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
import {
  HERO_SURGE_MS,
  HYPERSPEED_DENSITY_POOL,
  type HeroPhase,
} from '@/lib/constants';
import { detectQuality } from '@/lib/deviceQuality';

export interface HyperspeedBackgroundProps {
  active: NavId;
  isTransitioning: boolean;
  obscured: boolean; // ProjectModal 열림. 속도는 유지하고 밝기만 추가 감광
  pageVisible: boolean;
  routeResolved: boolean; // 최초 해시 해석 전에는 WebGL import·rAF를 시작하지 않음
  motionReady: boolean; // route + motion preference가 모두 확정됨
  reducedMotion: boolean;
  // 첫 진입 hero. HomeClient가 소유한 단계다. 최초 overview(pending)에서는
  // 배경이 보이지 않고, 처음 섹션으로 넘어가는 surge에서 소실점(CSS
  // 마스크, styles/design-tokens.css의 data-hyperspeed-hero 규칙)부터
  // 자라며 밀도와 속도가 치솟는다. settle에서 섹션 기본치로 가라앉고 done
  // 뒤로는 오늘의 overview/section 동작 그대로다. 딥링크로 다른 섹션에서
  // 시작하거나 reducedMotion이면 HomeClient가 pending을 곧바로 done으로
  // 보내고, 여기서도 heroState 계산이 그 둘을 none으로 접는다.
  hero: HeroPhase;
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
// 0.3에서는 광선이 사실상 보이지 않아 0.55까지 올렸는데, 이번엔 반대로
// 배경이 본문을 이겼다. 0.35는 광선의 흐름은 남기면서 본문 뒤를 다시
// 검정에 가깝게 되돌리는 자리다. 전 섹션 공통값이다.
const BASE_OPACITY_SECTION = 0.35;

// 체류 중 배경 흐름 배율. 오버뷰 값은 엔진 기본값(IDLE_TIME_SCALE)과 같다.
// 섹션에서는 본문을 읽는 동안 시야 가장자리가 계속 움직이면 눈이 끌려가므로
// 3분의 1로 줄인다. 멈추지는 않는다. 배경이 죽으면 화면이 정지 이미지가 된다.
const IDLE_SCALE_OVERVIEW = 0.3;
const IDLE_SCALE_SECTION = 0.1;
// 첫 진입 hero의 흐름 배율과 밀도. pending(숨김) 동안 낮은 값으로 수렴해
// 있어야 surge가 "느린 데서 시작해 빨라지는" 곡선이 된다. surge의 상한은
// 오버뷰 체류 속도다. 배경이 처음 보이는 동안 오버뷰만큼 빨라졌다가
// settle에서 섹션 체류 속도로 내려가고, 그 내려가는 구간에 셸과 섹션
// 내용이 들어온다. 엔진의 지수 수렴(1/초)을 거치므로 1.8초 안에 상한에
// 다 닿지는 않고 그 근처까지 오른다. 밀도 단위는 엔진의 setDensity와
// 같다. 1이 기본, HYPERSPEED_DENSITY_POOL이 최대.
const HERO_IDLE_PENDING = 0.05;
const HERO_IDLE_SURGE = IDLE_SCALE_OVERVIEW;
const HERO_DENSITY_PENDING = 0.3;
const HERO_DENSITY_SURGE = HYPERSPEED_DENSITY_POOL;
// obscured(ProjectModal 열림) 동안 배경에서 초점을 빼는 블러 반경.
// 감광(0.4배)에서 블러로 바꿨다 — 어둡게 하면 배경이 남색 덩어리로 죽는데,
// 블러는 밝기를 유지한 채 시선만 모달로 보낸다. 대비는 모달 자신의 불투명
// 패널이 담당한다.
//
// 주의: 전체화면 블러는 모바일 GPU에서 비싸다. 다만 모달이 열려 있는 동안만
// 걸리고 그때는 배경 애니메이션을 볼 이유가 없으므로 감수한다. 실기기에서
// 모달 여닫기가 무거우면 이 값을 낮추거나 감광으로 되돌린다.
const OBSCURED_BLUR_PX = 8;
// obscured 동안 배경 자신이 물러나는 감광 계수. 블러만 걸면 배경이 사라지는
// 속도가 곧 모달 셸 배경이 차오르는 속도라, 배경이 제 걸음 없이 툭 꺼진
// 것처럼 보인다. 밝기를 같이 빼면 배경이 스스로 뒤로 물러난다. 0으로
// 떨어뜨리지 않는 것은 흐름이 완전히 죽으면 화면이 정지 이미지가 되기 때문이다
const OBSCURED_OPACITY_SCALE = 0.35;

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
  hero,
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

  // 첫 진입 hero의 실효 상태. reducedMotion과 딥링크(pending인데 이미
  // 섹션)와 done은 전부 none으로 접는다. none이면 마스크 속성이 붙지 않고
  // 밝기, 배율, 밀도가 오늘 값 그대로다.
  const heroState: 'pending' | 'surge' | 'settle' | 'none' = reducedMotion
    ? 'none'
    : hero === 'pending'
      ? active === OVERVIEW
        ? 'pending'
        : 'none'
      : hero === 'done'
        ? 'none'
        : hero;
  const heroPending = heroState === 'pending';
  // surge와 settle 동안에는 전환 boost를 걸지 않는다. boost는 섹션이 바뀌는
  // 순간을 속도로 덮는 장치인데, hero에서는 배경 자체가 안무다. 얹으면
  // 올라가는 구간이 상한(오버뷰 체류 속도)을 넘고, 내려가야 할 settle
  // 구간에도 boost가 아직 오르는 중이라 감속이 보이지 않는다. hero가 done이
  // 될 때까지 흐름은 idleScale 하나만 몬다.
  const heroSuppressesBoost =
    heroState === 'surge' || heroState === 'settle';

  const idleScale = heroPending
    ? HERO_IDLE_PENDING
    : heroState === 'surge'
      ? HERO_IDLE_SURGE
      : active === OVERVIEW
        ? IDLE_SCALE_OVERVIEW
        : IDLE_SCALE_SECTION;
  const density = heroPending
    ? HERO_DENSITY_PENDING
    : heroState === 'surge'
      ? HERO_DENSITY_SURGE
      : 1;
  // 핸들은 next/dynamic 청크가 풀린 뒤에야 도착한다. 이 effect가 먼저 돌 수도
  // 있으므로 값을 ref에도 남겨 setHandle이 도착 시점에 다시 걸어준다.
  const idleScaleRef = useRef(idleScale);
  idleScaleRef.current = idleScale;
  const densityRef = useRef(density);
  densityRef.current = density;
  // boost effect의 의존성은 isTransitioning 하나로 유지한다(연속 전환에
  // settle 0회). 그래서 최신값을 ref로 건넨다.
  const heroSuppressesBoostRef = useRef(heroSuppressesBoost);
  heroSuppressesBoostRef.current = heroSuppressesBoost;
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
    if (isTransitioning && !heroSuppressesBoostRef.current) {
      handleRef.current?.boost();
    } else {
      handleRef.current?.settle();
    }
  }, [isTransitioning]);

  // 섹션에 머무는 동안의 흐름 속도. boost/settle과 독립이라 전환 중에 섹션이
  // 바뀌어도 가속이 끊기지 않는다.
  useEffect(() => {
    handleRef.current?.setIdleScale(idleScale);
  }, [idleScale]);

  // 밀도도 같은 방식이다. surge에서 풀 전부, settle 뒤 기본치로.
  useEffect(() => {
    handleRef.current?.setDensity(density);
  }, [density]);

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
    if (isTransitioningRef.current && !heroSuppressesBoostRef.current) {
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
    handle?.setIdleScale(idleScaleRef.current);
    handle?.setDensity(densityRef.current);
    if (handle && !appliedInitialQualityRef.current) {
      appliedInitialQualityRef.current = true;
      void detectQuality().then((tier) => {
        handleRef.current?.setQuality(tier);
      });
    }
  }, []);

  // pending(최초 overview) 동안은 밝기도 0이다. 마스크가 0이라 보이지
  // 않지만, opacity 0이면 브라우저가 합성 자체를 건너뛰어 숨어 있는 동안
  // GPU 비용이 없다. surge로 넘어가면 이 밝기 페이드와 마스크 성장이 같이
  // 시작한다.
  const baseOpacity = heroPending
    ? 0
    : active === OVERVIEW
      ? BASE_OPACITY_OVERVIEW
      : BASE_OPACITY_SECTION;
  // obscured는 초점과 밝기를 같이 건드린다. boost()·settle()은 그대로다 -
  // 씬은 계속 돈다. rAF를 멈추면 재개 비용이 눈에 띄게 튄다.
  const opacity = obscured ? baseOpacity * OBSCURED_OPACITY_SCALE : baseOpacity;
  const filter = obscured ? `blur(${OBSCURED_BLUR_PX}px)` : 'none';
  // 2차 감사 지적 — 이 래퍼에 전환이 없어 씬 청크가 풀리는 순간이나
  // heroRevealed가 뒤집히는 순간 캔버스가 튀어 들어왔다. opacity·filter
  // 둘 다 트랜지션을 걸어 모든 밝기·초점 변화가 페이드로 보이게 한다.
  // 두 지속이 어긋나면 초점이 먼저 풀리고 밝기가 뒤따라 배경이 두 몸으로
  // 움직인다. 같은 값으로 맞춰 한 몸으로 물러나게 한다.
  // reducedMotion에서는 전환 자체를 걸지 않는다(즉시 최종 상태).
  // mask-size 전환도 여기 있어야 한다. 인라인 transition이 CSS 규칙의
  // transition을 덮으므로 design-tokens.css 쪽에 두면 무시된다. 지속은
  // surge 길이와 같다. 마스크가 다 자라는 순간이 곧 셸과 섹션이 들어오는
  // 순간이다. 곡선은 사이트 공통 ease-out이 아니라 대칭 곡선이다. 공통
  // 곡선으로는 0.45초에 이미 화면을 거의 덮어 소실점에서 자라는 구간이
  // 너무 짧았다(실측). 대칭 곡선이면 1.5초 즈음까지 서서히 열린다.
  const transition = reducedMotion
    ? 'none'
    : `opacity var(--animate-duration-slow) ease-out, filter var(--animate-duration-slow) ease-out, mask-size ${HERO_SURGE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;

  // 계획 6 Task 5a. Playwright가 픽셀이나 내부 state 대신 붙잡을 관측
  // 속성. 둘 다 기존 값의 순수 파생이고 새 state를 만들지 않는다. 폴백일
  // 때도 이 div는 살아 있으므로(엔진 container는 청크가 풀려야 존재한다)
  // 여기에 단다. fallback은 boost·slow보다, obscured는 overview·section보다
  // 우선한다. 더 자세한 폴백 사유는 이미 HyperspeedFallback의
  // data-fallback-reason이 맡는다. hero 구간은 전환 중이어도 엔진에 boost를
  // 걸지 않으므로 slow로 읽힌다. 속성이 엔진과 어긋나면 관측용으로 쓸모가
  // 없다. hero가 도는 중인지는 data-hyperspeed-hero가 따로 말한다.
  const motionState = !showScene
    ? 'fallback'
    : isTransitioning && !heroSuppressesBoost
      ? 'boost'
      : 'slow';
  const visibilityState = obscured
    ? 'obscured'
    : active === OVERVIEW
      ? 'overview'
      : 'section';

  return (
    <div
      ref={rootRef}
      data-testid="hyperspeed-background"
      data-hyperspeed-motion={motionState}
      data-hyperspeed-visibility={visibilityState}
      // 첫 진입 hero. 값이 있으면 design-tokens.css가 소실점 마스크를 건다.
      // none이면 속성 자체가 없다.
      data-hyperspeed-hero={heroState === 'none' ? undefined : heroState}
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ opacity, filter, transition }}
    >
      {showScene ? <DynamicHyperspeed onHandle={setHandle} /> : <HyperspeedFallback reason={outerFallbackReason} />}
    </div>
  );
}
