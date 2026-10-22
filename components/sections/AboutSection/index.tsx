'use client';

import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { ELECTRIC_LOGO_MORPH_SECONDS } from '@/components/blocks/ElectricLogo/motion';
import { coreValues } from '@/lib/data';
import { RichText, parseRichText } from '@/lib/utils/richText';
import { SECTION_IDS } from '@/lib/constants';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import ChapterFocus from './ChapterFocus';
import { ABOUT_SCRIMS, ABOUT_SCRIMS_MOBILE } from './scrim';
import styles from './styles.module.css';

export interface AboutSectionHandle { release(): void }
export interface AboutSectionProps {
  onChapterChange: (index: number) => void;
  navigationPending: boolean;
  // 공유 로고의 자리(HomeClient motion.ts의 LogoOwner). 날아가는 동안(boundary)에는 잠그지 않고,
  // 그사이 잠금 자리에 닿았으면 About에 내려앉을 때 잠근다. Hero로 되돌아가 내려앉으면 미룬 잠금을 버린다.
  logoOwner?: 'hero' | 'about' | 'boundary' | 'none';
}

const GESTURE_IDLE_MS = 220;
// 끊긴 wheel의 기준. 프레임 간격(16.7ms)이나 합쳐진 wheel 둘(48ms 안팎)보다 길다.
const WHEEL_PAUSE_MS = 56;
// 다시 프레임 간격으로 붙는 wheel. 느리거나 보통 속도로 굴린 마우스 노치는 이보다 길다. 빠르게 튕긴 노치는 10-20ms로 올 수 있다.
const WHEEL_FRAME_MS = 20;
// 본문 전환과 로고 모프가 같은 1초를 쓴다.
const TRANSITION_MS = ELECTRIC_LOGO_MORPH_SECONDS * 1000;

// reading 시안(app/prototypes/about/GestureReading)의 이식이다. About에
// 닿은 제스처 하나가 chapter 하나를 넘기고, 마지막 chapter에서 새 제스처가
// 오면 문서 스크롤로 돌려준다. 잠금은 About 위에서만 capture wheel·touchmove를
// 막는다. 시안에 있던 "마운트 때 About 아래면 About으로 되돌린다"는 직접 해시와
// 명시적 이동을 끌어오므로 옮기지 않았다.
export default function AboutSection({ ref, onChapterChange, navigationPending, logoOwner = 'none' }: AboutSectionProps & { ref?: Ref<AboutSectionHandle> }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [plain, setPlain] = useState(false);
  const selected = useRef(0);
  const selectRef = useRef<(index: number) => void>(() => {});
  const releaseRef = useRef(() => {});
  const enterRef = useRef(() => {});
  const landedRef = useRef(logoOwner !== 'boundary');
  const landRef = useRef<(apply: boolean) => void>(() => {});
  // 로고가 About에 내려앉아 있는지. 위로 돌아갈 때 그동안은 R 위에서도 본문을 남긴다.
  const restingRef = useRef(logoOwner === 'about');
  const revealRef = useRef(() => {});
  const { reducedMotion, motionReady, pageVisible, obscured } = useSectionActivity();
  const { ref: sectionRef, visible } = useSectionVisibility<HTMLElement>();
  const active = visible && motionReady && pageVisible && !obscured;

  useImperativeHandle(ref, () => ({ release: () => releaseRef.current() }), []);
  useEffect(() => { onChapterChange(activeIndex); }, [activeIndex, onChapterChange]);
  // 창·탭에 돌아오면 브라우저가 떠날 때 포커스가 있던 요소에 focus를 다시 보낸다(relatedTarget 없음).
  // 사용자가 옮긴 포커스가 아니므로 chapter 단어의 잠금을 걸지 않는다(M3 N1).
  const refocusRef = useRef<Element | null>(null);
  useEffect(() => {
    // 요소의 blur는 거품이 일지 않아 캡처 없이 단 이 리스너에는 창 자신의 blur만 온다.
    const leave = () => { refocusRef.current = document.activeElement; };
    window.addEventListener('blur', leave);
    return () => window.removeEventListener('blur', leave);
  }, []);
  useEffect(() => {
    landedRef.current = logoOwner !== 'boundary';
    restingRef.current = logoOwner === 'about';
    revealRef.current();
    if (landedRef.current) landRef.current(logoOwner !== 'hero');
  }, [logoOwner]);

  // 스크림 포털 대상. 서버 렌더에는 document가 없어 마운트 뒤에 정한다.
  // .portfolio-document 안에 붙여야 배경과 같은 쌓임 맥락에 놓인다.
  const [scrimHost, setScrimHost] = useState<Element | null>(null);
  useEffect(() => setScrimHost(sectionRef.current?.closest('.portfolio-document') ?? document.body), [sectionRef]);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    const short = window.matchMedia('(max-height: 640px)');
    // 명시적 이동 중이거나 모달이 본문을 가리면 새 잠금을 잡지 않는다.
    const blocked = navigationPending || obscured;
    let disabled = false;
    let start = 0;
    let phase: 'before' | 'locked' | 'after' = 'before';
    let lastInput = -Infinity;
    let lastStep = -Infinity;
    let pendingGesture = false;
    let lastWheelTime = -Infinity;
    let lastWheelDelta = 0;
    let lastWheelGap = Infinity;
    let earlierDelta = 0;
    let wheelPeak = 0;
    let wheelTail = false;
    let touchY = 0;
    let touchConsumed = false;
    let lastNativeInput = -Infinity;
    // 로고가 날아가는 동안 미룬 잠금의 방향(아래에서 왔는지). 없으면 null.
    let held: boolean | null = null;
    const setPhase = (next: typeof phase) => {
      phase = next;
      setLocked(phase === 'locked');
      window.removeEventListener('wheel', lockedWheel, true);
      window.removeEventListener('touchmove', lockedTouchMove, true);
      if (phase === 'locked' && !disabled) {
        window.addEventListener('wheel', lockedWheel, { passive: false, capture: true });
        window.addEventListener('touchmove', lockedTouchMove, { passive: false, capture: true });
      }
    };
    const choose = (index: number) => { selected.current = index; setActiveIndex(index); };
    const measure = () => {
      const wasDisabled = disabled;
      disabled = reducedMotion || short.matches;
      setPlain(disabled);
      // 헤더 아래 여백은 해시 이동과 같은 scroll-margin-top을 쓴다.
      start = Math.round(window.scrollY + element.getBoundingClientRect().top - (parseFloat(getComputedStyle(element).scrollMarginTop) || 0));
      // 정적 모드는 잠금을 들고 가지 않는다. 그동안 읽은 위치를 돌아올 때 끌어오지 않도록 위치로 앞뒤를 정한다.
      if (disabled && phase === 'locked') phase = window.scrollY > start ? 'after' : 'before';
      setPhase(phase);
      if (wasDisabled && !disabled) scroll();
      else if (phase === 'locked' && !disabled) window.scrollTo({ top: start, behavior: 'instant' });
    };
    const lock = (fromBelow: boolean, time: number) => {
      held = landedRef.current ? null : fromBelow;
      if (held !== null) return;
      setPhase('locked'); lastInput = time; lastStep = time;
      pendingGesture = false;
      choose(fromBelow ? 2 : 0);
      window.scrollTo({ top: start, behavior: 'instant' });
    };
    // 진입 제스처는 자리만 잡는다. 그 관성은 chapter를 넘기지 못한다.
    const input = (delta: number, time: number, fresh = false) => {
      if (disabled || blocked || delta === 0) return false;
      lastNativeInput = performance.now();
      if (phase !== 'locked') {
        const y = window.scrollY;
        const entering = phase === 'before' && delta > 0 && y + delta >= start;
        const returning = phase === 'after' && delta < 0 && y >= start && y + delta <= start;
        // 미룬 잠금은 입력을 막지 않는다.
        if (entering || returning) { lock(returning, time); return held === null; }
        return false;
      }
      const newGesture = fresh || time - lastInput > GESTURE_IDLE_MS;
      lastInput = time;
      pendingGesture ||= newGesture;
      if (!pendingGesture || time - lastStep < TRANSITION_MS) return true;
      pendingGesture = false;
      const next = selected.current + (delta > 0 ? 1 : -1);
      if (next < 0 || next > 2) { setPhase(next < 0 ? 'before' : 'after'); return false; }
      lastStep = time;
      choose(next);
      return true;
    };
    const editable = (target: EventTarget | null) => target instanceof HTMLElement
      && !!target.closest('input, textarea, select, [contenteditable="true"]');
    const wheelInput = (event: WheelEvent) => {
      if (event.ctrlKey || editable(event.target)) return false;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (delta === 0) return false;
      const magnitude = Math.abs(delta);
      const gap = event.timeStamp - lastWheelTime;
      const idle = gap > GESTURE_IDLE_MS;
      // 바쁜 메인 스레드는 wheel 둘을 하나로 합쳐 간격과 크기를 함께 키운다. 앞 간격보다 길어진 만큼만
      // 줄여 비교하면 합쳐진 관성은 새 stroke가 아니고, 크기가 늘 같은 마우스 노치는 간격이 흔들려도 그대로다.
      const comparable = magnitude * (idle ? 1 : Math.min(1, lastWheelGap / gap));
      const reversed = delta * lastWheelDelta < 0;
      // 끊긴 wheel 바로 뒤 프레임은 끊기기 전 크기와도 견준다. 쉬고 완만하게 오르는 새 stroke는 끊기기 전 꼬리보다
      // 커서 보이고, 합쳐진 wheel이나 한 번 끊긴 관성은 끊기기 전 크기 그대로라 보이지 않는다.
      const resumed = lastWheelGap > WHEEL_PAUSE_MS && gap <= WHEEL_FRAME_MS;
      const reference = resumed ? Math.min(Math.abs(lastWheelDelta), earlierDelta) : Math.abs(lastWheelDelta);
      // 트랙패드는 앞 stroke의 관성이 끝나기 전에 새 stroke를 시작할 수 있다.
      const renewed = wheelTail && comparable >= 4 && comparable >= reference * 1.8;
      if (idle || reversed || renewed) {
        wheelPeak = magnitude;
        wheelTail = false;
      } else {
        wheelPeak = Math.max(wheelPeak, magnitude);
        if (magnitude < wheelPeak * .6) wheelTail = true;
      }
      lastWheelTime = event.timeStamp;
      earlierDelta = Math.abs(lastWheelDelta);
      lastWheelDelta = delta;
      lastWheelGap = gap;
      return input(delta, event.timeStamp, reversed || renewed);
    };
    const wheel = (event: WheelEvent) => { if (phase !== 'locked') wheelInput(event); };
    function lockedWheel(event: WheelEvent) {
      if (wheelInput(event) && event.cancelable) event.preventDefault();
    }
    const closeOvershoot = () => { lastNativeInput = -Infinity; };
    const key = (event: KeyboardEvent) => {
      closeOvershoot();
      if (editable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.key === ' ' || event.key === 'Enter') && event.target instanceof HTMLElement && event.target.closest('button, a')) return;
      const direction = ['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey) ? 1
        : ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1 : 0;
      if (!direction) return;
      if (event.repeat && phase === 'locked') { event.preventDefault(); return; }
      if (input(direction * window.innerHeight * .8, event.timeStamp, true)) event.preventDefault();
    };
    const touchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? 0; touchConsumed = false; };
    const touchInput = (event: TouchEvent, blocking: boolean) => {
      if (event.touches.length !== 1 || editable(event.target)) return;
      const nextY = event.touches[0].clientY;
      const delta = touchY - nextY;
      touchY = nextY;
      if (touchConsumed && phase === 'locked' && !disabled) { if (blocking && event.cancelable) event.preventDefault(); return; }
      if (input(delta, event.timeStamp, true)) {
        touchConsumed = true;
        if (blocking && event.cancelable) event.preventDefault();
      }
    };
    const touchMove = (event: TouchEvent) => { if (phase !== 'locked') touchInput(event, false); };
    function lockedTouchMove(event: TouchEvent) { touchInput(event, true); }
    const scroll = () => {
      if (disabled) return;
      const offset = window.scrollY - start;
      // 위로 R을 지나도 로고가 About에 있는 동안은 본문이 남는다. 로고가 떠나는 프레임(되돌기 시작)에 owner effect가 다시 읽는다(Task 11).
      setRevealed(shown => offset < window.innerHeight / 2 && (offset > -window.innerHeight / 2 || (shown && restingRef.current)));
      // 방금 들어온 제스처의 관성이 넘친 거리만 되돌린다. 넘침은 Chrome의 부드러운 wheel
      // 스크롤 때문에 수백 px까지 간다. 스크롤바는 입력이 없고, History·명시적 이동·다른 키는
      // 이 창을 닫으므로 끌려오지 않는다.
      const overshoot = !blocked && performance.now() - lastNativeInput < 350;
      if (overshoot && phase !== 'locked' && (phase === 'before' ? offset > 0 : offset < 0)) {
        lock(phase === 'after', performance.now());
        return;
      }
      if (overshoot && phase === 'locked' && Math.abs(offset) > 1) {
        window.scrollTo({ top: start, behavior: 'instant' });
        return;
      }
      if (Math.abs(offset) <= 1) {
        if (phase !== 'locked' && !blocked) {
          if (!landedRef.current) held = phase === 'after';
          else { setPhase('locked'); lastInput = -Infinity; lastStep = -Infinity; }
        }
      } else if (phase !== 'locked' || Math.abs(offset) > 2) {
        // 잠금 밖에서는 위치로 앞뒤를 다시 정해 스크롤바로 건너뛴 뒤에도 돌아오는 방향을 안다.
        const next = offset > 0 ? 'after' : 'before';
        if (next !== phase) setPhase(next);
      }
    };
    selectRef.current = index => {
      if (disabled || blocked) { choose(index); return; }
      setPhase('locked'); choose(index); lastStep = performance.now(); lastInput = lastStep; pendingGesture = false;
      window.scrollTo({ top: start, behavior: 'instant' });
    };
    // Tab으로 chapter 단어에 닿으면 진입 제스처처럼 잠근다. 위에서 오면 BASICS, 아래에서 오면 TEAMWORK다.
    // 마우스 클릭의 포커스는 거르고 클릭 선택에 맡긴다. 안 그러면 누르는 순간 다른 chapter로 한 번 넘어간다.
    enterRef.current = () => { if (!disabled && !blocked && phase !== 'locked') lock(window.scrollY > start, performance.now()); };
    // About에 내려앉으면 미룬 잠금을 건다. Hero로 되돌아갔거나 그사이 반 화면 넘게 지나쳤으면 끌어오지 않는다.
    landRef.current = apply => {
      const fromBelow = held;
      held = null;
      if (apply && fromBelow !== null && !disabled && !blocked && phase !== 'locked' && Math.abs(window.scrollY - start) < window.innerHeight / 2) lock(fromBelow, performance.now());
    };
    releaseRef.current = () => {
      closeOvershoot(); pendingGesture = false; held = null;
      if (phase === 'locked') setPhase(window.scrollY > start ? 'after' : 'before');
    };
    revealRef.current = () => { if (!disabled) setRevealed(Math.abs(window.scrollY - start) < window.innerHeight / 2); };
    measure();
    scroll();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    // 위쪽 Hero 높이가 바뀌어도 About의 문서 위치가 움직이므로 문서 전체를 본다.
    resize?.observe(element);
    resize?.observe(document.documentElement);
    window.addEventListener('wheel', wheel, { passive: true, capture: true });
    window.addEventListener('keydown', key);
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchmove', touchMove, { passive: true, capture: true });
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('popstate', closeOvershoot);
    window.addEventListener('resize', measure);
    short.addEventListener('change', measure);
    return () => {
      resize?.disconnect();
      window.removeEventListener('wheel', lockedWheel, true);
      window.removeEventListener('touchmove', lockedTouchMove, true);
      window.removeEventListener('wheel', wheel, true); window.removeEventListener('keydown', key);
      window.removeEventListener('touchstart', touchStart); window.removeEventListener('touchmove', touchMove, true);
      window.removeEventListener('scroll', scroll); window.removeEventListener('popstate', closeOvershoot); window.removeEventListener('resize', measure);
      short.removeEventListener('change', measure);
      releaseRef.current = () => {};
      enterRef.current = () => {};
      landRef.current = () => {};
      revealRef.current = () => {};
    };
  }, [sectionRef, reducedMotion, navigationPending, obscured]);

  const value = coreValues[activeIndex];
  // 본문은 로고가 내려앉은 뒤에 나타난다(사용자 결정 2026-10-21). 날아가는 동안 기다릴 뿐 스크롤 입력은 막지 않는다.
  // 본문은 로고가 About에 내려앉아 있을 때만 보인다. 경로 지점에서 Hero로 돌아간 로고는 R 아래에서도 본문을 다시 열지 않는다(Task 12).
  const entered = (revealed && (logoOwner === 'about' || logoOwner === 'none')) || plain;
  return (
    <section ref={sectionRef} id={SECTION_IDS.ABOUT} aria-labelledby="about-heading" className={styles.section}>
      {/* 섹션 제목은 시각적으로 숨긴다. 화면 위에는 chapter 단어만 남는다. */}
      <h2 id="about-heading" className="sr-only">
        About
      </h2>
      {/* 스크림은 .portfolio-document의 끝으로 포털해 배경 위·본문 아래에 깐다.
          보이는 조건은 About이 읽기선을 가질 때다(design-tokens.css의
          [data-about-scrim] 형제 선택자). 언마운트가 아니라 불투명도로 감춰
          떠날 때도 페이드한다. lg 미만은 세로 그라데이션을 쓴다(scrim.ts). */}
      {scrimHost
        ? createPortal(
            <>
              {ABOUT_SCRIMS.map((scrim, index) => (
                <div
                  key={`desktop-${index}`}
                  data-about-scrim
                  data-about-scrim-index={index}
                  aria-hidden="true"
                  className={`pointer-events-none fixed inset-0 -z-[1] hidden transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block ${
                    active && index === activeIndex
                      ? 'opacity-100'
                      : 'opacity-0'
                  }`}
                  style={{ background: scrim }}
                />
              ))}
              {ABOUT_SCRIMS_MOBILE.map((scrim, index) => (
                <div
                  key={`mobile-${index}`}
                  data-about-scrim
                  data-about-scrim-index={index}
                  aria-hidden="true"
                  className={`pointer-events-none fixed inset-0 -z-[1] transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
                    active && index === activeIndex
                      ? 'opacity-100'
                      : 'opacity-0'
                  }`}
                  style={{ background: scrim }}
                />
              ))}
            </>,
            scrimHost
          )
        : null}
      <div className={styles.stage} style={{ '--chapter-transition': `${TRANSITION_MS}ms` } as CSSProperties}
        data-motion-layout="reading" data-static={plain ? '' : undefined} data-entered={entered} data-locked={locked}>
        <div className={styles.header} onFocus={event => {
          const returned = !event.relatedTarget && event.target === refocusRef.current;
          refocusRef.current = null;
          if (!returned && event.target.matches(':focus-visible')) enterRef.current();
        }}>
          <ChapterFocus active={activeIndex} entered={entered} onSelect={index => selectRef.current(index)} />
        </div>
        <div className={styles.rail} aria-hidden="true">
          {/* 공유 로고는 HomeClient 셸의 host 하나가 띄우고 이 앵커에 내려앉는다. 여기는 자리와 정적 실루엣뿐이다. */}
          <div data-about-visual>
            <div data-motion-anchor="about-logo" className="about-electric">
              <div className={`about-electric-static ${reducedMotion || plain ? '' : 'about-electric-static-charging'}`}>
                <div className="about-electric-static-shape" style={{ maskImage: `url(${value.logoSrc})`, WebkitMaskImage: `url(${value.logoSrc})` }} />
              </div>
            </div>
          </div>
        </div>
        {/* 세 chapter가 전부 DOM에 상주한다. 활성 하나만 보이고 나머지는 inert다. */}
        <div className={styles.articles}>
          <div className={styles.panelViewport}>
            {coreValues.map((chapter, index) => {
              const current = plain || index === activeIndex;
              return (
                <article key={chapter.id} data-detail={index} data-chapter={chapter.label} className={styles.panel}
                  data-position={index === activeIndex ? 'active' : index < activeIndex ? 'past' : 'future'}
                  inert={!current} aria-hidden={!current}>
                  <h3 data-about-title className={styles.title}>{parseRichText(chapter.title)}</h3>
                  <dl data-about-evidence className={styles.evidence}>
                    {chapter.evidence.map(({ label, value: evidenceValue }) => (
                      <div key={label}><dt>{parseRichText(label)}</dt><dd>{parseRichText(evidenceValue)}</dd></div>
                    ))}
                  </dl>
                  <div data-about-description className={styles.description}>
                    <RichText text={chapter.description} />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
