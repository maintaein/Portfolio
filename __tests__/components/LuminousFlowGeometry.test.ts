import { describe, expect, it } from 'vitest';
import { buildFlowGeometry, type FlowGeometry } from '@/components/blocks/LuminousFlowBackground/geometry';

const numbers = (geometry: FlowGeometry) => [
  geometry.width, geometry.height, geometry.length,
  ...[geometry.center, ...geometry.strands.flat()].flat().flatMap(({ x, y, halfWidth, s }) => [x, y, halfWidth, s]),
];

describe('buildFlowGeometry', () => {
  it('같은 폭에서 문서 높이가 늘어도 에너지 폭의 단위를 늘리지 않는다', () => {
    const a = buildFlowGeometry(1440, 4000);
    const b = buildFlowGeometry(1440, 8000);
    expect(b.center.map(p => p.halfWidth)).toEqual(a.center.map(p => p.halfWidth));
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(a.length);
  });

  it('에너지 폭은 문서 폭과 같은 비율로 바뀐다', () => {
    const wide = buildFlowGeometry(1440, 6000);
    const narrow = buildFlowGeometry(390, 6000);
    narrow.center.forEach((point, index) => expect(point.halfWidth * 1440 / 390).toBeCloseTo(wide.center[index].halfWidth, 6));
    expect(Math.max(...wide.center.map(p => p.halfWidth))).toBeGreaterThan(Math.min(...wide.center.map(p => p.halfWidth)) * 10);
  });

  it('중심 경로의 s는 0에서 length까지 단조 증가한다', () => {
    const { center, length } = buildFlowGeometry(1440, 8000);
    expect(center[0].s).toBe(0);
    expect(center.at(-1)?.s).toBeCloseTo(length, 6);
    center.slice(1).forEach((point, index) => expect(point.s).toBeGreaterThan(center[index].s));
  });

  it('모든 포즈의 점은 중심 경로와 같은 수, 같은 진행 위치를 가진다', () => {
    const { center, strands } = buildFlowGeometry(1440, 8000);
    const progress = center.map(({ s, halfWidth }) => [s, halfWidth]);
    expect(strands.length).toBeGreaterThan(0);
    strands.forEach(poses => {
      expect(poses).toHaveLength(16);
      poses.forEach(pose => expect(pose.map(({ s, halfWidth }) => [s, halfWidth])).toEqual(progress));
    });
  });

  it('흐름의 끝은 좁은 화면에서도 화면 왼쪽 가장자리 밖에서 끝난다', () => {
    [[390, 4927], [390, 5739], [390, 15000], [768, 5500], [1440, 4927], [1440, 6120]].forEach(([width, height]) => {
      const { center, strands } = buildFlowGeometry(width, height);
      const unit = width / 492;
      const end = center.at(-1)!;
      // 글로 띠(중심에서 25 단위 + 반폭)와 가장 굵은 획의 둥근 끝(13 단위의 절반)까지 화면 밖이어야 한다.
      expect(end.x + 25 * unit + end.halfWidth).toBeLessThan(0);
      strands.flat().forEach(pose => expect(pose.at(-1)!.x + 6.5 * unit).toBeLessThan(0));
    });
  });

  it('0 크기 입력에서도 NaN이나 무한값을 만들지 않는다', () => {
    [[0, 0], [0, 4000], [1440, 0]].forEach(([width, height]) => {
      expect(numbers(buildFlowGeometry(width, height)).every(Number.isFinite)).toBe(true);
    });
  });

  it('새 크기의 형상은 이전 형상과 버퍼를 공유하거나 바꾸지 않는다', () => {
    const before = buildFlowGeometry(1440, 4000);
    const snapshot = structuredClone(before);
    const after = buildFlowGeometry(1440, 8000);
    expect(before).toEqual(snapshot);
    expect(after.center).not.toBe(before.center);
    expect(after.strands.flat().some(pose => before.strands.flat().includes(pose))).toBe(false);
    expect(Math.max(...after.center.map(p => p.y))).toBeGreaterThan(before.height);
  });
});
