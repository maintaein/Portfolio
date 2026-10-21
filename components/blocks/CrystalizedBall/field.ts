// 볼 안 입자의 움직임 모델(표류). 입자는 셰이더(FIELD_GLSL)로, 기술 아이콘은 같은 식의 JS(fieldPoint)로 움직여
// 아이콘이 같은 장의 큰 입자처럼 떠다닌다. 포인터 반응(휘젓기)은 GL 볼 청크에만 들어가게 stir.ts에 따로 둔다(이 모듈은 First Load의 정적 볼도 쓴다).
export type Vec3 = [number, number, number];
type Pair = readonly [number, number] | readonly number[];

// 표류 진폭(볼 반지름 단위). 참조의 drift 움직임 값이다.
export const DRIFT = 0.045;
// 포인터가 볼 위에 있을 때의 세기(참조 hoverStrength 기본값).
export const HOVER = 0.7;
// 유리 안쪽 한계.
export const LIMIT = 0.975;
// 아이콘 한 변(볼 지름 비율). 연구 시제품의 12.5%보다 작다.
export const ICON_SIZE = 0.09;

const f = (value: number) => value.toFixed(4);

// home: 단위 볼 안 자리. seed: 위상, 주기, 이동(참조 입자 seed의 yzw). turn: 흔들림과 포인터 응시의 회전(yaw, pitch).
// 참조 drift와 같이 유리 안으로 자르지 않은 자리다. 휘젓기가 이 자리를 기준으로 offset을 움직인다.
export function driftPoint(home: Pair, seed: Pair, t: number, turn: Pair): Vec3 {
  let x = home[0] + DRIFT * (Math.sin(t * 0.37 + seed[0] * 17) + 0.5 * Math.sin(t * 0.83 + seed[1] * 5));
  let y = home[1] + DRIFT * (Math.sin(t * 0.29 + seed[1] * 11) + 0.5 * Math.sin(t * 0.61 + seed[2] * 7));
  let z = home[2] + DRIFT * Math.sin(t * 0.33 + seed[2] * 23);
  const cy = Math.cos(turn[0]), sy = Math.sin(turn[0]);
  [x, z] = [cy * x + sy * z, cy * z - sy * x];
  const cx = Math.cos(turn[1]), sx = Math.sin(turn[1]);
  [y, z] = [cx * y + sx * z, cx * z - sx * y];
  return [x, y, z];
}

// 보이는 자리: 표류 자리에 휘젓기 offset을 더하고 유리 안으로 자른다(참조 dust 셰이더).
export function fieldPoint(home: Pair, seed: Pair, t: number, turn: Pair, offset: Pair): Vec3 {
  const [x, y, z] = driftPoint(home, seed, t, turn);
  const p: Vec3 = [x + offset[0], y + offset[1], z + offset[2]];
  const length = Math.hypot(...p);
  return length > LIMIT ? [p[0] * LIMIT / length, p[1] * LIMIT / length, p[2] * LIMIT / length] : p;
}

export const FIELD_GLSL = `
const float DRIFT = ${f(DRIFT)};
const float LIMIT = ${f(LIMIT)};
vec3 driftPoint(vec3 home, vec3 seed, float t, vec2 turn) {
  vec3 p = home + DRIFT * vec3(
    sin(t * 0.37 + seed.x * 17.0) + 0.5 * sin(t * 0.83 + seed.y * 5.0),
    sin(t * 0.29 + seed.y * 11.0) + 0.5 * sin(t * 0.61 + seed.z * 7.0),
    sin(t * 0.33 + seed.z * 23.0));
  float cy = cos(turn.x), sy = sin(turn.x);
  p = vec3(cy * p.x + sy * p.z, p.y, cy * p.z - sy * p.x);
  float cx = cos(turn.y), sx = sin(turn.y);
  return vec3(p.x, cx * p.y + sx * p.z, cx * p.z - sx * p.y);
}
vec3 fieldPoint(vec3 home, vec3 seed, float t, vec2 turn, vec3 offset) {
  vec3 p = driftPoint(home, seed, t, turn) + offset;
  float len = length(p);
  return len > LIMIT ? p * (LIMIT / len) : p;
}
`;

// 핵심 기술 여섯(lib/data/skills.tsx의 D23 정본 순서). React가 맨 앞이다(Task 10 변신에서 React 로고가 된다).
// 자리는 밝은 바닥 먼지 띠 위, 서로 겹치지 않게 골랐다. seed는 입자 seed와 같은 범위다.
export const BALL_ICONS = [
  { name: 'react', home: [-0.05, 0.05, 0.55], seed: [0.13, 3.1, 0.22] },
  { name: 'typescript', home: [-0.48, 0.32, 0.1], seed: [0.71, 4.6, 0.35] },
  { name: 'nextjs', home: [0.44, 0.36, -0.1], seed: [0.42, 5.3, 0.18] },
  { name: 'react-query', home: [-0.4, -0.18, -0.25], seed: [0.88, 2.9, 0.4] },
  { name: 'zustand', home: [0.04, 0.46, -0.2], seed: [0.27, 3.8, 0.29] },
  { name: 'tailwind', home: [0.42, -0.14, 0.2], seed: [0.59, 5.9, 0.25] },
] as const;

// 아이콘은 볼 상자 가운데(50% 50%)에 놓인 한 변 ICON_SIZE의 상자다. translate 백분율은 아이콘 자신의 크기 기준이라
// 픽셀 없이도(서버 HTML, JS 없음) 같은 자리에 선다. 크기와 밝기는 입자의 앞뒤 깊이 식(dust 셰이더)과 같다.
export function iconStyle([x, y, z]: Vec3) {
  const front = z * 0.5 + 0.5;
  const at = (value: number) => ((value / (2 * ICON_SIZE) - 0.5) * 100).toFixed(1);
  return {
    transform: `translate(${at(x)}%, ${at(-y)}%) scale(${(0.82 + 0.36 * front).toFixed(3)})`,
    opacity: Math.round(Math.min(1, 0.61 + 0.48 * front) * 1000) / 1000,
    zIndex: Math.round(front * 10),
  };
}
