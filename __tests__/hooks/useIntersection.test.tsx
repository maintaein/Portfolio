import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CollaborationMesh from '@/components/blocks/CollaborationMesh';
import EmpathyRadar from '@/components/blocks/EmpathyRadar';
import TechParticleStorm from '@/components/blocks/TechParticleStorm';
import {
  SectionActivityProvider,
} from '@/components/common/SectionActivityContext';
import WhenVisible from '@/components/common/WhenVisible';
import { useSectionNav } from '@/hooks/useSectionNav';
import type { ComponentType } from 'react';

type DecorationProps = { shouldEnter: boolean };
type Decoration = ComponentType<DecorationProps>;

const decorations = [
  { name: 'CollaborationMesh', Component: CollaborationMesh, animationClass: 'animate-bob' },
  { name: 'EmpathyRadar', Component: EmpathyRadar, animationClass: 'animate-radar-slow' },
  { name: 'TechParticleStorm', Component: TechParticleStorm, animationClass: 'animate-float' },
] satisfies ReadonlyArray<{
  name: string;
  Component: Decoration;
  animationClass: string;
}>;

beforeEach(() => {
  window.history.replaceState(null, '', '#overview');
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      takeRecords: vi.fn(() => []),
      unobserve: vi.fn(),
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
            <Component shouldEnter={shouldEnter} />
          </div>
        )}
      </WhenVisible>
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
  it('freezeOnceVisible을 사용하는 컴포넌트의 IntersectionObserver 진입 판정을 차단한다', () => {
    const componentRoot = resolve(process.cwd(), 'components');
    const offenders = collectComponentFiles(componentRoot)
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return (
          source.includes('useIntersection') &&
          source.includes('freezeOnceVisible')
        );
      })
      .map((file) => file.slice(process.cwd().length + 1));

    expect(
      offenders,
      `섹션 진입 판정에 IntersectionObserver를 사용하는 파일: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  for (const { name, Component, animationClass } of decorations) {
    it(`${name}은 최초 방문에만 진입하고 재방문에는 재생하지 않는다`, async () => {
      const { container } = render(<DecorationHarness Component={Component} />);

      fireEvent.click(screen.getByRole('button', { name: 'About' }));
      await waitFor(() => {
        expect(screen.getByTestId('decoration')).toHaveAttribute(
          'data-should-enter',
          'true'
        );
        expect(
          container.querySelector(`[data-testid="decoration"] .${animationClass}`)
        ).not.toBeNull();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
      fireEvent.click(screen.getByRole('button', { name: 'About' }));
      await waitFor(() => {
        expect(screen.getByTestId('decoration')).toHaveAttribute(
          'data-should-enter',
          'false'
        );
        expect(
          container.querySelector(`[data-testid="decoration"] .${animationClass}`)
        ).toBeNull();
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
          container.querySelector(`[data-testid="decoration"] .${animationClass}`)
        ).toBeNull();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
      fireEvent.click(screen.getByRole('button', { name: 'About' }));
      await waitFor(() => {
        expect(screen.getByTestId('decoration')).toHaveAttribute(
          'data-should-enter',
          'false'
        );
        expect(
          container.querySelector(`[data-testid="decoration"] .${animationClass}`)
        ).toBeNull();
      });
    });

    it(`${name}은 routeResolved 전에는 진입하지 않는다`, () => {
      const { container } = render(
        <BlockedDecorationHarness Component={Component} />
      );

      expect(
        container.querySelector(`[data-testid="decoration"] .${animationClass}`)
      ).toBeNull();
      expect(screen.getByTestId('decoration')).toHaveAttribute(
        'data-should-enter',
        'false'
      );
    });
  }
});
