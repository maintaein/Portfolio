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
beforeEach(() => {
  documentY = 0; clock = 10_000;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  vi.spyOn(window, 'scrollTo').mockImplementation(((options: ScrollToOptions) => { documentY = options.top ?? documentY; }) as typeof window.scrollTo);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  // 화면 크기로 답한다. 잠금은 lg(1024) 이상에서만 걸리고 짧은 화면(640 이하)에서는 꺼진다(M4 Task 8).
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: query === '(min-width: 1024px)' ? window.innerWidth >= 1024 : query === '(max-height: 640px)' ? window.innerHeight <= 640 : false,
    media: query, addEventListener: () => {}, removeEventListener: () => {},
  })));
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const box = (top: number, height: number, width = 600) => ({
      top: top - documentY, bottom: top + height - documentY, left: 0, right: width, width, height, x: 0, y: top - documentY, toJSON: () => ({}),
    }) as DOMRect;
    if (this.id === SECTION_IDS.PROJECTS) return box(START, 900);
    if (this.matches('[data-motion-anchor="projects-preview"]')) return box(START + 250, 370);
    if (this.matches('[data-part="index"]')) return box(START + 300, 400);
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
  it.each([-901, -900, 900, 901])('진입 자리에서 %ipx 떨어지면 한 화면 안에서만 비수동 진입 리스너를 등록한다', offset => {
    const add = vi.spyOn(window, 'addEventListener');
    mount(START + offset);
    const blocking = add.mock.calls.filter(([type, , options]) => ['wheel', 'touchmove'].includes(type) && typeof options === 'object' && options.passive === false);
    expect(blocking.map(([type]) => type)).toEqual(Math.abs(offset) <= 900 ? ['wheel', 'touchmove'] : []);
  });

  it('진입 구간을 떠나거나 잠금이 꺼지면 비수동 진입 리스너를 제거하고 수동 리스너로 돌린다', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { update, unmount } = mount(START - 1000);
    add.mockClear();
    scrollAt(START - 100, 20_000);
    const entry = add.mock.calls.filter(([type, , options]) => ['wheel', 'touchmove'].includes(type) && typeof options === 'object' && options.passive === false);
    expect(entry.map(([type]) => type)).toEqual(['wheel', 'touchmove']);
    add.mockClear(); remove.mockClear();
    scrollAt(START - 1000, 21_000);
    for (const [type, listener] of entry) {
      expect(remove).toHaveBeenCalledWith(type, listener, true);
      expect(add).toHaveBeenCalledWith(type, listener, { passive: true, capture: true });
    }
    scrollAt(START - 100, 22_000);
    add.mockClear(); remove.mockClear();
    update({ reducedMotion: true });
    for (const [type, listener] of entry) expect(remove).toHaveBeenCalledWith(type, listener, true);
    expect(add.mock.calls.filter(([type, , options]) => ['wheel', 'touchmove'].includes(type) && typeof options === 'object' && options.passive === false)).toEqual([]);
    add.mockClear(); remove.mockClear();
    update({ reducedMotion: false });
    const restored = add.mock.calls.filter(([type, , options]) => ['wheel', 'touchmove'].includes(type) && typeof options === 'object' && options.passive === false);
    expect(restored.map(([type]) => type)).toEqual(['wheel', 'touchmove']);
    unmount();
    for (const [type, listener] of restored) expect(remove).toHaveBeenCalledWith(type, listener, true);
  });

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

  it.each(['boundary', 'preview'] as const)('로고가 %s에 있어도 빠른 wheel은 진입에서 고정되고 착지 전에는 넘기지 않는다', owner => {
    const { update } = mount(START - 100, { logoOwner: owner });
    wheel(60, 19_984);
    documentY = START - 40;
    expect(wheel(1200, 20_000).defaultPrevented).toBe(true);
    expect(isLocked()).toBe(true);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
    for (let i = 1; i <= 80; i += 1) expect(wheel(1200, 20_000 + i * 16).defaultPrevented).toBe(true);
    expect(key('ArrowDown', 22_000).defaultPrevented).toBe(true);
    expect(selected()).toBe(0);
    expect(window.scrollY).toBe(START);
    const pins = vi.mocked(window.scrollTo).mock.calls.length;
    update({ logoOwner: 'projects' });
    expect(window.scrollTo).toHaveBeenCalledTimes(pins);
    let at = 23_000;
    for (let i = 1; i < N; i += 1) {
      expect(wheel(100, at).defaultPrevented).toBe(true);
      expect(selected()).toBe(i);
      expect(window.scrollY).toBe(START);
      at += PROJECT_STEP_MS;
    }
    expect(wheel(100, at).defaultPrevented).toBe(false);
    expect(isLocked()).toBe(false);
  });

  it('비행 중 실제 스크롤이 진입 자리를 넘으면 overshoot 경로도 즉시 고정한다', () => {
    mount(START - 100, { logoOwner: 'boundary' });
    wheel(20, 20_000);
    scrollAt(START + 700, 20_100);
    expect(isLocked()).toBe(true);
    expect(window.scrollY).toBe(START);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
    expect(wheel(1200, 20_116).defaultPrevented).toBe(true);
    expect(selected()).toBe(0);
  });

  it('비행 중 아래에서 들어와도 마지막 프로젝트로 고정하고 touch 입력은 착지까지 삼킨다', () => {
    mount(START + 60, { logoOwner: 'preview' });
    const touch = (y: number, at: number, type: string) => stamp(Object.assign(new Event(type, { cancelable: true }), { touches: [{ clientY: y }] }), at);
    touch(400, 20_000, 'touchstart');
    expect(touch(500, 20_016, 'touchmove').defaultPrevented).toBe(true);
    expect(isLocked()).toBe(true);
    expect(window.scrollY).toBe(START);
    expect(selected()).toBe(N - 1);
    touch(400, 21_000, 'touchstart');
    expect(touch(500, 21_016, 'touchmove').defaultPrevented).toBe(true);
    expect(selected()).toBe(N - 1);
  });

  it('비행 중 스크롤바로 About에 돌아가면 고정을 풀고 착지에서도 끌어오지 않는다', () => {
    const { update } = mount(START - 100, { logoOwner: 'preview' });
    documentY = START - 40;
    wheel(120, 20_000);
    scrollAt(START - 200, 20_500);
    update({ logoOwner: 'about' });
    update({ logoOwner: 'preview' });
    update({ logoOwner: 'projects' });
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
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
    act(() => name(2).focus({ preventScroll: true }));
    fireEvent.click(name(2));
    expect(selected()).toBe(2);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  // Task 2·7 B1: 진입에서 고정한 뒤 누른 이름은 착지에서도 유지하고 추가 스크롤을 만들지 않는다.
  it('비행 중 고정된 자리에서 이름 3을 누르면 잠금을 유지하고 착지에서도 선택과 위치를 유지한다', () => {
    const { update } = mount(START - 100, { logoOwner: 'preview' });
    wheel(120, 20_000);
    expect(isLocked()).toBe(true);
    expect(window.scrollY).toBe(START);
    fireEvent.click(name(3));
    expect(isLocked()).toBe(true);
    update({ logoOwner: 'projects' });
    expect(selected()).toBe(3);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollY).toBe(START);
  });

  // 헤드 실측(fix1): 빠른 노치 뒤에도 남은 노치가 늦게 온다. 그 wheel이 진입으로 읽혀 누른 이름을 첫 프로젝트로 되돌리면 안 된다.
  it('비행 중 고정된 자리에서 누른 이름은 착지 뒤에 늦게 온 같은 stroke의 wheel에도 되돌아가지 않는다', () => {
    const { update } = mount(START - 100, { logoOwner: 'preview' });
    wheel(120, 20_000);
    scrollAt(START + 270, 20_050);
    fireEvent.click(name(3));
    update({ logoOwner: 'projects' });
    wheel(125, 20_120);
    scrollAt(START + 300, 20_150);
    expect(selected()).toBe(3);
    expect(isLocked()).toBe(true);
    expect(window.scrollY).toBe(START);
  });

  // Task 7 B2: 로고가 About 쪽에 있어도 진입 자리를 넘는 키는 고정하고, 걸음만 착지를 기다린다.
  it.each(['about', 'boundary', 'hero'] as const)('로고가 %s에 있을 때 진입 자리를 넘는 키는 고정하고 착지까지 걸음을 삼킨다', (owner) => {
    const { update } = mount(START - 700, { logoOwner: owner });
    expect(key('ArrowDown', 20_000).defaultPrevented).toBe(true);
    expect(isLocked()).toBe(true);
    expect(window.scrollY).toBe(START);
    expect(selected()).toBe(0);
    expect(key('PageDown', 20_000 + PROJECT_STEP_MS).defaultPrevented).toBe(true);
    expect(selected()).toBe(0);
    update({ logoOwner: 'preview' });
    expect(key('PageDown', 20_000 + PROJECT_STEP_MS + 100).defaultPrevented).toBe(true);
    expect(key(' ', 20_000 + 2 * PROJECT_STEP_MS + 200).defaultPrevented).toBe(true);
    expect(isLocked()).toBe(true);
    expect(selected()).toBe(0);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    update({ logoOwner: 'projects' });
    expect(isLocked()).toBe(true);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
    expect(selected()).toBe(0);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollY).toBe(START);
    expect(key('ArrowDown', 20_000 + 3 * PROJECT_STEP_MS + 300).defaultPrevented).toBe(true);
    expect(selected()).toBe(1);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollY).toBe(START);
  });

  it.each([-40, 0, 40])('비행 중 고정된 로고가 다른 자리로 떠나면 %ipx 위치에 맞춰 잠금을 풀고 입력을 통과시킨다', offset => {
    const { update } = mount(START - 100, { logoOwner: 'preview' });
    wheel(120, 20_000);
    expect(isLocked()).toBe(true);
    documentY = START + offset;
    update({ logoOwner: 'about' });
    expect(isLocked()).toBe(false);
    expect(wheel(offset > 0 ? 10 : -10, 20_100).defaultPrevented).toBe(false);
    scrollAt(START + (offset > 0 ? 200 : -200), 20_150);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it.each(['이동 대기', '화면 폭'] as const)('비행 중 이름을 고른 뒤 %s 변경으로 잠금을 다시 세워도 선택을 유지한다', change => {
    const { update } = mount(START - 100, { logoOwner: 'preview' });
    wheel(120, 20_000);
    fireEvent.click(name(3));
    expect(selected()).toBe(3);
    if (change === '이동 대기') {
      update({ logoOwner: 'preview', navigationPending: true });
      update({ logoOwner: 'preview', navigationPending: false });
    } else {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1023 });
      stamp(new Event('resize'), 20_100);
      expect(isLocked()).toBe(false);
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
      stamp(new Event('resize'), 20_200);
    }
    expect(isLocked()).toBe(true);
    expect(selected()).toBe(3);
    const pins = vi.mocked(window.scrollTo).mock.calls.length;
    update({ logoOwner: 'projects' });
    expect(selected()).toBe(3);
    expect(window.scrollTo).toHaveBeenCalledTimes(pins);
    key('ArrowDown', 22_000);
    expect(selected()).toBe(4);
  });

  it('비행 중 실제 스크롤로 아래에서 진입 자리에 닿으면 마지막 프로젝트로 고정한다', () => {
    mount(START + 100, { logoOwner: 'preview' });
    scrollAt(START, 20_000);
    expect(isLocked()).toBe(true);
    expect(selected()).toBe(N - 1);
  });

  // M4 Task 8. 휠은 화면 높이로 크기를 잡아 늘 들어오므로 잠금은 About처럼 노트북 화면에서도 걸린다.
  it.each([[1280, 720], [1024, 768], [1440, 900]])('%ix%i에서 잠근다', (width, height) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    mount(START - 60);
    wheel(100, 20_000);
    expect(isLocked()).toBe(true);
    expect(selected()).toBe(0);
    key('ArrowDown', 20_000 + PROJECT_STEP_MS);
    expect(selected()).toBe(1);
    expect(window.scrollY).toBe(START);
  });

  // lg 아래에는 휠이 없고 가로 끌기로 넘긴다. 세로 스크롤은 잠그지 않고 그대로 지나간다.
  it('lg 아래(390x844)에서는 잠그지 않고 세로 입력이 문서로 지나간다', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    mount(START);
    expect(isLocked()).toBe(false);
    expect(wheel(100, 20_000).defaultPrevented).toBe(false);
    const touch = (y: number, at: number, type: string) => stamp(Object.assign(new Event(type, { cancelable: true }), { touches: [{ clientY: y }] }), at);
    touch(500, 20_100, 'touchstart');
    expect(touch(400, 20_116, 'touchmove').defaultPrevented).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(selected()).toBe(0);
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
      matches: media === '(max-height: 640px)' || media === '(min-width: 1024px)', media, addEventListener: () => {}, removeEventListener: () => {},
    })))],
    ['lg 아래 화면', {}, () => { Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1023 }); }],
  ] as const)('%s이면 잠그지 않고 목록의 방향키는 끝에서 멈춘다(순환하지 않는다)', (_, props, setup) => {
    setup();
    const add = vi.spyOn(window, 'addEventListener');
    mount(START, props);
    expect(add.mock.calls.filter(([type, , options]) => ['wheel', 'touchmove'].includes(type) && typeof options === 'object' && options.passive === false)).toEqual([]);
    expect(isLocked()).toBe(false);
    expect(wheel(100, 20_000).defaultPrevented).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    fireEvent.keyDown(name(0), { key: 'ArrowUp' });
    expect(selected()).toBe(0);
    fireEvent.keyDown(name(0), { key: 'End' });
    fireEvent.keyDown(name(N - 1), { key: 'ArrowDown' });
    expect(selected()).toBe(N - 1);
    fireEvent.keyDown(name(N - 1), { key: 'ArrowUp' });
    expect(selected()).toBe(N - 2);
  });

  // Task 8 리뷰 B1: 반 화면 넘게 지나친 관성이 착지 뒤의 다음 노치를 새 진입으로 만들어 페이지를 끌어오던 회귀를 막는다.
  it('비행 중 반 화면 넘게 밀린 관성도 고정 위치로 되돌리고 착지에서 잠금을 버리지 않는다', () => {
    const { update } = mount(START - 600, { logoOwner: 'about' });
    update({ logoOwner: 'preview' });
    documentY = START - 60;
    expect(wheel(100, 20_000).defaultPrevented).toBe(true);
    scrollAt(START + 200, 20_100);
    expect(wheel(100, 20_250).defaultPrevented).toBe(true);
    scrollAt(START + 500, 20_300);
    update({ logoOwner: 'projects' });
    expect(isLocked()).toBe(true);
    expect(window.scrollY).toBe(START);
    const pins = vi.mocked(window.scrollTo).mock.calls.length;
    expect(wheel(100, 21_000).defaultPrevented).toBe(true);
    expect(selected()).toBe(1);
    expect(window.scrollTo).toHaveBeenCalledTimes(pins);
  });

  // Task 8 리뷰. 브라우저의 PageUp 한 번은 화면의 .8보다 길고(크롬은 약 .875), 느린 프레임에서는 그 스크롤 이벤트가 350ms보다 늦게 온다.
  // 키 스크롤이 잠금 자리를 넘는지는 추정이 아니라 실제로 넘은 스크롤 이벤트로 정한다. 다른 입력이 오면 그 키의 몫은 끝난다.
  it('키 스크롤이 900ms 뒤에 경계를 넘어도 마지막 프로젝트를 잠근다', () => {
    mount(START + 765);
    expect(isLocked()).toBe(false);
    expect(key('PageUp', 20_000).defaultPrevented).toBe(false);
    scrollAt(START + 400, 20_400);
    expect(isLocked()).toBe(false);
    scrollAt(START - 22, 20_900);
    expect(isLocked()).toBe(true);
    expect(selected()).toBe(N - 1);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
  });

  it('키 스크롤 뒤에 다른 입력(wheel)이 오면 그 뒤에 잠금 자리를 넘는 스크롤은 키의 것이 아니라 잠그지 않는다', () => {
    mount(START + 765);
    key('PageUp', 20_000);
    scrollAt(START + 400, 20_400);
    wheel(-1, 20_500);
    scrollAt(START - 22, 21_200);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('대기 중인 키는 1500ms 뒤에 만료되어 입력 없는 경계 통과가 페이지를 끌지 않는다', () => {
    mount(START + 765);
    expect(key('PageUp', 20_000).defaultPrevented).toBe(false);
    scrollAt(START - 22, 21_501);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it.each(['scrollend', 'pointerdown', 'touchstart', 'popstate', 'release'] as const)('%s가 대기 중인 키를 지워 뒤늦은 경계 통과를 잠그지 않는다', closer => {
    const { handle } = mount(START + 765);
    expect(key('PageUp', 20_000).defaultPrevented).toBe(false);
    if (closer === 'release') act(() => handle.current!.release());
    else stamp(Object.assign(new Event(closer), { touches: [{ clientY: 500 }] }), 20_400);
    scrollAt(START - 22, 20_900);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  // Safari 17.4와 jsdom에는 checkVisibility가 없다. 대체 검사로도 숨은 이름 대신 모바일 열기 단추에 포커스를 돌려야 한다.
  it('모달을 연 채 lg 아래로 넘어가 닫으면 checkVisibility 없이도 포커스가 프리뷰 열기 단추로 돌아온다', async () => {
    expect('checkVisibility' in Element.prototype).toBe(false);
    const query = new EventTarget() as EventTarget & { matches: boolean };
    query.matches = true;
    vi.stubGlobal('matchMedia', vi.fn((media: string) => media === '(min-width: 1024px)' ? query : {
      matches: false, media, addEventListener: () => {}, removeEventListener: () => {},
    }));
    const ready = projects.findIndex(isProjectModalReady);
    documentY = START + 300;
    render(
      <SectionActivityProvider obscured={false} pageVisible routeResolved motionReady reducedMotion={false}>
        <div data-section="projects" tabIndex={-1}><ProjectsSection /></div>
      </SectionActivityProvider>
    );
    if (ready > 0) fireEvent.click(name(ready));
    fireEvent.click(document.querySelector('[data-part="preview-open"]')!);
    expect(await screen.findByRole('dialog', {}, { timeout: 20_000 })).toBeTruthy();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    (document.querySelector('[data-part="index"]')!.parentElement as HTMLElement).style.display = 'none';
    act(() => { query.matches = false; query.dispatchEvent(new Event('change')); });
    expect(document.querySelector('[data-part="preview-open"]')).not.toHaveAttribute('aria-hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 20_000 });
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-part="preview-open"]')), { timeout: 5_000 });
  }, 30_000);
});
