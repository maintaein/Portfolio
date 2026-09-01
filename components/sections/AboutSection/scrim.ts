// 문항별 배경 세기. 깊이가 얕을수록(01) 배경이 조용하다. lg부터는 오른쪽에
// 글자가 있으므로 그쪽만 덮고 왼쪽으로는 광선이 그대로 흐른다.
//
// 설명 문단 뒤로 광선이 지나가 대비가 떨어진다. 배경 밝기를 0.55로 올린
// 뒤 여유가 크지 않아 아래쪽을 조금 더 태웠다.
export const ABOUT_SCRIMS = [
  'linear-gradient(to left, rgb(0 0 0 / 0.82) 0%, rgb(0 0 0 / 0.72) 38%, rgb(0 0 0 / 0.3) 64%, rgb(0 0 0 / 0) 100%)',
  'linear-gradient(to left, rgb(0 0 0 / 0.74) 0%, rgb(0 0 0 / 0.62) 38%, rgb(0 0 0 / 0.24) 64%, rgb(0 0 0 / 0) 100%)',
  'linear-gradient(to left, rgb(0 0 0 / 0.66) 0%, rgb(0 0 0 / 0.54) 38%, rgb(0 0 0 / 0.18) 64%, rgb(0 0 0 / 0) 100%)',
] as const;

// lg 미만 전용. 모바일 배치(index.tsx)는 글자가 col-start-1부터 폭 전체를
// 쓰므로 위 가로 그라데이션을 그대로 쓰면 본문이 시작하는 왼쪽 끝의 알파가
// 0이라 그 뒤로 광선이 그대로 지나간다(최종 리뷰 발견 3). 같은 밝기 단계를
// 세로(to top)로 돌려 아래쪽(설명이 앉는 자리)을 가장 어둡게, 위쪽(제목,
// 글자가 크고 굵어 대비 여유가 있다)을 밝게 둔다.
export const ABOUT_SCRIMS_MOBILE = [
  'linear-gradient(to top, rgb(0 0 0 / 0.82) 0%, rgb(0 0 0 / 0.72) 38%, rgb(0 0 0 / 0.3) 64%, rgb(0 0 0 / 0) 100%)',
  'linear-gradient(to top, rgb(0 0 0 / 0.74) 0%, rgb(0 0 0 / 0.62) 38%, rgb(0 0 0 / 0.24) 64%, rgb(0 0 0 / 0) 100%)',
  'linear-gradient(to top, rgb(0 0 0 / 0.66) 0%, rgb(0 0 0 / 0.54) 38%, rgb(0 0 0 / 0.18) 64%, rgb(0 0 0 / 0) 100%)',
] as const;
