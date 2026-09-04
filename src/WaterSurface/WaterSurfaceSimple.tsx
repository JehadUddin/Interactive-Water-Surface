import { useMemo, useRef } from 'react';
import { PlaneGeometry, RepeatWrapping, Vector2, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { WaterSimple } from './Water/WaterSimple';

import { WaterContext } from './WaterContext';

type Props = {
	width?: number;
	length?: number;
	dimensions?: number;
	waterColor?: number | string;
	position?: [number, number, number];
	distortionScale?: number;
	fxDistortionFactor?: number;
	fxDisplayColorAlpha?: number;
	fxMixColor?: number | string;
	children?: React.ReactNode;
	sharedPointerRef?: React.MutableRefObject<Vector2>;
};

export default function WaterSurfaceSimple({
	width = 3500,
	length = 3500,
	dimensions = 512,
	waterColor = 0x000000,
	position = [0, 0, 0],
	distortionScale = 0.7,
	fxDistortionFactor = 0.2,
	fxDisplayColorAlpha = 0.0,
	fxMixColor = 0x000000,
	children,
	sharedPointerRef,
}: Props) {
	const ref = useRef<any>();
	const internalPointer = useRef(new Vector2(0, 0));
	const refPointer = sharedPointerRef || internalPointer;

	const gl = useThree((state) => state.gl);
	const waterNormals = useTexture('/water/simple/waternormals.jpeg');
	waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;
	const geom = useMemo(
		() => new PlaneGeometry(width, length, 240, 240),
		[length, width]
	);
	const config = useMemo(
		() => ({
			textureWidth: dimensions,
			textureHeight: dimensions,
			waterNormals,

			waterColor: waterColor,
			distortionScale: distortionScale,
			fxDistortionFactor: fxDistortionFactor,
			fxDisplayColorAlpha: fxDisplayColorAlpha,
			fxMixColor: fxMixColor,
			fog: true,
			format: (gl as any).encoding,
		}),
		[
			dimensions,
			distortionScale,
			fxDisplayColorAlpha,
			fxDistortionFactor,
			fxMixColor,
			gl,
			waterColor,
			waterNormals,
		]
	);
	useFrame((state, delta) => {
		if (ref.current) {
			ref.current.position.x = state.camera.position.x;
			ref.current.position.z = state.camera.position.z;
			ref.current.position.y = position[1];
		}
		if (ref.current?.material?.uniforms?.time) {
			ref.current.material.uniforms.time.value += delta / 2;
		}
	});

	//const refPointer = useRef(new Vector2(0, 0));

	const waterObj = useMemo(
		() => new WaterSimple(geom, config),
		[geom, config]
	);

	return (
		<WaterContext.Provider value={{ ref: ref, refPointer: refPointer }}>
			<primitive
				ref={ref}
				object={waterObj}
				rotation-x={-Math.PI / 2}
				position={position}
			/>

			{children}
		</WaterContext.Provider>
	);
}
