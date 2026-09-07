import type { CSSProperties } from 'react';

// 마스크 원본 크기. contain 마스크는 상자에 폭이 남으면 그만큼 죽은 여백을
// 만들 뿐이라, 정사각 타일에 넣으면 4:1 워드마크가 높이의 4분의 1까지 줄어
// 읽히지 않는다. 높이를 고정하고 폭은 여기서 원본 비율로 역산한다.
// Experience와 Awards가 같은 조직 로고를 쓰므로 크기표는 한곳에서 쥔다.
const INTRINSIC: Record<string, { width: number; height: number }> = {
  fasoo: { width: 428, height: 104 },
  hankyung: { width: 714, height: 176 },
  kua: { width: 216, height: 176 },
  opic: { width: 304, height: 176 },
  ssafy: { width: 156, height: 68 },
};

// maxWidth는 아주 납작한 워드마크가 줄을 통째로 밀어낼 때만 쓴다. 상한에
// 걸리면 마스크가 contain이라 로고가 슬롯 높이보다 작게 그려지므로,
// 필요하지 않으면 걸지 않는 편이 낫다.
export function orgLogoStyle(logo: string, height: number, maxWidth?: number): CSSProperties {
  const name = logo.toLowerCase();
  const source = INTRINSIC[name];
  const width = Math.round((height * source.width) / source.height);
  return {
    '--org-logo-src': `url(/logos-mono/${name}.png)`,
    height,
    width: maxWidth === undefined ? width : Math.min(maxWidth, width),
  } as CSSProperties;
}
