// 헤드 재질(일렁이는 빛 덩어리)과 그 잔상, 고리 펄스. overlay.ts와 넘김 그리기가 함께 쓴다. 시안 blobPath, drawOrb, ring, ghosts를 옮겼다.
import { K, lerp } from './lineMotion';

type G = CanvasRenderingContext2D;

const hash = (a: number, b: number) => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
export function n2(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
}

/* ---------- 헤드: 테두리 선 없이 광휘가 빛나고 일렁이는 덩어리 ---------- */
export function blobPath(g: G, x: number, y: number, r: number, amp: number, seed: number, time: number, pts = 40) {
  g.beginPath();
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const j = (n2(c * 1.3 + seed, s * 1.3 + time * 1.9) - 0.5) * 2 * 0.7 + (n2(c * 2.8 + seed * 2, s * 2.8 - time * 2.6) - 0.5) * 2 * 0.3;
    const rr = r * (1 + amp * j);
    if (i) g.lineTo(x + c * rr, y + s * rr);
    else g.moveTo(x + c * rr, y + s * rr);
  }
  g.closePath();
}

// cap: 큰 반지름(Awards 항성)에서 빛 반경과 그림자 번짐의 상한. 없으면 그림은 그대로다.
export function drawOrb(g: G, x: number, y: number, r: number, alpha: number, seed: number, time: number, k = K, cap?: { halo?: number; blur?: number }) {
  if (r < 0.4 || alpha <= 0) return;
  const fl = 0.8 + 0.2 * n2(time * 2.4, seed); // 깜빡임
  const br = 0.95 + 0.1 * n2(time * 1.1, seed + 9); // 숨쉬기
  const halo = Math.min(cap?.halo ?? Infinity, r * (2.8 + 3.2 * k) * br);
  const grad = g.createRadialGradient(x, y, r * 0.6, x, y, halo);
  grad.addColorStop(0, `rgba(127,227,238,${0.55 * k * fl * alpha})`);
  grad.addColorStop(0.3, `rgba(3,179,195,${0.28 * k * fl * alpha})`);
  grad.addColorStop(1, 'rgba(3,179,195,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, halo, 0, Math.PI * 2);
  g.fill();
  // 입체 그라데이션 대신 평면 원판 세 겹. 셋 다 같은 잡음으로 일렁여 한 덩어리로 읽힌다.
  g.save();
  g.shadowColor = `rgba(3,179,195,${alpha})`;
  g.shadowBlur = Math.min(cap?.blur ?? Infinity, r * (1.2 + 2.2 * k) * fl);
  blobPath(g, x, y, r * br, 0.05 + 0.08 * k, seed, time);
  g.fillStyle = `rgba(3,179,195,${0.95 * alpha})`;
  g.fill();
  g.shadowBlur = 0;
  blobPath(g, x, y, r * 0.68 * br, 0.07 + 0.08 * k, seed, time);
  g.fillStyle = `rgba(127,227,238,${alpha})`;
  g.fill();
  blobPath(g, x, y, r * 0.34 * br, 0.08, seed + 3, time);
  g.fillStyle = `rgba(236,253,255,${fl * alpha})`;
  g.fill();
  g.restore();
}

// 도착·강조 고리 펄스. pulse 1 → 0으로 퍼지며 옅어진다.
export function drawRing(g: G, x: number, y: number, r: number, pulse: number) {
  if (pulse <= 0) return;
  const ring = r + (1 - pulse) * 34;
  const grad = g.createRadialGradient(x, y, ring * 0.5, x, y, ring);
  grad.addColorStop(0, 'rgba(127,227,238,0)');
  grad.addColorStop(0.75, `rgba(127,227,238,${0.35 * pulse})`);
  grad.addColorStop(1, 'rgba(127,227,238,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, ring, 0, Math.PI * 2);
  g.fill();
}

/* ---------- 잔상: 헤드가 지나간 자리에 남는, 멀수록 작고 옅은 헤드 사본 ---------- */
export type Ghost = { x: number; y: number; r: number; a: number };

// len: 헤드에서 꼬리 끝까지의 거리. 14px마다 하나, 최대 7개. f는 헤드(0)에서 꼬리 끝(1)까지의 자리다.
export function ghostSpots(len: number): { f: number; scale: number; a: number }[] {
  const n = Math.min(7, Math.floor(len / 14));
  return Array.from({ length: n }, (_, i) => {
    const f = (i + 1) / (n + 1);
    return { f, scale: lerp(0.85, 0.35, f), a: lerp(0.55, 0.08, f) };
  });
}

// ghosts는 헤드에 가까운 것부터다. 먼 것부터 그려 가까운 것이 위에 놓인다.
export function drawGhosts(g: G, ghosts: readonly Ghost[], time: number) {
  for (let k = ghosts.length; k >= 1; k--) {
    const q = ghosts[k - 1];
    drawOrb(g, q.x, q.y, q.r, q.a, k * 1.7, time, K * 0.6);
  }
}
