// 경력 선·헤드와 프리뷰→헤드 morph를 그리는 화면 고정 Canvas2D 하나. 시안 blobPath, drawOrb, drawLine, boxPoints, trace, drawMorph를 옮겼다.
// 두 소비자(경계, 타임라인)의 상태를 받아 rAF 하나로 그린다. 계산은 lineMotion이 맡고 여기서는 그리기만 한다.
import { K, R, SPLIT, morphPhases, morphQ, pulseOffsets } from './lineMotion';

export type BoundaryFrame = { t: number; preview: DOMRect; radius: number; image: HTMLImageElement | null; target: { x: number; y: number } };
export type TimelineFrame = {
  scrollY: number; axisX: number;
  segments: readonly { from: number; tip: number; swell: number; done: boolean; last: boolean; rOrigin: number }[]; // 화면 y
  heads: readonly { y: number; r: number; pulse: number; current: boolean }[]; // 화면 y, r 0이면 그리지 않는다
};
export interface ExperienceOverlay {
  setBoundary(frame: BoundaryFrame | null): void;
  setTimeline(provider: ((dt: number, now: number) => TimelineFrame | null) | null): void;
  setReduced(reduced: boolean): void;
  destroy(): void;
}

type G = CanvasRenderingContext2D;
type OutlinePoint = [number, number, number, number];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInOutD = (t: number) => (t < 0.5 ? 12 * t * t : 3 * Math.pow(2 - 2 * t, 2)) / 3; // 속도, 정점 1
const hash = (a: number, b: number) => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
function n2(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
}

/* ---------- 헤드: 테두리 선 없이 광휘가 빛나고 일렁이는 덩어리 ---------- */
function blobPath(g: G, x: number, y: number, r: number, amp: number, seed: number, time: number, pts = 40) {
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

function drawOrb(g: G, x: number, y: number, r: number, alpha: number, seed: number, time: number, k = K) {
  if (r < 0.4 || alpha <= 0) return;
  const fl = 0.8 + 0.2 * n2(time * 2.4, seed); // 깜빡임
  const br = 0.95 + 0.1 * n2(time * 1.1, seed + 9); // 숨쉬기
  const halo = r * (2.8 + 3.2 * k) * br;
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
  g.shadowBlur = r * (1.2 + 2.2 * k) * fl;
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

// 둥근 상자 둘레를 같은 간격으로 짚은 점과 바깥 법선
function boxPoints(w: number, h: number, r: number, n = 180): OutlinePoint[] {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const ex = w - 2 * r, ey = h - 2 * r, arc = (Math.PI * r) / 2, P = Math.PI;
  const corner = (ox: number, oy: number, a: number): OutlinePoint => [ox + r * Math.cos(a), oy + r * Math.sin(a), Math.cos(a), Math.sin(a)];
  const segs: [number, (t: number) => OutlinePoint][] = [
    [ex, t => [-ex / 2 + t * ex, -h / 2, 0, -1]], [arc, t => corner(ex / 2, -ey / 2, -P / 2 + (t * P) / 2)],
    [ey, t => [w / 2, -ey / 2 + t * ey, 1, 0]], [arc, t => corner(ex / 2, ey / 2, (t * P) / 2)],
    [ex, t => [ex / 2 - t * ex, h / 2, 0, 1]], [arc, t => corner(-ex / 2, ey / 2, P / 2 + (t * P) / 2)],
    [ey, t => [-w / 2, ey / 2 - t * ey, -1, 0]], [arc, t => corner(-ex / 2, -ey / 2, P + (t * P) / 2)],
  ];
  const L = segs.reduce((s, [l]) => s + l, 0) || 1, pts: OutlinePoint[] = [];
  for (let i = 0; i < n; i++) {
    let d = (i / n) * L, k = 0;
    while (k < 7 && d > segs[k][0]) {
      d -= segs[k][0];
      k++;
    }
    pts.push(segs[k][1](segs[k][0] ? Math.min(1, d / segs[k][0]) : 0));
  }
  return pts;
}

const trace = (g: G, pts: readonly OutlinePoint[]) => {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
};

const NOOP: ExperienceOverlay = { setBoundary() {}, setTimeline() {}, setReduced() {}, destroy() {} };

export function createExperienceOverlay(canvas: HTMLCanvasElement): ExperienceOverlay {
  const ctx = canvas.getContext('2d');
  if (!ctx) return NOOP;
  let boundary: BoundaryFrame | null = null;
  let provider: ((dt: number, now: number) => TimelineFrame | null) | null = null;
  let reduced = false, dead = false, raf = 0, last = 0, dpr = 1, vw = 0, vh = 0;
  // morph의 가면(mask)과 그림 흔들림(warp) 캔버스. 그림이 처음 필요할 때 한 번 만들어 계속 쓴다.
  let layers: { mask: HTMLCanvasElement; m: G; warp: HTMLCanvasElement; w: G } | null | undefined;

  const sizeMask = () => {
    if (!layers) return;
    layers.mask.width = vw * dpr;
    layers.mask.height = vh * dpr;
  };
  const getLayers = () => {
    if (layers === undefined) {
      const mask = document.createElement('canvas'), warp = document.createElement('canvas');
      const m = mask.getContext('2d'), w = warp.getContext('2d');
      layers = m && w ? { mask, m, warp, w } : null;
      sizeMask();
    }
    return layers;
  };
  const measure = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    vw = innerWidth;
    vh = innerHeight;
    canvas.width = vw * dpr;
    canvas.height = vh * dpr;
    sizeMask();
  };

  /* ---------- 프리뷰 → 헤드 ----------
     About→Projects 전환(previewPhases)을 제자리에서 거꾸로 밟는다. 윤곽은 프리뷰 상자 안에서만 구겨지고(7차), 그림은 고르지 않은 앞선으로
     가운데로 물러나며 그 자리가 빛으로 찬다. 끝에서 전기가 가라앉아 헤드가 된 뒤에야 목적지로 옮겨 간다. */
  const drawMorph = (b: BoundaryFrame, time: number) => {
    const pr = b.preview, img = b.image;
    const cx = pr.left + pr.width / 2, cy = pr.top + pr.height / 2;
    if (b.t >= SPLIT) {
      // morph가 끝난 헤드가 목적지로 옮겨 간다. 빠른 가운데에서만 진행 방향으로 살짝 늘어난다.
      const u = (b.t - SPLIT) / (1 - SPLIT), e = easeInOut(u), st = 1 + 0.35 * easeInOutD(u);
      const tx = b.target.x, ty = b.target.y, x = lerp(cx, tx, e), y = lerp(cy, ty, e), ang = Math.atan2(ty - cy, tx - cx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.scale(st, 1 / Math.sqrt(st));
      ctx.rotate(-ang);
      ctx.translate(-x, -y);
      drawOrb(ctx, x, y, R, 1, 0, time);
      ctx.restore();
      return;
    }
    const q = morphQ(b.t), v = morphPhases(q);
    const W = lerp(R * 2, pr.width, v.widen), H = lerp(R * 2, pr.height, v.face), hw = W / 2, hh = H / 2;
    // 모서리는 프리뷰 모서리에서 다 둥근 덩이로 간다
    const rad = lerp(Math.min(hw, hh), b.radius, v.corner);
    const end = 1 - smooth(0, 0.12, q); // 끝: 전기가 가라앉고 테두리 없는 헤드만 남는다
    const zap = v.strands * (1 - end), sz = clamp(Math.min(W, H) / 60, 0.35, 1);
    // 빛(흰 막과 가장자리 광휘)은 윤곽이 일그러지기 시작할 때부터 얹혀 맨 윤곽이 드러나지 않게 한다
    const glow = Math.max(v.strands, 0.6 * v.ragged);
    // 구김과 잔떨림은 안쪽으로만 민다. 바깥으로 밀면 줄어들기 전에 프리뷰보다 커지듯 모서리와 테두리가 부풀었다(7차).
    const unit = Math.sqrt(hw * hh) || 1, crush = 0.18 * v.crumple * unit, swing = v.ragged * Math.min(5, 1 + 0.015 * Math.min(W, H));
    const lobes = [[3, 0.45, 0.7], [4, 0.3, -1.1], [5, 0.25, 1.6], [7, 0.15, -2.3]];
    const outline = boxPoints(W, H, rad, 220).map(([x, y, nx, ny]): OutlinePoint => {
      const a = Math.atan2(y / (hh || 1), x / (hw || 1));
      let lobe = 0;
      for (const [k, w, sp] of lobes) lobe += w * Math.cos(k * a + sp * time + k * 1.7);
      // 법선 따라 안으로 밀면 모서리 호가 서로 넘어가 뾰족하게 접혔다. 가운데 쪽으로 당기면 접히지 않는다.
      const pull = crush * (lobe + 1.15) * 0.8 + swing * n2(x * 0.03 + 11, y * 0.03 + time * 0.3) * 2;
      const f = Math.max(0.3, 1 - pull / (Math.hypot(x, y) || 1));
      return [cx + x * f, cy + y * f, nx, ny];
    });
    ctx.save();
    ctx.globalAlpha = (1 - v.handoff) * (1 - end);
    if (glow > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(3,179,195,${0.85 * glow})`;
      ctx.shadowBlur = 26 * sz;
      trace(ctx, outline);
      ctx.fillStyle = `rgba(3,179,195,${0.3 * glow})`;
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    trace(ctx, outline);
    ctx.clip();
    if (v.reveal < 1) {
      ctx.fillStyle = `rgba(127,227,238,${1 - v.reveal})`;
      ctx.fillRect(cx - hw - 60, cy - hh - 60, W + 120, H + 120);
    }
    const lay = v.reveal > 0 && img && img.complete && img.naturalWidth ? getLayers() : null;
    if (img && lay) {
      const { mask, m: mctx, warp, w: wctx } = lay;
      // 그림은 프리뷰와 같은 cover로 깔리고, 가운데에서 재는 고르지 않은 앞선 안에서만 보인다
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.clearRect(0, 0, vw, vh);
      mctx.filter = `blur(${Math.max(1, 0.12 * Math.min(hw, hh))}px)`;
      mctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const rf = v.reveal * (2.75 + (n2(c * 1.2 + 31, s * 1.2 + time * 0.12) - 0.5) * 2.6);
        if (i) mctx.lineTo(cx + c * rf * hw, cy + s * rf * hh);
        else mctx.moveTo(cx + c * rf * hw, cy + s * rf * hh);
      }
      mctx.fillStyle = '#fff';
      mctx.fill();
      mctx.filter = 'none';
      const fw = pr.width, fh = pr.height, ar = fw / fh, iar = img.naturalWidth / img.naturalHeight;
      let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
      if (iar > ar) {
        sw = sh * ar;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = sw / ar;
        sy = (img.naturalHeight - sh) / 2;
      }
      // 그림은 느린 흐름 장을 따라 밀린다. 가는 가로줄을 옆으로 민 뒤 가는 세로줄을 위아래로 미는 두 번 밀기라 칸 경계가 보이지 않는다.
      // 덮어 그려야 해서 source-atop이다.
      const flow = Math.max(v.crumple, 0.5 * v.strands) * Math.min(fw, fh) * 0.07, step = 3;
      const ww = Math.round(fw * dpr), wh = Math.round(fh * dpr);
      if (warp.width !== ww || warp.height !== wh) {
        warp.width = ww;
        warp.height = wh;
      } else wctx.clearRect(0, 0, ww, wh);
      wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let y = 0; y < fh; y += step) {
        const ox = flow * (n2(y * 0.012 + 3, time * 0.9) - 0.5) * 2;
        wctx.drawImage(img, sx, sy + (sh * y) / fh, sw, (sh * step) / fh, ox, y, fw, step + 0.5);
      }
      mctx.globalCompositeOperation = 'source-atop';
      for (let x = 0; x < fw; x += step) {
        const oy = flow * (n2(x * 0.012 + 17, time * 0.7) - 0.5) * 2;
        mctx.drawImage(warp, x * dpr, 0, step * dpr, wh, cx - fw / 2 + x, cy - fh / 2 + oy, step + 0.5, fh);
      }
      mctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(mask, 0, 0, vw, vh);
    }
    if (glow > 0) {
      // 빛 막: 안쪽은 흐리게, 가장자리로 갈수록 하얗게 밝아진다. 구겨질수록 막이 짙다.
      const sheet = Math.max(0.22 * v.strands, 0.38 * v.crumple);
      ctx.fillStyle = `rgba(225,250,255,${sheet})`;
      ctx.fillRect(cx - hw - 60, cy - hh - 60, W + 120, H + 120);
      const band = Math.min(26, 6 + 0.07 * Math.min(W, H));
      ctx.shadowColor = `rgba(236,253,255,${glow})`;
      ctx.shadowBlur = band;
      trace(ctx, outline);
      ctx.lineWidth = band;
      ctx.strokeStyle = `rgba(236,253,255,${0.55 * glow})`;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = band * 0.35;
      ctx.strokeStyle = `rgba(200,248,252,${0.5 * glow})`;
      ctx.stroke();
    }
    ctx.restore();
    if (zap > 0) {
      // 가장자리 전기 줄기: 굵은 선두 하나와 가는 줄기 둘이 외곽선을 따라 떨린다
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const amp = (i ? 1 + 0.8 * i : 0.6) * sz, sp = 1 + i * 0.19; // 줄기는 외곽선에 붙어 떨린다. 멀리 뜨면 별개의 테두리로 읽힌다
        ctx.beginPath();
        outline.forEach(([x, y, nx, ny], j) => {
          const d = amp * (n2(x * 0.03 + i * 5.1, y * 0.03 + time * 1.4 * sp) - 0.5) * 2.6;
          if (j) ctx.lineTo(x + nx * d, y + ny * d);
          else ctx.moveTo(x + nx * d, y + ny * d);
        });
        ctx.closePath();
        ctx.shadowColor = 'rgba(3,179,195,.9)';
        ctx.shadowBlur = i ? 6 : 10;
        ctx.lineWidth = (i ? 0.9 : 1.6) * zap;
        ctx.strokeStyle = i ? `rgba(127,227,238,${0.55 * zap})` : `rgba(235,253,255,${0.9 * zap})`;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    if (end > 0) drawOrb(ctx, cx, cy, R, end, 0, time);
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
      if (pulse > 0) {
        const ring = h.r + (1 - pulse) * 34;
        const grad = ctx.createRadialGradient(x, h.y, ring * 0.5, x, h.y, ring);
        grad.addColorStop(0, 'rgba(127,227,238,0)');
        grad.addColorStop(0.75, `rgba(127,227,238,${0.35 * pulse})`);
        grad.addColorStop(1, 'rgba(127,227,238,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, h.y, ring, 0, Math.PI * 2);
        ctx.fill();
      }
    });
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
    // 모션 감소에서는 경계를 재생하지 않는다
    if (boundary && !reduced && boundary.t > 0 && boundary.t < 1) drawMorph(boundary, time);
    const timeline = provider?.(dt, now);
    if (timeline) drawTimeline(timeline, time);
    start();
  };
  const start = () => {
    if (!raf && !dead && !document.hidden && (boundary || provider)) raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  // 둘 다 비면 남은 그림을 지우고 루프를 멈춘다
  const settle = () => {
    if (boundary || provider) return start();
    stop();
    clear();
  };
  const onVisibility = () => (document.hidden ? stop() : start());

  measure();
  window.addEventListener('resize', measure);
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
    setReduced(next) {
      reduced = next;
    },
    destroy() {
      dead = true;
      stop();
      boundary = provider = null;
      window.removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
