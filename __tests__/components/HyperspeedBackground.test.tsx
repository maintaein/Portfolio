import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HyperspeedBackground, {
  type HyperspeedBackgroundProps,
} from '@/components/blocks/HyperspeedBackground';
import { OVERVIEW } from '@/hooks/useSectionNav';
import { HERO_DIM_MS, HYPERSPEED_BOOST_TIME_SCALE } from '@/lib/constants';
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
  setIdleScale: vi.fn(),
  setDensity: vi.fn(),
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
        setIdleScale: hyperspeedSpies.setIdleScale,
        setDensity: hyperspeedSpies.setDensity,
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

// hero: 'done'. 이 파일 대부분의 describe는 첫 진입 hero가 끝난 "정상
// 상태"의 boost/settle, pause/resume, detectQuality 등을 다룬다. hero 단계
// 자체는 별도 describe에서 pending/surge/settle을 명시적으로 주며 검증한다.
const readyProps: HyperspeedBackgroundProps = {
  active: OVERVIEW,
  isTransitioning: false,
  obscured: false,
  pageVisible: true,
  routeResolved: true,
  motionReady: true,
  reducedMotion: false,
  hero: 'done',
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

describe('HyperspeedBackground 밝기(overview 100%, 섹션 35%)와 obscured', () => {
  // 0.3에서는 광선이 안 보여 0.55까지 올렸다가, 이번엔 배경이 본문을 이겨서
  // 0.35로 내렸다. 전 섹션 공통이다.
  it('overview는 배경 100%, 콘텐츠 섹션은 35%다', async () => {
    const { rerender } = await renderReady({ active: OVERVIEW });
    const root = screen.getByTestId('hyperspeed-background');
    expect(root.style.opacity).toBe('1');

    rerender(<HyperspeedBackground {...readyProps} active="about" />);
    expect(root.style.opacity).toBe('0.35');
  });

  // obscured는 초점과 밝기를 같이 뺀다. 블러만 걸면 배경이 사라지는 속도가
  // 곧 모달 셸 배경이 차오르는 속도라, 배경이 제 걸음 없이 툭 꺼진 것처럼
  // 보인다. 다만 0으로 떨어뜨리지는 않는다 - 흐름이 죽으면 정지 이미지가 된다.
  // 돌아올 때 정확히 baseline으로 복귀하는 것까지 양방향으로 못박는다.
  it('obscured=false→true→false는 초점과 밝기를 같이 빼고 정확히 되돌린다', async () => {
    const { rerender } = await renderReady({ active: OVERVIEW, obscured: false });
    const root = screen.getByTestId('hyperspeed-background');
    const baselineOpacity = Number(root.style.opacity);
    expect(baselineOpacity).toBeGreaterThan(0);
    expect(root.style.filter).toBe('none');
    hyperspeedSpies.boost.mockClear();
    hyperspeedSpies.settle.mockClear();

    rerender(<HyperspeedBackground {...readyProps} active={OVERVIEW} obscured />);
    expect(root.style.filter).toMatch(/^blur\((\d|\.)+px\)$/);
    // 물러나되 꺼지지는 않는다. 양옆을 다 막아야 계수가 1이나 0으로 새는 것을 잡는다
    const obscuredOpacity = Number(root.style.opacity);
    expect(obscuredOpacity).toBeGreaterThan(0);
    expect(obscuredOpacity).toBeLessThan(baselineOpacity);
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();

    rerender(<HyperspeedBackground {...readyProps} active={OVERVIEW} obscured={false} />);
    expect(root.style.filter).toBe('none');
    expect(Number(root.style.opacity)).toBe(baselineOpacity);
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
    expect(hyperspeedSpies.settle).not.toHaveBeenCalled();
  });

  // 밝기와 초점이 서로 다른 길이로 움직이면 초점이 먼저 풀리고 밝기가
  // 뒤따라, 배경이 한 몸이 아니라 두 몸으로 움직인다.
  it('밝기와 초점의 전환 길이가 같다 - 들어갈 때도 나올 때도', async () => {
    const { rerender } = await renderReady({ active: OVERVIEW, obscured: false });
    const root = screen.getByTestId('hyperspeed-background');

    const durations = () =>
      root.style.transition
        .split(',')
        .map((part) => part.trim())
        .map((part) => {
          const [property, ...rest] = part.split(/\s+/);
          return { property, timing: rest.join(' ') };
        });

    for (const obscured of [true, false]) {
      rerender(
        <HyperspeedBackground {...readyProps} active={OVERVIEW} obscured={obscured} />
      );
      const parts = durations();
      const opacityPart = parts.find((part) => part.property === 'opacity');
      const filterPart = parts.find((part) => part.property === 'filter');
      expect(opacityPart).toBeDefined();
      expect(filterPart).toBeDefined();
      expect(filterPart!.timing).toBe(opacityPart!.timing);
    }
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

// 첫 진입 hero. HomeClient가 소유한 단계를 받아 밝기, 초점, 배율, 밀도로
// 반응한다. 최초 overview(pending)는 검은 화면이고 surge에서 흐림이 풀리며
// 오버뷰 밝기로 떠올랐다가 settle에서 섹션 밝기로 내려간다.
describe('HyperspeedBackground. 첫 진입 hero 단계', () => {
  // 뮤테이션 (a). heroState 계산에서 pending을 무시하고 항상 보이게 하면
  // opacity가 '1'로 나와 FAIL해야 한다.
  it('pending + overview + 모션 허용이면 opacity 0, 블러, 배율과 밀도가 낮다', async () => {
    await renderReady({ active: OVERVIEW, hero: 'pending' });
    const root = screen.getByTestId('hyperspeed-background');
    expect(root.style.opacity).toBe('0');
    expect(root).toHaveAttribute('data-hyperspeed-hero', 'pending');
    // 모달을 닫고 섹션으로 돌아올 때와 같은 블러다. surge에서 이게 풀리며
    // 밝기가 차오르는 것이 첫 진입의 등장 그 자체다.
    expect(root.style.filter).toBe('blur(8px)');
    expect(hyperspeedSpies.setIdleScale).toHaveBeenLastCalledWith(0.05);
    expect(hyperspeedSpies.setDensity).toHaveBeenLastCalledWith(0.3);
  });

  // 뮤테이션: surge의 밝기를 섹션 값으로 두면 첫 진입에서 어두워지는
  // 구간이 사라진다. 섹션(about)으로 가는 중인데도 오버뷰 밝기여야 한다.
  it('surge면 블러가 풀리고 오버뷰 밝기로 떠오르며 배율은 전환 배속, 밀도는 2다', async () => {
    const { rerender } = await renderReady({ active: OVERVIEW, hero: 'pending' });
    rerender(
      <HyperspeedBackground {...readyProps} active="about" isTransitioning hero="surge" />
    );
    const root = screen.getByTestId('hyperspeed-background');
    expect(root).toHaveAttribute('data-hyperspeed-hero', 'surge');
    expect(root.style.opacity).toBe('1');
    expect(root.style.filter).toBe('none');
    expect(hyperspeedSpies.setIdleScale).toHaveBeenLastCalledWith(
      HYPERSPEED_BOOST_TIME_SCALE
    );
    expect(hyperspeedSpies.setDensity).toHaveBeenLastCalledWith(2);
  });

  // 어두워지는 전환의 지속은 HERO_DIM_MS다. 이 숫자가 --hero-delay의
  // 뒷부분이라 셸과 섹션이 들어오는 시각과 한 몸이다.
  it('settle이면 섹션 밝기로 HERO_DIM_MS 동안 내려가고 배율과 밀도는 섹션 기본치다', async () => {
    const { rerender } = await renderReady({ active: 'about', hero: 'surge' });
    rerender(<HyperspeedBackground {...readyProps} active="about" hero="settle" />);
    const root = screen.getByTestId('hyperspeed-background');
    expect(root).toHaveAttribute('data-hyperspeed-hero', 'settle');
    expect(root.style.opacity).toBe('0.35');
    expect(root.style.transition).toContain(`opacity ${HERO_DIM_MS}ms`);
    expect(hyperspeedSpies.setIdleScale).toHaveBeenLastCalledWith(0.1);
    expect(hyperspeedSpies.setDensity).toHaveBeenLastCalledWith(1);
  });

  it('done + overview면 hero 속성이 없고 overview 밝기(1)다', async () => {
    await renderReady({ active: OVERVIEW, hero: 'done' });
    const root = screen.getByTestId('hyperspeed-background');
    expect(root).not.toHaveAttribute('data-hyperspeed-hero');
    expect(root.style.opacity).toBe('1');
    expect(hyperspeedSpies.setIdleScale).toHaveBeenLastCalledWith(0.3);
    expect(hyperspeedSpies.setDensity).toHaveBeenLastCalledWith(1);
  });

  // hero 구간의 속도는 idleScale 하나가 몬다. boost가 얹히면 올라가는
  // 구간이 상한(오버뷰 체류 속도 0.3)을 넘고, settle에서 내려가야 하는데
  // boost는 아직 오르는 중이라 감속이 보이지 않는다. 뮤테이션: boost 호출에서
  // hero 조건을 빼면 첫 줄에서 FAIL한다.
  it('surge와 settle 동안에는 전환이 시작돼도 boost 대신 settle을 부른다', async () => {
    const { rerender } = await renderReady({
      active: OVERVIEW,
      hero: 'pending',
      isTransitioning: false,
    });
    hyperspeedSpies.boost.mockClear();
    hyperspeedSpies.settle.mockClear();

    rerender(
      <HyperspeedBackground {...readyProps} active="about" isTransitioning hero="surge" />
    );
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
    expect(hyperspeedSpies.settle).toHaveBeenCalledTimes(1);
    // 관측 속성도 엔진을 따라간다. 전환 중이지만 boost가 아니다.
    expect(screen.getByTestId('hyperspeed-background')).toHaveAttribute(
      'data-hyperspeed-motion',
      'slow'
    );

    rerender(
      <HyperspeedBackground
        {...readyProps}
        active="about"
        isTransitioning={false}
        hero="settle"
      />
    );
    expect(hyperspeedSpies.boost).not.toHaveBeenCalled();
  });

  // hero가 끝난 뒤의 전환은 평소와 같아야 한다. 억제가 done까지 새면 이후
  // 모든 섹션 전환에서 가속이 사라진다.
  it('done 뒤의 전환에서는 다시 boost를 부른다', async () => {
    const { rerender } = await renderReady({
      active: 'about',
      hero: 'done',
      isTransitioning: false,
    });
    hyperspeedSpies.boost.mockClear();

    rerender(
      <HyperspeedBackground {...readyProps} active="skills" isTransitioning hero="done" />
    );
    expect(hyperspeedSpies.boost).toHaveBeenCalledTimes(1);
  });

  // 씬 로드는 단계와 무관하게 이미 진행 중이어야 한다. 뮤테이션 (c) 대응:
  // showScene 계산에 hero를 끼워 넣으면 pending에서 canvas가 없어 FAIL한다.
  it('pending이어도 씬(canvas)은 이미 mount돼 있다. 준비는 일찍, 노출만 늦다', async () => {
    await renderReady({ active: OVERVIEW, hero: 'pending' });
    expect(screen.getByTestId('hyperspeed-canvas')).toBeInTheDocument();
  });

  // 딥링크. HomeClient가 done으로 보내기 전 한 커밋 동안 pending인데 이미
  // 섹션이다. 그때도 마스크를 걸거나 숨기면 안 된다.
  it('pending이라도 active가 overview가 아니면 마스크 속성 없이 곧바로 섹션 밝기(0.35)다', async () => {
    await renderReady({ active: 'about', hero: 'pending' });
    const root = screen.getByTestId('hyperspeed-background');
    expect(root).not.toHaveAttribute('data-hyperspeed-hero');
    expect(root.style.opacity).toBe('0.35');
  });

  it('reducedMotion이면 어느 단계든 마스크 속성이 없고 곧바로 최종 밝기다', () => {
    // reducedMotion에서는 씬을 아예 마운트하지 않으므로(정적 폴백) canvas를
    // 기다리는 renderReady를 쓰면 안 된다. 관찰 대상은 래퍼다.
    for (const hero of ['pending', 'surge', 'settle'] as const) {
      const { unmount } = render(
        <HyperspeedBackground {...readyProps} active={OVERVIEW} reducedMotion hero={hero} />
      );
      const root = screen.getByTestId('hyperspeed-background');
      expect(root).not.toHaveAttribute('data-hyperspeed-hero');
      expect(root.style.opacity).toBe('1');
      unmount();
    }
  });

  // 2차 감사 지적. 래퍼에 전환이 없으면 씬이 풀리는 순간 캔버스가 튀어
  // 들어온다. 뮤테이션 (b). transition을 지우면 FAIL한다. 밝기와 초점은
  // 같은 지속이어야 배경이 한 몸으로 움직인다.
  it('모션 허용이면 밝기와 초점에 같은 지속의 트랜지션이 걸려 있다', async () => {
    await renderReady({ active: OVERVIEW, hero: 'pending' });
    const root = screen.getByTestId('hyperspeed-background');
    expect(root.style.transition).toContain(
      'opacity var(--animate-duration-slow) ease-out'
    );
    expect(root.style.transition).toContain(
      'filter var(--animate-duration-slow) ease-out'
    );
  });

  it('reducedMotion이면 트랜지션 자체를 걸지 않는다(즉시 최종 상태)', () => {
    render(
      <HyperspeedBackground {...readyProps} active={OVERVIEW} reducedMotion hero="pending" />
    );
    const root = screen.getByTestId('hyperspeed-background');
    expect(root.style.transition).toBe('none');
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

  // 실기기 회귀. "한 번 잃으면 폴백 고정"이 곧 "탭을 한 번 전환하면 배경이
  // 새로고침 전까지 영영 안 돌아옴"으로 나타났다. showScene은 ready와
  // reducedMotion과 contextLost의 곱인데 앞의 둘은 한 번 정해지면 안 바뀌므로
  // 세션 중간에 배경을 끄는 경로는 contextLost 하나뿐이다.
  it('손실 뒤 일정 시간이 지나면 씬을 다시 세운다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await renderReady();
      fireEvent(screen.getByTestId('hyperspeed-canvas'), new Event('webglcontextlost'));

      await waitFor(() => {
        expect(screen.getByTestId('hyperspeed-fallback')).toBeInTheDocument();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('hyperspeed-canvas')).toBeInTheDocument();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  // 반대 방향. 무한 재생성을 막는 한도가 실제로 있는지 — 없으면 손실이
  // 반복되는 기기에서 씬을 계속 다시 만든다.
  it('재시도 한도를 넘으면 폴백에 고정된다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await renderReady();

      // 한도(3)보다 한 번 더 잃는다.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        fireEvent(screen.getByTestId('hyperspeed-canvas'), new Event('webglcontextlost'));
        await waitFor(() => {
          expect(screen.getByTestId('hyperspeed-fallback')).toBeInTheDocument();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(5_000);
        });

        if (attempt < 3) {
          await waitFor(() => {
            expect(screen.getByTestId('hyperspeed-canvas')).toBeInTheDocument();
          });
        }
      }

      expect(screen.getByTestId('hyperspeed-fallback')).toHaveAttribute(
        'data-fallback-reason',
        'context-lost'
      );
      expect(screen.queryByTestId('hyperspeed-canvas')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

// 계획 6 Task 5a. Playwright가 픽셀이나 내부 state 대신 붙잡을 관측 속성.
// 루트(hyperspeed-background)는 폴백일 때도 살아 있는 유일한 요소라 여기에
// 단다. 우선순위 두 줄(fallback이 boost·slow보다 우선, obscured가 overview·
// section보다 우선)을 반드시 양쪽 다 잠근다.
describe('HyperspeedBackground. data-hyperspeed-motion·data-hyperspeed-visibility 관측 속성', () => {
  it('씬이 뜬 상태에서 전환 중이면 boost다', async () => {
    await renderReady({ isTransitioning: true });
    expect(screen.getByTestId('hyperspeed-background')).toHaveAttribute(
      'data-hyperspeed-motion',
      'boost'
    );
  });

  it('씬이 뜬 상태에서 전환이 끝났으면 slow다', async () => {
    await renderReady({ isTransitioning: false });
    expect(screen.getByTestId('hyperspeed-background')).toHaveAttribute(
      'data-hyperspeed-motion',
      'slow'
    );
  });

  it('reduced-motion이면 전환 중이어도 fallback이 boost보다 우선한다', () => {
    render(<HyperspeedBackground {...readyProps} reducedMotion isTransitioning />);
    expect(screen.getByTestId('hyperspeed-background')).toHaveAttribute(
      'data-hyperspeed-motion',
      'fallback'
    );
  });

  it('준비 전(routeResolved=false)이면 fallback이다', () => {
    render(<HyperspeedBackground {...readyProps} routeResolved={false} />);
    expect(screen.getByTestId('hyperspeed-background')).toHaveAttribute(
      'data-hyperspeed-motion',
      'fallback'
    );
  });

  it('준비 전(motionReady=false)이면 fallback이다', () => {
    render(<HyperspeedBackground {...readyProps} motionReady={false} />);
    expect(screen.getByTestId('hyperspeed-background')).toHaveAttribute(
      'data-hyperspeed-motion',
      'fallback'
    );
  });

  it('overview에 있으면 visibility가 overview다', async () => {
    await renderReady({ active: OVERVIEW });
    expect(screen.getByTestId('hyperspeed-background')).toHaveAttribute(
      'data-hyperspeed-visibility',
      'overview'
    );
  });

  it('섹션에 있으면 visibility가 section이다', async () => {
    await renderReady({ active: 'about' });
    expect(screen.getByTestId('hyperspeed-background')).toHaveAttribute(
      'data-hyperspeed-visibility',
      'section'
    );
  });

  it('obscured가 true면 overview에서도 obscured가 overview보다 우선한다', async () => {
    await renderReady({ active: OVERVIEW, obscured: true });
    expect(screen.getByTestId('hyperspeed-background')).toHaveAttribute(
      'data-hyperspeed-visibility',
      'obscured'
    );
  });

  it('obscured가 true면 섹션에서도 obscured가 section보다 우선한다', async () => {
    await renderReady({ active: 'about', obscured: true });
    expect(screen.getByTestId('hyperspeed-background')).toHaveAttribute(
      'data-hyperspeed-visibility',
      'obscured'
    );
  });
});
