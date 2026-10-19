import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import type { ElectricLogoHandle } from '@/components/blocks/ElectricLogo';
import { createPortfolioMotion, type LogoOwner, type PortfolioMotion } from '@/components/sections/HomeClient/motion';

// jsdom에는 레이아웃이 없어 실제 브라우저가 줄 offset 값을 요소마다 심는다.
type Box = { x: number; y: number; w: number; h: number };
function place(element: HTMLElement, { x, y, w, h }: Box, parent: HTMLElement | null = null) {
  Object.defineProperties(element, {
    offsetLeft: { configurable: true, get: () => x }, offsetTop: { configurable: true, get: () => y },
    offsetWidth: { configurable: true, get: () => w }, offsetHeight: { configurable: true, get: () => h },
    offsetParent: { configurable: true, get: () => parent },
  });
  element.getBoundingClientRect = () => ({ left: x, top: y - (parent ? 0 : documentY), width: w, height: h, right: x + w, bottom: y + h - documentY, x, y, toJSON: () => ({}) }) as DOMRect;
}

let documentY = 0;
let viewport = 900;
const handle = { beginBoundary: vi.fn(() => true), setBoundaryTarget: vi.fn(), seekBoundary: vi.fn(), endBoundary: vi.fn() } satisfies ElectricLogoHandle;
let root: HTMLElement; let header: HTMLElement; let wordmark: HTMLButtonElement; let host: HTMLElement; let inner: HTMLElement;
let heroName: HTMLElement; let heroObject: HTMLElement; let aboutLogo: HTMLElement; let hero: HTMLElement; let about: HTMLElement;
let motion: PortfolioMotion | null = null;
const owners: LogoOwner[] = [];

// Hero는 76~900, About은 900부터. 도착은 헤더 아래 16px 여유(scroll-margin-top 92) 자리 808이다.
function build() {
  document.body.innerHTML = `
    <nav><div data-motion-anchor="nav-name"><button>KIM TAEIN</button></div></nav>
    <main>
      <section data-section="overview"><div data-motion-anchor="hero-object"></div><div data-motion-anchor="hero-name"></div></section>
      <div data-section="about"><div data-motion-anchor="about-logo"></div></div>
      <div data-logo-host><div></div></div>
    </main>`;
  header = document.querySelector('nav')!; wordmark = document.querySelector('button')!; root = document.querySelector('main')!;
  host = document.querySelector('[data-logo-host]')!; inner = host.firstElementChild as HTMLElement;
  hero = document.querySelector('[data-section="overview"]')!; about = document.querySelector('[data-section="about"]')!;
  heroName = document.querySelector('[data-motion-anchor="hero-name"]')!;
  heroObject = document.querySelector('[data-motion-anchor="hero-object"]')!;
  aboutLogo = document.querySelector('[data-motion-anchor="about-logo"]')!;
  place(header, { x: 0, y: 0, w: 1440, h: 76 });
  place(wordmark, { x: 24, y: 16, w: 120, h: 44 }, header);
  place(root, { x: 0, y: 0, w: 1440, h: 5000 });
  place(hero, { x: 0, y: 76, w: 1440, h: 824 });
  place(about, { x: 0, y: 900, w: 1440, h: 900 });
  place(heroName, { x: 600, y: 200, w: 300, h: 44 });
  place(heroObject, { x: 120, y: 300, w: 360, h: 360 });
  place(aboutLogo, { x: 140, y: 1100, w: 360, h: 360 });
  place(host, { x: 0, y: 0, w: 360, h: 360 }, root);
}

const create = (logo: ElectricLogoHandle | null = handle) => {
  motion = createPortfolioMotion({ root, header, wordmark, logoHost: host, logo, onLogoOwnerChange: owner => owners.push(owner) });
  return motion;
};
const scrollAt = (y: number) => { documentY = y; window.dispatchEvent(new Event('scroll')); ScrollTrigger.update(); };
const numbers = (value: string) => (value.replace('translate3d', '').match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const name = () => numbers(wordmark.style.transform).slice(0, 2);
// translate3d(x, y, 0) perspective(...) rotateX rotateY scale
const logo = () => { const [x, y, , , rx, ry, scale] = numbers(host.style.transform); return { x, y, rx, ry, scale }; };

beforeEach(() => {
  documentY = 0; viewport = 900; owners.length = 0;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'pageYOffset', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewport });
  // ScrollTrigger가 등록 때 matchMedia를 부른다. jsdom에는 없다.
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: false, media, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
  const computed = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => element === about ? { scrollMarginTop: '92px' } as CSSStyleDeclaration : computed(element));
  build();
});
afterEach(() => { motion?.destroy(); motion = null; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Hero→About 경계', () => {
  it('Hero에서는 이름이 hero-name 앵커에, 로고가 hero-object 앵커에 비스듬히 앉는다', () => {
    create();
    // 이름: 왼쪽 끝을 맞추고 세로 가운데를 맞춘다. (600-24, 222-38)
    expect(name()).toEqual([576, 184]);
    expect(logo()).toMatchObject({ x: 120, y: 300, scale: 1 });
    expect(logo().ry).toBeLessThan(0);
    expect(owners).toEqual(['hero']);
  });

  it('0–20%는 이름이 문서와 함께 흐르고, 20–50%에 nav에 닿는다', () => {
    create();
    scrollAt(808 * .2);
    expect(name()[0]).toBe(576);
    expect(name()[1]).toBeCloseTo(184 - 161.6, 1);
    scrollAt(808 * .35);
    expect(name()[0]).toBeGreaterThan(0); expect(name()[0]).toBeLessThan(576);
    scrollAt(808 * .5);
    expect(wordmark.style.transform).toBe('');
    expect(owners).toEqual(['hero', 'boundary']);
  });

  it('50%까지 로고는 화면에 붙어 있고 50–85%에 정면으로 돌며 About에 다가가 100%에 BASICS 자리에 앉는다', () => {
    create();
    scrollAt(404);
    // 문서 좌표 300+404: 화면에서는 처음 자리 그대로다.
    expect(logo()).toMatchObject({ x: 120, y: 704 });
    const rest = logo().ry;
    scrollAt(808 * .85);
    expect(logo().ry).toBeCloseTo(0, 5);
    expect(logo().y).toBeGreaterThan(1050); expect(logo().y).toBeLessThan(1100);
    scrollAt(808);
    expect(logo()).toMatchObject({ x: 140, y: 1100, rx: 0, ry: 0, scale: 1 });
    expect(rest).toBeLessThan(0);
    expect(owners).toEqual(['hero', 'boundary', 'about']);
  });

  it('지나친 뒤에도 About 앵커에 남고, 되감으면 같은 길로 Hero에 돌아온다', () => {
    create();
    scrollAt(2400);
    expect(logo()).toMatchObject({ x: 140, y: 1100 });
    expect(wordmark.style.transform).toBe('');
    scrollAt(404); expect(logo()).toMatchObject({ x: 120, y: 704 });
    scrollAt(0);
    expect(name()).toEqual([576, 184]);
    expect(logo()).toMatchObject({ x: 120, y: 300 });
    expect(owners).toEqual(['hero', 'about', 'boundary', 'hero']);
  });

  it('Hero가 화면보다 길면 Hero 끝이 화면 아래에 닿을 때 시작하고 그 전에는 이름이 문서와 함께 흐른다', () => {
    place(hero, { x: 0, y: 76, w: 1440, h: 1224 }); place(about, { x: 0, y: 1300, w: 1440, h: 900 });
    place(aboutLogo, { x: 140, y: 1500, w: 360, h: 360 });
    create();
    scrollAt(200);
    expect(name()).toEqual([576, -16]);
    expect(logo()).toMatchObject({ x: 120, y: 300 });
    expect(owners).toEqual(['hero']);
    // 시작 400, 도착 1208.
    scrollAt(400 + 808 * .5);
    expect(wordmark.style.transform).toBe('');
    expect(owners.at(-1)).toBe('boundary');
  });

  it('경계 거리가 없으면 나누지 않고 도착 상태로 둔다', () => {
    viewport = 92;
    create();
    expect(wordmark.style.transform).toBe('');
    expect(logo()).toMatchObject({ x: 140, y: 1100, ry: 0 });
    expect(host.style.transform).not.toContain('NaN');
    expect(owners).toEqual(['about']);
  });

  it('refresh는 지금 진행도를 지키고 실제 앵커를 다시 잰다', () => {
    create();
    scrollAt(808);
    place(aboutLogo, { x: 180, y: 1140, w: 300, h: 300 });
    motion!.refresh();
    expect(logo()).toMatchObject({ x: 180, y: 1140, scale: 1 });
    expect(host.style.width).toBe('300px');
  });

  it('멈춘 동안에는 쓰지 않고 풀리면 지금 자리로 맞춘다', () => {
    create();
    motion!.setPaused(true);
    scrollAt(808);
    expect(name()).toEqual([576, 184]);
    motion!.setPaused(false);
    expect(wordmark.style.transform).toBe('');
    expect(logo()).toMatchObject({ x: 140, y: 1100 });
  });

  it('GL 손잡이가 없으면 로고 host는 건드리지 않고 이름 채널만 돈다', () => {
    create(null);
    expect(name()).toEqual([576, 184]);
    expect(host.style.transform).toBe('');
    expect(owners).toEqual(['none']);
  });

  it('destroy는 이름과 host를 정적 자리로 돌려놓고 더는 쓰지 않는다', () => {
    create();
    scrollAt(404);
    motion!.destroy(); motion = null;
    expect(wordmark.style.transform).toBe('');
    expect(host.style.transform).toBe('');
    scrollAt(0);
    expect(wordmark.style.transform).toBe('');
  });

  it('chapter 로고가 바뀌어도 경계는 손잡이를 다시 부르지 않는다', () => {
    create();
    scrollAt(404); scrollAt(808);
    expect(handle.beginBoundary).not.toHaveBeenCalled();
    expect(handle.seekBoundary).not.toHaveBeenCalled();
  });
});

describe('pointer 반응', () => {
  // jsdom에는 PointerEvent가 없다.
  const move = (clientX: number, clientY: number, pointerType: string) =>
    window.dispatchEvent(Object.assign(new MouseEvent('pointermove', { clientX, clientY }), { pointerType }));
  // quickTo(0.6초)가 끝나도록 루트 시간을 앞으로 민다.
  let ahead = 0;
  const settle = () => gsap.updateRoot(gsap.ticker.time + (ahead += 5));
  const tilt = () => ({ rx: Number(gsap.getProperty(inner, 'rotationX')), ry: Number(gsap.getProperty(inner, 'rotationY')), x: Number(gsap.getProperty(inner, 'x')), y: Number(gsap.getProperty(inner, 'y')) });

  it('host 로컬 좌표로 바꾼 포인터에 안쪽만 ±8°·12px 기울고 문장은 그대로다', () => {
    create();
    const outer = host.style.transform;
    // host 가운데(300, 480)에서 오른쪽 끝·위쪽 끝을 넘어간 자리.
    move(900, 0, 'mouse');
    settle();
    expect(tilt()).toMatchObject({ rx: 8, ry: 8, x: 12, y: -12 });
    expect(host.style.transform).toBe(outer);
    expect(heroName.style.transform).toBe('');
    move(390, 480, 'mouse');
    settle();
    expect(tilt().ry).toBeCloseTo(4, 3);
  });

  it('0–20% 사이에 포인터 반응이 잦아들어 20%에는 남지 않는다', () => {
    create();
    move(900, 0, 'mouse');
    settle();
    scrollAt(808 * .1); settle();
    expect(tilt().ry).toBeCloseTo(4, 3);
    scrollAt(808 * .2); settle();
    expect(tilt()).toMatchObject({ rx: 0, ry: 0, x: 0, y: 0 });
  });

  it('터치는 기울이지 않는다', () => {
    create();
    move(900, 0, 'touch');
    settle();
    expect(tilt().ry).toBe(0);
  });
});
