import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Hyperspeed, { type HyperspeedHandle } from '@/components/blocks/Hyperspeed';

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
});
