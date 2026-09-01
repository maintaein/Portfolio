'use client';

import { coreValues } from '@/lib/data';

export interface AboutRailProps {
  activeIndex: number;
  onSelect: (index: number) => void;
}

// 세로 위치가 곧 깊이다. 위가 멀고 아래가 가깝다. 굵은 눈금이 내려가면
// 터널 안으로 들어간 것이다.
const TOP_PERCENT = [20, 46, 72];

export default function AboutRail({ activeIndex, onSelect }: AboutRailProps) {
  return (
    <nav aria-label="About 문항" className="relative ml-6 w-44 shrink-0">
      <div aria-hidden="true" className="about-rail-line absolute bottom-8 left-1 top-8" />
      {coreValues.map((value, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={value.id}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={isActive ? 'true' : undefined}
            /* lg 미만에서는 top: %가 기준으로 삼을 높이가 없다(레일 자체
               높이가 자식 absolute뿐이라 0으로 무너진다, Task 7 조사).
               버튼을 흐름 안에 두고 세 개를 세로로 쌓아 실제 높이를 만든
               뒤, lg부터 absolute + top: %로 되돌려 깊이 배치를 쓴다. */
            className="flex h-11 w-44 items-center gap-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)] lg:absolute lg:left-0"
            style={{ top: `${TOP_PERCENT[index]}%` }}
          >
            <span
              aria-hidden="true"
              className={`lg:absolute lg:left-0 ${isActive ? 'about-rail-tick-active' : 'about-rail-tick'}`}
            />
            {/* 리뷰 발견 1: 순번을 11px 회색으로 두면 라벨이 안 보였다는
                브리프 테스트 주석과 실제 코드(text-t8)가 모순됐다. 가독성이
                레일 폭보다 우선이라 활성 t6(15px)·비활성 t7(13px)로
                올리고, 커진 글자가 옆 상세 패널을 침범하지 않도록 레일
                폭도 w-32에서 w-44로 늘렸다. */}
            <span
              className={`whitespace-nowrap uppercase tracking-[0.14em] lg:absolute lg:left-4 ${
                isActive
                  ? 'text-t6 font-bold text-[var(--color-text-primary)]'
                  : 'text-t7 text-[var(--color-text-secondary)]'
              }`}
            >
              {value.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
