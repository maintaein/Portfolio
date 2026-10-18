'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ELECTRIC_LOGO_MORPH_SECONDS } from '@/components/blocks/ElectricLogo/motion';
import { coreValues } from '@/lib/data/profile';
import { Description, Evidence, SectionHeading, ValueIcon } from './shared';
import styles from './gesture.module.css';
import ChapterFocus from './ChapterFocus';

const ElectricLogo = dynamic(() => import('@/components/blocks/ElectricLogo'), { ssr: false });
const logos = coreValues.map(value => value.logoSrc);
const GESTURE_IDLE_MS = 220;
const TRANSITION_MS = ELECTRIC_LOGO_MORPH_SECONDS * 1000;

export default function GestureReading() {
  const root = useRef<HTMLDivElement>(null);
  const selected = useRef(0);
  const selectRef = useRef<(index: number) => void>(() => {});
  const [active, setActive] = useState(0);
  const [entered, setEntered] = useState(false);
  const [plain, setPlain] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const short = matchMedia('(max-height: 640px)');
    let disabled = false;
    let start = 0;
    let phase: 'before' | 'locked' | 'after' = 'before';
    let lastInput = -Infinity;
    let lastStep = -Infinity;
    let pendingGesture = false;
    let lastWheelTime = -Infinity;
    let lastWheelDelta = 0;
    let wheelPeak = 0;
    let wheelTail = false;
    let touchY = 0;
    let touchConsumed = false;
    let lastNativeInput = -Infinity;
    const setPhase = (next: typeof phase) => {
      phase = next;
      setEntered(phase === 'locked');
      window.removeEventListener('wheel', lockedWheel, true);
      window.removeEventListener('touchmove', lockedTouchMove, true);
      if (phase === 'locked' && !disabled) {
        window.addEventListener('wheel', lockedWheel, { passive: false, capture: true });
        window.addEventListener('touchmove', lockedTouchMove, { passive: false, capture: true });
      }
    };
    const choose = (index: number) => { selected.current = index; setActive(index); };
    const measure = () => {
      disabled = reduce.matches || short.matches;
      setPhase(phase);
      setPlain(disabled);
      start = Math.round(scrollY + element.getBoundingClientRect().top);
      if (phase === 'locked' && !disabled) scrollTo({ top: start, behavior: 'instant' });
    };
    const lock = (fromBelow: boolean, time: number) => {
      setPhase('locked'); lastInput = time; lastStep = time;
      pendingGesture = false;
      choose(fromBelow ? 2 : 0);
      scrollTo({ top: start, behavior: 'instant' });
    };
    // The entry gesture only positions the section. Its momentum cannot advance a chapter.
    const input = (delta: number, time: number, fresh = false) => {
      if (disabled || delta === 0) return false;
      lastNativeInput = performance.now();
      if (phase !== 'locked') {
        const entering = phase === 'before' && delta > 0 && scrollY + delta >= start;
        const returning = phase === 'after' && delta < 0 && scrollY >= start && scrollY + delta <= start;
        if (entering || returning) { lock(returning, time); return true; }
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
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (delta === 0) return false;
      const magnitude = Math.abs(delta);
      const idle = event.timeStamp - lastWheelTime > GESTURE_IDLE_MS;
      const reversed = delta * lastWheelDelta < 0;
      // Trackpads can begin a new stroke while the previous stroke's momentum is still arriving.
      const renewed = wheelTail && magnitude >= 4 && magnitude >= Math.abs(lastWheelDelta) * 1.8;
      if (idle || reversed || renewed) {
        wheelPeak = magnitude;
        wheelTail = false;
      } else {
        wheelPeak = Math.max(wheelPeak, magnitude);
        if (magnitude < wheelPeak * .6) wheelTail = true;
      }
      lastWheelTime = event.timeStamp;
      lastWheelDelta = delta;
      return input(delta, event.timeStamp, reversed || renewed);
    };
    const wheel = (event: WheelEvent) => { if (phase !== 'locked') wheelInput(event); };
    function lockedWheel(event: WheelEvent) {
      if (wheelInput(event) && event.cancelable) event.preventDefault();
    }
    const key = (event: KeyboardEvent) => {
      if (editable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.key === ' ' || event.key === 'Enter') && event.target instanceof HTMLElement && event.target.closest('button, a')) return;
      const direction = ['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey) ? 1
        : ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1 : 0;
      if (!direction) return;
      if (event.repeat && phase === 'locked') { event.preventDefault(); return; }
      if (input(direction * innerHeight * .8, event.timeStamp, true)) event.preventDefault();
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
      const recentInput = performance.now() - lastNativeInput < 350;
      if (phase === 'before' && scrollY > start && recentInput) {
        lock(false, performance.now());
        return;
      }
      if (phase === 'after' && scrollY < start && recentInput) {
        lock(true, performance.now());
        return;
      }
      if (phase === 'locked' && Math.abs(scrollY - start) > 1 && recentInput) {
        scrollTo({ top: start, behavior: 'instant' });
        return;
      }
      if (Math.abs(scrollY - start) <= 1 && phase !== 'locked') {
        setPhase('locked'); lastInput = -Infinity; lastStep = -Infinity;
      } else if (phase === 'locked' && Math.abs(scrollY - start) > 2) {
        // Native scrollbar, Home/End, and browser navigation remain usable.
        setPhase(scrollY > start ? 'after' : 'before');
      }
    };
    selectRef.current = index => {
      if (disabled) { document.getElementById(`motion-value-${coreValues[index].id}`)?.scrollIntoView(); return; }
      setPhase('locked'); choose(index); lastStep = performance.now(); lastInput = lastStep; pendingGesture = false;
      scrollTo({ top: start, behavior: 'instant' });
    };
    measure();
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!disabled && navigation?.type === 'navigate' && scrollY > start) lock(false, performance.now());
    scroll();
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    if (element.parentElement) resize.observe(element.parentElement);
    const visibility = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    visibility.observe(element);
    window.addEventListener('wheel', wheel, { passive: true, capture: true });
    window.addEventListener('keydown', key);
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchmove', touchMove, { passive: true, capture: true });
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', measure);
    reduce.addEventListener('change', measure);
    short.addEventListener('change', measure);
    return () => {
      resize.disconnect(); visibility.disconnect();
      window.removeEventListener('wheel', lockedWheel, true);
      window.removeEventListener('touchmove', lockedTouchMove, true);
      window.removeEventListener('wheel', wheel, true); window.removeEventListener('keydown', key);
      window.removeEventListener('touchstart', touchStart); window.removeEventListener('touchmove', touchMove, true);
      window.removeEventListener('scroll', scroll); window.removeEventListener('resize', measure);
      reduce.removeEventListener('change', measure); short.removeEventListener('change', measure);
    };
  }, []);

  const value = coreValues[active];
  return <section className={styles.section}>
    <SectionHeading showIndex={false} />
    <div ref={root} className={styles.stage} style={{ '--chapter-transition': `${TRANSITION_MS}ms` } as CSSProperties} data-motion-layout="reading" data-static={plain ? '' : undefined} data-entered={entered || plain} data-chapter-step={entered ? active + 1 : 0}>
      <header className={styles.header}>
        <ChapterFocus active={active} entered={entered || plain} onSelect={index => selectRef.current(index)} />
      </header>
      <aside className={styles.rail}>
        <div className={styles.electric} data-electric-src={value.logoSrc}>
          <div className={styles.fallback} style={{ opacity: ready && !plain ? 0 : 1 }}><ValueIcon value={value} /></div>
          {!plain && <ElectricLogo src={value.logoSrc} active={visible} maxFps={30} maxDpr={.75} preloadSrcs={logos} onReady={() => setReady(true)}
            color="#7fe3ee" glowColor="#03b3c3" intensity={.65} glow={.3} speed={1.1} flicker={.25} interactive={false} />}
        </div>
      </aside>
      <div className={styles.articles}>
        <div className={styles.panelViewport}>
        {coreValues.map((chapter, index) => <article id={`motion-value-${chapter.id}`} key={chapter.id} className={styles.panel}
          data-motion-panel data-chapter={chapter.label} data-position={index === active ? 'active' : index < active ? 'past' : 'future'}
          inert={!plain && index !== active} aria-hidden={!plain && index !== active}>
          <h2>{chapter.title}</h2><Evidence value={chapter} /><Description value={chapter} />
        </article>)}
        </div>
      </div>
    </div>
  </section>;
}
