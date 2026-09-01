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
// 순번 인덱스는 라벨 레일(AboutRail)로 바뀌었다. 상세 내부는 12칸 6줄
// 격자 한 배치를 쓴다. 데스크톱 전용이고, 반응형 접두사는 뒤 태스크가
// 붙인다.
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
          레벨에서 재생산한다. */}
      <div className="relative flex-1 lg:h-full lg:min-h-0">
        {coreValues.map((value, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={value.id}
              data-detail={index}
              inert={!isActive}
              aria-hidden={!isActive}
              className={`absolute inset-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div
                data-about-grid
                className="grid h-full grid-cols-12 grid-rows-6 gap-x-6 gap-y-2 px-10 py-8"
              >
                <h3
                  data-about-title
                  className="col-span-5 col-start-7 row-start-2 self-center text-t2 font-bold leading-tight text-[var(--color-text-primary)] lg:text-t1"
                >
                  {value.title}
                </h3>
                <div
                  data-about-evidence
                  className="col-span-4 col-start-7 row-span-2 row-start-3 self-center"
                >
                  {EVIDENCE[index]}
                </div>
                <p
                  data-about-description
                  className="col-span-5 col-start-7 row-start-5 self-center text-t6 leading-relaxed text-[var(--color-text-secondary)]"
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
