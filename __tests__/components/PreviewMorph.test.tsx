import { createRef } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap, SITE_EASE } from '@/lib/gsap';
import PreviewMorph, { type PreviewMorphHandle } from '@/components/blocks/PreviewMorph';

// jsdom에는 WebGL도 2d 캔버스도 없다(canvas npm 패키지 미설치). 셰이더가 만든
// 픽셀은 여기서 못 본다 - 그건 크롬 실측이 맡고 이 파일은 원인만 잠근다.
//
// three에서 갈아치우는 것은 WebGLRenderer 하나다. ShaderMaterial·PlaneGeometry·
// Texture·Scene·Mesh는 GPU 없이도 만들어지는 순수 JS 객체라 진짜를 쓴다 -
// 그래야 유니폼 값과 씬 조립을 실제로 관측할 수 있다.
const { MockWebGLRenderer, rendererInstances } = vi.hoisted(() => {
  const rendererInstances: Array<{
    canvas: unknown;
    pixelRatio: number;
    sizes: Array<[number, number, boolean | undefined]>;
    dispose: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
  }> = [];

  class MockWebGLRenderer {
    canvas: unknown;
    pixelRatio = 1;
    sizes: Array<[number, number, boolean | undefined]> = [];
    dispose = vi.fn();
    render = vi.fn();
    setPixelRatio = (dpr: number) => {
      this.pixelRatio = dpr;
    };
    setSize = (w: number, h: number, updateStyle?: boolean) => {
      this.sizes.push([w, h, updateStyle]);
    };
    constructor(params: { canvas?: unknown }) {
      this.canvas = params?.canvas;
      rendererInstances.push(this as unknown as (typeof rendererInstances)[number]);
    }
  }

  return { MockWebGLRenderer, rendererInstances };
});

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: MockWebGLRenderer };
});

const BOX_W = 640;
const BOX_H = 360;

let drawImage: ReturnType<typeof vi.fn>;
let images: FakeImage[];

class FakeImage {
  onload: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  private _src = '';
  constructor() {
    images.push(this);
  }
  get src(): string {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
  }
  // 실제 이미지가 도착한 척한다
  arrive(w: number, h: number): void {
    this.naturalWidth = w;
    this.naturalHeight = h;
    this.onload?.();
  }
}

// WebGL과 2d 컨텍스트가 둘 다 살아 있는 환경을 흉내 낸다
function withCanvas(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
    if (kind === 'webgl2') return { getExtension: () => null };
    if (kind === '2d') return { drawImage };
    return null;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext);
}

// webgl2만 못 얻는 환경. 2d는 살려 둔다 - 그래야 렌더러를 안 만드는 이유가
// 탐침 하나로 좁혀지고, 탐침을 지웠을 때 이 파일이 그걸 본다
function withoutWebGL(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
    if (kind === '2d') return { drawImage };
    return null;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext);
}

// 탐침 자체가 던지는 환경
function throwingWebGL(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
    if (kind === '2d') return { drawImage };
    throw new Error('context creation blocked');
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext);
}

function makeVideo(w = 1920, h = 1080): HTMLVideoElement {
  const el = document.createElement('video');
  Object.defineProperty(el, 'videoWidth', { value: w, configurable: true });
  Object.defineProperty(el, 'videoHeight', { value: h, configurable: true });
  return el;
}

function makeImg(w = 1280, h = 720): HTMLImageElement {
  const el = document.createElement('img');
  Object.defineProperty(el, 'naturalWidth', { value: w, configurable: true });
  Object.defineProperty(el, 'naturalHeight', { value: h, configurable: true });
  return el;
}

function mount(preload?: readonly string[]) {
  const ref = createRef<PreviewMorphHandle>();
  const view = render(<PreviewMorph ref={ref} className="absolute inset-0" preload={preload} />);
  const canvas = document.querySelector<HTMLCanvasElement>('[data-part="preview-morph"]')!;
  return { ref, view, canvas };
}

// 캐시를 미리 데운다. 실제로는 preload가 하는 일이다 - 여기서는 morph를 한 번
// 불러 요청만 내보내고(캐시가 비어 있어 그 호출 자신은 포기한다), 도착을
// 흉내 내서 다음 호출부터 더워진 캐시를 쓰게 만든다
function warmCache(
  ref: { current: PreviewMorphHandle | null },
  src: string,
  w = 800,
  h = 450
): void {
  ref.current!.morph(makeVideo(), src);
  const pending = images[images.length - 1];
  act(() => {
    pending.arrive(w, h);
  });
}

function renderer() {
  return rendererInstances[rendererInstances.length - 1];
}

// morph가 태운 tween. 전역 타임라인에 붙어 있는 것을 그대로 집는다
function liveTweens(): gsap.core.Tween[] {
  return gsap.globalTimeline.getChildren(false, true, false) as gsap.core.Tween[];
}

// 씬에 붙은 진짜 ShaderMaterial. 유니폼은 여기로만 관측한다
function uniforms(): Record<string, { value: unknown }> {
  const scene = renderer().render.mock.calls[0][0] as {
    children: Array<{ material: { uniforms: Record<string, { value: unknown }> } }>;
  };
  return scene.children[0].material.uniforms;
}

beforeEach(() => {
  rendererInstances.length = 0;
  images = [];
  drawImage = vi.fn();
  vi.stubGlobal('Image', FakeImage);
  Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: BOX_W,
    height: BOX_H,
    top: 0,
    left: 0,
    right: BOX_W,
    bottom: BOX_H,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  gsap.globalTimeline.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PreviewMorph - 표제 계약: 두 화면을 셰이더로 녹여 잇는다', () => {
  it('출발 화면을 굳혀 텍스처로 물리고 uProgress를 0에서 1까지 태운다', () => {
    withCanvas();
    const { ref, canvas } = mount();
    warmCache(ref, '/projects/a.png');
    const from = makeVideo(1920, 1080);

    expect(canvas.style.opacity).toBe('0');
    const started = ref.current!.morph(from, '/projects/a.png');
    expect(started).toBe(true);

    // 출발 텍스처는 지금 보이는 미디어를 원본 크기로 굳힌 한 장이다.
    // 이 drawImage가 사라지면 tCurrent가 빈 캔버스라 모프가 검정에서 시작한다
    expect(drawImage).toHaveBeenCalledWith(from, 0, 0, 1920, 1080);

    const u = uniforms();
    expect((u.uCurrentSize.value as { x: number; y: number }).x).toBe(1920);
    expect((u.uCurrentSize.value as { x: number; y: number }).y).toBe(1080);
    // 전환이 시작하는 순간 캔버스가 보인다. 그리고 이미 p=0을 한 장 그려 뒀다
    expect(canvas.style.opacity).toBe('1');
    expect(u.uProgress.value).toBe(0);
    expect(renderer().render).toHaveBeenCalledTimes(1);

    const tween = liveTweens()[0];
    expect(tween).toBeDefined();
    // 값은 브리프가 못박은 것이다. 0.3초는 melt가 녹을 시간이 안 나고
    // 1.1초는 이름을 훑을 때 밀린다
    expect(tween.duration()).toBeCloseTo(0.56, 5);
    expect(tween.vars.ease).toBe(SITE_EASE);

    // 중간 - 두 화면이 섞여 있는 구간이다
    act(() => {
      tween.progress(0.5);
    });
    expect(u.uProgress.value as number).toBeGreaterThan(0);
    expect(u.uProgress.value as number).toBeLessThan(1);
    expect(canvas.style.opacity).toBe('1');
    expect(renderer().render.mock.calls.length).toBeGreaterThan(1);

    // 끝 - 캔버스는 스스로 물러난다. 안 물러나면 정지 이미지가 영상을 덮는다
    act(() => {
      tween.progress(1);
    });
    expect(u.uProgress.value).toBe(1);
    expect(canvas.style.opacity).toBe('0');
  });

  it('DOM img를 출발 텍스처로 읽지 않는다 - 직전 도착지의 캐시 이미지를 굳힌다', () => {
    // 원인 1 고정: next/image는 같은 <img> 노드의 src만 갈아 끼운다. 이름을
    // 빠르게 훑으면 그 노드가 아직 직전 프로젝트 그림을 디코드해 둔 채일 수
    // 있다. 그 노드를 굳히면 호버한 것과 무관한 그림이 남는다 - 출발 텍스처는
    // 언제나 직전에 도착이 확정된 목적지의 캐시 이미지여야 한다
    withCanvas();
    const { ref } = mount();
    warmCache(ref, '/projects/a.png', 1000, 500);
    ref.current!.morph(makeVideo(), '/projects/a.png');
    const cachedA = images.find((img) => img.src === '/projects/a.png')!;

    // 아직 이전 그림(1920x1080)을 들고 있는, 디코드는 끝난 stale한 <img> 노드.
    // b.png는 캐시에 없어 이 전환 자체는 결국 포기하지만, 출발 텍스처 선택은
    // 그보다 먼저 끝난다
    const staleImg = makeImg(1920, 1080);
    ref.current!.morph(staleImg, '/projects/b.png');

    expect(drawImage).not.toHaveBeenCalledWith(staleImg, 0, 0, 1920, 1080);
    expect(drawImage).toHaveBeenCalledWith(cachedA, 0, 0, 1000, 500);
    const u = uniforms();
    expect((u.uCurrentSize.value as { x: number; y: number }).x).toBe(1000);
    expect((u.uCurrentSize.value as { x: number; y: number }).y).toBe(500);
  });

  it('melt 유니폼이 브리프가 정한 값으로 들어간다', () => {
    withCanvas();
    const { ref } = mount();
    warmCache(ref, '/projects/a.png');
    ref.current!.morph(makeVideo(), '/projects/a.png');

    const u = uniforms();
    expect(u.uIntensity.value).toBe(0.55);
    expect(u.uScale.value).toBe(2.4);
    // 기본값 0.35는 순검정 배경에서 색테두리가 도드라진다
    expect(u.uAberration.value).toBe(0.22);
    // 상시 흔들림은 0.56초짜리 전환에서 떨림으로만 보인다
    expect(u.uDrift.value).toBe(0);
    const overlay = u.uOverlay.value as { x: number; y: number; z: number };
    expect([overlay.x, overlay.y, overlay.z]).toEqual([0, 0, 0]);

    // melt 하나만 옮겼다. 나머지 셋이 쓰던 유니폼이 남아 있으면 옮기다 만 것이다
    for (const dead of ['uMode', 'uDir', 'uPointer', 'uReduce']) {
      expect(u[dead]).toBeUndefined();
    }
  });

  it('캔버스 픽셀 크기는 상자 크기에 dpr 상한 2를 곱한 값이다', () => {
    withCanvas();
    const { ref } = mount();
    // devicePixelRatio는 3으로 세워 뒀다. 상한이 없으면 9배 픽셀을 그린다
    expect(renderer().pixelRatio).toBe(2);
    warmCache(ref, '/projects/a.png');
    ref.current!.morph(makeVideo(), '/projects/a.png');
    // updateStyle=false여야 한다. three가 style width/height를 박으면
    // absolute inset-0이 깨진다
    expect(renderer().sizes).toEqual([[BOX_W, BOX_H, false]]);
  });

  it('늦게 도착한 요청은 캐시에만 들어간다. 다음에 같은 곳으로 가면 곧바로 쓴다', () => {
    withCanvas();
    const { ref } = mount();
    ref.current!.morph(makeVideo(), '/projects/late.png');
    const pending = images[images.length - 1];
    expect(pending.src).toBe('/projects/late.png');

    act(() => {
      pending.arrive(800, 450);
    });
    // 물리지 않고 캐시에만 들어갔다 - 다시 요청하지 않고 첫 프레임부터 실제 크기다
    const requested = images.length;
    ref.current!.morph(makeVideo(), '/projects/late.png');
    expect(images.length).toBe(requested);
    const u = uniforms();
    expect((u.uNextSize.value as { x: number; y: number }).x).toBe(800);
  });

  it('한 번 받은 도착 이미지는 다시 요청하지 않고 첫 프레임부터 물린다', () => {
    withCanvas();
    const { ref } = mount();
    warmCache(ref, '/projects/warm.png', 800, 450);
    const requestsAfterFirst = images.length;

    ref.current!.morph(makeVideo(), '/projects/warm.png');
    expect(images.length).toBe(requestsAfterFirst);
    const u = uniforms();
    expect((u.uNextSize.value as { x: number; y: number }).x).toBe(800);
  });
});

describe('PreviewMorph - 태울 수 없으면 false로 물러난다', () => {
  it('fromEl이 null이면 false를 돌려주고 캔버스를 켜지 않는다', () => {
    withCanvas();
    const { ref, canvas } = mount();
    expect(ref.current!.morph(null, '/projects/a.png')).toBe(false);
    expect(canvas.style.opacity).toBe('0');
    expect(liveTweens()).toHaveLength(0);
  });

  it('첫 프레임도 못 그린 미디어(원본 크기 0)면 false다', () => {
    withCanvas();
    const { ref, canvas } = mount();
    // 비디오가 아직 아무것도 디코드하지 않았다. 굳히면 빈 판이 나온다
    expect(ref.current!.morph(makeVideo(0, 0), '/projects/a.png')).toBe(false);
    // 이미지 쪽도 같은 부류다. 한쪽만 막으면 다른 쪽으로 샌다
    expect(ref.current!.morph(makeImg(0, 0), '/projects/a.png')).toBe(false);
    expect(canvas.style.opacity).toBe('0');
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('상자가 아직 0픽셀이면 false다', () => {
    withCanvas();
    const { ref } = mount();
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0,
      toJSON: () => ({}),
    });
    expect(ref.current!.morph(makeVideo(), '/projects/a.png')).toBe(false);
  });

  it('drawImage가 던져도 삼키고 false를 돌려준다', () => {
    withCanvas();
    const { ref, canvas } = mount();
    drawImage.mockImplementation(() => {
      throw new DOMException('tainted', 'SecurityError');
    });
    expect(() => ref.current!.morph(makeVideo(), '/projects/a.png')).not.toThrow();
    expect(ref.current!.morph(makeVideo(), '/projects/a.png')).toBe(false);
    expect(canvas.style.opacity).toBe('0');
  });

  it('WebGL이 없으면 렌더러를 아예 만들지 않고 morph가 false다', () => {
    withoutWebGL();
    const { ref, canvas } = mount();
    // three 생성자를 그냥 부르면 콘솔에 세 줄이 찍힌다. 탐침이 그것을 막는다
    expect(rendererInstances).toHaveLength(0);
    expect(() => ref.current!.morph(makeVideo(), '/projects/a.png')).not.toThrow();
    expect(ref.current!.morph(makeVideo(), '/projects/a.png')).toBe(false);
    expect(canvas.style.opacity).toBe('0');
    expect(liveTweens()).toHaveLength(0);
  });

  it('탐침이 얻은 컨텍스트는 즉시 반납한다', () => {
    const loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
      if (kind === 'webgl2') return { getExtension: () => ({ loseContext }) };
      if (kind === '2d') return { drawImage };
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext);
    mount();
    // 반납 안 하면 탭당 컨텍스트 한도를 우리 탐침이 한 칸 먹는다
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('탐침이 던져도 삼키고 렌더러를 만들지 않는다', () => {
    throwingWebGL();
    const { ref, canvas } = mount();
    expect(rendererInstances).toHaveLength(0);
    expect(ref.current!.morph(makeVideo(), '/projects/a.png')).toBe(false);
    expect(canvas.style.opacity).toBe('0');
  });

  it('도착 이미지가 캐시에 없으면 false를 반환하고, 캔버스를 끄며, tween을 태우지 않는다', () => {
    withCanvas();
    const fromTo = vi.spyOn(gsap, 'fromTo');
    const { ref, canvas } = mount();
    const started = ref.current!.morph(makeVideo(), '/projects/cold.png');

    expect(started).toBe(false);
    expect(canvas.style.opacity).toBe('0');
    expect(fromTo).not.toHaveBeenCalled();
    expect(liveTweens()).toHaveLength(0);
  });

  it('이른 포기 경로가 돌고 있던 tween의 kill()을 부른다', () => {
    withCanvas();
    const { ref, canvas } = mount();
    warmCache(ref, '/projects/a.png');
    ref.current!.morph(makeVideo(), '/projects/a.png');
    const tween = liveTweens()[0];
    const killSpy = vi.spyOn(tween, 'kill');

    // 다음 프로젝트로 넘어가는데 그쪽 캐시가 비어 있다 - 이른 포기 경로다
    const started = ref.current!.morph(makeVideo(), '/projects/cold.png');

    expect(started).toBe(false);
    expect(killSpy).toHaveBeenCalledTimes(1);
    expect(canvas.style.opacity).toBe('0');
    expect(liveTweens()).toHaveLength(0);
  });
});

describe('PreviewMorph - 겹치는 전환과 뒷정리', () => {
  it('전환 중에 또 부르면 이전 tween을 죽이고 하나만 남긴다', () => {
    withCanvas();
    const { ref } = mount();
    warmCache(ref, '/projects/a.png');
    warmCache(ref, '/projects/b.png');
    ref.current!.morph(makeVideo(), '/projects/a.png');
    const first = liveTweens()[0];
    act(() => {
      first.progress(0.4);
    });

    ref.current!.morph(makeVideo(1280, 720), '/projects/b.png');
    // 둘이 같이 남으면 uProgress를 서로 밀며 화면이 튄다
    expect(liveTweens()).toHaveLength(1);
    expect(liveTweens()[0]).not.toBe(first);
    // 새 전환은 처음부터다. 이어붙이지 않는다
    expect(uniforms().uProgress.value).toBe(0);
    // 출발 텍스처는 직전 모프가 그리던 화면이 아니라 방금 굳힌 fromEl이다
    expect((uniforms().uCurrentSize.value as { x: number }).x).toBe(1280);
  });

  it('언마운트가 렌더러와 GPU 자원을 정리하고 tween도 죽인다', () => {
    withCanvas();
    const { ref, view } = mount();
    warmCache(ref, '/projects/a.png');
    ref.current!.morph(makeVideo(), '/projects/a.png');
    const u = uniforms();
    const material = (
      renderer().render.mock.calls[0][0] as {
        children: Array<{ material: { dispose: () => void }; geometry: { dispose: () => void } }>;
      }
    ).children[0];
    const materialDispose = vi.spyOn(material.material, 'dispose');
    const geometryDispose = vi.spyOn(material.geometry, 'dispose');
    const currentDispose = vi.spyOn(u.tCurrent.value as { dispose: () => void }, 'dispose');

    view.unmount();

    expect(renderer().dispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(currentDispose).toHaveBeenCalledTimes(1);
    // 살아 있는 tween이 남으면 사라진 캔버스를 계속 그린다
    expect(liveTweens()).toHaveLength(0);
  });

  it('언마운트 뒤에 morph를 불러도 false만 돌려준다', () => {
    withCanvas();
    const { ref, view } = mount();
    const handle = ref.current!;
    view.unmount();
    expect(handle.morph(makeVideo(), '/projects/a.png')).toBe(false);
  });
});

describe('PreviewMorph - 프리로드', () => {
  it('preload로 준 경로마다 마운트 직후 Image 인스턴스로 요청한다', () => {
    withCanvas();
    const paths = ['/projects/a.png', '/projects/b.png'] as const;
    mount(paths);
    expect(images.map((img) => img.src)).toEqual(paths);
  });

  it('이미 캐시에 있는 경로는 다시 요청하지 않는다', () => {
    withCanvas();
    const { ref, view } = mount();
    warmCache(ref, '/projects/a.png');
    const requestedBefore = images.length;

    // 같은 컴포넌트가 나중에 preload를 받아도, 이미 캐시에 든 경로는 다시
    // 요청하지 않는다
    view.rerender(<PreviewMorph ref={ref} className="absolute inset-0" preload={['/projects/a.png']} />);
    expect(images.length).toBe(requestedBefore);
  });
});
