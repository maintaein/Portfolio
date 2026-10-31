// Experience 선이 Skills 헤드로 빨려 가는 넘김의 순수 계산. DOM도 캔버스도 모른다. 시안 C의 buildPath, at, slice, 꼬리 쫓기를 옮겼다.
// 헤드는 ease-in-out으로 길을 가고, 선 윗끝(꼬리)은 헤드를 임계 감쇠로 쫓는다. 탄성으로 지나치는 값은 없다.
import { type Ghost, ghostSpots } from './orb';
import { R, R_NODE, clamp, easeInOut, lerp, smooth } from './lineMotion';

const HEAD_SECONDS = 0.8; // 헤드가 길을 가는 시간
const OMEGA = 8.5; // 꼬리가 헤드를 쫓는 빠르기(ζ 1)
const HZ = 240;
const MAX_SECONDS = 1.3;
const ARRIVE_PX = 0.8;

// head, tail: 길 위에서 잰 거리(px). 길은 세로선(lineLen) 다음 곡선(curveLen)이다.
export type HandoffTable = { total: number; lineLen: number; curveLen: number; at(p: number): { head: number; tail: number } };

// 진행도 하나가 모든 그림을 정하도록 쫓기 시뮬레이션을 기하마다 한 번만 돌려 표로 둔다. 거꾸로 재생은 같은 표를 거꾸로 읽는다.
export function buildHandoffTable(lineLen: number, curveLen: number): HandoffTable {
  const dt = 1 / HZ, heads = [lineLen], tails = [0];
  let tail = 0, v = 0;
  for (let i = 1; ; i++) {
    const t = i * dt, head = lineLen + curveLen * easeInOut(clamp(t / HEAD_SECONDS));
    v += (OMEGA * OMEGA * (head - tail) - 2 * OMEGA * v) * dt;
    tail = Math.min(head, tail + v * dt);
    heads.push(head);
    tails.push(tail);
    if ((t > HEAD_SECONDS && head - tail < ARRIVE_PX) || t >= MAX_SECONDS) break;
  }
  const steps = heads.length - 1;
  const read = (a: number[], x: number) => {
    const i = Math.min(steps - 1, Math.floor(x));
    return lerp(a[i], a[i + 1], x - i);
  };
  return {
    total: steps * dt, lineLen, curveLen,
    at(p) {
      const x = clamp(p) * steps;
      return { head: read(heads, x), tail: read(tails, x) };
    },
  };
}

// 모두 화면 좌표. top: 길의 시작 y, tail: 선 끝 y, nodes: Experience 노드 y(마지막이 현재 헤드).
export type HandoffGeo = { axisX: number; top: number; tail: number; target: { x: number; y: number }; nodes: readonly number[] };
export type HandoffFrame = {
  line: { x: number; top: number; bottom: number } | null;
  // i: geo.nodes에서의 자리(타임라인과 같은 일렁임 seed를 잇는 데 쓴다). x: 축 x.
  heads: readonly { i: number; x: number; y: number; r: number; a: number; current: boolean }[];
  head: { x: number; y: number; r: number };
  ghosts: readonly Ghost[];
};

// 선 끝에서 target까지 2차 곡선. 조절점은 (축 x, 선 끝 y + 세로 거리 × .6)이다.
const CURVE_STEPS = 80;
function curvePoints(geo: Pick<HandoffGeo, 'axisX' | 'tail' | 'target'>) {
  const { axisX, tail, target } = geo, cy = tail + 0.6 * (target.y - tail);
  const pts = Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
    const t = i / CURVE_STEPS, u = 1 - t;
    return { x: u * u * axisX + t * t * target.x + 2 * u * t * axisX, y: u * u * tail + t * t * target.y + 2 * u * t * cy };
  });
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, acc };
}

// buildHandoffTable의 curveLen에 넘길 곡선 길이
export const handoffCurveLength = (geo: Pick<HandoffGeo, 'axisX' | 'tail' | 'target'>) => curvePoints(geo).acc.at(-1)!;

export function handoffPose(table: HandoffTable, geo: HandoffGeo, p: number): HandoffFrame {
  const { lineLen, curveLen } = table, { axisX, top } = geo;
  const { head, tail } = table.at(p);
  const { pts, acc } = curvePoints(geo);
  const sampled = acc[acc.length - 1];
  const pointAt = (d: number) => {
    if (d <= lineLen) return { x: axisX, y: top + d };
    // 표의 curveLen과 표본 합이 조금 달라도 끝이 target에 맞도록 비율로 옮긴다
    const s = curveLen > 0 ? clamp((d - lineLen) / curveLen) * sampled : sampled;
    let lo = 0, hi = acc.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (acc[m] <= s) lo = m;
      else hi = m;
    }
    const t = (s - acc[lo]) / (acc[hi] - acc[lo] || 1);
    return { x: lerp(pts[lo].x, pts[hi].x, t), y: lerp(pts[lo].y, pts[hi].y, t) };
  };

  const headR = lerp(2.4, 12, Math.sqrt(clamp(tail / lineLen)) * 0.6 + 0.4 * clamp(curveLen > 0 ? (head - lineLen) / curveLen : 1));
  const lineEnd = Math.min(head, lineLen);
  const tailY = pointAt(tail).y;
  const hp = pointAt(head);
  const edge = Math.max(tail, lineLen);
  const ghosts = ghostSpots(head - edge).map(({ f, scale, a }) => {
    const q = pointAt(lerp(head, edge, f));
    return { x: q.x, y: q.y, r: headR * scale, a };
  });

  const heads: HandoffFrame['heads'][number][] = [];
  geo.nodes.forEach((y, i) => {
    if (y <= top) return;
    const a = 1 - smooth(y - 40, y, tailY);
    if (a <= 0) return;
    const current = i === geo.nodes.length - 1;
    heads.push({ i, x: axisX, y: y + (1 - a) * 20, r: (current ? R : R_NODE) * lerp(0.3, 1, a), a: (current ? 1 : 0.75) * a, current });
  });

  return {
    line: lineEnd - tail < 0.5 ? null : { x: axisX, top: top + tail, bottom: top + lineEnd },
    heads,
    head: { x: hp.x, y: hp.y, r: headR },
    ghosts,
  };
}
