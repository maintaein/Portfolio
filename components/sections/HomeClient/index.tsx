'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import type { ElectricLogoHandle, ElectricLogoProps } from '@/components/blocks/ElectricLogo';
import LuminousFlowBackground, { type LuminousFlowBackgroundHandle } from '@/components/blocks/LuminousFlowBackground';
import Navigation from '@/components/blocks/Navigation';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { AboutSection, AwardAndCertificateSection, ExperienceSection, Footer, ProjectsSection, SkillsSection } from '@/components/sections';
import type { AboutSectionHandle } from '@/components/sections/AboutSection';
import BootSequence, { INTRO_GREETINGS, type BootSequenceHandle, type IntroTargets } from '@/components/sections/BootSequence';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useProjectModalObscured } from '@/hooks/useProjectModalObscured';
import { useSectionNav } from '@/hooks/useSectionNav';
import { HOME_SECTION_CONFIG, NAV_ITEMS, SECTION_IDS, type HomeSectionId } from '@/lib/constants';
import { coreValues } from '@/lib/data';
import type { LogoOwner, PortfolioMotion } from './motion';

const SECTION_COMPONENTS = {
  [SECTION_IDS.SKILLS]: SkillsSection,
  [SECTION_IDS.PROJECTS]: ProjectsSection,
  [SECTION_IDS.AWARDS_CERTIFICATES]: AwardAndCertificateSection,
  [SECTION_IDS.EXPERIENCE]: ExperienceSection,
} satisfies Record<Exclude<HomeSectionId, typeof SECTION_IDS.ABOUT>, ComponentType>;

// WebGL 장식은 셸에 한 번만 띄워 Hero와 About이 같은 로고를 나눠 쓴다.
const DynamicElectricLogo = dynamic<ElectricLogoProps & { ref?: Ref<ElectricLogoHandle> }>(() => import('@/components/blocks/ElectricLogo'), { ssr: false });
const LOGO_SRCS = coreValues.map(value => value.logoSrc);

export default function HomeClient() {
  const rootRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const { ready: preferenceReady, reduced: reducedMotion } = useMotionPreference();
  const pageVisible = usePageVisibility();
  const obscured = useProjectModalObscured();
  const aboutRef = useRef<AboutSectionHandle>(null);
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  const logoHostRef = useRef<HTMLDivElement>(null);
  const heroStaticRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const bootRef = useRef<BootSequenceHandle>(null);
  // 그리기 전 판정 스크립트(lib/introGate.ts)가 붙인 표시를 하이드레이션 때 한 번 읽는다. 마크업에는 쓰지 않는다.
  const [introEnabled] = useState(() => typeof document !== 'undefined' && document.documentElement.hasAttribute('data-intro'));
  // 커튼이 덮고 있는 동안은 배경 루프를 돌리지 않는다. 공통 시작에서 연다.
  const [introCovered, setIntroCovered] = useState(introEnabled);
  const uncover = useCallback(() => setIntroCovered(false), []);
  // GL 로고는 인트로가 끝난 뒤에 띄운다. WebGL 문맥 생성이 이 기기에서 메인 스레드를 1.4–2.3초 막아 인사말과 커튼을 멈춰 세웠다.
  const [introPending, setIntroPending] = useState(introEnabled);
  const introDone = useCallback(() => { setIntroCovered(false); setIntroPending(false); }, []);
  const [background, setBackground] = useState<LuminousFlowBackgroundHandle | null>(null);
  const [introTargets, setIntroTargets] = useState<IntroTargets | null>(null);
  // 공유 로고가 선택한 chapter를 따라가도록 셸이 들고 있는다.
  const [aboutChapter, setAboutChapter] = useState(0);
  const [wideScreen, setWideScreen] = useState(false);
  const [motionModule, setMotionModule] = useState<typeof import('./motion') | null>(null);
  const [logo, setLogo] = useState<ElectricLogoHandle | null>(null);
  const [logoOwner, setLogoOwner] = useState<LogoOwner>('none');
  const [logoReady, setLogoReady] = useState(false);
  const motionRef = useRef<PortfolioMotion | null>(null);
  // 명시적 이동 직전에 About의 읽기 잠금을 풀어 목적지로 가는 스크롤을 붙잡지 않는다.
  const { active, routeResolved, navigationTarget, navigate } = useSectionNav({ rootRef, headerRef, blocked: obscured, reducedMotion, onBeforeNavigate: () => { bootRef.current?.finish(); aboutRef.current?.release(); } });
  const motionReady = routeResolved && preferenceReady;
  // About 레일과 같이 1024px부터만 WebGL 로고를 띄운다. 그 아래와 모션 감소는 앵커의 정적 실루엣이다.
  const glLogo = wideScreen && preferenceReady && !reducedMotion && !introPending;
  const logoLive = logoReady && logoOwner !== 'none';
  const activeLabel = HOME_SECTION_CONFIG.find(section => section.id === active)?.label ?? 'Overview';
  const [announcement, setAnnouncement] = useState('');
  // 명시적 이동이 도착해 목적지에 포커스가 간 때만 알린다. 수동으로 읽어 넘긴 섹션은 알리지 않는다.
  useEffect(() => {
    if (navigationTarget) setAnnouncement('');
    else if (document.activeElement === rootRef.current?.querySelector(`[data-section="${active}"]`)) setAnnouncement(`${activeLabel} section`);
  }, [navigationTarget, active, activeLabel]);

  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 1024px)');
    if (!query) return;
    const update = () => setWideScreen(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  // 경계 모듈은 GSAP·ScrollTrigger를 품어 First Load 밖에서 늦게 부른다. 모션 감소는 부르지 않는다.
  useEffect(() => {
    if (!motionReady || reducedMotion) return;
    let alive = true;
    import('./motion').then(module => { if (alive) setMotionModule(module); });
    return () => { alive = false; };
  }, [motionReady, reducedMotion]);
  // 모듈 준비와 GL 손잡이 등록·해제 때만 다시 잇는다. chapter 로고의 onReady는 건드리지 않는다.
  useEffect(() => {
    const root = rootRef.current, header = headerRef.current, wordmark = wordmarkRef.current, logoHost = logoHostRef.current;
    if (!motionModule || reducedMotion || !root || !header || !wordmark || !logoHost) return;
    const motion = motionModule.createPortfolioMotion({ root, header, wordmark, logoHost, logo, onLogoOwnerChange: setLogoOwner });
    motionRef.current = motion;
    return () => { motion.destroy(); motionRef.current = null; setLogoOwner('none'); };
  }, [motionModule, logo, reducedMotion]);
  useEffect(() => { motionRef.current?.setPaused(obscured || !pageVisible); }, [obscured, pageVisible, motionModule, logo, reducedMotion]);
  // 인트로 대상은 경계가 이름을 Hero 자리에 놓은 뒤에 넘긴다. 커튼이 걷힐 때 이름이 nav에서 뛰어내리지 않는다.
  // 오브젝트는 Hero 앵커 안 정적 실루엣의 껍질이다. 경계가 재는 앵커 상자는 건드리지 않는다.
  // 경계 모듈이 오지 않으면 대상도 없고, BootSequence가 제한 시간 뒤 커튼을 걷어 정적 첫 화면을 준다.
  useEffect(() => {
    const wordmark = wordmarkRef.current?.firstElementChild, headline = headlineRef.current, heroObject = heroStaticRef.current;
    if (!introEnabled || !motionModule || !(wordmark instanceof HTMLElement) || !headline || !heroObject) return;
    setIntroTargets({ wordmark, headline, heroObject, background });
  }, [introEnabled, motionModule, background]);
  useEffect(() => { if (!logo) setLogoReady(false); }, [logo]);

  return <SectionActivityProvider pageVisible={pageVisible} routeResolved={routeResolved} motionReady={motionReady} reducedMotion={reducedMotion} obscured={obscured}>
    {/* 준비 전 기본값(reduced: true)으로 인트로를 끝내지 않는다. 그리기 전 판정이 이미 모션 감소를 걸렀다. */}
    <BootSequence ref={bootRef} enabled={introEnabled} reducedMotion={preferenceReady && reducedMotion} targets={introTargets} onRevealStart={uncover} onComplete={introDone} />
    <div className="portfolio-document" data-logo-owner={logoOwner} data-logo-live={logoLive ? '' : undefined}>
      <LuminousFlowBackground ref={setBackground} scrollScene paused={!pageVisible || !motionReady || reducedMotion || obscured || introCovered} />
      <div inert={obscured} data-obscured={obscured ? '' : undefined}>
        <Navigation items={NAV_ITEMS} active={active} onNavigate={navigate} reducedMotion={reducedMotion} headerRef={headerRef} wordmarkRef={wordmarkRef} />
      </div>
      <main ref={rootRef} className="section-stage" inert={obscured}
        data-route-resolved={routeResolved} data-motion-ready={motionReady} data-reduced-motion={reducedMotion}
        data-navigation-target={navigationTarget ?? undefined} data-active-section={active}>
        <section id="overview" data-section="overview" role="region" aria-label="Overview" tabIndex={-1} className="document-section portfolio-hero">
          <div className="hero-copy">
            {/* 이름 버튼은 nav에 하나뿐이다. 여기는 경계가 그 버튼을 옮겨 오는 빈 자리다. */}
            <div data-motion-anchor="hero-name" aria-hidden="true" className="h-11" />
            {/* 네 인사말은 인트로 커튼에서만 보인다. 커튼이 없는 진입(해시·모션 감소·JS 없음)과 보조기기도 한 번은 읽는다. */}
            <p className="sr-only">{INTRO_GREETINGS.join(' ')}</p>
            <h1 ref={headlineRef}>탄탄한 기본기를 바탕으로 꾸준히 개선하고, 협업으로 함께 성장하는 개발자.</h1>
          </div>
          {/* 공유 로고가 앉는 자리. GL이 없거나 준비 전, 모션 감소에서는 정적 실루엣이 대신한다.
              D5-A: 1024px부터 문장 오른쪽, 그 아래는 이름·문장 다음이다. */}
          <div data-motion-anchor="hero-object" aria-hidden="true" className="hero-object">
            {/* 바깥 껍질은 인트로의 opacity·크기, 안쪽은 GL 궤도와 같은 기울기(경계가 정면으로 돌린다)다. */}
            <div ref={heroStaticRef} className={`about-electric-static ${glLogo ? 'about-electric-static-charging' : ''}`}>
              <div className="hero-object-tilt">
                <div className="about-electric-static-shape" style={{ maskImage: `url(${LOGO_SRCS[0]})`, WebkitMaskImage: `url(${LOGO_SRCS[0]})` }} />
              </div>
            </div>
          </div>
        </section>
        {HOME_SECTION_CONFIG.map(({ id, label }) => {
          const Section = id === SECTION_IDS.ABOUT ? null : SECTION_COMPONENTS[id];
          return <div key={id} data-section={id} role="region" aria-label={label} tabIndex={-1} className="document-section">
            {Section ? <Section /> : <AboutSection ref={aboutRef} onChapterChange={setAboutChapter} navigationPending={navigationTarget !== null} />}
          </div>;
        })}
        {/* 공유 로고 host. About의 원형 마스크와 overflow-x: clip 밖, 문서 좌표에 산다.
            바깥은 경계가 옮기고 안쪽은 포인터만 기울인다. */}
        <div ref={logoHostRef} data-logo-host aria-hidden="true" className="logo-host">
          <div>
            {glLogo ? <DynamicElectricLogo ref={setLogo} src={LOGO_SRCS[logoOwner === 'about' ? aboutChapter : 0]} active={logoOwner !== 'none' && motionReady && pageVisible && !obscured}
              preloadSrcs={LOGO_SRCS} onReady={() => setLogoReady(true)} color="#7fe3ee" glowColor="#03b3c3"
              intensity={0.65} glow={0.3} speed={1.1} flicker={0.25} interactive={false} /> : null}
          </div>
        </div>
      </main>
      <div inert={obscured} data-flow-finale=""><Footer /></div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
    </div>
  </SectionActivityProvider>;
}
