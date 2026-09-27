'use client';

import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import ScrollArea from '@/components/common/ScrollArea';

export default function ExperienceSection() {
  const [selected, setSelected] = useState(0);
  const dragStart = useRef<number | null>(null);
  const select = (index: number) => setSelected((index + experiences.length) % experiences.length);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      select(selected + (event.key === 'ArrowRight' ? 1 : -1));
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragStart.current = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    const distance = event.clientX - dragStart.current;
    dragStart.current = null;
    if (Math.abs(distance) > 45) select(selected + (distance < 0 ? 1 : -1));
  }

  return (
    <section id={SECTION_IDS.EXPERIENCE} aria-label="경력" className="experience-depth">

      <div className="experience-depth-layout">
        <ol className="experience-depth-timeline" aria-label="경력 시점">
          {experiences.map((experience, index) => (
            <li key={experience.id} data-active={index === selected}>
              <button type="button" aria-current={index === selected ? 'true' : undefined} onClick={() => select(index)}>
                <small>{experience.type === 'student' ? 'EDUCATION' : 'WORK'}</small>
                <strong>{experience.company}</strong>
                <span>{experience.period}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="experience-depth-deck-wrap">
          <div
            className="experience-depth-deck"
            role="group"
            aria-roledescription="carousel"
            aria-label="경력 깊이 캐러셀"
            tabIndex={0}
            data-section-swipe-ignore
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { dragStart.current = null; }}
          >
            {experiences.map((experience, index) => {
              const depth = (index - selected + experiences.length) % experiences.length;
              return (
                <ScrollArea
                  as="article"
                  key={experience.id}
                  className="experience-depth-card"
                  data-depth={depth}
                  tabIndex={depth === 0 ? 0 : -1}
                  aria-labelledby={`experience-card-${experience.id}`}
                >
                  <div className="experience-depth-card-meta">
                    <span>{String(index + 1).padStart(2, '0')} / {String(experiences.length).padStart(2, '0')}</span>
                    <span>{experience.period}</span>
                  </div>
                  <p className="experience-depth-kind">{experience.type === 'student' ? 'EDUCATION' : 'WORK'}</p>
                  <h3 id={`experience-card-${experience.id}`}>{experience.company}</h3>
                  <p className="experience-depth-position">{experience.position}</p>
                  <p className="experience-depth-description">{experience.description}</p>
                  <h4>주요 경험</h4>
                  <ul className="experience-depth-responsibilities">
                    {experience.responsibilities.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <ul className="experience-depth-skills" aria-label="기술">
                    {(experience.skills ?? []).map((skill) => <li key={skill}>{skill}</li>)}
                  </ul>
                </ScrollArea>
              );
            })}
          </div>
          <div className="experience-depth-foot">
            <span aria-live="polite">{String(selected + 1).padStart(2, '0')} / {String(experiences.length).padStart(2, '0')} · {experiences[selected].company}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
