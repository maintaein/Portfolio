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

const documentHeight = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
const clampTop = (top: number) => Math.max(0, Math.min(top, Math.max(0, documentHeight() - window.innerHeight)));
// Next 필드와 projectModalId를 지키려고 항목 state는 언제나 펼쳐서 덮는다.
const saveScroll = () => window.history.replaceState({ ...window.history.state, sectionScrollY: window.scrollY }, '');
const savedScroll = (): number | null => {
  const saved = window.history.state?.sectionScrollY;
  return Number.isFinite(saved) ? saved : null;
};

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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const section = useCallback((id: NavId) => latest.current.rootRef.current?.querySelector<HTMLElement>(`[data-section="${id}"]`), []);
  const headerHeight = useCallback(() => latest.current.headerRef.current?.getBoundingClientRect().height ?? 0, []);
  // 실측 header 높이에 16px 여유를 더한다. scroll-margin-top도 같은 자리에 둔다.
  const targetTop = useCallback((id: NavId) => clampTop(
    (section(id)?.getBoundingClientRect().top ?? 0) + window.scrollY - headerHeight() - 16
  ), [section, headerHeight]);
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
    // Safari는 짧은 시간에 replaceState가 몰리면 던진다. 스크롤이 멎은 뒤 한 번만 저장한다.
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveScroll, 200);
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
    if (readHash() !== id) {
      clearTimeout(saveTimer.current);
      saveScroll();
      // 새 항목은 떠나는 항목의 위치를 물려받지 않는다. 도착 뒤 저장이 채운다.
      window.history.pushState({ ...window.history.state, sectionScrollY: null }, '', `#${id}`);
    }
    move(id, navigationOptions?.focus ?? true, navigationOptions?.behavior ?? 'smooth');
  }, [move]);

  useLayoutEffect(() => {
    const id = readHash();
    activeRef.current = id;
    setActive(id);
    const type = (performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
    const restoring = type === 'reload' || type === 'back_forward';
    const saved = savedScroll();
    // 새로고침·앞뒤 이동은 저장한 읽기 위치로 간다. 없으면 이미 그 섹션인 위치를 존중한다.
    if (restoring && saved !== null) window.scrollTo({ top: clampTop(saved), behavior: 'auto' });
    else if (!(restoring && current() === id)) window.scrollTo({ top: targetTop(id), behavior: 'auto' });
    setRouteResolved(true);
  }, [targetTop, current]);

  useEffect(() => {
    // 판단은 hashchange에서만 한다. popstate는 지연 저장을 끊을 뿐 위치를 건드리지 않는다.
    // 모달 항목은 섹션 해시를 공유하므로 hashchange가 없고, body 잠금이라 스크롤도 그대로다.
    // 복원이 manual이라 저장한 위치는 직접 돌려놓는다. 저장이 없으면 앵커가 만든 새 항목이다.
    const onHistory = () => {
      const id = readHash();
      const saved = savedScroll();
      if (saved === null && id === activeRef.current) return;
      if (saved !== null) window.scrollTo({ top: clampTop(saved), behavior: 'auto' });
      else if (current() !== id) return move(id, false, 'auto');
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
    const restoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    // 떠나는 항목의 지연 저장이 새 항목에 옛 위치를 쓰지 않게 이동 순간에 끊는다.
    const dropSave = () => clearTimeout(saveTimer.current);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scrollend', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', onHistory);
    window.addEventListener('popstate', dropSave);
    window.addEventListener('pagehide', saveScroll);
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('keydown', cancel);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (latest.current.rootRef.current) observer?.observe(latest.current.rootRef.current);
    if (latest.current.headerRef.current) observer?.observe(latest.current.headerRef.current);
    return () => {
      cancelAnimationFrame(frame.current); frame.current = 0;
      clearTimeout(timer.current); clearTimeout(saveTimer.current); observer?.disconnect();
      window.history.scrollRestoration = restoration;
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('scrollend', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', onHistory);
      window.removeEventListener('popstate', dropSave);
      window.removeEventListener('pagehide', saveScroll);
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', cancel);
    };
  }, [move, schedule, current]);

  return { active, routeResolved, navigationTarget, navigate };
}
