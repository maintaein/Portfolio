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
            className="absolute left-0 flex h-11 w-44 items-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
            style={{ top: `${TOP_PERCENT[index]}%` }}
          >
            <span
              aria-hidden="true"
              className={`absolute left-0 ${isActive ? 'about-rail-tick-active' : 'about-rail-tick'}`}
            />
            {/* 리뷰 발견 1: 순번을 11px 회색으로 두면 라벨이 안 보였다는
                브리프 테스트 주석과 실제 코드(text-t8)가 모순됐다. 가독성이
                레일 폭보다 우선이라 활성 t6(15px)·비활성 t7(13px)로
                올리고, 커진 글자가 옆 상세 패널을 침범하지 않도록 레일
                폭도 w-32에서 w-44로 늘렸다. */}
            <span
              className={`absolute left-4 whitespace-nowrap uppercase tracking-[0.14em] ${
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
