import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAPTION_REVEAL_MS,
  PREVIEW_CAPTION_SCRIM,
  clearCaptionReveal,
  hideCaption,
  revealCaption,
} from '@/components/sections/ProjectsSection/captionReveal';

// M4 Task 14. 프리뷰 캡션은 그림의 녹음과 같은 결로 들어온다. 어둠 띠는 fbm 잡음을 따라 아래부터
// 고르지 않게 차고, 글자는 줄마다 조금씩 늦게 흐림에서 또렷하게 떠오른다.
// jsdom에는 캔버스와 WAAPI가 없어 둘 다 기록만 하는 가짜를 심는다. 프레임은 손으로 돌린다.

type Recorded = { el: Element; keyframes: Keyframe[]; options: KeyframeAnimationOptions; cancel: ReturnType<typeof vi.fn> };
let animations: Recorded[] = [];
let frames: Map<number, FrameRequestCallback>;
let nextFrame = 0;
let now = 0;
let masks: Uint8ClampedArray[] = [];
let caption: HTMLElement;

function fakeContext(canvas: HTMLCanvasElement) {
  return {
    canvas,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    fillStyle: '' as unknown,
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (image: ImageData) => masks.push(Uint8ClampedArray.from(image.data)),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };
}

function build(withSubtitle = true) {
  document.body.innerHTML = `
    <div data-part="preview-caption" style="background: ${PREVIEW_CAPTION_SCRIM}">
      <div data-part="preview-caption-text">
        <p>제목</p>${withSubtitle ? '<p>부제</p>' : ''}<span>자세히 보기</span>
      </div>
    </div>`;
  caption = document.querySelector<HTMLElement>('[data-part="preview-caption"]')!;
  Object.defineProperty(caption, 'clientWidth', { configurable: true, get: () => 640 });
  Object.defineProperty(caption, 'clientHeight', { configurable: true, get: () => 160 });
}

const lines = () => Array.from(caption.querySelectorAll<HTMLElement>('[data-part="preview-caption-text"] > *'));
const canvases = () => caption.querySelectorAll('canvas');
// 지금 시각을 at(ms)으로 옮기고 걸려 있는 프레임을 한 번 돌린다
function frameAt(at: number) {
  now = at;
  const pending = [...frames.values()];
  frames.clear();
  for (const frame of pending) frame(at);
}
// 남은 인라인 값. 캡션과 글자 줄 어디에도 mask·filter·opacity·transform이 남으면 안 된다
function leftovers() {
  return [caption, ...lines()].flatMap((el) =>
    ['mask', 'mask-image', '-webkit-mask-image', 'filter', 'opacity', 'transform']
      .map((name) => el.style.getPropertyValue(name))
      .filter(Boolean)
  );
}

beforeEach(() => {
  animations = [];
  masks = [];
  frames = new Map();
  nextFrame = 0;
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
    nextFrame += 1;
    frames.set(nextFrame, frame);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  Element.prototype.animate = function (this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    const cancel = vi.fn();
    animations.push({ el: this, keyframes, options, cancel });
    return { cancel } as unknown as Animation;
  } as Element['animate'];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return fakeContext(this) as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement['getContext']);
  build();
});

afterEach(() => {
  clearCaptionReveal(caption);
  delete (Element.prototype as Partial<Element>).animate;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('캡션 드러냄: 시작 값', () => {
  it('어둠 띠는 기존 처방 그대로다(글자 대비 4.5:1의 근거)', () => {
    expect(PREVIEW_CAPTION_SCRIM).toBe(
      'linear-gradient(to top, rgb(0 0 0 / 0.78) 0%, rgb(0 0 0 / 0.78) 62%, rgb(0 0 0 / 0.3) 84%, rgb(0 0 0 / 0) 100%)'
    );
  });

  it('글자 줄마다 흐림 6px·투명·아래 8px에서 또렷·불투명·제자리로 가고, 제목부터 75ms씩 늦게 떠오른다', () => {
    revealCaption(caption);
    const lineEls = lines();
    expect(animations.map((a) => a.el)).toEqual(lineEls);
    for (const { keyframes, options } of animations) {
      expect(keyframes[0]).toEqual({ opacity: 0, filter: 'blur(6px)', transform: 'translateY(8px)' });
      expect(keyframes.at(-1)).toEqual({ opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' });
      // 사이트 공용 진입 커브(SITE_EASE_CUBIC)다
      expect(options.easing).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
      expect(options.fill).toBe('both');
    }
    const delays = animations.map((a) => a.options.delay as number);
    expect(delays[1] - delays[0]).toBe(75);
    expect(delays[2] - delays[1]).toBe(75);
    // 마지막 줄이 전체 길이(800ms)에 정확히 끝난다
    const last = animations.at(-1)!.options;
    expect((last.delay as number) + (last.duration as number)).toBe(CAPTION_REVEAL_MS);
    expect(CAPTION_REVEAL_MS).toBe(800);
  });

  it('어둠 띠는 같은 그라데이션을 그리는 캔버스로 바뀌고 처음 프레임은 다 비어 있다', () => {
    revealCaption(caption);
    expect(canvases()).toHaveLength(1);
    // 캔버스가 글자보다 앞(아래 겹)이다
    expect(caption.firstElementChild?.tagName).toBe('CANVAS');
    expect(caption.style.background).toBe('none');
    expect(Math.max(...masks[0].filter((_, i) => i % 4 === 3))).toBe(0);
  });

  it('30% 지점의 띠는 아래가 위보다 먼저 차고, 경계는 곧은 선이 아니라 잡음 모양이다', () => {
    revealCaption(caption);
    frameAt(0.3 * CAPTION_REVEAL_MS);
    const mask = masks.at(-1)!;
    // 칸 하나가 8px이다. 640 × 160 캡션이면 81 × 21 칸이다
    const w = 81;
    const h = mask.length / 4 / w;
    expect(Number.isInteger(h)).toBe(true);
    const row = (y: number) => Array.from({ length: w }, (_, x) => mask[(y * w + x) * 4 + 3]);
    const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean(row(h - 1))).toBeGreaterThan(mean(row(0)));
    // 경계가 지나가는 줄 어딘가에는 이미 찬 칸과 아직 빈 칸이 함께 있다
    const ragged = Array.from({ length: h }, (_, y) => row(y)).some(
      (values) => Math.max(...values) > 200 && Math.min(...values) < 55
    );
    expect(ragged).toBe(true);
  });
});

describe('캡션 드러냄: 끝과 중단', () => {
  it('끝나면 캔버스를 걷고 어둠 띠를 되돌리며 인라인 mask·filter 값이 하나도 안 남는다', () => {
    revealCaption(caption);
    frameAt(400);
    frameAt(CAPTION_REVEAL_MS);
    expect(canvases()).toHaveLength(0);
    expect(caption.style.background).toContain('linear-gradient');
    expect(animations.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
    expect(leftovers()).toEqual([]);
    expect(frames.size).toBe(0);
  });

  it('도중에 걷으면 같은 자리로 정리되고 남은 프레임이 다시 그리지 않는다', () => {
    revealCaption(caption);
    frameAt(200);
    const drawn = masks.length;
    clearCaptionReveal(caption);
    expect(canvases()).toHaveLength(0);
    expect(caption.style.background).toContain('linear-gradient');
    expect(animations.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
    expect(leftovers()).toEqual([]);
    frameAt(400);
    expect(masks.length).toBe(drawn);
  });

  it('도는 중에 다시 부르면 앞의 것을 걷고 새로 시작한다. 캔버스는 늘 하나다', () => {
    revealCaption(caption);
    frameAt(300);
    const first = animations.slice();
    revealCaption(caption);
    expect(first.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
    expect(canvases()).toHaveLength(1);
    frameAt(300 + CAPTION_REVEAL_MS);
    expect(canvases()).toHaveLength(0);
    expect(leftovers()).toEqual([]);
  });

  it('감춰 둔 캡션은 드러냄이나 걷기가 감춤을 풀어 준다. 감춘 채 굳지 않는다', () => {
    hideCaption(caption);
    expect(caption.style.opacity).toBe('0');
    revealCaption(caption);
    expect(caption.style.opacity).toBe('');
    hideCaption(caption);
    clearCaptionReveal(caption);
    expect(leftovers()).toEqual([]);
  });

  it('길이를 받으면 띠와 글자가 같은 비율로 줄고 마지막 줄이 그 길이에 끝난다', () => {
    revealCaption(caption, { duration: 600 });
    const last = animations.at(-1)!.options;
    expect((last.delay as number) + (last.duration as number)).toBe(600);
    frameAt(600);
    expect(canvases()).toHaveLength(0);
  });
});

describe('캡션 드러냄: 모션 감소와 폴백', () => {
  it('모션 감소에서는 잡음도 흐림도 없이 바로 보인다', () => {
    hideCaption(caption);
    revealCaption(caption, { reduced: true });
    expect(animations).toHaveLength(0);
    expect(canvases()).toHaveLength(0);
    expect(frames.size).toBe(0);
    expect(leftovers()).toEqual([]);
  });

  it('2D 캔버스를 못 얻으면 띠는 그대로 두고 글자만 들어온다', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    revealCaption(caption);
    expect(canvases()).toHaveLength(0);
    expect(caption.style.background).toContain('linear-gradient');
    expect(animations).toHaveLength(3);
    frameAt(CAPTION_REVEAL_MS);
    expect(leftovers()).toEqual([]);
  });

  it('부제가 없는 프로젝트는 두 줄만 75ms 간격으로 들어온다', () => {
    build(false);
    revealCaption(caption);
    expect(animations).toHaveLength(2);
    expect((animations[1].options.delay as number) - (animations[0].options.delay as number)).toBe(75);
  });
});
