export type BoatControlState = {
	forward: boolean;
	backward: boolean;
	left: boolean;
	right: boolean;
	boost: boolean;
};

export type BoatSimState = {
	x: number;
	y: number;
	z: number;
	heading: number;
	speed: number;
	engineRpm?: number;
	boostActive?: boolean;
};

export type AppMode = 'intro' | 'transitioning' | 'active';

export type CameraViewMode = 'follow' | 'cockpit' | 'drone' | 'topdown';

export type EnvironmentType = 'tropical_day' | 'golden_dawn' | 'sunset' | 'night_sky';

export type WaterType = 'simple' | 'complex';

export type FXType = 'ripple' | 'fluid';
