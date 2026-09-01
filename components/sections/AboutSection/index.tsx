'use client';

import { useState } from 'react';
import { awards, coreValues } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import AboutRail from './rail';

// 상세 제목이 쓰는 순번 표기. coreValues 길이(3)와 짝을 이룬다. 늘어나면
// 이 배열도 함께 늘려야 한다.
const ORDINALS = ['01', '02', '03'];

// AlphaMail 프로젝트 수상 이력. coreValues[2]의 "Alphamail 프로젝트에서
// 프론트엔드 리더..." 서술을 뒷받침하는 근거로 재사용한다(lib/data/profile.ts).
const alphaMailAward = awards[0];

// Cubes와 Orbit은 폐기했다. 배경이 이미 있는데 별도 도형을 얹으면 경쟁한다.
// 순번 인덱스는 라벨 레일(AboutRail)로 바뀌었다. 격자는 뒤 태스크가 이 위에
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
      <div className="relative min-h-[640px] flex-1 sm:min-h-[680px] lg:h-full lg:min-h-0">
        {coreValues.map((value, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={value.id}
              data-detail={index}
              inert={!isActive}
              aria-hidden={!isActive}
              className={`absolute inset-0 flex flex-col transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* 제목: lg 이상에서 상단 20% */}
              <div className="flex shrink-0 items-end justify-between gap-4 border-b border-[var(--color-hairline)] px-4 py-4 sm:px-8 lg:h-[20%] lg:px-10 lg:py-0">
                <h3 className="text-t3 font-semibold text-[var(--color-text-primary)] sm:text-t2 lg:text-t1">
                  {value.title}
                </h3>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-t7 tabular-nums text-[var(--color-text-secondary)]"
                >
                  {ORDINALS[index]} / 03
                </span>
              </div>

              {/* 본문: 증거와 설명. lg 이상에서 하단 80%. */}
              <div className="flex flex-1 flex-col px-4 py-6 sm:px-8 lg:h-[80%] lg:overflow-y-auto lg:px-10 lg:py-10">
                {value.imagePlaceholder === 'tech-stack' && (
                  <dl className="mb-6 flex gap-8 sm:gap-12">
                    <div>
                      <dt className="text-t8 uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
                        Tree-shaking
                      </dt>
                      <dd className="text-d3 font-bold text-[var(--color-text-primary)]">91%</dd>
                    </div>
                    <div className="border-l border-[var(--color-hairline)] pl-8 sm:pl-12">
                      <dt className="text-t8 uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
                        렌더링 에러
                      </dt>
                      <dd className="text-d3 font-bold text-[var(--color-text-primary)]">0</dd>
                    </div>
                  </dl>
                )}

                {value.imagePlaceholder === 'ux-focus' && (
                  <div className="mb-6 flex items-center gap-3 font-mono text-t2 text-[var(--color-text-primary)] sm:gap-4 sm:text-t1">
                    <span>Flat</span>
                    <span aria-hidden="true" className="text-[var(--color-cyan-core)]">
                      ↔
                    </span>
                    <span>Compound</span>
                  </div>
                )}

                {value.imagePlaceholder === 'collaboration' && (
                  <dl className="mb-6 grid grid-cols-3 gap-4 font-mono text-t7 sm:gap-8 sm:text-t6">
                    <div>
                      <dt className="tracking-[0.2em] text-[var(--color-text-secondary)]">ROLE</dt>
                      <dd className="mt-1 text-[var(--color-text-primary)]">프론트엔드 리더</dd>
                    </div>
                    <div>
                      <dt className="tracking-[0.2em] text-[var(--color-text-secondary)]">CONVENTION</dt>
                      <dd className="mt-1 text-[var(--color-text-primary)]">git · jira</dd>
                    </div>
                    <div>
                      <dt className="tracking-[0.2em] text-[var(--color-text-secondary)]">ARCHITECTURE</dt>
                      <dd className="mt-1 text-[var(--color-text-primary)]">FSD · Atomic</dd>
                    </div>
                  </dl>
                )}

                <div className="border-t border-[var(--color-hairline)] pt-6">
                  <p className="text-t6 leading-relaxed text-[var(--color-text-secondary)] sm:text-t5">
                    {value.description}
                  </p>
                  {value.imagePlaceholder === 'collaboration' && (
                    <p className="mt-4 text-t7 text-[var(--color-text-secondary)]">
                      {alphaMailAward.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
