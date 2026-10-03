"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";

type MotionState = {
  pointerX: number;
  pointerY: number;
  scroll: number;
};

type SceneProps = {
  activeRegion: string;
  mobile: boolean;
  inView: boolean;
  motionRef: MutableRefObject<MotionState>;
};

type Building = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
};

const WINDOW_GOLD = "#C9A96E";

function hash2(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = THREE.MathUtils.lerp(hash2(x0, y0), hash2(x0 + 1, y0), sx);
  const b = THREE.MathUtils.lerp(hash2(x0, y0 + 1), hash2(x0 + 1, y0 + 1), sx);
  return THREE.MathUtils.lerp(a, b, sy);
}

function createBuildings(count: number, mobile: boolean): Building[] {
  const columns = mobile ? 20 : 40;
  const rows = Math.ceil(count / columns);
  const spacingX = mobile ? 6.15 : 3.55;
  const spacingZ = mobile ? 5.9 : 3.25;
  const buildings: Building[] = [];

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = (column - (columns - 1) / 2) * spacingX + (hash2(column, row) - 0.5) * 0.72;
    const z = (row - (rows - 1) / 2) * spacingZ + (hash2(row + 27, column) - 0.5) * 0.7;
    const coarse = smoothNoise(column * 0.18 + 4.3, row * 0.2 + 10.7);
    const fine = hash2(column + 14, row + 41);
    const centerMass = Math.exp(-(((x - 5) ** 2) / 1550 + ((z + 3) ** 2) / 630));
    const height = 4.2 + coarse * 12 + fine * 5 + centerMass * (7 + fine * 11);

    buildings.push({
      x,
      z,
      width: 1.35 + hash2(index, 73) * 0.82,
      depth: 1.15 + hash2(index, 91) * 0.8,
      height,
    });
  }
  return buildings;
}

function createBuildingMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: "#0B1F2A",
    roughness: 0.84,
    metalness: 0.12,
  });
  material.defines = { ...material.defines, USE_UV: "" };
  material.needsUpdate = true;
  material.onBeforeCompile = shader => {
    shader.uniforms.uCityTime = { value: 0 };
    material.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec2 vCityUv;
         varying vec3 vCityWorldPosition;
         varying float vCityFaceTop;
         varying float vCitySeed;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vCityUv = uv;
         vCityFaceTop = abs(normal.y);
         #ifdef USE_INSTANCING
           vec4 cityWorldPosition = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
           vCitySeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
         #else
           vec4 cityWorldPosition = modelMatrix * vec4(transformed, 1.0);
           vCitySeed = 0.37;
         #endif
         vCityWorldPosition = cityWorldPosition.xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uCityTime;
         varying vec2 vCityUv;
         varying vec3 vCityWorldPosition;
         varying float vCityFaceTop;
         varying float vCitySeed;
         float cityHash(vec2 p) {
           return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
         }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         float cityVariation = fract(vCitySeed * 41.73);
         diffuseColor.rgb *= mix(0.78, 1.14, cityVariation);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         vec2 cityCell = floor(vCityUv * vec2(6.0, 13.0));
         vec2 cityCellUv = fract(vCityUv * vec2(6.0, 13.0));
         float cityWindowShape =
           step(0.13, cityCellUv.x) * step(cityCellUv.x, 0.84) *
           step(0.12, cityCellUv.y) * step(cityCellUv.y, 0.82);
         float cityWindowOn = step(0.62, cityHash(cityCell + vec2(vCitySeed * 17.0, floor(vCitySeed * 91.0))));
         float cityTwinkle = 0.72 + 0.28 * sin(uCityTime * 0.19 + cityHash(cityCell + vCitySeed) * 6.28318 + vCitySeed * 8.0);
         float cityWindowMask = cityWindowShape * cityWindowOn * (1.0 - step(0.5, vCityFaceTop));
          vec3 cityWindowColor = vec3(0.584, 0.396, 0.156);
         diffuseColor.rgb = mix(diffuseColor.rgb, cityWindowColor, cityWindowMask * 0.78);
          totalEmissiveRadiance += cityWindowColor * cityWindowMask * cityTwinkle * 0.9;`,
      );
  };
  return material;
}

function Buildings({ count, mobile }: { count: number; mobile: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const buildings = useMemo(() => createBuildings(count, mobile), [count, mobile]);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(() => createBuildingMaterial(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    buildings.forEach((building, index) => {
      transform.position.set(building.x, building.height / 2, building.z);
      transform.scale.set(building.width, building.height, building.depth);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [buildings]);

  useFrame(({ clock }) => {
    const shader = material.userData.shader as
      | { uniforms: { uCityTime?: { value: number } } }
      | undefined;
    if (shader?.uniforms.uCityTime) shader.uniforms.uCityTime.value = clock.elapsedTime;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled
      castShadow={false}
      receiveShadow={false}
    />
  );
}

function Highlight({ region, mobile }: { region: string; mobile: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const points: Record<string, [number, number]> = {
    "thu-duc": [26, -7],
    "bien-hoa": [45, -3],
    hcm: [5, 4],
    "tay-ninh": [-43, -10],
  };
  const point = points[region];

  useFrame(({ clock }) => {
    const phase = clock.elapsedTime * 0.42;
    if (groupRef.current) groupRef.current.position.y = 0.18 + Math.sin(phase) * 0.08;
    if (ringRef.current) ringRef.current.scale.setScalar(1 + Math.sin(phase) * 0.055);
  });

  if (!point) return null;

  return (
    <group ref={groupRef} position={[point[0], 0.18, point[1]]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <torusGeometry args={[mobile ? 3.1 : 4.2, 0.11, 6, 52]} />
        <meshBasicMaterial
          color={WINDOW_GOLD}
          transparent
          opacity={0.95}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <group position={[0, mobile ? 5.1 : 6.3, 0]}>
        {[0, Math.PI / 2].map(rotation => (
          <mesh
            key={rotation}
            rotation={[0, rotation, 0]}
            renderOrder={10}
          >
            <planeGeometry args={[mobile ? 0.7 : 0.8, mobile ? 10 : 12]} />
            <meshBasicMaterial
              color={WINDOW_GOLD}
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.08, 0]} renderOrder={10}>
        <circleGeometry args={[0.5, 20]} />
        <meshBasicMaterial
          color={WINDOW_GOLD}
          transparent
          opacity={0.96}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function CityCamera({
  motionRef,
}: {
  motionRef: MutableRefObject<MotionState>;
}) {
  const { camera } = useThree();
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const easedPointer = useRef({ x: 0, y: 0 });

  useFrame(({ clock }, delta) => {
    const motion = motionRef.current;
    const ease = 1 - Math.exp(-delta * 0.65);
    easedPointer.current.x = THREE.MathUtils.lerp(easedPointer.current.x, motion.pointerX, ease);
    easedPointer.current.y = THREE.MathUtils.lerp(easedPointer.current.y, motion.pointerY, ease);

    const orbit = (clock.elapsedTime / 90) * Math.PI * 2;
    const radius = 89;
    desiredPosition.set(
      Math.sin(orbit) * radius,
      31 - motion.scroll * 4.3,
      Math.cos(orbit) * radius,
    );
    camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 0.38));

    const yaw = THREE.MathUtils.degToRad(3) * easedPointer.current.x;
    const pitch = THREE.MathUtils.degToRad(3) * easedPointer.current.y;
    lookAt.set(
      Math.sin(yaw) * 89,
      10 - motion.scroll * 2.2 + pitch * 89,
      0,
    );
    camera.lookAt(lookAt);
  });

  return null;
}

function NightWater() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 51]} receiveShadow={false}>
      <planeGeometry args={[178, 42]} />
      <MeshReflectorMaterial
        color="#102B32"
        metalness={0.38}
        roughness={0.68}
        mirror={0.2}
        blur={[180, 60]}
        resolution={128}
        mixBlur={0.82}
        mixStrength={0.18}
        depthScale={0.16}
        minDepthThreshold={0.28}
        maxDepthThreshold={1.2}
        depthToBlurRatioBias={0.22}
      />
    </mesh>
  );
}

function SceneContents({ activeRegion, mobile, motionRef }: SceneProps) {
  return (
    <>
      <fog attach="fog" args={["#102D36", 70, 174]} />
      <ambientLight intensity={0.78} color="#557078" />
      <directionalLight position={[-22, 35, -16]} intensity={1.1} color="#7898A0" />
      <directionalLight position={[18, 18, 28]} intensity={0.32} color="#C9A96E" />
      <Buildings count={mobile ? 300 : 1200} mobile={mobile} />
      <Highlight region={activeRegion} mobile={mobile} />
      {!mobile && <NightWater />}
      {!mobile && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.6} luminanceThreshold={0.77} luminanceSmoothing={0.22} mipmapBlur />
        </EffectComposer>
      )}
      <CityCamera motionRef={motionRef} />
    </>
  );
}

export function HeroCityScene({ activeRegion, mobile, inView, motionRef }: SceneProps) {
  return (
    <Canvas
      dpr={mobile ? 1 : [1, 1.5]}
      frameloop={inView ? "always" : "never"}
      camera={{ position: [0, 31, 89], fov: 39, near: 0.1, far: 260 }}
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
        preserveDrawingBuffer: false,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor("#071923", 1);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
      }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <SceneContents
        activeRegion={activeRegion}
        mobile={mobile}
        inView={inView}
        motionRef={motionRef}
      />
    </Canvas>
  );
}

export default HeroCityScene;