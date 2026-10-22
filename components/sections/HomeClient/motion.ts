import type { CrystalizedBallHandle } from '@/components/blocks/CrystalizedBall';
import type { ElectricLogoHandle } from '@/components/blocks/ElectricLogo';
import { gsap, registerScrollTrigger, ScrollTrigger, SITE_EASE } from '@/lib/gsap';
import { readingLineY } from '@/lib/utils/scrollGeometry';

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
// 크리스털 볼은 Hero 앵커를 꽉 채우고 테두리 광휘가 앵커 폭의 이만큼 밖으로 나간다(볼 상자 = 앵커 + 광휘).
// shortcut: 쉬는 볼을 픽셀로 잰 고정 비율, 볼의 크기·광휘가 바뀌면 다시 잰다.
const BALL_GLOW = .1;
// 큰 이름과 볼 상자 사이에 남기는 거리(px).
const BALL_GAP = 16;
// 볼에서 로고로의 변신(사용자 결정 2026-10-21, background_good.mp4 0–2초). 진행도 하나를 이 시간 동안 시간으로 돌린다.
// 사용자 요청(2026-10-22)으로 1.2초에서 25% 느리게 했다. 구간 비율은 진행도 기준이라 그대로다.
export const LOGO_SECONDS = 1.5;
// 로고는 About 본문이 나타나기 시작하는 스크롤 R보다 화면 높이의 이만큼 먼저 떠나 본문보다 먼저 내려앉는다.
// 1.2초 때의 .12에서 비행 시간과 같은 비율로 늘렸다. 앞섬 / 비행 시간(이보다 느리게 굴리면 R 전에 내려앉는 빠르기)이 같다.
const LOGO_LEAD = .15;
// 경로 지점(About→Overview)에 닿지 않고 돌아선 사람은 로고 지점에서 이만큼 위로 돌아오면 Hero로 되돌아간다(px).
// About 본문은 로고가 About을 떠나는 프레임까지 남는다(AboutSection).
const LOGO_BACK = 24;
// 볼이 접혀 드는 작은 고리의 지름(Hero 앵커 비율). 이 지름에서 Electric 원이 넘겨받는다.
export const CORE = .22;
// 원이 펼쳐지는 지름(About 앵커 비율). ElectricLogo가 로고를 그리는 크기(scale .7)와 같다.
export const ORBIT = .7;

type Box = { x: number; y: number; w: number; h: number };
const EMPTY: Box = { x: 0, y: 0, w: 0, h: 0 };
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
// 두 끝에서 정확히 from·to가 되는 꼴. 쉬는 자리의 값이 반올림 찌꺼기 없이 같다.
const lerp = (from: number, to: number, t: number) => from * (1 - t) + to * t;
const span = (from: number, to: number, p: number) => clamp((p - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
// power2.inOut. 참조의 접힘과 이동은 천천히 떠나 빨라졌다가 내려앉으며 느려진다.
const inOut = (t: number) => t < .5 ? 4 * t * t * t : 1 - (2 - 2 * t) ** 3 / 2;
const out = (t: number) => 1 - (1 - t) ** 3;

// 진행도 p(0 Hero의 쉬는 볼, 1 About에 내려앉은 로고)의 세 구간. 모든 값이 p만의 함수라 어디서 되돌아도 같은 길을 거꾸로 밟는다.
// 줄기 0–.42: 볼이 채워진 한 덩이로 제자리에서 작게 준다. 참조 1.23–1.70초, 판이 속까지 함께 작은 타일로 줄어든다.
// 빠짐 .3–.42: 그 끝에서만 속(먼지·안개·아이콘)이 고리 가운데로 빠진다. 참조 1.67–1.77초, 타일의 채움이 빠지고 기호만 남는다.
// 인계 .2–.42: 같은 지름의 Electric 원이 나타나고 볼이 사라진다.
// 이동 .36–.8: 작은 원이 About 앵커로 간다. 참조 1.77–1.97초. 펼침 .68–1: 원이 React 궤도로 풀리며 About 크기로 큰다. 참조 1.93–2.03초와 0.47–0.80초.
export function logoPhases(p: number) {
  const unfold = span(.68, 1, p);
  return {
    contract: inOut(span(0, .42, p)),
    drain: smooth(span(.3, .42, p)),
    ball: 1 - smooth(span(.28, .42, p)),
    logo: smooth(span(.2, .36, p)),
    travel: inOut(span(.36, .8, p)),
    grow: out(unfold),
    boundary: 1 - inOut(unfold),
  };
}

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

export function createPortfolioMotion({ root, header, wordmark, logoHost, ball, reduced, onLogoOwnerChange }: {
  root: HTMLElement; header: HTMLElement; wordmark: HTMLButtonElement; logoHost: HTMLElement; reduced: boolean;
  // GL 볼 손잡이(없으면 정적 볼). 볼은 진입 뒤에 늦게 떠서 ref로 받는다.
  ball?: { current: CrystalizedBallHandle | null };
  onLogoOwnerChange: (owner: LogoOwner) => void;
}): PortfolioMotion {
  registerScrollTrigger();
  const inner = logoHost.firstElementChild instanceof HTMLElement ? logoHost.firstElementChild : null;
  const label = wordmark.firstElementChild instanceof HTMLElement ? wordmark.firstElementChild : wordmark;
  const anchor = (name: string) => root.querySelector(`[data-motion-anchor="${name}"]`);
  // 볼은 Hero 앵커째로 접히고 옮긴다. 앵커는 offset으로 재므로 이 transform이 측정에 섞이지 않는다.
  const orb = anchor('hero-object');
  // Hero 이름 글자 크기(0이면 CSS 값), nav 자리(화면 좌표), 로고가 떠나는 스크롤 지점, 두 로고 앵커(문서 좌표).
  // aboutTop·line: useSectionNav가 About을 고르는 읽기선(About 위끝 <= 스크롤 + 읽기선).
  let m = { nameSize: 0, nav: EMPTY, logoAt: Infinity, aboutTop: Infinity, line: 0, hero: EMPTY, about: EMPTY, origin: EMPTY };
  let side: 'hero' | 'nav' = 'hero';
  let flip: gsap.core.Tween | null = null;
  // 로고 진행도 t: 0 Hero, 1 About. 시간으로만 움직이고 goal은 지금 스크롤이 가리키는 쪽이다.
  const pose = { t: 0 };
  let goal = 0;
  let travel: gsap.core.Tween | null = null;
  let logo: ElectricLogoHandle | null = null;
  // 날아가는 동안 ElectricLogo 경계(원)를 잡고 있는지.
  let bound = false;
  let owner: LogoOwner | null = null;
  let paused = false;
  let alive = true;
  let queued = 0;
  // 지난 판단의 스크롤. 로고 지점과 경로 지점 사이에서는 어느 쪽에서 들어왔는지로 정한다.
  let lastY = -Infinity;

  const measure = () => {
    const about = root.querySelector('[data-section="about"]');
    const heroObject = layoutBox(anchor('hero-object'));
    const aboutLogo = layoutBox(anchor('about-logo'));
    const slot = rectBox(anchor('hero-name'), window.scrollY);
    // 글자 폭은 글자 크기에 비례한다. em 단위로 재 두면 어느 쪽 자리에서 재도 같다. tracking-widest의 끝 자간은 보이는 폭에서 뺀다.
    const style = getComputedStyle(label);
    const font = parseFloat(style.fontSize) || 0;
    // 날고 있는 이름은 FLIP 배율(원점 왼쪽 위)이 실린 상자다. 배율을 덜어 쉬는 글자 폭을 잰다.
    const flying = flip ? Number(gsap.getProperty(wordmark, 'scaleX')) || 1 : 1;
    const width = font ? label.getBoundingClientRect().width / flying / font : 0;
    const glyph = width - (font ? (parseFloat(style.letterSpacing) || 0) / font : 0);
    // 이름은 자리 왼쪽 끝에서 시작한다. 이름 자리와 같은 높이에 오른쪽 볼이 있으면(1024px부터) 글자 오른쪽 끝이 볼 상자 앞에서 멈추게 줄인다.
    const glow = heroObject.w * BALL_GLOW;
    const ball = { x: heroObject.x - glow, top: heroObject.y - glow, bottom: heroObject.y + heroObject.h + glow };
    const besideBall = heroObject.w > 0 && ball.x > slot.x && slot.y < ball.bottom && slot.y + slot.h > ball.top;
    const ballRoom = besideBall && glyph > 0 ? (ball.x - BALL_GAP - slot.x) / glyph : Infinity;
    // 자리 높이(글자 줄)와 자리 폭에 맞추되 볼에 닿지 않는다. 잴 수 없으면 CSS 크기를 둔다.
    const size = width > 0 ? Math.max(1, Math.min(slot.h / NAME_LINE, slot.w / width, ballRoom)) : 0;
    const target = aboutLogo.w ? aboutLogo : heroObject;
    // 로고 지점: About 본문은 잠금 자리에서 화면 절반 안(R = 잠금 - 화면 높이 / 2)에 들면 나타나기 시작한다(AboutSection).
    // 그보다 화면 높이의 15% 먼저 떠나 본문보다 먼저 내려앉는다. 이름 문턱보다 아래, About 잠금 자리보다 위에 둔다.
    // 두 앵커가 화면 높이만큼 떨어져 있어 이 지점에서 멈추면 비행이 화면 아래로 빠진다(받아들인 결정).
    const aboutTop = about ? about.getBoundingClientRect().top + window.scrollY : Infinity;
    const lock = aboutTop - (about ? parseFloat(getComputedStyle(about).scrollMarginTop) || header.offsetHeight : 0);
    const reveal = lock - window.innerHeight / 2;
    m = {
      nameSize: size, nav: rectBox(header.querySelector('[data-motion-anchor="nav-name"]')),
      logoAt: Math.min(lock - 1, Math.max(NAME_DOWN, reveal - LOGO_LEAD * window.innerHeight)),
      aboutTop, line: readingLineY(window.innerHeight, header.getBoundingClientRect().height),
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

  // 볼(Hero 앵커)과 로고 host를 진행도 하나로 쓴다. 둘 다 문서 좌표의 같은 길 위에 있어 재생 중에 스크롤이 움직여도 About 앵커에 정확히 내려앉는다.
  const clearOrb = () => {
    if (orb instanceof HTMLElement) Object.assign(orb.style, { transform: '', opacity: '' });
    ball?.current?.setCollapse(0);
  };
  const renderLogo = () => {
    if (!logo) {
      report('none');
      return;
    }
    const { t } = pose;
    const { hero, about, origin } = m;
    const phase = logoPhases(t);
    const from = { x: hero.x + hero.w / 2, y: hero.y + hero.h / 2 };
    const x = lerp(from.x, about.x + about.w / 2, phase.travel);
    const y = lerp(from.y, about.y + about.h / 2, phase.travel);
    const shrink = lerp(1, CORE, phase.contract);
    logoHost.style.transform = `translate3d(${x - about.w / 2 - origin.x}px, ${y - about.h / 2 - origin.y}px, 0)`;
    if (inner) inner.style.opacity = String(phase.logo);
    if (t <= 0) clearOrb();
    else {
      if (orb instanceof HTMLElement) Object.assign(orb.style, { transform: `translate(${x - from.x}px, ${y - from.y}px) scale(${shrink})`, opacity: String(phase.ball) });
      ball?.current?.setCollapse(phase.drain);
    }
    // 원은 볼 고리와 같은 화면 지름에서 넘겨받아(host는 About 크기 그대로라 컨테이너 px = 화면 px) 펼침 동안 로고 크기로 크며 풀린다.
    // 경계 캔버스 자리는 줄지 않으므로 가장 큰 원으로 한 번 잡는다. GL이 아직 그리지 않았으면 다음 프레임에 다시 잡는다.
    if (travel && !bound) {
      const size = Math.max(hero.w, about.w * ORBIT);
      bound = logo.beginBoundary({ width: size, height: size, radius: size / 2 });
    }
    if (bound) {
      const ring = lerp(hero.w * shrink, about.w * ORBIT, phase.grow);
      logo.setBoundaryTarget({ width: ring, height: ring, radius: ring / 2 });
      logo.seekBoundary(phase.boundary);
      if (!travel) {
        logo.endBoundary();
        bound = false;
      }
    }
    report(travel ? 'boundary' : t >= 1 ? 'about' : 'hero');
  };

  const moveLogo = (target: number, animate: boolean) => {
    if (target === goal) return;
    goal = target;
    travel?.kill();
    travel = null;
    // 남은 길이 0이면 길이 0 트윈이 만들어지는 중에 끝나 travel에 끝난 트윈이 남는다(경계에 멈춘다). 날기 시작한 프레임에 되돌 때다.
    if (!logo || !animate || reduced || pose.t === target) pose.t = target;
    else {
      // 되돌아갈 때는 지난 진행도만큼의 시간만 쓴다. 진행도는 시간에 선형이고 구간마다 제 곡선을 쓴다(logoPhases).
      travel = gsap.to(pose, {
        t: target, duration: LOGO_SECONDS * Math.abs(target - pose.t), ease: 'none', onUpdate: renderLogo,
        onComplete: () => { travel = null; renderLogo(); },
      });
    }
    renderLogo();
  };

  // 지금 스크롤이 가리키는 쪽. 이름은 두 문턱 사이에서 지금 자리를 지킨다.
  const nameSide = () => window.scrollY >= NAME_DOWN ? 'nav' : window.scrollY <= NAME_UP ? 'hero' : side;
  // 위로 갈 때 되돌기는 경로가 About에서 Overview로 바뀌는 프레임에 시작한다(사용자 요청 2026-10-22). 경로 지점은 잰 화면 크기 모두에서 로고 지점보다 아래다.
  // 그 사이에서는 아래로 움직이면 About(첫 하강처럼 R 전에 내려앉는다), 경로 지점을 넘어 올라왔으면 Hero, 그 밖에는 지금 쪽이다.
  // 경로가 About이면 언제나 About이다. 부르는 곳 모두가 지난 스크롤 갱신을 원해 여기서 lastY를 바꾼다.
  const logoSide = () => {
    const y = window.scrollY;
    const was = lastY;
    lastY = y;
    const routed = (at: number) => m.aboutTop <= at + m.line;
    if (y >= m.logoAt && (routed(y) || y > was)) return 1;
    if (y <= m.logoAt - LOGO_BACK || (routed(was) && !routed(y))) return 0;
    return Math.max(0, goal);
  };

  const decide = () => {
    if (paused || !alive) return;
    const name = nameSide();
    if (name !== side) placeName(name, true);
    moveLogo(logoSide(), true);
  };

  // 크기·폰트가 바뀌면 앵커를 다시 잰다. 쉬는 이름·로고는 재생 없이 지금 쪽의 쉬는 자리에 둔다.
  // 날던 것은 끊지 않는다(M3 #12). 아래 섹션이 배치되며 main이 자라는 일이 잦아 도중에 툭 내려앉았다.
  // 이름은 쉬는 자리만 바뀌어 transform이 새 자리로 마저 줄고, 로고는 프레임마다 m을 다시 읽는다.
  const settle = () => {
    if (!alive) return;
    measure();
    const name = nameSide();
    if (!flip) placeName(name, false);
    else if (name !== side) placeName(name, true);
    else applyName();
    const next = logoSide();
    if (travel) {
      moveLogo(next, true);
      renderLogo();
      return;
    }
    // 두 문턱 사이에서는 지금 쪽을 지킨다. 같은 쪽이라도 다시 놓도록 goal을 비운다.
    goal = -1;
    moveLogo(next, false);
  };

  const context = gsap.context(() => {
    // 지점 검출만 맡긴다. 새로 고침 중의 갱신은 넘음이 아니다.
    ScrollTrigger.create({
      start: 0, end: 'max',
      // isRefreshing은 런타임에 있지만 타입 선언에 빠져 있다.
      onUpdate: () => { if (!(ScrollTrigger as unknown as { isRefreshing?: boolean }).isRefreshing) decide(); },
      onRefresh: settle,
    });
  });
  // 처음 자리는 재생 없이 정한다. 문턱 아래로 바로 온 해시는 곧장 nav·About이다.
  // 지점 검출이 만들어지며 잰 값 없이 부른 판단이 이름을 날리기 시작했을 수 있어 먼저 내려놓는다.
  stopName();
  settle();

  // 폰트, 창 크기, About 정적 배치 전환이 앵커를 옮긴다. main만 보면 크기가 같은 채 움직인 앵커를 놓친다. 다음 프레임에 한 번만 잰다.
  const queue = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; settle(); }); };
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queue);
  for (const element of [root, header, anchor('hero-name'), anchor('hero-object'), anchor('about-logo')]) if (element) resize?.observe(element);
  document.fonts?.ready.then(queue);

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
        bound = false;
        pose.t = goal;
        logoHost.style.transform = '';
        clearOrb();
      }
      renderLogo();
    },
    // M4가 Projects 경계를 붙이기 전까지는 할 일이 없다.
    settleProjects: () => {},
    destroy: () => {
      alive = false;
      cancelAnimationFrame(queued);
      resize?.disconnect();
      travel?.kill();
      stopName();
      context.revert();
      side = 'hero';
      m.nameSize = 0;
      applyName();
      logoHost.style.transform = '';
      logoHost.style.width = '';
      logoHost.style.height = '';
      if (inner) inner.style.opacity = '';
      clearOrb();
    },
  };
}
