import { coreValues } from '@/lib/data/profile';
import { Description, Evidence, SectionHeading, ValueIcon } from './shared';
import styles from './styles.module.css';

export default function IndexVariant() {
  return <section className={styles.indexLayout} aria-label="인덱스형 About">
    <aside className={styles.indexAside}>
      <SectionHeading />
      <nav className={styles.indexLinks} aria-label="About 역량">
        {coreValues.map((value, index) => <a key={value.id} href={`#value-${value.id}`}>
          <span>0{index + 1}</span>{value.label}<span aria-hidden="true">↘</span>
        </a>)}
      </nav>
      <p className={styles.asideNote}>경험이 쌓인 방식과<br />일을 대하는 태도.</p>
    </aside>
    <div className={styles.indexArticles}>
      {coreValues.map((value, index) => <article key={value.id} id={`value-${value.id}`} className={styles.indexArticle}>
        <div className={styles.articleTop}><p className={styles.eyebrow}>0{index + 1} / {value.label}</p><ValueIcon value={value} /></div>
        <h2>{value.title}</h2>
        <Evidence value={value} />
        <Description value={value} />
      </article>)}
    </div>
  </section>;
}
