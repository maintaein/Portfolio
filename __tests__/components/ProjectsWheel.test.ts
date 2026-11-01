import { describe, expect, it } from 'vitest';
import {
  DRUM_MIN_OPACITY,
  MUTED_ALPHA,
  DRUM_STEP_DEG,
  drumItem,
  swipeOffset,
  swipeTarget,
  SWIPE_DISTANCE_PX,
  SWIPE_FLICK_PX_MS,
  SWIPE_SLOP_PX,
} from '@/components/sections/ProjectsSection/wheel';

// M4 Task 8. 이름 휠은 오른쪽 끝에 붙은 드럼이다. 사용자가 준 기준 그림(왼쪽 끝 드럼)을 좌우로 비춘 것이다.
// 각 이름은 드럼 위의 각도 하나로 자리·크기·납작함·기울기·번짐·투명도가 정해진다.
const ROW = 70;
const COUNT = 6;
const at = (i: number, pos: number) => drumItem(i, pos, COUNT, ROW);

describe('기준 그림에 맞춘 휠', () => {
  it.each([1, 2])('이웃 %i칸의 크기를 거의 그대로 둔다', distance => {
    expect(at(distance, 0).scale).toBeGreaterThanOrEqual(0.95);
  });
  it.each([[1, 1, 1.5], [2, 4, 6]])('%i칸 떨어진 이름을 부드럽게 흐린다', (distance, min, max) => {
    expect(at(distance, 0).blur).toBeGreaterThanOrEqual(min);
    expect(at(distance, 0).blur).toBeLessThanOrEqual(max);
  });
  it('두 칸 떨어진 이름은 10~15도 기울인다', () => {
    expect(at(2, 0).rot).toBeLessThanOrEqual(-10);
    expect(at(2, 0).rot).toBeGreaterThanOrEqual(-15);
  });
  it.each([0, 5])('선택 %i에서 모든 이름의 번짐은 6px 이하다', pos => {
    for (let i = 0; i < COUNT; i += 1) expect(at(i, pos).blur).toBeLessThanOrEqual(6);
  });
  it.each([0, 5])('선택 %i에서 비활성 이름의 실제 알파는 0.15 이상이다', pos => {
    for (let i = 0; i < COUNT; i += 1) {
      if (i !== pos) expect(at(i, pos).opacity * MUTED_ALPHA).toBeGreaterThanOrEqual(0.15);
    }
  });
});

describe('drumItem: 드럼 위의 각도가 배치를 정한다', () => {
  it('고른 이름은 드럼 앞면이다. 기울지 않고 줄지 않고 번지지 않고 가장 왼쪽(프리뷰 쪽)으로 부푼다', () => {
    const front = at(2, 2);
    expect(front.y).toBe(0);
    expect(front.rot).toBe(0);
    expect(front.scale).toBe(1);
    expect(front.scaleY).toBe(1);
    expect(front.blur).toBe(0);
    expect(front.opacity).toBe(1);
    expect(front.x).toBeLessThan(0);
    for (let i = 0; i < COUNT; i += 1) expect(at(i, 2).x, `item ${i}`).toBeGreaterThanOrEqual(front.x);
  });

  it('멀어질수록 오른쪽 끝으로 휘어 들어가고, 작아지고, 납작해지고, 번지고, 흐려진다. 위아래 같다', () => {
    for (const side of [1, -1]) {
      let prev = at(2.5 + side * 0, 2.5);
      for (let k = 1; k <= 2; k += 1) {
        const item = at(2.5 + side * k, 2.5);
        expect(item.x, `x ${side * k}`).toBeGreaterThan(prev.x);
        expect(item.scale, `scale ${side * k}`).toBeLessThan(prev.scale);
        expect(item.scaleY / item.scale, `squash ${side * k}`).toBeLessThan(prev.scaleY / prev.scale);
        expect(item.blur, `blur ${side * k}`).toBeGreaterThan(prev.blur);
        expect(item.opacity, `opacity ${side * k}`).toBeLessThan(prev.opacity);
        expect(Math.abs(item.rot), `rot ${side * k}`).toBeGreaterThan(Math.abs(prev.rot));
        prev = item;
      }
    }
    // 위아래가 거울상이다. 자리와 기울기만 부호가 갈린다
    const up = at(1, 3);
    const down = at(5, 3);
    expect(up.y).toBeCloseTo(-down.y, 6);
    expect(up.rot).toBeCloseTo(-down.rot, 6);
    expect(up.x).toBeCloseTo(down.x, 6);
    expect(up.scale).toBeCloseTo(down.scale, 6);
  });

  it('오른쪽에 붙은 거울상이다: 위 이름은 왼쪽 끝이 들리고(시계 방향, +) 아래 이름은 내려간다(-)', () => {
    expect(at(0, 2).rot).toBeGreaterThan(0);
    expect(at(4, 2).rot).toBeLessThan(0);
    expect(at(0, 2).y).toBeLessThan(0);
    expect(at(4, 2).y).toBeGreaterThan(0);
  });

  it('간격은 드럼 둘레를 따른다: 앞면 가까이는 거의 한 줄, 지평선 쪽으로 갈수록 좁아진다', () => {
    const gap = (k: number) => at(k, 0).y - at(k - 1, 0).y;
    expect(gap(1)).toBeGreaterThan(ROW * 0.95);
    expect(gap(1)).toBeLessThanOrEqual(ROW);
    for (let k = 2; k < COUNT; k += 1) expect(gap(k), `gap ${k}`).toBeLessThan(gap(k - 1));
  });

  it('순환하지 않는다: 첫 프로젝트에서는 위가 비고, 마지막에서는 아래가 빈다', () => {
    for (let i = 1; i < COUNT; i += 1) expect(at(i, 0).y, `item ${i} at first`).toBeGreaterThan(0);
    for (let i = 0; i < COUNT - 1; i += 1) expect(at(i, COUNT - 1).y, `item ${i} at last`).toBeLessThan(0);
    // 가장 먼 이름도 지평선(90도) 앞에 있다. 순환했다면 반대편 한 칸 자리에 있었을 것이다
    expect(at(COUNT - 1, 0).y).toBeGreaterThan(at(1, 0).y * 3);
    expect((COUNT - 1) * DRUM_STEP_DEG).toBeLessThan(90);
  });

  it('가장 먼 이름은 오른쪽 끝(x 0)에 닿고 넘지 않는다. 고른 이름이 그 끝에서 가장 멀다', () => {
    expect(at(COUNT - 1, 0).x).toBeCloseTo(0, 6);
    expect(at(0, COUNT - 1).x).toBeCloseTo(0, 6);
    for (let pos = 0; pos <= COUNT - 1; pos += 0.25) {
      for (let i = 0; i < COUNT; i += 1) expect(at(i, pos).x).toBeLessThanOrEqual(1e-9);
    }
  });

  it('몇 개인지가 정보라 가장 먼 이름도 바닥 투명도 아래로 안 내려간다', () => {
    for (let i = 0; i < COUNT; i += 1) expect(at(i, 0).opacity, `item ${i}`).toBeGreaterThanOrEqual(DRUM_MIN_OPACITY);
    expect(DRUM_MIN_OPACITY).toBeGreaterThanOrEqual(0.12);
  });

  it('돌아가는 도중(소수 자리)에도 이어진다. 정수 사이에서 값이 튀지 않는다', () => {
    const a = at(3, 1.999);
    const b = at(3, 2.001);
    expect(Math.abs(a.y - b.y)).toBeLessThan(1);
    expect(Math.abs(a.rot - b.rot)).toBeLessThan(0.1);
  });

  it('줄 높이를 못 재면 자리는 안 옮기고 거리 표현만 남긴다', () => {
    const item = drumItem(3, 0, COUNT, 0);
    expect(item).toMatchObject({ x: 0, y: 0, rot: 0, scale: 1, scaleY: 1 });
    expect(item.opacity).toBeLessThan(1);
    expect(item.blur).toBeGreaterThan(0);
    expect(Number.isNaN(item.x + item.y + item.rot)).toBe(false);
  });
});

describe('swipeTarget: 모바일 가로 끌기', () => {
  it('왼쪽으로 문턱을 넘겨 끌면 다음, 오른쪽이면 이전 프로젝트다', () => {
    expect(swipeTarget(-SWIPE_DISTANCE_PX, 0, 2, COUNT)).toBe(3);
    expect(swipeTarget(SWIPE_DISTANCE_PX, 0, 2, COUNT)).toBe(1);
  });

  it('문턱 아래의 느린 끌기는 제자리로 돌아간다', () => {
    expect(swipeTarget(-(SWIPE_DISTANCE_PX - 1), 0, 2, COUNT)).toBeNull();
    expect(swipeTarget(SWIPE_DISTANCE_PX - 1, 0.1, 2, COUNT)).toBeNull();
  });

  it('짧아도 같은 방향으로 튕기면 넘어가고, 반대 방향 속도면 안 넘어간다', () => {
    expect(swipeTarget(-(SWIPE_SLOP_PX + 4), -SWIPE_FLICK_PX_MS, 2, COUNT)).toBe(3);
    expect(swipeTarget(SWIPE_SLOP_PX + 4, SWIPE_FLICK_PX_MS, 2, COUNT)).toBe(1);
    expect(swipeTarget(-(SWIPE_SLOP_PX + 4), SWIPE_FLICK_PX_MS, 2, COUNT)).toBeNull();
  });

  it('탭 범위 안의 움직임은 넘기지 않는다(빠르더라도)', () => {
    expect(swipeTarget(-(SWIPE_SLOP_PX - 1), -5, 2, COUNT)).toBeNull();
  });

  it('끝에서는 순환하지 않는다', () => {
    expect(swipeTarget(-200, -2, COUNT - 1, COUNT)).toBeNull();
    expect(swipeTarget(200, 2, 0, COUNT)).toBeNull();
  });
});

describe('swipeOffset: 끄는 동안 따라가는 거리', () => {
  it('넘어갈 곳이 있으면 저항을 받으며 손가락 방향으로 따라간다', () => {
    const o = swipeOffset(-100, 2, COUNT);
    expect(o).toBeLessThan(0);
    expect(o).toBeGreaterThan(-100);
  });

  it('끝에서 바깥으로 끌면 고무줄처럼 더 무겁고 한계가 있다', () => {
    const free = Math.abs(swipeOffset(-100, 2, COUNT));
    const end = Math.abs(swipeOffset(-100, COUNT - 1, COUNT));
    expect(end).toBeGreaterThan(0);
    expect(end).toBeLessThan(free);
    expect(Math.abs(swipeOffset(-2000, COUNT - 1, COUNT))).toBeLessThan(64);
    expect(swipeOffset(100, 0, COUNT)).toBeGreaterThan(0);
    expect(Math.abs(swipeOffset(2000, 0, COUNT))).toBeLessThan(64);
  });
});
