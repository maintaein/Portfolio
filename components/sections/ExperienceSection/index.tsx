'use client';

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import type { ExperienceMetric } from '@/types';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import { readingLineY } from '@/lib/utils/scrollGeometry';
import { R, R_NODE, createSegments, stepSegment } from './lineMotion';
import type { ExperienceOverlay, TimelineFrame } from './overlay';
import EvidenceCard from './EvidenceCard';

const N = experiences.length;
const kind = (type: string) => type === 'student' ? 'EDUCATION' : 'WORK';
const delay = (d: number) => ({ '--d': d }) as CSSProperties;
// transform을 뺀 레이아웃 좌표(문서 기준). 공개 전 translateY(18px)가 잰 값을 흔들지 않는다.
const docOffset = (el: HTMLElement, key: 'offsetTop' | 'offsetLeft') => {
  let v = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) v += node[key];
  return v;
};
const headerHeight = () => document.querySelector('[data-scroll-header]')?.getBoundingClientRect().height ?? 0;
const noSubscribe = () => () => {};

// 시안 countTo: 공개되고 250ms 뒤 1.6초 동안 easeOut3로 from에서 to까지 센다. 글자는 요소에 바로 쓴다(프레임마다 React를 다시 그리지 않는다).
function Count({ metric, on, reduced }: { metric: ExperienceMetric; on: boolean; reduced: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { from, to, suffix } = metric;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!on || reduced) { el.textContent = `${to}${suffix}`; return; }
    el.textContent = `${from}${suffix}`;
    const t0 = performance.now() + 250;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / 1600));
      el.textContent = `${Math.round(from + (to - from) * (1 - (1 - t) ** 3))}${suffix}`;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [on, reduced, from, to, suffix]);
  return <b ref={ref}>{`${to}${suffix}`}</b>;
}

// 시안 레이아웃 A: 120px 축 칸과 본문으로 된 장 셋. 선과 헤드는 화면 고정 오버레이가 그리고, 여기는 읽기 진행을 계산해 provider로 넘긴다.
// lineArrived: 프리뷰→헤드 경계가 첫 노드에 내려앉았다(첫 헤드가 산다). 다음 헤드는 앞 구간이 질주를 마치면 산다. 장은 헤드가 살아 있는 동안 공개된다.
// data-part="experience-line"은 장을 감싸지 않는 빈 표시다. data-complete(마지막 장을 다 읽었는지, Skills 경계가 읽는다)와 data-tip(선 끝 문서 y)을 단다.
export default function ExperienceSection({ lineArrived = false, overlay = null }: { lineArrived?: boolean; overlay?: ExperienceOverlay | null }) {
  const { reducedMotion, motionReady } = useSectionActivity();
  const { ref, visible } = useSectionVisibility<HTMLElement>();
  const lineRef = useRef<HTMLSpanElement>(null);
  // 모션 감소는 선호를 확인한 뒤에만 전체 정적 공개다. 확인 전 기본값(reduced)으로 미래 장을 한 번 보였다가 숨기지 않는다.
  const staticMode = reducedMotion && motionReady;
  // 점진 공개는 하이드레이션 뒤 JS가 켠다(data-progressive). 서버 HTML과 JS가 없는 방문에서는 모든 장이 보인다.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const progressive = hydrated && !staticMode;
  // 구간과 헤드는 보임이 바뀌어도 이어진다. 다시 들어올 때 처음부터 질주하며 지난 장을 숨겼다 보이지 않게 한다.
  const motion = useRef({ segs: createSegments(N), heads: Array.from({ length: N }, () => ({ r: 0, pulse: 0, alive: false })) });
  const arrived = useRef(lineArrived);
  // React 상태는 살아 있는 헤드 수와 완료가 바뀔 때만 바꾼다.
  const [progress, setProgress] = useState({ alive: 0, complete: false });
  const alive = staticMode ? N : lineArrived ? Math.max(progress.alive, 1) : 0;
  const complete = staticMode || progress.complete;

  useLayoutEffect(() => { arrived.current = lineArrived; }, [lineArrived]);

  useLayoutEffect(() => {
    const section = ref.current, line = lineRef.current;
    if (!visible || !section || !line) return;
    // 모션 감소: 질주 없이 선 끝이 읽기선을 따르고(stepSegment reduced) 헤드는 맥동 없이 제 크기로 멈춘다. 장 공개는 위 정적 규칙이 맡는다.
    const reduced = staticMode;
    const { segs, heads } = motion.current;
    let geo = { axisX: 0, nodes: [] as number[], readEnd: [] as number[], tail: 0, header: 0 };
    // 보이기 시작한 첫 프레임. 아래에서 켜지면(새로 고침·해시·nav 이동) 읽기선 위의 구간을 하나씩 0.9초씩 질주시키지 않는다.
    let cold = true;
    const measure = () => {
      const axis = section.querySelector<HTMLElement>('[data-part="experience-axis"]');
      const chapters = [...section.querySelectorAll<HTMLElement>('article')];
      geo = {
        axisX: axis ? docOffset(axis, 'offsetLeft') + axis.offsetWidth / 2 : 0,
        nodes: chapters.map(c => { const h = c.querySelector<HTMLElement>('[data-part="experience-node"]')!; return docOffset(h, 'offsetTop') + Math.min(h.offsetHeight, 60) / 2; }),
        readEnd: chapters.map(c => { const el = c.querySelector<HTMLElement>('ul[aria-label="기술"]')!; return docOffset(el, 'offsetTop') + el.offsetHeight + 8; }),
        tail: chapters.length ? docOffset(chapters[N - 1], 'offsetTop') + chapters[N - 1].offsetHeight - 80 : 0,
        header: headerHeight(),
      };
    };
    // 시안 frame()의 A 분기. 다시 잰 뒤에도 선 끝은 stepSegment의 따라감으로 새 자리에 옮겨 간다(바로 옮기지 않는다).
    const tick = (dt: number): TimelineFrame => {
      const y = window.scrollY;
      const reading = readingLineY(window.innerHeight, geo.header) + y;
      // 모션 감소에는 경계 재생이 없어 첫 헤드가 처음부터 산다
      const first = arrived.current || reduced;
      if (first && !heads[0].alive) { heads[0].r = R; heads[0].pulse = 1; }
      heads[0].alive = first;
      segs.forEach((seg, i) => {
        stepSegment(seg, { from: geo.nodes[i], to: i < N - 1 ? geo.nodes[i + 1] : geo.tail, readEnd: geo.readEnd[i], reading, alive: heads[i].alive, dt, reduced, cold });
        const next = heads[i + 1];
        if (!next) return;
        if (seg.done && !next.alive) { next.r = R; next.pulse = 1; }
        next.alive = seg.done;
      });
      cold = false;
      // 헤드는 앞에서부터 산다(다음 헤드는 앞 구간이 끝나야 산다). 가장 아래 산 헤드가 현재다.
      const count = heads.filter(h => h.alive).length, cur = count - 1;
      heads.forEach((h, i) => {
        const target = !h.alive ? 0 : i === cur ? R : R_NODE;
        h.r = reduced ? target : h.r + (target - h.r) * Math.min(1, dt * 6);
        h.pulse = reduced ? 0 : Math.max(0, h.pulse - dt * 1.2);
      });
      const done = reading >= (geo.readEnd[N - 1] ?? Infinity);
      if (cur >= 0) line.dataset.tip = String(Math.round(segs[cur].tip ?? geo.nodes[cur]));
      else delete line.dataset.tip;
      setProgress(p => p.alive === count && p.complete === done ? p : { alive: count, complete: done });
      return {
        scrollY: y,
        axisX: geo.axisX,
        segments: segs.map((s, i) => ({ from: geo.nodes[i] - y, tip: (s.tip ?? geo.nodes[i]) - y, swell: s.swell, done: s.done, last: i === N - 1, rOrigin: heads[i].r })),
        heads: heads.map((h, i) => ({ y: geo.nodes[i] - y, r: h.r, pulse: h.pulse, current: i === cur })),
      };
    };
    const refit = () => { measure(); tick(0); };
    refit();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refit);
    resize?.observe(section);
    window.addEventListener('resize', refit);
    let live = true;
    document.fonts?.ready.then(() => { if (live) refit(); });
    // 오버레이가 있으면 그 rAF 하나로 그리며 진행한다. 없으면(테스트, 캔버스 없음) 그리기 없이 같은 진행만 돈다.
    let raf = 0, last = 0;
    const loop = (now: number) => {
      tick(last ? Math.min(0.05, (now - last) / 1000) : 0);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    if (overlay) overlay.setTimeline(dt => tick(dt));
    else raf = requestAnimationFrame(loop);
    return () => {
      live = false;
      resize?.disconnect();
      window.removeEventListener('resize', refit);
      cancelAnimationFrame(raf);
      overlay?.setTimeline(null);
      // 화면을 떠나는 마지막 스크롤이 진행되기 전에 끊겼을 수 있다. 떠난 자리(예: 한 번에 Skills로)의 완료 상태로 한 번 더 맞춘다.
      tick(0);
    };
  }, [visible, staticMode, overlay, ref]);

  // 보이지 않는 동안은 프레임을 돌지 않지만 data-complete(Skills 경계가 읽는다)는 맞춘다. 한 번도 보이지 않고 지나간 방문도 있다.
  // 섹션이 화면 위로 다 지나갔으면 화면 안의 읽기선은 마지막 읽기 끝 아래다. 화면 아래에 있으면 아직이다.
  useLayoutEffect(() => {
    const section = ref.current;
    if (visible || staticMode || !section) return;
    const check = () => {
      const done = section.getBoundingClientRect().bottom <= 0;
      setProgress(p => p.complete === done ? p : { ...p, complete: done });
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [visible, staticMode, ref]);

  return (
    <section ref={ref} id={SECTION_IDS.EXPERIENCE} aria-labelledby="experience-heading" className="experience" data-progressive={progressive ? '' : undefined}>
      {/* 섹션 제목은 시각적으로 숨긴다(다른 섹션과 같다) */}
      <h2 id="experience-heading" className="sr-only">경력</h2>
      <span ref={lineRef} data-part="experience-line" data-complete={complete} aria-hidden="true" />
      {experiences.map((experience, index) => {
        const on = index < alive;
        return (
          <article
            key={experience.id}
            className="experience-chapter"
            data-state={index < alive - 1 ? 'past' : index === alive - 1 ? 'current' : 'future'}
            aria-labelledby={`experience-company-${experience.id}`}
          >
            <div className="experience-axis" data-part="experience-axis" />
            <div className="experience-chapter-body">
              <div className="experience-meta experience-reveal">
                <span className="experience-kind">{kind(experience.type)}</span>
                <span>{experience.period}</span>
              </div>
              <h3 id={`experience-company-${experience.id}`} data-part="experience-node" className="experience-company experience-reveal">{experience.company}</h3>
              <p className="experience-position experience-reveal" style={delay(1)}>{experience.position}</p>
              <p className="experience-desc experience-reveal" style={delay(2)}>{experience.description}</p>
              {experience.metrics && (
                <div className="experience-metrics experience-reveal" style={delay(3)}>
                  {experience.metrics.map((metric) => (
                    <div key={metric.label} className="experience-metric">
                      <Count metric={metric} on={on} reduced={staticMode} />
                      <span>{metric.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {experience.evidence && (
                // 카드는 EvidenceCard의 figure가 직접 공개된다. 지연은 이 --d를 물려받고 둘째 카드는 한 칸 늦다(CSS).
                <div className="experience-cards" style={delay(experience.metrics ? 4 : 3)}>
                  {experience.evidence.map((evidence) => <EvidenceCard key={evidence.demo} evidence={evidence} active={on} reduced={staticMode} />)}
                </div>
              )}
              <h4 className="experience-resp-title experience-reveal">{experience.type === 'student' ? '학습 내용' : '주요 업무'}</h4>
              <ul className="experience-resp experience-reveal">
                {experience.highlight && <li className="experience-win">{experience.highlight}</li>}
                {experience.responsibilities.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <ul className="experience-chips experience-reveal" aria-label="기술">
                {(experience.skills ?? []).map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            </div>
          </article>
        );
      })}
    </section>
  );
}
