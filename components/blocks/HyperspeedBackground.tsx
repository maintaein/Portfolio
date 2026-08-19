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
import { detectQuality } from '@/lib/deviceQuality';

export interface HyperspeedBackgroundProps {
  active: NavId;
  isTransitioning: boolean;
  obscured: boolean; // ProjectModal 열림. 속도는 유지하고 밝기만 추가 감광
  pageVisible: boolean;
  routeResolved: boolean; // 최초 해시 해석 전에는 WebGL import·rAF를 시작하지 않음
  motionReady: boolean; // route + motion preference가 모두 확정됨
  reducedMotion: boolean;
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
// obscured(ProjectModal 열림) 동안 모달 텍스트 대비를 확보하기 위한 추가
// 감광 배수. 정확한 값은 실기기 디자인 검수 대상 — 여기서는 "obscured가
// 밝기만 낮추고 boost()·settle()은 건드리지 않는다"는 계약을 만족하는
// 유효값(0~1 사이, 기존 밝기보다 항상 어두움)이다.
const OBSCURED_DIM_MULTIPLIER = 0.4;

export default function HyperspeedBackground({
  active,
  isTransitioning,
  obscured,
  pageVisible,
  routeResolved,
  motionReady,
  reducedMotion,
}: HyperspeedBackgroundProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HyperspeedHandle | null>(null);
  const appliedInitialQualityRef = useRef(false);
  const prevTransitioningRef = useRef(isTransitioning);
  const prevPageVisibleRef = useRef(pageVisible);
  // effect 의존성에 isTransitioning을 넣지 않고도(넣으면 resume과 무관한
  // isTransitioning 변화에도 이 effect가 재실행된다) 재동기화 시점에 최신값을
  // 읽기 위한 ref. 매 렌더 갱신한다 — hooks/useSectionNav.ts의 activeRef와
  // 같은 패턴.
  const isTransitioningRef = useRef(isTransitioning);
  isTransitioningRef.current = isTransitioning;
  const [contextLost, setContextLost] = useState(false);

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
  }, []);

  const baseOpacity = active === OVERVIEW ? BASE_OPACITY_OVERVIEW : BASE_OPACITY_SECTION;
  const opacity = obscured ? baseOpacity * OBSCURED_DIM_MULTIPLIER : baseOpacity;

  return (
    <div
      ref={rootRef}
      data-testid="hyperspeed-background"
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ opacity }}
    >
      {showScene ? <DynamicHyperspeed onHandle={setHandle} /> : <HyperspeedFallback reason={outerFallbackReason} />}
    </div>
  );
}
