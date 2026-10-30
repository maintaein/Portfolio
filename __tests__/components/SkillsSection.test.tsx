import { useRef as useVisibilityRef } from 'react';
const localVisibility = vi.hoisted(() => ({ visible: true, hasEntered: true }));
vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: localVisibility.visible, hasEntered: localVisibility.hasEntered }) }));
vi.mock('@/components/blocks/ElectricLogo', () => ({
  default: ({ src, active }: { src: string; active: boolean }) => <div data-testid="skills-logo" data-src={src} data-active={String(active)} />,
}));
import { readFileSync } from 'node:fs';
import { StrictMode } from 'react';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import SkillsSection from '@/components/sections/SkillsSection';
import { SectionActivityProvider, type SectionActivityProviderProps } from '@/components/common/SectionActivityContext';
import { SECTION_IDS } from '@/lib/constants';
import { projects, skillCategories } from '@/lib/data';

const visibleSkills = [
  'React', 'TypeScript', 'Next.js', 'Tailwind CSS',
  'Python', 'React Query', 'Zustand', 'Figma',
];
const WEB = ['TUI (Taein UI)', 'Portfolio', 'AlphaMail', 'Ttabong'];
const relations: Record<string, string[]> = {
  React: WEB, TypeScript: WEB, 'Next.js': ['Portfolio'], 'Tailwind CSS': ['Portfolio', 'AlphaMail', 'Ttabong'],
  Python: ['PoseTive'], 'React Query': ['AlphaMail'], Zustand: ['AlphaMail', 'Ttabong'], Figma: ['ReBirth'],
};
const css = readFileSync(resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');

function skillsWithActivity(state: Partial<Omit<SectionActivityProviderProps, 'children'>> = {}) {
  return (
    <SectionActivityProvider obscured={false}
      routeResolved motionReady pageVisible reducedMotion={false} {...state}>
      <SkillsSection />
    </SectionActivityProvider>
  );
}

// 실제 ticker에는 등록하지 않고 콜백만 쥔다. jsdom의 rAF는 돌지 않아 시간은 테스트가 흘린다.
let ticks: Set<gsap.TickerCallback>;
let added: ReturnType<typeof vi.fn>;
function step(ms: number) {
  act(() => { for (let t = 0; t < ms; t += 16) ticks.forEach((tick) => tick(0, 16, 0, 0)); });
}
const nodes = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-project-node]')];
const titles = (container: HTMLElement, state?: 'in' | 'out') =>
  nodes(container).filter((node) => !state || node.dataset.state === state).map((node) => node.dataset.projectNode);
const styles = (container: HTMLElement) =>
  nodes(container).flatMap((node) => [...node.querySelectorAll<HTMLElement | SVGPathElement>('a, [data-part], [data-part="text"] > *, path')]
    .map((el) => `${el.getAttribute('d') ?? ''}|${el.getAttribute('style') ?? ''}`));

describe('SkillsSection signal map', () => {
  beforeEach(() => {
    localVisibility.visible = true; localVisibility.hasEntered = true;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    ticks = new Set();
    added = vi.fn();
    vi.spyOn(gsap.ticker, 'add').mockImplementation((tick: Parameters<typeof gsap.ticker.add>[0]) => {
      added(tick); ticks.add(tick); return tick;
    });
    vi.spyOn(gsap.ticker, 'remove').mockImplementation((tick: Parameters<typeof gsap.ticker.remove>[0]) => { ticks.delete(tick); });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('shows only the eight approved project-backed skills with existing icons', () => {
    render(skillsWithActivity());
    const buttons = screen.getAllByRole('button', { name: /^(TypeScript|Python|React|Next\.js|Tailwind CSS|React Query|Zustand|Figma)$/ });
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(visibleSkills);
    for (const name of visibleSkills) {
      const skill = skillCategories.flatMap((category) => category.skills).find((item) => item.name === name)!;
      expect(screen.getByRole('button', { name }).style.getPropertyValue('--skill-icon-src'))
        .toBe(`url(/icons-mono/${skill.icon}.svg)`);
    }
    expect(screen.queryByRole('button', { name: 'JavaScript' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'React' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects on hover, focus, and click, replacing the prior project map immediately', () => {
    const { container } = render(skillsWithActivity());
    const map = () => container.querySelector('[data-skill-map]')!;
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Python' }));
    expect(map()).toHaveAttribute('data-active-skill', 'Python');
    expect(screen.getByRole('link', { name: /PoseTive/ })).toHaveAttribute('href',
      projects.find((project) => project.title === 'PoseTive')!.githubUrl);
    fireEvent.focus(screen.getByRole('button', { name: 'Figma' }));
    expect(map()).toHaveAttribute('data-active-skill', 'Figma');
    expect(screen.getByRole('link', { name: /ReBirth/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'React Query' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zustand' }));
    expect(map()).toHaveAttribute('data-active-skill', 'Zustand');
    expect(screen.queryByRole('link', { name: /ReBirth/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /PoseTive/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zustand' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'React Query' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('links every active satellite to a real project and keeps the existing description', () => {
    render(skillsWithActivity());
    for (const name of visibleSkills) {
      fireEvent.click(screen.getByRole('button', { name }));
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(projects.some((project) => project.githubUrl === link.getAttribute('href'))).toBe(true);
      }
      const skill = skillCategories.flatMap((category) => category.skills).find((item) => item.name === name)!;
      expect(screen.getByTestId('skill-result')).toHaveTextContent(skill.description);
    }
  });

  it('8개 스킬의 관계를 노드·썸네일·subtitle·GitHub 링크로 그린다', () => {
    const { container } = render(skillsWithActivity({ reducedMotion: true }));
    // subtitle의 줄바꿈은 공백 하나로 접는다.
    expect(container.querySelector('[data-project-node="TUI (Taein UI)"] a')!.textContent).toContain('개발자 김태인의');
    for (const name of visibleSkills) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(titles(container)).toEqual(relations[name]);
      for (const node of nodes(container)) {
        const project = projects.find((item) => item.title === node.dataset.projectNode)!;
        const link = node.querySelector('a')!;
        expect(link).toHaveAttribute('href', project.githubUrl);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('aria-label', `${project.title} GitHub`);
        expect(node.querySelector('img')!.getAttribute('src')).toContain(encodeURIComponent(project.image));
        expect(link).toHaveTextContent(project.subtitle!.replace(/\s*\n\s*/g, ' '));
        expect(link).toHaveTextContent('GitHub ↗');
      }
    }
  });

  it('React→TypeScript 전환은 네 노드를 언마운트하지 않고 in으로 남긴다', () => {
    const { container } = render(skillsWithActivity());
    step(3000);
    const before = nodes(container);
    fireEvent.click(screen.getByRole('button', { name: 'TypeScript' }));
    expect(nodes(container)).toEqual(before);
    expect(titles(container, 'in')).toEqual(WEB);
    step(3000);
    expect(nodes(container)).toEqual(before);
    expect(before.every((node) => node.dataset.state === 'in')).toBe(true);
  });

  it('React→Python 전환은 빠지는 네 노드가 out을 거쳐 사라지고 PoseTive 하나만 남는다', () => {
    const { container } = render(skillsWithActivity());
    step(3000);
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    expect(titles(container, 'out')).toEqual(WEB);
    expect(titles(container, 'in')).toEqual(['PoseTive']);
    for (const node of nodes(container).filter((item) => item.dataset.state === 'out')) {
      expect(node).toHaveAttribute('aria-hidden', 'true');
      expect(node).toHaveAttribute('inert');
    }
    step(100);
    expect(titles(container, 'out')).toEqual(WEB);
    step(1000);
    expect(titles(container)).toEqual(['PoseTive']);
    step(2000);
    const pose = container.querySelector<HTMLElement>('[data-project-node="PoseTive"]')!;
    expect(pose.querySelector<HTMLElement>('[data-part="thumb"]')!.style.clipPath).toBe('inset(0 0% 0 0)');
  });

  it('전환 도중 다른 스킬을 고르면 마지막 선택의 노드 집합으로 끝난다', () => {
    const { container } = render(skillsWithActivity());
    step(3000);
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    step(100);
    fireEvent.click(screen.getByRole('button', { name: 'Zustand' }));
    step(3000);
    expect(titles(container)).toEqual(['AlphaMail', 'Ttabong']);
    expect(titles(container, 'in')).toEqual(['AlphaMail', 'Ttabong']);
    for (const name of visibleSkills) { fireEvent.mouseEnter(screen.getByRole('button', { name })); step(32); }
    step(3000);
    expect(titles(container)).toEqual(['ReBirth']);
    const text = [...container.querySelectorAll<HTMLElement>('[data-project-node="ReBirth"] [data-part="text"] > *')];
    expect(text.map((el) => el.style.opacity)).toEqual(['1', '1', '1']);
  });

  it('모션 감소에서는 첫 렌더부터 최종 상태이고 스프링 tick이 없다', () => {
    const { container } = render(skillsWithActivity({ reducedMotion: true }));
    expect(added).not.toHaveBeenCalled();
    const check = () => {
      for (const node of nodes(container)) {
        expect(node.dataset.state).toBe('in');
        expect(node.querySelector<HTMLElement>('[data-part="thumb"]')!.style.clipPath).toBe('inset(0 0% 0 0)');
        for (const el of node.querySelectorAll<HTMLElement>('[data-part="text"] > *')) expect(el.style.opacity).toBe('1');
        expect(node.querySelector('[data-line="hub"]')!.getAttribute('d')).toMatch(/^M/);
        expect(node.querySelector('[data-line="desc"]')!.getAttribute('d')).toMatch(/^M/);
      }
      expect(container.querySelector('[data-graph="link"]')!.getAttribute('d')).toMatch(/^M/);
      expect(container.querySelector<HTMLElement>('[data-graph="hub"]')!.style.opacity).toBe('1');
    };
    check();
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    expect(titles(container)).toEqual(['PoseTive']);
    check();
    expect(added).not.toHaveBeenCalled();
    expect(screen.queryByTestId('skills-logo')).not.toBeInTheDocument();
  });

  it('숨김·obscured·화면 밖인 동안 진행을 멈추고 돌아오면 이어 간다', () => {
    const { container, rerender } = render(skillsWithActivity());
    step(400);
    const partial = styles(container);
    expect(container.querySelector('[data-project-node] [data-part="thumb"]')!.getAttribute('style')).not.toContain('inset(0 0% 0 0)');
    for (const state of [{ pageVisible: false }, { obscured: true }, {}]) {
      if (!Object.keys(state).length) localVisibility.visible = false;
      rerender(skillsWithActivity(state));
      expect(ticks.size).toBe(0);
      step(1000);
      expect(styles(container)).toEqual(partial);
      localVisibility.visible = true;
      rerender(skillsWithActivity());
      expect(ticks.size).toBe(1);
      expect(container.querySelector('[data-skill-map]')).toHaveAttribute('data-active-skill', 'React');
    }
    step(3000);
    expect(styles(container)).not.toEqual(partial);
    for (const node of nodes(container)) expect(node.querySelector<HTMLElement>('[data-part="thumb"]')!.style.clipPath).toBe('inset(0 0% 0 0)');
  });

  it('keeps bare icons and focusable project links without the old surface drawing', () => {
    const { container } = render(skillsWithActivity());
    const button = screen.getByRole('button', { name: 'React' });
    expect(button.className).not.toMatch(/\bbg-|\bborder-/);
    expect(button.querySelector('.skill-icon-active')).toBeInTheDocument();
    expect(container.querySelector('.signal-surface')).not.toBeInTheDocument();
    expect(css).not.toMatch(/signal-surface|signal-draw|signal-reveal|730ms/);
    expect(css).toMatch(/\.signal-project:focus-visible :is\([^)]*\.signal-thumb[\s\S]*?opacity: 1 !important/);
  });

  it('waits for actual visible Skills entry, grows once, and keeps later selections on the same graph', () => {
    const { container, rerender } = render(skillsWithActivity({ obscured: true }));
    for (const state of [{ routeResolved: false }, { motionReady: false }, { pageVisible: false }]) {
      rerender(skillsWithActivity(state));
      expect(added).not.toHaveBeenCalled();
    }
    // 들어오기 전에는 접힌 채 기다린다.
    expect(container.querySelector('[data-graph="link"]')!.getAttribute('d')).toBe('');
    rerender(skillsWithActivity());
    expect(added).toHaveBeenCalledTimes(1);
    step(3000);
    expect(container.querySelector('[data-graph="link"]')!.getAttribute('d')).toMatch(/^M/);
    rerender(skillsWithActivity({ obscured: true }));
    rerender(skillsWithActivity());
    expect(added).toHaveBeenCalledTimes(2);
    expect(new Set(added.mock.calls.map(([tick]) => tick)).size).toBe(1);
    fireEvent.focus(screen.getByRole('button', { name: 'Python' }));
    step(3000);
    expect(titles(container)).toEqual(['PoseTive']);
  });

  it('모션 선호를 알기 전의 reducedMotion 기본값(true)으로 굳지 않고 진입에서 자란다', () => {
    localVisibility.visible = false;
    const { container, rerender } = render(skillsWithActivity({ motionReady: false, reducedMotion: true }));
    rerender(skillsWithActivity());
    expect(container.querySelector('[data-graph="link"]')!.getAttribute('d')).toBe('');
    expect(container.querySelector<HTMLElement>('[data-project-node] [data-part="thumb"]')!.style.clipPath).toBe('inset(0 100% 0 0)');
    localVisibility.visible = true;
    rerender(skillsWithActivity());
    expect(ticks.size).toBe(1);
    step(3000);
    expect(container.querySelector('[data-graph="link"]')!.getAttribute('d')).toMatch(/^M/);
    expect(container.querySelector<HTMLElement>('[data-project-node] [data-part="thumb"]')!.style.clipPath).toBe('inset(0 0% 0 0)');
  });

  it('cleans up a running graph when reduced motion is enabled without replaying it', () => {
    const { container, rerender } = render(skillsWithActivity());
    step(200);
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    rerender(skillsWithActivity({ reducedMotion: true }));
    expect(ticks.size).toBe(0);
    expect(titles(container)).toEqual(['PoseTive']);
    expect(container.querySelector<HTMLElement>('[data-project-node] [data-part="thumb"]')!.style.clipPath).toBe('inset(0 0% 0 0)');
    rerender(skillsWithActivity());
    expect(ticks.size).toBe(1);
    step(100);
    expect(container.querySelector<HTMLElement>('[data-project-node] [data-part="thumb"]')!.style.clipPath).toBe('inset(0 0% 0 0)');
  });

  it('keeps direct-entry animation after StrictMode effect replay', () => {
    const { container } = render(<StrictMode>{skillsWithActivity()}</StrictMode>);
    expect(ticks.size).toBe(1);
    for (const node of nodes(container)) {
      expect(node.querySelector<HTMLElement>('[data-part="thumb"]')!.style.clipPath).toBe('inset(0 100% 0 0)');
    }
    step(3000);
    for (const node of nodes(container)) {
      expect(node.querySelector<HTMLElement>('[data-part="thumb"]')!.style.clipPath).toBe('inset(0 0% 0 0)');
    }
  });

  it('허브는 들어온 동안만 도는 자기 ElectricLogo이고 src를 고른 아이콘으로 바꾼다', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { rerender } = render(skillsWithActivity({ obscured: true }));
    expect(screen.queryByTestId('skills-logo')).not.toBeInTheDocument();
    rerender(skillsWithActivity());
    const logo = await screen.findByTestId('skills-logo');
    expect(logo).toHaveAttribute('data-src', '/icons-mono/react.svg');
    expect(logo).toHaveAttribute('data-active', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    expect(screen.getByTestId('skills-logo')).toHaveAttribute('data-src', '/icons-mono/python.svg');
    rerender(skillsWithActivity({ obscured: true }));
    expect(screen.getByTestId('skills-logo')).toHaveAttribute('data-active', 'false');
    rerender(skillsWithActivity({ reducedMotion: true }));
    expect(screen.queryByTestId('skills-logo')).not.toBeInTheDocument();
  });

  it('keeps the labeled icon navigation as a native ScrollArea with buttons that do not shrink', () => {
    render(skillsWithActivity());
    expect(screen.getByRole('navigation', { name: '기술 선택' })).toHaveClass('scroll-area', 'signal-nav');
    expect(css).toMatch(/\.signal-skill\s*\{[^}]*flex-shrink: 0/);
    expect(css).not.toMatch(/\.signal-nav[^}]*scrollbar-width: none/);
    expect(css).toMatch(/\.scroll-area::-webkit-scrollbar-button\s*\{[^}]*display: none/);
  });

  it('keeps all eight skill descriptions and project names in server HTML', () => {
    const html = renderToString(skillsWithActivity());
    expect(html).toContain(`id="${SECTION_IDS.SKILLS}"`);
    for (const name of visibleSkills) {
      const skill = skillCategories.flatMap((category) => category.skills).find((item) => item.name === name)!;
      expect(html).toContain(skill.description);
    }
    expect(html).toContain('TUI (Taein UI)');
    expect(html).toContain('AlphaMail');
    expect(html).toContain('PoseTive');
    expect(html).toContain('ReBirth');
  });
});
