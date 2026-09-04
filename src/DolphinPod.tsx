import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { getOceanWaveSample } from './oceanWavePhysics';
import { BoatSimState, EnvironmentType } from './types';

// Procedural multi-ring ocean ripple texture with foam crests
function createDolphinRippleTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 512;
	const ctx = canvas.getContext('2d')!;

	ctx.clearRect(0, 0, 512, 512);

	// Inner impact foam burst
	const innerGrad = ctx.createRadialGradient(256, 256, 4, 256, 256, 75);
	innerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
	innerGrad.addColorStop(0.35, 'rgba(230, 248, 255, 0.7)');
	innerGrad.addColorStop(0.7, 'rgba(200, 238, 255, 0.2)');
	innerGrad.addColorStop(1, 'rgba(180, 225, 255, 0.0)');
	ctx.fillStyle = innerGrad;
	ctx.beginPath();
	ctx.arc(256, 256, 75, 0, Math.PI * 2);
	ctx.fill();

	// Primary outer sharp wave ring
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
	ctx.lineWidth = 14;
	ctx.beginPath();
	ctx.arc(256, 256, 215, 0, Math.PI * 2);
	ctx.stroke();

	// Secondary wave ring
	ctx.strokeStyle = 'rgba(220, 245, 255, 0.75)';
	ctx.lineWidth = 18;
	ctx.beginPath();
	ctx.arc(256, 256, 160, 0, Math.PI * 2);
	ctx.stroke();

	// Tertiary inner wave ring
	ctx.strokeStyle = 'rgba(200, 235, 255, 0.55)';
	ctx.lineWidth = 12;
	ctx.beginPath();
	ctx.arc(256, 256, 110, 0, Math.PI * 2);
	ctx.stroke();

	// Subtle foam bubbles around perimeter
	for (let i = 0; i < 90; i++) {
		const angle = Math.random() * Math.PI * 2;
		const r = 130 + Math.random() * 95;
		const bx = 256 + Math.cos(angle) * r;
		const by = 256 + Math.sin(angle) * r;
		const size = Math.random() * 4.5 + 1.5;

		ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.7 + 0.3})`;
		ctx.beginPath();
		ctx.arc(bx, by, size, 0, Math.PI * 2);
		ctx.fill();
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

// Procedural water droplet spray texture
function createDolphinSprayTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 128;
	const ctx = canvas.getContext('2d')!;

	const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
	grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
	grad.addColorStop(0.3, 'rgba(235, 250, 255, 0.85)');
	grad.addColorStop(0.65, 'rgba(200, 240, 255, 0.3)');
	grad.addColorStop(1, 'rgba(180, 230, 255, 0.0)');

	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, 128, 128);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

interface DolphinInstanceProps {
	baseGeometry: THREE.BufferGeometry;
	baseMaterial: THREE.Material;
	scale: number;
	isNight: boolean;
	meshRefCallback: (mesh: THREE.Mesh | null) => void;
}

// Individual Animated Dolphin with true traveling-wave spinal kinematics
function DolphinInstance({
	baseGeometry,
	baseMaterial,
	scale,
	isNight,
	meshRefCallback,
}: DolphinInstanceProps) {
	const { dynamicGeom, basePositions } = useMemo(() => {
		const geom = baseGeometry.clone();
		const posAttr = geom.attributes.position;
		const baseArray = new Float32Array(posAttr.array);
		return { dynamicGeom: geom, basePositions: baseArray };
	}, [baseGeometry]);

	// Silky wet marine skin shader
	const dolphinMat = useMemo(() => {
		const mat = (baseMaterial as THREE.MeshStandardMaterial).clone();
		mat.roughness = 0.22;
		mat.metalness = 0.04;
		mat.envMapIntensity = 1.25;
		if (isNight) {
			mat.color = new THREE.Color('#94a3b8');
		} else {
			mat.color = new THREE.Color('#ffffff');
		}
		return mat;
	}, [baseMaterial, isNight]);

	return (
		<mesh
			ref={meshRefCallback}
			castShadow
			receiveShadow
			geometry={dynamicGeom}
			material={dolphinMat}
			scale={[scale, scale, scale]}
			userData={{ basePositions }}
		/>
	);
}

export interface DolphinPodProps {
	boatState: BoatSimState;
	environment: EnvironmentType;
}

interface DolphinEntity {
	id: number;
	x: number;
	y: number;
	z: number;
	heading: number;
	pitch: number;
	roll: number;
	speed: number;
	size: number;
	slotForward: number;
	slotSide: number;
	phase: number;
	leapInterval: number;
	leapTimer: number;
	isLeaping: boolean;
	leapProgress: number;
	hasLaunched: boolean;
	hasPlunged: boolean;
	lastSurfaceWakeTime: number;
}

interface ActiveRipple {
	x: number;
	z: number;
	age: number;
	maxAge: number;
	baseSize: number;
	maxScale: number;
	opacity: number;
}

interface ActiveDroplet {
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	life: number;
	maxLife: number;
	size: number;
}

const MAX_RIPPLES = 48;
const MAX_DROPLETS = 160;

export function DolphinPod({ boatState, environment }: DolphinPodProps) {
	const gltf = useGLTF('/dolphin.glb');
	const isNight = environment === 'night_sky';

	const rippleTexture = useMemo(() => createDolphinRippleTexture(), []);
	const sprayTexture = useMemo(() => createDolphinSprayTexture(), []);

	const rippleMeshRef = useRef<THREE.InstancedMesh>(null);
	const dropletMeshRef = useRef<THREE.InstancedMesh>(null);

	const ripplesRef = useRef<ActiveRipple[]>([]);
	const dropletsRef = useRef<ActiveDroplet[]>([]);

	const rippleDummy = useMemo(() => new THREE.Object3D(), []);
	const dropletDummy = useMemo(() => new THREE.Object3D(), []);

	// Extract, align, and center the GLB mesh geometry
	const { baseGeometry, baseMaterial } = useMemo(() => {
		let foundMesh: THREE.Mesh | null = null;
		gltf.scene.traverse((child) => {
			if ((child as THREE.Mesh).isMesh && !foundMesh) {
				foundMesh = child as THREE.Mesh;
			}
		});

		if (foundMesh) {
			const mesh = foundMesh as THREE.Mesh;
			const geom = mesh.geometry.clone();
			// Correct raw export tilt (-50 deg on X) so body spine is horizontal along Z
			geom.rotateX(-50 * (Math.PI / 180));
			geom.center();
			geom.computeVertexNormals();
			return { baseGeometry: geom, baseMaterial: mesh.material as THREE.Material };
		}

		const fallbackGeom = new THREE.ConeGeometry(0.3, 2.0, 16);
		fallbackGeom.rotateX(Math.PI / 2);
		return {
			baseGeometry: fallbackGeom,
			baseMaterial: new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.3 }),
		};
	}, [gltf]);

	// Natural escort pod of 4 dolphins
	const podMembers = useMemo<DolphinEntity[]>(() => {
		return [
			{
				id: 0,
				x: 20,
				y: -3.8,
				z: 22,
				heading: 0,
				pitch: 0,
				roll: 0,
				speed: 5.0,
				size: 0.0112, // Adult ~2.5m
				slotForward: 22,
				slotSide: 18,
				phase: 0.0,
				leapInterval: 12.0,
				leapTimer: 5.0,
				isLeaping: false,
				leapProgress: 0,
				hasLaunched: false,
				hasPlunged: false,
				lastSurfaceWakeTime: 0,
			},
			{
				id: 1,
				x: -22,
				y: -3.8,
				z: 24,
				heading: 0,
				pitch: 0,
				roll: 0,
				speed: 5.0,
				size: 0.0108, // Adult ~2.4m
				slotForward: 26,
				slotSide: -20,
				phase: 2.1,
				leapInterval: 14.5,
				leapTimer: 10.0,
				isLeaping: false,
				leapProgress: 0,
				hasLaunched: false,
				hasPlunged: false,
				lastSurfaceWakeTime: 0,
			},
			{
				id: 2,
				x: -28,
				y: -3.8,
				z: -14,
				heading: 0,
				pitch: 0,
				roll: 0,
				speed: 4.8,
				size: 0.0118, // Large pod leader ~2.6m
				slotForward: -8,
				slotSide: -28,
				phase: 4.3,
				leapInterval: 18.0,
				leapTimer: 2.0,
				isLeaping: false,
				leapProgress: 0,
				hasLaunched: false,
				hasPlunged: false,
				lastSurfaceWakeTime: 0,
			},
			{
				id: 3,
				x: 26,
				y: -3.8,
				z: -6,
				heading: 0,
				pitch: 0,
				roll: 0,
				speed: 5.2,
				size: 0.0078, // Playful calf ~1.7m
				slotForward: 12,
				slotSide: 26,
				phase: 1.2,
				leapInterval: 10.0,
				leapTimer: 7.0,
				isLeaping: false,
				leapProgress: 0,
				hasLaunched: false,
				hasPlunged: false,
				lastSurfaceWakeTime: 0,
			},
		];
	}, []);

	const dolphinsRef = useRef<DolphinEntity[]>(podMembers);
	const dolphinMeshRefs = useRef<(THREE.Mesh | null)[]>([]);

	// Spawns expanding concentric surface ripple rings
	const spawnRipple = (x: number, z: number, baseSize: number, maxScale: number, duration: number, opacity: number) => {
		if (ripplesRef.current.length >= MAX_RIPPLES) {
			ripplesRef.current.shift(); // Evict oldest
		}
		ripplesRef.current.push({
			x,
			z,
			age: 0,
			maxAge: duration,
			baseSize,
			maxScale,
			opacity,
		});
	};

	// Spawns ballistic splash droplets & spray plumes
	const spawnSplashBurst = (x: number, y: number, z: number, count: number, baseSpeed: number, forwardAngle: number) => {
		const droplets = dropletsRef.current;
		for (let i = 0; i < count; i++) {
			if (droplets.length >= MAX_DROPLETS) {
				droplets.shift();
			}
			const spreadAngle = forwardAngle + (Math.random() - 0.5) * 1.8;
			const speed = baseSpeed * (0.6 + Math.random() * 0.8);
			const upwardSpeed = baseSpeed * (0.8 + Math.random() * 1.2);

			droplets.push({
				x: x + (Math.random() - 0.5) * 0.6,
				y: y + Math.random() * 0.2,
				z: z + (Math.random() - 0.5) * 0.6,
				vx: Math.sin(spreadAngle) * speed + (Math.random() - 0.5) * 0.8,
				vy: upwardSpeed,
				vz: Math.cos(spreadAngle) * speed + (Math.random() - 0.5) * 0.8,
				life: 0,
				maxLife: 0.8 + Math.random() * 0.6,
				size: 0.18 + Math.random() * 0.22,
			});
		}
	};

	useFrame((state, delta) => {
		const t = state.clock.getElapsedTime();
		const dt = Math.min(delta, 0.06);

		const boatSpeed = Math.abs(boatState.speed || 0);
		const boatHeading = boatState.heading || 0;

		const boatForwardX = Math.sin(boatHeading);
		const boatForwardZ = Math.cos(boatHeading);
		const boatRightX = Math.cos(boatHeading);
		const boatRightZ = -Math.sin(boatHeading);

		// --- 1. SIMULATE DOLPHIN KINEMATICS & ESCORT BEHAVIOR ---
		dolphinsRef.current.forEach((d, i) => {
			const mesh = dolphinMeshRefs.current[i];
			if (!mesh) return;

			// Natural orbital wander around the escort slot
			const wanderForward = Math.sin(t * 0.25 + d.phase) * 5.0;
			const wanderSide = Math.cos(t * 0.22 + d.phase * 1.5) * 4.0;

			const targetForwardDist = d.slotForward + wanderForward;
			const targetSideDist = d.slotSide + wanderSide;

			const targetX = boatState.x + boatForwardX * targetForwardDist + boatRightX * targetSideDist;
			const targetZ = boatState.z + boatForwardZ * targetForwardDist + boatRightZ * targetSideDist;

			// Steering physics: smooth, organic pursuit
			const dx = targetX - d.x;
			const dz = targetZ - d.z;
			const dist = Math.sqrt(dx * dx + dz * dz);

			const targetHeading = Math.atan2(dx, dz);

			let angleDiff = targetHeading - d.heading;
			while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
			while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

			const turnRate = Math.min(1.8, Math.max(0.6, 1.2 + dist * 0.05));
			d.heading += angleDiff * Math.min(1.0, turnRate * dt);

			// Smooth cruising speed matching vessel
			const cruiseSpeed = 4.2 + boatSpeed * 12.0;
			const catchUpFactor = Math.min(1.6, Math.max(0.7, 1.0 + (dist - 5.0) * 0.05));
			const targetSpeed = cruiseSpeed * catchUpFactor;
			d.speed += (targetSpeed - d.speed) * Math.min(1.0, 2.5 * dt);

			d.x += Math.sin(d.heading) * d.speed * dt;
			d.z += Math.cos(d.heading) * d.speed * dt;

			// Sample ocean Gerstner wave elevation at dolphin's position
			const waveSample = getOceanWaveSample(d.x, d.z, t);
			const waterSurfaceY = -2.96 + waveSample.height;

			// Leap trigger cycle
			d.leapTimer += dt;
			if (!d.isLeaping && d.leapTimer > d.leapInterval && dist < 40) {
				d.isLeaping = true;
				d.leapProgress = 0;
				d.leapTimer = 0;
				d.hasLaunched = false;
				d.hasPlunged = false;
			}

			let targetY = waterSurfaceY - 0.75;
			let targetPitch = 0;
			let targetRoll = -angleDiff * 0.35; // Natural banking into turns

			if (d.isLeaping) {
				d.leapProgress += dt / 1.65; // ~1.65s ballistic leap

				const p = d.leapProgress;
				const leapHeight = 2.2 * (d.size / 0.011);
				const arc = Math.sin(p * Math.PI);

				targetY = waterSurfaceY + arc * leapHeight - 0.55;
				// Tangential ballistic pitch: launch upward (+0.6 rad), crest (0 rad), dive headfirst downward (-0.65 rad)
				targetPitch = (0.45 - p) * 1.4;
				targetRoll += Math.sin(p * Math.PI) * 0.22 * (d.slotSide > 0 ? -1 : 1);

				// A. BREACH LAUNCH EVENT: Dolphin shoots upward through water surface (p ~ 0.12)
				if (p >= 0.12 && !d.hasLaunched) {
					d.hasLaunched = true;
					// Spawn launch wave ripples
					spawnRipple(d.x, d.z, 1.2 * (d.size / 0.011), 3.8, 2.8, 0.75);
					// Spawn launch water spray burst shooting up along forward trajectory
					spawnSplashBurst(d.x, waterSurfaceY + 0.05, d.z, 16, 4.5, d.heading);
				}

				// B. SPLASHDOWN PLUNGE EVENT: Dolphin dives headfirst back into water (p ~ 0.84)
				if (p >= 0.84 && !d.hasPlunged) {
					d.hasPlunged = true;
					// Spawn powerful splashdown wave ripples with white foam crest
					spawnRipple(d.x, d.z, 1.5 * (d.size / 0.011), 5.2, 3.4, 0.9);
					// Spawn energetic radial splash droplet plume
					spawnSplashBurst(d.x, waterSurfaceY + 0.05, d.z, 28, 5.8, d.heading + Math.PI);
				}

				if (d.leapProgress >= 1.0) {
					d.isLeaping = false;
					d.leapProgress = 0;
				}
			} else {
				// Smooth rhythmic porpoising beneath the surface
				const porpoiseCycle = Math.sin(t * 1.8 + d.phase);
				targetY = waterSurfaceY - 0.75 + porpoiseCycle * 0.42;
				// Pitch matches vertical motion derivative
				targetPitch = Math.cos(t * 1.8 + d.phase) * 0.22;

				// C. SURFACE SWIMMING WAKE: Dorsal fin breaks water surface
				const dorsalFinY = d.y + 0.35;
				if (dorsalFinY > waterSurfaceY - 0.12 && t - d.lastSurfaceWakeTime > 0.22) {
					d.lastSurfaceWakeTime = t;
					spawnRipple(d.x, d.z, 0.6 * (d.size / 0.011), 2.2, 1.6, 0.45);
				}
			}

			// Damped interpolation for silky smooth rotation transitions
			d.y += (targetY - d.y) * Math.min(1.0, 7.0 * dt);
			d.pitch += (targetPitch - d.pitch) * Math.min(1.0, 5.5 * dt);
			d.roll += (targetRoll - d.roll) * Math.min(1.0, 4.5 * dt);

			// Apply transform to dolphin mesh
			mesh.position.set(d.x, d.y, d.z);
			mesh.rotation.set(0, 0, 0);
			mesh.rotation.y = d.heading;
			mesh.rotation.x = d.pitch;
			mesh.rotation.z = d.roll;

			// Biological Traveling-Wave Spinal Flexion on Geometry Vertices
			const strokeFreq = d.isLeaping ? 2.5 : 3.8 * (0.8 + (boatSpeed / 10.0) * 0.8);
			const strokePhase = t * strokeFreq + d.phase;
			const turnLateralBend = -angleDiff * 1.0;

			const posAttr = mesh.geometry.attributes.position;
			const basePositions = mesh.userData.basePositions as Float32Array;

			if (posAttr && basePositions) {
				const count = posAttr.count;
				const posArr = posAttr.array as Float32Array;
				for (let v = 0; v < count; v++) {
					const idx = v * 3;
					const origX = basePositions[idx];
					const origY = basePositions[idx + 1];
					const origZ = basePositions[idx + 2];

					if (origZ < 15) {
						const tailT = (15 - origZ) * 0.0079365;
						const tailFlex = tailT * tailT * Math.sqrt(tailT);
						const waveOffset = tailT * 2.2;
						const waveY = Math.sin(strokePhase - waveOffset);

						posArr[idx + 1] = origY + waveY * tailFlex * 15.0;
						posArr[idx] = origX + turnLateralBend * tailFlex * 12.0;
					} else {
						posArr[idx + 1] = origY;
						posArr[idx] = origX;
					}
				}
				posAttr.needsUpdate = true;
			}
		});

		// --- 2. STEP & RENDER EXPANDING CONCENTRIC SURFACE RIPPLES ---
		const ripples = ripplesRef.current;
		let aliveRippleCount = 0;

		for (let i = 0; i < ripples.length; i++) {
			const r = ripples[i];
			r.age += dt;

			if (r.age < r.maxAge && aliveRippleCount < MAX_RIPPLES) {
				const progress = r.age / r.maxAge;
				// Natural wave expansion curve: fast initial burst, then steady expansion
				const scaleProgress = 1.0 - Math.pow(1.0 - progress, 1.6);
				const currentRadius = r.baseSize + (r.maxScale - r.baseSize) * scaleProgress;

				// Temporal opacity fade: sharp onset, smooth quadratic decay
				const alpha = r.opacity * Math.sin((1.0 - progress) * Math.PI * 0.5);

				// Sample wave surface height at ripple center for exact water plane alignment
				const localWave = getOceanWaveSample(r.x, r.z, t);
				const waveY = -2.96 + localWave.height + 0.02; // Float micro-offset above water plane

				if (rippleMeshRef.current) {
					rippleDummy.position.set(r.x, waveY, r.z);
					rippleDummy.rotation.set(-Math.PI / 2, 0, (r.x + r.z) * 0.1);
					rippleDummy.scale.set(currentRadius * alpha, currentRadius * alpha, 1);
					rippleDummy.updateMatrix();
					rippleMeshRef.current.setMatrixAt(aliveRippleCount, rippleDummy.matrix);
				}

				ripples[aliveRippleCount] = r;
				aliveRippleCount++;
			}
		}
		ripples.length = aliveRippleCount;

		// Clear remaining inactive ripple instances
		if (rippleMeshRef.current) {
			for (let i = aliveRippleCount; i < MAX_RIPPLES; i++) {
				rippleDummy.position.set(0, -9999, 0);
				rippleDummy.scale.set(0, 0, 0);
				rippleDummy.updateMatrix();
				rippleMeshRef.current.setMatrixAt(i, rippleDummy.matrix);
			}
			rippleMeshRef.current.instanceMatrix.needsUpdate = true;
		}

		// --- 3. STEP & RENDER BALLISTIC SPLASH DROPLET PARTICLES ---
		const droplets = dropletsRef.current;
		let aliveDropletCount = 0;

		for (let i = 0; i < droplets.length; i++) {
			const d = droplets[i];
			d.life += dt;

			if (d.life < d.maxLife && aliveDropletCount < MAX_DROPLETS) {
				// Ballistic physics integration with gravity and aerodynamic drag
				d.vy -= 9.81 * dt;
				d.vx *= 0.985;
				d.vz *= 0.985;

				d.x += d.vx * dt;
				d.y += d.vy * dt;
				d.z += d.vz * dt;

				const progress = d.life / d.maxLife;
				const localWave = getOceanWaveSample(d.x, d.z, t);
				const waterLevel = -2.96 + localWave.height;

				// Splashdown impact test: droplet hits water surface
				if (d.y <= waterLevel) {
					// Spawn micro splash ring on impact
					if (d.vy < -1.5) {
						spawnRipple(d.x, d.z, 0.25, 0.8, 0.8, 0.35);
					}
					// Terminate droplet
					continue;
				}

				const size = d.size * (1.0 - progress * 0.5);
				const opacity = Math.sin((1.0 - progress) * Math.PI * 0.5);

				if (dropletMeshRef.current) {
					dropletDummy.position.set(d.x, d.y, d.z);
					dropletDummy.quaternion.copy(state.camera.quaternion);
					dropletDummy.scale.set(size * opacity, size * opacity, 1);
					dropletDummy.updateMatrix();
					dropletMeshRef.current.setMatrixAt(aliveDropletCount, dropletDummy.matrix);
				}

				droplets[aliveDropletCount] = d;
				aliveDropletCount++;
			}
		}
		droplets.length = aliveDropletCount;

		// Clear remaining inactive droplet instances
		if (dropletMeshRef.current) {
			for (let i = aliveDropletCount; i < MAX_DROPLETS; i++) {
				dropletDummy.position.set(0, -9999, 0);
				dropletDummy.scale.set(0, 0, 0);
				dropletDummy.updateMatrix();
				dropletMeshRef.current.setMatrixAt(i, dropletDummy.matrix);
			}
			dropletMeshRef.current.instanceMatrix.needsUpdate = true;
		}
	});

	return (
		<group>
			{/* Cloned, Aligned Dolphin Instances */}
			{dolphinsRef.current.map((d, i) => (
				<DolphinInstance
					key={d.id}
					baseGeometry={baseGeometry}
					baseMaterial={baseMaterial}
					scale={d.size}
					isNight={isNight}
					meshRefCallback={(el) => (dolphinMeshRefs.current[i] = el)}
				/>
			))}

			{/* High-Visibility Concentric Dolphin Surface Ripples & Breach Foam Rings */}
			<instancedMesh
				ref={rippleMeshRef}
				args={[undefined, undefined, MAX_RIPPLES]}
				frustumCulled={false}
			>
				<planeGeometry args={[1, 1]} />
				<meshBasicMaterial
					map={rippleTexture}
					transparent
					opacity={0.85}
					depthWrite={false}
					blending={THREE.NormalBlending}
					side={THREE.DoubleSide}
				/>
			</instancedMesh>

			{/* Airborne Splash Droplets & Water Mist Plumes */}
			<instancedMesh
				ref={dropletMeshRef}
				args={[undefined, undefined, MAX_DROPLETS]}
				frustumCulled={false}
			>
				<planeGeometry args={[1, 1]} />
				<meshBasicMaterial
					map={sprayTexture}
					transparent
					opacity={0.9}
					depthWrite={false}
					blending={THREE.NormalBlending}
				/>
			</instancedMesh>
		</group>
	);
}

useGLTF.preload('/dolphin.glb');
export default DolphinPod;
