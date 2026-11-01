import { describe, expect, it } from 'vitest';
import {
  LEAD,
  PULSE_GAP,
  SPRINT_IN,
  SPRINT_OUT,
  createSegments,
  gatherPose,
  pulseOffsets,
  stepSegment,
} from '@/components/sections/ExperienceSection/lineMotion';

const DT = 1 / 60;
const base = { from: 0, to: 2000, readEnd: 1200, reading: 500, alive: true, dt: DT, reduced: false };

function run(seg: ReturnType<typeof createSegments>[number], frames: number, input: Partial<typeof base>) {
  for (let i = 0; i < frames; i++) stepSegment(seg, { ...base, ...input });
}

describe('stepSegment', () => {
  it('읽는 동안 선 끝은 읽기선 + LEAD를 따라가되 읽기 끝을 넘지 않는다', () => {
    const [seg] = createSegments(1);
    run(seg, 120, { reading: 500 });
    expect(seg.tip).toBeCloseTo(500 + LEAD, 0);
    expect(Math.abs((seg.tip as number) - 540)).toBeLessThanOrEqual(1);

    const [near] = createSegments(1);
    run(near, 120, { reading: 1180 });
    expect(near.tip as number).toBeLessThanOrEqual(1200);
  });

  it('질주는 그 순간의 선 끝에서 출발해 첫 프레임에 튀지 않는다', () => {
    const [seg] = createSegments(1);
    seg.tip = 800;
    const before = seg.tip;
    stepSegment(seg, { ...base, reading: 1300 });
    expect((seg.tip as number) - before).toBeLessThan(70);
  });

  it('질주는 SPRINT_IN 동안 다음 노드에 닿아 done이 되고, 되돌면 SPRINT_OUT 동안 돌아온다', () => {
    const [seg] = createSegments(1);
    // 0.9초를 한 프레임 넘겨 q가 정확히 1로 잘리게 한다
    run(seg, Math.ceil(SPRINT_IN / DT) + 1, { reading: 1300 });
    expect(seg.tip).toBe(2000);
    expect(seg.done).toBe(true);

    run(seg, Math.ceil(SPRINT_OUT / DT) + 1, { reading: 500 });
    expect(seg.q).toBe(0);
    expect(seg.done).toBe(false);
  });

  it('살아 있지 않은 구간은 노드 자리로 초기화된다', () => {
    const [seg] = createSegments(1);
    run(seg, 30, { reading: 1300 });
    stepSegment(seg, { ...base, from: 100, alive: false });
    expect(seg.tip).toBe(100);
    expect(seg.q).toBe(0);
    expect(seg.done).toBe(false);
  });

  it('모션 감소는 읽기선 자리에 바로 선다', () => {
    const [seg] = createSegments(1);
    stepSegment(seg, { ...base, reading: 900, reduced: true });
    expect(seg.tip).toBe(900);
    expect(seg.done).toBe(false);
    stepSegment(seg, { ...base, reading: 2500, reduced: true });
    expect(seg.tip).toBe(2000);
    expect(seg.done).toBe(true);
  });
});

describe('pulseOffsets', () => {
  it('빛 덩이 자리는 선 길이가 바뀌어도 그대로다', () => {
    const short = pulseOffsets(3, 500);
    const long = pulseOffsets(3, 2000);
    expect(long[0]).toBe(short[0]);
    for (let i = 1; i < long.length; i++) expect(long[i] - long[i - 1]).toBeCloseTo(PULSE_GAP, 6);
    expect(short.every((d) => d < 500)).toBe(true);
    expect(long.every((d) => d < 2000)).toBe(true);
  });
});

describe('gatherPose', () => {
  const word = { x: 1000, y: 300 }, node = { x: 64, y: 700 };
  const near = { x: 900, y: 300, k: 0 }, far = { x: 1100, y: 300, k: 7 };

  it('0초에는 글자가 제자리에 있고 녹지도 모이지도 않았다', () => {
    const p = gatherPose(far, 0, word, node);
    expect(p.x).toBeCloseTo(1100, 6);
    expect(p.y).toBeCloseTo(300, 6);
    expect([p.g, p.melt, p.speed]).toEqual([0, 0, 0]);
  });

  it('1.95초에 모든 글자가 노드에 한 덩이로 내려앉는다', () => {
    for (const L of [near, far]) {
      const p = gatherPose(L, 1.95, word, node);
      expect(p.x).toBeCloseTo(64, 6);
      expect(p.y).toBeCloseTo(700, 6);
      expect([p.g, p.melt, p.speed]).toEqual([1, 1, 0]);
    }
  });

  it('노드에 가까운 글자(k 0)가 먼저 떠난다', () => {
    const sec = 0.37;
    expect(gatherPose(near, sec, word, node).speed).toBeGreaterThan(0);
    expect(gatherPose(far, sec, word, node).speed).toBe(0);
  });

  it('무리는 떠날 때 낱말 위로 살짝 떠오른다(예비 동작)', () => {
    const p = gatherPose({ ...word, k: 0 }, 0.6, word, node);
    expect(p.y).toBeLessThan(300);
  });
});
