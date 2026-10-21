'use client';

// designRefactoring2/CrystalizedBall을 Hero 오브젝트로 줄였다. 뺀 것: 프리셋 8개, light 테마, 런타임 팔레트(Oklab),
// rise·fall·orbit 먼지와 사각 입자, 테두리 hover heat와 클릭 kick, 펼쳐짐(intro), HDR float 렌더 타깃과 합성 패스.
// 남긴 것: 테두리 가닥 5개와 flare, 테두리 불꽃 4개, 바닥 안개, drift 먼지 5000개, 포인터 응시 회전,
// 포인터 휘젓기(입자마다 offset·velocity 상태 타깃). 아이콘은 같은 휘젓기 식(field.ts stirStep)을 JS로 푼다.
import { useEffect, useImperativeHandle, useRef, type Ref, type RefObject } from 'react';
import { Geometry, Mesh, RenderTarget, Renderer, Texture, Triangle } from 'ogl';
import { ParallelProgram } from '@/lib/parallelProgram';
import { CYAN_PALETTE } from '../Hyperspeed/presets';
import { BALL_ICONS, FIELD_GLSL, HOVER, driftPoint, fieldPoint, iconStyle, type Vec3 } from './field';
import { STIR, STIR_GLSL, stiffness, stirStep, trackBrush } from './stir';

// Hero -> About 변신(HomeClient motion.ts)이 매 프레임 속이 빠진 정도를 넘긴다. 0 쉬는 볼, 1 속이 다 빠진 고리.
export interface CrystalizedBallHandle { setCollapse(value: number): void }

export interface CrystalizedBallProps {
  // 아이콘 층. 자식 순서가 BALL_ICONS 순서다. 서버 HTML의 쉬는 자리에 서 있다가 GL이 프레임마다 옮긴다.
  icons: RefObject<HTMLElement | null>;
  paused?: boolean;
  onReady?: () => void;
  ref?: Ref<CrystalizedBallHandle>;
}

type Rgb = [number, number, number];
const rgb = (hex: number): Rgb => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const mix = (a: Rgb, b: Rgb, t: number) => a.map((v, i) => v + (b[i] - v) * t) as Rgb;
const WHITE: Rgb = [1, 1, 1];
const BLACK: Rgb = [0, 0, 0];
// 배경과 Electric 로고와 같은 Luminous 시안. 참조의 dark 팔레트 비율을 시안에 걸었다. 녹색으로 돈 톤 하나는 Luminous 파랑이다.
const CYAN = rgb(CYAN_PALETTE.sticks);
const BLUE = rgb(CYAN_PALETTE.leftCars[1]);
const PALETTE = {
  rim: CYAN, rimHot: mix(CYAN, WHITE, 0.72), rimMid: mix(CYAN, BLACK, 0.15), rimDeep: mix(CYAN, BLACK, 0.45),
  spark: mix(CYAN, WHITE, 0.45), sparkGlow: mix(CYAN, BLACK, 0.26), haze: mix(CYAN, BLACK, 0.6), edge: mix(CYAN, BLACK, 0.5),
  tones: [mix(CYAN, BLACK, 0.1), mix(CYAN, BLUE, 0.35), BLUE, rgb(CYAN_PALETTE.leftCars[2]), mix(CYAN, WHITE, 0.7)].flat(),
};
// 볼 지름 / 캔버스 한 변. 볼이 앵커를 꽉 채우고 캔버스는 각 변에서 앵커의 1/6만큼 밖으로 나가 테두리 광휘 자리를 둔다(1.33배).
const SIZE = 0.75;
const PAD = `${(-(1 / SIZE - 1) / 2 * 100).toFixed(3)}%`;
const STRANDS = 5;
const DUST = 5000;
// 입자 상태 텍스처 한 줄의 칸 수(참조 STATE_WIDTH). 입자 i는 (i % 256, i / 256) 칸이다.
const STATE_WIDTH = 256;
const MAX_ARCS = 4;
// ElectricLogo와 같은 DPR 상한, 0.45MP 픽셀 예산(연구 2.4).
const MAX_DPR = 1.25;
const PIXEL_BUDGET = 4.5e5;
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// 속이 빠질 때 먼지와 아이콘이 가운데로 끌려드는 몫. 볼 전체는 경계가 CSS로 함께 줄이고, 그 끝에서만 속이 더 모여 밝은 심이 된다.
export const PULL = 0.85;

const seeded = (start: number) => {
  let state = start >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const buildStrands = () => {
  const random = seeded(99);
  const bands = [[6, 12, 0.6, 1.6], [18, 34, 1.5, 3.5], [40, 70, 3, 7], [80, 130, 6, 12]];
  const d = { harmonics: [] as number[], rates: [] as number[], phases: [] as number[], flareHarmonics: [] as number[], flareRates: [] as number[], flarePhases: [] as number[] };
  for (let s = 0; s < STRANDS; s++) {
    bands.forEach(([low, high, slow, fast]) => {
      d.harmonics.push(Math.round(low + random() * (high - low)));
      d.rates.push((slow + random() * (fast - slow)) * (random() < 0.5 ? -1 : 1));
      d.phases.push(random() * Math.PI * 2);
    });
    for (let j = 0; j < 3; j++) {
      d.flareHarmonics.push(4 + Math.floor(random() * 6));
      d.flareRates.push((0.4 + random() * 0.8) * (random() < 0.5 ? -1 : 1));
      d.flarePhases.push(random() * Math.PI * 2);
    }
    const lead = s === 0;
    d.flareHarmonics.push(lead ? 0.75 : 0.95 + random() * 0.3);
    d.flareRates.push(lead ? 1.15 : 0.8 + random() * 0.2);
    d.flarePhases.push(lead ? 1 : 0.7 + random() * 0.25);
  }
  return d;
};

// 먼지: 바닥 그릇과 아래쪽 테두리 띠에 몰린다(참조 분포). home xyz + 톤, seed는 크기·위상·주기·이동.
const buildDust = () => {
  const random = seeded(1337);
  const rows = Math.ceil(DUST / STATE_WIDTH);
  const home = new Float32Array(STATE_WIDTH * rows * 4);
  const seed = new Float32Array(STATE_WIDTH * rows * 4);
  let count = 0;
  for (let guard = 0; count < DUST && guard < DUST * 80; guard++) {
    let x: number, y: number, tone: number;
    if (random() < 0.28) {
      const angle = random() * Math.PI * 2;
      const radius = 0.87 + Math.sqrt(random()) * 0.105;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      if (random() > smooth(-0.6, 0.3, -y)) continue;
      const q = random();
      tone = q < 0.5 ? 3 : q < 0.8 ? 2 : 1;
    } else {
      x = random() * 2 - 1;
      y = random() * 2 - 1;
      const radius = Math.hypot(x, y);
      if (radius > 0.975) continue;
      const weight = Math.max(Math.pow(smooth(-0.25, 0.85, -y), 1.3), smooth(0.66, 0.96, radius) * smooth(-0.7, 0.3, -y) * 0.9);
      if (random() > 0.012 + 0.988 * weight) continue;
      if (weight < 0.12) tone = 4;
      else { const q = random(); tone = q < 0.32 ? 0 : q < 0.52 ? 1 : q < 0.8 ? 2 : 3; }
    }
    const chord = Math.sqrt(Math.max(0, 0.95 - x * x - y * y));
    home.set([x, y, (random() * 2 - 1) * chord, tone], count * 4);
    seed.set([tone === 4 ? 1.8 : random() < 0.22 ? 2.1 : 1.3, random(), 2.5 + random() * 3.5, 0.16 + random() * 0.26], count * 4);
    count++;
  }
  return { home, seed, count, rows };
};

const passVertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// 테두리. 참조 필드 패스에서 펼쳐짐과 hover heat를 1과 0으로 접었고, 톤 매핑(soften)을 여기서 마친다. 먼지는 그 위에 더한다.
const fieldFragment = `#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform float uRadius, uDpr, uLine, uRimTime, uFrame, uBins, uCollapse;
uniform vec3 uRim, uRimHot, uRimMid, uRimDeep, uSpark, uSparkGlow, uHazeColor, uEdgeColor;
uniform vec4 uHarmonics[${STRANDS}], uRates[${STRANDS}], uPhases[${STRANDS}], uFlareHarmonics[${STRANDS}], uFlareRates[${STRANDS}], uFlarePhases[${STRANDS}], uArcs[${MAX_ARCS}];
out vec4 fragColor;
uint scramble(uint v) { v = v * 747796405u + 2891336453u; uint w = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u; return (w >> 22u) ^ w; }
float random(uint v) { return float(scramble(v)) * (1.0 / 4294967295.0); }
const float PI = 3.14159265;
const float TAU = 6.28318531;
const float PULL = ${PULL.toFixed(4)};
const vec4 AMPS = vec4(0.35, 0.3, 0.22, 0.13);
const float CRACKLE = 0.6;
const float GLOW = 0.8;
const float HAZE = 0.7;
float bell(float d, float w) { float x = d / w; return exp(-x * x); }
vec3 soften(vec3 x) { vec3 over = max(x - 0.6, 0.0); return min(x, 0.6) + 0.4 * (1.0 - exp(-over / 0.4)); }
float pool(vec2 q) {
  float t = length(q - vec2(0.0, -0.83)) / 1.075;
  return t < 0.6 ? mix(0.5, 0.22, t / 0.6) : mix(0.22, 0.0, clamp((t - 0.6) / 0.4, 0.0, 1.0));
}
void main() {
  vec2 p = gl_FragCoord.xy / uDpr - uCenter;
  float r = length(p);
  float R = uRadius;
  float theta = atan(p.y, p.x);
  float topDim = 1.0 - 0.35 * pow(max(p.y / max(r, 1e-3), 0.0), 1.5);
  vec3 col = vec3(0.0);
  uint frame = uint(uFrame);
  // 접히면 안개도 먼지와 같은 몫만큼 가운데로 모인다.
  float core = R * (1.0 - PULL * uCollapse);
  if (r < core) {
    vec2 q = p / core;
    col += uHazeColor * pool(q) * (0.55 + 0.45 * sqrt(max(1.0 - dot(q, q), 0.0))) * HAZE;
    col += uEdgeColor * 0.5 * pow(smoothstep(0.62, 1.0, length(q - vec2(0.0, 0.2)) / 1.2), 1.4) * (0.5 + 0.5 * HAZE);
  }
  float dr = r - R;
  col += uRimDeep * 0.18 * (1.0 - smoothstep(R * 0.05, R * 0.105, abs(dr - R * 0.0213))) * topDim * GLOW;
  col += uRim * 0.12 * bell(dr + R * 0.0383, R * 0.032) * GLOW;
  col += uRim * 0.32 * bell(dr, max(R * 0.0117, uLine));
  float amp = R * 0.016 * (0.3 + 1.4 * CRACKLE);
  float jitterAmp = R * 0.0048 * (0.3 + 1.4 * CRACKLE);
  float flareAmp = R * 0.064 * (0.4 + 1.2 * CRACKLE) * 0.8;
  if (abs(dr) < amp * 2.0 + flareAmp + R * 0.3) {
    float step = TAU / uBins;
    float binPos = (theta + PI) / step;
    float bin0 = floor(binPos);
    float binF = binPos - bin0;
    float th0 = bin0 * step - PI;
    float th1 = th0 + step;
    uint b0 = uint(mod(bin0, uBins));
    uint b1 = uint(mod(bin0 + 1.0, uBins));
    for (int k = 0; k < ${STRANDS}; k++) {
      vec4 lead = uRates[k] * uRimTime + uPhases[k];
      uint salt = uint(k) * 1013u + frame * 7919u;
      vec4 shape = uFlareHarmonics[k];
      vec4 look = uFlareRates[k];
      vec4 tone = uFlarePhases[k];
      float a = amp * shape.w;
      float off0 = a * dot(AMPS, sin(uHarmonics[k] * th0 + lead)) + jitterAmp * (random(b0 + salt) - 0.5);
      float off1 = a * dot(AMPS, sin(uHarmonics[k] * th1 + lead)) + jitterAmp * (random(b1 + salt) - 0.5);
      float rc = R + mix(off0, off1, binF);
      float grade = (off1 - off0) / (step * max(r, 1.0));
      float d = abs(r - rc) * inversesqrt(1.0 + grade * grade);
      float width = uLine * look.w * (0.8 + 0.4 * (0.5 + 0.5 * sin(3.0 * theta + uRimTime * 0.7 + tone.x * 1.7)));
      col += (uRimHot * exp(-d * d / (width * width)) * 0.8 + uRim * exp(-d * d / (width * width * 3.0)) * 0.32) * tone.w;
      vec3 fargs = shape.xyz * theta + look.xyz * uRimTime + tone.xyz;
      float flare = max(0.0, (sin(fargs.x) + sin(fargs.y) + sin(fargs.z)) / 3.0);
      flare = flare * flare * flareAmp;
      float dw = abs(r - rc - flare);
      vec3 glow = uRimDeep * (0.07 * bell(dw, R * 0.09) + 0.16 * bell(dw, R * 0.05));
      glow += uRimMid * 0.28 * bell(abs(r - rc - flare * 0.6), R * 0.027) + uRim * 0.38 * bell(abs(r - rc - flare * 0.25), R * 0.013);
      col += glow * (2.4 / ${STRANDS}.0) * topDim * GLOW;
    }
  }
  for (int i = 0; i < ${MAX_ARCS}; i++) {
    vec4 arc = uArcs[i];
    if (arc.w <= 0.002) continue;
    float mid = arc.x + arc.y * 0.5;
    if (distance(p, R * 0.93 * vec2(cos(mid), sin(mid))) > R * (abs(arc.y) * 0.6 + 0.1) + 12.0) continue;
    float ar = R * 0.955;
    vec2 a0 = ar * vec2(cos(arc.x), sin(arc.x));
    vec2 a2 = ar * vec2(cos(arc.x + arc.y), sin(arc.x + arc.y));
    vec2 a1 = R * (0.955 - arc.z) * vec2(cos(mid), sin(mid));
    float dmin = 1e5;
    float along = 0.0;
    vec2 prev = a0;
    for (int s = 1; s <= 10; s++) {
      float u = float(s) / 10.0;
      vec2 b = mix(mix(a0, a1, u), mix(a1, a2, u), u);
      vec2 pa = p - prev;
      vec2 ba = b - prev;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
      float dist = length(pa - ba * h);
      if (dist < dmin) { dmin = dist; along = (float(s) - 1.0 + h) / 10.0; }
      prev = b;
    }
    float taper = sqrt(max(sin(PI * along), 0.0));
    float w2 = pow(uLine * (0.55 + 0.6 * taper), 2.0);
    col += (uSpark * 0.95 * exp(-dmin * dmin / w2) + uSparkGlow * 0.4 * exp(-dmin * dmin / (w2 * 12.0))) * arc.w * taper;
  }
  vec3 shown = soften(col);
  fragColor = vec4(shown, max(shown.r, max(shown.g, shown.b)));
}
`;

// 먼지 한 알 = 점 하나. 자리는 아이콘과 같은 fieldPoint(표류 + 휘젓기 offset)다. 반짝임과 투명도는 참조가 입자 id 해시로 고르던 것을 seed로 고른다.
const dustVertex = `#version 300 es
precision highp float;
in float aIndex;
uniform sampler2D tHome, tSeed, tOffset;
uniform vec2 uCenter, uViewport, uTurn;
uniform float uRadius, uDpr, uPointScale, uTime, uStirred, uCollapse;
uniform vec3 uTones[5];
uniform vec3 uRimTone;
out vec3 vColor;
out float vSize;
const float PULL = ${PULL.toFixed(4)};
${FIELD_GLSL}
void main() {
  ivec2 cell = ivec2(int(mod(aIndex, ${STATE_WIDTH}.0)), int(floor(aIndex / ${STATE_WIDTH}.0)));
  vec4 home = texelFetch(tHome, cell, 0);
  vec4 seed = texelFetch(tSeed, cell, 0);
  vec3 offset = uStirred > 0.5 ? texelFetch(tOffset, cell, 0).xyz : vec3(0.0);
  float life = sin(3.14159265 * fract(uTime / seed.z + seed.y));
  vec3 p = fieldPoint(home.xyz, seed.yzw, uTime, uTurn, offset) * (1.0 - PULL * uCollapse);
  float front = p.z * 0.5 + 0.5;
  float blink = sin(uTime * (2.0 + 6.0 * fract(seed.y * 7.31)) + seed.w * 41.0);
  float alpha = fract(seed.y * 13.7) < 0.5 || home.w > 3.5 ? 1.0 : 0.6;
  float px = seed.x * uPointScale * (0.35 + 0.95 * life) * (0.82 + 0.36 * front) * uDpr;
  gl_Position = vec4((uCenter + p.xy * uRadius) / uViewport * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = px + 2.0;
  vSize = px;
  float rim = smoothstep(0.8, 0.97, length(p.xy));
  vColor = (uTones[int(home.w + 0.5)] + uRimTone * rim * rim * 0.12) * alpha * smoothstep(0.04, 0.12, life)
    * mix(1.0, smoothstep(-0.9, -0.6, blink), 0.5) * (0.61 + 0.48 * front) * (1.0 - smoothstep(0.955, 0.985, length(p.xy))) * (1.0 + uCollapse);
}
`;

// 참조 stir 패스: 입자 칸마다 offset·velocity를 한 걸음 푼다(두 출력, ping-pong).
const stirFragment = `#version 300 es
precision highp float;
uniform sampler2D tHome, tSeed, tOffset, tVelocity;
uniform float uTime, uDt, uReset, uBrushPower;
uniform vec2 uTurn;
uniform vec4 uBrush;
layout(location = 0) out vec4 outOffset;
layout(location = 1) out vec4 outVelocity;
${FIELD_GLSL}
${STIR_GLSL}
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  if (uReset > 0.5) {
    outOffset = vec4(0.0);
    outVelocity = vec4(0.0);
    return;
  }
  vec4 home = texelFetch(tHome, cell, 0);
  vec4 seed = texelFetch(tSeed, cell, 0);
  vec3 o = texelFetch(tOffset, cell, 0).xyz;
  vec3 v = texelFetch(tVelocity, cell, 0).xyz;
  stir(o, v, driftPoint(home.xyz, seed.yzw, uTime, uTurn), stiffness(seed.yzw), uTime, uDt, uBrush, uBrushPower);
  outOffset = vec4(o, 1.0);
  outVelocity = vec4(v, 1.0);
}
`;

const dustFragment = `#version 300 es
precision highp float;
in vec3 vColor;
in float vSize;
out vec4 fragColor;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * (vSize + 2.0);
  float cover = clamp(max(vSize * 0.5, 0.5) - length(q) + 0.5, 0.0, 1.0);
  if (cover <= 0.0) discard;
  fragColor = vec4(vColor * cover, 0.0);
}
`;

export default function CrystalizedBall({ icons, paused = false, onReady, ref }: CrystalizedBallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const onReadyRef = useRef(onReady);
  const wakeRef = useRef<(() => void) | null>(null);
  const collapseRef = useRef(0);
  onReadyRef.current = onReady;

  // 멈춘 동안에 바뀌어도 한 장 다시 그려 보이는 접힘이 값과 같다.
  useImperativeHandle(ref, () => ({
    setCollapse: (value) => {
      if (value === collapseRef.current) return;
      collapseRef.current = value;
      wakeRef.current?.();
    },
  }), []);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) wakeRef.current?.();
  }, [paused]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let renderer: Renderer;
    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
    } catch {
      // WebGL이 아예 없으면 OGL이 생성자에서 던진다. 정적 볼이 남는다.
      return undefined;
    }
    const gl = renderer.gl;
    if (!renderer.isWebgl2) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return undefined;
    }
    const canvas = gl.canvas;
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    container.appendChild(canvas);
    const layer = icons.current;
    const iconElements = layer ? ([...layer.children] as HTMLElement[]) : [];
    const restStyles = iconElements.map(element => element.style.cssText);

    const geometry = new Triangle(gl);
    const strands = buildStrands();
    const arcData = new Array(MAX_ARCS * 4).fill(0);
    const field = {
      uCenter: { value: [0, 0] }, uRadius: { value: 1 }, uDpr: { value: 1 }, uLine: { value: 0.6 }, uRimTime: { value: 0 }, uFrame: { value: 0 }, uBins: { value: 420 }, uCollapse: { value: 0 },
      uRim: { value: PALETTE.rim }, uRimHot: { value: PALETTE.rimHot }, uRimMid: { value: PALETTE.rimMid }, uRimDeep: { value: PALETTE.rimDeep },
      uSpark: { value: PALETTE.spark }, uSparkGlow: { value: PALETTE.sparkGlow }, uHazeColor: { value: PALETTE.haze }, uEdgeColor: { value: PALETTE.edge },
      uHarmonics: { value: strands.harmonics }, uRates: { value: strands.rates }, uPhases: { value: strands.phases },
      uFlareHarmonics: { value: strands.flareHarmonics }, uFlareRates: { value: strands.flareRates }, uFlarePhases: { value: strands.flarePhases },
      uArcs: { value: arcData },
    };
    const turn = [0, 0];
    const points = buildDust();
    const gl2 = gl as unknown as WebGL2RenderingContext;
    const dataTexture = (image: Float32Array) => new Texture(gl, {
      image, width: STATE_WIDTH, height: points.rows, type: gl.FLOAT, format: gl.RGBA, internalFormat: gl2.RGBA32F,
      minFilter: gl.NEAREST, magFilter: gl.NEAREST, generateMipmaps: false, flipY: false,
    });
    const homeTexture = dataTexture(points.home);
    const seedTexture = dataTexture(points.seed);
    const dust = {
      uCenter: field.uCenter, uRadius: field.uRadius, uDpr: field.uDpr, uViewport: { value: [1, 1] }, uPointScale: { value: 1 },
      uTime: { value: 0 }, uTurn: { value: turn }, uTones: { value: PALETTE.tones }, uRimTone: { value: PALETTE.rim },
      tHome: { value: homeTexture }, tSeed: { value: seedTexture }, tOffset: { value: homeTexture }, uStirred: { value: 0 }, uCollapse: field.uCollapse,
    };
    // 휘젓기 상태는 float 색 버퍼에 쓴다. 참조처럼 32비트가 안 되면 16비트, 둘 다 안 되면 휘젓기 없이 돈다(아이콘도 같다).
    const fullFloat = !!gl.getExtension('EXT_color_buffer_float');
    const canStir = fullFloat || !!gl.getExtension('EXT_color_buffer_half_float');
    const stateTarget = () => new RenderTarget(gl, {
      width: STATE_WIDTH, height: points.rows, color: 2, depth: false, type: fullFloat ? gl.FLOAT : gl2.HALF_FLOAT, format: gl.RGBA,
      internalFormat: fullFloat ? gl2.RGBA32F : gl2.RGBA16F, minFilter: gl.NEAREST, magFilter: gl.NEAREST,
    });
    let read = canStir ? stateTarget() : null;
    let write = canStir ? stateTarget() : null;
    const stirBrush = [0, 0, 0, 0];
    const stirUniforms = {
      tHome: { value: homeTexture }, tSeed: { value: seedTexture }, tOffset: { value: homeTexture }, tVelocity: { value: homeTexture },
      uTime: dust.uTime, uTurn: dust.uTurn, uDt: { value: 0 }, uReset: { value: 0 }, uBrush: { value: stirBrush }, uBrushPower: { value: 0 },
    };
    const program = (vertex: string, fragment: string, uniforms: Record<string, unknown>) => {
      const made = new ParallelProgram(gl, { vertex, fragment, uniforms, transparent: true, depthTest: false, depthWrite: false });
      made.setBlendFunc(gl.ONE, gl.ONE);
      return made;
    };
    const fieldProgram = program(passVertex, fieldFragment, field);
    const dustProgram = program(dustVertex, dustFragment, dust);
    const stirProgram = new ParallelProgram(gl, { vertex: passVertex, fragment: stirFragment, uniforms: stirUniforms, depthTest: false, depthWrite: false });
    const fieldMesh = new Mesh(gl, { geometry, program: fieldProgram });
    const stirMesh = new Mesh(gl, { geometry, program: stirProgram });
    const dustMesh = new Mesh(gl, {
      mode: gl.POINTS, program: dustProgram,
      geometry: new Geometry(gl, { aIndex: { size: 1, data: new Float32Array(points.count).map((_, i) => i) } }),
    });
    // 아이콘 여섯의 휘젓기 상태. 입자 한 칸과 같은 offset·velocity다.
    const iconState = BALL_ICONS.map(icon => ({ k: stiffness(icon.seed), o: [0, 0, 0] as Vec3, v: [0, 0, 0] as Vec3 }));
    const brush = { x: 0, y: 0, vx: 0, vy: 0, fresh: true };
    let stirEnergy = 0, stirring = 0, stirDt = 0, stirPower = 0, wasOver = false;
    const resetStir = () => {
      if (!read || !write) return;
      stirUniforms.uReset.value = 1;
      renderer.render({ scene: stirMesh, target: read, clear: false });
      renderer.render({ scene: stirMesh, target: write, clear: false });
      stirUniforms.uReset.value = 0;
      iconState.forEach(state => { state.o = [0, 0, 0]; state.v = [0, 0, 0]; });
    };

    const random = seeded(913);
    const arcs: { start: number; span: number; curl: number; life: number; duration: number; drift: number }[] = [];
    const pointer = { x: 0, y: 0, on: false };
    const look = { x: 0, y: 0, vx: 0, vy: 0 };
    let width = 1, height = 1, raf = 0, last = performance.now(), time = 0, nextArc = 0.3, visible = true, ready = false;

    const resize = () => {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      renderer.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR, Math.sqrt(PIXEL_BUDGET / (width * height)));
      renderer.setSize(width, height);
      start();
    };

    // 한 프레임: 움직일 때만 시간과 포인터 상태를 나아가게 하고, 같은 상태로 먼지와 아이콘을 함께 그린다.
    const frame = (now: number) => {
      raf = 0;
      const dt = clamp((now - last) / 1000, 1 / 240, 0.05);
      last = now;
      const moving = !pausedRef.current;
      const radius = (SIZE * Math.min(width, height)) / 2;
      if (moving) {
        time += dt;
        if ((nextArc -= dt * 2.2) <= 0 && arcs.length < MAX_ARCS) {
          arcs.push({ start: random() < 0.7 ? Math.PI / 2 + (random() - 0.5) * 1.5 : random() * Math.PI * 2, span: (0.05 + random() * 0.07) * (random() < 0.5 ? -1 : 1), curl: 0.02 + random() * 0.04, life: 0, duration: 0.2 + random() * 0.2, drift: (random() - 0.5) * 0.3 });
          nextArc = 0.15 + random() * 0.6;
        }
        for (let i = arcs.length - 1; i >= 0; i--) {
          arcs[i].life += dt * 2;
          arcs[i].start += arcs[i].drift * dt * 2;
          if (arcs[i].life >= arcs[i].duration) arcs.splice(i, 1);
        }
        // 포인터(참조 프레임 루프): 붓이 포인터 속도를 따라가고, 캔버스 위에서 움직인 만큼 휘젓기 에너지가 쌓인다.
        // 에너지가 있으면 STIR.settle(7초) 동안 휘젓고, 그 뒤 상태를 0으로 되돌린다. 볼은 포인터 쪽을 바라보게 돈다.
        const rect = container.getBoundingClientRect();
        const bx = (pointer.x - rect.left - rect.width / 2) / radius;
        const by = (rect.top + rect.height / 2 - pointer.y) / radius;
        const over = pointer.on && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
        if (over && !wasOver) brush.fresh = true;
        wasOver = over;
        trackBrush(brush, bx, by, dt);
        const speed = Math.hypot(brush.vx, brush.vy);
        const cap = speed > 4 ? 4 / speed : 1;
        stirPower = over ? HOVER * Math.exp(-Math.max(0, Math.hypot(bx, by) - 1) * 6) : 0;
        stirEnergy = stirEnergy * Math.exp(-dt / 1.2) + stirPower * Math.min(speed, 4) * dt;
        if (canStir && stirEnergy > 0.002) stirring = STIR.settle;
        stirBrush.splice(0, 4, brush.x, brush.y, brush.vx * cap, brush.vy * cap);
        stirDt = stirring > 0 ? Math.min(dt, STIR.maxStep) : 0;
        const gaze = over ? HOVER : 0;
        look.vx += (40 * (clamp(bx, -1.6, 1.6) * gaze - look.x) - 11 * look.vx) * dt;
        look.vy += (40 * (clamp(by, -1.6, 1.6) * gaze - look.y) - 11 * look.vy) * dt;
        look.x += look.vx * dt;
        look.y += look.vy * dt;
        turn[0] = 0.21 * Math.sin(time * 0.23) + look.x * 0.3;
        turn[1] = 0.06 * Math.sin(time * 0.17) - look.y * 0.16;
      }
      for (let i = 0; i < MAX_ARCS; i++) {
        const arc = arcs[i];
        arcData.splice(i * 4, 4, arc ? arc.start : 0, arc ? arc.span : 0, arc ? arc.curl : 0, arc ? Math.sin((Math.PI * arc.life) / arc.duration) * 0.8 : 0);
      }
      // 셋 다 링크된 뒤에만 그린다. 휘젓기 걸음은 그리는 프레임에서만 풀어 입자와 아이콘이 같은 걸음을 밟는다.
      if (fieldProgram.finish() && dustProgram.finish() && stirProgram.finish()) {
        field.uCenter.value = [width / 2, height / 2];
        field.uRadius.value = radius;
        field.uDpr.value = renderer.dpr;
        field.uLine.value = Math.max(0.6, radius * 0.0035);
        field.uRimTime.value = time * 2;
        field.uFrame.value = Math.floor(time * 48) % 100000;
        field.uBins.value = clamp(Math.round((Math.PI * 2 * radius) / 2.6), 240, 900);
        dust.uTime.value = time;
        field.uCollapse.value = collapseRef.current;
        dust.uViewport.value = [width, height];
        dust.uPointScale.value = Math.max(1, radius / 491);
        if (stirDt > 0 && read && write) {
          // 입자: stir 패스 한 걸음. 아이콘: 같은 time·dt·turn·붓으로 같은 식 한 걸음.
          const input = { t: time, dt: stirDt, brush: stirBrush, power: stirPower };
          stirUniforms.uDt.value = input.dt;
          stirUniforms.uBrushPower.value = input.power;
          stirUniforms.tOffset.value = read.textures[0];
          stirUniforms.tVelocity.value = read.textures[1];
          renderer.render({ scene: stirMesh, target: write, clear: false });
          [read, write] = [write, read];
          iconState.forEach((state, index) => stirStep(state.o, state.v, driftPoint(BALL_ICONS[index].home, BALL_ICONS[index].seed, time, turn), state.k, input));
          stirring -= dt;
          stirDt = 0;
          if (stirring <= 0) {
            stirring = 0;
            resetStir();
          }
        }
        dust.uStirred.value = stirring > 0 ? 1 : 0;
        dust.tOffset.value = read ? read.textures[0] : homeTexture;
        gl.clearColor(0, 0, 0, 0);
        renderer.render({ scene: fieldMesh, clear: true });
        renderer.render({ scene: dustMesh, clear: false });
        // 아이콘: 먼지와 같은 fieldPoint(표류 + 휘젓기 offset)와 같은 접힘 몫, 같은 프레임에 transform과 opacity만 쓴다.
        // 접히는 동안 아이콘은 심에 닿기 전에 사라진다(.35–.8).
        const pull = 1 - PULL * collapseRef.current;
        const fade = 1 - smooth(0.35, 0.8, collapseRef.current);
        iconElements.forEach((element, index) => {
          const icon = BALL_ICONS[index];
          if (!icon) return;
          const style = iconStyle(fieldPoint(icon.home, icon.seed, time, turn, iconState[index].o).map(v => v * pull) as Vec3);
          element.style.transform = style.transform;
          element.style.opacity = String(fade === 1 ? style.opacity : Math.round(style.opacity * fade * 1000) / 1000);
          element.style.zIndex = String(style.zIndex);
        });
        if (!ready) {
          ready = true;
          onReadyRef.current?.();
        }
      }
      if (visible && (moving || !ready)) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    // 터치는 hover가 없다. 누른 자리를 휘젓지 않게 마우스·펜만 본다.
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      Object.assign(pointer, { x: event.clientX, y: event.clientY, on: true });
    };
    const onLeave = () => { pointer.on = false; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', onLeave);
    document.documentElement.addEventListener('pointerleave', onLeave);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; start(); });
    intersection.observe(container);
    wakeRef.current = start;
    resize();

    return () => {
      visible = false;
      wakeRef.current = null;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', onLeave);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      iconElements.forEach((element, index) => { element.style.cssText = restStyles[index]; });
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
  }, [icons]);

  return <div ref={containerRef} aria-hidden="true" style={{ position: 'absolute', inset: PAD, pointerEvents: 'none' }} />;
}
