'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { ElectricLogoProps } from '@/components/blocks/ElectricLogo';
import { SECTION_IDS } from '@/lib/constants';
import { projects, skillCategories } from '@/lib/data';
import ScrollArea from '@/components/common/ScrollArea';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import { createSkillGraph, type SkillGraph } from './graph';

// 허브 아이콘은 Skills가 따로 띄우는 GL 로고다. src를 바꾸면 1초 모프로 다음 아이콘이 된다.
const DynamicElectricLogo = dynamic<ElectricLogoProps>(() => import('@/components/blocks/ElectricLogo'), { ssr: false });

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

// 지금 고른 기술의 프로젝트와, 빠지는 중이라 아직 거두는 프로젝트를 문서 순서대로 그린다.
function rendered(view: { skill: Skill; leaving: string[] }) {
  return projects.filter((project) => view.skill.projects.includes(project) || view.leaving.includes(project.title));
}

export default function SkillsSection() {
  const [view, setView] = useState({ skill: skills[0], leaving: [] as string[] });
  const selected = view.skill;
  const stageRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<SkillGraph | null>(null);
  const { routeResolved, motionReady, pageVisible, reducedMotion, obscured } = useSectionActivity();
  const { ref, visible } = useSectionVisibility<HTMLElement>();
  const entered = visible && routeResolved && motionReady && pageVisible && !obscured;
  const [started, setStarted] = useState(false);
  // 셸의 로고처럼 1024px부터만 GL을 띄운다. 그 아래와 모션 감소는 정적 아이콘이다.
  const [wide, setWide] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const glHub = wide && started && !reducedMotion;
  // GL 허브가 내려가면 준비도 걷는다. 다시 뜬 로고가 그리기 전까지 정적 아이콘이 자리를 지킨다.
  useEffect(() => { if (!glHub) setLogoReady(false); }, [glHub]);
  const order = selected.projects.map((project) => project.title);
  const row = skills.indexOf(selected);

  const choose = (skill: Skill) => setView((prev) => prev.skill === skill ? prev : {
    skill,
    leaving: rendered(prev).map((project) => project.title).filter((title) => !skill.projects.some((project) => project.title === title)),
  });

  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 1024px)');
    if (!query) return;
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // 그래프는 모션 선호를 안 뒤에 만든다. 그 전의 reducedMotion은 기본값 true라 정적 상태로 굳어 버린다.
  // 그때까지는 서버 HTML의 최종 상태(선 없음) 그대로다. 아래 효과들이 모션 감소, 선택, 진입을 넘긴다.
  useLayoutEffect(() => {
    if (!motionReady) return;
    const graph = createSkillGraph(stageRef.current!, {
      reduced: reducedMotion,
      onGone: (title) => setView((prev) => prev.leaving.includes(title) ? { ...prev, leaving: prev.leaving.filter((item) => item !== title) } : prev),
    });
    graphRef.current = graph;
    return () => { graph.destroy(); graphRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionReady]);

  useLayoutEffect(() => { graphRef.current?.setReduced(reducedMotion); }, [reducedMotion]);

  // 렌더마다 React가 붙이거나 뗀 노드를 다시 읽는다. 그래프는 고른 줄이 바뀐 때만 새 목표를 잡는다.
  useLayoutEffect(() => {
    graphRef.current?.sync();
    graphRef.current?.select(row, order);
  });

  useLayoutEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    if (entered) { graph.start(); setStarted(true); }
    graph.setRunning(entered);
  }, [entered, reducedMotion]);

  return (
    <section ref={ref} id={SECTION_IDS.SKILLS} aria-labelledby="skills-heading" className="skills-signal">
      {/* 섹션 제목은 시각적으로 숨긴다(다른 섹션과 같다) */}
      <h2 id="skills-heading" className="sr-only">기술</h2>
      <div className="signal-shell">
        <div
          ref={stageRef}
          data-skill-map
          data-active-skill={selected.name}
          className="signal-stage"
          aria-label="선택한 기술의 프로젝트 연결 지도"
        >
          <span data-graph="rail" className="signal-rail" aria-hidden="true" />
          <span data-graph="head" className="signal-head" aria-hidden="true" />
          <svg className="signal-lines" aria-hidden="true" focusable="false"><path data-graph="link" /></svg>
          <ScrollArea as="nav" className="signal-nav" aria-label="기술 선택">
            {skills.map((skill) => {
              const active = selected.name === skill.name;
              return (
                <button
                  key={skill.name}
                  type="button"
                  data-skill-row
                  aria-pressed={active}
                  style={iconStyle(skill.icon)}
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
            <span className="skill-icon skill-icon-active" style={{ ...iconStyle(selected.icon), opacity: glHub && logoReady ? 0 : undefined }} />
            {glHub ? (
              <DynamicElectricLogo src={`/icons-mono/${selected.icon}.svg`} active={entered} onReady={() => setLogoReady(true)}
                color="#7fe3ee" glowColor="#03b3c3" intensity={0.65} glow={0.3} speed={1.1} flicker={0.25} interactive={false} scale={0.57} className="signal-logo" />
            ) : null}
          </div>
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
