import {
	Color,
	FrontSide,
	HalfFloatType,
	Matrix4,
	Mesh,
	PerspectiveCamera,
	Plane,
	ShaderMaterial,
	Side,
	Texture,
	UniformsLib,
	UniformsUtils,
	Vector3,
	Vector4,
	WebGLRenderTarget,
} from 'three';

/**
 * Work based on :
 * https://github.com/Slayvin: Flat mirror for three.js
 * https://home.adelphi.edu/~stemkoski/ : An implementation of water shader based on the flat mirror
 * http://29a.ch/ && http://29a.ch/slides/2012/webglwater/ : Water shader explanations in WebGL
 */

type WaterOptions = {
	textureWidth?: number;
	textureHeight?: number;
	clipBias?: number;
	alpha?: number;
	time?: number;
	waterNormals?: Texture;

	waterColor?: Color | string | number;
	eye?: Vector3;
	distortionScale?: number;
	side?: Side;
	fog?: boolean;

	fxDistortionFactor?: number;
	fxDisplayColorAlpha?: number;
	fxMixColor?: Color | string | number;
};

class WaterSimple extends Mesh {
	constructor(geometry: any, options: WaterOptions = {}) {
		super(geometry);

		//this.isWater = true;

		const scope = this;

		const textureWidth =
			options.textureWidth !== undefined ? options.textureWidth : 512;
		const textureHeight =
			options.textureHeight !== undefined ? options.textureHeight : 512;

		const clipBias =
			options.clipBias !== undefined ? options.clipBias : 0.0;
		const alpha = options.alpha !== undefined ? options.alpha : 1.0;
		const time = options.time !== undefined ? options.time : 0.0;
		const normalSampler =
			options.waterNormals !== undefined ? options.waterNormals : null;

		const waterColor = new Color(
			options.waterColor !== undefined ? options.waterColor : 0x7f7f7f
		);
		const eye =
			options.eye !== undefined ? options.eye : new Vector3(0, 0, 0);
		const distortionScale =
			options.distortionScale !== undefined
				? options.distortionScale
				: 20.0;
		const side = options.side !== undefined ? options.side : FrontSide;
		const fog = options.fog !== undefined ? options.fog : false;

		const fxDistortionFactor = options.fxDistortionFactor || 1.0;
		const fxDisplayColorAlpha = options.fxDisplayColorAlpha;
		const fxMixColor = new Color(options.fxMixColor || 0x000000);

		//

		const mirrorPlane = new Plane();
		const normal = new Vector3();
		const mirrorWorldPosition = new Vector3();
		const cameraWorldPosition = new Vector3();
		const rotationMatrix = new Matrix4();
		const lookAtPosition = new Vector3(0, 0, -1);
		const clipPlane = new Vector4();

		const view = new Vector3();
		const target = new Vector3();
		const q = new Vector4();

		const textureMatrix = new Matrix4();

		const mirrorCamera = new PerspectiveCamera();

		const renderTarget = new WebGLRenderTarget(
			textureWidth,
			textureHeight,
			{ type: HalfFloatType } //Dont know why, but it make results the same as Reflector
		);

		const mirrorShader = {
			name: 'MirrorShader',

			uniforms: UniformsUtils.merge([
				UniformsLib['fog'],
				UniformsLib['lights'],
				{
					//sunColor: { value: new Color(0x7f7f7f) },
					//sunDirection: { value: new Vector3(0.70707, 0.70707, 0) },
					normalSampler: { value: null },
					mirrorSampler: { value: null },
					alpha: { value: 1.0 },
					time: { value: 0.0 },
					size: { value: 1.0 },
					distortionScale: { value: 20.0 },
					textureMatrix: { value: new Matrix4() },
					eye: { value: new Vector3() },
					waterColor: { value: new Color(0x555555) },
					u_fx: { value: 0.0 },
					fxDistortionFactor: { value: 1.0 },
					fxDisplayColorAlpha: { value: 0.0 },
					fxMixColor: { value: new Vector3(0, 0, 0) },
				},
			]),

			vertexShader: /* glsl */ `
				uniform mat4 textureMatrix;
				uniform float time;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;
				varying vec2 vUv;
				varying vec3 vWaveNormal;
				varying float vWaveCrest;

				#include <common>
				#include <fog_pars_vertex>
				#include <shadowmap_pars_vertex>
				#include <logdepthbuf_pars_vertex>

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

						if (sinF > 0.58) {
							crest += (sinF - 0.58) * 2.8 * (a / 0.65);
						}
					}

					outNormal = normalize(cross(tangent, binormal));
					outCrest = clamp(crest, 0.0, 1.0);
					return gridPos + disp;
				}

				void main() {
					vUv = uv;

					vec3 origWorldPos = (modelMatrix * vec4( position, 1.0 )).xyz;
					vec3 waveNorm;
					float crest;
					vec3 dispWorldPos = calculateGerstnerWaves(origWorldPos, time, waveNorm, crest);

					vWaveNormal = waveNorm;
					vWaveCrest = crest;

					worldPosition = vec4(dispWorldPos, 1.0);
					mirrorCoord = textureMatrix * worldPosition;
					vec4 mvPosition = viewMatrix * worldPosition;
					gl_Position = projectionMatrix * mvPosition;

					#include <logdepthbuf_vertex>
					#include <fog_vertex>
					#include <shadowmap_vertex>
				}`,

			fragmentShader: /* glsl */ `
				uniform sampler2D mirrorSampler;
				uniform float alpha;
				uniform float time;
				uniform float size;
				uniform float distortionScale;
				uniform sampler2D normalSampler;
				uniform vec3 eye;
				uniform vec3 waterColor;

				uniform sampler2D u_fx;
				uniform float fxDistortionFactor;
				uniform float fxDisplayColorAlpha;
				uniform vec3 fxMixColor;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;
				varying vec2 vUv;
				varying vec3 vWaveNormal;
				varying float vWaveCrest;

				vec4 getNoise( vec2 uv ) {
					vec2 uv0 = ( uv * 0.06 ) + vec2(time * 0.025, time * 0.018);
					vec2 uv1 = ( uv * 0.18 ) - vec2(time * 0.035, -time * 0.025);
					vec2 uv2 = ( uv * 0.45 ) + vec2(-time * 0.06, time * 0.05);
					vec2 uv3 = ( uv * 1.1 ) - vec2(time * 0.10, time * 0.08);
					vec4 n0 = texture2D( normalSampler, uv0 );
					vec4 n1 = texture2D( normalSampler, uv1 );
					vec4 n2 = texture2D( normalSampler, uv2 );
					vec4 n3 = texture2D( normalSampler, uv3 );
					return (n0 + n1 * 0.6 + n2 * 0.35 + n3 * 0.2) - 1.075;
				}

				#include <common>
				#include <packing>
				#include <bsdfs>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <lights_pars_begin>
				#include <shadowmap_pars_fragment>
				#include <shadowmask_pars_fragment>

				void main() {
					#include <logdepthbuf_fragment>
					vec4 noise = getNoise( worldPosition.xz * size );
					vec3 microNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );
					
					// Combine physical Gerstner wave slope normal with micro ripple details
					vec3 surfaceNormal = normalize(vWaveNormal + microNormal * 0.42);

					vec3 worldToEye = eye - worldPosition.xyz;
					vec3 eyeDirection = normalize( worldToEye );
					float distance = length(worldToEye);

					vec2 screenUV = mirrorCoord.xy / mirrorCoord.w;
					vec4 fx = texture2D(u_fx, screenUV);
					float avgDistortion = ((fx.r + fx.g + fx.b) / 3.0) * fxDistortionFactor;

					vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale + avgDistortion;
					vec3 reflectionSample = vec3( texture2D( mirrorSampler, screenUV + distortion ) );

					// Optical Fresnel Reflection (grazing angles reflect sky, perpendicular sees water depth)
					float cosTheta = clamp(dot(eyeDirection, surfaceNormal), 0.0, 1.0);
					float fresnel = 0.05 + 0.95 * pow(1.0 - cosTheta, 4.0);

					// Dynamic sun specular sparkle
					vec3 sunDir = normalize(vec3(25.0, 35.0, 20.0));
					vec3 halfDir = normalize(sunDir + eyeDirection);
					float NdotH = max(dot(surfaceNormal, halfDir), 0.0);
					float sharpSpec = pow(NdotH, 256.0) * 1.6;
					float broadSpec = pow(NdotH, 28.0) * 0.3;
					float totalSpec = sharpSpec + broadSpec;

					// Subsurface Scattering glow through wave crests
					float sss = pow(clamp(dot(eyeDirection, -sunDir + surfaceNormal * 0.5), 0.0, 1.0), 3.0) * 0.45;
					vec3 sssColor = vec3(0.04, 0.38, 0.35);

					// Rich oceanic water gradient
					vec3 deepOcean = waterColor;
					vec3 shallowTurquoise = waterColor + vec3(0.03, 0.12, 0.15);
					vec3 waterBase = mix(deepOcean, shallowTurquoise, clamp((worldPosition.y + 3.5) * 0.5, 0.0, 1.0));
					waterBase += sssColor * sss;

					// Foam and whitecaps on physical wave crests
					float foamFactor = smoothstep(0.35, 0.8, vWaveCrest + noise.y * 0.2);
					vec3 whiteCapFoam = vec3(0.95, 0.98, 1.0) * foamFactor * 0.8;

					// Composite all maritime lighting passes
					vec3 outgoingLight = mix(waterBase, reflectionSample, fresnel) + vec3(totalSpec * fresnel) + whiteCapFoam;

					float luminance = dot(fx.rgb * fxDisplayColorAlpha, vec3(0.299, 0.587, 0.114));
					vec3 mixedColor = mix(outgoingLight, fx.rgb * fxDisplayColorAlpha, luminance * fxDisplayColorAlpha);
					mixedColor += fx.rgb * fxMixColor;

					gl_FragColor = vec4(mixedColor, alpha);

					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					#include <fog_fragment>	
				}`,
		};

		const material = new ShaderMaterial({
			name: mirrorShader.name,
			uniforms: UniformsUtils.clone(mirrorShader.uniforms),
			vertexShader: mirrorShader.vertexShader,
			fragmentShader: mirrorShader.fragmentShader,
			lights: true,
			side: side,
			fog: fog,
		});

		material.uniforms['mirrorSampler'].value = renderTarget.texture;
		material.uniforms['textureMatrix'].value = textureMatrix;
		material.uniforms['alpha'].value = alpha;
		material.uniforms['time'].value = time;
		material.uniforms['normalSampler'].value = normalSampler;

		material.uniforms['waterColor'].value = waterColor;

		material.uniforms['distortionScale'].value = distortionScale;

		material.uniforms['eye'].value = eye;

		material.uniforms['u_fx'].value = null;
		material.uniforms['fxDistortionFactor'].value = fxDistortionFactor;
		material.uniforms['fxDisplayColorAlpha'].value = fxDisplayColorAlpha;
		material.uniforms['fxMixColor'].value = fxMixColor;

		scope.material = material;

		scope.onBeforeRender = function (renderer, scene, camera) {
			mirrorWorldPosition.setFromMatrixPosition(scope.matrixWorld);
			cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

			rotationMatrix.extractRotation(scope.matrixWorld);

			normal.set(0, 0, 1);
			normal.applyMatrix4(rotationMatrix);

			view.subVectors(mirrorWorldPosition, cameraWorldPosition);

			// Avoid rendering when mirror is facing away

			if (view.dot(normal) > 0) return;

			view.reflect(normal).negate();
			view.add(mirrorWorldPosition);

			rotationMatrix.extractRotation(camera.matrixWorld);

			lookAtPosition.set(0, 0, -1);
			lookAtPosition.applyMatrix4(rotationMatrix);
			lookAtPosition.add(cameraWorldPosition);

			target.subVectors(mirrorWorldPosition, lookAtPosition);
			target.reflect(normal).negate();
			target.add(mirrorWorldPosition);

			mirrorCamera.position.copy(view);
			mirrorCamera.up.set(0, 1, 0);
			mirrorCamera.up.applyMatrix4(rotationMatrix);
			mirrorCamera.up.reflect(normal);
			mirrorCamera.lookAt(target);

			mirrorCamera.far = (camera as any).far; // Used in WebGLBackground

			mirrorCamera.updateMatrixWorld();
			mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);

			// Update the texture matrix
			textureMatrix.set(
				0.5,
				0.0,
				0.0,
				0.5,
				0.0,
				0.5,
				0.0,
				0.5,
				0.0,
				0.0,
				0.5,
				0.5,
				0.0,
				0.0,
				0.0,
				1.0
			);
			textureMatrix.multiply(mirrorCamera.projectionMatrix);
			textureMatrix.multiply(mirrorCamera.matrixWorldInverse);

			// Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
			// Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
			mirrorPlane.setFromNormalAndCoplanarPoint(
				normal,
				mirrorWorldPosition
			);
			mirrorPlane.applyMatrix4(mirrorCamera.matrixWorldInverse);

			clipPlane.set(
				mirrorPlane.normal.x,
				mirrorPlane.normal.y,
				mirrorPlane.normal.z,
				mirrorPlane.constant
			);

			const projectionMatrix = mirrorCamera.projectionMatrix;

			q.x =
				(Math.sign(clipPlane.x) + projectionMatrix.elements[8]) /
				projectionMatrix.elements[0];
			q.y =
				(Math.sign(clipPlane.y) + projectionMatrix.elements[9]) /
				projectionMatrix.elements[5];
			q.z = -1.0;
			q.w =
				(1.0 + projectionMatrix.elements[10]) /
				projectionMatrix.elements[14];

			// Calculate the scaled plane vector
			clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));

			// Replacing the third row of the projection matrix
			projectionMatrix.elements[2] = clipPlane.x;
			projectionMatrix.elements[6] = clipPlane.y;
			projectionMatrix.elements[10] = clipPlane.z + 1.0 - clipBias;
			projectionMatrix.elements[14] = clipPlane.w;

			eye.setFromMatrixPosition(camera.matrixWorld);

			// Render

			const currentRenderTarget = renderer.getRenderTarget();

			const currentXrEnabled = renderer.xr.enabled;
			const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

			scope.visible = false;

			renderer.xr.enabled = false; // Avoid camera modification and recursion
			renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows

			renderer.setRenderTarget(renderTarget);

			renderer.state.buffers.depth.setMask(true); // make sure the depth buffer is writable so it can be properly cleared, see #18897

			if (renderer.autoClear === false) renderer.clear();
			renderer.render(scene, mirrorCamera);

			scope.visible = true;

			renderer.xr.enabled = currentXrEnabled;
			renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

			renderer.setRenderTarget(currentRenderTarget);

			// Restore viewport

			const viewport = (camera as any).viewport;

			if (viewport !== undefined) {
				renderer.state.viewport(viewport);
			}
		};
	}
}

export { WaterSimple };
