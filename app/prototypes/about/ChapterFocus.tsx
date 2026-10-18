'use client';

import { coreValues } from '@/lib/data/profile';
import styles from './chapter-focus.module.css';

export default function ChapterFocus({ active, entered, onSelect }: { active: number; entered: boolean; onSelect: (index: number) => void }) {
  return <nav className={styles.chapters} data-chapter-focus data-entered={entered} aria-label="About 이야기">
    {coreValues.map((value, index) => <button key={value.id} type="button"
      className={styles.word} aria-current={active === index ? 'step' : undefined} data-chapter-word={value.label} data-focused={active === index}
      tabIndex={entered ? 0 : -1} onClick={() => onSelect(index)}>
      <span className={styles.label}>{value.label}</span>
      <span className={styles.glow} data-chapter-glow aria-hidden="true">{value.label}</span>
    </button>)}
  </nav>;
}
