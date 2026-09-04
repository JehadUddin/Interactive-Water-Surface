import React, { useRef } from 'react';
import { Vector2 } from 'three';
import { Perf } from 'r3f-perf';
import { Environment, Sky, Stars } from '@react-three/drei';
import WaterSurfaceSimple from './WaterSurface/WaterSurfaceSimple';
import WaterSurfaceComplex from './WaterSurface/WaterSurfaceComplex';
import { useControls, folder } from 'leva';
import FluidFX from './WaterSurface/InteractiveFX/FluidFX';
import RippleFX from './WaterSurface/InteractiveFX/RippleFX';
import BoatController from './BoatController';
import WaterFXSystem from './WaterFXSystem';
import { Seagulls } from './Wildlife';
import DolphinPod from './DolphinPod';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import { BoatSimState, AppMode, CameraViewMode, EnvironmentType, BoatControlState } from './types';

type SceneProps = {
	appMode: AppMode;
	cameraMode: CameraViewMode;
	environment: EnvironmentType;
	externalKeys: BoatControlState;
	onBoatState: (state: BoatSimState) => void;
	onCameraModeChange: (mode: CameraViewMode) => void;
	onResetTrigger: number;
	currentBoatState: BoatSimState;
};

export default function Scene({
	appMode,
	cameraMode,
	environment,
	externalKeys,
	onBoatState,
	onCameraModeChange,
	onResetTrigger,
	currentBoatState,
}: SceneProps) {
	const sharedPointerRef = useRef<Vector2>(new Vector2(0, 0));

	const controls = useControls({
		perfMonitor: {
			value: false,
		},

		waterType: {
			value: 'simple',
			options: ['simple', 'complex'],
		},

		fxType: {
			value: 'none',
			options: ['none', 'ripple', 'fluid'],
		},

		planeSize: {
			value: { width: 4500, length: 4500 },
		},

		position: [0, -2.96, 0],

		simpleWater: folder(
			{
				waterColor: '#0c445c',
				distortionScale: 1.2,
				fxDistortionFactor: 0.0,
				fxDisplayColorAlpha: 0.0,
				fxMixColor: '#000000',
			},
			{ render: (get) => get('waterType') === 'simple' }
		),

		complexWater: folder(
			{
				fxDistortionFactor_complex: 0.12,
				fxDisplayColorAlpha_complex: 0.6,
				flowSpeed: 0.03,
				flowDirection: [1.0, 0.5],
				reflectivity: 1.2,
				scale_complex: 5,
			},
			{ render: (get) => get('waterType') === 'complex' }
		),

		rippleFX: folder(
			{
				alpha: 1.0,
				fadeoutSpeed: 0.94,
				frequency: 0.015,
				rotation: 0.02,
				scale: 0.10,
			},
			{ render: (get) => get('fxType') === 'ripple' }
		),

		fluidFX: folder(
			{
				densityDissipation: 0.975,
				velocityDissipation: 0.985,
				velocityAcceleration: 25.0,
				pressureDissipation: 0.5,
				splatRadius: 0.00004,
				curlStrength: 7.0,
				pressureIterations: 2,
			},
			{ render: (get) => get('fxType') === 'fluid' }
		),
	});

	const FX_RENDER = (
		<>
			{controls.fxType === 'ripple' && (
				<RippleFX
					alpha={controls.alpha}
					fadeoutSpeed={controls.fadeoutSpeed}
					frequency={controls.frequency}
					rotation={controls.rotation}
					scale={controls.scale}
				/>
			)}

			{controls.fxType === 'fluid' && (
				<FluidFX
					densityDissipation={controls.densityDissipation}
					velocityDissipation={controls.velocityDissipation}
					velocityAcceleration={controls.velocityAcceleration}
					pressureDissipation={controls.pressureDissipation}
					splatRadius={controls.splatRadius}
					curlStrength={controls.curlStrength}
					pressureIterations={controls.pressureIterations}
				/>
			)}
		</>
	);

	// Determine atmospheric lighting and horizon visibility
	const isNight = environment === 'night_sky';
	const isDawn = environment === 'golden_dawn';
	const isSunset = environment === 'sunset';

	const fogColor = isNight
		? '#040a16'
		: isDawn
		? '#deb0b8'
		: isSunset
		? '#b86048'
		: '#5894c4'; // Natural deep oceanic sky blue

	const sunPos: [number, number, number] = isNight
		? [10, -50, 10]
		: isDawn
		? [70, 10, 40]
		: isSunset
		? [70, 6, 25]
		: [80, 40, 50];

	return (
		<>
			{controls.perfMonitor && <Perf position={'top-left'} />}

			{/* Background Sky Canvas Color for Infinite Horizon */}
			<color
				attach="background"
				args={[
					isNight
						? '#040914'
						: isDawn
						? '#d8a39a'
						: isSunset
						? '#b55a42'
						: '#4d8cb8',
				]}
			/>

			{/* Atmosphere and Skybox - Crisp Atmospheric Scattering */}
			{environment === 'tropical_day' && (
				<>
					<Sky
						sunPosition={sunPos}
						turbidity={0.05}
						rayleigh={1.1}
						mieCoefficient={0.0008}
						mieDirectionalG={0.82}
						distance={100000}
					/>
				</>
			)}

			{environment === 'golden_dawn' && (
				<>
					<Sky
						sunPosition={sunPos}
						turbidity={1.5}
						rayleigh={2.2}
						mieCoefficient={0.005}
						mieDirectionalG={0.82}
						distance={100000}
					/>
				</>
			)}

			{environment === 'sunset' && (
				<Environment
					key="sunset"
					background
					files={[
						'/cubemap/sunset/right.png',
						'/cubemap/sunset/left.png',
						'/cubemap/sunset/top.png',
						'/cubemap/sunset/bot.png',
						'/cubemap/sunset/front.png',
						'/cubemap/sunset/back.png',
					]}
				/>
			)}

			{environment === 'night_sky' && (
				<>
					<Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
				</>
			)}

			{/* Distant Horizon Haze (Far distance 800 to 7000 to keep open-sea visibility) */}
			<fog attach="fog" args={[fogColor, 800, 7000]} />

			{/* Soft balanced maritime illumination */}
			<ambientLight intensity={isNight ? 0.3 : 0.6} color={isNight ? '#60a5fa' : '#e2f0fb'} />
			<hemisphereLight
				args={[
					isNight ? '#0d1e3d' : isDawn ? '#ffdfcc' : '#f0f7ff',
					isNight ? '#050c18' : '#327ea8', // Ocean bounce fill
					isNight ? 0.35 : 0.7,
				]}
			/>
			<directionalLight
				position={sunPos}
				intensity={isNight ? 0.35 : 1.35}
				color={isDawn ? '#fed7aa' : isSunset ? '#ffb07c' : '#fffaf2'}
				castShadow
			/>

			{/* Infinite Ocean Water */}
			{controls.waterType === 'simple' && (
				<WaterSurfaceSimple
					position={controls.position}
					width={controls.planeSize.width}
					length={controls.planeSize.length}
					waterColor={controls.waterColor}
					distortionScale={controls.distortionScale}
					fxDistortionFactor={0.0}
					fxDisplayColorAlpha={0.0}
					fxMixColor={controls.fxMixColor}
				/>
			)}

			{controls.waterType === 'complex' && (
				<WaterSurfaceComplex
					dimensions={512}
					position={controls.position}
					width={controls.planeSize.width}
					length={controls.planeSize.length}
					fxDistortionFactor={0.0}
					fxDisplayColorAlpha={0.0}
					flowSpeed={controls.flowSpeed}
					flowDirection={controls.flowDirection}
					reflectivity={controls.reflectivity}
					scale={controls.scale_complex}
				/>
			)}

			{/* World Space Expanding Ocean Wake Trail, Bow Sprays & Propeller Wash */}
			<WaterFXSystem boatState={currentBoatState} />

			{/* Coastal Seagulls */}
			<Seagulls />

			{/* Authentic 3D GLB Dolphin Pod with Realistic Swimming Kinematics */}
			<DolphinPod boatState={currentBoatState} environment={environment} />

			<EffectComposer>
				<N8AO intensity={3} aoRadius={5} halfRes />
			</EffectComposer>

			{/* Controllable Power Boat */}
			<BoatController
				appMode={appMode}
				cameraMode={cameraMode}
				externalKeys={externalKeys}
				refPointer={sharedPointerRef}
				onBoatState={onBoatState}
				onCameraModeChange={onCameraModeChange}
				onResetTrigger={onResetTrigger}
			/>
		</>
	);
}
