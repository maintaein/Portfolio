'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap, registerGsap, SITE_EASE } from '@/lib/gsap';
import { cn } from '@/lib/utils/cn';

interface SectionHeaderProps {
  /** 1부터 센다. 화면에는 2자리로 채워 찍는다. */
  current: number;
  total: number;
  /** 이미 대문자로 받는다. 여기서는 대소문자를 바꾸지 않는다. */
  label: string;
  /** 표시할 전문. 'NEXT · PROJECTS' / 'EMAIL' / 'COPIED' / 'SELECT EMAIL' */
  actionLabel: string;
  onAction: () => void;
  motionReady: boolean;
  reducedMotion: boolean;
  className?: string;
}

const TICK_BASE_HEIGHT = 6;
const TICK_LIT_HEIGHT = 10;
const CURSOR_BASE_WIDTH = 2;
const CURSOR_STRETCH_WIDTH = 5;

export default function SectionHeader({
  current,
  total,
  label,
  actionLabel,
  onAction,
  motionReady,
  reducedMotion,
  className,
}: SectionHeaderProps) {
  const cursorRef = useRef<HTMLSpanElement>(null);
  const tickRefs = useRef<Array<HTMLSpanElement | null>>([]);
  // 타임라인 하나가 아니라 개별 트윈 여러 개다. 클린업 때 전부 죽인다.
  const activeTweensRef = useRef<gsap.core.Tween[]>([]);
  // 마지막으로 그린 인덱스(0부터). 다음 렌더에서 "출발"로 쓴다.
  const prevIndexRef = useRef(current - 1);
  const mountedRef = useRef(false);
  // NEXT 미리보기 하나만 필요하다. 마우스 호버와 키보드 포커스가 같은 값을 쓴다.
  const [previewing, setPreviewing] = useState(false);

  const progressPct = total > 1 ? ((current - 1) / (total - 1)) * 100 : 0;
  const hasNext = current < total;
  // 0부터 센 목적지 눈금. 마지막 섹션에는 다음 눈금이 없다.
  const previewTickIndex = hasNext ? current : -1;

  useEffect(() => {
    registerGsap();
  }, []);

  useEffect(() => {
    const cursor = cursorRef.current;
    activeTweensRef.current.forEach((tween) => tween.kill());
    activeTweensRef.current = [];
    if (!cursor) return undefined;

    const fromIndex = prevIndexRef.current;
    const toIndex = current - 1;
    prevIndexRef.current = toIndex;

    // 최초 마운트는 이동이 아니라 배치다. 애니메이션할 "이전 자리"가 없다.
    const isFirstRun = !mountedRef.current;
    mountedRef.current = true;

    if (isFirstRun || reducedMotion || !motionReady) {
      gsap.set(cursor, { left: `${progressPct}%`, width: CURSOR_BASE_WIDTH });
      return undefined;
    }

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const passingTicks: HTMLSpanElement[] = [];
    for (let i = start + 1; i < end; i += 1) {
      const tick = tickRefs.current[i];
      if (tick) passingTicks.push(tick);
    }

    // 타임라인 대신 delay로 위치를 준다. 트윈마다 duration + delay를 합쳐도
    // 0.5초를 넘지 않게 맞춘다. 아래 tween들이 그 예산 안의 배치다.
    const tweens: gsap.core.Tween[] = [];

    // 이동 자체가 예산 0.5초의 기준선이다. 몇 칸을 건너뛰어도 이 한 트윈뿐이다.
    tweens.push(gsap.to(cursor, { left: `${progressPct}%`, duration: 0.5, ease: SITE_EASE }));
    // 진행 방향으로 살짝 늘어났다가 도착 전에 제자리로 돌아온다.
    tweens.push(gsap.to(cursor, { width: CURSOR_STRETCH_WIDTH, duration: 0.18, ease: 'power1.out' }));
    tweens.push(
      gsap.to(cursor, { width: CURSOR_BASE_WIDTH, duration: 0.22, ease: 'power1.in', delay: 0.28 })
    );

    if (passingTicks.length > 0) {
      const stagger = 0.5 / (passingTicks.length + 2);
      tweens.push(
        gsap.to(passingTicks, {
          height: TICK_LIT_HEIGHT,
          opacity: 1,
          duration: 0.16,
          ease: 'power1.out',
          stagger,
        })
      );
      tweens.push(
        gsap.to(passingTicks, {
          height: TICK_BASE_HEIGHT,
          opacity: 0.35,
          duration: 0.16,
          ease: 'power1.in',
          stagger,
          delay: 0.3,
        })
      );
    }

    activeTweensRef.current = tweens;

    return () => {
      tweens.forEach((tween) => tween.kill());
    };
  }, [current, progressPct, motionReady, reducedMotion]);

  const paddedCurrent = String(current).padStart(2, '0');
  const paddedTotal = String(total).padStart(2, '0');

  // 가운데 트랙의 폭은 라벨과 액션 문구 길이에 흔들리면 안 된다. 한 줄
  // flex로 두면 좌우 칸이 글자 폭을 따라 늘고 줄어서, 섹션을 옮길 때마다
  // 눈금 전체가 옆으로 밀린다. lg부터는 좌우 칸 폭을 고정한 3열 그리드로
  // 바꿔 트랙의 시작과 끝을 항상 같은 자리에 둔다. lg 미만에서는 트랙
  // 자체를 감추므로 라벨과 액션 두 칸만 남고, 그 둘을 양 끝에 붙인다.
  return (
    <div
      role="group"
      aria-label="섹션 진행도"
      className={cn(
        'flex h-8 items-center justify-between gap-4 text-t8 tracking-[0.08em] text-[var(--color-text-secondary)] lg:grid lg:grid-cols-[13rem_1fr_13rem] lg:justify-normal',
        className
      )}
    >
      <p className="shrink-0 whitespace-nowrap">
        <span className="text-[var(--color-text-primary)]">
          {paddedCurrent}/{paddedTotal}
        </span>{' '}
        <span>{label}</span>
      </p>

      {/* 순수 장식. 상단 내비게이션과 중복 탐색을 만들지 않도록 인터랙티브
          요소를 두지 않는다. 위치 정보는 위 01/05 텍스트와 아래 액션
          버튼이 전부 짊어진다. */}
      <div
        aria-hidden="true"
        data-testid="section-rail"
        className="relative hidden h-3 min-w-0 lg:block"
      >
        <span className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[rgb(3_179_195_/_0.35)]" />
        <span
          className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--color-cyan-core)]"
          style={{ width: `${progressPct}%` }}
        />
        {Array.from({ length: total }, (_, index) => {
          const isPreview = previewing && index === previewTickIndex;
          return (
            <span
              key={index}
              ref={(node) => {
                tickRefs.current[index] = node;
              }}
              data-testid="section-rail-tick"
              // height·opacity는 통과 파동(GSAP)과 NEXT 미리보기(CSS transition)가
              // 함께 쓴다. 둘이 동시에 같은 눈금을 건드리는 경우는 드물고,
              // 겹쳐도 결과가 틀리지 않으므로 따로 잠그지 않는다.
              className={cn(
                'absolute top-1/2 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--color-cyan-core)] transition-[height,opacity] duration-300',
                isPreview ? 'opacity-100' : 'opacity-[0.35]'
              )}
              style={{
                left: `${total > 1 ? (index / (total - 1)) * 100 : 0}%`,
                height: isPreview ? TICK_LIT_HEIGHT : TICK_BASE_HEIGHT,
              }}
            />
          );
        })}
        <span
          ref={cursorRef}
          data-testid="section-rail-cursor"
          className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-[var(--color-cyan-hi)]"
          style={{ left: `${progressPct}%` }}
        />
      </div>

      <button
        type="button"
        onClick={onAction}
        onMouseEnter={() => setPreviewing(true)}
        onMouseLeave={() => setPreviewing(false)}
        onFocus={() => setPreviewing(true)}
        onBlur={() => setPreviewing(false)}
        className="flex h-8 shrink-0 items-center uppercase transition-colors duration-300 hover:text-[var(--color-cyan-core)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)] lg:justify-self-end"
      >
        <span className="relative">
          {actionLabel}
          <span
            aria-hidden="true"
            className={cn(
              'absolute bottom-0 left-0 h-px w-full origin-left bg-current transition-transform duration-300',
              previewing ? 'scale-x-100' : 'scale-x-0'
            )}
          />
        </span>
      </button>
    </div>
  );
}
