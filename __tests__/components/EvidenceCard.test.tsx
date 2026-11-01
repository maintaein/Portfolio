import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EvidenceCard from '@/components/sections/ExperienceSection/EvidenceCard';
import type { ExperienceEvidence } from '@/types';

// 그리기 모듈은 늦게 받는다. 그린 횟수만 보면 되므로 모든 데모를 같은 스파이로 바꾼다.
const { draw } = vi.hoisted(() => ({ draw: vi.fn() }));
vi.mock('@/components/sections/ExperienceSection/demos', () => ({
  DEMOS: { inspect: draw, security: draw, calendar: draw, loss: draw, cnn: draw },
}));

const evidence: ExperienceEvidence = {
  demo: 'security',
  label: '보안 취약점 진단',
  note: '소스코드 · 앱 진단과 개선',
  wide: true,
  summary: '소스코드와 앱의 보안 취약점을 항목별로 진단하고, 취약한 항목을 개선한다.',
};

let frames: FrameRequestCallback[];
let raf: ReturnType<typeof vi.fn>;
let observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void>;

beforeEach(() => {
  draw.mockClear();
  frames = [];
  observers = [];
  raf = vi.fn((cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observers.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
  // jsdom에는 2d 컨텍스트가 없다
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
    setTransform() {},
    clearRect() {},
  })) as unknown as HTMLCanvasElement['getContext']);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// 화면에 들어오고 늦은 import가 끝난 뒤, 쌓인 프레임을 한 번 돌린다
async function showAndFlush() {
  await act(async () => {
    observers.forEach((cb) => cb([{ isIntersecting: true }]));
    await vi.dynamicImportSettled();
  });
  act(() => {
    const pending = frames;
    frames = [];
    pending.forEach((cb) => cb(performance.now()));
  });
}

describe('EvidenceCard', () => {
  it('라벨, note, sr-only 요약을 렌더하고 canvas는 aria-hidden이다', () => {
    const { container, getByText } = render(<EvidenceCard evidence={evidence} active={false} reduced={false} />);
    expect(getByText('보안 취약점 진단')).toBeTruthy();
    expect(getByText('소스코드 · 앱 진단과 개선')).toBeTruthy();
    expect(getByText(evidence.summary).className).toContain('sr-only');
    expect(container.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('active가 아니면 그리지 않는다', async () => {
    render(<EvidenceCard evidence={evidence} active={false} reduced={false} />);
    await showAndFlush();
    expect(draw).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
  });

  it('reduced면 한 장만 그리고 rAF를 다시 요청하지 않는다', async () => {
    render(<EvidenceCard evidence={evidence} active reduced />);
    await showAndFlush();
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0][4]).toBe(true);
    expect(raf).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(0);
  });
});
