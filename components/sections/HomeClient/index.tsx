'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type TransitionEvent,
} from 'react';
import HyperspeedBackground from '@/components/blocks/HyperspeedBackground';
import Navigation from '@/components/blocks/Navigation';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import {
  AboutSection,
  AwardAndCertificateSection,
  BootSequence,
  ContactSection,
  ExperienceSection,
  Footer,
  ProjectsSection,
  SkillsSection,
} from '@/components/sections';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useProjectModalObscured } from '@/hooks/useProjectModalObscured';
import { useSectionSwipe } from '@/hooks/useSectionSwipe';
import {
  NAV_SEQUENCE,
  OVERVIEW,
  useSectionNav,
  type NavId,
} from '@/hooks/useSectionNav';
import {
  HOME_SECTION_CONFIG,
  NAV_ITEMS,
  SECTION_IDS,
  type HomeSectionId,
} from '@/lib/constants';
import type { Flip } from '@/lib/gsap';

// 워드마크 FLIP 지속(ms) — 네비 겹침 회피의 단일 출처(세 이음매 브리프
// 3절). styles/design-tokens.css의 --wordmark-flip-duration
// (.nav-strip-visible의 transition-delay)이 반드시 이 값과 같아야
// "워드마크가 착지한 뒤에만 스트립이 나타난다"가 성립한다. TS와 CSS는
// 빌드 타임에 값을 공유할 수 없으므로 WordmarkFlip.test.tsx가 두 파일을
// 각각 읽어 숫자가 같은지 교차 검증한다 — 한쪽만 바뀌면 그 테스트가
// FAIL한다.
const WORDMARK_FLIP_DURATION_MS = 500;

const SECTION_COMPONENTS = {
  [SECTION_IDS.ABOUT]: AboutSection,
  [SECTION_IDS.SKILLS]: SkillsSection,
  [SECTION_IDS.PROJECTS]: ProjectsSection,
  [SECTION_IDS.AWARDS_CERTIFICATES]: AwardAndCertificateSection,
  [SECTION_IDS.EXPERIENCE]: ExperienceSection,
  [SECTION_IDS.CONTACT]: ContactSection,
} satisfies Record<HomeSectionId, ComponentType>;

function parseTransitionTime(value: string | undefined) {
  if (!value) return 0;

  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return 0;
  return value.trim().endsWith('ms') ? amount : amount * 1000;
}

function hasOpacityTransition(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const properties = style.transitionProperty
    .split(',')
    .map((value) => value.trim());
  const durations = style.transitionDuration
    .split(',')
    .map((value) => value.trim());
  const delays = style.transitionDelay.split(',').map((value) => value.trim());

  return properties.some((property, index) => {
    if (property !== 'opacity' && property !== 'all') return false;

    const duration = parseTransitionTime(durations[index % durations.length]);
    const delay = parseTransitionTime(delays[index % delays.length]);
    return duration + delay > 0;
  });
}

export default function HomeClient() {
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  // 이름이 "멀리서 도착"하는 scale을 여는 wrapper(Navigation 소유 DOM,
  // 워드마크 버튼 자신이 아니다). BootSequence의 GSAP 타임라인이 이 노드에만
  // scale을 건다 — 부팅 안무 브리프 1절의 FLIP 불변식.
  const wordmarkScaleRef = useRef<HTMLDivElement>(null);
  // HERO 재순서 브리프 — 파티클이 뭉쳐 이름이 완성되는 핸드오프 순간
  // BootSequence가 이 값을 true로 뒤집는다. HyperspeedBackground는 이
  // 값을 기다렸다가 배경을 페이드로 드러낸다(t=0 검은 화면 → 이름 완성 →
  // 배경 등장, 브리프 2·3절). 씬 자체는 이 값과 무관하게 이미 일찍
  // 로드·렌더되고 있다 — "준비는 일찍, 노출은 늦게".
  const [heroRevealed, setHeroRevealed] = useState(false);
  const handleNameRevealed = useCallback(() => setHeroRevealed(true), []);
  // GSAP은 정적 import에서 뺐다(First Load JS 예산 — gsap-lazy-brief.md).
  // 마운트 직후 미리 요청해 ref에 담아 두고, 아래 handleBeforeActiveChange는
  // 이 ref를 동기적으로만 읽는다 — Flip.getState()는 DOM이 바뀌기 직전에
  // 동기 호출돼야 해서 await을 넣을 수 있는 자리가 아니기 때문이다. 아직
  // 로드되지 않았으면(사용자가 첫 섹션 이동을 하기까지 보통 수백 ms가
  // 걸리므로 드물다) FLIP 없이 넘어간다 — 위치는 CSS가 바꾸므로 애니메이션만
  // 없을 뿐 깨지지 않는다.
  const gsapModuleRef = useRef<typeof import('@/lib/gsap') | null>(null);

  useEffect(() => {
    import('@/lib/gsap').then((mod) => {
      gsapModuleRef.current = mod;
    });
  }, []);

  // 워드마크 FLIP 브리지 — hero/compact 경계를 넘는 실제 active 변경 직전에
  // useSectionNav가 onBeforeActiveChange로 알려주면 Flip.getState()를 여기
  // 담아 둔다. 값이 있으면 React가 hero/compact 클래스를 반영한 다음 커밋의
  // useLayoutEffect([active])에서 꺼내 Flip.from()을 부른다(GSAP React FLIP
  // 지침). motionReady·reducedMotion·routeResolved는 이 콜백이 정의되는
  // 시점엔 아직 useSectionNav의 반환값이 없어 순환 참조가 생기므로, 매
  // 렌더 갱신되는 ref로 최신값을 읽는다(이 파일의 activeRef와 동일 패턴).
  const pendingWordmarkStateRef = useRef<Flip.FlipState | null>(null);
  const motionReadyRef = useRef(false);
  const reducedMotionRef = useRef(true);
  const routeResolvedRef = useRef(false);

  const handleBeforeActiveChange = useCallback(
    (from: NavId, to: NavId) => {
      if (
        !routeResolvedRef.current ||
        !motionReadyRef.current ||
        reducedMotionRef.current
      ) {
        return;
      }
      const crossesOverviewBoundary = from === OVERVIEW || to === OVERVIEW;
      if (!crossesOverviewBoundary || !wordmarkRef.current) return;

      // 아직 GSAP 모듈이 로드되지 않았으면 FLIP 없이 넘어간다 — 구조적으로
      // 강제된다: pendingWordmarkStateRef가 비어 있으므로 아래
      // useLayoutEffect([active])의 Flip.from()도 실행되지 않는다.
      const mod = gsapModuleRef.current;
      if (!mod) return;

      // BootSequence는 active === overview일 때만 registerGsap()을 부른다.
      // /#projects처럼 overview를 거치지 않고 다른 섹션에서 시작한 뒤 최초로
      // overview 경계를 넘는 경우 그 등록이 아직 없었을 수 있으므로 여기서도
      // 멱등하게 보장한다.
      mod.registerGsap();
      pendingWordmarkStateRef.current = mod.Flip.getState(wordmarkRef.current);
    },
    []
  );

  const {
    active,
    setActive,
    goNext,
    goPrevious,
    isTransitioning,
    completeTransition,
    entryAnimationTarget,
    routeResolved,
    sectionTransition,
  } = useSectionNav(handleBeforeActiveChange);
  const swipeHandlers = useSectionSwipe({
    onNext: goNext,
    onPrevious: goPrevious,
  });
  const { ready: preferenceReady, reduced: reducedMotion } =
    useMotionPreference();
  const pageVisible = usePageVisibility();
  const motionReady = routeResolved && preferenceReady;
  motionReadyRef.current = motionReady;
  reducedMotionRef.current = reducedMotion;
  routeResolvedRef.current = routeResolved;
  const isProjectModalOpen = useProjectModalObscured();

  // 전환 끊김 완화. 비활성 섹션은 .section-hidden의 content-visibility:
  // auto로 렌더를 건너뛴다. active가 바뀌는 순간 .section-visible로
  // 올라가며 건너뛰던 서브트리 전체의 레이아웃·페인트가 전환이 시작되는 그
  // 프레임에 몰려 워드마크 FLIP, 섹션 진입 타임라인과 겹쳤다. NAV_SEQUENCE
  // 순서상 지금 active의 "다음" 섹션 하나만 미리 content-visibility를
  // 올려 두면(opacity·pointer-events·inert는 .section-hidden 값 그대로)
  // 그 비용이 전환 전에 이미 끝나 있다.
  // START의 420ms 충전 구간을 굳이 별도로 훅하지 않은 이유는 이렇다.
  // active 파생값이라 overview에 머무는 동안 계속 예열돼 420ms보다 훨씬
  // 긴 여유를 번다. 순방향 연속 이동(about에서 projects로 같은 네비 클릭,
  // 스와이프)도 같은 이유로 자연히 덮인다. 다만 역방향 이동과 건너뛰는
  // 네비 점프(예: about에서 contact로)는 목적지가 "다음 하나"가 아니므로
  // 덮이지 않는다(리포트 참고). reducedMotion에서는 애니메이션 자체가
  // 없으므로 예열도 하지 않는다.
  //
  // isTransitioning을 함께 보는 이유가 이 예열의 핵심이다. prewarmId가
  // active만 보고 파생되면, overview에서 about으로 넘어가는 그 커밋에서
  // about이 싸게 올라가는 대신 projects가 hidden에서 prewarm으로 바뀐다.
  // content-visibility가 그 프레임에 다시 올라가므로 지키려던 바로 그
  // 프레임에 새 서브트리의 첫 렌더가 들어앉고, 끊김이 사라지는 게 아니라
  // 옆 섹션으로 옮겨간다. setActive가 setActiveState와 setIsTransitioning을
  // 같은 배치에서 부르므로 전환이 시작되는 렌더에는 이미 isTransitioning이
  // true다. 그동안 예열을 멈췄다가 transitionend로 completeTransition이
  // 닫아 준 뒤, 아무것도 움직이지 않을 때 다음 섹션을 데운다.
  const prewarmId =
    motionReady && !reducedMotion && !isTransitioning
      ? NAV_SEQUENCE[NAV_SEQUENCE.indexOf(active) + 1]
      : undefined;

  // 유휴 예열. 위 prewarmId는 NAV_SEQUENCE의 "다음 하나"만 덮어 건너뛰는
  // 이동(예: about에서 experience로)은 놓친다. 컨트롤러가 프로덕션
  // 빌드·실제 GPU로 실측한 값이 이 구멍을 그대로 보여준다. about에서
  // experience로 처음 이동할 때 긴 작업(long task)이 138ms·102ms 뛰고
  // 프레임 간격이 최대 150ms까지 벌어졌다. 재방문에서는 둘 다 0에 가깝다.
  // content-visibility: auto가 비활성 섹션의 첫 렌더를 미뤄 두는데, 그
  // 비용이 전환이 시작되는 바로 그 프레임에 몰려 메인 스레드를 막기
  // 때문이다. 그래서 300ms 이탈 애니메이션의 절반이 그려지지 않고,
  // 떠나는 섹션이 확대도 흐려짐도 없이 선명한 채로 멈췄다가 툭 사라진다.
  //
  // 그래서 유휴 시간에 아직 안 데운 섹션을 하나씩 데워 이 비용을 전환
  // 밖으로 옮긴다. 한 번 데운 섹션은 절대 다시 식히지 않는다(warmed 상태는
  // 늘기만 한다). 이게 이 수정의 요점이다. 한 프레임에 전부 데우면 그
  // 자체가 유휴 시간에 긴 작업을 만들므로 반드시 하나씩 예약한다.
  const [warmedSectionIds, setWarmedSectionIds] = useState<
    ReadonlySet<HomeSectionId>
  >(() => new Set());

  useEffect(() => {
    // 전환 중에 데우면 지금 고치려는 문제를 그 프레임에 그대로 재현하므로
    // routeResolved가 아직이거나 전환이 진행 중이면 예약하지 않는다.
    if (!routeResolved || isTransitioning) return;

    const nextId = HOME_SECTION_CONFIG.map(({ id }) => id).find(
      (id) => !warmedSectionIds.has(id)
    );
    if (!nextId) return;

    // requestIdleCallback이 없는 브라우저(Safari 구버전)는 setTimeout으로
    // 대체한다.
    const hasIdleCallback = typeof window.requestIdleCallback === 'function';
    const warm = () => {
      setWarmedSectionIds((prev) => {
        if (prev.has(nextId)) return prev;
        return new Set(prev).add(nextId);
      });
    };
    const handle = hasIdleCallback
      ? window.requestIdleCallback(warm)
      : window.setTimeout(warm, 0);

    return () => {
      if (hasIdleCallback) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [isTransitioning, routeResolved, warmedSectionIds]);

  const sectionRefs = useRef<
    Partial<Record<NavId, HTMLDivElement | null>>
  >({});
  const lastFocusedActive = useRef<NavId>(OVERVIEW);
  const runningTransitions = useRef(new Set<NavId>());

  // React가 hero/compact 클래스를 커밋한 직후 pending Flip 상태를 소비한다.
  // 최초 마운트에는 pendingWordmarkStateRef가 비어 있으므로 Flip이 실행되지
  // 않는다(구멍 없이 구조적으로 보장). Overview 경계를 넘지 않은 전환(예:
  // about → projects)도 관찰자가 상태를 담지 않으므로 여기서 no-op한다.
  useLayoutEffect(() => {
    const state = pendingWordmarkStateRef.current;
    if (!state) return;
    pendingWordmarkStateRef.current = null;
    if (!wordmarkRef.current) return;

    // state가 있다는 것은 handleBeforeActiveChange가 그 시점에 이미
    // gsapModuleRef를 채워 뒀다는 뜻이므로(같은 조건에서만 둘 다 세팅) 여기
    // 도달했을 때 모듈이 없는 경우는 없다.
    const mod = gsapModuleRef.current;
    if (!mod) return;

    mod.Flip.from(state, {
      duration: WORDMARK_FLIP_DURATION_MS / 1000,
      ease: mod.SITE_EASE,
      scale: true,
      absolute: true,
    });
  }, [active]);

  const activeLabel =
    active === OVERVIEW
      ? 'Overview'
      : HOME_SECTION_CONFIG.find(({ id }) => id === active)?.label ??
        'Overview';

  // reduced-motion이나 0초 전환에서는 CSS 이벤트가 없으므로 계산값으로 닫는다.
  useLayoutEffect(() => {
    if (!motionReady) return;
    if (!isTransitioning) {
      runningTransitions.current.clear();
      return;
    }

    const destination = sectionRefs.current[active];
    if (reducedMotion || !destination || !hasOpacityTransition(destination)) {
      completeTransition(active);
    }
  }, [
    active,
    completeTransition,
    isTransitioning,
    motionReady,
    reducedMotion,
  ]);

  // 상태 훅은 DOM을 모른다. 완료 뒤 region에만 포커스하고 scrollTop은 보존한다.
  useEffect(() => {
    if (
      !routeResolved ||
      isTransitioning ||
      lastFocusedActive.current === active
    ) {
      return;
    }

    lastFocusedActive.current = active;
    sectionRefs.current[active]?.focus({ preventScroll: true });
  }, [active, isTransitioning, routeResolved]);

  const isOwnOpacityTransition = (
    event: TransitionEvent<HTMLDivElement>
  ) => {
    // React 19는 transitionrun/cancel을 일반 SyntheticEvent로 전달하므로
    // 그 두 이벤트의 propertyName은 nativeEvent에서 보완해야 한다.
    const nativePropertyName =
      'propertyName' in event.nativeEvent &&
      typeof event.nativeEvent.propertyName === 'string'
        ? event.nativeEvent.propertyName
        : '';
    const propertyName = event.propertyName || nativePropertyName;

    return event.target === event.currentTarget && propertyName === 'opacity';
  };

  const handleSectionTransitionRun = (
    id: NavId,
    event: TransitionEvent<HTMLDivElement>
  ) => {
    if (
      isTransitioning &&
      id === active &&
      isOwnOpacityTransition(event)
    ) {
      runningTransitions.current.add(id);
    }
  };

  const handleSectionTransitionDone = (
    id: NavId,
    event: TransitionEvent<HTMLDivElement>
  ) => {
    if (!isOwnOpacityTransition(event)) return;
    if (!runningTransitions.current.has(id)) return;

    runningTransitions.current.delete(id);
    completeTransition(id);
  };

  // 전환 표식은 들어오는 섹션 하나와 나가는 섹션 하나에만 단다. 그래야
  // 매 전환마다 그 둘의 animation-name이 반드시 바뀌어 같은 방향으로
  // 연속 이동해도 애니메이션이 다시 재생된다. 전부에 달면 비활성 여섯 개가
  // 함께 뛴다. reducedMotion이면 아예 달지 않아 CSS가 걸릴 자리가 없다.
  //
  // isTransitioning 게이트(최종 리뷰 I2). sectionTransition은 한 번
  // 기록되면 다음 이동 전까지 초기화되지 않는다. 이 게이트가 없으면
  // reducedMotion이 켜진 채로 이동해 표식 없이 도착한 뒤(아무 애니메이션도
  // 없음), 한참 뒤 OS 모션 설정이 꺼져 재렌더가 일어나면 표식이 새로
  // 붙어 아무 데도 가지 않았는데 진입 애니메이션이 재생된다. setActive가
  // setActiveState와 setIsTransitioning(true)를 같은 배치에서 부르므로
  // 전환 첫 렌더에는 이미 표식이 붙어 있어 안전하다.
  function transitionAttributes(id: NavId): Record<string, string> {
    if (reducedMotion || !isTransitioning || sectionTransition.direction === 'none') {
      return {};
    }
    if (id === active) {
      return { 'data-section-direction': sectionTransition.direction };
    }
    if (id === sectionTransition.from) {
      return {
        'data-section-direction': sectionTransition.direction,
        'data-section-leaving': '',
      };
    }
    return {};
  }

  return (
    <SectionActivityProvider
      active={active}
      entryAnimationTarget={entryAnimationTarget}
      pageVisible={pageVisible}
      routeResolved={routeResolved}
      motionReady={motionReady}
      reducedMotion={reducedMotion}
    >
      <HyperspeedBackground
        active={active}
        isTransitioning={isTransitioning}
        obscured={isProjectModalOpen}
        pageVisible={pageVisible}
        routeResolved={routeResolved}
        motionReady={motionReady}
        reducedMotion={reducedMotion}
        heroRevealed={heroRevealed}
      />

      <Navigation
        items={NAV_ITEMS}
        active={active}
        onNavigate={setActive}
        reducedMotion={reducedMotion}
        wordmarkRef={wordmarkRef}
        wordmarkScaleRef={wordmarkScaleRef}
      />

      {/* 워드마크와 같은 셸 레벨 — overview 섹션(.section-hidden의
          content-visibility) 밖에 둔다. 섹션 안에 있으면 paint containment가
          이 fixed 캡션을 뷰포트가 아니라 섹션 컨테이닝 박스 기준으로
          재배치해 START를 누르는 순간 아래로 튀었다(부팅 안무 브리프 3절).
          BootSequence는 항상 마운트 상태를 유지한다(active로 조건부 렌더하지
          않는다) — 그래야 hasStartedRef가 살아남아 재방문 시 재생되지 않는다는
          계약을 지킨다. 보이기/숨기기·inert는 BootSequence 자신이 active를
          보고 소유한다. */}
      <BootSequence
        active={active}
        routeResolved={routeResolved}
        motionReady={motionReady}
        reducedMotion={reducedMotion}
        wordmarkRef={wordmarkRef}
        onStart={() => setActive(SECTION_IDS.ABOUT)}
        onNameRevealed={handleNameRevealed}
        transitionAttributes={transitionAttributes(OVERVIEW)}
      />

      <main
        className={`section-stage${
          active === SECTION_IDS.PROJECTS ? ' section-stage-horizontal' : ''
        }`}
        data-route-resolved={routeResolved}
        data-motion-ready={motionReady}
        data-reduced-motion={reducedMotion}
        {...swipeHandlers}
      >
        <div
          ref={(node) => {
            sectionRefs.current[OVERVIEW] = node;
          }}
          data-section={OVERVIEW}
          role="region"
          aria-label="Overview"
          tabIndex={-1}
          className={`section-scroll ${
            active === OVERVIEW ? 'section-visible' : 'section-hidden'
          }`}
          inert={active !== OVERVIEW}
          aria-hidden={active !== OVERVIEW}
          {...transitionAttributes(OVERVIEW)}
          onTransitionRun={(event) =>
            handleSectionTransitionRun(OVERVIEW, event)
          }
          onTransitionEnd={(event) =>
            handleSectionTransitionDone(OVERVIEW, event)
          }
          onTransitionCancel={(event) =>
            handleSectionTransitionDone(OVERVIEW, event)
          }
        />
        {/* overview는 이제 셸 레벨의 BootSequence만 보여준다(위 참고) — 이
            wrapper는 section 상태(visible/hidden·inert)와 SEO용 region
            상주만을 위해 빈 채로 남는다. */}

        {HOME_SECTION_CONFIG.map(({ id, label }) => {
          const Section = SECTION_COMPONENTS[id];
          const isActive = active === id;
          // id === prewarmId는 전환 직후 다음 섹션을 즉시 덮고, warmedSectionIds는
          // 유휴 시간에 하나씩 쌓인 데워진 섹션 전체를 덮는다. 활성 섹션에는
          // 붙이지 않는다(!isActive). 이미 section-visible이라 예열이 필요 없다.
          const isPrewarm =
            !isActive && (id === prewarmId || warmedSectionIds.has(id));

          return (
            <div
              ref={(node) => {
                sectionRefs.current[id] = node;
              }}
              key={id}
              data-section={id}
              role="region"
              aria-label={label}
              tabIndex={-1}
              className={`section-scroll ${
                isActive
                  ? 'section-visible'
                  : isPrewarm
                    ? 'section-hidden section-prewarm'
                    : 'section-hidden'
              }`}
              // 비활성 섹션은 보이지 않아도 Tab으로 들어갈 수 있으므로 inert가 필요하다.
              inert={!isActive}
              aria-hidden={!isActive}
              {...transitionAttributes(id)}
              onTransitionRun={(event) =>
                handleSectionTransitionRun(id, event)
              }
              onTransitionEnd={(event) =>
                handleSectionTransitionDone(id, event)
              }
              onTransitionCancel={(event) =>
                handleSectionTransitionDone(id, event)
              }
            >
              <Section />
            </div>
          );
        })}
      </main>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isTransitioning ? '' : `${activeLabel} section`}
      </div>

      <Footer />
    </SectionActivityProvider>
  );
}
