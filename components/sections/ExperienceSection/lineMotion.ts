// 경력 타임라인 선의 순수 계산. DOM을 읽지 않는다. 시안 stepSeg(A 분기), previewPhases, morphQ를 옮겼다.
export const K = 0.45;
export const R = 16;
export const R_NODE = 7.5;
export const LEAD = 40;
export const SPRINT_IN = 0.9;
export const SPRINT_OUT = 0.5;
export const PULSE_SPEED = 230;
export const PULSE_GAP = 420;
export const HEAD_MORPH_SECONDS = 1.8;
export const HEAD_TRAVEL_SECONDS = 0.8;
export const SPLIT = HEAD_MORPH_SECONDS / (HEAD_MORPH_SECONDS + HEAD_TRAVEL_SECONDS);

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
export function stepSegment(
  seg: Segment,
  input: { from: number; to: number; readEnd: number; reading: number; alive: boolean; dt: number; reduced: boolean },
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

// 경계 진행 t(0..1, morph+이동)를 morph 진행 q로. 1은 프리뷰, 0은 헤드이며 t >= SPLIT이면 0이다.
export function morphQ(t: number): number {
  return 1 - easeInOut(clamp(t / SPLIT));
}

export function morphPhases(q: number) {
  return {
    widen: easeInOut(span(0, 0.65, q)),
    face: easeInOut(span(0.1, 0.65, q)),
    corner: easeInOut(span(0.25, 0.65, q)),
    reveal: easeOut3(span(0, 0.8, q)),
    strands: 1 - smooth(0.3, 0.6, q),
    ragged: 1 - smooth(0.45, 0.82, q),
    handoff: smooth(0.94, 1, q),
    // 구겨지는 정도: .82에 0, .41에 가장 크고, 0에서 다시 0.
    crumple: Math.pow(Math.sin(Math.PI * span(0, 0.82, q)), 0.8),
  };
}
