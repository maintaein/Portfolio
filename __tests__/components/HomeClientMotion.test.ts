import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import type { ElectricLogoHandle } from '@/components/blocks/ElectricLogo';
import { createPortfolioMotion, type LogoOwner, type PortfolioMotion } from '@/components/sections/HomeClient/motion';

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

// 이름 글자 줄은 8em × 1.5em이다(nav 15px에서 120 × 22.5). 버튼 하나가 CSS 두 자리(data-wordmark-mode) 사이를 오간다.
// nav: nav-name 앵커(24, 16)에 fixed, 44px 최소 높이 가운데에 글자 줄. Hero: 자리 세로 가운데·Hero 가로 가운데(720).
const font = () => parseFloat(wordmark.style.fontSize) || (wordmark.dataset.wordmarkMode === 'nav' ? 15 : 88);
function layout() {
  const f = font();
  if (wordmark.dataset.wordmarkMode === 'nav') return { button: { x: 24, y: 16, w: 120, h: 44 }, label: { x: 24, y: 16 + (44 - 22.5) / 2, w: 120, h: 22.5 } };
  const label = { x: 720 - 4 * f, y: 266 - .75 * f - documentY, w: 8 * f, h: 1.5 * f };
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

// Hero는 76~900, About은 900부터. 로고는 About 머리가 화면 70%(900 - 630 = 270)를 지날 때 떠난다.
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

const create = (options: { logo?: ElectricLogoHandle | null; reduced?: boolean } = {}) => {
  motion = createPortfolioMotion({ root, header, wordmark, logoHost: host, reduced: options.reduced ?? false, onLogoOwnerChange: owner => owners.push(owner) });
  motion.setLogo(options.logo === undefined ? handle : options.logo);
  return motion;
};
const scrollAt = (y: number) => { documentY = y; window.dispatchEvent(new Event('scroll')); ScrollTrigger.update(); };
// 루트 시간을 지금에서 앞으로 민다. 재생은 시간으로만 간다. 테스트 사이 rAF 틱이 루트를 되돌려도 지금 기준이다.
const advance = (seconds: number) => gsap.updateRoot(gsap.globalTimeline.time() + seconds);
const numbers = (value: string) => (value.replace('translate3d', '').match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
// translate3d(x, y, 0) perspective(...) rotateX rotateY scale
const logo = () => { const [x, y, , , rx, ry, scale] = numbers(host.style.transform); return { x, y, rx, ry, scale }; };
const HERO_LOGO = { x: 960, y: 300, rx: 56, ry: -24, scale: 1 };
const ABOUT_LOGO = { x: 140, y: 1100, rx: 0, ry: 0, scale: 1 };
const expectNameAt = (mode: 'hero' | 'nav') => {
  expect(wordmark.dataset.wordmarkMode).toBe(mode);
  expect(wordmark.style.transform).toBe('');
  expect(gsap.getTweensOf(wordmark)).toHaveLength(0);
};

beforeEach(() => {
  documentY = 0; viewport = 900; letterSpacing = 0; owners.length = 0; observed = [];
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'pageYOffset', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewport });
  // 지점 검출 ScrollTrigger는 문서 끝(max)까지 본다. jsdom 문서는 높이가 0이다.
  for (const element of [document.documentElement, document.body]) Object.defineProperty(element, 'scrollHeight', { configurable: true, get: () => 5000 });
  // ScrollTrigger가 등록 때 matchMedia를 부른다. jsdom에는 없다.
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: false, media, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
  vi.stubGlobal('ResizeObserver', class { observe(element: Element) { observed.push(element); } disconnect() {} });
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
  });

  it('refresh는 재생하지 않고 다시 잰 지금 쪽 자리에 둔다. 날던 이름도 내려놓는다', () => {
    create();
    scrollAt(200); advance(.2);
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
    expect(host.style.transform).toBe('');
    scrollAt(0); scrollAt(300);
    expectNameAt('hero');
  });

  // 390px에서 넘치지 않는다. 자리 폭이 좁으면 높이 대신 폭에 맞춰 줄인다.
  it('이름 자리 폭이 좁으면 폭에 맞춰 줄인다', () => {
    place(heroName, { x: 24, y: 200, w: 300, h: 132 });
    create();
    expect(wordmark.style.fontSize).toBe('37.5px');
  });

  // 리뷰 Important 1. 넓고 낮은 화면(1280x720 실측)에서는 오브젝트 칸이 이름 높이까지 올라온다.
  // 눕힌 궤도의 보이는 고리는 앵커 상자 안쪽(왼쪽 18%, 위 28%, 아래 24%)에 있다. 이름은 그 상자에 닿지 않게 줄어든다.
  it('넓고 낮은 화면에서 이름 상자가 보이는 궤도 상자와 겹치지 않게 줄어든다', () => {
    place(heroObject, { x: 780, y: 150, w: 360, h: 360 });
    create();
    const ring = { l: 780 + .18 * 360, t: 150 + .28 * 360, b: 510 - .24 * 360 };
    const box = visual('label');
    expect(box.y < ring.b && box.y + box.h > ring.t).toBe(true);
    expect(box.x + box.w).toBeLessThanOrEqual(ring.l - 16 + 1e-6);
    expect(font()).toBeGreaterThan(1.5 * 15);
  });

  // tracking-widest는 마지막 글자 뒤에도 자간을 남긴다. 고리까지의 거리는 보이는 글자 폭으로 잰다.
  it('끝 자간을 빼고 보이는 글자 폭으로 고리 앞 크기를 잰다', () => {
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

describe('로고: About 머리가 화면 70%를 지나면 0.9초 이동', () => {
  it('Hero에서는 hero-object 앵커에 비스듬히, 지점(270)을 넘으면 0.9초 동안 About 앵커로 가며 정면으로 돈다', () => {
    create();
    expect(logo()).toEqual(HERO_LOGO);
    scrollAt(260);
    expect(logo()).toEqual(HERO_LOGO);
    scrollAt(300);
    expect(owners.at(-1)).toBe('boundary');
    advance(.45);
    const mid = logo();
    expect(mid.x).toBeLessThan(960); expect(mid.x).toBeGreaterThan(140);
    expect(mid.rx).toBeGreaterThan(0); expect(mid.rx).toBeLessThan(56);
    advance(.5);
    expect(logo()).toEqual(ABOUT_LOGO);
    expect(owners).toEqual(['none', 'hero', 'boundary', 'about']);
  });

  it('재생 중에 스크롤이 계속 움직여도 About 앵커(문서 좌표)에 정확히 내려앉는다', () => {
    create();
    scrollAt(300); advance(.3);
    scrollAt(600); advance(.2);
    scrollAt(808); advance(1);
    expect(logo()).toEqual(ABOUT_LOGO);
  });

  it('되넘으면 남은 거리만큼 거꾸로 돌고, 도중의 되넘음은 지금 자리에서 이어 간다', () => {
    create();
    scrollAt(300); advance(1);
    scrollAt(200);
    expect(owners.at(-1)).toBe('boundary');
    advance(.3);
    const mid = logo();
    scrollAt(300);
    expect(logo()).toEqual(mid);
    advance(1);
    expect(logo()).toEqual(ABOUT_LOGO);
    scrollAt(0); advance(1);
    expect(logo()).toEqual(HERO_LOGO);
    expect(owners.at(-1)).toBe('hero');
  });

  it('refresh는 Hero에 있는 동안 About 자리를 쓰지 않고, About에서는 다시 잰 앵커에 바로 둔다', () => {
    create();
    motion!.refresh();
    expect(logo()).toEqual(HERO_LOGO);
    scrollAt(808); advance(1);
    place(aboutLogo, { x: 180, y: 1140, w: 300, h: 300 });
    motion!.refresh();
    expect(logo()).toEqual({ ...ABOUT_LOGO, x: 180, y: 1140 });
    expect(host.style.width).toBe('300px');
  });

  it('창 크기 변화는 main뿐 아니라 앵커들도 지켜본다', () => {
    create();
    for (const element of [root, heroName, heroObject, aboutLogo]) expect(observed).toContain(element);
  });

  it('GL 손잡이가 없으면 host를 건드리지 않고, 오면 지금 쪽 자리에서 받아들인다', () => {
    create({ logo: null });
    scrollAt(808);
    expect(host.style.transform).toBe('');
    expect(owners).toEqual(['none']);
    motion!.setLogo(handle);
    expect(logo()).toEqual(ABOUT_LOGO);
    expect(owners).toEqual(['none', 'about']);
    motion!.setLogo(null);
    expect(host.style.transform).toBe('');
    expect(owners.at(-1)).toBe('none');
  });

  it('모션 감소는 바로 그쪽 자리로 바뀐다', () => {
    create({ reduced: true });
    scrollAt(808);
    expect(logo()).toEqual(ABOUT_LOGO);
    expect(owners).toEqual(['none', 'hero', 'about']);
  });

  it('chapter 로고가 바뀌어도 경계는 손잡이를 다시 부르지 않는다', () => {
    create();
    scrollAt(404); advance(1); scrollAt(808);
    expect(handle.beginBoundary).not.toHaveBeenCalled();
    expect(handle.seekBoundary).not.toHaveBeenCalled();
  });
});

describe('pointer 반응', () => {
  // jsdom에는 PointerEvent가 없다.
  const move = (clientX: number, clientY: number, pointerType: string) =>
    window.dispatchEvent(Object.assign(new MouseEvent('pointermove', { clientX, clientY }), { pointerType }));
  // quickTo(0.6초)가 끝나도록 루트 시간을 앞으로 민다.
  const settle = () => advance(5);
  const tilt = () => ({ rx: Number(gsap.getProperty(inner, 'rotationX')), ry: Number(gsap.getProperty(inner, 'rotationY')), x: Number(gsap.getProperty(inner, 'x')), y: Number(gsap.getProperty(inner, 'y')) });

  it('host 로컬 좌표로 바꾼 포인터에 안쪽만 ±8°·12px 기울고 문장은 그대로다', () => {
    create();
    const outer = host.style.transform;
    // host 가운데(1140, 480)에서 오른쪽 끝·위쪽 끝을 넘어간 자리.
    move(1500, 0, 'mouse');
    settle();
    expect(tilt()).toMatchObject({ rx: 8, ry: 8, x: 12, y: -12 });
    expect(host.style.transform).toBe(outer);
    expect(heroName.style.transform).toBe('');
    move(1230, 480, 'mouse');
    settle();
    expect(tilt().ry).toBeCloseTo(4, 3);
  });

  it('Hero를 떠나는 이동 동안 포인터 반응이 잦아들어 About에는 남지 않는다', () => {
    create();
    move(1500, 0, 'mouse');
    settle();
    // 이동이 끝나는 프레임에 기울기 0을 걸고, 그 quickTo가 다음 시간에 닿는다.
    scrollAt(300); settle(); settle();
    expect(tilt()).toMatchObject({ rx: 0, ry: 0, x: 0, y: 0 });
  });

  it('모션 감소는 포인터에 기울지 않는다', () => {
    create({ reduced: true });
    move(1500, 0, 'mouse');
    settle();
    expect(tilt().ry).toBe(0);
  });

  it('터치는 기울이지 않는다', () => {
    create();
    move(1500, 0, 'touch');
    settle();
    expect(tilt().ry).toBe(0);
  });
});
