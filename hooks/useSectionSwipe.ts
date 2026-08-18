import { useCallback, useRef, type PointerEventHandler } from 'react';

export const EDGE_GUARD_PX = 24;
export const MIN_SWIPE_DISTANCE_PX = 64;
export const HORIZONTAL_DOMINANCE_RATIO = 1.25;
export const IGNORE_SELECTOR =
  'a, button, input, textarea, select, [role="dialog"], [data-section-swipe-ignore]';

interface SwipeStart {
  pointerId: number;
  clientX: number;
  clientY: number;
}

export interface UseSectionSwipeOptions {
  onNext: () => void;
  onPrevious: () => void;
}

export interface SectionSwipeHandlers {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
}

export function useSectionSwipe({
  onNext,
  onPrevious,
}: UseSectionSwipeOptions): SectionSwipeHandlers {
  // 실기기(Galaxy S25/Chrome)에서 제스처 30/30이 pointercancel로 끝나고
  // pointerup은 0번 왔다 — 브라우저가 스크롤로 제스처를 가져가면 pointerup은
  // 영원히 오지 않는다. 그래서 판정은 pointermove에서 조기에 끝내야 한다.
  // pointerup 경로는 pointermove가 없는 환경(단위 테스트, 일부 브라우저)을
  // 위해 그대로 둔다. 두 경로 모두 startRef를 판정 직후 null로 비워
  // 제스처당 정확히 한 번만 onNext/onPrevious가 불리도록 공유한다.
  const startRef = useRef<SwipeStart | null>(null);

  const onPointerDown = useCallback<PointerEventHandler<HTMLElement>>((event) => {
    startRef.current = null;

    if (event.pointerType !== 'touch') return;
    if (
      event.clientX <= EDGE_GUARD_PX ||
      event.clientX >= window.innerWidth - EDGE_GUARD_PX
    ) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest(IGNORE_SELECTOR)) return;

    startRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }, []);

  // 판정 조건을 만족하면 즉시 onNext/onPrevious를 호출하고 true를 반환한다.
  // 호출자가 true를 받으면 startRef를 비워 같은 제스처의 남은 이벤트가
  // 다시 판정하지 않도록 해야 한다.
  const judge = useCallback(
    (deltaX: number, deltaY: number) => {
      const absoluteX = Math.abs(deltaX);
      const absoluteY = Math.abs(deltaY);

      if (
        absoluteX < MIN_SWIPE_DISTANCE_PX ||
        absoluteX <= absoluteY * HORIZONTAL_DOMINANCE_RATIO
      ) {
        return false;
      }

      if (deltaX < 0) onNext();
      else onPrevious();
      return true;
    },
    [onNext, onPrevious]
  );

  const onPointerMove = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      const start = startRef.current;
      if (
        !start ||
        event.pointerType !== 'touch' ||
        event.pointerId !== start.pointerId
      ) {
        return;
      }

      const judged = judge(
        event.clientX - start.clientX,
        event.clientY - start.clientY
      );
      // pointercancel이 뒤따라도 이 판정은 이미 끝난 것이다 — 취소는
      // "브라우저가 스크롤을 가져갔다"는 뜻이지 스와이프가 없었다는 뜻이
      // 아니다. startRef를 비워 pointerup/pointercancel이 이후에 와도
      // 다시 판정하거나 상태를 되살리지 못하게 한다.
      if (judged) startRef.current = null;
    },
    [judge]
  );

  const onPointerUp = useCallback<PointerEventHandler<HTMLElement>>((event) => {
    const start = startRef.current;
    startRef.current = null;

    if (
      !start ||
      event.pointerType !== 'touch' ||
      event.pointerId !== start.pointerId
    ) {
      return;
    }

    judge(event.clientX - start.clientX, event.clientY - start.clientY);
  }, [judge]);

  const onPointerCancel = useCallback<PointerEventHandler<HTMLElement>>(() => {
    startRef.current = null;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
