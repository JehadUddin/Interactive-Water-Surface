import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { BoatControlState } from '../types';

type Props = {
	setKeyState: (key: keyof BoatControlState, pressed: boolean) => void;
};

export const MobileControls: React.FC<Props> = ({ setKeyState }) => {
	return (
		<div className="md:hidden absolute inset-0 pointer-events-none z-20 flex justify-between items-end p-4 pb-20 select-none">
			{/* Left Steering Pad (Port / Starboard) */}
			<div className="flex gap-2 pointer-events-auto">
				<button
					id="btn-touch-left"
					type="button"
					onPointerDown={() => setKeyState('left', true)}
					onPointerUp={() => setKeyState('left', false)}
					onPointerLeave={() => setKeyState('left', false)}
					className="w-14 h-14 rounded-2xl bg-slate-950/80 active:bg-cyan-500/40 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-lg shadow-black/50"
				>
					<ChevronLeft className="w-8 h-8" />
				</button>
				<button
					id="btn-touch-right"
					type="button"
					onPointerDown={() => setKeyState('right', true)}
					onPointerUp={() => setKeyState('right', false)}
					onPointerLeave={() => setKeyState('right', false)}
					className="w-14 h-14 rounded-2xl bg-slate-950/80 active:bg-cyan-500/40 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-lg shadow-black/50"
				>
					<ChevronRight className="w-8 h-8" />
				</button>
			</div>

			{/* Right Pedals: Throttle, Reverse & Boost */}
			<div className="flex items-end gap-2 pointer-events-auto">
				{/* Boost Button */}
				<button
					id="btn-touch-boost"
					type="button"
					onPointerDown={() => setKeyState('boost', true)}
					onPointerUp={() => setKeyState('boost', false)}
					onPointerLeave={() => setKeyState('boost', false)}
					className="w-12 h-12 rounded-2xl bg-cyan-600/80 active:bg-cyan-400 border border-cyan-300/40 text-white flex items-center justify-center backdrop-blur-md shadow-lg shadow-cyan-900/50"
				>
					<Zap className="w-5 h-5 fill-white" />
				</button>

				{/* Reverse */}
				<button
					id="btn-touch-backward"
					type="button"
					onPointerDown={() => setKeyState('backward', true)}
					onPointerUp={() => setKeyState('backward', false)}
					onPointerLeave={() => setKeyState('backward', false)}
					className="w-14 h-14 rounded-2xl bg-slate-950/80 active:bg-red-500/40 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-lg shadow-black/50"
				>
					<ChevronDown className="w-8 h-8" />
				</button>

				{/* Forward Throttle */}
				<button
					id="btn-touch-forward"
					type="button"
					onPointerDown={() => setKeyState('forward', true)}
					onPointerUp={() => setKeyState('forward', false)}
					onPointerLeave={() => setKeyState('forward', false)}
					className="w-16 h-16 rounded-2xl bg-gradient-to-t from-emerald-600 to-teal-500 active:from-emerald-400 active:to-teal-300 border border-emerald-300/40 text-white flex items-center justify-center backdrop-blur-md shadow-lg shadow-emerald-950/50"
				>
					<ChevronUp className="w-9 h-9" />
				</button>
			</div>
		</div>
	);
};

export default MobileControls;
