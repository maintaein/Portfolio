// 경력 타임라인의 순수 계산(M5 Task 1). 좌표는 한 기준(섹션 레이아웃 위끝)에서 잰 값이고 nodeY만 실제 선 그룹의 local y다.
export type TimelineLayout = {
  articleTops: readonly number[];
  articleBottoms: readonly number[];
  nodeY: readonly number[]; // 실제 rail의 local y, 각 article과 같은 index
};

// 다음 본문으로 가는 전환 길이의 시안값. 이전 본문 끝에서 읽기선 아래 남은 화면과 이전 본문 높이 중 짧은 쪽의 비율이다.
// 본문 높이를 줄이거나 스크롤을 가로채지 않는다. 선 끝은 이 길이 동안 내려가 실제 다음 article top에서 노드에 닿는다.
const VIEWPORT_SHARE = .35;
const BODY_SHARE = .25;

// readingY: 같은 기준의 읽기선(M1 readingLineY). viewportRest: 읽기선 아래 남은 화면 높이(없으면 본문 비율만 쓴다).
export function computeTimelineState(layout: TimelineLayout, readingY: number, viewportRest = Infinity): {
  tipY: number; reached: number; complete: boolean;
} {
  const { articleTops: tops, articleBottoms: bottoms, nodeY } = layout;
  const count = nodeY.length;
  if (!count) return { tipY: 0, reached: -1, complete: true };
  let reached = -1;
  for (let i = 0; i < count; i++) if (readingY >= tops[i]) reached = i;
  let tipY = nodeY[Math.max(reached, 0)];
  if (reached >= 0 && reached < count - 1) {
    const next = tops[reached + 1];
    const length = Math.min(viewportRest * VIEWPORT_SHARE, (bottoms[reached] - tops[reached]) * BODY_SHARE);
    const progress = length > 0 ? (readingY - (next - length)) / length : 0;
    if (progress > 0) tipY += (nodeY[reached + 1] - tipY) * Math.min(progress, 1);
  }
  return { tipY, reached, complete: readingY >= bottoms[count - 1] };
}
