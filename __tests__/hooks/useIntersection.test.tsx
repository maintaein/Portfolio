import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lazy, Suspense, type ComponentType } from 'react';
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

type DecorationProps = { shouldEnter: boolean; reducedMotion?: boolean };
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

const ELEMENT_LEVEL_ALLOWLIST: readonly string[] = [];
const intersectionCallbacks = new Set<IntersectionObserverCallback>();

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
        {({ shouldEnter }) => (
          <div
            data-testid="decoration"
            data-should-enter={shouldEnter}
          >
            <Component shouldEnter={shouldEnter} reducedMotion={reducedMotion} />
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
        {({ shouldEnter }) => (
          <div
            data-testid="decoration"
            data-should-enter={shouldEnter}
          >
            <Component shouldEnter={shouldEnter} />
          </div>
        )}
      </WhenVisible>
    </SectionActivityProvider>
  );
}

describe('섹션 진입 애니메이션 트리거', () => {
  it('useIntersection을 사용하는 컴포넌트의 IntersectionObserver 진입 판정을 차단한다', () => {
    const componentRoot = resolve(process.cwd(), 'components');
    const offenders = collectComponentFiles(componentRoot)
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        const relativePath = file.slice(process.cwd().length + 1);
        return (
          source.includes('useIntersection') &&
          !ELEMENT_LEVEL_ALLOWLIST.includes(relativePath)
        );
      })
      .map((file) => file.slice(process.cwd().length + 1));

    expect(
      offenders,
      `섹션 진입 판정에 IntersectionObserver를 사용하는 파일: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  for (const { name, Component, initialClasses, finalClasses } of decorations) {
    it(`${name} starts in the transition's initial state and latches its final state`, async () => {
      const { container, rerender } = render(<Component shouldEnter={false} />);

      expect(findElementWithClasses(container, initialClasses)).not.toBeUndefined();
      expect(findElementWithClasses(container, finalClasses)).toBeUndefined();

      rerender(<Component shouldEnter />);
      await waitFor(() => {
        expect(findElementWithClasses(container, finalClasses)).not.toBeUndefined();
      });
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
    const aboutSource = readFileSync(
      resolve(process.cwd(), 'components/sections/AboutSection/index.tsx'),
      'utf8'
    );
    expect(aboutSource).toMatch(/shouldLoad\s*\|\|\s*shouldMount/);

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

  it('production AboutSection wiring mounts reduced-motion decorations in their final state', async () => {
    const { container } = render(<AboutHarness reducedMotion />);

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    await waitFor(() => {
      expect(findElementWithClasses(container, decorations[0].finalClasses)).not.toBeUndefined();
    });
  });
});
