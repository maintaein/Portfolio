import { describe, expect, it } from 'vitest';
import { HAZE_FROM, REVEAL_SECONDS, strandReach } from '@/components/blocks/LuminousFlowBackground/entrance';
import { strandLane } from '@/components/blocks/LuminousFlowBackground/geometry';
import { INTRO_TIMING } from '@/components/sections/BootSequence';

// Reach is measured in the first screen's path length (fold), so 1 means the head is at the bottom of the first screen.
const FOLD = 1000;
const STRANDS = Array.from({ length: 28 }, (_, index) => index);
const at = (seconds: number) => STRANDS.map(strand => strandReach(strand, seconds / REVEAL_SECONDS, FOLD) / FOLD);
// 0 to 2.89 s: at 2.9 s the reveal is 1 and every strand is complete.
const grid = Array.from({ length: 290 }, (_, step) => step / 100);

describe('가닥별 진입 시간표', () => {
  it('진입은 2.9초이고 0에서는 아무 가닥도 자라지 않았으며 1에서는 모두 끝까지 자란다', () => {
    expect(REVEAL_SECONDS).toBe(2.9);
    // BootSequence keeps its own copy (it imports only react), so the two must agree.
    expect(INTRO_TIMING.background).toBe(REVEAL_SECONDS);
    STRANDS.forEach(strand => {
      expect(strandReach(strand, 0, FOLD)).toBe(0);
      expect(strandReach(strand, 1, FOLD)).toBe(Infinity);
    });
  });

  it('같은 진행도에서 가닥마다 길이가 다르다', () => {
    [.6, 1.2, 2].forEach(seconds => expect(new Set(at(seconds).map(reach => reach.toFixed(4))).size).toBeGreaterThan(20));
  });

  it('가닥마다 진행도에 따라 줄지 않고, 출발 뒤에는 계속 자란다', () => {
    STRANDS.forEach(strand => {
      const reaches = grid.map(seconds => strandReach(strand, seconds / REVEAL_SECONDS, FOLD));
      reaches.slice(1).forEach((reach, index) => expect(reach).toBeGreaterThanOrEqual(reaches[index]));
      expect(reaches.at(-1)!).toBeGreaterThan(reaches.at(-2)!);
    });
  });

  it('가운데 차선이 먼저, 바깥 차선이 나중에 출발한다', () => {
    const start = STRANDS.map(strand => grid.find(seconds => strandReach(strand, seconds / REVEAL_SECONDS, FOLD) > 0)!);
    const byLane = [...STRANDS].sort((a, b) => Math.abs(strandLane(a)) - Math.abs(strandLane(b)));
    byLane.slice(1).forEach((strand, index) => expect(start[strand]).toBeGreaterThanOrEqual(start[byLane[index]]));
    expect(start[byLane.at(-1)!] - start[byLane[0]]).toBeGreaterThan(.3);
  });

  it('무리가 함께 흐른다: 앞뒤 폭이 첫 화면 경로의 25%를 넘지 않고, 선두 하나가 혼자 앞서지 않는다', () => {
    grid.forEach(seconds => {
      const reaches = at(seconds).sort((a, b) => b - a);
      expect(reaches[0] - reaches[27], `${seconds}s spread`).toBeLessThanOrEqual(.25);
      // The leader is never more than 5% of the first screen ahead of the fifth strand.
      expect(reaches[0] - reaches[4], `${seconds}s lead`).toBeLessThanOrEqual(.05);
    });
  });

  it('머리는 진입이 끝나기 전에 첫 화면 아래 끝을 지나 멈추지 않고 계속 간다', () => {
    const end = at(REVEAL_SECONDS - .01);
    end.forEach(reach => expect(reach).toBeGreaterThan(1.1));
    // Cruising: the last .3 s adds about the same length as the .3 s before it.
    const [a, b, c] = [2.3, 2.6, 2.89].map(at);
    STRANDS.forEach(strand => expect((c[strand] - b[strand]) / (b[strand] - a[strand])).toBeCloseTo(.29 / .3, 1));
  });

  it('haze는 마지막 가닥이 첫 화면을 벗어나는 진행도부터 켜진다', () => {
    expect(Math.min(...STRANDS.map(strand => strandReach(strand, HAZE_FROM, FOLD)))).toBeGreaterThanOrEqual(FOLD * .999);
    expect(Math.min(...STRANDS.map(strand => strandReach(strand, HAZE_FROM - .01, FOLD)))).toBeLessThan(FOLD);
    expect(HAZE_FROM).toBeGreaterThan(.5);
    expect(HAZE_FROM).toBeLessThan(.95);
  });
});
