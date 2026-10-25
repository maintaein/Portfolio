// 이름 휠의 드럼 배치와 lg 아래의 가로 끌기 판정(M4 Task 8). React도 DOM도 모르는 순수 함수라 따로 둔다.
//
// 드럼의 정본은 .claude/designRefactoring/optionWheel/optionWheel.tsx의 runFrame(이웃 사이 호의 길이가 줄 높이인 원)이고,
// 생김새의 기준은 사용자가 준 그림이다. 그림은 왼쪽 끝에 붙은 드럼이고 여기는 그것을 좌우로 비춰 오른쪽 끝에 붙인다.
// 이름 하나는 드럼 위의 각도 하나다. 자리(y), 오른쪽 끝으로 휘어 들어가는 정도(x), 크기, 위아래로 눌린 정도, 기울기,
// 번짐, 투명도가 전부 그 각도에서 나온다. 평평한 목록에 기울기만 준 것과 갈리는 지점이 이것이다.

// 이웃 사이 드럼 각. 여섯 이름이면 가장 먼 이름이 75도라 지평선(90도) 바로 앞에서 납작하게 남는다
export const DRUM_STEP_DEG = 15;
// 드럼 반지름에 대한 옆 휨의 깊이. 고른 이름이 프리뷰 쪽으로 부푸는 정도다. 기준 그림에서 두세 칸 먼 이름이 들어가는 폭에 맞췄다
export const DRUM_CURVE = 0.45;
// 앞면에서 멀어지며 작아지는 비율. sin을 따라 앞면 바로 옆부터 줄어 고른 이름이 한눈에 크다
export const DRUM_SHRINK = 0.5;
// 위아래로 눌리는 정도(원근의 단축). 1이면 지평선에서 선이 되고, 0.65면 가장 먼 이름도 글자 모양이 남는다
export const DRUM_SQUASH = 0.65;
// 드럼 각에 대한 글자 기울기의 비. 각도를 그대로 쓰면 먼 이름이 수십 도 누워 읽히지 않는다
export const DRUM_TILT = 0.25;
// 지평선에서의 번짐. 기준 그림처럼 바로 옆 이름부터 살짝 번지고 멀수록 빨리 번진다(sin²)
export const DRUM_BLUR_PX = 7;
// 앞면에서 멀어지며 흐려지는 비율(sin에 곱한다). 기준 그림의 바로 옆 이름이 절반 남짓 밝기다
export const DRUM_FADE = 1.1;
// 투명도의 바닥. 몇 개인지가 이 목록의 정보라 가장 먼 이름도 셀 수 있게 남긴다
export const DRUM_MIN_OPACITY = 0.18;

export interface DrumItem {
  // 오른쪽 끝(흐름 자리)에서의 가로 어긋남. 늘 0 이하이고 고른 이름이 가장 왼쪽이다
  x: number;
  // 드럼 가운데에서의 세로 자리
  y: number;
  // 글자 기울기(도). 위 이름은 +(왼쪽 끝이 들린다), 아래 이름은 -다
  rot: number;
  scale: number;
  scaleY: number;
  opacity: number;
  blur: number;
}

// i번째 이름의 배치. pos는 휠의 지금 자리라 돌아가는 동안 정수가 아니다. 순환하지 않으므로 거리는 i - pos 그대로다.
// count는 가장 먼 이름의 각도를 정해 그 이름이 오른쪽 끝(x 0)에 닿게 한다. rowH가 0이면(아직 못 잰 첫 그림, 숨은 목록)
// 자리를 옮길 근거가 없어 자리·기울기·크기는 항등으로 두고 거리 표현(투명도·번짐)만 남긴다
export function drumItem(i: number, pos: number, count: number, rowH: number): DrumItem {
  const step = (DRUM_STEP_DEG * Math.PI) / 180;
  const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (i - pos) * step));
  const cos = Math.cos(ang);
  const sin = Math.abs(Math.sin(ang));
  const opacity = Math.max(DRUM_MIN_OPACITY, 1 - DRUM_FADE * sin);
  const blur = DRUM_BLUR_PX * sin * sin;
  if (!(rowH > 0)) return { x: 0, y: 0, rot: 0, scale: 1, scaleY: 1, opacity, blur };
  const R = rowH / step;
  const far = Math.cos(Math.min(Math.PI / 2, (count - 1) * step));
  const scale = 1 - DRUM_SHRINK * sin;
  return {
    x: -R * DRUM_CURVE * (cos - far),
    y: R * Math.sin(ang),
    // + 0은 앞면의 -0을 0으로 만든다. 문자열로 찍으면 같지만 값 비교에서 갈린다
    rot: (-DRUM_TILT * ang * 180) / Math.PI + 0,
    scale,
    scaleY: scale * (1 - DRUM_SQUASH * (1 - cos)),
    opacity,
    blur,
  };
}

// 탭과 끌기의 경계. 이보다 덜 움직였으면 탭이고 상세를 연다
export const SWIPE_SLOP_PX = 10;
// 이만큼 끌면 느려도 넘어간다
export const SWIPE_DISTANCE_PX = 56;
// 짧게 튕긴 손가락의 속도(px/ms). 같은 방향이면 거리가 짧아도 넘어간다
export const SWIPE_FLICK_PX_MS = 0.4;

// 끌기를 놓았을 때 갈 프로젝트. 왼쪽으로 끌면 다음, 오른쪽이면 이전이다. 넘어가지 않으면 null이고, 끝에서는 순환하지 않는다
export function swipeTarget(dx: number, velocity: number, index: number, count: number): number | null {
  if (Math.abs(dx) < SWIPE_SLOP_PX) return null;
  const flick = Math.abs(velocity) >= SWIPE_FLICK_PX_MS && Math.sign(velocity) === Math.sign(dx);
  if (Math.abs(dx) < SWIPE_DISTANCE_PX && !flick) return null;
  const next = index + (dx < 0 ? 1 : -1);
  return next >= 0 && next < count ? next : null;
}

// 끄는 동안 프리뷰가 손가락을 따라가는 거리. 넘어갈 곳이 있으면 1/3쯤 저항을 받고, 끝에서 바깥으로 끌면 40px로 다가가는
// 고무줄이다. 끌 수 있는 쪽인지가 손에 먼저 느껴진다
export function swipeOffset(dx: number, index: number, count: number): number {
  const blocked = dx < 0 ? index >= count - 1 : index <= 0;
  if (!blocked) return dx * 0.35;
  return Math.sign(dx) * 40 * (1 - Math.exp(-Math.abs(dx) / 120));
}
