import type { ElectricLogoHandle } from '@/components/blocks/ElectricLogo';
import { gsap, registerScrollTrigger, ScrollTrigger, SITE_EASE } from '@/lib/gsap';

export type LogoOwner = 'hero' | 'about' | 'boundary' | 'none';

export interface PortfolioMotion {
  refresh(): void;
  setPaused(paused: boolean): void;
  setLogo(logo: ElectricLogoHandle | null): void;
  settleProjects(): void;
  destroy(): void;
}

// 경계는 스크롤을 따라 긁지 않는다. 지점을 넘으면 정해진 시간 동안 끝까지 돌고, 되넘으면 거꾸로 돈다(사용자 결정 2026-10-20).
// 이름: 휠 두 칸(200px)이면 nav로 간다. 120px 위로 올라와야 돌아와 문턱에서 떨지 않는다.
const NAME_DOWN = 180;
const NAME_UP = 120;
// 옛 Hyperspeed 워드마크 Flip과 같은 길이다.
const NAME_SECONDS = .5;
// 이름 글자 줄 높이(design-tokens.css .site-name line-height). Hero 자리 높이가 글자 크기의 이 배수다.
const NAME_LINE = 1.5;
const LOGO_SECONDS = .9;
// 로고 지점에서 멈춰도 내려앉은 로고 아래에 남는 여유(px).
const LOGO_MARGIN = 16;
const TILT_DEG = 8;
const SHIFT_PX = 12;
// Hero에서는 원자 궤도처럼 눕혀 보인다. 평면 캔버스라 크게 눕혀야 기울기가 읽힌다(cos 56° = .56).
const REST_X_DEG = 56;
const REST_Y_DEG = -24;
const PERSPECTIVE_PX = 900;
// 크리스털 볼은 Hero 앵커를 꽉 채우고 테두리 광휘가 앵커 폭의 이만큼 밖으로 나간다(볼 상자 = 앵커 + 광휘).
// shortcut: 쉬는 볼을 픽셀로 잰 고정 비율, 볼의 크기·광휘가 바뀌면 다시 잰다.
const BALL_GLOW = .1;
// 큰 이름과 볼 상자 사이에 남기는 거리(px).
const BALL_GAP = 16;

type Box = { x: number; y: number; w: number; h: number };
const EMPTY: Box = { x: 0, y: 0, w: 0, h: 0 };
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

// transform을 뺀 레이아웃 좌표. About 레일의 등장 transform이 잰 값을 흔들지 않는다.
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

export function createPortfolioMotion({ root, header, wordmark, logoHost, reduced, onLogoOwnerChange }: {
  root: HTMLElement; header: HTMLElement; wordmark: HTMLButtonElement; logoHost: HTMLElement; reduced: boolean;
  onLogoOwnerChange: (owner: LogoOwner) => void;
}): PortfolioMotion {
  registerScrollTrigger();
  const inner = logoHost.firstElementChild instanceof HTMLElement ? logoHost.firstElementChild : null;
  const label = wordmark.firstElementChild instanceof HTMLElement ? wordmark.firstElementChild : wordmark;
  const anchor = (name: string) => root.querySelector(`[data-motion-anchor="${name}"]`);
  // Hero 이름 글자 크기(0이면 CSS 값), nav 자리(화면 좌표), 로고가 떠나는 스크롤 지점, 두 로고 앵커(문서 좌표).
  let m = { nameSize: 0, nav: EMPTY, logoAt: Infinity, hero: EMPTY, about: EMPTY, origin: EMPTY };
  let side: 'hero' | 'nav' = 'hero';
  let flip: gsap.core.Tween | null = null;
  // 로고 진행도 t: 0 Hero, 1 About. 시간으로만 움직이고 goal은 지금 스크롤이 가리키는 쪽이다.
  const pose = { t: 0 };
  let goal = 0;
  let travel: gsap.core.Tween | null = null;
  let logo: ElectricLogoHandle | null = null;
  let owner: LogoOwner | null = null;
  let paused = false;
  let alive = true;
  let queued = 0;
  let weight = 1;
  const pointer = { x: 0, y: 0 };
  const centre = { x: 0, y: 0, r: 0 };
  let tilt: ((x: number, y: number) => void) | null = null;

  const measure = () => {
    const about = root.querySelector('[data-section="about"]');
    const heroObject = layoutBox(anchor('hero-object'));
    const aboutLogo = layoutBox(anchor('about-logo'));
    const slot = rectBox(anchor('hero-name'), window.scrollY);
    // 글자 폭은 글자 크기에 비례한다. em 단위로 재 두면 어느 쪽 자리에서 재도 같다. tracking-widest의 끝 자간은 보이는 폭에서 뺀다.
    const style = getComputedStyle(label);
    const font = parseFloat(style.fontSize) || 0;
    const width = font ? label.getBoundingClientRect().width / font : 0;
    const glyph = width - (font ? (parseFloat(style.letterSpacing) || 0) / font : 0);
    // 이름은 자리 왼쪽 끝에서 시작한다. 이름 자리와 같은 높이에 오른쪽 볼이 있으면(1024px부터) 글자 오른쪽 끝이 볼 상자 앞에서 멈추게 줄인다.
    const glow = heroObject.w * BALL_GLOW;
    const ball = { x: heroObject.x - glow, top: heroObject.y - glow, bottom: heroObject.y + heroObject.h + glow };
    const besideBall = heroObject.w > 0 && ball.x > slot.x && slot.y < ball.bottom && slot.y + slot.h > ball.top;
    const ballRoom = besideBall && glyph > 0 ? (ball.x - BALL_GAP - slot.x) / glyph : Infinity;
    // 자리 높이(글자 줄)와 자리 폭에 맞추되 볼에 닿지 않는다. 잴 수 없으면 CSS 크기를 둔다.
    const size = width > 0 ? Math.max(1, Math.min(slot.h / NAME_LINE, slot.w / width, ballRoom)) : 0;
    const target = aboutLogo.w ? aboutLogo : heroObject;
    // 로고 지점: 그 자리에서 멈춰도 내려앉은 About 로고가 화면 안에 다 드는 첫 스크롤. 크기마다 앵커로 다시 잰다.
    // 두 로고 앵커 사이가 화면 높이만큼 멀어 두 끝을 함께 다 보일 수는 없다. 1440x900에서 About 머리가 화면 3분의 1쯤일 때다.
    // 이름 문턱보다 아래, About 잠금 자리보다 위에 둔다.
    const landed = target.y + target.h + LOGO_MARGIN - window.innerHeight;
    const lock = about ? about.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(about).scrollMarginTop) || header.offsetHeight) : Infinity;
    m = {
      nameSize: size, nav: rectBox(header.querySelector('[data-motion-anchor="nav-name"]')),
      logoAt: Math.min(lock - 1, Math.max(NAME_DOWN, landed)),
      hero: heroObject, about: target, origin: layoutBox(logoHost.offsetParent),
    };
    if (m.about.w) {
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

  // 이름의 두 쉬는 자리는 CSS 배치(data-wordmark-mode)다. Hero는 자리 왼쪽 끝(문장과 같은 끝), nav는 nav-name 앵커에 fixed로 선다.
  // 쉬는 동안 transform이 없어 누르는 상자가 보이는 글자 줄 상자다.
  const applyName = () => {
    wordmark.dataset.wordmarkMode = side;
    wordmark.style.fontSize = side === 'hero' && m.nameSize ? `${m.nameSize}px` : '';
    wordmark.style.left = side === 'nav' ? `${m.nav.x}px` : '';
    wordmark.style.top = side === 'nav' ? `${m.nav.y}px` : '';
  };
  const stopName = () => {
    flip?.kill();
    flip = null;
    gsap.set(wordmark, { clearProps: 'transform,transformOrigin,zIndex' });
  };
  // 넘을 때만 0.5초 동안 옮긴다(FLIP). 버튼 상자는 nav의 44px 최소 높이 때문에 두 자리의 가로세로 비가 달라
  // 상자끼리 맞추면 글자가 눌린다. 그래서 글자 줄 상자로 한 배율을 잰다. 도중에 되넘으면 지금 보이는 자리에서 다시 출발한다.
  const placeName = (next: 'hero' | 'nav', animate: boolean) => {
    const from = animate && !reduced && next !== side ? label.getBoundingClientRect() : null;
    stopName();
    side = next;
    applyName();
    if (!from) return;
    const to = label.getBoundingClientRect();
    const box = wordmark.getBoundingClientRect();
    const scale = to.height ? from.height / to.height : 1;
    gsap.set(wordmark, { zIndex: 51 });
    flip = gsap.fromTo(wordmark,
      { x: from.left - box.left - scale * (to.left - box.left), y: from.top - box.top - scale * (to.top - box.top), scale, transformOrigin: '0 0' },
      { x: 0, y: 0, scale: 1, duration: NAME_SECONDS, ease: SITE_EASE, onComplete: stopName });
  };

  // 문서 좌표의 두 앵커 사이를 진행도로 잇는다. host가 문서 좌표에 살아 재생 중에 스크롤이 움직여도 About 앵커에 정확히 내려앉는다.
  const renderLogo = () => {
    if (!logo) {
      report('none');
      return;
    }
    const { t } = pose;
    const { hero, about, origin } = m;
    const x = lerp(hero.x + hero.w / 2, about.x + about.w / 2, t);
    const y = lerp(hero.y + hero.h / 2, about.y + about.h / 2, t);
    const scale = lerp(hero.w, about.w, t) / (about.w || 1);
    const lean = 1 - t;
    logoHost.style.transform = `translate3d(${x - about.w / 2 - origin.x}px, ${y - about.h / 2 - origin.y}px, 0) perspective(${PERSPECTIVE_PX}px) rotateX(${REST_X_DEG * lean}deg) rotateY(${REST_Y_DEG * lean}deg) scale(${scale})`;
    Object.assign(centre, { x, y: y - window.scrollY, r: about.w * scale / 2 });
    // 포인터 반응은 Hero에서만 산다. 떠나며 잦아든다.
    if (lean !== weight) {
      weight = lean;
      aim();
    }
    report(travel ? 'boundary' : t >= 1 ? 'about' : 'hero');
  };

  const moveLogo = (target: number, animate: boolean) => {
    if (target === goal) return;
    goal = target;
    travel?.kill();
    travel = null;
    if (!logo || !animate || reduced) pose.t = target;
    else {
      // 되돌아갈 때는 남은 거리만큼의 시간만 쓴다.
      travel = gsap.to(pose, {
        t: target, duration: LOGO_SECONDS * Math.abs(target - pose.t), ease: SITE_EASE, onUpdate: renderLogo,
        onComplete: () => { travel = null; renderLogo(); },
      });
    }
    renderLogo();
  };

  // 지금 스크롤이 가리키는 쪽. 이름은 두 문턱 사이에서 지금 자리를 지킨다.
  const nameSide = () => window.scrollY >= NAME_DOWN ? 'nav' : window.scrollY <= NAME_UP ? 'hero' : side;
  const logoSide = () => window.scrollY >= m.logoAt ? 1 : 0;

  const decide = () => {
    if (paused || !alive) return;
    const name = nameSide();
    if (name !== side) placeName(name, true);
    moveLogo(logoSide(), true);
  };

  // 크기·폰트가 바뀌면 앵커를 다시 재고 지금 쪽의 쉬는 자리에 둔다. 재생하지 않는다.
  const settle = () => {
    if (!alive) return;
    // 날던 이름의 배율이 측정에 섞이지 않게 먼저 내려놓는다.
    stopName();
    measure();
    placeName(nameSide(), false);
    goal = -1;
    moveLogo(logoSide(), false);
  };

  // 포인터는 host의 로컬 좌표로 바꿔 안쪽만 기울인다. host 이동과 같은 transform을 쓰지 않아 서로 덮지 않는다.
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !logo || !centre.r) return;
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
    if (inner && !reduced) {
      gsap.set(inner, { transformPerspective: PERSPECTIVE_PX });
      const options = { duration: .6, ease: 'power3' };
      const rx = gsap.quickTo(inner, 'rotationX', options);
      const ry = gsap.quickTo(inner, 'rotationY', options);
      const tx = gsap.quickTo(inner, 'x', options);
      const ty = gsap.quickTo(inner, 'y', options);
      tilt = (x, y) => { rx(-y * TILT_DEG); ry(x * TILT_DEG); tx(x * SHIFT_PX); ty(y * SHIFT_PX); };
    }
    // 지점 검출만 맡긴다. 새로 고침 중의 갱신은 넘음이 아니다.
    ScrollTrigger.create({
      start: 0, end: 'max',
      // isRefreshing은 런타임에 있지만 타입 선언에 빠져 있다.
      onUpdate: () => { if (!(ScrollTrigger as unknown as { isRefreshing?: boolean }).isRefreshing) decide(); },
      onRefresh: settle,
    });
  });
  // 처음 자리는 재생 없이 정한다. 문턱 아래로 바로 온 해시는 곧장 nav·About이다.
  settle();

  // 폰트, 창 크기, About 정적 배치 전환이 앵커를 옮긴다. main만 보면 크기가 같은 채 움직인 앵커를 놓친다. 다음 프레임에 한 번만 잰다.
  const queue = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; settle(); }); };
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queue);
  for (const element of [root, header, anchor('hero-name'), anchor('hero-object'), anchor('about-logo')]) if (element) resize?.observe(element);
  document.fonts?.ready.then(queue);
  if (!reduced) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }

  return {
    refresh: settle,
    setPaused: (next) => {
      paused = next;
      if (next || !alive) return;
      // 멈춘 사이 넘은 지점은 재생하지 않고 그쪽 자리에 둔다.
      if (nameSide() !== side) placeName(nameSide(), false);
      moveLogo(logoSide(), false);
    },
    // GL 손잡이가 오거나 떠날 때. 진행도는 그대로 두고 지금 자리에 놓는다.
    setLogo: (next) => {
      logo = next;
      if (!next) {
        travel?.kill();
        travel = null;
        pose.t = goal;
        logoHost.style.transform = '';
      }
      renderLogo();
    },
    // M4가 Projects 경계를 붙이기 전까지는 할 일이 없다.
    settleProjects: () => {},
    destroy: () => {
      alive = false;
      cancelAnimationFrame(queued);
      resize?.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      travel?.kill();
      stopName();
      context.revert();
      side = 'hero';
      m.nameSize = 0;
      applyName();
      logoHost.style.transform = '';
      logoHost.style.width = '';
      logoHost.style.height = '';
    },
  };
}
