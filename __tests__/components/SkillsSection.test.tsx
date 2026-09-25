import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SkillsSection from '@/components/sections/SkillsSection';
import { SECTION_IDS } from '@/lib/constants';
import { projects, skillCategories } from '@/lib/data';

const visibleSkills = [
  'TypeScript', 'Python', 'React', 'Next.js',
  'Tailwind CSS', 'React Query', 'Zustand', 'Figma',
];
const css = readFileSync(resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');

describe('SkillsSection signal map', () => {
  it('shows only the eight approved project-backed skills with existing icons', () => {
    render(<SkillsSection />);
    const buttons = screen.getAllByRole('button', { name: /^(TypeScript|Python|React|Next\.js|Tailwind CSS|React Query|Zustand|Figma)$/ });
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(visibleSkills);
    for (const name of visibleSkills) {
      const skill = skillCategories.flatMap((category) => category.skills).find((item) => item.name === name)!;
      expect(screen.getByRole('button', { name }).style.getPropertyValue('--skill-icon-src'))
        .toBe(`url(/icons-mono/${skill.icon}.svg)`);
    }
    expect(screen.queryByRole('button', { name: 'JavaScript' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TypeScript' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects on hover, focus, and click, replacing the prior project map immediately', () => {
    const { container } = render(<SkillsSection />);
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
    render(<SkillsSection />);
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

  it('has bare selected icons, line-first reveal, and a reduced-motion fallback', () => {
    render(<SkillsSection />);
    const button = screen.getByRole('button', { name: 'TypeScript' });
    expect(button.className).not.toMatch(/\bbg-|\bborder-/);
    expect(button.querySelector('.skill-icon-active')).toBeInTheDocument();
    expect(css).toMatch(/\.skills-signal \.signal-path[\s\S]*?animation: signal-draw/);
    expect(css).toMatch(/\.skills-signal \.signal-project[\s\S]*?animation: signal-reveal/);
    expect(css).toMatch(/\.skills-signal \.signal-project[\s\S]*?animation-delay: calc\(730ms \+ var\(--count\) \* 80ms/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.skills-signal \.signal-path[\s\S]*?animation: none/);
  });

  it('keeps all eight skill descriptions and project names in server HTML', () => {
    const html = renderToString(<SkillsSection />);
    expect(html).toContain(`id="${SECTION_IDS.SKILLS}"`);
    for (const name of visibleSkills) {
      const skill = skillCategories.flatMap((category) => category.skills).find((item) => item.name === name)!;
      expect(html).toContain(skill.description);
    }
    expect(html).toContain('TDS (Taein Design System)');
    expect(html).toContain('AlphaMail');
  });
});
