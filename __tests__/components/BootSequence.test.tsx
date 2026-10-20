import { readFileSync } from 'node:fs';
import { createRef, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import BootSequence, {
  INTRO_TIMING, introWordStagger,
  type BootSequenceHandle, type BootSequenceProps, type IntroTargets,
} from '@/components/sections/BootSequence';
import { gsap } from '@/lib/gsap';

// Hero 왼쪽의 두 줄 인사. 줄바꿈은 원문의 개행이다.
const SENTENCE = '안녕하세요.\nSW개발자 김태인입니다.';
const CSS = readFileSync('styles/design-tokens.css', 'utf8').replace(/\r\n/g, '\n');
const FLOW_CSS = readFileSync('components/blocks/LuminousFlowBackground/styles.module.css', 'utf8').replace(/\r\n/g, '\n');
const html = document.documentElement;

type Background = { setRevealProgress: ReturnType<typeof vi.fn> };
const makeBackground = (): Background => ({ setRevealProgress: vi.fn() });
const lastReveal = (background: Background) => background.setRevealProgress.mock.calls.at(-1)?.[0];
const asHandle = (background: Background | null) => background as unknown as BootSequenceProps['background'];

// 실제 DOM 대상. 이름은 nav 버튼 안쪽 span, 소개는 h1, 오브젝트는 전용 껍질이다.
function makeTargets(background: Background | null = makeBackground()) {
  const button = document.createElement('button');
  const wordmark = document.createElement('span');
  wordmark.textContent = 'KIM TAEIN';
  button.append(wordmark);
  const headline = document.createElement('h1');
  headline.textContent = SENTENCE;
  const heroObject = document.createElement('div');
  document.body.append(button, headline, heroObject);
  const targets: IntroTargets = { wordmark, headline, heroObject };
  return { targets, button, background: background! };
}

function mount(props: Partial<BootSequenceProps> = {}) {
  const ref = createRef<BootSequenceHandle>();
  const onComplete = vi.fn();
  const all: BootSequenceProps = { enabled: true, reducedMotion: false, targets: null, background: null, onComplete, ...props };
  const view = render(<BootSequence ref={ref} {...all} />);
  return { ref, onComplete, view, rerender: (next: Partial<BootSequenceProps>) => view.rerender(<BootSequence ref={ref} {...all} {...next} />) };
}

let timeline: MockInstance<typeof gsap.timeline>;
beforeEach(() => {
  html.setAttribute('data-intro', '');
  timeline = vi.spyOn(gsap, 'timeline');
  // jsdom에는 레이아웃이 없어 offsetParent가 늘 null이다. GSAP은 그런 요소를 잠깐 떼었다 다시 붙이며
  // 다음 요소 형제 앞에 넣어 단어 사이 공백 노드를 밀어낸다. 브라우저에서 보이는 단어는 offsetParent가 있다.
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
  // jsdom의 rAF는 돌지 않는다. GSAP ticker가 돌도록 16ms 타이머로 흉내 낸다.
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  html.removeAttribute('data-intro');
  document.body.innerHTML = '';
});

// 실제 GSAP timeline을 잡는다. 멈춘 채 만들어 다음 tick에 재생하므로 재생이 시작된 뒤 멈추고 seek로 전진시킨다.
async function captureTimeline() {
  await waitFor(() => expect(timeline).toHaveBeenCalled(), { timeout: 3000 });
  const tl = timeline.mock.results[0].value as gsap.core.Timeline;
  await waitFor(() => expect(tl.paused()).toBe(false));
  tl.pause();
  return (time: number) => act(() => { tl.seek(time, false); });
}

const opacity = (element: Element) => Number((element as HTMLElement).style.opacity || 1);
const words = (headline: HTMLElement) => [...headline.querySelectorAll<HTMLElement>('span')];

describe('BootSequence 진입 SSR·접근성', () => {
  it('인사말·커튼 없이 서버 HTML에는 아무것도 그리지 않는다', () => {
    const markup = renderToString(<BootSequence enabled={false} reducedMotion={false} targets={null} background={null} onComplete={() => {}} />);
    expect(markup).toBe('');
    expect(CSS).not.toMatch(/intro-curtain|intro-greeting|intro-ivory|intro-ink/);
  });

  // 진입할 방문은 첫 페인트부터 출발 상태여야 완성된 첫 화면이 한 번 비치지 않는다. JS 없는 방문은 표시가 붙지 않는다.
  it('그리기 전 판정이 있을 때만 이름·나뉘기 전 문장·오브젝트 껍질·배경 안개를 첫 페인트부터 숨긴다', () => {
    expect(CSS).toMatch(/html\[data-intro\] \[data-motion-anchor='nav-name'\] button > span,\nhtml\[data-intro\] \.portfolio-hero h1:not\(\[aria-label\]\),\nhtml\[data-intro\] \.hero-object \.about-electric-static \{ opacity: 0; \}/);
    expect(FLOW_CSS).toMatch(/:global\(html\[data-intro\]\) \.sourceHaze \{ opacity: 0; \}/);
  });

  it('소개 문장은 단어로 나뉜 동안에도 원문 한 번만 읽히고 공백·줄바꿈을 보존한다', async () => {
    const { targets } = makeTargets();
    mount({ targets });
    await captureTimeline();
    const headline = targets.headline;
    expect(headline.textContent).toBe(SENTENCE);
    // 이름에는 개행 대신 공백 하나다. 읽기 이름은 화면 줄바꿈과 무관하다.
    expect(headline).toHaveAttribute('aria-label', '안녕하세요. SW개발자 김태인입니다.');
    expect(words(headline).map(word => word.textContent)).toEqual(['안녕하세요.', 'SW개발자', '김태인입니다.']);
    expect(words(headline).every(word => word.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(screen.getAllByRole('heading', { name: '안녕하세요. SW개발자 김태인입니다.' })).toHaveLength(1);
  });
});

describe('BootSequence 시간표: 실제 GSAP timeline을 seek로 전진시킨다', () => {
  it('배경 공개값은 레이아웃에서 0이고, 0초에 배경·이름·소개·오브젝트가 함께 시작해 .60 / .90 / 1.20에 끝난다', async () => {
    const { targets, background } = makeTargets();
    // 대상(경계 모듈)이 오기 전에도 배경은 첫 그림부터 0이다.
    const { onComplete, rerender } = mount({ background: asHandle(background) });
    expect(background.setRevealProgress).toHaveBeenNthCalledWith(1, 0);
    rerender({ targets });
    const seek = await captureTimeline();
    await seek(0);
    expect(lastReveal(background)).toBe(0);
    const word = words(targets.headline);
    for (const element of [targets.wordmark, targets.heroObject, ...word]) expect(opacity(element)).toBe(0);

    await seek(.02);
    expect(lastReveal(background)).toBeGreaterThan(0);
    expect(opacity(targets.wordmark)).toBeGreaterThan(0);
    expect(opacity(word[0])).toBeGreaterThan(0);
    expect(opacity(targets.heroObject)).toBeGreaterThan(0);

    // 감속 곡선이 가팔라 끝 직전에도 opacity가 1로 반올림된다. 시작·끝 시각은 timeline에서 직접 읽는다.
    const tl = timeline.mock.results[0].value as gsap.core.Timeline;
    const span = (element: Element) => {
      const tween = tl.getTweensOf(element)[0];
      return [tween.startTime(), tween.startTime() + tween.duration()].map(value => Number(value.toFixed(3)));
    };
    expect(span(targets.wordmark)).toEqual([0, .6]);
    expect(span(word[0])[0]).toBe(0);
    expect(Math.max(...word.map(element => span(element)[1]))).toBe(.9);
    expect(span(targets.heroObject)).toEqual([0, 1.2]);
    expect(tl.duration()).toBeCloseTo(1.2, 6);
    await seek(.3);
    expect(opacity(targets.wordmark)).toBeLessThan(1);
    expect(opacity(word.at(-1)!)).toBe(0);
    await seek(.6);
    expect(opacity(targets.wordmark)).toBe(1);
    await seek(.9);
    expect(word.every(element => opacity(element) === 1)).toBe(true);
    expect(opacity(targets.heroObject)).toBeLessThan(1);
    expect(lastReveal(background)).toBeLessThan(1);
    expect(onComplete).not.toHaveBeenCalled();

    await seek(INTRO_TIMING.object);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(lastReveal(background)).toBe(1);
    // 원문이 돌아오고 진입이 쓴 인라인 자세가 남지 않는다.
    expect(targets.headline.innerHTML).toBe(SENTENCE);
    expect(targets.headline).not.toHaveAttribute('aria-label');
    expect(targets.headline.style.width).toBe('');
    expect(targets.wordmark.style.opacity + targets.wordmark.style.transform).toBe('');
    expect(targets.heroObject.style.opacity + targets.heroObject.style.transform).toBe('');
    expect(html).not.toHaveAttribute('data-intro');
  });

  it('소개 단어는 각 .35초, 전체 .90초, 간격 (.90-.35)/(N-1)로 앞 단어부터 열린다', async () => {
    expect(introWordStagger(3)).toBeCloseTo(.275, 6);
    expect(introWordStagger(2)).toBeCloseTo(.55, 6);
    expect(introWordStagger(1)).toBe(0);
    expect(introWordStagger(0)).toBe(0);
    const { targets } = makeTargets();
    mount({ targets });
    const seek = await captureTimeline();
    const word = words(targets.headline);
    const each = introWordStagger(word.length);
    for (let index = 1; index < word.length; index++) {
      await seek(each * index - .01);
      expect(opacity(word[index - 1]), `word ${index - 1}`).toBeGreaterThan(0);
      expect(opacity(word[index]), `word ${index}`).toBe(0);
    }
  });

  it('배경 ref가 늦게 붙으면 진입의 현재 공개값을 받는다. 0으로 되감지 않는다', async () => {
    const { targets } = makeTargets(null);
    const view = mount({ targets });
    const seek = await captureTimeline();
    await seek(.6);
    const late = makeBackground();
    view.rerender({ background: asHandle(late) });
    const first = late.setRevealProgress.mock.calls[0][0];
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    expect(late.setRevealProgress).not.toHaveBeenCalledWith(0);
    await seek(1);
    expect(lastReveal(late)).toBeGreaterThan(first);
  });
});

// 사용자 결정(2026-10-20). 커튼이 없으니 프레임이 고르기를 기다리지 않는다. 배경의 첫 그림 정지는 따로 잰다.
describe('BootSequence 즉시 시작', () => {
  it('rAF가 오지 않아도 GSAP과 대상이 오면 바로 timeline을 만든다', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const { targets } = makeTargets();
    mount({ targets });
    await waitFor(() => expect(timeline).toHaveBeenCalledTimes(1));
  });
});

describe('BootSequence 중단 경로: 공개값 1·원문·원래 입력 유지', () => {
  it.each([
    ['직접 해시·비활성 인트로', { enabled: false }],
    ['모션 감소', { reducedMotion: true }],
  ] as const)('%s는 처음부터 공개값 1이고 timeline 없이 완료 신호를 한 번 보낸다', async (_, props) => {
    const { targets, background, button } = makeTargets();
    button.style.transform = 'translate3d(10px, 300px, 0)';
    const { onComplete } = mount({ targets, background: asHandle(background), ...props });
    expect(background.setRevealProgress).toHaveBeenCalledWith(1);
    expect(background.setRevealProgress).not.toHaveBeenCalledWith(0);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(html).not.toHaveAttribute('data-intro');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(timeline).not.toHaveBeenCalled();
    // 비활성 인트로는 경계가 놓은 이름 자리를 덮어쓰지 않는다.
    expect(button.style.transform).toBe('translate3d(10px, 300px, 0)');
    expect(targets.wordmark.getAttribute('style')).toBeNull();
    expect(targets.headline.innerHTML).toBe(SENTENCE);
  });

  // 리뷰 Important 3. 하이드레이션이 늦어 판정 스크립트의 안전장치가 먼저 표시를 걷은 순서다.
  it('켜진 진입이라도 마운트 전에 표시가 이미 걷혔으면 다시 숨기지 않고 정적 첫 화면으로 끝낸다', async () => {
    html.removeAttribute('data-intro');
    const { targets, background } = makeTargets();
    const { onComplete } = mount({ targets, background: asHandle(background) });
    expect(html).not.toHaveAttribute('data-intro');
    expect(background.setRevealProgress).not.toHaveBeenCalledWith(0);
    expect(lastReveal(background)).toBe(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(timeline).not.toHaveBeenCalled();
    expect(targets.headline.innerHTML).toBe(SENTENCE);
  });

  it('도중 finish()는 공개값 1·원문·최종 자세로 정리하고, 남은 timeline이 다시 재생하거나 신호를 또 보내지 않는다', async () => {
    const { targets, background } = makeTargets();
    const { ref, onComplete } = mount({ targets, background: asHandle(background) });
    const seek = await captureTimeline();
    await seek(.3);
    act(() => ref.current!.finish());
    expect(lastReveal(background)).toBe(1);
    expect(targets.headline.innerHTML).toBe(SENTENCE);
    expect(opacity(targets.wordmark)).toBe(1);
    expect(opacity(targets.heroObject)).toBe(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    await seek(.9);
    await seek(INTRO_TIMING.object);
    act(() => ref.current!.finish());
    expect(background.setRevealProgress.mock.calls.slice(-1)).toEqual([[1]]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['wheel', () => new WheelEvent('wheel', { deltaY: 120, cancelable: true })],
    ['keydown', () => new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true })],
    ['pointerdown', () => new Event('pointerdown', { cancelable: true })],
    ['touchstart', () => new Event('touchstart', { cancelable: true })],
  ] as const)('초기 %s는 진입을 끝내고 입력을 막지 않는다', async (_, make) => {
    const { targets, background } = makeTargets();
    const { onComplete } = mount({ targets, background: asHandle(background) });
    await captureTimeline();
    const event = make();
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(lastReveal(background)).toBe(1);
  });

  it('시간표 도중 언마운트하면 원문·자세를 되돌리고 표시를 지운다', async () => {
    const { targets } = makeTargets();
    const { view } = mount({ targets });
    const seek = await captureTimeline();
    await seek(.15);
    expect(words(targets.headline).length).toBeGreaterThan(1);
    expect(opacity(targets.wordmark)).toBeLessThan(1);
    view.unmount();
    expect(targets.headline.innerHTML).toBe(SENTENCE);
    expect(targets.headline).not.toHaveAttribute('aria-label');
    expect(targets.headline.style.width).toBe('');
    expect(targets.wordmark.style.opacity + targets.wordmark.style.transform).toBe('');
    expect(targets.heroObject.style.opacity + targets.heroObject.style.transform).toBe('');
    expect(html).not.toHaveAttribute('data-intro');
  });

  it('문서 스크롤은 인트로를 끝내지만 안쪽 스크롤러의 스크롤은 끝내지 않는다', async () => {
    const { targets } = makeTargets();
    const { onComplete } = mount({ targets });
    await captureTimeline();
    const scroller = document.createElement('div');
    document.body.append(scroller);
    act(() => { scroller.dispatchEvent(new Event('scroll')); });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { document.dispatchEvent(new Event('scroll')); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

// 최종 리뷰 I1. next dev의 StrictMode는 마운트 직후 효과를 한 번 걷었다 다시 건다. 그 정리가 표시를 지워 인트로가 바로 끝났다.
describe('BootSequence StrictMode', () => {
  const strict = (targets: IntroTargets) => {
    const onComplete = vi.fn();
    render(<StrictMode><BootSequence enabled reducedMotion={false} targets={targets} background={null} onComplete={onComplete} /></StrictMode>);
    return { onComplete };
  };

  it('가짜 언마운트 뒤에도 진입이 돌고 끝에서 한 번만 끝난다', async () => {
    const { targets } = makeTargets();
    const { onComplete } = strict(targets);
    expect(onComplete).not.toHaveBeenCalled();
    expect(html).toHaveAttribute('data-intro', 'playing');
    const seek = await captureTimeline();
    await seek(.5);
    expect(onComplete).not.toHaveBeenCalled();
    expect(html).toHaveAttribute('data-intro', 'playing');
    await seek(INTRO_TIMING.object);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(html).not.toHaveAttribute('data-intro');
    expect(targets.headline.innerHTML).toBe(SENTENCE);
  });

  it('판정 스크립트가 이미 걷은 표시는 StrictMode에서도 다시 걸지 않는다', () => {
    html.removeAttribute('data-intro');
    const { targets } = makeTargets();
    const { onComplete } = strict(targets);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(html).not.toHaveAttribute('data-intro');
  });
});
