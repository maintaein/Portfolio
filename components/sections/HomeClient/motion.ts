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
// Hero에서 정면을 보기 전의 기울기.
const REST_X_DEG = 6;
const REST_Y_DEG = -16;
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
  const nameEase = gsap.parseEase('power2.inOut');
  const turnEase = gsap.parseEase('power2.inOut');
  const settleEase = gsap.parseEase('power2.out');
  let m = { start: 0, end: 0, name: EMPTY, button: EMPTY, hero: EMPTY, about: EMPTY, origin: EMPTY };
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
    m = {
      start, end: Math.max(start, documentTop(about) - margin),
      name: layoutBox(anchor('hero-name')), button: layoutBox(wordmark),
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
    const { name, button } = m;
    // 0–20%는 이름이 Hero와 함께 흐르고 20–50%에 nav 자리로 간다.
    wordmark.style.transform = named >= 1 ? '' : `translate3d(${(name.x - button.x) * (1 - named)}px, ${(name.y + name.h / 2 - scroll - button.y - button.h / 2) * (1 - named)}px, 0)`;

    if (!logo) {
      report('none');
      return;
    }
    const turned = turnEase(span(NAME_END, TURN_END));
    const travel = (1 - SETTLE_SHARE) * turned + SETTLE_SHARE * settleEase(span(TURN_END, 1));
    const { hero, about, origin } = m;
    // 50%까지는 화면에 붙어 있고 그 뒤 About 앵커로 옮겨 간다. 문서 좌표라 경계 밖에서는 앵커와 함께 흐른다.
    const pinned = hero.y + clamp(scroll, m.start, m.end) - m.start;
    const x = lerp(hero.x + hero.w / 2, about.x + about.w / 2, travel);
    const y = lerp(pinned + hero.h / 2, about.y + about.h / 2, travel);
    const scale = lerp(hero.w, about.w, travel) / (about.w || 1);
    logoHost.style.transform = `translate3d(${x - about.w / 2 - origin.x}px, ${y - about.h / 2 - origin.y}px, 0) perspective(${PERSPECTIVE_PX}px) rotateX(${REST_X_DEG * (1 - turned)}deg) rotateY(${REST_Y_DEG * (1 - turned)}deg) scale(${scale})`;
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
      logoHost.style.transform = '';
      logoHost.style.width = '';
      logoHost.style.height = '';
    },
  };
}
