import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HOME_SECTION_CONFIG, type HomeSectionId } from '@/lib/constants';
import { resolveCurrentSection } from '@/lib/utils/scrollGeometry';

export type OverviewId = 'overview';
export type NavId = OverviewId | HomeSectionId;

export const OVERVIEW: OverviewId = 'overview';

export const NAV_SEQUENCE: readonly NavId[] = [
  OVERVIEW,
  ...HOME_SECTION_CONFIG.map((section) => section.id),
];

export type SectionNavOptions = {
  rootRef: React.RefObject<HTMLElement | null>;
  headerRef: React.RefObject<HTMLElement | null>;
  blocked: boolean;
  reducedMotion: boolean;
  onBeforeNavigate?: () => void;
};

const SCROLL_KEYS = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '];

function readHash(): NavId {
  const hash = window.location.hash.slice(1);
  return NAV_SEQUENCE.includes(hash as NavId) ? hash as NavId : OVERVIEW;
}

export function useSectionNav(options: SectionNavOptions) {
  const [active, setActive] = useState<NavId>(OVERVIEW);
  const [routeResolved, setRouteResolved] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<NavId | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const activeRef = useRef<NavId>(OVERVIEW);
  const transaction = useRef<{ id: NavId; top: number; focus: boolean } | null>(null);
  const frame = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const section = useCallback((id: NavId) => latest.current.rootRef.current?.querySelector<HTMLElement>(`[data-section="${id}"]`), []);
  const headerHeight = useCallback(() => latest.current.headerRef.current?.getBoundingClientRect().height ?? 0, []);
  const documentHeight = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  // 실측 header 높이에 16px 여유를 더한다. scroll-margin-top도 같은 자리에 둔다.
  const targetTop = useCallback((id: NavId) => Math.max(0, Math.min(
    (section(id)?.getBoundingClientRect().top ?? 0) + window.scrollY - headerHeight() - 16,
    Math.max(0, documentHeight() - window.innerHeight)
  )), [section, headerHeight]);
  const current = useCallback(() => resolveCurrentSection({
    sections: NAV_SEQUENCE.flatMap(id => {
      const element = section(id);
      return element ? [{ id, top: element.getBoundingClientRect().top + window.scrollY }] : [];
    }),
    scrollY: window.scrollY, viewportHeight: window.innerHeight, headerHeight: headerHeight(), documentHeight: documentHeight(),
  }), [section, headerHeight]);

  const sample = useCallback(() => {
    frame.current = 0;
    if (latest.current.blocked) return;
    const pending = transaction.current;
    if (pending) {
      if (Math.abs(window.scrollY - pending.top) > 2) return;
      transaction.current = null;
      clearTimeout(timer.current);
      setNavigationTarget(null);
      if (pending.focus) section(pending.id)?.focus({ preventScroll: true });
    }
    const id = current();
    activeRef.current = id;
    setActive(id);
    if (readHash() !== id) window.history.replaceState(window.history.state, '', `#${id}`);
  }, [section, current]);
  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(sample);
  }, [sample]);

  const move = useCallback((id: NavId, focus: boolean, behavior: ScrollBehavior) => {
    clearTimeout(timer.current);
    latest.current.onBeforeNavigate?.();
    const top = targetTop(id);
    transaction.current = { id, top, focus };
    setNavigationTarget(id);
    activeRef.current = id;
    setActive(id);
    window.scrollTo({ top, behavior: latest.current.reducedMotion ? 'auto' : behavior });
    schedule();
    timer.current = setTimeout(() => {
      if (transaction.current?.id !== id) return;
      if (Math.abs(window.scrollY - top) > 2) {
        transaction.current = null;
        setNavigationTarget(null);
      }
      schedule();
    }, 1800);
  }, [targetTop, schedule]);

  const navigate = useCallback((id: NavId, navigationOptions?: { focus?: boolean; behavior?: 'auto' | 'smooth' }) => {
    if (latest.current.blocked) return;
    if (readHash() !== id) window.history.pushState(window.history.state, '', `#${id}`);
    move(id, navigationOptions?.focus ?? true, navigationOptions?.behavior ?? 'smooth');
  }, [move]);

  useLayoutEffect(() => {
    const id = readHash();
    activeRef.current = id;
    setActive(id);
    const type = (performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
    // 새로고침·앞뒤 이동은 브라우저가 복원한 읽기 위치가 이미 그 섹션이면 존중한다.
    if (!((type === 'reload' || type === 'back_forward') && current() === id)) window.scrollTo({ top: targetTop(id), behavior: 'auto' });
    setRouteResolved(true);
  }, [targetTop, current]);

  useEffect(() => {
    // popstate는 브라우저 스크롤 복원보다 먼저 온다. 복원 뒤에 오는 hashchange에서만 판단한다.
    // 모달 항목은 섹션 해시를 공유하므로 hashchange가 없고 스크롤 복원도 스스로 맡는다.
    const onHistory = () => {
      const id = readHash();
      if (id === activeRef.current) return;
      if (current() !== id) return move(id, false, 'auto');
      transaction.current = null;
      clearTimeout(timer.current);
      setNavigationTarget(null);
      activeRef.current = id;
      setActive(id);
    };
    const cancel = (event: Event) => {
      if (!transaction.current) return;
      if (event instanceof KeyboardEvent) {
        const target = event.target;
        if (!SCROLL_KEYS.includes(event.key) ||
          (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      }
      transaction.current = null;
      clearTimeout(timer.current);
      setNavigationTarget(null);
      window.scrollTo({ top: window.scrollY, behavior: 'auto' });
      schedule();
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scrollend', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', onHistory);
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('keydown', cancel);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (latest.current.rootRef.current) observer?.observe(latest.current.rootRef.current);
    if (latest.current.headerRef.current) observer?.observe(latest.current.headerRef.current);
    return () => {
      cancelAnimationFrame(frame.current); frame.current = 0;
      clearTimeout(timer.current); observer?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('scrollend', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', onHistory);
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', cancel);
    };
  }, [move, schedule, current]);

  return { active, routeResolved, navigationTarget, navigate };
}
