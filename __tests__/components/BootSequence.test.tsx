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
  sceneReady = true,
  onStart = vi.fn(),
}: Partial<BootSequenceProps>) {
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  const wordmarkScaleRef = useRef<HTMLDivElement>(null);
  return (
    <>
      {/* 실제 Navigation을 쓰지 않고 최소한의 wordmark 자리만 재현한다 —
          hero/compact 스타일은 Navigation 자신의 관심사고, 여기 관심사는
          BootSequence가 이 노드를 어떻게 애니메이션하는지다. */}
      <div ref={wordmarkScaleRef}>
        <button ref={wordmarkRef} data-testid="wordmark">
          KIM TAEIN
        </button>
      </div>
      <BootSequence
        active={active}
        routeResolved={routeResolved}
        motionReady={motionReady}
        reducedMotion={reducedMotion}
        sceneReady={sceneReady}
        wordmarkRef={wordmarkRef}
        wordmarkScaleRef={wordmarkScaleRef}
        onStart={onStart}
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
        sceneReady={false}
        wordmarkRef={wordmarkRef}
        wordmarkScaleRef={wordmarkScaleRef}
        onStart={() => {}}
      />
    </>
  );
}

// BootSequence는 wordmarkRef가 가리키는 노드에 blur만 애니메이션한다(시안
// 스윕은 3라운드에서 제거했다). 위 Harness의 가짜 <button>에는
// data-wordmark-mode가 없어 CSS의 pre-boot blur 오버라이드가 걸리지 않으므로,
// 그 결합(data-wordmark-mode='hero' ↔ blur)을 검증하려면 실제 Navigation을
// 함께 렌더해야 한다.
function CompositionHarness({
  active = 'overview',
  routeResolved = true,
  motionReady = true,
  reducedMotion = false,
  sceneReady = true,
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
        sceneReady={sceneReady}
        wordmarkRef={wordmarkRef}
        wordmarkScaleRef={wordmarkScaleRef}
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
  // 확정 안무: 이름 0.15~1.05초, 역할 라벨 1.30~1.55초, START 1.55~1.80초.
  // 광선이 0.90~1.30초에 감속하며 "도착"하고 그 뒤에 캡션이 순서대로 붙는다.
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
      tl.seek(1.29);
    });
    expect(role.style.opacity).toBe('0');
    expect(start.style.opacity).toBe('0');

    // 역할 라벨 완료 = START 시작 지점. 둘이 겹치지 않는다.
    act(() => {
      tl.seek(1.55);
    });
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('0');

    act(() => {
      tl.seek(1.8);
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
  it('워드마크 pre-boot blur도 CSS가 소유한다 — data-wordmark-mode=hero가 no-preference에서만 blur(8px)', () => {
    const selector = "[data-wordmark-mode='hero']";
    const base = unconditionalRuleBody(selector);
    expect(base, `${selector} 기본 규칙이 없다`).toBeDefined();
    expect(base).toMatch(/filter\s*:\s*blur\(0px\)\s*;/);

    // 8px — 부팅 안무 브리프 LCP 절이 정한 상한(≤8px, 글자를 글자로 알아볼
    // 수 있는 한계). 이전 라운드의 5px에서 올랐다.
    const override = noPreferenceOverrideBody(selector);
    expect(override, `${selector}의 no-preference 오버라이드가 없다`).toBeDefined();
    expect(override).toMatch(/filter\s*:\s*blur\(8px\)\s*;/);

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

  it('아이들 광휘 span이 START 뒤에 존재한다', () => {
    render(<Harness />);
    const start = screen.getByTestId('boot-start');
    const glow = screen.getByTestId('boot-start-glow');

    expect(start).toContainElement(glow);
    expect(glow).toHaveAttribute('aria-hidden', 'true');
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

// 워드마크 blur 안무 — Navigation과 결합해 seek()로 검증한다. 시안
// 스윕(계획 D6/D7 2단계)은 3라운드에서 사용자 판단으로 제거했다(정상
// 동작이나 보기에 이상하다는 판정). blur 초점(blur(5px)→blur(0))은
// 안무 2단계의 다른 절반이라 남긴다.
describe('BootSequence — 워드마크 blur 안무 (Navigation 결합)', () => {
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
    expect(wordmark.style.filter).toBe('');
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
