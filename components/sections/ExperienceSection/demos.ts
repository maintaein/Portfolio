// 경력 증거 카드 그리기. 시안 index.html의 DEMOS, label, rr, 색 함수, MONTH_ICONS, ICONS, GLYPHS, drawIcon,
// drawMonth(떨어짐 분기만)를 옮겼다. EvidenceCard가 import()로 늦게 받으므로 이 모듈은 브라우저에서만 돈다.
import type { EvidenceDemo } from '@/types';

export type DemoDraw = (g: CanvasRenderingContext2D, w: number, h: number, t: number, still: boolean) => void;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3);
const hash = (a: number, b: number) => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
function n2(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
}

// 글꼴은 시안의 고정 이름 대신 카드 캔버스의 계산된 font-family를 쓴다. 캔버스마다 한 번만 읽는다.
const families = new WeakMap<CanvasRenderingContext2D, string>();
function family(g: CanvasRenderingContext2D) {
  let f = families.get(g);
  if (!f) {
    f = getComputedStyle(g.canvas).fontFamily || 'system-ui, sans-serif';
    families.set(g, f);
  }
  return f;
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, Math.max(0, h), r);
}
function label(g: CanvasRenderingContext2D, s: string, x: number, y: number, size = 11, color = 'rgba(176,184,193,.85)', align: CanvasTextAlign = 'left', weight = 500) {
  g.font = `${weight} ${size}px ${family(g)}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y);
}
const CY = (a: number) => `rgba(3,179,195,${a})`, CL = (a: number) => `rgba(127,227,238,${a})`, AM = (a: number) => `rgba(242,180,76,${a})`, GR = (a: number) => `rgba(176,184,193,${a})`;

// 달 m은 .2 + .3m초에 시작해 .8초 동안 켜진다(시안 calendar의 pm)
export function monthProgress(t: number, month: number, still = false): number {
  return still ? 1 : clamp((t - 0.2 - month * 0.3) / 0.8);
}

export const DEMOS: Record<EvidenceDemo, DemoDraw> = {
  /* 체크리스트를 위에서 아래로 훑는다. 마지막 암/복호화 사용량에서 이상치를 찾고,
     오른쪽 지표(장애 발생률, 평균 복구 시간)가 줄어든다. */
  inspect(g, w, h, t, still) {
    const narrow = w < 560;
    const listW = narrow ? w : w * .58, rows = 5, top = 8, rowH = (narrow ? h * .58 : h - 16) / rows;
    const items = ['CPU', '메모리', '디스크 용량', '에러 로그', '암/복호화 사용량'];
    const values = [.23, .41, .62, 0, 0];
    const period = 7.5, cyc = still ? period - .5 : t % period;
    const scanY = top + clamp((cyc - .4) / 3.6) * rowH * rows;
    for (let i = 0; i < rows; i++) {
      const y = top + i * rowH, mid = y + rowH / 2, done = scanY > y + rowH * .55, anomaly = i === 4 && done;
      rr(g, 0, y + 3, listW, rowH - 6, 10);
      g.fillStyle = anomaly ? AM(.12) : done ? CY(.08) : 'rgba(255,255,255,.02)'; g.fill();
      g.strokeStyle = anomaly ? AM(.55) : CL(done ? .22 : .08); g.lineWidth = 1; g.stroke();
      label(g, items[i], 16, mid, 13, done ? '#f2f4f6' : GR(.7), 'left', 600);
      const gx = listW * (narrow ? .42 : .36), gw = listW * (narrow ? .28 : .4);
      if (i < 3) {
        rr(g, gx, mid - 4, gw, 8, 4); g.fillStyle = 'rgba(255,255,255,.06)'; g.fill();
        const v = values[i] * (done ? 1 : .0) + (done ? .03 * Math.sin(t * 3 + i) : 0);
        rr(g, gx, mid - 4, gw * clamp(v), 8, 4); g.fillStyle = CL(.8); g.fill();
        if (done && !narrow) label(g, `${Math.round(values[i] * 100)}%`, gx + gw + 10, mid, 11, GR(.85));
      } else if (i === 3) {
        for (let b = 0; b < 14; b++) { rr(g, gx + b * (gw / 14), mid - 6, gw / 14 - 3, 12, 2); g.fillStyle = done ? CY(.35) : 'rgba(255,255,255,.05)'; g.fill(); }
        if (done && !narrow) label(g, '0건', gx + gw + 10, mid, 11, GR(.85));
      } else {
        g.beginPath();
        for (let p = 0; p <= 40; p++) {
          const x = gx + gw * p / 40, spike = p === 31 ? 1 : p === 30 || p === 32 ? .35 : 0;
          const v = .25 + .12 * n2(p * .4, 2) + spike * .7;
          const yy = mid + 10 - v * 20 * (done ? 1 : .15);
          if (p) g.lineTo(x, yy); else g.moveTo(x, yy);
        }
        g.strokeStyle = anomaly ? AM(.95) : CL(done ? .8 : .25); g.lineWidth = 1.5; g.stroke();
        if (anomaly) {
          const px = gx + gw * 31 / 40, py = mid + 10 - .98 * 20, pul = .5 + .5 * Math.sin(t * 8);
          g.beginPath(); g.arc(px, py, 4 + 4 * pul, 0, 7); g.strokeStyle = AM(.7 - .4 * pul); g.stroke();
          g.beginPath(); g.arc(px, py, 3, 0, 7); g.fillStyle = AM(1); g.fill();
        }
      }
      const sx = listW - 14;
      if (anomaly) {
        const blink = still ? 1 : .65 + .35 * Math.sin(t * 7);
        rr(g, sx - 86, mid - 12, 86, 24, 12); g.fillStyle = AM(.25 * blink + .1); g.fill(); g.strokeStyle = AM(.9); g.stroke();
        label(g, '이상치 탐지!', sx - 43, mid, 12, AM(1), 'center', 700);
      } else if (done) {
        label(g, '✓ 정상', sx, mid, 12, CL(.95), 'right', 600);
      } else label(g, '대기', sx, mid, 12, GR(.45), 'right');
    }
    if (!still && cyc < 4.2) {
      g.fillStyle = CL(.9); g.shadowColor = CY(1); g.shadowBlur = 12; g.fillRect(0, scanY, listW, 2); g.shadowBlur = 0;
      const gr = g.createLinearGradient(0, scanY - 40, 0, scanY); gr.addColorStop(0, CY(0)); gr.addColorStop(1, CY(.14)); g.fillStyle = gr; g.fillRect(0, scanY - 40, listW, 40);
    }
    // 지표: 첫 이상치 탐지 뒤에 줄어든다
    const f = still ? 1 : easeOut3(clamp((t - 4.4) / 2.2));
    const px0 = narrow ? 0 : w * .64, py0 = narrow ? h * .62 : 8, pw = narrow ? w : w - px0, ph = narrow ? h * .38 : h - 16;
    const half = ph / 2;
    // 장애 발생률
    label(g, '장애 발생률', px0, py0 + 12, 12, GR(.9), 'left', 600);
    label(g, `${Math.round(-30 * f)}%`, px0 + pw, py0 + 14, 22, '#f2f4f6', 'right', 700);
    const bTop = py0 + 34, bH = half - 60, bw = Math.min(56, pw * .2);
    rr(g, px0, bTop, bw, bH, 6); g.fillStyle = GR(.18); g.fill();
    const aH = bH * (1 - .3 * f);
    rr(g, px0 + bw + 14, bTop + bH - aH, bw, aH, 6); g.fillStyle = CL(.8); g.fill();
    label(g, '도입 전', px0 + bw / 2, bTop + bH + 12, 11, GR(.8), 'center');
    label(g, '도입 후', px0 + bw * 1.5 + 14, bTop + bH + 12, 11, CL(.95), 'center');
    // 평균 복구 시간 20분 → 3분
    const my = py0 + half + 8;
    label(g, '장애 시 평균 복구 시간', px0, my + 12, 12, GR(.9), 'left', 600);
    label(g, `${Math.round(lerp(20, 3, f))}분`, px0 + pw, my + 14, 22, '#f2f4f6', 'right', 700);
    const ty = my + 44;
    rr(g, px0, ty, pw, 10, 5); g.fillStyle = 'rgba(255,255,255,.06)'; g.fill();
    rr(g, px0, ty, pw * lerp(1, 3 / 20, f), 10, 5); g.fillStyle = CL(.85); g.fill();
    label(g, '20분', px0, ty + 24, 11, GR(.7)); label(g, '3분', px0 + pw * 3 / 20, ty + 24, 11, CL(.95), 'center');
  },
  // 코드 줄 위를 진단선이 내려가며 취약 줄을 찾고 고친다.
  security(g, w, h, t, still) {
    const lines = 7, lh = (h - 8) / lines, period = 3.2, cyc = still ? period - .01 : t % period, scanY = cyc / period * (h + 30) - 15;
    const flag: Record<number, number> = { 2: 1, 5: 1 }, indent = [0, 1, 2, 2, 1, 2, 0];
    for (let i = 0; i < lines; i++) {
      const y = i * lh + lh / 2 + 4, passed = still || scanY > y, since = still ? 9 : (scanY - y) / (h / period);
      label(g, String(i + 1).padStart(2, '0'), 0, y, 10, 'rgba(107,118,132,.9)');
      const x = 26 + indent[i] * 18, ww = (w - x - 60) * (.3 + .5 * hash(i, 4));
      let col = GR(.22);
      if (flag[i] && passed) col = since < .9 ? AM(.75) : CL(.75);
      rr(g, x, y - 4, ww, 8, 4); g.fillStyle = col; g.fill();
      if (flag[i] && passed) label(g, since < .9 ? '취약' : '✓ 개선', w - 8, y, 12, since < .9 ? AM(1) : CL(1), 'right', 700);
    }
    if (!still) { g.fillStyle = CL(.9); g.shadowColor = CY(1); g.shadowBlur = 10; g.fillRect(0, scanY, w, 1.5); g.shadowBlur = 0; }
  },
  /* 2024년 7월 ~ 2025년 6월 달력. 달마다 배운 것의 로고가 위에서 떨어져 타일이 차례로 켜지고, 아래 막대는 켜진 달까지 그려진다. */
  calendar(g, w, h, t, still) {
    const months = ['7월', '8월', '9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월', '6월'];
    const narrow = w < 560, per = narrow ? 6 : 12, gap = narrow ? 6 : 8, cw = (w - gap * (per - 1)) / per;
    const calH = narrow ? 100 : 112, rh = narrow ? 30 : 36;
    // 막대와 누적 시간은 켜진 정도의 합을 따른다.
    const pm = (m: number) => monthProgress(t, m, still);
    let cur = 0; for (let m = 0; m < 12; m++) cur += pm(m);
    const learn: Array<[number, number, string]> = [[0, 1, 'Java · 객체지향'], [1, 2, '알고리즘'], [2, 3, 'DB · SQL · MySQL'], [3, 4, 'HTML/CSS/JS · Spring · Vue'], [11, 12, 'AI 기초 · ML/DL']];
    const proj: Array<[number, number, string]> = [[4, 6, 'Spring + Vue 프로젝트'], [6, 7.5, 'Ttabong'], [7.5, 9.5, 'ReBirth'], [9.5, 11, 'AlphaMail']];
    label(g, `누적 ${Math.round(1620 * cur / 12)}시간`, w, 6, 12, '#f2f4f6', 'right', 700);
    // 좁은 화면에서는 반년씩 두 판으로 나눠 쌓는다
    const panelH = 24 + calH + 30 + 2 * (rh + 8) + 34;
    for (let pnl = 0; pnl < 12 / per; pnl++) {
      const m0 = pnl * per, m1 = m0 + per, top = pnl * panelH, calTop = top + 24;
      const X = (mm: number) => (mm - m0) * (cw + gap);
      if (m0 === 0) label(g, '2024', 0, top + 6, 11, CL(.9), 'left', 700);
      if (m0 <= 6 && 6 < m1) label(g, '2025', X(6), top + 6, 11, CL(.9), 'left', 700);
      for (let m = m0; m < m1; m++) {
        const x = X(m), p = pm(m);
        label(g, months[m], x + cw / 2, calTop + calH + 12, 11, p > .5 ? '#f2f4f6' : GR(.6), 'center', p > .5 ? 600 : 500);
        drawMonth(g, MONTH_ICONS[m], x, calTop, cw, calH, p);
      }
      const rowsTop = calTop + calH + 30;
      // 막대 안에 들어가지 않는 이름은 ' · '에서 두 줄로 나누고, 그래도 넘치면 글자를 줄인다
      const bar = (a: number, b: number, row: number, text: string, strong = false) => {
        const a0 = Math.max(a, m0), b0 = Math.min(b, m1), end = Math.min(b0, cur); if (end <= a0) return;
        const x0 = X(a0), x1 = X(end) - (end === b0 ? gap : 0), y = rowsTop + row * (rh + 8), full = X(b0) - gap - x0;
        rr(g, x0, y, Math.max(4, x1 - x0), rh, 7);
        g.fillStyle = strong ? CY(.42) : CY(.2); g.fill(); g.strokeStyle = CL(strong ? .7 : .35); g.lineWidth = 1; g.stroke();
        const weight = strong ? 700 : 500, avail = full - 12;
        let size = 12, lines = [text];
        const fits = (ls: string[], sz: number) => { g.font = `${weight} ${sz}px ${family(g)}`; return ls.every(l => g.measureText(l).width <= avail); };
        const sep = text.includes(' · ') ? ' · ' : ' ';
        if (!fits(lines, size) && text.includes(sep)) {
          const p = text.split(sep); let best: { ls: string[]; mw: number } | null = null;
          for (let k = 1; k < p.length; k++) { const ls = [p.slice(0, k).join(sep), p.slice(k).join(sep)]; fits(ls, size); const mw = Math.max(...ls.map(l => g.measureText(l).width)); if (!best || mw < best.mw) best = { ls, mw }; }
          lines = best!.ls;
        }
        while (size > 8.5 && !fits(lines, size)) size -= .5;
        g.save(); g.beginPath(); g.rect(x0, y, Math.max(0, x1 - x0), rh); g.clip();
        const lh = size + 3, y0 = y + rh / 2 - (lines.length - 1) * lh / 2;
        lines.forEach((l, i) => label(g, l, x0 + 6, y0 + i * lh, size, strong ? '#f2f4f6' : 'rgba(220,240,244,.9)', 'left', weight));
        g.restore();
      };
      learn.forEach(([a, b, s]) => bar(a, b, 0, s));
      proj.forEach(([a, b, s]) => bar(a, b, 1, s, true));
      // 1~5월: React + TypeScript 묶음
      const ra = Math.max(6, m0), rb = Math.min(11, m1), rEnd = Math.min(rb, cur);
      if (rb > ra && rEnd > ra) {
        const y = rowsTop + 2 * (rh + 8) + 4, x0 = X(ra), x1 = X(rEnd) - (rEnd === rb ? gap : 0);
        g.strokeStyle = CL(.85); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0, y - 6); g.lineTo(x0, y); g.lineTo(x1, y); if (rEnd === rb) g.lineTo(x1, y - 6); g.stroke();
        if (rEnd - ra > 1.2) label(g, 'React + TypeScript (1월 ~ 5월)', x0 + (x1 - x0) / 2, y + 14, 12, CL(1), 'center', 700);
      }
    }
  },
  // 학습 곡선: epoch이 돌며 train/val loss가 그려지고, 값과 epoch이 함께 줄어든다. 반복.
  loss(g, w, h, t, still) {
    const x0 = 34, y0 = 26, x1 = w - 10, y1 = h - 26;
    g.strokeStyle = GR(.25); g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, y1); g.lineTo(x1, y1); g.stroke();
    for (let i = 1; i < 4; i++) { const yy = lerp(y1, y0, i / 4); g.strokeStyle = 'rgba(176,184,193,.07)'; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); }
    label(g, 'loss', 0, y0, 10, 'rgba(139,149,161,.95)'); label(g, 'epoch', x1, h - 8, 10, 'rgba(139,149,161,.95)', 'right');
    const period = 6.2, cyc = still ? 4 : t % period;
    const draw = easeInOut(clamp(cyc / 3.4)), fade = 1 - smooth(5.4, 6.2, cyc);
    const train = (u: number) => .88 * Math.exp(-u * 3.6) + .05 + .025 * (n2(u * 26, 3) - .5);
    const val = (u: number) => .9 * Math.exp(-u * 3) + .11 + .03 * (n2(u * 18, 7) - .5) + .04 * smooth(.7, 1, u);
    const curve = (fn: (u: number) => number, dash: number[], col: string, wdt: number) => {
      g.save(); g.setLineDash(dash); g.beginPath();
      let px = x0, py = y1;
      for (let u = 0; u <= draw; u += .008) { px = lerp(x0, x1, u); py = lerp(y1, y0, fn(u)); if (u) g.lineTo(px, py); else g.moveTo(px, py); }
      g.globalAlpha = fade; g.strokeStyle = col; g.lineWidth = wdt; g.stroke(); g.restore();
      return [px, py];
    };
    curve(val, [5, 5], GR(.6), 1.4);
    g.shadowColor = CY(1); g.shadowBlur = 8;
    const [px, py] = curve(train, [], CL(.95), 2);
    g.shadowBlur = 0;
    const pul = still ? 0 : Math.sin(t * 6);
    g.globalAlpha = fade; g.beginPath(); g.arc(px, py, 3.5 + pul, 0, 7); g.fillStyle = '#e8fbfd'; g.fill();
    g.beginPath(); g.arc(px, py, 9 + 3 * pul, 0, 7); g.strokeStyle = CL(.25); g.stroke(); g.globalAlpha = 1;
    label(g, `epoch ${Math.max(1, Math.round(draw * 50))}/50`, x1, y0 - 14, 12, '#f2f4f6', 'right', 700);
    label(g, `loss ${train(draw).toFixed(3)}`, x1 - 110, y0 - 14, 12, CL(.95), 'right', 600);
    label(g, 'train', x0 + 12, y0 - 14, 11, CL(.95)); label(g, 'val', x0 + 62, y0 - 14, 11, GR(.75));
  },
  // CNN: 3x3 커널이 입력 위를 미끄러지며 특징 맵을 켠다.
  cnn(g, w, h, t, still) {
    const n = 8, cs = Math.min((w * .5) / n, (h - 20) / n), ox = 0, oy = (h - cs * n) / 2;
    const glyph = ['00111100', '01100110', '01100110', '00001100', '00011000', '00110000', '01111110', '00000000'];
    const m = n - 2, steps = m * m, s = still ? steps : Math.floor(t / .14) % (steps + 6), kx = s % m, ky = Math.floor(s / m);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { rr(g, ox + x * cs + 1, oy + y * cs + 1, cs - 2, cs - 2, 3); g.fillStyle = glyph[y][x] === '1' ? CL(.7) : 'rgba(127,227,238,.06)'; g.fill(); }
    if (s < steps) { g.strokeStyle = '#e8fbfd'; g.lineWidth = 2; g.shadowColor = CY(1); g.shadowBlur = 10; g.strokeRect(ox + kx * cs, oy + ky * cs, cs * 3, cs * 3); g.shadowBlur = 0; }
    const fs = cs * .9, fx0 = w - fs * m, fy0 = (h - fs * m) / 2;
    for (let i = 0; i < steps; i++) {
      const x = i % m, y = Math.floor(i / m);
      let v = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) v += glyph[y + a][x + b] === '1' ? 1 : 0;
      const done = i < s || s >= steps;
      rr(g, fx0 + x * fs + 1, fy0 + y * fs + 1, fs - 2, fs - 2, 3); g.fillStyle = done ? CY(.1 + v / 9 * .8) : 'rgba(127,227,238,.04)'; g.fill();
    }
    label(g, '→', (ox + cs * n + fx0) / 2, h / 2, 16, CL(.8), 'center', 700);
  },
};

// 달마다 배운 것. 7월부터 0. 알고리즘과 AI는 대표 로고가 없어 트리와 신경망을 그린다.
const MONTH_ICONS = [['java'], ['algo'], ['mysql'], ['javascript', 'spring'], ['spring', 'vue'], ['spring', 'vue'],
  ['react', 'typescript'], ['react', 'typescript'], ['react', 'typescript'], ['react', 'typescript'], ['react', 'typescript'], ['nn']];
const ICONS: Record<string, HTMLImageElement> = {};
['java', 'mysql', 'javascript', 'spring', 'react', 'typescript'].forEach(n => { ICONS[n] = new Image(); ICONS[n].src = `/icons-mono/${n}.svg`; });
// icons-mono에 Vue가 없어 같은 꼴(흰 단색, 24 viewBox)로 넣는다
ICONS.vue = new Image();
ICONS.vue.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M24 1.61h-9.94L12 5.16 9.94 1.61H0l12 20.78ZM12 14.08 5.16 2.23h4.43L12 6.41l2.41-4.18h4.43Z"/></svg>');
type Glyph = { cols: boolean; layers: Array<[number, number[]]> };
const GLYPHS: Record<string, Glyph> = {
  algo: { cols: false, layers: [[-.36, [0]], [0, [-.26, .26]], [.36, [-.39, -.13, .13, .39]]] }, // 이진 트리: [y, x들]
  nn: { cols: true, layers: [[-.36, [-.22, .22]], [0, [-.36, -.12, .12, .36]], [.36, [0]]] }, // 신경망: [x, y들]
};
function drawIcon(g: CanvasRenderingContext2D, name: string, x: number, y: number, s: number, a: number) {
  g.save(); g.globalAlpha = a;
  const im = ICONS[name];
  if (im) { if (im.complete && im.naturalWidth) g.drawImage(im, x - s / 2, y - s / 2, s, s); g.restore(); return; }
  const { cols, layers } = GLYPHS[name];
  const pt = (L: [number, number[]], j: number) => cols ? [x + L[0] * s, y + L[1][j] * s] : [x + L[1][j] * s, y + L[0] * s];
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = Math.max(1, s * .06);
  for (let l = 0; l < layers.length - 1; l++) layers[l + 1][1].forEach((_, j) => {
    // 트리는 부모 하나에, 신경망은 앞 층 전부에 잇는다
    const from = cols ? layers[l][1].map((_, k) => k) : [j >> 1];
    from.forEach(k => { const [x0, y0] = pt(layers[l], k), [x1, y1] = pt(layers[l + 1], j); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); });
  });
  layers.forEach(L => L[1].forEach((_, j) => { const [px, py] = pt(L, j); g.beginPath(); g.arc(px, py, s * .08, 0, 7); g.fill(); }));
  g.restore();
}

// 달 타일 하나. p 0~1은 그 달이 켜진 정도다. 로고가 위에서 떨어져 타일에 닿아 튀고, 닿는 순간 타일이 켜진다.
function drawMonth(g: CanvasRenderingContext2D, icons: string[], x: number, y: number, w: number, h: number, p: number) {
  const icon = (a: number, dy = 0) => {
    const s = icons.length > 1 ? Math.min(w * .46, h * .32) : Math.min(w * .56, h * .46);
    icons.forEach((n, i) => drawIcon(g, n, x + w / 2, y + h / 2 + dy + (icons.length > 1 ? (i - .5) * h * .4 : 0), s, a));
  };
  const tile = (lit: number) => { rr(g, x, y, w, h, 10); g.fillStyle = CY(.05 + .2 * lit); g.fill(); g.strokeStyle = CL(.1 + .45 * lit); g.lineWidth = 1; g.stroke(); };
  const f = clamp(p / .55), b = clamp((p - .55) / .45);
  tile(smooth(.5, .7, p));
  if (p <= 0) return;
  const dy = -h * .85 * (1 - f * f) - h * .1 * Math.abs(Math.sin(b * Math.PI * 2)) * (1 - b);
  g.save(); rr(g, x, y, w, h, 10); g.clip(); icon(.3 + .7 * f, dy); g.restore();
}
