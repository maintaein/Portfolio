// WCAG 2.1 대비비 계산.
// https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
// 본문 텍스트는 4.5:1, 큰 텍스트(18.66px bold / 24px)는 3:1이 최소 기준이다.

function parseHex(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`색상 파싱 실패: ${hex}`);
  }

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

// sRGB 채널값(0~255)을 선형 광량으로 변환한다.
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
