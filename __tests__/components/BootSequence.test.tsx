import { readFileSync } from 'node:fs';
import path from 'node:path';
import { useRef } from 'react';
import { renderToString } from 'react-dom/server';
import { act, render, screen } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import BootSequence, {
  type BootSequenceProps,
} from '@/components/sections/BootSequence';
import Navigation from '@/components/blocks/Navigation';
import { gsap } from '@/lib/gsap';
import { NAV_ITEMS, PERSONAL_INFO } from '@/lib/constants';

const bootSequencePath = path.resolve(
  process.cwd(),
  'components/sections/BootSequence/index.tsx'
);
const DESIGN_TOKENS_CSS = readFileSync(
  path.resolve(process.cwd(), 'styles/design-tokens.css'),
  'utf8'
);

// styles/sectionVisibility.test.ts와 같은 패턴 — jsdom은 미디어쿼리를 계산하지
// 못하므로 CSS 원문을 정규식으로 읽어 "미디어쿼리 밖 = 최종 상태,
// no-preference 안 = pre-boot 은닉 상태"를 소스 수준에서 고정한다.
function unconditionalRuleBody(selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return DESIGN_TOKENS_CSS.match(
    new RegExp(`^  ${escaped}\\s*\\{([\\s\\S]*?)^  \\}`, 'm')
  )?.[1];
}

function noPreferenceOverrideBody(selector: string): string | undefined {
  const mediaBlock = DESIGN_TOKENS_CSS.match(
    /@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n {2}\}\n/
  )?.[1];
  if (!mediaBlock) throw new Error('no-preference 미디어 블록을 찾지 못했다');

  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return mediaBlock.match(
    new RegExp(`^ {4}${escaped}\\s*\\{([\\s\\S]*?)^ {4}\\}`, 'm')
  )?.[1];
}

function Harness({
  active = 'overview',
  routeResolved = true,
  motionReady = true,
  reducedMotion = false,
  onStart = vi.fn(),
  onNameRevealed,
}: Partial<BootSequenceProps>) {
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {/* 실제 Navigation을 쓰지 않고 최소한의 wordmark 자리만 재현한다 —
          hero/compact 스타일은 Navigation 자신의 관심사고, 여기 관심사는
          BootSequence가 이 노드를 어떻게 애니메이션하는지다. */}
      <div>
        <button ref={wordmarkRef} data-testid="wordmark">
          KIM TAEIN
        </button>
      </div>
      <BootSequence
        active={active}
        routeResolved={routeResolved}
        motionReady={motionReady}
        reducedMotion={reducedMotion}
        wordmarkRef={wordmarkRef}
        onStart={onStart}
        onNameRevealed={onNameRevealed}
      />
    </>
  );
}

function SsrHarness() {
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  const wordmarkScaleRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <Navigation
        items={NAV_ITEMS}
        active="overview"
        onNavigate={() => {}}
        wordmarkRef={wordmarkRef}
        wordmarkScaleRef={wordmarkScaleRef}
      />
      <BootSequence
        active="overview"
        routeResolved={false}
        motionReady={false}
        reducedMotion={false}
        wordmarkRef={wordmarkRef}
        onStart={() => {}}
      />
    </>
  );
}

// BootSequence는 wordmarkRef가 가리키는 노드에 opacity만 애니메이션한다
// (시안 스윕은 3라운드에서, scale·blur의 원경감은 파티클 형성 브리프(4차)에서
// 제거했다). 위 Harness의 가짜 <button>에는 data-wordmark-mode가 없어 CSS의
// pre-boot opacity 오버라이드가 걸리지 않으므로, 그 결합(data-wordmark-mode=
// 'hero' ↔ opacity)을 검증하려면 실제 Navigation을 함께 렌더해야 한다.
function CompositionHarness({
  active = 'overview',
  routeResolved = true,
  motionReady = true,
  reducedMotion = false,
  onStart = vi.fn(),
}: Partial<BootSequenceProps>) {
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  const wordmarkScaleRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <Navigation
        items={NAV_ITEMS}
        active={active}
        onNavigate={() => {}}
        wordmarkRef={wordmarkRef}
        wordmarkScaleRef={wordmarkScaleRef}
      />
      <BootSequence
        active={active}
        routeResolved={routeResolved}
        motionReady={motionReady}
        reducedMotion={reducedMotion}
        wordmarkRef={wordmarkRef}
        onStart={onStart}
      />
    </>
  );
}

let timelineSpy: MockInstance<typeof gsap.timeline>;
let rafSpy: MockInstance<typeof window.requestAnimationFrame>;

// GSAP timeline은 만들어지면 자동재생을 위해 자체 ticker가 requestAnimationFrame을
// 예약한다. real timer를 그대로 두면 그 콜백이 테스트 사이 경계를 넘어
// 비동기로 발화해 나중 테스트(특히 "rAF 0개" 게이트 테스트)의 rafSpy를
// 오염시킬 수 있다. fake timer를 걸어두되 절대 진행시키지 않는다 —
// 진행 수단은 오직 tl.seek()뿐이다(브리프가 금지한 것은
// vi.advanceTimersByTime()로 "진행"시키는 것이지, 잔여 실 타이머 발화를
// 막기 위해 fake timer를 까는 것 자체가 아니다). afterEach에서 걸린 채로
// 남은 fake timer를 전부 버리고 real timer로 복원한다.
// 이 파일 대부분의 테스트는 파티클 형성 자체를 검증 대상으로 삼지 않는다 —
// jsdom 기본값(getContext → null)에 맡기면 "not implemented" 경고가 매
// 테스트마다 콘솔에 찍히므로 명시적으로 null을 반환해 조용히 "캔버스 없음"
// 경로를 taken한다(HyperspeedApi.test.tsx와 같은 패턴). 이것은 동시에
// "파티클 캔버스가 실패해도 이름은 보인다"는 8번째 폴백 경로를 이 파일의
// 거의 모든 테스트가 이미 통과하고 있다는 뜻이기도 하다 — DOM 워드마크의
// opacity 트윈이 파티클 성공 여부와 무관하게 독립적으로 동작하기 때문이다.
// 파티클이 실제로 "성공"하는 경로는 별도 describe에서 이 mock을
// mockReturnValue(stubContext)로 재정의해 검증한다.
let getContextSpy: MockInstance<typeof HTMLCanvasElement.prototype.getContext>;

beforeEach(() => {
  vi.useFakeTimers();
  timelineSpy = vi.spyOn(gsap, 'timeline');
  rafSpy = vi.spyOn(window, 'requestAnimationFrame');
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(null);
});

afterEach(() => {
  timelineSpy.mockRestore();
  rafSpy.mockRestore();
  getContextSpy.mockRestore();
  vi.useRealTimers();
});

function capturedTimeline(): gsap.core.Timeline {
  const result = timelineSpy.mock.results[0];
  if (!result) throw new Error('gsap.timeline()이 호출되지 않았다');
  return result.value as gsap.core.Timeline;
}

// BootSequence는 이제 useLayoutEffect 안에서 import('@/lib/gsap')을 동적으로
// 부른 뒤 그 결과로 timeline을 만든다(gsap-lazy-brief.md). render() 직후
// gsap.timeline()이 이미 호출돼 있다고 가정할 수 없으므로, 이 promise가
// 만드는 마이크로태스크 체인만 흘려보낸다. vi.advanceTimersByTimeAsync(0)은
// 시간을 진행시키지 않는다 — 위 주석이 금지한 "vi.advanceTimersByTime()으로
// 부팅 안무 자체를 진행시키는 것"과는 다르다. 안무를 진행시키는 수단은
// 여전히 tl.seek()뿐이다.
async function flushGsapImport() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('BootSequence LCP 계약', () => {
  it('이름이 SSR HTML에 존재한다', () => {
    const html = renderToString(<SsrHarness />);
    expect(html).toContain('KIM TAEIN');
  });

  // 뒤집힌 계약(터널 진입 브리프 3절) — 사용자가 "opacity: 0으로 시작하지
  // 않는다"를 폐기하기로 결정했다. "광선을 타고 가다가 이름에 닿는다"를
  // 위해 이름은 이제 no-preference에서 opacity 0으로 시작해 도착 시점에
  // 1이 된다. 소유권은 여전히 CSS다 — SSR 마크업 자체에는 인라인 style이
  // 없다(JS 낙관 boolean으로 하면 역방향 플래시가 난다, 계획이 명시적으로
  // 금지). blur와 완전히 같은 패턴이라 같은 헬퍼로 기본 규칙(1)·
  // no-preference 오버라이드(0)를 직접 CSS에서 고정한다.
  it('이름은 opacity 0으로 시작해(CSS 소유) 도착 시점에 1이 된다 — LCP 계약 변경, 뮤테이션 (d)', () => {
    const selector = "[data-wordmark-mode='hero']";
    const base = unconditionalRuleBody(selector);
    expect(base, `${selector} 기본 규칙이 없다`).toBeDefined();
    expect(base).toMatch(/opacity\s*:\s*1\s*;/);

    const override = noPreferenceOverrideBody(selector);
    expect(override, `${selector}의 no-preference 오버라이드가 없다`).toBeDefined();
    expect(override).toMatch(/opacity\s*:\s*0\s*;/);

    // reduce 미디어쿼리 블록 어디에도 이 선택자를 다시 숨기는 규칙이 없어야
    // 한다 — 역방향 플래시 방지(역할·START·blur와 같은 이유).
    const reduceBlocks = DESIGN_TOKENS_CSS.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n {2}\}\n/g
    ) ?? [];
    for (const block of reduceBlocks) {
      expect(block).not.toMatch(/data-wordmark-mode/);
    }

    // SSR 마크업 자체에는 여전히 인라인 style이 없다 — CSS가 소유한다는
    // 계약(JS 낙관 boolean 금지)은 유지된다.
    const html = renderToString(<SsrHarness />);
    const wordmarkMarkup = html.match(
      /<button[^>]*data-testid="wordmark"[^>]*>[\s\S]*?<\/button>/
    )?.[0];
    expect(wordmarkMarkup, 'wordmark 마크업을 SSR HTML에서 찾지 못했다').toBeDefined();
    expect(wordmarkMarkup).not.toMatch(/style=/);
  });

  it('Navigation만 워드마크를 렌더하고 BootSequence는 복제하지 않는다', () => {
    render(<Harness />);
    expect(screen.getAllByTestId('wordmark')).toHaveLength(1);

    // 관찰 채널을 렌더 트리 하나로만 두지 않는다 — BootSequence가
    // aria-hidden·시각적으로 숨긴 복제 노드로 렌더 트리 검사를 우회해도
    // 이 소스 검사는 잡는다.
    const source = readFileSync(bootSequencePath, 'utf8');
    expect(source).not.toMatch(/NAME_EN/);
    expect(source).not.toMatch(/PERSONAL_INFO/);

    // 위 둘로는 부족하다. testid 없는 리터럴 문자열로 이름을 복제하면
    // getAllByTestId도 상수 참조 검사도 통과한다 — 컨트롤러가 실제로 그
    // 뮤테이션을 주입해 확인했다. 렌더된 BootSequence 서브트리에 이름이
    // 없다는 것을 값으로 판정한다. FLIP은 노드가 하나여야 성립하므로
    // 이름이 두 곳에 그려지는 순간 이 Task의 전제가 깨진다.
    expect(screen.getByTestId('boot-sequence')).not.toHaveTextContent(
      PERSONAL_INFO.NAME_EN
    );
  });

  it('애니메이션은 transform·filter·opacity만 쓰고 레이아웃 속성을 건드리지 않는다', () => {
    const source = readFileSync(bootSequencePath, 'utf8');
    const tweenCalls = source.match(/tl\.(?:to|fromTo|set)\([\s\S]*?\);/g) ?? [];

    expect(tweenCalls.length).toBeGreaterThan(0);
    const forbidden = /\b(width|height|top|left|right|bottom|margin|padding|inset)\s*:/;
    for (const call of tweenCalls) {
      expect(call, call).not.toMatch(forbidden);
    }
  });

  it('역할 라벨·START의 pre-boot 상태는 CSS가 소유한다 — 미디어쿼리 밖은 최종 상태, no-preference 안이 은닉 상태', () => {
    for (const selector of ['.boot-role', '.boot-start']) {
      const base = unconditionalRuleBody(selector);
      expect(base, `${selector} 기본 규칙이 없다`).toBeDefined();
      expect(base).toMatch(/opacity\s*:\s*1\s*;/);

      const override = noPreferenceOverrideBody(selector);
      expect(override, `${selector}의 no-preference 오버라이드가 없다`).toBeDefined();
      expect(override).toMatch(/opacity\s*:\s*0\s*;/);
    }

    // reduce 미디어쿼리 블록 어디에도 boot-role/boot-start를 다시 숨기는
    // 규칙이 없어야 한다 — reduce는 오버라이드가 아예 없어서 기본 규칙(최종
    // 상태)이 그대로 적용되는 방식으로 설계했기 때문이다.
    const reduceBlocks = DESIGN_TOKENS_CSS.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n {2}\}\n/g
    ) ?? [];
    for (const block of reduceBlocks) {
      expect(block).not.toMatch(/\.boot-(role|start)\b/);
    }
  });

  it('SSR 출력에서 역할 라벨·START는 boot-role·boot-start 클래스만으로 표시되고 인라인 style로 강제되지 않는다', () => {
    const html = renderToString(<Harness routeResolved={false} motionReady={false} />);
    const role = html.match(/<span[^>]*data-testid="boot-role"[^>]*>/)?.[0];
    const start = html.match(/<button[^>]*data-testid="boot-start"[^>]*>/)?.[0];

    expect(role).toBeDefined();
    expect(start).toBeDefined();
    expect(role).toMatch(/class="[^"]*\bboot-role\b/);
    expect(start).toMatch(/class="[^"]*\bboot-start\b/);
    expect(role).not.toMatch(/style=/);
    expect(start).not.toMatch(/style=/);
  });
});

describe('BootSequence 안무 — 실제 GSAP timeline을 seek()로 전진시킨다', () => {
  // 확정 안무(2차): 이름 0.75~1.30초, 역할 라벨 1.30~1.55초, START
  // 1.55~1.80초. 광선의 개수 램프·감속이 0.90~1.30초에 idle로 정착("도착")
  // 하고, 이름도 같은 1.30초에 도착한 뒤 캡션이 순서대로 붙는다.
  // 경계마다 양옆을 짚어 순서가 뒤집히거나 겹치면 잡히게 한다.
  // 숫자는 일부러 리터럴이다 — 이 일정 자체가 사용자가 승인한 계약이므로
  // 구현 상수를 import하면 일정이 바뀌어도 테스트가 조용히 따라가 버린다.
  it('이름이 정착한 뒤 역할과 START가 순서대로 등장한다', async () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);
    await flushGsapImport();
    const tl = capturedTimeline();
    const role = screen.getByTestId('boot-role');
    const start = screen.getByTestId('boot-start');

    // 역할 라벨 시작 직전. fromTo 트윈은 GSAP 기본값(immediateRender: true)에
    // 따라 생성 즉시 "from" 값(opacity 0)을 렌더하므로 CSS의 pre-boot 은닉과
    // 같은 값이고, 핸드오프에 시각적 점프가 없다.
    act(() => {
      tl.seek(1.04);
    });
    expect(role.style.opacity).toBe('0');
    expect(start.style.opacity).toBe('0');

    // 역할 라벨 완료 = START 시작 지점. 둘이 겹치지 않는다.
    act(() => {
      tl.seek(1.3);
    });
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('0');

    act(() => {
      tl.seek(1.55);
    });
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('1');
  });

  // 파티클 형성 브리프(4차) — scale(0.35→1)·blur(11px→0)로 "멀리서 도착"하던
  // 원경감을 걷어내고 흩어진 파티클이 뭉쳐 이름이 되는 캔버스 연출로
  // 대체했다(아래 "이름 파티클 형성" describe). wordmarkScaleRef prop과
  // scale 트윈이 소스에 재도입되면 FLIP 대상 조상에 다시 transform이
  // 걸릴 위험이 되살아나므로, 소스 수준에서 부재를 못박는다.
  it('wordmarkScaleRef·scale 원경감 트윈이 소스에 남아 있지 않다', () => {
    const source = readFileSync(bootSequencePath, 'utf8');
    expect(source).not.toMatch(/wordmarkScaleRef/);
    expect(source).not.toMatch(/scale\s*:\s*0\.35/);
  });

  // HERO 재순서 이후 계약이 더 강해졌다. 이전에는 fromTo의 immediateRender가
  // from 값(0)을 인라인으로 써서 CSS와 값이 같기만 하면 됐는데, 지금은 핸드오프
  // 전까지 JS가 인라인 style을 아예 건드리지 않는다 — 은닉의 소유권이 온전히
  // CSS([data-wordmark-mode='hero'] no-preference)에 있다. 그래야 GSAP이 언제
  // 로드되든 이름의 겉모습이 달라지지 않는다.
  it('핸드오프 전까지 JS가 이름의 인라인 opacity를 건드리지 않는다 — 은닉은 CSS 소유다', async () => {
    render(<Harness />);
    await flushGsapImport();
    const wordmarkEl = screen.getByTestId('wordmark');

    // 인라인이 비어 있어야 CSS 규칙이 그대로 산다. '0'을 쓰는 것도(값이
    // 같더라도) 소유권을 JS로 가져오는 것이라 여기서 잡는다.
    expect(wordmarkEl.style.opacity).toBe('');
  });

  it('밑줄이 실제로 그려진다(scaleX 트윈이 존재하고 진행된다) — 뮤테이션 (j)', async () => {
    render(<Harness />);
    await flushGsapImport();
    const tl = capturedTimeline();
    const underline = screen.getByTestId('boot-start-underline');

    // fromTo의 immediateRender가 생성 즉시 from 값(scaleX 0)을 적용한다 —
    // 뮤테이션 (j)로 draw 트윈 자체를 지우면 이 값이 계속 빈 문자열로
    // 남아 FAIL한다.
    const atStart = underline.style.transform;
    expect(atStart, '밑줄 트윈의 from 값이 즉시 렌더돼 있어야 한다').not.toBe('');

    act(() => {
      tl.seek(1.9); // UNDERLINE_DRAW_DURATION 종료 시각
    });
    const atEnd = underline.style.transform;
    expect(atEnd).not.toBe('');
    expect(atEnd, '좌→우로 그려지는 중이므로 시작 값과 달라야 한다').not.toBe(atStart);
  });

  // HERO 재순서의 표제 계약. 파티클이 뭉치는 동안 DOM 이름이 함께 페이드인하면
  // "따로 등장하는 두 컴포넌트"로 읽힌다(3차 실기기 피드백). 크로스페이드가
  // 아니라 핸드오프여야 한다 — 핸드오프 직전까지 인라인이 비어 있고(CSS 은닉),
  // 핸드오프 시각에 한 프레임으로 1이 된다. 중간값이 존재하면 그것은 페이드다.
  it('이름은 페이드가 아니라 핸드오프 한 프레임으로 나타난다 — 중간값이 없다', async () => {
    render(<Harness />);
    await flushGsapImport();
    const tl = capturedTimeline();
    const wordmark = screen.getByTestId('wordmark');

    // 핸드오프(0.90) 직전 — JS는 아직 인라인을 건드리지 않았다.
    act(() => {
      tl.seek(0.89);
    });
    expect(wordmark.style.opacity).toBe('');

    // 핸드오프 시각 — 곧바로 1이다. 0과 1 사이 값이 나오면 페이드라는 뜻이라
    // 이 어서션이 잡는다(뮤테이션 (e) — 0.55초 페이드로 되돌리기).
    act(() => {
      tl.seek(0.9, false);
    });
    expect(wordmark.style.opacity).toBe('1');
  });

  it('2초 안에 완료되고 Overview 대형 모드로 잔류한다', async () => {
    render(<Harness />);
    await flushGsapImport();
    const tl = capturedTimeline();
    const wordmark = screen.getByTestId('wordmark');
    const role = screen.getByTestId('boot-role');
    const start = screen.getByTestId('boot-start');

    expect(tl.duration()).toBeCloseTo(2, 5);

    act(() => {
      tl.seek(2);
    });
    expect(wordmark.style.opacity).toBe('1');
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('1');
  });

  // HERO 재순서로 배경이 이름 다음에 오면서, 부팅은 더 이상 씬 준비를
  // 기다리지 않는다(예전 sceneReady prop과 600ms 타임아웃 폴백은 사라졌다).
  // 그래도 그것이 지키던 계약은 그대로 살아 있어야 한다 — 이름이 다른
  // 무엇의 인질이 되면 안 된다. 씬 준비 게이트를 다시 들이면 이 테스트가
  // 잡는다: eligible이 되는 즉시 timeline이 만들어져야 한다.
  it('부팅은 씬 준비를 기다리지 않고 eligible이 되는 즉시 출발한다', async () => {
    render(<Harness />);
    await flushGsapImport();

    // 어떤 지연·타이머도 진행시키지 않았는데 이미 만들어져 있어야 한다.
    expect(timelineSpy).toHaveBeenCalled();

    const tl = capturedTimeline();
    const wordmark = screen.getByTestId('wordmark');

    act(() => {
      tl.seek(2);
    });
    expect(wordmark.style.opacity).toBe('1');
  });

  it('START 클릭은 반짝임이 보일 지연(230ms) 뒤 onStart를 호출한다 — 뮤테이션 (m)', () => {
    // 터널 진입 브리프 4절 — 클릭 즉시 전환되면 "에너지가 차오르는" 반짝임을
    // 볼 시간이 없다. onStart는 지연 뒤에만 불려야 한다(뮤테이션 (k)·(m)).
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);

    act(() => {
      screen.getByTestId('boot-start').click();
    });
    expect(onStart, '클릭 즉시 불리면 안 된다').not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(229);
    });
    expect(onStart, '230ms 전에 불리면 안 된다').not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1); // 총 230ms
    });
    expect(onStart, '230ms 뒤에는 불려야 한다').toHaveBeenCalledTimes(1);
  });

  // 터널 진입 브리프 3절, 7경로 표 — "부팅 도중 언마운트·이탈 → 최종
  // 상태로 정착". opacity 계약 변경 뒤 가장 위험한 경로 중 하나다 —
  // revealFinalState()가 wordmarkEl.style.opacity를 세팅하지 않으면 이름이
  // CSS의 no-preference 은닉(opacity: 0)에 영원히 갇힌다.
  it('unmount 뒤 timeline을 kill하고 이름을 최종 상태(opacity 1)로 정착시킨다 — 자가 뮤테이션(언마운트 cleanup의 revealFinalState 제거)', async () => {
    const { unmount } = render(<Harness />);
    await flushGsapImport();
    const tl = capturedTimeline();
    const killSpy = vi.spyOn(tl, 'kill');
    const wordmark = screen.getByTestId('wordmark');

    unmount();
    expect(killSpy).toHaveBeenCalledTimes(1);
    // 브리프의 (e)는 GSAP 로드 "실패"(.catch) 경로의 revealFinalState() 호출
    // 제거를 가리킨다 — 이 테스트는 다른 호출부(effect cleanup, 언마운트·이탈
    // 공용)를 겨눈 자가 발견 뮤테이션이다. revealFinalState()에서
    // wordmarkEl.style.opacity 대입을 지우면 이 값이 ''로 남아 FAIL한다.
    expect(wordmark.style.opacity).toBe('1');
  });
});

describe('BootSequence 게이트 — reduced-motion·routeResolved·motionReady', () => {
  // 7경로 표 — "reducedMotion = true → 첫 프레임부터 보인다(부팅 없음)".
  // JS가 인라인 opacity를 전혀 건드리지 않아야 CSS의 reduce 분기(오버라이드
  // 없음 = 기본 규칙 opacity:1)가 최초 페인트부터 그대로 적용된다.
  it('reduced-motion이면 부팅을 건너뛰고 즉시 완료한다(timeline·rAF 0개) — 이름은 CSS가 처음부터 보여준다', () => {
    render(<Harness reducedMotion />);

    expect(timelineSpy).not.toHaveBeenCalled();
    expect(rafSpy).not.toHaveBeenCalled();

    const role = screen.getByTestId('boot-role');
    const start = screen.getByTestId('boot-start');
    const wordmark = screen.getByTestId('wordmark');
    // JS가 인라인 스타일을 전혀 건드리지 않는다 — CSS(.boot-role/.boot-start/
    // [data-wordmark-mode='hero'] 기본 규칙)가 최종 상태를 처음부터 보여준다.
    expect(role.style.opacity).toBe('');
    expect(start.style.opacity).toBe('');
    expect(wordmark.style.opacity).toBe('');
  });

  // 7경로 표 — "motionReady = false → 보인다". JS가 이 상태에서 인라인
  // opacity를 강제로 걸지 않아야(early return) CSS가 계속 소유권을 쥔다 —
  // "JS 낙관 boolean으로 하면 역방향 플래시가 난다"는 브리프 경고를 직접
  // 확인한다.
  it('motionReady=false이면 timeline·rAF를 만들지 않고 이름의 opacity를 강제로 건드리지 않는다', () => {
    render(<Harness motionReady={false} />);

    expect(timelineSpy).not.toHaveBeenCalled();
    expect(rafSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('wordmark').style.opacity).toBe('');
  });

  // 7경로 표 — "routeResolved = false → 보인다". 위와 같은 이유.
  it('routeResolved=false이면 timeline을 만들지 않고, 해시가 section으로 확정된 뒤에도 시작하지 않는다 — 이름 opacity도 건드리지 않는다', () => {
    const { rerender } = render(
      <Harness routeResolved={false} active="overview" />
    );
    expect(timelineSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('wordmark').style.opacity).toBe('');

    // routeResolved가 true가 되었지만 확정된 해시가 overview가 아니다 —
    // "해시가 section이면 끝까지 시작하지 않는다".
    rerender(<Harness routeResolved active="about" />);
    expect(timelineSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('wordmark').style.opacity).toBe('');
  });
});

// boot-composition 브리프 — 중앙 정렬·겹침 해소·CTA 위계·pre-boot blur의
// CSS 소유(감사 H2). jsdom은 레이아웃을 계산하지 않으므로 실제 겹침 여부·
// 픽셀 정렬은 증명할 수 없다 — 여기서는 "어떤 클래스·변수가 어디서
// 오는가"라는 구조만 고정한다.
describe('BootSequence 구도 — 중앙 정렬·간격·CTA 위계', () => {
  // 파티클 형성 브리프(4차)가 blur의 "멀리서 도착" 원경감을 걷어냈다 —
  // [data-wordmark-mode='hero']는 이제 opacity만 갖고 no-preference에서도
  // filter를 다시 걸지 않는다. 재도입을 소스 수준에서 못박는다.
  it('워드마크 pre-boot 은닉은 opacity만 쓴다 — blur 원경감은 파티클 형성으로 대체됐다', () => {
    const selector = "[data-wordmark-mode='hero']";
    const base = unconditionalRuleBody(selector);
    expect(base, `${selector} 기본 규칙이 없다`).toBeDefined();
    expect(base).toMatch(/opacity\s*:\s*1\s*;/);
    expect(base).not.toMatch(/filter/);

    const override = noPreferenceOverrideBody(selector);
    expect(override, `${selector}의 no-preference 오버라이드가 없다`).toBeDefined();
    expect(override).toMatch(/opacity\s*:\s*0\s*;/);
    expect(override).not.toMatch(/filter/);

    // reduce 미디어쿼리 블록 어디에도 이 선택자로 다시 블러를 거는 규칙이
    // 없어야 한다 — role/start와 같은 이유(역방향 플래시 방지).
    const reduceBlocks = DESIGN_TOKENS_CSS.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n {2}\}\n/g
    ) ?? [];
    for (const block of reduceBlocks) {
      expect(block).not.toMatch(/data-wordmark-mode/);
    }
  });

  it('워드마크를 t=0에 건드리지 않는다 — tl.set은 핸드오프 위치에서만 허용', () => {
    // 이전 결함(감사 H2): tl.set(wordmarkEl, {filter:'blur(5px)'}, 0)이 동적
    // import가 resolve된 뒤에야 실행돼, SSR로 선명하게 그려진 이름이 GSAP
    // 로드 시점에 갑자기 흐려지는 역방향 플래시를 만들었다.
    //
    // HERO 재순서 이후 계약이 좁혀졌다. 핸드오프(NAME_HANDOFF_AT)에서는
    // tl.set이 오히려 필수다 — 0.55초 페이드가 아니라 한 프레임 전환이어야
    // 하기 때문이다. 금지되는 것은 t=0 위치의 tl.set뿐이다.
    const source = readFileSync(bootSequencePath, 'utf8');

    // 위치 인자가 0인 tl.set(wordmarkEl, ...) — 역방향 플래시의 형태.
    expect(source).not.toMatch(/tl\.set\(\s*wordmarkEl[^;]*,\s*0\s*\)/);
    // 핸드오프 위치의 tl.set은 있어야 한다.
    expect(source).toMatch(/tl\.set\(\s*wordmarkEl[^;]*NAME_HANDOFF_AT\s*\)/);
  });

  it('워드마크 버튼(FLIP 대상) 자신은 position·transform 계열 속성을 트윈하지 않는다 — FLIP 불변식', () => {
    // GSAP Flip이 이 노드에 inline transform을 걸고 absolute:true로 잠깐
    // position:absolute까지 주는데, 부팅 타임라인이 같은 노드에 scale·x·y
    // 같은 transform 속성까지 걸면 두 transform 소유자가 충돌해 "START
    // 직후 워드마크 소실" 버그가 재발한다(Navigation/index.tsx 계약).
    // wordmarkEl 트윈은 opacity만 쓴다 — scale의 "원경감" 자체가 파티클
    // 형성으로 대체되며 걷어졌으므로, 이제 그 어떤 트윈 대상도 아닌
    // wrapperEl(wordmarkScaleRef)이 소스에 남아 있지 않은지도 함께 본다.
    const source = readFileSync(bootSequencePath, 'utf8');
    const wordmarkCall = source.match(/tl\.(?:to|fromTo|set)\(\s*wordmarkEl[\s\S]*?\);/)?.[0];
    expect(wordmarkCall, 'wordmarkEl을 대상으로 한 트윈을 찾지 못했다').toBeDefined();
    expect(wordmarkCall).not.toMatch(/scale|[^\w]x\s*:|[^\w]y\s*:|transform/);

    expect(source.match(/tl\.(?:to|fromTo|set)\(\s*wrapperEl/)).toBeNull();
  });

  it('wordmarkEl 트윈은 opacity 0→1을 쓴다 — LCP 계약 변경, 뮤테이션 (d)', () => {
    const source = readFileSync(bootSequencePath, 'utf8');
    const wordmarkCall = source.match(/tl\.(?:to|fromTo|set)\(\s*wordmarkEl[\s\S]*?\);/)?.[0];
    expect(wordmarkCall, 'wordmarkEl 트윈을 찾지 못했다').toBeDefined();

    // 뮤테이션 (d) — opacity 트윈을 지우면(항상 1) FAIL한다.
    expect(wordmarkCall).toMatch(/opacity/);
  });

  it('캡션(역할·START) 블록은 워드마크와 같은 뷰포트 중앙 기준(50%)에서 --boot-caption-gap만큼 아래 시작한다', () => {
    render(<Harness />);
    const container = screen.getByTestId('boot-sequence');
    expect(container.className).toContain('top-1/2');
    expect(container.className).toContain('left-1/2');
    expect(container.className).toContain('-translate-x-1/2');
    expect(container.className).toContain('items-center');
    // 뮤테이션 (c) — 좌측 하단(left-6, bottom-*, items-start)으로 되돌리면
    // 이 값들이 사라지거나 반대로 나타나 FAIL한다.
    expect(container.className).not.toMatch(/\bbottom-\d|\bleft-6\b|items-start/);

    // 뮤테이션 (d) — 간격의 출처를 참조하지 않으면(클래스 제거) 이름의
    // 바닥(50%)과 캡션의 시작(50%)이 같은 선에 붙어 겹침이 다시 가능해진다.
    expect(container.className).toContain('mt-[var(--boot-caption-gap)]');

    // 뮤테이션 (n) — 96px 이름 아래에서 고정값은 붙어 보인다(부팅 안무
    // 브리프). clamp()로 이름과 함께 자라야 한다: 최솟값 > 0, 뷰포트 비례
    // 항(vh)을 포함, 최댓값 > 최솟값. 고정값(예: 1.75rem)으로 되돌리면 이
    // clamp() 패턴 자체가 안 잡혀 FAIL한다.
    const gapDecl = DESIGN_TOKENS_CSS.match(
      /--boot-caption-gap:\s*clamp\(([^,]+),\s*([^,]+),\s*([^)]+)\)\s*;/
    );
    expect(
      gapDecl,
      '--boot-caption-gap이 clamp()로 정의되어 있지 않다'
    ).not.toBeNull();
    const [, min, preferred, max] = gapDecl!;
    expect(parseFloat(min)).toBeGreaterThan(0);
    expect(preferred).toMatch(/vh/);
    expect(parseFloat(max)).toBeGreaterThan(parseFloat(min));
  });

  it('역할 라벨은 START보다 작고 흐리다 — 크기·자간 토큰이 서로 다르다', () => {
    // 뮤테이션 (f) — 두 값을 다시 같은 크기·자간으로 되돌리면 아래 부등호가
    // 깨진다.
    render(<Harness />);
    const role = screen.getByTestId('boot-role');
    const start = screen.getByTestId('boot-start');

    const roleSize = role.className.match(/\btext-t\d\b/)?.[0];
    const startSize = start.className.match(/\btext-t\d\b/)?.[0];
    expect(roleSize, '역할 라벨의 크기 토큰을 찾지 못했다').toBeDefined();
    expect(startSize, 'START의 크기 토큰을 찾지 못했다').toBeDefined();
    expect(roleSize).not.toBe(startSize);

    const roleTracking = role.className.match(/tracking-\[[\d.]+em\]/)?.[0];
    const startTracking = start.className.match(/tracking-\[[\d.]+em\]/)?.[0];
    expect(roleTracking, '역할 라벨의 자간 토큰을 찾지 못했다').toBeDefined();
    expect(startTracking, 'START의 자간 토큰을 찾지 못했다').toBeDefined();
    expect(roleTracking).not.toBe(startTracking);

    expect(role.className).not.toContain('cyan-hi');
    expect(role.className).toContain('text-secondary');
  });

  it('START는 화살표·목적지 표기 없는 시안 밑줄 텍스트 버튼이다 — 박스·필이 아니다', () => {
    // 3라운드 사용자 판단 — "START — ABOUT →"에서 화살표·목적지 표기를
    // 뺀다. 밑줄·hover·focus-visible이라는 CTA 신호 자체는 화살표 없이도
    // 유지한다.
    render(<Harness />);
    const start = screen.getByTestId('boot-start');

    // 뮤테이션 (d) — "START — ABOUT →"로 되돌리면 정확히 일치하지 않아 FAIL한다.
    expect(start.textContent).toBe('START');

    // hover·focus-visible 신호 — 화살표가 빠진 자리를 대신한다.
    expect(start.className).toContain('hover:text-[var(--color-cyan-hi)]');
    expect(start.className).toMatch(/focus-visible:/);
    for (const banned of [
      'rounded-lg',
      'rounded-full',
      'rounded-2xl',
      'bg-[var(--color-cyan-core)]',
      'border-b',
    ]) {
      expect(start.className, `${banned}가 있다`).not.toContain(banned);
    }
  });

  it('START 크기는 모바일 t5 / 태블릿 t3 / 데스크톱 t2이고 역할 라벨(t8)과 항상 2배 가까이 벌어진다 — 뮤테이션 (h)', () => {
    render(<Harness />);
    const start = screen.getByTestId('boot-start');
    const role = screen.getByTestId('boot-role');

    // 뮤테이션 (h) — t6(반응형 없는 고정 크기)으로 되돌리면 이 세 토큰이
    // 사라져 FAIL한다.
    expect(start.className).toContain('text-t5');
    expect(start.className).toContain('sm:text-t3');
    expect(start.className).toContain('md:text-t2');
    expect(role.className).toContain('text-t8');

    // 실제 px 값으로도 위계를 재확인한다 — 이전 라운드는 15/11=1.36배였다.
    const PX_BY_TOKEN: Record<string, number> = {
      t8: 11,
      t5: 17,
      t3: 22,
      t2: 26,
    };
    for (const startToken of ['t5', 't3', 't2']) {
      expect(PX_BY_TOKEN[startToken] / PX_BY_TOKEN.t8).toBeGreaterThan(1.36);
    }
  });

  it('밑줄은 START 버튼 안의 별도 span이다 — CSS border가 아니라 GSAP이 scaleX로 그을 수 있어야 한다', () => {
    // 뮤테이션 (i) — 이 span 자체를 지우면 밑줄 draw 자체가 불가능해진다.
    render(<Harness />);
    const start = screen.getByTestId('boot-start');
    const underline = screen.getByTestId('boot-start-underline');

    expect(start).toContainElement(underline);
    expect(underline.className).toContain('bg-[var(--color-cyan-core)]');
    expect(underline.className).toContain('origin-left');
    expect(underline).toHaveAttribute('aria-hidden', 'true');
  });

  it('밑줄은 버튼 박스가 아니라 텍스트를 감싸는 relative span의 자손이다 — 뮤테이션 (i)', () => {
    // 컨트롤러가 코드에서 확정한 원인: 버튼이 min-h-11(44px 터치 타깃)이고
    // items-center로 글자가 그 안에서 수직 중앙에 놓이는데, 밑줄이 버튼
    // 바로 아래 absolute bottom-0 자식이면 글자가 아니라 버튼 박스
    // 바닥에 그어진다. 텍스트를 relative span으로 감싸 밑줄을 그 안에
    // 두면 밑줄이 글자 자신의 박스 바닥에 붙는다.
    render(<Harness />);
    const start = screen.getByTestId('boot-start');
    const underline = screen.getByTestId('boot-start-underline');

    // 뮤테이션 (i) — 밑줄을 다시 버튼 바로 아래 자식으로 옮기면(텍스트
    // wrapper 없이) parentElement가 start 자신이 되어 FAIL한다.
    expect(underline.parentElement).not.toBe(start);
    expect(underline.parentElement?.className).toContain('relative');
    expect(underline.parentElement?.textContent).toBe('START');
  });

  it('START 버튼은 44px 터치 타깃(min-h-11)을 유지한다 — 뮤테이션 (r)', () => {
    render(<Harness />);
    const start = screen.getByTestId('boot-start');
    expect(start.className).toContain('min-h-11');
  });

  // 클릭 링은 3차(터널 진입 브리프 4절) 사용자 판단으로 제거됐다 — 대신
  // 글자가 반짝인다. 뮤테이션 (j)(링을 되살림)·(k)(반짝임을 지움) 둘 다
  // 이 테스트 하나로 잡는다 — 반대 방향을 함께 짚어야 어느 쪽으로
  // 회귀해도 걸린다.
  it('클릭하면 글자가 반짝이고, 클릭 링은 더 이상 존재하지 않는다 — 뮤테이션 (j)·(k)', () => {
    render(<Harness />);
    const start = screen.getByTestId('boot-start');

    // 클릭 전 — 상시 루프가 아니므로 아직 반짝임 클래스가 없다.
    expect(screen.getByTestId('boot-start-text').className).not.toContain('boot-start-flash');

    act(() => {
      start.click();
    });

    // 뮤테이션 (k) — 클릭에 반짝임 클래스 부착을 지우면 FAIL한다.
    expect(screen.getByTestId('boot-start-text').className).toContain('boot-start-flash');

    // 뮤테이션 (j) — 클릭 링을 되살리면(JSX·CSS 어느 쪽이든) 아래 넷 중
    // 하나가 FAIL한다.
    expect(screen.queryByTestId('boot-start-ripple')).not.toBeInTheDocument();
    expect(start.querySelector('.animate-ripple')).toBeNull();
    // 실제 규칙 선언만 본다(주석에 남은 "이전에는 이랬다"는 역사 설명은
    // 허용한다) — 규칙 자체가 되살아나면 여기서 FAIL한다.
    expect(DESIGN_TOKENS_CSS).not.toMatch(/@keyframes ripple-expand\s*\{/);
    expect(DESIGN_TOKENS_CSS).not.toMatch(/\.animate-ripple\s*\{/);

    // 반짝임 keyframe 자체 — cyan-hi로 정점을 찍고, 1회성이다(infinite가
    // 아니다) — 이 둘이 "상시 맥동 아님"과 "Hyperspeed 색으로 반짝임"을
    // CSS 수준에서 고정한다.
    const keyframeBlock = DESIGN_TOKENS_CSS.match(
      /@keyframes boot-start-flash \{([\s\S]*?)\n {2}\}/
    )?.[1];
    expect(keyframeBlock, 'boot-start-flash keyframe을 찾지 못했다').toBeDefined();
    expect(keyframeBlock).toMatch(/cyan-hi/);

    const flashRule = DESIGN_TOKENS_CSS.match(
      /\n {2}\.boot-start-flash\s*\{([\s\S]*?)\n {2}\}/
    )?.[1];
    expect(flashRule, '.boot-start-flash 규칙을 찾지 못했다').toBeDefined();
    expect(flashRule).not.toMatch(/infinite/);
  });

  // 3차 실기기 피드백으로 제거했다. 버튼 크기의 220%라 START 위로 크게
  // 삐져나와 이름과 START 사이에 정체불명의 얼룩으로 보였다 — 무엇을 위한
  // 빛인지 읽히지 않으면 장식 노이즈이고, 2차 감사가 지적한 AI slop 6번
  // (장식용 블롭)에 오히려 가까워진다. 지우지 않고 반대 방향으로 못박는다.
  it('START 뒤에 정체불명의 광휘 블롭이 없다', () => {
    render(<Harness />);

    expect(screen.queryByTestId('boot-start-glow')).not.toBeInTheDocument();
  });

  it('글자("START") 자신에는 어떤 CSS 애니메이션·keyframe도 걸리지 않는다 — 뮤테이션 (j)', () => {
    // .boot-start(버튼 자신) 규칙 블록에 animation 선언이 없어야 한다 —
    // 맥동은 밑줄(.boot-start-underline)·광휘(.boot-start-glow)만의 몫이다.
    const bootStartBlock = DESIGN_TOKENS_CSS.match(
      /\n {2}\.boot-start\s*\{([\s\S]*?)\n {2}\}/
    )?.[1];
    expect(bootStartBlock, '.boot-start 규칙을 찾지 못했다').toBeDefined();
    expect(bootStartBlock).not.toMatch(/animation\s*:/);
  });
});

// 캡션 컨테인먼트 점프(감사 H — 부팅 안무 브리프 3절). BootSequence는 이제
// HomeClient에서 overview 섹션 밖(셸 레벨)에 렌더되므로, 자기 자신이 active를
// 보고 보임/숨김·inert를 직접 소유해야 한다(예전엔 섹션 wrapper의 inert를
// 상속받았다). jsdom은 paint containment도 점프도 계산할 수 없으므로 여기서는
// "active가 아닐 때 이 컴포넌트가 스스로 격리되는가"라는 구조만 고정한다 —
// 실제 점프 소멸 여부는 실기기 확인 사항이다(리포트 참고).
describe('BootSequence — 캡션 컨테인먼트 점프 회피(active 기반 자가 은닉)', () => {
  it('active=overview에서는 inert가 없고 aria-hidden=false, boot-caption-visible이다', () => {
    render(<Harness active="overview" />);
    const container = screen.getByTestId('boot-sequence');

    expect(container).not.toHaveAttribute('inert');
    expect(container).toHaveAttribute('aria-hidden', 'false');
    expect(container.className).toContain('boot-caption-visible');
    expect(container.className).not.toContain('boot-caption-hidden');
  });

  // 뮤테이션 — active !== overview에서 inert/aria-hidden을 안 걸면 START·
  // 역할 라벨이 다른 섹션 위에서도 Tab·스크린리더에 남아 FAIL해야 한다.
  it('active가 overview를 벗어나면 inert=true, aria-hidden=true, boot-caption-hidden이다', () => {
    render(<Harness active="about" />);
    const container = screen.getByTestId('boot-sequence');

    expect(container).toHaveAttribute('inert');
    expect(container).toHaveAttribute('aria-hidden', 'true');
    expect(container.className).toContain('boot-caption-hidden');
    expect(container.className).not.toContain('boot-caption-visible');
  });
});

// START 클릭 지연 — 클릭 즉시 전환되면 반짝임("에너지가 차오르는" 연출,
// 터널 진입 브리프 4절이 클릭 링을 대체했다)을 볼 시간이 없었다. onStart를
// START_TRANSITION_DELAY_MS만큼 늦추되 네 가드(중복 클릭·다른 네비 경합·
// 언마운트 정리·reducedMotion)를 지킨다.
describe('BootSequence — START 클릭 지연(반짝임 가시성 확보)과 가드', () => {
  it('지연 중 두 번 클릭해도 onStart는 한 번만 예약된다 — 뮤테이션 (l)', () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);
    const start = screen.getByTestId('boot-start');

    act(() => {
      start.click();
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    act(() => {
      start.click(); // 지연 중 재클릭 — 무시돼야 한다
    });

    act(() => {
      vi.advanceTimersByTime(300); // 두 지연 모두 끝났을 시간
    });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('지연 중 active가 다른 곳으로 바뀌면(다른 네비게이션이 이김) 예약된 onStart를 부르지 않는다 — 뮤테이션 (m)', () => {
    const onStart = vi.fn();
    const { rerender } = render(<Harness onStart={onStart} active="overview" />);

    act(() => {
      screen.getByTestId('boot-start').click();
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    // 다른 경로(예: 해시 변경)로 이미 다른 섹션으로 이동했다고 가정한다.
    rerender(<Harness onStart={onStart} active="about" />);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(
      onStart,
      '예약된 전환이 다른 네비게이션 결과를 덮어쓰면 안 된다'
    ).not.toHaveBeenCalled();
  });

  it('언마운트 시 예약된 onStart 타이머를 정리한다 — 뮤테이션 (n)', () => {
    const onStart = vi.fn();
    const { unmount } = render(<Harness onStart={onStart} />);

    act(() => {
      screen.getByTestId('boot-start').click();
    });
    unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onStart).not.toHaveBeenCalled();
  });

  it('reducedMotion에서는 지연 없이 즉시 onStart를 부른다 — 뮤테이션 (o)', () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} reducedMotion />);

    act(() => {
      screen.getByTestId('boot-start').click();
    });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('reducedMotion에서는 클릭해도 글자가 반짝이지 않는다 — 뮤테이션 (p)', () => {
    render(<Harness reducedMotion />);

    act(() => {
      screen.getByTestId('boot-start').click();
    });
    // 뮤테이션 (p) — reducedMotion 가드 없이 flashKey>0이면 늘 클래스를
    // 걸면 FAIL한다. 클릭 링은 애초에 존재하지 않는다(위 describe에서
    // 이미 확인) — 여기서는 대체된 반짝임 쪽 게이트만 본다.
    expect(screen.getByTestId('boot-start-text').className).not.toContain('boot-start-flash');
  });
});

// 워드마크 opacity 안무 — Navigation과 결합해 seek()로 검증한다. 시안
// 스윕(계획 D6/D7 2단계)은 3라운드에서 사용자 판단으로 제거했다(정상
// 동작이나 보기에 이상하다는 판정). blur 초점(blur(5px)→blur(0))은 안무
// 2단계의 다른 절반이었지만 파티클 형성 브리프(4차)가 blur 자체를
// 완전히 걷어냈다 — 이제 이 축은 opacity 하나만 남는다.
describe('BootSequence — 워드마크 opacity 안무 (Navigation 결합)', () => {
  // 실제 Navigation은 compact 뷰포트 판정에 matchMedia를 쓴다
  // (centerCompactItem). 이 파일의 다른 describe는 가짜 <button>만 쓰므로
  // 필요 없었지만, CompositionHarness는 실제 Navigation을 마운트한다.
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('시안 스윕 오버레이가 더 이상 렌더되지 않는다 — 뮤테이션 (f)', () => {
    // 사용자 판단으로 제거한 기능이 되살아나면 이 테스트가 FAIL해야 한다.
    render(<CompositionHarness />);
    expect(screen.queryByTestId('wordmark-sweep')).not.toBeInTheDocument();
  });

  it('reduced-motion에서는 워드마크가 인라인 스타일을 건드리지 않는다 — 뮤테이션 (j)', async () => {
    // 렌더 직후 곧바로 검사하면(flush 없이) eligible 게이트가 깨져 있어도
    // import('@/lib/gsap') 콜백이 아직 도착하지 않았을 뿐이라 우연히
    // 통과해버린다 — 반드시 flush한 뒤 timelineSpy 호출 수까지 함께
    // 확인해야 "GSAP 자체를 시도조차 하지 않는다"는 실제 계약을 본다.
    render(<CompositionHarness reducedMotion />);
    await flushGsapImport();

    expect(timelineSpy).not.toHaveBeenCalled();

    const wordmark = screen.getByTestId('wordmark');
    expect(wordmark.style.opacity).toBe('');
  });

  // 컨트롤러 추가. pre-boot opacity를 CSS가 [data-wordmark-mode='hero']로
  // 소유하게 바뀌면서 새로 생긴 위험이다 — overview로 돌아오면 그 속성이
  // 다시 붙는데 부팅 타임라인은 재생되지 않는다(hasStartedRef). 인라인
  // opacity:1이 남아 CSS를 덮지 않으면 이름이 안 보이는 채로 굳는다. 7경로
  // 표 — "overview 재방문 → 보인다(부팅 재생 없음)". hasStartedRef가 이미
  // true라 재방문은 새 timeline을 만들지 않는다 — 이름은 최초 이탈 때
  // revealFinalState()가 남긴 최종 상태(opacity 1) 그대로 유지돼야 한다.
  it('overview를 떠났다 돌아와도 이름이 안 보이는 채로 굳지 않는다 — 뮤테이션 (i)', async () => {
    const { rerender } = render(<CompositionHarness active="overview" />);
    await flushGsapImport();

    rerender(<CompositionHarness active="about" />);
    rerender(<CompositionHarness active="overview" />);
    await flushGsapImport();

    const wordmark = screen.getByTestId('wordmark');
    expect(wordmark).toHaveAttribute('data-wordmark-mode', 'hero');
    // 뮤테이션 (i) — revealFinalState()의 opacity 대입을 지우면 이 값이
    // ''로 남고, CSS의 no-preference 오버라이드(opacity:0)가 재방문에도
    // 그대로 적용돼 이름이 안 보인다.
    expect(wordmark.style.opacity).toBe('1');
  });
});

// 이름 파티클 형성 — react-bits ParticleText를 부팅 전용으로 개조한
// 컴포넌트(components/blocks/ParticleText)의 세부 동작(글리프 샘플링·
// 파티클 수 상한·DPR 제한·rAF 정지)은 __tests__/components/ParticleText.test.tsx가
// 직접 고정한다. 여기서는 BootSequence가 그 컴포넌트를 "언제 렌더하고
// 언제 재생을 트리거하는가"라는 게이팅·배선만 검증한다. 아래 브리프 표기의
// (a)~(f)는 이 브리프(particle-name-brief.md)의 뮤테이션 목록이다 — 이
// 파일에 이미 존재하는 (구) 터널 진입 브리프의 같은 글자와 뜻이 다르므로
// "파티클 브리프"를 붙여 구분한다.
describe('BootSequence — 이름 파티클 형성(gating·트리거)', () => {
  function stubWorkingParticleCanvas() {
    const ctx = {
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text: string) => ({
        width: text.length * 8,
        actualBoundingBoxAscent: 12,
        actualBoundingBoxDescent: 4,
      })),
      getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4).fill(255),
      })),
      font: '',
      fillStyle: '',
      textBaseline: '',
    };
    const contextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        width: 200,
        height: 80,
        left: 10,
        top: 10,
        right: 210,
        bottom: 90,
        x: 10,
        y: 10,
        toJSON: () => {},
      } as DOMRect);
    return { ctx, contextSpy, rectSpy };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('기기 등급이 high/medium이고 reducedMotion이 아니면 파티클 캔버스가 렌더되고, 도착 시각(0.75초)에 형성이 시작된다 — 파티클 브리프 뮤테이션 (a)', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 8 });
    const { ctx } = stubWorkingParticleCanvas();

    render(<Harness />);
    await flushGsapImport();
    await flushGsapImport(); // detectQuality의 Promise 체인까지 흘려보낸다

    expect(screen.getByTestId('particle-name-canvas')).toBeInTheDocument();

    const tl = capturedTimeline();
    const before = rafSpy.mock.calls.length;
    act(() => {
      tl.seek(0.75, false);
    });

    // 뮤테이션 (a) — 파티클 형성을 제거하면(즉시 표시로 바꾸면) tl.call도
    // ParticleText.play()도 사라져 rAF가 새로 예약되지 않아 FAIL한다.
    expect(rafSpy.mock.calls.length).toBeGreaterThan(before);
    // play()가 실제로 도달했다는 증거 — 글리프 샘플링이 이미 마운트 시
    // 끝나 있었으므로 재생 트리거만으로 getImageData가 추가로 불리지
    // 않는다(1회 유지, ParticleText.test.tsx의 (j)와 같은 계약).
    expect(ctx.getImageData).toHaveBeenCalledTimes(1);
  });

  it('low tier에서는 파티클 캔버스를 렌더하지 않는다 — 파티클 브리프 뮤테이션 (f)', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 2, deviceMemory: 2 });
    stubWorkingParticleCanvas();

    render(<Harness />);
    await flushGsapImport();
    await flushGsapImport();

    // 뮤테이션 (f) — low tier에서도 렌더하도록 게이트를 지우면 이 캔버스가
    // 나타나 FAIL한다.
    expect(screen.queryByTestId('particle-name-canvas')).not.toBeInTheDocument();
  });

  it('reducedMotion에서는 파티클 캔버스를 만들지 않는다 — 파티클 브리프 뮤테이션 (e)', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 8 });
    stubWorkingParticleCanvas();

    render(<Harness reducedMotion />);
    await flushGsapImport();
    await flushGsapImport();

    // 뮤테이션 (e) — reducedMotion 게이트를 지우면 이 캔버스가 나타나 FAIL한다.
    expect(screen.queryByTestId('particle-name-canvas')).not.toBeInTheDocument();
  });

  it('캔버스가 실패해도(getContext null) DOM 이름의 opacity 트윈은 독립적으로 도착한다 — 파티클 브리프 뮤테이션 (d)', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 8 });
    // 이 파일 전역 beforeEach가 이미 getContext를 null로 고정해 둔다 —
    // "캔버스 실패"가 사실상 기본값이다. 여기서는 그 상태에서도 이름이
    // 도착하는지를 명시적으로 확인한다.
    render(<Harness />);
    await flushGsapImport();
    await flushGsapImport();
    const tl = capturedTimeline();
    const wordmark = screen.getByTestId('wordmark');

    act(() => {
      tl.seek(1.3, false);
    });
    // 뮤테이션 (d) — 파티클 실패 시에만 도는 별도 revealFinalState 경로를
    // 지우는 것이 아니라, wordmarkEl의 opacity 트윈 자체가 파티클 재생
    // 성패와 무관하게 독립적으로 스케줄되는 이 설계 자체가 계약이다.
    // 이 트윈을 particleRef 성공 여부에 조건부로 만들면(즉 tl.call 안에
    // 넣거나 play() 콜백에 의존하게 하면) 캔버스가 없는 이 테스트에서
    // opacity가 계속 '0'으로 남아 FAIL한다.
    expect(wordmark.style.opacity).toBe('1');
  });

  it('BootSequence는 lib/deviceQuality의 detectQuality()를 부른다 — 강등 판정의 단일 출처', () => {
    const source = readFileSync(bootSequencePath, 'utf8');
    expect(source).toMatch(/detectQuality\(\)/);
    expect(source).toMatch(/from '@\/lib\/deviceQuality'/);
  });
});

// START — Magnet(호버)·ClickSpark(클릭). 두 컴포넌트 자신의 세부 동작(이동
// 범위 클램프·rAF idle 정지·색 해석)은 각각 __tests__/components/Magnet.test.tsx·
// __tests__/components/ClickSpark.test.tsx가 직접 고정한다. 여기서는
// BootSequence가 START 버튼을 올바르게 감싸고, reducedMotion에서 ClickSpark를
// 아예 만들지 않는지를 본다.
describe('BootSequence — START Magnet·ClickSpark 배선', () => {
  it('START 버튼이 여전히 boot-start testid·44px 터치 타깃·밑줄을 갖는다 — Magnet/ClickSpark로 감싸도 마크업이 보존된다', () => {
    render(<Harness />);
    const start = screen.getByTestId('boot-start');
    expect(start.tagName).toBe('BUTTON');
    expect(start.className).toContain('min-h-11');
    expect(screen.getByTestId('boot-start-underline')).toBeInTheDocument();
  });

  it('reducedMotion이 아니면 ClickSpark가 클릭 캔버스를 만든다', () => {
    render(<Harness />);
    // ClickSpark는 자신만의 <canvas>를 boot-sequence 컨테이너 안(START
    // 버튼의 조상)에 렌더한다(components/blocks/ClickSpark). 이름 파티클
    // 캔버스는 boot-sequence 컨테이너 *밖*(형제 fragment)에 렌더되므로
    // 이 컨테이너 안에서 찾은 canvas는 반드시 ClickSpark의 것이다. Magnet은
    // canvas를 만들지 않는다.
    const container = screen.getByTestId('boot-sequence');
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('reducedMotion에서는 ClickSpark를 만들지 않는다 — 뮤테이션 (o)', () => {
    render(<Harness reducedMotion />);
    // reducedMotion에서는 이름 파티클 캔버스도 안 만들어지므로(위 describe)
    // body 전체에 canvas가 하나도 없어야 한다 — ClickSpark가 만들어지면
    // 이 값이 truthy가 되어 FAIL한다.
    expect(document.body.querySelector('canvas')).toBeNull();
  });

  it('ClickSpark 색은 팔레트 상수(--color-cyan-hi)를 참조한다 — 뮤테이션 (p)', () => {
    const source = readFileSync(bootSequencePath, 'utf8');
    const clickSparkCall = source.match(/<ClickSpark[\s\S]*?>/)?.[0];
    expect(clickSparkCall, 'ClickSpark 호출을 찾지 못했다').toBeDefined();
    expect(clickSparkCall).toMatch(/--color-cyan-hi/);
    // 뮤테이션 (p) — 색을 팔레트 밖 임의 값(예: '#ff00ff')으로 바꾸면
    // sparkColorVar가 그 문자열을 참조하지 않아 FAIL한다.
    expect(clickSparkCall).not.toMatch(/#ff00ff/);
  });

  // 사용자 판단으로 Magnet을 걷었다("디자인 나쁨"). 호버 반응은 전기 충전
  // 효과가 대신한다. 지우지 않고 반대 방향으로 못박는다 — 되살리면 잡힌다.
  it('Magnet이 더 이상 쓰이지 않는다 — 호버는 전기 충전이 맡는다', () => {
    const source = readFileSync(bootSequencePath, 'utf8');

    expect(source).not.toMatch(/<Magnet/);
    expect(source).not.toMatch(/from '@\/components\/blocks\/Magnet'/);
  });

  it('워드마크 버튼(FLIP 대상)은 Magnet/ClickSpark와 무관하다 — Navigation을 건드리지 않았다', () => {
    // 이번 변경은 START(boot-start)만 감싼다. 워드마크(Navigation의 wordmark
    // 버튼)는 여전히 position·transform 클래스를 갖지 않는다 — 뮤테이션
    // (q)가 겨누는 FLIP 불변식은 Navigation/index.tsx 자체를 건드리지
    // 않았으므로 소스 수준에서 그대로 유지된다.
    const navigationPath = path.resolve(
      process.cwd(),
      'components/blocks/Navigation/index.tsx'
    );
    const navigationSource = readFileSync(navigationPath, 'utf8');
    const wordmarkButton = navigationSource.match(
      /<button\s+ref=\{wordmarkRef\}[\s\S]*?<\/button>/
    )?.[0];
    expect(wordmarkButton, 'wordmark 버튼 마크업을 찾지 못했다').toBeDefined();
    expect(wordmarkButton).not.toMatch(/\btransform\b/);
    expect(wordmarkButton).not.toMatch(/\bfixed\b|\babsolute\b/);
  });
});
