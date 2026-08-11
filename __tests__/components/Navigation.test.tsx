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
    const { container } = render(
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

    const fades = container.querySelectorAll('[aria-hidden="true"]');
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
