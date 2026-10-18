import type { CSSProperties } from 'react';
import type { CoreValue } from '@/types';
import styles from './styles.module.css';

export function ValueIcon({ value }: { value: CoreValue }) {
  return <span aria-hidden="true" className={styles.icon} style={{
    maskImage: `url(${value.logoSrc})`, WebkitMaskImage: `url(${value.logoSrc})`,
  } as CSSProperties} />;
}

export function Evidence({ value }: { value: CoreValue }) {
  return <dl className={styles.evidence}>
    {value.evidence?.map(item => <div key={item.label}>
      <dt>{item.label}</dt><dd>{item.value}</dd>
    </div>)}
  </dl>;
}

export function Description({ value }: { value: CoreValue }) {
  return <div className={styles.description}>
    {value.description.split('\n\n').map((paragraph, i) => <p key={i}>{paragraph.trim()}</p>)}
  </div>;
}

export function SectionHeading({ showIndex = true }: { showIndex?: boolean }) {
  return <div className={styles.sectionHeading}>
    {showIndex && <p className={styles.eyebrow}>01 / ABOUT</p>}
    <h1>어떻게 일하는<br />개발자인가.</h1>
    <p className={styles.intro}>기본에 충실하고, 완성도를 높이며, 함께 나아갑니다.</p>
  </div>;
}
