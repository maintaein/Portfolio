import { createRef, Profiler } from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrameQualityGovernor } from '@/lib/deviceQuality';

// jsdom에는 WebGL이 없다 — new THREE.WebGLRenderer(...)는 항상 던진다
// (HyperspeedApi.test.tsx 상단 주석 참고). 이 파일이 검증하는 계약들
// (품질 노브 적용, DPR cap, governor 연동, isLost, 팔레트)은 App 인스턴스가
// 실제로 존재해야 관측 가능하다. 그래서 THREE.WebGLRenderer와 postprocessing의
// EffectComposer/EffectPass/RenderPass/BloomEffect/SMAAEffect를 모듈
// 경계에서 가짜로 바꿔 App 생성 자체는 성공시킨다. Mesh/Geometry/Material/
// Camera/Scene 등 나머지 three.js 객체는 진짜다 — GPU 없이도 생성 가능한
// 순수 JS 객체라 실제 조립 로직(광선 개수, mesh 재생성 등)을 진짜로 검증한다.
//
// 이 mock 경계 밖(GPU가 실제로 몇 프레임을 그리는지, bloom 해상도가 픽셀에
// 어떻게 나오는지)은 jsdom으로 증명 불가 — task-4-report.md의 「jsdom 한계」
// 절에 실기기 확인 필요 항목으로 적었다.
const {
  MockWebGLRenderer,
  mockRendererInstances,
  MockEffectComposer,
  mockComposerInstances,
  MockEffectPass,
  MockRenderPass,
  MockBloomEffect,
  mockBloomEffectCalls,
  MockSMAAEffect
} = vi.hoisted(() => {
  class MockEffectPass {
    camera: unknown;
    effects: unknown[];
    renderToScreen = false;
    dispose = vi.fn();
    constructor(camera: unknown, ...effects: unknown[]) {
      this.camera = camera;
      this.effects = effects;
    }
  }

  class MockRenderPass {
    renderToScreen = false;
    dispose = vi.fn();
    scene: unknown;
    camera: unknown;
    constructor(scene: unknown, camera: unknown) {
      this.scene = scene;
      this.camera = camera;
    }
  }

  const mockBloomEffectCalls: Array<{ resolutionScale: number }> = [];
  class MockBloomEffect {
    options: { resolutionScale: number };
    constructor(options: { resolutionScale: number }) {
      this.options = options;
      mockBloomEffectCalls.push(options);
    }
  }

  class MockSMAAEffect {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
    static get searchImageDataURL() {
      return 'data:,';
    }
    static get areaImageDataURL() {
      return 'data:,';
    }
  }

  const mockComposerInstances: InstanceType<typeof MockEffectComposer>[] = [];
  class MockEffectComposer {
    renderer: unknown;
    passes: unknown[] = [];
    addPass = vi.fn((pass: unknown, index?: number) => {
      if (typeof index === 'number') {
        this.passes.splice(index, 0, pass);
      } else {
        this.passes.push(pass);
      }
    });
    removePass = vi.fn((pass: unknown) => {
      this.passes = this.passes.filter(p => p !== pass);
    });
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    constructor(renderer: unknown) {
      this.renderer = renderer;
      mockComposerInstances.push(this);
    }
  }

  const mockRendererInstances: InstanceType<typeof MockWebGLRenderer>[] = [];
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    getPixelRatio = vi.fn(() => 1);
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    constructor() {
      mockRendererInstances.push(this);
    }
  }

  return {
    MockWebGLRenderer,
    mockRendererInstances,
    MockEffectComposer,
    mockComposerInstances,
    MockEffectPass,
    MockRenderPass,
    MockBloomEffect,
    mockBloomEffectCalls,
    MockSMAAEffect
  };
});

vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: MockWebGLRenderer };
});

vi.mock('postprocessing', () => ({
  EffectComposer: MockEffectComposer,
  EffectPass: MockEffectPass,
  RenderPass: MockRenderPass,
  BloomEffect: MockBloomEffect,
  SMAAEffect: MockSMAAEffect,
  SMAAPreset: { MEDIUM: 'medium' }
}));

// 위 vi.mock이 적용된 뒤에 import해야 한다(vi.mock은 파일 상단으로
// 호이스팅되므로 실제로는 순서가 문제되지 않지만 가독성을 위해 아래에 둔다).
const { default: Hyperspeed, App, defaultOptions, QUALITY_PROFILES } = await import('@/components/blocks/Hyperspeed');
const { distortions } = await import('@/components/blocks/Hyperspeed/distortions');
type HyperspeedHandle = import('@/components/blocks/Hyperspeed').HyperspeedHandle;
type HyperspeedOptions = import('@/components/blocks/Hyperspeed').HyperspeedOptions;

function createContainer(width = 800, height = 600): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
  return el;
}

function buildOptions(overrides: Partial<HyperspeedOptions> = {}): HyperspeedOptions {
  const options: HyperspeedOptions = {
    ...defaultOptions,
    ...overrides,
    colors: { ...defaultOptions.colors, ...overrides.colors }
  };
  if (typeof options.distortion === 'string') {
    options.distortion = distortions[options.distortion];
  }
  return options;
}

// requestAnimationFrame/cancelAnimationFrame을 수동으로 진행 가능한 큐로
// 바꾼다 — governor가 120개 표본 windows를 요구해 실제 rAF 타이밍을 기다릴
// 수 없다. dispose()가 실제로 cancelAnimationFrame을 부르는지도 이 큐로
// 직접 관측한다(Hole 3 "unmount 뒤 예약 rAF 0개").
let rafQueue: Array<{ id: number; cb: (t: number) => void }>;
let rafIdSeq: number;

function fireNextFrame(timestamp: number) {
  const next = rafQueue.shift();
  if (!next) throw new Error('예약된 rAF가 없다');
  next.cb(timestamp);
}

// App.loadAssets()는 SMAA search/area 이미지의 load 이벤트를 기다린다.
// jsdom은 canvas npm 패키지 없이는 실제 이미지 디코딩을 하지 않아 data: URI를
// 넣어도 load가 저절로 안 터진다 — src를 세팅하면 다음 microtask에 load를
// 쏴 주는 가짜 Image로 바꿔 결정적으로 resolve시킨다.
class FakeImage {
  private loadHandlers: Array<() => void> = [];
  get src() {
    return '';
  }
  set src(_value: string) {
    queueMicrotask(() => {
      this.loadHandlers.forEach(cb => cb.call(this as unknown as HTMLImageElement));
    });
  }
  addEventListener(type: string, cb: () => void) {
    if (type === 'load') this.loadHandlers.push(cb);
  }
  removeEventListener() {}
}

async function flushMicrotasks() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  mockRendererInstances.length = 0;
  mockComposerInstances.length = 0;
  mockBloomEffectCalls.length = 0;
  rafQueue = [];
  rafIdSeq = 0;

  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: (t: number) => void) => {
      rafIdSeq += 1;
      rafQueue.push({ id: rafIdSeq, cb });
      return rafIdSeq;
    })
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => {
      rafQueue = rafQueue.filter(entry => entry.id !== id);
    })
  );
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('구멍 1 — setQuality가 App을 재생성하지 않는다', () => {
  it('dispose를 부르지 않고, App을 새로 만들지 않고, canvas는 하나로 유지된다', () => {
    const disposeSpy = vi.spyOn(App.prototype, 'dispose');
    const loadAssetsSpy = vi.spyOn(App.prototype, 'loadAssets');

    const ref = createRef<HyperspeedHandle>();
    const { container } = render(<Hyperspeed ref={ref} />);

    // 마운트에서 App이 정확히 한 번 만들어졌다(loadAssets은 생성 직후
    // 한 번만 불린다 — 결과 Promise가 언제 resolve되는지와 무관하다).
    expect(loadAssetsSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('canvas').length).toBe(1);

    ref.current?.setQuality('low');
    ref.current?.setQuality('medium');
    ref.current?.setQuality('high');

    // 재생성됐다면 dispose가 최소 한 번 불렸을 것이고 loadAssets도 다시
    // 불렸을 것이다 — 원본은 [effectOptions] 의존성 때문에 매번 그랬다.
    expect(disposeSpy).not.toHaveBeenCalled();
    expect(loadAssetsSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('canvas').length).toBe(1);
  });
});

// task-4-brief.md가 확정한 표를 그대로 하드코딩한다. QUALITY_PROFILES에서
// 값을 읽어 기대값을 만들면 presets.ts 자체가 잘못된 숫자로 바뀌어도(뮤테이션
// (b)/(c)) App이 "그 잘못된 값을 충실히 적용"하기만 하면 테스트가 항상
// 통과해버린다 — 실제로 처음 그렇게 썼다가 뮤테이션 (c)가 안 잡혀서 고쳤다.
const EXPECTED_PROFILES = {
  high: { lightPairsPerRoadWay: 40, totalSideLightSticks: 20, maxDpr: 0, resolutionScale: 1.0, bloom: true, renderInterval: 1 },
  medium: { lightPairsPerRoadWay: 40, totalSideLightSticks: 20, maxDpr: 1.0, resolutionScale: 1.0, bloom: true, renderInterval: 1 },
  low: { lightPairsPerRoadWay: 20, totalSideLightSticks: 10, maxDpr: 1.0, resolutionScale: 1.0, bloom: false, renderInterval: 2 }
} as const;

describe('구멍 2 — profile의 여섯 노브를 정확히 적용한다', () => {
  it.each(['high', 'medium', 'low'] as const)('%s profile의 여섯 노브를 정확히 적용한다', tier => {
    const expected = EXPECTED_PROFILES[tier];
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    app.setQuality(tier);

    // 1) 광선 수 — mesh의 instanceCount로 직접 관측한다(GPU 없이도 순수
    // JS 객체라 검증 가능하다).
    expect(app.leftCarLights.mesh?.geometry.instanceCount).toBe(expected.lightPairsPerRoadWay * 2);
    expect(app.rightCarLights.mesh?.geometry.instanceCount).toBe(expected.lightPairsPerRoadWay * 2);
    // 2) side light 수
    expect(app.leftSticks.mesh?.geometry.instanceCount).toBe(expected.totalSideLightSticks);

    // 3) maxDpr — renderer에 실제로 적용된 마지막 pixel ratio
    const renderer = mockRendererInstances[0];
    const expectedDpr = expected.maxDpr === 0 ? 1 : Math.min(1, expected.maxDpr);
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(expectedDpr);

    // 4) bloom — pass 존재 여부
    expect(Boolean(app.bloomPass)).toBe(expected.bloom);

    // 5) resolutionScale — bloom이 켜져 있을 때만 BloomEffect 생성자 인자로 확인
    if (expected.bloom) {
      const lastCall = mockBloomEffectCalls[mockBloomEffectCalls.length - 1];
      expect(lastCall.resolutionScale).toBe(expected.resolutionScale);
    }

    // 6) renderInterval — App이 실제로 물고 있는 값
    expect(app.qualityProfile.renderInterval).toBe(expected.renderInterval);

    // QUALITY_PROFILES 자체도 이 표와 같아야 한다 — App이 profile을 참조로
    // 그대로 물고 있어 위 검증과 겹치는 부분이 있지만, 필드 하나라도 표에서
    // 벗어나면 여기서 즉시 드러난다.
    expect(QUALITY_PROFILES[tier]).toEqual(expected);
  });

  // 자가 뮤테이션으로 찾은 구멍: 현재 표는 세 tier의 resolutionScale이 전부
  // 1.0이라 rebuildBloomPass 안에서 profile.resolutionScale 대신 1을 그냥
  // 박아 넣어도 위 it.each가 못 잡는다(값이 우연히 같다). private 메서드를
  // 합성 profile로 직접 불러 배선 자체를 표 값과 무관하게 검증한다.
  it('resolutionScale은 표 값이 아니라 profile.resolutionScale을 그대로 BloomEffect에 넘긴다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    const applyQualityProfile = (
      app as unknown as { applyQualityProfile: (profile: (typeof QUALITY_PROFILES)['high']) => void }
    ).applyQualityProfile.bind(app);

    applyQualityProfile({ ...QUALITY_PROFILES.high, resolutionScale: 0.42 });

    const lastCall = mockBloomEffectCalls[mockBloomEffectCalls.length - 1];
    expect(lastCall.resolutionScale).toBe(0.42);
  });

  // 자가 뮤테이션으로 찾은 구멍: rebuildLights가 mesh의 X 위치 재배치를
  // 빠뜨려도(예: setQuality로 인한 재생성 뒤) instanceCount 등 다른 검증은
  // 전부 그대로 통과한다. 좌우 도로 폭 절반만큼 갈라져 있어야 한다는 것도
  // 별도로 고정한다.
  it('setQuality로 재생성된 뒤에도 좌/우 카라이트가 도로 중심에서 갈라져 있다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();
    app.setQuality('low');

    const expectedOffset = app.options.roadWidth / 2 + app.options.islandWidth / 2;
    expect(app.leftCarLights.mesh?.position.x).toBe(-expectedOffset);
    expect(app.rightCarLights.mesh?.position.x).toBe(expectedOffset);
  });

  it('renderInterval 2(low)는 두 프레임 중 한 번만 composer.render를 부른다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();
    app.setQuality('low');

    const composer = mockComposerInstances[0];
    composer.render.mockClear();

    let t = 1000;
    for (let i = 0; i < 6; i++) {
      t += 16.7;
      fireNextFrame(t);
    }

    expect(composer.render).toHaveBeenCalledTimes(3);
  });

  it('renderInterval 1(high)는 매 프레임 composer.render를 부른다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    const composer = mockComposerInstances[0];
    composer.render.mockClear();

    let t = 1000;
    for (let i = 0; i < 6; i++) {
      t += 16.7;
      fireNextFrame(t);
    }

    expect(composer.render).toHaveBeenCalledTimes(6);
  });
});

describe('구멍 6 — maxDpr 0(무제한) 분기', () => {
  it('high tier는 기기 DPR을 그대로 쓴다(3.0이어도 캡을 걸지 않는다)', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    const renderer = mockRendererInstances[0];
    // high는 QUALITY_PROFILES.high.maxDpr === 0 → 무제한 → 기기 DPR 그대로.
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(3);
  });

  it('medium/low tier는 기기 DPR 3.0을 1.0으로 캡한다', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    const renderer = mockRendererInstances[0];
    app.setQuality('medium');
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1);

    app.setQuality('low');
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1);
  });
});

describe('구멍 7 — 초기화·profile 변경·resize 세 경로 모두 DPR cap을 유지한다', () => {
  it('초기화 시점: high tier + DPR 3 → 캡 없이 3', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();
    expect(mockRendererInstances[0].setPixelRatio).toHaveBeenLastCalledWith(3);
  });

  it('profile 변경 시점: high(DPR 3) → medium으로 바꾸면 1로 캡된다', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    app.setQuality('medium');
    expect(mockRendererInstances[0].setPixelRatio).toHaveBeenLastCalledWith(1);
  });

  it('resize/회전 시점: medium 상태에서 resize가 나도 캡(1)이 그대로 유지된다', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();
    app.setQuality('medium');

    const renderer = mockRendererInstances[0];
    renderer.setPixelRatio.mockClear();

    // onWindowResize는 container.offsetWidth/Height를 읽는다 — 크기가 바뀐
    // 것처럼 재정의한다.
    Object.defineProperty(container, 'offsetWidth', { value: 1024, configurable: true });
    Object.defineProperty(container, 'offsetHeight', { value: 768, configurable: true });
    app.onWindowResize();

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
    // 기기 DPR(3)로 되돌아가지 않았는지 — resize가 cap을 깨는 회귀를 잡는다.
    expect(renderer.setPixelRatio).not.toHaveBeenCalledWith(3);
  });
});

describe('given 7 — high → medium → low 비용 단조 감소 + 인접 단계 차이', () => {
  it('노브별로 high >= medium >= low이고, 인접한 두 tier는 최소 한 노브가 다르다', () => {
    const asCost = (profile: (typeof QUALITY_PROFILES)['high']) => ({
      lightPairsPerRoadWay: profile.lightPairsPerRoadWay,
      totalSideLightSticks: profile.totalSideLightSticks,
      // maxDpr 0(무제한)은 "상한 없음" = 가장 비싸다 → Infinity로 취급한다.
      dprCost: profile.maxDpr === 0 ? Infinity : profile.maxDpr,
      bloomCost: profile.bloom ? 1 : 0,
      // renderInterval이 클수록(2 = 한 프레임 걸러) 더 싸다 → 역수로 비용화.
      renderCost: 1 / profile.renderInterval
    });

    const high = asCost(QUALITY_PROFILES.high);
    const medium = asCost(QUALITY_PROFILES.medium);
    const low = asCost(QUALITY_PROFILES.low);

    for (const key of ['lightPairsPerRoadWay', 'totalSideLightSticks', 'dprCost', 'bloomCost', 'renderCost'] as const) {
      expect(high[key]).toBeGreaterThanOrEqual(medium[key]);
      expect(medium[key]).toBeGreaterThanOrEqual(low[key]);
    }

    const differs = (a: ReturnType<typeof asCost>, b: ReturnType<typeof asCost>) =>
      (Object.keys(a) as Array<keyof typeof a>).some(key => a[key] !== b[key]);

    expect(differs(high, medium)).toBe(true);
    expect(differs(medium, low)).toBe(true);
  });
});

describe('given 8 — tier 변경이 boost/settle 속도 상태를 덮어쓰지 않는다', () => {
  it('boost() 뒤 setQuality를 불러도 fovTarget/speedUpTarget이 유지된다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    app.boost();
    expect(app.fovTarget).toBe(app.options.fovSpeedUp);
    expect(app.speedUpTarget).toBe(app.options.speedUp);

    app.setQuality('low');

    expect(app.fovTarget).toBe(app.options.fovSpeedUp);
    expect(app.speedUpTarget).toBe(app.options.speedUp);
  });

  it('boost()는 fovTarget과 speedUpTarget을 함께 바꾼다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    app.boost();

    expect(app.fovTarget).toBe(app.options.fovSpeedUp);
    expect(app.speedUpTarget).toBe(app.options.speedUp);
  });
});

// bootIn — 부팅 안무(boot-choreography-brief.md 1절). App은 자기 자신의
// setTimeout으로 감속 시점을 예약하므로 real timer로는 테스트가 느려진다 —
// 이 describe만 fake timer를 쓴다(governor 관련 테스트들의 rAF 큐와는
// 독립적인 타이머 채널이라 서로 간섭하지 않는다).
describe('(다) bootIn — 부팅 안무 fov 펀치·감속', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('호출 즉시 boost()와 같은 목표로 fov 펀치를 시작한다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    app.bootIn(2);

    expect(app.fovTarget).toBe(app.options.fovSpeedUp);
    expect(app.speedUpTarget).toBe(app.options.speedUp);
  });

  it('2초 부팅 기준 0.90초 지점(duration의 45%)에서 settle()로 감속을 시작한다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    app.bootIn(2);
    vi.advanceTimersByTime(899);
    expect(app.fovTarget, '아직 감속 시점 전이다').toBe(app.options.fovSpeedUp);

    vi.advanceTimersByTime(2);
    expect(app.fovTarget).toBe(app.options.fov);
    expect(app.speedUpTarget).toBe(0);
  });

  it('duration이 다르면 감속 시점도 같은 비율로 비례한다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    app.bootIn(4); // 0.45 * 4 = 1.8s
    vi.advanceTimersByTime(1799);
    expect(app.fovTarget).toBe(app.options.fovSpeedUp);

    vi.advanceTimersByTime(2);
    expect(app.fovTarget).toBe(app.options.fov);
  });

  it('연속 호출은 이전 감속 예약을 취소하고 새로 시작한다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    app.bootIn(2);
    vi.advanceTimersByTime(500);
    app.bootIn(2); // 재시작 — 새 900ms 카운트다운이어야 한다

    vi.advanceTimersByTime(899);
    expect(
      app.fovTarget,
      '이전 예약이 취소되지 않았다면 500+899=1399ms 지점이라 이미 감속했을 것이다'
    ).toBe(app.options.fovSpeedUp);

    vi.advanceTimersByTime(2);
    expect(app.fovTarget).toBe(app.options.fov);
  });

  it('dispose()는 예약된 감속을 취소한다 — 죽은 인스턴스에 뒤늦은 부작용이 없다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    app.bootIn(2);
    app.dispose();

    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    expect(app.fovTarget).toBe(app.options.fovSpeedUp);
  });

  it('dispose 이후 bootIn을 호출해도 예약된 settle이 disposed 가드로 no-op한다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();
    app.dispose();

    app.bootIn(2);
    expect(app.fovTarget).toBe(app.options.fovSpeedUp); // boost() 자체는 동기 실행된다

    vi.advanceTimersByTime(2000);
    // disposed 가드가 없으면 여기서 settle()이 실행돼 options.fov로 바뀐다.
    expect(app.fovTarget).toBe(app.options.fovSpeedUp);
  });
});

describe('구멍 3 — FrameQualityGovernor 통합', () => {
  it('tick 끝에서 governor.record(timestamp)를 호출한다', () => {
    const recordSpy = vi.spyOn(FrameQualityGovernor.prototype, 'record');
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    recordSpy.mockClear();
    fireNextFrame(1016.7);

    expect(recordSpy).toHaveBeenCalledWith(1016.7);
  });

  it('init()의 첫 동기 tick 호출(timestamp 없음)은 governor에 기록하지 않는다', () => {
    const recordSpy = vi.spyOn(FrameQualityGovernor.prototype, 'record');
    const container = createContainer();
    const app = new App(container, buildOptions());

    recordSpy.mockClear();
    app.init(); // 내부에서 this.tick()을 timestamp 없이 동기 호출한다

    expect(recordSpy).not.toHaveBeenCalled();
  });

  it('governor가 null을 반환하면 setQuality를 부르지 않고, tier를 반환하면 그 tier로 setQuality를 부른다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    const setQualitySpy = vi.spyOn(app, 'setQuality');
    const recordSpy = vi.spyOn(FrameQualityGovernor.prototype, 'record');

    recordSpy.mockReturnValueOnce(null);
    fireNextFrame(1016.7);
    expect(setQualitySpy).not.toHaveBeenCalled();

    recordSpy.mockReturnValueOnce('medium');
    fireNextFrame(1033.4);
    expect(setQualitySpy).toHaveBeenCalledWith('medium');
    expect(container.dataset.qualityTier).toBe('medium');
  });

  it('실제로 나쁜 프레임이 연속되면 강등하고, host의 data-quality-tier가 갱신된다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();
    expect(container.dataset.qualityTier).toBe('high');

    // GOVERNOR_WINDOW_SIZE(120) 표본 × 2 window 연속 33.3ms 초과 간격.
    let t = 0;
    for (let i = 0; i < 242; i++) {
      t += 50; // 33.3ms 예산을 넘는 나쁜 프레임
      fireNextFrame(t);
    }

    expect(container.dataset.qualityTier).toBe('medium');
  });

  it('매 프레임 React state를 만들지 않는다 — 여러 프레임이 지나도 Profiler onRender는 마운트 커밋 1회뿐이다', async () => {
    const onRender = vi.fn();
    const ref = createRef<HyperspeedHandle>();

    render(
      <Profiler id="hs" onRender={onRender}>
        <Hyperspeed ref={ref} />
      </Profiler>
    );
    await flushMicrotasks(); // loadAssets() resolve → app.init() 실행 대기

    const renderCountAfterMount = onRender.mock.calls.length;
    expect(renderCountAfterMount).toBeGreaterThan(0);
    expect(rafQueue.length).toBe(1); // init()이 실제로 tick 루프를 시작했는지 확인

    let t = 1000;
    for (let i = 0; i < 300; i++) {
      t += 16.7;
      if (rafQueue.length > 0) fireNextFrame(t);
    }

    expect(onRender.mock.calls.length).toBe(renderCountAfterMount);
  });

  it('별도 rAF를 만들지 않는다 — tick 한 번당 requestAnimationFrame 예약도 정확히 하나다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    expect(rafQueue.length).toBe(1);
    fireNextFrame(1016.7);
    expect(rafQueue.length).toBe(1);
    fireNextFrame(1033.4);
    expect(rafQueue.length).toBe(1);
  });

  it('자동 승급을 만들지 않는다 — low로 강등된 뒤 좋은 프레임이 계속돼도 high/medium으로 되돌아가지 않는다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    // medium으로, 다시 low로 강제 강등시킨다(연속 2 window씩).
    let t = 0;
    for (let i = 0; i < 242; i++) {
      t += 50;
      fireNextFrame(t);
    }
    expect(container.dataset.qualityTier).toBe('medium');
    for (let i = 0; i < 242; i++) {
      t += 50;
      fireNextFrame(t);
    }
    expect(container.dataset.qualityTier).toBe('low');

    const setQualitySpy = vi.spyOn(app, 'setQuality');
    // 아주 좋은 프레임을 오래 흘려보낸다.
    for (let i = 0; i < 500; i++) {
      t += 16.7;
      fireNextFrame(t);
    }

    expect(container.dataset.qualityTier).toBe('low');
    expect(setQualitySpy).not.toHaveBeenCalled();
  });

  it('pause()·resume()이 governor의 window를 reset한다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    const resetSpy = vi.spyOn(FrameQualityGovernor.prototype, 'resetWindow');

    app.pause();
    expect(resetSpy).toHaveBeenCalledTimes(1);

    app.resume();
    expect(resetSpy).toHaveBeenCalledTimes(2);
  });

  it('pause()는 rAF를 취소하고, 취소된 뒤에는 tick이 다시 예약되지 않는다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    expect(rafQueue.length).toBe(1);
    app.pause();
    expect(rafQueue.length).toBe(0);
  });

  it('pause 뒤 남아있던 tick 콜백이 어떻게든 불려도(레이스) paused 플래그가 재예약을 막는다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    const staleTick = rafQueue[0].cb; // pause() 전에 예약된 콜백을 미리 붙잡아 둔다
    app.pause();
    rafQueue = []; // cancelAnimationFrame이 큐를 비웠다고 가정하고 흉내낸다

    staleTick(2000); // 취소가 안 먹혔다고 가정하고 브라우저가 그래도 불렀다 치자

    expect(rafQueue.length).toBe(0); // paused 플래그가 재귀 예약을 막았다
  });

  it('unmount이 App.dispose()를 정확히 한 번 호출하고, 예약된 rAF·resize 리스너가 0개가 된다', async () => {
    const disposeSpy = vi.spyOn(App.prototype, 'dispose');
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const ref = createRef<HyperspeedHandle>();
    const { unmount } = render(<Hyperspeed ref={ref} />);
    await flushMicrotasks();

    const resizeAdds = addSpy.mock.calls.filter(args => args[0] === 'resize').length;
    expect(rafQueue.length).toBe(1);

    unmount();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(rafQueue.length).toBe(0);
    const resizeRemoves = removeSpy.mock.calls.filter(args => args[0] === 'resize').length;
    expect(resizeRemoves).toBe(resizeAdds);
  });
});

describe('구멍 4 — isLost()가 컨텍스트 손실 전후로 실제로 갈린다', () => {
  // 실기기 회귀. canvas에 CSS 크기가 없으면 canvas는 자기 width/height
  // 속성(= CSS 크기 x DPR)만큼 레이아웃된다. DPR 1.3 데스크톱에서 1536px
  // 컨테이너의 canvas가 1996px로 깔려 좌상단만 보였고(도로가 우측 하단으로
  // 밀린 것처럼 보임), DPR 3 폰에서는 1080px가 360px 화면에 깔려 빈 하늘만
  // 보였다. clientWidth도 레이아웃 박스가 아니라 드로잉 버퍼를 되돌려
  // resizeRendererToDisplaySize가 자기 자신을 재고 있었다.
  it('canvas에 컨테이너를 채우는 CSS 크기를 준다', () => {
    const container = createContainer();
    new App(container, buildOptions());

    const canvas = mockRendererInstances[0].domElement;
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
    // display:block이 없으면 inline 요소의 baseline 여백이 생겨 컨테이너보다
    // 몇 px 커진다 — 부모가 overflow:hidden이 아니면 스크롤이 생긴다.
    expect(canvas.style.display).toBe('block');
  });

  it('webglcontextlost 뒤 true, webglcontextrestored 뒤 다시 false', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());
    app.init();

    expect(app.isLost()).toBe(false);

    const canvas = mockRendererInstances[0].domElement;
    canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(app.isLost()).toBe(true);

    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(app.isLost()).toBe(false);
  });
});

describe('구멍 5 — 시안 팔레트가 마젠타/보라 계열이 아니고 차선이 배경에 묻힌다', () => {
  // 열거("이 세 값이 아니다")가 아니라 색상환 위 부류로 판정한다 — 네 번째
  // 마젠타가 들어와도 잡아낸다.
  function hueDegrees(hex: number): number {
    const r = ((hex >> 16) & 0xff) / 255;
    const g = ((hex >> 8) & 0xff) / 255;
    const b = (hex & 0xff) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return 0;
    let h: number;
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
    return h;
  }

  // 마젠타/보라 계열은 색상환 270°~330° 부근이다(0xd856bf≈305°, 0x6750a2≈267°,
  // 0xc247ac≈312°). 시안/파랑 계열은 150°~230° 부근이다.
  const MAGENTA_PURPLE_RANGE: [number, number] = [255, 335];
  const CYAN_BLUE_RANGE: [number, number] = [150, 235];

  it('leftCars/rightCars/sticks는 마젠타·보라 계열 색상환 범위 밖에 있고 시안·파랑 계열 안에 있다', () => {
    const colors = [...defaultOptions.colors.leftCars, ...defaultOptions.colors.rightCars, defaultOptions.colors.sticks];
    expect(colors.length).toBeGreaterThan(0);

    for (const hex of colors) {
      const hue = hueDegrees(hex);
      expect(hue, `0x${hex.toString(16)} hue=${hue}`).toBeGreaterThanOrEqual(CYAN_BLUE_RANGE[0]);
      expect(hue, `0x${hex.toString(16)} hue=${hue}`).toBeLessThanOrEqual(CYAN_BLUE_RANGE[1]);
      const inMagentaPurple = hue >= MAGENTA_PURPLE_RANGE[0] && hue <= MAGENTA_PURPLE_RANGE[1];
      expect(inMagentaPurple, `0x${hex.toString(16)} hue=${hue}는 마젠타/보라 범위여선 안 된다`).toBe(false);
    }
  });

  it('shoulderLines·brokenLines는 배경색과 같다 — 차선이 보이지 않는다는 불변식', () => {
    expect(defaultOptions.colors.shoulderLines).toBe(defaultOptions.colors.background);
    expect(defaultOptions.colors.brokenLines).toBe(defaultOptions.colors.background);
  });
});

describe('(가) 카메라 옵션 — cameraY/cameraZ가 실제 camera.position에 반영된다', () => {
  it('기본값은 원본과 동일한 8 / -5다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions());

    expect(app.camera.position.y).toBe(8);
    expect(app.camera.position.z).toBe(-5);
  });

  it('cameraY/cameraZ를 넘기면 그 값이 하드코딩을 대체한다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions({ cameraY: 3, cameraZ: -2 }));

    expect(app.camera.position.y).toBe(3);
    expect(app.camera.position.z).toBe(-2);
  });
});

describe('(나) 시드 — 같은 시드는 같은 광선 배치를 낸다', () => {
  it('seed가 같으면 leftCarLights의 aOffset이 완전히 같다', () => {
    const containerA = createContainer();
    const appA = new App(containerA, buildOptions({ seed: 7 }));
    appA.init();

    const containerB = createContainer();
    const appB = new App(containerB, buildOptions({ seed: 7 }));
    appB.init();

    const offsetA = appA.leftCarLights.mesh?.geometry.getAttribute('aOffset').array;
    const offsetB = appB.leftCarLights.mesh?.geometry.getAttribute('aOffset').array;

    expect(Array.from(offsetA as Float32Array)).toEqual(Array.from(offsetB as Float32Array));
  });

  it('seed가 다르면 배치도 달라진다', () => {
    const containerA = createContainer();
    const appA = new App(containerA, buildOptions({ seed: 1 }));
    appA.init();

    const containerB = createContainer();
    const appB = new App(containerB, buildOptions({ seed: 2 }));
    appB.init();

    const offsetA = appA.leftCarLights.mesh?.geometry.getAttribute('aOffset').array;
    const offsetB = appB.leftCarLights.mesh?.geometry.getAttribute('aOffset').array;

    expect(Array.from(offsetA as Float32Array)).not.toEqual(Array.from(offsetB as Float32Array));
  });

  it('setQuality로 인한 재생성도 같은 시드면 같은 배치를 낸다', () => {
    const container = createContainer();
    const app = new App(container, buildOptions({ seed: 7 }));
    app.init();

    const before = Array.from(app.leftCarLights.mesh?.geometry.getAttribute('aOffset').array as Float32Array);

    app.setQuality('medium'); // lightPairsPerRoadWay는 high와 동일(40) — 재생성만 일어난다
    const after = Array.from(app.leftCarLights.mesh?.geometry.getAttribute('aOffset').array as Float32Array);

    expect(after).toEqual(before);
  });
});
