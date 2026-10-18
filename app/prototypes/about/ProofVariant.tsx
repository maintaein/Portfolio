import { coreValues } from '@/lib/data/profile';
import { Description, Evidence, SectionHeading, ValueIcon } from './shared';
import styles from './styles.module.css';

export default function ProofVariant() {
  return <section className={styles.proofLayout} aria-label="근거 비교형 About">
    <div className={styles.proofHeading}><SectionHeading /><p className={styles.proofNote}>세 가지 기준.<br />그 기준을 지켜 온 경험.</p></div>
    <div className={styles.proofGrid}>
      {coreValues.map((value, index) => <article key={value.id} className={styles.proofColumn} id={`value-${value.id}`}>
        <div className={styles.articleTop}><p className={styles.eyebrow}>0{index + 1} / {value.label}</p><ValueIcon value={value} /></div>
        <h2>{value.title}</h2>
        <Evidence value={value} />
        <Description value={value} />
      </article>)}
    </div>
    <a className={styles.backToTop} href="#prototype-top">처음으로 돌아가기 <span aria-hidden="true">↑</span></a>
  </section>;
}
