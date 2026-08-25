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
  // 파티클 형성 브리프(4차)가 tl.call()로 ParticleText.play()를 예약한다
  // (BootSequence/index.tsx 참고) — 이 메서드가 없으면 실제 gsap.timeline()
  // 타임라인 빌더가 "tl.call is not a function"으로 던져 이 파일의 모든
  // 성공 경로 테스트가 GSAP 로드 실패로 오인된다.
  call: vi.fn().mockReturnThis(),
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
  return (
    <>
      <div>
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
  // 이 파일은 GSAP 로드 타이밍만 본다 — 파티클 캔버스 준비 여부와는
  // 무관해야 한다. jsdom 기본값(getContext → null)에 맡기면 콘솔에 매번
  // "not implemented" 경고가 찍히므로 명시적으로 null을 반환해 조용히
  // "캔버스 없음" 경로를 taken한다(HyperspeedApi.test.tsx와 같은 패턴).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
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

  // 7경로 표(터널 진입 브리프 3절) — "GSAP 청크 로드 실패 → 이름이 최종
  // 상태로 드러난다". 이름(wordmarkEl)도 이제 opacity 0에서 시작하므로,
  // 역할·START와 마찬가지로 revealFinalState()가 없으면 영원히 안 보인다.
  it('로드 실패 시 역할·START·이름을 최종 상태로 강제 노출한다(이번 변경이 새로 만든 위험) — 뮤테이션 (e)', async () => {
    mockRejects();
    render(<Harness />);
    const role = screen.getByTestId('boot-role');
    const start = screen.getByTestId('boot-start');
    const wordmark = screen.getByTestId('wordmark');

    // CSS의 no-preference 오버라이드가 opacity 0으로 계속 숨기므로, 실패
    // 경로가 없으면 이 값은 영원히 ''(미지정) 또는 '0'으로 남는다.
    // 뮤테이션 (e) — revealFinalState()에서 wordmarkEl.style.opacity 대입을
    // 지우면 wordmark 쪽 expect만 FAIL한다.
    await waitFor(() => {
      expect(role.style.opacity).toBe('1');
      expect(start.style.opacity).toBe('1');
      expect(wordmark.style.opacity).toBe('1');
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
