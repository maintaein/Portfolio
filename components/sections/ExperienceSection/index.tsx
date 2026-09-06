'use client';

import type { CSSProperties } from 'react';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

// 마스크 원본 크기. 슬롯 높이를 44px로 고정하고 폭은 여기서 비율로
// 계산한다. contain 마스크는 폭이 남으면 그만큼 죽은 여백을 만들 뿐이라,
// 정사각 타일에 넣으면 4:1 워드마크가 11px까지 줄어 읽히지 않는다.
const LOGO_HEIGHT = 44;
const LOGO_MAX_WIDTH = 120;
const LOGOS: Record<string, { file: string; width: number; height: number }> = {
  FASOO: { file: 'fasoo', width: 428, height: 104 },
  SSAFY: { file: 'ssafy', width: 184, height: 145 },
  KUA: { file: 'kua', width: 216, height: 176 },
};

// 노드 한 칸의 폭. 896px(max-w-4xl) 안에서 두 칸이 온전히 보이고 세 번째
// 칸이 살짝 걸쳐 보여야 가로로 더 있다는 것이 읽힌다.
const NODE_WIDTH = 'clamp(280px, 76vw, 380px)';

function logoStyle(logo: string): CSSProperties {
  const { file, width, height } = LOGOS[logo];
  return {
    '--org-logo-src': `url(/logos-mono/${file}.png)`,
    width: Math.min(LOGO_MAX_WIDTH, Math.round((LOGO_HEIGHT * width) / height)),
  } as CSSProperties;
}

export default function ExperienceSection() {
  return (
    <section id={SECTION_IDS.EXPERIENCE} className="py-6 lg:py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h2 className="mb-5 text-t2 font-bold uppercase tracking-widest text-[var(--color-text-primary)] lg:mb-6">
          Experience
        </h2>

        {/* data-section-swipe-ignore가 없으면 useSectionSwipe가 가로 스와이프를
            먼저 집어 삼켜 섹션이 넘어간다. tabIndex는 스크롤 컨테이너를
            키보드로도 움직이게 한다. */}
        <div
          role="region"
          aria-label="경력 타임라인"
          tabIndex={0}
          data-section-swipe-ignore
          className="section-horizontal-scroll overflow-x-auto pb-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <ol
            className="experience-rail"
            style={{ gridTemplateColumns: `repeat(${experiences.length}, ${NODE_WIDTH})` }}
          >
            <li aria-hidden className="experience-axis" />

            {experiences.map((experience, index) => {
              const current = experience.period.endsWith('현재');

              return (
                <li
                  key={experience.id}
                  data-experience-node={experience.company}
                  data-experience-current={current ? 'true' : undefined}
                  className="experience-node pl-4 pr-8"
                  style={{ gridColumn: index + 1 }}
                >
                  <p
                    data-experience-field="period"
                    className="flex items-center gap-2 text-t7 font-medium uppercase tracking-widest text-[var(--color-text-secondary)]"
                  >
                    {experience.period}
                    {current && (
                      <span className="text-[var(--color-cyan-hi)]">CURRENT</span>
                    )}
                  </p>

                  <div
                    data-experience-field="company"
                    className="mt-2 flex items-center gap-3"
                  >
                    <span
                      aria-hidden
                      data-experience-logo
                      className="org-logo shrink-0"
                      style={logoStyle(experience.logo ?? 'FASOO')}
                    />
                    <h3 className="text-t5 font-semibold text-[var(--color-text-primary)]">
                      {experience.company}
                    </h3>
                  </div>

                  <p
                    data-experience-field="position"
                    className="mt-1 text-t6 text-[var(--color-text-secondary)]"
                  >
                    {experience.position}
                  </p>

                  <ul
                    data-experience-field="responsibilities"
                    className="mt-3 space-y-1.5 border-t border-[var(--color-hairline)] pt-3"
                  >
                    {experience.responsibilities.map((item) => (
                      <li
                        key={item}
                        className="text-t6 leading-relaxed text-[var(--color-text-secondary)]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>

                  <ul data-experience-field="skills" className="mt-3 flex flex-wrap gap-1.5">
                    {(experience.skills ?? []).map((skill) => (
                      <li
                        key={skill}
                        className="border border-[var(--color-hairline)] px-2 py-0.5 text-t8 text-[var(--color-text-secondary)]"
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
      </div>
    </section>
  );
}
