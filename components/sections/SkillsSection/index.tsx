'use client';

import Image from 'next/image';
import { useId, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type Ref } from 'react';
import { SECTION_IDS } from '@/lib/constants';
import { projects, skillCategories } from '@/lib/data';
import ScrollArea from '@/components/common/ScrollArea';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import { createSkillGraph, type SkillGraph } from './graph';

const names = [
  'React', 'TypeScript', 'Next.js', 'Tailwind CSS',
  'Python', 'React Query', 'Zustand', 'Figma',
];
const skills = names.map((name) => {
  const category = skillCategories.find((group) => group.skills.some((skill) => skill.name === name))!;
  const skill = category.skills.find((item) => item.name === name)!;
  const normalized = name.toLowerCase().replace(/[^a-z]/g, '');
  return {
    ...skill,
    category: category.label,
    projects: projects.filter((project) =>
      project.tags.some((tag) =>
        tag.toLowerCase().replace(/\s*\d+$/, '').replace(/[^a-z]/g, '') === normalized
      )
    ),
  };
});
type Skill = (typeof skills)[number];

function iconStyle(icon: string): CSSProperties {
  return { '--skill-icon-src': `url(/icons-mono/${icon}.svg)` } as CSSProperties;
}
// 값이 바뀌지 않으니 React는 마운트 뒤 이 style을 다시 쓰지 않는다. 그 뒤로는 그래프가 아이콘을 바꾼다.
const HUB_ICON = iconStyle(skills[0].icon);

// 지금 고른 기술의 프로젝트와, 빠지는 중이라 아직 거두는 프로젝트를 문서 순서대로 그린다.
function rendered(view: { skill: Skill; leaving: string[] }) {
  return projects.filter((project) => view.skill.projects.includes(project) || view.leaving.includes(project.title));
}

// 넘김이 React를 거치지 않고 헤드를 바로 숨기거나 세운다. 같은 scroll 안에서 오버레이 헤드와 맞바꿔야 한 프레임도 겹치거나 비지 않는다.
// reveal: 넘김 헤드가 곡선에 들어섰다. 목록을 위부터 차례로 꺼낸다(한 번만).
export interface SkillsSectionHandle { setArrived(arrived: boolean): void; reveal(): void }

// 목록과 제목 자리의 등장. idle: 아직 나오지 않았다(헤드가 오는 중이면 감춘다). rows: 넘김 헤드가 곡선에 들어서 목록이 나온다.
// full: 그 뒤 도착해 제목 자리도 나온다. done: 넘김 없이 도착했다(nav, 새로 고침, 모바일, 모션 감소). 한 번 나오면 다시 감추지 않는다.
type Reveal = 'idle' | 'rows' | 'full' | 'done';

// headArrived: Experience에서 넘어온 헤드가 도착했다. 도착한 뒤에 등장한다. onHeadShown: 도착 뒤 헤드를 처음 그렸다.
export default function SkillsSection({ ref: handleRef, headArrived = true, onHeadShown }: { ref?: Ref<SkillsSectionHandle>; headArrived?: boolean; onHeadShown?: () => void } = {}) {
  const [view, setView] = useState({ skill: skills[0], leaving: [] as string[] });
  const selected = view.skill;
  const stageRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<SkillGraph | null>(null);
  // 그래프는 한 번 만들고, 부를 때마다 지금 받은 콜백을 쓴다.
  const headShownRef = useRef(onHeadShown);
  headShownRef.current = onHeadShown;
  const [reveal, setReveal] = useState<Reveal>('idle');
  const revealedRef = useRef(false);
  // 두 번 마운트돼도 url(#…)이 남의 필터를 집지 않게 인스턴스마다 다른 id를 쓴다.
  const zapId = `skills-zap-${useId().replace(/[^\w-]/g, '')}`;
  const { routeResolved, motionReady, pageVisible, reducedMotion, obscured } = useSectionActivity();
  const { ref, visible } = useSectionVisibility<HTMLElement>();
  const entered = visible && routeResolved && motionReady && pageVisible && !obscured;
  const order = selected.projects.map((project) => project.title);
  const row = skills.indexOf(selected);

  const choose = (skill: Skill) => setView((prev) => prev.skill === skill ? prev : {
    skill,
    leaving: rendered(prev).map((project) => project.title).filter((title) => !skill.projects.some((project) => project.title === title)),
  });

  // 그래프는 모션 선호를 안 뒤에 만든다. 그 전의 reducedMotion은 기본값 true라 정적 상태로 굳어 버린다.
  // 그때까지는 서버 HTML의 최종 상태(선 없음) 그대로다. 아래 효과들이 모션 감소, 선택, 진입을 넘긴다.
  useLayoutEffect(() => {
    if (!motionReady) return;
    const graph = createSkillGraph(stageRef.current!, {
      reduced: reducedMotion,
      onGone: (title) => setView((prev) => prev.leaving.includes(title) ? { ...prev, leaving: prev.leaving.filter((item) => item !== title) } : prev),
      onHeadShown: () => headShownRef.current?.(),
    });
    graphRef.current = graph;
    return () => { graph.destroy(); graphRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionReady]);

  useImperativeHandle(handleRef, () => ({
    setArrived: (arrived) => graphRef.current?.setArrived(arrived),
    // 넘김은 매 프레임 부른다. 첫 번만 상태를 바꾼다.
    reveal: () => {
      if (revealedRef.current) return;
      revealedRef.current = true;
      setReveal((prev) => prev === 'idle' ? 'rows' : prev);
    },
  }), []);

  // 그래프 진입과 같은 때(도착하고 보일 때) 제목 자리가 나온다
  useLayoutEffect(() => {
    if (entered && headArrived) setReveal((prev) => prev === 'rows' ? 'full' : prev === 'idle' ? 'done' : prev);
  }, [entered, headArrived]);

  // 모션 감소의 정착(헤드 그리기)보다 먼저 도착 여부를 넘긴다.
  useLayoutEffect(() => { graphRef.current?.setArrived(headArrived); }, [headArrived, motionReady]);

  useLayoutEffect(() => { graphRef.current?.setReduced(reducedMotion); }, [reducedMotion]);

  // 렌더마다 React가 붙이거나 뗀 노드를 다시 읽는다. 그래프는 고른 줄이 바뀐 때만 새 목표를 잡는다.
  useLayoutEffect(() => {
    graphRef.current?.sync();
    graphRef.current?.select(row, order, `/icons-mono/${selected.icon}.svg`);
  });

  useLayoutEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    if (entered && headArrived) graph.start();
    graph.setRunning(entered);
  }, [entered, reducedMotion, headArrived]);

  return (
    <section ref={ref} id={SECTION_IDS.SKILLS} aria-labelledby="skills-heading" className="skills-signal">
      {/* 섹션 제목은 시각적으로 숨긴다(다른 섹션과 같다) */}
      <h2 id="skills-heading" className="sr-only">기술</h2>
      <div className="signal-shell">
        <div
          ref={stageRef}
          data-skill-map
          data-active-skill={selected.name}
          data-reveal={reveal === 'idle' ? (headArrived ? undefined : 'wait') : reveal}
          className="signal-stage"
          aria-label="선택한 기술의 프로젝트 연결 지도"
        >
          <canvas data-graph="head" className="signal-head" aria-hidden="true" />
          <svg className="signal-lines" aria-hidden="true" focusable="false"><path data-graph="link" /></svg>
          <ScrollArea as="nav" className="signal-nav" aria-label="기술 선택">
            {skills.map((skill, i) => {
              const active = selected.name === skill.name;
              return (
                <button
                  key={skill.name}
                  type="button"
                  data-skill-row
                  aria-pressed={active}
                  style={{ ...iconStyle(skill.icon), '--i': i } as CSSProperties}
                  className="signal-skill"
                  onMouseEnter={() => choose(skill)}
                  onFocus={() => choose(skill)}
                  onClick={() => choose(skill)}
                >
                  <span aria-hidden="true" className={`skill-icon ${active ? 'skill-icon-active' : ''}`} />
                  <span className="signal-skill-name">{skill.name}</span>
                </button>
              );
            })}
          </ScrollArea>
          <div className="signal-result" data-testid="skill-result" aria-live="polite">
            <div key={selected.name}>
              <p className="signal-micro">{selected.category}</p>
              <h3>{selected.name}</h3>
              <p className="signal-detail">{selected.description}</p>
            </div>
          </div>
          <div data-graph="hub" className="signal-hub" aria-hidden="true">
            {/* 아이콘 둘은 그래프가 소유한다(모프 동안 옛것과 새것이 엇갈린다). 서버 HTML은 첫 기술 아이콘이다. */}
            <span data-graph="icon-a" className="skill-icon skill-icon-active" style={HUB_ICON} />
            <span data-graph="icon-b" className="skill-icon skill-icon-active" style={{ opacity: 0 }} />
          </div>
          {/* 허브 모프 필터(시안 #zap). 그래프가 모프 동안만 허브에 건다. */}
          <svg className="signal-zap" aria-hidden="true" focusable="false">
            <filter id={zapId} x="-40%" y="-40%" width="180%" height="180%">
              <feTurbulence data-graph="turb" type="fractalNoise" baseFrequency="0.08" numOctaves={2} seed={1} />
              <feDisplacementMap data-graph="disp" in="SourceGraphic" scale={0} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
          <div className="signal-nodes">
            {rendered(view).map((project) => {
              const k = selected.projects.indexOf(project);
              const leaving = k < 0;
              return (
                <div key={project.title} data-project-node={project.title} data-state={leaving ? 'out' : 'in'} className="signal-node"
                  aria-hidden={leaving || undefined} inert={leaving}>
                  <svg className="signal-node-lines" aria-hidden="true" focusable="false">
                    <path data-line="hub" />
                    <path data-line="desc" />
                    <path data-line="pulse" pathLength={1} className="signal-pulse" />
                  </svg>
                  <a className="signal-project" href={project.githubUrl} target="_blank" rel="noopener noreferrer" aria-label={`${project.title} GitHub`}
                    style={{ '--k': leaving ? 0 : k - (selected.projects.length - 1) / 2 } as CSSProperties}>
                    <span data-part="thumb" className="signal-thumb">
                      <Image src={project.image} alt="" width={160} height={90} sizes="160px" />
                    </span>
                    <i data-part="edge" className="signal-edge" aria-hidden="true" />
                    <span data-part="dot" className="signal-dot" aria-hidden="true" />
                    <span data-part="text" className="signal-text">
                      <b>{project.title}</b>
                      <span>{project.subtitle?.replace(/\s*\n\s*/g, ' ')}</span>
                      <span>GitHub ↗</span>
                    </span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="sr-only">
        {skills.map((skill) => (
          <p key={skill.name}>
            {skill.name}: {skill.description}. Projects: {skill.projects.map((project) => project.title).join(', ')}
          </p>
        ))}
      </div>
    </section>
  );
}
