// components/blocks/Magnet — react-bits Magnet을 START 호버 반응으로 개조한
// 컴포넌트의 단위 테스트. 이동 범위 상한(maxOffsetPx)이 이 개조의 핵심이다
// — 원본에는 없던 안전판이다.
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Magnet from '@/components/blocks/Magnet';

function fireMouseMove(x: number, y: number) {
  act(() => {
    window.dispatchEvent(
      new MouseEvent('mousemove', { clientX: x, clientY: y })
    );
  });
}

function mockRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 100,
      height: 40,
      right: 100,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
      ...rect,
    }) as DOMRect;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Magnet — 이동 범위 제한', () => {
  it('트리거 영역 안의 극단적인 마우스 위치에서도 이동량이 maxOffsetPx를 넘지 않는다 — 뮤테이션 (m)', () => {
    render(
      <Magnet padding={200} magnetStrength={1} maxOffsetPx={8}>
        <button data-testid="target">START</button>
      </Magnet>
    );
    const wrapper = screen.getByTestId('target').parentElement
      ?.parentElement as HTMLElement; // inner div > wrapper div
    mockRect(wrapper, { left: 0, top: 0, width: 100, height: 40 });

    // 트리거 영역은 중심(50,20) ± (width/2+padding) = ±250, 즉 x ∈ [-200,300].
    // 그 경계 바로 안쪽(290)을 짚어 "트리거 영역 안이지만 중심에서 아주 먼"
    // 위치를 만든다 — magnetStrength가 1이라 클램프가 없다면 오프셋이
    // 240px에 달한다.
    fireMouseMove(290, 20);

    const innerDiv = screen.getByTestId('target').parentElement as HTMLElement;
    const match = innerDiv.style.transform.match(
      /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/
    );
    expect(match, 'translate3d 값을 찾지 못했다').not.toBeNull();
    const [, xStr] = match!;
    const x = Number.parseFloat(xStr);
    // 클램프가 정말 걸렸다는 것 자체도 함께 못박는다 — 트리거가 아예 발화
    // 안 해 x가 우연히 0으로 남는 것과 구별한다.
    expect(x).not.toBe(0);

    // 뮤테이션 (m) — maxOffsetPx 클램프를 제거하면 (290-50)/1 = 240에
    // 가까운 값이 나와 FAIL한다.
    expect(Math.abs(x)).toBeLessThanOrEqual(8);
  });
});

describe('Magnet — disabled(reducedMotion) 게이팅', () => {
  it('disabled면 mousemove를 구독하지 않고 이동량은 항상 0이다', () => {
    render(
      <Magnet padding={200} magnetStrength={1} maxOffsetPx={8} disabled>
        <button data-testid="target">START</button>
      </Magnet>
    );
    const wrapper = screen.getByTestId('target').parentElement
      ?.parentElement as HTMLElement;
    mockRect(wrapper, { left: 0, top: 0, width: 100, height: 40 });

    fireMouseMove(400, 20);

    const innerDiv = screen.getByTestId('target').parentElement as HTMLElement;
    expect(innerDiv.style.transform).toBe('translate3d(0px, 0px, 0)');
  });
});

describe('Magnet — 자식을 그대로 렌더한다', () => {
  it('children이 DOM에 그대로 존재한다', () => {
    render(
      <Magnet>
        <button data-testid="target">START</button>
      </Magnet>
    );
    expect(screen.getByTestId('target')).toHaveTextContent('START');
  });
});
