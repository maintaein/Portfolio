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
    <nav aria-label="About 문항" className="relative ml-6 w-32 shrink-0">
      <div aria-hidden="true" className="about-rail-line absolute bottom-8 left-1 top-8" />
      {coreValues.map((value, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={value.id}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={isActive ? 'true' : undefined}
            className="absolute left-0 flex h-11 w-32 items-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
            style={{ top: `${TOP_PERCENT[index]}%` }}
          >
            <span
              aria-hidden="true"
              className={`absolute left-0 ${isActive ? 'about-rail-tick-active' : 'about-rail-tick'}`}
            />
            <span
              className={`absolute left-4 uppercase tracking-[0.14em] ${
                isActive
                  ? 'text-t8 font-bold text-[var(--color-text-primary)]'
                  : 'text-t8 text-[var(--color-text-secondary)]'
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
