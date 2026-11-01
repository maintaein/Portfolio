import gsap from 'gsap';
import { createHeadLayer } from './headLayer';

// Skills 그래프 모션. 승인 시안(.claude/designRefactoring2/skills-prototype)의 재출발 값 V와 상태 흐름, 수치를 옮겼다.
// 전환은 A(겹치는 프로젝트는 남기고 재배선)뿐이다. 시간은 이 그래프의 가상 시계라 멈춘 동안 흐르지 않는다.

const GAP = 140;
// 감쇠 스프링의 정규화 꼴. t=0에서 1, 오버슈트하며 0으로 수렴한다.
const shape = (t: number, z: number, w: number) => {
  const wd = w * Math.sqrt(1 - z * z);
  return Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
};
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
const easeInOut = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, t: number) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };

type Tween = { k: 's'; to: number; t0: number; w: number; z: number; from?: number }
  | { k: 'e'; to: number; t0: number; dur: number; f: (t: number) => number; from?: number };

// 값 하나. 새 목표가 오면 지금 값에서 다시 출발하므로 연타해도 튀지 않는다.
class V {
  v: number; to: number; tw: Tween | null = null;
  constructor(v: number, private now: () => number) { this.v = this.to = v; }
  // ζ .7은 약 5% 지나쳤다 돌아온다. 시안의 .5(16%)는 너무 튄다는 사용자 판단(2026-10-31).
  spring(to: number, delay = 0, w = 9.4, z = .7) { this.tw = { k: 's', to, t0: this.now() + delay, w, z }; this.to = to; }
  ease(to: number, dur: number, delay = 0, f = easeOut) { this.tw = { k: 'e', to, t0: this.now() + delay, dur, f }; this.to = to; }
  set(v: number) { this.v = this.to = v; this.tw = null; }
  tick() {
    const tw = this.tw; if (!tw) return;
    const t = (this.now() - tw.t0) / 1000; if (t < 0) return;
    if (tw.from === undefined) tw.from = this.v;
    if (tw.k === 's') {
      if (t > 4 / (tw.z * tw.w) + .3) { this.v = tw.to; this.tw = null; return; }
      this.v = tw.to + (tw.from - tw.to) * shape(t, tw.z, tw.w);
    } else {
      const p = Math.min(1, t * 1000 / tw.dur);
      this.v = tw.from + (tw.to - tw.from) * tw.f(p); if (p >= 1) this.tw = null;
    }
  }
}

// 끝점을 시작점에서 목표 쪽으로 s만큼 민다. s가 1을 넘으면 선이 목표를 지나쳤다가 돌아온다.
function curve(x0: number, y0: number, x1: number, y1: number, s: number, k = .45) {
  const ex = x0 + (x1 - x0) * s, ey = y0 + (y1 - y0) * s;
  return `M${x0} ${y0} C ${x0 + (ex - x0) * k} ${y0}, ${ex - (ex - x0) * (1 - k)} ${ey}, ${ex} ${ey}`;
}

// 무대 기준 위치. transform은 빼고 레이아웃 자리만 잰다.
function offset(el: HTMLElement, stage: HTMLElement) {
  let x = 0, y = 0;
  for (let e: HTMLElement | null = el; e && e !== stage; e = e.offsetParent as HTMLElement | null) {
    x += e.offsetLeft - (e === el ? 0 : e.scrollLeft);
    y += e.offsetTop - (e === el ? 0 : e.scrollTop);
  }
  return { x, y };
}

type State = 'in' | 'out' | 'gone';
interface Node {
  el: HTMLElement; link: HTMLElement; thumb: HTMLElement; edge: HTMLElement; dot: HTMLElement; parts: HTMLElement[];
  hubP: SVGPathElement; descP: SVGPathElement; pulseP: SVGPathElement;
  y: V; hubS: V; reveal: V; descS: V; text: V;
  state: State; enterAt: number | null; enterY: number; flashAt: number; pulseAt: number;
}

export interface SkillGraph {
  // React가 노드를 붙이거나 뗀 뒤 DOM을 다시 읽는다.
  sync(): void;
  // 고른 줄, 그 기술의 프로젝트 제목 순서, 허브 아이콘 경로. 같은 줄이면 아무것도 하지 않는다.
  select(row: number, order: string[], icon: string): void;
  // Skills에 처음 들어왔다. 헤드→허브 선부터 자란다.
  start(): void;
  // 들어와 보이는 동안만 돈다. 멈추면 그 자리에서 기다렸다 이어 간다.
  setRunning(on: boolean): void;
  // 모션 감소: 모든 값을 최종 상태에 놓고 돌지 않는다.
  setReduced(on: boolean): void;
  // Experience에서 넘어온 헤드가 도착했는지. 도착 전에는 헤드를 그리지 않고, 풀리면 헤드→허브 선을 허브 쪽으로 걷는다.
  setArrived(on: boolean): void;
  destroy(): void;
}

export function createSkillGraph(stage: HTMLElement, options: { reduced: boolean; onGone: (title: string) => void; onHeadShown?: () => void }): SkillGraph {
  let vt = 0;
  const now = () => vt;
  const q = <T extends Element>(sel: string, root: ParentNode = stage) => root.querySelector<T>(sel)!;
  const head = q<HTMLCanvasElement>('[data-graph="head"]');
  const layer = createHeadLayer(head);
  const link = q<SVGPathElement>('[data-graph="link"]');
  const hub = q<HTMLElement>('[data-graph="hub"]');
  const iconA = q<HTMLElement>('[data-graph="icon-a"]'), iconB = q<HTMLElement>('[data-graph="icon-b"]');
  const turb = q<SVGElement>('[data-graph="turb"]'), disp = q<SVGElement>('[data-graph="disp"]');
  const zap = turb.closest('filter')!.id;
  const headY = new V(0, now), linkS = new V(0, now), hubA = new V(0, now);
  const nodes = new Map<string, Node>();
  let reduced = options.reduced, running = false, started = false, hubShown = false, dirty = true;
  // arrived: 헤드가 와 있다. shown: 이번 도착 뒤 헤드를 그렸다. retract: 선을 허브 쪽 끝에서 그린다(걷히는 중).
  // tailY는 줄을 옮길 때 헤드를 쫓는 꼬리 끝(임계 감쇠라 헤드를 지나치지 않는다). ringAt은 다시 도착한 시각(고리 펄스).
  let arrived = true, shown = false, retract = false, tailY = 0, tailV = 0, ringAt = -1e9;
  let row = -1, order: string[] = [], pending: string[] = [], icon = '';
  // 허브 아이콘 모프(시안의 #zap). 번개처럼 일그러졌다 새 아이콘으로 맺힌다. t는 0~1.
  let morph: { to: string; t0: number; t: number } | null = null;
  const setIcon = (el: HTMLElement, src: string) => el.style.setProperty('--skill-icon-src', `url(${src})`);
  const morphIcon = (src: string) => {
    if (morph && morph.t > .5) setIcon(iconA, morph.to);
    iconA.style.opacity = '1'; setIcon(iconB, src); morph = { to: src, t0: now(), t: 0 };
  };
  // 모프 없이 바로 선다(첫 진입 전, 모션 감소, 모프 끝).
  const restIcon = (src: string) => {
    morph = null;
    setIcon(iconA, src); iconA.style.opacity = '1'; iconB.style.opacity = '0'; hub.style.filter = '';
  };
  let geo = { headX: 0, hubX: 0, hubY: 0, tx: 0, tw: 0, dot: 0, rows: [] as number[] };

  const slot = (k: number, n: number) => geo.hubY + (k - (n - 1) / 2) * GAP;
  const measure = () => {
    const first = nodes.values().next().value;
    const hubAt = offset(hub, stage);
    const thumb = first ? offset(first.thumb, stage).x : 0;
    geo = {
      headX: offset(head, stage).x + head.offsetWidth / 2,
      hubX: hubAt.x + hub.offsetWidth / 2,
      hubY: hubAt.y + hub.offsetHeight / 2,
      tx: thumb,
      tw: first?.thumb.offsetWidth ?? 0,
      dot: first ? offset(first.dot, stage).x + first.dot.offsetWidth / 2 : 0,
      rows: [...stage.querySelectorAll<HTMLElement>('[data-skill-row]')].map(b => offset(b, stage).y + b.offsetHeight / 2),
    };
    dirty = true;
  };

  // 회수가 끝났다. 예약된 진입(회수 도중 다시 고른 노드)은 지우지 않는다. 시안처럼 그 시각에 다시 자란다.
  const gone = (title: string, n: Node) => { n.state = 'gone'; options.onGone(title); };
  const exit = (n: Node, d: number) => {
    n.state = 'out';
    n.text.ease(0, 120, d, easeInOut);
    n.descS.ease(0, 180, d + 60, easeInOut);
    n.reveal.ease(0, 180, d + 140, easeInOut);
    n.hubS.ease(0, 200, d + 220, easeInOut);
  };
  const enter = (n: Node, d: number, y: number) => { n.enterAt = now() + d; n.enterY = y; };
  // 헤드를 바로 놓는다. 꼬리도 같은 자리라 잔상이 없다.
  const placeHead = (y: number) => { headY.set(y); tailY = y; tailV = 0; };
  const showHead = (time: number) => {
    layer?.draw(geo.headX, headY.v, tailY, time, clamp(1 - (now() - ringAt) / 700));
    // 캔버스가 없어도 부른다. 받는 쪽(넘김 오버레이)이 헤드를 잡아 둔 채 기다리지 않게 한다.
    if (!shown) { shown = true; options.onHeadShown?.(); }
  };

  // 모션 감소와 감소로 바뀌는 순간: 고른 노드는 다 자란 자리, 나머지는 사라진다.
  const settle = () => {
    started = hubShown = true; retract = false;
    placeHead(geo.rows[row] ?? 0); linkS.set(arrived ? 1 : 0); hubA.set(1);
    restIcon(icon);
    nodes.forEach((n, title) => {
      const k = order.indexOf(title);
      if (k < 0) { n.enterAt = null; gone(title, n); return; }
      n.state = 'in'; n.enterAt = null; n.flashAt = n.pulseAt = -1e9;
      n.y.set(slot(k, order.length));
      [n.hubS, n.reveal, n.descS, n.text].forEach(v => v.set(1));
    });
    dirty = true;
    draw();
    if (arrived) showHead(0);
  };

  const tick = () => {
    let busy = false;
    // 이번 프레임에 트윈이 있었으면(끝나는 프레임 포함) 그린다.
    for (const v of [headY, linkS, hubA]) { busy ||= !!v.tw; v.tick(); }
    // 걷혔으면(0에 닿으면) 그때 헤드 쪽에서 다시 뻗는다. 걷히는 도중에 기준점을 바꾸면 선이 한 프레임에 반대쪽 끝으로 건너뛴다.
    if (arrived && started && linkS.to === 0 && !linkS.tw) { retract = false; linkS.spring(1, 0, 9.4); }
    if (linkS.v >= .98 && !hubShown) {
      hubShown = true; hubA.ease(1, 240);
      pending.forEach((title, k) => { const n = nodes.get(title); if (n) enter(n, 120 + k * 70, slot(k, pending.length)); });
    }
    nodes.forEach((n, title) => {
      if (n.enterAt !== null && now() >= n.enterAt) {
        if (n.state === 'gone') n.y.set(n.enterY); else n.y.spring(n.enterY, 0, 9, .8);
        n.state = 'in'; n.enterAt = null; n.hubS.spring(1, 0, 9.4);
      }
      for (const v of [n.y, n.hubS, n.reveal, n.descS, n.text]) { busy ||= !!v.tw; v.tick(); }
      if (n.state === 'in') {
        // 선이 썸네일 변에 닿기 직전부터 노드가 그 변에서 번져 나오고, 펼쳐지는 도중 다음 선이 뻗는다.
        if (n.hubS.v >= .94 && n.reveal.to !== 1) { n.reveal.ease(1, 420); n.flashAt = now(); }
        if (n.reveal.v >= .7 && n.descS.to !== 1) n.descS.spring(1, 0, 12);
        if (n.descS.v >= .98 && n.text.to !== 1) n.text.ease(1, 320);
      } else if (n.state === 'out' && n.hubS.to === 0 && !n.hubS.tw) gone(title, n);
      busy ||= n.enterAt !== null || now() - n.flashAt < 1500 || now() - n.pulseAt < 760;
    });
    if (morph) {
      const t = morph.t = (now() - morph.t0) / 700, w = Math.sin(Math.PI * clamp(t));
      if (t >= 1) restIcon(morph.to);
      else {
        turb.setAttribute('seed', String(Math.floor(now() / 45) % 97));
        disp.setAttribute('scale', (w * 26).toFixed(1));
        iconA.style.opacity = String(1 - smooth(.35, .6, t)); iconB.style.opacity = String(smooth(.35, .6, t));
        hub.style.filter = `url(#${zap}) drop-shadow(0 0 ${14 + 22 * w}px rgba(127,227,238,${.55 + .4 * w}))`;
      }
      busy = true;
    }
    return busy;
  };

  const draw = () => {
    if (!dirty) return;
    dirty = false;
    const hx = geo.headX + 12, ax = geo.hubX - 44;
    link.setAttribute('d', linkS.v <= .001 ? '' : retract ? curve(ax, geo.hubY, hx, headY.v, linkS.v, .5) : curve(hx, headY.v, ax, geo.hubY, linkS.v, .5));
    hub.style.opacity = String(hubA.v);
    hub.style.transform = `scale(${.9 + .1 * hubA.v})`;
    nodes.forEach(n => {
      const y = n.y.v, r = clamp(n.reveal.v), tx = clamp(n.text.v), flash = Math.exp(-(now() - n.flashAt) / 260);
      n.link.style.transform = `translate3d(0, ${y}px, 0)`;
      // 경계가 40% 폭으로 번지는 닦아내기. 빛이 먼저 닿은 쪽이 밝았다가 원래 색으로 가라앉는다. 다 펼치면 마스크를 뗀다.
      n.thumb.style.maskImage = r >= 1 ? 'none' : `linear-gradient(90deg, #000 ${r * 140 - 40}%, transparent ${r * 140}%)`;
      n.thumb.style.filter = r >= 1 ? '' : `brightness(${1 + .8 * (1 - r)})`;
      n.edge.style.opacity = String(clamp(r * 4));
      n.edge.style.boxShadow = `-6px 0 ${18 + 26 * flash}px ${-10 + 8 * flash}px #7fe3ee`;
      n.dot.style.opacity = String(clamp(tx * 3));
      n.dot.style.transform = `scale(${.6 + .4 * easeOut(tx)})`;
      n.parts.forEach((el, i) => { const a = clamp(tx * 1.4 - i * .18); el.style.opacity = String(a); el.style.transform = `translateX(${(1 - a) * 8}px)`; });
      n.hubP.setAttribute('d', n.hubS.v > .001 ? curve(geo.hubX + 42, geo.hubY, geo.tx, y, n.hubS.v) : '');
      n.descP.setAttribute('d', n.descS.v > .001 ? `M${geo.tx + geo.tw} ${y} H${geo.tx + geo.tw + (geo.dot - geo.tx - geo.tw) * n.descS.v}` : '');
      // 남은 프로젝트: 새 아이콘에서 빛 한 점이 선을 타고 설명까지 흐른다. "이 기술로도 만들었다"는 표시.
      const pt = (now() - n.pulseAt) / 700;
      if (pt > 0 && pt < 1 && n.state === 'in') {
        n.pulseP.setAttribute('d', `${curve(geo.hubX + 42, geo.hubY, geo.tx, y, 1)} M${geo.tx + geo.tw} ${y} H${geo.dot}`);
        n.pulseP.style.strokeDasharray = '0.08 2';
        n.pulseP.style.strokeDashoffset = String(.08 - easeInOut(pt) * 1.08);
        n.pulseP.style.opacity = '1';
      } else n.pulseP.style.opacity = '0';
    });
  };

  // 시간은 실제대로 흘린다. 배경 때문에 프레임이 67~200ms인 기기에서 50ms 상한은 모션을 2~3배 늘였다(실측).
  // 500ms 넘는 멈춤은 gsap lagSmoothing이 먼저 33ms로 줄이고, 250~500ms 프레임만 여기서 끊는다. 아무것도 움직이지 않으면 스타일을 쓰지 않는다.
  const frame = (_time: number, deltaTime: number) => {
    const dt = Math.min(250, deltaTime);
    vt += dt;
    if (tick()) dirty = true;
    // 꼬리 끝은 헤드를 ω 13.6, ζ 1로 쫓는다. 프레임을 네 번 나눠 적분하고, 수치 오차로 헤드를 넘으면 헤드에 붙인다.
    const w = 13.6, h = dt / 4000;
    for (let i = 0; i < 4; i++) {
      const gap = headY.v - tailY;
      tailV += (w * w * gap - 2 * w * tailV) * h;
      tailY += tailV * h;
      if ((headY.v - tailY) * gap <= 0) { tailY = headY.v; tailV = 0; }
    }
    draw();
    // 와 있는 동안은 매 프레임 그린다(일렁임).
    if (arrived) showHead(vt / 1000);
  };

  const sync = () => {
    const seen = new Set<string>();
    stage.querySelectorAll<HTMLElement>('[data-project-node]').forEach(el => {
      const title = el.dataset.projectNode!;
      seen.add(title);
      const old = nodes.get(title);
      if (old?.el === el) return;
      const values = old ?? { y: new V(geo.hubY, now), hubS: new V(0, now), reveal: new V(0, now), descS: new V(0, now), text: new V(0, now),
        state: 'gone' as State, enterAt: null, enterY: 0, flashAt: -1e9, pulseAt: -1e9 };
      nodes.set(title, {
        ...values, el,
        link: q('a', el), thumb: q('[data-part="thumb"]', el), edge: q('[data-part="edge"]', el), dot: q('[data-part="dot"]', el),
        parts: [...el.querySelectorAll<HTMLElement>('[data-part="text"] > *')],
        hubP: q('[data-line="hub"]', el), descP: q('[data-line="desc"]', el), pulseP: q('[data-line="pulse"]', el),
      });
    });
    for (const title of [...nodes.keys()]) if (!seen.has(title)) nodes.delete(title);
    dirty = true;
  };

  const select = (nextRow: number, nextOrder: string[], nextIcon: string) => {
    if (nextRow === row) return;
    row = nextRow; order = nextOrder; icon = nextIcon;
    measure();
    if (reduced) { settle(); return; }
    nodes.forEach(n => (n.enterAt = null));
    // 탄성 없이 320ms ease-in-out으로 새 줄에 간다. 꼬리 끝은 frame에서 쫓는다.
    if (!started) placeHead(geo.rows[row] ?? 0);
    else headY.ease(geo.rows[row] ?? 0, 320, 0, easeInOut);
    if (!started || !hubShown) { pending = order; restIcon(icon); }
    else {
      morphIcon(icon);
      let idx = 0;
      nodes.forEach((n, title) => {
        const k = order.indexOf(title), live = n.state === 'in';
        if (k < 0) { if (live) exit(n, 0); return; }
        if (live) { n.y.spring(slot(k, order.length), 0, 9, .8); n.pulseAt = now() + 260; }
        else enter(n, 260 + idx++ * 70, slot(k, order.length));
      });
    }
    // 아직 자라지 않은 채 빠지는 노드는 거둘 것이 없다.
    nodes.forEach((n, title) => { if (n.state === 'gone' && n.enterAt === null && !order.includes(title)) gone(title, n); });
    dirty = true;
    draw();
  };

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    measure();
    layer?.resize();
    if (reduced) settle();
    else {
      // 자리를 다시 잡는다. 탄성 없이 새 슬롯으로 옮긴다.
      nodes.forEach((n, title) => { const k = order.indexOf(title); if (k >= 0 && !n.y.tw) n.y.set(slot(k, order.length)); });
      if (!headY.tw) placeHead(geo.rows[row] ?? 0);
      draw();
    }
  });
  observer?.observe(stage);

  return {
    sync,
    select,
    start() {
      if (started || reduced) return;
      started = true;
      pending = order;
      linkS.spring(1, 0, 9.4);
    },
    setRunning(on) {
      on &&= !reduced;
      if (on === running) return;
      running = on;
      if (on) gsap.ticker.add(frame); else gsap.ticker.remove(frame);
    },
    setReduced(on) {
      reduced = on;
      if (!on) return;
      running = false;
      gsap.ticker.remove(frame);
      measure();
      settle();
    },
    setArrived(on) {
      if (on === arrived) return;
      arrived = on;
      if (!on) {
        shown = false;
        layer?.clear();
        if (!started) return;
        // 빈 자리에 매달리지 않게 허브 쪽으로 걷는다. 허브와 노드는 그대로 둔다.
        // 다 뻗어 쉬는 선만 기준점을 허브로 바꾼다(그때는 같은 곡선이다). 아직 뻗는 중이면 헤드 쪽으로 거둬 건너뛰지 않게 한다.
        retract ||= !linkS.tw;
        if (reduced) linkS.set(0); else linkS.ease(0, 200, 0, easeInOut);
        dirty = true;
        draw();
        return;
      }
      if (reduced) { settle(); return; }
      // 선은 tick이 걷힌 뒤 다시 뻗는다. 노드 등장은 다시 하지 않는다.
      ringAt = now();
    },
    destroy() {
      gsap.ticker.remove(frame);
      running = false;
      observer?.disconnect();
    },
  };
}
