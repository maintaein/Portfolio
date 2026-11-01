'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { LuminousFlowBackgroundHandle } from '@/components/blocks/LuminousFlowBackground';
import type { gsap } from '@/lib/gsap';

export interface IntroTargets { wordmark: HTMLElement; headline: HTMLElement; heroObject: HTMLElement }
export interface BootSequenceHandle { finish(): void }
export interface BootSequenceProps {
  enabled: boolean; reducedMotion: boolean; targets: IntroTargets | null;
  background: LuminousFlowBackgroundHandle | null;
  onComplete: () => void;
}

// 통합 설계 5.4의 포트폴리오 제안값(초)이다. 네 진입이 0초에 함께 출발한다.
// 배경은 가닥마다 제 길을 따라 자라므로 더 길다(사용자 결정 2026-10-21). LuminousFlowBackground/entrance.ts의 REVEAL_SECONDS와 같은 값이다.
// 이 모듈은 react만 값으로 가져온다(First Load 계약). 그래서 가져오지 않고 같은 수를 둔다.
export const INTRO_TIMING = { name: .6, words: .9, word: .35, object: 1.2, background: 2.9 } as const;
// 모듈이나 대상이 이 안에 오지 않으면 숨긴 출발 상태를 걷고 완성된 첫 화면을 준다.
const LOAD_LIMIT_MS = 3000;
// 첫 입력은 막지 않는다. 진입만 끝내고 원래 동작(스크롤·탐색)이 그대로 이어진다.
const INPUTS = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'] as const;
// 진입 도중 첫 입력은 남은 진입(가닥별 배경과 덜 끝난 이름·문장·오브젝트)을 이만큼(초) 감속으로 마저 돌린다.
// 배경이 2.9초라 첫 휠이 한가운데 떨어지기 쉽고, 한 번에 끝내면 배경 전체가 툭 바뀐다(최종 리뷰 I-1).
const FAST_FINISH = .35;

export const introWordStagger = (count: number) =>
  count > 1 ? (INTRO_TIMING.words - INTRO_TIMING.word) / (count - 1) : 0;

// 공백 덩어리는 원래 텍스트 노드로 두고 단어만 감싼다. 원문·공백·줄바꿈 자리가 그대로이고, 읽기는 aria-label 한 번이다.
function splitWords(headline: HTMLElement) {
  const text = headline.textContent ?? '';
  headline.setAttribute('aria-label', text.replace(/\s+/g, ' '));
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

const BootSequence = forwardRef<BootSequenceHandle, BootSequenceProps>(function BootSequence({ enabled, reducedMotion, targets, background, onComplete }, ref) {
  const [gsapModule, setGsapModule] = useState<typeof import('@/lib/gsap') | null>(null);
  const [done, setDone] = useState(false);
  const playing = enabled && !reducedMotion && !done;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  // 배경 공개값. 진입이 켜져 있으면 0에서 출발하고, 늦게 붙은 배경 ref도 이 현재값을 받는다.
  const reveal = useRef({ value: enabled && !reducedMotion ? 0 : 1 });
  const run = useRef<{ timeline: gsap.core.Timeline | null; fast: gsap.core.Tween | null; play: (() => void) | null; split: ReturnType<typeof splitWords> | null; limit: ReturnType<typeof setTimeout> | undefined; completed: boolean; claimed: boolean }>(
    { timeline: null, fast: null, play: null, split: null, limit: undefined, completed: false, claimed: false });

  const applyReveal = (value: number) => {
    reveal.current.value = value;
    backgroundRef.current?.setRevealProgress(value);
  };
  const tidy = () => {
    const state = run.current;
    clearTimeout(state.limit);
    const built = state.timeline !== null;
    if (state.play) gsapModule?.gsap.ticker.remove(state.play);
    state.play = null;
    state.fast?.kill();
    state.fast = null;
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
  const tidyRef = useRef(tidy);
  tidyRef.current = tidy;
  // 완료·중단·해시·모션 감소가 모두 여기로 온다. 원문을 되돌리고 공개값 1로 끝내며 완료 신호는 한 번만 보낸다.
  const settle = useCallback(() => {
    if (run.current.completed) return;
    tidyRef.current();
    run.current.completed = true;
    applyReveal(1);
    if (document.documentElement.hasAttribute('data-intro')) document.documentElement.removeAttribute('data-intro');
    setDone(true);
    completeRef.current();
  }, []);
  useImperativeHandle(ref, () => ({ finish: settle }), [settle]);
  // 입력이 오면 숨김 표시는 바로 걷고 남은 진입만 마저 돌린다. 완료 신호(GL host 마운트)는 그 뒤라 문맥 생성이 이 사이에 끼지 않는다.
  // 시간표가 아직 없으면 돌릴 것이 없으니 바로 끝낸다. 명시적 이동(finish)은 지금처럼 바로 끝낸다.
  const hurry = () => {
    const state = run.current, tl = state.timeline;
    if (state.completed || state.fast) return;
    if (!tl || !gsapModule) return settle();
    document.documentElement.removeAttribute('data-intro');
    if (state.play) gsapModule.gsap.ticker.remove(state.play);
    state.play = null;
    state.fast = tl.tweenTo(tl.duration(), { duration: FAST_FINISH, ease: 'power2.out', onComplete: settle });
  };
  const hurryRef = useRef(hurry);
  hurryRef.current = hurry;

  // 페인트 전에 진입을 맡는다. 판정 스크립트의 안전장치가 숨긴 출발 상태를 걷지 않게 표시를 바꾼다.
  // 하이드레이션이 늦어 안전장치가 이미 걷었다면 다시 숨기지 않고 정적 첫 화면으로 끝낸다.
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
  useLayoutEffect(() => { background?.setRevealProgress(reveal.current.value); }, [background]);

  useEffect(() => {
    if (!playing) return;
    let alive = true;
    const limit = run.current.limit = setTimeout(settle, LOAD_LIMIT_MS);
    import('@/lib/gsap').then(module => { if (alive) setGsapModule(module); }).catch(() => { if (alive) settle(); });
    // 안쪽 스크롤러(가로 목록 등)의 초기화 스크롤은 사용자 입력이 아니다. 문서 스크롤만 본다.
    const onInput = (event: Event) => { if (event.type !== 'scroll' || event.target === document) hurryRef.current(); };
    const options = { capture: true, passive: true };
    INPUTS.forEach(type => window.addEventListener(type, onInput, options));
    return () => {
      alive = false;
      clearTimeout(limit);
      INPUTS.forEach(type => window.removeEventListener(type, onInput, options));
    };
  }, [playing, settle]);
  useEffect(() => () => {
    tidyRef.current();
    document.documentElement.removeAttribute('data-intro');
  }, []);

  // 시간표 전체를 한 번에 만든다. 0초 한 위치에서 배경 확장과 세 진입이 함께 출발한다.
  useEffect(() => {
    if (!playing || !gsapModule || !targets || run.current.timeline) return;
    clearTimeout(run.current.limit);
    const { gsap, registerGsap, SITE_EASE } = gsapModule;
    registerGsap();
    const { wordmark, headline, heroObject } = targets;
    const T = INTRO_TIMING;
    // 줄바꿈이 나뉜 단어 때문에 바뀌지 않게 폭을 먼저 고정한다.
    headline.style.width = `${headline.getBoundingClientRect().width}px`;
    const split = splitWords(headline);
    run.current.split = split;
    // 출발 자세는 지금 그리고, 재생은 다음 tick에 건다. 무거운 커밋 안에서 바로 재생하면 막힌 시간이 첫 프레임에 실린다.
    const tl = gsap.timeline({ paused: true, onComplete: settle });
    run.current.timeline = tl;
    tl.fromTo(wordmark, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: T.name, ease: SITE_EASE }, 0)
      .fromTo(split.words, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: T.word, ease: SITE_EASE, stagger: introWordStagger(split.words.length) }, 0)
      .fromTo(heroObject, { opacity: 0, scale: .92 }, { opacity: 1, scale: 1, duration: T.object, ease: SITE_EASE }, 0)
      // 가속과 엇갈림은 배경의 가닥별 시간표가 맡는다. 공개값은 시간 그 자체다.
      .to(reveal.current, { value: 1, duration: T.background, ease: 'none', onUpdate: () => applyReveal(reveal.current.value) }, 0);
    const play = () => {
      gsap.ticker.remove(play);
      run.current.play = null;
      tl.play();
    };
    run.current.play = play;
    gsap.ticker.add(play);
  }, [playing, gsapModule, targets, settle]);

  return null;
});

export default BootSequence;
