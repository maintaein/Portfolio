import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ExperienceSection from '@/components/sections/ExperienceSection';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

function cards() {
  return screen.getAllByRole('article');
}

function activeCard() {
  return cards().find((card) => card.getAttribute('data-depth') === '0')!;
}

describe('ExperienceSection', () => {
  it('renders the FASOO record and complete details on the first server render', () => {
    const html = renderToString(<ExperienceSection />);
    expect(html).toContain(`id="${SECTION_IDS.EXPERIENCE}"`);
    expect(html).toContain('aria-label="경력"');
    expect(html).toContain('FASOO');
    expect(html).toContain(experiences[0].description);
    for (const item of experiences[0].responsibilities) expect(html).toContain(item);
    for (const skill of experiences[0].skills ?? []) expect(html).toContain(skill);
    expect(html).not.toContain('상세 보기');
  });

  it('offers WORK and EDUCATION timeline choices for all three records', () => {
    render(<ExperienceSection />);
    const timeline = screen.getByRole('list', { name: '경력 시점' });
    const choices = within(timeline).getAllByRole('button');
    expect(choices).toHaveLength(3);
    expect(choices.map((button) => button.textContent)).toEqual([
      expect.stringContaining('WORK'),
      expect.stringContaining('EDUCATION'),
      expect.stringContaining('EDUCATION'),
    ]);
    experiences.forEach((record, index) => {
      expect(choices[index]).toHaveTextContent(record.company);
      expect(choices[index]).toHaveTextContent(record.period);
    });
    expect(cards()).toHaveLength(3);
    for (const card of cards()) expect(card).toHaveClass('scroll-area', 'experience-depth-card');
    expect(cards().map((card) => card.tabIndex)).toEqual([0, -1, -1]);
    experiences.forEach((record, index) => {
      expect(cards()[index]).toHaveTextContent(record.description);
      for (const item of record.responsibilities) expect(cards()[index]).toHaveTextContent(item);
      for (const skill of record.skills ?? []) expect(cards()[index]).toHaveTextContent(skill);
    });
  });

  it('selects a timeline record and reveals all of its details in the front card', () => {
    render(<ExperienceSection />);
    fireEvent.click(screen.getByRole('button', { name: /삼성청년SW아카데미/ }));
    expect(activeCard()).toHaveAttribute('data-depth', '0');
    expect(activeCard()).toHaveTextContent(experiences[1].description);
    for (const item of experiences[1].responsibilities) expect(activeCard()).toHaveTextContent(item);
    for (const skill of experiences[1].skills ?? []) expect(activeCard()).toHaveTextContent(skill);
    expect(screen.getByRole('button', { name: /삼성청년SW아카데미/ })).toHaveAttribute('aria-current', 'true');
    expect(cards().map((card) => card.getAttribute('data-depth'))).toEqual(['2', '0', '1']);
    expect(cards()).toHaveLength(experiences.length);
  });

  it('cycles with keyboard arrows', () => {
    render(<ExperienceSection />);
    const deck = screen.getByRole('group', { name: '경력 깊이 캐러셀' });
    fireEvent.keyDown(deck, { key: 'ArrowLeft' });
    expect(activeCard()).toHaveTextContent(experiences[2].company);
    fireEvent.keyDown(deck, { key: 'ArrowRight' });
    expect(activeCard()).toHaveTextContent('FASOO');
    fireEvent.keyDown(deck, { key: 'ArrowRight' });
    expect(activeCard()).toHaveTextContent(experiences[1].company);
    fireEvent.keyDown(deck, { key: 'ArrowLeft' });
    expect(activeCard()).toHaveTextContent('FASOO');
  });

  it('changes the front card after a horizontal drag', () => {
    render(<ExperienceSection />);
    const deck = screen.getByRole('group', { name: '경력 깊이 캐러셀' });
    fireEvent(deck, new MouseEvent('pointerdown', { bubbles: true, clientX: 180 }));
    fireEvent(deck, new MouseEvent('pointerup', { bubbles: true, clientX: 100 }));
    expect(activeCard()).toHaveTextContent(experiences[1].company);
  });
});
