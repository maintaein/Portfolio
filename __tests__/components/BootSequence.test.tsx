import { readFileSync } from 'node:fs';
import path from 'node:path';
import { useRef } from 'react';
import { renderToString } from 'react-dom/server';
import { act, render, screen, within } from '@testing-library/react';
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

// boot-composition 브리프의 항목 6(시안 스윕)은 Navigation이 워드마크 버튼
// 안에 그려 둔 오버레이(wordmark-sweep)를 BootSequence가 wordmarkRef를 통해
// 찾아 애니메이션한다. 위 Harness의 가짜 <button>에는 그 오버레이도
// data-wordmark-mode도 없으므로, 이 결합을 검증하려면 실제 Navigation을
// 함께 렌더해야 한다.
function CompositionHarness({
  active = 'overview',
  routeResolved = true,
  motionReady = true,
  reducedMotion = false,
  onStart = vi.fn(),
}: Partial<BootSequenceProps>) {
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Navigation
        items={NAV_ITEMS}
        active={active}
        onNavigate={() => {}}
        wordmarkRef={wordmarkRef}
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

// boot-composition 브리프 — 중앙 정렬·겹침 해소·CTA 위계·pre-boot blur의
// CSS 소유(감사 H2). jsdom은 레이아웃을 계산하지 않으므로 실제 겹침 여부·
// 픽셀 정렬은 증명할 수 없다 — 여기서는 "어떤 클래스·변수가 어디서
// 오는가"라는 구조만 고정한다.
describe('BootSequence 구도 — 중앙 정렬·간격·CTA 위계', () => {
  it('워드마크 pre-boot blur도 CSS가 소유한다 — data-wordmark-mode=hero가 no-preference에서만 blur(5px)', () => {
    const selector = "[data-wordmark-mode='hero']";
    const base = unconditionalRuleBody(selector);
    expect(base, `${selector} 기본 규칙이 없다`).toBeDefined();
    expect(base).toMatch(/filter\s*:\s*blur\(0px\)\s*;/);

    const override = noPreferenceOverrideBody(selector);
    expect(override, `${selector}의 no-preference 오버라이드가 없다`).toBeDefined();
    expect(override).toMatch(/filter\s*:\s*blur\(5px\)\s*;/);

    // reduce 미디어쿼리 블록 어디에도 이 선택자로 다시 블러를 거는 규칙이
    // 없어야 한다 — role/start와 같은 이유(역방향 플래시 방지).
    const reduceBlocks = DESIGN_TOKENS_CSS.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n {2}\}\n/g
    ) ?? [];
    for (const block of reduceBlocks) {
      expect(block).not.toMatch(/data-wordmark-mode/);
    }
  });

  it('워드마크 blur를 JS가 t=0에 다시 걸지 않는다 — 감사 H2, 뮤테이션 (g)', () => {
    // 이전 결함: tl.set(wordmarkEl, {filter:'blur(5px)'}, 0)이 동적 import가
    // resolve된 뒤에야 실행돼, SSR로 선명하게 그려진 이름이 GSAP 로드 시점에
    // 갑자기 흐려지는 역방향 플래시를 만들었다. fromTo만 허용한다 — from
    // 값이 CSS가 이미 그린 값과 같아 즉시 렌더돼도 시각적 점프가 없다.
    const source = readFileSync(bootSequencePath, 'utf8');
    expect(source).not.toMatch(/tl\.set\(\s*wordmarkEl/);
    expect(source).toMatch(/tl\.fromTo\(\s*wordmarkEl/);
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
    const gapDecl = DESIGN_TOKENS_CSS.match(
      /--boot-caption-gap:\s*([\d.]+)\s*\w*\s*;/
    );
    expect(gapDecl, '--boot-caption-gap 선언을 design-tokens.css에서 찾지 못했다').not.toBeNull();
    expect(Number(gapDecl![1])).toBeGreaterThan(0);
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

  it('START는 시안 밑줄 + hover 화살표를 가진 텍스트 버튼이다 — 박스·필이 아니다', () => {
    render(<Harness />);
    const start = screen.getByTestId('boot-start');

    // 뮤테이션 (e) — 밑줄을 지우면 FAIL한다.
    expect(start.className).toMatch(/\bborder-b\b/);
    expect(start.className).toContain('border-[var(--color-cyan-core)]');
    for (const banned of [
      'rounded-lg',
      'rounded-full',
      'rounded-2xl',
      'bg-[var(--color-cyan-core)]',
    ]) {
      expect(start.className, `${banned}가 있다`).not.toContain(banned);
    }
    expect(start.className).toMatch(/focus-visible:/);

    const arrow = within(start).getByText('→');
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow.className).toContain('group-hover:translate-x-1');
  });
});

// 시안 스윕(항목 6) — Navigation의 wordmark-sweep 오버레이를 BootSequence의
// 실제 GSAP timeline이 어떻게 움직이는지 seek()로 검증한다. 실제 색상·
// 흐림 정도의 시각적 결과(합성 렌더)는 jsdom이 증명할 수 없다 — transform·
// opacity 값의 진행만 구조로 고정한다.
describe('BootSequence 시안 스윕 — Navigation과 결합해 seek()로 검증', () => {
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

  it('1.4~1.7초 구간에서 스윕이 페이드 인·아웃하며 이름 자신의 opacity는 건드리지 않는다', async () => {
    render(<CompositionHarness />);
    await flushGsapImport();
    const tl = capturedTimeline();
    const wordmark = screen.getByTestId('wordmark');
    const sweep = screen.getByTestId('wordmark-sweep');

    // fromTo의 immediateRender가 생성 즉시 "from" 값을 렌더한다 — CSS
    // 기본값(opacity-0, 투명)과 같은 값이라 핸드오프에 점프가 없다.
    expect(sweep.style.opacity).toBe('0');

    act(() => {
      tl.seek(1.4); // SWEEP_AT — 스윕 시작
    });
    expect(parseFloat(sweep.style.opacity)).toBeCloseTo(0, 5);

    act(() => {
      tl.seek(1.55); // SWEEP_AT + SWEEP_HALF — 페이드인 종료/페이드아웃 시작
    });
    expect(parseFloat(sweep.style.opacity)).toBeGreaterThan(0.9);

    act(() => {
      tl.seek(1.7); // SWEEP_AT + SWEEP_DURATION — 스윕 종료
    });
    expect(parseFloat(sweep.style.opacity)).toBeCloseTo(0, 1);

    // LCP 계약 — 스윕은 별개 오버레이 노드고, 이름 자신의 opacity는 어떤
    // seek 지점에서도 건드려선 안 된다. 뮤테이션 (l).
    expect(wordmark.style.opacity).toBe('');
  });

  it('스윕은 transform(xPercent)으로만 이동한다 — 레이아웃 속성을 쓰지 않는다', async () => {
    render(<CompositionHarness />);
    await flushGsapImport();
    const tl = capturedTimeline();
    const sweep = screen.getByTestId('wordmark-sweep');

    act(() => {
      tl.seek(1.55);
    });
    // GSAP은 xPercent를 matrix/translate 기반 transform으로 렌더한다.
    expect(sweep.style.transform).toMatch(/matrix|translate/);
    expect(sweep.style.left).toBe('');
    expect(sweep.style.top).toBe('');
    expect(sweep.style.width).toBe('');
  });

  it('reduced-motion에서는 워드마크·스윕 어느 것도 인라인 스타일을 건드리지 않는다 — 뮤테이션 (j)', async () => {
    // 렌더 직후 곧바로 검사하면(flush 없이) eligible 게이트가 깨져 있어도
    // import('@/lib/gsap') 콜백이 아직 도착하지 않았을 뿐이라 우연히
    // 통과해버린다 — 반드시 flush한 뒤 timelineSpy 호출 수까지 함께
    // 확인해야 "GSAP 자체를 시도조차 하지 않는다"는 실제 계약을 본다.
    render(<CompositionHarness reducedMotion />);
    await flushGsapImport();

    expect(timelineSpy).not.toHaveBeenCalled();

    const wordmark = screen.getByTestId('wordmark');
    const sweep = screen.getByTestId('wordmark-sweep');

    expect(wordmark.style.filter).toBe('');
    expect(sweep.style.opacity).toBe('');
    expect(sweep.style.transform).toBe('');
  });

  // 컨트롤러 추가. pre-boot blur를 CSS가 [data-wordmark-mode='hero']로 소유하게
  // 바뀌면서 새로 생긴 위험이다 — overview로 돌아오면 그 속성이 다시 붙는데
  // 부팅 타임라인은 재생되지 않는다(hasStartedRef). 인라인 blur(0px)가 남아
  // CSS를 덮지 않으면 이름이 흐린 채로 굳는다. jsdom은 CSS를 로드하지 않으므로
  // 관측 가능한 채널은 "인라인 filter가 CSS를 무력화하는 값으로 남아 있는가"다.
  it('overview를 떠났다 돌아와도 이름이 흐린 채로 굳지 않는다', async () => {
    const { rerender } = render(<CompositionHarness active="overview" />);
    await flushGsapImport();

    rerender(<CompositionHarness active="about" />);
    rerender(<CompositionHarness active="overview" />);
    await flushGsapImport();

    const wordmark = screen.getByTestId('wordmark');
    expect(wordmark).toHaveAttribute('data-wordmark-mode', 'hero');
    // CSS는 hero에 blur(5px)를 건다. 인라인이 그것을 덮어야 한다.
    expect(wordmark.style.filter).toBe('blur(0px)');
  });
});
