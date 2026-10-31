import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap } from '@/lib/gsap';
import type { HandoffFrame } from '@/components/sections/ExperienceSection/handoff';
import type { ExperienceOverlay } from '@/components/sections/ExperienceSection/overlay';
import { createSkillsHandoff, type SkillsHandoff } from '@/components/sections/HomeClient/skillsHandoff';

// jsdom에는 레이아웃이 없어 HomeClientMotion.test.ts처럼 요소마다 offset과 화면 상자를 심는다.
type Box = { x: number; y: number; w: number; h: number };
let documentY = 0;
const viewport = 900;
function place(element: Element, box: Box) {
  Object.defineProperties(element, {
    offsetLeft: { configurable: true, get: () => box.x }, offsetTop: { configurable: true, get: () => box.y },
    offsetWidth: { configurable: true, get: () => box.w }, offsetHeight: { configurable: true, get: () => box.h },
    offsetParent: { configurable: true, get: () => null },
  });
  element.getBoundingClientRect = () => ({ left: box.x, top: box.y - documentY, width: box.w, height: box.h, right: box.x + box.w, bottom: box.y + box.h - documentY, x: box.x, y: box.y - documentY, toJSON: () => ({}) }) as DOMRect;
  return box;
}

// 장 둘. 축 가운데 x 64, 노드 1060·1860, 선 끝 = 1800 + 1000 - 80 = 2720.
// Skills 헤드 캔버스 가운데 x 160(1440 아래의 +96), 줄 가운데 2956(선 끝 + 236)·3028.
// 지점: 첫 줄 가운데가 화면 70%(630) 위 = 스크롤 2326 이상. 선 끝은 스크롤 1820~2720에서 화면 안이다.
const TAIL = 2720, ROW0 = 2956, ROW1 = 3028, HEAD_X = 160;
let root: HTMLElement; let line: HTMLElement; let rows: HTMLElement[];
let wide = true;
let overlay: { setHandoff: ReturnType<typeof vi.fn> };
let arrivals: boolean[] = [];
let handoff: SkillsHandoff | null = null;

beforeEach(() => {
  documentY = 0; wide = true; arrivals = [];
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewport });
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: media === '(min-width: 768px)' && wide, media, addEventListener() {}, removeEventListener() {} })));
  document.body.innerHTML = `<main>
    <section id="experience"><span data-part="experience-line" data-complete="false"></span>
      <article><div data-part="experience-axis"></div><div><h3 data-part="experience-node">A</h3></div></article>
      <article><div data-part="experience-axis"></div><div><h3 data-part="experience-node">B</h3></div></article>
    </section>
    <section id="skills"><div data-skill-map><canvas data-graph="head"></canvas>
      <nav><button data-skill-row aria-pressed="true">React</button><button data-skill-row aria-pressed="false">TypeScript</button></nav>
    </div></section>
  </main>`;
  root = document.querySelector('main')!;
  line = root.querySelector('[data-part="experience-line"]')!;
  const [a, b] = [...root.querySelectorAll('article')];
  place(a, { x: 0, y: 1000, w: 1200, h: 800 });
  place(b, { x: 0, y: 1800, w: 1200, h: 1000 });
  root.querySelectorAll('[data-part="experience-axis"]').forEach(el => place(el, { x: 40, y: 0, w: 48, h: 600 }));
  const [na, nb] = [...root.querySelectorAll('[data-part="experience-node"]')];
  place(na, { x: 120, y: 1040, w: 600, h: 40 });
  place(nb, { x: 120, y: 1840, w: 600, h: 40 });
  place(root.querySelector('[data-graph="head"]')!, { x: HEAD_X - 24, y: 2900, w: 48, h: 600 });
  rows = [...root.querySelectorAll<HTMLElement>('[data-skill-row]')];
  place(rows[0], { x: 200, y: ROW0 - 36, w: 300, h: 72 });
  place(rows[1], { x: 200, y: ROW1 - 36, w: 300, h: 72 });
  overlay = { setHandoff: vi.fn() };
});
afterEach(() => { handoff?.destroy(); handoff = null; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// 경계 모듈처럼 오버레이는 만든 뒤에 넘긴다. 그 전에는 자격이 없어 도착(true)을 한 번 알린다.
const create = ({ reduced = false, withOverlay = true, at = 2000 } = {}) => {
  documentY = at;
  handoff = createSkillsHandoff({ root, reduced, onArrive: arrived => arrivals.push(arrived) });
  if (withOverlay) handoff.setOverlay(overlay as unknown as ExperienceOverlay);
  return handoff;
};
const scrollAt = (y: number) => { documentY = y; window.dispatchEvent(new Event('scroll')); };
const advance = (seconds: number) => gsap.updateRoot(gsap.globalTimeline.time() + seconds);
const frames = () => overlay.setHandoff.mock.calls.map(([f]) => f as HandoffFrame | null);
const last = () => frames().at(-1);
// 헤드를 Skills에 넘긴 뒤의 프레임: 아무것도 그리지 않되 타임라인도 그리지 않는다
const gone = (f: HandoffFrame | null | undefined) => !!f && f.head === null && f.line === null && f.heads.length === 0;
type Drawn = HandoffFrame & { head: NonNullable<HandoffFrame['head']> };
const drawn = () => frames().filter((f): f is Drawn => !!f && f.head !== null);
// 표 길이(1.3초 상한)보다 넉넉히
const TOTAL = 1.3;

describe('Skills 넘김: 재생하지 않는 경우', () => {
  it('모션 감소면 onArrive(true)를 한 번 부르고 넘김 프레임을 보내지 않는다', () => {
    line.dataset.complete = 'true';
    create({ reduced: true });
    scrollAt(2330);
    advance(2);
    scrollAt(2000);
    advance(2);
    expect(arrivals).toEqual([true]);
    expect(frames().filter(f => f !== null)).toEqual([]);
  });

  it.each([
    ['768px 아래', { wide: false, withOverlay: true }],
    ['오버레이 없음', { wide: true, withOverlay: false }],
  ])('%s에서도 같다', (_, { wide: w, withOverlay }) => {
    wide = w;
    line.dataset.complete = 'true';
    create({ withOverlay });
    scrollAt(2330);
    advance(2);
    expect(arrivals).toEqual([true]);
    expect(frames().filter(f => f !== null)).toEqual([]);
  });

  it('Experience를 다 읽지 않았으면 70%를 지나도 재생하지 않고 도착 아님을 지킨다', () => {
    create();
    scrollAt(2330);
    advance(2);
    expect(arrivals).toEqual([true, false]);
    expect(frames().filter(f => f !== null)).toEqual([]);
  });
});

describe('Skills 넘김: 앞으로와 거꾸로', () => {
  it('처음 만들 때 이미 지점을 지났으면 재생 없이 도착한 끝 상태다', () => {
    line.dataset.complete = 'true';
    create({ at: 2400 });
    expect(arrivals).toEqual([true]);
    expect(drawn()).toEqual([]);
    expect(gone(last())).toBe(true);
  });

  it('지점을 지나면 진행하는 프레임을 보내고 total초 뒤 도착한다. p 1 프레임은 release까지 남는다', () => {
    line.dataset.complete = 'true';
    create();
    expect(arrivals).toEqual([true, false]);
    scrollAt(2330);
    advance(.016);
    // 첫 프레임: 헤드는 선 끝의 작은 점이다
    const first = drawn()[0];
    expect(first.head.x).toBeCloseTo(64, 0);
    expect(first.head.y).toBeCloseTo(TAIL - 2330, -1);
    expect(first.head.r).toBeLessThan(4);
    advance(.5);
    const mid = last()!;
    expect(mid.head!.y).toBeGreaterThan(first.head.y);
    expect(arrivals).toEqual([true, false]);
    advance(TOTAL);
    expect(arrivals).toEqual([true, false, true]);
    const end = last()!;
    expect(end.head).toEqual({ x: HEAD_X, y: ROW0 - 2330, r: 12 });
    expect(end.line).toBeNull();
    // 헤드 y는 줄지 않는다
    const ys = drawn().map(f => f.head.y);
    expect(ys.every((y, i) => i === 0 || y >= ys[i - 1] - 1e-6)).toBe(true);
    const calls = overlay.setHandoff.mock.calls.length;
    advance(.3);
    expect(overlay.setHandoff.mock.calls.length).toBe(calls);
    handoff!.release();
    expect(gone(last())).toBe(true);
    expect(arrivals).toEqual([true, false, true]);
  });

  it('release가 없으면 500ms 뒤 스스로 헤드를 내려놓는다', () => {
    line.dataset.complete = 'true';
    create();
    scrollAt(2330);
    advance(TOTAL + .1);
    expect(last()!.head!.r).toBe(12);
    advance(.45);
    expect(last()!.head!.r).toBe(12);
    advance(.1);
    expect(gone(last())).toBe(true);
  });

  it('다시 70% 아래로 가면 즉시 도착 아님이 되고 1에서 0으로 줄어드는 프레임 뒤 넘김을 비운다', () => {
    line.dataset.complete = 'true';
    create();
    scrollAt(2330);
    advance(TOTAL + .1);
    handoff!.release();
    const before = overlay.setHandoff.mock.calls.length;
    scrollAt(2300);
    expect(arrivals).toEqual([true, false, true, false]);
    // Skills가 제 헤드를 지울 틈(한 프레임 넘게)을 두고 출발한다
    advance(.01);
    expect(frames().slice(before).some(f => f?.head)).toBe(false);
    advance(.03);
    const back = frames().slice(before).filter((f): f is Drawn => !!f && f.head !== null);
    // 첫 거꾸로 프레임은 도착 자리 근처에서 출발한다
    expect(back[0].head.y).toBeGreaterThan(ROW0 - 2300 - 20);
    advance(.5);
    expect(last()!.head!.y).toBeLessThan(back[0].head.y);
    advance(TOTAL);
    expect(last()).toBeNull();
    expect(arrivals).toEqual([true, false, true, false]);
  });

  it('지점을 지날 때 선 끝이 화면 밖이면(nav 이동, 해시) 프레임 없이 바로 끝 상태다', () => {
    line.dataset.complete = 'true';
    create({ at: 1000 });
    scrollAt(2800);
    expect(arrivals).toEqual([true, false, true]);
    expect(drawn()).toEqual([]);
    expect(gone(last())).toBe(true);
    scrollAt(1000);
    expect(arrivals).toEqual([true, false, true, false]);
    expect(drawn()).toEqual([]);
    expect(last()).toBeNull();
  });

  it('재생 중 멈추면(setPaused) 바로 끝 상태다', () => {
    line.dataset.complete = 'true';
    create();
    scrollAt(2330);
    advance(.3);
    handoff!.setPaused(true);
    expect(arrivals).toEqual([true, false, true]);
    expect(gone(last())).toBe(true);
    const calls = overlay.setHandoff.mock.calls.length;
    advance(.3);
    // 트윈은 남지 않는다(프레임이 더 오지 않는다)
    expect(overlay.setHandoff.mock.calls.length).toBe(calls);
  });

  it('거꾸로 재생 중 문서가 숨으면 바로 0이다', () => {
    line.dataset.complete = 'true';
    create({ at: 2400 });
    scrollAt(2300);
    advance(.3);
    expect(drawn().length).toBeGreaterThan(0);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(last()).toBeNull();
    expect(arrivals).toEqual([true, false]);
  });

  it('Review Focus 1: 재생 중 resize로 줄 자리가 바뀌면 p 1 프레임의 헤드가 새 자리다', () => {
    line.dataset.complete = 'true';
    create();
    scrollAt(2330);
    advance(.4);
    // 지점 판정은 그대로(새 줄 가운데 586 ≤ 630)이고 도착 자리만 40px 올라간다
    place(rows[0], { x: 200, y: ROW0 - 40 - 36, w: 300, h: 72 });
    window.dispatchEvent(new Event('resize'));
    advance(TOTAL);
    expect(last()!.head).toEqual({ x: HEAD_X, y: ROW0 - 40 - 2330, r: 12 });
  });

  it('Review Focus 2: 앞으로 재생 도중 되돌아 지나면 지금 p에서 줄어들고, 다시 지나면 그 p에서 늘어난다', () => {
    line.dataset.complete = 'true';
    create();
    scrollAt(2330);
    advance(.5);
    const at = last()!.head!;
    // 스크롤만 바뀌어도 화면 좌표는 30px 움직인다. 진행도가 튀지 않았는지는 같은 스크롤에서 비교한다.
    scrollAt(2310);
    advance(.016);
    const back1 = last()!.head!;
    advance(.1);
    const back2 = last()!.head!;
    expect(back2.y).toBeLessThan(back1.y);
    expect(Math.abs(back1.y - (at.y + 20))).toBeLessThan(15);
    expect(Math.abs(back1.r - at.r)).toBeLessThan(.5);
    scrollAt(2330);
    advance(.016);
    const fwd = last()!.head!;
    expect(Math.abs(fwd.y - (back2.y - 20))).toBeLessThan(15);
    advance(.1);
    expect(last()!.head!.y).toBeGreaterThan(fwd.y);
  });

  it('Review Focus 3: 재생 중 고른 줄(aria-pressed)이 바뀌면 p 1 프레임의 헤드가 새 줄이다', () => {
    line.dataset.complete = 'true';
    create();
    scrollAt(2330);
    advance(.4);
    rows[0].setAttribute('aria-pressed', 'false');
    rows[1].setAttribute('aria-pressed', 'true');
    advance(TOTAL);
    expect(last()!.head).toEqual({ x: HEAD_X, y: ROW1 - 2330, r: 12 });
  });

  it('destroy는 넘김을 비우고 더 판정하지 않는다', () => {
    line.dataset.complete = 'true';
    create();
    scrollAt(2330);
    advance(.3);
    handoff!.destroy();
    handoff = null;
    expect(last()).toBeNull();
    const calls = overlay.setHandoff.mock.calls.length;
    scrollAt(2000);
    advance(1);
    expect(overlay.setHandoff.mock.calls.length).toBe(calls);
  });
});
