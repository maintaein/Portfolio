import { coreValues } from '@/lib/data/profile';
import { Description, Evidence, SectionHeading, ValueIcon } from './shared';
import styles from './styles.module.css';

export default function ChaptersVariant() {
  return <section className={styles.chaptersLayout} aria-label="챕터형 About">
    <SectionHeading />
    <div className={styles.chapterLinks}>
      {coreValues.map(value => <a href={`#value-${value.id}`} key={value.id}>{value.label}<span aria-hidden="true">↓</span></a>)}
    </div>
    {coreValues.map((value, index) => <article className={styles.chapter} key={value.id} id={`value-${value.id}`}>
      <div className={styles.chapterIdentity}>
        <p className={styles.eyebrow}>0{index + 1} / {value.label}</p>
        <div className={styles.chapterVisual}><ValueIcon value={value} /><span aria-hidden="true">0{index + 1}</span></div>
      </div>
      <div className={styles.chapterContent}>
        <h2>{value.title}</h2>
        <Description value={value} />
        <Evidence value={value} />
      </div>
    </article>)}
  </section>;
}
