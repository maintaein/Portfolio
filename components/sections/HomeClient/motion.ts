import type { CrystalizedBallHandle } from '@/components/blocks/CrystalizedBall';
import type { ElectricLogoHandle } from '@/components/blocks/ElectricLogo';
import { GATHER_SECONDS } from '@/components/sections/ExperienceSection/lineMotion';
import type { ExperienceOverlay, GatherLetter } from '@/components/sections/ExperienceSection/overlay';
import { clearCaptionReveal, revealCaption } from '@/components/sections/ProjectsSection/captionReveal';
import { gsap, registerScrollTrigger, ScrollTrigger, SITE_EASE } from '@/lib/gsap';
import { readingLineY } from '@/lib/utils/scrollGeometry';

// boundary: Hero↔About 비행, preview: About↔Projects 비행, projects: 프리뷰에 넘기고 숨은 자리.
export type LogoOwner = 'hero' | 'about' | 'boundary' | 'preview' | 'projects' | 'none';

export interface PortfolioMotion {
  refresh(): void;
  setPaused(paused: boolean): void;
  setLogo(logo: ElectricLogoHandle | null): void;
  setOverlay(overlay: ExperienceOverlay | null): void;
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
// About 로고에서 프리뷰로 가는 구간(진행도 1–2)만의 시간. 사용자 요청(2026-10-23)으로 1.5초에서 2.1초로 늘렸다가, 2026-10-29 요청으로 1.8초로 줄였다.
export const PREVIEW_SECONDS = 1.8;
// 같은 구간을 거꾸로(프리뷰 그림 → 움직이는 로고) 도는 시간. 사용자 요청(2026-10-24)으로 되돌기만 빠르다. 떠나는 쪽이라 설명할 것이 없다.
export const PREVIEW_RETURN_SECONDS = 1.4;
// 처음 들어올 때 캡션이 들어오는 시간(M4 Task 14). 넘김(.94–1)은 0.13초뿐이라 그 안에는 잡음이 안 읽힌다. 넘김에서 시작해
// 도착 뒤 0.47초에 끝난다. 상세에서 돌아올 때(800ms)보다 짧은 것은 여기서는 그림이 이미 1초 넘게 자리를 잡아 온 끝이라서다.
const ENTRY_CAPTION_MS = 600;
// 진행도 t까지 오는 데 드는 시간(Hero 0에서). 1을 지나는 한 트윈도 구간마다 제 빠르기로 돈다. 진행도를 내려가는 트윈(back)은 프리뷰 구간을 되돌기 빠르기로 돈다.
const previewSeconds = (back: boolean) => back ? PREVIEW_RETURN_SECONDS : PREVIEW_SECONDS;
const secondsAt = (t: number, back: boolean) => LOGO_SECONDS * Math.min(t, 1) + previewSeconds(back) * Math.max(t - 1, 0);
const progressAt = (s: number, back: boolean) => s <= LOGO_SECONDS ? s / LOGO_SECONDS : 1 + (s - LOGO_SECONDS) / previewSeconds(back);
// 로고는 About 본문이 나타나기 시작하는 스크롤 R보다 화면 높이의 이만큼 먼저 떠나 본문보다 먼저 내려앉는다.
// 1.2초 때의 .12에서 비행 시간과 같은 비율로 늘렸다. 앞섬 / 비행 시간(이보다 느리게 굴리면 R 전에 내려앉는 빠르기)이 같다.
const LOGO_LEAD = .15;
// 경로 지점(About→Overview)에 닿지 않고 돌아선 사람은 로고 지점에서 이만큼 위로 돌아오면 Hero로 되돌아간다(px).
// About 본문은 로고가 About을 떠나는 프레임까지 남는다(AboutSection).
const LOGO_BACK = 24;
// Hero로 돌아선 로고는 마지막으로 올라온 자리에서 이만큼 내려와야 다시 난다(px). 경로 지점에서 1–2px 떨어도 Hero와 About을 오가지 않는다.
const LOGO_SLACK = 4;
// Projects에서 위로 갈 때 되돌기가 시작하는 선(header 아래 화면의 비율). Projects 위끝이 이 선 아래로 내려가면 돈다.
// 사용자 요청(2026-10-24)으로 경로의 읽기선(.4)보다 덜 올라와도 돈다. 경로와 nav 표시는 그대로 읽기선을 쓴다.
const RETURN_LINE_RATIO = .15;
// 볼이 접혀 드는 작은 고리의 지름(Hero 앵커 비율). 이 지름에서 Electric 원이 넘겨받는다.
export const CORE = .22;
// 원이 펼쳐지는 지름(About 앵커 비율). ElectricLogo가 로고를 그리는 크기(scale .7)와 같다.
export const ORBIT = .7;
// 떠나는 타일의 모서리(로고 크기 비율). 참조 5.35초의 155px 타일이 45px 남짓 둥글다.
const TILE_RADIUS = .3;
// Projects 이름 글자가 첫 노드로 날아가며 뭉쳐 첫 Experience 헤드가 된다(사용자 승인 2026-10-29). 진행 t 하나를 2.1초 동안 시간에 선형으로 돌리고
// 곡선은 lineMotion gatherPose가 준다. 되돌기는 사이트 규칙(About→Projects의 1.4 / 1.8)대로 더 빠르다. 그림은 오버레이 캔버스가 그린다.
const BOUNDARY_IN = GATHER_SECONDS;
const BOUNDARY_OUT = BOUNDARY_IN * 1.4 / 1.8;
// 선 지점: 첫 노드가 화면 아래끝에서 이만큼(px) 올라온 스크롤(1440x900에서 1858, 390x844에서 1735 실측, 계획 R1).
// 잠금 자리보다 LOGO_BACK 넘게 아래, 프리뷰가 nav 아래 12px에 닿는 스크롤보다 위에 묶는다. 둘이 다투는 짧은 화면은 위쪽이 이긴다
// (프리뷰가 nav 밑으로 들어가지 않는다). 그때 헤드는 매 프레임 잰 노드 자리로 가고 화면 밖일 수 있다.
const NODE_SHOW = 140;
// 앞으로 도는 경계 동안 막는 아래쪽 스크롤 키(계획 R2). Shift+Space는 위로 가는 키라 두지 않는다.
const DOWN_KEYS = new Set([' ', 'PageDown', 'ArrowDown', 'End']);

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
// 경계가 시작되고 프리뷰와 다른 이름이 물러나는 시간(초). 글자가 충전되는 동안이다.
const AWAY_SECONDS = .5;

// 첫 헤드로 뭉칠 낱말을 잰다. 글자마다 상자 가운데(문서 좌표)와 노드에 가까운 순서 k를 매긴다. 공백은 건너뛴다.
function measureWord(el: HTMLElement, node: { x: number; y: number }) {
  const text = el.firstChild;
  if (!(text instanceof Text)) return null;
  const s = getComputedStyle(el), range = document.createRange(), letters: GatherLetter[] = [];
  for (let i = 0; i < text.data.length; i++) {
    if (!text.data[i].trim()) continue;
    range.setStart(text, i);
    range.setEnd(text, i + 1);
    const b = range.getBoundingClientRect();
    letters.push({ ch: text.data[i], x: b.left + b.width / 2, y: b.top + b.height / 2 + window.scrollY, k: 0 });
  }
  [...letters].sort((a, b) => Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y)).forEach((L, k) => { L.k = k; });
  return { el, font: `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`, letters };
}

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

// About(1)에서 Projects(2)로 가는 진행도 q의 구간. 참조 5.15–5.35초 기호가 옮겨 가며 타일로 차고, 5.35–5.75초 면이 가로로 넓어지고,
// 5.75–6.13초 그 면 안에 내용이 드러나고, 6.13–6.17초 카드로 들어앉는다. 비율은 녹화 속도가 아니라 이 구간들의 몫이다.
// 이동 0–.25, 가로 0–.65, 외피 seek 0–.65(옮겨 가는 동안 이미 3분의 1 풀린다), 높이 .1–.65, 모서리 .25–.65, 목록 .7–.9.
// 면은 프리뷰 크기 그대로 넓어진다. 프리뷰보다 4% 크게 섰다가 줄어드는 정착은 사용자 요청(2026-10-29)으로 뺐다.
// 빛의 면(사용자 선택 A 2026-10-23): 옮겨 가는 동안 기호 속이 빛으로 차(채움 0–.2) 면으로 퍼지고, 다 퍼진 자리에서
// 빛(로고 캔버스와 그 테두리 전기)이 가라앉는 만큼 미디어·캡션이 떠오른다(.65–.9). 둘은 한 곡선의 보수라 빈 프레임도 겹쳐 밝은 프레임도 없다.
// 그림 안의 면(사용자 선택 (가) + (i) 2026-10-23): 프리뷰 그림이 받아져 있으면 처음부터 그 그림이 모양 안에서 가운데부터 드러난다(앞선 0–.8,
// 10%에 이미 3분의 1). 테두리 전기는 굵기째 가늘어져 사라진다(.3–.6, Task 5에서 .6–.9보다 앞당김).
// 방향마다 고르지 않은 퍼짐(Task 5, 사용자 요청 2026-10-24): 앞선과 외곽선이 같은 잡음 장을 따라 어떤 쪽은 앞서고 어떤 쪽은 처진다(ElectricLogo).
// 외곽선의 일그러짐(ragged)은 .45까지 다 실리고 .82에 0이라 넘김 전에 상자가 정확하다.
// .94–1은 넘김이다(Task 4 수정 1): 제자리에 멈춘 GL 그림 아래 DOM 틀(그림·캡션)이 다 서고 캔버스가 빠진다. 둘이 같은 자리라 같은 그림이 차츰
// 또렷해지고 캡션이 떠오른다. 한 프레임 바꿈은 DPR이 1.25를 넘으면 흐린 GL 그림이 또렷한 DOM 그림으로 툭 바뀌었다. 위 교차(media·logo)는 그림이 없는 방문의 몫이다.
export function previewPhases(q: number) {
  const media = smooth(span(.65, .9, q));
  return {
    travel: inOut(span(0, .25, q)),
    fill: smooth(span(0, .2, q)),
    widen: inOut(span(0, .65, q)),
    shell: smooth(span(0, .65, q)),
    face: inOut(span(.1, .65, q)),
    corner: inOut(span(.25, .65, q)),
    reveal: out(span(0, .8, q)),
    strands: 1 - smooth(span(.3, .6, q)),
    ragged: 1 - smooth(span(.45, .82, q)),
    media,
    list: smooth(span(.7, .9, q)),
    handoff: smooth(span(.94, 1, q)),
    logo: 1 - media,
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

export function createPortfolioMotion({ root, header, wordmark, logoHost, ball, reduced, onLogoOwnerChange, onLineArrive, onLinePlay }: {
  root: HTMLElement; header: HTMLElement; wordmark: HTMLButtonElement; logoHost: HTMLElement; reduced: boolean;
  // GL 볼 손잡이(없으면 정적 볼). 볼은 진입 뒤에 늦게 떠서 ref로 받는다.
  ball?: { current: CrystalizedBallHandle | null };
  onLogoOwnerChange: (owner: LogoOwner) => void;
  // 프리뷰가 첫 헤드에 내려앉았는지(경계 100%). 내려앉을 때와 거꾸로 떠날 때만 부른다. Experience가 첫 헤드와 첫 장을 이것으로 공개한다.
  onLineArrive?: (arrived: boolean) => void;
  // 경계가 재생 중인지(앞으로든 거꾸로든). 바뀔 때만 부른다. HomeClient가 그동안 배경 그리기를 줄여 GPU를 경계에 내준다.
  onLinePlay?: (playing: boolean) => void;
}): PortfolioMotion {
  registerScrollTrigger();
  const inner = logoHost.firstElementChild instanceof HTMLElement ? logoHost.firstElementChild : null;
  const label = wordmark.firstElementChild instanceof HTMLElement ? wordmark.firstElementChild : wordmark;
  const anchor = (name: string) => root.querySelector(`[data-motion-anchor="${name}"]`);
  // 볼은 Hero 앵커째로 접히고 옮긴다. 앵커는 offset으로 재므로 이 transform이 측정에 섞이지 않는다.
  const orb = anchor('hero-object');
  // 프리뷰 손잡이(previewRef)는 재기만 한다. 경계가 쓰는 것은 그 안의 자르는 틀(transform·opacity·clip-path)과 목록(opacity)뿐이다.
  // 틀에는 선택 전환 tween도 Flip 손잡이도 없고, 미디어 겹·data-flip-id·크기는 건드리지 않는다. 쉬는 Projects 자리에서 ''로 되돌린다.
  const previewAnchor = anchor('projects-preview');
  const frame = previewAnchor?.firstElementChild instanceof HTMLElement ? previewAnchor.firstElementChild : null;
  const projectsSection = previewAnchor?.closest('section') ?? null;
  const focusedControl = (target: EventTarget | null = document.activeElement) => target instanceof Element && target !== projectsSection
    && !!projectsSection?.contains(target) && !!target.closest('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const list = projectsSection?.querySelector<HTMLElement>('[data-part="index"]') ?? null;
  // lg 아래의 넘김 줄(n / N과 양옆 단추). Experience 경계에서는 목록과 같이 사라진다(시안 #wheel).
  const pager = projectsSection?.querySelector<HTMLElement>('[data-part="mobile-pager"]') ?? null;
  // Experience 첫 장의 축 칸과 노드 제목(ExperienceSection). 재기만 한다. 노드 y는 섹션과 같이 제목 위끝 + min(높이, 60) / 2다.
  const axis = root.querySelector<HTMLElement>('[data-part="experience-axis"]');
  const firstNode = root.querySelector<HTMLElement>('[data-part="experience-node"]');
  const nodeY = (box: Box) => box.y + Math.min(box.h, 60) / 2;
  // Hero 이름 글자 크기(0이면 CSS 값), nav 자리(화면 좌표), 로고가 떠나는 스크롤 지점, 두 로고 앵커(문서 좌표).
  // aboutTop·line: useSectionNav가 About을 고르는 읽기선(About 위끝 <= 스크롤 + 읽기선). back: Projects에서 되도는 선(RETURN_LINE_RATIO).
  // previewAt·projectsTop: 프리뷰로 떠나는 지점과 Projects 위끝(경로 판정), preview·radius: 프리뷰 상자와 모서리.
  let m = { nameSize: 0, nav: EMPTY, logoAt: Infinity, aboutTop: Infinity, line: 0, back: 0, hero: EMPTY, about: EMPTY, origin: EMPTY,
    previewAt: Infinity, projectsTop: Infinity, preview: EMPTY, radius: 0, lineAt: Infinity };
  let side: 'hero' | 'nav' = 'hero';
  let flip: gsap.core.Tween | null = null;
  // 로고 진행도 t: 0 Hero, 1 About, 2 Projects 프리뷰. 시간으로만 움직이고 goal은 지금 스크롤이 가리키는 쪽이다.
  const pose = { t: 0 };
  let goal = 0;
  let travel: gsap.core.Tween | null = null;
  let logo: ElectricLogoHandle | null = null;
  // 날아가는 동안 ElectricLogo 경계(원)를 잡고 있는지.
  let bound = false;
  // 프리뷰 쪽 경계(상자)를 잡고 있는지. 방문마다 떠날 때 한 번만 잡는다.
  let boxed = false;
  // 이 방문에 GL 로고가 모양 안에 그리는 프리뷰 그림. 상자를 잡을 때 받아져 있을 때만 정하고, 아니면 그 방문은 빛 → 교차로 넘긴다.
  let photo: HTMLImageElement | null = null;
  // 틀(그림·캡션)이 보이는 중인지. 보이기 시작하는 프레임에 캡션 드러냄을 부르고 숨는 프레임에 걷는다(M4 Task 14).
  let captionShown = false;
  let owner: LogoOwner | null = null;
  let paused = false;
  let alive = true;
  let queued = 0;
  // 지난 판단의 스크롤. 로고 지점과 경로 지점 사이에서는 어느 쪽에서 들어왔는지로 정한다.
  let lastY = -Infinity;
  // 마지막으로 위로 움직인 스크롤. 아직 올라간 적이 없으면 -Infinity라 처음 내려가는 길에는 늦춤이 없다.
  let lowY = -Infinity;
  // Projects 컨트롤에 포커스가 선 스크롤(그 뒤 내려간 가장 아래). 이보다 위로 굴리면 포커스가 남아 있어도 Projects를 놓는다.
  let holdFrom = Infinity;
  // 선 진행도 p: 0 프리뷰, 1 첫 헤드. 로고가 Projects(goal 2)에 있을 때만 움직이고 lineGoal은 지금 스크롤이 가리키는 쪽이다.
  const linePose = { p: 0 };
  let lineGoal = 0;
  let lineTween: gsap.core.Tween | null = null;
  // 경계 한 번의 재생 동안 캔버스가 이어받아 그리는 낱말. 그동안 DOM 글자는 숨는다. 프리뷰 쪽(0)에 서면 되돌려 다음 재생에서 지금 이름을 다시 잰다.
  let word: ReturnType<typeof measureWord> = null;
  let lineArrived = false;
  let linePlaying = false;
  // 경계를 그리는 오버레이(HomeClient가 늦게 넘긴다). 없으면 그리기 없이 시간·도착·틀 숨김만 돈다.
  let overlay: ExperienceOverlay | null = null;
  // 아래쪽 입력을 막는 차단 리스너를 달고 있는지. 차단 wheel은 스크롤을 메인 스레드에 묶어 늦추므로 막는 동안만 단다(useChapterLock과 같은 이유).
  let pinned = false;
  let touchY = NaN;

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
    // 프리뷰로 떠나는 지점도 같은 규칙이다. Projects가 화면 절반 안에 드는 스크롤보다 화면 높이의 15% 먼저 떠나 내용보다 먼저 내려앉는다.
    // About 잠금 자리 뒤, Projects 잠금 자리 앞에 둔다. 프리뷰가 없으면(Projects 미마운트) 떠나지 않는다.
    const projects = root.querySelector('[data-section="projects"]');
    const projectsTop = projects ? projects.getBoundingClientRect().top + window.scrollY : Infinity;
    const projectsLock = projectsTop - (projects ? parseFloat(getComputedStyle(projects).scrollMarginTop) || header.offsetHeight : 0);
    // 프리뷰는 소수점까지 잰다. 도착에서 GL 그림이 DOM 그림과 화소째 겹쳐야 한다(정수 offset으로는 반 화소 어긋났다). 프리뷰 조상에는 transform이 없다.
    const preview = previewAnchor ? rectBox(previewAnchor, window.scrollY) : EMPTY;
    const previewAt = preview.w ? Math.min(projectsLock - 1, Math.max(lock + 1, projectsLock - window.innerHeight / 2 - LOGO_LEAD * window.innerHeight)) : Infinity;
    const headerHeight = header.getBoundingClientRect().height;
    // 첫 노드는 offset으로 잰다. 아직 공개되지 않은 제목의 등장 이동(transform)이 섞이지 않는다. clamp는 위쪽 묶음이 이긴다.
    const lineAt = preview.w && firstNode
      ? clamp(nodeY(layoutBox(firstNode)) - window.innerHeight + NODE_SHOW, projectsLock + LOGO_BACK + 1, preview.y - headerHeight - 12) : Infinity;
    m = {
      nameSize: size, nav: rectBox(header.querySelector('[data-motion-anchor="nav-name"]')),
      logoAt: Math.min(lock - 1, Math.max(NAME_DOWN, reveal - LOGO_LEAD * window.innerHeight)),
      aboutTop, line: readingLineY(window.innerHeight, headerHeight),
      // 되돌기 선. 되돌기 스크롤(Projects 위끝 - 선)은 떠나는 지점보다 LOGO_SLACK 넘게 위에 묶는다. 둘이 한 자리에서 다투지 않는다.
      back: Math.min(readingLineY(window.innerHeight, headerHeight, RETURN_LINE_RATIO), projectsTop - previewAt - LOGO_SLACK),
      hero: heroObject, about: target, origin: layoutBox(logoHost.offsetParent),
      previewAt, projectsTop, preview, radius: frame ? parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0 : 0, lineAt,
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
  const clearProjects = () => {
    if (frame) Object.assign(frame.style, { transform: '', opacity: '', clipPath: '', pointerEvents: '', visibility: '', willChange: '' });
    for (const el of [list, pager]) if (el) Object.assign(el.style, { opacity: '', pointerEvents: '', willChange: '' });
  };
  // 아래로 가는 wheel·손가락을 위로 끄는 touchmove·아래쪽 스크롤 키를 막는다. 위로 가는 입력은 두어 되돌 수 있다.
  const block = (event: Event) => { if (event.cancelable) event.preventDefault(); };
  // Ctrl·Meta가 실린 입력은 확대와 Ctrl+End 같은 브라우저 명령이라 두고 넘긴다.
  const onWheel = (event: WheelEvent) => { if (event.deltaY > 0 && !event.ctrlKey && !event.metaKey) block(event); };
  const onTouchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? NaN; };
  // 막기 시작한 몸짓의 첫 움직임은 기준이 없어 두고 다음부터 본다.
  const onTouchMove = (event: TouchEvent) => {
    const y = event.touches[0]?.clientY ?? NaN;
    if (y < touchY) block(event);
    touchY = y;
  };
  const onKey = (event: KeyboardEvent) => { if (DOWN_KEYS.has(event.key) && !(event.key === ' ' && event.shiftKey) && !event.ctrlKey && !event.metaKey) block(event); };
  // 앞으로 도는 경계 동안만 막는다(계획 R2). 되돌기·멈춤(상세가 열린 동안)은 막지 않는다.
  const syncPin = () => {
    const next = alive && !paused && !reduced && !!lineTween && lineGoal === 1;
    if (next === pinned) return;
    pinned = next;
    touchY = NaN;
    const options = { passive: false, capture: true };
    if (next) {
      window.addEventListener('wheel', onWheel, options);
      window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
      window.addEventListener('touchmove', onTouchMove, options);
      window.addEventListener('keydown', onKey, options);
    } else {
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('touchstart', onTouchStart, true);
      window.removeEventListener('touchmove', onTouchMove, true);
      window.removeEventListener('keydown', onKey, true);
    }
  };
  const dropWord = () => {
    if (word) word.el.style.visibility = '';
    word = null;
  };
  // 이름 → 첫 헤드. 프리뷰·목록·넘김 줄은 처음 AWAY_SECONDS 동안 물러나고(프리뷰는 3% 작아진다) 낱말은 오버레이가 이어받는다.
  // 진행도 0에서는 경계가 쓴 값을 걷어 Projects 쉬는 자리다(로고가 프리뷰에 넘긴 자리의 clearProjects).
  const renderLine = () => {
    const p = linePose.p;
    // 도착은 100%에 선 쪽을 가리킬 때다. 거꾸로 돌기 시작하는 프레임에 바로 떠난다(첫 헤드와 첫 장이 경계와 함께 숨는다).
    const arrived = p >= 1 && lineGoal === 1;
    if (arrived !== lineArrived) {
      lineArrived = arrived;
      onLineArrive?.(arrived);
    }
    syncPin();
    const playing = alive && !reduced && !!lineTween;
    if (playing !== linePlaying) {
      linePlaying = playing;
      onLinePlay?.(playing);
    }
    // 모션 감소는 재생이 없어 프리뷰가 그대로 서고(시안과 같다) 첫 헤드는 도착으로 바로 산다.
    if (p <= 0 || reduced || !previewAnchor) {
      dropWord();
      overlay?.setBoundary(null);
      clearProjects();
      return;
    }
    const away = out(span(0, AWAY_SECONDS / BOUNDARY_IN, p));
    // 열기 단추는 떠나는 동안 눌리지 않는다. 상세의 FLIP과 이 경계가 같은 프리뷰를 함께 옮기지 않는다.
    // 경계 동안은 제 레이어에 올린다. 안 올리면 그림·캡션 틀과 흐린 이름들이 물러나는 프레임마다 다시 그려져 시작이 30fps 밑으로 끊겼다(2026-10-29 실측).
    if (frame) Object.assign(frame.style, { transform: away ? `scale(${1 - .03 * away})` : '', opacity: String(1 - away), clipPath: '', pointerEvents: 'none', visibility: away >= 1 ? 'hidden' : '', willChange: 'opacity, transform' });
    for (const el of [list, pager]) if (el) Object.assign(el.style, { opacity: String(1 - away), pointerEvents: 'none', willChange: 'opacity' });
    // 그릴 캔버스가 없으면 낱말도 목록·프리뷰와 같이 물러난다.
    if (!overlay) return dropWord();
    // 출발과 도착은 매 프레임 지금 화면 좌표로 잰다. 재생 중에 스크롤이 움직여도 낱말에서 떠나 지금 노드 자리에 내려앉는다.
    // 도착(t 1)도 넘긴다. 오버레이가 실제 첫 헤드가 살 때까지 그 자리에 헤드를 잡아 두고 스스로 비운다(넘김 프레임이 비지 않는다).
    const axisBox = layoutBox(axis);
    const target = { x: axisBox.x + axisBox.w / 2, y: nodeY(layoutBox(firstNode)) - window.scrollY };
    if (!word) {
      // 데스크톱은 오른쪽 목록의 고른 이름, 목록이 숨는 lg 아래는 프리뷰 캡션 제목이다
      const name = list?.querySelector<HTMLElement>('[aria-selected="true"] > span');
      const el = name?.getClientRects().length ? name : frame?.querySelector<HTMLElement>('[data-part="preview-caption-text"] > p');
      word = el ? measureWord(el, { x: target.x, y: target.y + window.scrollY }) : null;
    }
    if (word) word.el.style.visibility = 'hidden';
    overlay.setBoundary({
      t: p, font: word?.font ?? '', target,
      letters: word?.letters.map(L => ({ ...L, y: L.y - window.scrollY })) ?? [],
    });
  };
  // 재생 없이 프리뷰 쪽(0)에 놓는다. 로고가 Projects를 떠날 때, Projects 컨트롤이 입력이나 포커스를 받을 때다.
  const dropLine = () => {
    lineTween?.kill();
    lineTween = null;
    lineGoal = 0;
    linePose.p = 0;
    renderLine();
  };

  const renderLogo = () => {
    if (!logo) {
      renderLine();
      report('none');
      return;
    }
    // 진행도 1–2는 About에서 프리뷰로 가는 구간이다. Hero 쪽 값은 그동안 1(About)에 머문다.
    const t = Math.min(pose.t, 1);
    const q = Math.max(0, pose.t - 1);
    // 날고 있는 구간. 1에서 막 떠나는 순간은 가는 쪽이고, 1에 닿는 마지막 갱신은 내려앉음이다(반대쪽 경계를 잡지 않는다).
    const leg = !travel ? 0 : pose.t > 1 ? 2 : pose.t < 1 ? 1 : goal > 1 ? 2 : goal < 1 ? 1 : 0;
    const { hero, about, origin, preview } = m;
    const phase = logoPhases(t);
    const view = previewPhases(q);
    const from = { x: hero.x + hero.w / 2, y: hero.y + hero.h / 2 };
    const centre = { x: preview.x + preview.w / 2, y: preview.y + preview.h / 2 };
    let x = lerp(from.x, about.x + about.w / 2, phase.travel);
    let y = lerp(from.y, about.y + about.h / 2, phase.travel);
    if (q > 0) {
      x = lerp(x, centre.x, view.travel);
      y = lerp(y, centre.y, view.travel);
    }
    const shrink = lerp(1, CORE, phase.contract);
    // 그림이 있는 방문: 틀은 .94에 캔버스 아래 다 서고(캔버스가 틀 위에 있어 가려진다) 캔버스가 .94–1 동안 빠진다. 되돌기는 같은 길을 거꾸로 밟는다.
    const media = photo ? (q >= .94 ? 1 : 0) : view.media;
    const glLogo = photo ? 1 - view.handoff : 1 - media;
    logoHost.style.transform = `translate3d(${x - about.w / 2 - origin.x}px, ${y - about.h / 2 - origin.y}px, 0)`;
    if (inner) inner.style.opacity = String(q > 0 ? glLogo : phase.logo);
    if (t <= 0) clearOrb();
    else {
      if (orb instanceof HTMLElement) Object.assign(orb.style, { transform: `translate(${x - from.x}px, ${y - from.y}px) scale(${shrink})`, opacity: String(phase.ball) });
      ball?.current?.setCollapse(phase.drain);
    }
    // 원은 볼 고리와 같은 화면 지름에서 넘겨받아(host는 About 크기 그대로라 컨테이너 px = 화면 px) 펼침 동안 로고 크기로 크며 풀린다.
    // 경계 캔버스 자리는 줄지 않으므로 가장 큰 원으로 한 번 잡는다. GL이 아직 그리지 않았으면 다음 프레임에 다시 잡는다.
    const ring = lerp(hero.w * shrink, about.w * ORBIT, phase.grow);
    const aimRing = () => {
      logo!.setBoundaryTarget({ width: ring, height: ring, radius: ring / 2 });
      logo!.seekBoundary(phase.boundary);
    };
    // 외피는 About 로고 크기의 타일에서 가로부터 넓어져 프리뷰 상자·모서리가 된다.
    // 캔버스 자리는 줄지 않으므로 가장 큰 면으로 한 번 잡는다(자리를 그 이상 넓히지 않는다).
    const tile = about.w * ORBIT;
    const box = { width: lerp(tile, preview.w, view.widen), height: lerp(tile, preview.h, view.face), radius: lerp(tile * TILE_RADIUS, m.radius, view.corner) };
    // 그림은 처음부터 프리뷰 상자에 DOM과 같은 cover로 깔리고 모양이 그 창이다. 끝에서 DOM 그림과 같은 자리다.
    const aimBox = () => {
      logo!.setBoundaryTarget(photo ? { ...box, image: { source: photo, width: preview.w, height: preview.h } } : box);
      logo!.seekBoundary(view.shell, view.fill, view.reveal, view.strands, view.ragged);
    };
    // 지금 구간의 것이 아닌 경계를 먼저 닫는다. ElectricLogo는 경계를 잡은 채 다시 begin하면 새로 잡지 않고 다시 겨누기만 해서,
    // 한 트윈이 About을 지나 반대쪽 구간으로 넘어갈 때 뒤에 닫으면 새 구간의 경계까지 지웠다(Task 1 리뷰 I1).
    if (bound && leg !== 1) {
      aimRing();
      logo.endBoundary();
      bound = false;
    }
    if (boxed && leg !== 2) {
      aimBox();
      logo.endBoundary();
      boxed = false;
    }
    if (leg === 1) {
      if (!bound) {
        const size = Math.max(hero.w, about.w * ORBIT);
        bound = logo.beginBoundary({ width: size, height: size, radius: size / 2 });
      }
      if (bound) aimRing();
    }
    if (leg === 2) {
      if (!boxed) {
        // next/image는 lazy라 아직 안 받아졌을 수 있다. 그 방문은 기다리지 않고 그림 없이 난다. 영상이나 오류 화면에는 img가 없다.
        const img = frame?.querySelector('img');
        photo = img?.complete && img.naturalWidth ? img : null;
        boxed = logo.beginBoundary({ width: preview.w, height: preview.h, radius: m.radius });
        // GL이 아직 그리지 않았으면 이 방문은 정적으로 넘긴다. 늦게 준비돼도 날던 도중에 외피를 끼우지 않고 다음 방문에 잇는다.
        if (!boxed) {
          travel?.kill();
          travel = null;
          pose.t = goal;
          renderLogo();
          return;
        }
      }
      aimBox();
    }
    // 내용 창: 미디어·캡션(틀)은 외피와 같은 transform·clip으로 드러나고 목록이 같은 구간에 따라온다.
    // About 쪽에서 쉬거나 나는 동안은 숨고, 프리뷰에 넘긴 뒤에는 쓴 값을 걷는다. 숨은 틀은 옮기지 않는다.
    // 틀 안의 열기 단추가 보이지 않는 채 About·Hero 위로 옮겨 가 눌리면 안 된다. 숨은(0) 틀과 목록은 제자리에서도 포인터를 받지 않는다.
    // 되돌기 뒤 About 쪽에서 프리뷰 자리가 아직 화면 아래쪽에 남아 빈 배경을 누르면 상세가 열렸다(Task 1 리뷰 I2).
    if (pose.t >= 2) renderLine();
    else {
      if (frame) {
        const sx = preview.w ? box.width / preview.w : 1;
        const sy = preview.h ? box.height / preview.h : 1;
        // 그림이 있는 방문에도 틀은 .65부터 같은 창에 서서 포인터를 받는다. 그 자리에 보이는 것은 GL이 그린 같은 그림이다.
        const open = view.media > 0;
        Object.assign(frame.style, {
          transform: open ? `translate(${x - centre.x}px, ${y - centre.y}px) scale(${sx}, ${sy})` : '',
          clipPath: open ? `inset(0px round ${box.radius / sx}px / ${box.radius / sy}px)` : '',
          opacity: String(media),
          pointerEvents: open ? '' : 'none',
        });
      }
      if (list) Object.assign(list.style, { opacity: String(view.list), pointerEvents: view.list > 0 ? '' : 'none' });
    }
    // 캡션의 인라인 값은 captionReveal만 쓴다. 여기서는 틀 값(transform·clip·opacity)만 쓰고 드러냄은 부르기만 한다.
    // 앞으로 나는 비행에서 틀이 보이기 시작하면(그림 방문은 .94, 아니면 교차 .65) 드러내고, 그 밖에 보이게 된 것(직접 해시, settleProjects)은 그냥 둔다.
    // 되돌아 틀이 숨는 프레임에 걷는다. 그 프레임의 틀은 투명이라 걷어 끝값이 돼도 안 보인다. 넘김(.94–1) 동안 그림은 이미 제자리다.
    const shown = pose.t >= 2 || media > 0;
    if (shown !== captionShown) {
      captionShown = shown;
      const caption = frame?.querySelector<HTMLElement>('[data-part="preview-caption"]');
      if (caption && shown && travel && goal > 1) revealCaption(caption, { duration: ENTRY_CAPTION_MS });
      else if (caption) clearCaptionReveal(caption);
    }
    report(leg === 2 ? 'preview' : leg ? 'boundary' : pose.t >= 2 ? 'projects' : t >= 1 ? 'about' : 'hero');
  };

  const moveLogo = (target: number, animate: boolean) => {
    if (target === goal) return;
    // 로고가 Projects를 떠나면 선은 재생 없이 0이다. 틀은 그 뒤 로고 비행이 쓴다.
    if (target !== 2 && (linePose.p > 0 || lineGoal)) dropLine();
    goal = target;
    travel?.kill();
    travel = null;
    // 남은 길이 0이면 길이 0 트윈이 만들어지는 중에 끝나 travel에 끝난 트윈이 남는다(경계에 멈춘다). 날기 시작한 프레임에 되돌 때다.
    if (!logo || !animate || reduced || pose.t === target) pose.t = target;
    else {
      // 되돌아갈 때는 지난 진행도만큼의 시간만 쓴다. 진행도는 구간마다 시간에 선형이고 구간마다 제 곡선을 쓴다(logoPhases·previewPhases).
      // 트윈은 시간 축(secondsAt)을 고르게 돌고 진행도로 되옮긴다. 끝은 ease가 정확히 1이라 target 그대로다.
      // 시간 축은 이 트윈의 방향 것이다. 도중에 돌아서면 지금 진행도에서 새 방향의 빠르기로 다시 재므로 진행도가 뛰지 않는다.
      const from = pose.t;
      const back = target < from;
      const [start, end] = [secondsAt(from, back), secondsAt(target, back)];
      travel = gsap.to(pose, {
        t: target, duration: Math.abs(end - start), onUpdate: renderLogo,
        ease: (p: number) => p >= 1 ? 1 : (progressAt(start + (end - start) * p, back) - from) / (target - from),
        onComplete: () => { travel = null; renderLogo(); },
      });
    }
    renderLogo();
  };

  // 선을 지금 쪽으로 옮긴다. 로고가 Projects에 넘긴 뒤에만 움직인다(그 밖에서는 moveLogo가 0에 놓는다).
  // 되돌아갈 때는 지난 진행도만큼의 시간만 쓴다. 진행도는 시간에 선형이고 곡선은 gatherPose가 준다.
  const moveLine = (target: number, animate: boolean) => {
    if (goal !== 2 || target === lineGoal) return;
    lineGoal = target;
    lineTween?.kill();
    lineTween = null;
    if (target === 1) {
      // 프리뷰로 날던 로고는 끝 자리로 정착시키고 떠난다(settleProjects와 같은 길). 숨을 컨트롤에 보이지 않는 포커스를 남기지 않는다.
      if (travel) {
        travel.kill();
        travel = null;
        pose.t = 2;
        renderLogo();
      }
      if (focusedControl()) (document.activeElement as HTMLElement).blur();
      // 캡션 드러냄이 돌고 있으면 걷는다. 캡션은 틀째로 숨는다. 캡션의 인라인 값은 captionReveal만 쓴다.
      const caption = frame?.querySelector<HTMLElement>('[data-part="preview-caption"]');
      if (caption) clearCaptionReveal(caption);
    }
    if (!animate || reduced || linePose.p === target) linePose.p = target;
    else lineTween = gsap.to(linePose, {
      p: target, duration: (target ? BOUNDARY_IN : BOUNDARY_OUT) * Math.abs(target - linePose.p), ease: 'none',
      onUpdate: renderLine, onComplete: () => { lineTween = null; renderLine(); },
    });
    renderLine();
  };
  // 선 지점을 넘으면 1, LOGO_BACK 넘게 위로 돌아오면 0, 그 사이에서는 지금 쪽이다.
  const lineSide = () => window.scrollY >= m.lineAt ? 1 : window.scrollY <= m.lineAt - LOGO_BACK ? 0 : clamp(lineGoal);
  // nav 이동(useSectionNav가 main에 data-navigation-target을 단 동안)이 선 지점을 넘으면 재생 없이 그쪽에 놓는다.
  // 빈 Experience 위로 2.1초 경계를 돌리지 않고 도착 상태로 선다. 로고 비행은 그대로 재생한다.
  const playLine = () => !root.hasAttribute('data-navigation-target');

  // 지금 스크롤이 가리키는 쪽. 이름은 두 문턱 사이에서 지금 자리를 지킨다.
  const nameSide = () => window.scrollY >= NAME_DOWN ? 'nav' : window.scrollY <= NAME_UP ? 'hero' : side;
  // 위로 갈 때 되돌기는 경로가 About에서 Overview로 바뀌는 프레임에 시작한다(사용자 요청 2026-10-22). 경로 지점은 잰 화면 크기 모두에서 로고 지점보다 아래다.
  // 그 사이에서는 아래로 움직이면 About(첫 하강처럼 R 전에 내려앉는다), 경로 지점을 넘어 올라왔으면 Hero, 그 밖에는 지금 쪽이다.
  // 경로가 About이면 언제나 About이다. 부르는 곳 모두가 지난 스크롤 갱신을 원해 여기서 lastY를 바꾼다.
  // 다시 날기(아래로 움직임, 경로 About)는 LOGO_SLACK만큼 늦춘다. 되돌기는 경로 지점 그대로다.
  // Projects(2)도 같은 규칙이되 선이 되돌기 선(m.back)이다(Task 5). Projects 위끝이 그 선 아래로 내려가는 프레임에 되돌고, 그 아래 띠에서 내려가면 다시 난다.
  const logoSide = () => {
    const y = window.scrollY;
    const was = lastY;
    lastY = y;
    if (y < was) lowY = y;
    const routed = (top: number, at: number) => top <= at + m.line;
    const held = (at: number) => m.projectsTop <= at + m.back;
    if (y >= m.previewAt && (held(y - LOGO_SLACK) || y >= lowY + LOGO_SLACK)) return 2;
    // 포커스가 Projects 컨트롤에 있는 동안은 Projects 위끝이 되돌기 선 위이거나, 포커스가 선 자리(그 뒤 가장 아래)에서 LOGO_SLACK 넘게 위로 굴리지 않았으면 머문다.
    // 포커스가 없을 때와 같은 지점에서 돈다. 경로 지점까지 머물면 포커스 유무로 되돌기 자리가 달랐다.
    // Tab의 scroll-into-view는 옛 문턱(지점 - 24) 아래에 설 수 있다(재리뷰 N2). 풀림은 넘는 한 프레임이 아니라 상태로 본다(재리뷰 N4).
    // 지난 스크롤도 내려간 자리로 친다. 깊은 데서 한 번에 뛰어올라도 그 프레임에 놓는다(재리뷰 3 N5).
    if (goal === 2 && focusedControl()) {
      if (held(y) || y >= Math.max(holdFrom, was) - LOGO_SLACK) {
        holdFrom = Math.max(holdFrom, y);
        return 2;
      }
      // 아래 규칙은 언제나 Projects가 아니다(clamp는 1까지). 다시 숨는 컨트롤에 보이지 않는 포커스를 남기지 않는다. 다음 Tab은 그 자리에서 이어진다.
      (document.activeElement as HTMLElement).blur();
    } else if (goal === 2 && y > m.previewAt - LOGO_BACK && !(held(was) && !held(y))) return 2;
    if (y >= m.logoAt && (routed(m.aboutTop, y - LOGO_SLACK) || y >= lowY + LOGO_SLACK)) return 1;
    if (y <= m.logoAt - LOGO_BACK || (routed(m.aboutTop, was) && !routed(m.aboutTop, y))) return 0;
    return clamp(goal);
  };

  const decide = () => {
    if (paused || !alive) return;
    const name = nameSide();
    if (name !== side) placeName(name, true);
    moveLogo(logoSide(), true);
    moveLine(lineSide(), playLine());
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
    const nextLine = lineSide();
    if (travel) {
      moveLogo(next, true);
      renderLogo();
      moveLine(nextLine, playLine());
      return;
    }
    // 두 문턱 사이에서는 지금 쪽을 지킨다. 같은 쪽이라도 다시 놓도록 goal을 비운다.
    goal = -1;
    moveLogo(next, false);
    // 도는 선은 끊지 않는다. 다음 갱신이 새 자리를 읽는다.
    if (lineTween) moveLine(nextLine, true);
    else {
      lineGoal = -1;
      moveLine(nextLine, false);
    }
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
  // 그리기 전 판정(lib/introGate.ts)이 nav 줄에 세워 둔 표시는 이제 data-wordmark-mode가 맡는다.
  document.documentElement.removeAttribute('data-name-side');

  // 폰트, 창 크기, About 정적 배치 전환이 앵커를 옮긴다. main만 보면 크기가 같은 채 움직인 앵커를 놓친다. 다음 프레임에 한 번만 잰다.
  const queue = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; settle(); }); };
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queue);
  for (const element of [root, header, anchor('hero-name'), anchor('hero-object'), anchor('about-logo'), previewAnchor]) if (element) resize?.observe(element);
  document.fonts?.ready.then(queue);
  // 숨은 Projects 안으로 키보드 포커스가 들어오면 재생 없이 Projects 쉬는 자리를 보인다. 보이지 않는 단추에 포커스가 서지 않는다.
  // visibility로 숨기면 About에서 Tab으로 Projects에 닿지 못해 포커스로 드러낸다(Task 1 리뷰 I2).
  // 컨트롤(열기 단추·목록 이름)에 닿은 포커스만 본다. nav 도착은 섹션 자체(tabIndex -1)에 포커스를 주고(useSectionNav),
  // 프리뷰로 날고 있는 동안은 끊지 않는다. 내려앉으면 컨트롤이 드러난다(Task 1 재리뷰 N1).
  const reveal = (event: FocusEvent) => {
    if (!focusedControl(event.target)) return;
    holdFrom = window.scrollY;
    // 선으로 떠난(떠나는) 프리뷰 안에 포커스가 서면 재생 없이 되돌려 놓는다. 보이지 않는 단추에 포커스가 서지 않는다.
    if (alive && !paused && linePose.p > 0) dropLine();
    if (!alive || paused || !logo || pose.t >= 2 || (travel && goal === 2)) return;
    goal = -1;
    moveLogo(2, false);
  };
  projectsSection?.addEventListener('focusin', reveal);
  // 받아진 프리뷰 그림을 미리 풀어 둔다(Task 4 리뷰 m2). 비행의 첫 GL 그리기(texImage2D)가 동기 디코드를 하지 않는다. 그림이 바뀌면 load가 다시 부른다.
  const predecode = (img: EventTarget | null | undefined) => {
    if (img instanceof HTMLImageElement && img.complete && img.naturalWidth) img.decode?.().catch(() => {});
  };
  const onImageLoad = (event: Event) => predecode(event.target);
  frame?.addEventListener('load', onImageLoad, true);
  predecode(frame?.querySelector('img'));

  return {
    refresh: settle,
    setPaused: (next) => {
      paused = next;
      // 상세가 열린 동안(M4 pause) 선 재생도 그 자리에 멈춘다.
      lineTween?.paused(next);
      syncPin();
      if (next || !alive) return;
      // 멈춘 사이 넘은 지점은 재생하지 않고 그쪽 자리에 둔다.
      if (nameSide() !== side) placeName(nameSide(), false);
      moveLogo(logoSide(), false);
      moveLine(lineSide(), false);
    },
    // GL 손잡이가 오거나 떠날 때. 진행도는 그대로 두고 지금 자리에 놓는다.
    setLogo: (next) => {
      logo = next;
      if (!next) {
        travel?.kill();
        travel = null;
        bound = false;
        boxed = false;
        pose.t = goal;
        logoHost.style.transform = '';
        clearOrb();
      }
      renderLogo();
    },
    // 오버레이가 오거나 바뀌거나 떠날 때. 옛 오버레이의 경계를 비우고 지금 진행을 새 오버레이에 그린다.
    setOverlay: (next) => {
      if (next === overlay) return;
      overlay?.setBoundary(null);
      overlay = next;
      if (alive) renderLine();
    },
    // 날고 있는 About↔Projects 비행을 Projects 쪽 끝 자리로 동기로 끝낸다. 스크롤은 건드리지 않는다.
    // 새 경로를 만들지 않는다: 쉬는 자리(t=2)로 놓는 renderLogo가 경계를 닫고 소유 속성을 걷는다. GL이 없으면 정적 자리 그대로다.
    settleProjects: () => {
      // 선으로 떠나던 프리뷰도 재생 없이 Projects 쪽으로 돌려놓는다. 입력이 다룰 프리뷰가 보인다.
      if (alive && linePose.p > 0) dropLine();
      if (!alive || (pose.t <= 1 && goal !== 2) || (pose.t >= 2 && !travel)) return;
      travel?.kill();
      travel = null;
      goal = 2;
      pose.t = 2;
      renderLogo();
    },
    destroy: () => {
      alive = false;
      cancelAnimationFrame(queued);
      resize?.disconnect();
      projectsSection?.removeEventListener('focusin', reveal);
      frame?.removeEventListener('load', onImageLoad, true);
      travel?.kill();
      lineTween?.kill();
      syncPin();
      if (linePlaying) {
        linePlaying = false;
        onLinePlay?.(false);
      }
      overlay?.setBoundary(null);
      dropWord();
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
      clearProjects();
      const caption = frame?.querySelector<HTMLElement>('[data-part="preview-caption"]');
      if (caption) clearCaptionReveal(caption);
    },
  };
}
