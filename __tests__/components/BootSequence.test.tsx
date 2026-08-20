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
}: Partial<BootSequenceProps>) {
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {/* 실제 Navigation을 쓰지 않고 최소한의 wordmark 자리만 재현한다 —
          hero/compact 스타일은 Navigation 자신의 관심사고, 여기 관심사는
          BootSequence가 이 노드를 어떻게 애니메이션하는지다. */}
      <button ref={wordmarkRef} data-testid="wordmark">
        KIM TAEIN
      </button>
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

function SsrHarness() {
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Navigation
        items={NAV_ITEMS}
        active="overview"
        onNavigate={() => {}}
        wordmarkRef={wordmarkRef}
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
beforeEach(() => {
  vi.useFakeTimers();
  timelineSpy = vi.spyOn(gsap, 'timeline');
  rafSpy = vi.spyOn(window, 'requestAnimationFrame');
});

afterEach(() => {
  timelineSpy.mockRestore();
  rafSpy.mockRestore();
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

  it('이름이 opacity 0으로 시작하지 않는다', () => {
    const html = renderToString(<SsrHarness />);
    const wordmarkMarkup = html.match(
      /<button[^>]*data-testid="wordmark"[^>]*>[\s\S]*?<\/button>/
    )?.[0];

    expect(wordmarkMarkup, 'wordmark 마크업을 SSR HTML에서 찾지 못했다').toBeDefined();
    // 인라인 style 자체가 없어야 한다 — "JS의 낙관적 boolean"으로 opacity를
    // 끄고 켜는 패턴을 원천적으로 배제한다.
    expect(wordmarkMarkup).not.toMatch(/style=/);
    expect(wordmarkMarkup).not.toMatch(/opacity:\s*0(?!\.)/);
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
  it('1.4초 스윕 뒤 역할과 START가 순서대로 안정된다', async () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);
    await flushGsapImport();
    const tl = capturedTimeline();
    const role = screen.getByTestId('boot-role');
    const start = screen.getByTestId('boot-start');

    act(() => {
      tl.seek(1.4);
    });
    // fromTo 트윈은 GSAP 기본값(immediateRender: true)에 따라 생성 즉시
    // "from" 값(opacity 0)을 렌더한다 — CSS의 pre-boot 은닉 상태(opacity 0)와
    // 정확히 같은 값이라 핸드오프에 시각적 점프가 없다. 아직 각 트윈의
    // 시작 지점(1.7초·1.85초)에 닿지 않았으므로 두 값 다 0으로 남아 있다.
    expect(role.style.opacity).toBe('0');
    expect(start.style.opacity).toBe('0');

    act(() => {
      tl.seek(1.85);
    });
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('0');

    act(() => {
      tl.seek(2);
    });
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('1');
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
    expect(wordmark.style.filter).toBe('blur(0px)');
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('1');
  });

  it('START 클릭은 onStart를 호출한다', () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);

    screen.getByTestId('boot-start').click();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('unmount 뒤 timeline을 kill한다', async () => {
    const { unmount } = render(<Harness />);
    await flushGsapImport();
    const tl = capturedTimeline();
    const killSpy = vi.spyOn(tl, 'kill');

    unmount();
    expect(killSpy).toHaveBeenCalledTimes(1);
  });
});

describe('BootSequence 게이트 — reduced-motion·routeResolved·motionReady', () => {
  it('reduced-motion이면 부팅을 건너뛰고 즉시 완료한다(timeline·rAF 0개)', () => {
    render(<Harness reducedMotion />);

    expect(timelineSpy).not.toHaveBeenCalled();
    expect(rafSpy).not.toHaveBeenCalled();

    const role = screen.getByTestId('boot-role');
    const start = screen.getByTestId('boot-start');
    // JS가 인라인 스타일을 전혀 건드리지 않는다 — CSS(.boot-role/.boot-start
    // 기본 규칙)가 최종 상태를 처음부터 보여준다.
    expect(role.style.opacity).toBe('');
    expect(start.style.opacity).toBe('');
  });

  it('motionReady=false이면 timeline·rAF를 만들지 않는다', () => {
    render(<Harness motionReady={false} />);

    expect(timelineSpy).not.toHaveBeenCalled();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('routeResolved=false이면 timeline을 만들지 않고, 해시가 section으로 확정된 뒤에도 시작하지 않는다', () => {
    const { rerender } = render(
      <Harness routeResolved={false} active="overview" />
    );
    expect(timelineSpy).not.toHaveBeenCalled();

    // routeResolved가 true가 되었지만 확정된 해시가 overview가 아니다 —
    // "해시가 section이면 끝까지 시작하지 않는다".
    rerender(<Harness routeResolved active="about" />);
    expect(timelineSpy).not.toHaveBeenCalled();
  });
});
