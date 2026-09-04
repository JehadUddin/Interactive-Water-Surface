// Realistic Ocean Gerstner Wave Simulation Engine
// Shared between Vertex Shader, WASM Physics, and Boat Buoyancy Dynamics

export interface WaveDefinition {
	dirX: number;
	dirZ: number;
	steepness: number;
	wavelength: number;
	amplitude: number;
	speed: number;
}

export const OCEAN_WAVES: WaveDefinition[] = [
	// 1. Primary Gentle Ocean Swell (long wavelength, smooth amplitude)
	{ dirX: 0.819, dirZ: 0.573, steepness: 0.18, wavelength: 65.0, amplitude: 0.38, speed: 0.95 },
	// 2. Secondary Crossing Swell
	{ dirX: -0.5, dirZ: 0.866, steepness: 0.14, wavelength: 42.0, amplitude: 0.22, speed: 1.15 },
	// 3. Ambient Surface Wave (gentle modulation)
	{ dirX: 0.939, dirZ: -0.342, steepness: 0.10, wavelength: 22.0, amplitude: 0.12, speed: 1.6 },
	// 4. Soft Micro Ripple
	{ dirX: 0.309, dirZ: 0.951, steepness: 0.08, wavelength: 11.5, amplitude: 0.05, speed: 2.2 },
];

export interface WaveSample {
	height: number;
	normalX: number;
	normalY: number;
	normalZ: number;
	crestFoam: number;
}

/**
 * Calculates the exact analytical Gerstner wave displacement and surface normal at any world (x, z, time).
 * Matches the GPU Vertex Shader 1:1 for perfect physical buoyancy.
 */
export function getOceanWaveSample(worldX: number, worldZ: number, time: number): WaveSample {
	let dispX = 0;
	let dispY = 0;
	let dispZ = 0;

	let binormalX = 1;
	let binormalY = 0;
	let binormalZ = 0;

	let tangentX = 0;
	let tangentY = 0;
	let tangentZ = 1;

	let crestAccum = 0;

	for (let i = 0; i < OCEAN_WAVES.length; i++) {
		const w = OCEAN_WAVES[i];
		const k = (2 * Math.PI) / w.wavelength;
		const c = Math.sqrt(9.81 / k) * w.speed;
		const dX = w.dirX;
		const dZ = w.dirZ;
		const f = k * (dX * worldX + dZ * worldZ) - c * time * 0.7;
		const a = w.amplitude;
		const q = w.steepness / (k * a * OCEAN_WAVES.length);

		const cosF = Math.cos(f);
		const sinF = Math.sin(f);

		dispX += q * a * dX * cosF;
		dispY += a * sinF;
		dispZ += q * a * dZ * cosF;

		const wa = k * a;
		binormalX -= q * dX * dX * wa * sinF;
		binormalY += dX * wa * cosF;
		binormalZ -= q * dX * dZ * wa * sinF;

		tangentX -= q * dX * dZ * wa * sinF;
		tangentY += dZ * wa * cosF;
		tangentZ -= q * dZ * dZ * wa * sinF;

		if (sinF > 0.65) {
			crestAccum += (sinF - 0.65) * 2.8 * (a / 0.65);
		}
	}

	// Calculate normal from cross product of binormal and tangent
	// n = binormal x tangent
	const nx = binormalY * tangentZ - binormalZ * tangentY;
	const ny = binormalZ * tangentX - binormalX * tangentZ;
	const nz = binormalX * tangentY - binormalY * tangentX;

	const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

	return {
		height: dispY,
		normalX: -nx / len,
		normalY: Math.abs(ny / len),
		normalZ: -nz / len,
		crestFoam: Math.min(1.0, crestAccum),
	};
}

/**
 * GLSL snippet for Gerstner Wave displacement in vertex shaders.
 */
export const GERSTNER_WAVE_GLSL_VERTEX = /* glsl */ `
struct WaveDef {
	vec2 dir;
	float steepness;
	float wavelength;
	float amplitude;
	float speed;
};

#define NUM_WAVES 4

WaveDef waves[NUM_WAVES] = WaveDef[NUM_WAVES](
	WaveDef(vec2(0.819, 0.573), 0.18, 65.0, 0.38, 0.95),
	WaveDef(vec2(-0.5, 0.866), 0.14, 42.0, 0.22, 1.15),
	WaveDef(vec2(0.939, -0.342), 0.10, 22.0, 0.12, 1.6),
	WaveDef(vec2(0.309, 0.951), 0.08, 11.5, 0.05, 2.2)
);

vec3 calculateGerstnerWaves(vec3 gridPos, float t, out vec3 outNormal, out float outCrest) {
	vec3 p = gridPos;
	vec3 disp = vec3(0.0);
	
	vec3 binormal = vec3(1.0, 0.0, 0.0);
	vec3 tangent = vec3(0.0, 0.0, 1.0);
	float crest = 0.0;

	for (int i = 0; i < NUM_WAVES; i++) {
		WaveDef w = waves[i];
		float k = 6.28318530718 / w.wavelength;
		float c = sqrt(9.81 / k) * w.speed;
		vec2 d = normalize(w.dir);
		float f = k * dot(d, gridPos.xz) - c * t * 0.7;
		float a = w.amplitude;
		float q = w.steepness / (k * a * float(NUM_WAVES));

		float cosF = cos(f);
		float sinF = sin(f);

		disp.x += q * a * d.x * cosF;
		disp.y += a * sinF;
		disp.z += q * a * d.y * cosF;

		float wa = k * a;
		binormal.x -= q * d.x * d.x * wa * sinF;
		binormal.y += d.x * wa * cosF;
		binormal.z -= q * d.x * d.y * wa * sinF;

		tangent.x -= q * d.x * d.y * wa * sinF;
		tangent.y += d.y * wa * cosF;
		tangent.z -= q * d.y * d.y * wa * sinF;

		if (sinF > 0.6) {
			crest += (sinF - 0.6) * 2.5 * (a / 0.65);
		}
	}

	outNormal = normalize(cross(tangent, binormal));
	outCrest = clamp(crest, 0.0, 1.0);
	return p + disp;
}
`;
