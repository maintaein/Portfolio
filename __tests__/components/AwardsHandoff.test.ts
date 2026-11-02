import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap } from '@/lib/gsap';
import type { ExperienceOverlay } from '@/components/sections/ExperienceSection/overlay';
import type { AwardsSectionHandle } from '@/components/sections/AwardAndCertificatesSection';
import { AWARD_ORBIT, CERT_ORBIT, awardAngle, certAngle, orbitPoint, toScreen } from '@/components/sections/AwardAndCertificatesSection/orbit';
import { STAR_SECONDS, type RideFrame, type StarDom } from '@/components/sections/AwardAndCertificatesSection/star';
import { createAwardsHandoff, type AwardsHandoff } from '@/components/sections/HomeClient/awardsHandoff';
import { createSkillsHandoff } from '@/components/sections/HomeClient/skillsHandoff';
import { createPortfolioMotion } from '@/components/sections/HomeClient/motion';

// motion 합치기 case만 두 넘김을 바꿔 끼운다. 나머지 case는 실제 구현을 그대로 돈다.
vi.mock('@/components/sections/HomeClient/awardsHandoff', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/sections/HomeClient/awardsHandoff')>();
  return { ...actual, createAwardsHandoff: vi.fn(actual.createAwardsHandoff) };
});
vi.mock('@/components/sections/HomeClient/skillsHandoff', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/sections/HomeClient/skillsHandoff')>();
  return { ...actual, createSkillsHandoff: vi.fn(actual.createSkillsHandoff) };
});

// jsdom에는 레이아웃이 없어 SkillsHandoff.test.ts처럼 요소마다 화면 상자를 심는다. fixed는 스크롤을 따르지 않는다.
type Box = { x: number; y: number; w: number; h: number };
let documentY = 0;
const viewport = 900;
function place(element: Element, box: Box, fixed = false) {
  element.getBoundingClientRect = () => {
    const top = box.y - (fixed ? 0 : documentY);
    return { left: box.x, top, width: box.w, height: box.h, right: box.x + box.w, bottom: top + box.h, x: box.x, y: top, toJSON: () => ({}) } as DOMRect;
  };
}

// 1440×900, nav 76: 출발 높이 76 + .25 × 824 = 282, 도착 높이 76 + .5 × 824 = 488.
// 헤드 열 가운데 x 184, React 줄 가운데 3000, Figma 줄 3504(7줄 아래). 원판 가운데 (720, 4023), 폭 275.2(320 × .86).
// sA = 4023 - 488 = 3535. sD: React 3000 - 282 = 2718, Figma min(3222, 3535 - 120) = 3222.
// Awards 섹션 3640~4406은 스크롤 2740~4406에서 화면 안이다.
const HEAD_X = 184, ROW0 = 3000, ROW7 = 3504, CX = 720, CY = 4023, DISC = 275.2;
const DEPART = 282, LAND = 488, SA = 3535, SD = 2718;
const STAGE = { scale: .86, tilt: -14 * Math.PI / 180 };
const ANGLE = .5;
let root: HTMLElement; let rows: HTMLElement[]; let disc: HTMLElement;
let wide = true;
// 오버레이, Awards 손잡이, onAway 호출을 한 줄로 적어 순서를 본다
let calls: string[] = [];
let overlay: { setRide: ReturnType<typeof vi.fn> };
let awards: { setStar: ReturnType<typeof vi.fn>; angle: () => number };
let handoff: AwardsHandoff | null = null;

beforeEach(() => {
  documentY = 0; wide = true; calls = [];
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewport });
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: media === '(min-width: 768px)' && wide, media, addEventListener() {}, removeEventListener() {} })));
  document.body.innerHTML = `<nav data-scroll-header></nav><main>
    <section id="skills"><div data-skill-map><canvas data-graph="head"></canvas>
      <nav>${Array.from({ length: 8 }, (_, i) => `<button data-skill-row aria-pressed="${i === 0}">${i}</button>`).join('')}</nav>
    </div></section>
    <section id="awards-certificates"><div class="awards-stage"><div data-orbit-center></div></div></section>
  </main>`;
  place(document.querySelector('[data-scroll-header]')!, { x: 0, y: 0, w: 1440, h: 76 }, true);
  root = document.querySelector('main')!;
  place(root.querySelector('[data-graph="head"]')!, { x: HEAD_X - 24, y: 2900, w: 48, h: 640 });
  rows = [...root.querySelectorAll<HTMLElement>('[data-skill-row]')];
  rows.forEach((row, i) => place(row, { x: 260, y: ROW0 + 72 * i - 36, w: 300, h: 72 }));
  disc = root.querySelector('[data-orbit-center]')!;
  place(disc, { x: CX - DISC / 2, y: CY - DISC / 2, w: DISC, h: DISC });
  place(root.querySelector('#awards-certificates')!, { x: 0, y: 3640, w: 1440, h: 766 });
  overlay = { setRide: vi.fn((f: RideFrame | null) => { calls.push(f === null ? 'ride null' : f.head ? 'ride head' : f.star ? 'ride star' : 'ride empty'); }) };
  awards = { setStar: vi.fn((s: 'wait' | StarDom | null) => { calls.push(`awards ${s === null ? 'null' : s === 'wait' ? 'wait' : 'dom'}`); }), angle: () => ANGLE };
});
afterEach(() => { handoff?.destroy(); handoff = null; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// 경계 모듈처럼 오버레이와 Awards 손잡이는 만든 뒤에 넘긴다
const create = ({ reduced = false, withOverlay = true, at = 2700 } = {}) => {
  documentY = at;
  handoff = createAwardsHandoff({ root, reduced, onAway: away => calls.push(`away ${away}`) });
  handoff.setAwards(awards as AwardsSectionHandle);
  if (withOverlay) handoff.setOverlay(overlay as unknown as ExperienceOverlay);
  return handoff;
};
const scrollAt = (y: number) => { documentY = y; window.dispatchEvent(new Event('scroll')); };
const advance = (seconds: number) => gsap.updateRoot(gsap.globalTimeline.time() + seconds);
// 프레임마다 나눠 민다(onUpdate가 프레임마다 온다)
const play = (seconds: number) => { for (let t = 0; t < seconds; t += .016) advance(.016); };
const frames = () => overlay.setRide.mock.calls.map(([f]) => f as RideFrame | null);
const last = () => frames().at(-1);
const stars = () => awards.setStar.mock.calls.map(([s]) => s as 'wait' | StarDom | null);
const doms = () => stars().filter((s): s is StarDom => !!s && s !== 'wait');
const away = () => calls.filter(c => c.startsWith('away'));
type Head = NonNullable<RideFrame['head']>;
const heads = () => frames().filter((f): f is RideFrame & { head: Head } => !!f?.head).map(f => f.head);

describe('Awards 넘김: 재생하지 않는 경우', () => {
  it.each([
    ['768px 아래', { wide: false, reduced: false, withOverlay: true }],
    ['모션 감소', { wide: true, reduced: true, withOverlay: true }],
    ['오버레이 없음', { wide: true, reduced: false, withOverlay: false }],
  ])('%s에서는 ride 프레임이 없고 onAway와 Awards setStar를 부르지 않는다', (_, { wide: w, reduced, withOverlay }) => {
    wide = w;
    create({ reduced, withOverlay });
    for (const y of [2722, 3000, 3300, SA + 5]) scrollAt(y);
    advance(2);
    scrollAt(2700);
    advance(1);
    expect(frames().filter(f => f !== null)).toEqual([]);
    expect(away()).toEqual([]);
    expect(awards.setStar).not.toHaveBeenCalled();
  });

  it('처음 만들 때 이미 sA를 지났으면 재생 없이 Awards는 쉬는 상태이고 onAway(true)다', () => {
    create({ at: 3600 });
    expect(away()).toEqual(['away true']);
    expect(frames().filter(f => f !== null)).toEqual([]);
    expect(stars().filter(s => s !== null)).toEqual([]);
  });

  it('nav 이동(data-navigation-target) 중에 sA를 지나면 도착 장면 없이 Awards는 쉬는 상태다', () => {
    create();
    root.setAttribute('data-navigation-target', 'awards-certificates');
    for (const y of [2722, 3000, 3300, SA + 5]) scrollAt(y);
    advance(2);
    expect(frames().some(f => f?.star)).toBe(false);
    expect(last()).toBeNull();
    expect(stars().at(-1)).toBeNull();
    expect(doms()).toEqual([]);
    expect(away()).toEqual(['away true']);
  });

  it('화면 높이를 넘게 한 번에 뛰어 sA를 지나면 프레임 없이 Awards는 쉬는 상태다', () => {
    create();
    scrollAt(3700);
    advance(2);
    expect(frames().filter(f => f !== null)).toEqual([]);
    expect(stars().filter(s => s !== null)).toEqual([]);
    expect(away()).toEqual(['away true']);
  });
});

describe('Awards 넘김: 떠 있기와 도착', () => {
  it('sD를 지나는 scroll 하나에서 onAway(true)가 첫 head 프레임보다 먼저이고, 그 head는 home 자리다', () => {
    create();
    expect(calls).toEqual([]);
    scrollAt(SD + 4);
    expect(calls.indexOf('away true')).toBeGreaterThan(-1);
    expect(calls.indexOf('away true')).toBeLessThan(calls.indexOf('ride head'));
    const head = heads()[0];
    expect(head.x).toBeCloseTo(HEAD_X, 0);
    // 헤드는 출발 높이에 머문다. 이 scroll이 sD를 넘은 만큼(4px)만 home 화면 자리와 다르다.
    expect(Math.abs(head.y - (ROW0 - (SD + 4)))).toBeLessThanOrEqual(5);
    expect(head.r).toBe(12);
    // 빈 프레임이 없다
    expect(calls).not.toContain('ride empty');
  });

  it('떠 있는 동안 Awards는 wait이고 head의 화면 y는 출발 높이에서 도착 높이 쪽으로 간다', () => {
    create();
    for (const y of [SD + 4, 3000, 3200, 3400, SA - 1]) scrollAt(y);
    expect(stars().at(-1)).toBe('wait');
    const ys = heads().map(h => h.y);
    expect(ys[0]).toBeCloseTo(DEPART, -1);
    expect(ys.every((y, i) => i === 0 || y >= ys[i - 1])).toBe(true);
    expect(ys.at(-1)!).toBeLessThanOrEqual(LAND + .5);
    expect(ys.at(-1)!).toBeGreaterThan(LAND - 2);
    // x는 원판 가운데로 간다
    expect(heads().at(-1)!.x).toBeCloseTo(CX, -1);
    expect(frames().every(f => f === null || f.head || f.star)).toBe(true);
  });

  it('sA를 지나면 STAR_SECONDS 동안 star 프레임과 setStar(dom)이 오르고, 끝에 ride null과 setStar(null)이다', () => {
    create();
    for (const y of [SD + 4, 3000, 3300, SA + 5]) scrollAt(y);
    play(.4);
    const mid = last()!;
    expect(mid.head).toBeNull();
    expect(mid.star!.center).toEqual({ x: CX, y: CY - (SA + 5) });
    const d = doms();
    expect(d.length).toBeGreaterThan(10);
    expect(d.every((s, i) => i === 0 || s.plane >= d[i - 1].plane)).toBe(true);
    expect(stars().at(-1)).not.toBeNull();
    play(STAR_SECONDS - .4 + .1);
    expect(last()).toBeNull();
    expect(stars().at(-1)).toBeNull();
    expect(calls.slice(-2)).toEqual(['ride null', 'awards null']);
    // 끝난 뒤에는 프레임이 더 오지 않는다
    const n = overlay.setRide.mock.calls.length;
    advance(1);
    expect(overlay.setRide.mock.calls.length).toBe(n);
  });

  it('Review Focus 3: 도착 장면 절반에서 되돌아가면 지금 p에서 줄고, 다시 지나면 그 p에서 는다', () => {
    create();
    for (const y of [SD + 4, 3000, 3300, SA + 5]) scrollAt(y);
    play(.6);
    const at = doms().at(-1)!.disc;
    expect(at).toBeGreaterThan(.2);
    expect(at).toBeLessThan(.9);
    scrollAt(SA - 5);
    advance(.016);
    const back1 = doms().at(-1)!.disc;
    play(.1);
    const back2 = doms().at(-1)!.disc;
    expect(back1).toBeLessThan(at);
    expect(at - back1).toBeLessThan(.05);
    expect(back2).toBeLessThan(back1);
    scrollAt(SA + 5);
    advance(.016);
    const fwd = doms().at(-1)!.disc;
    expect(Math.abs(fwd - back2)).toBeLessThan(.05);
    play(.1);
    expect(doms().at(-1)!.disc).toBeGreaterThan(fwd);
  });

  it('도착 장면이 거꾸로 0에 닿으면 원판 가운데에서 떠 있기로 돌아가고 Awards는 wait이다', () => {
    create({ at: 3600 });
    scrollAt(SA - 5);
    play(STAR_SECONDS + .1);
    const f = last()!;
    expect(f.star).toBeNull();
    expect(f.head!.x).toBeCloseTo(CX, 0);
    expect(f.head!.y).toBeCloseTo(LAND, -1);
    expect(stars().at(-1)).toBe('wait');
  });

  it('되돌아 sD 위로 가면 home 자리 head 프레임을 보내는 그 호출에서 onAway(false)이고, release 뒤 ride null이다', () => {
    create();
    for (const y of [SD + 4, 3000]) scrollAt(y);
    calls = [];
    scrollAt(2700);
    expect(calls.slice(0, 2)).toEqual(['ride head', 'away false']);
    expect(last()!.head).toEqual({ x: HEAD_X, y: ROW0 - 2700, r: 12 });
    expect(stars().at(-1)).toBeNull();
    handoff!.release();
    expect(last()).toBeNull();
  });

  it('release가 없으면 500ms 뒤 스스로 home 헤드를 내려놓는다', () => {
    create();
    for (const y of [SD + 4, 3000, 2700]) scrollAt(y);
    advance(.45);
    expect(last()!.head).not.toBeNull();
    advance(.1);
    expect(last()).toBeNull();
  });

  it('Review Focus 1: 떠 있는 동안 고른 줄을 Figma로 옮기고 되돌아가면 home이 Figma 줄이다', async () => {
    create();
    for (const y of [SD + 4, 3000, 3300]) scrollAt(y);
    rows[0].setAttribute('aria-pressed', 'false');
    rows[7].setAttribute('aria-pressed', 'true');
    await Promise.resolve();
    // Figma의 sD(3222)를 되돌아 지난다
    scrollAt(3200);
    expect(last()!.head).toEqual({ x: HEAD_X, y: ROW7 - 3200, r: 12 });
    expect(away().at(-1)).toBe('away false');
  });

  it('Review Focus 2: 도착 장면 중 원판 자리를 옮기고 resize하면 마지막 점 자리가 새 원판의 궤도 자리다', () => {
    create();
    for (const y of [SD + 4, 3000, 3300, SA + 5]) scrollAt(y);
    play(.5);
    // 지점 판정은 그대로(새 sA 3495)이고 원판만 40px씩 옮긴다
    const center = { x: CX + 40, y: CY - 40 };
    place(disc, { x: center.x - DISC / 2, y: center.y - DISC / 2, w: DISC, h: DISC });
    window.dispatchEvent(new Event('resize'));
    let star = last()!.star!;
    while (last()) {
      star = last()!.star!;
      advance(.016);
    }
    const screen = { x: center.x, y: center.y - (SA + 5) };
    expect(star.center).toEqual(screen);
    for (let i = 0; i < 3; i++) {
      const q = toScreen(screen, STAGE, orbitPoint(AWARD_ORBIT, awardAngle(ANGLE, i)));
      expect(star.fliers[i].x).toBeCloseTo(q.x, 0);
      expect(star.fliers[i].y).toBeCloseTo(q.y, 0);
    }
    const q = toScreen(screen, STAGE, orbitPoint(CERT_ORBIT, certAngle(ANGLE)));
    expect(star.fliers[3].x).toBeCloseTo(q.x, 0);
    expect(star.fliers[3].y).toBeCloseTo(q.y, 0);
  });

  it('도착 장면 중 setPaused(true)면 p가 1로 가고 트윈이 남지 않는다', () => {
    create();
    for (const y of [SD + 4, 3000, 3300, SA + 5]) scrollAt(y);
    play(.5);
    handoff!.setPaused(true);
    expect(last()).toBeNull();
    expect(stars().at(-1)).toBeNull();
    const n = overlay.setRide.mock.calls.length;
    advance(.5);
    expect(overlay.setRide.mock.calls.length).toBe(n);
  });

  it('거꾸로 도착 장면 중 문서가 숨으면 p가 0으로 가고 떠 있는 헤드와 wait이다', () => {
    create({ at: 3600 });
    scrollAt(SA - 5);
    play(.3);
    expect(last()!.star).not.toBeNull();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(last()!.star).toBeNull();
    expect(last()!.head).not.toBeNull();
    expect(stars().at(-1)).toBe('wait');
  });

  it('destroy는 넘김을 비우고 Awards를 쉬는 상태로 돌려놓는다(모션 감소로 다시 만들어도 wait에 갇히지 않는다)', () => {
    create();
    for (const y of [SD + 4, 3000]) scrollAt(y);
    handoff!.destroy();
    handoff = null;
    expect(last()).toBeNull();
    expect(stars().at(-1)).toBeNull();
    const n = overlay.setRide.mock.calls.length;
    scrollAt(3300);
    expect(overlay.setRide.mock.calls.length).toBe(n);
  });
});

// Review Focus 4: Skills 헤드의 표시는 두 넘김의 합이다. 두 넘김 모듈을 바꿔 끼우고 motion.ts의 합치기만 본다.
describe('motion: Skills 헤드 합치기', () => {
  it('Exp 넘김이 도착한 뒤에만 Awards 넘김의 떠남과 돌아옴이 진짜 setArrived에 닿는다', () => {
    const got: { arrive?: (on: boolean) => void; head?: { setArrived(on: boolean): void; reveal(): void } | null; away?: (on: boolean) => void } = {};
    const releases = { skills: vi.fn(), awards: vi.fn() };
    vi.mocked(createSkillsHandoff).mockImplementationOnce(({ onArrive }) => {
      got.arrive = onArrive;
      return { setOverlay() {}, setSkillsHead(h) { got.head = h; }, setPaused() {}, release: releases.skills, destroy() {} };
    });
    vi.mocked(createAwardsHandoff).mockImplementationOnce(({ onAway }) => {
      got.away = onAway;
      return { setOverlay() {}, setAwards() {}, setPaused() {}, release: releases.awards, destroy() {} };
    });
    document.body.innerHTML = '<nav></nav><main><button><span>K</span></button><div data-logo-host><div></div></div></main>';
    const react: boolean[] = [];
    const motion = createPortfolioMotion({
      root: document.querySelector('main')!, header: document.querySelector('nav')!, wordmark: document.querySelector('button')!,
      logoHost: document.querySelector<HTMLElement>('[data-logo-host]')!, reduced: false, onLogoOwnerChange() {}, onSkillsHeadArrive: on => react.push(on),
    });
    const real = { setArrived: vi.fn(), reveal: vi.fn() };
    motion.setSkillsHead(real);
    const shown = () => real.setArrived.mock.calls.at(-1)?.[0];
    // skillsHandoff는 손잡이와 onArrive를 함께 부른다
    got.head!.setArrived(true);
    got.arrive!(true);
    expect(shown()).toBe(true);
    got.away!(true);
    expect(shown()).toBe(false);
    expect(react.at(-1)).toBe(false);
    got.away!(false);
    expect(shown()).toBe(true);
    expect(react.at(-1)).toBe(true);
    // Exp 넘김이 거꾸로인 동안에는 Awards가 돌아와도 서지 않는다
    got.head!.setArrived(false);
    got.arrive!(false);
    got.away!(true);
    got.away!(false);
    expect(shown()).toBe(false);
    expect(react.at(-1)).toBe(false);
    // reveal은 진짜 손잡이로 간다. Skills가 헤드를 그리면 두 넘김을 다 놓는다.
    got.head!.reveal();
    expect(real.reveal).toHaveBeenCalledTimes(1);
    motion.releaseSkillsHead();
    expect(releases.skills).toHaveBeenCalledTimes(1);
    expect(releases.awards).toHaveBeenCalledTimes(1);
    motion.destroy();
  });
});
