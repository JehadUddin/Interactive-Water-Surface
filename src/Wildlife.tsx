import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Single Articulated Seagull with Feathered Wings
function SeagullRig({
	wingFlapAngle,
	glideTilt,
}: {
	wingFlapAngle: number;
	glideTilt: number;
}) {
	const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.7 }), []);
	const wingMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.6 }), []);
	const wingTipMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5 }), []);
	const beakMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.4 }), []);

	return (
		<group rotation-z={glideTilt}>
			{/* Streamlined Body */}
			<mesh scale={[0.16, 0.12, 0.55]}>
				<sphereGeometry args={[1, 8, 8]} />
				<primitive object={bodyMat} attach="material" />
			</mesh>

			{/* Head & Yellow Beak */}
			<group position={[0, 0.08, 0.42]}>
				<mesh scale={[0.1, 0.1, 0.14]}>
					<sphereGeometry args={[1, 6, 6]} />
					<primitive object={bodyMat} attach="material" />
				</mesh>
				<mesh position={[0, -0.02, 0.18]} rotation-x={Math.PI / 2} scale={[0.04, 0.18, 0.04]}>
					<coneGeometry args={[1, 1, 4]} />
					<primitive object={beakMat} attach="material" />
				</mesh>
			</group>

			{/* Left Wing */}
			<group position={[0.12, 0.04, 0.05]} rotation-z={wingFlapAngle}>
				<mesh position={[0.45, 0, 0]} scale={[0.85, 0.02, 0.22]}>
					<boxGeometry />
					<primitive object={wingMat} attach="material" />
				</mesh>
				<group position={[0.88, 0, 0]} rotation-z={wingFlapAngle * 0.45}>
					<mesh position={[0.35, 0, -0.04]} scale={[0.7, 0.015, 0.18]}>
						<boxGeometry />
						<primitive object={wingTipMat} attach="material" />
					</mesh>
				</group>
			</group>

			{/* Right Wing */}
			<group position={[-0.12, 0.04, 0.05]} rotation-z={-wingFlapAngle}>
				<mesh position={[-0.45, 0, 0]} scale={[0.85, 0.02, 0.22]}>
					<boxGeometry />
					<primitive object={wingMat} attach="material" />
				</mesh>
				<group position={[-0.88, 0, 0]} rotation-z={-wingFlapAngle * 0.45}>
					<mesh position={[-0.35, 0, -0.04]} scale={[0.7, 0.015, 0.18]}>
						<boxGeometry />
						<primitive object={wingTipMat} attach="material" />
					</mesh>
				</group>
			</group>

			{/* Tail Feathers */}
			<mesh position={[0, 0.02, -0.45]} scale={[0.22, 0.015, 0.28]}>
				<boxGeometry />
				<primitive object={bodyMat} attach="material" />
			</mesh>
		</group>
	);
}

export function Seagulls() {
	const count = 8;
	const gulls = useMemo(() => {
		return Array.from({ length: count }, (_, i) => ({
			radius: 22 + Math.random() * 45,
			speed: 0.18 + Math.random() * 0.15,
			height: 14 + Math.random() * 12,
			phase: (i / count) * Math.PI * 2,
			flapFreq: 4.2 + Math.random() * 2.0,
			size: 0.85 + Math.random() * 0.25,
			glidePhase: Math.random() * Math.PI * 2,
		}));
	}, [count]);

	const gullRefs = useRef<(THREE.Group | null)[]>([]);
	const wingAnglesRef = useRef<number[]>(new Array(count).fill(0));
	const glideTiltsRef = useRef<number[]>(new Array(count).fill(0));

	useFrame((state) => {
		const t = state.clock.getElapsedTime();

		gulls.forEach((g, i) => {
			const group = gullRefs.current[i];
			if (!group) return;

			const angle = t * g.speed + g.phase;
			const x = Math.cos(angle) * g.radius;
			const z = Math.sin(angle) * g.radius;
			const y = g.height + Math.sin(t * 0.8 + g.phase) * 1.8;

			const nextAngle = angle + 0.05;
			const nextX = Math.cos(nextAngle) * g.radius;
			const nextZ = Math.sin(nextAngle) * g.radius;
			const heading = Math.atan2(nextX - x, nextZ - z);

			const glideCycle = Math.sin(t * 0.4 + g.glidePhase);
			const isGliding = glideCycle > 0.1;

			let flap = 0;
			if (isGliding) {
				flap = 0.08 + Math.sin(t * 1.2) * 0.04;
			} else {
				flap = Math.sin(t * g.flapFreq) * 0.55;
			}

			wingAnglesRef.current[i] = flap;
			glideTiltsRef.current[i] = Math.sin(t * g.speed * 2.0) * 0.25;

			group.position.set(x, y, z);
			group.rotation.set(0, heading + Math.PI, 0);
		});
	});

	return (
		<group>
			{gulls.map((g, i) => (
				<group key={i} ref={(el) => (gullRefs.current[i] = el)} scale={[g.size, g.size, g.size]}>
					<SeagullRig
						wingFlapAngle={wingAnglesRef.current[i] || 0}
						glideTilt={glideTiltsRef.current[i] || 0}
					/>
				</group>
			))}
		</group>
	);
}

export default Seagulls;
