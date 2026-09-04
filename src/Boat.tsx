import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { GLTF } from 'three-stdlib';

type GLTFResult = GLTF & {
	nodes: {
		Plane004_Boat_0_1?: THREE.Mesh;
		Plane004_Boat_0_2?: THREE.Mesh;
		['Plane.004_Boat_0_1']?: THREE.Mesh;
		['Plane.004_Boat_0_2']?: THREE.Mesh;
	};
	materials: {
		Surface: THREE.MeshStandardMaterial;
		cloth: THREE.MeshStandardMaterial;
	};
};

// Generates natural weathered organic wood grain texture (matte cedar / oak)
function createWeatheredWoodTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 1024;
	const ctx = canvas.getContext('2d')!;

	// Natural warm weathered timber base tone (authentic boat wood, non-plastic)
	ctx.fillStyle = '#9b7653';
	ctx.fillRect(0, 0, 1024, 1024);

	// Organic plank grain streaks
	for (let y = 0; y < 1024; y += 48) {
		// Subtle plank seam shadow
		ctx.fillStyle = 'rgba(50, 32, 18, 0.45)';
		ctx.fillRect(0, y, 1024, 2);

		// Soft sun-bleached edge
		ctx.fillStyle = 'rgba(210, 180, 140, 0.2)';
		ctx.fillRect(0, y + 2, 1024, 1);
	}

	// Fine natural timber fibers
	for (let i = 0; i < 9000; i++) {
		const x = Math.random() * 1024;
		const y = Math.random() * 1024;
		const len = Math.random() * 120 + 30;
		const alpha = Math.random() * 0.12 + 0.02;
		const isDark = Math.random() > 0.5;

		ctx.fillStyle = isDark
			? `rgba(55, 35, 20, ${alpha})`
			: `rgba(205, 175, 135, ${alpha})`;
		ctx.fillRect(x, y, len, 1.2);
	}

	// Soft natural wood knots
	for (let k = 0; k < 8; k++) {
		const kx = Math.random() * 900 + 60;
		const ky = Math.random() * 900 + 60;
		const grad = ctx.createRadialGradient(kx, ky, 2, kx, ky, 28);
		grad.addColorStop(0, 'rgba(60, 38, 22, 0.4)');
		grad.addColorStop(0.5, 'rgba(110, 75, 45, 0.15)');
		grad.addColorStop(1, 'rgba(155, 118, 83, 0)');
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(kx, ky, 28, 0, Math.PI * 2);
		ctx.fill();
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(3, 3);
	texture.needsUpdate = true;
	return texture;
}

// Generates fine woven linen canvas sail texture with natural matte fibers
function createRealisticSailClothTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 512;
	const ctx = canvas.getContext('2d')!;

	// Authentic matte maritime linen canvas tone
	ctx.fillStyle = '#f5f0e6';
	ctx.fillRect(0, 0, 512, 512);

	// Fabric weave cross-hatching
	ctx.fillStyle = 'rgba(150, 138, 120, 0.1)';
	for (let x = 0; x < 512; x += 3) {
		ctx.fillRect(x, 0, 1, 512);
	}
	for (let y = 0; y < 512; y += 3) {
		ctx.fillRect(0, y, 512, 1);
	}

	// Micro-fibers
	for (let i = 0; i < 5000; i++) {
		const x = Math.random() * 512;
		const y = Math.random() * 512;
		const alpha = Math.random() * 0.12 + 0.03;
		ctx.fillStyle = Math.random() > 0.5 ? `rgba(255, 255, 255, ${alpha})` : `rgba(160, 145, 125, ${alpha})`;
		ctx.fillRect(x, y, 2, 1.5);
	}

	// Sail panel seams and reinforcement stitching
	const seamPositions = [128, 256, 384];
	for (const sy of seamPositions) {
		ctx.fillStyle = 'rgba(110, 95, 75, 0.3)';
		ctx.fillRect(0, sy - 1, 512, 2);

		ctx.fillStyle = 'rgba(80, 68, 52, 0.45)';
		for (let sx = 0; sx < 512; sx += 8) {
			ctx.fillRect(sx, sy - 3, 3, 1.2);
			ctx.fillRect(sx + 4, sy + 3, 3, 1.2);
		}
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(2, 2);
	texture.needsUpdate = true;
	return texture;
}

// Enhanced Wooden Boat Hull Component with authentic matte timber shading
function WoodenHullMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
	const woodTexture = useMemo(() => createWeatheredWoodTexture(), []);

	const woodMaterial = useMemo(() => {
		const mat = new THREE.MeshStandardMaterial({
			map: woodTexture,
			color: new THREE.Color('#946b45'), // Natural seasoned teak & oak wood
			roughness: 0.92,                   // Fully matte wood surface - eliminates plastic sheen
			metalness: 0.0,                    // Non-metallic timber
			envMapIntensity: 0.4,              // Soft diffuse ambient light without harsh plastic glints
		});

		// Add custom ambient shading for crevices and sunlight depth
		mat.onBeforeCompile = (shader) => {
			shader.vertexShader = `
				varying vec3 vModelPos;
				varying vec3 vWorldNorm;
				${shader.vertexShader}
			`;

			shader.vertexShader = shader.vertexShader.replace(
				'#include <begin_vertex>',
				`
				#include <begin_vertex>
				vModelPos = position;
				vWorldNorm = normal;
				`
			);

			shader.fragmentShader = `
				varying vec3 vModelPos;
				varying vec3 vWorldNorm;
				${shader.fragmentShader}
			`;

			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <dithering_fragment>',
				`
				#include <dithering_fragment>

				// 1. Natural Wood Shading Variations across Hull vs Deck vs Mast:
				// - Deck / top floor (Y between 0.3 and 1.2): slightly sun-weathered golden wood
				// - Inner hull floor & lower crevices (Y < 0.3): soft ambient occlusion shadow
				// - Mast & oars: distinct natural timber warmth
				
				float heightFactor = clamp((vModelPos.y - 0.2) / 2.5, 0.0, 1.0);
				
				// Crevice ambient occlusion in inner hull & under ribs
				float innerOcclusion = smoothstep(-0.2, 0.8, vModelPos.y);
				float creviceAO = mix(0.72, 1.0, innerOcclusion);

				// Sun bleaching on top surfaces (upward facing normals)
				float upFacing = max(0.0, vWorldNorm.y);
				vec3 sunBleachColor = vec3(1.08, 1.05, 0.98);

				gl_FragColor.rgb *= creviceAO;
				gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * sunBleachColor, upFacing * 0.15);
				`
			);
		};

		return mat;
	}, [woodTexture]);

	return (
		<mesh
			castShadow
			receiveShadow
			geometry={geometry}
			material={woodMaterial}
		/>
	);
}

// Dynamic Cloth Simulation Sail Component
function ClothSailMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
	const sailClothTexture = useMemo(() => createRealisticSailClothTexture(), []);
	const uniformsRef = useRef<{ uTime: { value: number }; uWindStrength: { value: number } }>({
		uTime: { value: 0 },
		uWindStrength: { value: 1.0 },
	});

	const customSailMaterial = useMemo(() => {
		const mat = new THREE.MeshStandardMaterial({
			map: sailClothTexture,
			color: new THREE.Color('#faf5ec'), // Soft natural maritime linen
			roughness: 0.94,                   // Matte woven cloth - completely non-plastic
			metalness: 0.0,
			side: THREE.DoubleSide,
			shadowSide: THREE.DoubleSide,
			envMapIntensity: 0.3,
		});

		mat.onBeforeCompile = (shader) => {
			shader.uniforms.uTime = uniformsRef.current.uTime;
			shader.uniforms.uWindStrength = uniformsRef.current.uWindStrength;

			shader.vertexShader = `
				uniform float uTime;
				uniform float uWindStrength;
				${shader.vertexShader}
			`;

			shader.vertexShader = shader.vertexShader.replace(
				'#include <begin_vertex>',
				`
				#include <begin_vertex>

				float normY = clamp((position.y - 2.4) / 7.6, 0.0, 1.0);
				float normZ = clamp((position.z + 2.7) / 7.9, 0.0, 1.0);
				
				float mastDist = length(vec2(position.x, position.z + 1.2));
				float pinFactor = smoothstep(0.15, 1.8, mastDist) * sin(normY * 3.14159);
				pinFactor = clamp(pinFactor, 0.0, 1.0);

				// Aerodynamic Wind Belly Billow
				float baseBillow = sin(normY * 3.14159) * sin(normZ * 3.14159) * 0.38 * uWindStrength;

				// Dynamic Traveling Wind Waves & Cloth Flutter Ripples
				float wave1 = sin(uTime * 3.8 + position.z * 1.6 + position.y * 1.1) * 0.055;
				float wave2 = sin(uTime * 6.5 - position.z * 3.0 + position.y * 1.8) * 0.028;
				float wave3 = sin(uTime * 11.0 + position.z * 5.5 + position.y * 3.2) * 0.014;

				// Free Leech Edge Flutter
				float edgeFlutter = pow(normZ, 2.2) * sin(uTime * 14.0 + position.y * 4.0) * 0.045;

				float totalDisplacement = (baseBillow + wave1 + wave2 + wave3 + edgeFlutter) * pinFactor;

				transformed.x += totalDisplacement * 0.95;
				transformed.z += totalDisplacement * 0.2 * sin(normY * 3.14159);
				transformed.y += sin(uTime * 2.5 + position.z * 1.8) * 0.012 * pinFactor;
				`
			);

			shader.vertexShader = shader.vertexShader.replace(
				'#include <beginnormal_vertex>',
				`
				#include <beginnormal_vertex>
				
				float normY_n = clamp((position.y - 2.4) / 7.6, 0.0, 1.0);
				float pinFactor_n = smoothstep(0.15, 1.8, length(vec2(position.x, position.z + 1.2))) * sin(normY_n * 3.14159);

				float dWave = (cos(uTime * 3.8 + position.z * 1.6) * 0.09 + cos(uTime * 6.5 - position.z * 3.0) * 0.06) * pinFactor_n;
				objectNormal.x += dWave;
				objectNormal.z += -dWave * 0.28;
				objectNormal = normalize(objectNormal);
				`
			);
		};

		return mat;
	}, [sailClothTexture]);

	useFrame((state) => {
		const t = state.clock.getElapsedTime();
		uniformsRef.current.uTime.value = t;
		uniformsRef.current.uWindStrength.value = 1.0 + Math.sin(t * 0.6) * 0.2 + Math.sin(t * 1.8) * 0.1;
	});

	return (
		<mesh
			castShadow
			receiveShadow
			geometry={geometry}
			material={customSailMaterial}
		/>
	);
}

export function Boat(props: JSX.IntrinsicElements['group']) {
	const gltf = useGLTF('/boat.glb') as unknown as GLTFResult;
	const { nodes, scene } = gltf;

	const mesh1 = nodes?.Plane004_Boat_0_1 || nodes?.['Plane.004_Boat_0_1'];
	const mesh2 = nodes?.Plane004_Boat_0_2 || nodes?.['Plane.004_Boat_0_2'];

	// Rotate boat 180 degrees so the bow faces forward in the direction of travel
	if (mesh1 && mesh2) {
		return (
			<group {...props} dispose={null}>
				<group rotation={[0, Math.PI, 0]}>
					{/* 1. Natural Weathered Matte Timber Boat Hull, Thwarts & Oars (Non-Plastic) */}
					<WoodenHullMesh geometry={mesh1.geometry} />

					{/* 2. Realistic Dynamic Cloth-Simulated Sail (Matte Linen) */}
					<ClothSailMesh geometry={mesh2.geometry} />
				</group>
			</group>
		);
	}

	return (
		<group {...props} dispose={null}>
			<primitive object={scene} rotation={[0, Math.PI, 0]} />
		</group>
	);
}

useGLTF.preload('/boat.glb');
