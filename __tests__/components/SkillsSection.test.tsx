import { useRef as useVisibilityRef } from 'react';
const localVisibility = vi.hoisted(() => ({ visible: true, hasEntered: true }));
vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: localVisibility.visible, hasEntered: localVisibility.hasEntered }) }));
import { readFileSync } from 'node:fs';
import { StrictMode } from 'react';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
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
const css = readFileSync(resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');

function skillsWithActivity(state: Partial<Omit<SectionActivityProviderProps, 'children'>> = {}) {
  return (
    <SectionActivityProvider obscured={false}
      routeResolved motionReady pageVisible reducedMotion={false} {...state}>
      <SkillsSection />
    </SectionActivityProvider>
  );
}

describe('SkillsSection signal map', () => {
  let resize: () => void;
  beforeEach(() => {
  localVisibility.visible = true; localVisibility.hasEntered = true;
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(490);
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect() {}
    });
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

  it('keeps bare icons and focusable project surfaces without CSS sequence delays', () => {
    const { container } = render(skillsWithActivity());
    const button = screen.getByRole('button', { name: 'React' });
    expect(button.className).not.toMatch(/\bbg-|\bborder-/);
    expect(button.querySelector('.skill-icon-active')).toBeInTheDocument();
    expect(container.querySelectorAll('.signal-surface')).toHaveLength(screen.getAllByRole('link').length);
    expect(css).not.toMatch(/signal-draw|signal-reveal|730ms/);
    expect(css).toMatch(/\.signal-project:focus-visible > span[\s\S]*?opacity: 1 !important/);
  });

  it('draws measured straight connectors into each border and surface on independent GSAP timelines', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(490);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = [...(this.parentElement?.querySelectorAll('.signal-project') ?? [])].indexOf(this);
      const hub = this.classList.contains('signal-hub');
      const left = hub ? 94 : index >= 0 ? 350 : 0;
      const top = hub ? 185 : index >= 0 ? 40 + index * 100 : 0;
      const width = hub ? 120 : index >= 0 ? 150 : 600;
      const height = hub ? 120 : index >= 0 ? 54 : 490;
      return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} };
    });
    const timelines = vi.spyOn(gsap, 'timeline');
    const { container } = render(skillsWithActivity());
    const paths = [...container.querySelectorAll('.signal-path')];
    expect(timelines).toHaveBeenCalledTimes(paths.length);
    const completions = timelines.mock.results.map(({ value }, index) => {
      value.pause(0);
      expect(value.delay()).toBeCloseTo(index * .16);
      const [line, border, surface] = value.getChildren(false, true, false);
      expect(paths[index].getAttribute('d')).toMatch(/^M [\d.]+ [\d.]+ L 350 /);
      expect(paths[index].getAttribute('d')).not.toMatch(/[QC]/);
      expect(line.vars.strokeDashoffset).toBe(408);
      expect(border.vars.strokeDashoffset).toBe(0);
      expect(border.startTime()).toBeCloseTo(line.duration());
      expect(surface.startTime()).toBeCloseTo(line.duration() + border.duration());
      expect(surface.vars.opacity).toBe(1);
      return line.duration();
    });
    expect(new Set(completions).size).toBeGreaterThan(1);
  });

  it.each([.62, 1.45])('keeps paths aligned while the entering section is scaled by %s', (scale) => {
    let measuredScale = scale;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(490);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(604);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(494);
    vi.spyOn(HTMLElement.prototype, 'clientLeft', 'get').mockReturnValue(2);
    vi.spyOn(HTMLElement.prototype, 'clientTop', 'get').mockReturnValue(2);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const hub = this.classList.contains('signal-hub');
      const project = this.classList.contains('signal-project');
      const left = 120 + (hub ? 96 : project ? 352 : 0) * measuredScale;
      const top = 80 + (hub ? 187 : project ? 42 : 0) * measuredScale;
      const width = (hub ? 120 : project ? 150 : 604) * measuredScale;
      const height = (hub ? 120 : project ? 54 : 494) * measuredScale;
      return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} };
    });
    const { container } = render(skillsWithActivity());
    const points = container.querySelector('.signal-path')!.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    [350, 67, 350, 40, 500, 40, 500, 94, 350, 94, 350, 67].forEach((coordinate, index) => {
      expect(points[index + 2]).toBeCloseTo(coordinate);
    });
    expect(Math.hypot(points[0] - 154, points[1] - 245)).toBeCloseTo(60);
    measuredScale = 1;
    resize();
    expect(container.querySelector<HTMLElement>('.signal-surface')!.style.opacity).toBe('0');
  });

  it('leaves reduced-motion project surfaces immediately readable without timelines', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(490);
    const timelines = vi.spyOn(gsap, 'timeline');
    const { container } = render(skillsWithActivity({ reducedMotion: true }));
    expect(timelines).not.toHaveBeenCalled();
    for (const span of container.querySelectorAll<HTMLElement>('.signal-project > span')) {
      expect(span.style.opacity).toBe('');
    }
  });

  it('waits for actual visible Skills entry, animates once, and preserves selection animations', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(490);
    const timelines = vi.spyOn(gsap, 'timeline');
    const { container, rerender } = render(skillsWithActivity({ obscured: true }));
    expect(timelines).not.toHaveBeenCalled();
    for (const state of [{ routeResolved: false }, { motionReady: false }, { pageVisible: false }]) {
      rerender(skillsWithActivity(state));
      expect(timelines).not.toHaveBeenCalled();
    }
    rerender(skillsWithActivity());
    const initialCount = container.querySelectorAll('.signal-path').length;
    expect(timelines).toHaveBeenCalledTimes(initialCount);
    timelines.mock.results.forEach(({ value }) => value.progress(1));
    rerender(skillsWithActivity({ obscured: true }));
    for (const span of container.querySelectorAll<HTMLElement>('.signal-project > span')) {
      expect(span.style.opacity).not.toBe('0');
    }
    rerender(skillsWithActivity());
    expect(timelines).toHaveBeenCalledTimes(initialCount);
    fireEvent.focus(screen.getByRole('button', { name: 'Python' }));
    expect(timelines).toHaveBeenCalledTimes(initialCount + container.querySelectorAll('.signal-path').length);
  });

  it('cleans up a running graph when reduced motion is enabled without replaying it', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(490);
    const timelines = vi.spyOn(gsap, 'timeline');
    const { container, rerender } = render(skillsWithActivity());
    const initialCount = container.querySelectorAll('.signal-path').length;
    expect(timelines).toHaveBeenCalledTimes(initialCount);
    rerender(skillsWithActivity({ reducedMotion: true }));
    for (const span of container.querySelectorAll<HTMLElement>('.signal-project > span')) {
      expect(span.style.opacity).toBe('');
    }
    rerender(skillsWithActivity());
    expect(timelines).toHaveBeenCalledTimes(initialCount);
  });

  it('keeps direct-entry animation after StrictMode effect replay', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(490);
    const timelines = vi.spyOn(gsap, 'timeline');
    const { container } = render(<StrictMode>{skillsWithActivity()}</StrictMode>);
    const paths = container.querySelectorAll('.signal-path');
    expect(timelines).toHaveBeenCalledTimes(paths.length * 2);
    for (const span of container.querySelectorAll<HTMLElement>('.signal-project > span')) {
      expect(span.style.opacity).toBe('0');
    }
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
  });
  it('retains partially drawn links and completion callbacks across temporary pauses', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(490);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const hub = this.classList.contains('signal-hub'); const link = this.classList.contains('signal-project');
      return { left: hub ? 94 : link ? 350 : 0, top: hub ? 185 : link ? 40 : 0, width: hub ? 120 : link ? 150 : 600, height: hub ? 120 : link ? 54 : 490 } as DOMRect;
    });
    const timelines = vi.spyOn(gsap, 'timeline');
    const { container, rerender, unmount } = render(skillsWithActivity());
    const owned = timelines.mock.results.map(result => result.value as gsap.core.Timeline);
    owned.forEach(tween => tween.progress(.4));
    const styles = () => [...container.querySelectorAll<HTMLElement>('.signal-path, .signal-project > span')].map(el => el.style.cssText);
    const partial = styles();
    for (const state of [{ pageVisible: false }, { obscured: true }, {}]) {
      if (!Object.keys(state).length) localVisibility.visible = false;
      rerender(skillsWithActivity(state)); owned.forEach(tween => { expect(tween.paused()).toBe(true); expect(tween.progress()).toBeCloseTo(.4); }); expect(styles()).toEqual(partial);
      localVisibility.visible = true; rerender(skillsWithActivity()); owned.forEach(tween => expect(tween.paused()).toBe(false)); expect(timelines).toHaveBeenCalledTimes(owned.length);
      expect(container.querySelector('[data-skill-map]')).toHaveAttribute('data-active-skill', 'React');
    }
    owned.forEach(tween => tween.progress(1));
    rerender(skillsWithActivity({ obscured: true })); rerender(skillsWithActivity()); expect(timelines).toHaveBeenCalledTimes(owned.length);
    fireEvent.focus(screen.getByRole('button', { name: 'Python' }));
    const next = timelines.mock.results.slice(owned.length).map(result => result.value as gsap.core.Timeline); next.forEach(tween => tween.progress(.4));
    rerender(skillsWithActivity({ pageVisible: false })); rerender(skillsWithActivity({ pageVisible: false, reducedMotion: true }));
    next.forEach(tween => expect(tween.parent).toBeNull());
    for (const span of container.querySelectorAll<HTMLElement>('.signal-project > span')) expect(span.style.opacity).toBe('');
    const count = timelines.mock.calls.length; rerender(skillsWithActivity()); expect(timelines).toHaveBeenCalledTimes(count);
    fireEvent.focus(screen.getByRole('button', { name: 'React' }));
    const last = timelines.mock.results.slice(count).map(result => result.value as gsap.core.Timeline); expect(last.length).toBeGreaterThan(0);
    unmount(); last.forEach(tween => expect(tween.parent).toBeNull());
  });

});
