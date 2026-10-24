import { useRef as useVisibilityRef } from 'react';
vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: true, hasEntered: true }) }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectsSection, { PROJECT_STEP_MS, type ProjectsSectionHandle, type ProjectsSectionProps } from '@/components/sections/ProjectsSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { projects } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import { isProjectModalReady } from '@/lib/utils/projectContract';

vi.mock('@/components/blocks/PreviewMorph', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    default: forwardRef<{ morph: () => boolean }, { className?: string }>(function FakePreviewMorph({ className }, ref) {
      useImperativeHandle(ref, () => ({ morph: () => false }), []);
      return <canvas data-part="preview-morph" className={className} />;
    }),
  };
});

// M4 Task 7. Projects는 About과 같은 읽기 잠금(useChapterLock)으로 제스처 하나에 프로젝트 하나를 넘긴다.
// jsdom은 스크롤하지 않으므로 scrollTo가 문서 위치만 옮기고, 섹션·프리뷰·목록의 상자는 그 위치로 계산한다.
// jsdom은 scroll-margin을 계산하지 않으므로 잠금 자리가 곧 섹션의 문서 위치(START)다.
const N = projects.length;
const START = 1500;
let documentY = 0;
let clock = 10_000;
// 잠금 자리에서 목록 아래끝까지의 거리. 목록 위끝은 300이고 이름은 N줄이다. 휠 끝의 먼 이름까지 화면(900) 안이어야 잠근다.
let listBottom = 700;

beforeEach(() => {
  documentY = 0; clock = 10_000; listBottom = 700;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  vi.spyOn(window, 'scrollTo').mockImplementation(((options: ScrollToOptions) => { documentY = options.top ?? documentY; }) as typeof window.scrollTo);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  })));
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const box = (top: number, height: number, width = 600) => ({
      top: top - documentY, bottom: top + height - documentY, left: 0, right: width, width, height, x: 0, y: top - documentY, toJSON: () => ({}),
    }) as DOMRect;
    if (this.id === SECTION_IDS.PROJECTS) return box(START, 900);
    if (this.matches('[data-motion-anchor="projects-preview"]')) return box(START + 250, 370);
    if (this.matches('[data-part="index"]')) return box(START + 300, listBottom - 300);
    return box(0, 0, 0);
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true });
});

type Owner = NonNullable<ProjectsSectionProps['logoOwner']>;
const stamp = <T extends Event>(event: T, at: number, target: EventTarget = window) => {
  clock = at;
  Object.defineProperty(event, 'timeStamp', { value: at });
  act(() => { target.dispatchEvent(event); });
  return event;
};
const wheel = (deltaY: number, at: number) => stamp(new WheelEvent('wheel', { deltaY, cancelable: true }), at);
const key = (name: string, at: number, target: EventTarget = window) => stamp(new KeyboardEvent('keydown', { key: name, cancelable: true, bubbles: true }), at, target);
const scrollAt = (top: number, at: number) => { documentY = top; stamp(new Event('scroll'), at); };
const mount = (top: number, initial: { navigationPending?: boolean; obscured?: boolean; logoOwner?: Owner; reducedMotion?: boolean } = {}) => {
  documentY = top;
  const handle = createRef<ProjectsSectionHandle>();
  const view = ({ navigationPending = false, obscured = false, logoOwner = 'none', reducedMotion = false }: typeof initial) => (
    <SectionActivityProvider obscured={obscured} pageVisible routeResolved motionReady reducedMotion={reducedMotion}>
      <ProjectsSection ref={handle} navigationPending={navigationPending} logoOwner={logoOwner} />
    </SectionActivityProvider>
  );
  const utils = render(view(initial));
  return { ...utils, handle, update: (next: typeof initial) => utils.rerender(view(next)) };
};
const isLocked = () => document.getElementById(SECTION_IDS.PROJECTS)!.getAttribute('data-locked') === 'true';
const selected = () => Number(document.querySelector('[data-name][aria-selected="true"]')!.getAttribute('data-name'));
const name = (i: number) => document.querySelector<HTMLElement>(`[data-name="${i}"]`)!;
// 잠긴 채 한 걸음 간격마다 아래로 한 번씩 눌러 마지막 프로젝트까지 간다.
const stepTo = (index: number, from: number) => { let at = from; for (let i = 0; i < N && selected() < index; i += 1) { at += PROJECT_STEP_MS; key('ArrowDown', at); } return at; };

describe('ProjectsSection 읽기 잠금 (M4 Task 7)', () => {
  it('한 걸음 간격은 PreviewMorph 녹는 시간보다 짧지 않다', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/blocks/PreviewMorph/index.tsx'), 'utf8');
    const melt = Number(source.match(/const DURATION_S = ([\d.]+);/)![1]) * 1000;
    expect(PROJECT_STEP_MS).toBeGreaterThanOrEqual(melt);
  });

  it('아래(Experience)에서 올라오면 마지막 프로젝트로, 위에서 들어오면 첫 프로젝트로 잠근다', () => {
    const { handle } = mount(START + 300);
    expect(isLocked()).toBe(false);
    documentY = START + 60;
    wheel(-120, 20_000);
    expect(isLocked()).toBe(true);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
    expect(selected()).toBe(N - 1);
    act(() => handle.current!.release());
    scrollAt(START - 400, 21_000);
    vi.mocked(window.scrollTo).mockClear();
    documentY = START - 60;
    wheel(100, 22_000);
    expect(isLocked()).toBe(true);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
    expect(selected()).toBe(0);
  });

  it('진입 제스처는 첫 프로젝트에 세우기만 하고 남은 관성은 넘기지 않는다. 다음 제스처가 한 걸음 간다', () => {
    mount(START - 100);
    wheel(60, 20_000);
    expect(isLocked()).toBe(false);
    documentY = START - 40;
    wheel(60, 20_016);
    expect(isLocked()).toBe(true);
    for (let i = 1; i <= 40; i += 1) expect(wheel(40, 20_016 + i * 16).defaultPrevented).toBe(true);
    expect(selected()).toBe(0);
    wheel(100, 20_016 + 40 * 16 + PROJECT_STEP_MS);
    expect(selected()).toBe(1);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('잠긴 뒤 짧은 wheel과 긴 관성은 한 프로젝트만 넘긴다', () => {
    mount(START);
    expect(isLocked()).toBe(true);
    expect(wheel(1, 20_000).defaultPrevented).toBe(true);
    for (let i = 0; i < 60; i += 1) wheel(Math.max(1, 30 * 0.95 ** i), 20_020 + i * 20);
    expect(selected()).toBe(1);
  });

  it('한 걸음 뒤 간격 안의 새 제스처는 넘기지 않고, 간격이 지나면 넘긴다', () => {
    mount(START);
    key('ArrowDown', 20_000);
    expect(selected()).toBe(1);
    expect(key('ArrowDown', 20_000 + PROJECT_STEP_MS - 1).defaultPrevented).toBe(true);
    expect(selected()).toBe(1);
    key('ArrowDown', 20_000 + 2 * PROJECT_STEP_MS);
    expect(selected()).toBe(2);
  });

  it('마지막 프로젝트의 새 제스처는 Experience로, 첫 프로젝트의 위 제스처는 위로 문서에 돌려준다', () => {
    mount(START);
    const at = stepTo(N - 1, 20_000);
    expect(isLocked()).toBe(true);
    expect(wheel(100, at + PROJECT_STEP_MS).defaultPrevented).toBe(false);
    expect(isLocked()).toBe(false);
    expect(selected()).toBe(N - 1);
    // 다시 올라와 잠그고, 첫 프로젝트까지 올라간 뒤 위 제스처는 놓는다(순환하지 않는다).
    documentY = START + 80;
    wheel(-100, at + 2 * PROJECT_STEP_MS);
    expect(isLocked()).toBe(true);
    let up = at + 2 * PROJECT_STEP_MS;
    for (let i = 0; i < N && selected() > 0; i += 1) { up += PROJECT_STEP_MS; key('ArrowUp', up); }
    expect(key('ArrowUp', up + PROJECT_STEP_MS).defaultPrevented).toBe(false);
    expect(isLocked()).toBe(false);
    expect(selected()).toBe(0);
  });

  it('로고가 프리뷰로 날아오는 동안에는 입력을 막지 않고 기다렸다가 내려앉을 때 첫 프로젝트로 잠근다', () => {
    const { update } = mount(START - 100, { logoOwner: 'preview' });
    documentY = START - 40;
    expect(wheel(120, 20_000).defaultPrevented).toBe(false);
    scrollAt(START + 80, 20_100);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    update({ logoOwner: 'projects' });
    expect(isLocked()).toBe(true);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
    expect(selected()).toBe(0);
  });

  it('로고가 About으로 되돌아가 내려앉으면 미룬 잠금을 버린다', () => {
    const { update } = mount(START - 100, { logoOwner: 'preview' });
    documentY = START - 40;
    wheel(120, 20_000);
    scrollAt(START - 200, 20_300);
    update({ logoOwner: 'about' });
    update({ logoOwner: 'preview' });
    update({ logoOwner: 'projects' });
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('잠긴 동안 방향키 한 번은 한 걸음이고 포커스가 따라간다. 끝에서는 순환하지 않고 문서로 돌려준다. Home·End는 목록의 것이다', () => {
    mount(START);
    act(() => name(0).focus());
    expect(key('ArrowUp', 20_000, name(0)).defaultPrevented).toBe(false);
    expect(selected()).toBe(0);
    expect(isLocked()).toBe(false);
    scrollAt(START, 21_000);
    expect(isLocked()).toBe(true);
    key('ArrowDown', 22_000, name(0));
    expect(selected()).toBe(1);
    expect(document.activeElement).toBe(name(1));
    key('End', 22_100, name(1));
    expect(selected()).toBe(N - 1);
    expect(document.activeElement).toBe(name(N - 1));
    expect(key('ArrowDown', 23_000, name(N - 1)).defaultPrevented).toBe(false);
    expect(selected()).toBe(N - 1);
    expect(isLocked()).toBe(false);
    key('Home', 23_100, name(N - 1));
    expect(selected()).toBe(0);
  });

  it('잠기지 않은 채 이름을 누르면 그 프로젝트로 잠근다', () => {
    mount(START + 300);
    expect(isLocked()).toBe(false);
    fireEvent.click(name(3));
    expect(isLocked()).toBe(true);
    expect(selected()).toBe(3);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
  });

  // Task 2: 날아오는 도중의 클릭은 비행을 제자리에 정착시키고 고르기만 한다. 잠금이 착지를 기다리듯 페이지를 옮기지 않는다.
  it('로고가 프리뷰로 날아오는 동안 이름을 누르면 고르기만 하고 잠그거나 페이지를 옮기지 않는다', () => {
    mount(START - 500, { logoOwner: 'preview' });
    fireEvent.click(name(2));
    expect(selected()).toBe(2);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('Tab으로 이름 목록에 닿으면 그 이름의 프로젝트로 잠근다', async () => {
    mount(START - 600);
    for (let i = 0; i < 4 && !document.activeElement?.hasAttribute('data-name'); i += 1) await userEvent.tab();
    expect(document.activeElement).toBe(name(0));
    expect(isLocked()).toBe(true);
    expect(selected()).toBe(0);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
  });

  it('모달이 본문을 가리거나 명시적 이동 중이면 잠그지 않고, 이동이 끝나면 잠근다', () => {
    const first = mount(START, { obscured: true });
    expect(isLocked()).toBe(false);
    expect(wheel(100, 20_000).defaultPrevented).toBe(false);
    first.unmount();
    const { update } = mount(START - 40, { navigationPending: true });
    expect(wheel(100, 21_000).defaultPrevented).toBe(false);
    scrollAt(START, 21_050);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    update({ navigationPending: false });
    expect(isLocked()).toBe(true);
  });

  it('release()는 잠금을 풀어 명시적 이동을 Projects로 끌어오지 않는다', () => {
    const { handle } = mount(START);
    expect(isLocked()).toBe(true);
    act(() => handle.current!.release());
    expect(isLocked()).toBe(false);
    scrollAt(START + 300, 20_050);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('프리뷰로 연 모달을 닫아 포커스가 이름으로 돌아와도 페이지를 끌어오지 않는다', async () => {
    const ready = projects.findIndex(isProjectModalReady);
    mount(START + 300);
    if (ready > 0) fireEvent.click(name(ready));
    scrollAt(START + 300, 20_000);
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.click(document.querySelector('[data-part="preview-open"]')!);
    expect(await screen.findByRole('dialog', {}, { timeout: 20_000 })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 20_000 });
    await waitFor(() => expect(document.activeElement).toBe(name(ready)), { timeout: 5_000 });
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(isLocked()).toBe(false);
  });

  it.each([
    ['모션 감소', { reducedMotion: true }, () => {}],
    ['짧은 화면', {}, () => vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
      matches: media === '(max-height: 640px)', media, addEventListener: () => {}, removeEventListener: () => {},
    })))],
    // 목록 상자(300-760)는 화면(900) 안이지만 한 줄이 76.7px이면 휠 끝의 가장 먼 이름은 아래끝이 928px까지 간다.
    ['목록 상자는 들어와도 휠 끝의 먼 이름이 잠금 자리에서 화면 아래로 잘리는 화면', {}, () => { listBottom = 760; }],
  ] as const)('%s이면 잠그지 않고 목록의 방향키는 그대로 순환한다', (_, props, setup) => {
    setup();
    mount(START, props);
    expect(isLocked()).toBe(false);
    expect(wheel(100, 20_000).defaultPrevented).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    fireEvent.keyDown(name(0), { key: 'ArrowUp' });
    expect(selected()).toBe(N - 1);
  });
});
