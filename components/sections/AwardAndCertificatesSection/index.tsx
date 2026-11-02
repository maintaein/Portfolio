'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import Image from 'next/image';
import { awards, certificates } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import type { Award, Certificate } from '@/types';
import { AWARD_ORBIT, CERT_ORBIT, awardAngle, certAngle, orbitPoint, type Orbit } from './orbit';
import { createStarRim } from './rim';
import type { StarDom } from './star';

const INITIAL_ANGLE = -Math.PI / 3;
// setStar(dom)이 stage에 쓰는 변수. StarDom의 disc, text, plane, awardLine, certLine, cards 순서다.
const STAR_VARS = ['--star-disc', '--star-text', '--star-plane', '--orbit-award', '--orbit-cert', '--card-0', '--card-1', '--card-2', '--card-3'];

// Skills → Awards 넘김(M6)이 부른다. 부르지 않으면 Awards는 SSR 그대로 돈다.
export interface AwardsSectionHandle { setStar(state: 'wait' | StarDom | null): void; angle(): number }

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

// 자격증 궤도는 수상 궤도 안쪽이다. 앞에서는 두 앞 궤도선(5) 위, 수상 카드(7) 아래, 뒤에서는 수상 카드 위에 놓인다.
const certRingStyle = {
  width: CERT_ORBIT.rx * 2,
  height: CERT_ORBIT.ry * 2,
  transform: `translate(-50%, -50%) rotate(${CERT_ORBIT.tilt}rad)`,
};

export default function AwardsAndCertificatesSection({ ref: handleRef }: { ref?: Ref<AwardsSectionHandle> } = {}) {
  const { pageVisible, motionReady, reducedMotion, obscured } = useSectionActivity();
  const { ref, visible } = useSectionVisibility<HTMLElement>();
  const active = visible && pageVisible && motionReady && !reducedMotion && !obscured;
  const [selected, setSelected] = useState(keyOf(items[0]));
  const stageRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(INITIAL_ANGLE);
  const rimRef = useRef<HTMLCanvasElement>(null);
  // null이 아니면 넘김 중이라 공전이 멈춘다. 재렌더 없이 rAF가 읽는다.
  const starRef = useRef<'wait' | StarDom | null>(null);
  const current = items.find((item) => keyOf(item) === selected)!;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const nodes = [...stage.querySelectorAll<HTMLElement>('[data-orbit-node]')];
    const certNodes = [...stage.querySelectorAll<HTMLElement>('[data-orbit-cert]')];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const canvas = rimRef.current!;
    const rim = createStarRim(canvas);
    // 테두리를 그릴 수 있을 때만 원판의 CSS border를 지운다.
    canvas.toggleAttribute('data-ready', !!rim);
    let frameId = 0;
    let lastTime = 0;

    const draw = (time: number) => {
      nodes.forEach((node, index) => position(node, AWARD_ORBIT, awardAngle(angleRef.current, index), '7', '2'));
      // shortcut: 자격증이 하나라 위상 하나에 놓는다. 둘 이상이 되면 위상을 나눈다.
      certNodes.forEach((node) => position(node, CERT_ORBIT, certAngle(angleRef.current), '6', '3'));
      // 기다리는 동안 테두리는 CSS로 감춰져 있다.
      if (starRef.current !== 'wait') rim?.draw(time / 1000);
    };
    const tick = (time: number) => {
      if (lastTime && !starRef.current) angleRef.current += Math.min(time - lastTime, 50) * .00015;
      lastTime = time;
      draw(time);
      frameId = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      lastTime = 0;
      draw(performance.now());
      if (active && !document.hidden && !motion.matches) {
        frameId = requestAnimationFrame(tick);
      }
    };

    // 크기를 다시 재면 캔버스가 지워진다. 루프가 멈춰 있으면(모션 감소, 화면 밖) 여기서 한 번 다시 그린다.
    const resize = () => {
      rim?.resize();
      if (!frameId) draw(performance.now());
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  useImperativeHandle(handleRef, () => ({
    // 도착 장면은 매 프레임 부른다. React 상태를 거치지 않고 stage에 바로 쓴다.
    setStar(state) {
      starRef.current = state;
      const stage = stageRef.current;
      if (!stage) return;
      const values = state && state !== 'wait' ? [state.disc, state.text, state.plane, state.awardLine, state.certLine, ...state.cards] : null;
      STAR_VARS.forEach((name, index) => values ? stage.style.setProperty(name, String(values[index])) : stage.style.removeProperty(name));
      if (state) stage.dataset.star = values ? 'play' : 'wait';
      else delete stage.dataset.star;
    },
    angle: () => angleRef.current,
  }), []);

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
          <canvas data-star-rim ref={rimRef} aria-hidden="true" />
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
                <span className="awards-date">{current.value.date} 취득{current.value.validUntil && ` · ${current.value.validUntil}까지 유효`}</span>
              </>
            )}
          </div>
          {awards.map((award, index) => (
            <div className="awards-node" data-orbit-node data-card={index} key={award.id}>
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
            // shortcut: 자격증이 하나라 data-card 3에 둔다. 둘 이상이 되면 StarDom의 cards를 늘린다.
            <div className="awards-node" data-orbit-cert data-card={3} key={certificate.id}>
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
                {certificate.validUntil && <span className="sr-only">{certificate.validUntil}까지 유효</span>}
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
            <span className="awards-date">{certificate.date} 취득{certificate.validUntil && ` · ${certificate.validUntil}까지 유효`}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
