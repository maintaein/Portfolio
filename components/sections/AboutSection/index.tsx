'use client';

import { useState } from 'react';
import { awards, coreValues } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

// 인덱스 레일과 상세 제목이 함께 쓰는 순번 표기. coreValues 길이(3)와 짝을
// 이룬다. 늘어나면 이 배열도 함께 늘려야 한다.
const ORDINALS = ['01', '02', '03'];

// AlphaMail 프로젝트 수상 이력. coreValues[2]의 "Alphamail 프로젝트에서
// 프론트엔드 리더..." 서술을 뒷받침하는 근거로 재사용한다(lib/data/profile.ts).
const alphaMailAward = awards[0];

// 비주얼(Cubes·Orbit·LogoLoop)은 Task 2~4가 채운다. 이 태스크는 구조와
// 텍스트만 세운다. 비주얼 자리는 빈 컨테이너로 남긴다.
export default function AboutSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section
      id={SECTION_IDS.ABOUT}
      aria-labelledby="about-heading"
      className="flex flex-col lg:h-full lg:flex-row"
    >
      {/* 인덱스 레일: lg 이상 좌측 18%, 미만은 상단 가로 레일로 눕는다 */}
      <nav
        aria-label="핵심 가치 목록"
        className="shrink-0 border-b border-[var(--color-hairline)] px-4 py-6 sm:px-6 lg:h-full lg:w-[18%] lg:border-b-0 lg:border-r lg:py-10"
      >
        <h2
          id="about-heading"
          className="mb-4 text-t8 uppercase tracking-[0.3em] text-[var(--color-text-secondary)] lg:mb-8"
        >
          About
        </h2>
        <ol className="flex gap-6 overflow-x-auto lg:flex-col lg:gap-3 lg:overflow-visible">
          {coreValues.map((value, index) => {
            const isActive = index === activeIndex;

            return (
              <li key={value.id} className="shrink-0">
                <button
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => setActiveIndex(index)}
                  className={`flex items-baseline gap-2 whitespace-nowrap border-b pb-2 text-left transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)] lg:whitespace-normal lg:border-b-0 lg:border-l lg:pb-0 lg:pl-4 ${
                    isActive
                      ? 'border-[var(--color-cyan-core)] text-[var(--color-text-primary)]'
                      : 'border-[var(--color-hairline)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  <span aria-hidden="true" className="text-t8 tabular-nums">
                    {ORDINALS[index]}
                  </span>
                  <span className="text-t6 lg:text-t5">{value.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

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

              {/* 본문: lg 이상에서 하단 80%를 비주얼 | 텍스트로 나눈다.
                  Compact는 비주얼 위 / 텍스트 아래의 세로 스택이다. */}
              <div className="flex flex-1 flex-col lg:h-[80%] lg:flex-row">
                {/* 비주얼 자리. 이 태스크에서는 빈 컨테이너. Task 2~4가 채운다 */}
                <div
                  aria-hidden="true"
                  className="aspect-square shrink-0 border-b border-[var(--color-hairline)] lg:aspect-auto lg:h-full lg:w-1/2 lg:border-b-0 lg:border-r"
                />

                <div className="flex-1 px-4 py-6 sm:px-8 lg:w-1/2 lg:overflow-y-auto lg:px-10 lg:py-10">
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
