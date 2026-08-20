import { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Navigation from '@/components/blocks/Navigation';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
import { NAV_ITEMS, PERSONAL_INFO } from '@/lib/constants';

let compactViewport = false;
let reducedMotion = false;
const scrollIntoView = vi.fn();
const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollIntoView'
);
// sm/md에서는 간격·글자 유틸만 허용한다. 그 밖의 토큰은 모르는 유틸까지
// 기본 차단해 Compact 구조가 lg 전에 바뀌지 않게 한다.
const earlyBreakpointDisallowedUtility =
  /\b(?:sm|md):(?!(?:!?-?(?:text|tracking|leading|font|gap(?:-[xy])?|p(?:[xytrblse])?|m(?:[xytrblse])?|space-[xy])-[^\s"'<>]+)(?=[\s"'<>]))[^\s"'<>]+(?=[\s"'<>])/g;

beforeEach(() => {
  compactViewport = false;
  reducedMotion = false;
  scrollIntoView.mockReset();

  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(max-width: 1023px)' ? compactViewport : reducedMotion,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
});

afterEach(() => {
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(
      Element.prototype,
      'scrollIntoView',
      originalScrollIntoViewDescriptor
    );
  } else {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Navigation', () => {
  it('자체 scroll listener를 등록하지 않는다', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');

    render(
      <Navigation
        items={NAV_ITEMS}
        active="overview"
        onNavigate={() => {}}
      />
    );

    expect(
      addEventListener.mock.calls.some(([eventName]) => eventName === 'scroll')
    ).toBe(false);
  });

  it('모든 항목을 렌더한다', () => {
    render(
      <Navigation
        items={NAV_ITEMS}
        active="overview"
        onNavigate={() => {}}
      />
    );

    for (const item of NAV_ITEMS) {
      expect(
        screen.getByRole('button', { name: new RegExp(item.label, 'i') })
      ).toBeInTheDocument();
    }
  });

  it('활성 항목에 aria-current를 준다', () => {
    render(
      <Navigation
        items={NAV_ITEMS}
        active="projects"
        onNavigate={() => {}}
      />
    );

    expect(
      screen.getByRole('button', { name: /projects/i })
    ).toHaveAttribute('aria-current', 'page');
  });

  it('비활성 항목에는 aria-current가 없다', () => {
    render(
      <Navigation
        items={NAV_ITEMS}
        active="projects"
        onNavigate={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /about/i })).not.toHaveAttribute(
      'aria-current'
    );
    expect(screen.getAllByRole('button', { current: 'page' })).toHaveLength(1);
  });

  it('클릭하면 onNavigate를 그 id로 호출한다', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <Navigation
        items={NAV_ITEMS}
        active="overview"
        onNavigate={onNavigate}
      />
    );

    await user.click(screen.getByRole('button', { name: /projects/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('projects');
  });

  it('워드마크를 클릭하면 overview로 이동한다', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <Navigation
        items={NAV_ITEMS}
        active="projects"
        onNavigate={onNavigate}
      />
    );

    await user.click(screen.getByTestId('wordmark'));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('overview');
  });

  it('Tab과 Enter로 이동할 수 있다', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <Navigation
        items={NAV_ITEMS}
        active="overview"
        onNavigate={onNavigate}
      />
    );

    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: /about/i })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('about');
  });

  it('Tailwind 팔레트 색상 유틸을 렌더하지 않는다', () => {
    const { container } = render(
      <Navigation
        items={NAV_ITEMS}
        active="overview"
        onNavigate={() => {}}
      />
    );

    expect(findTailwindPaletteColorUtilities(container.innerHTML)).toEqual([]);
  });

  it('sm 또는 md에서 간격·글자 외 유틸을 렌더하지 않는다', () => {
    const { container } = render(
      <Navigation
        items={NAV_ITEMS}
        active="projects"
        onNavigate={() => {}}
      />
    );

    expect(
      container.innerHTML.match(earlyBreakpointDisallowedUtility) ?? []
    ).toEqual([]);
  });

  it('워드마크가 PERSONAL_INFO 이름을 쓰는 단일 FLIP 노드다', () => {
    const wordmarkRef = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <Navigation
        items={NAV_ITEMS}
        active="overview"
        onNavigate={() => {}}
        wordmarkRef={wordmarkRef}
      />
    );

    const wordmark = screen.getByTestId('wordmark');
    expect(screen.getAllByTestId('wordmark')).toHaveLength(1);
    expect(PERSONAL_INFO.NAME_EN).toBe('KIM TAEIN');
    expect(wordmark).toHaveTextContent(PERSONAL_INFO.NAME_EN);
    expect(wordmark).toHaveAttribute('data-flip-id', 'site-wordmark');
    expect(wordmark).toHaveAttribute('data-wordmark-mode', 'hero');
    expect(wordmarkRef.current).toBe(wordmark);

    rerender(
      <Navigation
        items={NAV_ITEMS}
        active="projects"
        onNavigate={() => {}}
        wordmarkRef={wordmarkRef}
      />
    );
    expect(wordmark).toHaveAttribute('data-wordmark-mode', 'compact');
  });

  it('Compact 항목과 양 끝 fade가 터치·접근성 계약을 지킨다', () => {
    render(
      <Navigation
        items={NAV_ITEMS}
        active="projects"
        onNavigate={() => {}}
      />
    );

    const item = screen.getByRole('button', { name: /projects/i });
    expect(item.className).toContain('text-t7');
    expect(item.className).toContain('min-h-11');
    const inactiveItem = screen.getByRole('button', { name: /about/i });
    expect(inactiveItem.className).toContain('text-t7');
    expect(inactiveItem.className).toContain('min-h-11');
    expect(screen.getByTestId('nav-strip').className).toContain(
      'overflow-x-auto'
    );

    // nav-strip을 감싸는 wrapper로 좁힌다 — 워드마크 버튼 안의 시안 스윕
    // 오버레이(wordmark-sweep)도 aria-hidden="true"라 좁히지 않으면 섞인다.
    const stripWrapper = screen.getByTestId('nav-strip').parentElement!;
    const fades = stripWrapper.querySelectorAll('[aria-hidden="true"]');
    expect(fades).toHaveLength(2);
    for (const fade of fades) {
      expect(fade.className).toContain('pointer-events-none');
      expect(fade.className).toContain('lg:hidden');
    }
  });

  it('활성 언더라인은 cyan 전체 폭이고 비활성 언더라인은 폭이 0이다', () => {
    render(
      <Navigation
        items={NAV_ITEMS}
        active="projects"
        onNavigate={() => {}}
      />
    );

    const activeUnderline = screen
      .getByRole('button', { name: /projects/i })
      .querySelector('span.absolute.bottom-0');
    expect(activeUnderline).toBeInTheDocument();
    expect(activeUnderline).toHaveClass(
      'bg-[var(--color-cyan-core)]',
      'w-full'
    );

    const inactiveUnderline = screen
      .getByRole('button', { name: /about/i })
      .querySelector('span.absolute.bottom-0');
    expect(inactiveUnderline).toBeInTheDocument();
    expect(inactiveUnderline).toHaveClass(
      'bg-[var(--color-cyan-core)]',
      'w-0'
    );
  });

  it('desktop에서는 mount와 활성 변경과 focus를 중앙 정렬하지 않는다', () => {
    const { rerender } = render(
      <Navigation
        items={NAV_ITEMS}
        active="about"
        onNavigate={() => {}}
      />
    );

    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(
      <Navigation
        items={NAV_ITEMS}
        active="projects"
        onNavigate={() => {}}
      />
    );
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByRole('button', { name: /skills/i }));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('활성 변경과 keyboard focus를 중앙 정렬하고 reduced-motion은 auto를 쓴다', async () => {
    compactViewport = true;
    const { rerender } = render(
      <Navigation
        items={NAV_ITEMS}
        active="about"
        onNavigate={() => {}}
      />
    );

    const about = screen.getByRole('button', { name: /about/i });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(about);
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });

    scrollIntoView.mockClear();
    rerender(
      <Navigation
        items={NAV_ITEMS}
        active="projects"
        onNavigate={() => {}}
      />
    );
    const projects = screen.getByRole('button', { name: /projects/i });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(projects);

    scrollIntoView.mockClear();
    const skills = screen.getByRole('button', { name: /skills/i });
    fireEvent.focus(skills);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(skills);
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });

    scrollIntoView.mockClear();
    reducedMotion = true;
    rerender(
      <Navigation
        items={NAV_ITEMS}
        active="projects"
        onNavigate={() => {}}
        reducedMotion={reducedMotion}
      />
    );
    scrollIntoView.mockClear();
    const awards = screen.getByRole('button', { name: /awards/i });
    fireEvent.focus(awards);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(awards);
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'auto',
      block: 'nearest',
      inline: 'center',
    });
  });
});

// boot-composition 브리프 — overview 부팅 구도 재작업 여섯 항목 중
// Navigation이 소유하는 부분(nav-strip 숨김, 워드마크 중앙 정렬, 시안 스윕
// 오버레이 구조). CSS 파일 자체(design-tokens.css)는 jsdom에 로드되지
// 않으므로(vitest.setup.ts에 CSS import가 없음), 여기서는 "어떤 클래스가
// 어떤 조건에서 붙는가"라는 구조만 고정한다. 실제 opacity·visibility 계산,
// 겹침 여부, 중앙 정렬 결과는 실기기 몫이다.
describe('Navigation — overview 부팅 구도', () => {
  it('overview에서는 nav-strip이 숨김 클래스를 받고, 아니면 보임 클래스를 받는다', () => {
    const { rerender } = render(
      <Navigation items={NAV_ITEMS} active="overview" onNavigate={() => {}} />
    );
    expect(screen.getByTestId('nav-strip').className).toContain(
      'nav-strip-hidden'
    );
    expect(screen.getByTestId('nav-strip').className).not.toContain(
      'nav-strip-visible'
    );

    rerender(
      <Navigation items={NAV_ITEMS} active="about" onNavigate={() => {}} />
    );
    expect(screen.getByTestId('nav-strip').className).toContain(
      'nav-strip-visible'
    );
    expect(screen.getByTestId('nav-strip').className).not.toContain(
      'nav-strip-hidden'
    );
  });

  it('워드마크는 active와 무관하게 절대 숨겨지지 않는다 — LCP 요소', () => {
    // nav-strip을 숨기는 매커니즘(클래스·aria-hidden·inert)이 실수로 <nav>
    // 전체나 워드마크 자신에 번져도 이 테스트가 잡는다. 뮤테이션 (b).
    for (const active of ['overview', 'about'] as const) {
      const { unmount, container } = render(
        <Navigation items={NAV_ITEMS} active={active} onNavigate={() => {}} />
      );

      const wordmark = screen.getByTestId('wordmark');
      expect(wordmark.className).not.toMatch(
        /nav-strip-hidden|opacity-0|invisible/
      );
      expect(wordmark).not.toHaveAttribute('aria-hidden');
      expect(wordmark).not.toHaveAttribute('inert');

      const nav = container.querySelector('nav')!;
      expect(nav.className).not.toMatch(
        /nav-strip-hidden|opacity-0|invisible|hidden/
      );
      expect(nav).not.toHaveAttribute('aria-hidden');
      expect(nav).not.toHaveAttribute('inert');

      unmount();
    }
  });

  it('hero 모드 워드마크는 transform 없는 wrapper가 뷰포트 중앙 하단(50%)에 정렬하고, compact에서는 그 wrapper가 사라진다', () => {
    // 3라운드 회귀 — 워드마크(FLIP 대상) 자신에 CSS position:fixed·transform이
    // 실려 있으면 GSAP Flip의 inline transform·absolute:true와 충돌해
    // 실기기에서 비행 뒤 워드마크가 사라졌다. 위치는 이제 감싸는 wrapper
    // div가 담당하고, 워드마크 버튼 자신은 position·transform이 전혀 없다.
    const { rerender } = render(
      <Navigation items={NAV_ITEMS} active="overview" onNavigate={() => {}} />
    );
    const wordmark = screen.getByTestId('wordmark');
    const wrapper = wordmark.parentElement!;

    // 뮤테이션 (a) — 워드마크 자신에 position:fixed·translate를 되돌리면
    // 아래 두 줄이 FAIL한다.
    expect(wordmark.className).not.toMatch(/\bfixed\b|\babsolute\b|translate/);
    expect(wrapper.className).not.toMatch(/translate/);

    // wrapper가 transform 없이 같은 "바닥이 50%에 닿는다" 정렬을 얻는다 —
    // bottom-1/2(뷰포트 50% 선에 자기 바닥을 붙임) + inset-x-0 + flex
    // justify-center(수평 중앙, transform 없이).
    expect(wrapper.className).toContain('fixed');
    expect(wrapper.className).toContain('bottom-1/2');
    expect(wrapper.className).toContain('inset-x-0');
    expect(wrapper.className).toContain('justify-center');

    rerender(
      <Navigation items={NAV_ITEMS} active="about" onNavigate={() => {}} />
    );
    // compact 모드는 flex 흐름 안 shrink-0이지 fixed 중앙 정렬이 아니다 —
    // wrapper는 display:contents로 스스로 사라져 워드마크를 nav 행의 평범한
    // flex 자식으로 되돌린다.
    const compactWordmark = screen.getByTestId('wordmark');
    expect(compactWordmark.className).not.toContain('fixed');
    expect(compactWordmark.className).toContain('shrink-0');
    expect(compactWordmark.parentElement!.className).toContain('contents');
  });

  it('워드마크가 흐름에서 빠져도(Flip absolute:true) 네비 항목이 움직이지 않도록 ml-auto로 스스로 오른쪽 끝을 지킨다', () => {
    // 3라운드 회귀 — nav 행이 justify-between인 채로 워드마크만
    // position:absolute로 흐름에서 빠지면(GSAP Flip의 absolute:true) 남은
    // 자식(nav-strip wrapper) 하나가 flex-start(왼쪽)로 쏠렸다. ml-auto는
    // 형제가 몇 개 남든 스스로 오른쪽 끝을 지키므로 워드마크의 흐름 이탈과
    // 무관하다. 뮤테이션 (b) — justify-between을 되돌리고 ml-auto를
    // 지우면 이 테스트가 FAIL한다.
    const { container } = render(
      <Navigation items={NAV_ITEMS} active="about" onNavigate={() => {}} />
    );

    const navRow = container.querySelector('nav > div')!;
    expect(navRow.className).not.toContain('justify-between');

    const navStripWrapper = screen.getByTestId('nav-strip').parentElement!;
    expect(navStripWrapper.className).toContain('ml-auto');
  });
});
