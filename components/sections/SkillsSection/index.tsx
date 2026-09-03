'use client';

import { useState, type CSSProperties } from 'react';
import { SECTION_IDS } from '@/lib/constants';
import { skillCategories } from '@/lib/data';
import type { Skill } from '@/types';

// 설명 슬롯 뒤로 Hyperspeed 광선이 지나간다(컨트롤러가 프로덕션 빌드에서
// 실측, SkillsSection이 원래 쓰던 SKILL_INVENTORY_SCRIM과 같은 값이다).
// 전면 카드로 덮지 않고 텍스트 영역 뒤에만 국소 그라데이션을 깐다(브리프
// "배경과 대비" 절, About의 scrim.ts와 같은 처방).
const SKILL_DESCRIPTION_SCRIM =
  'radial-gradient(ellipse at center, rgb(0 0 0 / 0.78) 0%, rgb(0 0 0 / 0.55) 45%, rgb(0 0 0 / 0) 85%)';

// 레인 블록 뒤. 설명 슬롯보다 넓은 면적을 덮으므로 중심을 덜 태우고
// 가장자리를 더 멀리까지 끌어 사각형 티가 나지 않게 한다. 아이콘은 글자와
// 달리 획이 굵어 설명 슬롯만큼 태울 필요가 없다.
const SKILL_LANE_SCRIM =
  'radial-gradient(ellipse at center, rgb(0 0 0 / 0.72) 0%, rgb(0 0 0 / 0.5) 55%, rgb(0 0 0 / 0) 92%)';

const ALL_SKILLS = skillCategories.flatMap((category) => category.skills);
// 기본 설명 슬롯은 React다(브리프 "상호작용" 절).
const DEFAULT_SKILL = ALL_SKILLS.find((skill) => skill.name === 'React')!;

// mask-image 소스. <img>로 쓰면 CSS로 색을 못 바꾸고 JS 번들에 경로 문자열이
// 들어간다. 버튼에 걸어 아이콘 span과 광휘 두 겹이 상속으로 같은 실루엣을
// 읽게 한다. --skill-icon-src는 커스텀 프로퍼티라 style 타입에 없어 캐스팅한다.
function iconMaskStyle(icon: string): CSSProperties {
  return { '--skill-icon-src': `url(/icons-mono/${icon}.svg)` } as CSSProperties;
}

export default function SkillsSection() {
  const [activeSkill, setActiveSkill] = useState<Skill>(DEFAULT_SKILL);
  const [pinnedCategory, setPinnedCategory] = useState<string | null>(null);

  function toggleCategory(label: string) {
    setPinnedCategory((current) => (current === label ? null : label));
  }

  return (
    <section id={SECTION_IDS.SKILLS} className="py-6 lg:py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h2 className="mb-5 text-t2 font-bold uppercase tracking-widest text-[var(--color-text-primary)] lg:mb-6">
          Skills
        </h2>

        {/* 설명 슬롯은 한 번에 기술 하나의 설명만 보여준다(아래). 나머지
            16개의 설명은 인터랙션 전에는 화면 어디에도 텍스트로 없어
            SSR HTML만으로는 크롤러도 스크린리더 사용자도 못 읽는다.
            시각적으로는 숨기되 HTML과 접근성 트리에는 항상 있는 sr-only
            블록으로 17개 전부의 설명을 둔다(SEO 계약, "크롤러는 HTML을
            읽지 Ctrl+F를 쓰지 않는다"). 키보드로 아이콘을 훑지 않아도
            스크린리더 사용자가 전체 목록을 바로 읽을 수 있다는 접근성
            이점도 겸한다. */}
        <div className="sr-only">
          {skillCategories.map((category) => (
            <p key={category.label}>
              {category.label}.{' '}
              {category.skills
                .map(
                  (skill) =>
                    `${skill.name}: ${skill.description}${
                      skill.projects ? ` (${skill.projects})` : ''
                    }`
                )
                .join(' ')}
            </p>
          ))}
        </div>

        {/* 레인 전체 뒤에 스크림 하나. Hyperspeed 광선이 아이콘 사이를
            지나가면 둘 다 빛나는 시안이라 서로 섞여 시인성이 무너진다.
            컨트롤러가 네 방향을 브라우저에서 비교해 확인했다. 글로우를
            키우는 쪽은 오히려 나빠진다. 배경도 같이 밝아지는 게 아니라
            기본과 호버의 차이가 사라지기 때문이다. 겹침 자체를 끊는 것이
            답이다.
            레인마다 따로 깔지 않고 블록 하나에 건다. 레인 길이가 4·7·2·4로
            제각각이라 따로 깔면 가장자리가 들쭉날쭉해진다. */}
        <div className="relative isolate flex flex-col gap-4 lg:gap-3">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-6 -inset-y-4 -z-[1]"
            style={{ background: SKILL_LANE_SCRIM }}
          />
          {skillCategories.map((category) => {
            const dimmed = pinnedCategory !== null && pinnedCategory !== category.label;

            return (
              <div
                key={category.label}
                data-skill-category={category.label}
                data-skill-category-dimmed={dimmed}
                className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-5 ${
                  dimmed ? 'opacity-25' : 'opacity-100'
                }`}
              >
                {/* min-h-11은 44px 터치 타깃이다. 상자만 아래로 늘어나고
                    글자 위치는 sm:pt-2가 그대로 잡고 있어 레인의 광학 정렬은
                    바뀌지 않는다. 레인 높이는 더 큰 아이콘 행이 정하므로
                    배치에도 영향이 없다. */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category.label)}
                  aria-pressed={pinnedCategory === category.label}
                  className="min-h-11 shrink-0 text-left text-t7 font-medium uppercase tracking-widest text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)] sm:w-28 sm:pt-2"
                >
                  {category.label}
                </button>

                <div className="flex flex-wrap gap-x-4 gap-y-3">
                  {category.skills.map((skill) => {
                    const isActive = activeSkill.name === skill.name;

                    return (
                      <button
                        key={skill.name}
                        type="button"
                        data-skill-icon={skill.name}
                        style={iconMaskStyle(skill.icon)}
                        onMouseEnter={() => setActiveSkill(skill)}
                        onFocus={() => setActiveSkill(skill)}
                        onClick={() => setActiveSkill(skill)}
                        className="skill-icon-button flex min-w-11 min-h-11 flex-col items-center gap-1 rounded-md p-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
                      >
                        <span
                          aria-hidden="true"
                          className={`skill-icon ${isActive ? 'skill-icon-active' : ''}`}
                        />
                        <span className="text-t8 leading-none text-[var(--color-text-secondary)]">
                          {skill.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 설명 슬롯. 아이콘 호버·포커스·탭이 이 안의 내용만 바꾼다. 높이를
            고정해 짧은 문구와 긴 문구를 오가도 레이아웃이 흔들리지 않는다
            (브리프 "레이아웃이 흔들리면 안 된다" 절). relative·isolate로
            이 블록만의 쌓임 맥락을 만들어 스크림의 음수 z-index가
            Hyperspeed 배경이나 다른 형제와 뒤섞이지 않게 한다. */}
        <div className="relative isolate mt-6 border-t border-[var(--color-hairline)] pt-4 lg:mt-7 lg:pt-5">
          <div
            data-skill-description-scrim
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-4 -inset-y-3 -z-[1]"
            style={{ background: SKILL_DESCRIPTION_SCRIM }}
          />
          <div
            data-skill-description-slot
            data-active-skill={activeSkill.name}
            className="flex h-36 flex-col justify-center gap-2 lg:h-28"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-t5 font-semibold text-[var(--color-text-primary)]">
                {activeSkill.name}
              </span>
              {activeSkill.projects ? (
                <span className="text-t7 text-[var(--color-text-secondary)]">
                  {activeSkill.projects}
                </span>
              ) : null}
            </div>
            <p className="text-t6 leading-relaxed text-[var(--color-text-primary)]">
              {activeSkill.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
