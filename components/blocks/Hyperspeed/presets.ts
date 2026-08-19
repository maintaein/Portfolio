// 시안 팔레트. 기본 leftCars의 마젠타/보라(0xd856bf, 0x6750a2, 0xc247ac)는
// AI가 만든 티가 가장 많이 나는 조합이라 시안 단색으로 통일했다.
// 깊이는 색상이 아니라 명도로 표현한다.
// shoulderLines·brokenLines를 검정으로 명시해 갓길선·점선이 배경과
// 같은 색이 되어 보이지 않게 한다 — 원본의 흰 차선은 명시적 거부 항목이다.
export const CYAN_PALETTE = {
  roadColor: 0x000000,
  islandColor: 0x000000,
  background: 0x000000,
  shoulderLines: 0x000000,
  brokenLines: 0x000000,
  leftCars: [0x03b3c3, 0x0e5ea5, 0x7fe3ee],
  rightCars: [0x03b3c3, 0x0e5ea5, 0x324555],
  sticks: 0x03b3c3
} as const;

export interface QualityProfile {
  lightPairsPerRoadWay: number;
  totalSideLightSticks: number;
  // 0은 "상한 없음"(네이티브 DPR 그대로)을 뜻한다. Math.min(dpr, maxDpr)에
  // 그대로 넣으면 안 된다 — 0을 무제한으로 해석하는 분기가 필요하다.
  maxDpr: number;
  resolutionScale: number;
  bloom: boolean;
  renderInterval: number;
}

// 계획 3 Task 1이 실기기 측정(Galaxy S25, 2026-08-19)으로 확정한 표.
// .claude/designRefactoring/plans/2026-08-04-spike-verdict.md 「배포본 실기기
// 측정」절의 확정본과 동일하다 — 계획 문서 본문의 예시 숫자보다 이 표가 우선한다.
export const QUALITY_PROFILES: Readonly<Record<'high' | 'medium' | 'low', Readonly<QualityProfile>>> = {
  high: {
    lightPairsPerRoadWay: 40,
    totalSideLightSticks: 20,
    maxDpr: 0,
    resolutionScale: 1.0,
    bloom: true,
    renderInterval: 1
  },
  medium: {
    lightPairsPerRoadWay: 40,
    totalSideLightSticks: 20,
    maxDpr: 1.0,
    resolutionScale: 1.0,
    bloom: true,
    renderInterval: 1
  },
  low: {
    lightPairsPerRoadWay: 20,
    totalSideLightSticks: 10,
    maxDpr: 1.0,
    // bloom이 꺼져 있어 실제로 쓰이지 않지만 QualityProfile은 전 필드
    // 필수라 빈칸을 둘 수 없다.
    resolutionScale: 1.0,
    bloom: false,
    renderInterval: 2
  }
};
