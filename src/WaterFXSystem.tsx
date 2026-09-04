import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BoatSimState } from './types';
import { OceanPhysicsWasm } from './wasmOceanPhysics';
import { getOceanWaveSample } from './oceanWavePhysics';

// High-fidelity procedural water droplet & mist spray texture
function getRealisticDropletTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 128;
	const ctx = canvas.getContext('2d')!;

	// Soft outer mist halo
	const mistGrad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
	mistGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
	mistGrad.addColorStop(0.25, 'rgba(230, 248, 255, 0.6)');
	mistGrad.addColorStop(0.6, 'rgba(200, 235, 255, 0.15)');
	mistGrad.addColorStop(1, 'rgba(190, 230, 255, 0.0)');
	ctx.fillStyle = mistGrad;
	ctx.fillRect(0, 0, 128, 128);

	// Sharp water droplet cores with specular highlights
	const dropletCoords = [
		{ x: 64, y: 64, r: 8 },
		{ x: 50, y: 54, r: 5 },
		{ x: 76, y: 56, r: 5.5 },
		{ x: 54, y: 76, r: 4.5 },
		{ x: 74, y: 74, r: 5 },
	];

	for (const drop of dropletCoords) {
		const dropGrad = ctx.createRadialGradient(
			drop.x - drop.r * 0.3,
			drop.y - drop.r * 0.3,
			1,
			drop.x,
			drop.y,
			drop.r
		);
		dropGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
		dropGrad.addColorStop(0.4, 'rgba(230, 250, 255, 0.8)');
		dropGrad.addColorStop(0.8, 'rgba(190, 230, 255, 0.25)');
		dropGrad.addColorStop(1, 'rgba(180, 220, 255, 0.0)');

		ctx.fillStyle = dropGrad;
		ctx.beginPath();
		ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
		ctx.fill();
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

// Procedural multi-bubble ocean foam lattice texture
function getRealisticFoamTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 256;
	canvas.height = 256;
	const ctx = canvas.getContext('2d')!;

	// Base foam bloom
	const baseGrad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
	baseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
	baseGrad.addColorStop(0.35, 'rgba(235, 248, 255, 0.6)');
	baseGrad.addColorStop(0.7, 'rgba(210, 240, 255, 0.15)');
	baseGrad.addColorStop(1, 'rgba(200, 235, 255, 0.0)');
	ctx.fillStyle = baseGrad;
	ctx.fillRect(0, 0, 256, 256);

	// Organic micro-bubbles
	for (let i = 0; i < 75; i++) {
		const angle = Math.random() * Math.PI * 2;
		const dist = Math.pow(Math.random(), 0.7) * 85;
		const x = 128 + Math.cos(angle) * dist;
		const y = 128 + Math.sin(angle) * dist;
		const r = Math.random() * 5 + 1.2;

		const bubbleGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r);
		bubbleGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
		bubbleGrad.addColorStop(0.6, 'rgba(230, 245, 255, 0.35)');
		bubbleGrad.addColorStop(1, 'rgba(200, 235, 255, 0.0)');

		ctx.fillStyle = bubbleGrad;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

// Procedural natural refractive water ripple texture (delicate concentric rings)
function getRippleDiscTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 128;
	const ctx = canvas.getContext('2d')!;

	ctx.clearRect(0, 0, 128, 128);

	// Delicate concentric rings that fade outward
	const rings = [
		{ r: 18, w: 2.0, alpha: 0.35 },
		{ r: 34, w: 2.5, alpha: 0.22 },
		{ r: 50, w: 2.0, alpha: 0.12 },
	];

	for (const ring of rings) {
		ctx.strokeStyle = `rgba(220, 245, 255, ${ring.alpha})`;
		ctx.lineWidth = ring.w;
		ctx.beginPath();
		ctx.arc(64, 64, ring.r, 0, Math.PI * 2);
		ctx.stroke();
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

type Props = {
	boatState: BoatSimState;
};

export default function WaterFXSystem({ boatState }: Props) {
	// 1. Airborne Bow Spray & Splash Droplets (WASM Accelerated)
	const maxSpray = 220;
	const sprayMeshRef = useRef<THREE.InstancedMesh>(null);
	const sprayDummy = useMemo(() => new THREE.Object3D(), []);
	const sprayEngine = useMemo(() => new OceanPhysicsWasm(), []);
	const lastSpraySpawn = useRef(0);

	// 2. Churning Stern Wash & Propeller White-Water (WASM Accelerated)
	const maxWash = 160;
	const washMeshRef = useRef<THREE.InstancedMesh>(null);
	const washDummy = useMemo(() => new THREE.Object3D(), []);
	const washEngine = useMemo(() => new OceanPhysicsWasm(), []);
	const lastWashSpawn = useRef(0);

	// 3. Lateral Kelvin Wake Foam Wings (WASM Accelerated)
	const maxKelvin = 140;
	const kelvinMeshRef = useRef<THREE.InstancedMesh>(null);
	const kelvinDummy = useMemo(() => new THREE.Object3D(), []);
	const kelvinEngine = useMemo(() => new OceanPhysicsWasm(), []);
	const lastKelvinSpawn = useRef(0);

	// 4. Water Surface Ripples (Bow V-wake ripples & Idle Hull lap rings)
	const maxImpacts = 90;
	const impactMeshRef = useRef<THREE.InstancedMesh>(null);
	const impactDummy = useMemo(() => new THREE.Object3D(), []);
	const impactEngine = useMemo(() => new OceanPhysicsWasm(), []);
	const lastIdleRipple = useRef(0);
	const lastBowRipple = useRef(0);

	// Dynamic Bow Spray Sheet Mesh References (Port & Starboard)
	const portSpraySheetRef = useRef<THREE.Mesh>(null);
	const stbdSpraySheetRef = useRef<THREE.Mesh>(null);

	const dropletTexture = useMemo(() => getRealisticDropletTexture(), []);
	const foamTexture = useMemo(() => getRealisticFoamTexture(), []);
	const rippleTexture = useMemo(() => getRippleDiscTexture(), []);

	useFrame((state, delta) => {
		const dt = Math.min(delta, 0.08);
		const time = state.clock.getElapsedTime();
		const speed = boatState.speed;
		const speedMag = Math.abs(speed);

		// Hydrodynamic thresholds:
		// Only spray when actually cruising forward with authority
		const isCruising = speed > 0.18;
		const isMoving = speedMag > 0.05;

		const forwardX = Math.sin(boatState.heading);
		const forwardZ = Math.cos(boatState.heading);
		const rightX = Math.cos(boatState.heading);
		const rightZ = -Math.sin(boatState.heading);

		// Accurate hull waterline anchor coordinates
		const bowX = boatState.x + forwardX * 1.55;
		const bowZ = boatState.z + forwardZ * 1.55;
		const sternX = boatState.x - forwardX * 1.45;
		const sternZ = boatState.z - forwardZ * 1.45;

		// Sample ocean wave height at bow to check for wave crest chopping & impact
		const bowWave = getOceanWaveSample(bowX, bowZ, time);
		const isChoppingWave = speed > 0.25 && (bowWave.height > 0.1 || bowWave.crestFoam > 0.2);

		// --- 1. SPAWN BOW SPLASH & AIRBORNE SPRAY DROPLETS (ONLY WHEN CRUISING) ---
		if (isCruising && time - lastSpraySpawn.current > 0.045) {
			lastSpraySpawn.current = time;

			const sprayIntensity = (speed / 0.6) * (isChoppingWave ? 1.5 : 1.0);
			const numDrops = isChoppingWave ? 3 : 2;

			for (let d = 0; d < numDrops; d++) {
				// Port Side Bow Splash
				const portOffset = 0.32 + Math.random() * 0.1;
				const portLaunchSpeed = (1.0 + Math.random() * 1.2) * sprayIntensity;
				const portUpward = (0.4 + Math.random() * 0.5) * sprayIntensity;

				sprayEngine.spawnParticle(
					bowX - rightX * portOffset + (Math.random() - 0.5) * 0.1,
					boatState.y + 0.18 + Math.random() * 0.05,
					bowZ - rightZ * portOffset + (Math.random() - 0.5) * 0.1,
					-rightX * portLaunchSpeed + forwardX * (speed * 2.2),
					portUpward,
					-rightZ * portLaunchSpeed + forwardZ * (speed * 2.2),
					0,
					0.45 + Math.random() * 0.25,
					0.3 + sprayIntensity * 0.3 + Math.random() * 0.15,
					Math.random() * Math.PI * 2
				);

				// Starboard Side Bow Splash
				const stbdOffset = 0.32 + Math.random() * 0.1;
				const stbdLaunchSpeed = (1.0 + Math.random() * 1.2) * sprayIntensity;
				const stbdUpward = (0.4 + Math.random() * 0.5) * sprayIntensity;

				sprayEngine.spawnParticle(
					bowX + rightX * stbdOffset + (Math.random() - 0.5) * 0.1,
					boatState.y + 0.18 + Math.random() * 0.05,
					bowZ + rightZ * stbdOffset + (Math.random() - 0.5) * 0.1,
					rightX * stbdLaunchSpeed + forwardX * (speed * 2.2),
					stbdUpward,
					rightZ * stbdLaunchSpeed + forwardZ * (speed * 2.2),
					0,
					0.45 + Math.random() * 0.25,
					0.3 + sprayIntensity * 0.3 + Math.random() * 0.15,
					Math.random() * Math.PI * 2
				);
			}
		}

		// --- 2. UPDATE BOW SPRAY SHEET FAN MESHES ---
		const targetSheetScale = isCruising ? Math.min(1.8, speedMag * 2.2 * (isChoppingWave ? 1.3 : 1.0)) : 0;
		const spraySheetScale = THREE.MathUtils.lerp(
			portSpraySheetRef.current?.scale.x || 0,
			targetSheetScale,
			dt * 6.0
		);

		if (portSpraySheetRef.current && stbdSpraySheetRef.current) {
			// Port sheet
			portSpraySheetRef.current.position.set(
				bowX - rightX * 0.38,
				boatState.y + 0.14,
				bowZ - rightZ * 0.38
			);
			portSpraySheetRef.current.rotation.set(0, boatState.heading - 0.38, 0.3);
			portSpraySheetRef.current.scale.set(spraySheetScale * 0.65, spraySheetScale * 0.9, spraySheetScale);

			// Starboard sheet
			stbdSpraySheetRef.current.position.set(
				bowX + rightX * 0.38,
				boatState.y + 0.14,
				bowZ + rightZ * 0.38
			);
			stbdSpraySheetRef.current.rotation.set(0, boatState.heading + 0.38, -0.3);
			stbdSpraySheetRef.current.scale.set(spraySheetScale * 0.65, spraySheetScale * 0.9, spraySheetScale);
		}

		// --- 3. SPAWN STERN PROPELLER WASH (ONLY WHEN MOVING) ---
		if (isMoving && time - lastWashSpawn.current > 0.048) {
			lastWashSpawn.current = time;

			const washWave = getOceanWaveSample(sternX, sternZ, time);
			washEngine.spawnParticle(
				sternX + (Math.random() - 0.5) * 0.35,
				-2.96 + washWave.height * 0.4,
				sternZ + (Math.random() - 0.5) * 0.35,
				(Math.random() - 0.5) * 0.15 - forwardX * (speed * 0.3),
				0,
				(Math.random() - 0.5) * 0.15 - forwardZ * (speed * 0.3),
				0,
				2.2 + Math.random() * 1.0,
				0.6 + speedMag * 1.5 + Math.random() * 0.3,
				Math.random() * Math.PI * 2
			);
		}

		// --- 4. SPAWN LATERAL KELVIN WAKE FOAM ARMS ---
		if (speedMag > 0.15 && time - lastKelvinSpawn.current > 0.075) {
			lastKelvinSpawn.current = time;

			const spreadOffset = 0.45 + speedMag * 0.45;
			const pX = sternX - rightX * spreadOffset;
			const pZ = sternZ - rightZ * spreadOffset;
			const sX = sternX + rightX * spreadOffset;
			const sZ = sternZ + rightZ * spreadOffset;

			const pWave = getOceanWaveSample(pX, pZ, time);
			const sWave = getOceanWaveSample(sX, sZ, time);

			kelvinEngine.spawnParticle(
				pX,
				-2.96 + pWave.height * 0.4,
				pZ,
				-rightX * (0.24 + speedMag * 0.35),
				0,
				-rightZ * (0.24 + speedMag * 0.35),
				0,
				2.5 + Math.random() * 1.0,
				0.6 + speedMag * 1.1,
				Math.random() * Math.PI * 2
			);

			kelvinEngine.spawnParticle(
				sX,
				-2.96 + sWave.height * 0.4,
				sZ,
				rightX * (0.24 + speedMag * 0.35),
				0,
				rightZ * (0.24 + speedMag * 0.35),
				0,
				2.5 + Math.random() * 1.0,
				0.6 + speedMag * 1.1,
				Math.random() * Math.PI * 2
			);
		}

		// --- 5. SPAWN WATER RIPPLES (TIMED PROPERLY AT BOW AND IDLE) ---
		// A. Hydrodynamic Bow Wake Ripples while cutting water
		if (isMoving && time - lastBowRipple.current > 0.12) {
			lastBowRipple.current = time;
			const localWave = getOceanWaveSample(bowX, bowZ, time);
			impactEngine.spawnParticle(
				bowX,
				-2.96 + localWave.height + 0.01,
				bowZ,
				forwardX * (speed * 0.2),
				0,
				forwardZ * (speed * 0.2),
				0,
				1.2 + speedMag * 0.8,
				0.6 + speedMag * 0.8,
				Math.random() * Math.PI * 2
			);
		}

		// B. Gentle Idle Water Lapping Rings when stationary/drifting
		if (!isMoving && time - lastIdleRipple.current > 1.8) {
			lastIdleRipple.current = time;
			const midWave = getOceanWaveSample(boatState.x, boatState.z, time);
			impactEngine.spawnParticle(
				boatState.x,
				-2.96 + midWave.height + 0.01,
				boatState.z,
				0, 0, 0,
				0,
				2.2,
				0.8,
				Math.random() * Math.PI * 2
			);
		}

		// --- 6. STEP AND RENDER INSTANCED MATRICES ---

		// A. Bow Spray Droplets
		if (sprayMeshRef.current) {
			const activeSpray = sprayEngine.stepParticles(dt, 5.0, 0.985, 3.2, (i, x, y, z, scale, opacity, rot, progress) => {
				if (i < maxSpray) {
					// Check for ocean surface splashdown impact
					const localWave = getOceanWaveSample(x, z, time);
					const waterLevel = -2.96 + localWave.height;

					if (y <= waterLevel && progress < 0.8) {
						// Spawn water impact ripple
						impactEngine.spawnParticle(
							x, waterLevel + 0.01, z,
							0, 0, 0,
							0, 0.7 + Math.random() * 0.25,
							scale * 0.7,
							Math.random() * Math.PI * 2
						);
					}

					sprayDummy.position.set(x, y, z);
					sprayDummy.quaternion.copy(state.camera.quaternion);
					sprayDummy.scale.set(scale * Math.max(0, opacity), scale * Math.max(0, opacity), 1);
					sprayDummy.updateMatrix();
					sprayMeshRef.current!.setMatrixAt(i, sprayDummy.matrix);
				}
			});

			for (let i = activeSpray; i < maxSpray; i++) {
				sprayDummy.position.set(0, -9999, 0);
				sprayDummy.scale.set(0, 0, 0);
				sprayDummy.updateMatrix();
				sprayMeshRef.current.setMatrixAt(i, sprayDummy.matrix);
			}
			sprayMeshRef.current.instanceMatrix.needsUpdate = true;
		}

		// B. Natural Water Ripples (Expanding concentric wave rings)
		if (impactMeshRef.current) {
			const activeImpacts = impactEngine.stepParticles(dt, 0, 0.98, 0, (i, x, y, z, scale, opacity, rot, progress) => {
				if (i < maxImpacts) {
					impactDummy.position.set(x, y, z);
					impactDummy.rotation.set(-Math.PI / 2, 0, rot);
					const expandScale = scale * (1.0 + progress * 2.2);
					const fadeAlpha = opacity * (1.0 - progress * 0.85);
					impactDummy.scale.set(expandScale * Math.max(0, fadeAlpha), expandScale * Math.max(0, fadeAlpha), 1);
					impactDummy.updateMatrix();
					impactMeshRef.current!.setMatrixAt(i, impactDummy.matrix);
				}
			});

			for (let i = activeImpacts; i < maxImpacts; i++) {
				impactDummy.position.set(0, -9999, 0);
				impactDummy.scale.set(0, 0, 0);
				impactDummy.updateMatrix();
				impactMeshRef.current.setMatrixAt(i, impactDummy.matrix);
			}
			impactMeshRef.current.instanceMatrix.needsUpdate = true;
		}

		// C. Stern Wash & Propeller White-Water Foam
		if (washMeshRef.current) {
			const activeWash = washEngine.stepParticles(dt, 0, 0.95, 0.12, (i, x, y, z, scale, opacity, rot) => {
				if (i < maxWash) {
					washDummy.position.set(x, y, z);
					washDummy.rotation.set(-Math.PI / 2, 0, rot);
					washDummy.scale.set(scale * Math.max(0, opacity), scale * Math.max(0, opacity), 1);
					washDummy.updateMatrix();
					washMeshRef.current!.setMatrixAt(i, washDummy.matrix);
				}
			});

			for (let i = activeWash; i < maxWash; i++) {
				washDummy.position.set(0, -9999, 0);
				washDummy.scale.set(0, 0, 0);
				washDummy.updateMatrix();
				washMeshRef.current.setMatrixAt(i, washDummy.matrix);
			}
			washMeshRef.current.instanceMatrix.needsUpdate = true;
		}

		// D. Lateral Kelvin Wake Foam Wings
		if (kelvinMeshRef.current) {
			const activeKelvin = kelvinEngine.stepParticles(dt, 0, 0.96, 0.08, (i, x, y, z, scale, opacity, rot) => {
				if (i < maxKelvin) {
					kelvinDummy.position.set(x, y, z);
					kelvinDummy.rotation.set(-Math.PI / 2, 0, rot);
					kelvinDummy.scale.set(scale * Math.max(0, opacity), scale * Math.max(0, opacity), 1);
					kelvinDummy.updateMatrix();
					kelvinMeshRef.current!.setMatrixAt(i, kelvinDummy.matrix);
				}
			});

			for (let i = activeKelvin; i < maxKelvin; i++) {
				kelvinDummy.position.set(0, -9999, 0);
				kelvinDummy.scale.set(0, 0, 0);
				kelvinDummy.updateMatrix();
				kelvinMeshRef.current.setMatrixAt(i, kelvinDummy.matrix);
			}
			kelvinMeshRef.current.instanceMatrix.needsUpdate = true;
		}
	});

	return (
		<group>
			{/* 1. Dynamic Translucent Bow Spray Fan Sheets (Port & Starboard) */}
			<mesh ref={portSpraySheetRef} frustumCulled={false}>
				<planeGeometry args={[0.6, 1.0]} />
				<meshBasicMaterial
					map={dropletTexture}
					transparent
					opacity={0.4}
					depthWrite={false}
					side={THREE.DoubleSide}
					blending={THREE.NormalBlending}
				/>
			</mesh>
			<mesh ref={stbdSpraySheetRef} frustumCulled={false}>
				<planeGeometry args={[0.6, 1.0]} />
				<meshBasicMaterial
					map={dropletTexture}
					transparent
					opacity={0.4}
					depthWrite={false}
					side={THREE.DoubleSide}
					blending={THREE.NormalBlending}
				/>
			</mesh>

			{/* 2. Airborne Bow Spray & Mist Droplets */}
			<instancedMesh
				ref={sprayMeshRef}
				args={[undefined, undefined, maxSpray]}
				frustumCulled={false}
			>
				<planeGeometry args={[1, 1]} />
				<meshBasicMaterial
					map={dropletTexture}
					transparent
					opacity={0.55}
					depthWrite={false}
					blending={THREE.NormalBlending}
				/>
			</instancedMesh>

			{/* 3. Natural Water Ripples (Concentric Refractive Waves) */}
			<instancedMesh
				ref={impactMeshRef}
				args={[undefined, undefined, maxImpacts]}
				frustumCulled={false}
			>
				<planeGeometry args={[1, 1]} />
				<meshBasicMaterial
					map={rippleTexture}
					transparent
					opacity={0.35}
					depthWrite={false}
					blending={THREE.NormalBlending}
				/>
			</instancedMesh>

			{/* 4. Stern Propeller Churn White-Water Wash */}
			<instancedMesh
				ref={washMeshRef}
				args={[undefined, undefined, maxWash]}
				frustumCulled={false}
			>
				<planeGeometry args={[1, 1]} />
				<meshBasicMaterial
					map={foamTexture}
					transparent
					opacity={0.55}
					depthWrite={false}
					blending={THREE.NormalBlending}
				/>
			</instancedMesh>

			{/* 5. Lateral Kelvin Wake Foam Wings */}
			<instancedMesh
				ref={kelvinMeshRef}
				args={[undefined, undefined, maxKelvin]}
				frustumCulled={false}
			>
				<planeGeometry args={[1, 1]} />
				<meshBasicMaterial
					map={foamTexture}
					transparent
					opacity={0.5}
					depthWrite={false}
					blending={THREE.NormalBlending}
				/>
			</instancedMesh>
		</group>
	);
}
