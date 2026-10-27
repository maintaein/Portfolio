import { describe, expect, it } from 'vitest';
import { computeTimelineState } from '@/components/sections/ExperienceSection/timeline';

// 본문 셋: 높이 800, 1000, 600. 사이 간격 100. 노드는 rail에서 0, 160, 320.
const layout = {
  articleTops: [100, 1000, 2100],
  articleBottoms: [900, 2000, 2700],
  nodeY: [0, 160, 320],
};

describe('computeTimelineState', () => {
  it('마지막 노드가 보여도 마지막 본문을 다 읽기 전에는 완료하지 않는다', () => {
    const layout = {
      articleTops: [100, 1000], articleBottoms: [900, 2200], nodeY: [0, 160],
    };
    expect(computeTimelineState(layout, 1800).complete).toBe(false);
    expect(computeTimelineState(layout, 2200).complete).toBe(true);
  });

  it('빈 이력도 NaN 없이 처리한다', () => {
    expect(computeTimelineState({
      articleTops: [], articleBottoms: [], nodeY: [],
    }, 100)).toEqual({ tipY: 0, reached: -1, complete: true });
  });

  it.each([
    // 첫 본문 전: 아직 첫 표식 전이고 선 끝은 첫 노드에 머문다.
    [99, -1, 0],
    // 첫 경계: 첫 본문 위끝에서 첫 표식만 공개한다.
    [100, 0, 0],
    // 첫 본문을 읽는 동안 선 끝은 움직이지 않는다. 전환은 다음 위끝 200px 전(이전 본문 800 * .25)에 시작한다.
    [800, 0, 0],
    // 전환 구간의 가운데에서 선 끝은 두 노드의 가운데다.
    [900, 0, 80],
    // 중간 경계: 실제 다음 article top에서 노드에 닿는다.
    [1000, 1, 160],
    // 두 번째 본문(높이 1000)은 250px 전부터 다음 노드로 간다.
    [1850, 1, 160],
    [1975, 1, 240],
    // 마지막 경계.
    [2100, 2, 320],
    [5000, 2, 320],
  ])('읽기선 %d에서 reached %d, 선 끝 %d이다', (readingY, reached, tipY) => {
    const state = computeTimelineState(layout, readingY);
    expect(state.reached).toBe(reached);
    expect(state.tipY).toBeCloseTo(tipY);
  });

  it('완료는 마지막 본문 끝을 읽기선이 지난 때다', () => {
    expect(computeTimelineState(layout, 2699).complete).toBe(false);
    expect(computeTimelineState(layout, 2700).complete).toBe(true);
  });

  it('역방향으로 읽기선이 올라가면 선 끝과 도달이 같은 길로 줄어든다', () => {
    const ys = [2700, 2100, 2050, 1975, 1900, 1000, 950, 900, 800, 100, 50];
    const states = ys.map(y => computeTimelineState(layout, y));
    for (let i = 1; i < states.length; i++) {
      expect(states[i].tipY).toBeLessThanOrEqual(states[i - 1].tipY);
      expect(states[i].reached).toBeLessThanOrEqual(states[i - 1].reached);
    }
    expect(states.at(-1)).toEqual({ tipY: 0, reached: -1, complete: false });
  });

  it('남은 화면이 짧으면 그 비율이 전환 길이가 된다', () => {
    // 남은 화면 400 * .35 = 140 < 본문 비율 200. 전환은 860에서 시작한다.
    expect(computeTimelineState(layout, 860, 400).tipY).toBeCloseTo(0);
    expect(computeTimelineState(layout, 930, 400).tipY).toBeCloseTo(80);
    expect(computeTimelineState(layout, 1000, 400).tipY).toBeCloseTo(160);
  });

  it('하나뿐인 이력은 그 본문 끝까지 읽기 전에는 완료하지 않고 선 끝은 그 노드다', () => {
    const one = { articleTops: [100], articleBottoms: [3100], nodeY: [24] };
    expect(computeTimelineState(one, 50)).toEqual({ tipY: 24, reached: -1, complete: false });
    expect(computeTimelineState(one, 3000)).toEqual({ tipY: 24, reached: 0, complete: false });
    expect(computeTimelineState(one, 3100)).toEqual({ tipY: 24, reached: 0, complete: true });
  });

  it('긴 본문은 읽는 동안 선 끝을 붙잡고 끝 무렵에만 진행한다', () => {
    const long = { articleTops: [0, 4100], articleBottoms: [4000, 4600], nodeY: [0, 200] };
    // 본문 비율은 1000이지만 남은 화면 500 * .35 = 175가 짧다.
    expect(computeTimelineState(long, 3900, 500).tipY).toBe(0);
    expect(computeTimelineState(long, 3925, 500).tipY).toBe(0);
    expect(computeTimelineState(long, 4012.5, 500).tipY).toBeCloseTo(100);
  });

  it('resize로 다시 잰 nodeY를 그대로 쓴다', () => {
    const before = computeTimelineState(layout, 900);
    const after = computeTimelineState({ ...layout, nodeY: [10, 410, 810] }, 900);
    expect(before.tipY).toBeCloseTo(80);
    expect(after.tipY).toBeCloseTo(210);
    expect(after.reached).toBe(before.reached);
  });

  it('읽기선이 NaN이거나 남은 화면이 NaN이어도 NaN을 내지 않는다', () => {
    expect(computeTimelineState(layout, Number.NaN)).toEqual({ tipY: 0, reached: -1, complete: false });
    expect(Number.isNaN(computeTimelineState(layout, 900, Number.NaN).tipY)).toBe(false);
  });
});
