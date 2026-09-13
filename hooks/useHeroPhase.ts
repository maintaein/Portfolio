import { useCallback, useEffect, useRef, useState } from 'react';
import { HERO_SETTLE_MS, HERO_SURGE_MS, type HeroPhase } from '@/lib/constants';

export interface UseHeroPhaseReturn {
  heroPhase: HeroPhase;
  // pending을 끝낸다. animate면 surge로 재생을 시작하고, 아니면(모션 준비
  // 전, reducedMotion, 딥링크) 재생 없이 done으로 굳힌다. pending이 아니면
  // 아무것도 하지 않는다.
  resolveHero: (animate: boolean) => void;
}

/**
 * 첫 진입 hero의 단계 기계(lib/constants.ts의 HeroPhase).
 *
 *   pending ──resolveHero(true)──▶ surge ──HERO_SURGE_MS──▶ settle ──HERO_SETTLE_MS──▶ done
 *      └────resolveHero(false)───────────────────────────────────────────────────────▶ done
 *
 * 최초 overview는 pending으로 배경이 숨어 있고, overview를 처음 떠나는
 * 순간 surge가 되어 배경이 소실점에서 자라며 치솟는다. settle에서 배경이
 * 기본치로 내려가는 동안 셸과 섹션의 지연된 진입이 들어오고, done으로
 * 굳는다. 시간 경과는 CSS 전환이 아니라 벽시계 타이머다. 이 안무는 어떤
 * 요소의 transitionend에도 묶이지 않는 배경 전용 구간이기 때문이다.
 * HomeClient 자신은 setTimeout을 쓰지 않는다는 잠금(HomeClient.test의 SSR
 * 셸 구조)이 있으므로 타이머는 여기 산다.
 */
export function useHeroPhase(): UseHeroPhaseReturn {
  const [heroPhase, setHeroPhaseState] = useState<HeroPhase>('pending');
  // state의 거울. resolveHero가 같은 배치 안에서 두 번 불릴 수 있어(setActive
  // 안의 호출과 딥링크 effect) 아직 커밋되지 않은 state 대신 이걸 본다.
  const heroPhaseRef = useRef<HeroPhase>('pending');
  const setHeroPhase = useCallback((next: HeroPhase) => {
    heroPhaseRef.current = next;
    setHeroPhaseState(next);
  }, []);

  const resolveHero = useCallback(
    (animate: boolean) => {
      if (heroPhaseRef.current !== 'pending') return;
      setHeroPhase(animate ? 'surge' : 'done');
    },
    [setHeroPhase]
  );

  // surge와 settle의 길이. 의존성은 heroPhase 하나뿐이다. 다른 값의 변화로
  // 재실행돼 타이머가 지워지면 surge에 영영 갇힌다.
  useEffect(() => {
    if (heroPhase === 'surge') {
      const timer = setTimeout(() => setHeroPhase('settle'), HERO_SURGE_MS);
      return () => clearTimeout(timer);
    }
    if (heroPhase === 'settle') {
      const timer = setTimeout(() => setHeroPhase('done'), HERO_SETTLE_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [heroPhase, setHeroPhase]);

  return { heroPhase, resolveHero };
}
