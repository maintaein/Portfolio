import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSectionSwipe } from '@/hooks/useSectionSwipe';

interface SwipeHarnessProps {
  onNext: () => void;
  onPrevious: () => void;
}

interface PointerCoordinates {
  clientX: number;
  clientY: number;
  pointerId: number;
  pointerType: string;
}

function SwipeHarness({ onNext, onPrevious }: SwipeHarnessProps) {
  const handlers = useSectionSwipe({ onNext, onPrevious });

  return createElement(
    'div',
    { ...handlers, 'data-testid': 'stage' },
    createElement('button', null, 'Button target'),
    createElement('a', { href: '#target' }, 'Link target'),
    createElement('input', { 'aria-label': 'Input target' }),
    createElement('textarea', { 'aria-label': 'Textarea target' }),
    createElement(
      'select',
      { 'aria-label': 'Select target' },
      createElement('option', null, 'Option')
    ),
    createElement(
      'div',
      { role: 'dialog' },
      createElement('span', { 'data-testid': 'dialog-child' }, 'Dialog child')
    ),
    createElement(
      'div',
      { 'data-section-swipe-ignore': true },
      createElement('span', { 'data-testid': 'ignored-child' }, 'Ignored child')
    )
  );
}

function firePointer(
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

function swipe(
  target: Element,
  stage: Element,
  start: Omit<PointerCoordinates, 'pointerType'>,
  end: Pick<PointerCoordinates, 'clientX' | 'clientY'>,
  pointerType = 'touch'
) {
  firePointer(target, 'pointerdown', { ...start, pointerType });
  firePointer(stage, 'pointerup', { ...end, pointerId: start.pointerId, pointerType });
}

function renderHarness() {
  const onNext = vi.fn();
  const onPrevious = vi.fn();
  render(createElement(SwipeHarness, { onNext, onPrevious }));

  return {
    onNext,
    onPrevious,
    stage: screen.getByTestId('stage'),
  };
}

describe('useSectionSwipe', () => {
  it('64px 이상 왼쪽 touch 스와이프가 onNext를 한 번 호출한다', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const { onNext, onPrevious, stage } = renderHarness();

    swipe(
      stage,
      stage,
      { clientX: 200, clientY: 200, pointerId: 1 },
      { clientX: 120, clientY: 205 },
      'mouse'
    );
    expect(onNext).not.toHaveBeenCalled();

    swipe(
      stage,
      stage,
      { clientX: 200, clientY: 200, pointerId: 2 },
      { clientX: 120, clientY: 205 }
    );
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('64px 이상 오른쪽 스와이프가 onPrevious를 한 번 호출한다', () => {
    const { onNext, onPrevious, stage } = renderHarness();

    swipe(
      stage,
      stage,
      { clientX: 120, clientY: 200, pointerId: 3 },
      { clientX: 200, clientY: 195 }
    );

    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('수직 이동이 우세하면 no-op이고 같은 fixture의 수평 이동은 동작한다', () => {
    const { onNext, stage } = renderHarness();

    swipe(
      stage,
      stage,
      { clientX: 200, clientY: 200, pointerId: 4 },
      { clientX: 130, clientY: 300 }
    );
    expect(onNext).not.toHaveBeenCalled();

    swipe(
      stage,
      stage,
      { clientX: 200, clientY: 200, pointerId: 5 },
      { clientX: 130, clientY: 205 }
    );
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('축 우세 비율 1.25의 51px/52px 경계를 구분한다', () => {
    const { onNext, stage } = renderHarness();

    swipe(
      stage,
      stage,
      { clientX: 200, clientY: 200, pointerId: 50 },
      { clientX: 136, clientY: 251 }
    );
    expect(onNext).toHaveBeenCalledOnce();

    swipe(
      stage,
      stage,
      { clientX: 200, clientY: 200, pointerId: 51 },
      { clientX: 136, clientY: 252 }
    );
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('64px 임계 거리 미만이면 no-op이고 경계값에서는 동작한다', () => {
    const { onNext, stage } = renderHarness();

    swipe(
      stage,
      stage,
      { clientX: 200, clientY: 200, pointerId: 6 },
      { clientX: 137, clientY: 200 }
    );
    expect(onNext).not.toHaveBeenCalled();

    swipe(
      stage,
      stage,
      { clientX: 200, clientY: 200, pointerId: 7 },
      { clientX: 136, clientY: 200 }
    );
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('좌우 24px 안에서 시작하면 no-op이고 내부 시작점에서는 동작한다', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
    const { onNext, onPrevious, stage } = renderHarness();

    swipe(
      stage,
      stage,
      { clientX: 24, clientY: 200, pointerId: 8 },
      { clientX: 104, clientY: 200 }
    );
    swipe(
      stage,
      stage,
      { clientX: 376, clientY: 200, pointerId: 9 },
      { clientX: 296, clientY: 200 }
    );
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrevious).not.toHaveBeenCalled();

    swipe(
      stage,
      stage,
      { clientX: 200, clientY: 200, pointerId: 10 },
      { clientX: 120, clientY: 200 }
    );
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('무시 대상 내부·pointercancel·다른 pointer id는 no-op이며 각각 양성 대조가 동작한다', () => {
    const { onNext, stage } = renderHarness();
    const ignoredTargets = [
      screen.getByRole('button', { name: 'Button target' }),
      screen.getByRole('link', { name: 'Link target' }),
      screen.getByRole('textbox', { name: 'Input target' }),
      screen.getByRole('textbox', { name: 'Textarea target' }),
      screen.getByRole('combobox', { name: 'Select target' }),
      screen.getByTestId('dialog-child'),
      screen.getByTestId('ignored-child'),
    ];

    let expectedPositiveCalls = 0;
    ignoredTargets.forEach((target, index) => {
      swipe(
        target,
        stage,
        { clientX: 200, clientY: 200, pointerId: 20 + index * 2 },
        { clientX: 120, clientY: 200 }
      );
      expect(onNext).toHaveBeenCalledTimes(expectedPositiveCalls);

      swipe(
        stage,
        stage,
        { clientX: 200, clientY: 200, pointerId: 21 + index * 2 },
        { clientX: 120, clientY: 200 }
      );
      expectedPositiveCalls += 1;
      expect(onNext).toHaveBeenCalledTimes(expectedPositiveCalls);
    });

    firePointer(stage, 'pointerdown', {
      clientX: 200,
      clientY: 200,
      pointerId: 40,
      pointerType: 'touch',
    });
    firePointer(stage, 'pointercancel', {
      clientX: 200,
      clientY: 200,
      pointerId: 40,
      pointerType: 'touch',
    });
    firePointer(stage, 'pointerup', {
      clientX: 120,
      clientY: 200,
      pointerId: 40,
      pointerType: 'touch',
    });
    expect(onNext).toHaveBeenCalledTimes(expectedPositiveCalls);

    firePointer(stage, 'pointerdown', {
      clientX: 200,
      clientY: 200,
      pointerId: 41,
      pointerType: 'touch',
    });
    firePointer(stage, 'pointerup', {
      clientX: 120,
      clientY: 200,
      pointerId: 42,
      pointerType: 'touch',
    });
    expect(onNext).toHaveBeenCalledTimes(expectedPositiveCalls);

    swipe(
      stage,
      stage,
      { clientX: 200, clientY: 200, pointerId: 43 },
      { clientX: 120, clientY: 200 }
    );
    expect(onNext).toHaveBeenCalledTimes(expectedPositiveCalls + 1);
  });

  it('pointerup 뒤 상태를 초기화해 같은 pointer id의 추가 pointerup을 무시한다', () => {
    const { onNext, stage } = renderHarness();

    firePointer(stage, 'pointerdown', {
      clientX: 200,
      clientY: 200,
      pointerId: 52,
      pointerType: 'touch',
    });
    firePointer(stage, 'pointerup', {
      clientX: 120,
      clientY: 200,
      pointerId: 52,
      pointerType: 'touch',
    });
    expect(onNext).toHaveBeenCalledOnce();

    firePointer(stage, 'pointerup', {
      clientX: 120,
      clientY: 200,
      pointerId: 52,
      pointerType: 'touch',
    });
    expect(onNext).toHaveBeenCalledOnce();
  });
});
