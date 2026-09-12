'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { isProjectModalReady } from '@/lib/utils/projectContract';
import { projects } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import { setProjectModalObscured } from '@/hooks/useProjectModalObscured';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import type { Flip } from '@/lib/gsap';
import type { PreviewMorphHandle } from '@/components/blocks/PreviewMorph';

const ProjectModal = dynamic(
  () => import('@/components/blocks/ProjectModal'),
  { ssr: false }
);

// three는 Hyperspeed와 공유하는 큰 덩어리다. Projects 섹션에 들어오기 전에
// 정적 번들로 딸려 들어오면 안 되므로 next/dynamic으로 늦게 부른다.
// next/dynamic의 LoadableComponent는 ref를 로드된 컴포넌트에 전달하지 않는다
// (HyperspeedBackground.tsx의 주석이 실측을 적어 뒀다). 그래서 핸들은 ref가
// 아니라 일반 prop으로 받는 다리 컴포넌트를 끼운다
const DynamicPreviewMorph = dynamic(
  () =>
    import('@/components/blocks/PreviewMorph').then(({ default: PreviewMorph }) => ({
      default: function PreviewMorphRefBridge({
        className,
        preload,
        onHandle,
      }: {
        className?: string;
        preload?: readonly string[];
        onHandle: (handle: PreviewMorphHandle | null) => void;
      }) {
        return <PreviewMorph ref={onHandle} className={className} preload={preload} />;
      },
    })),
  { ssr: false }
);

const N = projects.length;
// 휠의 중심. 목록의 세로 한가운데이고, 고른 항목이 항상 이 자리로 온다.
// applyWheel의 centerShift가 이 값을 쓴다
const CENTER = (N - 1) / 2;
// 모프가 마운트 직후 받아 둘 도착 이미지 경로. 렌더마다 새 배열을 만들면
// PreviewMorph의 프리로드 effect가 매번 다시 돈다. 모듈 상수로 한 번만 만든다
const PROJECT_IMAGE_PATHS = projects.map((p) => p.image);

// history.state에서 projectModalId 키만 걷어내고 나머지 필드(Next.js가
// 쓰는 것 포함)는 그대로 둔다. state가 객체가 아니면 빈 객체로 시작한다
function stripProjectModalId(state: unknown): Record<string, unknown> {
  const base: Record<string, unknown> =
    state && typeof state === 'object' ? { ...(state as Record<string, unknown>) } : {};
  delete base.projectModalId;
  return base;
}

// mount와 popstate가 공용하는 순수 판정. history를 읽지도 쓰지도 않고
// 인자만 본다. 두 경로가 갈리면 새로고침 복구와 뒤로가기 복구가
// 다르게 동작한다(계획 5 T2 Task 9)
export function reconcileProjectModal(historyState: unknown): string | null {
  if (!historyState || typeof historyState !== 'object') return null;
  const id = (historyState as Record<string, unknown>).projectModalId;
  if (typeof id !== 'string') return null;
  const project = projects.find((p) => p.title === id);
  if (!project || !isProjectModalReady(project)) return null;
  return id;
}

const MUTED = 'rgb(255 255 255 / 0.62)';

// 이름 목록의 휠 조형. 조형의 정본은
// .claude/designRefactoring/optionWheel/optionWheel.tsx의 runFrame이고,
// 여기로 옮겨 온 것은 배치 수학뿐이다. 휠 스크롤도 드래그도 순환도 안
// 가져온다. 이 섹션에는 중첩 스크롤 계약이 이미 있어서 이름 위에서
// wheel을 막으면 페이지 스크롤이 죽고, 여섯 개짜리 목록이 순환하면
// 어디가 처음인지 사라진다. 선택은 클릭과 방향키로만 옮긴다. 호버도
// 포커스도 선택을 옮기지 않는다.
//
// 값은 optionWheel의 기본값(항목 12개, 3rem 글자)이 아니라 우리 목록
// (항목 여섯, 26px 글자)에 맞춘 것이다
const WHEEL_TILT_DEG = 7; // 기본 6은 항목 12개의 곡률이다. 여섯이면 호가 직선으로 보인다
const WHEEL_CURVE = 1;
const WHEEL_BLUR_PX = 1.6; // 기본 2는 두 칸만 멀어져도 글자가 뭉갠다
const WHEEL_FADE = 0.3; // 기본 0.25보다 세게. 항목이 적어 대비를 더 줘야 활성이 산다
const WHEEL_MIN_OPACITY = 0.18; // 기본 0.05는 사실상 안 보인다. 몇 개인지가 이 목록의 정보다
const WHEEL_SMOOTHING_MS = 200;
// optionWheel의 side='right'. 호가 오른쪽으로 부풀어 활성 이름이 프리뷰에
// 가장 가까운 자리에 남는다. 반대 부호였다면 먼 항목이 프리뷰 열을 침범한다
const WHEEL_MIRROR = -1;
// 모달이 열릴 때 휠의 나머지 이름이 벌어지는 폭과 블러. spread(0→1)가
// 이 상수들에 곱해진다. 활성 항목(dist 0)은 안 받는다. 비행 손잡이가
// 거기 있다
const WHEEL_SPLIT_PX = 56;
const WHEEL_SPLIT_BLUR_PX = 6;

// 프리뷰 캡션 뒤 국소 그라데이션. 전면 카드로 덮지 않고 글자가 앉는
// 아래쪽에만 깐다 - SkillsSection의 SKILL_DESCRIPTION_SCRIM, About의
// ABOUT_SCRIMS_MOBILE와 같은 처방이고 방향(to top)도 같다. 알파 0.78도
// SKILL_DESCRIPTION_SCRIM에서 가져온 값이다.
//
// 다만 저 둘과 달리 뒷배경이 Hyperspeed가 아니라 남의 앱 화면 녹화다.
// 여섯 프로젝트 중 다섯이 밝은 테마라 캡션 뒤에 순백(255,255,255)이 그대로
// 온다. 형제 섹션처럼 기울기를 계속 태우면 글자 윗줄이 알파 0.47 자리에
// 앉아 대비가 3.25:1까지 내려간다(크롬 실측). 그래서 위 두 정지점의 알파를
// 같게 두어 글자가 앉는 구간 전체를 평평한 0.78로 만들고, 기울기는 글자가
// 없는 위쪽 여백(pt-12)에서만 진다. 어느 줄이 어디에 앉든 뒤가 같은 알파다
const PREVIEW_CAPTION_SCRIM =
  'linear-gradient(to top, rgb(0 0 0 / 0.78) 0%, rgb(0 0 0 / 0.78) 62%, rgb(0 0 0 / 0.3) 84%, rgb(0 0 0 / 0) 100%)';

// 프로젝트가 갈릴 때 미디어 겹이 자리를 잡는 시간. --animate-duration-base와
// 같은 값이다. 이름을 훑으면 매번 오는 전환이라 길면 걸리적거린다
const PREVIEW_SWAP_MS = 300;

// 접힘 프리뷰와 펼침 stage 사이 비행 시간. 워드마크 FLIP과 같은 값이고
// 정본은 styles/design-tokens.css의 워드마크 flip 지속 변수다. HomeClient도
// 같은 값을 복제해 둔다. 숫자 하나 때문에 공유 모듈을 파지 않는다
const FLIP_DURATION_MS = 500;

// 제목만 100ms 더 날린다. 사용자가 글자 비행을 조금 느리게 보고 싶다고
// 했다. 100ms는 느리다고 느껴지되 이미지와 따로 논다고 느껴지지는 않는
// 값이다(설계 문서 "비행의 시작과 끝을 잇는다" 참고)
const TITLE_FLIP_MS = 600;

// 머리띠가 등장하는 시각. 비행의 정확히 절반이다. 몸통이 등장할 틀이
// 먼저 서야 한다
const HEAD_IN_AT_MS = FLIP_DURATION_MS / 2;

// #pm-shell 클래스가 쓰는 판 배경색. gsap 색 파서가 읽는 표기로 적는다
const SHELL_BG = 'rgba(6, 8, 10, 0.97)';
const SHELL_BG_CLEAR = 'rgba(6, 8, 10, 0)';

// FLIP은 섹션이 두 열로 서는 lg(1024) 위에서만 태운다. 비행의 출발 기하가
// 섹션의 접힘 프리뷰이므로 모달이 아니라 섹션 쪽 경계를 쓴다
const WIDE_QUERY = '(min-width: 1024px)';

// Flip.from은 timeline을, Flip.fit은 tween을 돌려준다. 정리에 필요한 건
// kill() 하나뿐이라 그것만 확인해서 담는다
function asKillable(value: unknown): { kill: () => void } | null {
  return value && typeof (value as { kill?: unknown }).kill === 'function'
    ? (value as { kill: () => void })
    : null;
}

// 비행 동안 stage와 셸 사이 조상들의 자르기를 걷어야 한다. 증거 열에 걸린
// overflow-hidden이, 접힘 프리뷰 자리에 있는 비행 초반(펼치기)·후반(닫기)의
// stage를 잘라내기 때문이다. 셸 자신은 뷰포트 전체라 자를 게 없고 건드리면
// 스크롤바가 생길 수 있어 뺀다. data-modal-part 이름에 기대지 않으므로 모달
// 구조가 바뀌어도 따라간다
function collectClippedAncestors(stageEl: Element, shellEl: Element): Element[] {
  const clipped: Element[] = [];
  for (
    let node: Element | null = stageEl.parentElement;
    node && node !== shellEl;
    node = node.parentElement
  ) {
    clipped.push(node);
  }
  return clipped;
}

// 지금 보이는 미디어 한 프레임을 캔버스에 뜬다. 비행 동안 상자 위에 얹어
// 그림이 안 바뀌게 하는 다리다. 캔버스를 못 만드는 환경(jsdom)이나 아직
// 크기가 없는 미디어면 null이고, 그때는 다리 없이 지금처럼 난다
function snapshotMedia(
  el: HTMLVideoElement | HTMLImageElement | null
): HTMLCanvasElement | null {
  if (!el) return null;
  const isVideo = el instanceof HTMLVideoElement;
  const srcWidth = isVideo ? el.videoWidth : el.naturalWidth;
  const srcHeight = isVideo ? el.videoHeight : el.naturalHeight;
  if (!srcWidth || !srcHeight) return null;

  // 가로 1280 캡. 그보다 큰 원본을 그대로 뜨면 drawImage가 비싸다
  const scale = Math.min(1, 1280 / srcWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(srcWidth * scale);
  canvas.height = Math.round(srcHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
  } catch {
    // 오염된 원본(CORS) 등으로 drawImage가 던지면 다리 없이 넘어간다
    return null;
  }

  canvas.dataset.part = 'media-bridge';
  // object-fit은 캔버스에도 먹는다. 프리뷰의 object-cover와 같은 잘림이라
  // 출발 프레임이 프리뷰와 겹친다
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.objectFit = 'cover';
  canvas.style.pointerEvents = 'none';
  return canvas;
}

export default function ProjectsSection() {
  const { routeResolved, motionReady, reducedMotion } =
    useSectionActivity();
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  // 상세 판 내용의 등장 소유권은 ProjectModal에 있다. 여기는 비행과 셸 배경과
  // 배경 알림만 갖고, 안무가 언제 시작하는지만 이 값으로 알린다.
  // null = 안무 없음(관문이 닫힌 경로), false = 비행 중(머리띠도 없음),
  // 'head' = 머리띠만 등장, true = 몸통까지 등장
  const [revealed, setRevealed] = useState<boolean | 'head' | null>(null);

  const nameRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // 이름 단추 안쪽의 글자 상자. 비행 손잡이는 단추가 아니라 이쪽이 쥔다 -
  // 단추도 글자 너비지만 py만큼 세로로 더 크므로, 단추를 그대로
  // 태우면 Flip이 그 높이 비율을 비행 첫 프레임 배율로 박는다
  const nameFlipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // 휠의 지금 자리와 목표. 목표는 activeIndex이고 지금 자리는 그리로
  // 수렴하는 중이라 정수가 아닐 수 있다
  const wheelPosRef = useRef(0);
  const wheelTargetRef = useRef(0);
  const wheelRafRef = useRef<number | null>(null);
  const wheelLastRef = useRef(0);
  // 휠이 벌어지는 정도(0→1). GSAP이 트윈할 수 있게 객체로 감싼다.
  // applyWheel이 매 프레임 이 값을 읽는다
  const wheelSpreadRef = useRef({ v: 0 });
  const spreadTweenRef = useRef<{ kill: () => void } | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  // 프로젝트 전환 tween이 붙는 겹. previewRef 자신이 아니라 그 안쪽이다 -
  // openModal이 Flip.getState(previewRef)로 뜨는 것은 previewRef의
  // getBoundingClientRect이고, 자식에 걸린 transform은 거기 안 섞인다.
  // 호버로 전환이 시작되자마자 클릭이 오는 흔한 경로에서 비행이 비뚤어지지
  // 않는 이유가 이것이다. 프리뷰 자신에 걸었다면 openModal에서 tween을
  // 먼저 죽여야 했을 것이다
  const mediaLayerRef = useRef<HTMLDivElement | null>(null);
  const swapTweenRef = useRef<{ kill: () => void } | null>(null);
  // 비행 앞뒤로 접힘 프리뷰(previewRef 자신)에 거는 opacity tween. 전환
  // tween(swapTweenRef, mediaLayerRef 담당)과는 대상도 시점도 다르다
  const previewTweenRef = useRef<{ kill: () => void } | null>(null);
  // 닫기 비행에서만 도는 캡션 등장 tween. 프리뷰 상자 전체를 채우는
  // previewTweenRef와 대상도 구간도 다르므로 ref를 따로 둔다
  const captionTweenRef = useRef<{ kill: () => void } | null>(null);
  // 셰이더 모프의 명령형 손잡이. next/dynamic이 늦게 풀어 주므로 처음 몇
  // 프레임은 null이고, 그동안의 전환은 아래 gsap 폴백이 맡는다
  const morphHandleRef = useRef<PreviewMorphHandle | null>(null);
  const handleMorphHandle = useCallback((handle: PreviewMorphHandle | null) => {
    morphHandleRef.current = handle;
  }, []);
  // 이번 activeIndex 변화를 모프가 맡았는가. goTo가 DOM이 갈리기 전에 세우고
  // 전환 effect가 읽고 지운다
  const morphStartedRef = useRef(false);
  // goTo가 "정말 다른 프로젝트로 옮기는가"를 판정하는 데만 쓴다. 이미 켜져
  // 있는 이름에 다시 호버해도 goTo는 불리는데, 그때 모프를 태우면 같은 그림
  // 사이를 녹이는 이유 없는 모션이 된다
  const activeIndexRef = useRef(0);
  // 펼침 stage. 모달이 지연 로드라 부모의 layout effect로는 DOM에 박히는
  // 순간을 못 잡는다 - ProjectModal의 onStageMount 콜백 ref가 채운다
  const stageElRef = useRef<HTMLDivElement | null>(null);
  // GSAP은 정적 import에서 뺐다(HomeClient와 같은 이유). 마운트 직후 미리
  // 요청해 ref에 담아 두고 아래는 이 ref를 동기적으로만 읽는다 -
  // Flip.getState()는 DOM이 바뀌기 직전에 동기 호출돼야 해서 await을 넣을
  // 자리가 아니다. 아직 안 왔으면 FLIP 없이 넘어간다
  const gsapModuleRef = useRef<typeof import('@/lib/gsap') | null>(null);
  const pendingFlipStateRef = useRef<Flip.FlipState | null>(null);
  const flightRef = useRef<{ kill: () => void } | null>(null);
  // 제목을 되돌리는 두 번째 비행. stage와 길이가 달라(S-1) 열기·닫기
  // 둘 다 Flip 호출이 stage와 제목으로 갈린다
  const titleFlightRef = useRef<{ kill: () => void } | null>(null);
  // 모달 틀(셸·머리띠·증거 열) 트윈. 닫기 쪽만 담는다. 열기 쪽은
  // flightRef의 kill에 같이 묶여 있다(handleStageMount)
  const frameTweenRef = useRef<{ kill: () => void } | null>(null);
  // 닫기 비행 동안 감춰 둔 착지점 이름. 착지든 중도 정리든 되돌릴 자리를
  // 잃지 않으려고 노드 자체를 들고 있는다
  const hiddenNameRef = useRef<HTMLElement | null>(null);
  // 닫기 비행이 프리뷰 상자 안에 얹어 둔 미디어 다리. 모달이 내려간 뒤(정리
  // effect)에야 서서히 지운다. 그 전에 지우면 착지 순간에 프리뷰 그림이
  // 한 번 바뀌어 튄다
  const previewBridgeRef = useRef<HTMLCanvasElement | null>(null);
  // 모달을 연 시점의 인덱스. 착지점은 이 값으로 집는다. 펼친 상태에서는
  // 프로젝트를 못 바꾸니 지금은 activeIndex와 같지만, 같다는 사실에 기대는
  // 코드는 언젠가 깨진다
  const openedIndexRef = useRef(0);
  // 붕괴가 끝나기를 기다렸다 닫기 비행을 띄우는 예약. setTimeout이 아니라
  // GSAP 시계를 쓴다. 탭이 백그라운드에 갔다 와도 타임라인과 안 어긋난다
  const collapseCallRef = useRef<{ kill: () => void } | null>(null);
  // 비행 500ms 동안 모달은 아직 열려 있고 포커스 트랩도 살아 있다. Escape를
  // 또 누르거나 배경을 또 클릭하면 closeModal이 다시 불린다
  const closingRef = useRef(false);
  // 지금 열린 모달이 우리가 pushState한 항목인지 기억한다. 새로고침으로
  // 복구된 모달(우리가 push한 적 없는 항목)을 history.back()으로 닫으면
  // 직전 항목이 우리 사이트가 아닐 수 있어 페이지를 떠난다. 그래서
  // pushedRef가 false일 때는 back() 대신 replaceState로 키만 지운다
  const pushedRef = useRef(false);

  const activeProject = projects[activeIndex];
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setMediaError(false);
  }, [activeIndex]);

  const handleMediaError = useCallback(() => {
    setMediaError(true);
  }, []);

  useEffect(() => {
    setProjectModalObscured(modalOpen);
  }, [modalOpen]);

  useEffect(() => {
    import('@/lib/gsap').then((mod) => {
      gsapModuleRef.current = mod;
    });
  }, []);

  // 프로젝트 전환. 이 모션이 전하는 것 하나: "보고 있는 프로젝트가 바뀌었다".
  // 새 화면이 조금 크게 아래에서 들어와 제자리에 앉는다. 순환 재생(3초)이
  // 도는 중의 src 교체에는 안 걸린다. 그건 같은 프로젝트 안의 다음 장면이라
  // 상태 전환이 아니고, 걸면 3초마다 영원히 꿈틀대는 잔모션이 된다.
  // transform과 opacity만 만진다. 이름을 빠르게 훑으면 전환이 겹치므로
  // 이전 것을 죽이고 다음을 태운다
  useEffect(() => {
    activeIndexRef.current = activeIndex;
    const layer = mediaLayerRef.current;
    swapTweenRef.current?.kill();
    swapTweenRef.current = null;
    // 이 전환을 셰이더 모프가 맡았으면 겹에는 아무것도 걸지 않는다. 두 화면을
    // 녹여 잇는 일을 셰이더가 이미 하고 있고, 겹은 그 아래에서 조용히 갈린다
    const morphed = morphStartedRef.current;
    morphStartedRef.current = false;
    if (!layer) return;
    const mod = gsapModuleRef.current;
    // reduce에서는 즉시 교체로 무너진다. 죽은 tween이 남긴 transform도 걷는다
    if (morphed || !mod || !motionReady || reducedMotion) {
      layer.style.removeProperty('transform');
      layer.style.removeProperty('opacity');
      return;
    }
    mod.registerGsap();
    swapTweenRef.current = asKillable(
      mod.gsap.fromTo(
        layer,
        { opacity: 0, scale: 1.06, yPercent: 3 },
        {
          opacity: 1,
          scale: 1,
          yPercent: 0,
          duration: PREVIEW_SWAP_MS / 1000,
          ease: mod.SITE_EASE,
          clearProps: 'transform',
        }
      )
    );
  }, [activeIndex, motionReady, reducedMotion]);

  // 모달이 사라지면 남은 비행과 재진입 잠금을 푼다. 정상 닫기에서는 이미 끝난
  // tween을 한 번 더 kill할 뿐이지만, popstate가 비행 중에 모달을 걷어가는
  // 경우에는 이 정리가 없으면 closingRef가 참으로 굳어 다음 닫기가 막힌다
  // 닫기 비행 동안 감췄던 착지점 이름을 되돌린다. 착지 onComplete 한 곳에만
  // 두면 비행이 중간에 죽었을 때 이름이 영영 안 보인다
  const restoreLandingName = useCallback(() => {
    hiddenNameRef.current?.style.removeProperty('opacity');
    hiddenNameRef.current = null;
  }, []);

  useEffect(() => {
    if (modalOpen) return;
    // 닫기 비행을 거쳐 돌아온 것인지 여기서 한 번만 읽는다. 바로 아래에서
    // 잠금을 푸는 순간 이 사실이 사라진다
    const returning = closingRef.current;
    closingRef.current = false;
    flightRef.current?.kill();
    flightRef.current = null;
    titleFlightRef.current?.kill();
    titleFlightRef.current = null;
    restoreLandingName();
    // 붕괴를 기다리던 예약이 남아 있으면 사라진 stage로 비행을 띄운다
    collapseCallRef.current?.kill();
    collapseCallRef.current = null;
    setRevealed(null);

    // 여기부터는 "모달이 방금 닫혔지만 비행을 끝까지 마쳤다는 보장이
    // 없는" 경로(좁은 화면, reduce, 비행 중 popstate로 강제로 닫힌 경우)를
    // 위한 정리다. 비행이 끝까지 돌았다면 각 tween이 이미 스스로 제값에
    // 도착해 있어 아래는 덮어쓸 뿐 해가 없다
    spreadTweenRef.current?.kill();
    spreadTweenRef.current = null;
    wheelSpreadRef.current.v = 0;
    applyWheel(wheelPosRef.current);

    previewTweenRef.current?.kill();
    previewTweenRef.current = null;
    if (previewRef.current) {
      gsapModuleRef.current?.gsap.set(previewRef.current, { clearProps: 'opacity' });
    }

    // 상세에서 돌아왔다면 여기가 캡션 글자를 들여보내는 자리다. 모달이 막
    // 사라져 프리뷰가 처음으로 온전히 보이는 순간이기 때문이다. 비행이 도는
    // 500ms 안에 밀어 봐야 소용이 없다. 그 구간의 프리뷰 상자는 바로 위
    // previewTween이 투명에서 채우는 중인 데다, 착지하는 stage가 그 위를
    // 덮고 내려앉아 무엇을 움직여도 화면에 안 나온다. 글자를 왼쪽으로
    // 치워 두는 것은 closeModal이 비행을 띄우는 시점에 이미 해 두었다.
    // 비행 도중에 모달이 걷혀 갔거나(popstate) 애초에 안 열렸다면 밀 것이
    // 없으니 인라인 값만 걷는다
    captionTweenRef.current?.kill();
    captionTweenRef.current = null;
    const captionTextEl = mediaLayerRef.current?.querySelector<HTMLElement>(
      '[data-part="preview-caption-text"]'
    );
    const captionMod = flipModule();
    if (captionTextEl && returning && captionMod) {
      captionTweenRef.current = asKillable(
        captionMod.gsap.to(captionTextEl, {
          xPercent: 0,
          opacity: 1,
          duration: 0.45,
          ease: captionMod.SITE_EASE,
          clearProps: 'transform,opacity',
        })
      );
    } else if (captionTextEl) {
      gsapModuleRef.current?.gsap.set(captionTextEl, {
        clearProps: 'transform,opacity',
      });
    }

    // 닫기 비행이 프리뷰 상자에 얹어 둔 다리를 크로스페이드로 걷는다
    if (previewBridgeRef.current) {
      const bridge = previewBridgeRef.current;
      previewBridgeRef.current = null;
      const mod = gsapModuleRef.current;
      if (mod) {
        mod.gsap.to(bridge, {
          opacity: 0,
          duration: 0.25,
          ease: mod.SITE_EASE,
          onComplete: () => bridge.remove(),
        });
      } else {
        bridge.remove();
      }
    }

    frameTweenRef.current?.kill();
    frameTweenRef.current = null;
    // applyWheel은 이 effect보다 뒤에서 선언되지만 useCallback([])이라
    // 항등성이 고정이다. 이 클로저가 실제로 도는 시점(커밋 이후, 렌더
    // 함수 전체가 끝난 뒤)에는 이미 만들어져 있어 안전하다. deps 배열에
    // 넣으면 이 useEffect 호출 자체가 평가되는 순간(렌더 도중, applyWheel의
    // const 선언보다 앞)에 그 이름을 읽어 TDZ에 걸리므로 여기서는 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, restoreLandingName]);

  // 비행 도중 컴포넌트가 통째로 사라지는 경우
  useEffect(
    () => () => {
      flightRef.current?.kill();
      titleFlightRef.current?.kill();
      collapseCallRef.current?.kill();
      swapTweenRef.current?.kill();
    },
    []
  );

  // 모달을 닫으면 Modal atom이 포커스를 opener로 돌려주려 하지만, 그 정리가
  // 도는 시점에는 셸의 격리 속성이 아직 안 벗겨졌다. 바로 위 effect가 그보다
  // 뒤에 돌기 때문이다. 그래서 atom은 opener가 갇혀 있다고 보고 포기하고,
  // 포커스는 사라진 닫기 버튼과 함께 문서 바닥으로 떨어진다. 한 프레임 뒤
  // 격리가 걷힌 다음 여기서 직접 돌려준다.
  // wasOpenRef가 없으면 첫 mount에서도 돌아 페이지를 열자마자 Projects
  // 이름 버튼으로 포커스를 훔쳐 간다
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (modalOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;

    const raf = requestAnimationFrame(() => {
      const opener = nameRefs.current[activeIndex];
      const usable =
        !!opener?.isConnected && !opener.closest('[inert], [aria-hidden="true"]');
      const fallback = sectionRef.current?.closest<HTMLElement>('[data-section]') ?? null;
      (usable ? opener : fallback)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [modalOpen, activeIndex]);

  // modal-only History. mount와 단일 popstate 구독이 같은 함수
  // (applyReconciliation)를 쓴다. 새로고침 복구와 뒤로가기 복구가 갈리지
  // 않게 하는 것이 이 배선의 요점이다. 유효한 id면 그 프로젝트로
  // activeIndex를 맞추고 모달을 열 뿐 push도 replace도 하지 않는다.
  // 무효한 id는 그 키만 replaceState로 지운다
  useEffect(() => {
    const applyReconciliation = () => {
      const state = window.history.state;
      const id = reconcileProjectModal(state);
      if (id) {
        const idx = projects.findIndex((p) => p.title === id);
        if (idx !== -1) {
          setActiveIndex(idx);
          // openModal을 안 거치는 복구 경로다. 여기서 안 맞추면 닫기 비행의
          // 착지점이 엉뚱한 이름으로 간다
          openedIndexRef.current = idx;
        }
        setModalOpen(true);
      } else {
        setModalOpen(false);
        if (state && typeof state === 'object' && 'projectModalId' in (state as object)) {
          window.history.replaceState(stripProjectModalId(state), '', window.location.hash);
        }
      }
      pushedRef.current = false;
    };

    applyReconciliation();
    window.addEventListener('popstate', applyReconciliation);
    return () => window.removeEventListener('popstate', applyReconciliation);
  }, []);

  // FLIP 관문. 3중 게이트 -> 넓은 화면 -> 모듈 준비 순서다. 이 순서가 계약이다:
  // 좁은 화면에서는 GSAP을 아예 건드리지 않는다. matchMedia가 없는 환경도 같이
  // 막는다. 상태로 들고 있지 않고 비행 직전에 한 번 물어본다
  const flipModule = useCallback(() => {
    if (!routeResolved || !motionReady || reducedMotion) return null;
    if (typeof window.matchMedia !== 'function') return null;
    if (!window.matchMedia(WIDE_QUERY).matches) return null;
    const mod = gsapModuleRef.current;
    if (!mod) return null;
    mod.registerGsap();
    return mod;
  }, [routeResolved, motionReady, reducedMotion]);

  const openModal = useCallback(
    (i: number) => {
      const mod = flipModule();
      openedIndexRef.current = i;
      // 이름 노드는 눌린 인덱스로 집는다. handleNameClick이 goTo(i)를 먼저
      // 부르지만 그건 비동기 상태 갱신이라 이 시점 DOM의 활성 이름은 아직
      // 이전 것일 수 있다 - activeIndex로 집으면 엉뚱한 노드가 날아간다
      const nameEl = nameFlipRefs.current[i];
      if (mod && previewRef.current && nameEl) {
        // 호버 없이 클릭이 곧장 오는 경로(터치, 프로그램적 클릭)에서는 goTo(i)가
        // 아직 커밋 전이라 접힘 손잡이가 이전 프로젝트 것이거나 아예 없다.
        // Flip.getState가 읽는 게 이 속성이므로 뜨기 직전에만 눌린 프로젝트
        // 것으로 맞춘다. 이름은 곧바로 되돌린다. 안 되돌리면 펼침 제목과 같은
        // 손잡이를 가진 노드가 화면에 둘이 돼 짝짓기가 깨진다. 프리뷰는
        // 되돌릴 필요가 없다. 다음 렌더가 modalOpen 때문에 어차피 지운다
        const nameHandle = nameEl.dataset.flipId;
        previewRef.current.dataset.flipId = `pv-${projects[i].title}`;
        nameEl.dataset.flipId = `title-${projects[i].title}`;
        pendingFlipStateRef.current = mod.Flip.getState([previewRef.current, nameEl]);
        if (nameHandle === undefined) delete nameEl.dataset.flipId;
        else nameEl.dataset.flipId = nameHandle;
      }
      // 비행을 실제로 태울 수 있을 때만 내용을 감춘다. 관문이 닫혔으면
      // null로 둬서 상세 판이 처음부터 그냥 보이게 한다
      setRevealed(pendingFlipStateRef.current ? false : null);
      // 기존 state를 펼쳐 담는다. Next.js가 쓰는 필드를 날리면 안 된다
      window.history.pushState(
        { ...window.history.state, projectModalId: projects[i].title },
        '',
        window.location.hash
      );
      pushedRef.current = true;
      setModalOpen(true);
    },
    [flipModule]
  );

  // 실제로 닫는 몸통. 즉시 닫기와 비행 착지 뒤 닫기가 이 하나를 공유한다
  const finishClose = useCallback(() => {
    if (pushedRef.current) {
      // 우리가 push한 항목이다. 그 앞 항목은 항상 우리 사이트다
      window.history.back();
    } else {
      // 새로고침으로 복구된 모달이다. 앞 항목이 우리 사이트가 아닐 수
      // 있으므로 back() 대신 키만 지운다
      window.history.replaceState(
        stripProjectModalId(window.history.state),
        '',
        window.location.hash
      );
    }
    pushedRef.current = false;
    setModalOpen(false);
  }, []);

  // 닫기는 Flip.fit이다. 펼침 노드를 접힘 프리뷰 자리로 되돌린 뒤 착지하고 나서
  // 모달을 내린다. 접힘 노드를 날리면 비행 초반이 섹션 상자 밖이라
  // .section-stage의 overflow에 잘린다. 펼침 노드는 그 자르기를 안 받는다.
  // Flip.from을 역방향으로 못 쓰는 이유는 이 시점에 두 노드가 다 살아 있어서
  // 상태를 뜨고 DOM을 바꾸는 순서 자체가 성립하지 않기 때문이다
  const closeModal = useCallback(() => {
    if (closingRef.current) return;
    const stageEl = stageElRef.current;
    const previewEl = previewRef.current;
    const mod = flipModule();
    if (!mod || !stageEl || !previewEl) {
      finishClose();
      return;
    }

    closingRef.current = true;
    // 0ms: 붕괴 시작. 몸통만 접는다(내용 접기는 ProjectModal이 갖는다).
    // 머리띠는 비행이 뜨는 순간(아래 delayedCall)까지 남는다
    setRevealed('head');

    collapseCallRef.current = asKillable(
      mod.gsap.delayedCall(mod.REVEAL_OUT_MS / 1000, () => {
        collapseCallRef.current = null;
        // 배경 복원은 비행과 같은 시점에 시작한다. finishClose를 통해
        // 간접적으로 두면 착지한 뒤에야 돌아와 열기와 대칭이 아니다
        setProjectModalObscured(false);
        // 머리띠가 비행과 함께 사라진다
        setRevealed(false);

        const seconds = FLIP_DURATION_MS / 1000;
        const titleSeconds = TITLE_FLIP_MS / 1000;
        const shellEl = document.getElementById('pm-shell');
        const headEl = document.querySelector<HTMLElement>('[data-modal-part="head"]');
        const evidenceEl = document.querySelector<HTMLElement>(
          '[data-modal-part="evidence"]'
        );
        const clipped = shellEl ? collectClippedAncestors(stageEl, shellEl) : [];

        mod.gsap.set(clipped, { overflow: 'visible' });

        // 착지 직전 마지막으로 보이던 stage의 그림을 캔버스 둘에 각각 뜬다.
        // 하나는 날아 내려가는 stage 위에(모달과 함께 사라지니 따로 안
        // 지운다), 하나는 착지할 프리뷰 상자 안에 놓아 착지 순간에 그림이
        // 바뀌어 튀지 않게 한다
        const stageMediaEl = stageEl.querySelector<HTMLVideoElement | HTMLImageElement>(
          'figure:not([hidden]) video, figure:not([hidden]) img'
        );
        const stageBridge = snapshotMedia(stageMediaEl);
        if (stageBridge) stageEl.appendChild(stageBridge);
        const previewLayer = mediaLayerRef.current;
        if (previewLayer) {
          const previewBridge = snapshotMedia(stageMediaEl);
          if (previewBridge) {
            // 캡션 띠(preview-caption)가 이 상자의 마지막 자식이다. 다리는
            // 그 앞에 꽂아야 미디어와 같은 자리에 들어간다. 뒤에 꽂으면
            // 다리가 어둠 띠와 글자를 덮어 크로스페이드 동안 캡션이 한 번
            // 가려진다
            const anchor = previewLayer.querySelector('[data-part="preview-caption"]');
            if (anchor) previewLayer.insertBefore(previewBridge, anchor);
            else previewLayer.appendChild(previewBridge);
            previewBridgeRef.current = previewBridge;
          }
        }

        // 모달 틀(셸·머리띠·증거 열)이 비행 전체 길이에 걸쳐 빠진다. 열기의
        // 역이라 커브도 뒤집는다(power2.out). 제값은 이미 인라인에 있으므로
        // (열기 쪽 clearProps가 걸어 둔 값이거나 애초에 안 열렸던 값) 읽지
        // 않고 곧장 투명으로 보낸다
        const shellTween = shellEl
          ? mod.gsap.to(shellEl, {
              backgroundColor: SHELL_BG_CLEAR,
              duration: seconds,
              ease: 'power2.out',
            })
          : null;
        const headTween = headEl
          ? mod.gsap.to(headEl, {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              duration: seconds,
              ease: 'power2.out',
            })
          : null;
        const evidenceTween = evidenceEl
          ? mod.gsap.to(evidenceEl, {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              duration: seconds,
              ease: 'power2.out',
            })
          : null;
        frameTweenRef.current = {
          kill: () => {
            shellTween?.kill();
            headTween?.kill();
            evidenceTween?.kill();
          },
        };

        // 휠이 제자리로 모인다(spread 1 → 0)
        spreadTweenRef.current?.kill();
        spreadTweenRef.current = asKillable(
          mod.gsap.to(wheelSpreadRef.current, {
            v: 0,
            duration: seconds,
            ease: mod.SITE_EASE,
            onUpdate: () => applyWheel(wheelPosRef.current),
          })
        );

        // 접힘 프리뷰가 돌아온다. stage가 착지하기(500ms 뒤) 전에 다
        // 차 있어야 한다
        previewTweenRef.current?.kill();
        previewTweenRef.current = asKillable(
          mod.gsap.to(previewEl, {
            opacity: 1,
            duration: 0.3,
            delay: 0.2,
            ease: mod.SITE_EASE,
            clearProps: 'opacity',
          })
        );

        // 돌아간 화면에서 왼쪽으로부터 들어올 글자를 지금 미리 치워 둔다.
        // 실제로 미는 것은 모달이 다 내려간 뒤이고(modalOpen 정리 effect),
        // 치우기만 여기서 하는 이유는 이 순간의 프리뷰 상자가 아직 투명이라
        // 글자가 사라지는 장면 자체가 안 보이기 때문이다. 움직이는 것은 글자
        // 묶음 하나뿐이다. 어둠 띠는 제자리에 있어야 오른쪽 끝에 안 어두워진
        // 구간이 안 생기고, 그림도 모프 캔버스도 그대로다
        const captionTextEl = previewLayer?.querySelector<HTMLElement>(
          '[data-part="preview-caption-text"]'
        );
        captionTweenRef.current?.kill();
        captionTweenRef.current = null;
        if (captionTextEl) {
          mod.gsap.set(captionTextEl, { xPercent: -8, opacity: 0 });
        }

        flightRef.current = asKillable(
          mod.Flip.fit(stageEl, previewEl, {
            duration: seconds,
            ease: mod.SITE_EASE,
            scale: true,
            onComplete: () => {
              mod.gsap.set(clipped, { clearProps: 'overflow' });
              // 제목 비행이 없으면 여기가 모달을 내리는 마지막 자리다.
              // 있으면 제목의 onComplete가 100ms 뒤에 대신 부른다. 먼저
              // 내리면 제목이 허공에서 사라진다(S-1)
              if (!titleFlightRef.current) finishClose();
            },
          })
        );

        // 제목도 같은 시점에 시작하지만 100ms 더 걸린다(S-1). 착지점 이름은
        // 비행 동안 감춘다. 셸 배경이 비행 전체에 걸쳐 빠지므로 그냥 두면
        // 날아오는 제목과 제자리 이름이 겹쳐 읽힌다. visibility가 아니라
        // opacity인 것은 이 노드가 착지 좌표의 기준이라 레이아웃이 살아
        // 있어야 하기 때문이다
        const titleEl = document.getElementById('pm-title');
        const landingEl = nameFlipRefs.current[openedIndexRef.current];
        if (titleEl && landingEl) {
          landingEl.style.opacity = '0';
          hiddenNameRef.current = landingEl;
          titleFlightRef.current = asKillable(
            mod.Flip.fit(titleEl, landingEl, {
              duration: titleSeconds,
              ease: mod.SITE_EASE,
              scale: true,
              onComplete: () => {
                restoreLandingName();
                finishClose();
              },
            })
          );
        } else {
          titleFlightRef.current = null;
        }
      })
    );
    // applyWheel은 이 함수보다 뒤에서 선언된다(useCallback([])이라 항등은
    // 고정이지만, deps 배열은 이 useCallback 호출 자체가 평가되는 시점에
    // 즉시 읽히므로 여기 넣으면 그 const 선언보다 앞서 읽어 TDZ에 걸린다.
    // 실제 호출은 delayedCall 콜백 안(마운트가 끝난 뒤)이라 참조 자체는
    // 안전하다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishClose, flipModule, restoreLandingName]);

  // stage가 DOM에 박히는 커밋에서, 브라우저가 그리기 전에 불린다. 관문을 여기서
  // 다시 보지 않는 것은 구조적으로 강제되기 때문이다 - pendingFlipStateRef는
  // openModal이 관문을 통과했을 때만 채워진다
  const handleStageMount = useCallback((el: HTMLDivElement | null) => {
    stageElRef.current = el;
    const state = pendingFlipStateRef.current;
    pendingFlipStateRef.current = null;
    const mod = gsapModuleRef.current;
    if (!el) return;
    const shellEl = document.getElementById('pm-shell');
    // 비행을 못 태우는 자리에서 감춘 채로 남겨두면 상세 판이 영영 안 보인다.
    // 다만 이미 비행이 돌고 있으면 등장은 그 비행의 onComplete 몫이다 -
    // 이 콜백 ref가 한 번 더 불리면 state는 이미 소진돼 null이라, 여기서
    // 등장을 열면 날아가는 이미지 너머로 논증 열이 다 그려진 채 착지한다
    if (!state || !mod || !shellEl) {
      if (!flightRef.current) setRevealed(true);
      return;
    }

    const seconds = FLIP_DURATION_MS / 1000;
    const titleSeconds = TITLE_FLIP_MS / 1000;
    const clipped = collectClippedAncestors(el, shellEl);
    mod.gsap.set(clipped, { overflow: 'visible' });

    // 출발 순간 접힘 프리뷰가 보여 주고 있던 그림을 캔버스에 떠서 stage
    // 위에 얹는다. stage의 video는 이 순간 막 마운트돼 poster 또는 검은
    // 화면이므로, 다리가 없으면 그 자리에서 그림이 한 번 바뀌어 튄다.
    // 프리뷰 노드는 아직 살아 있다(modalOpen이 data-flip-id만 뗀다)
    const previewMediaEl =
      mediaLayerRef.current?.querySelector('img') ?? null;
    const bridge = snapshotMedia(previewMediaEl);
    // stage는 relative grid ... overflow-hidden이라 absolute 자식이 상자를
    // 꽉 채운다. stage의 rounded-media가 잘라 준다
    if (bridge) el.appendChild(bridge);

    // targets를 명시해야 한다. 넘기지 않으면 GSAP은 상태를 뜬 접힘 노드를
    // 날리려 든다. 우리가 날릴 건 펼침 노드다. stage와 제목은 길이가 달라
    // (S-1, 500 vs 600) Flip.from을 둘로 가른다
    const titleEl = document.getElementById('pm-title');
    const tl = mod.Flip.from(state, {
      targets: [el],
      duration: seconds,
      ease: mod.SITE_EASE,
      scale: true,
      absolute: true,
      // 새로고침 뒤 첫 열기는 이 콜백 자체가 무거운 커밋(청크 평가, 첫
      // 렌더) 안에서 불린다. GSAP은 마지막 tick을 기준으로 시작 시각을
      // 잡으므로, 만들자마자 재생하면 그 막힌 시간이 통째로 첫 프레임
      // 진행도에 실린다(node 실측: 60ms 막으면 +46ms). paused로 만들고
      // 다음 gsap tick에 play하면 막힘이 안 실린다
      paused: true,
      onComplete: () => {
        mod.gsap.set(clipped, { clearProps: 'overflow' });
        // 비행이 끝난 뒤에 몸통이 등장한다. 머리띠는 이미 비행 중반에
        // 나와 있다(바로 아래 tl.call, S-3)
        setRevealed(true);
        // 착지 시점에는 stage 영상이 이미 돌고 있으니 다리를 걷으면 뒤가
        // 살아 있는 영상이다
        if (bridge) {
          mod.gsap.to(bridge, {
            opacity: 0,
            duration: 0.25,
            ease: mod.SITE_EASE,
            onComplete: () => bridge.remove(),
          });
        }
      },
    });
    // 비행 절반 지점에 머리띠가 먼저 등장한다. 몸통이 등장할 틀이
    // 먼저 서야 한다
    tl.call(() => setRevealed('head'), undefined, HEAD_IN_AT_MS / 1000);

    let titleTl: typeof tl | null = null;
    if (titleEl) {
      // 착지점 이름은 제목이 그 위에서 출발하는 순간 감춘다(S-5). 노드째
      // hiddenNameRef에 담아야 중도에 정리돼도 되돌릴 자리를 잃지 않는다.
      // 닫기 쪽은 이미 같은 일을 한다
      const landingEl = nameFlipRefs.current[openedIndexRef.current];
      if (landingEl) {
        landingEl.style.opacity = '0';
        hiddenNameRef.current = landingEl;
      }
      titleTl = mod.Flip.from(state, {
        targets: [titleEl],
        duration: titleSeconds,
        ease: mod.SITE_EASE,
        scale: true,
        absolute: true,
        paused: true,
      });
    }
    titleFlightRef.current = titleTl ? asKillable(titleTl) : null;

    // 모달 틀(셸·머리띠·증거 열)이 비행 전체 길이에 걸쳐 찬다. power2.in -
    // 느리게 시작해 끝에서 덮어야 앞 절반 동안 뒤가 비쳐 휠과 프리뷰가
    // 빠지는 게 보인다(S-2). 머리띠·증거 열의 제값은 클래스가 바뀌어도
    // 따라가도록 트윈 만들기 직전에 getComputedStyle로 읽고, 끝나면
    // clearProps로 CSS에 색 소유권을 돌려준다. 셸은 소스 상수 그대로다
    const headEl = document.querySelector<HTMLElement>('[data-modal-part="head"]');
    const evidenceEl = document.querySelector<HTMLElement>('[data-modal-part="evidence"]');
    const frameTl = mod.gsap.timeline({ paused: true });
    frameTl.fromTo(
      shellEl,
      { backgroundColor: SHELL_BG_CLEAR },
      { backgroundColor: SHELL_BG, duration: seconds, ease: 'power2.in' },
      0
    );
    if (headEl) {
      const headStyle = getComputedStyle(headEl);
      frameTl.fromTo(
        headEl,
        { backgroundColor: 'transparent', borderColor: 'transparent' },
        {
          backgroundColor: headStyle.backgroundColor,
          borderColor: headStyle.borderColor,
          duration: seconds,
          ease: 'power2.in',
          clearProps: 'backgroundColor,borderColor',
        },
        0
      );
    }
    if (evidenceEl) {
      const evidenceStyle = getComputedStyle(evidenceEl);
      frameTl.fromTo(
        evidenceEl,
        { backgroundColor: 'transparent', borderColor: 'transparent' },
        {
          backgroundColor: evidenceStyle.backgroundColor,
          borderColor: evidenceStyle.borderColor,
          duration: seconds,
          ease: 'power2.in',
          clearProps: 'backgroundColor,borderColor',
        },
        0
      );
    }

    // 첫 tick이 오기 전에 모달이 걷혀 kill이 먼저 올 수 있다. 그때도
    // ticker에서 콜백을 빼야 죽은 timeline을 붙든 채로 남지 않는다.
    // 콜백이 이미 돌아 play가 끝난 뒤에 kill이 와도 ticker.remove는
    // 그저 헛돌 뿐이라 따로 가지치기하지 않는다
    const previewEl = previewRef.current;
    const onFirstTick = () => {
      mod.gsap.ticker.remove(onFirstTick);
      tl.play();
      titleTl?.play();
      frameTl.play();

      // 휠의 나머지 이름이 벌어지며 흐려진다(S-4)
      spreadTweenRef.current?.kill();
      spreadTweenRef.current = asKillable(
        mod.gsap.to(wheelSpreadRef.current, {
          v: 1,
          duration: 0.4,
          ease: mod.SITE_EASE,
          // applyWheel은 이 파일 뒤쪽에서 선언되지만 useCallback([])이라
          // 항등이 고정이고, 이 콜백은 다음 gsap tick에야 실행되므로 참조
          // 시점에는 이미 만들어져 있다
          onUpdate: () => applyWheel(wheelPosRef.current),
        })
      );

      // 접힘 프리뷰가 빠진다(S-6). stage가 그 위에서 출발하므로 빠르게
      // 빼도 바뀜이 안 보인다
      if (previewEl) {
        previewTweenRef.current?.kill();
        previewTweenRef.current = asKillable(
          mod.gsap.to(previewEl, { opacity: 0, duration: 0.25, ease: mod.SITE_EASE })
        );
      }
    };
    mod.gsap.ticker.add(onFirstTick);
    flightRef.current = {
      kill: () => {
        mod.gsap.ticker.remove(onFirstTick);
        tl.kill();
        frameTl.kill();
        // 이미 remove된 노드에 remove를 다시 불러도 해가 없다
        bridge?.remove();
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 휠 배치 한 프레임. 단추는 흐름에 그대로 서 있고 여기서 주는 것은 그
  // 평평한 자리에서의 어긋남이다. d가 0인 활성 항목은 x와 rot은 항등이지만
  // y는 아니다. 휠의 중심은 목록의 세로 한가운데로 고정이고, 활성 항목이
  // 항상 그 자리에 오도록 centerShift((CENTER - pos) * rowH)를 더한다.
  // reduce 경로는 이 인라인 스타일을 안 걸기만 하면 지금의 평평한 목록으로
  // 그대로 돌아간다.
  //
  // filter와 opacity는 단추가 받고 안쪽 span은 깨끗이 둔다. filter가 걸린
  // 요소는 새 스택 문맥을 만들고 자손의 fixed 기준을 바꾸는데, 그 span이
  // 제목 비행의 손잡이다
  const applyWheel = useCallback((pos: number) => {
    const els = nameRefs.current;
    // 줄 높이는 단추의 실제 높이로 잰다. 글자 크기가 lg에서 갈리므로 상수로
    // 박으면 좁은 화면에서 호가 어긋난다. 첫 항목 하나로 전부를 대표하는 것은
    // 단추의 whitespace-nowrap이 모든 줄을 한 줄로 지켜 줄 간격을 균일하게
    // 만들기 때문이다
    const rowH = els[0]?.offsetHeight ?? 0;
    const tiltRad = (WHEEL_TILT_DEG * Math.PI) / 180;
    // 이웃 두 항목 사이 호의 길이가 줄 높이와 같아지는 반지름. tilt가 곧
    // 얼마나 말리는가다
    // 줄 높이를 아직 못 재면(첫 그림, 숨은 섹션) rowH가 0이고 R도 0이라
    // 아래 R > 0 가지가 통째로 안 돈다. 호만 안 걸리고 거리 표현은 산다
    const R = rowH / tiltRad;
    // 고른 항목은 흐름상 pos * rowH 자리에 있다. 이 항을 더하면 그 자리가
    // 항상 정확히 목록의 세로 한가운데(CENTER * rowH)로 옮겨진다, pos가
    // 무엇이든 같다. rowH가 0이면 이 항도 0이라 위 NaN 방지와 안 부딪힌다
    const centerShift = (CENTER - pos) * rowH;
    // 모달이 열리며 벌어지는 정도(0→1). handleStageMount·closeModal의
    // tween이 이 값을 매 프레임 바꾸고 applyWheel을 다시 부른다
    const spread = wheelSpreadRef.current.v;
    for (let i = 0; i < N; i += 1) {
      const el = els[i];
      if (!el) continue;
      const d = i - pos;
      const dist = Math.abs(d);
      let x = 0;
      let y = centerShift;
      let rot = 0;
      if (R > 0) {
        const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
        y = R * Math.sin(ang) - d * rowH + centerShift;
        x = -WHEEL_MIRROR * R * (1 - Math.cos(ang)) * WHEEL_CURVE;
        rot = (WHEEL_MIRROR * ang * 180) / Math.PI;
      }
      let opacity = Math.max(WHEEL_MIN_OPACITY, 1 - dist * WHEEL_FADE);
      // 활성 항목에는 blur를 아예 안 건다. blur(0px)도 none이 아닌 이상
      // 겹을 하나 만들고, 이 단추 안에 비행 출발 손잡이가 들어 있다
      let blurPx = dist > 0 ? dist * WHEEL_BLUR_PX : 0;
      // spread는 활성이 아닌 항목만 받는다. 활성(dist 0)의 span은 S-5가
      // 따로 감춘다. 여기서 더 손대면 그 감춤과 겹친다
      if (dist > 0) {
        y += spread * d * WHEEL_SPLIT_PX;
        opacity *= 1 - spread;
        blurPx += spread * WHEEL_SPLIT_BLUR_PX;
      }
      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg)`;
      el.style.opacity = String(opacity);
      el.style.filter = blurPx > 0 ? `blur(${blurPx.toFixed(2)}px)` : 'none';
      el.style.setProperty(
        '--pj-wheel-p',
        Math.max(0, 1 - Math.min(dist, 1)).toFixed(4)
      );
    }
  }, []);

  // reduce 경로. 휠이 남긴 것을 전부 걷어 평평한 목록으로 되돌린다
  const clearWheel = useCallback(() => {
    for (const el of nameRefs.current) {
      if (!el) continue;
      el.style.removeProperty('transform');
      el.style.removeProperty('opacity');
      el.style.removeProperty('filter');
      el.style.removeProperty('--pj-wheel-p');
    }
  }, []);

  // 지수 감쇠 한 프레임. k를 dt에서 뽑으므로 프레임률이 달라도 같은 시각에
  // 같은 자리에 있다. 수렴하면 스스로 멈춘다. 이 목록은 대부분의 시간
  // 가만히 있고, 가만히 있는 동안 rAF가 도는 것이 이 효과의 유일한 상시 비용이다
  const runWheelFrame = useCallback(
    (now: number) => {
      const dt = Math.min((now - wheelLastRef.current) / 1000, 0.05);
      wheelLastRef.current = now;
      const tau = WHEEL_SMOOTHING_MS / 1000;
      const k = 1 - Math.exp(-dt / tau);
      const target = wheelTargetRef.current;
      const cur = wheelPosRef.current;
      let next = cur + (target - cur) * k;
      const settled = Math.abs(target - next) < 0.001;
      if (settled) next = target;
      wheelPosRef.current = next;
      applyWheel(next);
      wheelRafRef.current = settled ? null : requestAnimationFrame(runWheelFrame);
    },
    [applyWheel]
  );

  const startWheel = useCallback(() => {
    if (wheelRafRef.current != null) cancelAnimationFrame(wheelRafRef.current);
    wheelLastRef.current = performance.now();
    wheelRafRef.current = requestAnimationFrame(runWheelFrame);
  }, [runWheelFrame]);

  // 제목 비행 직전에 휠을 목표에 못박는다. 이름을 훑다가 곧바로 클릭하면
  // pos가 아직 목표에 못 갔는데 비행이 시작된다. Flip.getState가 뜨는 rect는
  // 조상의 transform을 반영하므로, 눌린 단추에 회전이 남아 있으면 그 rect가
  // 회전한 상자의 외접 사각형이 되어 비행 첫 프레임이 기울거나 부푼다
  const snapWheel = useCallback(
    (i: number) => {
      if (wheelRafRef.current != null) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
      wheelTargetRef.current = i;
      wheelPosRef.current = i;
      applyWheel(i);
    },
    [applyWheel]
  );

  // 휠은 activeIndex를 따라간다. 모달이 펼쳐져 있으면 프로젝트를 못 바꾸니
  // 휠이 움직일 일이 없다 - rAF를 아예 안 돌린다. reduce에서는 만들지도
  // 않는다: 평평한 목록 그대로 두고 활성 이름의 색만 갈린다
  useEffect(() => {
    if (reducedMotion) {
      clearWheel();
      return;
    }
    if (modalOpen) {
      // 새로고침으로 복구된 모달은 openModal을 안 거치므로 snapWheel도 안
      // 불렸다. 여기서 못박지 않으면 휠 pos가 마운트 기본값에 멈춘 채라,
      // 닫기 비행이 이 이름의 rect로 착지한 뒤에야 휠이 돌아 제자리로
      // 옮겨 가며 튄다. 일반 열기 경로에서는 handleNameClick이 이미 같은
      // 값으로 못박아 둔 것을 한 번 더 못박을 뿐이라 해가 없다
      snapWheel(activeIndex);
      return;
    }
    wheelTargetRef.current = activeIndex;
    startWheel();
    // 줄 높이는 글자 크기를 따라가고 글자 크기는 lg에서 갈린다. 창이 바뀌면
    // 이미 멈춘 휠이 옛 줄 높이로 굳어 있으므로 한 프레임을 다시 그린다
    const onResize = () => applyWheel(wheelPosRef.current);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (wheelRafRef.current != null) cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    };
  }, [activeIndex, modalOpen, reducedMotion, startWheel, applyWheel, clearWheel, snapWheel]);

  // 클릭과 키보드가 이 하나로 선택을 옮긴다. focus 옵션은 키보드 경로
  // 전용이다. 포커스 자체는 선택을 옮기지 않는다. mousedown이 클릭보다
  // 먼저 단추에 포커스를 주는데, 거기서 goTo를 부르면 click이 보기 전에
  // activeIndexRef가 이미 바뀌어 있어 첫 클릭에서 바로 열려버린다
  const goTo = useCallback((next: number, opts?: { focus?: boolean }) => {
    // 모프는 출발 화면을 여기서 굳혀야 한다. 아래 setActiveIndex가 커밋되고
    // effect가 돌 때는 프리뷰 <Image>의 src가 이미 새 프로젝트로 갈려 있어
    // 그때 굳히면 두 텍스처가 같은 그림이 된다
    if (next !== activeIndexRef.current) {
      activeIndexRef.current = next;
      const fromEl =
        mediaLayerRef.current?.querySelector('img') ?? null;
      morphStartedRef.current =
        morphHandleRef.current?.morph(fromEl, projects[next].image) ?? false;
    }
    setActiveIndex(next);
    if (opts?.focus) nameRefs.current[next]?.focus();
  }, []);

  // 첫 클릭은 선택만 옮긴다. 이미 고른 이름을 다시 클릭해야 상세를 연다 -
  // 목록을 훑다가 실수로 상세가 펼쳐지지 않게 하는 장치다. 이미 그 항목인지는
  // activeIndex state가 아니라 activeIndexRef.current로 본다. goTo가 그 ref를
  // 쓰고, state를 의존성에 넣으면 이 콜백이 선택이 바뀔 때마다 새로 만들어진다.
  // 계약을 통과한 프로젝트만 두 번째 클릭에서 펼침을 연다. 계약 미달 프로젝트는
  // 선택은 되지만 다시 눌러도 안 열린다
  const handleNameClick = useCallback(
    (i: number) => {
      const alreadyActive = i === activeIndexRef.current;
      goTo(i);
      if (alreadyActive && isProjectModalReady(projects[i])) {
        // 비행보다 먼저다. 출발 rect를 뜨는 것이 openModal 안이라 순서가 계약이다
        if (!reducedMotion) snapWheel(i);
        openModal(i);
      }
    },
    [goTo, openModal, snapWheel, reducedMotion]
  );

  // 프리뷰 클릭은 이름의 두 번째 클릭과 같다. 이미 고른 프로젝트를 다시
  // 가리키는 것이라 선택은 안 옮기고, 계약을 통과했을 때만 상세를 연다.
  // 순서는 handleNameClick과 같다: snapWheel이 openModal보다 먼저다
  const handlePreviewClick = useCallback(() => {
    const i = activeIndexRef.current;
    if (!isProjectModalReady(projects[i])) return;
    if (!reducedMotion) snapWheel(i);
    openModal(i);
  }, [openModal, snapWheel, reducedMotion]);

  const handleIndexKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      let next: number | null = null;
      if (event.key === 'ArrowUp') next = (activeIndex - 1 + N) % N;
      else if (event.key === 'ArrowDown') next = (activeIndex + 1) % N;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = N - 1;

      if (next === null) return;
      event.preventDefault();
      goTo(next, { focus: true });
    },
    [activeIndex, goTo]
  );

  return (
    <section
      ref={sectionRef}
      id={SECTION_IDS.PROJECTS}
      // min-h-full은 .section-scroll(absolute inset-0)의 확정 높이를 받는다.
      // h-screen을 쓰면 푸터 띠와 헤더를 두 번 빼야 해서 무대와 어긋난다.
      // 세로 가운데는 justify-center가 아니라 자식의 my-auto로 잡는다 -
      // 내용이 무대보다 길어지면 auto 여백이 0으로 접혀 위에서부터 흐르고,
      // justify-center였다면 위쪽이 스크롤로 닿지 않는 자리에 잘린다
      className="py-6 px-10 min-h-full flex flex-col"
    >
      <h2 className="sr-only">Projects</h2>

      <div className="my-auto grid grid-cols-1 lg:grid-cols-[3fr_2fr]">
        {/* 좁은 화면에서는 프리뷰가 w-full이라 justify-center가 할 일이 없다.
            lg에서만 3fr 열 안의 80% 프리뷰를 가로 가운데로 민다 */}
        <div className="flex items-center justify-center">
          {/* 같은 data-flip-id를 가진 노드가 화면에 둘이면 Flip이 짝을 못
              짓는다. 펼침이 살아 있는 동안은 접힘 쪽 손잡이를 뗀다 */}
          <div
            ref={previewRef}
            data-part="preview"
            aria-hidden="true"
            data-flip-id={modalOpen ? undefined : `pv-${activeProject.title}`}
            className="w-full lg:w-[80%] aspect-video"
          >
            {/* 자르는 쪽이 여기다. 그림은 object-cover로 상자를 넘치므로
                반경만 줘서는 모서리가 안 깎인다. rounded-media는 상세 판
                무대와 같은 토큰이다(비행 양 끝의 모서리가 같아야 한다).
                이 상자는 전환 tween이 안 붙는다 - 잘라내는 틀은 제자리에
                있고 안쪽 겹만 움직여야 새 화면이 틀 안으로 들어온다 */}
            <div
              className="relative h-full w-full overflow-hidden rounded-media"
              style={{ background: 'rgb(255 255 255 / 0.06)' }}
            >
            <div ref={mediaLayerRef} data-part="preview-media" className="absolute inset-0">
              {mediaError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-4">
                  <span className="text-[13px] tabular-nums" style={{ color: MUTED }}>
                    {String(activeIndex + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                    {activeProject.title}
                  </span>
                  <span className="text-[11px]" style={{ color: MUTED }}>
                    MEDIA UNAVAILABLE
                  </span>
                </div>
              ) : (
                <Image
                  data-part="preview-image"
                  src={activeProject.image}
                  alt={activeProject.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 660px"
                  className="object-cover pointer-events-none"
                  onError={handleMediaError}
                />
              )}

              {/* 프로젝트가 갈리는 0.56초 동안만 켜지는 셰이더 모프. 미디어
                  위, 캡션 아래에 놓는다 - 캡션까지 같이 녹으면 글자가 안
                  읽힌다. 평소에는 opacity 0이고 rAF도 안 돈다. reduce에서는
                  아예 만들지 않는다(셰이더에 분기를 넣는 것보다 캔버스를
                  안 만드는 쪽이 싸다) */}
              {motionReady && !reducedMotion ? (
                <DynamicPreviewMorph
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  preload={PROJECT_IMAGE_PATHS}
                  onHandle={handleMorphHandle}
                />
              ) : null}

              {/* 그림 아래쪽에 늘 깔리는 어둠 띠. 캡션 글자가 어느 그림 위에
                  앉든 같은 바닥을 받게 한다. 상세를 한 번도 안 연 화면과 갔다
                  온 화면이 달라 보이면 안 되므로 띠는 상시로 있고, 상세에서
                  돌아올 때 왼쪽에서 들어오는 것은 안에 든 글자 묶음뿐이다.
                  absolute라 subtitle이 있든 없든 프리뷰 높이가 안 흔들린다
                  (FLIP 출발 좌표가 곧 이 높이다). 오류 화면에는 이미 제목이
                  크게 있어 통째로 뺀다 */}
              {mediaError ? null : (
                <div
                  data-part="preview-caption"
                  className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-4 pt-12"
                  style={{ background: PREVIEW_CAPTION_SCRIM }}
                >
                  {/* 미는 것은 이 안쪽 묶음이다. 바깥 띠까지 같이 밀면 민
                      폭만큼 오른쪽 끝이 안 어두운 채로 남는다. 프리뷰
                      컨테이너에 aria-hidden이 걸려 있으므로 이 글자는
                      장식이고, 같은 내용을 오른쪽 이름 목록이 이미
                      스크린리더에 준다. 그래서 이름 목록보다 작고 흐리다.
                      같은 제목이 화면에 둘이니 어느 쪽이 주인공인지 크기와
                      색으로 갈라야 한다. subtitle은 선택 필드이고 TDS 것에는
                      리터럴 줄바꿈이 들어 있는데, HTML 공백 접기가 그것을 한
                      칸으로 만들고 truncate가 한 줄로 고정한다 */}
                  <div data-part="preview-caption-text">
                    <p className="text-t5 font-semibold text-[var(--color-text-primary)]">
                      {activeProject.title}
                    </p>
                    {activeProject.subtitle ? (
                      <p className="mt-0.5 truncate text-t7 text-[var(--color-text-secondary)]">
                        {activeProject.subtitle}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
            {/* 프리뷰 클릭 과녁. previewRef 자신을 단추로 감싸면 그 상자가
                Flip 손잡이라 바뀌면 안 된다. 그래서 잘라내는 상자 안에
                과녁만 덧대 얹는다. 자르는 조상이 이미 있어 사각형 모서리가
                따로 튀지 않는다 */}
            <button
              type="button"
              data-part="preview-open"
              onClick={handlePreviewClick}
              aria-label={activeProject.title}
              disabled={!isProjectModalReady(activeProject)}
              className="absolute inset-0 block h-full w-full border-0 bg-transparent p-0 text-left [font:inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-core)]"
            />
            </div>
          </div>
        </div>

        <div className="lg:pl-10">
          <div
            data-part="index"
            role="tablist"
            aria-orientation="vertical"
            aria-label="프로젝트 목록"
            className="flex flex-col"
            onKeyDown={handleIndexKeyDown}
          >
            {projects.map((project, i) => {
              const isActive = i === activeIndex;
              return (
                <button
                  key={project.title}
                  ref={(el) => {
                    nameRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  data-name={i}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleNameClick(i)}
                  // 줄 사이를 벌리는 것은 목록의 gap이 아니라 단추 자신의
                  // py다. gap으로 벌리면 줄과 줄 사이에 아무 반응 없는 죽은
                  // 띠가 생겨, 그 자리를 클릭해도 아무 이름도 안 잡힌다.
                  // py가 단추에 남아 있어야 줄과 줄 사이가 전부 과녁이다
                  //
                  // 휠의 회전축은 글자가 시작하는 왼쪽 모서리다. 그래서 상자가
                  // 오른쪽으로 넓을수록 그 오른쪽 끝이 세로로 크게 실린다.
                  // 상자를 열 전체 너비로 쥐면 글자가 끝난 뒤의 빈 영역이
                  // 통째로 실려 올라가 남의 줄 위를 덮고, 이름을 겨냥하지 않은
                  // 자리에서 엉뚱한 프로젝트가 잡힌다. 과녁을 글자 너비로
                  // 줄이면 보이는 것과 잡히는 것이 같아진다
                  className={`block w-fit origin-left whitespace-nowrap text-left text-t1 lg:text-d3 font-bold tracking-[-0.02em] py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-core)] ${
                    isActive ? 'text-[var(--color-text-primary)]' : ''
                  }`}
                  // 휠이 도는 동안 색도 같이 간다. --pj-wheel-p는 활성에서
                  // 1이고 한 칸만 멀어져도 0이라, 선택이 옮겨 가는 사이
                  // 글자색이 뚝 끊기지 않고 따라 붙는다
                  style={{
                    color: reducedMotion
                      ? isActive
                        ? undefined
                        : MUTED
                      : `color-mix(in srgb, var(--color-text-primary) calc(var(--pj-wheel-p, 0) * 100%), ${MUTED})`,
                  }}
                >
                  {/* 비행 손잡이는 단추가 아니라 글자 너비인 이 안쪽 상자가
                      쥔다. 단추도 글자 너비지만 py만큼 세로로 더 크므로, 단추를
                      그대로 태우면 Flip이 그 높이 차이를 비행 첫 프레임의
                      배율로 박는다. inline-block이 아니라 block인 것은 기준선
                      밑에 딸려 오는 여백이 단추 높이를 바꾸지 않게 하기
                      위해서다 */}
                  <span
                    ref={(el) => {
                      nameFlipRefs.current[i] = el;
                    }}
                    data-flip-id={
                      isActive && !modalOpen ? `title-${project.title}` : undefined
                    }
                    className="block w-fit"
                  >
                    {project.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ProjectModal
        isOpen={modalOpen}
        onClose={closeModal}
        project={modalOpen ? activeProject : null}
        onStageMount={handleStageMount}
        reveal={revealed}
      />
    </section>
  );
}
