// 포인터 반응: 참조의 휘젓기(stir). 입자마다 offset·velocity 용수철이 포인터 속도에 끌리고 소용돌이(curl)로 옆으로 흩어진 뒤 돌아온다.
// 입자 하나의 식은 제 상태와 프레임 입력(t, dt, turn, 붓)만 읽으므로 셰이더(STIR_GLSL)와 아이콘 여섯의 JS(stirStep)가 같은 식을 푼다.
// GL 볼 청크에만 들어간다(field.ts는 First Load의 정적 볼도 쓴다).
import type { Vec3 } from './field';

type Pair = readonly [number, number] | readonly number[];
const f = (value: number) => value.toFixed(4);
const fract = (value: number) => value - Math.floor(value);

// 참조 휘젓기 상수: 포인터 손길의 가우스 폭(반지름²)과 끌림, 소용돌이 크기와 세기, 벽(반지름)과 튕김.
// 마지막 손길 뒤 이만큼(초) 지나면 상태를 0으로 되돌린다(SETTLE_SECONDS). 한 걸음은 1/30초를 넘지 않는다.
export const STIR = { width: 0.07, grip: 14, scale: 1.6, curl: 1.8, wall: 0.97, bounce: 1.5, settle: 7, maxStep: 1 / 30 };

// 입자마다 다른 용수철 세기. 참조는 입자 id 해시로 골랐다. 여기서는 셰이더와 JS가 같이 계산하는 seed로 고른다.
export const stiffness = (seed: Pair) => 0.8 + 1.4 * fract(seed[0] * 53);

// 참조 swirl: 시간에 따라 천천히 도는 발산 없는 소용돌이 장.
export function swirl(p: Pair, t: number): Vec3 {
  const s = t * 0.15;
  const a = [Math.cos(1.7 * p[1] + s) * 1.7, Math.cos(1.9 * p[2] + 1.2) * 1.9, Math.cos(1.5 * p[0] + 2.1) * 1.5];
  const b = [Math.cos(2.3 * p[2] + 0.4) * 2.3, Math.cos(2.1 * p[0] + s * 1.3) * 2.1, Math.cos(2.7 * p[1] + 0.9) * 2.7];
  return [a[2] - b[0], b[1] - a[0], a[1] - b[2]];
}

export interface StirInput { t: number; dt: number; brush: Pair; power: number }

// 참조 stir 패스의 한 걸음(입자 하나). offset·velocity를 제자리에서 바꾼다. brush: 포인터 자리 xy와 속도 zw(반지름 단위).
export function stirStep(offset: Vec3, velocity: Vec3, base: Pair, k: number, { t, dt, brush, power }: StirInput) {
  const o = offset, v = velocity;
  const p = [base[0] + o[0], base[1] + o[1], base[2] + o[2]];
  const acc = [0, 1, 2].map(i => -k * o[i] - 1.5 * Math.sqrt(k) * v[i]);
  const gx = p[0] - brush[0], gy = p[1] - brush[1];
  const touch = Math.exp(-(gx * gx + gy * gy) / STIR.width) * power;
  const pull = [brush[2], brush[3], 0];
  for (let i = 0; i < 3; i++) acc[i] += (pull[i] - v[i]) * touch * STIR.grip;
  const pace = Math.hypot(...v);
  if (pace > 1e-4) {
    const curl = swirl(p.map(value => value * STIR.scale), t);
    const along = (curl[0] * v[0] + curl[1] * v[1] + curl[2] * v[2]) / pace;
    for (let i = 0; i < 3; i++) acc[i] += (curl[i] - v[i] / pace * along) * Math.min(pace, 2) * STIR.curl;
  }
  for (let i = 0; i < 3; i++) { v[i] += acc[i] * dt; o[i] += v[i] * dt; }
  const q = [base[0] + o[0], base[1] + o[1], base[2] + o[2]];
  const length = Math.hypot(...q);
  if (length > STIR.wall) {
    const n = q.map(value => value / length);
    for (let i = 0; i < 3; i++) o[i] -= n[i] * (length - STIR.wall);
    const out = Math.max(v[0] * n[0] + v[1] * n[1] + v[2] * n[2], 0) * STIR.bounce;
    for (let i = 0; i < 3; i++) v[i] -= n[i] * out;
  }
}

// 참조 포인터 붓: 0.05초로 따라가는 속도. 처음 들어오거나 0.6 넘게 뛰면 속도 없이 그 자리에서 다시 시작한다.
export interface Brush { x: number; y: number; vx: number; vy: number; fresh: boolean }
export function trackBrush(brush: Brush, x: number, y: number, dt: number) {
  if (brush.fresh || Math.hypot(x - brush.x, y - brush.y) > 0.6) Object.assign(brush, { x, y, vx: 0, vy: 0, fresh: false });
  const follow = 1 - Math.exp(-dt / 0.05);
  brush.vx += ((x - brush.x) / dt - brush.vx) * follow;
  brush.vy += ((y - brush.y) / dt - brush.vy) * follow;
  brush.x = x;
  brush.y = y;
}

export const STIR_GLSL = `
float stiffness(vec3 seed) { return 0.8 + 1.4 * fract(seed.x * 53.0); }
vec3 swirl(vec3 p, float t) {
  float s = t * 0.15;
  vec3 a = vec3(1.7, 1.9, 1.5) * p.yzx + vec3(s, 1.2, 2.1);
  vec3 b = vec3(2.3, 2.1, 2.7) * p.zxy + vec3(0.4, s * 1.3, 0.9);
  vec3 ca = cos(a) * vec3(1.7, 1.9, 1.5);
  vec3 cb = cos(b) * vec3(2.3, 2.1, 2.7);
  return vec3(ca.z - cb.x, cb.y - ca.x, ca.y - cb.z);
}
void stir(inout vec3 o, inout vec3 v, vec3 base, float k, float t, float dt, vec4 brush, float power) {
  vec3 p = base + o;
  vec3 acc = -k * o - 1.5 * sqrt(k) * v;
  vec2 gap = p.xy - brush.xy;
  float touch = exp(-dot(gap, gap) / ${f(STIR.width)}) * power;
  acc += (vec3(brush.zw, 0.0) - v) * touch * ${f(STIR.grip)};
  float pace = length(v);
  if (pace > 1e-4) {
    vec3 heading = v / pace;
    vec3 curl = swirl(p * ${f(STIR.scale)}, t);
    acc += (curl - heading * dot(curl, heading)) * min(pace, 2.0) * ${f(STIR.curl)};
  }
  v += acc * dt;
  o += v * dt;
  vec3 q = base + o;
  float len = length(q);
  if (len > ${f(STIR.wall)}) {
    vec3 n = q / len;
    o -= n * (len - ${f(STIR.wall)});
    v -= n * max(dot(v, n), 0.0) * ${f(STIR.bounce)};
  }
}
`;
