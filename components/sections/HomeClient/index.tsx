'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import type { CrystalizedBallHandle } from '@/components/blocks/CrystalizedBall';
import { BALL_ICONS, ICON_SIZE, fieldPoint, iconStyle } from '@/components/blocks/CrystalizedBall/field';
import type { ElectricLogoHandle, ElectricLogoProps } from '@/components/blocks/ElectricLogo';
import LuminousFlowBackground, { type LuminousFlowBackgroundHandle } from '@/components/blocks/LuminousFlowBackground';
import Navigation from '@/components/blocks/Navigation';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { AboutSection, AwardAndCertificateSection, ExperienceSection, Footer, ProjectsSection, SkillsSection } from '@/components/sections';
import type { AboutSectionHandle } from '@/components/sections/AboutSection';
import type { ProjectsSectionHandle } from '@/components/sections/ProjectsSection';
import { createExperienceOverlay, type ExperienceOverlay } from '@/components/sections/ExperienceSection/overlay';
import BootSequence, { type BootSequenceHandle, type IntroTargets } from '@/components/sections/BootSequence';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useProjectModalObscured } from '@/hooks/useProjectModalObscured';
import { useSectionNav } from '@/hooks/useSectionNav';
import { HOME_SECTION_CONFIG, NAV_ITEMS, PERSONAL_INFO, SECTION_IDS, type HomeSectionId } from '@/lib/constants';
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
// Hero 오브젝트는 크리스털 볼이다. GL은 로고와 같이 진입 뒤에 뜨는 지연 청크(OGL 청크를 같이 쓴다)이고,
// 정적 볼(유리 + 아이콘의 쉬는 자리)이 서버 HTML부터 같은 구성을 보인다. 쉬는 자리는 GL 첫 프레임(시간 0, 포인터 없음)과 같다.
const DynamicCrystalizedBall = dynamic(() => import('@/components/blocks/CrystalizedBall'), { ssr: false });
const BALL_REST = BALL_ICONS.map(icon => ({ name: icon.name, ...iconStyle(fieldPoint(icon.home, icon.seed, 0, [0, 0], [0, 0, 0])) }));

export default function HomeClient() {
  const rootRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const { ready: preferenceReady, reduced: reducedMotion } = useMotionPreference();
  const pageVisible = usePageVisibility();
  const obscured = useProjectModalObscured();
  const aboutRef = useRef<AboutSectionHandle>(null);
  const projectsRef = useRef<ProjectsSectionHandle>(null);
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  const logoHostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const heroStaticRef = useRef<HTMLDivElement>(null);
  const ballIconsRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<CrystalizedBallHandle>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const bootRef = useRef<BootSequenceHandle>(null);
  // 그리기 전 판정 스크립트(lib/introGate.ts)가 붙인 표시를 하이드레이션 때 한 번 읽는다. 마크업에는 쓰지 않는다.
  const [introEnabled] = useState(() => typeof document !== 'undefined' && document.documentElement.hasAttribute('data-intro'));
  // GL 로고는 진입이 끝난 뒤에 띄운다. WebGL 문맥 생성이 이 기기에서 메인 스레드를 1.4–2.3초 막아 진입을 멈춰 세웠다.
  const [introPending, setIntroPending] = useState(introEnabled);
  const introDone = useCallback(() => setIntroPending(false), []);
  const [background, setBackground] = useState<LuminousFlowBackgroundHandle | null>(null);
  const [introTargets, setIntroTargets] = useState<IntroTargets | null>(null);
  // 공유 로고가 선택한 chapter를 따라가도록 셸이 들고 있는다.
  const [aboutChapter, setAboutChapter] = useState(0);
  const [wideScreen, setWideScreen] = useState(false);
  const [motionModule, setMotionModule] = useState<typeof import('./motion') | null>(null);
  const [logo, setLogo] = useState<ElectricLogoHandle | null>(null);
  const [logoOwner, setLogoOwner] = useState<LogoOwner>('none');
  // 프리뷰→헤드 경계가 첫 노드에 내려앉았는지. Experience가 첫 헤드와 첫 장을 공개한다.
  const [lineArrived, setLineArrived] = useState(false);
  // 경계 청크를 못 받으면 도착이 오지 않는다. Experience는 기다리지 않고 첫 장부터 읽기 진행으로 공개한다.
  const [motionFailed, setMotionFailed] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  // GL 로고는 쉬는 자리(hero·about)에서만 드러난다. 날아가는 도중에 준비돼도 내려앉은 뒤에 정적 실루엣과 바뀐다.
  const [logoLive, setLogoLive] = useState(false);
  // GL 볼이 첫 그림을 그린 뒤에만 정적 유리가 물러난다.
  const [ballReady, setBallReady] = useState(false);
  // GL 볼도 로고처럼 쉬는 자리에서만 정적 유리와 바뀐다. 접히거나 펼쳐지는 도중에 준비돼도 Hero에 돌아와 쉴 때 바꾼다.
  const [ballLive, setBallLive] = useState(false);
  const ballDone = useCallback(() => setBallReady(true), []);
  const motionRef = useRef<PortfolioMotion | null>(null);
  // 명시적 이동 직전에 About과 Projects의 읽기 잠금을 풀어 목적지로 가는 스크롤을 붙잡지 않는다.
  const { active, routeResolved, navigationTarget, navigate } = useSectionNav({ rootRef, headerRef, blocked: obscured, reducedMotion, onBeforeNavigate: () => { bootRef.current?.finish(); aboutRef.current?.release(); projectsRef.current?.release(); } });
  const motionReady = routeResolved && preferenceReady;
  // 프리뷰로 날아가는 동안의 Projects 입력: About 잠금을 풀고 비행을 끝 자리로 정착시킨 뒤 원래 동작을 한 번 부른다(다시 관문으로 보내지 않는다).
  const beforeProjectsAction = useCallback((run: () => void) => { aboutRef.current?.release(); motionRef.current?.settleProjects(); run(); }, []);
  // About 레일과 같이 1024px부터만 WebGL 로고와 볼을 띄운다. 그 아래와 모션 감소는 앵커의 정적 실루엣과 정적 볼이다.
  const glLogo = wideScreen && preferenceReady && !reducedMotion && !introPending;
  // 쉬는 자리마다 그리는 GL host는 하나다. Hero에서는 볼이 돌고 로고는 한 장만 미리 그린 채 멈춘다.
  // About에서는 로고가 돌고 볼은 접혀 사라진 채 멈춘다. 변신 동안(boundary)만 둘이 함께 그린다.
  // 프리뷰로 가는 동안(preview)은 로고만 돌고, 프리뷰에 넘긴 뒤(projects)에는 숨은 로고도 멈춘다.
  const heroResting = logoOwner === 'hero' || logoOwner === 'none';
  const logoIdle = heroResting || logoOwner === 'projects';
  const ballRuns = heroResting || logoOwner === 'boundary';
  const activeLabel = HOME_SECTION_CONFIG.find(section => section.id === active)?.label ?? 'Overview';
  const [announcement, setAnnouncement] = useState('');
  // 경력 선과 프리뷰 morph를 그리는 오버레이 손잡이. ExperienceSection이 읽기 진행을, motion이 프리뷰→헤드 경계를 넘긴다.
  const [overlay, setOverlay] = useState<ExperienceOverlay | null>(null);
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const overlay = createExperienceOverlay(canvas);
    if (!overlay) return;
    setOverlay(overlay);
    return () => { overlay.destroy(); setOverlay(null); };
  }, []);
  // 모션 감소에서 오버레이는 경계를 재생하지 않고 선과 헤드를 멈춘 채 그린다.
  useEffect(() => { overlay?.setReduced(reducedMotion); }, [overlay, reducedMotion]);
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
  // 경계 모듈은 GSAP·ScrollTrigger를 품어 First Load 밖에서 늦게 부른다. 모션 감소도 같은 지점에서 이름 자리를 바꾸므로 부른다.
  useEffect(() => {
    if (!motionReady) return;
    let alive = true;
    // 청크를 못 받으면 모듈 없이 둔다. 이름·로고·볼은 CSS 쉬는 자리에 남고, 직접 해시의 nav 표시도 걷히지 않는다.
    import('./motion').then(module => { if (alive) setMotionModule(module); }).catch(() => { if (alive) setMotionFailed(true); });
    return () => { alive = false; };
  }, [motionReady]);
  // 모듈 준비와 모션 감소 전환 때만 다시 잇는다. GL 손잡이는 날던 이름·로고를 끊지 않게 따로 넘긴다.
  useEffect(() => {
    const root = rootRef.current, header = headerRef.current, wordmark = wordmarkRef.current, logoHost = logoHostRef.current;
    if (!motionModule || !root || !header || !wordmark || !logoHost) return;
    const motion = motionModule.createPortfolioMotion({ root, header, wordmark, logoHost, ball: ballRef, reduced: reducedMotion, onLogoOwnerChange: setLogoOwner, onLineArrive: setLineArrived });
    motionRef.current = motion;
    return () => { motion.destroy(); motionRef.current = null; setLogoOwner('none'); setLineArrived(false); };
  }, [motionModule, reducedMotion]);
  useEffect(() => { motionRef.current?.setLogo(logo); }, [logo, motionModule, reducedMotion]);
  // 오버레이는 마운트 뒤에 와서 setLogo처럼 따로 넘긴다. 옵션으로 넘기면 오는 순간 경계 전체를 다시 지었다.
  useEffect(() => { motionRef.current?.setOverlay(overlay); }, [overlay, motionModule, reducedMotion]);
  useEffect(() => { motionRef.current?.setPaused(obscured || !pageVisible); }, [obscured, pageVisible, motionModule, reducedMotion]);
  useEffect(() => {
    if (!logoReady || logoOwner === 'none') setLogoLive(false);
    else if (logoOwner !== 'boundary' && logoOwner !== 'preview') setLogoLive(true);
  }, [logoReady, logoOwner]);
  // 진입 대상은 경계가 이름을 Hero 자리에 놓은 뒤에 넘긴다. 숨긴 이름이 nav에서 나타나 뛰어내리지 않는다.
  // 오브젝트는 Hero 앵커 안 정적 실루엣의 껍질이다. 경계가 재는 앵커 상자는 건드리지 않는다.
  // 경계 모듈이 오지 않으면 대상도 없고, BootSequence가 제한 시간 뒤 정적 첫 화면을 준다.
  useEffect(() => {
    const wordmark = wordmarkRef.current?.firstElementChild, headline = headlineRef.current, heroObject = heroStaticRef.current;
    if (!introEnabled || !motionModule || !(wordmark instanceof HTMLElement) || !headline || !heroObject) return;
    setIntroTargets({ wordmark, headline, heroObject });
  }, [introEnabled, motionModule]);
  useEffect(() => { if (!logo) setLogoReady(false); }, [logo]);
  useEffect(() => { if (!glLogo) setBallReady(false); }, [glLogo]);
  useEffect(() => {
    if (!glLogo || !ballReady) setBallLive(false);
    else if (logoOwner === 'hero' || logoOwner === 'none') setBallLive(true);
  }, [glLogo, ballReady, logoOwner]);

  return <SectionActivityProvider pageVisible={pageVisible} routeResolved={routeResolved} motionReady={motionReady} reducedMotion={reducedMotion} obscured={obscured}>
    {/* 준비 전 기본값(reduced: true)으로 진입을 끝내지 않는다. 그리기 전 판정이 이미 모션 감소를 걸렀다.
        배경 손잡이는 대상보다 먼저 넘겨 첫 그림부터 공개값 0이다. */}
    <BootSequence ref={bootRef} enabled={introEnabled} reducedMotion={preferenceReady && reducedMotion} targets={introTargets} background={background} onComplete={introDone} />
    <div className="portfolio-document" data-logo-owner={logoOwner} data-logo-live={logoLive ? '' : undefined}>
      <LuminousFlowBackground ref={setBackground} scrollScene paused={!pageVisible || !motionReady || reducedMotion || obscured} />
      <div inert={obscured} data-obscured={obscured ? '' : undefined}>
        <Navigation items={NAV_ITEMS} active={active} onNavigate={navigate} reducedMotion={reducedMotion} headerRef={headerRef} />
      </div>
      <main ref={rootRef} className="section-stage" inert={obscured}
        data-route-resolved={routeResolved} data-motion-ready={motionReady} data-reduced-motion={reducedMotion}
        data-navigation-target={navigationTarget ?? undefined} data-active-section={active}>
        <section id="overview" data-section="overview" role="region" aria-label="Overview" tabIndex={-1} className="document-section portfolio-hero">
          <div className="hero-copy">
            {/* 이름 버튼은 문서에 하나뿐이다. 서버 HTML부터 이 자리(Hero)에 크게 서고, 경계가 지점을 넘으면 nav 자리로 옮긴다.
                버튼 transform은 경계가, 안쪽 span의 opacity·자세는 인트로가 쓴다. 키보드로 누른 클릭(detail 0)은 smooth 없이 바로 간다. */}
            <div data-motion-anchor="hero-name" className="hero-name">
              <button ref={wordmarkRef} data-testid="wordmark" data-wordmark-mode="hero" aria-label={`${PERSONAL_INFO.NAME_EN}, 개요로 이동`}
                onClick={event => navigate('overview', { focus: true, behavior: reducedMotion || event.detail === 0 ? 'auto' : 'smooth' })}
                className="site-name min-h-11 text-left text-t6 font-bold tracking-widest"><span className="inline-block">{PERSONAL_INFO.NAME_EN}</span></button>
            </div>
            <h1 ref={headlineRef}>{'안녕하세요.\nSW개발자 김태인입니다.'}</h1>
          </div>
          {/* 볼이 앉는 자리이자 로고가 떠나는 자리. 볼은 정면이고 앵커를 꽉 채운다.
              D5-A: 1024px부터 문장 오른쪽, 그 아래는 이름·문장 다음이다. */}
          <div data-motion-anchor="hero-object" aria-hidden="true" className="hero-object">
            {/* 껍질은 인트로의 opacity·크기와 로고와의 교대를 받는다. 아이콘 층은 하나뿐이고 유리(캔버스) 아래에 있다.
                기술 이름은 Skills에 있어 아이콘은 장식이다. */}
            <div ref={heroStaticRef} className="hero-ball" data-ball-live={ballLive ? '' : undefined}>
              <div className="hero-ball-glass" />
              <div ref={ballIconsRef} className="hero-ball-icons">
                {BALL_REST.map(({ name, transform, opacity, zIndex }) => <span key={name} style={{ width: `${ICON_SIZE * 100}%`, transform, opacity, zIndex }}>
                  <span style={{ maskImage: `url(/icons-mono/${name}.svg)`, WebkitMaskImage: `url(/icons-mono/${name}.svg)` }} />
                </span>)}
              </div>
              {glLogo ? <DynamicCrystalizedBall ref={ballRef} icons={ballIconsRef} paused={!ballRuns || !motionReady || !pageVisible || obscured} onReady={ballDone} /> : null}
            </div>
          </div>
        </section>
        {HOME_SECTION_CONFIG.map(({ id, label }) => {
          const Section = id === SECTION_IDS.ABOUT || id === SECTION_IDS.PROJECTS || id === SECTION_IDS.EXPERIENCE ? null : SECTION_COMPONENTS[id];
          return <div key={id} data-section={id} role="region" aria-label={label} tabIndex={-1} className="document-section">
            {id === SECTION_IDS.EXPERIENCE ? <ExperienceSection lineArrived={motionFailed || lineArrived} overlay={overlay} /> : id === SECTION_IDS.PROJECTS ? <ProjectsSection ref={projectsRef} beforeAction={beforeProjectsAction} navigationPending={navigationTarget !== null} logoOwner={logoOwner} /> : Section ? <Section /> : <AboutSection ref={aboutRef} onChapterChange={setAboutChapter} navigationPending={navigationTarget !== null} logoOwner={logoOwner} />}
          </div>;
        })}
        {/* 공유 로고 host. About의 원형 마스크와 overflow-x: clip 밖, 문서 좌표에 산다.
            바깥은 경계가 옮기고, 안쪽 불투명도는 변신 진행도(Hero에서 0)다. */}
        <div ref={logoHostRef} data-logo-host aria-hidden="true" className="logo-host">
          <div>
            {/* Hero에서 쉬는 동안 host는 숨어 돌지 않는다. 한 장만 미리 그려 준비를 알리고 변신이 시작되면 돈다.
                About을 떠나 프리뷰로 가고 돌아오는 동안은 chapter 로고 그대로다. 되돌아올 때 About에서 보던 로고로 접힌다. */}
            {glLogo ? <DynamicElectricLogo ref={setLogo} src={LOGO_SRCS[heroResting || logoOwner === 'boundary' ? 0 : aboutChapter]} active={!logoIdle && motionReady && pageVisible && !obscured}
              prewarm preloadSrcs={LOGO_SRCS} onReady={() => setLogoReady(true)} color="#7fe3ee" glowColor="#03b3c3"
              intensity={0.65} glow={0.3} speed={1.1} flicker={0.25} interactive={false} /> : null}
          </div>
        </div>
        {/* 페이지 전용 오버레이 캔버스. 경력 선·헤드와 프리뷰→헤드 morph를 그린다. 화면 좌표에 고정되고 누르거나 읽을 것이 아니다. */}
        <canvas ref={overlayRef} data-motion-overlay aria-hidden="true" className="motion-overlay" />
      </main>
      <div inert={obscured} data-flow-finale=""><Footer /></div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
    </div>
  </SectionActivityProvider>;
}
