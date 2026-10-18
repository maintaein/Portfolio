'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { coreValues } from '@/lib/data/profile';
import { Description, Evidence, SectionHeading, ValueIcon } from './shared';
import base from './styles.module.css';
import styles from './motion.module.css';

const ElectricLogo = dynamic(() => import('@/components/blocks/ElectricLogo'), { ssr: false });
const logos = coreValues.map(value => value.logoSrc);
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
// Cinema alternates reading holds and transitions, then holds the final chapter before release.
const cinemaProgress = (scroll: number) => scroll < .18 ? 0
  : scroll < .34 ? (scroll - .18) / .16
    : scroll < .53 ? 1
      : scroll < .69 ? 1 + (scroll - .53) / .16 : 2;
const cinemaStops = [.08, .43, .85];
type Layout = 'reading' | 'focus' | 'cinema';

export default function ScrollChapters({ layout, scrollHoldRef }: { layout: Layout; scrollHoldRef?: RefObject<{ start: number; end: number } | null> }) {
  const root = useRef<HTMLDivElement>(null);
  const progressBar = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [staticLayout, setStaticLayout] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const activeRef = useRef(0);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const shortQuery = matchMedia('(max-height: 640px)');
    const panels = [...element.querySelectorAll<HTMLElement>('[data-motion-panel]')];
    const beats = panels.map(panel => [...panel.querySelectorAll<HTMLElement>('[data-motion-beat]')]);
    let frame = 0;
    let disposed = false;

    const update = () => {
      frame = 0;
      if (disposed) return;
      const height = innerHeight;
      const rect = element.getBoundingClientRect();
      const plain = reduceQuery.matches || shortQuery.matches;
      const reading = layout === 'reading' && !scrollHoldRef;
      if (scrollHoldRef) scrollHoldRef.current = plain ? null : { start: scrollY + rect.top, end: scrollY + rect.top + rect.height - height };
      const bounds = reading ? panels.map(panel => ({ top: rect.top + panel.offsetTop, height: panel.offsetHeight })) : [];
      const scrollProgress = clamp(-rect.top / Math.max(1, rect.height - height));
      const progress = layout === 'cinema' || scrollHoldRef ? cinemaProgress(scrollProgress) : scrollProgress * 2;
      if (progressBar.current) progressBar.current.style.transform = `scaleX(${scrollProgress})`;
      const distances = reading
        ? bounds.map(bound => (bound.top + bound.height / 2 - height * .56) / height)
        : panels.map((_, index) => index - progress);
      let nearest = 0;
      distances.forEach((distance, index) => {
        if (Math.abs(distance) < Math.abs(distances[nearest])) nearest = index;
      });
      // Keep a small boundary deadband so trackpad jitter cannot repeatedly morph the logo.
      const candidate = reading
        ? (Math.abs(distances[nearest]) + .035 < Math.abs(distances[activeRef.current]) ? nearest : activeRef.current)
        : (progress > activeRef.current + .54 || progress < activeRef.current - .54 ? Math.round(progress) : activeRef.current);
      if (candidate !== activeRef.current) {
        activeRef.current = candidate;
        setActive(candidate);
      }
      setInView(rect.bottom > 0 && rect.top < height && !document.hidden);
      panels.forEach((panel, index) => {
        const distance = distances[index];
        const opacity = plain ? 1 : reading
          ? clamp((.78 - Math.abs(distance)) / .36)
          : clamp((.5 - Math.abs(distance)) / .2);
        panel.style.opacity = String(opacity);
        panel.style.transform = plain ? 'none' : `translate3d(0, ${clamp(distance, -1, 1) * (reading ? 48 : 100)}px, 0)`;
        panel.inert = !reading && !plain && index !== candidate;
        panel.setAttribute('aria-hidden', String(!reading && !plain && index !== candidate));
        if (layout === 'cinema') beats[index].forEach((beat, beatIndex) => {
          const delay = distance > 0 ? beatIndex * .055 : 0;
          beat.style.opacity = plain ? '1' : String(clamp((.74 - Math.abs(distance) - delay) / .42));
          beat.style.transform = plain ? 'none' : `translate3d(0, ${distance > 0 ? delay * 120 : 0}px, 0)`;
        });
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const preferences = () => {
      setReduced(reduceQuery.matches);
      setStaticLayout(reduceQuery.matches || shortQuery.matches);
      schedule();
    };
    preferences();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    reduceQuery.addEventListener('change', preferences);
    shortQuery.addEventListener('change', preferences);
    return () => {
      disposed = true;
      if (scrollHoldRef) scrollHoldRef.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      reduceQuery.removeEventListener('change', preferences);
      shortQuery.removeEventListener('change', preferences);
    };
  }, [layout, scrollHoldRef]);

  const value = coreValues[active];
  const visual = <aside className={styles.rail}>
    <p className={base.eyebrow}>0{active + 1} / {value.label}</p>
    <div className={styles.electric} data-electric-src={value.logoSrc}>
      <div className={styles.fallback} style={{ opacity: logoReady && !reduced ? 0 : 1 }}><ValueIcon value={value} /></div>
      {!reduced && <ElectricLogo src={value.logoSrc} active={inView} preloadSrcs={logos}
        onReady={() => setLogoReady(true)} color="#7fe3ee" glowColor="#03b3c3"
        intensity={.65} glow={.3} speed={1.1} flicker={.25} interactive={false} />}
    </div>
    <nav className={styles.chapterNav} aria-label="About chapters">
      {coreValues.map((chapter, index) => <a href={`#motion-value-${chapter.id}`} key={chapter.id}
        aria-current={index === active ? 'step' : undefined} onClick={event => {
          if ((layout === 'reading' && !scrollHoldRef) || staticLayout) return;
          event.preventDefault();
          const element = root.current;
          if (!element) return;
          const rect = element.getBoundingClientRect();
          const stop = layout === 'cinema' || scrollHoldRef ? cinemaStops[index] : index / 2;
          window.scrollTo({ top: scrollY + rect.top + stop * (rect.height - innerHeight), behavior: 'instant' });
          history.replaceState(history.state, '', `#motion-value-${chapter.id}`);
        }}><span>0{index + 1}</span><span>{chapter.label}</span></a>)}
    </nav>
  </aside>;

  const articles = coreValues.map((chapter, index) => <article key={chapter.id} id={`motion-value-${chapter.id}`}
    data-motion-panel data-chapter={chapter.label} className={styles.panel}>
    <div className={styles.copy}>
      <p className={base.eyebrow} data-motion-beat>0{index + 1} / {chapter.label}</p>
      <h2 data-motion-beat>{chapter.title}</h2>
      <div data-motion-beat><Evidence value={chapter} /></div>
      <div data-motion-beat><Description value={chapter} /></div>
    </div>
  </article>);

  return <section className={styles.section} aria-label="스크롤에 따른 About 전환">
    <SectionHeading />
    <p className={styles.scrollHint}>아래로 스크롤하며 세 가지 기준을 살펴보세요 <span aria-hidden="true">↓</span></p>
    <div ref={root} className={`${styles.sequence} ${styles[layout]} ${scrollHoldRef ? styles.pinnedReading : ''}`} data-static={staticLayout ? '' : undefined} data-motion-layout={layout} data-pinned-reading={scrollHoldRef ? '' : undefined}>
      {layout === 'reading' && !scrollHoldRef ? <>{visual}<div className={styles.articles}>{articles}</div></>
        : <div className={styles.viewport}>
          {(layout === 'cinema' || scrollHoldRef) && <div className={styles.pinnedHeader}>
            <span className={base.eyebrow}>01 / ABOUT</span>
            <span>{active === 2 ? '마지막 이야기 · 계속 내리면 다음 섹션으로' : '스크롤하여 다음 이야기로'} <span aria-hidden="true">↓</span></span>
            <div className={styles.progressTrack} aria-hidden="true"><span ref={progressBar} /></div>
          </div>}
          {visual}<div className={styles.articles}>{articles}</div>
        </div>}
    </div>
  </section>;
}
