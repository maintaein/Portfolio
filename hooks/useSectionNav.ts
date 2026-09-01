import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HOME_SECTION_CONFIG, type HomeSectionId } from '@/lib/constants';

export type OverviewId = 'overview';
export type NavId = OverviewId | HomeSectionId;

export const OVERVIEW: OverviewId = 'overview';

export const NAV_SEQUENCE: readonly NavId[] = [
  OVERVIEW,
  ...HOME_SECTION_CONFIG.map((section) => section.id),
];

function isNavId(value: string): value is NavId {
  return (NAV_SEQUENCE as readonly string[]).includes(value);
}

// URL 해시에서 섹션을 읽는다. 없거나 모르는 값이면 overview.
function readHash(): NavId {
  if (typeof window === 'undefined') return OVERVIEW;
  const raw = window.location.hash.replace('#', '');
  return isNavId(raw) ? raw : OVERVIEW;
}

export interface UseSectionNavReturn {
  active: NavId;
  routeResolved: boolean;
  setActive: (id: NavId) => void;
  goNext: () => void;
  goPrevious: () => void;
  isTransitioning: boolean;
  completeTransition: (id: NavId) => void;
  seen: ReadonlySet<NavId>;
  isSeen: (id: NavId) => boolean;
  entryAnimationTarget: NavId | null;
  sectionTransition: {
    direction: 'forward' | 'backward' | 'none';
    from: NavId | null;
  };
}

export type OnBeforeActiveChange = (from: NavId, to: NavId) => void;

/**
 * 활성 섹션을 소유하는 단일 진실 공급원.
 *
 *   [버튼 클릭 / Tab+Enter / popstate]
 *              │
 *              ▼
 *        setActive(id)
 *              │
 *   ┌──────────┼──────────┬──────────┐
 *   ▼          ▼          ▼          ▼
 *  active   seen 누적   history   (구독자들)
 *
 * 스크롤이 없으므로 IntersectionObserver를 쓰지 않는다.
 * 전 섹션이 항상 DOM에 있고 opacity로만 감춰지는데, IO는 opacity를 무시해
 * 로드 순간 전부 "보인다"고 판정하기 때문이다.
 *
 * @param onBeforeActiveChange 실제 active가 바뀌기 직전에 호출되는 선택적
 *   observer. 훅은 DOM을 모르고 이 값을 그대로 알려줄 뿐이다 — HomeClient가
 *   여기서 워드마크의 Flip.getState()를 찍는다. 동일 id로의 변경(no-op)과
 *   modal-only popstate에는 호출되지 않는다. 최초 해시 hydration도 이 경로를
 *   타지 않으므로 호출되지 않는다. 불안정한 함수 identity가 popstate
 *   리스너를 재등록하지 않도록 최신 값은 ref에만 보관한다.
 */
export function useSectionNav(
  onBeforeActiveChange?: OnBeforeActiveChange
): UseSectionNavReturn {
  const [active, setActiveState] = useState<NavId>(OVERVIEW);
  const [routeResolved, setRouteResolved] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [seen, setSeen] = useState<ReadonlySet<NavId>>(() => new Set<NavId>());
  const [entryAnimationTarget, setEntryAnimationTarget] = useState<NavId | null>(null);
  const [sectionTransition, setSectionTransition] = useState<{
    direction: 'forward' | 'backward' | 'none';
    from: NavId | null;
  }>({ direction: 'none', from: null });
  const activeRef = useRef(active);
  const seenRef = useRef<ReadonlySet<NavId>>(new Set<NavId>());
  const didResolveInitialRouteRef = useRef(false);
  const onBeforeActiveChangeRef = useRef(onBeforeActiveChange);
  activeRef.current = active;
  onBeforeActiveChangeRef.current = onBeforeActiveChange;

  const captureFirstEntry = useCallback((id: NavId) => {
    if (seenRef.current.has(id)) {
      setEntryAnimationTarget(null);
      return;
    }

    const nextSeen = new Set(seenRef.current).add(id);
    seenRef.current = nextSeen;
    setSeen(nextSeen);
    setEntryAnimationTarget(id);
  }, []);

  // 자식 layout effect가 Boot/FLIP/WebGL을 만들기 전에 최초 해시와 진입 대상을
  // 한 commit에서 확정한다. 이 단계 전에는 routeResolved 소비자가 모두 정지한다.
  useLayoutEffect(() => {
    // StrictMode cleanup으로 이 1회성 초기 진입 안무가 다시 실행되지 않도록 가드한다.
    // cleanup을 추가하면 최초 안무가 0회가 되는 회귀가 조용히 재발한다.
    if (didResolveInitialRouteRef.current) return;
    didResolveInitialRouteRef.current = true;

    const fromHash = readHash();
    activeRef.current = fromHash;
    setActiveState(fromHash);
    captureFirstEntry(fromHash);
    setRouteResolved(true);
  }, [captureFirstEntry]);

  // overview가 터널 입구이고 섹션이 더 안쪽이다. NAV_SEQUENCE 순서상 뒤로
  // 가면 전진이다. from은 CSS가 나가는 섹션 하나에만 이탈 애니메이션을
  // 걸기 위한 것이다. 이것 없이 .section-hidden에 걸면 비활성 여섯 개가
  // 전부 뛴다.
  const recordTransition = useCallback((from: NavId, to: NavId) => {
    const fromIndex = NAV_SEQUENCE.indexOf(from);
    const toIndex = NAV_SEQUENCE.indexOf(to);
    setSectionTransition({
      direction: toIndex > fromIndex ? 'forward' : 'backward',
      from,
    });
  }, []);

  const setActive = useCallback((id: NavId) => {
    if (activeRef.current === id) return;

    recordTransition(activeRef.current, id);
    onBeforeActiveChangeRef.current?.(activeRef.current, id);
    activeRef.current = id;
    setActiveState(id);
    setIsTransitioning(true);
    captureFirstEntry(id);
    window.history.pushState(null, '', `#${id}`);
  }, [captureFirstEntry, recordTransition]);

  const completeTransition = useCallback((id: NavId) => {
    // 연타로 목적지가 바뀐 뒤 도착한 과거 transitionend는 무시한다.
    if (activeRef.current !== id) return;
    setIsTransitioning(false);
  }, []);

  const goNext = useCallback(() => {
    const index = NAV_SEQUENCE.indexOf(activeRef.current);
    const next = NAV_SEQUENCE[index + 1];
    if (next) setActive(next);
  }, [setActive]);

  const goPrevious = useCallback(() => {
    const index = NAV_SEQUENCE.indexOf(activeRef.current);
    const previous = NAV_SEQUENCE[index - 1];
    if (previous) setActive(previous);
  }, [setActive]);

  useEffect(() => {
    const onPopState = () => {
      const next = readHash();
      // 계획 5의 ProjectModal은 같은 URL에 modal-only History 항목을 쌓는다.
      // 같은 해시는 섹션 이동이 아니므로 전환·Hyperspeed를 다시 열지 않는다.
      if (activeRef.current === next) return;

      recordTransition(activeRef.current, next);
      onBeforeActiveChangeRef.current?.(activeRef.current, next);
      activeRef.current = next;
      setActiveState(next);
      setIsTransitioning(true);
      captureFirstEntry(next);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [captureFirstEntry, recordTransition]);

  const isSeen = useCallback((id: NavId) => seen.has(id), [seen]);

  return {
    active,
    routeResolved,
    setActive,
    goNext,
    goPrevious,
    isTransitioning,
    completeTransition,
    seen,
    isSeen,
    entryAnimationTarget,
    sectionTransition,
  };
}
