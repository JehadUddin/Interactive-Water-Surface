import React, { useEffect } from 'react';
import { Anchor, Compass, Gauge, Play, Wind, Eye } from 'lucide-react';
import { EnvironmentType } from '../types';

type Props = {
	onStartEngine: () => void;
	environment: EnvironmentType;
	setEnvironment: (env: EnvironmentType) => void;
};

export const IntroScreen: React.FC<Props> = ({
	onStartEngine,
	environment,
	setEnvironment,
}) => {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (['Space', 'Enter', 'KeyW', 'ArrowUp'].includes(e.code)) {
				e.preventDefault();
				onStartEngine();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [onStartEngine]);

	return (
		<div className="absolute inset-0 z-30 flex flex-col justify-between pointer-events-none p-6 md:p-10 select-none">
			{/* Top Bar / Brand & Atmosphere Picker */}
			<div className="flex items-center justify-between pointer-events-auto">
				<div className="flex items-center gap-3 bg-slate-950/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white shadow-xl">
					<Anchor className="w-5 h-5 text-cyan-400 animate-pulse" />
					<span className="font-semibold tracking-wider text-sm text-cyan-100 uppercase">
						PACIFIC HELM
					</span>
					<span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
						WASM V2.4
					</span>
				</div>

				{/* Environment Quick Preview */}
				<div className="hidden sm:flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-xl">
					<button
						id="btn-env-day"
						onClick={() => setEnvironment('tropical_day')}
						className={`px-3 py-1 text-xs rounded-full transition-all font-medium ${
							environment === 'tropical_day'
								? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
								: 'text-slate-300 hover:text-white hover:bg-white/10'
						}`}
					>
						Tropical Day
					</button>
					<button
						id="btn-env-dawn"
						onClick={() => setEnvironment('golden_dawn')}
						className={`px-3 py-1 text-xs rounded-full transition-all font-medium ${
							environment === 'golden_dawn'
								? 'bg-amber-500 text-slate-950 font-semibold shadow-md'
								: 'text-slate-300 hover:text-white hover:bg-white/10'
						}`}
					>
						Golden Dawn
					</button>
					<button
						id="btn-env-sunset"
						onClick={() => setEnvironment('sunset')}
						className={`px-3 py-1 text-xs rounded-full transition-all font-medium ${
							environment === 'sunset'
								? 'bg-orange-500 text-white font-semibold shadow-md'
								: 'text-slate-300 hover:text-white hover:bg-white/10'
						}`}
					>
						Sunset
					</button>
					<button
						id="btn-env-night"
						onClick={() => setEnvironment('night_sky')}
						className={`px-3 py-1 text-xs rounded-full transition-all font-medium ${
							environment === 'night_sky'
								? 'bg-indigo-500 text-white font-semibold shadow-md'
								: 'text-slate-300 hover:text-white hover:bg-white/10'
						}`}
					>
						Starlit Night
					</button>
				</div>
			</div>

			{/* Center Hero Card */}
			<div className="max-w-xl mx-auto text-center pointer-events-auto bg-slate-950/75 backdrop-blur-xl border border-white/15 p-8 md:p-10 rounded-3xl shadow-2xl shadow-cyan-950/40 transform transition-all hover:border-cyan-500/40">
				<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">
					<Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '12s' }} />
					WASM Hydrodynamic Simulation
				</div>

				<h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
					PACIFIC <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">HORIZON</span>
				</h1>

				<p className="text-sm md:text-base text-slate-300 mb-6 leading-relaxed">
					Experience an authentic 3D open-ocean cruising simulation featuring real-time water wave reflections, dynamic hydrodynamics, and WebAssembly wake physics.
				</p>

				{/* Feature Badges */}
				<div className="grid grid-cols-3 gap-2 text-xs text-slate-300 mb-8 border-y border-white/10 py-3">
					<div className="flex flex-col items-center gap-1">
						<Gauge className="w-4 h-4 text-cyan-400" />
						<span className="font-mono text-[11px] text-white">Dual V8 Marine</span>
						<span className="text-[10px] text-slate-400">Hydrofoil Lift</span>
					</div>
					<div className="flex flex-col items-center gap-1 border-x border-white/10">
						<Wind className="w-4 h-4 text-blue-400" />
						<span className="font-mono text-[11px] text-white">Kelvin Wake</span>
						<span className="text-[10px] text-slate-400">WASM Optimized</span>
					</div>
					<div className="flex flex-col items-center gap-1">
						<Eye className="w-4 h-4 text-amber-400" />
						<span className="font-mono text-[11px] text-white">4 Dynamic Views</span>
						<span className="text-[10px] text-slate-400">Cockpit & Chase</span>
					</div>
				</div>

				{/* Primary Embark Action Button */}
				<button
					id="btn-start-engine"
					onClick={onStartEngine}
					className="group w-full py-4 px-8 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-base md:text-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 cursor-pointer"
				>
					<Play className="w-5 h-5 fill-slate-950 transition-transform group-hover:scale-110" />
					<span>TAKE THE HELM & START ENGINE</span>
				</button>

				{/* Keyboard Quick Hint */}
				<div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
					<span>Press</span>
					<kbd className="px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white text-[11px]">SPACE</kbd>
					<span>or</span>
					<kbd className="px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white text-[11px]">W</kbd>
					<span>to embark</span>
				</div>
			</div>

			{/* Bottom Controls Info Banner */}
			<div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto text-xs text-slate-400 bg-slate-950/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-1.5">
						<span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white text-[11px]">W A S D</span>
						<span>or</span>
						<span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white text-[11px]">ARROWS</span>
						<span>Steer & Throttle</span>
					</div>
					<div className="hidden sm:flex items-center gap-1.5">
						<span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white text-[11px]">SHIFT</span>
						<span>Nitro Boost</span>
					</div>
				</div>

				<div className="flex items-center gap-4">
					<div className="hidden md:flex items-center gap-1.5">
						<span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white text-[11px]">C</span>
						<span>Change Camera</span>
					</div>
					<div className="flex items-center gap-1.5 text-cyan-300 font-mono">
						<span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
						<span>High-FPS WASM Engine</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export default IntroScreen;
