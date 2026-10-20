'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { LuminousFlowBackgroundHandle } from '@/components/blocks/LuminousFlowBackground';
import type { gsap } from '@/lib/gsap';

export interface IntroTargets {
  wordmark: HTMLElement; headline: HTMLElement; heroObject: HTMLElement;
  background: LuminousFlowBackgroundHandle | null;
}
export interface BootSequenceHandle { finish(): void }
export interface BootSequenceProps {
  enabled: boolean; reducedMotion: boolean; targets: IntroTargets | null;
  onRevealStart: () => void; onComplete: () => void;
}

export const INTRO_GREETINGS = ['안녕하세요.', 'SW개발자.', '김태인입니다.', '잘부탁드립니다.'] as const;
// 통합 설계 5.3의 포트폴리오 제안값(초)이다. 원본 영상에서 잰 값이 아니다.
export const INTRO_TIMING = {
  greetings: [0, .4, .8, 1.25], clear: 1.7, curtain: 1.85, reveal: 2.45,
  name: .6, words: .9, word: .35, object: 1.2,
} as const;
// 중앙이 가장자리보다 늦게 출발해 같은 순간에 화면 위로 빠진다. 그래서 가운데가 처졌다가 나가며 평평해진다.
const CENTRE_LAG = .15;
// 모듈이나 대상이 이 안에 오지 않으면 커튼을 걷고 완성된 첫 화면을 준다.
const LOAD_LIMIT_MS = 3000;
// 커튼 아래 배경의 첫 래스터가 이 기기에서 프레임을 1–2초 멈췄다. 첫 인사는 정지 화면이라 그동안 머물러도 티가 나지 않는다.
// 프레임이 이만큼 고르게 돈 뒤에 시간표를 시작하고, 아무리 늦어도 SETTLE_LIMIT_MS에는 시작한다.
export const SETTLE_MS = 400;
const SETTLE_LIMIT_MS = 2000;
const STEADY_FRAME_MS = 100;
// 첫 입력은 막지 않는다. 인트로만 끝내고 원래 동작(스크롤·탐색)이 그대로 이어진다.
const INPUTS = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'] as const;

export const introWordStagger = (count: number) =>
  count > 1 ? (INTRO_TIMING.words - INTRO_TIMING.word) / (count - 1) : 0;
// 화면 비율과 무관한 0–100 좌표. 아래 경계는 양끝(edge)에서 출발해 가운데(centre)를 제어점으로 휜다.
export const curtainPath = (edge: number, centre: number) => `M0 0H100V${edge}Q50 ${centre} 0 ${edge}Z`;

// 공백 덩어리는 원래 텍스트 노드로 두고 단어만 감싼다. 원문·공백·줄바꿈 자리가 그대로이고, 읽기는 aria-label 한 번이다.
function splitWords(headline: HTMLElement) {
  const text = headline.textContent ?? '';
  headline.setAttribute('aria-label', text);
  const words = text.split(/(\s+)/).filter(Boolean).map(part => {
    if (/^\s+$/.test(part)) return document.createTextNode(part);
    const word = document.createElement('span');
    word.setAttribute('aria-hidden', 'true');
    word.style.display = 'inline-block';
    word.textContent = part;
    return word;
  });
  headline.replaceChildren(...words);
  return { words: words.filter((node): node is HTMLSpanElement => node instanceof HTMLSpanElement), revert: () => { headline.textContent = text; headline.removeAttribute('aria-label'); } };
}

const clearPose = (element: HTMLElement) => {
  element.style.removeProperty('opacity');
  element.style.removeProperty('transform');
};

const BootSequence = forwardRef<BootSequenceHandle, BootSequenceProps>(function BootSequence({ enabled, reducedMotion, targets, onRevealStart, onComplete }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [gsapModule, setGsapModule] = useState<typeof import('@/lib/gsap') | null>(null);
  const [done, setDone] = useState(false);
  const playing = enabled && !reducedMotion && !done;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const callbacks = useRef({ onRevealStart, onComplete });
  callbacks.current = { onRevealStart, onComplete };
  // 배경 공개값. 인트로가 켜져 있으면 0에서 출발하고, 늦게 붙은 배경 ref도 이 현재값을 받는다.
  const reveal = useRef({ value: enabled && !reducedMotion ? 0 : 1 });
  const run = useRef<{ timeline: gsap.core.Timeline | null; split: ReturnType<typeof splitWords> | null; limit: ReturnType<typeof setTimeout> | undefined; revealed: boolean; completed: boolean; claimed: boolean }>(
    { timeline: null, split: null, limit: undefined, revealed: false, completed: false, claimed: false });

  const applyReveal = (value: number) => {
    reveal.current.value = value;
    targetsRef.current?.background?.setRevealProgress(value);
  };
  const revealStart = () => {
    if (run.current.revealed) return;
    run.current.revealed = true;
    callbacks.current.onRevealStart();
  };
  const tidy = () => {
    const state = run.current;
    clearTimeout(state.limit);
    const built = state.timeline !== null;
    state.timeline?.kill();
    state.timeline = null;
    state.split?.revert();
    state.split = null;
    const current = targetsRef.current;
    if (current && built) {
      clearPose(current.wordmark);
      clearPose(current.heroObject);
      current.headline.style.removeProperty('width');
    }
  };
  // 완료·중단·해시·모션 감소가 모두 여기로 온다. 원문을 되돌리고 공개값 1로 끝내며 두 신호는 한 번씩만 보낸다.
  const settle = useCallback(() => {
    if (run.current.completed) return;
    tidy();
    run.current.completed = true;
    applyReveal(1);
    revealStart();
    if (document.documentElement.hasAttribute('data-intro')) document.documentElement.removeAttribute('data-intro');
    setDone(true);
    callbacks.current.onComplete();
  }, []);
  useImperativeHandle(ref, () => ({ finish: settle }), [settle]);

  // 페인트 전에 인트로를 맡는다. 판정 스크립트의 안전장치가 커튼을 걷지 않게 표시를 바꾼다.
  // 하이드레이션이 늦어 안전장치가 이미 커튼을 걷었다면 다시 덮지 않고 정적 첫 화면으로 끝낸다.
  // 안전장치는 'playing'을 걷지 않는다. 맡은 뒤 표시가 없으면 StrictMode의 가짜 언마운트가 지운 것이라 다시 맡는다.
  useLayoutEffect(() => {
    const html = document.documentElement;
    if (!enabled || reducedMotion || !(html.hasAttribute('data-intro') || run.current.claimed)) settle();
    else if (!run.current.completed) {
      html.setAttribute('data-intro', 'playing');
      run.current.claimed = true;
    }
  }, [enabled, reducedMotion, settle]);
  // 배경 ref가 늦게 붙어도 지금의 공개값을 준다. 이미 진행한 값을 0으로 되감지 않는다.
  const background = targets?.background ?? null;
  useLayoutEffect(() => { background?.setRevealProgress(reveal.current.value); }, [background]);

  useEffect(() => {
    if (!playing) return;
    let alive = true;
    const limit = run.current.limit = setTimeout(settle, LOAD_LIMIT_MS);
    import('@/lib/gsap').then(module => { if (alive) setGsapModule(module); }).catch(() => { if (alive) settle(); });
    // 안쪽 스크롤러(가로 목록 등)의 초기화 스크롤은 사용자 입력이 아니다. 문서 스크롤만 본다.
    const onInput = (event: Event) => { if (event.type !== 'scroll' || event.target === document) settle(); };
    const options = { capture: true, passive: true };
    INPUTS.forEach(type => window.addEventListener(type, onInput, options));
    return () => {
      alive = false;
      clearTimeout(limit);
      INPUTS.forEach(type => window.removeEventListener(type, onInput, options));
    };
  }, [playing, settle]);
  useEffect(() => () => {
    tidy();
    document.documentElement.removeAttribute('data-intro');
  }, []);

  useEffect(() => {
    const root = rootRef.current, path = pathRef.current;
    if (!playing || !gsapModule || !targets || !root || !path || run.current.timeline) return;
    clearTimeout(run.current.limit);
    const begun = performance.now();
    let last = begun, steady = 0, frame = 0;
    const wait = (now: number) => {
      steady = now - last < STEADY_FRAME_MS ? steady + now - last : 0;
      last = now;
      if (steady < SETTLE_MS && now - begun < SETTLE_LIMIT_MS) frame = requestAnimationFrame(wait);
      else build();
    };
    frame = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(frame);

    // 시간표 전체를 한 번에 만든다. 2.45 위치 하나에서 네 진입이 함께 출발한다.
    function build() {
      if (run.current.completed || !gsapModule || !targets || !root || !path) return;
      const { gsap, registerGsap, SITE_EASE } = gsapModule;
      registerGsap();
      const { wordmark, headline, heroObject } = targets;
      const T = INTRO_TIMING;
      const greetings = [...root.querySelectorAll<HTMLElement>('[data-intro-greeting]')];
      // 줄바꿈이 나뉜 단어 때문에 바뀌지 않게 폭을 먼저 고정한다.
      headline.style.width = `${headline.getBoundingClientRect().width}px`;
      const split = splitWords(headline);
      run.current.split = split;
      const curtain = { edge: 100, centre: 100 };
      const draw = () => path.setAttribute('d', curtainPath(curtain.edge, curtain.centre));
      const tl = gsap.timeline({ onComplete: settle });
      run.current.timeline = tl;
      // 같은 자리에서 끊어 바꾼다(원본 시안의 리듬). 마지막 인사만 짧게 흐려 정리한다.
      greetings.forEach((greeting, index) => {
        if (index) tl.set(greetings[index - 1], { opacity: 0 }, T.greetings[index]).set(greeting, { opacity: 1 }, T.greetings[index]);
      });
      tl.to(greetings[greetings.length - 1], { opacity: 0, y: -8, duration: T.curtain - T.clear, ease: 'power2.in' }, T.clear)
        .to(curtain, { edge: 0, duration: T.reveal - T.curtain, ease: 'power2.inOut', onUpdate: draw }, T.curtain)
        .to(curtain, { centre: 0, duration: T.reveal - T.curtain - CENTRE_LAG, ease: 'power2.inOut', onUpdate: draw }, T.curtain + CENTRE_LAG)
        // 커튼이 빠진 순간이 공통 시작이다. 배경 확장과 세 요소의 진입이 같은 위치에서 함께 출발한다.
        .call(revealStart, undefined, T.reveal)
        .fromTo(wordmark, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: T.name, ease: SITE_EASE }, T.reveal)
        .fromTo(split.words, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: T.word, ease: SITE_EASE, stagger: introWordStagger(split.words.length) }, T.reveal)
        .fromTo(heroObject, { opacity: 0, scale: .92 }, { opacity: 1, scale: 1, duration: T.object, ease: SITE_EASE }, T.reveal)
        // 첫 화면은 경로 앞쪽 일부라 천천히 출발해야 위에서 아래로 뻗는 것이 보인다.
        .to(reveal.current, { value: 1, duration: T.object, ease: 'power2.in', onUpdate: () => applyReveal(reveal.current.value) }, T.reveal);
    }
  }, [playing, gsapModule, targets, settle]);

  if (done) return null;
  return <div ref={rootRef} className="intro-curtain" aria-hidden="true">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
      <path ref={pathRef} d={curtainPath(100, 100)} />
    </svg>
    {INTRO_GREETINGS.map(greeting => <p key={greeting} data-intro-greeting="" className="intro-greeting">{greeting}</p>)}
  </div>;
});

export default BootSequence;
