import { describe, expect, it } from 'vitest';
import {
  readingLineY,
  resolveCurrentSection,
  type SectionPosition,
} from '@/lib/utils/scrollGeometry';

describe('readingLineY', () => {
  it.each([
    [900, 100, 420],
    [900, 0, 360],
    [900, 1200, 900],
    [900, -100, 360],
    [0, 100, 0],
    [-900, 100, 0],
    [NaN, 100, 0],
    [Infinity, 100, 0],
    [900, NaN, 360],
    [900, Infinity, 360],
  ])('uses the clamped header and 40%% of the remaining viewport (%s, %s)', (
    viewportHeight, headerHeight, expected,
  ) => {
    expect(readingLineY(viewportHeight, headerHeight)).toBe(expected);
  });
});

describe('resolveCurrentSection', () => {
  const sections: readonly SectionPosition[] = [
    { id: 'overview', top: 0 },
    { id: 'about', top: 1000 },
    { id: 'projects', top: 3000 },
    { id: 'awards-certificates', top: 5000 },
  ];
  const input = {
    sections,
    scrollY: 0,
    viewportHeight: 900,
    headerHeight: 100,
    documentHeight: 7000,
  };

  it('uses overview when there are no sections', () => {
    expect(resolveCurrentSection({ ...input, sections: [] })).toBe('overview');
  });

  it.each([
    [0, 'overview'],
    [579, 'overview'],
    [580, 'about'],
    [581, 'about'],
    [2000, 'about'],
    [2579, 'about'],
    [2580, 'projects'],
    [6100, 'awards-certificates'],
    [9000, 'awards-certificates'],
    [-100, 'overview'],
    [NaN, 'overview'],
    [Infinity, 'overview'],
  ])('resolves scrollY %s to %s', (scrollY, expected) => {
    expect(resolveCurrentSection({ ...input, scrollY })).toBe(expected);
  });

  it('selects the final existing section at the document end before its top reaches the line', () => {
    expect(resolveCurrentSection({ ...input, documentHeight: 5500, scrollY: 4600 }))
      .toBe('awards-certificates');
  });

  it('uses section positions rather than array order', () => {
    expect(resolveCurrentSection({
      ...input, sections: [sections[3], sections[1], sections[0], sections[2]], scrollY: 2580,
    })).toBe('projects');
    expect(resolveCurrentSection({
      ...input, sections: [sections[3], sections[1], sections[0], sections[2]], scrollY: 6100,
    })).toBe('awards-certificates');
  });

  it.each([0, -1, NaN, Infinity, 900])('does not force the last section in a non-scrollable document (%s)', (documentHeight) => {
    expect(resolveCurrentSection({ ...input, documentHeight, scrollY: 9000 }))
      .toBe('overview');
  });

  it('supports a zero-height viewport and header', () => {
    expect(resolveCurrentSection({ ...input, viewportHeight: 0, headerHeight: 0, scrollY: 1000 }))
      .toBe('about');
  });

  it('clamps an oversized header to the viewport', () => {
    expect(resolveCurrentSection({ ...input, headerHeight: 1200, scrollY: 100 }))
      .toBe('about');
  });

  it('ignores non-finite section positions', () => {
    expect(resolveCurrentSection({
      ...input,
      sections: [{ id: 'projects', top: NaN }, { id: 'skills', top: Infinity }, ...sections],
      scrollY: 6100,
    })).toBe('awards-certificates');
  });

  it('uses overview before the first measured section', () => {
    expect(resolveCurrentSection({ ...input, sections: sections.slice(1) })).toBe('overview');
  });
});
