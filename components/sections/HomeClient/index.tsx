'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type TransitionEvent,
} from 'react';
import Navigation from '@/components/blocks/Navigation';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import {
  AboutSection,
  AwardAndCertificateSection,
  ExperienceSection,
  Footer,
  HeroSection,
  ProjectsSection,
  SkillsSection,
} from '@/components/sections';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useSectionSwipe } from '@/hooks/useSectionSwipe';
import {
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

const SECTION_COMPONENTS = {
  [SECTION_IDS.ABOUT]: AboutSection,
  [SECTION_IDS.SKILLS]: SkillsSection,
  [SECTION_IDS.PROJECTS]: ProjectsSection,
  [SECTION_IDS.AWARDS_CERTIFICATES]: AwardAndCertificateSection,
  [SECTION_IDS.EXPERIENCE]: ExperienceSection,
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
  const {
    active,
    setActive,
    goNext,
    goPrevious,
    isTransitioning,
    completeTransition,
    entryAnimationTarget,
    routeResolved,
  } = useSectionNav();
  const swipeHandlers = useSectionSwipe({
    onNext: goNext,
    onPrevious: goPrevious,
  });
  const { ready: preferenceReady, reduced: reducedMotion } =
    useMotionPreference();
  const pageVisible = usePageVisibility();
  const motionReady = routeResolved && preferenceReady;
  const sectionRefs = useRef<
    Partial<Record<NavId, HTMLDivElement | null>>
  >({});
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  const lastFocusedActive = useRef<NavId>(OVERVIEW);
  const runningTransition = useRef<NavId | null>(null);

  const activeLabel =
    active === OVERVIEW
      ? 'Overview'
      : HOME_SECTION_CONFIG.find(({ id }) => id === active)?.label ??
        'Overview';

  // reduced-motion이나 0초 전환에서는 CSS 이벤트가 없으므로 계산값으로 닫는다.
  useLayoutEffect(() => {
    if (!motionReady) return;
    if (!isTransitioning) {
      runningTransition.current = null;
      return;
    }

    runningTransition.current = null;
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
      runningTransition.current = id;
    }
  };

  const handleSectionTransitionDone = (
    id: NavId,
    event: TransitionEvent<HTMLDivElement>
  ) => {
    if (!isOwnOpacityTransition(event)) return;
    if (id !== active || runningTransition.current !== id) return;

    runningTransition.current = null;
    completeTransition(id);
  };

  return (
    <SectionActivityProvider
      active={active}
      entryAnimationTarget={entryAnimationTarget}
      pageVisible={pageVisible}
      routeResolved={routeResolved}
      motionReady={motionReady}
      reducedMotion={reducedMotion}
    >
      <Navigation
        items={NAV_ITEMS}
        active={active}
        onNavigate={setActive}
        wordmarkRef={wordmarkRef}
      />

      <main
        className="section-stage"
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
          onTransitionRun={(event) =>
            handleSectionTransitionRun(OVERVIEW, event)
          }
          onTransitionEnd={(event) =>
            handleSectionTransitionDone(OVERVIEW, event)
          }
          onTransitionCancel={(event) =>
            handleSectionTransitionDone(OVERVIEW, event)
          }
        >
          <HeroSection />
        </div>

        {HOME_SECTION_CONFIG.map(({ id, label }) => {
          const Section = SECTION_COMPONENTS[id];
          const isActive = active === id;

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
                isActive ? 'section-visible' : 'section-hidden'
              }`}
              // 비활성 섹션은 보이지 않아도 Tab으로 들어갈 수 있으므로 inert가 필요하다.
              inert={!isActive}
              aria-hidden={!isActive}
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
