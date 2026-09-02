'use client';

import { SectionHeader } from '@/components/blocks';
import { SECTION_IDS } from '@/lib/constants';
import { skillLedger, skillInventory } from '@/lib/data';

// Inventory 줄은 화면 아래쪽이라 Hyperspeed 광선이 정확히 그 높이를
// 지나간다(컨트롤러가 프로덕션 빌드 1920x1080에서 실측). 전면 카드로
// 덮지 않고 텍스트 영역 뒤에만 국소 그라데이션을 깐다(브리프 "배경과
// 공존" 절, About의 scrim.ts와 같은 처방). About은 문항마다 세기가 다른
// 스크림 6장이 필요해 별도 파일로 뺐지만 여기는 값이 하나뿐이라 파일을
// 새로 만들지 않고 이름만 붙여 이 컴포넌트 위에 둔다. 평평한 검정이
// 아니라 radial-gradient로 중심만 태우고 가장자리는 0까지 빠져야 광선이
// 잘리지 않고 그대로 흐른다.
const SKILL_INVENTORY_SCRIM =
  'radial-gradient(ellipse at center, rgb(0 0 0 / 0.78) 0%, rgb(0 0 0 / 0.55) 45%, rgb(0 0 0 / 0) 85%)';

// 증거 우선 레저(계획 5 T3). 탭·아이콘 격자·숙련도 막대·hover 툴팁을
// 걷어내고 기술 / 증거 / 연결 프로젝트 3열을 그대로 스캔하게 한다. 문구는
// 디자인 리뷰 D23에서 확정된 값을 lib/data/skills.tsx에서 그대로 가져온다.
export default function SkillsSection() {
  return (
    <section id={SECTION_IDS.SKILLS} className="py-8 lg:py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* 부제를 두지 않는다. 아래 열 머리(기술 / 증거 / 연결 프로젝트)가
            이미 무엇을 보는 화면인지 말하고 있어, "증거를 먼저 스캔하게
            정리했다"처럼 배치를 설명하는 문장은 같은 말을 한 번 더 하면서
            읽을 것만 늘린다. */}
        <SectionHeader title="SKILLS" />

        {/* 핵심 6개. 데스크톱은 12칸 그리드를 3·6·3으로 나눠 기술 / 증거 /
            연결 프로젝트를 한 행에 둔다. 1024px 미만은 같은 의미 순서로
            세로 배치한다(공통 Ledger Rhythm, 디자인 리뷰 D18). */}
        <div className="hidden text-t7 font-medium uppercase tracking-widest text-[var(--color-text-secondary)] lg:grid lg:grid-cols-12 lg:gap-6 lg:pb-2">
          <span className="lg:col-span-3">기술</span>
          <span className="lg:col-span-6">증거</span>
          <span className="lg:col-span-3 lg:text-right">연결 프로젝트</span>
        </div>

        {skillLedger.map((entry) => (
          <div
            key={entry.name}
            data-skill-ledger-entry={entry.name}
            className="flex flex-col gap-2 border-b border-[var(--color-hairline)] py-4 lg:grid lg:grid-cols-12 lg:items-baseline lg:gap-6"
          >
            <span className="text-t4 font-semibold text-[var(--color-text-primary)] lg:col-span-3">
              {entry.name}
            </span>
            <p className="text-t5 text-[var(--color-text-secondary)] lg:col-span-6">
              {entry.evidence}
            </p>
            {/* 프로젝트 이름에는 uppercase를 걸지 않는다. AlphaMail,
                Ttabong, PoseTive처럼 대소문자가 이름의 일부다. 메타 라벨과
                달리 이건 값이다. */}
            <p className="text-t6 text-[var(--color-text-secondary)] lg:col-span-3 lg:text-right">
              {entry.projects}
            </p>
          </div>
        ))}

        {/* Inventory 11개. 설명·숙련도·아이콘 없는 조용한 한 줄 목록이다.
            핵심 6개와 같은 강조나 행 높이를 주지 않는다. relative·isolate로
            이 블록만의 쌓임 맥락을 만들어, 아래 스크림의 음수 z-index가
            Hyperspeed 배경(-z-10)이나 다른 형제와 뒤섞이지 않고 이 두 문단
            바로 뒤에만 머물게 한다. */}
        <div
          data-skill-inventory
          className="relative isolate mt-10 lg:mt-12"
        >
          <div
            data-skill-inventory-scrim
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-4 -inset-y-3 -z-[1]"
            style={{ background: SKILL_INVENTORY_SCRIM }}
          />
          <p className="text-t7 font-medium uppercase tracking-widest text-[var(--color-text-secondary)]">
            Inventory
          </p>
          <p className="mt-3 text-t6 leading-relaxed text-[var(--color-text-secondary)]">
            {skillInventory.join(' · ')}
          </p>
        </div>
      </div>
    </section>
  );
}
