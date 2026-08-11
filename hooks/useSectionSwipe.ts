import { useCallback, useRef, type PointerEventHandler } from 'react';

const EDGE_GUARD_PX = 24;
const MIN_SWIPE_DISTANCE_PX = 64;
const HORIZONTAL_DOMINANCE_RATIO = 1.25;
const IGNORE_SELECTOR =
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
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
}

export function useSectionSwipe({
  onNext,
  onPrevious,
}: UseSectionSwipeOptions): SectionSwipeHandlers {
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

    const deltaX = event.clientX - start.clientX;
    const deltaY = event.clientY - start.clientY;
    const absoluteX = Math.abs(deltaX);
    const absoluteY = Math.abs(deltaY);

    if (
      absoluteX < MIN_SWIPE_DISTANCE_PX ||
      absoluteX <= absoluteY * HORIZONTAL_DOMINANCE_RATIO
    ) {
      return;
    }

    if (deltaX < 0) onNext();
    else onPrevious();
  }, [onNext, onPrevious]);

  const onPointerCancel = useCallback<PointerEventHandler<HTMLElement>>(() => {
    startRef.current = null;
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
}
