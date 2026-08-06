// 다크 단일 테마의 색상 단일 출처.
// styles/design-tokens.css의 CSS 변수와 값이 일치해야 한다.
// text 그룹에 넣는 색은 검정 위 4.5:1을 넘어야 하며,
// __tests__/lib/darkTokens.test.ts가 이를 강제한다.

export const darkTokens = {
  background: '#000000',

  // 본문에 쓸 수 있는 색. 전부 검정 위 4.5:1 이상.
  text: {
    primary: '#eef4f5',   // 18.9:1
    secondary: '#8b95a1', // 6.91:1  (기존 grey-500 재사용)
    accent: '#03b3c3',    //  8.24:1
    highlight: '#7fe3ee', // 14.12:1
  },

  // 텍스트로 쓰면 안 되는 색.
  decoration: {
    dim: '#0e5ea5',                        // 3.16:1 — 배경 광선 전용
    hairline: 'rgb(3 179 195 / 0.35)',     // 구획선
    elevationNear: 'rgb(3 179 195 / 0.6)', // 가까운 테두리
    elevationFar: 'rgb(3 179 195 / 0.15)', // 먼 테두리
  },
} as const;
