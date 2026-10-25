'use client';

import { useEffect, useRef, useState, type FocusEvent, type RefObject } from 'react';

const GESTURE_IDLE_MS = 220;
// 끊긴 wheel의 기준. 프레임 간격(16.7ms)이나 합쳐진 wheel 둘(48ms 안팎)보다 길다.
const WHEEL_PAUSE_MS = 56;
// 다시 프레임 간격으로 붙는 wheel. 느리거나 보통 속도로 굴린 마우스 노치는 이보다 길다. 빠르게 튕긴 노치는 10-20ms로 올 수 있다.
const WHEEL_FRAME_MS = 20;

// 공유 로고와 이 섹션의 관계. flying: 이 섹션으로 날아오는 중(잠금을 미룬다), landed: 이 섹션에 내려앉았다(미룬 잠금을 건다),
// away: 다른 자리에 있다(미룬 잠금을 버린다. awayDefers가 없으면 잠금 자체는 막지 않는다).
export type ChapterLogo = 'flying' | 'landed' | 'away';

export interface ChapterLockOptions {
  ref: RefObject<HTMLElement | null>;
  count: number;
  // 지금 고른 index와 index를 고르는 방법. current는 choose 직후에도 새 값을 돌려줘야 한다.
  current: () => number;
  choose: (index: number) => void;
  logo: ChapterLogo;
  // away도 새 잠금을 미룬다. 로고가 다른 자리에서 이 섹션으로 날아올 일이 남아 있는 섹션(Projects)의 것이다.
  awayDefers?: boolean;
  // 한 걸음 뒤 다음 걸음까지의 최소 간격. 섹션의 전환 시간이다.
  stepMs: number;
  disabled: boolean;
  // 명시적 이동 중이거나 모달이 본문을 가리면 새 잠금을 잡지 않는다.
  blocked: boolean;
  // 잠금 자리(start)에서 잠가도 되는지. 없으면 늘 된다. 짧은 화면과 disabled에 더한다.
  fits?: (start: number) => boolean;
  // 정적 모드가 아닐 때 스크롤마다 잠금 자리에서의 거리를 받는다.
  onScroll?: (offset: number) => void;
}

// reading 시안(app/prototypes/about/GestureReading)의 이식이다. 섹션에
// 닿은 제스처 하나가 index 하나를 넘기고, 마지막 index에서 새 제스처가
// 오면 문서 스크롤로 돌려준다. 잠금은 섹션 위에서만 capture wheel·touchmove를
// 막는다. 시안에 있던 "마운트 때 섹션 아래면 섹션으로 되돌린다"는 직접 해시와
// 명시적 이동을 끌어오므로 옮기지 않았다. About에서 Projects와 같이 쓰려고 꺼냈다(M4 Task 7).
export function useChapterLock({ ref, count, current, choose, logo, awayDefers = false, stepMs, disabled: forced, blocked, fits, onScroll }: ChapterLockOptions) {
  const [locked, setLocked] = useState(false);
  const [plain, setPlain] = useState(false);
  // 렌더마다 바뀌는 값은 잠금을 다시 세우지 않고 최신 것을 읽는다.
  const latest = useRef({ count, current, choose, stepMs, fits, onScroll });
  latest.current = { count, current, choose, stepMs, fits, onScroll };
  const selectRef = useRef<(index: number) => void>(() => {});
  const releaseRef = useRef(() => {});
  const enterRef = useRef<(index?: number) => void>(() => {});
  const landedRef = useRef(logo === 'landed' || (logo === 'away' && !awayDefers));
  const landRef = useRef<(apply: boolean) => void>(() => {});
  const offsetRef = useRef<() => number | null>(() => null);
  // 창·탭에 돌아오면 브라우저가 떠날 때 포커스가 있던 요소에 focus를 다시 보낸다(relatedTarget 없음).
  // 사용자가 옮긴 포커스가 아니므로 잠금을 걸지 않는다(M3 N1).
  const refocusRef = useRef<Element | null>(null);
  useEffect(() => {
    // 요소의 blur는 거품이 일지 않아 캡처 없이 단 이 리스너에는 창 자신의 blur만 온다.
    const leave = () => { refocusRef.current = document.activeElement; };
    window.addEventListener('blur', leave);
    return () => window.removeEventListener('blur', leave);
  }, []);
  useEffect(() => {
    landedRef.current = logo === 'landed' || (logo === 'away' && !awayDefers);
    if (logo !== 'flying') landRef.current(logo === 'landed');
  }, [logo, awayDefers]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // matchMedia가 없는 환경(일부 테스트 환경)은 짧은 화면이 아닌 것으로 본다.
    const short = window.matchMedia?.('(max-height: 640px)') ?? null;
    let disabled = false;
    let start = 0;
    let phase: 'before' | 'locked' | 'after' = 'before';
    let lastInput = -Infinity;
    let lastStep = -Infinity;
    let pendingGesture = false;
    let lastWheelTime = -Infinity;
    let lastWheelDelta = 0;
    let lastWheelGap = Infinity;
    let earlierDelta = 0;
    let wheelPeak = 0;
    let wheelTail = false;
    let touchY = 0;
    let touchConsumed = false;
    let lastNativeInput = -Infinity;
    // 문서로 넘긴 키 스크롤이 아직 진행 중일 수 있다. 브라우저의 한 걸음은 아래 .8 화면 추정보다 길고(PageUp 약 .875), 굴러가는 중의
    // 누름은 남은 목표에 더해진다. 그래서 키가 잠금 자리를 넘는지는 실제로 넘은 스크롤 이벤트로 정하고, 다른 입력이 오거나 스크롤이
    // 끝나면(scrollend) 닫는다. 시간 창(350ms)은 느린 프레임에서 그 이벤트를 놓쳤다(Task 8 리뷰).
    let keyPending = false;
    // 로고가 날아가는 동안 미룬 잠금의 index. 없으면 null.
    let held: number | null = null;
    const last = () => latest.current.count - 1;
    const choose = (index: number) => latest.current.choose(index);
    const setPhase = (next: typeof phase) => {
      phase = next;
      setLocked(phase === 'locked');
      window.removeEventListener('wheel', lockedWheel, true);
      window.removeEventListener('touchmove', lockedTouchMove, true);
      if (phase === 'locked' && !disabled) {
        window.addEventListener('wheel', lockedWheel, { passive: false, capture: true });
        window.addEventListener('touchmove', lockedTouchMove, { passive: false, capture: true });
      }
    };
    const measure = () => {
      const wasDisabled = disabled;
      // 헤더 아래 여백은 해시 이동과 같은 scroll-margin-top을 쓴다.
      start = Math.round(window.scrollY + element.getBoundingClientRect().top - (parseFloat(getComputedStyle(element).scrollMarginTop) || 0));
      disabled = forced || !!short?.matches || !(latest.current.fits?.(start) ?? true);
      setPlain(disabled);
      // 정적 모드는 잠금을 들고 가지 않는다. 그동안 읽은 위치를 돌아올 때 끌어오지 않도록 위치로 앞뒤를 정한다.
      if (disabled && phase === 'locked') phase = window.scrollY > start ? 'after' : 'before';
      setPhase(phase);
      if (wasDisabled && !disabled) scroll();
      else if (phase === 'locked' && !disabled) window.scrollTo({ top: start, behavior: 'instant' });
    };
    const lock = (index: number, time: number) => {
      held = landedRef.current ? null : index;
      if (held !== null) return;
      keyPending = false;
      setPhase('locked'); lastInput = time; lastStep = time;
      pendingGesture = false;
      choose(index);
      window.scrollTo({ top: start, behavior: 'instant' });
    };
    // 진입 제스처는 자리만 잡는다. 그 관성은 index를 넘기지 못한다.
    const input = (delta: number, time: number, fresh = false) => {
      if (disabled || blocked || delta === 0) return false;
      lastNativeInput = performance.now();
      if (phase !== 'locked') {
        const y = window.scrollY;
        const entering = phase === 'before' && delta > 0 && y + delta >= start;
        const returning = phase === 'after' && delta < 0 && y >= start && y + delta <= start;
        // 미룬 잠금은 입력을 막지 않는다.
        if (entering || returning) { lock(returning ? last() : 0, time); return held === null; }
        return false;
      }
      const newGesture = fresh || time - lastInput > GESTURE_IDLE_MS;
      lastInput = time;
      pendingGesture ||= newGesture;
      if (!pendingGesture || time - lastStep < latest.current.stepMs) return true;
      pendingGesture = false;
      const next = latest.current.current() + (delta > 0 ? 1 : -1);
      if (next < 0 || next > last()) { setPhase(next < 0 ? 'before' : 'after'); return false; }
      lastStep = time;
      choose(next);
      return true;
    };
    const editable = (target: EventTarget | null) => target instanceof HTMLElement
      && !!target.closest('input, textarea, select, [contenteditable="true"]');
    const wheelInput = (event: WheelEvent) => {
      keyPending = false;
      if (event.ctrlKey || editable(event.target)) return false;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (delta === 0) return false;
      const magnitude = Math.abs(delta);
      const gap = event.timeStamp - lastWheelTime;
      const idle = gap > GESTURE_IDLE_MS;
      // 바쁜 메인 스레드는 wheel 둘을 하나로 합쳐 간격과 크기를 함께 키운다. 앞 간격보다 길어진 만큼만
      // 줄여 비교하면 합쳐진 관성은 새 stroke가 아니고, 크기가 늘 같은 마우스 노치는 간격이 흔들려도 그대로다.
      const comparable = magnitude * (idle ? 1 : Math.min(1, lastWheelGap / gap));
      const reversed = delta * lastWheelDelta < 0;
      // 끊긴 wheel 바로 뒤 프레임은 끊기기 전 크기와도 견준다. 쉬고 완만하게 오르는 새 stroke는 끊기기 전 꼬리보다
      // 커서 보이고, 합쳐진 wheel이나 한 번 끊긴 관성은 끊기기 전 크기 그대로라 보이지 않는다.
      const resumed = lastWheelGap > WHEEL_PAUSE_MS && gap <= WHEEL_FRAME_MS;
      const reference = resumed ? Math.min(Math.abs(lastWheelDelta), earlierDelta) : Math.abs(lastWheelDelta);
      // 트랙패드는 앞 stroke의 관성이 끝나기 전에 새 stroke를 시작할 수 있다.
      const renewed = wheelTail && comparable >= 4 && comparable >= reference * 1.8;
      if (idle || reversed || renewed) {
        wheelPeak = magnitude;
        wheelTail = false;
      } else {
        wheelPeak = Math.max(wheelPeak, magnitude);
        if (magnitude < wheelPeak * .6) wheelTail = true;
      }
      lastWheelTime = event.timeStamp;
      earlierDelta = Math.abs(lastWheelDelta);
      lastWheelDelta = delta;
      lastWheelGap = gap;
      return input(delta, event.timeStamp, reversed || renewed);
    };
    const wheel = (event: WheelEvent) => { if (phase !== 'locked') wheelInput(event); };
    function lockedWheel(event: WheelEvent) {
      if (wheelInput(event) && event.cancelable) event.preventDefault();
    }
    const closeOvershoot = () => { lastNativeInput = -Infinity; keyPending = false; };
    const closeKey = () => { keyPending = false; };
    const key = (event: KeyboardEvent) => {
      closeOvershoot();
      if (editable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.key === ' ' || event.key === 'Enter') && event.target instanceof HTMLElement && event.target.closest('button, a')) return;
      const direction = ['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey) ? 1
        : ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1 : 0;
      if (!direction) return;
      if (event.repeat && phase === 'locked') { event.preventDefault(); return; }
      if (input(direction * window.innerHeight * .8, event.timeStamp, true)) event.preventDefault();
      else keyPending = phase !== 'locked';
    };
    const touchStart = (event: TouchEvent) => { keyPending = false; touchY = event.touches[0]?.clientY ?? 0; touchConsumed = false; };
    const touchInput = (event: TouchEvent, blocking: boolean) => {
      if (event.touches.length !== 1 || editable(event.target)) return;
      const nextY = event.touches[0].clientY;
      const delta = touchY - nextY;
      touchY = nextY;
      if (touchConsumed && phase === 'locked' && !disabled) { if (blocking && event.cancelable) event.preventDefault(); return; }
      if (input(delta, event.timeStamp, true)) {
        touchConsumed = true;
        if (blocking && event.cancelable) event.preventDefault();
      }
    };
    const touchMove = (event: TouchEvent) => { if (phase !== 'locked') touchInput(event, false); };
    function lockedTouchMove(event: TouchEvent) { touchInput(event, true); }
    const scroll = () => {
      if (disabled) return;
      const offset = window.scrollY - start;
      latest.current.onScroll?.(offset);
      // 방금 들어온 제스처의 관성이 넘친 거리만 되돌린다. 넘침은 Chrome의 부드러운 wheel
      // 스크롤 때문에 수백 px까지 간다. 스크롤바는 입력이 없고, History·명시적 이동·다른 키는
      // 이 창을 닫으므로 끌려오지 않는다.
      const overshoot = !blocked && performance.now() - lastNativeInput < 350;
      if ((overshoot || (keyPending && !blocked)) && phase !== 'locked' && (phase === 'before' ? offset > 0 : offset < 0)) {
        lock(phase === 'after' ? last() : 0, performance.now());
        return;
      }
      if (overshoot && phase === 'locked' && Math.abs(offset) > 1) {
        window.scrollTo({ top: start, behavior: 'instant' });
        return;
      }
      if (Math.abs(offset) <= 1) {
        if (phase !== 'locked' && !blocked) {
          if (!landedRef.current) held = phase === 'after' ? last() : 0;
          else { setPhase('locked'); lastInput = -Infinity; lastStep = -Infinity; }
        }
      } else if (phase !== 'locked' || Math.abs(offset) > 2) {
        // 잠금 밖에서는 위치로 앞뒤를 다시 정해 스크롤바로 건너뛴 뒤에도 돌아오는 방향을 안다.
        const next = offset > 0 ? 'after' : 'before';
        if (next !== phase) setPhase(next);
      }
    };
    selectRef.current = index => {
      if (disabled || blocked) { choose(index); return; }
      setPhase('locked'); choose(index); lastStep = performance.now(); lastInput = lastStep; pendingGesture = false;
      window.scrollTo({ top: start, behavior: 'instant' });
    };
    // Tab으로 섹션의 컨트롤에 닿으면 진입 제스처처럼 잠근다. index가 없으면 위에서 오면 처음, 아래에서 오면 마지막이다.
    // 마우스 클릭의 포커스는 거르고 클릭 선택에 맡긴다. 안 그러면 누르는 순간 다른 index로 한 번 넘어간다.
    enterRef.current = index => { if (!disabled && !blocked && phase !== 'locked') lock(index ?? (window.scrollY > start ? last() : 0), performance.now()); };
    // 섹션에 내려앉으면 미룬 잠금을 건다. 다른 자리로 되돌아갔거나 그사이 반 화면 넘게 지나쳤으면 끌어오지 않는다.
    landRef.current = apply => {
      const index = held;
      held = null;
      if (index === null) return;
      if (apply && !disabled && !blocked && phase !== 'locked' && Math.abs(window.scrollY - start) < window.innerHeight / 2) lock(index, performance.now());
      // 버릴 때도 위치로 앞뒤를 정한다(release와 같다). 날아오는 동안 잠금 자리를 지나치면 앞(before)이 남아, 다음 노치가 진입으로 읽혀
      // 반 화면 넘게 떨어진 페이지를 잠금 자리로 끌어왔다(Task 8 리뷰 B1).
      else if (phase !== 'locked') setPhase(window.scrollY > start ? 'after' : 'before');
    };
    // 미룬 잠금을 버릴 때도 위치로 앞뒤를 정한다. 미룬 잠금은 잠금 자리를 지나친 채 앞(before)을 남겨, 같은 stroke의 늦은 wheel이
    // 진입으로 읽혀 처음 index로 잠그고 끌어왔다(Projects의 날아오는 동안 누른 이름, Task 7 수정 1). 미룬 잠금은 로고가 날 때만 생긴다.
    releaseRef.current = () => {
      const dropped = held !== null;
      closeOvershoot(); pendingGesture = false; held = null;
      if (phase === 'locked' || dropped) setPhase(window.scrollY > start ? 'after' : 'before');
    };
    offsetRef.current = () => disabled ? null : window.scrollY - start;
    measure();
    scroll();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    // 위쪽 섹션 높이가 바뀌어도 이 섹션의 문서 위치가 움직이므로 문서 전체를 본다.
    resize?.observe(element);
    resize?.observe(document.documentElement);
    // 글꼴이 준비되면 한 번 더 잰다. 줄 높이가 바뀌어도 관찰하는 상자의 크기는 그대로일 수 있어서다. 레이아웃을 재는 fits를 위한 것이고,
    // 지금 두 섹션(About은 fits 없음, Projects는 화면 폭 media query)에서는 대개 같은 값이 다시 나온다.
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) measure(); });
    window.addEventListener('wheel', wheel, { passive: true, capture: true });
    window.addEventListener('keydown', key);
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchmove', touchMove, { passive: true, capture: true });
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('popstate', closeOvershoot);
    window.addEventListener('pointerdown', closeKey, { passive: true });
    window.addEventListener('scrollend', closeKey);
    window.addEventListener('resize', measure);
    short?.addEventListener('change', measure);
    return () => {
      alive = false;
      resize?.disconnect();
      window.removeEventListener('wheel', lockedWheel, true);
      window.removeEventListener('touchmove', lockedTouchMove, true);
      window.removeEventListener('wheel', wheel, true); window.removeEventListener('keydown', key);
      window.removeEventListener('touchstart', touchStart); window.removeEventListener('touchmove', touchMove, true);
      window.removeEventListener('scroll', scroll); window.removeEventListener('popstate', closeOvershoot); window.removeEventListener('resize', measure);
      window.removeEventListener('pointerdown', closeKey); window.removeEventListener('scrollend', closeKey);
      short?.removeEventListener('change', measure);
      releaseRef.current = () => {};
      enterRef.current = () => {};
      landRef.current = () => {};
      offsetRef.current = () => null;
    };
  }, [ref, forced, blocked]);

  const [actions] = useState(() => ({
    select: (index: number) => selectRef.current(index),
    release: () => releaseRef.current(),
    // 잠금 자리에서의 지금 거리. 정적 모드이거나 잠금이 서기 전이면 null이다.
    offset: () => offsetRef.current(),
    // 섹션 컨트롤의 focus 처리. 창에 돌아와 되돌려 받은 포커스와 마우스 포커스는 잠그지 않는다.
    focus: (event: FocusEvent<Element>, index?: number) => {
      const returned = !event.relatedTarget && event.target === refocusRef.current;
      refocusRef.current = null;
      if (!returned && event.target.matches(':focus-visible')) enterRef.current(index);
    },
  }));
  return { locked, plain, ...actions };
}
