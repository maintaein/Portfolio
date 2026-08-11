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
  SECTION_IDS,
  type HomeSectionId,
} from '@/lib/constants';

const motionSpies = vi.hoisted(() => ({
  dynamicLoader: vi.fn(),
  gsapTimeline: vi.fn(),
}));

vi.mock('@/components/sections', async () => {
  const { useEffect, useRef } = await import('react');
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
    ExperienceSection: () => (
      <SectionShell label="Experience" marker="Frontend Experience" />
    ),
    Footer: () => <a href="mailto:test@example.com">Contact footer</a>,
    HeroSection: () => (
      <section>
        <h1>Overview profile</h1>
        <button>Overview content action</button>
        <MotionProbe label="boot-sequence" section="overview" />
        <MotionProbe label="hyperspeed" section="overview" />
        <MotionProbe label="preview" section="overview" />
      </section>
    ),
    ProjectsSection: () => (
      <SectionShell label="Projects" marker="AlphaMail" />
    ),
    SkillsSection: () => (
      <SectionShell label="Skills" marker="TypeScript" />
    ),
  };
});

interface MockMediaController {
  fire: (matches: boolean) => void;
  listenerCount: () => number;
}

const semanticMarkerBySection = {
  [SECTION_IDS.ABOUT]: '91%',
  [SECTION_IDS.PROJECTS]: 'AlphaMail',
  [SECTION_IDS.EXPERIENCE]: 'Frontend Experience',
  [SECTION_IDS.SKILLS]: 'TypeScript',
  [SECTION_IDS.AWARDS_CERTIFICATES]: 'Grand Prize',
} satisfies Record<HomeSectionId, string>;

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

  installMatchMedia(false);
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

describe('HomeClient SSR 상주', () => {
  it('서버 HTML에 overview와 다섯 의미 콘텐츠를 항목별로 모두 렌더한다', () => {
    const html = renderToString(<HomeClient />);

    expect(html).toContain('data-section="overview"');
    expect(html).toContain('Overview profile');
    for (const { id } of HOME_SECTION_CONFIG) {
      expect(html, `${id} 래퍼가 서버 HTML에 없다`).toContain(
        `data-section="${id}"`
      );
      expect(html, `${id} 의미 콘텐츠가 서버 HTML에 없다`).toContain(
        semanticMarkerBySection[id]
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
        'ExperienceSection',
        'Footer',
        'HeroSection',
        'ProjectsSection',
        'SkillsSection',
      ].sort()
    );
    expect(importsNextDynamic).toBe(false);
    expect(dynamicImports).toEqual([]);
    expect(timeoutCalls).toEqual([]);
  });
});

describe('HomeClient section 상태', () => {
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
    render(<HomeClient />);

    for (const { label } of HOME_SECTION_CONFIG) {
      const action = screen
        .getByText(`${label} content action`)
        .closest('button');
      const inertBoundary = action?.closest('[inert]');

      expect(action, `${label} Tab 후보가 없다`).not.toBeNull();
      expect(inertBoundary, `${label} Tab 후보가 inert 밖에 있다`).not.toBeNull();
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
    fireOpacityTransition(about, 'transitioncancel');

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(projects).not.toHaveFocus();

    fireOpacityTransition(projects, 'transitioncancel');
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
