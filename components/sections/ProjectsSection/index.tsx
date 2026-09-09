'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { isProjectModalReady } from '@/lib/utils/projectContract';
import { projects } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import { setProjectModalObscured } from '@/hooks/useProjectModalObscured';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import type { Flip } from '@/lib/gsap';

const ProjectModal = dynamic(
  () => import('@/components/blocks/ProjectModal'),
  { ssr: false }
);

const N = projects.length;

// history.state에서 projectModalId 키만 걷어내고 나머지 필드(Next.js가
// 쓰는 것 포함)는 그대로 둔다. state가 객체가 아니면 빈 객체로 시작한다
function stripProjectModalId(state: unknown): Record<string, unknown> {
  const base: Record<string, unknown> =
    state && typeof state === 'object' ? { ...(state as Record<string, unknown>) } : {};
  delete base.projectModalId;
  return base;
}

// mount와 popstate가 공용하는 순수 판정. history를 읽지도 쓰지도 않고
// 인자만 본다 — 두 경로가 갈리면 새로고침 복구와 뒤로가기 복구가
// 다르게 동작한다(계획 5 T2 Task 9)
export function reconcileProjectModal(historyState: unknown): string | null {
  if (!historyState || typeof historyState !== 'object') return null;
  const id = (historyState as Record<string, unknown>).projectModalId;
  if (typeof id !== 'string') return null;
  const project = projects.find((p) => p.title === id);
  if (!project || !isProjectModalReady(project)) return null;
  return id;
}

const LINE_STRONG = 'rgb(255 255 255 / 0.14)';
const MUTED = 'rgb(255 255 255 / 0.62)';

// 프로젝트 프리뷰 영상 순환 주기. 정본은 스펙 §4.6
const CYCLE_MS = 3000;

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

// lib/gsap의 SITE_EASE와 같은 곡선을 CSS 표기로 적은 것. 값을 import하면
// gsap 모듈이 정적 번들로 딸려 들어와 지연 로드가 깨진다 - design-tokens.css도
// 같은 이유로 이 리터럴을 그대로 쓴다
const SITE_EASE_CSS = 'cubic-bezier(0.22, 1, 0.36, 1)';

// 접힘 프리뷰와 펼침 stage 사이 비행 시간. 워드마크 FLIP과 같은 값이고
// 정본은 styles/design-tokens.css의 워드마크 flip 지속 변수다. HomeClient도
// 같은 값을 복제해 둔다 - 숫자 하나 때문에 공유 모듈을 파지 않는다
const FLIP_DURATION_MS = 500;

// #pm-shell 클래스가 쓰는 판 배경색. gsap 색 파서가 읽는 표기로 적는다
const SHELL_BG = 'rgba(6, 8, 10, 0.97)';
const SHELL_BG_CLEAR = 'rgba(6, 8, 10, 0)';

// 셸 배경이 차오르는 구간은 비행의 앞 60%다. 비행 중반에 셸이 아직
// 반투명하면 뒤에 있는 접힘 섹션 글자가 날아가는 이미지 너머로 비친다.
// 닫기는 이것을 정확히 뒤집어 비행의 뒤 60%에 뺀다
const SHELL_FADE_MS = FLIP_DURATION_MS * 0.6;
const SHELL_FADE_OUT_DELAY_MS = FLIP_DURATION_MS - SHELL_FADE_MS;

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

export default function ProjectsSection() {
  const { active, pageVisible, routeResolved, motionReady, reducedMotion } =
    useSectionActivity();
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  // 상세 판 내용의 등장 소유권은 ProjectModal에 있다. 여기는 비행과 셸 배경과
  // 배경 알림만 갖고, 안무가 언제 시작하는지만 이 값으로 알린다.
  // null = 안무 없음(관문이 닫힌 경로), false = 비행 중, true = 등장
  const [revealed, setRevealed] = useState<boolean | null>(null);

  const nameRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // 이름 단추 안쪽의 글자 상자. 비행 손잡이는 단추가 아니라 이쪽이 쥔다 -
  // 단추는 호버 과녁이라 w-full이고, 상세 판 제목은 글자 너비라, 단추를
  // 그대로 태우면 Flip이 그 너비 비율을 첫 프레임 scaleX로 박는다
  const nameFlipRefs = useRef<(HTMLSpanElement | null)[]>([]);
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
  // 닫기에서 제목을 되돌리는 두 번째 비행. 여는 쪽은 Flip.from 하나가
  // stage와 제목을 같이 태우지만 닫기는 Flip.fit이라 대상마다 호출이 하나다
  const titleFlightRef = useRef<{ kill: () => void } | null>(null);
  // 닫기 비행 동안 감춰 둔 착지점 이름. 착지든 중도 정리든 되돌릴 자리를
  // 잃지 않으려고 노드 자체를 들고 있는다
  const hiddenNameRef = useRef<HTMLElement | null>(null);
  // 모달을 연 시점의 인덱스. 착지점은 이 값으로 집는다. 펼친 상태에서는
  // 프로젝트를 못 바꾸니 지금은 activeIndex와 같지만, 같다는 사실에 기대는
  // 코드는 언젠가 깨진다
  const openedIndexRef = useRef(0);
  // 붕괴가 끝나기를 기다렸다 닫기 비행을 띄우는 예약. setTimeout이 아니라
  // GSAP 시계를 쓴다 - 탭이 백그라운드에 갔다 와도 타임라인과 안 어긋난다
  const collapseCallRef = useRef<{ kill: () => void } | null>(null);
  // 비행 500ms 동안 모달은 아직 열려 있고 포커스 트랩도 살아 있다. Escape를
  // 또 누르거나 배경을 또 클릭하면 closeModal이 다시 불린다
  const closingRef = useRef(false);
  // 지금 열린 모달이 우리가 pushState한 항목인지 기억한다. 새로고침으로
  // 복구된 모달(우리가 push한 적 없는 항목)을 history.back()으로 닫으면
  // 직전 항목이 우리 사이트가 아닐 수 있어 페이지를 떠난다 — 그래서
  // pushedRef가 false일 때는 back() 대신 replaceState로 키만 지운다
  const pushedRef = useRef(false);

  const activeProject = projects[activeIndex];
  const videoList = useMemo(
    () =>
      (activeProject.implementations ?? [])
        .map((impl) => impl.video)
        .filter((v): v is string => Boolean(v)),
    [activeProject]
  );
  const hasVideo = videoList.length > 0;

  // 정지 조건은 하나로 모은다. 정본은 스펙 §4.6. 호버로 프리뷰가 갈려도
  // 이 식에 호버는 안 들어가므로 계속 재생한다
  const playable =
    active === SECTION_IDS.PROJECTS &&
    !modalOpen &&
    pageVisible &&
    motionReady &&
    !reducedMotion;

  const [cycleIndex, setCycleIndex] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const currentSrc = hasVideo ? (videoList[cycleIndex] ?? null) : null;

  // 실제로 그릴 src. playable일 때만 currentSrc를 따라가고, 아니면 멈춘 자리를
  // 그대로 둔다. src를 놓는 것은 활성 프로젝트가 바뀔 때(goTo가 cycleIndex를
  // 0으로 되돌릴 때)뿐이다
  const [committedSrc, setCommittedSrc] = useState<string | null>(null);
  useEffect(() => {
    if (playable) setCommittedSrc(currentSrc);
  }, [playable, currentSrc]);

  useEffect(() => {
    setMediaError(false);
  }, [activeIndex]);

  useEffect(() => {
    const video = videoElRef.current;
    if (!video) return;
    if (!playable) {
      video.pause();
      return;
    }
    // jsdom의 play()는 Promise를 돌려주지 않는다. 실제 브라우저의 거절만 조용히 삼킨다
    const playResult = video.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {});
    }
  }, [playable, committedSrc]);

  // 영상이 하나뿐이면 순환하지 않는다. onEnded가 3초를 기다리지 않고 다음으로 넘긴다
  useEffect(() => {
    if (!playable || videoList.length < 2) return;
    const timeout = setTimeout(() => {
      setCycleIndex((i) => (i + 1) % videoList.length);
    }, CYCLE_MS);
    return () => clearTimeout(timeout);
  }, [playable, videoList.length, cycleIndex]);

  const handleVideoEnded = useCallback(() => {
    setCycleIndex((i) => (videoList.length > 0 ? (i + 1) % videoList.length : 0));
  }, [videoList.length]);

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
  // 도는 중의 src 교체에는 안 걸린다 - 그건 같은 프로젝트 안의 다음 장면이라
  // 상태 전환이 아니고, 걸면 3초마다 영원히 꿈틀대는 잔모션이 된다.
  // transform과 opacity만 만진다. 이름을 빠르게 훑으면 전환이 겹치므로
  // 이전 것을 죽이고 다음을 태운다
  useEffect(() => {
    const layer = mediaLayerRef.current;
    swapTweenRef.current?.kill();
    swapTweenRef.current = null;
    if (!layer) return;
    const mod = gsapModuleRef.current;
    // reduce에서는 즉시 교체로 무너진다. 죽은 tween이 남긴 transform도 걷는다
    if (!mod || !motionReady || reducedMotion) {
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
  // (applyReconciliation)를 쓴다 — 새로고침 복구와 뒤로가기 복구가 갈리지
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
        // 것으로 맞춘다. 이름은 곧바로 되돌린다 - 안 되돌리면 펼침 제목과 같은
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
      // 기존 state를 펼쳐 담는다 — Next.js가 쓰는 필드를 날리면 안 된다
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
      // 우리가 push한 항목이다 — 그 앞 항목은 항상 우리 사이트다
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
  // .section-stage의 overflow에 잘린다 - 펼침 노드는 그 자르기를 안 받는다.
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
    // 0ms: 붕괴 시작. 내용 접기는 ProjectModal이 갖는다
    setRevealed(false);

    collapseCallRef.current = asKillable(
      mod.gsap.delayedCall(mod.REVEAL_OUT_MS / 1000, () => {
        collapseCallRef.current = null;
        // 배경 복원은 비행과 같은 시점에 시작한다. finishClose를 통해
        // 간접적으로 두면 착지한 뒤에야 돌아와 열기와 대칭이 아니다
        setProjectModalObscured(false);

        const seconds = FLIP_DURATION_MS / 1000;
        const shellEl = document.getElementById('pm-shell');
        const clipped = shellEl ? collectClippedAncestors(stageEl, shellEl) : [];

        mod.gsap.set(clipped, { overflow: 'visible' });
        if (shellEl) {
          mod.gsap.to(shellEl, {
            backgroundColor: SHELL_BG_CLEAR,
            duration: SHELL_FADE_MS / 1000,
            delay: SHELL_FADE_OUT_DELAY_MS / 1000,
            ease: mod.SITE_EASE,
          });
        }

        flightRef.current = asKillable(
          mod.Flip.fit(stageEl, previewEl, {
            duration: seconds,
            ease: mod.SITE_EASE,
            scale: true,
            onComplete: () => {
              mod.gsap.set(clipped, { clearProps: 'overflow' });
              finishClose();
            },
          })
        );

        // 제목도 같은 시점에 같은 길이로 되돌린다. 어긋나면 이미지와 제목이
        // 따로 논다. 착지점 이름은 비행 동안 감춘다 - 셸 배경이 뒤 60%에
        // 빠지므로 그냥 두면 날아오는 제목과 제자리 이름이 겹쳐 읽힌다.
        // visibility가 아니라 opacity인 것은 이 노드가 착지 좌표의 기준이라
        // 레이아웃이 살아 있어야 하기 때문이다
        const titleEl = document.getElementById('pm-title');
        const landingEl = nameFlipRefs.current[openedIndexRef.current];
        if (titleEl && landingEl) {
          landingEl.style.opacity = '0';
          hiddenNameRef.current = landingEl;
          titleFlightRef.current = asKillable(
            mod.Flip.fit(titleEl, landingEl, {
              duration: seconds,
              ease: mod.SITE_EASE,
              scale: true,
              onComplete: restoreLandingName,
            })
          );
        }
      })
    );
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
    const clipped = collectClippedAncestors(el, shellEl);
    mod.gsap.set(clipped, { overflow: 'visible' });

    // targets를 명시해야 한다. 넘기지 않으면 GSAP은 상태를 뜬 접힘 노드를
    // 날리려 든다. 우리가 날릴 건 펼침 노드다
    const titleEl = document.getElementById('pm-title');
    flightRef.current = asKillable(
      mod.Flip.from(state, {
        targets: titleEl ? [el, titleEl] : [el],
        duration: seconds,
        ease: mod.SITE_EASE,
        scale: true,
        absolute: true,
        onComplete: () => {
          mod.gsap.set(clipped, { clearProps: 'overflow' });
          // 비행이 끝난 뒤에 내용이 등장한다. 동시에 하면 날아가는 이미지
          // 너머로 논증 열이 이미 다 그려진 채 착지한다
          setRevealed(true);
        },
      })
    );

    // stage 자신은 끝까지 불투명하게 둔다 - 착지 순간 접힘 프리뷰와 같은
    // 사각형에 있어야 교대가 눈에 안 띈다. 같이 페이드하면 유령이 겹친다
    mod.gsap.fromTo(
      shellEl,
      { backgroundColor: SHELL_BG_CLEAR },
      {
        backgroundColor: SHELL_BG,
        duration: SHELL_FADE_MS / 1000,
        ease: mod.SITE_EASE,
        clearProps: 'backgroundColor',
      }
    );
  }, []);

  // 호버·포커스·키보드가 모두 이 하나로 선택을 옮긴다. focus 옵션은 키보드
  // 경로 전용이다 — 호버가 포커스를 훔치면 방향키 탐색과 스크린리더가 어긋난다
  const goTo = useCallback((next: number, opts?: { focus?: boolean }) => {
    setActiveIndex(next);
    setCycleIndex(0);
    if (opts?.focus) nameRefs.current[next]?.focus();
  }, []);

  // 클릭은 항상 선택을 옮긴다. 계약을 통과한 프로젝트만 추가로 펼침을 연다.
  // 계약 미달 프로젝트도 목록에 서고 프리뷰 전환은 되지만 눌러도 안 펼쳐진다
  const handleNameClick = useCallback(
    (i: number) => {
      goTo(i);
      if (isProjectModalReady(projects[i])) {
        openModal(i);
      }
    },
    [goTo, openModal]
  );

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
            {/* 자르는 쪽이 여기다. 영상은 object-cover로 상자를 넘치므로
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
              ) : hasVideo ? (
                <video
                  ref={(el) => {
                    videoElRef.current = el;
                  }}
                  data-part="preview-video"
                  aria-hidden="true"
                  muted
                  playsInline
                  poster={activeProject.image}
                  src={committedSrc ?? undefined}
                  onEnded={handleVideoEnded}
                  onError={handleMediaError}
                  className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                />
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

              {/* 영상 위 캡션. 프리뷰 컨테이너에 aria-hidden이 걸려 있으므로
                  이 글자는 장식이고, 같은 내용을 오른쪽 이름 목록이 이미
                  스크린리더에 준다. 그래서 이름 목록보다 작고 흐리다 -
                  같은 제목이 화면에 둘이니 어느 쪽이 주인공인지 크기와
                  색으로 갈라야 한다. absolute라 subtitle이 있든 없든
                  프리뷰 높이가 안 흔들린다(FLIP 출발 좌표가 곧 이 높이다).
                  subtitle은 선택 필드이고 TDS 것에는 리터럴 줄바꿈이 들어
                  있는데, HTML 공백 접기가 그것을 한 칸으로 만들고 truncate가
                  한 줄로 고정한다. 오류 화면에는 이미 제목이 있어 뺀다 */}
              {mediaError ? null : (
                <div
                  data-part="preview-caption"
                  className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-4 pt-12"
                  style={{ background: PREVIEW_CAPTION_SCRIM }}
                >
                  <p className="text-t5 font-semibold text-[var(--color-text-primary)]">
                    {activeProject.title}
                  </p>
                  {activeProject.subtitle ? (
                    <p className="mt-0.5 truncate text-t7 text-[var(--color-text-secondary)]">
                      {activeProject.subtitle}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        <div className="lg:pl-10">
          <div className="flex items-center gap-3">
            <span
              className="text-t8 uppercase tracking-[0.2em]"
              style={{ color: MUTED }}
            >
              MY PROJECTS
            </span>
            {/* 이미 있던 헤어라인이 일을 하나 하게 한다: 목록 여섯 중
                몇 번째를 보고 있는지. 장식을 하나 더 얹는 대신 있던 선을
                궤도로 쓴다. transform만 움직이고 reduce에서는 즉시 뛴다.
                이름 목록이 aria로 이미 말하고 있으니 여기는 장식이다 */}
            <span
              aria-hidden="true"
              className="relative flex-1 h-px overflow-hidden"
              style={{ background: LINE_STRONG }}
            >
              <span
                data-part="index-progress"
                className="absolute inset-0 origin-left"
                style={{
                  background: 'var(--color-cyan-core)',
                  transform: `scaleX(${(activeIndex + 1) / N})`,
                  transition: reducedMotion
                    ? 'none'
                    : `transform var(--animate-duration-base) ${SITE_EASE_CSS}`,
                }}
              />
            </span>
          </div>

          <div
            data-part="index"
            role="tablist"
            aria-orientation="vertical"
            aria-label="프로젝트 목록"
            className="mt-6 flex flex-col"
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
                  onMouseEnter={() => goTo(i)}
                  onFocus={() => goTo(i)}
                  // 이름이 광휘 겹의 글자를 data-glow-text로 복제한다. 그
                  // 사본이 접근성 이름에 두 번 섞이지 않게 여기서 이름을
                  // 못박는다
                  aria-label={project.title}
                  // 줄 사이를 벌리는 것은 목록의 gap이 아니라 단추 자신의
                  // py다. gap으로 벌리면 줄과 줄 사이에 아무 반응 없는 죽은
                  // 띠가 생겨, 목록을 세로로 훑을 때 광휘가 그 띠마다 깜빡인다
                  className={`block w-full text-left text-t2 font-bold tracking-[-0.02em] py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-core)] ${
                    isActive ? 'text-[var(--color-text-primary)]' : ''
                  }`}
                  style={{ color: isActive ? undefined : MUTED }}
                >
                  {/* 단추는 w-full로 남아 호버 과녁을 지키고, 비행 손잡이는
                      글자 너비인 이 안쪽 상자가 쥔다. inline-block이 아니라
                      block인 것은 기준선 밑에 딸려 오는 여백이 단추 높이를
                      바꾸지 않게 하기 위해서다 */}
                  <span
                    ref={(el) => {
                      nameFlipRefs.current[i] = el;
                    }}
                    data-flip-id={
                      isActive && !modalOpen ? `title-${project.title}` : undefined
                    }
                    // 광휘 겹 둘이 이 글자를 복제해 번짐만 남긴다. 정본은
                    // styles/design-tokens.css의 .pj-name-glow이고, 그 겹은
                    // absolute라 이 상자의 너비를 바꾸지 않는다 - 바꾸면
                    // 비행 첫 프레임이 배율로 부푼다
                    data-glow-text={project.title}
                    className="pj-name-glow block w-fit"
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
