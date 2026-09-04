import { useMemo, useRef } from 'react';
import { PlaneGeometry, Vector2 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { WaterComplex } from './Water/WaterComplex';
import { WaterContext } from './WaterContext';

type Props = {
	children?: React.ReactNode;
	position?: [number, number, number];
	width?: number;
	length?: number;
	color?: number | string;
	scale?: number;
	flowDirection?: Vector2 | [number, number];
	flowSpeed?: number;
	dimensions?: number;
	reflectivity?: number;
	fxDistortionFactor?: number;
	fxDisplayColorAlpha?: number;
	sharedPointerRef?: React.MutableRefObject<Vector2>;
};

export default function WaterSurfaceComplex({
	children,
	position,
	width = 3500,
	length = 3500,
	color,
	scale = 11,
	flowDirection = new Vector2(1.0, 0.5),
	flowSpeed = 0.05,
	dimensions = 512,
	reflectivity = 1.2,
	fxDistortionFactor = 0.2,
	fxDisplayColorAlpha = 0.0,
	sharedPointerRef,
}: Props) {
	const ref = useRef<any>();
	const internalPointer = useRef(new Vector2(0, 0));
	const refPointer = sharedPointerRef || internalPointer;

	const gl = useThree((state) => state.gl);
	const [waterNormals1, waterNormals2] = useTexture([
		'/water/complex/Water_1_M_Normal.jpg',
		'/water/complex/Water_2_M_Normal.jpg',
	]);
	//waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;
	const geom = useMemo(
		() => new PlaneGeometry(width, length, 2, 2),
		[length, width]
	);
	const config = useMemo(
		() => ({
			color: color,
			scale: scale,
			flowDirection: flowDirection as Vector2,
			flowSpeed: flowSpeed,
			textureWidth: dimensions,
			textureHeight: dimensions,
			normalMap0: waterNormals1,
			normalMap1: waterNormals2,
			reflectivity: reflectivity,
			encoding: (gl as any).encoding,
			fxDistortionFactor: fxDistortionFactor,
			fxDisplayColorAlpha: fxDisplayColorAlpha,
		}),
		[
			color,
			dimensions,
			flowDirection,
			flowSpeed,
			fxDisplayColorAlpha,
			fxDistortionFactor,
			gl,
			reflectivity,
			scale,
			waterNormals1,
			waterNormals2,
		]
	);

	useFrame((state) => {
		if (ref.current) {
			ref.current.position.x = state.camera.position.x;
			ref.current.position.z = state.camera.position.z;
		}
	});

	//const refPointer = useRef(new Vector2(0, 0));

	const waterObj = useMemo(
		() => new WaterComplex(geom, config),
		[geom, config]
	);

	return (
		<WaterContext.Provider value={{ ref, refPointer }}>
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
