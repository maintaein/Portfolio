'use client';

import { useEffect, useRef, useState } from 'react';
import { awards } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

const INITIAL_ANGLE = -Math.PI / 3;

function position(node: HTMLElement, angle: number) {
  const depth = Math.sin(angle);
  node.style.setProperty('--orbit-x', (415 * Math.cos(angle)).toFixed(2));
  node.style.setProperty('--orbit-y', (255 * depth).toFixed(2));
  node.style.setProperty('--orbit-scale', (.91 + .12 * (depth + 1) / 2).toFixed(3));
  node.style.setProperty('--orbit-opacity', (.72 + .28 * (depth + 1) / 2).toFixed(3));
  node.style.setProperty('--orbit-layer', depth > .28 ? '6' : '2');
}

export default function AwardsAndCertificatesSection({ active = false }: { active?: boolean }) {
  const [selected, setSelected] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(INITIAL_ANGLE);
  const current = awards[selected];

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const nodes = [...stage.querySelectorAll<HTMLElement>('[data-orbit-node]')];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frameId = 0;
    let lastTime = 0;

    const draw = () => nodes.forEach((node, index) => {
      position(node, angleRef.current + index * Math.PI * 2 / awards.length);
    });
    const tick = (time: number) => {
      if (lastTime) angleRef.current += Math.min(time - lastTime, 50) * .00015;
      lastTime = time;
      draw();
      frameId = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      lastTime = 0;
      draw();
      if (active && !document.hidden && !motion.matches) {
        frameId = requestAnimationFrame(tick);
      }
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
    };
  }, [active]);

  return (
    <section
      id={SECTION_IDS.AWARDS_CERTIFICATES}
      aria-labelledby="awards-heading"
      className="awards-orbit-section"
    >
      <h2 id="awards-heading" className="sr-only">Awards &amp; Certificates</h2>
      <div className="awards-orbit" aria-label="Awards">
        <div className="awards-stage" ref={stageRef}>
          <div className="awards-plane" aria-hidden="true" />
          <div className="awards-axis" aria-hidden="true" />
          <div className="awards-ring awards-ring-back" aria-hidden="true" />
          <div className="awards-center" data-orbit-center aria-live="polite" aria-atomic="true">
            <span className="awards-kind">{String(selected + 1).padStart(2, '0')} / AWARD</span>
            <h3>{current.project}</h3>
            <p className="awards-rank">{current.rank}</p>
            <p className="awards-issuer">{current.title} · {current.organization}</p>
            <p className="awards-description">{current.description}</p>
            <span className="awards-date">{current.date}</span>
          </div>
          {awards.map((award, index) => (
            <div className="awards-node" data-orbit-node key={award.id}>
              <button
                type="button"
                data-award-select={award.id}
                aria-pressed={selected === index}
                onPointerEnter={() => setSelected(index)}
                onFocus={() => setSelected(index)}
                onClick={() => setSelected(index)}
                className="awards-node-face"
              >
                <span className="awards-node-number">{String(index + 1).padStart(2, '0')} / {award.date}</span>
                <span className="awards-node-project">{award.project}</span>
                <span className="awards-node-rank">{award.rank}</span>
                <span className="sr-only"> · {award.title}</span>
              </button>
            </div>
          ))}
          <div className="awards-ring awards-ring-front" aria-hidden="true" />
        </div>
      </div>
      <div className="awards-mobile-records">
        {awards.map((award, index) => (
          <article className="awards-mobile-card" data-award-card={award.id} key={award.id}>
            <span className="awards-kind">{String(index + 1).padStart(2, '0')} / {award.date}</span>
            <h3>{award.project}</h3>
            <p className="awards-rank">{award.rank}</p>
            <p className="awards-issuer">{award.title} · {award.organization}</p>
            <p className="awards-description">{award.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
