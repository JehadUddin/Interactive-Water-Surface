import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Boat } from './Boat';
import { BoatControlState, BoatSimState, AppMode, CameraViewMode } from './types';
import { getOceanWaveSample } from './oceanWavePhysics';
import { sharedWasmEngine } from './wasmOceanPhysics';

export type { BoatControlState, BoatSimState };

type Props = {
	appMode: AppMode;
	cameraMode?: CameraViewMode;
	externalKeys?: BoatControlState;
	refPointer?: React.MutableRefObject<THREE.Vector2>;
	onBoatState?: (state: BoatSimState) => void;
	onCameraModeChange?: (mode: CameraViewMode) => void;
	onResetTrigger?: number;
};

export default function BoatController({
	appMode,
	cameraMode = 'follow',
	externalKeys,
	refPointer,
	onBoatState,
	onCameraModeChange,
	onResetTrigger = 0,
}: Props) {
	const boatGroupRef = useRef<THREE.Group>(null);
	const camera = useThree((s) => s.camera);

	// Physics and state simulation variables
	const sim = useRef({
		x: 0,
		z: 0,
		y: -3.46,
		heading: Math.PI / 1.8,
		speed: 0,
		maxForwardSpeed: 0.6,
		maxReverseSpeed: 0.22,
		accel: 0.45,
		brake: 0.7,
		drag: 0.978,
		rudderAngle: 0,
		turnRate: 1.45,
		roll: 0,
		pitch: 0,
	});

	const keys = useRef<BoatControlState>({
		forward: false,
		backward: false,
		left: false,
		right: false,
		boost: false,
	});

	// Transition timing ref
	const transitionStart = useRef<number | null>(null);

	// Handle external reset
	useEffect(() => {
		if (onResetTrigger > 0) {
			sim.current.x = 0;
			sim.current.z = 0;
			sim.current.speed = 0;
			sim.current.heading = Math.PI / 1.8;
		}
	}, [onResetTrigger]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			const code = e.code;
			if (['KeyW', 'ArrowUp'].includes(code)) keys.current.forward = true;
			if (['KeyS', 'ArrowDown'].includes(code)) keys.current.backward = true;
			if (['KeyA', 'ArrowLeft'].includes(code)) keys.current.left = true;
			if (['KeyD', 'ArrowRight'].includes(code)) keys.current.right = true;
			if (['ShiftLeft', 'ShiftRight', 'Space'].includes(code)) keys.current.boost = true;
			if (code === 'KeyR') {
				sim.current.x = 0;
				sim.current.z = 0;
				sim.current.speed = 0;
				sim.current.heading = Math.PI / 1.8;
			}
			if (code === 'KeyC' && onCameraModeChange) {
				const modes: CameraViewMode[] = ['follow', 'cockpit', 'drone', 'topdown'];
				const nextIdx = (modes.indexOf(cameraMode) + 1) % modes.length;
				onCameraModeChange(modes[nextIdx]);
			}
		};

		const onKeyUp = (e: KeyboardEvent) => {
			const code = e.code;
			if (['KeyW', 'ArrowUp'].includes(code)) keys.current.forward = false;
			if (['KeyS', 'ArrowDown'].includes(code)) keys.current.backward = false;
			if (['KeyA', 'ArrowLeft'].includes(code)) keys.current.left = false;
			if (['KeyD', 'ArrowRight'].includes(code)) keys.current.right = false;
			if (['ShiftLeft', 'ShiftRight', 'Space'].includes(code)) keys.current.boost = false;
		};

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
		};
	}, [cameraMode, onCameraModeChange]);

	const camTargetPos = useRef(new THREE.Vector3(25, 16, 25));
	const camLookAt = useRef(new THREE.Vector3(0, -3.2, 0));
	const defaultFov = 48;

	useFrame((threeState, delta) => {
		const s = sim.current;
		const dt = Math.min(delta, 0.08);
		const time = threeState.clock.getElapsedTime();

		// Merge keyboard and touch/external inputs
		const forward = Boolean((keys.current.forward || externalKeys?.forward) && appMode === 'active');
		const backward = Boolean((keys.current.backward || externalKeys?.backward) && appMode === 'active');
		const left = Boolean((keys.current.left || externalKeys?.left) && appMode === 'active');
		const right = Boolean((keys.current.right || externalKeys?.right) && appMode === 'active');
		const boost = Boolean((keys.current.boost || externalKeys?.boost) && appMode === 'active');

		const targetMaxSpeed = boost ? s.maxForwardSpeed * 1.45 : s.maxForwardSpeed;
		const currentAccel = boost ? s.accel * 1.5 : s.accel;

		// Longitudinal throttle & drag
		if (forward) {
			s.speed = Math.min(s.speed + currentAccel * dt, targetMaxSpeed);
		} else if (backward) {
			s.speed = Math.max(s.speed - s.brake * dt, -s.maxReverseSpeed);
		} else {
			s.speed *= Math.pow(s.drag, dt * 60);
			if (Math.abs(s.speed) < 0.001) s.speed = 0;
		}

		// Rudder steering dynamics
		let steerInput = 0;
		if (left) steerInput += 1;
		if (right) steerInput -= 1;

		s.rudderAngle = THREE.MathUtils.lerp(s.rudderAngle, steerInput, dt * 7);

		// Hydrodynamic turning effectiveness (turning sharpens with velocity)
		const steerSpeedFactor = 0.4 + 0.6 * (Math.abs(s.speed) / s.maxForwardSpeed);
		let steerSign = s.rudderAngle;
		if (s.speed < -0.01) steerSign *= -1; // Reverse gear steering

		s.heading += steerSign * s.turnRate * steerSpeedFactor * dt;

		// World translation (tuned for smooth, authentic boat movement)
		const moveDist = s.speed * 18 * dt;
		s.x += Math.sin(s.heading) * moveDist;
		s.z += Math.cos(s.heading) * moveDist;

		// WebAssembly-Accelerated 4-Point Ocean Wave Buoyancy & Hydrodynamics Sampling
		const buoyancy = sharedWasmEngine.computeHullBuoyancy(
			s.x,
			s.z,
			s.heading,
			s.speed,
			s.maxForwardSpeed,
			s.rudderAngle,
			forward,
			backward,
			dt,
			time,
			getOceanWaveSample
		);

		// Stable natural buoyancy (subtle sea heave, no jerky bouncing)
		s.y = THREE.MathUtils.lerp(s.y, buoyancy.posY, dt * 2.8);
		const currentPosY = s.y;

		s.roll = THREE.MathUtils.lerp(s.roll, buoyancy.roll, dt * 2.5);
		s.pitch = THREE.MathUtils.lerp(s.pitch, buoyancy.pitch, dt * 2.5);

		// Engine micro-vibration
		const engineVib = Math.abs(s.speed) > 0.02 ? Math.sin(time * 38) * 0.0025 * (Math.abs(s.speed) / s.maxForwardSpeed) : 0;

		// Apply transforms to boat model group
		if (boatGroupRef.current) {
			boatGroupRef.current.position.set(s.x, currentPosY + engineVib, s.z);
			boatGroupRef.current.rotation.set(0, 0, 0);
			boatGroupRef.current.rotation.y = s.heading;
			boatGroupRef.current.rotation.z = s.roll;
			boatGroupRef.current.rotation.x = s.pitch;
		}

		// Water Simulation Interaction (Screen-projected Ripple & Fluid FX)
		if (refPointer) {
			const wakeWorldPos = new THREE.Vector3(
				s.x - Math.sin(s.heading) * (1.5 + Math.abs(s.speed) * 0.7),
				currentPosY,
				s.z - Math.cos(s.heading) * (1.5 + Math.abs(s.speed) * 0.7)
			);
			wakeWorldPos.project(camera);
			refPointer.current.set(wakeWorldPos.x, wakeWorldPos.y);
		}

		// Notify parent of boat state for world-space wake and telemetry
		if (onBoatState) {
			onBoatState({
				x: s.x,
				y: currentPosY,
				z: s.z,
				heading: s.heading,
				speed: s.speed,
				boostActive: boost,
			});
		}

		// --- CAMERA ORCHESTRATION SYSTEM ---
		if (appMode === 'intro') {
			// Cinematic Orbit Drone Camera: Sweeps gently around the boat high above sea
			const introOrbitRadius = 26;
			const introHeight = 11 + Math.sin(time * 0.4) * 2;
			const introOrbitAngle = time * 0.15;

			const introCamX = s.x + Math.sin(introOrbitAngle) * introOrbitRadius;
			const introCamZ = s.z + Math.cos(introOrbitAngle) * introOrbitRadius;
			const introCamY = currentPosY + introHeight;

			camTargetPos.current.lerp(new THREE.Vector3(introCamX, introCamY, introCamZ), dt * 3.0);
			camera.position.copy(camTargetPos.current);

			const targetLook = new THREE.Vector3(s.x, currentPosY + 1.2, s.z);
			camLookAt.current.lerp(targetLook, dt * 4.0);
			camera.lookAt(camLookAt.current);

			if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
				const perspCam = camera as THREE.PerspectiveCamera;
				perspCam.fov = THREE.MathUtils.lerp(perspCam.fov, 45, dt * 2.0);
				perspCam.updateProjectionMatrix();
			}
		} else if (appMode === 'transitioning') {
			// Fly-in transition: Swoops smoothly down to follow view
			if (transitionStart.current === null) {
				transitionStart.current = time;
			}
			const elapsed = time - transitionStart.current;
			const progress = Math.min(1, elapsed / 2.2);
			const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI); // Ease in-out

			// Target follow camera position behind boat
			const followCamDist = 12.0;
			const followCamHeight = 4.4;
			const targetFollowX = s.x - Math.sin(s.heading) * followCamDist;
			const targetFollowZ = s.z - Math.cos(s.heading) * followCamDist;
			const targetFollowY = currentPosY + followCamHeight;

			// Interpolate camera position
			camTargetPos.current.lerp(new THREE.Vector3(targetFollowX, targetFollowY, targetFollowZ), ease);
			camera.position.copy(camTargetPos.current);

			const lookX = s.x + Math.sin(s.heading) * 5.0;
			const lookZ = s.z + Math.cos(s.heading) * 5.0;
			const lookY = currentPosY + 1.0;
			camLookAt.current.lerp(new THREE.Vector3(lookX, lookY, lookZ), ease);
			camera.lookAt(camLookAt.current);

			if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
				const perspCam = camera as THREE.PerspectiveCamera;
				perspCam.fov = THREE.MathUtils.lerp(perspCam.fov, defaultFov, ease);
				perspCam.updateProjectionMatrix();
			}
		} else if (appMode === 'active') {
			transitionStart.current = null;
			const speedRatio = Math.abs(s.speed) / s.maxForwardSpeed;

			if (cameraMode === 'follow') {
				// 1. Action Third-Person Follow Camera
				const camDist = 12.0 + speedRatio * 1.6 + (boost ? 1.8 : 0);
				const camHeight = 4.4 + speedRatio * 0.3;

				const camSway = -s.rudderAngle * 1.2;
				const targetCamX = s.x - Math.sin(s.heading + camSway * 0.08) * camDist;
				const targetCamZ = s.z - Math.cos(s.heading + camSway * 0.08) * camDist;
				const targetCamY = currentPosY + camHeight;

				camTargetPos.current.set(targetCamX, targetCamY, targetCamZ);
				camera.position.lerp(camTargetPos.current, dt * 5.5);

				const lookAheadDist = 5.5 + speedRatio * 2.0;
				const lookX = s.x + Math.sin(s.heading) * lookAheadDist;
				const lookZ = s.z + Math.cos(s.heading) * lookAheadDist;
				const lookY = currentPosY + 1.0;

				camLookAt.current.lerp(new THREE.Vector3(lookX, lookY, lookZ), dt * 6.5);
				camera.lookAt(camLookAt.current);

				if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
					const perspCam = camera as THREE.PerspectiveCamera;
					const targetFov = defaultFov + speedRatio * (boost ? 6.0 : 3.0);
					perspCam.fov = THREE.MathUtils.lerp(perspCam.fov, targetFov, dt * 3.0);
					perspCam.updateProjectionMatrix();
				}
			} else if (cameraMode === 'cockpit') {
				// 2. Captain's Helm / Cockpit First-Person View
				const forwardX = Math.sin(s.heading);
				const forwardZ = Math.cos(s.heading);
				const helmPosX = s.x - forwardX * 0.2;
				const helmPosZ = s.z - forwardZ * 0.2;
				const helmPosY = currentPosY + 1.25;

				camTargetPos.current.set(helmPosX, helmPosY, helmPosZ);
				camera.position.lerp(camTargetPos.current, dt * 14.0);

				const lookX = s.x + forwardX * 20.0;
				const lookZ = s.z + forwardZ * 20.0;
				const lookY = currentPosY + 1.0;

				camLookAt.current.lerp(new THREE.Vector3(lookX, lookY, lookZ), dt * 12.0);
				camera.lookAt(camLookAt.current);

				if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
					const perspCam = camera as THREE.PerspectiveCamera;
					perspCam.fov = THREE.MathUtils.lerp(perspCam.fov, 65, dt * 3.0);
					perspCam.updateProjectionMatrix();
				}
			} else if (cameraMode === 'drone') {
				// 3. Drone Orbit / Fly-By Exterior Camera
				const droneAngle = time * 0.4;
				const droneDist = 18.0;
				const droneHeight = 7.0;
				const droneX = s.x + Math.sin(droneAngle) * droneDist;
				const droneZ = s.z + Math.cos(droneAngle) * droneDist;
				const droneY = currentPosY + droneHeight;

				camTargetPos.current.set(droneX, droneY, droneZ);
				camera.position.lerp(camTargetPos.current, dt * 3.5);

				const lookTarget = new THREE.Vector3(s.x, currentPosY + 1.0, s.z);
				camLookAt.current.lerp(lookTarget, dt * 5.0);
				camera.lookAt(camLookAt.current);
			} else if (cameraMode === 'topdown') {
				// 4. Satellite / Top-Down Tactical View
				const topdownX = s.x;
				const topdownZ = s.z;
				const topdownY = currentPosY + 40.0;

				camTargetPos.current.set(topdownX, topdownY, topdownZ);
				camera.position.lerp(camTargetPos.current, dt * 4.0);

				const lookTarget = new THREE.Vector3(s.x + Math.sin(s.heading) * 2, currentPosY, s.z + Math.cos(s.heading) * 2);
				camLookAt.current.lerp(lookTarget, dt * 6.0);
				camera.lookAt(camLookAt.current);

				if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
					const perspCam = camera as THREE.PerspectiveCamera;
					perspCam.fov = THREE.MathUtils.lerp(perspCam.fov, 42, dt * 3.0);
					perspCam.updateProjectionMatrix();
				}
			}
		}
	});

	return (
		<group ref={boatGroupRef} position={[0, -3.11, 0]}>
			<Boat />
		</group>
	);
}
