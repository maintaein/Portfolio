import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import type { ElectricLogoHandle } from '@/components/blocks/ElectricLogo';
import { CORE, LOGO_SECONDS, ORBIT, PREVIEW_OVER, PREVIEW_RETURN_SECONDS, PREVIEW_SECONDS, createPortfolioMotion, logoPhases, previewPhases, type LogoOwner, type PortfolioMotion } from '@/components/sections/HomeClient/motion';
import { resolveCurrentSection } from '@/lib/utils/scrollGeometry';

// jsdom에는 레이아웃이 없어 실제 브라우저가 줄 offset 값을 요소마다 심는다.
type Box = { x: number; y: number; w: number; h: number };
const rect = ({ x, y, w, h }: Box) => ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y, toJSON: () => ({}) }) as DOMRect;
function place(element: HTMLElement, box: Box, parent: HTMLElement | null = null) {
  Object.defineProperties(element, {
    offsetLeft: { configurable: true, get: () => box.x }, offsetTop: { configurable: true, get: () => box.y },
    offsetWidth: { configurable: true, get: () => box.w }, offsetHeight: { configurable: true, get: () => box.h },
    offsetParent: { configurable: true, get: () => parent },
  });
  element.getBoundingClientRect = () => rect({ ...box, y: box.y - (parent ? 0 : documentY) });
}

let documentY = 0;
let viewport = 900;
let letterSpacing = 0;
const handle = { beginBoundary: vi.fn(() => true), setBoundaryTarget: vi.fn(), seekBoundary: vi.fn(), endBoundary: vi.fn() } satisfies ElectricLogoHandle;
let root: HTMLElement; let header: HTMLElement; let wordmark: HTMLButtonElement; let label: HTMLElement; let host: HTMLElement; let inner: HTMLElement;
let navName: HTMLElement; let heroName: HTMLElement; let heroObject: HTMLElement; let aboutLogo: HTMLElement; let hero: HTMLElement; let about: HTMLElement;
let motion: PortfolioMotion | null = null;
const owners: LogoOwner[] = [];
let observed: Element[] = [];
let resized = () => {};

// 이름 글자 줄은 8em × 1.5em이다(nav 15px에서 120 × 22.5). 버튼 하나가 CSS 두 자리(data-wordmark-mode) 사이를 오간다.
// nav: nav-name 앵커(24, 16)에 fixed, 44px 최소 높이 가운데에 글자 줄. Hero: 자리 세로 가운데·자리 왼쪽 끝(Task 9, 문장과 같은 끝).
const font = () => parseFloat(wordmark.style.fontSize) || (wordmark.dataset.wordmarkMode === 'nav' ? 15 : 88);
function layout() {
  const f = font();
  if (wordmark.dataset.wordmarkMode === 'nav') return { button: { x: 24, y: 16, w: 120, h: 44 }, label: { x: 24, y: 16 + (44 - 22.5) / 2, w: 120, h: 22.5 } };
  const label = { x: heroName.offsetLeft, y: 266 - .75 * f - documentY, w: 8 * f, h: 1.5 * f };
  return { button: label, label };
}
// 날고 있는 버튼의 transform(원점 왼쪽 위)을 실은 화면 상자. 브라우저의 getBoundingClientRect와 같다.
function visual(which: 'button' | 'label'): Box {
  const { button, label } = layout();
  // gsap.getProperty는 offsetParent가 없는 jsdom 요소에서 getBoundingClientRect를 다시 부르므로 GSAP 캐시를 읽는다.
  const cache = (wordmark as unknown as { _gsap?: { x: string; y: string; scaleX: number } })._gsap;
  const [x, y, s] = wordmark.style.transform && cache ? [parseFloat(cache.x), parseFloat(cache.y), cache.scaleX] : [0, 0, 1];
  const box = which === 'button' ? button : label;
  return { x: button.x + x + s * (box.x - button.x), y: button.y + y + s * (box.y - button.y), w: s * box.w, h: s * box.h };
}

// Hero는 76~900, About은 900부터. 로고 지점은 About 로고(1100~1460)가 아래 여유 16px까지 화면(900)에 다 드는 576이다.
function build() {
  document.body.innerHTML = `
    <nav><div data-motion-anchor="nav-name"></div></nav>
    <main>
      <section data-section="overview"><div data-motion-anchor="hero-name"><button data-wordmark-mode="hero"><span>KIM TAEIN</span></button></div><div data-motion-anchor="hero-object"></div></section>
      <div data-section="about"><div data-motion-anchor="about-logo"></div></div>
      <div data-logo-host><div></div></div>
    </main>`;
  header = document.querySelector('nav')!; wordmark = document.querySelector('button')!; label = wordmark.querySelector('span')!; root = document.querySelector('main')!;
  host = document.querySelector('[data-logo-host]')!; inner = host.firstElementChild as HTMLElement;
  hero = document.querySelector('[data-section="overview"]')!; about = document.querySelector('[data-section="about"]')!;
  navName = document.querySelector('[data-motion-anchor="nav-name"]')!;
  heroName = document.querySelector('[data-motion-anchor="hero-name"]')!;
  heroObject = document.querySelector('[data-motion-anchor="hero-object"]')!;
  aboutLogo = document.querySelector('[data-motion-anchor="about-logo"]')!;
  place(header, { x: 0, y: 0, w: 1440, h: 76 });
  place(navName, { x: 24, y: 16, w: 0, h: 44 }, header);
  wordmark.getBoundingClientRect = () => rect(visual('button'));
  label.getBoundingClientRect = () => rect(visual('label'));
  place(root, { x: 0, y: 0, w: 1440, h: 5000 });
  place(hero, { x: 0, y: 76, w: 1440, h: 824 });
  place(about, { x: 0, y: 900, w: 1440, h: 900 });
  // 큰 이름의 줄 높이만큼 비운 자리. 높이(132/1.5 = 88px)가 폭(800/8 = 100px)보다 먼저 닿는다.
  place(heroName, { x: 100, y: 200, w: 800, h: 132 });
  // D5-A: 1024px부터 오브젝트는 문장 오른쪽에 있다.
  place(heroObject, { x: 960, y: 300, w: 360, h: 360 });
  place(aboutLogo, { x: 140, y: 1100, w: 360, h: 360 });
  place(host, { x: 0, y: 0, w: 360, h: 360 }, root);
}

// 크리스털 볼 손잡이. 경계가 접힘 정도(0 쉬는 볼 ~ 1 작은 고리)를 프레임마다 넘긴다.
const ball = { setCollapse: vi.fn() };
const create = (options: { logo?: ElectricLogoHandle | null; reduced?: boolean } = {}) => {
  motion = createPortfolioMotion({ root, header, wordmark, logoHost: host, ball: { current: ball }, reduced: options.reduced ?? false, onLogoOwnerChange: owner => owners.push(owner) });
  motion.setLogo(options.logo === undefined ? handle : options.logo);
  return motion;
};
const scrollAt = (y: number) => { documentY = y; window.dispatchEvent(new Event('scroll')); ScrollTrigger.update(); };
// 크기 관찰이 부르면 motion.ts는 다음 프레임에 한 번 잰다. 그 프레임만 붙잡아 바로 돌린다.
const resize = () => {
  const frames: FrameRequestCallback[] = [];
  const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(frame => frames.push(frame));
  resized();
  raf.mockRestore();
  expect(frames).toHaveLength(1);
  for (const frame of frames) frame(0);
};
// 루트 시간을 지금에서 앞으로 민다. 재생은 시간으로만 간다. 테스트 사이 rAF 틱이 루트를 되돌려도 지금 기준이다.
const advance = (seconds: number) => gsap.updateRoot(gsap.globalTimeline.time() + seconds);
const numbers = (value: string) => (value.replace(/translate3d|translate/, '').match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map(Number);
// host: translate3d(x, y, 0). 크기는 About 앵커 그대로이고 기울지 않는다(Hero에서는 숨는다).
const logo = () => { const [x, y, z] = numbers(host.style.transform); return { x, y, z }; };
const HERO_LOGO = { x: 960, y: 300, z: 0 };
const ABOUT_LOGO = { x: 140, y: 1100, z: 0 };
// 볼(hero-object 앵커): translate(dx, dy) scale(s). Hero 앵커 가운데 (1140, 480), About 앵커 가운데 (320, 1280).
const orb = () => { const [dx, dy, scale] = numbers(heroObject.style.transform); return { dx: dx ?? 0, dy: dy ?? 0, scale: scale ?? 1, opacity: heroObject.style.opacity }; };
const lastCall = (fn: { mock: { calls: unknown[][] } }) => fn.mock.calls.at(-1)?.[0];
// 로고 지점: About 본문이 나타나기 시작하는 R(잠금 824 - 화면 절반 450 = 374)에서 화면 높이의 15% 앞, 239. 되돌아오는 문턱은 24 위 215.
// Task 11: 1.5초 비행에 맞춰 12%에서 15%로 앞당겼다(앞섬 / 비행 시간이 같다). 되돌기는 60에서 24로 더 일찍 시작한다.
const START = 239;
const expectNameAt = (mode: 'hero' | 'nav') => {
  expect(wordmark.dataset.wordmarkMode).toBe(mode);
  expect(wordmark.style.transform).toBe('');
  expect(gsap.getTweensOf(wordmark)).toHaveLength(0);
};

beforeEach(() => {
  documentY = 0; viewport = 900; letterSpacing = 0; owners.length = 0; observed = [];
  for (const fn of [...Object.values(handle), ball.setCollapse]) fn.mockClear();
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'pageYOffset', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewport });
  // 지점 검출 ScrollTrigger는 문서 끝(max)까지 본다. jsdom 문서는 높이가 0이다.
  for (const element of [document.documentElement, document.body]) Object.defineProperty(element, 'scrollHeight', { configurable: true, get: () => 5000 });
  // ScrollTrigger가 등록 때 matchMedia를 부른다. jsdom에는 없다.
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: false, media, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resized = callback; } observe(element: Element) { observed.push(element); } disconnect() {} });
  const computed = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => element === label
    ? { fontSize: `${font()}px`, letterSpacing: `${letterSpacing * font()}px` } as CSSStyleDeclaration
    : computed(element));
  build();
});
afterEach(() => { motion?.destroy(); motion = null; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('이름: 지점을 넘으면 0.5초 FLIP', () => {
  it('맨 위에서는 Hero 자리(CSS 배치)에 큰 글자로 서고 transform이 없다', () => {
    create();
    expectNameAt('hero');
    // 자리 높이 132의 글자 줄(1.5em)이 폭(800 / 8em = 100px)보다 먼저 닿는다.
    expect(wordmark.style.fontSize).toBe('88px');
    expect(wordmark.style.left + wordmark.style.top).toBe('');
  });

  it('180px을 넘으면 nav 자리로 바뀌고 Hero에서 보이던 글자 줄에서 출발해 0.5초 뒤 transform 없이 닿는다', () => {
    create();
    const before = visual('label');
    scrollAt(150);
    expectNameAt('hero');
    scrollAt(200);
    expect(wordmark.dataset.wordmarkMode).toBe('nav');
    expect([wordmark.style.left, wordmark.style.top, wordmark.style.fontSize]).toEqual(['24px', '16px', '']);
    const [tween] = gsap.getTweensOf(wordmark);
    expect(tween.duration()).toBe(.5);
    // 출발: 스크롤이 200 내려간 Hero 글자 줄. 가로세로 같은 배율이라 글자가 눌리지 않는다.
    const start = visual('label');
    // GSAP은 px 값을 소수 셋째 자리에서 반올림한다.
    expect(start.x).toBeCloseTo(before.x, 2); expect(start.y).toBeCloseTo(before.y - 200, 2);
    expect(start.w).toBeCloseTo(before.w, 2); expect(start.h).toBeCloseTo(before.h, 2);
    expect(wordmark.style.transform).toMatch(/scale\(([\d.]+)(, \1)?\)/);
    advance(.25);
    expect(visual('label').h).toBeLessThan(before.h); expect(visual('label').h).toBeGreaterThan(22.5);
    advance(.3);
    expectNameAt('nav');
    expect(visual('label')).toEqual({ x: 24, y: 26.75, w: 120, h: 22.5 });
    expect(wordmark.style.zIndex).toBe('');
  });

  it('되넘으면 Hero로 거꾸로 돌고, 두 문턱 사이(120–180)에서는 지금 자리를 지킨다', () => {
    create();
    scrollAt(200); advance(1);
    scrollAt(150);
    expectNameAt('nav');
    scrollAt(100);
    expect(wordmark.dataset.wordmarkMode).toBe('hero');
    expect(gsap.getTweensOf(wordmark)[0].duration()).toBe(.5);
    expect(visual('label')).toMatchObject({ x: 24, y: 26.75 });
    advance(1);
    expectNameAt('hero');
    expect(wordmark.style.fontSize).toBe('88px');
    scrollAt(150);
    expectNameAt('hero');
  });

  it('날아가는 도중에 되넘으면 지금 보이는 자리에서 다시 출발해 튀지 않는다', () => {
    create();
    scrollAt(200); advance(.2);
    const mid = visual('label');
    scrollAt(100);
    const resumed = visual('label');
    // 배율도 소수 넷째 자리에서 반올림돼 큰 글자 줄에서 0.01px 남짓 어긋난다.
    for (const key of ['x', 'y', 'w', 'h'] as const) expect(resumed[key]).toBeCloseTo(mid[key], 1);
    advance(1);
    expectNameAt('hero');
  });

  it('쉬는 자리의 버튼 상자는 글자 줄 상자 그대로다(배율로 키운 상자가 왼쪽 문장을 덮지 않는다)', () => {
    create();
    expect(visual('button')).toEqual(visual('label'));
    expect(visual('button').h).toBeLessThanOrEqual(132);
  });

  it('모션 감소는 같은 문턱에서 재생 없이 바로 바뀐다', () => {
    create({ logo: null, reduced: true });
    scrollAt(200);
    expectNameAt('nav');
    scrollAt(100);
    expectNameAt('hero');
  });

  it('문턱 아래로 바로 온 해시(/#about)는 처음부터 nav·About 자리이고 아무것도 재생하지 않는다', () => {
    documentY = 808;
    create();
    expectNameAt('nav');
    expect(logo()).toEqual(ABOUT_LOGO);
    expect(owners).toEqual(['none', 'about']);
    // 변신도 끝난 자리다: 로고는 다 보이고, 볼은 About 자리에서 작은 고리로 접혀 사라져 있다.
    expect(inner.style.opacity).toBe('1');
    expect(orb()).toEqual({ dx: -820, dy: 800, scale: .22, opacity: '0' });
    expect(lastCall(ball.setCollapse)).toBe(1);
    expect(handle.beginBoundary).not.toHaveBeenCalled();
  });

  // M4 Task 0 (M3 #14). 그리기 전 판정(lib/introGate.ts)의 nav 표시는 경계가 처음 자리를 정하면 걷는다. 그 뒤로는 data-wordmark-mode만 따른다.
  it('그리기 전 판정이 붙인 nav 표시는 경계가 처음 자리를 정할 때 걷는다', () => {
    document.documentElement.setAttribute('data-name-side', 'nav');
    documentY = 808;
    create();
    expectNameAt('nav');
    expect(document.documentElement.hasAttribute('data-name-side')).toBe(false);
  });

  it('refresh는 쉬는 이름을 재생하지 않고 다시 잰 지금 쪽 자리에 둔다', () => {
    create();
    scrollAt(200); advance(1);
    place(navName, { x: 80, y: 16, w: 0, h: 44 }, header);
    motion!.refresh();
    expectNameAt('nav');
    expect(wordmark.style.left).toBe('80px');
    place(heroName, { x: 100, y: 200, w: 800, h: 90 });
    scrollAt(0); advance(1);
    motion!.refresh();
    expectNameAt('hero');
    expect(wordmark.style.fontSize).toBe('60px');
  });

  // M4 Task 0 (M3 #12, #53). 아래 섹션·그림이 배치되며 main이 자라면 크기 관찰이 날던 이름을 끊어 도중에 툭 내려앉혔다.
  it('날던 이름은 크기 변화·refresh에 끊기지 않고 다시 잰 자리로 마저 난다. 날던 배율은 잰 크기에 섞이지 않는다', () => {
    create();
    scrollAt(200); advance(.2);
    const mid = visual('label');
    place(navName, { x: 80, y: 16, w: 0, h: 44 }, header);
    resize();
    expect(gsap.getTweensOf(wordmark)).toHaveLength(1);
    expect(wordmark.style.left).toBe('80px');
    // 아직 날고 있다. nav 크기로 내려앉지 않았다.
    expect(visual('label').h).toBeCloseTo(mid.h, 1);
    motion!.refresh();
    expect(gsap.getTweensOf(wordmark)).toHaveLength(1);
    advance(1);
    expectNameAt('nav');
    expect(wordmark.style.left).toBe('80px');
    expect(visual('label').h).toBe(22.5);
    // nav 쪽으로 날던 중에 잰 Hero 크기도 쉬는 자리의 크기와 같다.
    scrollAt(100); advance(1);
    expectNameAt('hero');
    expect(wordmark.style.fontSize).toBe('88px');
  });

  it('멈춘 동안 넘은 지점은 풀릴 때 재생 없이 그쪽 자리에 둔다', () => {
    create();
    motion!.setPaused(true);
    scrollAt(300);
    expectNameAt('hero');
    motion!.setPaused(false);
    expectNameAt('nav');
  });

  it('destroy는 이름을 CSS의 Hero 자리로 돌려놓고 더는 쓰지 않는다', () => {
    create();
    scrollAt(250);
    motion!.destroy(); motion = null;
    expectNameAt('hero');
    expect(wordmark.style.fontSize + wordmark.style.left + wordmark.style.top).toBe('');
    expect(host.style.transform + inner.style.opacity + heroObject.style.transform + heroObject.style.opacity).toBe('');
    scrollAt(0); scrollAt(300);
    expectNameAt('hero');
  });

  // 390px에서 넘치지 않는다. 자리 폭이 좁으면 높이 대신 폭에 맞춰 줄인다.
  it('이름 자리 폭이 좁으면 폭에 맞춰 줄인다', () => {
    place(heroName, { x: 24, y: 200, w: 300, h: 132 });
    create();
    expect(wordmark.style.fontSize).toBe('37.5px');
  });

  // Task 9. 볼은 앵커를 꽉 채우고 광휘가 앵커 폭의 10%만큼 밖으로 나간다. 이름 자리와 같은 높이에 볼이 있으면
  // 왼쪽 끝에서 시작한 이름의 오른쪽 끝이 그 볼 상자 16px 앞에서 멈춘다.
  it('볼이 이름 옆에 있으면 이름 상자가 광휘까지 포함한 볼 상자에 닿지 않게 줄어든다', () => {
    place(heroObject, { x: 780, y: 150, w: 360, h: 360 });
    create();
    const ball = { l: 780 - .1 * 360, t: 150 - .1 * 360, b: 510 + .1 * 360 };
    const box = visual('label');
    expect(box.x).toBe(100);
    expect(box.y < ball.b && box.y + box.h > ball.t).toBe(true);
    expect(box.x + box.w).toBeLessThanOrEqual(ball.l - 16 + 1e-6);
    expect(box.x + box.w).toBeGreaterThan(ball.l - 16 - 1);
    expect(font()).toBeGreaterThan(1.5 * 15);
  });

  // 1024px 아래에서는 볼이 문장 아래에 있어 이름 높이와 겹치지 않는다. 이름은 자리에만 맞춘다.
  it('볼이 이름 아래에 있으면 볼 상한이 걸리지 않는다', () => {
    place(heroObject, { x: 100, y: 600, w: 220, h: 220 });
    create();
    expect(wordmark.style.fontSize).toBe('88px');
  });

  // tracking-widest는 마지막 글자 뒤에도 자간을 남긴다. 볼까지의 거리는 보이는 글자 폭으로 잰다.
  it('끝 자간을 빼고 보이는 글자 폭으로 볼 앞 크기를 잰다', () => {
    place(heroObject, { x: 780, y: 150, w: 360, h: 360 });
    create();
    const tight = font();
    motion!.destroy();
    letterSpacing = .1;
    create();
    // 보이는 글자는 7.9em이라 같은 거리에 조금 더 크게 들어간다.
    expect(font()).toBeCloseTo(tight * 8 / 7.9, 5);
  });

  // 흰 광휘는 Hero 자리의 글자 그림자뿐이다. 글자 뒤 검은 판은 없다(사용자 결정 2026-10-20). FLIP 동안 사라진다.
  it('이름의 흰 광휘는 Hero 자리의 text-shadow뿐이고 글자 뒤 판이나 흐림이 없다', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('styles/design-tokens.css', 'utf8');
    const hero = css.match(/\.site-name\[data-wordmark-mode='hero'\] \{[^}]*\}/)![0];
    expect(hero).toMatch(/text-shadow: 0 0 \.2em rgb\(255 255 255 \/ \.4\), 0 0 \.6em rgb\(255 255 255 \/ \.2\)/);
    expect(css).toMatch(/\.site-name \{[^}]*transition: text-shadow 500ms/);
    expect(css).not.toMatch(/name-glow|\.site-name[^{]*::before|nav-name'\] button/);
    expect(hero).not.toMatch(/filter|blur\(/);
  });
});

// Task 10(사용자 결정 2026-10-21, background_good.mp4 0–2초). 볼이 제자리에서 작은 고리로 접히고(줄기), 같은 지름의 Electric 원이
// 넘겨받아 About으로 날아가(이동), 그 자리에서 React 로고로 풀린다(펼침). 진행도 하나를 1.5초(Task 11, 1.2초에서 25% 느리게) 동안 시간으로 돌리고
// 모든 값이 진행도의 함수라 어느 지점에서든 같은 길을 거꾸로 밟는다.
describe('변신 시간표', () => {
  const at = logoPhases;
  const scale = (p: number) => 1 - (1 - CORE) * at(p).contract;

  it('끝점: 0은 쉬는 볼, 1은 내려앉은 로고이고 전체는 1.5초다', () => {
    expect(at(0)).toEqual({ contract: 0, drain: 0, ball: 1, logo: 0, travel: 0, grow: 0, boundary: 1 });
    expect(at(1)).toEqual({ contract: 1, drain: 1, ball: 0, logo: 1, travel: 1, grow: 1, boundary: 0 });
    expect(LOGO_SECONDS).toBe(1.5);
    expect([CORE, ORBIT]).toEqual([.22, .7]);
  });

  it('줄기 0–.42, 이동 .36–.8, 펼침 .68–1. 앞 구간 끝에 다음 구간이 조금씩 겹친다', () => {
    expect(at(.42).contract).toBe(1);
    expect(at(.21).contract).toBeCloseTo(.5, 5);
    expect(at(.36).travel).toBe(0);
    expect(at(.58).travel).toBeCloseTo(.5, 5);
    expect(at(.8).travel).toBe(1);
    expect(at(.68)).toMatchObject({ grow: 0, boundary: 1 });
    expect(at(.84).boundary).toBeCloseTo(.5, 5);
    // 떠날 때 볼은 이미 작은 고리다.
    expect(at(.36).contract).toBeGreaterThan(.95);
  });

  it('인계: Electric 원은 .2–.36에 나타나고 볼은 .28–.42에 사라진다. 원이 나타나기 시작할 때 볼은 0.7배 아래로 줄어 있다', () => {
    expect(at(.2).logo).toBe(0);
    expect(at(.36).logo).toBe(1);
    expect(at(.28).ball).toBe(1);
    expect(at(.42).ball).toBe(0);
    expect(scale(.2)).toBeLessThan(.7);
  });

  // Task 10 리뷰 Important 1. 참조(background_good g37–g51)의 판은 채워진 한 덩이로 줄고, 속이 빠지는 것은 끝(g50–g53)뿐이다.
  // 그래서 볼 속(먼지·안개·아이콘)은 줄기 내내 테두리와 같은 배율이고, .3–.42에만 가운데로 빠진다.
  it('줄기는 채워진 한 덩이다: 속은 .3까지 테두리와 같은 배율로 줄고 .3–.42에만 빠진다', () => {
    const PULL = .85;
    const contents = (p: number) => scale(p) * (1 - PULL * at(p).drain);
    for (let i = 0; i <= 30; i++) expect(contents(i / 100)).toBe(scale(i / 100));
    expect(at(.3).drain).toBe(0);
    expect(at(.36).drain).toBeCloseTo(.5, 5);
    expect(at(.42).drain).toBe(1);
    // p .2(줄기 한가운데)에 테두리는 이미 0.7배 아래인데 속도 같은 배율이다. 사이에 빈 띠가 없다.
    expect(contents(.2) / scale(.2)).toBe(1);
  });

  it('모든 값은 진행도에 대해 한쪽으로만 움직여 되감기가 같은 길을 거꾸로 밟는다', () => {
    let last = at(0);
    for (let i = 1; i <= 400; i++) {
      const now = at(i / 400);
      for (const key of ['contract', 'drain', 'logo', 'travel', 'grow'] as const) expect(now[key]).toBeGreaterThanOrEqual(last[key]);
      for (const key of ['ball', 'boundary'] as const) expect(now[key]).toBeLessThanOrEqual(last[key]);
      last = now;
    }
  });
});

describe('로고: About 본문보다 먼저 내려앉게 떠나는 변신', () => {
  it('Hero에서 쉬는 동안 host는 Hero 앵커 가운데에 숨어 있고 볼은 그대로다', () => {
    create();
    expect(logo()).toEqual(HERO_LOGO);
    expect(inner.style.opacity).toBe('0');
    expect(heroObject.style.transform + heroObject.style.opacity).toBe('');
    expect(lastCall(ball.setCollapse)).toBe(0);
    expect(owners).toEqual(['none', 'hero']);
  });

  it('지점은 About 본문이 나타나는 R에서 화면 높이의 15% 앞이고 이름 문턱 아래·잠금 자리 위로 묶는다. 되돌아오는 문턱은 24 위다', () => {
    create();
    scrollAt(START - 1); expect(owners.at(-1)).toBe('hero');
    scrollAt(START); expect(owners.at(-1)).toBe('boundary');
    advance(2); expect(owners.at(-1)).toBe('about');
    scrollAt(START - 23); expect(owners.at(-1)).toBe('about');
    scrollAt(START - 24); expect(owners.at(-1)).toBe('boundary');
    advance(2); expect(owners.at(-1)).toBe('hero');
    scrollAt(START - 1); expect(owners.at(-1)).toBe('hero');
    motion!.destroy(); owners.length = 0; documentY = 0;
    // 1280x720: R = 824 - 360 = 464, 지점 464 - 108 = 356.
    viewport = 720;
    create();
    scrollAt(355); expect(owners.at(-1)).toBe('hero');
    scrollAt(356); expect(owners.at(-1)).toBe('boundary');
    motion!.destroy(); owners.length = 0; documentY = 0; viewport = 900;
    // About이 가까우면 이름 문턱(180)보다 먼저 떠나지 않는다.
    place(about, { x: 0, y: 500, w: 1440, h: 900 });
    create();
    scrollAt(179); expect(owners.at(-1)).toBe('hero');
    scrollAt(181); expect(owners.at(-1)).toBe('boundary');
    motion!.destroy(); owners.length = 0; documentY = 0;
    // 그래도 About 잠금 자리(200 - 76 = 124)에 닿기 전에 떠난다.
    place(about, { x: 0, y: 200, w: 1440, h: 900 });
    create();
    scrollAt(122); expect(owners.at(-1)).toBe('hero');
    scrollAt(123); expect(owners.at(-1)).toBe('boundary');
  });

  // Task 12(사용자 요청 2026-10-22). 위로 갈 때 되돌기는 useSectionNav가 About에서 Overview로 바뀌는 그 스크롤에서 시작한다.
  // 읽기선은 실측 header 아래 화면의 40%다. 이 문서에서 경로 지점은 900 - (76 + 824 × .4) = 494.4로 로고 지점(239)보다 아래다.
  it('위로 갈 때 되돌기는 경로가 About에서 Overview로 바뀌는 스크롤에서 시작하고, 경로 지점에 닿지 않았으면 옛 문턱(지점 - 24)에서 돌아간다', () => {
    const route = (y: number) => resolveCurrentSection({
      sections: [{ id: 'overview', top: 76 }, { id: 'about', top: 900 }],
      scrollY: y, viewportHeight: viewport, headerHeight: header.getBoundingClientRect().height, documentHeight: 5000,
    });
    // About 잠금 자리 아래에서 1px씩 올라가며 로고가 About을 떠난 첫 스크롤과 경로가 Overview가 된 첫 스크롤을 함께 찾는다.
    const climb = () => {
      scrollAt(900); advance(2);
      expect(owners.at(-1)).toBe('about');
      let left = 0;
      let switched = 0;
      for (let y = 899; y > 0 && !(left && switched); y--) {
        scrollAt(y);
        if (!left && owners.at(-1) !== 'about') left = y;
        if (!switched && route(y) === 'overview') switched = y;
      }
      return { left, switched };
    };
    create();
    expect(climb()).toEqual({ left: 494, switched: 494 });
    // 경로 지점 위로 올라와 Hero에 돌아간 로고는 계속 올라가는 동안 그대로 있고, 그 띠에서 아래로 굴리면 다시 떠난다(Task 12 fix 1).
    advance(2); expect(owners.at(-1)).toBe('hero');
    scrollAt(400); scrollAt(300);
    expect(owners.at(-1)).toBe('hero');
    scrollAt(450); expect(owners.at(-1)).toBe('boundary');
    // 날기 시작한 그 스크롤에서 되돌아도(남은 길 0) 경계에 멈추지 않는다.
    scrollAt(0); expect(owners.at(-1)).toBe('hero');
    // 경로 지점에 닿지 않고 돌아서면 옛 문턱에서 돌아간다. Hero에 로고를 남긴 채 About이 보이는 일은 없다.
    scrollAt(START + 100); advance(2); expect(owners.at(-1)).toBe('about');
    scrollAt(START - 23); expect(owners.at(-1)).toBe('about');
    scrollAt(START - 24); expect(owners.at(-1)).toBe('boundary');
    motion!.destroy(); owners.length = 0; documentY = 0;
    // 1280x720에 header 92: 경로 지점 900 - (92 + 628 × .4) = 556.8, 로고 지점 (808 - 360) - 108 = 340.
    viewport = 720;
    place(header, { x: 0, y: 0, w: 1440, h: 92 });
    create();
    expect(climb()).toEqual({ left: 556, switched: 556 });
  });

  // Task 12 fix 1(사용자 결정 2026-10-22). 경로 지점에서 돌아간 뒤 로고 지점과 경로 지점 사이에서 다시 내려가면
  // 로고가 곧장 About으로 날아가 첫 하강과 같은 자리(R)에서 본문이 나타날 수 있다. 경로가 About이 될 때까지 기다리지 않는다.
  it('경로 지점에서 돌아간 뒤 그 아래 띠에서 아래로 굴리면 로고가 About으로 다시 날고, 잔 휠에도 떨지 않는다', () => {
    create();
    scrollAt(900); advance(2);
    scrollAt(494); expect(owners.at(-1)).toBe('boundary');
    advance(2); expect(owners.at(-1)).toBe('hero');
    // 계속 올라가는 동안은 Hero다.
    scrollAt(420); scrollAt(380);
    expect(owners.at(-1)).toBe('hero');
    // 아래로 한 번 굴리면 다시 떠나 내려앉는다.
    scrollAt(390); expect(owners.at(-1)).toBe('boundary');
    advance(2); expect(owners.at(-1)).toBe('about');
    // 위아래로 번갈아 조금씩 굴려도 경로 지점과 옛 문턱(지점 - 24)을 넘지 않으면 About에 머문다.
    for (const y of [386, 392, 384, 391, 383]) {
      scrollAt(y);
      expect(owners.at(-1)).toBe('about');
    }
    // 경로가 다시 About을 읽지 않았으니 위로 돌아가는 것은 옛 문턱에서다.
    scrollAt(START - 23); expect(owners.at(-1)).toBe('about');
    scrollAt(START - 24); expect(owners.at(-1)).toBe('boundary');
    advance(2); expect(owners.at(-1)).toBe('hero');
    // 다시 경로 지점 아래까지 내려갔다가 올라오면 되돌기는 다시 경로 지점에서 시작한다.
    scrollAt(900); advance(2);
    scrollAt(495); expect(owners.at(-1)).toBe('about');
    scrollAt(494); expect(owners.at(-1)).toBe('boundary');
  });

  // M4 Task 0. 경로 지점에서 1–2px 떨면 로고가 Hero와 About을 번갈아 날았다. 되돌기는 경로 지점 그대로이고 다시 날기만 몇 px 늦춘다.
  it('경로 지점에서 돌아선 뒤 1–3px 떨림에는 다시 날지 않고, 돌아선 자리에서 4px 내려와야 About으로 다시 난다', () => {
    create();
    scrollAt(900); advance(2);
    scrollAt(494); expect(owners.at(-1)).toBe('boundary');
    // 경로는 495부터 About이다. 그 위아래로 떨어도 되돌던 길을 지킨다.
    for (const y of [495, 494, 496, 495, 497]) scrollAt(y);
    advance(2); expect(owners.at(-1)).toBe('hero');
    for (const y of [496, 497, 495, 498]) {
      scrollAt(y);
      expect(owners.at(-1)).toBe('hero');
    }
    // 마지막으로 올라온 495에서 4px 내려왔다.
    scrollAt(499); expect(owners.at(-1)).toBe('boundary');
    advance(2); expect(owners.at(-1)).toBe('about');
  });

  it('줄기: 볼이 제자리에서 접히고 같은 지름의 Electric 원(반지름 = 반변)이 넘겨받는다. 경계는 가장 큰 원으로 한 번만 시작한다', () => {
    create();
    scrollAt(START);
    expect(handle.beginBoundary).toHaveBeenCalledTimes(1);
    expect(handle.beginBoundary).toHaveBeenCalledWith({ width: 360, height: 360, radius: 180 });
    // 줄기 한가운데: 볼 전체(앵커)가 줄고 속은 아직 빠지지 않는다.
    advance(.2 * LOGO_SECONDS);
    expect(orb().scale).toBeLessThan(.7);
    expect(lastCall(ball.setCollapse)).toBe(0);
    advance(.1 * LOGO_SECONDS);
    const { contract } = logoPhases(.3);
    expect(lastCall(ball.setCollapse)).toBeCloseTo(0, 2);
    expect(orb().scale).toBeCloseTo(1 - (1 - CORE) * contract, 2);
    expect(orb().dx + orb().dy).toBe(0);
    const ring = 360 * orb().scale;
    const target = lastCall(handle.setBoundaryTarget) as { width: number; height: number; radius: number };
    expect(target.width).toBeCloseTo(ring, 3);
    expect(target.height).toBeCloseTo(ring, 3);
    expect(target.radius).toBeCloseTo(ring / 2, 3);
    expect(lastCall(handle.seekBoundary)).toBe(1);
    // 인계 한가운데: 둘 다 반쯤 보인다.
    expect(Number(orb().opacity)).toBeGreaterThan(0); expect(Number(orb().opacity)).toBeLessThan(1);
    expect(Number(inner.style.opacity)).toBeGreaterThan(0); expect(Number(inner.style.opacity)).toBeLessThan(1);
    expect(logo()).toEqual(HERO_LOGO);
    expect(handle.beginBoundary).toHaveBeenCalledTimes(1);
    // 줄기 끝(.3–.42)에만 속이 고리 가운데로 빠진다.
    advance(.06 * LOGO_SECONDS);
    expect(lastCall(ball.setCollapse) as number).toBeCloseTo(logoPhases(.36).drain, 1);
    expect(lastCall(ball.setCollapse) as number).toBeGreaterThan(.3);
  });

  it('이동과 펼침: 작은 원이 문서 좌표로 About 앵커에 가서 React 로고로 풀리고, 1.5초에 정확히 내려앉는다', () => {
    create();
    scrollAt(START);
    advance(.6 * LOGO_SECONDS);
    const mid = logo();
    expect(mid.x).toBeLessThan(960); expect(mid.x).toBeGreaterThan(140);
    expect(mid.y).toBeGreaterThan(300); expect(mid.y).toBeLessThan(1100);
    expect((lastCall(handle.setBoundaryTarget) as { width: number }).width).toBeCloseTo(360 * CORE, 3);
    expect(lastCall(handle.seekBoundary)).toBe(1);
    expect(inner.style.opacity).toBe('1');
    expect(orb().opacity).toBe('0');
    // 사라진 볼도 같은 길에 있다(host 가운데 = Hero 앵커 가운데 + 볼 이동).
    expect(1140 + orb().dx).toBeCloseTo(mid.x + 180, 3);
    expect(480 + orb().dy).toBeCloseTo(mid.y + 180, 3);
    advance(.24 * LOGO_SECONDS - .01);
    expect(owners.at(-1)).toBe('boundary');
    expect(lastCall(handle.seekBoundary) as number).toBeGreaterThan(.4);
    expect(lastCall(handle.seekBoundary) as number).toBeLessThan(.6);
    advance(.16 * LOGO_SECONDS - .01);
    expect(owners.at(-1)).toBe('boundary');
    advance(.03);
    expect(logo()).toEqual(ABOUT_LOGO);
    expect(lastCall(handle.seekBoundary)).toBe(0);
    expect(lastCall(handle.setBoundaryTarget)).toEqual({ width: 360 * ORBIT, height: 360 * ORBIT, radius: 180 * ORBIT });
    expect(handle.endBoundary).toHaveBeenCalledTimes(1);
    expect(owners).toEqual(['none', 'hero', 'boundary', 'about']);
  });

  it('재생 중에 스크롤이 계속 움직여도 About 앵커(문서 좌표)에 정확히 내려앉는다', () => {
    create();
    scrollAt(START); advance(.3);
    scrollAt(500); advance(.2);
    scrollAt(808); advance(1);
    expect(logo()).toEqual(ABOUT_LOGO);
  });

  it('도중에 되넘으면 보이는 그대로에서 거꾸로 돌아 볼로 펼쳐지고 지난 진행도만큼의 시간만 쓴다. About에서 돌아가는 길도 같다', () => {
    create();
    scrollAt(START); advance(.5 * LOGO_SECONDS);
    const seen = () => ({ host: host.style.transform, orb: heroObject.style.transform + heroObject.style.opacity, inner: inner.style.opacity,
      seek: lastCall(handle.seekBoundary), target: lastCall(handle.setBoundaryTarget), collapse: lastCall(ball.setCollapse) });
    const before = seen();
    scrollAt(START - 24);
    expect(owners.at(-1)).toBe('boundary');
    expect(seen()).toEqual(before);
    advance(.5 * LOGO_SECONDS - .02);
    expect(owners.at(-1)).toBe('boundary');
    advance(.04);
    expect(owners.at(-1)).toBe('hero');
    expect(logo()).toEqual(HERO_LOGO);
    expect(heroObject.style.transform + heroObject.style.opacity).toBe('');
    expect(inner.style.opacity).toBe('0');
    expect(lastCall(ball.setCollapse)).toBe(0);
    expect(handle.beginBoundary).toHaveBeenCalledTimes(1);
    expect(handle.endBoundary).toHaveBeenCalledTimes(1);
    scrollAt(START); advance(2);
    scrollAt(0);
    expect(handle.beginBoundary).toHaveBeenCalledTimes(3);
    // 로고가 원으로 접혀 가는 중(p = .84).
    advance(.16 * LOGO_SECONDS);
    expect(lastCall(handle.seekBoundary) as number).toBeCloseTo(.5, 1);
    advance(2);
    expect(owners.at(-1)).toBe('hero');
    expect(handle.endBoundary).toHaveBeenCalledTimes(3);
  });

  it('refresh는 Hero에 있는 동안 About 자리를 쓰지 않고, About에서는 다시 잰 앵커에 바로 둔다', () => {
    create();
    motion!.refresh();
    expect(logo()).toEqual(HERO_LOGO);
    scrollAt(808); advance(2);
    place(aboutLogo, { x: 180, y: 1140, w: 300, h: 300 });
    motion!.refresh();
    expect(logo()).toEqual({ ...ABOUT_LOGO, x: 180, y: 1140 });
    expect(host.style.width).toBe('300px');
  });

  // M4 Task 0 (M3 #12, #53). 크기 관찰이 날던 로고를 끊어 About 자리로 툭 옮겼다.
  it('날던 로고는 크기 변화·refresh에 끊기지 않고 다시 잰 About 앵커로 마저 날아가 내려앉는다', () => {
    create();
    scrollAt(START); advance(.5 * LOGO_SECONDS);
    place(aboutLogo, { x: 180, y: 1140, w: 300, h: 300 });
    resize();
    expect(owners.at(-1)).toBe('boundary');
    expect(host.style.width).toBe('300px');
    motion!.refresh();
    expect(owners.at(-1)).toBe('boundary');
    expect(handle.endBoundary).not.toHaveBeenCalled();
    advance(.5 * LOGO_SECONDS - .02);
    expect(owners.at(-1)).toBe('boundary');
    advance(.04);
    expect(owners.at(-1)).toBe('about');
    expect(logo()).toEqual({ ...ABOUT_LOGO, x: 180, y: 1140 });
    expect(handle.beginBoundary).toHaveBeenCalledTimes(1);
    expect(handle.endBoundary).toHaveBeenCalledTimes(1);
  });

  it('창 크기 변화는 main뿐 아니라 앵커들도 지켜본다', () => {
    create();
    for (const element of [root, heroName, heroObject, aboutLogo]) expect(observed).toContain(element);
  });

  it('GL 손잡이가 없으면 host를 건드리지 않고, 오면 지금 쪽 자리에서 받아들인다', () => {
    create({ logo: null });
    scrollAt(808);
    // 볼도 Hero에 그대로 남는다. GL 없이 접혀 사라지면 대신 설 것이 없다.
    expect(host.style.transform + heroObject.style.transform + heroObject.style.opacity).toBe('');
    expect(owners).toEqual(['none']);
    motion!.setLogo(handle);
    expect(logo()).toEqual(ABOUT_LOGO);
    expect(owners).toEqual(['none', 'about']);
    motion!.setLogo(null);
    expect(host.style.transform + heroObject.style.transform + heroObject.style.opacity).toBe('');
    expect(owners.at(-1)).toBe('none');
  });

  it('날아가는 도중에 GL 손잡이가 떠나면 경계를 닫으려 부르지 않고 볼을 Hero 쉬는 자리에 돌려놓는다', () => {
    create();
    scrollAt(START); advance(.5);
    motion!.setLogo(null);
    expect(handle.endBoundary).not.toHaveBeenCalled();
    expect(heroObject.style.transform + heroObject.style.opacity).toBe('');
    advance(2);
    expect(owners.at(-1)).toBe('none');
  });

  it('모션 감소는 재생 없이 바로 그쪽 쉬는 자리로 바뀐다', () => {
    create({ reduced: true });
    scrollAt(808);
    expect(logo()).toEqual(ABOUT_LOGO);
    expect(owners).toEqual(['none', 'hero', 'about']);
    expect(orb().opacity).toBe('0');
    expect(inner.style.opacity).toBe('1');
    scrollAt(0);
    expect(heroObject.style.transform + heroObject.style.opacity).toBe('');
    expect(inner.style.opacity).toBe('0');
    expect(handle.beginBoundary).not.toHaveBeenCalled();
  });

  it('내려앉은 뒤에는 chapter 로고가 바뀌어도 경계 손잡이를 다시 부르지 않는다', () => {
    create();
    scrollAt(START); advance(2);
    const calls = Object.values(handle).map(fn => fn.mock.calls.length);
    scrollAt(808); advance(1);
    expect(Object.values(handle).map(fn => fn.mock.calls.length)).toEqual(calls);
  });
});

// M4 Task 1(사용자 결정 D2-A 2026-10-20, 참조 background.mp4 5.15–6.17초). About 로고가 지금 고른 프로젝트의 프리뷰가 된다.
// 진행도는 1(About)에서 2(Projects)로 2.1초(Task 3, 1.5초에서 40% 느리게) 동안 시간으로 돈다. 0–25% 이동·가로 확장, 25–65% 외피가 프리뷰 면을 이루고,
// 65–90% 빛이 가라앉으며 실제 미디어·캡션·목록이 같은 창으로 드러나고, 90–100% 프리뷰 상자·모서리에 정확히 내려앉는다.
describe('About→Projects: 로고가 지금 고른 프로젝트 프리뷰가 된다', () => {
  let projectsSection: HTMLElement; let preview: HTMLElement; let frame: HTMLElement; let media: HTMLElement; let list: HTMLElement;
  // Projects는 1800부터 900 높이. 프리뷰(640×360, 모서리 14)는 왼쪽 열에 있고 목록은 오른쪽 열이다.
  // 지점 = 잠금(1800 - 76) - 화면 절반 450 - 화면 15% 135 = 1139. 경로 지점 = 1800 - (76 + 824 × .4) = 1394.4.
  const PREVIEW_AT = 1139;
  const PREVIEW = { x: 120, y: 2050, w: 640, h: 360 };
  // 프리뷰 가운데(440, 2230)에 About 앵커 크기(360)의 host 가운데가 온다.
  const PREVIEW_LOGO = { x: 260, y: 2050, z: 0 };
  const OVER = { width: 640 * 1.04, height: 360 * 1.04, radius: 14 };
  beforeEach(() => {
    projectsSection = document.createElement('div');
    projectsSection.dataset.section = 'projects';
    projectsSection.innerHTML = `<section><div data-motion-anchor="projects-preview" data-flip-id="pv-A"><div style="border-top-left-radius: 14px"><div data-part="preview-media"></div></div></div><div data-part="index"></div></section>`;
    root.insertBefore(projectsSection, host);
    preview = projectsSection.querySelector('[data-motion-anchor="projects-preview"]')!;
    frame = preview.firstElementChild as HTMLElement;
    media = projectsSection.querySelector('[data-part="preview-media"]')!;
    list = projectsSection.querySelector('[data-part="index"]')!;
    place(projectsSection, { x: 0, y: 1800, w: 1440, h: 900 });
    place(preview, PREVIEW);
  });
  const shown = () => ({ frame: frame.style.opacity, list: list.style.opacity });
  const restAtAbout = () => { create(); scrollAt(900); advance(2); expect(owners.at(-1)).toBe('about'); };
  const route = (y: number) => resolveCurrentSection({
    sections: [{ id: 'overview', top: 76 }, { id: 'about', top: 900 }, { id: 'projects', top: 1800 }],
    scrollY: y, viewportHeight: viewport, headerHeight: 76, documentHeight: 5000,
  });

  // M4 Task 3(사용자 선택 A 2026-10-23): 로고 속이 빛으로 차 면이 되고(채움 0–.2), 그 면이 프리뷰 모양으로 퍼지고(0–.65),
  // 다 퍼진 자리에서 빛이 가라앉는 만큼 그림이 떠오른다(.65–.9, 한 교차). 테두리 전기도 그 교차 동안 함께 사라진다.
  // M4 Task 4(사용자 선택 (가) + (i) 2026-10-23): 그림이 처음부터 모양 안에서 가운데부터 드러나고(앞선 0–.8), 테두리 전기는 가늘어져 사라진다(.6–.9).
  // 면은 정착(.82–.94)에서 프리뷰 상자에 들어앉고, 그 뒤 .94–1 동안 GL 그림이 제자리에 멈춰 있다가 도착에서 DOM 틀로 한 프레임에 바뀐다.
  it('시간표: 이동 0–.25, 채움 0–.2, 외피 seek 0–.65, 높이 .1–.65, 모서리 .25–.65, 앞선 0–.8, 전기 .3–.6, 일그러짐 .45–.82, 교차(그림 없는 방문) .65–.9, 목록 .7–.9, 정착 .82–.94', () => {
    expect(previewPhases(0)).toEqual({ travel: 0, fill: 0, widen: 0, shell: 0, face: 0, corner: 0, reveal: 0, strands: 1, ragged: 1, media: 0, list: 0, settle: 0, handoff: 0, logo: 1 });
    expect(previewPhases(1)).toEqual({ travel: 1, fill: 1, widen: 1, shell: 1, face: 1, corner: 1, reveal: 1, strands: 0, ragged: 0, media: 1, list: 1, settle: 1, handoff: 1, logo: 0 });
    expect(previewPhases(.2).fill).toBe(1);
    expect(previewPhases(.1).fill).toBeGreaterThan(0);
    expect(previewPhases(.25).travel).toBe(1);
    expect(previewPhases(.65)).toMatchObject({ fill: 1, widen: 1, shell: 1, face: 1, corner: 1, media: 0, logo: 1 });
    expect(previewPhases(.9)).toMatchObject({ media: 1, logo: 0, list: 1, strands: 0 });
    expect(previewPhases(.7).list).toBe(0);
    // 앞선은 처음부터 보인다: 10%에 이미 3분의 1 넘게 나아갔고, 정착 전에 상자를 다 덮는다.
    expect(previewPhases(.1).reveal).toBeGreaterThan(.3);
    expect(previewPhases(.8).reveal).toBe(1);
    // Task 5(사용자 요청 2026-10-24): 테두리 전기는 .3–.6에 일찍 가늘어져 사라진다.
    expect(previewPhases(.3).strands).toBe(1);
    expect(previewPhases(.45).strands).toBeCloseTo(.5, 12);
    expect(previewPhases(.6).strands).toBe(0);
    // 모양의 방향별 일그러짐은 .45까지 다 실리고 정착(.82)이 시작할 때 0이다. 정착한 상자가 정확하고 넘김 자리가 맞는다.
    expect(previewPhases(.45).ragged).toBe(1);
    expect(previewPhases(.6).ragged).toBeGreaterThan(0);
    expect(previewPhases(.82).ragged).toBe(0);
    expect(previewPhases(.82).settle).toBe(0);
    expect(previewPhases(.94).settle).toBe(1);
    // 그림이 있는 방문의 넘김: 정착이 끝난 .94부터 GL 캔버스가 DOM 틀 위에서 빠진다.
    expect(previewPhases(.94).handoff).toBe(0);
    expect(previewPhases(.97).handoff).toBeCloseTo(.5, 12);
    expect(PREVIEW_OVER).toBe(1.04);
    let last = previewPhases(0);
    for (let i = 1; i <= 400; i++) {
      const now = previewPhases(i / 400);
      for (const key of ['travel', 'fill', 'widen', 'shell', 'face', 'corner', 'reveal', 'media', 'list', 'settle', 'handoff'] as const) expect(now[key]).toBeGreaterThanOrEqual(last[key]);
      expect(now.logo).toBeLessThanOrEqual(last.logo);
      expect(now.strands).toBeLessThanOrEqual(last.strands);
      expect(now.ragged).toBeLessThanOrEqual(last.ragged);
      if (i / 400 >= .82) expect(now.ragged).toBe(0);
      // 한 교차: 빛이 가라앉는 만큼 그림이 떠오른다. 빈 프레임도 둘 다 밝은 프레임도 없다.
      expect(now.logo + now.media).toBeCloseTo(1, 12);
      last = now;
    }
  });

  // Task 5(사용자 요청 2026-10-24): 프리뷰 구간을 거꾸로(그림 → 로고) 돌 때는 1.4초 빠르기다. 앞으로는 2.1초 그대로다.
  it('프리뷰 구간은 앞으로 2.1초, 되돌기 1.4초이고 Hero 구간은 1.5초 그대로다', () => {
    expect(LOGO_SECONDS).toBe(1.5);
    expect(PREVIEW_SECONDS).toBe(2.1);
    expect(PREVIEW_RETURN_SECONDS).toBe(1.4);
    restAtAbout();
    scrollAt(PREVIEW_AT);
    advance(PREVIEW_SECONDS - .02); expect(owners.at(-1)).toBe('preview');
    advance(.04); expect(owners.at(-1)).toBe('projects');
    scrollAt(1800); scrollAt(1394);
    advance(PREVIEW_RETURN_SECONDS - .02); expect(owners.at(-1)).toBe('preview');
    advance(.04); expect(owners.at(-1)).toBe('about');
  });

  it('1을 지나는 한 트윈은 구간마다 제 빠르기로 돈다: Hero→Projects 1.5초 + 2.1초, Projects→Hero 1.4초 + 1.5초', () => {
    create();
    scrollAt(1800);
    advance(LOGO_SECONDS - .02); expect(owners.at(-1)).toBe('boundary');
    advance(.04); expect(owners.at(-1)).toBe('preview');
    advance(PREVIEW_SECONDS - .04); expect(owners.at(-1)).toBe('preview');
    advance(.04); expect(owners.at(-1)).toBe('projects');
    scrollAt(0);
    advance(PREVIEW_RETURN_SECONDS - .02); expect(owners.at(-1)).toBe('preview');
    advance(.04); expect(owners.at(-1)).toBe('boundary');
    advance(LOGO_SECONDS - .04); expect(owners.at(-1)).toBe('boundary');
    advance(.04); expect(owners.at(-1)).toBe('hero');
  });

  it('1을 지나는 트윈을 도중에 되돌리면 지난 진행도를 새 방향의 빠르기로 바꿔 돌아온다', () => {
    create();
    // Hero 구간 1.5초 + 프리뷰 구간 .5초(진행도 .5 / 2.1)를 날았다. 돌아가는 프리뷰 몫은 1.4초 빠르기라 .5 × 1.4 / 2.1초다.
    scrollAt(1800); advance(LOGO_SECONDS + .5);
    expect(owners.at(-1)).toBe('preview');
    scrollAt(0);
    const back = .5 * PREVIEW_RETURN_SECONDS / PREVIEW_SECONDS;
    advance(back - .02); expect(owners.at(-1)).toBe('preview');
    advance(.04); expect(owners.at(-1)).toBe('boundary');
    advance(LOGO_SECONDS - .04); expect(owners.at(-1)).toBe('boundary');
    advance(.04); expect(owners.at(-1)).toBe('hero');
  });

  it('되돌기를 도중에 다시 앞으로 돌리면 남은 진행도를 2.1초 빠르기로 날고, 진행도는 뛰지 않는다', () => {
    restAtAbout();
    scrollAt(1800); advance(3); expect(owners.at(-1)).toBe('projects');
    // 되돌기 .7초 = 진행도 .5. 앞으로 남은 .5는 1.05초다.
    scrollAt(1394); advance(.5 * PREVIEW_RETURN_SECONDS);
    const before = [host.style.transform, lastCall(handle.seekBoundary)];
    scrollAt(1800);
    expect([host.style.transform, lastCall(handle.seekBoundary)]).toEqual(before);
    advance(.5 * PREVIEW_SECONDS - .02); expect(owners.at(-1)).toBe('preview');
    advance(.04); expect(owners.at(-1)).toBe('projects');
  });

  it('채움은 상자 경계의 seek에 실려 손잡이에 닿고, Hero 쪽 원 경계에는 채움이 없다', () => {
    create();
    scrollAt(900);
    advance(.5 * LOGO_SECONDS);
    expect(handle.seekBoundary.mock.calls.length).toBeGreaterThan(0);
    // 원 경계에는 채움도 앞선도 전기 가늘어짐도 없다(손잡이 기본값: 채움 0, 앞선 0, 전기 1).
    for (const call of handle.seekBoundary.mock.calls as unknown[][]) expect(call).toHaveLength(1);
    advance(2);
    handle.seekBoundary.mockClear();
    scrollAt(PREVIEW_AT);
    expect(handle.seekBoundary).toHaveBeenLastCalledWith(0, 0, 0, 1, 1);
    advance(.1 * PREVIEW_SECONDS);
    const [shell, fill, reveal, strands, ragged] = handle.seekBoundary.mock.calls.at(-1) as unknown as number[];
    expect(shell).toBeCloseTo(previewPhases(.1).shell, 3);
    expect(fill).toBeCloseTo(previewPhases(.1).fill, 3);
    expect(reveal).toBeCloseTo(previewPhases(.1).reveal, 3);
    expect(strands).toBe(1);
    expect(ragged).toBe(1);
    expect(fill).toBeGreaterThan(0);
    advance(.3 * PREVIEW_SECONDS);
    const [later, full] = handle.seekBoundary.mock.calls.at(-1) as unknown as [number, number];
    expect(later).toBeCloseTo(previewPhases(.4).shell, 3);
    expect(full).toBe(1);
    // 모양의 일그러짐은 정착 전에 0이 되어 정착한 상자가 정확하다.
    advance(.45 * PREVIEW_SECONDS);
    expect((handle.seekBoundary.mock.calls.at(-1) as unknown as number[])[4]).toBe(0);
  });

  it('About에서 쉬는 동안 Projects 내용은 숨어 있고, 지점(Projects 잠금 - 화면 절반 - 15%)에서 한 번 재생해 프리뷰에 내려앉는다', () => {
    restAtAbout();
    expect(shown()).toEqual({ frame: '0', list: '0' });
    expect(frame.style.transform).toBe('');
    scrollAt(PREVIEW_AT - 1); expect(owners.at(-1)).toBe('about');
    scrollAt(PREVIEW_AT); expect(owners.at(-1)).toBe('preview');
    expect(handle.beginBoundary).toHaveBeenLastCalledWith(OVER);
    advance(PREVIEW_SECONDS - .02); expect(owners.at(-1)).toBe('preview');
    advance(.04); expect(owners.at(-1)).toBe('projects');
    expect(logo()).toEqual(PREVIEW_LOGO);
    expect(inner.style.opacity).toBe('0');
    expect(shown()).toEqual({ frame: '', list: '' });
    expect(frame.style.transform + frame.style.clipPath).toBe('');
    // 경로 지점에 닿지 않고 돌아서면 지점 24 위에서 돌아간다.
    scrollAt(PREVIEW_AT - 23); expect(owners.at(-1)).toBe('projects');
    scrollAt(PREVIEW_AT - 24); expect(owners.at(-1)).toBe('preview');
    advance(3); expect(owners.at(-1)).toBe('about');
    expect(logo()).toEqual(ABOUT_LOGO);
    expect(shown()).toEqual({ frame: '0', list: '0' });
  });

  // Task 5(사용자 요청 2026-10-24): 위로 갈 때 되돌기는 Projects 위끝이 header + (화면 - header) × .15 아래로 내려가는 스크롤에서 시작한다.
  // 경로(읽기선 .4)보다 덜 올라와도 돈다. 경로와 nav 표시는 그대로라 되돌기가 시작한 자리에서도 경로는 Projects다.
  // 되돌기 지점 = 1800 - (76 + (화면 - 76) × .15): 900에서 1600.4, 768에서 1620.2, 1080에서 1573.4. 모두 떠나는 지점보다 위다.
  it.each([[900, 1600, 1394, 1139], [768, 1620, 1447, 1224.8], [1080, 1573, 1322, 1022]])('화면 %i: 위로 갈 때 되돌기는 %i에서 시작하고(경로 지점 %i 위, 떠나는 지점 %d 위), 1–3px 떨림에는 다시 날지 않는다', (height, back, switchAt, departAt) => {
    viewport = height;
    restAtAbout();
    scrollAt(1800); advance(3); expect(owners.at(-1)).toBe('projects');
    let left = 0;
    let switched = 0;
    for (let y = 1799; y > 900 && !(left && switched); y--) {
      scrollAt(y);
      if (!left && owners.at(-1) !== 'projects') left = y;
      if (!switched && route(y) === 'about') switched = y;
    }
    expect({ left, switched }).toEqual({ left: back, switched: switchAt });
    expect(left).toBeGreaterThan(departAt);
    // 되돌기 지점에서 경로는 아직 Projects다(nav 규칙은 바뀌지 않았다).
    expect(route(back)).toBe('projects');
    scrollAt(1800); advance(3); expect(owners.at(-1)).toBe('projects');
    for (const y of [back + 1, back, back + 2, back + 1, back + 3]) scrollAt(y);
    expect(owners.at(-1)).toBe('preview');
    advance(3); expect(owners.at(-1)).toBe('about');
    for (const y of [back + 2, back + 3, back + 1, back + 4]) {
      scrollAt(y);
      expect(owners.at(-1)).toBe('about');
    }
    // 마지막으로 올라온 back + 1에서 4px 내려왔다(M4 Task 0의 늦춤).
    scrollAt(back + 5); expect(owners.at(-1)).toBe('preview');
    advance(3); expect(owners.at(-1)).toBe('projects');
  });

  // 떠나는 지점(previewAt)이 되돌기 지점에 닿는 화면에서는 되돌기 지점을 떠나는 지점 + 4(LOGO_SLACK) 위에 묶어 둘이 다투지 않는다.
  // About이 짧은 배치: Projects 1000, 잠금 924. 떠나는 지점 = max(About 잠금 824 + 1, 924 - 450 - 135) = 825. 묶지 않은 되돌기 지점 800.4는 그 아래다.
  it('되돌기 지점이 떠나는 지점에 닿으면 떠나는 지점 + 4 위로 묶는다', () => {
    place(projectsSection, { x: 0, y: 1000, w: 1440, h: 900 });
    create();
    scrollAt(1000); advance(5); expect(owners.at(-1)).toBe('projects');
    let left = 0;
    for (let y = 999; y > 700 && !left; y--) {
      scrollAt(y);
      if (owners.at(-1) !== 'projects') left = y;
    }
    // 1000 - 829 = 171이 묶인 되돌기 선이다. 위끝이 그 아래로 내려가는 첫 스크롤이 828이다.
    expect(left).toBe(828);
    expect(owners.at(-1)).toBe('preview');
    // 늦춤 안의 떨림에는 다시 날지 않고, 4px 내려오면 다시 난다.
    for (const y of [829, 830, 831]) {
      scrollAt(y);
      expect(owners.at(-1)).toBe('preview');
    }
    advance(3); expect(owners.at(-1)).toBe('about');
    scrollAt(832); expect(owners.at(-1)).toBe('preview');
  });

  it('외피: 지금 보이는 로고에서 시작해 가장 큰 면으로 한 번만 잡고, 이동·확장 뒤 면을 이루고, 프리뷰 상자·모서리에 정확히 정착한다', () => {
    restAtAbout();
    handle.beginBoundary.mockClear(); handle.endBoundary.mockClear();
    scrollAt(PREVIEW_AT);
    expect(handle.beginBoundary).toHaveBeenCalledTimes(1);
    // 출발은 About 로고 크기(앵커 × .7)의 타일이고 외피는 아직 로고 모양 그대로다(seek 0).
    expect(lastCall(handle.setBoundaryTarget)).toEqual({ width: 360 * ORBIT, height: 360 * ORBIT, radius: 360 * ORBIT * .3 });
    expect(lastCall(handle.seekBoundary)).toBe(0);
    expect(logo()).toEqual(ABOUT_LOGO);
    // 25%: host가 프리뷰 가운데에 닿았고 가로가 먼저 넓어진다.
    advance(.25 * PREVIEW_SECONDS);
    expect(logo()).toEqual(PREVIEW_LOGO);
    const wide = lastCall(handle.setBoundaryTarget) as { width: number; height: number };
    expect(wide.width).toBeGreaterThan(wide.height);
    // 옮겨 가는 동안 로고가 이미 넓어지는 타일로 풀리기 시작한다(headed Chrome에서 .08이면 로고 그대로였다).
    expect(lastCall(handle.seekBoundary) as number).toBeGreaterThan(.3);
    // 65%: 외피가 프리뷰보다 4% 큰 면을 이뤘다.
    advance(.4 * PREVIEW_SECONDS);
    const face = lastCall(handle.setBoundaryTarget) as { width: number; height: number; radius: number };
    expect(face.width).toBeCloseTo(OVER.width, 3); expect(face.height).toBeCloseTo(OVER.height, 3); expect(face.radius).toBeCloseTo(14, 3);
    expect(lastCall(handle.seekBoundary)).toBe(1);
    expect(inner.style.opacity).toBe('1');
    expect(owners.at(-1)).toBe('preview');
    advance(.35 * PREVIEW_SECONDS + .02);
    expect(lastCall(handle.setBoundaryTarget)).toEqual({ width: 640, height: 360, radius: 14 });
    expect(handle.endBoundary).toHaveBeenCalledTimes(1);
    expect(handle.beginBoundary).toHaveBeenCalledTimes(1);
    expect(owners.at(-1)).toBe('projects');
  });

  it('미디어·캡션은 외피와 같은 transform·clip 창으로 드러나고 목록이 같은 구간에 따라온다. 프리뷰 손잡이·미디어 겹은 건드리지 않는다', () => {
    restAtAbout();
    scrollAt(PREVIEW_AT);
    advance(.5 * PREVIEW_SECONDS);
    expect(shown()).toEqual({ frame: '0', list: '0' });
    // 숨은 틀은 옮기지 않는다. 안의 열기 단추가 보이지 않는 채 About 위로 오면 눌린다.
    expect(frame.style.transform + frame.style.clipPath).toBe('');
    advance(.25 * PREVIEW_SECONDS);
    // q = .75: 면은 프리뷰의 1.04배, 창의 모서리는 화면에서 14px이다.
    const box = lastCall(handle.setBoundaryTarget) as { width: number; height: number; radius: number };
    const [dx, dy, sx, sy] = numbers(frame.style.transform);
    expect([dx, dy]).toEqual([0, 0]);
    expect(sx).toBeCloseTo(box.width / 640, 4); expect(sy).toBeCloseTo(box.height / 360, 4);
    expect(frame.style.clipPath).toMatch(/^inset\(0px round [\d.]+px \/ [\d.]+px\)$/);
    const [rx, ry] = (frame.style.clipPath.match(/[\d.]+(?=px)/g) ?? []).slice(1).map(Number);
    expect(rx * sx).toBeCloseTo(box.radius, 2); expect(ry * sy).toBeCloseTo(box.radius, 2);
    expect(Number(shown().frame)).toBeGreaterThan(0); expect(Number(shown().frame)).toBeLessThan(1);
    expect(Number(shown().list)).toBeGreaterThan(0); expect(Number(shown().list)).toBeLessThan(Number(shown().frame));
    expect(preview.style.cssText + media.style.cssText).toBe('');
    expect(preview.dataset.flipId).toBe('pv-A');
    advance(1);
    expect(frame.style.cssText).toBe('border-top-left-radius: 14px;');
    expect(list.style.cssText + preview.style.cssText + media.style.cssText).toBe('');
  });

  it('되돌기는 같은 창을 거꾸로 밟는다: 시작 프레임에는 내용이 그대로이고 내용이 사라진 뒤 로고로 접혀 About에서 chapter 시간으로 돌아간다', () => {
    restAtAbout();
    scrollAt(1800); advance(3);
    handle.beginBoundary.mockClear(); handle.endBoundary.mockClear();
    scrollAt(1394);
    expect(owners.at(-1)).toBe('preview');
    expect(handle.beginBoundary).toHaveBeenCalledWith(OVER);
    expect(lastCall(handle.seekBoundary)).toBe(1);
    // 시작 프레임은 쉬는 자리 그대로다(쓴 값 없음).
    expect(shown()).toEqual({ frame: '', list: '' });
    expect(frame.style.transform + frame.style.clipPath).toBe('');
    advance(.2 * PREVIEW_RETURN_SECONDS);
    expect(Number(shown().list)).toBeLessThan(1);
    advance(.8 * PREVIEW_RETURN_SECONDS + .02);
    expect(owners.at(-1)).toBe('about');
    expect(lastCall(handle.seekBoundary)).toBe(0);
    expect(handle.endBoundary).toHaveBeenCalledTimes(1);
    expect(shown()).toEqual({ frame: '0', list: '0' });
  });

  it('도중에 되넘으면 보이는 그대로에서 거꾸로 돌고 지난 진행도만큼의 시간만 쓴다', () => {
    restAtAbout();
    scrollAt(PREVIEW_AT); advance(.7 * PREVIEW_SECONDS);
    const seen = () => ({ host: host.style.transform, inner: inner.style.opacity, frame: frame.style.cssText, list: list.style.opacity,
      seek: lastCall(handle.seekBoundary), target: lastCall(handle.setBoundaryTarget) });
    const before = seen();
    scrollAt(PREVIEW_AT - 24);
    expect(owners.at(-1)).toBe('preview');
    expect(seen()).toEqual(before);
    advance(.7 * PREVIEW_RETURN_SECONDS - .02); expect(owners.at(-1)).toBe('preview');
    advance(.04); expect(owners.at(-1)).toBe('about');
    expect(logo()).toEqual(ABOUT_LOGO);
  });

  it('날던 중의 크기 변화·refresh는 처음부터 다시 돌지 않고 다시 잰 프리뷰로 마저 간다', () => {
    restAtAbout();
    scrollAt(PREVIEW_AT); advance(.5 * PREVIEW_SECONDS);
    place(preview, { x: 100, y: 2000, w: 560, h: 315 });
    resize();
    motion!.refresh();
    expect(owners.at(-1)).toBe('preview');
    expect(handle.endBoundary).toHaveBeenCalledTimes(1);
    advance(.5 * PREVIEW_SECONDS + .02);
    expect(owners.at(-1)).toBe('projects');
    expect(logo()).toEqual({ x: 100 + 280 - 180, y: 2000 + 157.5 - 180, z: 0 });
    expect(lastCall(handle.setBoundaryTarget)).toEqual({ width: 560, height: 315, radius: 14 });
  });

  it('GL이 아직 준비되지 않은 방문은 정적으로 넘기고, 늦게 준비돼도 그 방문 도중에 외피를 끼우지 않는다. 다음 방문은 다시 잇는다', () => {
    restAtAbout();
    handle.beginBoundary.mockClear();
    handle.beginBoundary.mockReturnValueOnce(false);
    scrollAt(PREVIEW_AT);
    expect(owners.slice(-2)).toEqual(['about', 'projects']);
    expect(handle.beginBoundary).toHaveBeenCalledTimes(1);
    expect(shown()).toEqual({ frame: '', list: '' });
    expect(inner.style.opacity).toBe('0');
    // 이제 begin은 true를 돌려준다(늦은 onReady). 같은 방문 안에서는 다시 부르지 않는다.
    scrollAt(PREVIEW_AT + 100); advance(2);
    expect(handle.beginBoundary).toHaveBeenCalledTimes(1);
    expect(owners.at(-1)).toBe('projects');
    scrollAt(PREVIEW_AT - 24);
    expect(owners.at(-1)).toBe('preview');
    expect(handle.beginBoundary).toHaveBeenCalledTimes(2);
  });

  it('직접 해시(/#projects)와 모션 감소는 재생 없이 Projects 쉬는 자리이고 내용은 손대지 않는다', () => {
    documentY = 1800;
    create();
    expect(owners).toEqual(['none', 'projects']);
    expect(handle.beginBoundary).not.toHaveBeenCalled();
    expect(shown()).toEqual({ frame: '', list: '' });
    motion!.destroy(); owners.length = 0;
    create({ reduced: true });
    scrollAt(900); scrollAt(1800);
    expect(owners).toEqual(['none', 'projects', 'about', 'projects']);
    expect(handle.beginBoundary).not.toHaveBeenCalled();
    expect(shown()).toEqual({ frame: '', list: '' });
  });

  it('1024px 아래(GL 로고 없음)는 Projects 내용을 숨기지 않고 정적으로 넘긴다. GL 손잡이가 떠나면 쓴 값을 걷는다', () => {
    create({ logo: null });
    scrollAt(900); scrollAt(1800);
    expect(shown()).toEqual({ frame: '', list: '' });
    expect(owners).toEqual(['none']);
    motion!.setLogo(handle);
    scrollAt(900); advance(2);
    expect(shown()).toEqual({ frame: '0', list: '0' });
    scrollAt(PREVIEW_AT); advance(.8 * PREVIEW_SECONDS);
    motion!.setLogo(null);
    expect(frame.style.cssText).toBe('border-top-left-radius: 14px;');
    expect(list.style.cssText).toBe('');
  });

  it('Hero에서 Projects로 바로 가면 한 진행도로 About을 지나고, Hero 쪽 원 경계를 닫은 뒤 상자 경계를 잡는다', () => {
    create();
    scrollAt(1800);
    expect(owners.at(-1)).toBe('boundary');
    advance(LOGO_SECONDS + .1);
    expect(owners.at(-1)).toBe('preview');
    const order = [...handle.beginBoundary.mock.invocationCallOrder, ...handle.endBoundary.mock.invocationCallOrder].sort((a, b) => a - b);
    expect(order).toEqual([handle.beginBoundary.mock.invocationCallOrder[0], handle.endBoundary.mock.invocationCallOrder[0], handle.beginBoundary.mock.invocationCallOrder[1]]);
    expect(handle.beginBoundary).toHaveBeenLastCalledWith(OVER);
    advance(PREVIEW_SECONDS);
    expect(owners.slice(-1)).toEqual(['projects']);
    expect(owners).toEqual(['none', 'hero', 'boundary', 'preview', 'projects']);
  });

  // Task 1 리뷰 I1. ElectricLogo는 경계를 잡은 채 다시 begin하면 새로 잡지 않고 그 경계를 다시 겨누기만 한다(index.tsx beginBoundary).
  // 한 트윈이 About을 지나 반대쪽 구간으로 넘어갈 때 앞 구간의 경계를 먼저 닫지 않으면, 뒤의 end가 새 구간의 경계까지 지운다.
  // 상태를 가진 손잡이로 실제 begin·end 의미를 흉내 낸다.
  const stateful = () => {
    const log: string[] = [];
    let held = false;
    let applied = 0;
    let dropped = 0;
    const logo: ElectricLogoHandle = {
      beginBoundary: target => { log.push(held ? 'begin(reuse)' : `begin(${target.width === target.height ? 'circle' : 'box'})`); held = true; return true; },
      setBoundaryTarget: () => { if (held) applied++; else dropped++; },
      seekBoundary: () => { if (held) applied++; else dropped++; },
      endBoundary: () => { if (held) log.push('end'); held = false; },
    };
    return { logo, log, counts: () => ({ applied, dropped, held }) };
  };

  it('Projects에서 Hero까지 한 트윈으로 돌아가도 About을 지날 때 상자 경계를 먼저 닫고 Hero 쪽 원 경계를 새로 잡아 끝까지 쓴다', () => {
    const shell = stateful();
    documentY = 1800;
    create({ logo: shell.logo });
    expect(owners.at(-1)).toBe('projects');
    scrollAt(0);
    expect(owners.at(-1)).toBe('preview');
    advance(PREVIEW_RETURN_SECONDS + .1);
    expect(owners.at(-1)).toBe('boundary');
    expect(shell.log).toEqual(['begin(box)', 'end', 'begin(circle)']);
    expect(shell.counts().held).toBe(true);
    const before = shell.counts().dropped;
    advance(.5 * LOGO_SECONDS);
    expect(shell.counts().dropped).toBe(before);
    advance(LOGO_SECONDS);
    expect(owners.at(-1)).toBe('hero');
    expect(shell.log).toEqual(['begin(box)', 'end', 'begin(circle)', 'end']);
    expect(shell.counts()).toMatchObject({ held: false, dropped: before });
  });

  it('Hero에서 Projects까지 한 트윈으로 가도 원 경계를 먼저 닫고 상자 경계를 새로 잡는다', () => {
    const shell = stateful();
    create({ logo: shell.logo });
    scrollAt(1800);
    advance(LOGO_SECONDS + PREVIEW_SECONDS + .1);
    expect(owners.at(-1)).toBe('projects');
    expect(shell.log).toEqual(['begin(circle)', 'end', 'begin(box)', 'end']);
    expect(shell.counts()).toMatchObject({ held: false, dropped: 0 });
  });

  // Task 1 리뷰 I2. 되돌아온 About 쪽에서 숨은(불투명도 0) 프리뷰 열기 단추와 목록이 화면 아래쪽에 남아 눌렸다.
  // 숨은 동안은 포인터를 받지 않고, 키보드로 Projects 안에 포커스가 들어오면 재생 없이 Projects 쉬는 자리를 보인다.
  it('숨은 프리뷰 틀과 목록은 포인터를 받지 않고, 보이기 시작하면 받으며, 넘긴 뒤에는 쓴 값을 걷는다', () => {
    restAtAbout();
    expect([frame.style.pointerEvents, list.style.pointerEvents]).toEqual(['none', 'none']);
    scrollAt(PREVIEW_AT);
    advance(.75 * PREVIEW_SECONDS);
    expect([frame.style.pointerEvents, list.style.pointerEvents]).toEqual(['', '']);
    advance(1);
    expect(frame.style.cssText).toBe('border-top-left-radius: 14px;');
    expect(list.style.cssText).toBe('');
    scrollAt(1800); scrollAt(1394); advance(3);
    expect(owners.at(-1)).toBe('about');
    expect([frame.style.pointerEvents, list.style.pointerEvents]).toEqual(['none', 'none']);
  });

  // M4 Task 4. 프리뷰 그림(next/image의 img)이 받아져 있으면 GL 로고가 모양 안에 그린다. 아니면 그 방문은 Task 3의 빛 → 교차로 넘긴다.
  const withImage = (complete = true) => {
    const img = document.createElement('img');
    Object.defineProperties(img, {
      complete: { configurable: true, value: complete },
      naturalWidth: { configurable: true, value: complete ? 1280 : 0 }, naturalHeight: { configurable: true, value: complete ? 720 : 0 },
    });
    media.appendChild(img);
    return img;
  };

  it('그림이 있는 방문: 그림은 GL 모양 안에 그려지고, DOM 틀은 .94까지 숨은 채 .65부터 포인터만 받고, .94에 GL 캔버스 아래 서서 캔버스가 .94–1 동안 빠진다', () => {
    const img = withImage();
    restAtAbout();
    scrollAt(PREVIEW_AT);
    expect(lastCall(handle.setBoundaryTarget)).toMatchObject({ image: { source: img, width: OVER.width, height: OVER.height } });
    advance(.5 * PREVIEW_SECONDS);
    expect([frame.style.opacity, inner.style.opacity]).toEqual(['0', '1']);
    advance(.25 * PREVIEW_SECONDS);
    // q = .75: 그림은 GL이 그리고 있다. 틀은 보이지 않지만 같은 창(transform·clip)에 서서 누르면 프리뷰 클릭이다.
    expect([frame.style.opacity, frame.style.pointerEvents, inner.style.opacity]).toEqual(['0', '', '1']);
    expect(frame.style.transform).not.toBe('');
    expect(Number(list.style.opacity)).toBeGreaterThan(0);
    advance(.22 * PREVIEW_SECONDS);
    // q = .97: 정착이 끝나 그림은 프리뷰 상자에 그대로 있고, 전기는 다 사라졌다. DOM 틀(그림·캡션)은 캔버스 아래 다 섰고 캔버스가 반쯤 빠졌다.
    expect(lastCall(handle.setBoundaryTarget)).toEqual({ width: 640, height: 360, radius: 14, image: { source: img, width: 640, height: 360 } });
    expect((handle.seekBoundary.mock.calls.at(-1) as unknown[]).slice(2)).toEqual([1, 0, 0]);
    expect(frame.style.opacity).toBe('1');
    expect(Number(inner.style.opacity)).toBeCloseTo(1 - previewPhases(.97).handoff, 2);
    expect(Number(inner.style.opacity)).toBeGreaterThan(.3); expect(Number(inner.style.opacity)).toBeLessThan(.7);
    advance(.05 * PREVIEW_SECONDS);
    expect(owners.at(-1)).toBe('projects');
    expect([frame.style.cssText, inner.style.opacity]).toEqual(['border-top-left-radius: 14px;', '0']);
    // 되돌기: 시작 갱신은 쉬는 자리 그대로(DOM 틀). GL 캔버스가 틀 위로 다시 차오른 뒤(1–.94) 틀이 빠진다.
    scrollAt(1800); scrollAt(1394);
    expect(owners.at(-1)).toBe('preview');
    expect([frame.style.opacity, inner.style.opacity]).toEqual(['', '0']);
    expect(lastCall(handle.setBoundaryTarget)).toMatchObject({ image: { source: img } });
    // 되돌기는 1.4초 빠르기다(Task 5). 진행도 .03만큼 돌아온 자리가 넘김의 가운데다.
    advance(.03 * PREVIEW_RETURN_SECONDS);
    expect(frame.style.opacity).toBe('1');
    expect(Number(inner.style.opacity)).toBeGreaterThan(.3); expect(Number(inner.style.opacity)).toBeLessThan(.7);
    advance(.05 * PREVIEW_RETURN_SECONDS);
    expect([frame.style.opacity, inner.style.opacity]).toEqual(['0', '1']);
    advance(3);
    expect(owners.at(-1)).toBe('about');
    expect([frame.style.opacity, inner.style.opacity]).toEqual(['0', '1']);
  });

  // Task 4 리뷰 m2: 받아진 그림을 미리 풀어 둔다. 비행의 첫 GL 그리기가 동기 디코드를 하지 않는다. 그림이 바뀌면(load) 다시 푼다.
  it('프리뷰 그림은 받아져 있으면 만들 때, 새로 받아지면 그때 미리 디코드를 시작한다', () => {
    const img = withImage();
    const decode = vi.fn(() => Promise.resolve());
    Object.defineProperty(img, 'decode', { configurable: true, value: decode });
    restAtAbout();
    expect(decode).toHaveBeenCalledTimes(1);
    img.dispatchEvent(new Event('load'));
    expect(decode).toHaveBeenCalledTimes(2);
    // 실패한 디코드(오류 그림)는 조용히 넘긴다.
    decode.mockReturnValueOnce(Promise.reject(new Error('EncodingError')));
    img.dispatchEvent(new Event('load'));
    expect(decode).toHaveBeenCalledTimes(3);
  });

  it('그림이 아직 받아지지 않은 방문은 그림 없이 빛 → 교차로 넘기고, 도중에 받아져도 그 방문에는 끼우지 않는다. 다음 방문은 그린다', () => {
    const img = withImage(false);
    restAtAbout();
    scrollAt(PREVIEW_AT);
    expect(lastCall(handle.setBoundaryTarget)).not.toHaveProperty('image');
    Object.defineProperties(img, { complete: { value: true }, naturalWidth: { value: 1280 }, naturalHeight: { value: 720 } });
    advance(.75 * PREVIEW_SECONDS);
    expect(lastCall(handle.setBoundaryTarget)).not.toHaveProperty('image');
    const shownAt = Number(frame.style.opacity);
    expect(shownAt).toBeGreaterThan(0); expect(shownAt).toBeLessThan(1);
    expect(Number(inner.style.opacity)).toBeCloseTo(1 - shownAt, 12);
    advance(1);
    expect(owners.at(-1)).toBe('projects');
    scrollAt(1800); scrollAt(1394);
    expect(lastCall(handle.setBoundaryTarget)).toMatchObject({ image: { source: img } });
  });

  it('숨은 Projects 안으로 포커스가 들어오면(Tab) 재생 없이 Projects 쉬는 자리가 되어 내용이 보이고, 날던 되돌기도 그 자리에서 멈춘다', () => {
    restAtAbout();
    scrollAt(1800); scrollAt(1394); advance(3);
    handle.beginBoundary.mockClear();
    const tab = document.createElement('button');
    list.append(tab);
    tab.focus();
    expect(owners.at(-1)).toBe('projects');
    expect(frame.style.cssText).toBe('border-top-left-radius: 14px;');
    expect(list.style.cssText).toBe('');
    expect(inner.style.opacity).toBe('0');
    expect(handle.beginBoundary).not.toHaveBeenCalled();
    // 포커스가 머무는 동안 포커스가 선 자리에서 4px 넘게 올라가지 않는 잔 스크롤에는 다시 숨지 않는다.
    scrollAt(1396); scrollAt(1395);
    expect(owners.at(-1)).toBe('projects');
    // 되돌기 도중의 포커스도 같다.
    tab.blur();
    scrollAt(1800); scrollAt(1394); advance(.3 * PREVIEW_RETURN_SECONDS);
    expect(owners.at(-1)).toBe('preview');
    handle.endBoundary.mockClear();
    tab.focus();
    expect(owners.at(-1)).toBe('projects');
    expect(handle.endBoundary).toHaveBeenCalledTimes(1);
    expect(list.style.opacity + frame.style.opacity).toBe('');
  });

  // Task 1 재리뷰 N1. nav 도착은 섹션 자체(tabIndex -1)에 포커스를 준다(useSectionNav). 그 포커스나 비행 중의 포커스가 앞으로 가는 비행을 끊고
  // 쉬는 자리로 건너뛰게 하면 nav의 Projects가 변신을 재생하지 않는다. 드러내기는 숨은 컨트롤에 닿은 포커스에만, 날고 있지 않을 때만 한다.
  it('nav 도착의 섹션 포커스와 앞으로 가는 비행 중의 컨트롤 포커스는 비행을 끊지 않고 끝까지 재생한다', () => {
    restAtAbout();
    projectsSection.tabIndex = -1;
    const inner = projectsSection.querySelector('section')!;
    inner.tabIndex = -1;
    const tab = document.createElement('button');
    list.append(tab);
    scrollAt(1800);
    expect(owners.at(-1)).toBe('preview');
    advance(.3 * PREVIEW_SECONDS);
    projectsSection.focus();
    inner.focus();
    tab.focus();
    expect(owners.at(-1)).toBe('preview');
    advance(.7 * PREVIEW_SECONDS - .02);
    expect(owners.at(-1)).toBe('preview');
    advance(.04);
    expect(owners.at(-1)).toBe('projects');
  });

  it('About에서 쉬는 동안 Tab으로 Projects 컨트롤에 닿으면 드러나고, 섹션 자체의 포커스로는 드러나지 않는다', () => {
    restAtAbout();
    const inner = projectsSection.querySelector('section')!;
    inner.tabIndex = -1;
    inner.focus();
    expect(owners.at(-1)).toBe('about');
    expect(shown()).toEqual({ frame: '0', list: '0' });
    const tab = document.createElement('button');
    list.append(tab);
    tab.focus();
    expect(owners.at(-1)).toBe('projects');
    expect(shown()).toEqual({ frame: '', list: '' });
  });

  // Task 1 재리뷰 N2. Tab의 scroll-into-view가 컨트롤을 화면 아래 끝에 맞추면 스크롤이 프리뷰 지점 - 24 아래에 설 수 있다.
  // 포커스가 Projects 컨트롤 안에 있는 동안은 그 스크롤로 되돌지 않는다. 포커스가 떠나거나 경로 지점을 위로 넘으면 돌아간다.
  it('Projects 컨트롤에 포커스가 있는 동안 포커스가 부른 스크롤로는 되돌지 않고, 포커스가 떠난 뒤의 스크롤이나 경로 지점 위로 넘음에는 돌아간다', () => {
    restAtAbout();
    const tab = document.createElement('button');
    list.append(tab);
    tab.focus();
    expect(owners.at(-1)).toBe('projects');
    // Tab의 scroll-into-view는 아래로 간다. 그 자리(경로는 About)에서 1–2px 떨려도 그대로다.
    scrollAt(PREVIEW_AT - 100);
    expect(owners.at(-1)).toBe('projects');
    scrollAt(PREVIEW_AT - 102); scrollAt(PREVIEW_AT - 99);
    expect(owners.at(-1)).toBe('projects');
    tab.blur();
    scrollAt(PREVIEW_AT - 120);
    expect(owners.at(-1)).toBe('preview');
    advance(3);
    expect(owners.at(-1)).toBe('about');
    // 되돌기 지점(1600.4, Task 5) 위로 넘어가면 포커스가 남아 있어도 돌아간다. 경로는 아직 Projects다(포커스 머묾도 같은 지점을 본다).
    scrollAt(1800); advance(3);
    tab.focus();
    scrollAt(1602); scrollAt(1601);
    expect(owners.at(-1)).toBe('projects');
    scrollAt(1599);
    expect(route(1599)).toBe('projects');
    expect(owners.at(-1)).toBe('preview');
    expect(document.activeElement).not.toBe(tab);
  });

  // Task 1 재리뷰 N4. 풀림이 경로 지점을 넘는 한 프레임에만 걸려 있어, 경로가 이미 About인 자리에서 포커스를 얻은 뒤 위로 굴리면
  // 포커스가 떠날 때까지 Projects에 머물렀다. 풀림은 상태로 본다: 경로가 About이고 포커스가 선 자리(그 뒤 가장 아래)보다 위로 굴렸으면 돌아간다.
  it('경로가 About인 자리에서 포커스를 얻은 뒤 위로 굴리면 포커스가 남아 있어도 돌아가고, 맨 위까지 가면 Hero다', () => {
    restAtAbout();
    const tab = document.createElement('button');
    list.append(tab);
    tab.focus();
    expect(owners.at(-1)).toBe('projects');
    scrollAt(PREVIEW_AT - 100);
    scrollAt(PREVIEW_AT - 112);
    expect(owners.at(-1)).toBe('preview');
    advance(3);
    expect(owners.at(-1)).toBe('about');
    expect(shown()).toEqual({ frame: '0', list: '0' });
    tab.blur(); tab.focus();
    expect(owners.at(-1)).toBe('projects');
    scrollAt(0);
    advance(4);
    expect(owners.at(-1)).toBe('hero');
  });

  it('포커스가 Projects 컨트롤에 있어도 되돌기 지점에서 떨면 한 번 돌아간 뒤 4px 늦춤 안에서는 다시 날지 않는다', () => {
    restAtAbout();
    scrollAt(1800); advance(3);
    const tab = document.createElement('button');
    list.append(tab);
    tab.focus();
    for (const y of [1602, 1601]) scrollAt(y);
    expect(owners.at(-1)).toBe('projects');
    // Projects 위끝이 되돌기 선(.15) 아래로 내려가는 첫 스크롤에 돌아간다.
    scrollAt(1599);
    expect(owners.at(-1)).toBe('preview');
    for (const y of [1598, 1597, 1599, 1596]) {
      scrollAt(y);
      expect(owners.at(-1)).toBe('preview');
    }
    advance(3);
    expect(owners.at(-1)).toBe('about');
    scrollAt(1598); scrollAt(1599);
    expect(owners.at(-1)).toBe('about');
  });

  // Task 1 재리뷰 3. 머묾이 풀려 Projects가 다시 숨으면 포커스가 보이지 않는 컨트롤에 남았다(WCAG 2.4.7). 풀리는 프레임에 한 번 놓는다.
  it('머무는 동안은 포커스를 두고, 머묾이 풀려 Projects가 숨는 프레임에 숨은 컨트롤의 포커스를 놓는다', () => {
    restAtAbout();
    const tab = document.createElement('button');
    list.append(tab);
    tab.focus();
    scrollAt(PREVIEW_AT - 100);
    scrollAt(PREVIEW_AT - 102); scrollAt(PREVIEW_AT - 99);
    expect(owners.at(-1)).toBe('projects');
    expect(document.activeElement).toBe(tab);
    scrollAt(PREVIEW_AT - 112);
    expect(owners.at(-1)).toBe('preview');
    expect(document.activeElement).not.toBe(tab);
    // 다음 Tab은 그 자리에서 이어져 다시 드러낸다.
    advance(2);
    tab.focus();
    expect(owners.at(-1)).toBe('projects');
  });

  // Task 1 재리뷰 3 N5. 낮은 자리에서 포커스를 얻은 뒤 깊이 내려갔다가 한 번에 경로 지점 아래로 뛰어오르면, 포커스 자리 띠 안이라 머물렀다.
  it('포커스를 둔 채 깊이 내려갔다가 한 프레임에 경로가 About인 자리로 뛰어오르면 그 프레임에 돌아간다', () => {
    restAtAbout();
    const tab = document.createElement('button');
    list.append(tab);
    tab.focus();
    scrollAt(1800);
    expect(owners.at(-1)).toBe('projects');
    scrollAt(PREVIEW_AT - 100);
    expect(owners.at(-1)).toBe('preview');
    expect(document.activeElement).not.toBe(tab);
    // 경로는 Projects지만 되돌기 지점 위인 자리(1500)로 뛰어도 그 프레임에 돌아가고 포커스를 놓는다.
    advance(3);
    tab.focus();
    scrollAt(1800);
    expect(owners.at(-1)).toBe('projects');
    scrollAt(1500);
    expect(route(1500)).toBe('projects');
    expect(owners.at(-1)).toBe('preview');
    expect(document.activeElement).not.toBe(tab);
  });

  // M4 Task 2. 비행 중의 Projects 입력은 비행을 동기로 끝 자리에 놓은 뒤 원래 동작을 한다. 스크롤은 움직이지 않고, 새 비행도 예약하지 않는다.
  it('settleProjects: 앞으로 날던 비행을 같은 호출 안에서 Projects 쉬는 자리로 끝내고, 경계를 닫고 쓴 값을 걷는다. 스크롤은 그대로다', () => {
    restAtAbout();
    scrollAt(PREVIEW_AT); advance(.3 * PREVIEW_SECONDS);
    expect(owners.at(-1)).toBe('preview');
    handle.endBoundary.mockClear(); handle.beginBoundary.mockClear();
    motion!.settleProjects();
    expect(owners.at(-1)).toBe('projects');
    expect(logo()).toEqual(PREVIEW_LOGO);
    expect(inner.style.opacity).toBe('0');
    expect(handle.endBoundary).toHaveBeenCalledTimes(1);
    expect(frame.style.cssText).toBe('border-top-left-radius: 14px;');
    expect(list.style.cssText).toBe('');
    expect(documentY).toBe(PREVIEW_AT);
    // 남은 재생 시간이 흘러도 달라지는 것이 없다(트윈이 남지 않았다).
    advance(2);
    expect(owners.at(-1)).toBe('projects');
    expect(handle.endBoundary).toHaveBeenCalledTimes(1);
    expect(handle.beginBoundary).not.toHaveBeenCalled();
    expect(logo()).toEqual(PREVIEW_LOGO);
  });

  it('settleProjects 뒤에도 지점 규칙은 그대로다: 같은 자리의 스크롤은 다시 날지 않고, 지점 24 위로 되돌면 평소처럼 돌아간다', () => {
    restAtAbout();
    scrollAt(PREVIEW_AT); advance(.3 * PREVIEW_SECONDS);
    motion!.settleProjects();
    scrollAt(PREVIEW_AT + 1);
    expect(owners.at(-1)).toBe('projects');
    scrollAt(PREVIEW_AT - 24);
    expect(owners.at(-1)).toBe('preview');
    advance(3);
    expect(owners.at(-1)).toBe('about');
    expect(logo()).toEqual(ABOUT_LOGO);
  });

  it('settleProjects: 돌아가던 비행도 Projects 쪽 끝 자리로 놓는다', () => {
    restAtAbout();
    scrollAt(1800); advance(3); scrollAt(1394); advance(.3 * PREVIEW_RETURN_SECONDS);
    expect(owners.at(-1)).toBe('preview');
    motion!.settleProjects();
    expect(owners.at(-1)).toBe('projects');
    expect(list.style.cssText).toBe('');
    advance(2);
    expect(owners.at(-1)).toBe('projects');
  });

  // 리뷰 M3. 돌아가던 비행을 정착시킨 뒤의 첫 스크롤 틱은 평소 규칙을 따른다: Projects 컨트롤에 포커스가 없으면 About으로 다시 날고, 있으면 머문다.
  it.each([[false, 'preview'], [true, 'projects']])('settleProjects: 돌아가던 비행을 정착시킨 뒤 스크롤 틱 한 번은, 컨트롤 포커스 %s이면 %s', (focused, expected) => {
    restAtAbout();
    scrollAt(1800); advance(3); scrollAt(PREVIEW_AT - 100); advance(.3 * PREVIEW_RETURN_SECONDS);
    expect(owners.at(-1)).toBe('preview');
    if (focused) {
      const tab = document.createElement('button');
      list.append(tab);
      tab.focus();
    }
    motion!.settleProjects();
    expect(owners.at(-1)).toBe('projects');
    scrollAt(PREVIEW_AT - 101);
    expect(owners.at(-1)).toBe(expected);
    advance(3);
    expect(owners.at(-1)).toBe(focused ? 'projects' : 'about');
  });

  it('settleProjects: 날고 있지 않으면 아무것도 하지 않는다(About 쉬는 자리, Projects 쉬는 자리, GL 손잡이 없음)', () => {
    restAtAbout();
    motion!.settleProjects();
    expect(owners.at(-1)).toBe('about');
    expect(shown()).toEqual({ frame: '0', list: '0' });
    scrollAt(1800); advance(3);
    handle.endBoundary.mockClear();
    const count = owners.length;
    motion!.settleProjects();
    expect(owners).toHaveLength(count);
    expect(handle.endBoundary).not.toHaveBeenCalled();
    motion!.destroy();
    create({ logo: null });
    expect(() => motion!.settleProjects()).not.toThrow();
    expect(owners.at(-1)).toBe('none');
  });
});

// Task 9 리뷰 Minor 5. Hero에서는 로고 host가 숨어 있으니 포인터로 기울일 것이 없다. About에서도 기울지 않았다.
it('로고 host는 포인터에 기울지 않는다', () => {
  create();
  window.dispatchEvent(Object.assign(new MouseEvent('pointermove', { clientX: 1500, clientY: 0 }), { pointerType: 'mouse' }));
  advance(5);
  expect(inner.style.transform).toBe('');
  expect(gsap.getTweensOf(inner)).toHaveLength(0);
});
