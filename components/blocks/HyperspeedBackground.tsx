'use client';

// 배경은 반응자다 — 콘텐츠가 배경을 기다리지 않는다. 이 컴포넌트는
// useSectionNav()·usePageVisibility()·useMotionPreference()를 다시 구독하지
// 않고 HomeClient가 이미 소유한 단일 값들을 props로만 받는다.
//
// 폴백은 세 가지 이유로 뜬다 — 서로 다른 data-fallback-reason으로 구별한다:
//   pending         — 아직 준비 전(routeResolved·motionReady 미확정 또는 청크 로딩 중)
//   reduced-motion  — 사용자가 모션을 줄임(WebGL 동적 import 자체를 시도하지 않는다)
//   load-error      — 청크 로드 실패(next/dynamic loading의 error)
//   context-lost    — webglcontextlost 이후(한 번 잃으면 폴백 고정, 복구하지 않는다)
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { HyperspeedHandle } from '@/components/blocks/Hyperspeed';
import { OVERVIEW, type NavId } from '@/hooks/useSectionNav';
import { BOOT_DURATION_SECONDS } from '@/lib/constants';
import { detectQuality } from '@/lib/deviceQuality';

export interface HyperspeedBackgroundProps {
  active: NavId;
  isTransitioning: boolean;
  obscured: boolean; // ProjectModal 열림. 속도는 유지하고 밝기만 추가 감광
  pageVisible: boolean;
  routeResolved: boolean; // 최초 해시 해석 전에는 WebGL import·rAF를 시작하지 않음
  motionReady: boolean; // route + motion preference가 모두 확정됨
  reducedMotion: boolean;
  // 씬(핸들)이 처음 살아나는 순간을 부모(HomeClient)에 알린다 — BootSequence의
  // 이름 타임라인이 같은 순간에 출발해야 광선과 이름이 하나의 제스처로
  // 읽힌다(부팅 안무 브리프 1절). 기존 7 prop 계약은 그대로 두고 8번째로
  // 얹은 선택적 콜백이다 — 안 넘기면(다른 호출부·과거 테스트) 동작이
  // 전혀 달라지지 않는다.
  onSceneReady?: () => void;
}

type FallbackReason = 'pending' | 'reduced-motion' | 'load-error' | 'context-lost';

// 나중에 승인된 시안과 같은 구도로 캡처한 정적 프레임(최적화 WebP/AVIF)으로
// 바꾸려면 이 경로 하나만 채우면 된다. 지금은 캡처가 없어 null로 두고, 씬이
// 실제로 그리는 배경색(#000 — presets.ts의 CYAN_PALETTE.background와 동일)을
// 그대로 쓴다. 계획이 거부한 것은 "일반 시안 그라데이션" 대체물이지 이 검정이
// 아니다 — 검정은 씬 자체의 배경색이다.
const FALLBACK_IMAGE_SRC: string | null = null;

function HyperspeedFallback({ reason }: { reason: FallbackReason }) {
  return (
    <div
      data-testid="hyperspeed-fallback"
      data-fallback-reason={reason}
      aria-hidden="true"
      className="absolute inset-0"
      style={{ backgroundColor: '#000' }}
    >
      {FALLBACK_IMAGE_SRC ? (
        <Image src={FALLBACK_IMAGE_SRC} alt="" fill className="object-cover" />
      ) : null}
    </div>
  );
}

// check-bundle.mjs가 이 파일(components/blocks/HyperspeedBackground.tsx)이
// '@/components/blocks/Hyperspeed'를 동적 import하는 edge 정확히 하나를
// 찾는다 — 지정자를 바꾸면 번들 계측이 깨진다.
//
// next/dynamic의 LoadableComponent(node_modules/next/dist/shared/lib/
// loadable.shared-runtime.js)는 forwardRef로 자기 자신의 {retry}만
// useImperativeHandle로 노출하고, 실제 로드된 컴포넌트에는 ref를 전달하지
// 않는다 — 로드 완료 후 렌더 경로가 createElement(resolve(state.loaded), props)라
// props는 그대로 넘기지만 ref는 버린다(실측: <DynamicHyperspeed ref={...}>로
// 시도했더니 handleRef.current가 {retry}만 가진 객체였다). 그래서
// HyperspeedHandle은 ref가 아니라 일반 prop(onHandle 콜백)으로 우회해서
// 받는다 — props는 정상적으로 전달되기 때문이다. 이 다리 컴포넌트는 로더
// 안에서만 존재하고 Hyperspeed 자체는 건드리지 않는다.
const DynamicHyperspeed = dynamic(
  () =>
    import('@/components/blocks/Hyperspeed').then(({ default: Hyperspeed }) => ({
      default: function HyperspeedRefBridge({
        onHandle,
      }: {
        onHandle: (handle: HyperspeedHandle | null) => void;
      }) {
        return <Hyperspeed ref={onHandle} />;
      },
    })),
  {
    ssr: false,
    loading: ({ error }) => (
      <HyperspeedFallback reason={error ? 'load-error' : 'pending'} />
    ),
  }
);

const BASE_OPACITY_OVERVIEW = 1;
const BASE_OPACITY_SECTION = 0.3;
// obscured(ProjectModal 열림) 동안 배경에서 초점을 빼는 블러 반경.
// 감광(0.4배)에서 블러로 바꿨다 — 어둡게 하면 배경이 남색 덩어리로 죽는데,
// 블러는 밝기를 유지한 채 시선만 모달로 보낸다. 대비는 모달 자신의 불투명
// 패널이 담당한다.
//
// 주의: 전체화면 블러는 모바일 GPU에서 비싸다. 다만 모달이 열려 있는 동안만
// 걸리고 그때는 배경 애니메이션을 볼 이유가 없으므로 감수한다. 실기기에서
// 모달 여닫기가 무거우면 이 값을 낮추거나 감광으로 되돌린다.
const OBSCURED_BLUR_PX = 8;

// 컨텍스트 손실 뒤 씬을 다시 세워보는 횟수와 간격.
//
// 계획은 "한 번 잃으면 폴백 고정"을 정했고 그 근거는 "되살리면 또 잃을
// 가능성이 높다"였다. 실기기에서 그 정책이 곧 "한 번 사라지면 새로고침
// 전까지 영영 안 돌아옴"으로 나타났다. showScene은 ready와 reducedMotion과
// contextLost의 곱인데 앞의 둘은 한 번 정해지면 안 바뀌므로, 세션 중간에
// 배경을 끄는 경로는 contextLost 하나뿐이다.
//
// webglcontextrestored를 기다릴 수는 없다 — 손실 시 씬을 언마운트하므로
// 그 canvas는 이미 사라졌고 이벤트가 도착할 곳이 없다. 그래서 시간을 두고
// 새 씬을 세운다. 횟수를 제한해 손실이 반복되는 기기에서 무한 재생성을 막고,
// 한도를 넘으면 원래 정책대로 폴백에 고정된다.
const CONTEXT_RETRY_LIMIT = 3;
const CONTEXT_RETRY_DELAY_MS = 2000;

export default function HyperspeedBackground({
  active,
  isTransitioning,
  obscured,
  pageVisible,
  routeResolved,
  motionReady,
  reducedMotion,
  onSceneReady,
}: HyperspeedBackgroundProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HyperspeedHandle | null>(null);
  const appliedInitialQualityRef = useRef(false);
  // bootIn()·onSceneReady 콜백을 정확히 한 번만 적용하기 위한 가드 —
  // appliedInitialQualityRef와 같은 패턴. 컨텍스트 손실 뒤 씬이 다시
  // 세워져도(설계 문서 "손실 뒤 씬 재시도") 부팅 안무는 다시 재생하지
  // 않는다 — 처음 살아난 그 순간에만 의미가 있는 일회성 신호다.
  const bootInAppliedRef = useRef(false);
  const prevTransitioningRef = useRef(isTransitioning);
  const prevPageVisibleRef = useRef(pageVisible);
  // effect 의존성에 isTransitioning을 넣지 않고도(넣으면 resume과 무관한
  // isTransitioning 변화에도 이 effect가 재실행된다) 재동기화 시점에 최신값을
  // 읽기 위한 ref. 매 렌더 갱신한다 — hooks/useSectionNav.ts의 activeRef와
  // 같은 패턴.
  const isTransitioningRef = useRef(isTransitioning);
  isTransitioningRef.current = isTransitioning;
  // setHandle은 ref 콜백이라 안정적인 identity를 유지해야 한다(아래 주석) —
  // 그래서 active·onSceneReady를 직접 의존성으로 넣지 못하고 매 렌더 갱신되는
  // ref로 최신값을 읽는다.
  const activeRef = useRef(active);
  activeRef.current = active;
  const onSceneReadyRef = useRef(onSceneReady);
  onSceneReadyRef.current = onSceneReady;
  const [contextLost, setContextLost] = useState(false);
  const contextRetriesRef = useRef(0);

  const ready = routeResolved && motionReady;
  const showScene = ready && !reducedMotion && !contextLost;
  const outerFallbackReason: FallbackReason = !ready
    ? 'pending'
    : reducedMotion
      ? 'reduced-motion'
      : 'context-lost';

  // webglcontextlost는 버블링하지 않지만(MDN) 캡처 단계는 target 여부와
  // 무관하게 조상 체인을 타므로, 루트에 캡처 리스너 하나면 몇 단계 아래
  // canvas(Hyperspeed의 forwardRef가 만드는 내부 div 안)에서 난 이벤트도
  // 잡힌다. 컴포넌트 수명 전체(홈 셸이 사는 동안 단 한 번 마운트) 동안
  // 유지한다 — 씬이 나중에 다시 mount돼도 놓치지 않는다.
  // webglcontextrestored는 의도적으로 듣지 않는다 — "한 번 잃으면 폴백
  // 고정" 정책 그 자체(되살리는 코드 경로를 아예 만들지 않는다).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onContextLost = () => setContextLost(true);
    el.addEventListener('webglcontextlost', onContextLost, true);
    return () => el.removeEventListener('webglcontextlost', onContextLost, true);
  }, []);

  // 손실 뒤 한도 안에서 씬을 다시 세운다. 탭이 뒤로 가 있는 동안에는 타이머가
  // 스로틀되므로 사용자가 돌아온 뒤에 시도되고, 화면을 보고 있는 중에 잃은
  // 경우도 같은 경로로 복구된다.
  useEffect(() => {
    if (!contextLost) return;
    if (contextRetriesRef.current >= CONTEXT_RETRY_LIMIT) return;

    const timer = setTimeout(() => {
      contextRetriesRef.current += 1;
      setContextLost(false);
    }, CONTEXT_RETRY_DELAY_MS);

    return () => clearTimeout(timer);
  }, [contextLost]);

  // isTransitioning의 실제 edge(false→true / true→false)에서만 boost/settle을
  // 부른다. active만 바뀌고 isTransitioning이 계속 true면 이 effect의
  // 의존성이 안 바뀌어 재실행 자체가 안 된다 — "연속 전환에 settle 0회"가
  // 자연히 성립한다. 마운트 첫 값은 useRef(isTransitioning) 초기화로
  // "undefined→false" 같은 가짜 edge를 만들지 않는다 — 최초 해시 확정을
  // boost로 오인하지 않는다.
  useEffect(() => {
    const prev = prevTransitioningRef.current;
    prevTransitioningRef.current = isTransitioning;
    if (prev === isTransitioning) return;
    if (isTransitioning) {
      handleRef.current?.boost();
    } else {
      handleRef.current?.settle();
    }
  }, [isTransitioning]);

  // pageVisible의 실제 edge에서만 pause/resume한다. resume 직후에는 hidden
  // 중 쌓인 과거 완료 신호를 재생하지 않고, 그 순간의 현재 isTransitioning을
  // ref로 다시 읽어 boost/settle 중 하나로 상태를 재동기화한다. 의존성 배열에
  // isTransitioning을 넣지 않는다 — 넣으면 pageVisible과 무관한
  // isTransitioning 변화에도 pause/resume이 재실행된다.
  useEffect(() => {
    const prev = prevPageVisibleRef.current;
    prevPageVisibleRef.current = pageVisible;
    if (prev === pageVisible) return;

    if (!pageVisible) {
      handleRef.current?.pause();
      return;
    }

    handleRef.current?.resume();
    if (isTransitioningRef.current) {
      handleRef.current?.boost();
    } else {
      handleRef.current?.settle();
    }
  }, [pageVisible]);

  // ref 콜백(오브젝트 ref가 아니라)을 쓰는 이유: next/dynamic의 청크 로드가
  // 비동기라 실제 Hyperspeed는 showScene이 true가 된 커밋보다 늦게(청크가
  // 풀린 뒤) 마운트된다. 콜백은 React가 실제로 핸들을 붙이는 그 커밋에서
  // 정확히 한 번 불려 타이밍 문제가 없다. detectQuality()는 핸들이 처음
  // 생긴 시점에 단 한 번만 적용한다 — App은 항상 high로 시작하므로
  // (Hyperspeed/index.tsx 주석 참고) 기기 상한을 setQuality로 걸어준다.
  const setHandle = useCallback((handle: HyperspeedHandle | null) => {
    handleRef.current = handle;
    if (handle && !appliedInitialQualityRef.current) {
      appliedInitialQualityRef.current = true;
      void detectQuality().then((tier) => {
        handleRef.current?.setQuality(tier);
      });
    }
    // 씬이 "처음" 살아난 이 순간이 부팅 안무의 출발점이다(브리프 1절).
    // onSceneReady는 active와 무관하게 항상 알린다 — BootSequence 자신이
    // active === overview 게이트를 이미 갖고 있으므로 여기서 중복 판단하지
    // 않는다. 반면 광선의 fov 펀치(bootIn)는 이 배경 자신의 시각 효과라
    // overview가 아닐 때(예: /#projects 딥링크로 처음 씬이 뜨는 경우) 불필요한
    // 펀치를 만들지 않도록 여기서 직접 게이트한다.
    if (handle && !bootInAppliedRef.current) {
      bootInAppliedRef.current = true;
      onSceneReadyRef.current?.();
      if (activeRef.current === OVERVIEW) {
        handle.bootIn(BOOT_DURATION_SECONDS);
      }
    }
  }, []);

  const opacity = active === OVERVIEW ? BASE_OPACITY_OVERVIEW : BASE_OPACITY_SECTION;
  // obscured는 밝기가 아니라 초점만 건드린다. boost()·settle()도 그대로다.
  const filter = obscured ? `blur(${OBSCURED_BLUR_PX}px)` : 'none';

  return (
    <div
      ref={rootRef}
      data-testid="hyperspeed-background"
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ opacity, filter }}
    >
      {showScene ? <DynamicHyperspeed onHandle={setHandle} /> : <HyperspeedFallback reason={outerFallbackReason} />}
    </div>
  );
}
