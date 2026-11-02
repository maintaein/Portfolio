'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { awards, certificates } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import type { Award, Certificate } from '@/types';
import { AWARD_ORBIT, CERT_ORBIT, awardAngle, certAngle, orbitPoint, type Orbit } from './orbit';

const INITIAL_ANGLE = -Math.PI / 3;

type OrbitItem = { kind: 'award'; value: Award } | { kind: 'certificate'; value: Certificate };

const items: OrbitItem[] = [
  ...awards.map((value) => ({ kind: 'award' as const, value })),
  ...certificates.map((value) => ({ kind: 'certificate' as const, value })),
];
const keyOf = (item: OrbitItem) => `${item.kind}:${item.value.id}`;

function position(node: HTMLElement, orbit: Orbit, angle: number, frontLayer: string, backLayer: string) {
  const { x, y, depth } = orbitPoint(orbit, angle);
  node.style.setProperty('--orbit-x', x.toFixed(2));
  node.style.setProperty('--orbit-y', y.toFixed(2));
  node.style.setProperty('--orbit-scale', (.91 + .12 * (depth + 1) / 2).toFixed(3));
  node.style.setProperty('--orbit-opacity', (.72 + .28 * (depth + 1) / 2).toFixed(3));
  node.style.setProperty('--orbit-layer', depth > .28 ? frontLayer : backLayer);
}

// 자격증 궤도는 수상 궤도 안쪽이다. 앞에서는 수상 카드와 수상 앞 궤도선(5) 아래, 뒤에서는 수상 카드 위에 놓인다.
const certRingStyle = {
  width: CERT_ORBIT.rx * 2,
  height: CERT_ORBIT.ry * 2,
  transform: `translate(-50%, -50%) rotate(${CERT_ORBIT.tilt}rad)`,
};

export default function AwardsAndCertificatesSection() {
  const { pageVisible, motionReady, reducedMotion, obscured } = useSectionActivity();
  const { ref, visible } = useSectionVisibility<HTMLElement>();
  const active = visible && pageVisible && motionReady && !reducedMotion && !obscured;
  const [selected, setSelected] = useState(keyOf(items[0]));
  const stageRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(INITIAL_ANGLE);
  const current = items.find((item) => keyOf(item) === selected)!;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const nodes = [...stage.querySelectorAll<HTMLElement>('[data-orbit-node]')];
    const certNodes = [...stage.querySelectorAll<HTMLElement>('[data-orbit-cert]')];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frameId = 0;
    let lastTime = 0;

    const draw = () => {
      nodes.forEach((node, index) => position(node, AWARD_ORBIT, awardAngle(angleRef.current, index), '6', '2'));
      // shortcut: 자격증이 하나라 위상 하나에 놓는다. 둘 이상이 되면 위상을 나눈다.
      certNodes.forEach((node) => position(node, CERT_ORBIT, certAngle(angleRef.current), '5', '3'));
    };
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
      ref={ref}
      id={SECTION_IDS.AWARDS_CERTIFICATES}
      aria-labelledby="awards-heading"
      className="awards-orbit-section"
    >
      <h2 id="awards-heading" className="sr-only">Awards &amp; Certificates</h2>
      <div className="awards-orbit" aria-label="Awards & Certificates">
        <div className="awards-stage" ref={stageRef}>
          <div className="awards-plane" aria-hidden="true" />
          <div className="awards-axis" aria-hidden="true" />
          <div className="awards-ring awards-ring-back" aria-hidden="true" />
          <div className="awards-ring awards-cert-ring awards-ring-back" style={certRingStyle} aria-hidden="true" />
          <div className="awards-center" data-orbit-center aria-live="polite" aria-atomic="true">
            {current.kind === 'award' ? (
              <>
                <span className="awards-kind">{String(awards.indexOf(current.value) + 1).padStart(2, '0')} / AWARD</span>
                <h3>{current.value.project}</h3>
                <p className="awards-rank">{current.value.rank}</p>
                <p className="awards-issuer">{current.value.title} · {current.value.organization}</p>
                <p className="awards-description">{current.value.description}</p>
                <span className="awards-date">{current.value.date}</span>
              </>
            ) : (
              <>
                <span className="awards-kind">CERTIFICATE</span>
                <Image className="awards-logo" src={`/logos-mono/${current.value.logo}.png`} alt="" width={76} height={44} unoptimized />
                <h3>{current.value.name}</h3>
                <p className="awards-rank">{current.value.grade}</p>
                <p className="awards-issuer">{current.value.organization}</p>
                <span className="awards-date">{current.value.date} 취득 · {current.value.validUntil}까지 유효</span>
              </>
            )}
          </div>
          {awards.map((award, index) => (
            <div className="awards-node" data-orbit-node key={award.id}>
              <button
                type="button"
                data-award-select={award.id}
                aria-pressed={selected === `award:${award.id}`}
                onPointerEnter={() => setSelected(`award:${award.id}`)}
                onFocus={() => setSelected(`award:${award.id}`)}
                onClick={() => setSelected(`award:${award.id}`)}
                className="awards-node-face"
              >
                <span className="awards-node-number">{String(index + 1).padStart(2, '0')} / {award.date}</span>
                <span className="awards-node-project">{award.project}</span>
                <span className="awards-node-rank">{award.rank}</span>
                <span className="sr-only">{award.title} {award.organization} {award.description}</span>
              </button>
            </div>
          ))}
          <div className="awards-ring awards-cert-ring awards-ring-front" style={certRingStyle} aria-hidden="true" />
          {certificates.map((certificate) => (
            <div className="awards-node" data-orbit-cert key={certificate.id}>
              <button
                type="button"
                data-certificate-select={certificate.id}
                aria-pressed={selected === `certificate:${certificate.id}`}
                onPointerEnter={() => setSelected(`certificate:${certificate.id}`)}
                onFocus={() => setSelected(`certificate:${certificate.id}`)}
                onClick={() => setSelected(`certificate:${certificate.id}`)}
                className="awards-node-face awards-node-cert"
              >
                <span className="awards-node-number"><span aria-hidden="true">CERT</span><span className="sr-only">자격증</span> / {certificate.date}</span>
                <span className="awards-node-project">{certificate.name}</span>
                <span className="awards-node-rank">{certificate.grade} · {certificate.organization}</span>
                <span className="sr-only">{certificate.validUntil}까지 유효</span>
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
      <div className="awards-mobile-records">
        {certificates.map((certificate) => (
          <article className="awards-mobile-card" data-certificate-card={certificate.id} key={certificate.id}>
            <span className="awards-kind">CERTIFICATE</span>
            <h3>{certificate.name}</h3>
            <p className="awards-rank">{certificate.grade}</p>
            <p className="awards-issuer">{certificate.organization}</p>
            <span className="awards-date">{certificate.date} 취득 · {certificate.validUntil}까지 유효</span>
          </article>
        ))}
      </div>
    </section>
  );
}
