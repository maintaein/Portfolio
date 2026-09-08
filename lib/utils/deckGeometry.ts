// 깊이 덱의 기하. DOM을 읽지 않는 순수 산수다.
// 시안에서 터진 버그 네 개 중 셋이 이 산수였고, window를 읽는 함수 안에
// 있으면 jsdom에서 잴 수 없다. 그래서 (n, vw, vh)를 인자로 받는다.
// 정본은 .claude/designRefactoring/2026-09-09-t2-implementation-spec.md §3

export const DECK_PERSPECTIVE = 900;
export const DECK_SLOT_SCALE = [1, 0.97, 0.94, 0.91, 0.88] as const;
export const DECK_EXPOSURE_X = [0, 48, 96, 144, 192] as const;
export const DECK_EXPOSURE_Y = [0, 44, 88, 132, 176] as const;
export const DECK_SLOT_BORDER = [
  'rgb(3 179 195 / 0.55)',
  'rgb(255 255 255 / 0.14)',
  'rgb(255 255 255 / 0.09)',
  'rgb(255 255 255 / 0.05)',
] as const;
export const DECK_SLOT_DIM = [1, 0.55, 0.32, 0.16] as const;
export const DECK_TRANSITION_MS = 600;
export const DECK_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const DECK_HEADER_H = 44;
export const DECK_META_H = 64;
export const DECK_CARD_MAX_W = 800;

const SECTION_PAD_X = 40;   // 섹션 좌우 패딩
const SECTION_PAD_Y = 80;   // py-20
const CHIP = 44;
const CHIP_GAP = 12;
const BACK_HEADER_ROOM = 132;  // 뒤 카드 헤더 3칸이 위로 넘칠 자리
const DECK_TO_INDEX_GAP = 24;
const BAND_BASE_GAP = 8;
const BAND_RATIO = 0.72;
const BAND_MIN_GAP = 1.2;
const BAND_MAX_LINES = 6;

export interface DeckGeometry {
  isDeck: boolean;
  availH: number;
  indexRowHeight: number;
  bandLines: number;
  bandHeight: number;
  cardW: number;
  cardH: number;
  preview: number;
}

export interface BandLineRect {
  left: number;
  width: number;
  bottom: number;
}

// 인덱스 행이 실제로 차지하는 높이. 헤어라인 1 + 패딩 12 + 칩 줄들이다.
// 44로 잡으면 안 된다. 한 줄이 57이다.
export function calcIndexRowHeight(n: number, vw: number): number {
  const rowWidth = vw - SECTION_PAD_X * 2;
  const chipsPerRow = Math.max(
    1,
    Math.floor((rowWidth + CHIP_GAP) / (CHIP + CHIP_GAP))
  );
  const lines = Math.max(1, Math.ceil(n / chipsPerRow));
  return 1 + CHIP_GAP + lines * CHIP + (lines - 1) * CHIP_GAP;
}

function calcBand(n: number, isDeck: boolean): { lines: number; height: number } {
  if (!isDeck || n <= 4) return { lines: 0, height: 0 };
  const maxLines = Math.min(n - 4, BAND_MAX_LINES);
  let lines = 0;
  let height = 0;
  for (let j = 0; j < maxLines; j += 1) {
    const gap = BAND_BASE_GAP * BAND_RATIO ** j;
    if (gap < BAND_MIN_GAP) break;
    height += gap;
    lines = j + 1;
  }
  return { lines, height };
}

export function calcGeometry(n: number, vw: number, vh: number): DeckGeometry {
  const isDeck = vw >= 1024 && vh >= 800;
  const availH = vh - SECTION_PAD_Y * 2;
  const indexRowHeight = calcIndexRowHeight(n, vw);
  const band = calcBand(n, isDeck);

  let cardH = isDeck
    ? availH - BACK_HEADER_ROOM - Math.round(band.height) - DECK_TO_INDEX_GAP - indexRowHeight
    : availH - DECK_TO_INDEX_GAP - indexRowHeight;
  // 극단적으로 낮은 뷰포트에서 음수가 되는 것만 막는 하한. 정상 뷰포트에서는 안 걸린다
  cardH = Math.max(200, cardH);

  let preview = cardH - DECK_HEADER_H - DECK_META_H;
  let cardW = (preview * 16) / 9;
  if (cardW > DECK_CARD_MAX_W) {
    // 폭 상한이 물리면 폭에서 16:9 프리뷰 높이를 되돌린다.
    // 안 그러면 카드 아래에 빈 띠가 생긴다
    cardW = DECK_CARD_MAX_W;
    preview = (cardW * 9) / 16;
    cardH = preview + DECK_HEADER_H + DECK_META_H;
  }

  return {
    isDeck,
    availH,
    indexRowHeight,
    bandLines: band.lines,
    bandHeight: band.height,
    cardW,
    cardH,
    preview,
  };
}

// translateZ만 설정하고 scale은 쓰지 않는다. 원근이 스케일을 만든다.
// 투영 때문에 화면 좌표가 s배로 줄어드므로 설정값은 목표 화면값을 s로 나눈 것이다.
export function slotTransform(k: number, cardW: number, cardH: number): string {
  const s = DECK_SLOT_SCALE[k];
  const z = -DECK_PERSPECTIVE * (1 / s - 1);
  const x = (DECK_EXPOSURE_X[k] + (cardW * (1 - s)) / 2) / s;
  const y = (DECK_EXPOSURE_Y[k] + (cardH * (1 - s)) / 2) / s;
  return `translate3d(${x.toFixed(2)}px, ${(-y).toFixed(2)}px, ${z.toFixed(2)}px)`;
}

// 밴드는 계단의 연장이다. 계단값을 상수로 박지 않고 슬롯 2와 3의 실제 배치
// 차이에서 매번 끌어낸다. 카드 폭이 바뀌면 계단도 같이 바뀌기 때문이다.
export function bandLineRects(geo: DeckGeometry): BandLineRect[] {
  if (geo.bandLines <= 0) return [];

  const yStep = DECK_EXPOSURE_Y[3] - DECK_EXPOSURE_Y[2];
  const xStep = DECK_EXPOSURE_X[3] - DECK_EXPOSURE_X[2];
  const sStep = DECK_SLOT_SCALE[2] - DECK_SLOT_SCALE[3];
  const leftStep = xStep + geo.cardW * sStep;
  const widthStep = geo.cardW * sStep;
  const slot3Left = DECK_EXPOSURE_X[3] + geo.cardW * (1 - DECK_SLOT_SCALE[3]);
  const slot3Width = geo.cardW * DECK_SLOT_SCALE[3];

  const rects: BandLineRect[] = [];
  let cumulative = 0;
  for (let j = 0; j < geo.bandLines; j += 1) {
    cumulative += BAND_BASE_GAP * BAND_RATIO ** j;
    const ratio = cumulative / yStep;
    rects.push({
      left: slot3Left + leftStep * ratio,
      width: slot3Width - widthStep * ratio,
      bottom: Math.max(0, cumulative - 1),
    });
  }
  return rects;
}
