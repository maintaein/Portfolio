import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HyperspeedBackground, {
  type HyperspeedBackgroundProps,
} from '@/components/blocks/HyperspeedBackground';
import { OVERVIEW } from '@/hooks/useSectionNav';
import type { QualityTier } from '@/lib/deviceQuality';

// 이 파일 전체에서 '@/components/blocks/Hyperspeed'는 항상 "성공적으로
// 로드되는" 가짜로 mock한다. "실패하는" 시나리오는 별도 파일
// (HyperspeedBackgroundLoadFailure.test.tsx)에서 다룬다 — vi.mock은 파일
// 단위로 hoist되어 한 파일 안에서 describe별로 다른 mock을 줄 수 없다
// (task-4-report.md의 HyperspeedApi/HyperspeedEngine 분리와 같은 이유).
const hyperspeedSpies = vi.hoisted(() => ({
  boost: vi.fn(),
  settle: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  setQuality: vi.fn(),
  isLost: vi.fn(() => false),
  mountCount: 0,
}));

const deviceQualitySpies = vi.hoisted(() => ({
  detectQuality: vi.fn(async (): Promise<QualityTier> => 'medium'),
}));

vi.mock('@/lib/deviceQuality', () => ({
  detectQuality: deviceQualitySpies.detectQuality,
}));

vi.mock('@/components/blocks/Hyperspeed', async () => {
  const { forwardRef, useEffect, useImperativeHandle } = await import('react');
  const Hyperspeed = forwardRef<unknown, Record<string, unknown>>((_props, ref) => {
    useImperativeHandle(
      ref,
      () => ({
        boost: hyperspeedSpies.boost,
        settle: hyperspeedSpies.settle,
        pause: hyperspeedSpies.pause,
        resume: hyperspeedSpies.resume,
        setQuality: hyperspeedSpies.setQuality,
        isLost: hyperspeedSpies.isLost,
      }),
      []
    );
    useEffect(() => {
      hyperspeedSpies.mountCount += 1;
    }, []);
    return <canvas data-testid="hyperspeed-canvas" />;
  });
  return { default: Hyperspeed };
});

const readyProps: HyperspeedBackgroundProps = {
  active: OVERVIEW,
  isTransitioning: false,
  obscured: false,
  pageVisible: true,
  routeResolved: true,
  motionReady: true,
  reducedMotion: false,
};

async function renderReady(overrides: Partial<HyperspeedBackgroundProps> = {}) {
  const view = render(<HyperspeedBackground {...readyProps} {...overrides} />);
  await waitFor(() => {
    expect(screen.getByTestId('hyperspeed-canvas')).toBeInTheDocument();
  });
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  hyperspeedSpies.mountCount = 0;
});

describe('HyperspeedBackground — 계획 Step 1 스켈레톤', () => {
  it('reduced-motion이면 정적 폴백을 쓴다', async () => {
    render(<HyperspeedBackground {...readyProps} reducedMotion />);
    await waitFor(() => {
      expect(screen.getByTestId('hyperspeed-fallback')).toBeInTheDocument();
    });
    expect(screen.getByTestId('hyperspeed-fallback')).toHaveAttribute(
      'data-fallback-reason',
      'reduced-motion'
    );
    // 구멍 3: WebGL 동적 import 자체를 시도하지 않는다 — canvas가 아예 없다.
    expect(screen.queryByTestId('hyperspeed-canvas')).not.toBeInTheDocument();
  });

  it('폴백은 aria-hidden이다 (장식)', async () => {
    render(<HyperspeedBackground {...readyProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('hyperspeed-fallback')).toHaveAttribute(
        'aria-hidden',
        'true'
      );
    });
  });
});

describe('HyperspeedBackground — ssr:false (jsdom 한계로 소스 검사)', () => {
  // jsdom은 항상 전역 window를 제공한다. next/dynamic의 noSSR()은
  // `typeof window === 'undefined'`로 서버 여부를 판정하므로, jsdom 위에서는
  // renderToString을 써도 이 값이 항상 false다 — ssr:false를 지우거나
  // 남기거나 jsdom에서는 런타임 차이를 관측할 수 없다(브리프가 경고한 jsdom
  // 한계 그 자체). 그래서 이 계약은 소스 검사로 고정하고, 실제 런타임
  // 증거는 `npm run build` 뒤 .next/server/app/index.html에 WebGL·three
  // 문자열이 0건인지로 별도 확인한다(리포트 5절 — 외부 증거).
  it('dynamic() 호출에 ssr:false가 리터럴로 있다', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'components/blocks/HyperspeedBackground.tsx'),
      'utf8'
    );
    expect(source).toMatch(/ssr:\s*false/);
  });
});

describe('HyperspeedBackground — 구멍 3: 폴백 사유 구별', () => {
  it('routeResolved=false면 pending이다', () => {
    render(<HyperspeedBackground {...readyProps} routeResolved={false} />);
    expect(screen.getByTestId('hyperspeed-fallback')).toHaveAttribute(
      'data-fallback-reason',
      'pending'
    );
  });

  it('motionReady=false면 pending이다', () => {
    render(<HyperspeedBackground {...readyProps} motionReady={false} />);
    expect(screen.getByTestId('hyperspeed-fallback')).toHaveAttribute(
      'data-fallback-reason',
      'pending'
    );
  });

  it('reducedMotion=true면 reduced-motion이다(위 스켈레톤 테스트와 같은 계약을 사유값으로 한 번 더 고정)', () => {
    render(<HyperspeedBackground {...readyProps} reducedMotion />);
    expect(screen.getByTestId('hyperspeed-fallback')).toHaveAttribute(
      'data-fallback-reason',
      'reduced-motion'
    );
  });
});

describe('HyperspeedBackground — isTransitioning edge → boost/settle', () => {
  it('false→true에서 boost()를 한 번 부른다', async () => {
    const { rerender } = await renderReady({ isTransitioning: false });
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();

    rerender(<HyperspeedBackground {...readyProps} isTransitioning />);
    expect(hyperspeedSpies.boost).toHaveBeenCalledTimes(1);
    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();
  });

  it('true→false에서 settle()을 한 번 부른다', async () => {
    const { rerender } = await renderReady({ isTransitioning: true });
    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();

    rerender(<HyperspeedBackground {...readyProps} isTransitioning={false} />);
    expect(hyperspeedSpies.settle).toHaveBeenCalledTimes(1);
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
  });

  it('isTransitioning이 true인 채 active만 연속 변경되면 settle()이 0회다', async () => {
    const { rerender } = await renderReady({ isTransitioning: true, active: 'about' });
    hyperspeedSpies.boost.mockClear();
    hyperspeedSpies.settle.mockClear();

    rerender(<HyperspeedBackground {...readyProps} isTransitioning active="skills" />);
    rerender(<HyperspeedBackground {...readyProps} isTransitioning active="projects" />);
    rerender(<HyperspeedBackground {...readyProps} isTransitioning active="experience" />);

    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
  });

  it('/#projects 최초 확정처럼 active=projects·isTransitioning=false로 처음 ready가 되면 boost 없이 시작한다', async () => {
    await renderReady({ active: 'projects', isTransitioning: false });
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();
  });
});

describe('HyperspeedBackground — 밝기(overview 100% / 섹션 30%) · obscured', () => {
  it('overview는 배경 100%, 콘텐츠 섹션은 30%다', async () => {
    const { rerender } = await renderReady({ active: OVERVIEW });
    const root = screen.getByTestId('hyperspeed-background');
    expect(root.style.opacity).toBe('1');

    rerender(<HyperspeedBackground {...readyProps} active="about" />);
    expect(root.style.opacity).toBe('0.3');
  });

  // obscured는 감광이 아니라 블러다. 어둡게 하면 배경이 남색 덩어리로 죽는데
  // 블러는 밝기를 유지한 채 시선만 모달로 보낸다. 그래서 opacity가 "변하지
  // 않는 것"까지 함께 못박는다 — 감광으로 되돌아가면 이 어서션이 잡는다.
  it('obscured=false→true→false는 초점만 바꾸고 밝기·boost·settle은 그대로다', async () => {
    const { rerender } = await renderReady({ active: OVERVIEW, obscured: false });
    const root = screen.getByTestId('hyperspeed-background');
    const baselineOpacity = root.style.opacity;
    expect(root.style.filter).toBe('none');
    hyperspeedSpies.boost.mockClear();
    hyperspeedSpies.settle.mockClear();

    rerender(<HyperspeedBackground {...readyProps} active={OVERVIEW} obscured />);
    expect(root.style.filter).toMatch(/^blur\((\d|\.)+px\)$/);
    expect(root.style.opacity).toBe(baselineOpacity);
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();

    rerender(<HyperspeedBackground {...readyProps} active={OVERVIEW} obscured={false} />);
    expect(root.style.filter).toBe('none');
    expect(root.style.opacity).toBe(baselineOpacity);
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();
  });
});

describe('HyperspeedBackground — pageVisible → pause/resume', () => {
  it('true→false에서 pause()를 한 번 부른다', async () => {
    const { rerender } = await renderReady({ pageVisible: true });
    rerender(<HyperspeedBackground {...readyProps} pageVisible={false} />);
    expect(hyperspeedSpies.pause).toHaveBeenCalledTimes(1);
    expect(hyperspeedSpies.resume).not.toHaveBeenCalled();
  });

  it('hidden 중 다른 prop 변화에는 resume()이 0회다', async () => {
    const { rerender } = await renderReady({ pageVisible: true, active: OVERVIEW });
    rerender(<HyperspeedBackground {...readyProps} pageVisible={false} active={OVERVIEW} />);
    hyperspeedSpies.resume.mockClear();

    rerender(<HyperspeedBackground {...readyProps} pageVisible={false} active="about" />);
    rerender(
      <HyperspeedBackground {...readyProps} pageVisible={false} active="about" obscured />
    );
    rerender(
      <HyperspeedBackground
        {...readyProps}
        pageVisible={false}
        active="about"
        obscured
        isTransitioning
      />
    );

    expect(hyperspeedSpies.resume).not.toHaveBeenCalled();
  });

  it('false→true에서 resume() 뒤 현재 isTransitioning=false에 맞춰 settle()을 한 번 부른다', async () => {
    const { rerender } = await renderReady({ pageVisible: true, isTransitioning: false });
    rerender(<HyperspeedBackground {...readyProps} pageVisible={false} isTransitioning={false} />);
    hyperspeedSpies.boost.mockClear();
    hyperspeedSpies.settle.mockClear();
    hyperspeedSpies.resume.mockClear();

    rerender(<HyperspeedBackground {...readyProps} pageVisible isTransitioning={false} />);

    expect(hyperspeedSpies.resume).toHaveBeenCalledTimes(1);
    expect(hyperspeedSpies.settle).toHaveBeenCalledTimes(1);
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
  });

  it('false→true에서 resume() 뒤 현재 isTransitioning=true에 맞춰 boost()를 한 번 부른다', async () => {
    const { rerender } = await renderReady({ pageVisible: true, isTransitioning: true });
    rerender(<HyperspeedBackground {...readyProps} pageVisible={false} isTransitioning />);
    hyperspeedSpies.boost.mockClear();
    hyperspeedSpies.settle.mockClear();
    hyperspeedSpies.resume.mockClear();

    rerender(<HyperspeedBackground {...readyProps} pageVisible isTransitioning />);

    expect(hyperspeedSpies.resume).toHaveBeenCalledTimes(1);
    expect(hyperspeedSpies.boost).toHaveBeenCalledTimes(1);
    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();
  });
});

describe('HyperspeedBackground — routeResolved/motionReady 게이팅', () => {
  it('routeResolved=false 동안은 loader·boost·settle·pause·resume·detectQuality 호출이 모두 0회다', () => {
    render(<HyperspeedBackground {...readyProps} routeResolved={false} />);
    expect(screen.queryByTestId('hyperspeed-canvas')).not.toBeInTheDocument();
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();
    expect(hyperspeedSpies.pause).not.toHaveBeenCalled();
    expect(hyperspeedSpies.resume).not.toHaveBeenCalled();
    expect(deviceQualitySpies.detectQuality).not.toHaveBeenCalled();
  });

  it('routeResolved=false→true가 될 때만 scene이 mount된다', async () => {
    const { rerender } = render(<HyperspeedBackground {...readyProps} routeResolved={false} />);
    expect(screen.queryByTestId('hyperspeed-canvas')).not.toBeInTheDocument();

    rerender(<HyperspeedBackground {...readyProps} routeResolved />);
    await waitFor(() => {
      expect(screen.getByTestId('hyperspeed-canvas')).toBeInTheDocument();
    });
  });

  it('motionReady=false와 최초 reducedMotion=true에서는 loader가 전혀 시작되지 않는다', () => {
    render(<HyperspeedBackground {...readyProps} motionReady={false} reducedMotion />);
    expect(screen.queryByTestId('hyperspeed-canvas')).not.toBeInTheDocument();
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();
    expect(deviceQualitySpies.detectQuality).not.toHaveBeenCalled();
  });

  it('내부에서 matchMedia를 다시 구독하지 않는다', async () => {
    const matchMediaSpy = vi.fn();
    vi.stubGlobal('matchMedia', matchMediaSpy);
    await renderReady();
    expect(matchMediaSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('HyperspeedBackground — detectQuality 초기 적용', () => {
  it('scene이 처음 mount될 때 detectQuality() 결과를 setQuality로 정확히 한 번 적용한다', async () => {
    deviceQualitySpies.detectQuality.mockResolvedValueOnce('low');
    const { rerender } = await renderReady();

    await waitFor(() => {
      expect(hyperspeedSpies.setQuality).toHaveBeenCalledWith('low');
    });
    expect(hyperspeedSpies.setQuality).toHaveBeenCalledTimes(1);

    // 이후 재렌더(섹션 전환 등)로 다시 적용되지 않는다 — 초기 1회뿐.
    // (governor가 나쁜 프레임 2회 뒤 자동으로 낮추는 동작 자체는
    // Hyperspeed/index.tsx 내부 책임이라 이 파일에서 mock으로는 관측할 수
    // 없다 — task-4-report.md 구멍 3에서 이미 실제 App으로 검증됐다.)
    rerender(<HyperspeedBackground {...readyProps} active="about" isTransitioning />);
    rerender(<HyperspeedBackground {...readyProps} active="about" isTransitioning={false} />);
    expect(hyperspeedSpies.setQuality).toHaveBeenCalledTimes(1);
  });
});

describe('HyperspeedBackground — 재마운트 금지', () => {
  it('섹션을 연속 전환해도 재마운트하지 않고 같은 인스턴스가 boost/settle을 받는다', async () => {
    const { rerender } = await renderReady();
    expect(hyperspeedSpies.mountCount).toBe(1);

    rerender(<HyperspeedBackground {...readyProps} active="about" isTransitioning />);
    rerender(<HyperspeedBackground {...readyProps} active="about" isTransitioning={false} />);
    rerender(<HyperspeedBackground {...readyProps} active="skills" isTransitioning />);
    rerender(<HyperspeedBackground {...readyProps} active="skills" isTransitioning={false} />);

    expect(hyperspeedSpies.mountCount).toBe(1);
    expect(screen.getByTestId('hyperspeed-canvas')).toBeInTheDocument();
    expect(hyperspeedSpies.boost).toHaveBeenCalledTimes(2);
    expect(hyperspeedSpies.settle).toHaveBeenCalledTimes(2);
  });
});

describe('HyperspeedBackground — 구멍 4: 컨텍스트 손실 복구 정책', () => {
  it('webglcontextlost 이후 폴백(context-lost)으로 전환하고, restored가 와도 되살리지 않는다', async () => {
    await renderReady();
    const canvas = screen.getByTestId('hyperspeed-canvas');

    // webglcontextlost는 버블링하지 않는다(MDN). canvas(자손)에서 쏘아
    // 루트의 캡처 리스너가 그래도 잡는지까지 함께 증명한다.
    fireEvent(canvas, new Event('webglcontextlost'));

    await waitFor(() => {
      expect(screen.getByTestId('hyperspeed-fallback')).toHaveAttribute(
        'data-fallback-reason',
        'context-lost'
      );
    });
    expect(screen.queryByTestId('hyperspeed-canvas')).not.toBeInTheDocument();
    expect(hyperspeedSpies.mountCount).toBe(1);

    const root = screen.getByTestId('hyperspeed-background');
    fireEvent(root, new Event('webglcontextrestored'));

    expect(screen.getByTestId('hyperspeed-fallback')).toHaveAttribute(
      'data-fallback-reason',
      'context-lost'
    );
    expect(screen.queryByTestId('hyperspeed-canvas')).not.toBeInTheDocument();
  });
});
