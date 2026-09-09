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

describe('calcGeometry - 카드 크기 (layoutH 없이, 셸이 없는 조건)', () => {
  const round = (g: { cardW: number; cardH: number }) => [
    Math.round(g.cardW),
    Math.round(g.cardH),
  ];

  // 아래 값은 전부 손으로 계산한 것이다. 공식은 하나뿐이라 옮겨 적어 둔다.
  //   availH = layoutH - 24*2,  layoutH 기본값 = vh
  //   cardH  = availH - 132(뒤 카드 헤더) - round(밴드) - 24(카드와 인덱스 사이) - 인덱스 행
  //   preview = cardH - 44 - 64,  cardW = preview * 16/9
  //   cardW가 800을 넘으면 800에서 preview 450, cardH 558로 되돌린다
  // 밴드 높이는 8 * 0.72^j의 합이다: N=6이면 13.76(반올림 14),
  // N=8이면 20.89(21), N>=12면 여섯 줄에서 멈춰 24.59(25)다.

  it('1440x900 N=6은 폭 상한 800에 걸려 800x558이다', () => {
    // cardH = (900-48) - 132 - 14 - 24 - 57 = 625 -> preview 517 -> cardW 919.1
    // 919.1이 800을 넘으므로 800에서 되돌아와 preview 450, cardH 558이 된다
    const geo = calcGeometry(6, 1440, 900);
    expect(round(geo)).toEqual([800, 558]);
    expect(Math.round(geo.preview)).toBe(450);
    expect(Math.round(geo.bandHeight)).toBe(14);
    expect(geo.indexRowHeight).toBe(57);
  });

  it('1440x900의 N별 확정값', () => {
    // N=8:  cardH 852-132-21-24-57 = 618 -> preview 510 -> cardW 906.7 -> 상한
    // N=12: cardH 852-132-25-24-57 = 614 -> preview 506 -> cardW 899.6 -> 상한
    // N=20: 인덱스 행이 아직 한 줄(24칸)이라 N=12와 같다
    // N=50: 인덱스 행 세 줄 169 -> cardH 852-132-25-24-169 = 502
    //       -> preview 394 -> cardW 700.4 (상한 미달)
    expect(round(calcGeometry(8, 1440, 900))).toEqual([800, 558]);
    expect(round(calcGeometry(12, 1440, 900))).toEqual([800, 558]);
    expect(round(calcGeometry(20, 1440, 900))).toEqual([800, 558]);
    expect(round(calcGeometry(50, 1440, 900))).toEqual([700, 502]);
  });

  it('1280x800의 N별 확정값', () => {
    // availH = 800-48 = 752, 인덱스 행은 N<=21이면 한 줄 57, N=50이면 세 줄 169
    // N=6:  752-132-14-24-57 = 525 -> preview 417 -> cardW 741.3
    // N=8:  752-132-21-24-57 = 518 -> preview 410 -> cardW 728.9
    // N=12: 752-132-25-24-57 = 514 -> preview 406 -> cardW 721.8
    // N=50: 752-132-25-24-169 = 402 -> preview 294 -> cardW 522.7
    expect(round(calcGeometry(6, 1280, 800))).toEqual([741, 525]);
    expect(round(calcGeometry(8, 1280, 800))).toEqual([729, 518]);
    expect(round(calcGeometry(12, 1280, 800))).toEqual([722, 514]);
    expect(round(calcGeometry(50, 1280, 800))).toEqual([523, 402]);
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

// 앱 셸 안에서 섹션이 실제로 받는 상자는 뷰포트보다 한참 작다. 1440x900에서
// 헤더 72와 푸터 45를 뺀 783이 스크롤 컨테이너 높이이고, 그 아래 여백 40을 더
// 빼면 743이 섹션이 쓸 수 있는 전부다. 이 describe가 이번 수정의 본체다.
describe('calcGeometry - 앱 셸이 주는 상자', () => {
  it('1440x900 상자 743에서 640x468이다', () => {
    // availH = 743-48 = 695
    // cardH = 695 - 132 - 14 - 24 - 57 = 468 -> preview 360 -> cardW 640
    // 상자 대신 뷰포트 900을 넣으면 800x558이 나와 인덱스 행이 푸터 밑으로 깔린다
    const geo = calcGeometry(6, 1440, 900, 743);
    expect(geo.isDeck).toBe(true);
    expect(geo.cardW).toBeCloseTo(640, 6);
    expect(geo.cardH).toBeCloseTo(468, 6);
    expect(geo.preview).toBeCloseTo(360, 6);
    expect(geo.bandHeight).toBeCloseTo(13.76, 6);
    expect(geo.indexRowHeight).toBe(57);
  });

  it('1280x800 상자 643에서 462x368이다', () => {
    // availH = 643-48 = 595
    // cardH = 595 - 132 - 14 - 24 - 57 = 368 -> preview 260 -> cardW 4160/9 = 462.2
    const geo = calcGeometry(6, 1280, 800, 643);
    expect(geo.isDeck).toBe(true);
    expect(geo.cardW).toBeCloseTo(4160 / 9, 6);
    expect(geo.cardH).toBeCloseTo(368, 6);
    expect(geo.preview).toBeCloseTo(260, 6);
  });

  it('390x844 상자 668에서 폭 상한에 걸려 310이 된다', () => {
    // availH = 668-48 = 620, Compact라 밴드가 없고 인덱스 행은 두 줄 113이다
    // cardH = 620 - 24 - 113 = 483 -> preview 375 -> cardW 666.7
    // 그대로 두면 390짜리 화면 밖으로 나간다. 좌우 여백 40씩을 뺀 310에서 잘리고
    // 거기서 16:9로 preview 174.375, cardH 282.375가 되돌아온다
    const geo = calcGeometry(6, 390, 844, 668);
    expect(geo.isDeck).toBe(false);
    expect(geo.indexRowHeight).toBe(113);
    expect(geo.cardW).toBeCloseTo(310, 6);
    expect(geo.preview).toBeCloseTo(174.375, 6);
    expect(geo.cardH).toBeCloseTo(282.375, 6);
  });

  it('셸이 준 상자 안에서 세로 예산이 넘치지 않는다', () => {
    // 이 섹션이 존재하는 이유다. 넘치면 인덱스 행이 고정 푸터에 먹힌다
    for (const [vw, vh, layoutH] of [
      [1440, 900, 743],
      [1280, 800, 643],
      [1920, 1080, 923],
      [390, 844, 668],
    ]) {
      for (const n of [6, 12]) {
        const geo = calcGeometry(n, vw, vh, layoutH);
        const used =
          geo.cardH +
          (geo.isDeck ? 132 : 0) +
          Math.round(geo.bandHeight) +
          24 +
          geo.indexRowHeight;
        expect(used, `${vw}x${vh} layoutH=${layoutH} n=${n}`).toBeLessThanOrEqual(
          geo.availH
        );
      }
    }
  });

  it('덱 게이트는 상자가 아니라 뷰포트 높이로만 판정한다', () => {
    // 상자로 판정하면 셸이 있는 1440x900에서 덱이 통째로 꺼진다
    expect(calcGeometry(6, 1440, 900, 300).isDeck).toBe(true);
    // 반대로 뷰포트가 낮으면 상자가 아무리 넉넉해도 Compact다
    expect(calcGeometry(6, 1440, 768, 2000).isDeck).toBe(false);
  });

  it('layoutH를 생략하면 뷰포트 높이를 그대로 쓴다', () => {
    expect(calcGeometry(6, 1440, 900, 900)).toEqual(calcGeometry(6, 1440, 900));
  });
});

describe('calcGeometry - 가로 상한', () => {
  it('어떤 뷰포트에서도 카드가 좌우 여백 안에 들어간다', () => {
    // 열거한 몇 개만 보는 대신 불변식으로 판정한다. 높이에서만 폭을 되돌리는
    // 코드는 좁은 화면 어디서든 이 선을 넘는다
    for (const [vw, vh] of [
      [320, 568],
      [360, 640],
      [390, 844],
      [430, 932],
      [600, 1024],
      [768, 1024],
      [834, 1112],
      [1024, 800],
      [1280, 800],
      [1440, 900],
      [1920, 1080],
    ]) {
      for (const n of [1, 6, 12, 50]) {
        // 셸이 세로로 157쯤 먹는다. 실제 앱에 가까운 상자로 재 본다
        const geo = calcGeometry(n, vw, vh, vh - 157);
        const label = `${vw}x${vh} n=${n}`;
        expect(geo.cardW, label).toBeLessThanOrEqual(vw - 80);
        // 폭에서 잘렸으면 프리뷰와 카드 높이도 같이 되돌아와야 한다.
        // 폭만 깎으면 카드 아래에 빈 띠가 남는다
        expect(geo.preview, label).toBeCloseTo((geo.cardW * 9) / 16, 6);
        expect(geo.cardH, label).toBeCloseTo(geo.preview + 44 + 64, 6);
      }
    }
  });

  it('넉넉한 폭에서는 가로 상한이 개입하지 않는다', () => {
    // 상한을 무조건 걸면 넓은 화면의 카드까지 같이 줄어든다
    expect(calcGeometry(6, 1440, 900, 743).cardW).toBeCloseTo(640, 6);
    expect(calcGeometry(6, 1920, 1080, 923).cardW).toBeCloseTo(800, 6);
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
    // cardW 800 기준. slot3Left = 144 + 800*0.09 = 216, leftStep = 48 + 800*0.03 = 72,
    // widthStep = 24, slot3Width = 728, yStep = 44.
    // j=0은 누적 8이라 비율 8/44, j=1은 누적 13.76이라 비율 13.76/44다
    expect(rects[0].left).toBeCloseTo(229.09, 1);
    expect(rects[0].width).toBeCloseTo(723.64, 1);
    expect(rects[1].left).toBeCloseTo(238.52, 1);
    expect(rects[1].width).toBeCloseTo(720.49, 1);
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
