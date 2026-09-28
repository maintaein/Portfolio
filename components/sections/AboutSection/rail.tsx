'use client';

import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

import { coreValues } from '@/lib/data';

export interface AboutRailProps {
  activeIndex: number;
  onSelect: (index: number) => void;
  active?: boolean;
  reducedMotion?: boolean;
}

// 세로 위치가 곧 깊이다. 위가 멀고 아래가 가깝다. 굵은 눈금이 내려가면
// 터널 안으로 들어간 것이다.
const TOP_PERCENT = [20, 46, 72];

// lg부터 레일을 오른쪽으로 더 들인다. 왼쪽 끝에 붙어 있으면 화면
// 가장자리와 선이 한 덩어리로 읽히고, 선과 상세 콘텐츠(격자 7칸째) 사이에
// 생기는 빈 칸이 시각 증거(폴더·링)의 자리다. lg 미만은 그대로 둔다.
// 거기서는 버튼이 흐름 안에 세로로 쌓여서 왼쪽 여백을 더 주면 라벨만
// 좁아진다.
export default function AboutRail({
  activeIndex,
  onSelect,
  active = true,
  reducedMotion = false,
}: AboutRailProps) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const previousIndex = useRef<number | null>(null);
  const motionRef = useRef<gsap.core.Timeline | null>(null);
  const flowRef = useRef({ head: 0, tail: 0 });

  useLayoutEffect(() => {
    if (!active) {
      previousIndex.current = null;
      return;
    }
    const marker = markerRef.current;
    const button = buttonsRef.current[activeIndex];
    if (!marker || !button) return;

    const center = () => button.offsetTop + button.offsetHeight / 2;
    const target = center();
    motionRef.current?.kill();
    const flow = flowRef.current;
    const draw = () => {
      gsap.set(marker, {
        top: (flow.head + flow.tail) / 2,
        height: Math.abs(flow.head - flow.tail) + 24,
      });
    };
    if (
      previousIndex.current === null ||
      reducedMotion ||
      (flow.head === target && flow.tail === target)
    ) {
      flow.head = target;
      flow.tail = target;
      draw();
    } else {
      motionRef.current = gsap
        .timeline()
        .to(flow, { head: target, duration: 0.55, ease: 'power2.inOut', onUpdate: draw }, 0)
        .to(flow, { tail: target, duration: 0.55, ease: 'power2.inOut', onUpdate: draw }, 0.12);
    }
    previousIndex.current = activeIndex;

    const onResize = () => {
      motionRef.current?.kill();
      flow.head = center();
      flow.tail = flow.head;
      draw();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      motionRef.current?.kill();
    };
  }, [active, activeIndex, reducedMotion]);

  return (
    <nav aria-label="About 문항" className="relative ml-6 w-44 shrink-0 lg:ml-24">
      <div
        aria-hidden="true"
        className="about-rail-line absolute bottom-[22px] left-1 top-[22px] lg:bottom-8 lg:top-8"
      />
      <span
        ref={markerRef}
        data-about-rail-marker
        aria-hidden="true"
        className="about-rail-tick-active about-rail-marker"
      />
      {coreValues.map((value, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={value.id}
            ref={(button) => {
              buttonsRef.current[index] = button;
            }}
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
              className="about-rail-tick relative left-[4px] lg:absolute lg:left-[4px]"
            />
            {/* 리뷰 발견 1: 순번을 11px 회색으로 두면 라벨이 안 보였다는
                브리프 테스트 주석과 실제 코드(text-t8)가 모순됐다. 가독성이
                레일 폭보다 우선이라 활성 t6(15px)·비활성 t7(13px)로
                올리고, 커진 글자가 옆 상세 패널을 침범하지 않도록 레일
                폭도 w-32에서 w-44로 늘렸다. */}
            <span
              className={`about-rail-label whitespace-nowrap uppercase tracking-[0.14em] lg:absolute lg:left-4 ${
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
