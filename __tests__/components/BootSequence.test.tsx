import { readFileSync } from 'node:fs';
import { createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import BootSequence, {
  curtainPath, INTRO_GREETINGS, INTRO_TIMING, introWordStagger, SETTLE_MS,
  type BootSequenceHandle, type BootSequenceProps, type IntroTargets,
} from '@/components/sections/BootSequence';
import { gsap } from '@/lib/gsap';

// 통합 설계 5.3·5.4의 제안값. 원본 영상의 측정값이 아니다.
const SENTENCE = '탄탄한 기본기를 바탕으로 꾸준히 개선하고, 협업으로 함께 성장하는 개발자.';
const CSS = readFileSync('styles/design-tokens.css', 'utf8').replace(/\r\n/g, '\n');
const html = document.documentElement;

type Background = { setRevealProgress: ReturnType<typeof vi.fn> };
const makeBackground = (): Background => ({ setRevealProgress: vi.fn() });
const lastReveal = (background: Background) => background.setRevealProgress.mock.calls.at(-1)?.[0];

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
  const targets: IntroTargets = { wordmark, headline, heroObject, background: background as unknown as IntroTargets['background'] };
  return { targets, button, background: background! };
}

function mount(props: Partial<BootSequenceProps> = {}) {
  const ref = createRef<BootSequenceHandle>();
  const onRevealStart = vi.fn();
  const onComplete = vi.fn();
  const all: BootSequenceProps = { enabled: true, reducedMotion: false, targets: null, onRevealStart, onComplete, ...props };
  const view = render(<BootSequence ref={ref} {...all} />);
  return { ref, onRevealStart, onComplete, view, rerender: (next: Partial<BootSequenceProps>) => view.rerender(<BootSequence ref={ref} {...all} {...next} />) };
}

let timeline: MockInstance<typeof gsap.timeline>;
beforeEach(() => {
  html.setAttribute('data-intro', '');
  timeline = vi.spyOn(gsap, 'timeline');
  // jsdom에는 레이아웃이 없어 offsetParent가 늘 null이다. GSAP은 그런 요소를 잠깐 떼었다 다시 붙이며
  // 다음 요소 형제 앞에 넣어 단어 사이 공백 노드를 밀어낸다. 브라우저에서 보이는 단어는 offsetParent가 있다.
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
  // jsdom의 rAF는 돌지 않는다. 시작 게이트가 고른 프레임을 받도록 16ms 타이머로 흉내 낸다.
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  html.removeAttribute('data-intro');
  document.body.innerHTML = '';
});

// 실제 GSAP timeline을 잡아 멈추고, 이벤트를 켠 채 seek로 전진시킨다.
// 시간표는 프레임이 SETTLE_MS 동안 고르게 돈 뒤에 만들어진다.
async function captureTimeline() {
  await waitFor(() => expect(timeline).toHaveBeenCalled(), { timeout: 3000 });
  const tl = timeline.mock.results[0].value as gsap.core.Timeline;
  tl.pause();
  return (time: number) => act(() => { tl.seek(time, false); });
}

const greetings = () => [...document.querySelectorAll<HTMLElement>('[data-intro-greeting]')];
// 첫 인사는 CSS로 보이고 나머지는 CSS로 숨는다. 인라인 opacity만으로 지금 보이는 인사를 가린다.
const shownGreeting = () => greetings().findIndex((node, index) => index === 0 ? node.style.opacity !== '0' : node.style.opacity === '1');
const opacity = (element: Element) => Number((element as HTMLElement).style.opacity || 1);
const words = (headline: HTMLElement) => [...headline.querySelectorAll<HTMLElement>('span')];

describe('BootSequence 인트로 SSR·접근성', () => {
  it('커튼과 네 인사말은 서버 HTML에 있고 장식이라 보조기기에서 감춘다', () => {
    const markup = renderToString(<BootSequence enabled={false} reducedMotion={false} targets={null} onRevealStart={() => {}} onComplete={() => {}} />);
    expect(markup).toContain('class="intro-curtain" aria-hidden="true"');
    const order = INTRO_GREETINGS.map(text => markup.indexOf(text));
    expect(order.every((index, i) => index > -1 && (i === 0 || index > order[i - 1]))).toBe(true);
    expect([...INTRO_GREETINGS]).toEqual(['안녕하세요.', 'SW개발자.', '김태인입니다.', '잘부탁드립니다.']);
    expect(markup).toContain(`d="${curtainPath(100, 100)}"`);
    expect(markup).not.toMatch(/\d+\s*%|START|canvas/);
  });

  it('커튼은 그리기 전 판정이 있을 때만 덮고 입력을 막지 않으며, 아이보리 면·검은 인사말에 발광 경계가 없다', () => {
    expect(CSS).toMatch(/\n\.intro-curtain \{ display: none; \}/);
    expect(CSS).toMatch(/html\[data-intro\] \.intro-curtain \{[^}]*position: fixed;[^}]*pointer-events: none;/);
    expect(CSS).toMatch(/--color-intro-ivory: #f5f2eb;/);
    expect(CSS).toMatch(/--color-intro-ink: #17191c;/);
    expect(CSS).toMatch(/\.intro-curtain svg \{[^}]*fill: var\(--color-intro-ivory\)/);
    expect(CSS).toMatch(/\.intro-greeting \{[^}]*color: var\(--color-intro-ink\)/);
    expect(CSS).toMatch(/\.intro-greeting ~ \.intro-greeting \{ opacity: 0; \}/);
    const rules = CSS.match(/[^\n]*\.intro-(curtain|greeting)[^{]*\{[^}]*\}/g)!.join('\n');
    expect(rules).not.toMatch(/shadow|filter|glow|blur/);
  });

  it('소개 문장은 단어로 나뉜 동안에도 원문 한 번만 읽히고 공백·문장을 보존한다', async () => {
    const { targets } = makeTargets();
    mount({ targets });
    await captureTimeline();
    const headline = targets.headline;
    expect(headline.textContent).toBe(SENTENCE);
    expect(headline).toHaveAttribute('aria-label', SENTENCE);
    expect(words(headline).length).toBe(SENTENCE.split(' ').length);
    expect(words(headline).every(word => word.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(screen.getAllByRole('heading', { name: SENTENCE })).toHaveLength(1);
  });
});

describe('BootSequence 시간표 — 실제 GSAP timeline을 seek로 전진시킨다', () => {
  it('0 / .40 / .80 / 1.25초에 네 인사말, 1.70에 정리, 1.85–2.45에 커튼이 양끝부터 걷힌다', async () => {
    const { targets } = makeTargets();
    mount({ targets });
    const seek = await captureTimeline();
    const path = document.querySelector('.intro-curtain path')!;
    for (const [time, index] of [[.2, 0], [.39, 0], [.41, 1], [.79, 1], [.81, 2], [1.24, 2], [1.26, 3], [1.69, 3]] as const) {
      await seek(time);
      expect(shownGreeting(), `${time}s`).toBe(index);
    }
    await seek(1.78);
    expect(opacity(greetings()[3])).toBeGreaterThan(0);
    expect(opacity(greetings()[3])).toBeLessThan(1);
    await seek(INTRO_TIMING.curtain);
    expect(opacity(greetings()[3])).toBe(0);
    expect(path.getAttribute('d')).toBe(curtainPath(100, 100));
    await seek(2.1);
    const [edge, centre] = path.getAttribute('d')!.match(/V([\d.]+)Q50 ([\d.]+)/)!.slice(1).map(Number);
    // 가장자리가 먼저 오르고 가운데가 처진다.
    expect(edge).toBeLessThan(100);
    expect(centre).toBeGreaterThan(edge);
    await seek(2.35);
    const [edge2, centre2] = path.getAttribute('d')!.match(/V([\d.]+)Q50 ([\d.]+)/)!.slice(1).map(Number);
    // 빠져나가며 평평해진다.
    expect(centre2 - edge2).toBeLessThan(centre - edge);
    await seek(INTRO_TIMING.reveal);
    expect(path.getAttribute('d')).toBe(curtainPath(0, 0));
  });

  it('2.45 전에는 배경 공개값이 0이고, 2.45에 배경·이름·소개·오브젝트가 함께 시작해 3.05 / 3.35 / 3.65에 끝난다', async () => {
    const { targets, background } = makeTargets();
    const { onRevealStart, onComplete } = mount({ targets });
    // 커튼이 무엇이든 드러내기 전, 레이아웃 단계에서 0을 건다.
    expect(background.setRevealProgress).toHaveBeenNthCalledWith(1, 0);
    const seek = await captureTimeline();
    for (const time of [.5, 1.9, 2.2, 2.44]) {
      await seek(time);
      expect(background.setRevealProgress.mock.calls.every(([value]) => value === 0), `${time}s`).toBe(true);
      expect(onRevealStart).not.toHaveBeenCalled();
    }
    const word = words(targets.headline);
    for (const element of [targets.wordmark, targets.heroObject, ...word]) expect(opacity(element)).toBe(0);

    await seek(2.47);
    expect(onRevealStart).toHaveBeenCalledTimes(1);
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
    expect(span(targets.wordmark)).toEqual([2.45, 3.05]);
    expect(span(word[0])[0]).toBe(2.45);
    expect(Math.max(...word.map(element => span(element)[1]))).toBe(3.35);
    expect(span(targets.heroObject)).toEqual([2.45, 3.65]);
    await seek(2.75);
    expect(opacity(targets.wordmark)).toBeLessThan(1);
    expect(opacity(word.at(-1)!)).toBe(0);
    await seek(3.05);
    expect(opacity(targets.wordmark)).toBe(1);
    await seek(3.35);
    expect(word.every(element => opacity(element) === 1)).toBe(true);
    expect(opacity(targets.heroObject)).toBeLessThan(1);
    expect(lastReveal(background)).toBeLessThan(1);
    expect(onComplete).not.toHaveBeenCalled();

    await seek(INTRO_TIMING.reveal + INTRO_TIMING.object);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onRevealStart).toHaveBeenCalledTimes(1);
    expect(lastReveal(background)).toBe(1);
    // 원문이 돌아오고 인트로가 쓴 인라인 자세가 남지 않는다.
    expect(targets.headline.innerHTML).toBe(SENTENCE);
    expect(targets.headline).not.toHaveAttribute('aria-label');
    expect(targets.headline.style.width).toBe('');
    expect(targets.wordmark.style.opacity + targets.wordmark.style.transform).toBe('');
    expect(targets.heroObject.style.opacity + targets.heroObject.style.transform).toBe('');
    expect(html).not.toHaveAttribute('data-intro');
    expect(document.querySelector('.intro-curtain')).toBeNull();
  });

  it('소개 단어는 각 .35초, 전체 .90초, 간격 (.90-.35)/(N-1)로 앞 단어부터 열린다', async () => {
    expect(introWordStagger(9)).toBeCloseTo(.06875, 6);
    expect(introWordStagger(2)).toBeCloseTo(.55, 6);
    expect(introWordStagger(1)).toBe(0);
    expect(introWordStagger(0)).toBe(0);
    const { targets } = makeTargets();
    mount({ targets });
    const seek = await captureTimeline();
    const word = words(targets.headline);
    const each = introWordStagger(word.length);
    for (let index = 1; index < word.length; index++) {
      await seek(INTRO_TIMING.reveal + each * index - .01);
      expect(opacity(word[index - 1]), `word ${index - 1}`).toBeGreaterThan(0);
      expect(opacity(word[index]), `word ${index}`).toBe(0);
    }
  });

  it('배경 ref가 늦게 붙으면 인트로의 현재 공개값을 받는다. 0으로 되감지 않는다', async () => {
    const { targets } = makeTargets(null);
    const view = mount({ targets });
    const seek = await captureTimeline();
    await seek(3.1);
    const late = makeBackground();
    view.rerender({ targets: { ...targets, background: late as unknown as IntroTargets['background'] } });
    const first = late.setRevealProgress.mock.calls[0][0];
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    expect(late.setRevealProgress).not.toHaveBeenCalledWith(0);
    await seek(3.3);
    expect(lastReveal(late)).toBeGreaterThan(first);
  });
});

// 헤드 Chrome에서 잡혔다. 커튼 아래 배경의 첫 래스터가 프레임을 1–2초 멈춰 인사말 리듬이 끊겼다.
describe('BootSequence 시작 게이트 — 프레임이 고를 때 시간표를 시작한다', () => {
  it('긴 프레임 공백 뒤 SETTLE_MS 동안 고른 프레임이 와야 timeline을 만들고, 그 전에는 첫 인사가 머문다', async () => {
    const queue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { queue.push(callback); return queue.length; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    let now = performance.now();
    const step = (gap: number) => act(() => { now += gap; queue.splice(0).forEach(callback => callback(now)); });
    const { targets } = makeTargets();
    mount({ targets });
    await waitFor(() => expect(queue.length).toBeGreaterThan(0));
    await step(16);
    await step(1200);
    for (let elapsed = 0; elapsed < SETTLE_MS - 20; elapsed += 20) await step(20);
    expect(timeline).not.toHaveBeenCalled();
    expect(shownGreeting()).toBe(0);
    await step(20);
    await step(20);
    expect(timeline).toHaveBeenCalledTimes(1);
  });
});

describe('BootSequence 중단 경로 — 공개값 1·원문·원래 입력 유지', () => {
  it.each([
    ['직접 해시·비활성 인트로', { enabled: false }],
    ['모션 감소', { reducedMotion: true }],
  ] as const)('%s는 처음부터 공개값 1이고 커튼·timeline 없이 두 신호를 한 번씩 보낸다', async (_, props) => {
    const { targets, background, button } = makeTargets();
    button.style.transform = 'translate3d(10px, 300px, 0)';
    const { onRevealStart, onComplete } = mount({ targets, ...props });
    expect(background.setRevealProgress).toHaveBeenCalledWith(1);
    expect(background.setRevealProgress).not.toHaveBeenCalledWith(0);
    expect(onRevealStart).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.intro-curtain')).toBeNull();
    expect(html).not.toHaveAttribute('data-intro');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(timeline).not.toHaveBeenCalled();
    // 비활성 인트로는 경계가 놓은 이름 자리를 덮어쓰지 않는다.
    expect(button.style.transform).toBe('translate3d(10px, 300px, 0)');
    expect(targets.wordmark.getAttribute('style')).toBeNull();
    expect(targets.headline.innerHTML).toBe(SENTENCE);
  });

  it('도중 finish()는 공개값 1·원문·최종 자세로 정리하고, 남은 timeline이 다시 재생하거나 신호를 또 보내지 않는다', async () => {
    const { targets, background } = makeTargets();
    const { ref, onRevealStart, onComplete } = mount({ targets });
    const seek = await captureTimeline();
    await seek(1.0);
    act(() => ref.current!.finish());
    expect(lastReveal(background)).toBe(1);
    expect(targets.headline.innerHTML).toBe(SENTENCE);
    expect(opacity(targets.wordmark)).toBe(1);
    expect(opacity(targets.heroObject)).toBe(1);
    expect(onRevealStart).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.intro-curtain')).toBeNull();
    await seek(3.0);
    await seek(INTRO_TIMING.reveal + INTRO_TIMING.object);
    act(() => ref.current!.finish());
    expect(background.setRevealProgress.mock.calls.slice(-1)).toEqual([[1]]);
    expect(onRevealStart).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['wheel', () => new WheelEvent('wheel', { deltaY: 120, cancelable: true })],
    ['keydown', () => new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true })],
    ['pointerdown', () => new Event('pointerdown', { cancelable: true })],
    ['touchstart', () => new Event('touchstart', { cancelable: true })],
  ] as const)('초기 %s는 인트로를 끝내고 입력을 막지 않는다', async (_, make) => {
    const { targets, background } = makeTargets();
    const { onComplete } = mount({ targets });
    await captureTimeline();
    const event = make();
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(lastReveal(background)).toBe(1);
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
