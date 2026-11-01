import { describe, expect, it } from 'vitest';
import { buildHandoffTable, handoffCurveLength, handoffPose, type HandoffGeo } from '@/components/sections/ExperienceSection/handoff';
import { ghostSpots } from '@/components/sections/ExperienceSection/orb';

const geo = (over: Partial<HandoffGeo> = {}): HandoffGeo => ({
  axisX: 120, top: 0, tail: 270, target: { x: 120, y: 506 }, nodes: [100, 250], ...over,
});
const setup = (over: Partial<HandoffGeo> = {}) => {
  const g = geo(over);
  const curveLen = handoffCurveLength(g);
  return { g, curveLen, table: buildHandoffTable(g.tail - g.top, curveLen) };
};

describe('buildHandoffTable', () => {
  const table = buildHandoffTable(270, 236);

  it('시작은 선 끝의 헤드와 길 시작의 꼬리다', () => {
    expect(table.at(0)).toEqual({ head: 270, tail: 0 });
  });

  it('헤드는 0.8초에 길 끝에 닿고, 총 길이는 1.0~1.3초다', () => {
    expect(table.total).toBeGreaterThanOrEqual(1);
    expect(table.total).toBeLessThanOrEqual(1.3);
    expect(table.at(0.8 / table.total).head).toBeCloseTo(506, 3);
    expect(table.at(1).head).toBeCloseTo(506, 3);
  });

  it('꼬리는 줄지 않고 헤드를 넘지 않는다(탄성으로 지나치지 않는다)', () => {
    let prev = 0;
    for (let i = 0; i <= 600; i++) {
      const { head, tail } = table.at(i / 600);
      expect(tail).toBeLessThanOrEqual(head);
      expect(tail).toBeGreaterThanOrEqual(prev);
      prev = tail;
    }
  });

  it('끝에서 꼬리가 헤드에 거의 붙고, 범위 밖 p는 끝값으로 막는다', () => {
    const end = table.at(1);
    expect(end.head - end.tail).toBeLessThan(14);
    expect(table.at(2)).toEqual(end);
    expect(table.at(-1)).toEqual(table.at(0));
  });
});

describe('handoffPose', () => {
  it('p 0: 선은 길 시작부터 끝까지, 헤드는 선 끝에 작은 점으로 서고 잔상은 없다', () => {
    const { g, table } = setup();
    const f = handoffPose(table, g, 0);
    expect(f.line).toEqual({ x: 120, top: 0, bottom: 270 });
    expect(f.head).toEqual({ x: 120, y: 270, r: 2.4 });
    expect(f.ghosts).toEqual([]);
    expect(f.heads.map(h => h.a)).toEqual([0.75, 1]);
    expect(f.heads.map(h => h.current)).toEqual([false, true]);
  });

  it('p 1: 헤드는 target에 반지름 12로 서고 선, 잔상, Experience 헤드는 없다', () => {
    const { g, table } = setup();
    const f = handoffPose(table, g, 1);
    expect(f.head.x).toBeCloseTo(120, 6);
    expect(f.head.y).toBeCloseTo(506, 6);
    expect(f.head.r).toBeCloseTo(12, 1);
    expect(f.line).toBeNull();
    expect(f.ghosts).toEqual([]);
    expect(f.heads).toEqual([]);
  });

  it('진행 중 잔상은 7개 이하이고 헤드에서 멀수록 작고 옅다', () => {
    const { g, table } = setup();
    for (const p of [0.3, 0.5, 0.7]) {
      const { ghosts, head } = handoffPose(table, g, p);
      expect(ghosts.length).toBeGreaterThan(0);
      expect(ghosts.length).toBeLessThanOrEqual(7);
      expect(ghosts[0].r).toBeLessThan(head.r);
      ghosts.slice(1).forEach((q, i) => {
        expect(q.r).toBeLessThan(ghosts[i].r);
        expect(q.a).toBeLessThan(ghosts[i].a);
      });
    }
  });

  it('잔상은 헤드에서 꼬리 쪽 길 위에 놓인다(세로선이면 헤드보다 위)', () => {
    const { g, table } = setup();
    const f = handoffPose(table, g, 0.5);
    expect(f.ghosts.every(q => q.x === 120 && q.y < f.head.y)).toBe(true);
  });

  it('target.x가 축에서 96px 떨어지면 헤드 x는 중간에서 축과 target 사이다', () => {
    const { g, table } = setup({ target: { x: 120 + 96, y: 506 } });
    const f = handoffPose(table, g, 0.5);
    expect(f.head.x).toBeGreaterThan(120);
    expect(f.head.x).toBeLessThan(216);
    expect(handoffPose(table, g, 1).head.x).toBeCloseTo(216, 6);
  });

  it('길 시작 위의 노드는 넣지 않고, 꼬리가 40px 안으로 오면 줄고 아래로 끌린다', () => {
    const { g, table } = setup({ nodes: [-50, 100, 250] });
    expect(handoffPose(table, g, 0).heads.map(h => h.i)).toEqual([1, 2]);
    // 꼬리 끝 y가 노드 y 20px 위가 되는 지점을 찾는다
    let f = handoffPose(table, g, 0);
    for (let p = 0; p <= 1; p += 0.002) {
      f = handoffPose(table, g, p);
      if (table.at(p).tail >= 80) break;
    }
    const h = f.heads.find(q => q.i === 1)!;
    expect(h.a).toBeLessThan(0.75);
    expect(h.y).toBeGreaterThan(100);
    expect(h.r).toBeLessThan(7.5);
  });
});

describe('ghostSpots', () => {
  it('14px마다 하나, 최대 7개이고 f는 헤드에서 꼬리 끝으로 늘며 scale과 a는 줄어든다', () => {
    expect(ghostSpots(13)).toEqual([]);
    expect(ghostSpots(14)).toHaveLength(1);
    expect(ghostSpots(1000)).toHaveLength(7);
    const s = ghostSpots(1000);
    expect(s[0].f).toBeCloseTo(1 / 8, 6);
    expect(s[6].f).toBeCloseTo(7 / 8, 6);
    expect(s[0].scale).toBeGreaterThan(s[6].scale);
    expect(s[0].a).toBeGreaterThan(s[6].a);
  });
});
