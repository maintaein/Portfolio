// 경력 타임라인 선의 순수 계산. DOM을 읽지 않는다. 시안 stepSeg(A 분기)와 PoseTive → 헤드 시안의 pose를 옮겼다.
export const K = 0.45;
export const R = 16;
export const R_NODE = 7.5;
export const LEAD = 40;
export const SPRINT_IN = 0.9;
export const SPRINT_OUT = 0.5;
export const PULSE_SPEED = 230;
export const PULSE_GAP = 420;
// Projects 이름 글자가 첫 노드로 날아가며 뭉쳐 첫 헤드가 된다(사용자 승인 2026-10-29, posetive-head-prototype).
// 무리는 1.95초에 내려앉고 .15초 뒤 첫 헤드로 넘긴다.
export const GATHER_SECONDS = 2.1;
const GATHER_LAND = 1.95;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3);
const span = (a: number, b: number, x: number) => clamp((x - a) / (b - a));

export type Segment = { tip: number | null; s0: number; q: number; swell: number; done: boolean };

export function createSegments(count: number): Segment[] {
  return Array.from({ length: count }, () => ({ tip: null, s0: 0, q: 0, swell: 0, done: false }));
}

// 문서 y. from: 이 장 노드, to: 다음 노드(마지막 장은 꼬리), readEnd: 이 장 읽기 끝, reading: 읽기선.
// cold: 보이기 시작한 첫 프레임. 다음 노드가 이미 읽기선 위면 질주 없이 끝난 채 선다(아래에서 켜지면 지난 장이 바로 산다).
export function stepSegment(
  seg: Segment,
  input: { from: number; to: number; readEnd: number; reading: number; alive: boolean; dt: number; reduced: boolean; cold?: boolean },
): void {
  const { from, to, reading, dt } = input;
  if (!input.alive) {
    seg.tip = from;
    seg.q = 0;
    seg.swell = 0;
    seg.done = false;
    return;
  }
  if (seg.tip === null) seg.tip = from;
  if (input.reduced) {
    seg.tip = clamp(reading, from, to);
    seg.swell = 0;
    seg.done = reading >= to;
    return;
  }
  if (input.cold && reading >= to) {
    seg.tip = seg.s0 = to;
    seg.q = seg.swell = 1;
    seg.done = true;
    return;
  }
  const end = Math.min(input.readEnd, to);
  // 질주는 장 끝이 아니라 지금 선 끝에서 출발한다. 빠르게 내리면 끝이 장 끝에 못 미친 채 질주가 시작돼 앞으로 툭 뛰었다.
  if (seg.q === 0 && reading >= end) seg.s0 = seg.tip;
  seg.q = reading >= end ? Math.min(1, seg.q + dt / SPRINT_IN) : Math.max(0, seg.q - dt / SPRINT_OUT);
  if (seg.q > 0) seg.tip = lerp(seg.s0, to, easeOut3(seg.q));
  else seg.tip += (clamp(reading + LEAD, from, end) - seg.tip) * Math.min(1, dt * 12);
  seg.swell = smooth(0.55, 1, seg.q);
  seg.done = seg.q >= 0.999;
}

// 빛 덩이 자리는 선 시작에서 잰 거리라 선이 자라거나 스크롤해도 덩이가 뛰지 않는다.
export function pulseOffsets(time: number, length: number): number[] {
  const out: number[] = [];
  for (let d = (time * PULSE_SPEED) % PULSE_GAP; d < length; d += PULSE_GAP) out.push(d);
  return out;
}

type Point = { x: number; y: number };
const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
};

// 경계 시작에서 sec초 뒤 글자 하나의 자리(화면 좌표). letter: 글자 상자 가운데와 노드에 가까운 순서 k, word: 낱말 가운데, node: 첫 노드.
// 무리 가운데는 낱말 가운데에서 살짝 떠올랐다가(예비 동작) 노드 바로 위에서 축을 따라 내려앉는다. 노드에 가까운 글자부터 .035초씩 먼저 떠나 같은 때 닿는다.
// 글자는 그 무리 가운데를 따라가며 제자리에서 가운데로 소용돌이치며(.9rad) 모인다(Hero 볼의 빠짐). g: 모인 정도, melt: 녹은 정도, speed: 이동 속도(정점 1).
export function gatherPose(letter: Point & { k: number }, sec: number, word: Point, node: Point) {
  const k = letter.k, u = span(0.35 + 0.035 * k, GATHER_LAND, sec), e = easeInOut(u);
  const g = easeInOut(span(0.4 + 0.03 * k, 1.35 + 0.03 * k, sec));
  const dx = node.x - word.x, dy = node.y - word.y;
  const c1x = word.x + dx * 0.15, c1y = word.y - 60, c2y = node.y - Math.max(120, 0.55 * Math.abs(dy));
  const at = (v: number): [number, number] => [bez(word.x, c1x, node.x, node.x, v), bez(word.y, c1y, c2y, node.y, v)];
  const [gx, gy] = at(e), [x1, y1] = at(Math.max(0, e - 0.01)), [x2, y2] = at(Math.min(1, e + 0.01));
  const ox = letter.x - word.x, oy = letter.y - word.y, th = 0.9 * g, r = 1 - g;
  return {
    x: gx + (ox * Math.cos(th) - oy * Math.sin(th)) * r,
    y: gy + (ox * Math.sin(th) + oy * Math.cos(th)) * r,
    g, melt: smooth(0.3 + 0.03 * k, 0.9 + 0.03 * k, sec),
    ang: Math.atan2(y2 - y1, x2 - x1),
    speed: u < 0.5 ? 4 * u * u : 4 * (1 - u) * (1 - u),
  };
}
