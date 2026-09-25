'use client';

import { useState, type CSSProperties } from 'react';
import { SECTION_IDS } from '@/lib/constants';
import { projects, skillCategories } from '@/lib/data';

const names = [
  'TypeScript', 'Python', 'React', 'Next.js',
  'Tailwind CSS', 'React Query', 'Zustand', 'Figma',
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

function iconStyle(icon: string): CSSProperties {
  return { '--skill-icon-src': `url(/icons-mono/${icon}.svg)` } as CSSProperties;
}

export default function SkillsSection() {
  const [selected, setSelected] = useState(skills[0]);
  const count = selected.projects.length;
  const ys = count === 1 ? [50] : count === 2 ? [34, 66] :
    count === 3 ? [22, 50, 78] : count === 4 ? [17, 39, 61, 83] : [13, 31, 50, 69, 87];
  const points = selected.projects.map((_, index) => ({
    x: count > 2 && (index === 0 || index === count - 1) ? 69 : 76,
    y: ys[index],
  }));

  return (
    <section id={SECTION_IDS.SKILLS} aria-labelledby="skills-heading" className="skills-signal flex min-h-full">
      <div className="signal-shell m-auto w-full">
        <div className="signal-top">
          <span>KIM TAE IN / CAPABILITY MAP</span>
          <span>PROJECT BACKED SKILLS</span>
        </div>
        <header className="signal-intro">
          <p className="signal-micro">SKILLS / SIGNAL HUB</p>
          <h2 id="skills-heading">기술에서 프로젝트로,<br />프로젝트에서 내가 한 일로.</h2>
        </header>
        <div className="signal-workspace">
          <nav className="signal-nav" aria-label="기술 선택">
            <p className="signal-micro">01 / SKILLS</p>
            {skills.map((skill) => {
              const active = selected.name === skill.name;
              return (
                <button
                  key={skill.name}
                  type="button"
                  aria-pressed={active}
                  style={iconStyle(skill.icon)}
                  className="skill-icon-button signal-skill"
                  onMouseEnter={() => setSelected(skill)}
                  onFocus={() => setSelected(skill)}
                  onClick={() => setSelected(skill)}
                >
                  <span aria-hidden="true" className={`skill-icon ${active ? 'skill-icon-active' : ''}`} />
                  <span>{skill.name}</span>
                </button>
              );
            })}
          </nav>
          <div className="signal-canvas">
            <div className="signal-canvas-head">
              <div>
                <p className="signal-micro">PROJECT SIGNAL MAP</p>
                <h3>One skill. Real work.</h3>
              </div>
              <p>왼쪽 기술에 마우스를 올리거나 선택하면 연결된 프로젝트와 기록이 바뀝니다.</p>
            </div>
            <div className="signal-stage">
              <div
                data-skill-map
                data-active-skill={selected.name}
                className="signal-map"
                aria-label="선택한 기술의 프로젝트 연결 지도"
                style={{ '--count': count } as CSSProperties}
              >
                <svg key={selected.name} viewBox="0 0 660 490" preserveAspectRatio="none" aria-hidden="true">
                  {points.map((point, index) => (
                    <path
                      key={selected.projects[index].title}
                      className="signal-path"
                      style={{ '--order': index } as CSSProperties}
                      d={`M 170 245 Q 300 245 ${Math.round(point.x * 6.6)} ${Math.round(point.y * 4.9)}`}
                    />
                  ))}
                </svg>
                <div className="signal-hub" aria-hidden="true" style={iconStyle(selected.icon)}>
                  <span className="skill-icon skill-icon-active" />
                </div>
                {selected.projects.map((project, index) => (
                  <a
                    key={`${selected.name}-${project.title}`}
                    className="signal-project"
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ '--x': `${points[index].x}%`, '--y': `${points[index].y}%`, '--order': index } as CSSProperties}
                    aria-label={`${project.title} GitHub`}
                  >
                    <span className="signal-index">{String(index + 1).padStart(2, '0')}</span>
                    <span>{project.title}</span>
                  </a>
                ))}
              </div>
              <div className="signal-result" data-testid="skill-result" aria-live="polite">
                <div>
                  <p className="signal-micro">{selected.category} / {String(count).padStart(2, '0')} PROJECT{count === 1 ? '' : 'S'}</p>
                  <h3>{selected.name}</h3>
                  <p className="signal-detail">{selected.description}</p>
                </div>
                <p className="signal-footnote">SOURCE / PORTFOLIO SKILL DESCRIPTION</p>
              </div>
            </div>
          </div>
        </div>
        <div className="signal-footer">
          <span>ONLY SKILLS WITH PROJECT EVIDENCE ARE SHOWN.</span>
          <span>HOVER OR SELECT AN ICON · FOLLOW THE CONNECTIONS</span>
        </div>
        <div className="sr-only">
          {skills.map((skill) => (
            <p key={skill.name}>
              {skill.name}: {skill.description}. Projects: {skill.projects.map((project) => project.title).join(', ')}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
