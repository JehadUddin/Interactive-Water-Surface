import React from 'react';
import {
	Compass,
	RotateCcw,
	Sun,
	Sunset,
	Moon,
	Sunrise,
	Zap,
	Film,
	Sparkles,
} from 'lucide-react';
import { BoatSimState, CameraViewMode, EnvironmentType } from '../types';

type Props = {
	boatState: BoatSimState;
	cameraMode: CameraViewMode;
	setCameraMode: (mode: CameraViewMode) => void;
	environment: EnvironmentType;
	setEnvironment: (env: EnvironmentType) => void;
	onResetBoat: () => void;
	onReplayIntro: () => void;
	keysPressed: {
		forward: boolean;
		backward: boolean;
		left: boolean;
		right: boolean;
		boost: boolean;
	};
};

export const ActiveHUD: React.FC<Props> = ({
	boatState,
	cameraMode,
	setCameraMode,
	environment,
	setEnvironment,
	onResetBoat,
	onReplayIntro,
	keysPressed,
}) => {
	// Speed calculations
	const maxSpeed = 0.6;
	const speedKnots = Math.abs(boatState.speed * 42.5); // Knots conversion
	const speedKmh = speedKnots * 1.852;
	const speedPercent = Math.min(100, (Math.abs(boatState.speed) / maxSpeed) * 100);

	// RPM Calculation
	const baseRpm = 800; // Idle RPM
	const maxRpm = 5800;
	const engineRpm = Math.round(
		baseRpm + (Math.abs(boatState.speed) / maxSpeed) * (maxRpm - baseRpm) + (keysPressed.boost ? 800 : 0)
	);

	// Gear status
	const gear = boatState.speed > 0.01 ? 'D' : boatState.speed < -0.01 ? 'R' : 'N';

	// Heading calculation
	let headingDegrees = Math.round((boatState.heading * 180) / Math.PI) % 360;
	if (headingDegrees < 0) headingDegrees += 360;

	const getCardinal = (deg: number) => {
		const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
		return dirs[Math.round(deg / 45) % 8];
	};

	const cameraOptions: { id: CameraViewMode; label: string; shortcut: string }[] = [
		{ id: 'follow', label: 'Third-Person Chase', shortcut: '1' },
		{ id: 'cockpit', label: 'Captain Helm', shortcut: '2' },
		{ id: 'drone', label: 'Drone Orbit', shortcut: '3' },
		{ id: 'topdown', label: 'Satellite', shortcut: '4' },
	];

	return (
		<div className="absolute inset-0 z-20 pointer-events-none p-4 md:p-6 flex flex-col justify-between select-none">
			{/* Top Navigation & Controls Bar */}
			<div className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
				{/* Left: Cinematic & Brand */}
				<div className="flex items-center gap-2">
					<button
						id="btn-cinematic-intro"
						onClick={onReplayIntro}
						className="flex items-center gap-2 bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-cyan-300 hover:text-cyan-200 text-xs font-semibold shadow-lg transition-all cursor-pointer"
						title="Return to cinematic fly-over scene"
					>
						<Film className="w-4 h-4 text-cyan-400" />
						<span className="hidden sm:inline">Cinematic Intro</span>
					</button>

					<div className="hidden lg:flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-300 font-mono">
						<span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
						<span>GPS: {Math.round(boatState.x)}m E, {Math.round(boatState.z)}m N</span>
					</div>

					<div className="hidden xl:flex items-center gap-2 bg-cyan-950/70 backdrop-blur-md px-3 py-2 rounded-xl border border-cyan-500/20 text-xs text-cyan-200 font-sans shadow-sm">
						<Sparkles className="w-3.5 h-3.5 text-cyan-400" />
						<span className="font-medium">Dolphin Pod: 4 Escorting</span>
					</div>

					<div className="hidden md:flex items-center gap-1.5 bg-emerald-950/60 backdrop-blur-md px-2.5 py-2 rounded-xl border border-emerald-500/30 text-[11px] text-emerald-300 font-mono shadow-sm">
						<Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/30" />
						<span className="font-semibold">WASM Engine</span>
					</div>
				</div>

				{/* Center: Environment Weather Switcher */}
				<div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg">
					<button
						id="btn-hud-env-day"
						onClick={() => setEnvironment('tropical_day')}
						className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
							environment === 'tropical_day'
								? 'bg-cyan-500 text-slate-950 font-bold shadow'
								: 'text-slate-300 hover:text-white hover:bg-white/10'
						}`}
						title="Tropical Day"
					>
						<Sun className="w-3.5 h-3.5" />
						<span className="hidden md:inline">Day</span>
					</button>
					<button
						id="btn-hud-env-dawn"
						onClick={() => setEnvironment('golden_dawn')}
						className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
							environment === 'golden_dawn'
								? 'bg-amber-500 text-slate-950 font-bold shadow'
								: 'text-slate-300 hover:text-white hover:bg-white/10'
						}`}
						title="Golden Dawn"
					>
						<Sunrise className="w-3.5 h-3.5" />
						<span className="hidden md:inline">Dawn</span>
					</button>
					<button
						id="btn-hud-env-sunset"
						onClick={() => setEnvironment('sunset')}
						className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
							environment === 'sunset'
								? 'bg-orange-500 text-white font-bold shadow'
								: 'text-slate-300 hover:text-white hover:bg-white/10'
						}`}
						title="Sunset"
					>
						<Sunset className="w-3.5 h-3.5" />
						<span className="hidden md:inline">Sunset</span>
					</button>
					<button
						id="btn-hud-env-night"
						onClick={() => setEnvironment('night_sky')}
						className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
							environment === 'night_sky'
								? 'bg-indigo-600 text-white font-bold shadow'
								: 'text-slate-300 hover:text-white hover:bg-white/10'
						}`}
						title="Starlit Night"
					>
						<Moon className="w-3.5 h-3.5" />
						<span className="hidden md:inline">Night</span>
					</button>
				</div>

				{/* Right: Camera Mode & Reset */}
				<div className="flex items-center gap-2">
					{/* Camera Mode Cycle */}
					<div className="flex items-center bg-slate-950/80 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg">
						{cameraOptions.map((opt) => (
							<button
								key={opt.id}
								id={`btn-cam-${opt.id}`}
								onClick={() => setCameraMode(opt.id)}
								className={`px-2.5 py-1.5 text-xs rounded-lg transition-all font-medium ${
									cameraMode === opt.id
										? 'bg-blue-600 text-white font-semibold shadow'
										: 'text-slate-400 hover:text-white hover:bg-white/10'
								}`}
								title={`${opt.label} (Press C to cycle)`}
							>
								{opt.id === 'follow' && 'Chase'}
								{opt.id === 'cockpit' && 'Helm'}
								{opt.id === 'drone' && 'Drone'}
								{opt.id === 'topdown' && 'Sat'}
							</button>
						))}
					</div>

					{/* Reset Position */}
					<button
						id="btn-hud-reset"
						onClick={onResetBoat}
						className="flex items-center justify-center w-9 h-9 bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white backdrop-blur-md rounded-xl border border-white/10 shadow-lg transition-all cursor-pointer"
						title="Reset Position (Press R)"
					>
						<RotateCcw className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Center Warning or Boost Message if active */}
			{keysPressed.boost && (
				<div className="self-center flex items-center gap-2 bg-gradient-to-r from-cyan-500/80 to-blue-600/80 backdrop-blur-md text-white font-black tracking-widest text-xs px-4 py-1.5 rounded-full border border-cyan-300/40 animate-pulse shadow-xl shadow-cyan-500/30">
					<Zap className="w-4 h-4 fill-white" />
					<span>NITRO BOOST ENGAGED</span>
				</div>
			)}

			{/* Bottom Telemetry Cluster */}
			<div className="flex items-end justify-between gap-4 pointer-events-auto">
				{/* Left: Speedometer & Engine Gauge */}
				<div className="bg-slate-950/80 backdrop-blur-xl border border-white/15 p-4 rounded-2xl shadow-2xl text-white flex items-center gap-5">
					{/* Digital & Dial Speed */}
					<div className="flex flex-col items-center">
						<div className="relative flex items-center justify-center w-24 h-24">
							{/* Background Arc */}
							<svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
								<circle
									cx="50"
									cy="50"
									r="40"
									fill="none"
									stroke="rgba(255,255,255,0.1)"
									strokeWidth="8"
								/>
								<circle
									cx="50"
									cy="50"
									r="40"
									fill="none"
									stroke={keysPressed.boost ? '#38bdf8' : '#06b6d4'}
									strokeWidth="8"
									strokeDasharray="251.2"
									strokeDashoffset={251.2 - (251.2 * speedPercent) / 100}
									strokeLinecap="round"
									className="transition-all duration-100"
								/>
							</svg>

							{/* Center Speed Value */}
							<div className="absolute flex flex-col items-center justify-center text-center">
								<span className="text-2xl font-black font-mono tracking-tighter leading-none">
									{speedKnots.toFixed(1)}
								</span>
								<span className="text-[10px] text-cyan-300 font-semibold tracking-wider uppercase">
									KNOTS
								</span>
								<span className="text-[9px] text-slate-400 font-mono">
									{speedKmh.toFixed(0)} km/h
								</span>
							</div>
						</div>
					</div>

					{/* Vertical Engine Stats & Gear */}
					<div className="flex flex-col justify-between gap-2 border-l border-white/10 pl-4">
						{/* Gear Shift */}
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-slate-400 uppercase font-semibold">GEAR:</span>
							<div className="flex items-center gap-1 font-mono text-xs font-bold">
								<span className={`px-1.5 py-0.5 rounded ${gear === 'R' ? 'bg-red-500 text-white' : 'text-slate-500'}`}>R</span>
								<span className={`px-1.5 py-0.5 rounded ${gear === 'N' ? 'bg-amber-500 text-slate-950' : 'text-slate-500'}`}>N</span>
								<span className={`px-1.5 py-0.5 rounded ${gear === 'D' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}>D</span>
							</div>
						</div>

						{/* Engine RPM Bar */}
						<div className="flex flex-col gap-1">
							<div className="flex justify-between items-center text-[10px] font-mono text-slate-300">
								<span>RPM</span>
								<span className={engineRpm > 4800 ? 'text-amber-400 font-bold' : 'text-cyan-300'}>
									{engineRpm}
								</span>
							</div>
							<div className="w-28 h-2 bg-white/10 rounded-full overflow-hidden">
								<div
									className={`h-full transition-all duration-100 ${
										engineRpm > 4800
											? 'bg-gradient-to-r from-cyan-400 via-amber-400 to-red-500'
											: 'bg-cyan-400'
									}`}
									style={{ width: `${Math.min(100, (engineRpm / maxRpm) * 100)}%` }}
								/>
							</div>
						</div>

						{/* Boost Indicator */}
						<div className="flex items-center gap-2 text-[10px] text-slate-300">
							<span className="text-slate-400">BOOST:</span>
							<span className={keysPressed.boost ? 'text-cyan-300 font-bold' : 'text-slate-500'}>
								{keysPressed.boost ? 'ACTIVE (145%)' : 'READY [SHIFT]'}
							</span>
						</div>
					</div>
				</div>

				{/* Right: Nautical Compass & Controls Legend */}
				<div className="hidden sm:flex items-center gap-4 bg-slate-950/80 backdrop-blur-xl border border-white/15 p-4 rounded-2xl shadow-2xl text-white">
					{/* Compass Rose */}
					<div className="relative flex items-center justify-center w-20 h-20 bg-slate-900/90 rounded-full border border-white/20">
						<Compass
							className="w-14 h-14 text-cyan-400 transition-transform duration-100"
							style={{ transform: `rotate(${-headingDegrees}deg)` }}
						/>
						<div className="absolute inset-0 flex items-center justify-center">
							<span className="text-xs font-black font-mono text-white bg-slate-950/90 px-1 py-0.5 rounded shadow">
								{getCardinal(headingDegrees)}
							</span>
						</div>
						<span className="absolute -bottom-1 text-[9px] font-mono text-cyan-300 bg-slate-950 px-1 rounded">
							{headingDegrees}°
						</span>
					</div>

					{/* Key Controls Helper */}
					<div className="flex flex-col gap-1 text-[11px] text-slate-300 font-mono">
						<div className="flex items-center gap-2">
							<kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white">W/S</kbd>
							<span className="text-slate-400">Throttle / Reverse</span>
						</div>
						<div className="flex items-center gap-2">
							<kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white">A/D</kbd>
							<span className="text-slate-400">Rudder Port / Starboard</span>
						</div>
						<div className="flex items-center gap-2">
							<kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white">SHIFT</kbd>
							<span className="text-slate-400">Turbo Hydrofoil Surge</span>
						</div>
						<div className="flex items-center gap-2">
							<kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white">C / R</kbd>
							<span className="text-slate-400">Camera / Reset</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ActiveHUD;
