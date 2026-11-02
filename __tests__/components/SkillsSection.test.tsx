import { useRef as useVisibilityRef } from 'react';
const localVisibility = vi.hoisted(() => ({ visible: true, hasEntered: true }));
vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: localVisibility.visible, hasEntered: localVisibility.hasEntered }) }));
vi.mock('@/components/blocks/ElectricLogo', () => ({
  default: () => <div data-testid="skills-logo" />,
}));
import { readFileSync } from 'node:fs';
import { StrictMode } from 'react';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import SkillsSection, { type SkillsSectionHandle } from '@/components/sections/SkillsSection';
import { createRef, type Ref } from 'react';
import { SectionActivityProvider, type SectionActivityProviderProps } from '@/components/common/SectionActivityContext';
import { SECTION_IDS } from '@/lib/constants';
import { projects, skillCategories } from '@/lib/data';
import { drawOrb } from '@/components/sections/ExperienceSection/orb';
import { K } from '@/components/sections/ExperienceSection/lineMotion';

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

function skillsWithActivity(state: Partial<Omit<SectionActivityProviderProps, 'children'>> = {}, props: { ref?: Ref<SkillsSectionHandle>; headArrived?: boolean; headAway?: boolean; onHeadShown?: () => void } = {}) {
  return (
    <SectionActivityProvider obscured={false}
      routeResolved motionReady pageVisible reducedMotion={false} {...state}>
      <SkillsSection {...props} />
    </SectionActivityProvider>
  );
}

// jsdom에는 2d 캔버스가 없다. ExperienceOverlay.test.ts처럼 모의 컨텍스트로 그리기 호출만 센다.
// 매 프레임 호출을 다 기록하면 느려서 헤드를 보는 case만 켠다. 나머지는 컨텍스트 없음(헤드 생략) 경로다.
type FakeContext = Record<string, ReturnType<typeof vi.fn>>;
let contexts: FakeContext[];
let canvas2d: boolean;
function fakeContext(): FakeContext {
  const store: Record<string | symbol, unknown> = {};
  return new Proxy(store, {
    get(target, key) {
      if (!(key in target)) target[key] = key === 'createRadialGradient' ? vi.fn(() => ({ addColorStop: vi.fn() })) : vi.fn();
      return target[key];
    },
    set(target, key, value) { target[key] = value; return true; },
  }) as FakeContext;
}
// 헤드 캔버스에 2d 컨텍스트를 주고, sized면 데스크톱처럼 크기(120×784)도 준다. jsdom은 레이아웃이 없어 크기가 0이다.
function enableCanvas(sized = true) {
  canvas2d = true;
  if (!sized) return;
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) { return this instanceof HTMLCanvasElement ? 120 : 0; });
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) { return this instanceof HTMLCanvasElement ? 784 : 0; });
}
const gradients = () => contexts.reduce((n, c) => n + c.createRadialGradient.mock.calls.length, 0);
// 헤드는 잔상 다음, 고리 앞에 그린다. 고리가 없으면 마지막 방사 그라데이션의 y가 헤드 y다.
const headY = () => contexts.at(-1)!.createRadialGradient.mock.calls.at(-1)![1] as number;
const linkD = (container: HTMLElement) => container.querySelector('[data-graph="link"]')!.getAttribute('d');

// 실제 ticker에는 등록하지 않고 콜백만 쥔다. jsdom의 rAF는 돌지 않아 시간은 테스트가 흘린다.
let ticks: Set<gsap.TickerCallback>;
let added: ReturnType<typeof vi.fn>;
function step(ms: number) {
  act(() => { for (let t = 0; t < ms; t += 16) ticks.forEach((tick) => tick(0, 16, 0, 0)); });
}
const nodes = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-project-node]')];
const titles = (container: HTMLElement, state?: 'in' | 'out') =>
  nodes(container).filter((node) => !state || node.dataset.state === state).map((node) => node.dataset.projectNode);
// 남은 노드마다 썸네일이 다 펼쳐지고, 두 선이 그려지고, 글자가 다 보인다.
function expectRevealed(container: HTMLElement) {
  for (const node of nodes(container)) {
    expect(node.dataset.state).toBe('in');
    expect(node.querySelector<HTMLElement>('[data-part="thumb"]')!.style.maskImage).toBe('none');
    expect(node.querySelector('[data-line="hub"]')!.getAttribute('d')).toMatch(/^M/);
    expect(node.querySelector('[data-line="desc"]')!.getAttribute('d')).toMatch(/^M/);
    expect([...node.querySelectorAll<HTMLElement>('[data-part="text"] > *')].map((el) => el.style.opacity)).toEqual(['1', '1', '1']);
  }
}
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
    contexts = []; canvas2d = false;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => {
      if (!canvas2d) return null;
      const c = fakeContext(); contexts.push(c); return c;
    }) as unknown as HTMLCanvasElement['getContext']);
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

  it('프레임이 200ms씩 늦어도 진입은 실제 시간대로 2.4초 안에 끝난다', () => {
    const { container } = render(skillsWithActivity());
    // 50ms 상한이면 같은 12프레임에 0.6초만 흘러 첫 선도 다 못 뻗는다.
    act(() => { for (let t = 0; t < 2400; t += 200) ticks.forEach((tick) => tick(0, 200, 0, 0)); });
    expectRevealed(container);
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
    expect(pose.querySelector<HTMLElement>('[data-part="thumb"]')!.style.maskImage).toBe('none');
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
    // 집합만이 아니라 화면도 수렴한다. 회수 도중 다시 고른 Ttabong도 다 펼쳐지고 글자가 보인다.
    expectRevealed(container);
    for (const name of visibleSkills) { fireEvent.mouseEnter(screen.getByRole('button', { name })); step(32); }
    step(3000);
    expect(titles(container)).toEqual(['ReBirth']);
    expectRevealed(container);
  });

  it.each([100, 150, 200, 300])('React→Python→TypeScript를 %ims 간격으로 고르면 회수 중이던 네 노드가 다시 다 펼쳐진다', (gap) => {
    const { container } = render(skillsWithActivity());
    step(3000);
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    step(gap);
    fireEvent.click(screen.getByRole('button', { name: 'TypeScript' }));
    step(4000);
    expect(titles(container)).toEqual(WEB);
    expectRevealed(container);
  });

  it('모션 감소에서는 첫 렌더부터 최종 상태이고 스프링 tick이 없다', () => {
    const { container } = render(skillsWithActivity({ reducedMotion: true }));
    expect(added).not.toHaveBeenCalled();
    const check = () => {
      for (const node of nodes(container)) {
        expect(node.dataset.state).toBe('in');
        expect(node.querySelector<HTMLElement>('[data-part="thumb"]')!.style.maskImage).toBe('none');
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
    for (const node of nodes(container)) expect(node.querySelector<HTMLElement>('[data-part="thumb"]')!.style.maskImage).toBe('none');
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
    expect(container.querySelector<HTMLElement>('[data-project-node] [data-part="thumb"]')!.style.maskImage).toBe('linear-gradient(90deg, #000 -40%, transparent 0%)');
    localVisibility.visible = true;
    rerender(skillsWithActivity());
    expect(ticks.size).toBe(1);
    step(3000);
    expect(container.querySelector('[data-graph="link"]')!.getAttribute('d')).toMatch(/^M/);
    expect(container.querySelector<HTMLElement>('[data-project-node] [data-part="thumb"]')!.style.maskImage).toBe('none');
  });

  it('cleans up a running graph when reduced motion is enabled without replaying it', () => {
    const { container, rerender } = render(skillsWithActivity());
    step(200);
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    rerender(skillsWithActivity({ reducedMotion: true }));
    expect(ticks.size).toBe(0);
    expect(titles(container)).toEqual(['PoseTive']);
    expect(container.querySelector<HTMLElement>('[data-project-node] [data-part="thumb"]')!.style.maskImage).toBe('none');
    rerender(skillsWithActivity());
    expect(ticks.size).toBe(1);
    step(100);
    expect(container.querySelector<HTMLElement>('[data-project-node] [data-part="thumb"]')!.style.maskImage).toBe('none');
  });

  it('keeps direct-entry animation after StrictMode effect replay', () => {
    const { container } = render(<StrictMode>{skillsWithActivity()}</StrictMode>);
    expect(ticks.size).toBe(1);
    for (const node of nodes(container)) {
      expect(node.querySelector<HTMLElement>('[data-part="thumb"]')!.style.maskImage).toBe('linear-gradient(90deg, #000 -40%, transparent 0%)');
    }
    step(3000);
    for (const node of nodes(container)) {
      expect(node.querySelector<HTMLElement>('[data-part="thumb"]')!.style.maskImage).toBe('none');
    }
  });

  it('Skills는 자기 ElectricLogo(두 번째 WebGL 문맥)를 띄우지 않는다', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { container } = render(skillsWithActivity());
    step(3000);
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    step(1000);
    // 지연 청크가 풀릴 시간을 준다.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
    expect(screen.queryByTestId('skills-logo')).not.toBeInTheDocument();
    expect(container.querySelector('canvas:not([data-graph="head"])')).not.toBeInTheDocument();
  });

  it('허브 아이콘은 고를 때 SVG 번개 모프(700ms)로 바뀌고 끝나면 필터 없이 새 아이콘에 선다', () => {
    const { container } = render(skillsWithActivity());
    const hub = () => container.querySelector<HTMLElement>('[data-graph="hub"]')!;
    const icon = (part: 'a' | 'b') => container.querySelector<HTMLElement>(`[data-graph="icon-${part}"]`)!;
    const src = (part: 'a' | 'b') => icon(part).style.getPropertyValue('--skill-icon-src');
    const scale = () => Number(container.querySelector('[data-graph="disp"]')!.getAttribute('scale'));
    step(3000);
    expect(src('a')).toBe('url(/icons-mono/react.svg)');
    expect(hub().style.filter).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    expect(src('b')).toBe('url(/icons-mono/python.svg)');
    step(352);
    // 가운데쯤: 변위가 가장 크고 두 아이콘이 엇갈려 바뀌는 중이다.
    const zap = container.querySelector('filter')!.id;
    expect(zap).toMatch(/^skills-zap-/);
    expect(hub().style.filter.startsWith(`url(#${zap}) drop-shadow(`)).toBe(true);
    expect(scale()).toBeGreaterThan(20);
    expect(Number(icon('a').style.opacity)).toBeLessThan(1);
    expect(Number(icon('b').style.opacity)).toBeGreaterThan(0);
    const seed = container.querySelector('[data-graph="turb"]')!.getAttribute('seed');
    step(96);
    expect(container.querySelector('[data-graph="turb"]')!.getAttribute('seed')).not.toBe(seed);
    step(400);
    expect(hub().style.filter).toBe('');
    expect(src('a')).toBe('url(/icons-mono/python.svg)');
    expect(icon('a').style.opacity).toBe('1');
    expect(icon('b').style.opacity).toBe('0');
    // 모프 도중 다시 고르면 지금 보이는 쪽에서 이어 간다.
    fireEvent.click(screen.getByRole('button', { name: 'Figma' }));
    step(500);
    fireEvent.click(screen.getByRole('button', { name: 'Zustand' }));
    step(1000);
    expect(src('a')).toBe('url(/icons-mono/zustand.svg)');
    expect(hub().style.filter).toBe('');
  });

  it('모션 감소에서 허브 아이콘은 필터 없이 즉시 바뀐다', () => {
    const { container } = render(skillsWithActivity({ reducedMotion: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    const a = container.querySelector<HTMLElement>('[data-graph="icon-a"]')!;
    expect(a.style.getPropertyValue('--skill-icon-src')).toBe('url(/icons-mono/python.svg)');
    expect(a.style.opacity).toBe('1');
    expect(container.querySelector<HTMLElement>('[data-graph="icon-b"]')!.style.opacity).toBe('0');
    expect(container.querySelector<HTMLElement>('[data-graph="hub"]')!.style.filter).toBe('');
    expect(added).not.toHaveBeenCalled();
  });

  it('모션 감소에서 제목 자리는 움직이지 않고 불투명도만 바뀐다', () => {
    expect(css).toMatch(/@keyframes signal-swap-fade\s*\{\s*from \{ opacity: 0; \}/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.skills-signal \.signal-result > div \{ animation-name: signal-swap-fade; \}/);
  });

  it('keeps the labeled icon navigation as a native ScrollArea with buttons that do not shrink', () => {
    render(skillsWithActivity());
    expect(screen.getByRole('navigation', { name: '기술 선택' })).toHaveClass('scroll-area', 'signal-nav');
    expect(css).toMatch(/\.signal-skill\s*\{[^}]*flex-shrink: 0/);
    expect(css).not.toMatch(/\.signal-nav[^}]*scrollbar-width: none/);
    expect(css).toMatch(/\.scroll-area::-webkit-scrollbar-button\s*\{[^}]*display: none/);
  });

  it('헤드가 도착하기 전에는 선도 헤드도 없고, 도착하면 진입이 시작되며 onHeadShown이 한 번 불린다', () => {
    enableCanvas();
    const onHeadShown = vi.fn();
    const { container, rerender } = render(skillsWithActivity({}, { headArrived: false, onHeadShown }));
    step(1000);
    expect(linkD(container)).toBe('');
    expect(gradients()).toBe(0);
    expect(onHeadShown).not.toHaveBeenCalled();
    rerender(skillsWithActivity({}, { headArrived: true, onHeadShown }));
    step(16);
    expect(onHeadShown).toHaveBeenCalledTimes(1);
    expect(gradients()).toBeGreaterThan(0);
    step(3000);
    expect(linkD(container)).toMatch(/^M/);
    expectRevealed(container);
    expect(onHeadShown).toHaveBeenCalledTimes(1);
  });

  it('목록과 제목 자리: 헤드가 오는 중이면 감추고, reveal이면 목록, 도착하면 제목 자리가 나오며 한 번 나온 뒤 다시 감추지 않는다', () => {
    const ref = createRef<SkillsSectionHandle>();
    const stage = () => screen.getByLabelText('선택한 기술의 프로젝트 연결 지도');
    const { rerender } = render(skillsWithActivity({}, { ref, headArrived: false }));
    expect(stage()).toHaveAttribute('data-reveal', 'wait');
    act(() => { ref.current!.reveal(); ref.current!.reveal(); });
    expect(stage()).toHaveAttribute('data-reveal', 'rows');
    rerender(skillsWithActivity({}, { ref, headArrived: true }));
    expect(stage()).toHaveAttribute('data-reveal', 'full');
    rerender(skillsWithActivity({}, { ref, headArrived: false }));
    expect(stage()).toHaveAttribute('data-reveal', 'full');
    // 줄마다 차례(--i)를 준다
    expect(screen.getAllByRole('button', { pressed: false })[0].style.getPropertyValue('--i')).toBe('1');
    expect(css).toMatch(/\[data-reveal='wait'\]:not\(:focus-within\)/);
  });

  it('넘김 없이 도착하면(nav, 새로 고침) 전환 없이 보이고, 그 뒤 헤드가 떠나도 감추지 않는다', () => {
    const ref = createRef<SkillsSectionHandle>();
    const stage = () => screen.getByLabelText('선택한 기술의 프로젝트 연결 지도');
    const { rerender } = render(skillsWithActivity({ routeResolved: false }, { ref, headArrived: false }));
    expect(stage()).toHaveAttribute('data-reveal', 'wait');
    rerender(skillsWithActivity({}, { ref, headArrived: true }));
    expect(stage()).toHaveAttribute('data-reveal', 'done');
    rerender(skillsWithActivity({}, { ref, headArrived: false }));
    expect(stage()).toHaveAttribute('data-reveal', 'done');
    act(() => ref.current!.reveal());
    expect(stage()).toHaveAttribute('data-reveal', 'done');
  });

  // Ruling 11: 헤드가 Awards로 떠나 있어도 목록 등장과 그래프 진입은 그대로다. 헤드 그리기(와 헤드→허브 선)만 꺼진다.
  it('headAway면 data-reveal과 노드 진입은 headAway 없을 때와 같고 헤드만 그리지 않으며, 돌아오면 헤드와 선이 선다', () => {
    enableCanvas();
    const stage = () => screen.getByLabelText('선택한 기술의 프로젝트 연결 지도');
    const plain = render(skillsWithActivity({}, { headArrived: true }));
    const plainReveal = stage().getAttribute('data-reveal');
    plain.unmount();
    contexts = [];
    const onHeadShown = vi.fn();
    const { container, rerender } = render(skillsWithActivity({}, { headArrived: true, headAway: true, onHeadShown }));
    expect(stage().getAttribute('data-reveal')).toBe(plainReveal);
    expect(stage()).not.toHaveAttribute('data-reveal', 'wait');
    step(3000);
    expectRevealed(container);
    expect(gradients()).toBe(0);
    expect(onHeadShown).not.toHaveBeenCalled();
    expect(linkD(container)).toBe('');
    rerender(skillsWithActivity({}, { headArrived: true, headAway: false, onHeadShown }));
    step(16);
    expect(onHeadShown).toHaveBeenCalledTimes(1);
    expect(gradients()).toBeGreaterThan(0);
    step(1000);
    expect(linkD(container)).toMatch(/^M/);
    expect(stage().getAttribute('data-reveal')).toBe(plainReveal);
  });

  // Experience → Skills 넘김은 지점을 지난 scroll 안에서 손잡이로 헤드를 맞바꾼다. React 커밋을 기다리면 한 프레임 겹친다.
  it('손잡이 setArrived(false)는 재렌더 없이 그 자리에서 헤드를 지우고 그리지 않으며, true면 다음 프레임에 다시 그린다', () => {
    enableCanvas();
    const ref = createRef<SkillsSectionHandle>();
    render(skillsWithActivity({}, { ref }));
    step(500);
    const clears = contexts.at(-1)!.clearRect.mock.calls.length;
    act(() => ref.current!.setArrived(false));
    expect(contexts.at(-1)!.clearRect.mock.calls.length).toBe(clears + 1);
    const drawn = gradients();
    step(500);
    expect(gradients()).toBe(drawn);
    act(() => ref.current!.setArrived(true));
    step(16);
    expect(gradients()).toBeGreaterThan(drawn);
  });

  it('줄을 옮기면 헤드가 320ms에 새 줄에 닿고 옮기는 동안만 잔상을 그린다', () => {
    enableCanvas();
    // 줄마다 다른 y(156, 228, …)를 준다. jsdom은 레이아웃이 없어 모두 0이다.
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-skill-row') ? 156 + 72 * [...document.querySelectorAll('[data-skill-row]')].indexOf(this) : 0;
    });
    render(skillsWithActivity());
    step(3000);
    expect(headY()).toBe(156);
    const frame = () => { const n = gradients(); step(16); return gradients() - n; };
    const rest = frame();
    fireEvent.click(screen.getByRole('button', { name: 'TypeScript' }));
    step(144);
    expect(frame()).toBeGreaterThan(rest);
    expect(headY()).toBeGreaterThan(156);
    expect(headY()).toBeLessThan(228);
    step(160);
    expect(headY()).toBe(228);
    step(280);
    expect(frame()).toBe(rest);
    expect(headY()).toBe(228);
  });

  it('진입 뒤 도착이 풀리면 헤드→허브 선만 허브 쪽으로 200ms에 걷히고, 다시 도착하면 선만 다시 자란다', () => {
    enableCanvas();
    const { container, rerender } = render(skillsWithActivity());
    step(3000);
    const thumbs = () => nodes(container).map((node) => node.querySelector<HTMLElement>('[data-part="thumb"]')!.style.maskImage);
    rerender(skillsWithActivity({}, { headArrived: false }));
    const drawn = gradients();
    step(96);
    // 허브 쪽 끝(hubX - 44, jsdom에서 -44)을 시작점으로 그린다.
    expect(linkD(container)).toMatch(/^M-44 /);
    step(112);
    expect(linkD(container)).toBe('');
    expect(gradients()).toBe(drawn);
    expect(titles(container, 'in')).toEqual(WEB);
    expect(thumbs().every((mask) => mask === 'none')).toBe(true);
    rerender(skillsWithActivity({}, { headArrived: true }));
    // 다시 도착하면 고리 펄스가 함께 그려진다.
    const n = gradients(); step(16);
    expect(gradients() - n).toBe(2);
    for (let t = 0; t < 1500; t += 16) {
      step(16);
      expect(thumbs().every((mask) => mask === 'none')).toBe(true);
    }
    expect(linkD(container)).toMatch(/^M12 /);
    expect(titles(container, 'in')).toEqual(WEB);
  });

  it('걷히는 도중 다시 도착해도 선은 허브 쪽으로 다 걷힌 뒤 헤드 쪽에서 다시 자라고 한 프레임에 건너뛰지 않는다', () => {
    const { container, rerender } = render(skillsWithActivity());
    step(3000);
    rerender(skillsWithActivity({}, { headArrived: false }));
    step(96);
    rerender(skillsWithActivity({}, { headArrived: true }));
    const starts: string[] = [];
    let end: number | null = null;
    for (let t = 0; t < 1500; t += 16) {
      step(16);
      const d = linkD(container)!;
      starts.push(d.split(' ')[0]);
      if (!d) { end = null; continue; }
      // 끝점이 프레임마다 조금씩만 움직인다(jsdom에서 선 길이는 56px).
      const x = Number(d.split(' ').at(-2));
      if (end !== null) expect(Math.abs(x - end)).toBeLessThan(10);
      end = x;
    }
    // 시작점은 허브 쪽(-44)에서 빈 선을 거쳐야만 헤드 쪽(12)으로 바뀐다.
    expect(starts.filter((v, i) => v !== starts[i - 1])).toEqual(['M-44', '', 'M12']);
  });

  it('헤드 층은 프레임마다 레이아웃을 읽지 않고, 크기가 0인 캔버스(모바일)에는 그리지 않는다', () => {
    enableCanvas();
    const reads = vi.fn();
    for (const key of ['offsetLeft', 'offsetTop'] as const) {
      vi.spyOn(HTMLElement.prototype, key, 'get').mockImplementation(function (this: HTMLElement) { if (this instanceof HTMLCanvasElement) reads(); return 0; });
    }
    const { unmount } = render(skillsWithActivity());
    step(16);
    reads.mockClear();
    step(500);
    expect(gradients()).toBeGreaterThan(0);
    expect(reads).not.toHaveBeenCalled();
    unmount();
    vi.restoreAllMocks();
    // beforeEach의 ticker와 getContext 모의를 다시 건다.
    contexts = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => { const c = fakeContext(); contexts.push(c); return c; }) as unknown as HTMLCanvasElement['getContext']);
    vi.spyOn(gsap.ticker, 'add').mockImplementation((tick: Parameters<typeof gsap.ticker.add>[0]) => { ticks.add(tick); return tick; });
    vi.spyOn(gsap.ticker, 'remove').mockImplementation((tick: Parameters<typeof gsap.ticker.remove>[0]) => { ticks.delete(tick); });
    const onHeadShown = vi.fn();
    render(skillsWithActivity({}, { onHeadShown }));
    step(500);
    expect(gradients()).toBe(0);
    expect(onHeadShown).toHaveBeenCalledTimes(1);
  });

  it('모션 감소에서 헤드는 time 0으로 멈춘 채 그려지고 ticker 없이 onHeadShown이 불린다', () => {
    enableCanvas();
    const onHeadShown = vi.fn();
    render(skillsWithActivity({ reducedMotion: true }, { onHeadShown }));
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    expect(added).not.toHaveBeenCalled();
    expect(onHeadShown).toHaveBeenCalledTimes(1);
    const ref = fakeContext();
    drawOrb(ref as unknown as CanvasRenderingContext2D, 0, 0, 12, 1, 0, 0, K);
    const want = ref.lineTo.mock.calls;
    expect(contexts.at(-1)!.lineTo.mock.calls.slice(-want.length)).toEqual(want);
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
