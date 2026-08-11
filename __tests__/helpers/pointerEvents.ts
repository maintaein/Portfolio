import { fireEvent } from '@testing-library/react';

export interface PointerCoordinates {
  clientX: number;
  clientY: number;
  pointerId: number;
  pointerType: string;
}

export function firePointer(
  target: Element,
  type: 'pointerdown' | 'pointerup' | 'pointercancel',
  coordinates: PointerCoordinates
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: coordinates.clientX },
    clientY: { value: coordinates.clientY },
    pointerId: { value: coordinates.pointerId },
    pointerType: { value: coordinates.pointerType },
  });
  fireEvent(target, event);
}
