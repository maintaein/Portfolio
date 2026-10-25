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

  // Task 7 리뷰 B1. 날아오는 동안 잠금 자리를 지나쳐 미룬 잠금이 있어도, 그사이 누른 이름은 착지 때 첫 프로젝트로 되돌아가지 않고 페이지도 옮기지 않는다.
  it('날아오는 동안 미룬 잠금이 있어도 그사이 누른 이름은 착지 뒤에도 그대로이고 페이지를 끌어오지 않는다', () => {
    const { update } = mount(START - 100, { logoOwner: 'preview' });
    wheel(120, 20_000);
    expect(isLocked()).toBe(false);
    fireEvent.click(name(3));
    update({ logoOwner: 'projects' });
    expect(selected()).toBe(3);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  // 헤드 실측(fix1): 빠른 노치는 잠금 자리를 지나치고, 누른 뒤에도 남은 노치가 늦게 온다. 그 wheel이 진입으로 읽혀 첫 프로젝트로 잠그면 안 된다.
  it('날아오는 동안 잠금 자리를 지나쳐 누른 이름은 착지 뒤에 늦게 온 같은 stroke의 wheel에도 되돌아가지 않는다', () => {
    const { update } = mount(START - 100, { logoOwner: 'preview' });
    wheel(120, 20_000);
    scrollAt(START + 270, 20_050);
    fireEvent.click(name(3));
    update({ logoOwner: 'projects' });
    wheel(125, 20_120);
    scrollAt(START + 300, 20_150);
    expect(selected()).toBe(3);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  // Task 7 리뷰 B2. 키 한 번은 로고가 아직 About(또는 Hero와 오가는 중)에 있을 때도 잠금 자리에 닿는다. 그때는 잠그지 않고 기다렸다가
  // 로고가 프리뷰에 내려앉을 때 잠근다. 날아가는 동안 보이지 않는 목록을 넘기지 않는다.
  it.each(['about', 'boundary', 'hero'] as const)('로고가 %s에 있을 때 키로 들어오면 잠그지도 넘기지도 않고 프리뷰에 내려앉을 때 첫 프로젝트로 잠근다', (owner) => {
    const { update } = mount(START - 700, { logoOwner: owner });
    expect(key('ArrowDown', 20_000).defaultPrevented).toBe(false);
    expect(isLocked()).toBe(false);
    update({ logoOwner: 'preview' });
    documentY = START - 100;
    expect(key('PageDown', 20_000 + PROJECT_STEP_MS + 100).defaultPrevented).toBe(false);
    expect(key(' ', 20_000 + 2 * PROJECT_STEP_MS + 200).defaultPrevented).toBe(false);
    expect(isLocked()).toBe(false);
    expect(selected()).toBe(0);
    expect(window.scrollTo).not.toHaveBeenCalled();
    update({ logoOwner: 'projects' });
    expect(isLocked()).toBe(true);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
    expect(selected()).toBe(0);
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
    mount(START, props);
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

  // Task 8 리뷰 B1. 로고가 프리뷰로 날아오는 동안 잠금 자리를 반 화면 넘게 지나치면 착지에서 미룬 잠금을 버린다.
  // 버릴 때 앞뒤를 위치로 다시 정하지 않으면 다음 노치가 진입으로 읽혀 페이지를 잠금 자리로 400px 넘게 끌어올렸다.
  it('날아오는 동안 잠금 자리를 반 화면 넘게 지나쳐 착지에서 미룬 잠금을 버리면 다음 노치가 페이지를 끌어오지 않는다', () => {
    const { update } = mount(START - 600, { logoOwner: 'about' });
    update({ logoOwner: 'preview' });
    documentY = START - 60;
    expect(wheel(100, 20_000).defaultPrevented).toBe(false);
    scrollAt(START + 200, 20_100);
    expect(wheel(100, 20_250).defaultPrevented).toBe(false);
    scrollAt(START + 500, 20_300);
    update({ logoOwner: 'projects' });
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(wheel(100, 21_000).defaultPrevented).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(isLocked()).toBe(false);
    expect(window.scrollY).toBe(START + 500);
  });

  // Task 8 리뷰. 브라우저의 PageUp 한 번은 화면의 .8보다 길고(크롬은 약 .875), 느린 프레임에서는 그 스크롤 이벤트가 350ms보다 늦게 온다.
  // 키 스크롤이 잠금 자리를 넘는지는 추정이 아니라 실제로 넘은 스크롤 이벤트로 정한다. 다른 입력이 오면 그 키의 몫은 끝난다.
  it('a late key crossing at 900ms still locks the last project', () => {
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

  it('pending key expires after 1500ms so an input-free crossing does not pull the page', () => {
    mount(START + 765);
    expect(key('PageUp', 20_000).defaultPrevented).toBe(false);
    scrollAt(START - 22, 21_501);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it.each(['scrollend', 'pointerdown', 'touchstart', 'popstate', 'release'] as const)('%s clears a pending key before a late crossing', closer => {
    const { handle } = mount(START + 765);
    expect(key('PageUp', 20_000).defaultPrevented).toBe(false);
    if (closer === 'release') act(() => handle.current!.release());
    else stamp(Object.assign(new Event(closer), { touches: [{ clientY: 500 }] }), 20_400);
    scrollAt(START - 22, 20_900);
    expect(isLocked()).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  // Hidden names must return focus to the mobile opener, including without checkVisibility.
  it('이름 목록이 숨은 화면에서 모달을 닫으면 checkVisibility 없이도 포커스가 프리뷰 열기 단추로 돌아온다', async () => {
    expect('checkVisibility' in Element.prototype).toBe(false);
    const ready = projects.findIndex(isProjectModalReady);
    documentY = START + 300;
    render(
      <SectionActivityProvider obscured={false} pageVisible routeResolved motionReady reducedMotion={false}>
        <div data-section="projects" tabIndex={-1}><ProjectsSection /></div>
      </SectionActivityProvider>
    );
    if (ready > 0) fireEvent.click(name(ready));
    (document.querySelector('[data-part="index"]')!.parentElement as HTMLElement).style.display = 'none';
    fireEvent.click(document.querySelector('[data-part="preview-open"]')!);
    expect(await screen.findByRole('dialog', {}, { timeout: 20_000 })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 20_000 });
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-part="preview-open"]')), { timeout: 5_000 });
  }, 30_000);
});
