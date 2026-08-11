import { useState, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SectionActivityProvider,
  type SectionActivityProviderProps,
} from '@/components/common/SectionActivityContext';
import WhenVisible, {
  type WhenVisibleProps,
} from '@/components/common/WhenVisible';
import { useSectionNav } from '@/hooks/useSectionNav';

type ActivityProps = Omit<SectionActivityProviderProps, 'children'>;
type GateProps = Omit<WhenVisibleProps, 'children'>;

const DEFAULT_ACTIVITY: ActivityProps = {
  active: 'about',
  entryAnimationTarget: 'about',
  pageVisible: true,
  routeResolved: true,
  motionReady: true,
  reducedMotion: false,
};

function GateProbe({
  paused,
  shouldEnter,
  shouldLoad,
}: {
  paused: boolean;
  shouldEnter: boolean;
  shouldLoad: boolean;
}) {
  return (
    <output
      data-testid="gate"
      data-paused={paused}
      data-should-enter={shouldEnter}
      data-should-load={shouldLoad}
    />
  );
}

function GateHarness({
  activity,
  gate = { section: 'about' },
  children,
}: {
  activity: ActivityProps;
  gate?: GateProps;
  children?: ReactNode;
}) {
  return (
    <SectionActivityProvider {...activity}>
      <WhenVisible {...gate}>
        {(state) => <GateProbe {...state} />}
      </WhenVisible>
      {children}
    </SectionActivityProvider>
  );
}

function expectGate(expected: {
  paused: boolean;
  shouldEnter: boolean;
  shouldLoad: boolean;
}) {
  const gate = screen.getByTestId('gate');
  expect(gate).toHaveAttribute('data-paused', String(expected.paused));
  expect(gate).toHaveAttribute(
    'data-should-enter',
    String(expected.shouldEnter)
  );
  expect(gate).toHaveAttribute('data-should-load', String(expected.shouldLoad));
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('WhenVisible', () => {
  it('active 게이트는 비활성 → 활성 → 비활성으로 왕복하고 load만 래치한다', async () => {
    const inactive = { ...DEFAULT_ACTIVITY, active: 'projects' as const };
    const { rerender } = render(<GateHarness activity={inactive} />);

    expectGate({ paused: true, shouldEnter: false, shouldLoad: false });

    rerender(<GateHarness activity={DEFAULT_ACTIVITY} />);
    await waitFor(() =>
      expectGate({ paused: false, shouldEnter: true, shouldLoad: true })
    );

    rerender(<GateHarness activity={inactive} />);
    expectGate({ paused: true, shouldEnter: false, shouldLoad: true });
  });

  it('routeResolved 게이트는 해석 전 세 신호를 닫고 해석 뒤 연다', async () => {
    const unresolved = { ...DEFAULT_ACTIVITY, routeResolved: false };
    const { rerender } = render(<GateHarness activity={unresolved} />);

    expectGate({ paused: true, shouldEnter: false, shouldLoad: false });

    rerender(<GateHarness activity={DEFAULT_ACTIVITY} />);
    await waitFor(() =>
      expectGate({ paused: false, shouldEnter: true, shouldLoad: true })
    );
  });

  it('motionReady 게이트는 준비 전 세 신호를 닫고 준비 뒤 연다', async () => {
    const unready = { ...DEFAULT_ACTIVITY, motionReady: false };
    const { rerender } = render(<GateHarness activity={unready} />);

    expectGate({ paused: true, shouldEnter: false, shouldLoad: false });

    rerender(<GateHarness activity={DEFAULT_ACTIVITY} />);
    await waitFor(() =>
      expectGate({ paused: false, shouldEnter: true, shouldLoad: true })
    );
  });

  it('reducedMotion 게이트는 true에서 멈추고 false에서 열리며 load 이력은 유지한다', async () => {
    const reduced = { ...DEFAULT_ACTIVITY, reducedMotion: true };
    const { rerender } = render(<GateHarness activity={reduced} />);

    expectGate({ paused: true, shouldEnter: false, shouldLoad: false });

    rerender(<GateHarness activity={DEFAULT_ACTIVITY} />);
    await waitFor(() =>
      expectGate({ paused: false, shouldEnter: true, shouldLoad: true })
    );

    rerender(<GateHarness activity={reduced} />);
    expectGate({ paused: true, shouldEnter: false, shouldLoad: true });
  });

  it('pageVisible 게이트는 hidden에서 멈추고 visible에서 열리며 다시 hidden이면 멈춘다', async () => {
    const hidden = { ...DEFAULT_ACTIVITY, pageVisible: false };
    const { rerender } = render(<GateHarness activity={hidden} />);

    expectGate({ paused: true, shouldEnter: false, shouldLoad: false });

    rerender(<GateHarness activity={DEFAULT_ACTIVITY} />);
    await waitFor(() =>
      expectGate({ paused: false, shouldEnter: true, shouldLoad: true })
    );

    rerender(<GateHarness activity={hidden} />);
    expectGate({ paused: true, shouldEnter: false, shouldLoad: true });
  });

  it('하위 index가 다르면 닫고 같으면 열며 다시 달라도 load는 유지한다', async () => {
    const { rerender } = render(
      <GateHarness
        activity={DEFAULT_ACTIVITY}
        gate={{ section: 'about', index: 1, activeIndex: 0 }}
      />
    );

    expectGate({ paused: true, shouldEnter: true, shouldLoad: false });

    rerender(
      <GateHarness
        activity={DEFAULT_ACTIVITY}
        gate={{ section: 'about', index: 1, activeIndex: 1 }}
      />
    );
    await waitFor(() =>
      expectGate({ paused: false, shouldEnter: true, shouldLoad: true })
    );

    rerender(
      <GateHarness
        activity={DEFAULT_ACTIVITY}
        gate={{ section: 'about', index: 1, activeIndex: 2 }}
      />
    );
    expectGate({ paused: true, shouldEnter: true, shouldLoad: true });
  });

  it('index가 없으면 activeIndex를 무시하고 index만 있으면 선택 전까지 닫는다', () => {
    const { rerender } = render(
      <GateHarness
        activity={DEFAULT_ACTIVITY}
        gate={{ section: 'about', activeIndex: 5 }}
      />
    );
    expectGate({ paused: false, shouldEnter: true, shouldLoad: true });

    rerender(
      <GateHarness
        activity={DEFAULT_ACTIVITY}
        gate={{ section: 'about', index: 0 }}
      />
    );
    expectGate({ paused: true, shouldEnter: true, shouldLoad: true });
  });

  it('원자적 entryAnimationTarget은 최초 진입만 열고 다른 대상과 재방문은 닫는다', () => {
    const { rerender } = render(<GateHarness activity={DEFAULT_ACTIVITY} />);
    expectGate({ paused: false, shouldEnter: true, shouldLoad: true });

    rerender(
      <GateHarness
        activity={{ ...DEFAULT_ACTIVITY, entryAnimationTarget: 'projects' }}
      />
    );
    expectGate({ paused: false, shouldEnter: false, shouldLoad: true });

    rerender(
      <GateHarness
        activity={{ ...DEFAULT_ACTIVITY, entryAnimationTarget: null }}
      />
    );
    expectGate({ paused: false, shouldEnter: false, shouldLoad: true });
  });

  it('useSectionNav가 seen을 먼저 기록해도 최초 진입은 열고 재방문은 닫는다', () => {
    function NavHarness() {
      const nav = useSectionNav();

      return (
        <SectionActivityProvider
          active={nav.active}
          entryAnimationTarget={nav.entryAnimationTarget}
          pageVisible
          routeResolved={nav.routeResolved}
          motionReady
          reducedMotion={false}
        >
          <button onClick={() => nav.setActive('about')}>About</button>
          <button onClick={() => nav.setActive('projects')}>Projects</button>
          <WhenVisible section="about">
            {({ shouldEnter }) => (
              <output
                data-testid="nav-entry"
                data-seen={nav.isSeen('about')}
                data-should-enter={shouldEnter}
              />
            )}
          </WhenVisible>
        </SectionActivityProvider>
      );
    }

    render(<NavHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByTestId('nav-entry')).toHaveAttribute('data-seen', 'true');
    expect(screen.getByTestId('nav-entry')).toHaveAttribute(
      'data-should-enter',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByTestId('nav-entry')).toHaveAttribute('data-seen', 'true');
    expect(screen.getByTestId('nav-entry')).toHaveAttribute(
      'data-should-enter',
      'false'
    );
  });

  it('reduced-motion 중의 최초 방문도 소비되어 설정을 풀고 재방문해도 entry가 열리지 않는다', () => {
    function ReducedMotionHarness() {
      const nav = useSectionNav();
      const [reducedMotion, setReducedMotion] = useState(true);

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
          <button onClick={() => setReducedMotion(false)}>Motion on</button>
          <WhenVisible section="about">
            {({ shouldEnter }) => (
              <output data-testid="reduced-entry">{String(shouldEnter)}</output>
            )}
          </WhenVisible>
        </SectionActivityProvider>
      );
    }

    render(<ReducedMotionHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByTestId('reduced-entry')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    fireEvent.click(screen.getByRole('button', { name: 'Motion on' }));
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByTestId('reduced-entry')).toHaveTextContent('false');
  });
});
