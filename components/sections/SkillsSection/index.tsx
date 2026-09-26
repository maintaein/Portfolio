'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import gsap from 'gsap';
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
  const mapRef = useRef<HTMLDivElement>(null);
  const count = selected.projects.length;

  useLayoutEffect(() => {
    const map = mapRef.current!;
    const svg = map.querySelector('svg')!;
    const hub = map.querySelector<HTMLElement>('.signal-hub')!;
    const links = [...map.querySelectorAll<HTMLAnchorElement>('.signal-project')];
    const paths = [...svg.querySelectorAll('path')];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let context: gsap.Context | undefined;
    let drawn = false;
    let geometry = '';

    const draw = (force = false) => {
      if (!map.clientWidth || !map.clientHeight) return;
      const bounds = map.getBoundingClientRect();
      const originX = bounds.left + map.clientLeft;
      const originY = bounds.top + map.clientTop;
      const hubBounds = hub.getBoundingClientRect();
      const hx = hubBounds.left + hubBounds.width / 2 - originX;
      const hy = hubBounds.top + hubBounds.height / 2 - originY;
      const boxes = links.map((link) => link.getBoundingClientRect());
      const nextGeometry = [map.clientWidth, map.clientHeight, hx, hy, hubBounds.width,
        ...boxes.flatMap((box) => [box.left - originX, box.top - originY, box.width, box.height])].join(',');
      if (!force && nextGeometry === geometry) return;
      geometry = nextGeometry;
      context?.revert();
      svg.setAttribute('viewBox', `0 0 ${map.clientWidth} ${map.clientHeight}`);
      context = gsap.context(() => {
        links.forEach((link, index) => {
          const box = boxes[index];
          const left = box.left - originX;
          const top = box.top - originY;
          const right = left + box.width;
          const bottom = top + box.height;
          const y = top + box.height / 2;
          const distance = Math.hypot(left - hx, y - hy);
          const radius = hubBounds.width / 2;
          const x0 = hx + (left - hx) * radius / distance;
          const y0 = hy + (y - hy) * radius / distance;
          const connector = Math.hypot(left - x0, y - y0);
          const perimeter = 2 * (box.width + box.height);
          const path = paths[index];
          path.setAttribute('d', `M ${x0} ${y0} L ${left} ${y} L ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} L ${left} ${y}`);
          if (motion.matches || drawn) return;
          const surface = link.querySelector('.signal-surface');
          const text = link.querySelectorAll('.signal-project > span:not(.signal-surface)');
          gsap.set(path, { strokeDasharray: connector + perimeter, strokeDashoffset: connector + perimeter });
          gsap.set([surface, ...text], { opacity: 0 });
          gsap.timeline({ delay: index * .16 })
            .to(path, { strokeDashoffset: perimeter, duration: connector / 700, ease: 'none' })
            .to(path, { strokeDashoffset: 0, duration: Math.min(perimeter / 700, .36), ease: 'none' })
            .to([surface, ...text], { opacity: 1, duration: .18, ease: 'power2.out' });
        });
      }, map);
      drawn = true;
    };

    draw();
    const observer = new ResizeObserver(() => draw());
    observer.observe(map);
    links.forEach((link) => observer.observe(link));
    const syncMotion = () => draw(true);
    motion.addEventListener('change', syncMotion);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', syncMotion);
      context?.revert();
    };
  }, [selected]);
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
                ref={mapRef}
                data-skill-map
                data-active-skill={selected.name}
                className="signal-map"
                aria-label="선택한 기술의 프로젝트 연결 지도"
              >
                <svg key={selected.name} aria-hidden="true">
                  {selected.projects.map((project) => (
                    <path key={project.title} className="signal-path" />
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
                    style={{ '--x': `${points[index].x}%`, '--y': `${points[index].y}%` } as CSSProperties}
                    aria-label={`${project.title} GitHub`}
                  >
                    <span className="signal-surface" aria-hidden="true" />
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
