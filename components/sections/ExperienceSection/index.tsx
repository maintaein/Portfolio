'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

// 마스크 원본 크기. 슬롯 높이를 32px로 고정하고 폭은 여기서 비율로
// 계산한다. contain 마스크는 폭이 남으면 그만큼 죽은 여백을 만들 뿐이라,
// 정사각 타일에 넣으면 4:1 워드마크가 8px까지 줄어 읽히지 않는다.
const LOGO_HEIGHT = 32;
const LOGO_MAX_WIDTH = 96;
const LOGOS: Record<string, { file: string; width: number; height: number }> = {
  FASOO: { file: 'fasoo', width: 428, height: 104 },
  SSAFY: { file: 'ssafy', width: 184, height: 145 },
  KUA: { file: 'kua', width: 216, height: 176 },
};

function logoStyle(logo: string): CSSProperties {
  const { file, width, height } = LOGOS[logo];
  return {
    '--org-logo-src': `url(/logos-mono/${file}.png)`,
    width: Math.min(LOGO_MAX_WIDTH, Math.round((LOGO_HEIGHT * width) / height)),
  } as CSSProperties;
}

export default function ExperienceSection() {
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; left: number } | null>(null);

  // 휠은 세로 회전만 보내는 마우스가 대부분이라 deltaY를 가로로 돌린다.
  // 트랙패드가 가로 성분을 실어 보내면 그쪽을 그대로 쓴다. 리액트의
  // onWheel은 루트에 passive로 걸려 preventDefault가 먹지 않으므로 직접
  // 건다. 끝에 닿아 더 못 가면 preventDefault를 하지 않는다. 그래야 카드가
  // 세로로 넘칠 때 바깥 스크롤이 살아 있다.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const handleWheel = (event: WheelEvent) => {
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const before = rail.scrollLeft;
      rail.scrollLeft = before + delta;
      if (rail.scrollLeft !== before) event.preventDefault();
    };

    rail.addEventListener('wheel', handleWheel, { passive: false });
    return () => rail.removeEventListener('wheel', handleWheel);
  }, []);

  // 터치는 브라우저의 관성 스크롤이 훨씬 낫고 가로 스와이프 판정도
  // useSectionSwipe가 쥐고 있다. 마우스와 펜의 주 버튼만 잡는다.
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    dragRef.current = { x: event.clientX, left: event.currentTarget.scrollLeft };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.currentTarget.scrollLeft = drag.left - (event.clientX - drag.x);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <section
      id={SECTION_IDS.EXPERIENCE}
      aria-labelledby="experience-heading"
      className="experience-hud"
    >
      {/* 화면에서는 뺀 제목. 섹션 이름을 쥐고 있는 유일한 요소라 접근성
          트리에는 남긴다. AboutSection도 같은 방식이다. */}
      <h2 id="experience-heading" className="sr-only">
        Experience
      </h2>

      <div aria-hidden className="experience-axis" />

      {/* data-section-swipe-ignore가 없으면 useSectionSwipe가 가로 스와이프를
          먼저 집어 삼켜 섹션이 넘어간다. tabIndex는 스크롤 컨테이너를
          키보드로도 움직이게 한다. */}
      <div
        ref={railRef}
        role="region"
        aria-label="경력 타임라인"
        tabIndex={0}
        data-section-swipe-ignore
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="section-horizontal-scroll absolute inset-0 cursor-grab overflow-x-auto active:cursor-grabbing focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <ol className="experience-rail">
          {experiences.map((experience, index) => {
            const current = experience.period.endsWith('현재');

            return (
              <li
                key={experience.id}
                data-experience-node={experience.company}
                data-experience-current={current ? 'true' : undefined}
                className="experience-node"
              >
                <p
                  data-experience-field="period"
                  className="flex items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-2.5 text-t8 uppercase tracking-widest text-[var(--color-text-secondary)]"
                >
                  <span className="flex items-center gap-2">
                    {experience.period}
                    {current && <span className="text-[var(--color-cyan-hi)]">CURRENT</span>}
                  </span>
                  <span>NODE_{String(index + 1).padStart(2, '0')}</span>
                </p>

                <div data-experience-field="company" className="mt-4 flex items-center gap-3">
                  <span
                    aria-hidden
                    data-experience-logo
                    className="org-logo shrink-0"
                    style={logoStyle(experience.logo ?? 'FASOO')}
                  />
                  <h3 className="text-t3 font-semibold text-[var(--color-text-primary)]">
                    {experience.company}
                  </h3>
                </div>

                <p
                  data-experience-field="position"
                  className="mt-1.5 text-t7 font-medium uppercase tracking-widest text-[var(--color-cyan-hi)]"
                >
                  {experience.position}
                </p>

                <ul
                  data-experience-field="responsibilities"
                  className="mt-4 space-y-1.5 text-t6 leading-relaxed text-[var(--color-text-secondary)]"
                >
                  {experience.responsibilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <ul data-experience-field="skills" className="mt-5 flex flex-wrap gap-2">
                  {(experience.skills ?? []).map((skill) => (
                    <li
                      key={skill}
                      className="border border-[var(--color-hairline)] px-2.5 py-1 text-t8 uppercase tracking-wider text-[var(--color-cyan-hi)]"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="pointer-events-none absolute bottom-6 right-8 z-10 flex items-center gap-4 text-t8 uppercase tracking-widest text-[var(--color-cyan-hi)]">
        휠 또는 드래그로 이동
        <span aria-hidden className="block h-px w-10 bg-[var(--color-cyan-core)]" />
      </p>
    </section>
  );
}
