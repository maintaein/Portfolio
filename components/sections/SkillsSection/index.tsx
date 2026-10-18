'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import gsap from 'gsap';
import { SECTION_IDS } from '@/lib/constants';
import { projects, skillCategories } from '@/lib/data';
import ScrollArea from '@/components/common/ScrollArea';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';

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

function iconStyle(icon: string): CSSProperties {
  return { '--skill-icon-src': `url(/icons-mono/${icon}.svg)` } as CSSProperties;
}

export default function SkillsSection() {
  const [selected, setSelected] = useState(skills[0]);
  const mapRef = useRef<HTMLDivElement>(null);
  const lastDrawnSkill = useRef<string | null>(null);
  const { routeResolved, motionReady, pageVisible, reducedMotion, obscured } = useSectionActivity();
  const { ref, visible } = useSectionVisibility<HTMLElement>();
  const entered = visible && routeResolved && motionReady && pageVisible && !obscured;
  const enteredRef = useRef(entered);
  enteredRef.current = entered;
  const timelinesRef = useRef<gsap.core.Timeline[]>([]);
  const drawRef = useRef<(() => void) | null>(null);
  const count = selected.projects.length;

  useLayoutEffect(() => {
    const map = mapRef.current!;
    const svg = map.querySelector('svg')!;
    const hub = map.querySelector<HTMLElement>('.signal-hub')!;
    const links = [...map.querySelectorAll<HTMLAnchorElement>('.signal-project')];
    const paths = [...svg.querySelectorAll('path')];
    let context: gsap.Context | undefined;
    if (reducedMotion) lastDrawnSkill.current = selected.name;
    let drawn = lastDrawnSkill.current === selected.name;
    let geometry = '';

    const draw = () => {
      if (!enteredRef.current || !map.clientWidth || !map.clientHeight) return;
      const bounds = map.getBoundingClientRect();
      const scaleX = bounds.width / map.offsetWidth;
      const scaleY = bounds.height / map.offsetHeight;
      const hubBounds = hub.getBoundingClientRect();
      const hx = (hubBounds.left + hubBounds.width / 2 - bounds.left) / scaleX - map.clientLeft;
      const hy = (hubBounds.top + hubBounds.height / 2 - bounds.top) / scaleY - map.clientTop;
      const radius = hubBounds.width / scaleX / 2;
      const boxes = links.map((link) => {
        const box = link.getBoundingClientRect();
        return {
          left: (box.left - bounds.left) / scaleX - map.clientLeft,
          top: (box.top - bounds.top) / scaleY - map.clientTop,
          width: box.width / scaleX,
          height: box.height / scaleY,
        };
      });
      const nextGeometry = [map.clientWidth, map.clientHeight, hx, hy, radius,
        ...boxes.flatMap((box) => [box.left, box.top, box.width, box.height])]
        .map((value) => value.toFixed(3)).join(',');
      if (nextGeometry === geometry) return;
      geometry = nextGeometry;
      context?.revert();
      timelinesRef.current = [];
      svg.setAttribute('viewBox', `0 0 ${map.clientWidth} ${map.clientHeight}`);
      context = gsap.context(() => {
        links.forEach((link, index) => {
          const box = boxes[index];
          const left = box.left;
          const top = box.top;
          const right = left + box.width;
          const bottom = top + box.height;
          const y = top + box.height / 2;
          const distance = Math.hypot(left - hx, y - hy);
          const x0 = hx + (left - hx) * radius / distance;
          const y0 = hy + (y - hy) * radius / distance;
          const connector = Math.hypot(left - x0, y - y0);
          const perimeter = 2 * (box.width + box.height);
          const path = paths[index];
          path.setAttribute('d', `M ${x0} ${y0} L ${left} ${y} L ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} L ${left} ${y}`);
          if (reducedMotion || drawn) return;
          const surface = link.querySelector('.signal-surface');
          const text = link.querySelectorAll('.signal-project > span:not(.signal-surface)');
          gsap.set(path, { strokeDasharray: connector + perimeter, strokeDashoffset: connector + perimeter });
          gsap.set([surface, ...text], { opacity: 0 });
          const timeline = gsap.timeline({
            delay: index * .16,
            onComplete: index === links.length - 1 ? () => { lastDrawnSkill.current = selected.name; } : undefined,
          })
            .to(path, { strokeDashoffset: perimeter, duration: connector / 700, ease: 'none' })
            .to(path, { strokeDashoffset: 0, duration: Math.min(perimeter / 700, .36), ease: 'none' })
            .to([surface, ...text], { opacity: 1, duration: .18, ease: 'power2.out' });
          timelinesRef.current.push(timeline);
        });
      }, map);
      if (reducedMotion || drawn) lastDrawnSkill.current = selected.name;
      drawn = true;
    };

    drawRef.current = draw;
    draw();
    const observer = new ResizeObserver(() => draw());
    observer.observe(map);
    links.forEach((link) => observer.observe(link));
    return () => {
      drawRef.current = null;
      observer.disconnect();
      context?.revert();
      timelinesRef.current = [];
    };
  }, [selected, reducedMotion]);

  useLayoutEffect(() => {
    if (entered) drawRef.current?.();
    timelinesRef.current.forEach(timeline => timeline.paused(!entered));
  }, [entered]);
  const ys = count === 1 ? [50] : count === 2 ? [34, 66] :
    count === 3 ? [22, 50, 78] : count === 4 ? [17, 39, 61, 83] : [13, 31, 50, 69, 87];
  const points = selected.projects.map((_, index) => ({
    x: count > 2 && (index === 0 || index === count - 1) ? 69 : 76,
    y: ys[index],
  }));

  return (
    <section ref={ref} id={SECTION_IDS.SKILLS} aria-labelledby="skills-heading" className="skills-signal flex min-h-full">
      <div className="signal-shell m-auto w-full">
        <div className="signal-workspace">
          <ScrollArea as="nav" className="signal-nav" aria-label="기술 선택">
            <h2 id="skills-heading" className="signal-micro">SKILLS</h2>
            {skills.map((skill) => {
              const active = selected.name === skill.name;
              return (
                <button
                  key={skill.name}
                  type="button"
                  aria-pressed={active}
                  style={iconStyle(skill.icon)}
                  className="signal-skill"
                  onMouseEnter={() => setSelected(skill)}
                  onFocus={() => setSelected(skill)}
                  onClick={() => setSelected(skill)}
                >
                  <span aria-hidden="true" className="skill-icon-button signal-icon-slot">
                    <span className={`skill-icon ${active ? 'skill-icon-active' : ''}`} />
                  </span>
                  <span>{skill.name}</span>
                </button>
              );
            })}
          </ScrollArea>
          <div className="signal-canvas">
            <div className="signal-canvas-head">
              <div>
                <h3>기술에서 프로젝트로</h3>
              </div>
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
                  <p className="signal-micro">{selected.category}</p>
                  <h3>{selected.name}</h3>
                  <p className="signal-detail">{selected.description}</p>
                </div>
              </div>
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
      </div>
    </section>
  );
}
