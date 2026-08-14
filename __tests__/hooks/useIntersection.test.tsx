import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lazy, Suspense, useLayoutEffect, useRef, type ComponentType } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CollaborationMesh from '@/components/blocks/CollaborationMesh';
import EmpathyRadar from '@/components/blocks/EmpathyRadar';
import TechParticleStorm from '@/components/blocks/TechParticleStorm';
import AboutSection from '@/components/sections/AboutSection';
import {
  SectionActivityProvider,
} from '@/components/common/SectionActivityContext';
import WhenVisible from '@/components/common/WhenVisible';
import { useSectionNav } from '@/hooks/useSectionNav';

type DecorationProps = { shouldEnter: boolean; paused?: boolean; reducedMotion?: boolean };
type Decoration = ComponentType<DecorationProps>;

vi.mock('next/dynamic', () => ({
  default: (
    loader: () => Promise<{ default: ComponentType<DecorationProps> }>
  ) => {
    const LazyComponent = lazy(loader);

    return function DynamicComponent(props: DecorationProps) {
      return (
        <Suspense fallback={null}>
          <LazyComponent {...props} />
        </Suspense>
      );
    };
  },
}));

const decorations = [
  {
    name: 'CollaborationMesh',
    Component: CollaborationMesh,
    initialClasses: ['transition-all', 'duration-700', 'opacity-0', 'scale-50'],
    finalClasses: ['transition-all', 'duration-700', 'opacity-100', 'scale-100'],
  },
  {
    name: 'EmpathyRadar',
    Component: EmpathyRadar,
    initialClasses: ['transition-all', 'duration-300', 'opacity-0', 'scale-50'],
    finalClasses: ['transition-all', 'duration-300', 'opacity-100', 'scale-100'],
  },
  {
    name: 'TechParticleStorm',
    Component: TechParticleStorm,
    initialClasses: ['transition-all', 'duration-0'],
    finalClasses: ['transition-all', 'duration-[1200ms]'],
  },
] satisfies ReadonlyArray<{
  name: string;
  Component: Decoration;
  initialClasses: string[];
  finalClasses: string[];
}>;

const WHILE_IN_VIEW_DEBT = {
  'components/sections/HeroSection/index.tsx': { plan: 3, count: 1 },
  'components/sections/AboutSection/index.tsx': { plan: 4, count: 2 },
  'components/blocks/SectionHeader/index.tsx': { plan: 5, count: 1 },
  'components/sections/SkillsSection/index.tsx': { plan: 5, count: 1 },
  'components/sections/ExperienceSection/index.tsx': {
    plan: 5,
    count: 3,
    additionalIntersectionApi: 'useInView',
  },
  'components/sections/AwardAndCertificatesSection/index.tsx': { plan: 5, count: 1 },
} as const;
const intersectionCallbacks = new Set<IntersectionObserverCallback>();
const DESIGN_TOKENS_CSS = readFileSync(
  resolve(process.cwd(), 'styles/design-tokens.css'),
  'utf8'
);
const INFINITE_ANIMATION_CLASSES = new Set(
  DESIGN_TOKENS_CSS.split('}')
    .map((block) => {
      const className = block.match(/\.([A-Za-z0-9_-]+)\s*\{/)?.[1];
      return className && block.includes('animation:') && block.includes('infinite')
        ? className
        : null;
    })
    .filter((className): className is string => className !== null)
);

beforeEach(() => {
  window.history.replaceState(null, '', '#overview');
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn((callback: IntersectionObserverCallback) => {
      intersectionCallbacks.add(callback);
      return {
        disconnect: vi.fn(() => intersectionCallbacks.delete(callback)),
        observe: vi.fn(() =>
          callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver
          )
        ),
        takeRecords: vi.fn(() => []),
        unobserve: vi.fn(),
      };
    })
  );
});

afterEach(() => {
  intersectionCallbacks.clear();
  vi.unstubAllGlobals();
});

function findElementWithClasses(container: HTMLElement, classes: string[]) {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).find((element) =>
    classes.every((className) => element.classList.contains(className))
  );
}

function collectComponentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectComponentFiles(path);
    return entry.isFile() && path.endsWith('.tsx') ? [path] : [];
  });
}

function FirstPaintHarness({
  Component,
  paused = false,
  shouldEnter,
  reducedMotion = false,
  onPaint,
}: {
  Component: Decoration;
  paused?: boolean;
  shouldEnter: boolean;
  reducedMotion?: boolean;
  onPaint: (root: HTMLElement) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (rootRef.current) onPaint(rootRef.current);
  }, [onPaint]);

  return (
    <div ref={rootRef}>
      <Component paused={paused} shouldEnter={shouldEnter} reducedMotion={reducedMotion} />
    </div>
  );
}

function DecorationHarness({
  Component,
  reducedMotion = false,
}: {
  Component: Decoration;
  reducedMotion?: boolean;
}) {
  const nav = useSectionNav();

  return (
    <SectionActivityProvider
      active={nav.active}
      entryAnimationTarget={nav.entryAnimationTarget}
      pageVisible
      routeResolved={nav.routeResolved}
      motionReady
      reducedMotion={reducedMotion}
    >
      <button onClick={() => nav.setActive('about')}>About</button>
      <button onClick={() => nav.setActive('projects')}>Projects</button>
      <WhenVisible section="about">
        {({ paused, shouldEnter }) => (
          <div
            data-testid="decoration"
            data-should-enter={shouldEnter}
          >
            <Component paused={paused} shouldEnter={shouldEnter} reducedMotion={reducedMotion} />
          </div>
        )}
      </WhenVisible>
    </SectionActivityProvider>
  );
}

function AboutHarness({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const nav = useSectionNav();

  return (
    <SectionActivityProvider
      active={nav.active}
      entryAnimationTarget={nav.entryAnimationTarget}
      pageVisible
      routeResolved={nav.routeResolved}
      motionReady
      reducedMotion={reducedMotion}
    >
      <button onClick={() => nav.setActive('about')}>About</button>
      <button onClick={() => nav.setActive('projects')}>Projects</button>
      <AboutSection />
    </SectionActivityProvider>
  );
}

function BlockedDecorationHarness({ Component }: { Component: Decoration }) {
  return (
    <SectionActivityProvider
      active="about"
      entryAnimationTarget="about"
      pageVisible
      routeResolved={false}
      motionReady
      reducedMotion={false}
    >
      <WhenVisible section="about">
        {({ paused, shouldEnter }) => (
          <div
            data-testid="decoration"
            data-should-enter={shouldEnter}
          >
            <Component paused={paused} shouldEnter={shouldEnter} />
          </div>
        )}
      </WhenVisible>
    </SectionActivityProvider>
  );
}

describe('섹션 진입 애니메이션 트리거', () => {
  it('useIntersection을 사용하는 컴포넌트의 IntersectionObserver 진입 판정을 차단한다', () => {
    const componentRoot = resolve(process.cwd(), 'components');
    const sources = collectComponentFiles(componentRoot).map((file) => {
      const source = readFileSync(file, 'utf8');
      const relativePath = file.slice(process.cwd().length + 1).replaceAll('\\', '/');
      return { relativePath, source };
    });
    const ioOffenders = sources
      .filter(({ source }) =>
        source.includes('useIntersection') ||
        source.includes('IntersectionObserver(') ||
        /\b(?:const|let)\s+\w+\s*=\s*window\.IntersectionObserver/.test(source) ||
        source.includes('useInView')
      )
      .map(({ relativePath }) => relativePath);
    const whileInViewOffenders = sources
      .filter(({ source }) => source.includes('whileInView'))
      .map(({ relativePath, source }) => ({
        relativePath,
        count: source.match(/whileInView/g)?.length ?? 0,
      }));
    const debtPaths = Object.keys(WHILE_IN_VIEW_DEBT);

    const offenders = ioOffenders.filter(
      (relativePath) => !debtPaths.includes(relativePath)
    );

    expect(
      offenders,
      `섹션 진입 판정에 IntersectionObserver를 사용하는 파일: ${offenders.join(', ')}`
    ).toEqual([]);
    expect(whileInViewOffenders.map(({ relativePath }) => relativePath).sort()).toEqual(
      debtPaths.sort()
    );
    for (const offender of whileInViewOffenders) {
      expect(offender.count).toBe(
        WHILE_IN_VIEW_DEBT[offender.relativePath as keyof typeof WHILE_IN_VIEW_DEBT].count
      );
    }
  });

  for (const { name, Component, initialClasses, finalClasses } of decorations) {
    it(`${name} pauses every infinite animation and resumes it when active`, async () => {
      const { container, rerender } = render(
        <Component shouldEnter paused={false} />
      );
      const collectInfiniteAnimations = () =>
        new Set(
          Array.from(container.querySelectorAll<HTMLElement>('*')).flatMap((element) => [
            ...Array.from(element.classList).filter(
              (className) =>
                INFINITE_ANIMATION_CLASSES.has(className) ||
                /infinite|radar-sweep/.test(className)
            ),
            ...( /infinite|radar-sweep/.test(element.style.animation)
              ? [element.style.animation]
              : []),
          ])
        );

      await waitFor(() => expect(collectInfiniteAnimations().size).toBeGreaterThan(0));
      if (name === 'EmpathyRadar') {
        const card = Array.from(container.querySelectorAll<HTMLElement>('*')).find(
          (element) =>
            element.className.includes('absolute transition-all duration-300 pointer-events-auto')
        );
        if (card) fireEvent.mouseEnter(card);
      }
      await waitFor(() => expect(collectInfiniteAnimations().size).toBeGreaterThan(0));
      const activeAnimations = collectInfiniteAnimations();
      rerender(<Component shouldEnter paused />);
      const pausedAnimations = collectInfiniteAnimations();
      for (const animation of activeAnimations) {
        expect(pausedAnimations).not.toContain(animation);
      }
      rerender(<Component shouldEnter paused={false} />);
      expect(collectInfiniteAnimations()).toEqual(activeAnimations);
    });

    it(`${name} starts in the transition's initial state and latches its final state`, async () => {
      const { container, rerender } = render(<Component shouldEnter={false} />);

      expect(findElementWithClasses(container, initialClasses)).not.toBeUndefined();
      expect(findElementWithClasses(container, finalClasses)).toBeUndefined();

      rerender(<Component shouldEnter />);
      await waitFor(() => {
        expect(findElementWithClasses(container, finalClasses)).not.toBeUndefined();
      });
    });

    it(`${name} starts in the initial state when mounted with shouldEnter`, () => {
      let firstPaintHasInitialState = false;
      let firstPaintHasFinalState = false;

      render(
        <FirstPaintHarness
          Component={Component}
          shouldEnter
          onPaint={(root) => {
            firstPaintHasInitialState =
              findElementWithClasses(root, initialClasses) !== undefined;
            firstPaintHasFinalState =
              findElementWithClasses(root, finalClasses) !== undefined;
          }}
        />
      );

      expect(firstPaintHasInitialState).toBe(true);
      expect(firstPaintHasFinalState).toBe(false);

      let reducedMotionHasInitialState = false;
      let reducedMotionHasFinalState = false;
      render(
        <FirstPaintHarness
          Component={Component}
          shouldEnter={false}
          reducedMotion
          onPaint={(root) => {
            reducedMotionHasInitialState =
              findElementWithClasses(root, initialClasses) !== undefined;
            reducedMotionHasFinalState =
              findElementWithClasses(root, finalClasses) !== undefined;
          }}
        />
      );

      expect(reducedMotionHasInitialState).toBe(false);
      expect(reducedMotionHasFinalState).toBe(true);
    });

    it(`${name}은 최초 방문에만 진입하고 재방문에는 재생하지 않는다`, async () => {
      const { container } = render(<DecorationHarness Component={Component} />);

      fireEvent.click(screen.getByRole('button', { name: 'About' }));
      await waitFor(() => {
        expect(screen.getByTestId('decoration')).toHaveAttribute(
          'data-should-enter',
          'true'
        );
        expect(
          findElementWithClasses(container, finalClasses)
        ).not.toBeUndefined();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
      fireEvent.click(screen.getByRole('button', { name: 'About' }));
      await waitFor(() => {
        expect(screen.getByTestId('decoration')).toHaveAttribute(
          'data-should-enter',
          'false'
        );
        expect(
          findElementWithClasses(container, finalClasses)
        ).not.toBeUndefined();
      });
    });

    it(`${name}은 reduced-motion에서 방문을 소비하고 이후에도 진입하지 않는다`, async () => {
      const { container } = render(
        <DecorationHarness Component={Component} reducedMotion />
      );

      fireEvent.click(screen.getByRole('button', { name: 'About' }));
      await waitFor(() => {
        expect(screen.getByTestId('decoration')).toHaveAttribute(
          'data-should-enter',
          'false'
        );
        expect(
          findElementWithClasses(container, finalClasses)
        ).not.toBeUndefined();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
      fireEvent.click(screen.getByRole('button', { name: 'About' }));
      await waitFor(() => {
        expect(screen.getByTestId('decoration')).toHaveAttribute(
          'data-should-enter',
          'false'
        );
        expect(
          findElementWithClasses(container, finalClasses)
        ).not.toBeUndefined();
      });
    });

    it(`${name}은 routeResolved 전에는 진입하지 않는다`, () => {
      const { container } = render(
        <BlockedDecorationHarness Component={Component} />
      );

      expect(
        findElementWithClasses(container, finalClasses)
      ).toBeUndefined();
      expect(screen.getByTestId('decoration')).toHaveAttribute(
        'data-should-enter',
        'false'
      );
    });
  }

  it('production AboutSection wiring latches decoration entry state across a revisit', async () => {
    const { container } = render(<AboutHarness />);

    expect(findElementWithClasses(container, decorations[0].finalClasses)).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    await waitFor(() => {
      expect(findElementWithClasses(container, decorations[0].finalClasses)).not.toBeUndefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    await waitFor(() => {
      expect(findElementWithClasses(container, decorations[0].finalClasses)).not.toBeUndefined();
    });
  });

  it('production AboutSection wiring pauses all decorations while inactive and resumes them', async () => {
    const { container } = render(<AboutHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll<HTMLElement>('*')).some((element) =>
          /infinite|radar-sweep/.test(element.getAttribute('class') ?? '') ||
          /infinite|radar-sweep/.test(element.style.animation)
        )
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    expect(
      Array.from(container.querySelectorAll<HTMLElement>('*')).some((element) =>
        /infinite|radar-sweep/.test(element.getAttribute('class') ?? '') ||
        /infinite|radar-sweep/.test(element.style.animation)
      )
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll<HTMLElement>('*')).some((element) =>
          /infinite|radar-sweep/.test(element.getAttribute('class') ?? '') ||
          /infinite|radar-sweep/.test(element.style.animation)
        )
      ).toBe(true);
    });
  });

  it('production AboutSection wiring mounts reduced-motion decorations in their final state', async () => {
    const { container } = render(<AboutHarness reducedMotion />);

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    await waitFor(() => {
      expect(findElementWithClasses(container, decorations[0].finalClasses)).not.toBeUndefined();
    });
  });
});
