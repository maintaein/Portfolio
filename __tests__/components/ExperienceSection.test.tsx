import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import gsap from 'gsap';
import ExperienceSection from '@/components/sections/ExperienceSection';
import { SectionActivityProvider, type SectionActivityProviderProps } from '@/components/common/SectionActivityContext';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

function cards() {
  return screen.getAllByRole('article');
}

function activeCard() {
  return cards().find((card) => card.getAttribute('data-depth') === '0')!;
}

function experienceWithActivity(state: Partial<Omit<SectionActivityProviderProps, 'children'>> = {}) {
  return (
    <SectionActivityProvider active={SECTION_IDS.EXPERIENCE} entryAnimationTarget={null}
      routeResolved motionReady pageVisible reducedMotion={false} {...state}>
      <ExperienceSection />
    </SectionActivityProvider>
  );
}

describe('ExperienceSection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('moves the timeline marker with a trailing end and snaps for reduced motion', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      const index = [...(this.parentElement?.querySelectorAll('li') ?? [])].indexOf(this as HTMLLIElement);
      return index < 0 ? 0 : index * 140;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'LI' ? 100 : 0;
    });
    const { container, rerender } = render(experienceWithActivity());
    const marker = container.querySelector<HTMLElement>('.experience-depth-marker')!;
    expect(marker.style.top).toBe('50px');
    const timelines = vi.spyOn(gsap, 'timeline');
    fireEvent.click(within(screen.getByRole('list', { name: '경력 시점' })).getAllByRole('button')[2]);
    const motion = timelines.mock.results.at(-1)?.value as gsap.core.Timeline;
    motion.time(0.3);
    const stretchedHeight = parseFloat(marker.style.height);
    expect(stretchedHeight).toBeGreaterThan(14);
    motion.time(0.45);
    expect(parseFloat(marker.style.height)).toBeLessThan(stretchedHeight);
    expect(parseFloat(marker.style.top)).toBeLessThan(330);
    motion.progress(1);
    expect(marker.style.top).toBe('330px');

    rerender(experienceWithActivity({ reducedMotion: true }));
    fireEvent.click(within(screen.getByRole('list', { name: '경력 시점' })).getAllByRole('button')[1]);
    expect(marker.style.top).toBe('190px');
    expect(marker.style.height).toBe('14px');
    expect(timelines).toHaveBeenCalledTimes(1);
  });

  it('renders the FASOO record and complete details on the first server render', () => {
    const html = renderToString(experienceWithActivity());
    expect(html).toContain(`id="${SECTION_IDS.EXPERIENCE}"`);
    expect(html).toContain('aria-label="경력"');
    expect(html).toContain('FASOO');
    expect(html).toContain(experiences[0].description);
    for (const item of experiences[0].responsibilities) expect(html).toContain(item);
    for (const skill of experiences[0].skills ?? []) expect(html).toContain(skill);
    expect(html).not.toContain('상세 보기');
  });

  it('offers WORK and EDUCATION timeline choices for all three records', () => {
    render(experienceWithActivity());
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
    for (const card of cards()) {
      expect(card).toHaveClass('experience-depth-card');
      expect(card.querySelector('.experience-depth-card-scroll')).toHaveClass('scroll-area');
    }
    expect(cards().map((card) => card.querySelector<HTMLElement>('.experience-depth-card-scroll')?.tabIndex)).toEqual([0, -1, -1]);
    experiences.forEach((record, index) => {
      expect(cards()[index]).toHaveTextContent(record.description);
      for (const item of record.responsibilities) expect(cards()[index]).toHaveTextContent(item);
      for (const skill of record.skills ?? []) expect(cards()[index]).toHaveTextContent(skill);
    });
  });

  it('selects a timeline record and reveals all of its details in the front card', () => {
    render(experienceWithActivity());
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
    render(experienceWithActivity());
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
    render(experienceWithActivity());
    const deck = screen.getByRole('group', { name: '경력 깊이 캐러셀' });
    fireEvent(deck, new MouseEvent('pointerdown', { bubbles: true, clientX: 180 }));
    fireEvent(deck, new MouseEvent('pointerup', { bubbles: true, clientX: 100 }));
    expect(activeCard()).toHaveTextContent(experiences[1].company);
  });
});
