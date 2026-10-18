'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import LuminousFlowBackground from '@/components/blocks/LuminousFlowBackground';
import { PERSONAL_INFO } from '@/lib/constants';
import IndexVariant from './IndexVariant';
import ChaptersVariant from './ChaptersVariant';
import ProofVariant from './ProofVariant';
import ReadingVariant from './ReadingVariant';
import FocusVariant from './FocusVariant';
import CinemaVariant from './CinemaVariant';
import styles from './styles.module.css';
import './picker.css';

const staticVariants = [
  { name: 'Index', Component: IndexVariant },
  { name: 'Chapters', Component: ChaptersVariant },
  { name: 'Proof', Component: ProofVariant },
];
const motionVariants = [
  { name: 'Reading', Component: ReadingVariant },
  { name: 'Focus', Component: FocusVariant },
  { name: 'Cinema', Component: CinemaVariant },
];

function readVariant() {
  const value = Number(new URLSearchParams(window.location.search).get('v'));
  return Number.isInteger(value) && value >= 1 && value <= 3 ? value - 1 : 0;
}

export default function AboutPrototype({ initialVariant, motion = false }: { initialVariant: number; motion?: boolean }) {
  const variants = motion ? motionVariants : staticVariants;
  const [replayKey, setReplayKey] = useState(0);
  const [current, setCurrent] = useState(initialVariant);
  const pickerRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const currentRef = useRef(current);
  currentRef.current = current;

  const select = useCallback((index: number) => {
    setCurrent(index);
    const url = new URL(window.location.href);
    url.searchParams.set('v', String(index + 1));
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const replay = useCallback(() => {
    setReplayKey(key => key + 1);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useLayoutEffect(() => {
    const index = readVariant();
    select(index);
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => pickerRef.current?.setAttribute('data-ready', ''));
    });
    let second = 0;
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [select]);

  useLayoutEffect(() => {
    const update = () => {
      const button = pickerRef.current?.querySelectorAll<HTMLButtonElement>('.proto-picker-item')[current];
      if (!button || !highlightRef.current) return;
      highlightRef.current.style.width = `${button.offsetWidth}px`;
      highlightRef.current.style.transform = `translateX(${button.offsetLeft}px)`;
    };
    update();
    const observer = new ResizeObserver(update);
    if (pickerRef.current) observer.observe(pickerRef.current);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [current]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest('input,textarea,select') || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const number = Number(event.key);
      if (Number.isInteger(number) && number >= 1 && number <= variants.length) {
        event.preventDefault(); select(number - 1);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        select((currentRef.current + (event.key === 'ArrowRight' ? 1 : -1) + variants.length) % variants.length);
      } else if (motion && event.key.toLowerCase() === 'r') {
        event.preventDefault(); replay();
      }
    };
    window.addEventListener('keydown', onKey);
    const onPopState = () => setCurrent(readVariant());
    window.addEventListener('popstate', onPopState);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('popstate', onPopState); };
  }, [select, replay, motion, variants.length]);

  const Variant = variants[current].Component;
  return <div className={styles.surface} id="prototype-top">
    <LuminousFlowBackground scrollScene minimumSceneScreens={motion && current === 0 ? 6.5 : 0} />
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>{PERSONAL_INFO.NAME_EN}</Link>
      <span>ABOUT</span>
      <a href="#about-preview" className={styles.headerLink}>소개 읽기 <span aria-hidden="true">↓</span></a>
    </header>
    <main className={styles.main} id="about-preview" data-prototype-variant={variants[current].name}>
      <Variant key={`${current}-${replayKey}`} />
      <div className={styles.nextSection}>
        {!(motion && current === 0) && <span className={styles.eyebrow}>NEXT / PROJECTS</span>}
        <Link href="/#projects">이 태도가 만든 프로젝트 <span aria-hidden="true">↗</span></Link>
      </div>
    </main>
    <nav ref={pickerRef} className="proto-picker" aria-label="Prototype variants">
      <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
      {variants.map((variant, index) => <button key={variant.name} className="proto-picker-item"
        data-active={current === index ? '' : undefined} aria-current={current === index ? 'true' : undefined}
        onClick={() => select(index)}>{variant.name}</button>)}
      {motion && <><span className="proto-picker-divider" aria-hidden="true" />
        <button className="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)" onClick={replay}>↻</button></>}
    </nav>
  </div>;
}
