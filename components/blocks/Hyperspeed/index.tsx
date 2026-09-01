'use client';

// Hyperspeed 포크. 원본은 `.claude/designRefactoring/Hyperspeed/Hyperspeed.tsx`다.
//
// 원본의 유일한 prop은 effectOptions이고 useEffect 의존성이 [effectOptions]라
// 옵션을 바꾸면 dispose() + new App() + 에셋 재로드가 통째로 일어났다. 이 포크는
// App을 마운트당 한 번만 만들고, 품질 노브는 forwardRef + useImperativeHandle로
// 노출한 명령형 API(setQuality/pause/resume/boost/settle/isLost)로 그 App
// 인스턴스에 직접 적용한다 — 캔버스도 WebGL 컨텍스트도 다시 만들지 않는다.
import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset } from 'postprocessing';
import * as THREE from 'three';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { FrameQualityGovernor, type QualityTier } from '@/lib/deviceQuality';
import { distortions, distortion_uniforms, distortion_vertex, type Distortion, type UniformValue } from './distortions';
import { CYAN_PALETTE, QUALITY_PROFILES, type QualityProfile } from './presets';

interface Colors {
  roadColor: number;
  islandColor: number;
  background: number;
  shoulderLines: number;
  brokenLines: number;
  leftCars: readonly number[];
  rightCars: readonly number[];
  sticks: number;
}

interface HyperspeedOptions {
  onSpeedUp?: (ev: MouseEvent | TouchEvent) => void;
  onSlowDown?: (ev: MouseEvent | TouchEvent) => void;
  distortion?: string | Distortion;
  length: number;
  roadWidth: number;
  islandWidth: number;
  lanesPerRoad: number;
  fov: number;
  fovSpeedUp: number;
  speedUp: number;
  carLightsFade: number;
  totalSideLightSticks: number;
  lightPairsPerRoadWay: number;
  shoulderLinesWidthPercentage: number;
  brokenLinesWidthPercentage: number;
  brokenLinesLengthPercentage: number;
  lightStickWidth: [number, number];
  lightStickHeight: [number, number];
  movingAwaySpeed: [number, number];
  movingCloserSpeed: [number, number];
  carLightsLength: [number, number];
  carLightsRadius: [number, number];
  carWidthPercentage: [number, number];
  carShiftX: [number, number];
  carFloorSeparation: [number, number];
  colors: Colors;
  isHyper?: boolean;
  // Task 4 (가) — 모바일 구도. fov를 넓히는 것은 채택하지 않았다(실측에서 p95가
  // 정확히 두 배로 뛴다 — 그리는 광선이 늘기 때문). 그리는 양을 늘리지 않는 이
  // 두 값만 옵션으로 뺀다. 기본값은 원본 하드코딩(8, -5)과 동일하다 — 실기기에서
  // 고르는 것은 Task 5의 일이고 여기서는 고를 수 있는 상태만 만든다.
  cameraY: number;
  cameraZ: number;
  // 광선 배치 난수 시드. 근거는 task-4-report.md의 (나) 절 참고.
  seed: number;
}

export interface HyperspeedProps {
  effectOptions?: Partial<HyperspeedOptions>;
}

export interface HyperspeedHandle {
  setQuality(tier: QualityTier): void;
  pause(): void;
  resume(): void;
  boost(): void;
  settle(): void;
  isLost(): boolean;
}

// 체류 중 기본 흐름 배율. 원본은 time = timer.getElapsed() + timeOffset이라
// 기본 흐름이 항상 1배로 흘렀고 speedUp으로는 줄일 수 없었다. 배경은
// 반응자이므로 체류 중에는 거의 멈춘 듯 흘러야 한다.
const IDLE_TIME_SCALE = 0.3;

// boost가 더하는 시간 배속의 목표치. 원본 2에서 낮춘다 — 최고 속도가 너무
// 빨라 전환이 튀었다.
const BOOST_TIME_SCALE = 1.15;

// speedUp이 목표로 수렴하는 시간 상수의 역수(1/초). 원본은
// Math.exp(-k*delta)를 그대로 비율로 써서 60fps에서 한 프레임에 간극의 86%를
// 메웠다 — 사실상 즉시 도달이라 가속도 감속도 보이지 않았다. 프레임률과
// 무관한 1 - exp(-rate*delta) 형태로 바로잡는다. 값이 작을수록 완만하다.
const SPEED_SMOOTHING_RATE = 1.6;

const defaultOptions: HyperspeedOptions = {
  onSpeedUp: () => {},
  onSlowDown: () => {},
  distortion: 'turbulentDistortion',
  length: 400,
  roadWidth: 10,
  islandWidth: 2,
  lanesPerRoad: 4,
  fov: 90,
  fovSpeedUp: 112,
  speedUp: BOOST_TIME_SCALE,
  carLightsFade: 0.4,
  totalSideLightSticks: 20,
  lightPairsPerRoadWay: 40,
  shoulderLinesWidthPercentage: 0.05,
  brokenLinesWidthPercentage: 0.1,
  brokenLinesLengthPercentage: 0.5,
  lightStickWidth: [0.12, 0.5],
  lightStickHeight: [1.3, 1.7],
  movingAwaySpeed: [60, 80],
  movingCloserSpeed: [-120, -160],
  carLightsLength: [400 * 0.03, 400 * 0.2],
  carLightsRadius: [0.05, 0.14],
  carWidthPercentage: [0.3, 0.5],
  carShiftX: [-0.8, 0.8],
  carFloorSeparation: [0, 5],
  colors: CYAN_PALETTE,
  cameraY: 8,
  cameraZ: -5,
  seed: 1
};

// 결정적 PRNG(mulberry32). 시드가 같으면 항상 같은 배치를 낸다. 원본은 전역
// Math.random()을 그대로 써서 마운트마다 광선 배치가 완전히 달라졌다 — 폰처럼
// 화면이 좁은 기기는 표본이 적어 편차가 그대로 드러난다.
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function random(base: number | [number, number], rng: () => number): number {
  if (Array.isArray(base)) {
    return rng() * (base[1] - base[0]) + base[0];
  }
  return rng() * base;
}

function pickRandom<T>(arr: T | readonly T[], rng: () => number): T {
  if (Array.isArray(arr)) {
    return (arr as readonly T[])[Math.floor(rng() * arr.length)];
  }
  return arr as T;
}

// this.colors처럼 프로퍼티 접근으로 읽으면 Array.isArray 뒤에도 TS가
// 유니온을 좁히지 못한다(파라미터라면 좁혀진다) — 그래서 별도 함수로 뺐다.
function toColorArray(colors: readonly number[] | THREE.Color): THREE.Color[] {
  return Array.isArray(colors) ? (colors as readonly number[]).map(c => new THREE.Color(c)) : [colors as THREE.Color];
}

function lerp(current: number, target: number, speed = 0.1, limit = 0.001): number {
  let change = (target - current) * speed;
  if (Math.abs(change) < limit) {
    change = target - current;
  }
  return change;
}

class CarLights {
  webgl: App;
  options: HyperspeedOptions;
  colors: readonly number[] | THREE.Color;
  speed: [number, number];
  fade: THREE.Vector2;
  mesh?: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;

  constructor(webgl: App, options: HyperspeedOptions, colors: readonly number[] | THREE.Color, speed: [number, number], fade: THREE.Vector2) {
    this.webgl = webgl;
    this.options = options;
    this.colors = colors;
    this.speed = speed;
    this.fade = fade;
  }

  // rng를 인자로 받아 초기 생성뿐 아니라 setQuality에 의한 재생성에서도
  // 호출된다 — 기존 mesh가 있으면 먼저 버린다.
  init(rng: () => number) {
    if (this.mesh) {
      this.webgl.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }

    const options = this.options;
    const curve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    const geometry = new THREE.TubeGeometry(curve, 40, 1, 8, false);

    const instanced = new THREE.InstancedBufferGeometry().copy(geometry as unknown as THREE.InstancedBufferGeometry);
    instanced.instanceCount = options.lightPairsPerRoadWay * 2;

    const laneWidth = options.roadWidth / options.lanesPerRoad;

    const colorArray = toColorArray(this.colors);

    const aOffset: number[] = [];
    const aMetrics: number[] = [];
    const aColor: number[] = [];

    for (let i = 0; i < options.lightPairsPerRoadWay; i++) {
      const radius = random(options.carLightsRadius, rng);
      const length = random(options.carLightsLength, rng);
      const spd = random(this.speed, rng);

      const carLane = i % options.lanesPerRoad;
      let laneX = carLane * laneWidth - options.roadWidth / 2 + laneWidth / 2;

      const carWidth = random(options.carWidthPercentage, rng) * laneWidth;
      const carShiftX = random(options.carShiftX, rng) * laneWidth;
      laneX += carShiftX;

      const offsetY = random(options.carFloorSeparation, rng) + radius * 1.3;
      const offsetZ = -random(options.length, rng);

      const color = pickRandom<THREE.Color>(colorArray, rng);

      aOffset.push(laneX - carWidth / 2, offsetY, offsetZ, laneX + carWidth / 2, offsetY, offsetZ);
      aMetrics.push(radius, length, spd, radius, length, spd);
      aColor.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    instanced.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(aOffset), 3, false));
    instanced.setAttribute('aMetrics', new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 3, false));
    instanced.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(aColor), 3, false));

    const material = new THREE.ShaderMaterial({
      fragmentShader: carLightsFragment,
      vertexShader: carLightsVertex,
      transparent: true,
      uniforms: Object.assign(
        {
          uTime: { value: 0 },
          uTravelLength: { value: options.length },
          uFade: { value: this.fade }
        },
        this.webgl.fogUniforms,
        (typeof this.options.distortion === 'object' ? this.options.distortion.uniforms : {}) || {}
      )
    });

    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <getDistortion_vertex>',
        typeof this.options.distortion === 'object' ? this.options.distortion.getDistortion : ''
      );
    };

    const mesh = new THREE.Mesh(instanced, material);
    mesh.frustumCulled = false;
    this.webgl.scene.add(mesh);
    this.mesh = mesh;
  }

  update(time: number) {
    if (!this.mesh) return;
    if (this.mesh.material.uniforms.uTime) {
      this.mesh.material.uniforms.uTime.value = time;
    }
  }
}

const carLightsFragment = `
  #define USE_FOG;
  ${THREE.ShaderChunk['fog_pars_fragment']}
  varying vec3 vColor;
  varying vec2 vUv;
  uniform vec2 uFade;
  void main() {
    vec3 color = vec3(vColor);
    float alpha = smoothstep(uFade.x, uFade.y, vUv.x);
    gl_FragColor = vec4(color, alpha);
    if (gl_FragColor.a < 0.0001) discard;
    ${THREE.ShaderChunk['fog_fragment']}
  }
`;

const carLightsVertex = `
  #define USE_FOG;
  ${THREE.ShaderChunk['fog_pars_vertex']}
  attribute vec3 aOffset;
  attribute vec3 aMetrics;
  attribute vec3 aColor;
  uniform float uTravelLength;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  #include <getDistortion_vertex>
  void main() {
    vec3 transformed = position.xyz;
    float radius = aMetrics.r;
    float myLength = aMetrics.g;
    float speed = aMetrics.b;

    transformed.xy *= radius;
    transformed.z *= myLength;

    transformed.z += myLength - mod(uTime * speed + aOffset.z, uTravelLength);
    transformed.xy += aOffset.xy;

    float progress = abs(transformed.z / uTravelLength);
    transformed.xyz += getDistortion(progress);

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
    gl_Position = projectionMatrix * mvPosition;
    vUv = uv;
    vColor = aColor;
    ${THREE.ShaderChunk['fog_vertex']}
  }
`;

class LightsSticks {
  webgl: App;
  options: HyperspeedOptions;
  mesh?: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;

  constructor(webgl: App, options: HyperspeedOptions) {
    this.webgl = webgl;
    this.options = options;
  }

  init(rng: () => number) {
    if (this.mesh) {
      this.webgl.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }

    const options = this.options;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const instanced = new THREE.InstancedBufferGeometry().copy(geometry as unknown as THREE.InstancedBufferGeometry);
    const totalSticks = options.totalSideLightSticks;
    instanced.instanceCount = totalSticks;

    const stickoffset = options.length / (totalSticks - 1);
    const aOffset: number[] = [];
    const aColor: number[] = [];
    const aMetrics: number[] = [];

    let colorArray: THREE.Color[];
    if (Array.isArray(options.colors.sticks)) {
      colorArray = options.colors.sticks.map(c => new THREE.Color(c));
    } else {
      colorArray = [new THREE.Color(options.colors.sticks)];
    }

    for (let i = 0; i < totalSticks; i++) {
      const width = random(options.lightStickWidth, rng);
      const height = random(options.lightStickHeight, rng);
      aOffset.push((i - 1) * stickoffset * 2 + stickoffset * rng());

      const color = pickRandom<THREE.Color>(colorArray, rng);
      aColor.push(color.r);
      aColor.push(color.g);
      aColor.push(color.b);

      aMetrics.push(width);
      aMetrics.push(height);
    }

    instanced.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(aOffset), 1, false));
    instanced.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(aColor), 3, false));
    instanced.setAttribute('aMetrics', new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 2, false));

    const material = new THREE.ShaderMaterial({
      fragmentShader: sideSticksFragment,
      vertexShader: sideSticksVertex,
      side: THREE.DoubleSide,
      uniforms: Object.assign(
        {
          uTravelLength: { value: options.length },
          uTime: { value: 0 }
        },
        this.webgl.fogUniforms,
        (typeof options.distortion === 'object' ? options.distortion.uniforms : {}) || {}
      )
    });

    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <getDistortion_vertex>',
        typeof this.options.distortion === 'object' ? this.options.distortion.getDistortion : ''
      );
    };

    const mesh = new THREE.Mesh(instanced, material);
    mesh.frustumCulled = false;
    this.webgl.scene.add(mesh);
    this.mesh = mesh;
  }

  update(time: number) {
    if (!this.mesh) return;
    if (this.mesh.material.uniforms.uTime) {
      this.mesh.material.uniforms.uTime.value = time;
    }
  }
}

const sideSticksVertex = `
  #define USE_FOG;
  ${THREE.ShaderChunk['fog_pars_vertex']}
  attribute float aOffset;
  attribute vec3 aColor;
  attribute vec2 aMetrics;
  uniform float uTravelLength;
  uniform float uTime;
  varying vec3 vColor;
  mat4 rotationY( in float angle ) {
    return mat4(
      cos(angle),		0,		sin(angle),	0,
      0,		        1.0,	0,			0,
      -sin(angle),	    0,		cos(angle),	0,
      0, 		        0,		0,			1
    );
  }
  #include <getDistortion_vertex>
  void main(){
    vec3 transformed = position.xyz;
    float width = aMetrics.x;
    float height = aMetrics.y;

    transformed.xy *= vec2(width, height);
    float time = mod(uTime * 60. * 2. + aOffset, uTravelLength);

    transformed = (rotationY(3.14/2.) * vec4(transformed,1.)).xyz;
    transformed.z += - uTravelLength + time;

    float progress = abs(transformed.z / uTravelLength);
    transformed.xyz += getDistortion(progress);

    transformed.y += height / 2.;
    transformed.x += -width / 2.;
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
    gl_Position = projectionMatrix * mvPosition;
    vColor = aColor;
    ${THREE.ShaderChunk['fog_vertex']}
  }
`;

const sideSticksFragment = `
  #define USE_FOG;
  ${THREE.ShaderChunk['fog_pars_fragment']}
  varying vec3 vColor;
  void main(){
    vec3 color = vec3(vColor);
    gl_FragColor = vec4(color,1.);
    ${THREE.ShaderChunk['fog_fragment']}
  }
`;

class Road {
  webgl: App;
  options: HyperspeedOptions;
  uTime: { value: number };
  leftRoadWay!: THREE.Mesh;
  rightRoadWay!: THREE.Mesh;
  island!: THREE.Mesh;

  constructor(webgl: App, options: HyperspeedOptions) {
    this.webgl = webgl;
    this.options = options;
    this.uTime = { value: 0 };
  }

  createPlane(side: number, isRoad: boolean) {
    const options = this.options;
    const segments = 100;
    const geometry = new THREE.PlaneGeometry(isRoad ? options.roadWidth : options.islandWidth, options.length, 20, segments);

    let uniforms: Record<string, { value: UniformValue }> = {
      uTravelLength: { value: options.length },
      uColor: {
        value: new THREE.Color(isRoad ? options.colors.roadColor : options.colors.islandColor)
      },
      uTime: this.uTime
    };

    if (isRoad) {
      uniforms = Object.assign(uniforms, {
        uLanes: { value: options.lanesPerRoad },
        uBrokenLinesColor: {
          value: new THREE.Color(options.colors.brokenLines)
        },
        uShoulderLinesColor: {
          value: new THREE.Color(options.colors.shoulderLines)
        },
        uShoulderLinesWidthPercentage: {
          value: options.shoulderLinesWidthPercentage
        },
        uBrokenLinesLengthPercentage: {
          value: options.brokenLinesLengthPercentage
        },
        uBrokenLinesWidthPercentage: {
          value: options.brokenLinesWidthPercentage
        }
      });
    }

    const material = new THREE.ShaderMaterial({
      fragmentShader: isRoad ? roadFragment : islandFragment,
      vertexShader: roadVertex,
      side: THREE.DoubleSide,
      uniforms: Object.assign(uniforms, this.webgl.fogUniforms, (typeof options.distortion === 'object' ? options.distortion.uniforms : {}) || {})
    });

    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <getDistortion_vertex>',
        typeof this.options.distortion === 'object' ? this.options.distortion.getDistortion : ''
      );
    };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.z = -options.length / 2;
    mesh.position.x += (this.options.islandWidth / 2 + options.roadWidth / 2) * side;

    this.webgl.scene.add(mesh);
    return mesh;
  }

  init() {
    this.leftRoadWay = this.createPlane(-1, true);
    this.rightRoadWay = this.createPlane(1, true);
    this.island = this.createPlane(0, false);
  }

  update(time: number) {
    this.uTime.value = time;
  }
}

const roadBaseFragment = `
  #define USE_FOG;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uTime;
  #include <roadMarkings_vars>
  ${THREE.ShaderChunk['fog_pars_fragment']}
  void main() {
    vec2 uv = vUv;
    vec3 color = vec3(uColor);
    #include <roadMarkings_fragment>
    gl_FragColor = vec4(color, 1.);
    ${THREE.ShaderChunk['fog_fragment']}
  }
`;

const islandFragment = roadBaseFragment.replace('#include <roadMarkings_fragment>', '').replace('#include <roadMarkings_vars>', '');

const roadMarkings_vars = `
  uniform float uLanes;
  uniform vec3 uBrokenLinesColor;
  uniform vec3 uShoulderLinesColor;
  uniform float uShoulderLinesWidthPercentage;
  uniform float uBrokenLinesWidthPercentage;
  uniform float uBrokenLinesLengthPercentage;
  highp float random(vec2 co) {
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt = dot(co.xy, vec2(a, b));
    highp float sn = mod(dt, 3.14);
    return fract(sin(sn) * c);
  }
`;

const roadMarkings_fragment = `
  uv.y = mod(uv.y + uTime * 0.05, 1.);
  float laneWidth = 1.0 / uLanes;
  float brokenLineWidth = laneWidth * uBrokenLinesWidthPercentage;
  float laneEmptySpace = 1. - uBrokenLinesLengthPercentage;

  float brokenLines = step(1.0 - brokenLineWidth, fract(uv.x * 2.0)) * step(laneEmptySpace, fract(uv.y * 10.0));
  float sideLines = step(1.0 - brokenLineWidth, fract((uv.x - laneWidth * (uLanes - 1.0)) * 2.0)) + step(brokenLineWidth, uv.x);

  brokenLines = mix(brokenLines, sideLines, uv.x);
`;

const roadFragment = roadBaseFragment
  .replace('#include <roadMarkings_fragment>', roadMarkings_fragment)
  .replace('#include <roadMarkings_vars>', roadMarkings_vars);

const roadVertex = `
  #define USE_FOG;
  uniform float uTime;
  ${THREE.ShaderChunk['fog_pars_vertex']}
  uniform float uTravelLength;
  varying vec2 vUv;
  #include <getDistortion_vertex>
  void main() {
    vec3 transformed = position.xyz;
    vec3 distortion = getDistortion((transformed.y + uTravelLength / 2.) / uTravelLength);
    transformed.x += distortion.x;
    transformed.z += distortion.y;
    transformed.y += -1. * distortion.z;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
    gl_Position = projectionMatrix * mvPosition;
    vUv = uv;
    ${THREE.ShaderChunk['fog_vertex']}
  }
`;

function resizeRendererToDisplaySize(
  renderer: THREE.WebGLRenderer,
  setSize: (width: number, height: number, updateStyle: boolean) => void
) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) return false;

  // 드로잉 버퍼는 CSS 크기 x pixelRatio다. CSS 크기와 직접 비교하면 DPR이 1이
  // 아닌 기기에서 매 프레임 불일치로 판정돼 composer의 렌더 타깃을 계속 다시
  // 만든다.
  const pixelRatio = renderer.getPixelRatio();
  const needResize =
    canvas.width !== Math.floor(width * pixelRatio) ||
    canvas.height !== Math.floor(height * pixelRatio);
  if (needResize) {
    renderer.setSize(width, height, false);
    setSize(width, height, false);
  }
  return needResize;
}

class App {
  container: HTMLElement;
  options: HyperspeedOptions;
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  renderPass!: RenderPass;
  smaaPass!: EffectPass;
  bloomPass?: EffectPass;
  timer: THREE.Timer;
  assets: { smaa?: { search?: HTMLImageElement; area?: HTMLImageElement } };
  disposed: boolean;
  paused: boolean;
  lost: boolean;
  rafId: number | null;
  frameCounter: number;
  qualityProfile: QualityProfile;
  governor: FrameQualityGovernor;
  road: Road;
  leftCarLights: CarLights;
  rightCarLights: CarLights;
  leftSticks: LightsSticks;
  fogUniforms: Record<string, { value: UniformValue }>;
  fovTarget: number;
  speedUpTarget: number;
  speedUp: number;
  // 체류 중 흐름을 직접 제어하기 위한 누적기. timer.getElapsed()를 그대로
  // 쓰면 1배 고정이라 느리게 만들 수 없다.
  baseTime: number;
  timeOffset: number;
  hasValidSize: boolean;

  constructor(container: HTMLElement, options: HyperspeedOptions) {
    this.options = options;
    if (!this.options.distortion) {
      this.options.distortion = {
        uniforms: distortion_uniforms,
        getDistortion: distortion_vertex
      };
    }
    this.container = container;
    this.hasValidSize = false;
    this.disposed = false;
    this.paused = false;
    this.lost = false;
    this.rafId = null;
    this.frameCounter = 0;
    // App은 항상 high로 시작한다 — defaultOptions의 lightPairsPerRoadWay(40) /
    // totalSideLightSticks(20)가 이미 high 프로필과 같고, 다른 tier로 시작하고
    // 싶은 호출부는 마운트 직후 ref.setQuality()를 부르면 된다(새 prop을 만들지
    // 않는다 — Interfaces 절이 정한 표면은 QualityProfile/QUALITY_PROFILES/
    // HyperspeedHandle뿐이다).
    this.qualityProfile = QUALITY_PROFILES.high;
    this.governor = new FrameQualityGovernor('high');

    const initW = Math.max(1, container.offsetWidth);
    const initH = Math.max(1, container.offsetHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true
    });
    // pixel ratio를 먼저 갱신한 뒤 size를 계산한다 — profile 변경·resize에서도
    // 같은 순서를 지킨다(setQuality/onWindowResize/setSize 참고).
    this.renderer.setPixelRatio(this.effectivePixelRatio());
    this.renderer.setSize(initW, initH, false);

    this.composer = new EffectComposer(this.renderer);

    // canvas는 컨테이너를 채우도록 CSS로 고정한다. three.js의 setSize(..., false)는
    // 드로잉 버퍼만 바꾸고 style을 건드리지 않는데, style이 없으면 canvas는 자기
    // width/height 속성(= CSS 크기 x DPR)만큼 레이아웃된다. DPR 1.3인 데스크톱에서
    // 1536px 컨테이너의 canvas가 1996px로 깔려 좌상단만 보이고, DPR 3인 폰에서는
    // 1080px가 360px 화면에 깔려 빈 하늘만 보였다. clientWidth도 레이아웃 박스가
    // 아니라 드로잉 버퍼를 되돌려 resizeRendererToDisplaySize가 자기 자신을 재고
    // 있었다 — 그래서 영원히 교정되지 않았다.
    const canvasElement = this.renderer.domElement;
    canvasElement.style.display = 'block';
    canvasElement.style.width = '100%';
    canvasElement.style.height = '100%';

    container.appendChild(canvasElement);

    this.camera = new THREE.PerspectiveCamera(options.fov, initW / initH, 0.1, 10000);
    this.camera.position.z = options.cameraZ;
    this.camera.position.y = options.cameraY;
    this.camera.position.x = 0;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    const fog = new THREE.Fog(options.colors.background, options.length * 0.2, options.length * 500);
    this.scene.fog = fog;

    this.fogUniforms = {
      fogColor: { value: fog.color },
      fogNear: { value: fog.near },
      fogFar: { value: fog.far }
    };

    // three 0.185에서 Clock은 deprecated다. THREE.Timer는 getDelta()/getElapsed() 전에
    // update(timestamp)를 먼저 호출해야 한다 — tick()에서 매 프레임 갱신한다.
    this.timer = new THREE.Timer();
    this.assets = {};

    this.road = new Road(this, options);
    this.leftCarLights = new CarLights(
      this,
      options,
      options.colors.leftCars,
      options.movingAwaySpeed,
      new THREE.Vector2(0, 1 - options.carLightsFade)
    );
    this.rightCarLights = new CarLights(
      this,
      options,
      options.colors.rightCars,
      options.movingCloserSpeed,
      new THREE.Vector2(1, 0 + options.carLightsFade)
    );
    this.leftSticks = new LightsSticks(this, options);

    this.fovTarget = options.fov;
    this.speedUpTarget = 0;
    this.speedUp = 0;
    this.baseTime = 0;
    this.timeOffset = 0;

    this.tick = this.tick.bind(this);
    this.init = this.init.bind(this);
    this.setSize = this.setSize.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);

    this.onWindowResize = this.onWindowResize.bind(this);
    this.onContextLost = this.onContextLost.bind(this);
    this.onContextRestored = this.onContextRestored.bind(this);
    window.addEventListener('resize', this.onWindowResize);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    if (container.offsetWidth > 0 && container.offsetHeight > 0) {
      this.hasValidSize = true;
    }
  }

  // 기기 DPR과 profile.maxDpr 중 작은 값. maxDpr 0은 "상한 없음"을 뜻하므로
  // Math.min(dpr, 0)이 되지 않도록 Infinity로 치환하는 분기가 반드시 있어야 한다.
  private effectivePixelRatio(): number {
    const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cap = this.qualityProfile.maxDpr === 0 ? Infinity : this.qualityProfile.maxDpr;
    return Math.min(deviceDpr, cap);
  }

  onContextLost(event: Event) {
    event.preventDefault();
    this.lost = true;
  }

  onContextRestored() {
    this.lost = false;
  }

  isLost(): boolean {
    return this.lost;
  }

  onWindowResize() {
    const width = this.container.offsetWidth;
    const height = this.container.offsetHeight;

    if (width <= 0 || height <= 0) {
      this.hasValidSize = false;
      return;
    }

    this.renderer.setPixelRatio(this.effectivePixelRatio());
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(width, height);
    this.hasValidSize = true;
  }

  initPasses() {
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.renderPass.renderToScreen = false;
    this.composer.addPass(this.renderPass);

    this.smaaPass = new EffectPass(
      this.camera,
      new SMAAEffect({
        preset: SMAAPreset.MEDIUM
      })
    );
    this.smaaPass.renderToScreen = true;
    this.composer.addPass(this.smaaPass);
  }

  // bloom pass만 떼어내 교체한다 — renderer/composer/scene은 그대로 둔다.
  // low profile은 bloom이 꺼져 있어 이 pass 자체가 없다.
  private rebuildBloomPass(profile: QualityProfile) {
    if (this.bloomPass) {
      this.composer.removePass(this.bloomPass);
      this.bloomPass.dispose();
      this.bloomPass = undefined;
    }

    if (!profile.bloom) return;

    const bloomPass = new EffectPass(
      this.camera,
      new BloomEffect({
        luminanceThreshold: 0.2,
        luminanceSmoothing: 0,
        resolutionScale: profile.resolutionScale
      })
    );
    bloomPass.renderToScreen = false;
    // renderPass(0) 다음, smaaPass 이전에 끼워 넣는다.
    this.composer.addPass(bloomPass, 1);
    this.bloomPass = bloomPass;
  }

  // 광선 수(lightPairsPerRoadWay/totalSideLightSticks)가 바뀌면 인스턴스
  // 버퍼 크기 자체가 달라져 mesh를 다시 만들어야 한다. renderer/canvas/scene은
  // 건드리지 않는다 — 매번 같은 시드로 재추첨해 배치를 재현 가능하게 한다.
  private rebuildLights() {
    const rng = createSeededRandom(this.options.seed);

    this.leftCarLights.init(rng);
    this.leftCarLights.mesh?.position.setX(-this.options.roadWidth / 2 - this.options.islandWidth / 2);

    this.rightCarLights.init(rng);
    this.rightCarLights.mesh?.position.setX(this.options.roadWidth / 2 + this.options.islandWidth / 2);

    this.leftSticks.init(rng);
    this.leftSticks.mesh?.position.setX(-(this.options.roadWidth + this.options.islandWidth / 2));
  }

  // 여섯 노브를 전부 이 App 인스턴스에 직접 적용한다 — dispose()도 새 App()도,
  // WebGL 컨텍스트도 canvas도 다시 만들지 않는다.
  private applyQualityProfile(profile: QualityProfile) {
    this.qualityProfile = profile;

    this.options.lightPairsPerRoadWay = profile.lightPairsPerRoadWay;
    this.options.totalSideLightSticks = profile.totalSideLightSticks;
    this.rebuildLights();

    this.renderer.setPixelRatio(this.effectivePixelRatio());
    if (this.hasValidSize) {
      const canvas = this.renderer.domElement;
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      this.composer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    }

    this.rebuildBloomPass(profile);
    this.frameCounter = 0;
  }

  // 명령형 ref API의 핵심. FrameQualityGovernor가 새 tier를 반환했을 때도
  // 같은 경로를 탄다 — 적용 로직이 두 곳으로 갈라지지 않는다.
  setQuality(tier: QualityTier) {
    this.applyQualityProfile(QUALITY_PROFILES[tier]);
    this.container.dataset.qualityTier = tier;
  }

  loadAssets(): Promise<void> {
    const assets = this.assets;
    return new Promise(resolve => {
      const manager = new THREE.LoadingManager(resolve);

      const searchImage = new Image();
      const areaImage = new Image();
      assets.smaa = {};

      searchImage.addEventListener('load', function () {
        assets.smaa!.search = this;
        manager.itemEnd('smaa-search');
      });

      areaImage.addEventListener('load', function () {
        assets.smaa!.area = this;
        manager.itemEnd('smaa-area');
      });

      manager.itemStart('smaa-search');
      manager.itemStart('smaa-area');

      searchImage.src = SMAAEffect.searchImageDataURL;
      areaImage.src = SMAAEffect.areaImageDataURL;
    });
  }

  init() {
    // loadAssets()가 비동기라 그 사이에 언마운트되면 dispose()가 먼저 끝난다.
    // 그 뒤 도착한 init()이 죽은 객체 위에서 돌면 composer가 null이라 던진다.
    // 개발 StrictMode의 이중 마운트에서 매번 재현되고, 로드 중 이탈에서도
    // 같은 일이 난다.
    if (this.disposed) return;

    this.initPasses();
    this.road.init();
    this.setQuality('high');

    this.container.addEventListener('mousedown', this.onMouseDown);
    this.container.addEventListener('mouseup', this.onMouseUp);
    this.container.addEventListener('mouseout', this.onMouseUp);

    this.container.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.container.addEventListener('touchend', this.onTouchEnd, { passive: true });
    this.container.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    this.container.addEventListener('contextmenu', this.onContextMenu);

    this.tick();
  }

  // boost/settle이 노출하는 것과 같은 동작이다 — 원본의 onMouseDown/onMouseUp이
  // 이미 하던 일을 명령형 메서드로 옮겼다.
  boost() {
    this.fovTarget = this.options.fovSpeedUp;
    this.speedUpTarget = this.options.speedUp;
  }

  settle() {
    this.fovTarget = this.options.fov;
    this.speedUpTarget = 0;
  }

  onMouseDown(ev: MouseEvent) {
    if (this.options.onSpeedUp) this.options.onSpeedUp(ev);
    this.boost();
  }

  onMouseUp(ev: MouseEvent) {
    if (this.options.onSlowDown) this.options.onSlowDown(ev);
    this.settle();
  }

  onTouchStart(ev: TouchEvent) {
    if (this.options.onSpeedUp) this.options.onSpeedUp(ev);
    this.boost();
  }

  onTouchEnd(ev: TouchEvent) {
    if (this.options.onSlowDown) this.options.onSlowDown(ev);
    this.settle();
  }

  onContextMenu(ev: MouseEvent) {
    ev.preventDefault();
  }

  update(delta: number) {
    const lerpPercentage = Math.exp(-(-60 * Math.log2(1 - 0.1)) * delta);

    // 프레임률과 무관한 지수 수렴. 원본의 lerpPercentage는 delta가 작을수록
    // 1에 가까워져 한 프레임에 거의 다 메웠다 — 방향이 뒤집혀 있었다.
    const speedSmoothing = 1 - Math.exp(-SPEED_SMOOTHING_RATE * delta);
    this.speedUp += (this.speedUpTarget - this.speedUp) * speedSmoothing;

    this.baseTime += delta * IDLE_TIME_SCALE;
    this.timeOffset += this.speedUp * delta;
    const time = this.baseTime + this.timeOffset;

    this.rightCarLights.update(time);
    this.leftCarLights.update(time);
    this.leftSticks.update(time);
    this.road.update(time);

    let updateCamera = false;
    const fovChange = lerp(this.camera.fov, this.fovTarget, lerpPercentage);
    if (fovChange !== 0) {
      this.camera.fov += fovChange * delta * 6;
      updateCamera = true;
    }

    if (typeof this.options.distortion === 'object' && this.options.distortion.getJS) {
      const distortion = this.options.distortion.getJS(0.025, time);
      this.camera.lookAt(
        new THREE.Vector3(
          this.camera.position.x + distortion.x,
          this.camera.position.y + distortion.y,
          this.camera.position.z + distortion.z
        )
      );
      updateCamera = true;
    }

    if (updateCamera) {
      this.camera.updateProjectionMatrix();
    }
  }

  render(delta: number) {
    this.composer.render(delta);
  }

  // pause()·resume()이 부른다 — 백그라운드 탭 같은 긴 공백이 저성능 frame으로
  // 계산되지 않도록 governor의 측정 버퍼를 비운다.
  pause() {
    if (this.paused) return;
    this.paused = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.governor.resetWindow();
  }

  resume() {
    if (!this.paused || this.disposed) return;
    this.paused = false;
    this.governor.resetWindow();
    this.rafId = requestAnimationFrame(this.tick);
  }

  dispose() {
    // 여러 번 불려도 안전해야 한다(unmount 경로가 실수로 두 번 불러도 죽지
    // 않는다) — 두 번째 호출은 조용히 무시한다.
    if (this.disposed) return;
    this.disposed = true;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.timer.dispose();

    if (this.scene) {
      this.scene.traverse(object => {
        const obj = object as unknown as THREE.Mesh;
        if (!obj.isMesh) return;

        if (obj.geometry) obj.geometry.dispose();

        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(material => material.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      this.scene.clear();
    }

    if (this.bloomPass) {
      this.bloomPass.dispose();
    }

    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    if (this.composer) {
      this.composer.dispose();
    }

    window.removeEventListener('resize', this.onWindowResize);
    if (this.container) {
      this.container.removeEventListener('mousedown', this.onMouseDown);
      this.container.removeEventListener('mouseup', this.onMouseUp);
      this.container.removeEventListener('mouseout', this.onMouseUp);

      this.container.removeEventListener('touchstart', this.onTouchStart);
      this.container.removeEventListener('touchend', this.onTouchEnd);
      this.container.removeEventListener('touchcancel', this.onTouchEnd);
      this.container.removeEventListener('contextmenu', this.onContextMenu);
    }
  }

  // resizeRendererToDisplaySize의 콜백. resize 경로에서도 pixel ratio를 먼저
  // 갱신한 뒤 size를 다시 계산한다 — 초기화·profile 변경과 같은 순서다.
  setSize(width: number, height: number, updateStyles: boolean) {
    this.renderer.setPixelRatio(this.effectivePixelRatio());
    this.composer.setSize(width, height, updateStyles);
  }

  tick(timestamp?: number) {
    if (this.disposed || this.paused) return;

    this.timer.update(timestamp);

    if (!this.hasValidSize) {
      const w = this.container.offsetWidth;
      const h = this.container.offsetHeight;
      if (w > 0 && h > 0) {
        this.renderer.setPixelRatio(this.effectivePixelRatio());
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.composer.setSize(w, h);
        this.hasValidSize = true;
      } else {
        this.rafId = requestAnimationFrame(this.tick);
        return;
      }
    }

    if (resizeRendererToDisplaySize(this.renderer, this.setSize)) {
      const canvas = this.renderer.domElement;
      if (this.hasValidSize) {
        this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
        this.camera.updateProjectionMatrix();
      }
    }

    if (this.hasValidSize) {
      const delta = this.timer.getDelta();
      this.frameCounter += 1;
      // renderInterval 1이면 매 프레임, 2면 한 프레임 걸러 렌더한다.
      if (this.frameCounter % this.qualityProfile.renderInterval === 0) {
        this.render(delta);
      }
      this.update(delta);
    }

    // rAF가 준 실제 timestamp가 있을 때만 governor에 기록한다 — init()의 첫
    // tick() 호출은 timestamp 없이 동기 호출되므로 표본에 넣지 않는다.
    if (timestamp !== undefined) {
      const newTier = this.governor.record(timestamp);
      if (newTier !== null) {
        this.setQuality(newTier);
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  }
}

const DEFAULT_EFFECT_OPTIONS: Partial<HyperspeedOptions> = {};

const Hyperspeed = forwardRef<HyperspeedHandle, HyperspeedProps>(function Hyperspeed(
  { effectOptions = DEFAULT_EFFECT_OPTIONS },
  ref
) {
  const container = useRef<HTMLDivElement>(null);
  const appRef = useRef<App | null>(null);
  // 마운트 시점의 effectOptions만 쓴다 — ref가 안정적이라 exhaustive-deps 없이도
  // 마운트 한 번짜리 effect를 유지할 수 있다. 이후의 조정은 ref API로만 한다.
  const effectOptionsRef = useRef(effectOptions);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const options: HyperspeedOptions = {
      ...defaultOptions,
      ...effectOptionsRef.current,
      colors: { ...defaultOptions.colors, ...effectOptionsRef.current.colors }
    };
    if (typeof options.distortion === 'string') {
      options.distortion = distortions[options.distortion];
    }

    // jsdom·구형 브라우저처럼 WebGL 컨텍스트를 못 얻는 환경에서는
    // THREE.WebGLRenderer 생성자가 던진다. ref API는 그래도 안전한
    // no-op으로 남아야 한다.
    try {
      const app = new App(el, options);
      appRef.current = app;
      app.loadAssets().then(() => app.init());
    } catch {
      appRef.current = null;
    }

    return () => {
      appRef.current?.dispose();
      appRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setQuality: (tier: QualityTier) => appRef.current?.setQuality(tier),
      pause: () => appRef.current?.pause(),
      resume: () => appRef.current?.resume(),
      boost: () => appRef.current?.boost(),
      settle: () => appRef.current?.settle(),
      isLost: () => appRef.current?.isLost() ?? false
    }),
    []
  );

  return <div id="lights" className="w-full h-full" ref={container}></div>;
});

export default Hyperspeed;
// App/defaultOptions는 테스트가 WebGL을 mock한 뒤 App을 직접 생성해 품질
// 노브·resize·governor 연동을 검증할 수 있도록 노출한다(구멍 1·2·3·4·6·7).
export { App, defaultOptions, QUALITY_PROFILES };
export type { HyperspeedOptions, QualityProfile };
