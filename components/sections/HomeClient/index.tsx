'use client';

import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import LuminousFlowBackground from '@/components/blocks/LuminousFlowBackground';
import Navigation from '@/components/blocks/Navigation';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { AboutSection, AwardAndCertificateSection, ExperienceSection, Footer, ProjectsSection, SkillsSection } from '@/components/sections';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useProjectModalObscured } from '@/hooks/useProjectModalObscured';
import { useSectionNav } from '@/hooks/useSectionNav';
import { HOME_SECTION_CONFIG, NAV_ITEMS, SECTION_IDS, type HomeSectionId } from '@/lib/constants';

const SECTION_COMPONENTS = {
  [SECTION_IDS.ABOUT]: AboutSection,
  [SECTION_IDS.SKILLS]: SkillsSection,
  [SECTION_IDS.PROJECTS]: ProjectsSection,
  [SECTION_IDS.AWARDS_CERTIFICATES]: AwardAndCertificateSection,
  [SECTION_IDS.EXPERIENCE]: ExperienceSection,
} satisfies Record<HomeSectionId, ComponentType>;

export default function HomeClient() {
  const rootRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const { ready: preferenceReady, reduced: reducedMotion } = useMotionPreference();
  const pageVisible = usePageVisibility();
  const obscured = useProjectModalObscured();
  const { active, routeResolved, navigationTarget, navigate } = useSectionNav({ rootRef, headerRef, blocked: obscured, reducedMotion });
  const motionReady = routeResolved && preferenceReady;
  const activeLabel = HOME_SECTION_CONFIG.find(section => section.id === active)?.label ?? 'Overview';
  const [announcement, setAnnouncement] = useState('');
  // 명시적 이동이 도착해 목적지에 포커스가 간 때만 알린다. 수동으로 읽어 넘긴 섹션은 알리지 않는다.
  useEffect(() => {
    if (navigationTarget) setAnnouncement('');
    else if (document.activeElement === rootRef.current?.querySelector(`[data-section="${active}"]`)) setAnnouncement(`${activeLabel} section`);
  }, [navigationTarget, active, activeLabel]);

  return <SectionActivityProvider pageVisible={pageVisible} routeResolved={routeResolved} motionReady={motionReady} reducedMotion={reducedMotion} obscured={obscured}>
    <div className="portfolio-document">
      <LuminousFlowBackground scrollScene paused={!pageVisible || !motionReady || reducedMotion || obscured} />
      <div inert={obscured} data-obscured={obscured ? '' : undefined}>
        <Navigation items={NAV_ITEMS} active={active} onNavigate={navigate} reducedMotion={reducedMotion} headerRef={headerRef} />
      </div>
      <main ref={rootRef} className="section-stage" inert={obscured}
        data-route-resolved={routeResolved} data-motion-ready={motionReady} data-reduced-motion={reducedMotion}
        data-navigation-target={navigationTarget ?? undefined} data-active-section={active}>
        <section id="overview" data-section="overview" role="region" aria-label="Overview" tabIndex={-1} className="document-section portfolio-hero">
          <div data-motion-anchor="hero-name" aria-hidden="true" className="h-16 w-full max-w-2xl sm:h-24" />
          <span aria-hidden="true" className="skill-icon mb-6" style={{ '--skill-icon-src': 'url(/icons-mono/react.svg)' } as CSSProperties} />
          <p>안녕하세요.</p><p>SW개발자.</p><p>김태인입니다.</p><p>잘부탁드립니다.</p>
          <h1>탄탄한 기본기를 바탕으로 꾸준히 개선하고, 협업으로 함께 성장하는 개발자.</h1>
        </section>
        {HOME_SECTION_CONFIG.map(({ id, label }) => {
          const Section = SECTION_COMPONENTS[id];
          return <div key={id} data-section={id} role="region" aria-label={label} tabIndex={-1} className="document-section"><Section /></div>;
        })}
      </main>
      <div inert={obscured}><Footer /></div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
    </div>
  </SectionActivityProvider>;
}
