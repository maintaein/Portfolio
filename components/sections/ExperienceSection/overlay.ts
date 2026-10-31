// 경력 선·헤드와 Projects 이름 → 첫 헤드 모임을 그리는 화면 고정 Canvas2D 하나. 시안 blobPath, drawOrb, drawLine, zapLine, drawGather를 옮겼다.
// 두 소비자(경계, 타임라인)의 상태를 받아 rAF 하나로 그린다. 계산은 lineMotion이 맡고 여기서는 그리기만 한다.
import { GATHER_SECONDS, K, R, clamp, easeInOut, gatherPose, lerp, pulseOffsets, smooth } from './lineMotion';
import type { HandoffFrame } from './handoff';
import { blobPath, drawGhosts, drawOrb, drawRing, n2 } from './orb';

// 경계 한 프레임. letters: 뭉칠 글자(화면 좌표 글자 상자 가운데, k: 노드에 가까운 순서), font: 그 글자의 CSS font, target: 첫 노드.
export type GatherLetter = { ch: string; x: number; y: number; k: number };
export type BoundaryFrame = { t: number; font: string; letters: readonly GatherLetter[]; target: { x: number; y: number } };
export type TimelineFrame = {
  scrollY: number; axisX: number;
  segments: readonly { from: number; tip: number; swell: number; done: boolean; last: boolean; rOrigin: number }[]; // 화면 y
  heads: readonly { y: number; r: number; pulse: number; current: boolean }[]; // 화면 y, r 0이면 그리지 않는다
};
export interface ExperienceOverlay {
  setBoundary(frame: BoundaryFrame | null): void;
  setTimeline(provider: ((dt: number, now: number) => TimelineFrame | null) | null): void;
  // 프레임이 있는 동안은 타임라인 대신 넘김을 그린다. provider는 그대로 불린다.
  setHandoff(frame: HandoffFrame | null): void;
  setReduced(reduced: boolean): void;
  destroy(): void;
}

type G = CanvasRenderingContext2D;

/* ---------- 선: 헤드와 같은 재질, 헤드 쪽은 물방울처럼 뽑혀 나온다. 일렁임은 없다(5차). ---------- */
function drawLine(g: G, vh: number, x: number, y0: number, y1: number, rOrigin: number, time: number, pulses: boolean, k = K) {
  const len = y1 - y0;
  if (len < 1) return;
  const top = Math.max(y0, -40), bot = Math.min(y1, vh + 40);
  if (bot <= top) return;
  // 일렁임이 없어 시안의 3px 점 목록은 곧은 한 줄과 같다
  const path = (from: number, to: number) => {
    g.beginPath();
    g.moveTo(x, Math.max(top, from));
    g.lineTo(x, Math.min(bot, to));
  };
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(3,179,195,.85)';
  g.shadowBlur = 8 + 12 * k;
  path(top, bot);
  g.lineWidth = 9 + 6 * k;
  g.strokeStyle = `rgba(3,179,195,${0.1 + 0.12 * k})`;
  g.stroke();
  g.shadowBlur = 4 + 6 * k;
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(127,227,238,.92)';
  g.stroke();
  if (rOrigin > 1) {
    const neck = Math.min(len, 80);
    const w = (d: number) => 1.5 + (rOrigin * 0.8 - 1.5) * Math.exp(-d / 15);
    g.beginPath();
    for (let d = 0; d <= neck; d += 2) g.lineTo(x - w(d), y0 + d);
    for (let d = neck; d >= 0; d -= 2) g.lineTo(x + w(d), y0 + d);
    g.closePath();
    g.shadowBlur = 8 + 8 * k;
    g.fillStyle = 'rgba(127,227,238,.85)';
    g.fill();
  }
  // 흐름: 빛 덩이 자리는 선 시작에서 잰 거리라 선이 자라거나 스크롤해도 덩이가 뛰지 않는다
  if (pulses) {
    for (const d of pulseOffsets(time, len)) {
      const yp = y0 + d;
      if (yp < top - 60 || yp > bot + 60) continue;
      const gr = g.createLinearGradient(0, yp - 60, 0, yp + 60);
      gr.addColorStop(0, 'rgba(236,253,255,0)');
      gr.addColorStop(0.5, 'rgba(236,253,255,.95)');
      gr.addColorStop(1, 'rgba(236,253,255,0)');
      path(yp - 60, yp + 60);
      g.shadowColor = 'rgba(127,227,238,1)';
      g.shadowBlur = 16;
      g.lineWidth = 6;
      g.strokeStyle = gr;
      g.stroke();
    }
  }
  g.restore();
}

// 전기 줄기: 두 점 사이를 떨며 잇는 가는 선(About→Projects 테두리 전기와 같은 말)
function zapLine(g: G, x1: number, y1: number, x2: number, y2: number, seed: number, time: number, a: number) {
  if (a <= 0.01) return;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  g.beginPath();
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, j = (n2(t * 3.1 + seed, time * 7 + seed) - 0.5) * 2 * Math.min(7, len * 0.12) * Math.sin(Math.PI * t);
    const x = lerp(x1, x2, t) + nx * j, y = lerp(y1, y2, t) + ny * j;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.strokeStyle = `rgba(220,251,255,${a})`;
  g.lineWidth = 1;
  g.stroke();
}

const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c: readonly number[]) => `rgb(${c.map(Math.round).join(',')})`;
// 글자색(--color-text-primary), 헤드 청록, 번쩍임
const INK = [238, 244, 245], CYAN_L = [127, 227, 238], WHITE = [236, 253, 255];
const SVG = 'http://www.w3.org/2000/svg';

// 2D 컨텍스트가 없으면 null이다. 받는 쪽(ExperienceSection)은 그리기 없이 자기 rAF로 읽기 진행을 돈다.
export function createExperienceOverlay(canvas: HTMLCanvasElement): ExperienceOverlay | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let boundary: BoundaryFrame | null = null;
  let handoff: HandoffFrame | null = null;
  let provider: ((dt: number, now: number) => TimelineFrame | null) | null = null;
  let reduced = false, dead = false, raf = 0, last = 0, dpr = 1, vw = 0, vh = 0;
  // 액체 캔버스: 글자와 방울을 여기에 그리고 SVG 필터(흐리게 번진 알파를 다시 날카롭게 세운다)로 가까운 방울끼리 목이 이어져 붙게 한다.
  // 이 캔버스 바로 아래 형제로, 처음 모일 때 한 번 만들어 계속 쓴다. 필터가 없는 브라우저에서는 방울이 따로 보일 뿐이다.
  // 화면 전체가 아니라 글자 무리 상자 크기로 두고 매 프레임 그 상자로 옮긴다. CSS 필터 비용은 요소 넓이를 따라가서, 화면 크기로 두면
  // 녹는 구간(.2~1.25초)이 30fps로 떨어졌다. 필터를 끄면 2.1초 중 25ms 넘는 프레임이 17~28에서 5~9로 줄었다(2026-10-30 실측).
  // 그림자는 요소 밖으로도 그려져 잘리지 않는다. 비트맵은 키우기만 한다. w·h는 CSS px.
  let goo: { el: HTMLCanvasElement; g: G; svg: SVGSVGElement; filter: SVGFilterElement; blur: SVGFEGaussianBlurElement; on: boolean; w: number; h: number } | null | undefined;

  // DPR이 바뀌면 다음 프레임에 새로 키운다
  const sizeGoo = () => {
    if (goo) goo.w = goo.h = 0;
  };
  const getGoo = () => {
    if (goo === undefined) {
      const el = document.createElement('canvas'), g = el.getContext('2d');
      if (!g) return (goo = null);
      el.className = canvas.className;
      Object.assign(el.style, { inset: 'auto', left: '0', top: '0' });
      el.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('style', 'position:absolute;width:0;height:0');
      svg.innerHTML = '<filter id="experience-goo" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
        + '<feGaussianBlur in="SourceGraphic" stdDeviation="0.01" result="b"/><feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -5"/></filter>';
      canvas.before(svg, el);
      goo = { el, g, svg, filter: svg.querySelector('filter')!, blur: svg.querySelector('feGaussianBlur')!, on: false, w: 0, h: 0 };
    }
    return goo;
  };
  const clearGoo = () => {
    if (!goo?.on) return;
    goo.on = false;
    goo.g.setTransform(1, 0, 0, 1, 0, 0);
    goo.g.clearRect(0, 0, goo.el.width, goo.el.height);
    goo.el.style.filter = '';
  };
  const measure = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    // 캔버스 상자(100%)는 고전 스크롤바를 뺀 폭이다. innerWidth로 재면 그림이 그 비만큼 눌려 오른쪽이 15px쯤 어긋났다.
    vw = canvas.clientWidth || innerWidth;
    vh = canvas.clientHeight || innerHeight;
    canvas.width = vw * dpr;
    canvas.height = vh * dpr;
    sizeGoo();
  };

  /* ---------- Projects 이름 → 헤드 ----------
     사이트 전환 말을 빌린다. ① 충전: About→Projects의 전기처럼 빛이 글자를 훑어 흰 글자가 청록으로 달아오르고 글자 사이에 전기 줄기가 튄다.
     ② 녹음: 글자 획이 둥글게 녹아 방울이 된다. ③ 모임: 무리가 노드로 떠나는 동안 글자들이 가운데로 소용돌이치며 모이고, 가까워진 방울끼리 목으로 이어져 한 덩이가 된다.
     ④ 맺힘: 덩이에 헤드 재질이 차올라 진행 방향으로 늘어난 채 노드에 내려앉는다. 넘김은 첫 헤드의 고리 펄스다. */
  const drawGather = (b: BoundaryFrame, time: number) => {
    const n = b.letters.length, layer = n ? getGoo() : null;
    if (!layer) return;
    const { g: gctx, el, filter, blur } = layer;
    const sec = b.t * GATHER_SECONDS, node = b.target;
    const xs = b.letters.map(L => L.x), minX = Math.min(...xs), maxX = Math.max(...xs);
    const word = { x: (minX + maxX) / 2, y: b.letters.reduce((a, L) => a + L.y, 0) / n };
    const rDrop = (1.2 * R) / Math.sqrt(n);
    layer.on = true;
    // 녹음: 번짐을 키울수록 획 모서리가 둥글어지고 가는 획이 가늘어진다. 방울끼리 가까우면 목이 이어진다.
    blur.setAttribute('stdDeviation', lerp(0.01, 4.5, smooth(0.2, 0.8, sec)).toFixed(2));
    const charge = smooth(0, 0.45, sec);
    el.style.filter = `url(#experience-goo) drop-shadow(0 0 ${(2 + 4 * charge).toFixed(1)}px rgba(127,227,238,${(0.85 * charge).toFixed(2)})) drop-shadow(0 0 14px rgba(3,179,195,${(0.5 * charge).toFixed(2)}))`;
    gctx.font = b.font;
    // 글자 상자 가운데에서 기준선까지(상자 높이 = 글꼴 올림 + 내림)
    const m = gctx.measureText('P'), base = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
    const poses = b.letters.map(L => {
      const p = gatherPose(L, sec, word, node);
      // 방울: 글자가 녹는 자리에서 맺히고, 모일수록 커져 다 모이면 겹친 방울이 헤드 크기 한 덩이가 된다
      const rd = smooth(0, 0.5, p.melt) * lerp(rDrop, R * 0.85, p.g), st = 1 + 0.6 * p.speed;
      // 꼬리: 지나온 자리의 작은 구슬 셋이 번짐에 이어져 물방울 꼬리가 된다
      const tail = rd > 0.3 && p.speed > 0.15 ? [1, 2, 3].map(j => gatherPose(L, sec - 0.035 * j, word, node)) : [];
      return { ...p, L, k: L.k, rd, st, tail };
    });
    // 캔버스 상자: 그리는 것(글자, 방울, 꼬리)의 가운데에 글자 높이와 번짐 몫을 더한다
    const pts = poses.flatMap(p => [p, ...p.tail]), pad = m.fontBoundingBoxAscent + 2 * R;
    // 상자는 CSS px로 정수이고 장치 px로 8의 배수인 칸(DPR 1.5면 16px)에 맞춘다. goo는 알파를 가파르게 잘라, 번짐 표본 격자가 화면 크기
    // 캔버스 때와 한 칸 미만만 어긋나도 글자·방울 가장자리가 1px씩 밀렸다. 큰 번짐은 축소해 계산되어 그 격자가 장치 px 여러 칸이다.
    const cell = Array.from({ length: 32 }, (_, i) => i + 1).find(u => Math.abs(u * dpr / 8 - Math.round(u * dpr / 8)) < 1e-6) ?? 1;
    const snap = (v: number, round: (x: number) => number) => round(v / cell) * cell;
    const bx = snap(Math.min(...pts.map(q => q.x)) - pad, Math.floor), by = snap(Math.min(...pts.map(q => q.y)) - pad, Math.floor);
    const bw = snap(Math.max(...pts.map(q => q.x)) + pad, Math.ceil) - bx, bh = snap(Math.max(...pts.map(q => q.y)) + pad, Math.ceil) - by;
    if (bw > layer.w || bh > layer.h) {
      layer.w = Math.max(layer.w, bw);
      layer.h = Math.max(layer.h, bh);
      Object.assign(el, { width: Math.round(layer.w * dpr), height: Math.round(layer.h * dpr) });
      Object.assign(el.style, { width: `${layer.w}px`, height: `${layer.h}px` });
      // 필터 영역도 상자 비율이 아니라 칸에 맞춘 px다
      Object.entries({ x: -cell, y: -cell, width: layer.w + 2 * cell, height: layer.h + 2 * cell }).forEach(([k, v]) => filter.setAttribute(k, String(v)));
    }
    el.style.transform = `translate(${bx}px, ${by}px)`;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, el.width, el.height);
    // 그리기는 화면 좌표 그대로다
    gctx.setTransform(dpr, 0, 0, dpr, -bx * dpr, -by * dpr);
    gctx.font = b.font;
    gctx.textAlign = 'center';
    gctx.textBaseline = 'alphabetic';
    const scan = lerp(minX - 60, maxX + 60, charge);
    for (const p of poses) {
      // 충전: 훑는 빛이 지나간 글자는 청록이 되고, 지나가는 순간 하얗게 번쩍인다
      const lit = smooth(-10, 50, scan - p.L.x), flash = Math.exp(-(((scan - p.L.x) / 28) ** 2)) * (1 - smooth(0.3, 0.5, sec));
      gctx.fillStyle = rgb(mix(mix(INK, CYAN_L, Math.max(lit, p.melt)), WHITE, 0.8 * flash));
      if (p.melt < 1) {
        const sc = lerp(1, 0.5, p.melt);
        gctx.save();
        gctx.translate(p.x, p.y);
        gctx.scale(sc, sc);
        gctx.globalAlpha = 1 - p.melt;
        gctx.fillText(p.L.ch, 0, base);
        gctx.restore();
      }
      if (p.rd <= 0.3) continue;
      gctx.beginPath();
      gctx.ellipse(p.x, p.y, p.rd * p.st, p.rd / Math.sqrt(p.st), p.ang, 0, Math.PI * 2);
      gctx.fill();
      p.tail.forEach((q, j) => {
        gctx.beginPath();
        gctx.arc(q.x, q.y, p.rd * (1 - 0.24 * (j + 1)), 0, Math.PI * 2);
        gctx.fill();
      });
    }
    const gm = poses.reduce((a, p) => a + p.g, 0) / n;
    // 전기 줄기: 이웃 글자 사이에 튀다가, 다 모여 한 덩이가 되면 가라앉는다
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(3,179,195,.9)';
    ctx.shadowBlur = 6;
    const live = smooth(0.12, 0.3, sec) * (1 - smooth(0.6, 0.9, gm));
    for (let i = 0; i < n - 1; i++) {
      const a = poses[i], c = poses[i + 1];
      zapLine(ctx, a.x, a.y, c.x, c.y, i * 3.3, time, K * 1.2 * live * (1 - smooth(90, 200, Math.hypot(a.x - c.x, a.y - c.y))));
    }
    ctx.restore();
    // 방울 속심: 헤드와 같은 재질(흰 속)이라 같은 것이 모이는 것으로 읽힌다
    const core = 0.9 * (1 - smooth(0.7, 1, gm));
    poses.forEach((p, i) => {
      if (p.rd <= 0.8 || core <= 0) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.ang);
      ctx.scale(p.st, 1 / Math.sqrt(p.st));
      blobPath(ctx, 0, 0, p.rd * 0.42, 0.08, i * 2.7, time);
      ctx.fillStyle = `rgba(236,253,255,${core})`;
      ctx.fill();
      ctx.restore();
    });
    // 덩이가 되면 헤드 재질이 차오른다. 무리 가운데에서 진행 방향으로 늘어나며 날아 노드에 내려앉는다.
    const head = smooth(0.55, 0.95, gm);
    if (head > 0) {
      const cx = poses.reduce((a, p) => a + p.x, 0) / n, cy = poses.reduce((a, p) => a + p.y, 0) / n;
      const lead = poses.find(p => p.k === 0) ?? poses[0], st = 1 + 0.35 * lead.speed, ang = lead.ang;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.scale(st, 1 / Math.sqrt(st));
      ctx.rotate(-ang);
      ctx.translate(-cx, -cy);
      drawOrb(ctx, cx, cy, R * lerp(0.6, 1, head), head, 0, time);
      ctx.restore();
    }
  };

  const drawTimeline = (f: TimelineFrame, time: number) => {
    const x = f.axisX;
    f.segments.forEach((s, i) => {
      if (s.tip - s.from < 0.5) return;
      drawLine(ctx, vh, x, s.from, s.tip, s.rOrigin, time, !reduced);
      if (!s.last && !s.done) drawOrb(ctx, x, s.tip, lerp(2.4, R, easeInOut(s.swell)), 1, 20 + i, time, K * (0.5 + 0.5 * s.swell));
      else if (s.last) drawOrb(ctx, x, s.tip, 2.4, s.done ? 0.4 : 1, 30, time, K * 0.5);
    });
    f.heads.forEach((h, i) => {
      if (h.r < 0.4 || h.y < -80 || h.y > vh + 80) return;
      const pulse = reduced ? 0 : h.pulse, sq = 1 + 0.25 * pulse * Math.cos(pulse * 9);
      drawOrb(ctx, x, h.y, h.r * sq, h.current ? 1 : 0.75, i * 5.3, time, h.current ? K : K * 0.5);
      drawRing(ctx, x, h.y, h.r, pulse);
    });
  };

  // 선 윗끝 40px는 .6 → 3px로 굵어지고 옅은 데서 선명해진다(꼬리). 나머지는 타임라인 선 그대로다.
  const drawHandoff = (f: HandoffFrame, time: number) => {
    const { line } = f;
    if (line) {
      const fade = Math.min(40, (line.bottom - line.top) * 0.85), bodyTop = line.top + fade;
      ctx.save();
      ctx.shadowBlur = 8 + 12 * K;
      for (let d = 0; d < fade; d += 2) {
        const y1 = Math.min(line.top + d + 2, bodyTop), v = smooth(0, fade, y1 - line.top), w = lerp(0.6, 3, v);
        ctx.shadowColor = `rgba(3,179,195,${0.85 * v})`;
        ctx.beginPath();
        ctx.moveTo(line.x, line.top + d);
        ctx.lineTo(line.x, y1);
        ctx.lineWidth = w * 3 + 6 * K;
        ctx.strokeStyle = `rgba(3,179,195,${(0.1 + 0.12 * K) * v})`;
        ctx.stroke();
        ctx.lineWidth = w;
        ctx.strokeStyle = `rgba(127,227,238,${0.92 * lerp(0.15, 1, v)})`;
        ctx.stroke();
      }
      ctx.restore();
      drawLine(ctx, vh, line.x, bodyTop, line.bottom, 0, time, false);
    }
    // 타임라인과 같은 seed와 세기라 넘김이 시작돼도 헤드 모양이 바뀌지 않는다
    for (const h of f.heads) drawOrb(ctx, h.x, h.y, h.r, h.a, h.i * 5.3, time, h.current ? K : K * 0.5);
    drawGhosts(ctx, f.ghosts, time);
    drawOrb(ctx, f.head.x, f.head.y, f.head.r, 1, 0, time, K);
  };

  const clear = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
  };
  const frame = (now: number) => {
    raf = 0;
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    const time = reduced ? 0 : now / 1000;
    clear();
    const timeline = provider?.(dt, now);
    // 도착한(t 1) 헤드는 타임라인의 첫 헤드가 살 때까지 그 자리에 잡아 둔다. 도착이 React를 거쳐 첫 헤드에 닿는 한 프레임 동안 헤드가 비지 않는다.
    if (boundary && boundary.t >= 1 && (!timeline || timeline.heads.some(h => h.current))) boundary = null;
    // 모션 감소에서는 경계를 재생하지 않는다
    if (boundary && !reduced && boundary.t > 0) drawGather(boundary, time);
    else clearGoo();
    if (handoff) drawHandoff(handoff, time);
    else if (timeline) drawTimeline(timeline, time);
    start();
  };
  const start = () => {
    if (!raf && !dead && !document.hidden && (boundary || provider || handoff)) raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  // 둘 다 비면 남은 그림을 지우고 루프를 멈춘다
  const settle = () => {
    if (boundary || provider || handoff) return start();
    stop();
    clear();
    clearGoo();
  };
  const onVisibility = () => (document.hidden ? stop() : start());

  measure();
  window.addEventListener('resize', measure);
  // 스크롤바가 생기거나 사라지면 창 resize 없이 상자만 바뀐다.
  const box = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
  box?.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    setBoundary(next) {
      boundary = next;
      settle();
    },
    setTimeline(next) {
      provider = next;
      settle();
    },
    setHandoff(next) {
      handoff = next;
      settle();
    },
    setReduced(next) {
      reduced = next;
    },
    destroy() {
      dead = true;
      stop();
      boundary = provider = handoff = null;
      goo?.el.remove();
      goo?.svg.remove();
      window.removeEventListener('resize', measure);
      box?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
