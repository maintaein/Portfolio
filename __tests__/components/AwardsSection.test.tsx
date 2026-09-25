import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AwardsSection from '@/components/sections/AwardAndCertificatesSection';
import { awards } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
let reducedMotion = false;
let pageHidden = false;
const requestFrame = vi.fn((callback: FrameRequestCallback) => {
  frames.set(++nextFrame, callback);
  return nextFrame;
});
const cancelFrame = vi.fn((id: number) => frames.delete(id));

function step(time: number) {
  const queued = [...frames.values()];
  frames.clear();
  act(() => queued.forEach((callback) => callback(time)));
}

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  reducedMotion = false;
  pageHidden = false;
  requestFrame.mockClear();
  cancelFrame.mockClear();
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reducedMotion; },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => pageHidden ? 'hidden' : 'visible',
  });
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => pageHidden,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Awards orbit', () => {
  it('renders all award facts before interaction', () => {
    const { container } = render(<AwardsSection active />);
    expect(container.querySelector('section')?.id).toBe(SECTION_IDS.AWARDS_CERTIFICATES);
    for (const award of awards) {
      const card = container.querySelector(`[data-award-card="${award.id}"]`);
      expect(card?.textContent).toContain(award.title);
      expect(card?.textContent).toContain(award.project);
      expect(card?.textContent).toContain(award.description);
    }
    expect(container.querySelector('.awards-credentials')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-orbit-node]')).toHaveLength(awards.length);
  });

  it('updates the center on hover, focus, and click without stopping orbit motion', () => {
    const { container } = render(<AwardsSection active />);
    const nodes = [...container.querySelectorAll<HTMLElement>('[data-orbit-node]')];
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('[data-award-select]')];
    step(1000);
    const before = nodes[0].style.getPropertyValue('--orbit-x');
    fireEvent.pointerEnter(buttons[1]);
    expect(container.querySelector('[data-orbit-center]')?.textContent).toContain(awards[1].project);
    fireEvent.focus(buttons[2]);
    expect(container.querySelector('[data-orbit-center]')?.textContent).toContain(awards[2].project);
    fireEvent.click(buttons[0]);
    expect(container.querySelector('[data-orbit-center]')?.textContent).toContain(awards[0].project);
    expect(screen.queryByRole('button', { name: /resume|재개/i })).not.toBeInTheDocument();
    step(2000);
    expect(nodes[0].style.getPropertyValue('--orbit-x')).not.toBe(before);
    expect(frames.size).toBe(1);
  });

  it('stops offscreen, hidden, and for reduced motion, then cleans up', () => {
    const { rerender, unmount } = render(<AwardsSection active={false} />);
    expect(frames.size).toBe(0);
    rerender(<AwardsSection active />);
    expect(frames.size).toBe(1);
    pageHidden = true;
    fireEvent(document, new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    pageHidden = false;
    fireEvent(document, new Event('visibilitychange'));
    expect(frames.size).toBe(1);
    rerender(<AwardsSection active={false} />);
    expect(frames.size).toBe(0);
    reducedMotion = true;
    rerender(<AwardsSection active />);
    expect(frames.size).toBe(0);
    unmount();
    expect(frames.size).toBe(0);
    expect(cancelFrame).toHaveBeenCalled();
  });
});
