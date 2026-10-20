import type { ElectricLogoHandle } from '@/components/blocks/ElectricLogo';
import { gsap, registerScrollTrigger, ScrollTrigger } from '@/lib/gsap';

export type LogoOwner = 'hero' | 'about' | 'boundary' | 'none';

export interface PortfolioMotion {
  refresh(): void;
  setPaused(paused: boolean): void;
  settleProjects(): void;
  destroy(): void;
}

// Hero→About 경계의 시안 비율이다. 실제 문서 거리 위의 진행도 p에 건다.
const POINTER_END = .2;
const NAME_START = .2;
const NAME_END = .5;
const TURN_END = .85;
// 85% 지점에 남겨 둔 거리. 마지막 15%에 BASICS 자리로 내려앉는다.
const SETTLE_SHARE = .08;
const TILT_DEG = 8;
const SHIFT_PX = 12;
// Hero에서는 원자 궤도처럼 눕혀 보인다. 평면 캔버스라 크게 눕혀야 기울기가 읽힌다(cos 56° = .56).
const REST_X_DEG = 56;
const REST_Y_DEG = -24;
// 85%에 남는 기울기 비율. 정면에 가깝게 다가간 뒤 마지막 15%에 정면이 된다.
const NEAR_FRONT = .12;
const PERSPECTIVE_PX = 900;

type Box = { x: number; y: number; w: number; h: number };
const EMPTY: Box = { x: 0, y: 0, w: 0, h: 0 };
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

// transform을 뺀 레이아웃 좌표. About 레일의 등장 transform이나 이름 이동이 잰 값을 흔들지 않는다.
// fixed 조상에서 사슬이 끝나므로 nav 안의 요소는 화면 좌표가 된다.
function layoutBox(element: Element | null): Box {
  if (!(element instanceof HTMLElement)) return EMPTY;
  let x = 0;
  let y = 0;
  for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y, w: element.offsetWidth, h: element.offsetHeight };
}

// 소수점까지 잰 상자. 이름은 여섯 배 가까이 커져 정수로 반올림된 offset의 0.5px이 3px로 벌어진다.
const rectBox = (element: Element | null, scroll = 0): Box => {
  if (!element) return EMPTY;
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top + scroll, w: rect.width, h: rect.height };
};

// 섹션 경계는 About 잠금·해시 이동과 같은 식(rect + scrollY, 반올림)으로 재야 도착 자리가 1px도 어긋나지 않는다.
const documentTop = (element: Element | null) => element ? Math.round(element.getBoundingClientRect().top + window.scrollY) : 0;

export function createPortfolioMotion({ root, header, wordmark, logoHost, logo, onLogoOwnerChange }: {
  root: HTMLElement; header: HTMLElement; wordmark: HTMLButtonElement;
  logoHost: HTMLElement; logo: ElectricLogoHandle | null;
  onLogoOwnerChange: (owner: LogoOwner) => void;
}): PortfolioMotion {
  registerScrollTrigger();
  const inner = logoHost.firstElementChild instanceof HTMLElement ? logoHost.firstElementChild : null;
  const anchor = (name: string) => root.querySelector(`[data-motion-anchor="${name}"]`);
  // Hero 정적 실루엣의 기울기. GL이 없는 폭과 GL이 뜨기 전에도 같은 비율로 정면을 향한다.
  const heroTilt = root.querySelector<HTMLElement>('[data-motion-anchor="hero-object"] .hero-object-tilt');
  const nameEase = gsap.parseEase('power2.inOut');
  const turnEase = gsap.parseEase('power2.inOut');
  const settleEase = gsap.parseEase('power2.out');
  // 이름: Hero에서 커지는 배율, 그때 보이는 글자 가운데가 올 Hero 가로 가운데, 배율 원점(버튼 가운데)과 거기서 본 글자 가운데.
  let m = { start: 0, end: 0, name: EMPTY, scale: 1, centreX: 0, pivot: { x: 0, y: 0 }, glyph: { x: 0, y: 0 }, hero: EMPTY, about: EMPTY, origin: EMPTY };
  let owner: LogoOwner | null = null;
  let paused = false;
  let alive = true;
  let queued = 0;
  let weight = 1;
  const pointer = { x: 0, y: 0 };
  const centre = { x: 0, y: 0, r: 0 };
  let tilt: ((x: number, y: number) => void) | null = null;
  let trigger: ScrollTrigger | null = null;

  const measure = () => {
    const hero = root.querySelector('[data-section="overview"]');
    const about = root.querySelector('[data-section="about"]');
    const heroBox = hero?.getBoundingClientRect();
    // 떠나는 Hero의 끝이 화면 아래에 닿을 때 시작한다.
    const start = Math.max(0, heroBox ? Math.round(heroBox.bottom + window.scrollY) - window.innerHeight : 0);
    // 도착하는 About이 헤더 아래에 닿을 때 끝난다. 여유는 해시 이동·About 잠금이 쓰는 scroll-margin-top과 같다.
    const margin = about ? parseFloat(getComputedStyle(about).scrollMarginTop) || header.offsetHeight : 0;
    const heroObject = layoutBox(anchor('hero-object'));
    const aboutLogo = layoutBox(anchor('about-logo'));
    const name = rectBox(anchor('hero-name'), window.scrollY);
    // 이름 버튼과 안쪽 글자(진입이 y를 쓴다)의 transform을 잠깐 걷고 잰다. 같은 동기 구간에서 되돌려 그려지지 않는다.
    const label = wordmark.firstElementChild instanceof HTMLElement ? wordmark.firstElementChild : wordmark;
    const saved = [wordmark.style.transform, label.style.transform];
    wordmark.style.transform = label.style.transform = '';
    const button = rectBox(wordmark);
    const text = rectBox(label);
    [wordmark.style.transform, label.style.transform] = saved;
    // 자리 높이에 글자 줄을 맞추되 자리 폭을 넘지 않는다. tracking-widest의 끝 자간은 가운데에서 뺀다.
    const scale = text.h && text.w ? Math.min(name.h / text.h, name.w / text.w) : 1;
    const trail = parseFloat(getComputedStyle(label).letterSpacing) || 0;
    const heroLayout = rectBox(hero);
    const pivot = { x: button.x + button.w / 2, y: button.y + button.h / 2 };
    m = {
      start, end: Math.max(start, documentTop(about) - margin),
      name, scale, centreX: heroLayout.x + heroLayout.w / 2,
      pivot, glyph: { x: text.x + (text.w - trail) / 2 - pivot.x, y: text.y + text.h / 2 - pivot.y },
      hero: heroObject, about: aboutLogo.w ? aboutLogo : heroObject, origin: layoutBox(logoHost.offsetParent),
    };
    if (logo && m.about.w) {
      logoHost.style.width = `${m.about.w}px`;
      logoHost.style.height = `${m.about.h}px`;
    }
  };

  const report = (next: LogoOwner) => {
    if (next === owner) return;
    owner = next;
    onLogoOwnerChange(next);
  };

  const aim = () => tilt?.(pointer.x * weight, pointer.y * weight);

  const render = () => {
    if (paused || !alive) return;
    const scroll = window.scrollY;
    const length = m.end - m.start;
    // 거리가 없으면 나누지 않고 도착 상태로 둔다. 1px 안쪽은 About 잠금 자리와 같은 도착이다.
    const p = length < 1 || scroll > m.end - 1 ? 1 : clamp((scroll - m.start) / length);
    const span = (from: number, to: number) => clamp((p - from) / (to - from));

    const named = nameEase(span(NAME_START, NAME_END));
    const { name, pivot, glyph } = m;
    // 0–20%는 이름이 Hero와 함께 흐르고 20–50%에 줄어들며 nav 자리로 간다. 배율은 버튼 가운데를 원점으로 건다.
    // 보이는 글자 가운데가 Hero 가로 가운데·자리 세로 가운데에서 nav 자리로 곧게 간다. 흰 광휘도 nav에 닿으며 꺼진다.
    const grow = lerp(m.scale, 1, named);
    const nameX = lerp(m.centreX, pivot.x + glyph.x, named) - pivot.x - grow * glyph.x;
    const nameY = lerp(name.y + name.h / 2 - scroll, pivot.y + glyph.y, named) - pivot.y - grow * glyph.y;
    wordmark.style.transform = named >= 1 ? '' : `translate3d(${nameX}px, ${nameY}px, 0) scale(${grow})`;
    wordmark.style.setProperty('--name-glow', named >= 1 ? '' : String(1 - named));

    const settled = settleEase(span(TURN_END, 1));
    const lean = (1 - (1 - NEAR_FRONT) * turnEase(span(NAME_END, TURN_END))) * (1 - settled);
    heroTilt?.style.setProperty('--hero-lean', String(lean));
    if (!logo) {
      report('none');
      return;
    }
    // 20%부터 About 로고 자리로 향하고, 50–85%에 정면으로 돌며 다가가 마지막 15%에 내려앉는다.
    const travel = (1 - SETTLE_SHARE) * turnEase(span(NAME_START, TURN_END)) + SETTLE_SHARE * settled;
    const { hero, about, origin } = m;
    // 20%까지는 화면에 붙어 있다. 문서 좌표라 경계 밖에서는 앵커와 함께 흐른다.
    const pinned = hero.y + clamp(scroll, m.start, m.end) - m.start;
    const x = lerp(hero.x + hero.w / 2, about.x + about.w / 2, travel);
    const y = lerp(pinned + hero.h / 2, about.y + about.h / 2, travel);
    const scale = lerp(hero.w, about.w, travel) / (about.w || 1);
    logoHost.style.transform = `translate3d(${x - about.w / 2 - origin.x}px, ${y - about.h / 2 - origin.y}px, 0) perspective(${PERSPECTIVE_PX}px) rotateX(${REST_X_DEG * lean}deg) rotateY(${REST_Y_DEG * lean}deg) scale(${scale})`;
    Object.assign(centre, { x, y: y - scroll, r: about.w * scale / 2 });

    const nextWeight = 1 - span(0, POINTER_END);
    if (nextWeight !== weight) {
      weight = nextWeight;
      aim();
    }
    report(p <= 0 ? 'hero' : p >= 1 ? 'about' : 'boundary');
  };

  // 포인터는 host의 로컬 좌표로 바꿔 안쪽만 기울인다. host 이동과 같은 transform을 쓰지 않아 서로 덮지 않는다.
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !centre.r) return;
    pointer.x = clamp((event.clientX - centre.x) / centre.r, -1, 1);
    pointer.y = clamp((event.clientY - centre.y) / centre.r, -1, 1);
    if (!paused) aim();
  };
  const onLeave = () => {
    pointer.x = 0;
    pointer.y = 0;
    aim();
  };

  const context = gsap.context(() => {
    if (logo && inner) {
      gsap.set(inner, { transformPerspective: PERSPECTIVE_PX });
      const options = { duration: .6, ease: 'power3' };
      const rx = gsap.quickTo(inner, 'rotationX', options);
      const ry = gsap.quickTo(inner, 'rotationY', options);
      const tx = gsap.quickTo(inner, 'x', options);
      const ty = gsap.quickTo(inner, 'y', options);
      tilt = (x, y) => { rx(-y * TILT_DEG); ry(x * TILT_DEG); tx(x * SHIFT_PX); ty(y * SHIFT_PX); };
    }
    measure();
    // 문서 꼭대기부터 도착까지 본다. 키가 큰 Hero에서는 경계 전에도 이름이 Hero와 함께 흘러야 한다.
    // scrub: true와 같이 매끄럽게 하지 않고 실제 스크롤 위치를 그대로 쓴다.
    trigger = ScrollTrigger.create({
      start: 0,
      end: () => { measure(); return Math.max(1, m.end); },
      onUpdate: render,
      onRefresh: render,
    });
  });
  render();

  const refresh = () => {
    if (!alive) return;
    trigger?.refresh();
    render();
  };
  // 폰트, About 정적 배치 전환 같은 레이아웃 변화도 앵커를 옮긴다. 다음 프레임에 한 번만 잰다.
  const queue = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; refresh(); }); };
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queue);
  resize?.observe(root);
  document.fonts?.ready.then(queue);
  if (logo) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }

  return {
    refresh,
    setPaused: (next) => {
      paused = next;
      if (!next) render();
    },
    // M4가 Projects 경계를 붙이기 전까지는 할 일이 없다.
    settleProjects: () => {},
    destroy: () => {
      alive = false;
      cancelAnimationFrame(queued);
      resize?.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      context.revert();
      wordmark.style.transform = '';
      wordmark.style.removeProperty('--name-glow');
      heroTilt?.style.removeProperty('--hero-lean');
      logoHost.style.transform = '';
      logoHost.style.width = '';
      logoHost.style.height = '';
    },
  };
}
