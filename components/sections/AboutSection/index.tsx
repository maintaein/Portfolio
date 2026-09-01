'use client';

import { useState } from 'react';
import { coreValues } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import AboutRail from './rail';

// 증거 블록. 자리는 셋이 같고 내용만 다르다. 콘텐츠가 확정되면 이 배열만
// 바꾼다. 라벨은 t8, 값은 크게 둬서 대충 봐도 값이 먼저 읽힌다.
const EVIDENCE = [
  <div key="basics" className="flex flex-col gap-5">
    <div>
      <div className="text-t8 uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
        Tree-shaking
      </div>
      <div className="text-d3 font-bold leading-none text-[var(--color-text-primary)]">91%</div>
    </div>
    <div>
      <div className="text-t8 uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
        렌더링 에러
      </div>
      <div className="text-d3 font-bold leading-none text-[var(--color-text-primary)]">0</div>
    </div>
  </div>,
  <div key="ai" className="flex flex-col gap-5 font-mono">
    <div>
      <div className="text-t8 uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
        검증한 뒤 반영
      </div>
      <div className="text-t2 leading-tight text-[var(--color-text-primary)]">
        Prompt <span className="text-[var(--color-cyan-core)]">&#8594;</span> Review{' '}
        <span className="text-[var(--color-cyan-core)]">&#8594;</span> Ship
      </div>
    </div>
  </div>,
  <div key="team" className="flex flex-col gap-4 font-mono">
    {[
      ['ROLE', '프론트엔드 리더'],
      ['CONVENTION', 'git  jira'],
      ['ARCHITECTURE', 'FSD  Atomic'],
    ].map(([label, value]) => (
      <div key={label}>
        <div className="text-t8 tracking-[0.2em] text-[var(--color-text-secondary)]">{label}</div>
        <div className="mt-1 text-t3 leading-tight text-[var(--color-text-primary)]">{value}</div>
      </div>
    ))}
  </div>,
];

// Cubes와 Orbit은 폐기했다. 배경이 이미 있는데 별도 도형을 얹으면 경쟁한다.
// 순번 인덱스는 라벨 레일(AboutRail)로 바뀌었다. 상세 내부는 lg부터 12칸
// 6줄 격자를 쓰고, 그 미만에서는 4칸으로 줄여 세로로 쌓는다(Task 7).
export default function AboutSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section
      id={SECTION_IDS.ABOUT}
      aria-labelledby="about-heading"
      className="flex flex-col lg:h-full lg:flex-row"
    >
      {/* about-heading: 섹션 aria-labelledby가 참조하는 시각적으로 숨긴
          제목. AboutRail은 라벨 레일 자체만 그리므로 여기서 섹션 이름을
          별도로 붙잡아 둔다. */}
      <h2 id="about-heading" className="sr-only">
        About
      </h2>
      <AboutRail activeIndex={activeIndex} onSelect={setActiveIndex} />

      {/* 상세 3개: 전부 DOM에 상주한다. 활성 하나만 보이고 나머지는 inert.
          .section-hidden과 같은 방식(opacity + pointer-events)으로 감춘다.
          활성 하나만 렌더하면 계획 2가 고친 SEO 조건부 렌더 결함을 이
          레벨에서 재생산한다.

          lg 미만에서는 활성 하나만 흐름 안에 두고 나머지를 absolute로
          빼낸다. 셋 다 absolute로 겹쳐두면(desktop 방식) 부모가 in-flow
          자식을 하나도 못 봐서 자체 높이가 0으로 무너진다(Task 7 조사).
          lg 이상에서는 기존처럼 전부 absolute로 겹쳐 크로스페이드한다. */}
      <div className="relative flex-1 lg:h-full">
        {coreValues.map((value, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={value.id}
              data-detail={index}
              inert={!isActive}
              aria-hidden={!isActive}
              className={`transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:absolute lg:inset-0 ${
                isActive
                  ? 'opacity-100 pointer-events-auto'
                  : 'absolute inset-0 opacity-0 pointer-events-none'
              }`}
            >
              <div
                data-about-grid
                className="grid grid-cols-4 gap-x-4 gap-y-6 px-5 py-6 lg:h-full lg:grid-cols-12 lg:grid-rows-6 lg:gap-x-6 lg:gap-y-2 lg:px-10 lg:py-8"
              >
                <h3
                  data-about-title
                  className="col-span-4 col-start-1 text-t3 font-bold leading-tight text-[var(--color-text-primary)] sm:text-t2 lg:col-span-5 lg:col-start-7 lg:row-start-2 lg:self-center lg:text-t1"
                >
                  {value.title}
                </h3>
                <div
                  data-about-evidence
                  className="col-span-4 col-start-1 lg:col-span-4 lg:col-start-7 lg:row-span-2 lg:row-start-3 lg:self-center"
                >
                  {EVIDENCE[index]}
                </div>
                <p
                  data-about-description
                  className="col-span-4 col-start-1 text-t7 leading-relaxed text-[var(--color-text-secondary)] sm:text-t6 lg:col-span-5 lg:col-start-7 lg:row-start-5 lg:self-center"
                >
                  {value.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
