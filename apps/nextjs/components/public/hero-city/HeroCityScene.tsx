"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { getHeroQualitySettings } from "./heroCityPolicy";
import type { HeroQualitySettings } from "./heroCityPolicy";
import { createHeroResourceCleanup } from "./heroCityResources";

type MotionState = {
  pointerX: number;
  pointerY: number;
  scroll: number;
};

type SceneProps = {
  activeRegion: string;
  mobile: boolean;
  inView: boolean;
  lowPerformance: boolean;
  motionRef: MutableRefObject<MotionState>;
  onLowFps: () => void;
  onRendererCreated: () => void;
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
  const columns = mobile ? 26 : 52;
  const rows = mobile ? 28 : 42;
  const spacingX = mobile ? 3.65 : 3.25;
  const spacingZ = mobile ? 3.5 : 3.05;
  const candidates: Building[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      // Broad avenues sit in the deliberate gaps between neighbourhood blocks.
      if (column % 8 === 7 || row % 8 === 7) continue;
      const x = (column - (columns - 1) / 2) * spacingX + (hash2(column, row) - 0.5) * 0.34;
      const z = (row - (rows - 1) / 2) * spacingZ + (hash2(row + 27, column) - 0.5) * 0.32;
      const riverCenter = 18 + 12 * Math.sin(x * 0.038) + 3 * Math.sin(x * 0.09 + 0.6);
      if (Math.abs(z - riverCenter) < 7) continue;

      const coarse = smoothNoise(column * 0.16 + 4.3, row * 0.19 + 10.7);
      const fine = hash2(column + 14, row + 41);
      const outerProfile = Math.exp(-(((x - 5) ** 2) / 2450 + ((z + 3) ** 2) / 1060));
      const centralBusinessDistrict = Math.exp(-(((x - 5) ** 2) / 480 + ((z + 3) ** 2) / 235));
      const height =
        3.4 +
        outerProfile * (2.4 + coarse * 6.4) +
        coarse * 3.6 +
        fine * 2.1 +
        centralBusinessDistrict * (6 + fine * 10.5);

      candidates.push({
        x,
        z,
        width: 1.5 + hash2(row, column + 73) * 1.05,
        depth: 1.38 + hash2(column, row + 91) * 0.9,
        height,
      });
    }
  }

  // A stable shuffle removes a visible row-by-row cutoff while preserving the city plan.
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(hash2(index, 107) * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }
  return candidates.slice(0, count);
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
        `#include <color_fragment>`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
          vec2 cityGridUv = vec2(vCityUv.x * 4.0, vCityWorldPosition.y / 1.25);
          vec2 cityCell = floor(cityGridUv);
          vec2 cityCellUv = fract(cityGridUv);
          float cityWindowShape =
            step(0.19, cityCellUv.x) * step(cityCellUv.x, 0.81) *
            step(0.13, cityCellUv.y) * step(cityCellUv.y, 0.84);
          float cityWindowSeed = cityHash(cityCell + vec2(vCitySeed * 17.0, floor(vCitySeed * 91.0)));
          float cityWindowPeriod = 5.0 + cityHash(cityCell + vec2(vCitySeed * 31.0, 7.0)) * 8.0;
          float cityWindowPhase = floor((uCityTime + cityWindowSeed * cityWindowPeriod) / cityWindowPeriod);
          float cityWindowOn = step(0.88, cityHash(cityCell + vec2(vCitySeed * 29.0, cityWindowPhase)));
          float cityTwinkle = 0.94 + 0.06 * sin(uCityTime * 0.12 + cityWindowSeed * 6.28318);
         float cityWindowMask = cityWindowShape * cityWindowOn * (1.0 - step(0.5, vCityFaceTop));
           vec2 cityFacadeGrid = fract(cityGridUv);
          float cityFacadeEdge = 1.0 - smoothstep(0.0, 0.035, min(min(cityFacadeGrid.x, 1.0 - cityFacadeGrid.x), min(cityFacadeGrid.y, 1.0 - cityFacadeGrid.y)));
           vec3 cityWindowColor = vec3(0.788, 0.663, 0.431);
          diffuseColor.rgb += vec3(0.009, 0.021, 0.026) * cityFacadeEdge * (1.0 - step(0.5, vCityFaceTop));
          diffuseColor.rgb = mix(diffuseColor.rgb, cityWindowColor, cityWindowMask * 0.7);
          totalEmissiveRadiance += cityWindowColor * cityWindowMask * cityTwinkle * 0.9;`,
      );
  };
  return material;
}

function Buildings({ count, mobile }: { count: number; mobile: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const buildings = useMemo(() => createBuildings(count, mobile), [count, mobile]);
  // InstancedMesh is reconstructed when its count changes, so give each instance
  // its own resources instead of reusing args that R3F may already have disposed.
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [count, mobile]);
  const material = useMemo(() => createBuildingMaterial(), [count, mobile]);

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
      61 - motion.scroll * 4.3,
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

function FpsMonitor({ onLowFps, inView }: { onLowFps: () => void; inView: boolean }) {
  const warmupElapsed = useRef(0);
  const sampleElapsed = useRef(0);
  const sampleFrames = useRef(0);
  const slowWindows = useRef(0);
  const notified = useRef(false);

  useEffect(() => {
    warmupElapsed.current = 0;
    sampleElapsed.current = 0;
    sampleFrames.current = 0;
    slowWindows.current = 0;
  }, [inView]);

  useFrame((_, delta) => {
    if (!inView || notified.current || !Number.isFinite(delta) || delta <= 0) return;

    if (warmupElapsed.current < 3) {
      warmupElapsed.current += delta;
      return;
    }

    sampleElapsed.current += delta;
    sampleFrames.current += 1;
    if (sampleElapsed.current < 2) return;

    const fps = sampleFrames.current / sampleElapsed.current;
    slowWindows.current = fps < 24 ? slowWindows.current + 1 : 0;
    sampleElapsed.current = 0;
    sampleFrames.current = 0;

    if (slowWindows.current >= 2) {
      notified.current = true;
      onLowFps();
    }
  });

  return null;
}

function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        fog: false,
        uniforms: {},
        vertexShader: `
          varying vec2 vSkyUv;
          void main() {
            vSkyUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vSkyUv;
          void main() {
             float horizon = smoothstep(0.22, 0.51, vSkyUv.y);
             float upperNight = smoothstep(0.51, 0.8, vSkyUv.y);
            vec3 dusk = vec3(0.20, 0.15, 0.12);
            vec3 blueHour = vec3(0.035, 0.085, 0.105);
            vec3 midnight = vec3(0.012, 0.032, 0.047);
            vec3 sky = mix(dusk, blueHour, horizon);
            sky = mix(sky, midnight, upperNight * 0.86);
             float afterglow = exp(-pow((vSkyUv.y - 0.49) * 22.0, 2.0));
             sky += vec3(0.16, 0.055, 0.012) * afterglow;
            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    [],
  );
  const geometry = useMemo(() => new THREE.SphereGeometry(400, 36, 24), []);
  useEffect(
    () => createHeroResourceCleanup([material, geometry]),
    [material, geometry],
  );

  const skyRef = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => { skyRef.current?.position.copy(camera.position); });
  return <mesh ref={skyRef} geometry={geometry} material={material} renderOrder={-1000} frustumCulled={false} />;
}

function CityGround({ mobile }: { mobile: boolean }) {
  const { roads, edges } = useMemo(() => {
    const xRoads = mobile ? [-20, 9, 38] : [-60, -34, -8, 18, 44, 70];
    const zRoads = mobile ? [-19, 9, 37] : [-41, -17, 7, 31, 55];
    const roadDepth = mobile ? 108 : 150;
    const roadWidth = mobile ? 1.3 : 1.25;
    const verticalRoads = xRoads.map(x => ({ x, z: 0, width: roadWidth, depth: roadDepth, rotation: 0 }));
    const horizontalRoads = zRoads.map(z => ({
      x: 0,
      z,
      width: mobile ? 110 : 178,
      depth: roadWidth,
      rotation: 0,
    }));
    const roadEdges = [
      ...xRoads.flatMap(x => [
        { x: x - roadWidth / 2 - 0.08, z: 0, width: 0.035, depth: roadDepth, rotation: 0 },
        { x: x + roadWidth / 2 + 0.08, z: 0, width: 0.035, depth: roadDepth, rotation: 0 },
      ]),
      ...zRoads.flatMap(z => [
        { x: 0, z: z - roadWidth / 2 - 0.08, width: mobile ? 110 : 178, depth: 0.035, rotation: 0 },
        { x: 0, z: z + roadWidth / 2 + 0.08, width: mobile ? 110 : 178, depth: 0.035, rotation: 0 },
      ]),
    ];
    return { roads: [...verticalRoads, ...horizontalRoads], edges: roadEdges };
  }, [mobile]);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow={false}>
        <planeGeometry args={mobile ? [120, 112] : [205, 155]} />
        <meshStandardMaterial color="#071820" roughness={0.98} metalness={0.04} />
      </mesh>
      {roads.map((road, index) => (
        <mesh
          key={`road-${index}`}
          position={[road.x, 0.018, road.z]}
          rotation={[0, road.rotation, 0]}
        >
          <boxGeometry args={[road.width, 0.025, road.depth]} />
          <meshBasicMaterial color="#1D3D47" toneMapped={false} />
        </mesh>
      ))}
      {edges.map((edge, index) => (
        <mesh
          key={`road-edge-${index}`}
          position={[edge.x, 0.033, edge.z]}
          rotation={[0, edge.rotation, 0]}
        >
          <boxGeometry args={[edge.width, 0.008, edge.depth]} />
          <meshBasicMaterial color="#6A8890" transparent opacity={0.52} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

function NightRiver({ mobile }: { mobile: boolean }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const startX = -100;
    const endX = 100;
    const halfWidth = 6.4;
    const riverY = (x: number) => -(18 + 12 * Math.sin(x * 0.038) + 3 * Math.sin(x * 0.09 + 0.6));
    shape.moveTo(startX, riverY(startX) - halfWidth);
    for (let x = startX + 2; x <= endX; x += 2) {
      shape.lineTo(x, riverY(x) - halfWidth);
    }
    for (let x = endX; x >= startX; x -= 2) {
      shape.lineTo(x, riverY(x) + halfWidth);
    }
    shape.closePath();
    const riverGeometry = new THREE.ShapeGeometry(shape, 1);
    riverGeometry.rotateX(-Math.PI / 2);
    return riverGeometry;
  }, []);
  useEffect(() => createHeroResourceCleanup([geometry]), [geometry]);

  return (
    <mesh geometry={geometry} position={[0, 0.045, 0]} receiveShadow={false}>
      {mobile ? (
        <meshBasicMaterial color="#205666" toneMapped={false} side={THREE.DoubleSide} />
      ) : (
        <MeshReflectorMaterial
          color="#1B4A56"
          metalness={0.48}
          roughness={0.44}
          mirror={0.34}
          blur={[24, 24]}
          resolution={128}
          mixBlur={0.72}
          mixStrength={0.32}
          depthScale={0.12}
          minDepthThreshold={0.24}
          maxDepthThreshold={1.1}
          depthToBlurRatioBias={0.18}
          emissive="#0D2A33"
          emissiveIntensity={0.55}
          side={THREE.DoubleSide}
        />
      )}
    </mesh>
  );
}

function GoldDust({ count, mobile }: { count: number; mobile: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { geometry, drift } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (hash2(index, 1) - 0.5) * 172;
      positions[index * 3 + 1] = 1 + hash2(index, 2) * 27;
      positions[index * 3 + 2] = (hash2(index, 3) - 0.5) * 122;
      velocities[index * 3] = (hash2(index, 4) - 0.5) * 0.12;
      velocities[index * 3 + 1] = 0.015 + hash2(index, 5) * 0.04;
      velocities[index * 3 + 2] = (hash2(index, 6) - 0.5) * 0.1;
    }
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry: pointsGeometry, drift: velocities };
  }, [count]);

  useFrame((_, delta) => {
    const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
    const positions = attribute.array as Float32Array;
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      positions[offset] += drift[offset] * delta;
      positions[offset + 1] += drift[offset + 1] * delta;
      positions[offset + 2] += drift[offset + 2] * delta;
      if (positions[offset] > 88) positions[offset] = -88;
      if (positions[offset] < -88) positions[offset] = 88;
      if (positions[offset + 1] > 30) positions[offset + 1] = 1;
      if (positions[offset + 2] > 64) positions[offset + 2] = -64;
      if (positions[offset + 2] < -64) positions[offset + 2] = 64;
    }
    attribute.needsUpdate = true;
  });

  useEffect(() => createHeroResourceCleanup([geometry]), [geometry]);

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={WINDOW_GOLD}
        size={mobile ? 0.34 : 0.4}
        transparent
        opacity={0.55}
        depthWrite={false}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

function VehicleTrail({ z, offset, reverse }: { z: number; offset: number; reverse: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const distance = ((clock.elapsedTime * 3.6 + offset) % 176 + 176) % 176;
    ref.current.position.set(reverse ? 88 - distance : -88 + distance, 0.14, z);
  });

  return (
    <group ref={ref}>
      <mesh position={[reverse ? 0.62 : -0.62, 0, 0]}>
        <boxGeometry args={[1.28, 0.035, 0.085]} />
        <meshBasicMaterial color={WINDOW_GOLD} transparent opacity={0.68} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.105, 8, 6]} />
        <meshBasicMaterial color="#E3C88E" toneMapped={false} />
      </mesh>
    </group>
  );
}

function CityContents({
  activeRegion,
  mobile,
  quality,
}: {
  activeRegion: string;
  mobile: boolean;
  quality: HeroQualitySettings;
}) {
  const mobileRows = [-42, -14, 14, 42];
  const desktopRows = [-41, -17, 7, 31, 55];
  const vehicleRows = mobile ? mobileRows : desktopRows;

  return (
    <group position={mobile ? [0, 0, 0] : [12, 0, 0]}>
      <CityGround mobile={mobile} />
      <Buildings count={quality.buildingCount} mobile={mobile} />
      <NightRiver mobile={mobile} />
      <Highlight region={activeRegion} mobile={mobile} />
      <GoldDust count={quality.particleCount} mobile={mobile} />
      {!mobile && vehicleRows.map((z, index) => (
        <VehicleTrail
          key={`vehicle-${index}`}
          z={z}
          offset={index * 29 + 12}
          reverse={index % 2 === 1}
        />
      ))}
    </group>
  );
}

function SceneContents({
  activeRegion,
  mobile,
  inView,
  lowPerformance,
  motionRef,
  onLowFps,
  quality,
}: SceneProps & { quality: HeroQualitySettings }) {
  return (
    <>
      <SkyDome />
      <fog attach="fog" args={["#102D3B", 82, 205]} />
      <ambientLight intensity={0.72} color="#69838A" />
      <directionalLight position={[-22, 35, -16]} intensity={1.04} color="#829BA0" />
      <directionalLight position={[18, 18, 28]} intensity={0.26} color="#C9A96E" />
      <CityContents activeRegion={activeRegion} mobile={mobile} quality={quality} />
      {quality.postprocessing && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.6} luminanceThreshold={0.79} luminanceSmoothing={0.24} mipmapBlur />
          <Vignette offset={0.28} darkness={0.28} />
        </EffectComposer>
      )}
      {!lowPerformance && <FpsMonitor onLowFps={onLowFps} inView={inView} />}
      <CityCamera motionRef={motionRef} />
    </>
  );
}

export function HeroCityScene({
  activeRegion,
  mobile,
  inView,
  lowPerformance,
  motionRef,
  onLowFps,
  onRendererCreated,
}: SceneProps) {
  const quality = getHeroQualitySettings(mobile, lowPerformance);

  return (
    <Canvas
      dpr={quality.dpr}
      frameloop={inView ? "always" : "never"}
      camera={{ position: [0, 61, 89], fov: 39, near: 0.1, far: 600 }}
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
        onRendererCreated();
      }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <SceneContents
        activeRegion={activeRegion}
        mobile={mobile}
        inView={inView}
        lowPerformance={lowPerformance}
        motionRef={motionRef}
        onLowFps={onLowFps}
        onRendererCreated={onRendererCreated}
        quality={quality}
      />
    </Canvas>
  );
}

export default HeroCityScene;