import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { firePointer } from '@/__tests__/helpers/pointerEvents';
import HomeClient from '@/components/sections/HomeClient';
import {
  HOME_SECTION_CONFIG,
  type HomeSectionId,
} from '@/lib/constants';

const motionSpies = vi.hoisted(() => ({
  dynamicLoader: vi.fn(),
  gsapTimeline: vi.fn(),
}));

// HyperspeedBackground는 Task 5의 산출물이다. 실제 WebGL 씬은 여기서
// 검증하지 않는다(components/blocks/HyperspeedBackground.tsx 자체 테스트가
// 맡는다) — 여기서는 HomeClient가 단일 useSectionNav·usePageVisibility·
// useMotionPreference에서 파생한 값을 그대로 넘기는지, 그리고 재마운트하지
// 않는지만 probe로 관측한다.
const hyperspeedBackgroundSpies = vi.hoisted(() => ({
  mountCount: 0,
}));

vi.mock('@/components/blocks/HyperspeedBackground', async () => {
  const { useEffect } = await import('react');
  return {
    default: function HyperspeedBackgroundProbe(props: {
      active: string;
      isTransitioning: boolean;
      obscured: boolean;
      pageVisible: boolean;
      routeResolved: boolean;
      motionReady: boolean;
      reducedMotion: boolean;
    }) {
      useEffect(() => {
        hyperspeedBackgroundSpies.mountCount += 1;
      }, []);
      return (
        <div
          data-testid="hyperspeed-background-probe"
          data-active={props.active}
          data-is-transitioning={props.isTransitioning}
          data-obscured={props.obscured}
          data-page-visible={props.pageVisible}
          data-route-resolved={props.routeResolved}
          data-motion-ready={props.motionReady}
          data-reduced-motion={props.reducedMotion}
        />
      );
    },
  };
});

vi.mock('@/components/sections', async () => {
  const { useEffect, useRef } = await import('react');
  const { default: ProjectsSection } = await import(
    '@/components/sections/ProjectsSection'
  );
  const { default: WhenVisible } = await import(
    '@/components/common/WhenVisible'
  );

  interface MotionStateEffectsProps {
    label: string;
    paused: boolean;
    shouldEnter: boolean;
    shouldLoad: boolean;
  }

  function MotionStateEffects({
    label,
    paused,
    shouldEnter,
    shouldLoad,
  }: MotionStateEffectsProps) {
    const previewRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      if (shouldLoad) motionSpies.dynamicLoader(label);
    }, [label, shouldLoad]);

    useEffect(() => {
      if (shouldEnter) motionSpies.gsapTimeline(label);
    }, [label, shouldEnter]);

    useEffect(() => {
      if (paused) return;
      requestAnimationFrame(() => {});
      if (label === 'preview') void previewRef.current?.play();
    }, [label, paused]);

    return (
      <div
        data-testid={`motion-${label}`}
        data-paused={paused}
        data-should-enter={shouldEnter}
        data-should-load={shouldLoad}
      >
        {label === 'preview' ? <video ref={previewRef} /> : null}
      </div>
    );
  }

  function MotionProbe({
    label,
    section,
  }: {
    label: string;
    section: 'overview' | HomeSectionId;
  }) {
    return (
      <WhenVisible section={section}>
        {(state) => <MotionStateEffects label={label} {...state} />}
      </WhenVisible>
    );
  }

  function SectionShell({
    label,
    marker,
  }: {
    label: string;
    marker: string;
  }) {
    return (
      <section>
        <h2>{label}</h2>
        <p>{marker}</p>
        <button>{label} content action</button>
      </section>
    );
  }

  return {
    AboutSection: () => (
      <>
        <SectionShell label="About" marker="91%" />
        <MotionProbe label="about-decoration-one" section="about" />
        <MotionProbe label="about-decoration-two" section="about" />
      </>
    ),
    AwardAndCertificateSection: () => (
      <SectionShell label="Awards" marker="Grand Prize" />
    ),
    ContactSection: () => (
      <SectionShell label="Contact" marker="Say hello" />
    ),
    ExperienceSection: () => (
      <SectionShell label="Experience" marker="Frontend Experience" />
    ),
    Footer: () => <a href="mailto:test@example.com">Contact footer</a>,
    // 실제 BootSequence는 wordmarkRef 등 여러 prop을 받지만, 이 mock의
    // 관심사는 HomeClient가 단일 matchMedia listener로 motion 소비자
    // 여럿(WhenVisible 3개)을 함께 정지·재개시키는지이지 BootSequence 자체
    // 구현이 아니다(그건 BootSequence.test.tsx·WordmarkFlip.test.tsx가 실제
    // 컴포넌트로 직접 검증한다). 대부분의 props는 무시해도 안전하다.
    // transitionAttributes(최종 리뷰 I1)만은 예외다. HomeClient가
    // transitionAttributes(OVERVIEW) 호출 결과를 이 컴포넌트에도 그대로
    // 내려보내는지가 여기서 볼 계약이므로 루트에 그대로 편다.
    BootSequence: (props: { transitionAttributes?: Record<string, string> }) => (
      <section data-testid="boot-sequence-probe" {...props.transitionAttributes}>
        <h1>Overview profile</h1>
        <button>Overview content action</button>
        <MotionProbe label="boot-sequence" section="overview" />
        <MotionProbe label="hyperspeed" section="overview" />
        <MotionProbe label="preview" section="overview" />
      </section>
    ),
    ProjectsSection,
    SkillsSection: () => (
      <SectionShell label="Skills" marker="TypeScript" />
    ),
  };
});

interface MockMediaController {
  fire: (matches: boolean) => void;
  listenerCount: () => number;
}

const homeClientPath = path.resolve(
  process.cwd(),
  'components/sections/HomeClient/index.tsx'
);

let transitionProperty = 'opacity';
let transitionDuration = '400ms';
let transitionDelay = '0ms';

function installMatchMedia(reduced: boolean): MockMediaController {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const reducedQuery = {
    matches: reduced,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn(
      (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.add(listener);
      }
    ),
    removeEventListener: vi.fn(
      (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.delete(listener);
      }
    ),
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      if (query === reducedQuery.media) return reducedQuery;
      return {
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    })
  );

  return {
    fire(matches: boolean) {
      reducedQuery.matches = matches;
      listeners.forEach((listener) =>
        listener({ matches } as MediaQueryListEvent)
      );
    },
    listenerCount: () => listeners.size,
  };
}

function fireOpacityTransition(
  target: Element,
  type: 'transitionrun' | 'transitionend' | 'transitioncancel'
) {
  const event = new window.Event(type, {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'propertyName', {
    configurable: true,
    enumerable: true,
    value: 'opacity',
  });
  fireEvent(target, event);
}

function getSection(container: HTMLElement, id: string) {
  const section = container.querySelector<HTMLElement>(
    `[data-section="${id}"]`
  );
  expect(section, `${id} 섹션이 DOM에 없다`).not.toBeNull();
  return section!;
}

function navigateTo(label: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: label }));
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  transitionProperty = 'opacity';
  transitionDuration = '400ms';
  transitionDelay = '0ms';
  motionSpies.dynamicLoader.mockReset();
  motionSpies.gsapTimeline.mockReset();
  hyperspeedBackgroundSpies.mountCount = 0;

  installMatchMedia(false);
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      takeRecords: vi.fn(() => []),
      unobserve: vi.fn(),
    }))
  );
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

  const getComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = getComputedStyle(element);
    if (!(element instanceof HTMLElement) || !element.hasAttribute('data-section')) {
      return style;
    }

    return new Proxy(style, {
      get(target, property, receiver) {
        if (property === 'transitionProperty') return transitionProperty;
        if (property === 'transitionDuration') return transitionDuration;
        if (property === 'transitionDelay') return transitionDelay;
        return Reflect.get(target, property, receiver);
      },
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HomeClient SSR 셸 구조', () => {
  it('서버 HTML에 overview와 다섯 섹션 래퍼를 항목별로 모두 렌더한다', () => {
    const html = renderToString(<HomeClient />);

    expect(html).toContain('data-section="overview"');
    for (const { id } of HOME_SECTION_CONFIG) {
      expect(html, `${id} 래퍼가 서버 HTML에 없다`).toContain(
        `data-section="${id}"`
      );
    }
    expect(html.match(/data-section=/g)).toHaveLength(
      HOME_SECTION_CONFIG.length + 1
    );
  });

  it('Navigation과 단일 워드마크가 최초 서버 HTML부터 상주한다', () => {
    const html = renderToString(<HomeClient />);

    expect(html).toContain('aria-label="메인 네비게이션"');
    expect(html.match(/data-testid="wordmark"/g)).toHaveLength(1);
  });

  it('최초 route 해석 전에는 모든 motion 소비자를 fail-closed로 둔다', () => {
    const html = renderToString(<HomeClient />);

    expect(html).toContain('data-route-resolved="false"');
    expect(html).toContain('data-motion-ready="false"');
    expect(html.match(/data-paused="true"/g)).toHaveLength(5);
    expect(html.match(/data-should-enter="false"/g)).toHaveLength(5);
    expect(html.match(/data-should-load="false"/g)).toHaveLength(5);
    expect(motionSpies.dynamicLoader).not.toHaveBeenCalled();
    expect(motionSpies.gsapTimeline).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('모든 의미 section shell을 정적 import하고 timeout 완료 경로를 만들지 않는다', () => {
    const source = readFileSync(homeClientPath, 'utf8');
    const sourceFile = ts.createSourceFile(
      homeClientPath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const staticSectionImports = new Set<string>();
    const dynamicImports: string[] = [];
    const timeoutCalls: number[] = [];
    let importsNextDynamic = false;

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier;
      if (!ts.isStringLiteral(specifier)) continue;
      if (specifier.text === 'next/dynamic') importsNextDynamic = true;
      if (specifier.text !== '@/components/sections') continue;

      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const element of bindings.elements) {
        staticSectionImports.add(element.name.text);
      }
    }

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const [specifier] = node.arguments;
          dynamicImports.push(
            specifier && ts.isStringLiteral(specifier)
              ? specifier.text
              : '<non-literal>'
          );
        }
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'setTimeout'
        ) {
          timeoutCalls.push(sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    expect([...staticSectionImports].sort()).toEqual(
      [
        'AboutSection',
        'AwardAndCertificateSection',
        'BootSequence',
        'ContactSection',
        'ExperienceSection',
        'Footer',
        'ProjectsSection',
        'SkillsSection',
      ].sort()
    );
    expect(importsNextDynamic).toBe(false);
    // GSAP은 First Load JS 예산 때문에 동적 경계로 뺐다(gsap-lazy-brief.md).
    // HomeClient가 만드는 동적 import는 정확히 이 하나뿐이어야 한다 — 다른
    // 지연 로딩이 몰래 추가되지 않았는지도 함께 고정한다.
    expect(dynamicImports).toEqual(['@/lib/gsap']);
    expect(timeoutCalls).toEqual([]);
  });
});

// render(<HomeClient />)는 전 섹션을 한 번에 마운트한다. About이 계획 4에서
// dynamic 장식을 붙이기 시작하면서 이 렌더가 무거워졌고, 39개 파일을 병렬로
// 돌리는 전체 스위트에서 기본 5초를 넘겨 여덟 번에 한 번꼴로 붉었다. 수행
// 시간이 아니라 CPU 경합에 따른 대기가 원인이라 같은 파일의
// HyperspeedBackground 배선 describe와 같은 방식으로 여유를 준다.
describe('HomeClient section 상태', { timeout: 30_000 }, () => {
  it('projects가 활성일 때만 stage에 가로 스크롤 클래스를 붙인다', () => {
    const { container } = render(<HomeClient />);
    const stage = container.querySelector<HTMLElement>('.section-stage');

    expect(stage).not.toBeNull();
    expect(stage).not.toHaveClass('section-stage-horizontal');

    navigateTo(/projects/i);
    expect(stage).toHaveClass('section-stage-horizontal');

    navigateTo(/about/i);
    expect(stage).not.toHaveClass('section-stage-horizontal');
  });

  it('초기 활성과 비활성 섹션의 visible·hidden·inert 상태가 배타적이다', () => {
    const { container } = render(<HomeClient />);
    const overview = getSection(container, 'overview');

    expect(overview).toHaveClass('section-scroll', 'section-visible');
    expect(overview).not.toHaveAttribute('inert');
    expect(overview).toHaveAttribute('aria-hidden', 'false');

    for (const { id } of HOME_SECTION_CONFIG) {
      const section = getSection(container, id);
      expect(section, id).toHaveClass('section-scroll', 'section-hidden');
      expect(section, id).toHaveAttribute('inert');
      expect(section, id).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('이동하면 이전 섹션은 inert가 되고 목적지만 inert에서 빠진다', () => {
    const { container } = render(<HomeClient />);
    navigateTo(/about/i);

    const overview = getSection(container, 'overview');
    const about = getSection(container, 'about');
    expect(overview).toHaveClass('section-hidden');
    expect(overview).toHaveAttribute('inert');
    expect(about).toHaveClass('section-visible');
    expect(about).not.toHaveAttribute('inert');

    for (const { id } of HOME_SECTION_CONFIG) {
      if (id === 'about') continue;
      expect(getSection(container, id), id).toHaveAttribute('inert');
    }
  });

  it('비활성 섹션의 모든 Tab 후보는 inert 경계 안에 격리된다', () => {
    const { container } = render(<HomeClient />);

    const inactiveCandidates = container.querySelectorAll<HTMLElement>(
      '.section-hidden a, .section-hidden button, .section-hidden input, .section-hidden textarea, .section-hidden select, .section-hidden [tabindex]'
    );

    expect(inactiveCandidates.length).toBeGreaterThan(0);
    for (const candidate of inactiveCandidates) {
      const inertBoundary = candidate.closest('[inert]');

      expect(inertBoundary, '비활성 Tab 후보가 inert 밖에 있다').not.toBeNull();
      expect(inertBoundary).toHaveClass('section-hidden');
    }
  });

  it('왼쪽 touch 스와이프가 같은 상태머신의 다음 섹션으로 이동한다', () => {
    const { container } = render(<HomeClient />);
    const stage = container.querySelector<HTMLElement>('.section-stage');
    expect(stage).not.toBeNull();

    firePointer(stage!, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 240,
      clientY: 200,
    });
    firePointer(stage!, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 160,
      clientY: 205,
    });

    expect(getSection(container, 'about')).toHaveClass('section-visible');
  });

  it('Projects 가로 트랙에서 시작한 양방향 스와이프는 섹션을 이동하지 않는다', () => {
    window.history.replaceState(null, '', '/#projects');
    const { container } = render(<HomeClient />);
    const stage = container.querySelector<HTMLElement>('.section-stage');
    const projectsSection = getSection(container, 'projects');
    const track = projectsSection.querySelector<HTMLElement>('.overflow-x-auto');
    const card = track?.querySelector<HTMLElement>('.cursor-pointer');

    expect(stage).not.toBeNull();
    expect(projectsSection).toHaveClass('section-visible');
    expect(track).not.toBeNull();
    expect(card).not.toBeNull();

    firePointer(card!, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 240,
      clientY: 200,
    });
    firePointer(stage!, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 160,
      clientY: 205,
    });
    expect(projectsSection).toHaveClass('section-visible');

    firePointer(card!, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 160,
      clientY: 200,
    });
    firePointer(stage!, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 240,
      clientY: 205,
    });
    expect(projectsSection).toHaveClass('section-visible');
  });

  it('섹션 DOM과 내부 scrollTop을 떠남·재방문 뒤에도 보존한다', () => {
    const { container } = render(<HomeClient />);
    const about = getSection(container, 'about');
    about.scrollTop = 240;

    navigateTo(/about/i);
    fireOpacityTransition(about, 'transitionrun');
    fireOpacityTransition(about, 'transitionend');

    navigateTo(/projects/i);
    const projects = getSection(container, 'projects');
    fireOpacityTransition(projects, 'transitionrun');
    fireOpacityTransition(projects, 'transitionend');

    navigateTo(/about/i);
    fireOpacityTransition(about, 'transitionrun');
    fireOpacityTransition(about, 'transitionend');

    expect(getSection(container, 'about')).toBe(about);
    expect(about.scrollTop).toBe(240);
  });
});

describe('HomeClient opacity 전환 생명주기', () => {
  it('transitionrun 없는 end는 무시하고 run 뒤 end에서만 완료한다', () => {
    const { container } = render(<HomeClient />);
    navigateTo(/about/i);
    const about = getSection(container, 'about');
    const status = screen.getByRole('status');

    expect(status).toBeEmptyDOMElement();
    fireOpacityTransition(about, 'transitionend');
    expect(status).toBeEmptyDOMElement();
    expect(about).not.toHaveFocus();

    fireOpacityTransition(about, 'transitionrun');
    expect(status).toBeEmptyDOMElement();
    fireOpacityTransition(about, 'transitionend');

    expect(status).toHaveTextContent('About section');
    expect(about).toHaveFocus();
  });

  it('현재 목적지의 transitioncancel도 전환을 완료한다', () => {
    const { container } = render(<HomeClient />);
    navigateTo(/about/i);
    const about = getSection(container, 'about');

    fireOpacityTransition(about, 'transitionrun');
    fireOpacityTransition(about, 'transitioncancel');

    expect(screen.getByRole('status')).toHaveTextContent('About section');
    expect(about).toHaveFocus();
  });

  it('연속 이동 중 과거 목적지 이벤트는 마지막 전환을 닫지 않는다', () => {
    const { container } = render(<HomeClient />);
    navigateTo(/about/i);
    const about = getSection(container, 'about');
    fireOpacityTransition(about, 'transitionrun');

    navigateTo(/projects/i);
    const projects = getSection(container, 'projects');
    fireOpacityTransition(projects, 'transitionrun');
    fireOpacityTransition(about, 'transitionend');

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(projects).not.toHaveFocus();

    fireOpacityTransition(projects, 'transitionend');
    expect(screen.getByRole('status')).toHaveTextContent('Projects section');
    expect(projects).toHaveFocus();
  });

  it('계산된 opacity duration과 delay 합이 0이면 이벤트 없이 즉시 완료한다', () => {
    transitionDuration = '0s';
    transitionDelay = '0ms';
    const { container } = render(<HomeClient />);

    navigateTo(/about/i);
    const about = getSection(container, 'about');

    expect(screen.getByRole('status')).toHaveTextContent('About section');
    expect(about).toHaveFocus();
  });

  it('opacity가 아닌 전환 이벤트는 완료 신호로 취급하지 않는다', () => {
    const { container } = render(<HomeClient />);
    navigateTo(/about/i);
    const about = getSection(container, 'about');
    const event = new Event('transitionrun', { bubbles: true });
    Object.defineProperty(event, 'propertyName', { value: 'transform' });
    fireEvent(about, event);
    const end = new Event('transitionend', { bubbles: true });
    Object.defineProperty(end, 'propertyName', { value: 'transform' });
    fireEvent(about, end);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(about).not.toHaveFocus();
  });

  it('완료 포커스는 preventScroll 옵션으로 목적지 region에만 이동한다', () => {
    const originalFocus = HTMLElement.prototype.focus;
    const focus = vi
      .spyOn(HTMLElement.prototype, 'focus')
      .mockImplementation(function (
        this: HTMLElement,
        options?: FocusOptions
      ) {
        originalFocus.call(this, options);
      });
    const { container } = render(<HomeClient />);
    focus.mockClear();
    navigateTo(/about/i);
    const about = getSection(container, 'about');

    fireOpacityTransition(about, 'transitionrun');
    fireOpacityTransition(about, 'transitionend');

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(about).toHaveFocus();
  });
});

describe('HomeClient motion 구독 통합', () => {
  it('최초 reduced-motion이면 여러 소비자도 listener 하나로 모두 정지한다', () => {
    const media = installMatchMedia(true);
    const addDocumentListener = vi.spyOn(document, 'addEventListener');
    render(<HomeClient />);

    expect(media.listenerCount()).toBe(1);
    expect(
      addDocumentListener.mock.calls.filter(
        ([type]) => type === 'visibilitychange'
      )
    ).toHaveLength(1);
    expect(screen.getAllByTestId(/^motion-/)).toHaveLength(5);
    for (const consumer of screen.getAllByTestId(/^motion-/)) {
      expect(consumer).toHaveAttribute('data-paused', 'true');
      expect(consumer).toHaveAttribute('data-should-enter', 'false');
      expect(consumer).toHaveAttribute('data-should-load', 'false');
    }
    expect(motionSpies.dynamicLoader).not.toHaveBeenCalled();
    expect(motionSpies.gsapTimeline).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('설정이 false에서 true로 바뀌면 같은 listener가 모든 소비자를 멈춘다', async () => {
    const media = installMatchMedia(false);
    render(<HomeClient />);

    await waitFor(() => {
      expect(motionSpies.dynamicLoader).toHaveBeenCalled();
      expect(motionSpies.gsapTimeline).toHaveBeenCalled();
      expect(requestAnimationFrame).toHaveBeenCalled();
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });
    const callsBeforeReduction = {
      loader: motionSpies.dynamicLoader.mock.calls.length,
      timeline: motionSpies.gsapTimeline.mock.calls.length,
      frame: vi.mocked(requestAnimationFrame).mock.calls.length,
      play: vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length,
    };

    act(() => media.fire(true));

    expect(media.listenerCount()).toBe(1);
    for (const consumer of screen.getAllByTestId(/^motion-/)) {
      expect(consumer).toHaveAttribute('data-paused', 'true');
    }
    expect(motionSpies.dynamicLoader).toHaveBeenCalledTimes(
      callsBeforeReduction.loader
    );
    expect(motionSpies.gsapTimeline).toHaveBeenCalledTimes(
      callsBeforeReduction.timeline
    );
    expect(requestAnimationFrame).toHaveBeenCalledTimes(
      callsBeforeReduction.frame
    );
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(
      callsBeforeReduction.play
    );
  });
});

// 이 블록의 ProjectModal 테스트는 gsap 동적 import와 ProjectModal 청크 로드가
// 겹쳐 단독으로도 ~1.7초가 걸린다. 전체 스위트 부하에서는 기본 5초를 넘겼다.
describe('HomeClient → HyperspeedBackground 배선', { timeout: 30_000 }, () => {
  it('단일 useSectionNav·usePageVisibility·useMotionPreference의 값이 일곱 prop으로 그대로 전달된다', () => {
    render(<HomeClient />);
    const probe = screen.getByTestId('hyperspeed-background-probe');

    expect(probe).toHaveAttribute('data-active', 'overview');
    expect(probe).toHaveAttribute('data-is-transitioning', 'false');
    expect(probe).toHaveAttribute('data-obscured', 'false');
    expect(probe).toHaveAttribute('data-page-visible', 'true');
    expect(probe).toHaveAttribute('data-route-resolved', 'true');
    expect(probe).toHaveAttribute('data-motion-ready', 'true');
    expect(probe).toHaveAttribute('data-reduced-motion', 'false');

    navigateTo(/about/i);
    expect(probe).toHaveAttribute('data-active', 'about');
    expect(probe).toHaveAttribute('data-is-transitioning', 'true');
  });

  it('pageVisible과 routeResolved는 서로 다른 값으로 각각 정확한 prop에 꽂힌다', () => {
    // 마운트 직후엔 둘 다 true라 자리가 뒤바뀌어도 겉보기 결과가 같다 —
    // 실제로 self-mutation(HomeClient에서 pageVisible↔routeResolved를
    // swap)을 주입했더니 위 테스트가 통과해버려서 찾은 구멍이다. 문서에서
    // visibilitychange만 쏴서 pageVisible을 false로 갈라놓아야 routeResolved
    // (계속 true)와 실제로 구별된다.
    render(<HomeClient />);
    const probe = screen.getByTestId('hyperspeed-background-probe');
    expect(probe).toHaveAttribute('data-page-visible', 'true');
    expect(probe).toHaveAttribute('data-route-resolved', 'true');

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(probe).toHaveAttribute('data-page-visible', 'false');
    expect(probe).toHaveAttribute('data-route-resolved', 'true');
  });

  it('ProjectModal이 열리면 obscured가 true, 닫히면 다시 false다', async () => {
    window.history.replaceState(null, '', '/#projects');
    const { container } = render(<HomeClient />);
    const probe = screen.getByTestId('hyperspeed-background-probe');
    expect(probe).toHaveAttribute('data-obscured', 'false');

    const projectsSection = getSection(container, 'projects');
    const track = projectsSection.querySelector<HTMLElement>('.overflow-x-auto');
    const card = track?.querySelector<HTMLElement>('.cursor-pointer');
    expect(card).not.toBeNull();
    // jsdom엔 Element.scrollTo가 없다. 첫 클릭이 featured로 만들며 예약하는
    // scrollToCenter의 setTimeout(30ms) 콜백이 이걸 부르므로 스텁해 둔다 —
    // 이 테스트의 관심사는 모달 열림→obscured 전파고 스크롤 자체가 아니다.
    track!.scrollTo = vi.fn();

    // 첫 클릭은 featured로만 만들고, 같은 카드를 다시 클릭해야 모달이 열린다
    // (components/sections/ProjectsSection/index.tsx의 handleCardClick).
    fireEvent.click(card!);
    fireEvent.click(card!);
    expect(probe).toHaveAttribute('data-obscured', 'true');

    // 되돌아오는 방향까지 확인한다. 이 어서션이 없으면 obscured를 한 번
    // true로 만들고 영원히 두는 구현도 통과한다 — 모달을 닫은 뒤 배경이
    // 어두운 채로 남는 것이 정확히 그 결함이다.
    // ProjectModal은 next/dynamic이라 클릭 직후에는 아직 DOM에 없다. 이 파일은
    // '@/lib/gsap'을 mock하지 않으므로 HomeClient의 마운트 effect가 실제
    // gsap 패키지를 처음으로 동적 import하면서 겪는 실 transform·평가 비용이
    // ProjectModal 자체의 청크 로드와 겹쳐 기본 1000ms 예산을 종종 넘는다
    // (실측: 최대 ~1.7초) — 로직 문제가 아니라 타이밍 여유를 넉넉히 준다.
    fireEvent.click(
      await screen.findByRole('button', { name: '닫기' }, { timeout: 5000 })
    );
    expect(probe).toHaveAttribute('data-obscured', 'false');
  });

  it('섹션을 연속 전환해도 HyperspeedBackground는 재마운트되지 않는다', () => {
    render(<HomeClient />);
    expect(hyperspeedBackgroundSpies.mountCount).toBe(1);

    navigateTo(/about/i);
    navigateTo(/projects/i);
    navigateTo(/skills/i);

    expect(hyperspeedBackgroundSpies.mountCount).toBe(1);
  });
});

describe('HomeClient Footer — 표제 계약', () => {
  // "Footer가 더 이상 문서 흐름에서 섹션 뒤로 비치지 않는다"의 구조적 절반이다.
  // 나머지 절반(Footer 자체가 position:fixed인지)은 Footer.test.tsx가 격리된
  // 컴포넌트로 고정한다 — 여기서는 이 mock으로도 관측 가능한 두 가지만 본다:
  // (1) Footer가 .section-stage 안으로 흡수되지 않았는가(=CONTACT의 위장
  // 일곱 번째 섹션이 되지 않았는가), (2) active와 무관하게 항상 렌더되는가.
  it('Footer는 .section-stage의 자손이 아니며 active가 바뀌어도 항상 렌더된다', () => {
    const { container } = render(<HomeClient />);
    const stage = container.querySelector('.section-stage');

    expect(stage).not.toBeNull();
    const footerLink = screen.getByText('Contact footer');
    // main(.section-stage) 밖 형제여야 한다 — main 안으로 들어가면 다른
    // 비활성 섹션과 함께 inert·hidden 처리되어 "항상 보인다"는 계약이
    // 구조적으로 깨진다.
    expect(stage!.contains(footerLink)).toBe(false);

    navigateTo(/^about$/i);
    expect(screen.getByText('Contact footer')).toBeInTheDocument();

    navigateTo(/^contact$/i);
    // overview에서만 렌더하도록 되돌리면(뮤테이션 g) 이 시점엔 이미 overview를
    // 벗어났으므로 이 어서션이 FAIL해야 한다.
    expect(screen.getByText('Contact footer')).toBeInTheDocument();
  });
});

describe('HomeClient CONTACT 섹션 등록', () => {
  it('CONTACT가 다른 다섯 섹션과 같은 경로(nav·해시·data-section)로 등록된다', () => {
    // 리터럴 'contact'를 직접 어서션한다 — HOME_SECTION_CONFIG를 순회하는
    // 검사는 CONTACT가 배열에서 통째로 빠져도(뮤테이션 b) 순회 범위 자체가
    // 줄어들 뿐이라 못 잡는다. 존재를 하드코딩해야 그 구멍이 막힌다.
    const { container } = render(<HomeClient />);

    expect(
      screen.getByRole('button', { name: /^contact$/i })
    ).toBeInTheDocument();

    navigateTo(/^contact$/i);

    expect(window.location.hash).toBe('#contact');
    const contact = getSection(container, 'contact');
    expect(contact).toHaveClass('section-visible');
    expect(contact).toHaveTextContent('Say hello');
  });
});

// START(그리고 순방향 네비·스와이프)를 누르면 다음 섹션이
// .section-hidden(content-visibility: auto)에서 .section-visible로 한 번에
// 바뀌며 건너뛰던 서브트리의 레이아웃·페인트가 전환 프레임에 몰렸다.
// HomeClient는 지금 active의 "다음" 섹션 하나에만 미리 content-visibility를
// 올려(.section-prewarm) 그 비용을 전환 전에 끝낸다. jsdom은
// content-visibility를 실제로 계산하지 않으므로 여기서는 "어떤 섹션에 어떤
// 클래스가 붙는가"라는 구조만 고정한다. 실제 프레임 비용 절감 여부는
// 실기기 몫이다.
describe('HomeClient 다음 섹션 예열(전환 끊김 완화)', () => {
  it('overview에서는 about 하나만 예열되고 나머지는 예열되지 않는다, 뮤테이션 (a)·(c)', () => {
    const { container } = render(<HomeClient />);
    const about = getSection(container, 'about');

    // 뮤테이션 (a): 예열 자체를 지우면 about에 section-prewarm이 붙지
    // 않아 FAIL한다.
    expect(about).toHaveClass('section-scroll', 'section-hidden', 'section-prewarm');
    expect(about).not.toHaveClass('section-visible');

    // 뮤테이션 (c): 비활성 섹션 전부를 예열하도록 게이트를 지우면 아래
    // 나머지 다섯 곳 중 하나 이상이 section-prewarm을 갖게 되어 FAIL한다.
    for (const { id } of HOME_SECTION_CONFIG) {
      if (id === 'about') continue;
      expect(getSection(container, id), id).not.toHaveClass('section-prewarm');
    }
  });

  it('예열된 섹션도 여전히 보이지 않는다, inert·aria-hidden 유지, 뮤테이션 (b)', () => {
    const { container } = render(<HomeClient />);
    const about = getSection(container, 'about');

    // 뮤테이션 (b): 예열된 섹션의 inert·aria-hidden을 벗기면(opacity나
    // pointer-events를 함께 열어주는 구현으로 바뀌면) 아래 둘 중 하나가
    // FAIL한다. content-visibility만 올라갈 뿐 여전히 비활성 섹션이다.
    expect(about).toHaveAttribute('inert');
    expect(about).toHaveAttribute('aria-hidden', 'true');
  });

  it('이동하면 예열 대상이 다음 섹션으로 옮겨간다, 순방향 네비 클릭도 자연히 덮인다', () => {
    const { container } = render(<HomeClient />);
    navigateTo(/about/i);

    const about = getSection(container, 'about');
    const projects = getSection(container, 'projects');

    // 활성 섹션 자신은 이미 진짜 section-visible이므로 예열 클래스가 필요
    // 없다.
    expect(about).toHaveClass('section-visible');
    expect(about).not.toHaveClass('section-prewarm');

    // 전환이 끝난 뒤에야 다음 대상이 옮겨온다. 아래 "전환 중에는 예열하지
    // 않는다" 테스트가 그 이유를 지킨다. transitionend는 transitionrun으로
    // 등록된 전환에만 반응하므로(handleSectionTransitionDone) 둘을 짝지어
    // 보낸다.
    fireOpacityTransition(about, 'transitionrun');
    fireOpacityTransition(about, 'transitionend');
    // HOME_SECTION_CONFIG 순서상 about 다음은 projects다.
    expect(projects).toHaveClass('section-prewarm');
  });

  // 이 예열의 핵심 계약이다. prewarmId가 active만 보고 파생되면 overview에서
  // about으로 넘어가는 그 커밋에서 about이 싸게 올라가는 대신 projects가
  // hidden에서 prewarm으로 바뀐다. content-visibility가 그 프레임에 다시
  // 올라가므로 지키려던 바로 그 프레임에 새 서브트리의 첫 렌더가 들어앉고,
  // 끊김이 사라지는 게 아니라 옆 섹션으로 옮겨간다.
  it('전환이 진행되는 동안에는 다음 대상을 예열하지 않는다, 끊김이 옆 섹션으로 옮겨가는 것을 막는다', () => {
    const { container } = render(<HomeClient />);
    navigateTo(/about/i);

    // isTransitioning 게이트를 지우면(active만 보고 파생하면) projects가
    // 이 시점에 이미 section-prewarm을 갖게 되어 FAIL한다.
    expect(getSection(container, 'projects')).not.toHaveClass('section-prewarm');

    // 전환 중이라고 해서 이미 데워 둔 목적지를 식히지도 않는다. about은
    // 활성이 됐으므로 예열 클래스 없이 section-visible이어야 한다.
    expect(getSection(container, 'about')).toHaveClass('section-visible');
  });

  it('reducedMotion에서는 예열하지 않는다, 애니메이션이 없으므로 프레임 비용을 뺄 이유도 없다', () => {
    installMatchMedia(true);
    const { container } = render(<HomeClient />);

    for (const { id } of HOME_SECTION_CONFIG) {
      expect(getSection(container, id), id).not.toHaveClass('section-prewarm');
    }
  });
});

// Task 4의 CSS가 .section-visible[data-section-direction]과
// .section-hidden[data-section-leaving][data-section-direction]으로 깊이
// 애니메이션을 건다. 표식이 관련된 둘(들어오는 섹션·나가는 섹션)에만 붙어야
// 비활성 여섯 개가 함께 뛰지 않는다.
describe('HomeClient 전환 방향 표식', () => {
  it('들어오는 섹션과 나가는 섹션에만 방향 표식이 붙는다', () => {
    const { container } = render(<HomeClient />);
    const stage = container.querySelector('.section-stage');
    expect(stage).not.toBeNull();
    navigateTo(/about/i);

    expect(getSection(container, 'about')).toHaveAttribute(
      'data-section-direction',
      'forward'
    );
    expect(getSection(container, 'overview')).toHaveAttribute(
      'data-section-leaving'
    );

    // 나머지는 깨끗해야 한다. 안 그러면 이탈 애니메이션이 여섯 개에서 뛴다.
    expect(getSection(container, 'projects')).not.toHaveAttribute(
      'data-section-direction'
    );

    // 이월 1(Important로 승격): 위는 표본 하나(projects)만 본다. .section-scroll
    // 래퍼 일곱 개(overview + 여섯 섹션) 전체에서 표식이 정확히 둘인지
    // 센다. 이 설계 전체가 서 있는 불변식이다. .section-stage로 범위를
    // 좁히는 이유는 BootSequence(최종 리뷰 I1)가 overview가 관련된 전환에서
    // 같은 transitionAttributes(OVERVIEW)를 받아 자기 루트(.section-stage
    // 밖 셸 레벨)에도 같은 표식을 펴기 때문이다. 그 표식까지 한 카운터에
    // 세면 이 불변식이 ".section-scroll 일곱 중 둘"이 아니라 DOM 전체
    // 얘기로 흐려진다. BootSequence 쪽 배선은 아래 별도 테스트가 고정한다.
    expect(stage!.querySelectorAll('[data-section-direction]')).toHaveLength(2);
  });

  it('모션을 끄면 표식을 달지 않는다', () => {
    installMatchMedia(true);
    const { container } = render(<HomeClient />);
    navigateTo(/about/i);

    expect(getSection(container, 'about')).not.toHaveAttribute(
      'data-section-direction'
    );
  });

  // 최종 리뷰 I1: overview의 실제 화면(FRONTEND DEVELOPER 캡션, START)은
  // .section-scroll 빈 wrapper가 아니라 BootSequence가 그린다. overview가
  // 관련된 전환에서는 BootSequence 루트도 같은 표식을 받아야 그 화면에도
  // 깊이 애니메이션이 그려진다.
  it('overview를 떠나면 BootSequence 루트가 이탈 표식을 받는다', () => {
    render(<HomeClient />);
    navigateTo(/about/i);

    const bootProbe = screen.getByTestId('boot-sequence-probe');
    expect(bootProbe).toHaveAttribute('data-section-direction', 'forward');
    expect(bootProbe).toHaveAttribute('data-section-leaving');
  });

  it('overview로 돌아오면 BootSequence 루트가 진입 표식을 받는다', () => {
    render(<HomeClient />);
    navigateTo(/about/i);
    fireEvent.click(screen.getByTestId('wordmark'));

    const bootProbe = screen.getByTestId('boot-sequence-probe');
    expect(bootProbe).toHaveAttribute('data-section-direction', 'backward');
    expect(bootProbe).not.toHaveAttribute('data-section-leaving');
  });

  // 최종 리뷰 I2: sectionTransition은 다음 이동 전까지 초기화되지 않는다.
  // isTransitioning 게이트가 없으면 reducedMotion을 끄는 것만으로(이동
  // 없이) 표식이 새로 붙어 진입 애니메이션이 재생된다. 전환이 끝난 뒤
  // (transitionend) 표식이 사라지는지로 이 게이트를 고정한다.
  it('전환이 끝나면 방향 표식이 사라진다', () => {
    const { container } = render(<HomeClient />);
    navigateTo(/about/i);
    const about = getSection(container, 'about');

    expect(about).toHaveAttribute('data-section-direction', 'forward');
    expect(getSection(container, 'overview')).toHaveAttribute(
      'data-section-leaving'
    );

    fireOpacityTransition(about, 'transitionrun');
    fireOpacityTransition(about, 'transitionend');

    // 뮤테이션: isTransitioning 게이트를 지우면(sectionTransition.direction만
    // 보면) 전환이 끝난 뒤에도 이 값들이 그대로 남아 FAIL한다.
    expect(about).not.toHaveAttribute('data-section-direction');
    expect(getSection(container, 'overview')).not.toHaveAttribute(
      'data-section-leaving'
    );
  });
});
