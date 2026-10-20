import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BootSequenceProps, IntroTargets } from '@/components/sections/BootSequence';

// BootSequence.test.tsx는 실제 gsap으로 시간표를 본다. 이 파일은 GSAP을 어떻게 기다리는지만 본다.
// 로드 시도 게이트, 로드 실패, 오지 않는 모듈, 언마운트 뒤 늦은 도착. 매 테스트가 동적 import 하나만 바꾼다.
const attempted = vi.fn();
const timelineFn = vi.fn(() => {
  const tl = { set: vi.fn(() => tl), to: vi.fn(() => tl), fromTo: vi.fn(() => tl), call: vi.fn(() => tl), kill: vi.fn() };
  return tl;
});
const fakeGsap = { gsap: { timeline: timelineFn }, registerGsap: vi.fn(), SITE_EASE: 'site' };

function mockSuccess() {
  vi.doMock('@/lib/gsap', () => { attempted(); return fakeGsap; });
}
function mockRejects() {
  vi.doMock('@/lib/gsap', () => { attempted(); throw new Error('gsap 청크 로드 실패(테스트 주입)'); });
}
function mockGated(gate: Promise<void>) {
  vi.doMock('@/lib/gsap', async () => { attempted(); await gate; return fakeGsap; });
}

function makeTargets() {
  const background = { setRevealProgress: vi.fn() };
  const wordmark = document.createElement('span');
  const headline = document.createElement('h1');
  headline.textContent = '탄탄한 기본기를';
  const heroObject = document.createElement('div');
  document.body.append(wordmark, headline, heroObject);
  return { targets: { wordmark, headline, heroObject, background } as unknown as IntroTargets, background };
}

async function mount(props: Partial<BootSequenceProps> = {}) {
  const { default: BootSequence } = await import('@/components/sections/BootSequence');
  const onRevealStart = vi.fn();
  const onComplete = vi.fn();
  const all = { enabled: true, reducedMotion: false, targets: null, onRevealStart, onComplete, ...props };
  const view = render(<BootSequence {...all} />);
  return { onRevealStart, onComplete, view, rerender: (next: Partial<BootSequenceProps>) => view.rerender(<BootSequence {...all} {...next} />) };
}

const tick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });

beforeEach(() => {
  vi.resetModules();
  attempted.mockClear();
  timelineFn.mockClear();
  document.documentElement.setAttribute('data-intro', '');
  // jsdom의 rAF는 돌지 않는다. 시작 게이트가 고른 프레임을 받도록 16ms 타이머로 흉내 낸다.
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('@/lib/gsap');
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-intro');
  document.body.innerHTML = '';
});

describe('BootSequence GSAP 동적 로드', () => {
  it('켜진 인트로는 마운트하자마자 @/lib/gsap을 부르고, 대상이 오면 timeline을 만든다(양성 대조)', async () => {
    mockSuccess();
    const { targets } = makeTargets();
    const view = await mount();
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));
    expect(timelineFn).not.toHaveBeenCalled();
    view.rerender({ targets });
    await waitFor(() => expect(timelineFn).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(document.documentElement).toHaveAttribute('data-intro', 'playing');
  });

  it.each([
    ['모션 감소', { reducedMotion: true }],
    ['비활성 인트로(해시·재방문)', { enabled: false }],
  ] as const)('%s는 @/lib/gsap을 부르지 않는다', async (_, props) => {
    mockSuccess();
    await mount(props);
    await tick();
    expect(attempted).not.toHaveBeenCalled();
  });

  it('로드가 실패하면 커튼을 걷고 공개값 1의 정적 첫 화면으로 끝낸다', async () => {
    mockRejects();
    const { targets, background } = makeTargets();
    const { onRevealStart, onComplete } = await mount({ targets });
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onRevealStart).toHaveBeenCalledTimes(1);
    expect(background.setRevealProgress).toHaveBeenLastCalledWith(1);
    expect(document.querySelector('.intro-curtain')).toBeNull();
    expect(document.documentElement).not.toHaveAttribute('data-intro');
    expect(timelineFn).not.toHaveBeenCalled();
    expect(targets.headline.innerHTML).toBe('탄탄한 기본기를');
  });

  it('모듈이나 대상이 3초 안에 오지 않으면 콘텐츠를 기다리게 두지 않고 커튼을 걷는다', async () => {
    vi.useFakeTimers();
    mockGated(new Promise(() => {}));
    const { onComplete } = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(onComplete).not.toHaveBeenCalled();
    expect(document.querySelector('.intro-curtain')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.intro-curtain')).toBeNull();
  });

  it('언마운트 뒤 늦게 도착한 모듈에는 timeline을 걸지 않고 판정 표시도 남기지 않는다', async () => {
    let open!: () => void;
    mockGated(new Promise<void>(resolve => { open = resolve; }));
    const { targets } = makeTargets();
    const { view } = await mount({ targets });
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(document.documentElement).not.toHaveAttribute('data-intro');
    open();
    await tick();
    expect(timelineFn).not.toHaveBeenCalled();
  });
});
