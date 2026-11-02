import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap } from '@/lib/gsap';
import type { ExperienceOverlay } from '@/components/sections/ExperienceSection/overlay';
import type { AwardsSectionHandle } from '@/components/sections/AwardAndCertificatesSection';
import { AWARD_ORBIT, CERT_ORBIT, awardAngle, certAngle, orbitPoint, toScreen } from '@/components/sections/AwardAndCertificatesSection/orbit';
import { STAR_SECONDS, rideHead, type RideFrame, type StarDom } from '@/components/sections/AwardAndCertificatesSection/star';
import type { HandoffFrame } from '@/components/sections/ExperienceSection/handoff';
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

// 1440×900, nav 76: 출발 높이 76 + .15 × 824 = 199.6(Ruling 7), 도착 높이 76 + .5 × 824 = 488.
// 헤드 열 가운데 x 184, React 줄 가운데 3000, Figma 줄 3504(7줄 아래). 원판 가운데 (720, 4023), 폭 275.2(320 × .86).
// sA = 4023 - 488 = 3535. sD: React 3000 - 199.6 = 2800.4, Figma min(3304.4, 3535 - 120) = 3304.4.
// Awards 섹션 3640~4406은 스크롤 2740~4406에서 화면 안이다.
const HEAD_X = 184, ROW0 = 3000, ROW7 = 3504, CX = 720, CY = 4023, DISC = 275.2;
const DEPART = 199.6, LAND = 488, SA = 3535, SD = 2800.4;
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

  // Ruling 8: nav 중에는 떠 있지 않고 목적지 쪽 끝에 바로 놓는다. 표시가 걷힌 뒤 첫 scroll은 헤드를 뛰게 하지 않는다.
  it('nav로 Awards에 가는 동안 떠 있지 않고 도착 상태로 놓이며, 표시가 걷힌 뒤 작은 scroll에도 그대로이고 그 뒤 거꾸로는 재생한다', async () => {
    create();
    root.setAttribute('data-navigation-target', 'awards-certificates');
    await Promise.resolve();
    expect(away()).toEqual(['away true']);
    for (const y of [2900, 3100, 3300, 3500, SA + 100]) scrollAt(y);
    advance(2);
    expect(frames().filter(f => f !== null)).toEqual([]);
    expect(stars().filter(s => s !== null)).toEqual([]);
    root.removeAttribute('data-navigation-target');
    await Promise.resolve();
    scrollAt(SA + 108);
    advance(1);
    expect(frames().filter(f => f !== null)).toEqual([]);
    expect(stars().filter(s => s !== null)).toEqual([]);
    expect(away()).toEqual(['away true']);
    // 손으로 되돌아 지나면 평소대로 거꾸로 재생한다
    scrollAt(SA + 60);
    scrollAt(SA - 5);
    advance(.3);
    expect(frames().some(f => f?.star)).toBe(true);
  });

  it('nav로 Awards에서 다른 섹션에 가는 동안 떠 있지 않고 home에 놓이며, 표시가 걷힌 뒤 작은 scroll에도 그대로이고 그 뒤 출발은 평소대로다', async () => {
    create({ at: 3600 });
    expect(away()).toEqual(['away true']);
    root.setAttribute('data-navigation-target', 'skills');
    await Promise.resolve();
    expect(away()).toEqual(['away true', 'away false']);
    for (const y of [3400, 3200, 3000, 2800, 2600]) scrollAt(y);
    expect(frames().filter(f => f !== null)).toEqual([]);
    expect(stars().filter(s => s !== null)).toEqual([]);
    root.removeAttribute('data-navigation-target');
    await Promise.resolve();
    scrollAt(2608);
    expect(frames().filter(f => f !== null)).toEqual([]);
    expect(away()).toEqual(['away true', 'away false']);
    // 손으로 sD를 지나면 평소대로 home 자리에서 떠난다
    for (const y of [2700, 2790, SD + 4]) scrollAt(y);
    expect(away().at(-1)).toBe('away true');
    expect(heads()[0].x).toBeCloseTo(HEAD_X, 0);
    expect(stars().at(-1)).toBe('wait');
  });

  it('nav 표시가 떠 있는 도중에 서면 떠 있는 헤드를 거두고 목적지 쪽 끝에 놓는다', async () => {
    create();
    for (const y of [SD + 4, 3000]) scrollAt(y);
    expect(last()!.head).not.toBeNull();
    root.setAttribute('data-navigation-target', 'about');
    await Promise.resolve();
    expect(last()).toBeNull();
    expect(stars().at(-1)).toBeNull();
    expect(away().at(-1)).toBe('away false');
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
    for (const y of [SD + 4, 3000, 3350]) scrollAt(y);
    rows[0].setAttribute('aria-pressed', 'false');
    rows[7].setAttribute('aria-pressed', 'true');
    await Promise.resolve();
    // Figma의 sD(3304.4)를 되돌아 지난다
    scrollAt(3290);
    expect(last()!.head).toEqual({ x: HEAD_X, y: ROW7 - 3290, r: 12 });
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

  // Trail.ghosts(문서, 먼 것부터)를 starPose의 scattered(화면, 가까운 것부터)로 바꾸는 순서를 잠근다(리뷰 M2)
  it('흩어지는 점 0은 도착 순간 헤드에 가장 가까운 잔상에서, 점 1은 그다음 잔상에서 출발한다', () => {
    create();
    // 시간 없이 크게 내려가 꼬리가 길게 남는다
    for (const y of [SD + 4, 3000, 3200, 3400, SA - 1]) scrollAt(y);
    scrollAt(SA + 5);
    const ride = frames().filter((f): f is RideFrame => !!f?.head).at(-1)!;
    expect(ride.ghosts.length).toBeGreaterThanOrEqual(3);
    const near = ride.ghosts.at(-1)!, next = ride.ghosts.at(-2)!, far = ride.ghosts[0];
    expect(Math.hypot(near.x - far.x, near.y - far.y)).toBeGreaterThan(20);
    advance(.016);
    const star = last()!.star!;
    expect(star.fliers[0].x).toBeCloseTo(near.x, 0);
    expect(star.fliers[0].y).toBeCloseTo(near.y, 0);
    expect(star.fliers[1].x).toBeCloseTo(next.x, 0);
    expect(star.fliers[1].y).toBeCloseTo(next.y, 0);
  });

  // Ruling 13(최종 리뷰 I1): 거꾸로 재생 동안 계속 올라가도 끝에서 헤드가 원판 가운데에서 스크롤 자리로 순간 이동하지 않는다.
  it('거꾸로 도착 장면 동안 프레임마다 5px씩 계속 올라가도 헤드는 원판 가운데에서 0.35초에 걸쳐 떠 있는 자리로 옮겨 가고 그 뒤 rideHead와 같다', () => {
    const G = { home: { x: HEAD_X, y: ROW0 }, center: { x: CX, y: CY }, departY: DEPART, landY: LAND };
    const step = 5, BLEND = .35;
    create({ at: SA + 100 });
    scrollAt(SA + 60);
    let y = SA - 5;
    scrollAt(y);
    // 프레임마다의 화면 자리: 항성 프레임은 orb 가운데, 헤드 프레임은 헤드. 그 프레임의 원판 가운데와 rideHead 사이 거리도 적는다.
    const seq: { x: number; y: number; head: boolean; gap: number }[] = [];
    let blendFrames = 0;
    for (let i = 0; i < 200; i++) {
      y -= step;
      scrollAt(y);
      advance(.016);
      const f = last()!;
      const at = rideHead(G, y), gap = Math.hypot(at.x - CX, at.y - CY);
      if (f.star) seq.push({ x: f.star.center.x, y: f.star.center.y, head: false, gap });
      else if (f.head) {
        seq.push({ x: f.head.x, y: f.head.y, head: true, gap });
        if (seq.filter(q => q.head).length * .016 > BLEND + .1) break;
        blendFrames++;
      }
    }
    const first = seq.findIndex(q => q.head);
    expect(first).toBeGreaterThan(10);
    // 항성에서 헤드로 바뀌는 프레임은 원판 가운데에서 이어진다(스크롤 한 칸 안)
    expect(Math.hypot(seq[first].x - seq[first - 1].x, seq[first].y - seq[first - 1].y)).toBeLessThanOrEqual(step + 1);
    // 섞는 동안 한 프레임의 이동은 스크롤 두 칸(원판 가운데와 rideHead가 각자 스크롤을 따라 움직인 몫)과
    // 섞기 한 걸음(ease-in-out 기울기 최대 3 × 16ms / 0.35초 × 둘 사이 거리)을 넘지 않는다
    for (let k = first + 1; k < seq.length; k++) {
      const d = Math.hypot(seq[k].x - seq[k - 1].x, seq[k].y - seq[k - 1].y);
      expect(d).toBeLessThanOrEqual(2 * step + 3 * .016 / BLEND * seq[k - 1].gap + 1);
    }
    expect(blendFrames).toBeGreaterThan(15);
    // 섞기가 끝나면 rideHead 그대로다
    const end = last()!.head!, at = rideHead(G, y);
    expect(end.x).toBeCloseTo(at.x, 1);
    expect(end.y).toBeCloseTo(at.y - y, 1);
    // 잔상이 원판 쪽에서 헤드를 쫓는다
    expect(last()!.ghosts.length).toBeGreaterThan(0);
  });

  // Ruling 14(최종 리뷰 I2): 도착 장면이 쉬다가 출발할 때마다 Awards의 지금 각도를 붙잡는다. 첫 점은 DOM 카드 자리에서 나온다.
  const cardAt = (angle: number, i: number, y: number) => toScreen({ x: CX, y: CY - y }, STAGE, orbitPoint(i === 3 ? CERT_ORBIT : AWARD_ORBIT, i === 3 ? certAngle(angle) : awardAngle(angle, i)));
  const expectAtCards = (star: NonNullable<RideFrame['star']>, angle: number, y: number) => {
    for (let i = 0; i < 4; i++) {
      const c = cardAt(angle, i, y);
      expect(Math.hypot(star.fliers[i].x - c.x, star.fliers[i].y - c.y)).toBeLessThanOrEqual(1);
    }
  };

  it('앞으로 도착한 뒤 쉬는 동안 각도가 돌았으면, 되돌아 지난 첫 항성 프레임의 점은 지금 DOM 카드 자리에 있고 그 재생은 끝까지 그 각도를 쓴다', () => {
    create();
    for (const y of [SD + 4, 3000, 3300, SA + 5]) scrollAt(y);
    play(STAR_SECONDS + .1);
    expect(last()).toBeNull();
    // 쉬는 동안 Awards가 10초 돌았다(0.15 rad/s)
    awards.angle = () => ANGLE + 1.5;
    scrollAt(SA - 5);
    // p 1에서 거꾸로 출발한 첫 tick의 항성 프레임
    advance(.016);
    expectAtCards(last()!.star!, ANGLE + 1.5, SA - 5);
    // 재생 도중 다시 내려가도 각도는 바뀌지 않는다(Awards는 재생 동안 공전을 세운다)
    play(.4);
    awards.angle = () => ANGLE + 3;
    scrollAt(SA + 5);
    let star = last()!.star!;
    while (last()) {
      star = last()!.star!;
      advance(.016);
    }
    expectAtCards(star, ANGLE + 1.5, SA + 5);
  });

  it('#awards 첫 배치(도착 장면을 한 번도 돌지 않음) 뒤 되돌아 지나도 첫 항성 프레임의 점은 지금 DOM 카드 자리에 있다', () => {
    create({ at: SA + 100 });
    scrollAt(SA + 60);
    scrollAt(SA - 5);
    advance(.016);
    expectAtCards(last()!.star!, ANGLE, SA - 5);
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

// Ruling 9: Experience 쪽에서 Skills 헤드가 오지 않았으면 Awards 넘김은 떠나지 않는다
describe('Awards 넘김: Skills 헤드가 없을 때', () => {
  it('setHeadArrived(false)면 sD와 sA를 지나도 떠 있는 헤드도 wait도 onAway도 없다', () => {
    create();
    handoff!.setHeadArrived(false);
    for (const y of [SD + 4, 3000, 3300, SA + 5]) scrollAt(y);
    advance(2);
    scrollAt(3000);
    advance(2);
    expect(frames().filter(f => f !== null)).toEqual([]);
    expect(awards.setStar).not.toHaveBeenCalled();
    expect(away()).toEqual([]);
  });

  it('떠 있는 동안 헤드가 없어지면 떠 있는 헤드를 거두고 Awards는 쉬며, 다시 오면 그 자리에 바로 놓는다', () => {
    create();
    for (const y of [SD + 4, 3000]) scrollAt(y);
    handoff!.setHeadArrived(false);
    expect(last()).toBeNull();
    expect(stars().at(-1)).toBeNull();
    expect(away().at(-1)).toBe('away false');
    handoff!.setHeadArrived(true);
    expect(last()!.head).not.toBeNull();
    expect(stars().at(-1)).toBe('wait');
  });
});

// Review Focus 4: Skills 헤드의 표시는 두 넘김의 합이다. 두 넘김 모듈을 바꿔 끼우고 motion.ts의 합치기만 본다.
describe('motion: Skills 헤드 합치기', () => {
  it('Exp 넘김이 도착한 뒤에만 Awards 넘김의 떠남과 돌아옴이 진짜 setArrived에 닿는다', () => {
    const got: { arrive?: (on: boolean) => void; head?: { setArrived(on: boolean): void; reveal(): void } | null; away?: (on: boolean) => void } = {};
    const releases = { skills: vi.fn(), awards: vi.fn() };
    const headArrived = vi.fn();
    vi.mocked(createSkillsHandoff).mockImplementationOnce(({ onArrive }) => {
      got.arrive = onArrive;
      return { setOverlay() {}, setSkillsHead(h) { got.head = h; }, setPaused() {}, release: releases.skills, destroy() {} };
    });
    vi.mocked(createAwardsHandoff).mockImplementationOnce(({ onAway }) => {
      got.away = onAway;
      return { setOverlay() {}, setAwards() {}, setPaused() {}, setHeadArrived: headArrived, release: releases.awards, destroy() {} };
    });
    document.body.innerHTML = '<nav></nav><main><button><span>K</span></button><div data-logo-host><div></div></div></main>';
    const react: boolean[] = [], reactAway: boolean[] = [];
    const motion = createPortfolioMotion({
      root: document.querySelector('main')!, header: document.querySelector('nav')!, wordmark: document.querySelector('button')!,
      logoHost: document.querySelector<HTMLElement>('[data-logo-host]')!, reduced: false, onLogoOwnerChange() {},
      onSkillsHeadArrive: on => react.push(on), onSkillsHeadAway: on => reactAway.push(on),
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
    // Ruling 11: React에는 둘을 따로 넘긴다. 떠나도 도착(목록 등장)은 그대로다.
    expect(react.at(-1)).toBe(true);
    expect(reactAway.at(-1)).toBe(true);
    got.away!(false);
    expect(shown()).toBe(true);
    expect(react.at(-1)).toBe(true);
    expect(reactAway.at(-1)).toBe(false);
    // Exp 넘김이 거꾸로인 동안에는 Awards가 돌아와도 서지 않는다
    got.head!.setArrived(false);
    got.arrive!(false);
    got.away!(true);
    got.away!(false);
    expect(shown()).toBe(false);
    expect(react.at(-1)).toBe(false);
    // Ruling 9: Exp 넘김의 도착 여부를 Awards 넘김에도 넘긴다
    expect(headArrived).toHaveBeenLastCalledWith(false);
    got.arrive!(true);
    expect(headArrived).toHaveBeenLastCalledWith(true);
    got.arrive!(false);
    // reveal은 진짜 손잡이로 간다. Skills가 헤드를 그리면 두 넘김을 다 놓는다.
    got.head!.reveal();
    expect(real.reveal).toHaveBeenCalledTimes(1);
    motion.releaseSkillsHead();
    expect(releases.skills).toHaveBeenCalledTimes(1);
    expect(releases.awards).toHaveBeenCalledTimes(1);
    motion.destroy();
  });

  // Ruling 11(리뷰 I1의 길): Hero에서 nav로 Awards에 내려앉은 뒤 위로 올라가 떠 있기 구간을 지난다.
  // 헤드는 떠나 있지만 React의 도착(목록 등장과 그래프 진입)은 줄곧 true라 Skills 목록이 wait에 묶이지 않는다.
  it('nav로 Awards에 간 뒤 떠 있기 구간을 거슬러 올라가도 React 도착은 true로 남고 헤드 그리기만 꺼졌다 돌아온다', async () => {
    vi.mocked(createSkillsHandoff).mockImplementationOnce(() => ({ setOverlay() {}, setSkillsHead() {}, setPaused() {}, release() {}, destroy() {} }));
    root.insertAdjacentHTML('beforeend', '<button data-test-wordmark><span>K</span></button><div data-logo-host><div></div></div>');
    documentY = 0;
    const react: boolean[] = [], reactAway: boolean[] = [];
    const motion = createPortfolioMotion({
      root, header: document.querySelector<HTMLElement>('[data-scroll-header]')!, wordmark: root.querySelector<HTMLButtonElement>('[data-test-wordmark]')!,
      logoHost: root.querySelector<HTMLElement>('[data-logo-host]')!, reduced: false, onLogoOwnerChange() {},
      onSkillsHeadArrive: on => react.push(on), onSkillsHeadAway: on => reactAway.push(on),
    });
    const real = { setArrived: vi.fn(), reveal: vi.fn() };
    motion.setSkillsHead(real);
    motion.setAwards(awards as AwardsSectionHandle);
    motion.setOverlay({ ...overlay, setBoundary: vi.fn(), setTimeline: vi.fn(), setHandoff: vi.fn() } as unknown as ExperienceOverlay);
    root.setAttribute('data-navigation-target', 'awards-certificates');
    await Promise.resolve();
    for (const y of [900, 1800, 2700, 3600, 4000]) scrollAt(y);
    root.removeAttribute('data-navigation-target');
    await Promise.resolve();
    expect(reactAway.at(-1)).toBe(true);
    // 손으로 위로: 도착 장면을 거꾸로, 떠 있기, 그리고 sD 위로 돌아온다
    scrollAt(3800);
    scrollAt(SA - 5);
    play(STAR_SECONDS + .1);
    for (let y = SA - 50; y > SD + 4; y -= 150) {
      scrollAt(y);
      expect(last()!.head).not.toBeNull();
      expect(reactAway.at(-1)).toBe(true);
      expect(real.setArrived.mock.calls.at(-1)?.[0]).toBe(false);
    }
    scrollAt(SD - 50);
    expect(reactAway.at(-1)).toBe(false);
    expect(real.setArrived.mock.calls.at(-1)?.[0]).toBe(true);
    expect(react.length).toBeGreaterThan(0);
    expect(react.every(on => on)).toBe(true);
    motion.destroy();
  });
});

// Ruling 15(최종 리뷰 I3): Exp → Skills 넘김이 끝나기 전에 sD를 지나도 헤드가 둘로 보이지 않는다.
// 실제 두 넘김과 motion.ts 합치기를 함께 돌린다. Skills 그래프는 "setArrived(true) 다음 tick에 헤드를 그리고 onHeadShown(release)" 모형이다.
describe('Exp → Skills 끝과 Skills → Awards 출발의 이음', () => {
  // measureTimeline은 offset을 읽는다
  const placeAll = (element: Element, box: Box) => {
    Object.defineProperties(element, {
      offsetLeft: { configurable: true, get: () => box.x }, offsetTop: { configurable: true, get: () => box.y },
      offsetWidth: { configurable: true, get: () => box.w }, offsetHeight: { configurable: true, get: () => box.h },
      offsetParent: { configurable: true, get: () => null },
    });
    place(element, box);
  };
  // 선 끝 2720, Skills 첫 줄 가운데 2956(지점: 스크롤 2326), 헤드 열 x 160, 원판 가운데 (720, 3979).
  // sD = 2956 - 199.6 = 2756.4, sA = 3979 - 488 = 3491. 넘김(약 1초)이 끝나기 전에 sD를 지나려면 430px를 1초 안에 내려가면 된다.
  const EXP_ROW = 2956, EXP_HEAD_X = 160, EXP_SD = 2756.4;
  const build = () => {
    document.body.innerHTML = `<nav data-scroll-header></nav><main>
      <section id="experience"><span data-part="experience-line" data-complete="true"></span>
        <article><div data-part="experience-axis"></div><div><h3 data-part="experience-node">A</h3></div></article>
        <article><div data-part="experience-axis"></div><div><h3 data-part="experience-node">B</h3></div></article>
      </section>
      <section id="skills"><div data-skill-map><canvas data-graph="head"></canvas>
        <nav><button data-skill-row aria-pressed="true">React</button><button data-skill-row aria-pressed="false">TypeScript</button></nav>
      </div></section>
      <section id="awards-certificates"><div class="awards-stage"><div data-orbit-center></div></div></section>
      <button data-test-wordmark><span>K</span></button><div data-logo-host><div></div></div>
    </main>`;
    place(document.querySelector('[data-scroll-header]')!, { x: 0, y: 0, w: 1440, h: 76 }, true);
    const main = document.querySelector('main')!;
    const [a, b] = [...main.querySelectorAll('article')];
    placeAll(a, { x: 0, y: 1000, w: 1200, h: 800 });
    placeAll(b, { x: 0, y: 1800, w: 1200, h: 1000 });
    main.querySelectorAll('[data-part="experience-axis"]').forEach(el => placeAll(el, { x: 40, y: 0, w: 48, h: 600 }));
    const [na, nb] = [...main.querySelectorAll('[data-part="experience-node"]')];
    placeAll(na, { x: 120, y: 1040, w: 600, h: 40 });
    placeAll(nb, { x: 120, y: 1840, w: 600, h: 40 });
    placeAll(main.querySelector('#skills')!, { x: 0, y: 2850, w: 1440, h: 1000 });
    placeAll(main.querySelector('[data-graph="head"]')!, { x: EXP_HEAD_X - 24, y: 2900, w: 48, h: 600 });
    const [r0, r1] = [...main.querySelectorAll('[data-skill-row]')];
    placeAll(r0, { x: 200, y: EXP_ROW - 36, w: 300, h: 72 });
    placeAll(r1, { x: 200, y: EXP_ROW + 36, w: 300, h: 72 });
    placeAll(main.querySelector('[data-orbit-center]')!, { x: 720 - DISC / 2, y: 3979 - DISC / 2, w: DISC, h: DISC });
    placeAll(main.querySelector('#awards-certificates')!, { x: 0, y: 3600, w: 1440, h: 800 });
    return main;
  };

  it.each([4, 7, 9, 12])('Experience에서 프레임당 %ipx로 계속 내려가도 넘김 헤드, Skills 헤드, 떠 있는 헤드 중 둘이 함께 그려지는 프레임이 없고 떠 있기는 줄에서 출발한다', (step) => {
    const main = build();
    documentY = 2000;
    let handoffNow: HandoffFrame | null = null, rideNow: RideFrame | null = null;
    const fakeOverlay = {
      setHandoff: (f: HandoffFrame | null) => { handoffNow = f; }, setRide: (f: RideFrame | null) => { rideNow = f; },
      setBoundary() {}, setTimeline() {}, setReduced() {}, destroy() {},
    } as unknown as ExperienceOverlay;
    // Skills 그래프 모형: setArrived(true)면 다음 tick에 헤드를 그리고 release를 부른다. false면 그 자리에서 지운다.
    let drawn = true, pending = false;
    const motion = createPortfolioMotion({
      root: main, header: document.querySelector<HTMLElement>('[data-scroll-header]')!, wordmark: main.querySelector<HTMLButtonElement>('[data-test-wordmark]')!,
      logoHost: main.querySelector<HTMLElement>('[data-logo-host]')!, reduced: false, onLogoOwnerChange() {},
    });
    motion.setSkillsHead({ setArrived: (on: boolean) => { if (!on) { drawn = false; pending = false; } else if (!drawn) pending = true; }, reveal() {} });
    motion.setAwards({ setStar() {}, angle: () => 0 });
    motion.setOverlay(fakeOverlay);
    let doubled = 0, firstRide: RideFrame | null = null, rideY = 0, heldSeen = false;
    for (let i = 0; i < 400 && documentY < 3400; i++) {
      documentY += step;
      window.dispatchEvent(new Event('scroll'));
      gsap.updateRoot(gsap.globalTimeline.time() + .016);
      if (pending) {
        pending = false;
        drawn = true;
        motion.releaseSkillsHead();
      }
      const h = handoffNow as HandoffFrame | null, r = rideNow as RideFrame | null;
      if (h?.head && h.head.r === 12) heldSeen = true;
      const count = (h?.head ? 1 : 0) + (r?.head ? 1 : 0) + (drawn ? 1 : 0);
      if (count > 1) doubled++;
      if (r?.head && !firstRide) { firstRide = r; rideY = documentY; }
    }
    expect(heldSeen).toBe(true);
    expect(doubled).toBe(0);
    // 떠 있기는 줄에서 출발한다: 출발 파동이 줄 자리에 있고 잔상이 남는다
    expect(firstRide).not.toBeNull();
    expect(rideY).toBeGreaterThan(EXP_SD);
    expect(firstRide!.ring).toEqual(expect.objectContaining({ x: EXP_HEAD_X, y: EXP_ROW - rideY }));
    motion.destroy();
  });
});
