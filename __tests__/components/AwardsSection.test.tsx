import { useRef as useVisibilityRef } from 'react';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
const visibility = vi.hoisted(() => ({ visible: true }));
vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: visibility.visible, hasEntered: true }) }));
function awardsView(visible = true) {
  visibility.visible = visible;
  return <SectionActivityProvider obscured={false} pageVisible routeResolved motionReady reducedMotion={false}><AwardsSection /></SectionActivityProvider>;
}
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
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
    const rendered = new DOMParser().parseFromString(renderToString(awardsView()), 'text/html');
    expect(rendered.querySelector('section')?.id).toBe(SECTION_IDS.AWARDS_CERTIFICATES);
    for (const award of awards) {
      const card = rendered.querySelector(`[data-award-card="${award.id}"]`);
      const button = rendered.querySelector(`[data-award-select="${award.id}"]`);
      expect(card?.textContent).toContain(award.title);
      expect(card?.textContent).toContain(award.project);
      expect(card?.textContent).toContain(award.description);
      expect(button?.textContent).toContain(award.title);
      expect(button?.textContent).toContain(award.organization);
      expect(button?.textContent).toContain(award.description);
    }
    expect(rendered.querySelector('.awards-credentials')).not.toBeInTheDocument();
    expect(rendered.querySelectorAll('[data-orbit-node]')).toHaveLength(awards.length);
  });

  it('updates the center on hover, focus, and click without stopping orbit motion', () => {
    const { container } = render(awardsView());
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
    const { rerender, unmount } = render(awardsView(false));
    expect(frames.size).toBe(0);
    rerender(awardsView());
    expect(frames.size).toBe(1);
    pageHidden = true;
    fireEvent(document, new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    pageHidden = false;
    fireEvent(document, new Event('visibilitychange'));
    expect(frames.size).toBe(1);
    rerender(awardsView(false));
    expect(frames.size).toBe(0);
    reducedMotion = true;
    rerender(awardsView());
    expect(frames.size).toBe(0);
    unmount();
    expect(frames.size).toBe(0);
    expect(cancelFrame).toHaveBeenCalled();
  });
});
