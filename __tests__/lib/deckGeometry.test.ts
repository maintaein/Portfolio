import { describe, expect, it } from 'vitest';
import {
  DECK_EXPOSURE_X,
  DECK_EXPOSURE_Y,
  DECK_SLOT_SCALE,
  bandLineRects,
  calcGeometry,
  calcIndexRowHeight,
  slotTransform,
} from '@/lib/utils/deckGeometry';

// translate3d(x, y, z)에서 세 값을 뽑는다. 화면 좌표로 되돌려 노출값을 재려면
// 설정값에 s를 다시 곱해야 한다.
function readTransform(css: string): { x: number; y: number; z: number } {
  const match = css.match(
    /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/
  );
  if (!match) throw new Error(`transform 형태가 아니다: ${css}`);
  return { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) };
}

describe('calcIndexRowHeight', () => {
  it('한 줄이면 57px이다. 44가 아니다', () => {
    // 44로 잡았을 때 모든 N, 모든 뷰포트에서 문서가 정확히 13px 넘쳤다.
    expect(calcIndexRowHeight(6, 1440)).toBe(57);
    expect(calcIndexRowHeight(24, 1440)).toBe(57);
  });

  it('1440에서 한 줄에 24칸까지 들어가고 25번째에서 줄이 는다', () => {
    // 줄당 칩 = floor((1440 - 80 + 12) / 56) = 24
    expect(calcIndexRowHeight(25, 1440)).toBe(57 + 44 + 12);
    expect(calcIndexRowHeight(50, 1440)).toBe(57 + (44 + 12) * 2);
  });
});

describe('calcGeometry - Compact 게이트', () => {
  it('폭과 높이를 둘 다 본다', () => {
    expect(calcGeometry(6, 1440, 900).isDeck).toBe(true);
    expect(calcGeometry(6, 1280, 800).isDeck).toBe(true);
    // 폭만 보던 것이 지금 있는 버그다. 1366x768은 높이가 모자라 Compact다
    expect(calcGeometry(6, 1366, 768).isDeck).toBe(false);
    expect(calcGeometry(6, 1023, 900).isDeck).toBe(false);
  });
});

describe('calcGeometry - 카드 크기', () => {
  const round = (g: { cardW: number; cardH: number }) => [
    Math.round(g.cardW),
    Math.round(g.cardH),
  ];

  it('정본 케이스 1440x900 N=6은 720x513이고 프리뷰 405, 밴드 14, 인덱스 행 57이다', () => {
    const geo = calcGeometry(6, 1440, 900);
    expect(round(geo)).toEqual([720, 513]);
    expect(Math.round(geo.preview)).toBe(405);
    expect(Math.round(geo.bandHeight)).toBe(14);
    expect(geo.indexRowHeight).toBe(57);
  });

  it('1440x900의 N별 확정값', () => {
    expect(round(calcGeometry(8, 1440, 900))).toEqual([708, 506]);
    expect(round(calcGeometry(12, 1440, 900))).toEqual([700, 502]);
    expect(round(calcGeometry(20, 1440, 900))).toEqual([700, 502]);
    expect(round(calcGeometry(50, 1440, 900))).toEqual([501, 390]);
  });

  it('1280x800의 N별 확정값', () => {
    expect(round(calcGeometry(6, 1280, 800))).toEqual([542, 413]);
    expect(round(calcGeometry(8, 1280, 800))).toEqual([530, 406]);
    expect(round(calcGeometry(12, 1280, 800))).toEqual([523, 402]);
    expect(round(calcGeometry(50, 1280, 800))).toEqual([324, 290]);
  });

  it('1920x1080은 폭 800에서 잘리고 높이가 558로 되돌아온다', () => {
    // 되돌리지 않으면 카드 아래에 빈 띠가 생긴다. 실제로 밟은 버그다
    for (const n of [6, 8, 12, 20, 50]) {
      const geo = calcGeometry(n, 1920, 1080);
      expect(round(geo)).toEqual([800, 558]);
      expect(geo.preview).toBeCloseTo(450, 5);
    }
  });

  it('세로 예산이 넘치지 않는다', () => {
    for (const vw of [1440, 1920, 1280]) {
      for (const n of [6, 12, 50]) {
        const geo = calcGeometry(n, vw, vw === 1920 ? 1080 : vw === 1440 ? 900 : 800);
        const used =
          geo.cardH + 132 + Math.round(geo.bandHeight) + 24 + geo.indexRowHeight;
        expect(used).toBeLessThanOrEqual(geo.availH);
      }
    }
  });
});

describe('calcGeometry - 두께 밴드', () => {
  it('N<=4면 밴드가 없다', () => {
    for (const n of [1, 2, 3, 4]) {
      const geo = calcGeometry(n, 1440, 900);
      expect(geo.bandLines).toBe(0);
      expect(geo.bandHeight).toBe(0);
    }
  });

  it('N이 늘어도 6줄에서 멈추고 높이가 수렴한다', () => {
    expect(calcGeometry(6, 1440, 900).bandLines).toBe(2);
    expect(calcGeometry(8, 1440, 900).bandLines).toBe(4);
    expect(calcGeometry(12, 1440, 900).bandLines).toBe(6);
    expect(calcGeometry(200, 1440, 900).bandLines).toBe(6);
    expect(Math.round(calcGeometry(200, 1440, 900).bandHeight)).toBe(25);
  });

  it('Compact에서는 밴드가 없다', () => {
    expect(calcGeometry(12, 1366, 768).bandLines).toBe(0);
  });
});

describe('slotTransform', () => {
  it('우측으로 48/96/144, 상단으로 44/88/132를 노출한다', () => {
    const { cardW, cardH } = calcGeometry(6, 1440, 900);
    for (const k of [0, 1, 2, 3]) {
      const s = DECK_SLOT_SCALE[k];
      const t = readTransform(slotTransform(k, cardW, cardH));
      // 화면 노출 = 설정값 * s - 카드가 중심 축소되며 생긴 여백 절반
      // slotTransform이 toFixed(2)로 반올림한 문자열을 되읽으므로 원값과는
      // 최대 0.005px 오차가 난다. 정밀도 6은 이 반올림과 양립 불가능해서 2로 잡는다
      expect(t.x * s - (cardW * (1 - s)) / 2).toBeCloseTo(DECK_EXPOSURE_X[k], 2);
      expect(-t.y * s - (cardH * (1 - s)) / 2).toBeCloseTo(DECK_EXPOSURE_Y[k], 2);
    }
  });

  it('k=0은 변환이 0이다', () => {
    // toFixed가 -0을 "0.00"으로 눕히므로 부호 있는 0이 남지 않는다
    const t = readTransform(slotTransform(0, 720, 513));
    expect(t).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('k=4는 팬텀 시작 위치라 k=3보다 더 뒤에 있다', () => {
    const three = readTransform(slotTransform(3, 720, 513));
    const four = readTransform(slotTransform(4, 720, 513));
    expect(four.z).toBeLessThan(three.z);
  });
});

describe('bandLineRects', () => {
  it('슬롯 3의 계단을 이어받는다', () => {
    // 앞 카드에 맞춰 가운데 세우면 계단과 무관한 전폭 선으로 읽힌다
    const geo = calcGeometry(6, 1440, 900);
    const rects = bandLineRects(geo);
    expect(rects).toHaveLength(2);
    // slot3Left = 144 + 720*0.09 = 208.8, leftStep = 48 + 720*0.03 = 69.6
    expect(rects[0].left).toBeCloseTo(221.45, 1);
    expect(rects[0].width).toBeCloseTo(651.27, 1);
    expect(rects[1].left).toBeCloseTo(230.57, 1);
    expect(rects[1].width).toBeCloseTo(648.44, 1);
  });

  it('좌는 계속 늘고 폭과 bottom 간격은 계속 준다. 사선이 끊기지 않는다', () => {
    const geo = calcGeometry(50, 1440, 900);
    const rects = bandLineRects(geo);
    expect(rects).toHaveLength(6);
    for (let j = 1; j < rects.length; j += 1) {
      expect(rects[j].left).toBeGreaterThan(rects[j - 1].left);
      expect(rects[j].width).toBeLessThan(rects[j - 1].width);
      expect(rects[j].bottom).toBeGreaterThan(rects[j - 1].bottom);
    }
  });

  it('밴드가 없으면 빈 배열이다', () => {
    expect(bandLineRects(calcGeometry(3, 1440, 900))).toEqual([]);
  });
});
