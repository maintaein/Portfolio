import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectQuality, FrameQualityGovernor } from '@/lib/deviceQuality';
import type { QualityTier } from '@/lib/deviceQuality';

beforeEach(() => {
  vi.unstubAllGlobals();
});

function stubNavigator(props: Record<string, unknown>) {
  vi.stubGlobal('navigator', { ...props });
}

describe('detectQuality', () => {
  it('배터리 100%면 low로 떨어지지 않는다 (C1 회귀)', async () => {
    // 원 버그: getBattery()가 Promise를 반환하는데 그걸 그대로 truthy 검사해서
    // Chrome 사용자는 배터리 상태와 무관하게 항상 low를 받았다.
    stubNavigator({
      getBattery: () => Promise.resolve({ level: 1.0, charging: true }),
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });
    // 구멍3: not.toBe('low')는 'medium'이어도 통과해버린다. (8,8) 하드웨어 +
    // 배터리 무관 조건이면 구현상 반드시 'high'이므로 값을 못박는다.
    await expect(detectQuality()).resolves.toBe('high');
  });

  it('배터리 20% 미만이면 low', async () => {
    stubNavigator({
      getBattery: () => Promise.resolve({ level: 0.1, charging: false }),
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });
    await expect(detectQuality()).resolves.toBe('low');
  });

  it('충전 중이면 배터리가 낮아도 low가 아니다', async () => {
    stubNavigator({
      getBattery: () => Promise.resolve({ level: 0.1, charging: true }),
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });
    // 구멍3: 충전 중이면 배터리 신호가 완전히 무시되므로 (8,8) 하드웨어는
    // 정확히 'high'다.
    await expect(detectQuality()).resolves.toBe('high');
  });

  it('getBattery가 없어도 던지지 않는다 (Safari/Firefox)', async () => {
    stubNavigator({ hardwareConcurrency: 8, deviceMemory: 8 });
    await expect(detectQuality()).resolves.toBe('high');
  });

  it('getBattery가 거부해도 던지지 않는다', async () => {
    stubNavigator({
      getBattery: () => Promise.reject(new Error('denied')),
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });
    await expect(detectQuality()).resolves.toBe('high');
  });

  it('코어가 적으면 등급이 내려간다', async () => {
    stubNavigator({ hardwareConcurrency: 2, deviceMemory: 2 });
    await expect(detectQuality()).resolves.toBe('low');
  });

  it('고사양이면 high', async () => {
    stubNavigator({ hardwareConcurrency: 12, deviceMemory: 8 });
    await expect(detectQuality()).resolves.toBe('high');
  });

  // --- 구멍2: 등급 경계가 하나도 고정되지 않았던 지점. cores<=2/memory<=2(low)와
  // cores<=4/memory<=4(medium) 두 경계 각각을 양옆 한 쌍으로, cores·memory가
  // 서로 독립적으로 등급을 끌어내리는지도 함께 확인한다.
  it('cores=2면 memory가 높아도 low (cores 단독 low 경계)', async () => {
    stubNavigator({ hardwareConcurrency: 2, deviceMemory: 8 });
    await expect(detectQuality()).resolves.toBe('low');
  });

  it('cores=3이면 low가 아니라 medium (cores<=2 경계 바로 위)', async () => {
    stubNavigator({ hardwareConcurrency: 3, deviceMemory: 8 });
    await expect(detectQuality()).resolves.toBe('medium');
  });

  it('memory=2면 cores가 높아도 low (memory 단독 low 경계)', async () => {
    stubNavigator({ hardwareConcurrency: 8, deviceMemory: 2 });
    await expect(detectQuality()).resolves.toBe('low');
  });

  it('memory=3이면 low가 아니라 medium (memory<=2 경계 바로 위)', async () => {
    stubNavigator({ hardwareConcurrency: 8, deviceMemory: 3 });
    await expect(detectQuality()).resolves.toBe('medium');
  });

  it('cores=4면 memory가 높아도 medium (cores 단독 medium 경계)', async () => {
    stubNavigator({ hardwareConcurrency: 4, deviceMemory: 8 });
    await expect(detectQuality()).resolves.toBe('medium');
  });

  it('cores=5면 medium이 아니라 high (cores<=4 경계 바로 위)', async () => {
    stubNavigator({ hardwareConcurrency: 5, deviceMemory: 8 });
    await expect(detectQuality()).resolves.toBe('high');
  });

  it('memory=4면 cores가 높아도 medium (memory 단독 medium 경계)', async () => {
    stubNavigator({ hardwareConcurrency: 8, deviceMemory: 4 });
    await expect(detectQuality()).resolves.toBe('medium');
  });

  it('memory=5면 medium이 아니라 high (memory<=4 경계 바로 위)', async () => {
    stubNavigator({ hardwareConcurrency: 8, deviceMemory: 5 });
    await expect(detectQuality()).resolves.toBe('high');
  });

  // --- 구멍4: hardwareConcurrency·deviceMemory는 브라우저에 따라 없을 수
  // 있다(특히 Safari의 deviceMemory). '?? 4' 폴백이 실제로 4인지, 하나만
  // 없을 때도 폴백이 적용되는지 확정한다. iOS 사용자 전체의 기본값이 걸린
  // 표제급 계약이다.
  it('둘 다 없으면 폴백 4/4로 medium', async () => {
    stubNavigator({});
    await expect(detectQuality()).resolves.toBe('medium');
  });

  it('hardwareConcurrency만 없으면 4로 폴백한다', async () => {
    stubNavigator({ deviceMemory: 8 });
    await expect(detectQuality()).resolves.toBe('medium');
  });

  it('deviceMemory만 없으면 4로 폴백한다', async () => {
    stubNavigator({ hardwareConcurrency: 8 });
    await expect(detectQuality()).resolves.toBe('medium');
  });
});

describe('FrameQualityGovernor', () => {
  const GOOD_INTERVAL_MS = 16.7; // 60fps 프레임 간격
  const BAD_INTERVAL_MS = 50; // 33.3ms 임계를 넉넉히 초과

  /**
   * governor에 timestamp를 순차로 흘려보낸다. 스펙상 첫 record()는 기준
   * 시각만 세우고 interval을 만들지 않으므로, 반환 배열의 길이는
   * intervalsMs.length + 1이고 results[i + 1]이 intervalsMs[i]까지
   * 반영된 판정 결과다.
   */
  function feed(governor: FrameQualityGovernor, intervalsMs: number[]): Array<QualityTier | null> {
    const results: Array<QualityTier | null> = [];
    let t = 0;
    results.push(governor.record(t));
    for (const interval of intervalsMs) {
      t += interval;
      results.push(governor.record(t));
    }
    return results;
  }

  it('나쁜 120프레임 window 두 번 연속이면 한 단계만 낮춘다', () => {
    const governor = new FrameQualityGovernor('high');
    const intervals = new Array(480).fill(BAD_INTERVAL_MS);
    const results = feed(governor, intervals);

    // window1(120개) 종료 시점: 연속 1회뿐이라 아직 강등 없음 (뮤테이션 k 대응).
    expect(results[120]).toBeNull();
    // window2(240개) 종료 시점: 연속 2회 충족, high -> medium 한 단계만.
    expect(results[240]).toBe('medium');
    // window3(360개) 종료 시점: 강등 직후 카운터가 리셋됐으므로 아직 1회뿐.
    expect(results[360]).toBeNull();
    // window4(480개) 종료 시점: 다시 연속 2회 충족, medium -> low 한 단계만
    // (high에서 바로 low로 건너뛰지 않는다 — 뮤테이션 m 대응).
    expect(results[480]).toBe('low');
  });

  it('중간의 정상 window가 연속 실패 횟수를 초기화한다', () => {
    const governor = new FrameQualityGovernor('high');
    const intervals = [
      ...new Array(120).fill(BAD_INTERVAL_MS), // window1: 나쁨 (카운터 1)
      ...new Array(120).fill(GOOD_INTERVAL_MS), // window2: 정상 (카운터 리셋)
      ...new Array(120).fill(BAD_INTERVAL_MS), // window3: 나쁨 (카운터 1)
      ...new Array(120).fill(BAD_INTERVAL_MS), // window4: 나쁨 (카운터 2 -> 강등)
    ];
    const results = feed(governor, intervals);

    expect(results[120]).toBeNull();
    expect(results[240]).toBeNull(); // 정상 window라 리셋됨
    // 리셋 후 첫 나쁜 window, 아직 1회뿐. 리셋이 안 됐다면(뮤테이션 l) 여기서
    // 이미 강등됐어야 한다(window1의 1회 + window3의 1회 = 2회).
    expect(results[360]).toBeNull();
    expect(results[480]).toBe('medium');
  });

  it('resetWindow 뒤 첫 긴 delta를 표본에 넣지 않는다', () => {
    const governor = new FrameQualityGovernor('high');
    governor.record(0);
    governor.resetWindow(); // hidden -> resume 경계를 흉내

    const results: Array<QualityTier | null> = [];
    let t = 100_000; // 탭이 오래 백그라운드에 있었다고 가정한 큰 점프
    results.push(governor.record(t)); // 이 큰 점프가 interval로 잡히면 안 된다

    for (let i = 0; i < 240; i++) {
      t += BAD_INTERVAL_MS;
      results.push(governor.record(t));
    }

    // 큰 점프가 표본에서 제외됐다면 두 window(240개)를 온전히 채우는 데
    // 정확히 240번의 명시적 record가 필요하다 = results[240]에서 강등.
    // 점프가 첫 표본으로 새어 들어갔다면(뮤테이션 n) window 경계가 하나
    // 당겨져 results[239]에서 이미 강등됐을 것이다.
    expect(results[239]).toBeNull();
    expect(results[240]).toBe('medium');
  });

  it('좋은 frame이 이어져도 세션 중 자동 승급하지 않는다', () => {
    const governor = new FrameQualityGovernor('medium');
    const intervals = new Array(360).fill(GOOD_INTERVAL_MS); // 정상 window 3개 연속
    const results = feed(governor, intervals);

    // 뮤테이션 p(승급 허용) 대응: 정상 window가 아무리 이어져도 null만 나와야 한다.
    expect(results[120]).toBeNull();
    expect(results[240]).toBeNull();
    expect(results[360]).toBeNull();
  });

  it('low에서는 추가 강등 신호를 만들지 않는다', () => {
    const governor = new FrameQualityGovernor('low');
    const intervals = new Array(240).fill(BAD_INTERVAL_MS); // 나쁜 window 2연속
    const results = feed(governor, intervals);

    // 뮤테이션 o 대응: 강등 조건을 충족해도 low 밑은 없으므로 항상 null.
    expect(results[120]).toBeNull();
    expect(results[240]).toBeNull();
  });

  // --- 구멍5: p95 index가 정의되지 않았던 지점. 정렬된 120개 중 인덱스
  // 113(0-based, nearest-rank 방식 ceil(0.95*120)-1)을 읽는다고 확정했다.
  // 인덱스가 1이라도 밀리면 판정이 뒤집히는 두 fixture로 양쪽 경계를 고정한다
  // (뮤테이션 h 대응). 두 테스트 모두 "정확히 임계값(33.3)"과 "임계값을 살짝
  // 초과(34)"를 함께 쓰므로 구멍6의 '>' vs '>=' 방향(계획 원문 "초과")도
  // 같이 고정한다.
  it('p95 index가 113에서 114로(위로) 밀리면 판정이 뒤집힌다', () => {
    const governor = new FrameQualityGovernor('high');
    // 인덱스 0~113(114개)은 정확히 임계값(33.3, 초과 아님), 인덱스 114~119
    // (6개)는 임계 초과(100). 실제 index(113)로 읽으면 p95=33.3(초과 아님)
    // → 나쁜 window가 아니어야 한다.
    //
    // 부동소수점 주의: 33.3을 여러 번 누적 덧셈하면 IEEE754 반올림 오차가
    // 쌓여 33.30000000000001처럼 일부 값이 임계를 실제로 넘어버린다(직접
    // 확인함). 그래서 33.3은 배열의 "첫 원소"로만 두어 매 window의 시작
    // 기준(0)에서 정확히 한 번만 더해지게 한다 — 0에 33.3을 더하는 단일
    // 덧셈은 드리프트가 없다. 나머지 값(10, 100)은 정수라 어떤 순서로
    // 누적돼도 드리프트가 임계와 절대 섞이지 않는다.
    const window = [33.3, ...new Array(113).fill(10), ...new Array(6).fill(100)];

    const results: Array<QualityTier | null> = [];
    let t = 0;
    results.push(governor.record(t)); // 자유 호출: 기준 0

    for (const interval of window) {
      t += interval;
      results.push(governor.record(t));
    }

    governor.resetWindow(); // window2도 기준 0에서 다시 시작하기 위해
    t = 0;
    results.push(governor.record(t)); // 자유 호출: 기준 0

    for (const interval of window) {
      t += interval;
      results.push(governor.record(t));
    }

    // 나쁜 window로 오판되면(index가 114로 밀렸을 때) 2 window 연속으로 강등된다.
    expect(results[results.length - 1]).toBeNull();
  });

  it('p95 index가 113에서 112로(아래로) 밀리면 판정이 뒤집힌다', () => {
    const governor = new FrameQualityGovernor('high');
    // 인덱스 0~112(113개)는 임계 아래(10, 정수라 드리프트 걱정 없음),
    // 인덱스113(실제 p95 index)은 임계를 살짝 초과하는 34(정수), 인덱스
    // 114~119(6개)는 크게 초과(100). 실제 index(113)로 읽으면 p95=34(초과)
    // → 나쁜 window여야 강등된다. index가 112로 밀리면 p95=10(초과 아님)이
    // 되어 영원히 강등되지 않는다.
    const window = [...new Array(113).fill(10), 34, ...new Array(6).fill(100)];
    const intervals = [...window, ...window];
    const results = feed(governor, intervals);

    expect(results[240]).toBe('medium');
  });

  // --- 구멍6: window 크기 120 고정. window가 60이면(뮤테이션 j) 이 120개
  // 안에서 이미 두 window(60+60)가 지나 강등됐을 것이다.
  it('window 크기는 120으로 고정이다 (120개로는 아직 1개 window뿐)', () => {
    const governor = new FrameQualityGovernor('high');
    const intervals = new Array(120).fill(BAD_INTERVAL_MS);
    const results = feed(governor, intervals);

    expect(results[120]).toBeNull();
  });

  // --- 구멍6: window 미충족(120 미만)이면 데이터가 아무리 나빠도 판정하지 않는다.
  it('window가 120개 미만이면 아무리 나빠도 판정하지 않는다', () => {
    const governor = new FrameQualityGovernor('high');
    const intervals = new Array(119).fill(1000); // 극단적으로 나쁜 값이라도
    const results = feed(governor, intervals);

    expect(results.every((r) => r === null)).toBe(true);
  });
});
