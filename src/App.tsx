import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import Scene from './Scene';
import { Leva } from 'leva';
import IntroScreen from './components/IntroScreen';
import ActiveHUD from './components/ActiveHUD';
import MobileControls from './components/MobileControls';
import { AppMode, CameraViewMode, EnvironmentType, BoatSimState, BoatControlState } from './types';
import './App.css';

function App() {
	const [appMode, setAppMode] = useState<AppMode>('intro');
	const [cameraMode, setCameraMode] = useState<CameraViewMode>('follow');
	const [environment, setEnvironment] = useState<EnvironmentType>('tropical_day');
	const [resetTrigger, setResetTrigger] = useState(0);

	const [boatState, setBoatState] = useState<BoatSimState>({
		x: 0,
		y: -3.11,
		z: 0,
		heading: Math.PI / 1.8,
		speed: 0,
	});

	const [keysPressed, setKeysPressed] = useState<BoatControlState>({
		forward: false,
		backward: false,
		left: false,
		right: false,
		boost: false,
	});

	// Handle touch / virtual controls
	const handleSetKeyState = useCallback((key: keyof BoatControlState, pressed: boolean) => {
		setKeysPressed((prev) => ({ ...prev, [key]: pressed }));
	}, []);

	// Start engine & initiate cinematic fly-in
	const handleStartEngine = useCallback(() => {
		setAppMode('transitioning');

		// Transition smoothly into active interactive control
		setTimeout(() => {
			setAppMode('active');
		}, 2200);
	}, []);

	// Return to cinematic camera
	const handleReplayIntro = useCallback(() => {
		setAppMode('intro');
	}, []);

	// Reset position
	const handleResetBoat = useCallback(() => {
		setResetTrigger((prev) => prev + 1);
	}, []);

	// Listen for Escape key to toggle intro/active
	useEffect(() => {
		const handleGlobalKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (appMode === 'active') {
					handleReplayIntro();
				} else if (appMode === 'intro') {
					handleStartEngine();
				}
			}
		};
		window.addEventListener('keydown', handleGlobalKey);
		return () => window.removeEventListener('keydown', handleGlobalKey);
	}, [appMode, handleReplayIntro, handleStartEngine]);

	return (
		<div className="background-canvas relative w-screen h-screen overflow-hidden bg-slate-950">
			<Leva hidden />

			{/* 3D WebGL Canvas */}
			<Canvas
				camera={{ position: [25, 14, 25], fov: 48, near: 0.1, far: 6000 }}
				dpr={[1, 2]}
				gl={{ antialias: true, powerPreference: 'high-performance' }}
			>
				<Scene
					appMode={appMode}
					cameraMode={cameraMode}
					environment={environment}
					externalKeys={keysPressed}
					onBoatState={setBoatState}
					onCameraModeChange={setCameraMode}
					onResetTrigger={resetTrigger}
					currentBoatState={boatState}
				/>
			</Canvas>

			{/* Cinematic Intro Entering Scene Overlay */}
			{appMode === 'intro' && (
				<IntroScreen
					onStartEngine={handleStartEngine}
					environment={environment}
					setEnvironment={setEnvironment}
				/>
			)}

			{/* Active Maritime Navigation HUD Overlay */}
			{(appMode === 'active' || appMode === 'transitioning') && (
				<ActiveHUD
					boatState={boatState}
					cameraMode={cameraMode}
					setCameraMode={setCameraMode}
					environment={environment}
					setEnvironment={setEnvironment}
					onResetBoat={handleResetBoat}
					onReplayIntro={handleReplayIntro}
					keysPressed={keysPressed}
				/>
			)}

			{/* On-Screen Touch / Mobile Controls */}
			{appMode === 'active' && (
				<MobileControls setKeyState={handleSetKeyState} />
			)}
		</div>
	);
}

export default App;
