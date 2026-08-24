import { useRef } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BootSequence, {
  type BootSequenceProps,
} from '@/components/sections/BootSequence';

// BootSequence.test.tsx는 실제 gsap으로 안무(seek 등)를 검증한다. 이 파일은
// "GSAP을 어떻게 기다리는지"— 로드 시도 게이팅·로드 실패·언마운트 뒤 늦은
// 도착 — 만 본다. BootSequence 자신은 더 이상 '@/lib/gsap'을 정적으로 참조하지
// 않으므로(런타임 의존은 effect 안의 동적 import뿐), 매 테스트가
// vi.resetModules() + vi.doMock()으로 그 동적 import 하나만 원하는 대로
// 바꿔치기한다 — 파일 전체에 공유되는 hoisted vi.mock 하나로 gate·실패 여부를
// 흘려보내려 했더니 두 번째 성공 이후의 import()가 팩토리를 다시 타지 않고
// 캐시된 이전 결과를 재사용해(실측: attempted 스파이가 0회로 남았다) 늦은
// 테스트들이 항상 통과해버리는 구멍이 있었다 — per-test doMock으로 바꿔
// 고쳤다.
const attempted = vi.fn();
const timelineFn = vi.fn(() => ({
  set: vi.fn().mockReturnThis(),
  to: vi.fn().mockReturnThis(),
  fromTo: vi.fn().mockReturnThis(),
  kill: vi.fn(),
}));
const registerGsapFn = vi.fn();

function mockSuccess() {
  vi.doMock('@/lib/gsap', () => {
    attempted();
    return {
      gsap: { timeline: timelineFn },
      registerGsap: registerGsapFn,
      Flip: {},
      SITE_EASE: 'site',
    };
  });
}

function mockRejects() {
  vi.doMock('@/lib/gsap', () => {
    attempted();
    throw new Error('gsap 청크 로드 실패(테스트 주입)');
  });
}

function mockGated(gate: Promise<void>) {
  vi.doMock('@/lib/gsap', async () => {
    attempted();
    await gate;
    return {
      gsap: { timeline: timelineFn },
      registerGsap: registerGsapFn,
      Flip: {},
      SITE_EASE: 'site',
    };
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function Harness({
  active = 'overview',
  routeResolved = true,
  motionReady = true,
  reducedMotion = false,
  sceneReady = true,
  onStart = vi.fn(),
}: Partial<BootSequenceProps>) {
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  const wordmarkScaleRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={wordmarkScaleRef}>
        <button ref={wordmarkRef} data-testid="wordmark">
          KIM TAEIN
        </button>
      </div>
      <BootSequence
        active={active}
        routeResolved={routeResolved}
        motionReady={motionReady}
        reducedMotion={reducedMotion}
        sceneReady={sceneReady}
        wordmarkRef={wordmarkRef}
        wordmarkScaleRef={wordmarkScaleRef}
        onStart={onStart}
      />
    </>
  );
}

beforeEach(() => {
  vi.resetModules();
  attempted.mockClear();
  timelineFn.mockClear();
  registerGsapFn.mockClear();
});

afterEach(() => {
  vi.doUnmock('@/lib/gsap');
  vi.restoreAllMocks();
});

describe('BootSequence — GSAP 동적 로드 타이밍', () => {
  it('eligible이면 @/lib/gsap 로드를 시도한다(양성 대조 — 아래 음성 테스트들이 실제로 뭔가 검증한다는 증거)', async () => {
    mockSuccess();
    render(<Harness />);
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));
  });

  it('reducedMotion=true면 @/lib/gsap 로드를 시도조차 하지 않는다', async () => {
    mockSuccess();
    render(<Harness reducedMotion />);
    // 음성 결과라 "된다"를 기다리는 waitFor를 쓸 수 없다 — 실제로 몇 tick을
    // 흘려보낸 뒤 여전히 호출되지 않았음을 확인한다.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(attempted).not.toHaveBeenCalled();
  });

  it('routeResolved=false면 로드를 시도하지 않는다', async () => {
    mockSuccess();
    render(<Harness routeResolved={false} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(attempted).not.toHaveBeenCalled();
  });

  it('motionReady=false면 로드를 시도하지 않는다', async () => {
    mockSuccess();
    render(<Harness motionReady={false} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(attempted).not.toHaveBeenCalled();
  });

  it('로드 실패 시 역할·START를 최종 상태로 강제 노출한다(이번 변경이 새로 만든 위험)', async () => {
    mockRejects();
    render(<Harness />);
    const role = screen.getByTestId('boot-role');
    const start = screen.getByTestId('boot-start');

    // CSS의 no-preference 오버라이드가 opacity 0으로 계속 숨기므로, 실패
    // 경로가 없으면 이 값은 영원히 ''(미지정) 또는 '0'으로 남는다.
    await waitFor(() => {
      expect(role.style.opacity).toBe('1');
      expect(start.style.opacity).toBe('1');
    });
    expect(timelineFn).not.toHaveBeenCalled();
  });

  it('언마운트 뒤 늦게 도착한 모듈에는 timeline을 걸지 않는다(죽은 노드에 애니메이션을 붙이지 않는다)', async () => {
    const gate = deferred();
    mockGated(gate.promise);
    const { unmount } = render(<Harness />);
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));

    unmount();
    gate.resolve();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(timelineFn).not.toHaveBeenCalled();
  });
});
