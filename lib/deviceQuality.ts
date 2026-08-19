export type QualityTier = 'high' | 'medium' | 'low';

interface BatteryLike {
  level: number;
  charging: boolean;
}

// getBattery는 Chromium 계열에만 있다. Safari·Firefox에는 없고,
// 있어도 거부될 수 있다. 어느 경우든 던지지 않고 null을 준다.
async function readBattery(): Promise<BatteryLike | null> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
  if (typeof nav.getBattery !== 'function') return null;

  try {
    return await nav.getBattery();
  } catch {
    return null;
  }
}

/**
 * 코어 수는 화면이 폰인지 알려주지 않는다.
 *
 * Galaxy S25는 hardwareConcurrency 8, deviceMemory 8이라 아래 규칙만으로는
 * high가 되고 네이티브 DPR 3.0을 받는다. 그런데 실기기 측정에서 DPR 3.0은
 * 거부됐고 DPR 1.0이 화질·성능 모두 최선이었다(2026-08-04-spike-verdict.md의
 * 2026-08-19 절). 셰이딩할 픽셀 수가 DPR의 제곱으로 늘기 때문이다.
 *
 * 두 조건을 함께 요구한다. 고밀도만 보면 레티나 데스크톱이 걸리는데 그쪽은
 * GPU가 충분하고 실측에서 네이티브가 양호했다. 거친 포인터만 보면 저밀도
 * 태블릿까지 내려가는데 그건 DPR 비용 문제가 아니다.
 */
function isHighDensityTouch(): boolean {
  if (typeof window === 'undefined') return false;

  // matchMedia가 없는 환경에서는 하드웨어 기준으로 폴백한다 — 던지지 않는다.
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const highDensity = (window.devicePixelRatio ?? 1) >= 2;

  return coarsePointer && highDensity;
}

/**
 * 기기 등급을 판정한다.
 *
 * C1 회귀 주의: 원 코드는 getBattery()가 반환한 Promise를 그대로 truthy
 * 검사해서 Chrome 사용자가 배터리 100%여도 항상 최저 등급을 받았다.
 * 반드시 await 해서 level을 읽는다.
 */
export async function detectQuality(): Promise<QualityTier> {
  const nav = navigator as Navigator & { deviceMemory?: number };

  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;

  const battery = await readBattery();
  // 충전 중이면 배터리 잔량은 무시한다. 벽에 꽂혀 있는데 품질을 낮출 이유가 없다.
  const batterySaver = battery !== null && !battery.charging && battery.level < 0.2;

  if (batterySaver) return 'low';
  if (cores <= 2 || memory <= 2) return 'low';
  if (cores <= 4 || memory <= 4) return 'medium';
  // 상한을 medium으로 내리기만 한다. 위 규칙이 이미 low로 판정한 기기를
  // 여기서 되올리지 않는다 — 이 함수는 최초 품질의 상한만 정한다.
  if (isHighDensityTouch()) return 'medium';
  return 'high';
}

// ---- FrameQualityGovernor ----
// Hyperspeed의 기존 tick timestamp를 받아 실제 프레임 성능을 감시하고, 지속적으로
// 나쁘면 detectQuality()가 정한 상한을 뒤늦게 한 단계씩 낮춘다. 별도 rAF를 새로
// 만들지 않는다. DOM·React·Three.js를 import하지 않는 순수 TypeScript라 timestamp
// fixture만으로 결정적으로 테스트할 수 있다.

const GOVERNOR_WINDOW_SIZE = 120;
const GOVERNOR_BAD_FRAME_MS = 33.3;
const GOVERNOR_CONSECUTIVE_BAD_WINDOWS_REQUIRED = 2;

// p95 index 결정(계획 미지정, 여기서 확정): nearest-rank 방식, 0-based로
// ceil(0.95 * N) - 1. N=120이면 113. 정렬된 배열에서 인덱스 0~113(114개,
// 전체의 95%)이 이 값 이하이고, 나머지 인덱스 114~119(6개, 5%)가 이 값보다
// 크거나 같다 — "표본의 95%가 이 값 이하"라는 표준 percentile 정의를 만족한다.
const GOVERNOR_P95_INDEX = Math.ceil(0.95 * GOVERNOR_WINDOW_SIZE) - 1; // 113

// low < medium < high. 강등은 이 배열에서 한 칸 왼쪽으로만 이동한다.
const TIER_DOWNGRADE_ORDER: readonly QualityTier[] = ['low', 'medium', 'high'];

export class FrameQualityGovernor {
  private tier: QualityTier;
  private intervals: number[] = [];
  private lastTimestamp: number | null = null;
  private consecutiveBadWindows = 0;

  constructor(initialTier: QualityTier) {
    this.tier = initialTier;
  }

  record(timestamp: number): QualityTier | null {
    // 생성 직후 또는 resetWindow() 직후의 첫 record는 기준 시각만 세우고
    // interval을 만들지 않는다(계획 요구사항). lastTimestamp가 없으면 이번
    // timestamp와의 차이를 표본에 넣지 않는다.
    if (this.lastTimestamp !== null) {
      this.intervals.push(timestamp - this.lastTimestamp);
    }
    this.lastTimestamp = timestamp;

    if (this.intervals.length < GOVERNOR_WINDOW_SIZE) {
      // window 미충족: 판정하지 않는다(계획 미지정, 여기서 확정). 120개를
      // 다 모으기 전에 일부만 보고 강등하면 짧은 튐 하나에도 오탐할 수 있다.
      return null;
    }

    const sorted = [...this.intervals].sort((a, b) => a - b);
    const p95 = sorted[GOVERNOR_P95_INDEX];
    // 판정 후에는 좋은 window든 나쁜 window든 버퍼를 비운다. window는 겹치지
    // 않는 연속 배치(batch) 단위로 판정한다(계획 미지정, 여기서 확정) —
    // 그래야 "몇 번째 window인가"가 결정적이라 테스트로 고정할 수 있다.
    this.intervals = [];

    // 계획 원문이 "초과"라고 썼으므로 p95가 임계와 정확히 같으면 나쁜
    // window로 치지 않는다(엄격한 '>'; 계획 미지정, 여기서 확정).
    const isBadWindow = p95 > GOVERNOR_BAD_FRAME_MS;

    if (!isBadWindow) {
      this.consecutiveBadWindows = 0;
      return null;
    }

    this.consecutiveBadWindows += 1;
    if (this.consecutiveBadWindows < GOVERNOR_CONSECUTIVE_BAD_WINDOWS_REQUIRED) {
      return null;
    }

    // 강등 조건(연속 2회) 충족. 실제로 tier가 내려가든(정상 tier) low라서
    // 못 내려가든 카운터를 0으로 되돌린다(계획 미지정, 여기서 확정) —
    // 리셋하지 않으면 강등 직후에도 "연속 2회 충족" 상태가 남아 바로 다음
    // window 단 1회만 나빠도 또 강등되어, "한 단계만 낮춘다"는 계획 문구가
    // window 단위로는 지켜지지 않게 된다.
    this.consecutiveBadWindows = 0;

    if (this.tier === 'low') {
      // low 아래로는 내려가지 않는다 — 어떤 신호도 만들지 않는다.
      return null;
    }

    const currentIndex = TIER_DOWNGRADE_ORDER.indexOf(this.tier);
    const newTier = TIER_DOWNGRADE_ORDER[currentIndex - 1];
    this.tier = newTier;
    return newTier;
  }

  resetWindow(): void {
    // pause/hidden/resume 경계에서 실제 렌더 간격이 아닌 긴 delta가 다음
    // record()의 interval로 잡히는 것을 막는다. lastTimestamp를 지워서
    // resetWindow 직후 첫 record()가 interval을 만들지 않게 한다.
    this.intervals = [];
    this.lastTimestamp = null;
    // 연속 강등 카운터는 건드리지 않는다(계획 미지정, 여기서 확정): 탭
    // 전환 같은 짧은 pause는 기기 성능 이력과 무관한 이벤트이므로, 그
    // 직전까지 쌓인 "나쁜 window" 판정 이력을 지울 이유가 없다 — 오염된
    // 측정 데이터만 버리고 판정 상태는 유지한다.
  }
}
