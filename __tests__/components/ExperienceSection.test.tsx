import { useRef as useVisibilityRef } from 'react';
const localVisibility = vi.hoisted(() => ({ visible: true }));
vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: localVisibility.visible, hasEntered: true }) }));
// 카드 그림은 EvidenceCard 테스트가 맡는다. 여기서는 active만 드러낸다.
vi.mock('@/components/sections/ExperienceSection/EvidenceCard', () => ({
  default: ({ evidence, active, reduced }: { evidence: { demo: string }; active: boolean; reduced: boolean }) =>
    <figure data-demo={evidence.demo} data-active={String(active)} data-reduced={String(reduced)} />,
}));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, within } from '@testing-library/react';
import ExperienceSection from '@/components/sections/ExperienceSection';
import { createExperienceOverlay, type ExperienceOverlay, type TimelineFrame } from '@/components/sections/ExperienceSection/overlay';
import { R } from '@/components/sections/ExperienceSection/lineMotion';
import { SectionActivityProvider, type SectionActivityProviderProps } from '@/components/common/SectionActivityContext';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

type Props = { lineArrived?: boolean; overlay?: ExperienceOverlay | null };
function experienceWithActivity(state: Partial<Omit<SectionActivityProviderProps, 'children'>> = {}, props: Props = {}) {
  return (
    <SectionActivityProvider obscured={false} routeResolved motionReady pageVisible reducedMotion={false} {...state}>
      <ExperienceSection {...props} />
    </SectionActivityProvider>
  );
}

// jsdom에는 배치가 없다. 문서 y로 회사명 h3는 1000, 2000, 3000(높이 80, 노드 y = 위 + 30), 기술 칩은 1600, 2600, 3600(높이 40, 읽기 끝 = 아래 + 8),
// 장은 950에서 1000씩(높이 1000, 꼬리 3870), 축 칸은 x 32에서 폭 120(축 x 92). 읽기선은 innerHeight 768, 헤더 없음에서 scrollY + 307.2다.
const NODES = [1030, 2030, 3030];
const READ_ENDS = [1648, 2648, 3648];
const READING = 768 * .4;
const articles = () => Array.from(document.querySelectorAll<HTMLElement>('#experience article'));
const line = () => document.querySelector<HTMLElement>('[data-part="experience-line"]')!;
const states = () => articles().map(article => article.dataset.state);
const scrollTo = (y: number) => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  act(() => { window.dispatchEvent(new Event('resize')); });
};

describe('ExperienceSection', () => {
  beforeEach(() => {
    localVisibility.visible = true;
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768);
    const index = (el: Element, selector: string) => [...document.querySelectorAll(selector)].indexOf(el);
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.matches('h3[data-part="experience-node"]')) return 1000 + index(this, 'h3[data-part="experience-node"]') * 1000;
      if (this.matches('ul[aria-label="기술"]')) return 1600 + index(this, 'ul[aria-label="기술"]') * 1000;
      if (this.matches('#experience article')) return 950 + index(this, '#experience article') * 1000;
      return 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.matches('h3[data-part="experience-node"]')) return 80;
      if (this.matches('ul[aria-label="기술"]')) return 40;
      if (this.matches('#experience article')) return 1000;
      return 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
      return this.matches('[data-part="experience-axis"]') ? 32 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.matches('[data-part="experience-axis"]') ? 120 : 0;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('SSR HTML에 세 장의 본문, 최종 수치, 업무, 기술이 모두 있고 숨김 속성이 없다', () => {
    const html = renderToString(experienceWithActivity());
    expect(html).toContain(`id="${SECTION_IDS.EXPERIENCE}"`);
    // 섹션 제목은 보이지 않는 h2 하나다(보이는 EXPERIENCE 머리말은 두지 않는다).
    expect(html).toContain('aria-labelledby="experience-heading"');
    expect(html).toMatch(/<h2 id="experience-heading" class="sr-only">경력<\/h2>/);
    expect(html).not.toContain('EXPERIENCE');
    expect(html).toContain('data-part="experience-line"');
    for (const record of experiences) {
      const texts = [record.company, record.position, record.period, record.description, ...record.responsibilities, ...(record.skills ?? []),
        ...(record.highlight ? [record.highlight] : []), ...(record.metrics ?? []).map(metric => metric.label)];
      for (const text of texts) expect(html).toContain(text);
    }
    for (const value of ['-30%', '3분', '1620h', '2회']) expect(html).toContain(`>${value}<`);
    expect(html).not.toContain('data-progressive');
    expect(html).not.toMatch(/\sinert|\shidden[\s=>]/);
    // 감추는 CSS는 모두 하이드레이션 뒤 JS가 켜는 data-progressive 아래에만 있다.
    const css = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector, body]) => /\.experience[\s[:-]/.test(selector) && /opacity:\s*0[;\s]|visibility:\s*hidden/.test(body));
    expect(rules.length).toBeGreaterThan(0);
    for (const [, selector] of rules) {
      // :is() 안의 쉼표는 나누지 않는다
      for (const part of selector.split(/,(?![^(]*\))/)) expect(part.trim()).toMatch(/^\.experience\[data-progressive\] /);
    }
  });

  it('하이드레이션 뒤 lineArrived 전에는 모든 장이 future이고 data-progressive가 켜진다', () => {
    const { container } = render(experienceWithActivity());
    expect(container.querySelector('section')).toHaveAttribute('data-progressive');
    expect(states()).toEqual(['future', 'future', 'future']);
    expect(line()).toHaveAttribute('data-complete', 'false');
    // 회사명 단추 목록(rail)은 없다. 선 표식은 내용 없는 표시이고 장을 감싸지 않는다.
    expect(container.querySelector('#experience button')).toBeNull();
    expect(line()).toBeEmptyDOMElement();
    expect(line().contains(articles()[0])).toBe(false);
    expect(document.querySelectorAll('h3[data-part="experience-node"]')).toHaveLength(experiences.length);
    expect(document.querySelectorAll('[data-part="experience-axis"]')).toHaveLength(experiences.length);
  });

  it('lineArrived가 되면 첫 장이 current로 공개되고 수치가 from에서 to로 센다', () => {
    vi.useFakeTimers();
    const { rerender } = render(experienceWithActivity());
    act(() => { rerender(experienceWithActivity({}, { lineArrived: true })); });
    expect(states()).toEqual(['current', 'future', 'future']);
    const first = within(articles()[0]);
    expect(first.getByText('0%')).toBeInTheDocument();
    expect(first.getByText('20분')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1850); });
    expect(first.getByText('-30%')).toBeInTheDocument();
    expect(first.getByText('3분')).toBeInTheDocument();
    // 공개되지 않은 장의 수치는 세지 않고 최종값 그대로다.
    expect(within(articles()[1]).getByText('1620h')).toBeInTheDocument();
  });

  it('모션 감소면 모든 장이 공개되고 수치는 최종값이며 data-complete는 true다', () => {
    const { container } = render(experienceWithActivity({ reducedMotion: true }));
    expect(container.querySelector('section')).not.toHaveAttribute('data-progressive');
    expect(states()).toEqual(['past', 'past', 'current']);
    expect(line()).toHaveAttribute('data-complete', 'true');
    for (const value of ['-30%', '3분', '1620h', '2회']) expect(within(container).getByText(value)).toBeInTheDocument();
    expect([...container.querySelectorAll('figure')].every(figure => figure.dataset.reduced === 'true')).toBe(true);
  });

  it('선호를 확인하기 전 기본값 reduced는 카드와 수치에 모션 감소로 넘기지 않는다', () => {
    const { container } = render(experienceWithActivity({ reducedMotion: true, motionReady: false }));
    expect([...container.querySelectorAll('figure')].every(figure => figure.dataset.reduced === 'false')).toBe(true);
  });

  it('모션 감소에서도 provider를 걸고, 선 끝은 읽기선을 따르며 헤드는 맥동 없이 멈춰 있다', () => {
    const overlay = { setBoundary: vi.fn(), setTimeline: vi.fn(), setReduced: vi.fn(), destroy: vi.fn() };
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1500 - READING });
    render(experienceWithActivity({ reducedMotion: true }, { overlay }));
    const provider = overlay.setTimeline.mock.calls.at(-1)![0] as (dt: number, now: number) => TimelineFrame;
    expect(provider).toBeTypeOf('function');
    let frame!: TimelineFrame;
    act(() => { frame = provider(1 / 60, 0); });
    expect(frame.segments[0].tip + 1500 - READING).toBeCloseTo(1500);
    expect(frame.heads[0]).toMatchObject({ r: R, pulse: 0, current: true });
    expect(line()).toHaveAttribute('data-tip', '1500');
    expect(states()).toEqual(['past', 'past', 'current']);
    expect(line()).toHaveAttribute('data-complete', 'true');
  });

  it('2D 컨텍스트가 없으면 오버레이 없이 자기 rAF로 다음 장을 공개하고 data-complete에 닿는다', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const overlay = createExperienceOverlay(document.createElement('canvas'));
    render(experienceWithActivity({}, { lineArrived: true, overlay }));
    expect(states()).toEqual(['current', 'future', 'future']);
    scrollTo(READ_ENDS[0] - READING + 1);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(states()).toEqual(['past', 'current', 'future']);
    scrollTo(READ_ENDS[2] - READING + 1);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(states()).toEqual(['past', 'past', 'current']);
    expect(line()).toHaveAttribute('data-complete', 'true');
  });

  it('헤더 높이는 잴 때만 읽고 프레임마다 읽지 않는다', () => {
    const header = document.body.appendChild(document.createElement('header'));
    header.setAttribute('data-scroll-header', '');
    const rect = vi.spyOn(header, 'getBoundingClientRect');
    const overlay = { setBoundary: vi.fn(), setTimeline: vi.fn(), setReduced: vi.fn(), destroy: vi.fn() };
    render(experienceWithActivity({}, { lineArrived: true, overlay }));
    const provider = overlay.setTimeline.mock.calls.at(-1)![0] as (dt: number, now: number) => TimelineFrame;
    const measured = rect.mock.calls.length;
    act(() => { for (let i = 0; i < 5; i++) provider(1 / 60, i * 16); });
    expect(rect).toHaveBeenCalledTimes(measured);
    header.remove();
  });

  it('읽기선이 마지막 장 읽기 끝을 지나면 data-complete가 true다', () => {
    const { rerender } = render(experienceWithActivity({}, { lineArrived: true }));
    scrollTo(READ_ENDS[2] - READING - 1);
    expect(line()).toHaveAttribute('data-complete', 'false');
    scrollTo(READ_ENDS[2] - READING + 1);
    expect(line()).toHaveAttribute('data-complete', 'true');
    scrollTo(READ_ENDS[0] - READING);
    expect(line()).toHaveAttribute('data-complete', 'false');
    // 화면을 떠나는 순간 떠난 자리의 완료 상태로 맞춘다(Skills 경계가 읽는다).
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 4000 });
    localVisibility.visible = false;
    rerender(experienceWithActivity({}, { lineArrived: true }));
    expect(line()).toHaveAttribute('data-complete', 'true');
  });

  it('아래에서 켜지면(새로 고침·해시·nav 이동) 다음 노드가 읽기선 위에 있는 구간은 질주 없이 끝난 채 시작한다', () => {
    const overlay = { setBoundary: vi.fn(), setTimeline: vi.fn(), setReduced: vi.fn(), destroy: vi.fn() };
    const view = (visible: boolean) => { localVisibility.visible = visible; return experienceWithActivity({}, { lineArrived: true, overlay }); };
    const below = NODES[2] + 100 - READING;
    // 처음 켜질 때 읽기선이 셋째 노드 아래다. 지난 두 헤드와 장이 바로 산다.
    Object.defineProperty(window, 'scrollY', { configurable: true, value: below });
    const { unmount } = render(view(true));
    expect(states()).toEqual(['past', 'past', 'current']);
    const provider = overlay.setTimeline.mock.calls.at(-1)![0] as (dt: number, now: number) => TimelineFrame;
    let frame!: TimelineFrame;
    act(() => { frame = provider(1 / 60, 0); });
    expect(frame.segments.map(segment => segment.done)).toEqual([true, true, false]);
    expect(frame.segments[0].tip).toBeCloseTo(NODES[1] - below);
    expect(frame.segments[1].tip).toBeCloseTo(NODES[2] - below);
    unmount();
    // 위에서 한 번 켜졌다가 꺼진 채(예: nav로 아래로 뛰어) 아래에서 다시 켜져도 같다.
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const again = render(view(true));
    expect(states()).toEqual(['current', 'future', 'future']);
    act(() => { again.rerender(view(false)); });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: below });
    act(() => { again.rerender(view(true)); });
    expect(states()).toEqual(['past', 'past', 'current']);
  });

  it('한 번도 보이지 않았어도 섹션이 화면 위로 다 지나갔으면 data-complete가 true이고, 다시 아래에 있으면 false다', () => {
    let bottom = -10;
    const original = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return this.id === SECTION_IDS.EXPERIENCE ? ({ top: bottom - 3000, bottom } as DOMRect) : original.call(this);
    });
    localVisibility.visible = false;
    render(experienceWithActivity({}, { lineArrived: true }));
    expect(line()).toHaveAttribute('data-complete', 'true');
    bottom = 5000;
    act(() => { window.dispatchEvent(new Event('scroll')); });
    expect(line()).toHaveAttribute('data-complete', 'false');
    bottom = -10;
    act(() => { window.dispatchEvent(new Event('scroll')); });
    expect(line()).toHaveAttribute('data-complete', 'true');
  });

  it('증거 카드는 공개된 장에서만 active다', () => {
    const { rerender } = render(experienceWithActivity());
    const active = () => articles().map(article => [...article.querySelectorAll('figure')].map(figure => figure.dataset.active));
    expect(active()).toEqual([['false', 'false'], ['false'], ['false', 'false']]);
    act(() => { rerender(experienceWithActivity({}, { lineArrived: true })); });
    expect(active()).toEqual([['true', 'true'], ['false'], ['false', 'false']]);
  });

  it('overlay가 있으면 보이는 동안만 provider를 걸고 떠나면 null로 푼다', () => {
    const overlay = { setBoundary: vi.fn(), setTimeline: vi.fn(), setReduced: vi.fn(), destroy: vi.fn() };
    const view = (visible: boolean) => { localVisibility.visible = visible; return experienceWithActivity({}, { lineArrived: true, overlay }); };
    const { rerender, unmount } = render(view(true));
    const provider = overlay.setTimeline.mock.calls.at(-1)![0] as (dt: number, now: number) => TimelineFrame;
    expect(provider).toBeTypeOf('function');
    // 축 x, 노드 화면 y, 탄생한 첫 헤드(현재, 반지름 R, 맥동이 줄어든다), 아직 살지 않은 헤드(반지름 0)
    let frame!: TimelineFrame;
    act(() => { frame = provider(1 / 60, 0); });
    expect(frame.axisX).toBe(92);
    expect(frame.segments.map(segment => segment.from)).toEqual(NODES);
    expect(frame.segments.map(segment => segment.last)).toEqual([false, false, true]);
    expect(frame.heads[0]).toMatchObject({ y: NODES[0], r: R, current: true });
    expect(frame.heads[0].pulse).toBeCloseTo(1 - 1.2 / 60);
    expect(frame.heads.slice(1).map(head => head.r)).toEqual([0, 0]);
    expect(line()).toHaveAttribute('data-tip', String(NODES[0]));
    act(() => { rerender(view(false)); });
    expect(overlay.setTimeline).toHaveBeenLastCalledWith(null);
    act(() => { rerender(view(true)); });
    expect(overlay.setTimeline.mock.calls.at(-1)![0]).toBeTypeOf('function');
    unmount();
    expect(overlay.setTimeline).toHaveBeenLastCalledWith(null);
  });
});
