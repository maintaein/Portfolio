import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SectionActivityProvider,
  useSectionActivity,
  type SectionActivityProviderProps,
} from '@/components/common/SectionActivityContext';

type ActivityProps = Omit<SectionActivityProviderProps, 'children'>;

function ActivityProbe() {
  const activity = useSectionActivity();

  return (
    <output
      data-testid="activity"
      data-active={activity.active}
      data-entry-animation-target={activity.entryAnimationTarget ?? 'null'}
      data-page-visible={activity.pageVisible}
      data-route-resolved={activity.routeResolved}
      data-motion-ready={activity.motionReady}
      data-reduced-motion={activity.reducedMotion}
    >
      {Object.keys(activity).sort().join(',')}
    </output>
  );
}

function Harness(props: ActivityProps) {
  return (
    <SectionActivityProvider {...props}>
      <ActivityProbe />
    </SectionActivityProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SectionActivityContext', () => {
  it('부모가 준 여섯 값을 읽기 전용 형태로 그대로 배포하고 재렌더도 따라간다', () => {
    const first: ActivityProps = {
      active: 'projects',
      entryAnimationTarget: 'about',
      pageVisible: false,
      routeResolved: true,
      motionReady: false,
      reducedMotion: true,
    };
    const second: ActivityProps = {
      active: 'about',
      entryAnimationTarget: null,
      pageVisible: true,
      routeResolved: false,
      motionReady: true,
      reducedMotion: false,
    };
    const { rerender } = render(<Harness {...first} />);
    const probe = screen.getByTestId('activity');

    expect(probe).toHaveAttribute('data-active', 'projects');
    expect(probe).toHaveAttribute('data-entry-animation-target', 'about');
    expect(probe).toHaveAttribute('data-page-visible', 'false');
    expect(probe).toHaveAttribute('data-route-resolved', 'true');
    expect(probe).toHaveAttribute('data-motion-ready', 'false');
    expect(probe).toHaveAttribute('data-reduced-motion', 'true');
    expect(probe.textContent).toBe(
      'active,entryAnimationTarget,motionReady,pageVisible,reducedMotion,routeResolved'
    );

    rerender(<Harness {...second} />);

    expect(probe).toHaveAttribute('data-active', 'about');
    expect(probe).toHaveAttribute('data-entry-animation-target', 'null');
    expect(probe).toHaveAttribute('data-page-visible', 'true');
    expect(probe).toHaveAttribute('data-route-resolved', 'false');
    expect(probe).toHaveAttribute('data-motion-ready', 'true');
    expect(probe).toHaveAttribute('data-reduced-motion', 'false');
  });

  it('Provider 밖에서 사용하면 명시적인 오류를 던진다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ActivityProbe />)).toThrow(
      'useSectionActivity must be used within SectionActivityProvider'
    );
  });
});
