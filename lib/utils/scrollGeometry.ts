import { OVERVIEW, type NavId } from '@/hooks/useSectionNav';

export const READING_LINE_RATIO = .4;
export type SectionPosition = { id: NavId; top: number };

function nonnegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function readingLineY(viewportHeight: number, headerHeight: number, ratio = READING_LINE_RATIO): number {
  const viewport = nonnegativeFinite(viewportHeight);
  const header = Math.min(viewport, nonnegativeFinite(headerHeight));
  return header + (viewport - header) * ratio;
}

export function resolveCurrentSection(input: {
  sections: readonly SectionPosition[];
  scrollY: number;
  viewportHeight: number;
  headerHeight: number;
  documentHeight: number;
}): NavId {
  const viewport = nonnegativeFinite(input.viewportHeight);
  const maxScroll = Math.max(0, nonnegativeFinite(input.documentHeight) - viewport);
  const scroll = Math.min(maxScroll, nonnegativeFinite(input.scrollY));
  const line = scroll + readingLineY(viewport, input.headerHeight);
  const atEnd = maxScroll > 0 && scroll >= maxScroll;
  let current: NavId = OVERVIEW;
  let currentTop = -Infinity;

  for (const section of input.sections) {
    if (Number.isFinite(section.top) && section.top >= currentTop && (atEnd || section.top <= line)) {
      current = section.id;
      currentTop = section.top;
    }
  }

  return current;
}
