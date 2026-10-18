'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import gsap from 'gsap';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import ScrollArea from '@/components/common/ScrollArea';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';

export default function ExperienceSection() {
  const [selected, setSelected] = useState(0);
  const dragStart = useRef<number | null>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const itemsRef = useRef<(HTMLLIElement | null)[]>([]);
  const motionRef = useRef<gsap.core.Timeline | null>(null);
  const flowRef = useRef({ head: 0, tail: 0 });
  const previousIndex = useRef<number | null>(null);
  const { reducedMotion, pageVisible, motionReady, obscured } = useSectionActivity();
  const { ref, visible } = useSectionVisibility<HTMLElement>();
  const active = visible && pageVisible && motionReady && !obscured;
  const select = (index: number) => setSelected((index + experiences.length) % experiences.length);

  useLayoutEffect(() => {
    if (!active) {
      previousIndex.current = null;
      return;
    }
    const line = lineRef.current;
    const marker = markerRef.current;
    const items = itemsRef.current;
    if (!line || !marker || !items[0] || !items[experiences.length - 1]) return;
    let mobile = window.innerWidth <= 760;
    const position = (item: HTMLLIElement) => mobile
      ? item.offsetLeft + item.offsetWidth / 2
      : item.offsetTop + item.offsetHeight / 2;
    const flow = flowRef.current;
    const draw = () => gsap.set(marker, mobile
      ? { left: (flow.head + flow.tail) / 2, width: Math.abs(flow.head - flow.tail) + 14 }
      : { top: (flow.head + flow.tail) / 2, height: Math.abs(flow.head - flow.tail) + 14 });
    const measure = () => {
      const first = position(items[0]!);
      const last = position(items[experiences.length - 1]!);
      if (mobile) {
        const top = items[0]!.offsetTop;
        gsap.set(line, { left: first, top: top - 2, width: last - first, height: 4 });
        gsap.set(marker, { top, height: 10 });
      } else {
        gsap.set(line, { left: 18, top: first, width: 4, height: last - first });
        gsap.set(marker, { left: 15, width: 10 });
      }
      return position(items[selected]!);
    };
    const target = measure();
    motionRef.current?.kill();
    if (previousIndex.current === null || reducedMotion ||
      (flow.head === target && flow.tail === target)) {
      flow.head = target;
      flow.tail = target;
      draw();
    } else {
      motionRef.current = gsap.timeline()
        .to(flow, { head: target, duration: 0.55, ease: 'power2.inOut', onUpdate: draw }, 0)
        .to(flow, { tail: target, duration: 0.55, ease: 'power2.inOut', onUpdate: draw }, 0.12);
    }
    previousIndex.current = selected;
    const onResize = () => {
      motionRef.current?.kill();
      mobile = window.innerWidth <= 760;
      flow.head = measure();
      flow.tail = flow.head;
      draw();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      motionRef.current?.kill();
    };
  }, [active, reducedMotion, selected]);

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
    <section ref={ref} id={SECTION_IDS.EXPERIENCE} aria-label="경력" className="experience-depth">

      <div className="experience-depth-layout">
        <div className="experience-depth-rail">
          <span ref={lineRef} className="experience-depth-line" aria-hidden="true" />
          <span ref={markerRef} className="experience-depth-marker" aria-hidden="true" />
          <ol className="experience-depth-timeline" aria-label="경력 시점">
            {experiences.map((experience, index) => (
              <li key={experience.id} ref={(item) => { itemsRef.current[index] = item; }} data-active={index === selected}>
                <button type="button" aria-current={index === selected ? 'true' : undefined} onClick={() => select(index)}>
                  <small>{experience.type === 'student' ? 'EDUCATION' : 'WORK'}</small>
                  <strong>{experience.company}</strong>
                  <span>{experience.period}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

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
                <article
                  key={experience.id}
                  className="experience-depth-card"
                  data-depth={depth}
                  aria-labelledby={`experience-card-${experience.id}`}
                >
                  <ScrollArea className="experience-depth-card-scroll" tabIndex={depth === 0 ? 0 : -1}>
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
                </article>
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
