import { useRef as useVisibilityRef } from 'react';
const localVisibility = vi.hoisted(() => ({ visible: true, hasEntered: true }));
vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: localVisibility.visible, hasEntered: localVisibility.hasEntered }) }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ExperienceSection from '@/components/sections/ExperienceSection';
import { SectionActivityProvider, type SectionActivityProviderProps } from '@/components/common/SectionActivityContext';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

function experienceWithActivity(state: Partial<Omit<SectionActivityProviderProps, 'children'>> = {}, props: { lineArrived?: boolean } = {}) {
  return (
    <SectionActivityProvider obscured={false}
      routeResolved motionReady pageVisible reducedMotion={false} {...state}>
      <ExperienceSection {...props} />
    </SectionActivityProvider>
  );
}

// jsdom에는 배치가 없다. 본문은 레이아웃 위끝에서 500, 1500, 2500(높이 800), rail 기관 이름은 0, 120, 240(높이 20)에 둔다.
// 읽기선은 innerHeight 768, header 없음에서 307.2이고 레이아웃 위끝(layoutTop)을 올리면 읽기선이 본문 아래로 내려간다.
const geometry = vi.hoisted(() => ({ layoutTop: 0 }));
const READING_LINE = 768 * .4;
const readAt = (y: number) => { geometry.layoutTop = READING_LINE - y; act(() => { window.dispatchEvent(new Event('resize')); }); };

const railItems = () => within(screen.getByRole('list', { name: '경력 시점' })).getAllByRole('listitem', { hidden: true });
const articles = () => Array.from(document.querySelectorAll<HTMLElement>('article.experience-body'));
const line = () => document.querySelector<HTMLElement>('[data-part="experience-line"]')!;

describe('ExperienceSection', () => {
  beforeEach(() => {
    localVisibility.visible = true;
    geometry.layoutTop = 0;
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768);
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.matches('article.experience-body')) return 500 + articles().indexOf(this) * 1000;
      if (this.matches('.experience-rail strong')) return [...document.querySelectorAll('.experience-rail strong')].indexOf(this) * 120;
      return 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.matches('article.experience-body')) return 800;
      if (this.matches('.experience-rail strong')) return 20;
      return 0;
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const top = this.classList.contains('experience-timeline-layout') ? geometry.layoutTop : 0;
      return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('첫 서버 렌더에 세 이력의 모든 원문을 넓은 본문에 담는다', () => {
    const html = renderToString(experienceWithActivity());
    expect(html).toContain(`id="${SECTION_IDS.EXPERIENCE}"`);
    expect(html).toContain('aria-label="경력"');
    expect(html).toContain('data-part="experience-line"');
    for (const record of experiences) {
      for (const text of [record.company, record.position, record.period, record.description, ...record.responsibilities, ...(record.skills ?? [])]) {
        expect(html).toContain(text);
      }
    }
    expect(html).not.toContain('상세 보기');
  });

  it('rail에는 기관과 직책만 두고 나머지 원문은 큰 본문에 둔다', () => {
    render(experienceWithActivity({ reducedMotion: true }));
    const items = railItems();
    expect(items).toHaveLength(experiences.length);
    experiences.forEach((record, index) => {
      expect(items[index].textContent).toBe(`${record.company}${record.position}`);
      const body = articles()[index];
      expect(body).toHaveAccessibleName(record.company);
      expect(body).toHaveTextContent(record.position);
      expect(body).toHaveTextContent(record.period);
      expect(body).toHaveTextContent(record.type === 'student' ? 'EDUCATION' : 'WORK');
      expect(body).toHaveTextContent(record.description);
      for (const item of record.responsibilities) expect(body).toHaveTextContent(item);
      for (const skill of record.skills ?? []) expect(within(body).getByRole('list', { name: '기술' })).toHaveTextContent(skill);
    });
    // 캐러셀·드래그·내부 스크롤 영역 없이 문서 스크롤로 읽는다.
    expect(document.querySelector('[aria-roledescription="carousel"], .scroll-area')).toBeNull();
  });

  it('첫 본문 전에는 미래 표식·기관·본문이 보이지 않고 포커스되지 않는다', () => {
    render(experienceWithActivity());
    for (const item of railItems()) {
      expect(item).toHaveAttribute('inert');
      expect(item).not.toHaveAttribute('data-reached');
    }
    expect(articles().map(article => article.dataset.state)).toEqual(['future', 'future', 'future']);
    expect(document.querySelectorAll('[data-part="line-node"][data-reached]')).toHaveLength(0);
    expect(line()).toHaveAttribute('data-complete', 'false');
  });

  it('읽기선이 첫 본문에 닿으면 첫 표식과 FASOO만 공개하고 다음 이력은 숨긴다', () => {
    render(experienceWithActivity());
    readAt(500);
    expect(railItems().map(item => item.hasAttribute('inert'))).toEqual([false, true, true]);
    expect(articles().map(article => article.dataset.state)).toEqual(['current', 'future', 'future']);
    expect(document.querySelectorAll('[data-part="line-node"][data-reached]')).toHaveLength(1);
    expect(within(railItems()[0]).getByRole('button')).toHaveAttribute('aria-current', 'step');
    expect(line()).toHaveAttribute('data-complete', 'false');
  });

  it('선 끝과 자르기는 요소에 바로 쓰고 다음 위끝에서 다음 노드에 닿는다', () => {
    render(experienceWithActivity());
    const tip = document.querySelector<HTMLElement>('[data-part="line-tip"]')!;
    const path = document.querySelector<HTMLElement>('[data-part="line-path"]')!;
    // 노드는 기관 이름 가운데: 10, 130, 250. 선은 첫 노드에서 마지막 노드까지 240px이다.
    expect(path.style.top).toBe('10px');
    expect(path.style.height).toBe('240px');
    readAt(1000);
    expect(tip.style.transform).toBe('translateY(10px)');
    expect(path.style.clipPath).toBe('inset(0px -12px 240px -12px)');
    readAt(1500);
    expect(tip.style.transform).toBe('translateY(130px)');
    expect(path.style.clipPath).toBe('inset(0px -12px 120px -12px)');
    expect(articles().map(article => article.dataset.state)).toEqual(['past', 'current', 'future']);
  });

  it('마지막 본문 끝을 지나야 완료하고, 되돌아오면 표식과 본문이 다시 숨는다', () => {
    render(experienceWithActivity());
    readAt(3000);
    expect(railItems().map(item => item.hasAttribute('inert'))).toEqual([false, false, false]);
    expect(line()).toHaveAttribute('data-complete', 'false');
    readAt(3300);
    expect(line()).toHaveAttribute('data-complete', 'true');
    readAt(1600);
    expect(line()).toHaveAttribute('data-complete', 'false');
    expect(railItems().map(item => item.hasAttribute('inert'))).toEqual([false, false, true]);
    expect(articles().map(article => article.dataset.state)).toEqual(['past', 'current', 'future']);
    readAt(100);
    expect(railItems().every(item => item.hasAttribute('inert'))).toBe(true);
  });

  it('화면을 떠나는 순간 떠난 자리의 완료 상태로 맞춘다', () => {
    const { rerender } = render(experienceWithActivity());
    geometry.layoutTop = READING_LINE - 4000;
    localVisibility.visible = false;
    rerender(experienceWithActivity());
    expect(line()).toHaveAttribute('data-complete', 'true');
  });

  it('모션 감소는 선호를 확인한 뒤 모든 이력과 전체 선을 정적으로 공개한다', () => {
    const { rerender } = render(experienceWithActivity({ reducedMotion: true, motionReady: false }));
    expect(articles().every(article => article.dataset.state === 'future')).toBe(true);
    rerender(experienceWithActivity({ reducedMotion: true }));
    expect(railItems().some(item => item.hasAttribute('inert'))).toBe(false);
    expect(articles().map(article => article.dataset.state)).toEqual(['past', 'past', 'current']);
    expect(line()).toHaveAttribute('data-complete', 'true');
    expect(document.querySelector<HTMLElement>('[data-part="line-tip"]')!.style.transform).toBe('translateY(250px)');
  });

  it('드러난 표식을 누르면 그 본문 위끝을 읽기선에 맞춰 스크롤하고 본문에 포커스한다', () => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(experienceWithActivity());
    readAt(1600);
    fireEvent.click(within(railItems()[0]).getByRole('button'));
    expect(scroll).toHaveBeenCalledWith({ top: Math.ceil(geometry.layoutTop + 500 - READING_LINE), behavior: 'smooth' });
    expect(articles()[0]).toHaveFocus();
  });
  // 수정 1 I2: 서버 HTML(JS 전)에는 감추는 표시가 없다. 감추는 CSS는 모두 하이드레이션 뒤 JS가 켜는 data-progressive 아래에만 있다.
  it('서버 HTML에는 점진 공개 표시도 inert도 없어 JS 없이도 모든 본문과 rail이 보인다', () => {
    const html = renderToString(experienceWithActivity());
    expect(html).not.toContain('data-progressive');
    expect(html).not.toMatch(/\sinert/);
    // 서버 HTML의 모든 본문은 future 상태로 나가지만, 그 상태를 감추는 규칙은 data-progressive 없이는 맞지 않는다.
    const css = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector, body]) => /experience-(body|rail)/.test(selector) && /opacity:\s*0[;\s]|visibility:\s*hidden|opacity:\s*\.\d/.test(body));
    expect(rules.length).toBeGreaterThan(0);
    for (const [, selector] of rules) {
      for (const part of selector.split(',')) expect(part.trim()).toMatch(/^\.experience-timeline\[data-progressive\] /);
    }
  });

  it('하이드레이션 뒤에는 점진 공개를 켜고, 모션 감소의 정적 공개에서는 끈다', () => {
    const { container, rerender } = render(experienceWithActivity());
    expect(container.querySelector('section')).toHaveAttribute('data-progressive');
    rerender(experienceWithActivity({ reducedMotion: true }));
    expect(container.querySelector('section')).not.toHaveAttribute('data-progressive');
  });

  // 수정 1 I1: 경계가 첫 세로축에 내려앉으면 읽기선 전이라도 첫 표식과 FASOO를 공개하고, 거꾸로 떠나면 다시 숨긴다. 다음 노드는 읽기선이 정한다.
  it('선 경계가 내려앉으면 첫 표식과 FASOO만 공개하고 떠나면 다시 숨긴다', () => {
    const { rerender } = render(experienceWithActivity());
    readAt(100);
    expect(railItems().every(item => item.hasAttribute('inert'))).toBe(true);
    rerender(experienceWithActivity({}, { lineArrived: true }));
    expect(railItems().map(item => item.hasAttribute('inert'))).toEqual([false, true, true]);
    expect(articles().map(article => article.dataset.state)).toEqual(['current', 'future', 'future']);
    expect(document.querySelectorAll('[data-part="line-node"][data-reached]')).toHaveLength(1);
    expect(within(railItems()[0]).getByRole('button')).toHaveAttribute('aria-current', 'step');
    // 그 뒤 노드는 여전히 읽기선이 정한다.
    readAt(1500);
    expect(articles().map(article => article.dataset.state)).toEqual(['past', 'current', 'future']);
    readAt(100);
    expect(articles()[0].dataset.state).toBe('current');
    rerender(experienceWithActivity({}, { lineArrived: false }));
    expect(railItems().every(item => item.hasAttribute('inert'))).toBe(true);
    expect(articles().map(article => article.dataset.state)).toEqual(['future', 'future', 'future']);
  });

  // 수정 1 I3: 모션 감소에서 rail 단추는 보이는 동안에만 포커스를 받는다. 정적 공개는 감추지 않고 inert도 걸지 않는다.
  it('모션 감소에서는 rail이 감춰지지 않고 모든 단추가 보이며 포커스된다', () => {
    render(experienceWithActivity({ reducedMotion: true }));
    expect(document.querySelector('section')).not.toHaveAttribute('data-progressive');
    for (const item of railItems()) {
      expect(item).not.toHaveAttribute('inert');
      const button = within(item).getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
    }
  });
});
