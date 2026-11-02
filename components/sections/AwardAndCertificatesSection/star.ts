// Skills 헤드가 Awards 항성이 되는 넘김의 순수 계산. DOM도 캔버스도 모른다. 시안 ride.html의 headDoc, 꼬리, drawAwards를 옮겼다.
// 헤드는 ease-in-out으로 옮겨 가고 꼬리는 임계 감쇠로 쫓으며, 도착 장면은 ease-out과 smoothstep뿐이다. 지나치는 값은 없다.
import { type Ghost, ghostSpots } from '@/components/sections/ExperienceSection/orb';
import { K, clamp, easeInOut, lerp, smooth } from '@/components/sections/ExperienceSection/lineMotion';
import { AWARD_ORBIT, CERT_ORBIT, type Orbit, type StageTransform, awardAngle, certAngle, orbitPoint, toScreen } from './orbit';

export type Point = { x: number; y: number };

const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

/* ---------- 떠 있기: 헤드가 화면에 머물며 스크롤과 함께 내려간다 ---------- */
// home: 고른 줄 헤드의 문서 좌표(x는 헤드 캔버스 가운데). center: 원판 가운데 문서 좌표. departY, landY: 화면 y.
export type RideGeo = { home: Point; center: Point; departY: number; landY: number };

// 떠 있는 구간이 120px보다 짧으면 출발을 앞당긴다
export function rideRange(g: RideGeo) {
  const sA = g.center.y - g.landY;
  return { sD: Math.min(g.home.y - g.departY, sA - 120), sA };
}

// 헤드의 문서 자리. sA에서 정확히 원판 가운데다.
export function rideHead(g: RideGeo, scrollY: number): Point {
  const { sD, sA } = rideRange(g);
  if (scrollY <= sD) return { ...g.home };
  if (scrollY >= sA) return { ...g.center };
  const e = easeInOut(clamp((scrollY - sD) / (sA - sD)));
  return { x: lerp(g.home.x, g.center.x, e), y: scrollY + lerp(g.home.y - sD, g.landY, e) };
}

/* ---------- 꼬리: 헤드가 문서에서 지나간 길을 꼬리 끝이 쫓는다(Exp → Skills와 같은 ω) ---------- */
const OMEGA = 8.5;
const SUBSTEPS = 4;

export interface Trail {
  reset(p: Point): void;
  push(p: Point): void;
  step(dt: number): void;
  // 문서 좌표, 먼 것부터
  ghosts(r: number): Ghost[];
}

export function createTrail(): Trail {
  // pts: 지나간 길, acc: 길 시작에서 잰 누적 거리, ut: 꼬리 끝의 거리, vt: 그 속도
  let pts: Point[] = [], acc = [0], ut = 0, vt = 0;
  const head = () => acc[acc.length - 1];
  const at = (u: number): Point => {
    let lo = 0, hi = acc.length - 1;
    if (hi === 0) return pts[0];
    u = clamp(u, acc[0], acc[hi]);
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (acc[m] < u) lo = m;
      else hi = m;
    }
    const t = (u - acc[lo]) / Math.max(1e-6, acc[hi] - acc[lo]);
    return { x: lerp(pts[lo].x, pts[hi].x, t), y: lerp(pts[lo].y, pts[hi].y, t) };
  };
  const reset = (p: Point) => {
    pts = [{ x: p.x, y: p.y }];
    acc = [0];
    ut = vt = 0;
  };
  return {
    reset,
    push(p) {
      const last = pts[pts.length - 1];
      if (!last) return reset(p);
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d < 0.5) return;
      pts.push({ x: p.x, y: p.y });
      acc.push(head() + d);
      while (pts.length > 2 && acc[1] < ut - 2) {
        pts.shift();
        acc.shift();
      }
    },
    step(dt) {
      const uh = head(), h = dt / SUBSTEPS;
      for (let i = 0; i < SUBSTEPS; i++) {
        vt += (OMEGA * OMEGA * (uh - ut) - 2 * OMEGA * vt) * h;
        ut = Math.min(uh, ut + vt * h);
      }
    },
    ghosts(r) {
      const uh = head();
      return ghostSpots(uh - ut).reverse().map(s => ({ ...at(lerp(uh, ut, s.f)), r: r * s.scale, a: s.a }));
    },
  };
}

/* ---------- 도착: 헤드가 부풀어 항성이 되고, 잔상 점 넷이 나선으로 궤도에 올라 카드가 된다 ---------- */
// 화면 좌표. angle: 도착 때 Awards angleRef.
export type StarGeo = { center: Point; discR: number; angle: number; stage: StageTransform };
// 궤도선 자국(from~to rad, 궤도 매개각)
export type Trace = { orbit: Orbit; from: number; to: number; a: number };
export type StarOverlay = {
  center: Point; stage: StageTransform;
  orb: { r: number; alpha: number; k: number };
  fliers: readonly Ghost[]; traces: readonly Trace[];
};
// cards: 수상 0, 1, 2, 자격증
export type StarDom = { disc: number; text: number; plane: number; awardLine: number; certLine: number; cards: readonly [number, number, number, number] };

export const STAR_SECONDS = 1.6;
const AWARD_SWEEP = 1.4 * Math.PI;
const CERT_SWEEP = 1.8 * Math.PI;

// since: 도착 뒤 초. scattered: 도착 순간의 잔상(화면 좌표, 헤드에 가까운 것부터). 모자라면 원판 가운데 근처에서 채운다.
export function starPose(geo: StarGeo, since: number, scattered: readonly Ghost[]): { overlay: StarOverlay; dom: StarDom } {
  const { center, stage, angle, discR } = geo;
  const cool = smooth(0.3, 0.85, since);
  // 끝의 10% 빛은 1.3~1.6초에 0으로 내린다. 쉬는 빛은 Awards 테두리 캔버스 몫이고, 남겨 두면 setRide(null)에서 한 프레임에 사라진다.
  const fade = 1 - smooth(1.3, 1.6, since);
  const cards: [number, number, number, number] = [0, 0, 0, 0];
  const fliers: Ghost[] = [], traces: Trace[] = [];
  for (let i = 0; i < 4; i++) {
    const cert = i === 3, o = cert ? CERT_ORBIT : AWARD_ORBIT;
    const g0 = scattered[i] ?? { x: center.x + (i - 1.5) * 10, y: center.y - 16 - 12 * i, r: 6.6, a: 0.35 };
    const f = easeOut((since - 0.05 - 0.08 * i) / 0.95);
    const phi = (cert ? certAngle(angle) : awardAngle(angle, i)) - (1 - f) * (cert ? CERT_SWEEP : AWARD_SWEEP);
    const sc = lerp(0.2, 1, smooth(0, 0.45, f));
    const q = toScreen(center, stage, orbitPoint(o, phi, sc)), w = smooth(0, 0.18, f);
    fliers.push({
      x: lerp(g0.x, q.x, w), y: lerp(g0.y, q.y, w), r: lerp(g0.r, 5, f),
      a: lerp(Math.max(0.35, g0.a), 1, smooth(0, 0.2, f)) * (1 - smooth(0.82, 1, f)),
    });
    cards[i] = smooth(0.8, 1, f);
    if (sc > 0.95 && f < 1) traces.push({ orbit: o, from: phi - 1.2, to: phi, a: 1 - smooth(0.85, 1, f) });
  }
  return {
    overlay: { center, stage, orb: { r: lerp(12, discR, easeOut(since / 0.45)), alpha: (1 - 0.9 * cool) * fade, k: lerp(K, 0.25, cool) }, fliers, traces },
    dom: {
      disc: cool, text: smooth(0.65, 1, since), plane: smooth(0.1, 1, since),
      awardLine: smooth(0.55, 1.35, since), certLine: smooth(0.7, 1.45, since), cards,
    },
  };
}

// 오버레이 한 프레임(화면 좌표). head: 떠 있는 헤드, ghosts: 잔상(먼 것부터), ring: 출발 파동, star: 도착 장면.
export type RideFrame = {
  head: { x: number; y: number; r: number } | null;
  ghosts: readonly Ghost[];
  ring: { x: number; y: number; r: number; pulse: number } | null;
  star: StarOverlay | null;
};
