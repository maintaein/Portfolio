import { createRef } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Hyperspeed, { App, type HyperspeedHandle } from '@/components/blocks/Hyperspeed';

// jsdom에는 WebGL이 없다(canvas npm 패키지 미설치 — node_modules/jsdom의
// HTMLCanvasElement-impl.js가 getContext를 notImplemented() 후 null로
// 반환한다). three.js WebGLRenderer는 컨텍스트를 못 얻으면 생성자에서 던진다
// (node_modules/three/src/renderers/WebGLRenderer.js:401,405). 아래 mock은
// 그 사실을 명시적으로 고정한다 — jsdom 기본 동작과 결과가 같다.
//
// 이 파일은 "WebGL을 정말 못 얻는 환경에서 안전한 no-op으로 남는가"만
// 검증한다. "품질 노브가 App 인스턴스에 정확히 적용되는가"(구멍 1·2·3·4·6·7)는
// 성공적으로 생성된 App 인스턴스가 있어야 관측 가능한데, App 생성자가 제일
// 먼저 하는 일이 new THREE.WebGLRenderer(...)라 이 파일의 환경에서는 항상
// 던진다 — beforeEach mock 유무와 무관하다. vi.mock('three'/'postprocessing')로
// WebGLRenderer 자체를 교체해야 하는데, vi.mock은 파일 단위로 호이스팅되어
// 한 파일 안에서 "mock 없음"과 "mock 있음"을 describe별로 다르게 가져갈 수
// 없다. 그래서 그 계약들은 __tests__/components/HyperspeedEngine.test.tsx로
// 분리했다(계획 일탈 — task-4-report.md 참고).
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('Hyperspeed ref API — WebGL 부재 시 안전성', () => {
  it('WebGL이 없어도 렌더가 던지지 않는다', () => {
    const ref = createRef<HyperspeedHandle>();
    expect(() => render(<Hyperspeed ref={ref} />)).not.toThrow();
  });

  it('ref로 6개 메서드를 노출한다 — bootIn은 되살아나지 않았다', () => {
    const ref = createRef<HyperspeedHandle>();
    render(<Hyperspeed ref={ref} />);
    for (const m of ['setQuality', 'pause', 'resume', 'boost', 'settle', 'isLost'] as const) {
      expect(typeof ref.current?.[m], m).toBe('function');
    }
    // 뮤테이션 (g) — 광선 부팅 안무(bootIn)를 되살리면 핸들에 다시
    // 나타나 FAIL한다. 걷어냈다는 계약을 반대 방향으로도 못박는다.
    expect(
      (ref.current as unknown as Record<string, unknown>)?.bootIn
    ).toBeUndefined();
  });

  it('WebGL 없이 메서드를 호출해도 던지지 않는다', () => {
    const ref = createRef<HyperspeedHandle>();
    render(<Hyperspeed ref={ref} />);
    expect(() => {
      ref.current?.pause();
      ref.current?.resume();
      ref.current?.boost();
      ref.current?.settle();
      ref.current?.setQuality('low');
    }).not.toThrow();
  });

  it('WebGL이 없으면 isLost()는 false를 돌려준다 — 예외 대신 안전한 기본값', () => {
    const ref = createRef<HyperspeedHandle>();
    render(<Hyperspeed ref={ref} />);
    expect(ref.current?.isLost()).toBe(false);
  });

  // loadAssets()가 비동기라 그 사이에 언마운트되면 dispose()가 먼저 끝난다.
  // 뒤늦게 도착한 init()이 죽은 객체 위에서 돌면 composer가 null이라 던진다.
  // 개발 StrictMode의 이중 마운트에서 매번 재현됐다.
  it('언마운트 뒤 도착한 init()이 던지지 않는다', async () => {
    const { unmount } = render(<Hyperspeed />);
    unmount();

    // dispose()가 끝난 뒤 loadAssets의 then이 도착하는 순서를 만든다.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // 가드가 없으면 unhandled rejection으로 이 테스트가 붉어진다.
    expect(true).toBe(true);
  });
});

// 위 컴포넌트 경로는 이 파일의 환경(WebGL 없음)에서 new App()의
// THREE.WebGLRenderer 생성이 항상 먼저 던진다. 그래서 loadAssets 이후의
// dispose→init 경합 자체가 이 파일 안에서는 재현되지 않는다. 가드를
// 지워도 위 테스트는 그대로 통과한다(실측: 뮤테이션 주입으로 확인, task-1
// 리포트 참고). 실제 가드 계약은 App.prototype.init을 가짜 this로 직접
// 호출해 양방향으로 고정한다.
describe('App.prototype.init 초기화 가드(disposed 상태에 따른 분기)', () => {
  function fakeApp(disposed: boolean) {
    return {
      disposed,
      initPasses: vi.fn(),
      road: { init: vi.fn() },
      setQuality: vi.fn(),
      container: { addEventListener: vi.fn() },
      tick: vi.fn()
    };
  }

  it('disposed=true면 init()이 초기화를 전혀 진행하지 않는다', () => {
    const app = fakeApp(true);
    App.prototype.init.call(app as never);
    expect(app.initPasses).not.toHaveBeenCalled();
    expect(app.road.init).not.toHaveBeenCalled();
    expect(app.tick).not.toHaveBeenCalled();
  });

  it('disposed=false면 init()이 평소대로 초기화를 진행한다', () => {
    const app = fakeApp(false);
    App.prototype.init.call(app as never);
    expect(app.initPasses).toHaveBeenCalledTimes(1);
    expect(app.road.init).toHaveBeenCalledTimes(1);
    expect(app.tick).toHaveBeenCalledTimes(1);
  });
});
