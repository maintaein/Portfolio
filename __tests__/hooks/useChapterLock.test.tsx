import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useChapterLock, type ChapterLogo } from '@/hooks/useChapterLock';

// M4 Task 13. About과 Projects는 잠금을 따로 갖지만 잠금 자리가 한 화면 안팎이다(1440x900 실측 808·1632).
// 실제 앱처럼 About 잠금을 먼저, Projects 잠금(pinWhileFlying)을 다음에 세운 두 인스턴스로 같은 입력을 받는다.
// jsdom은 스크롤하지 않으므로 scrollTo가 문서 위치만 옮기고, 섹션 상자는 그 위치로 계산한다.
const ABOUT = 1000;
const PROJECTS = 1800;
let documentY = 0;
let clock = 10_000;
const handles: { about?: ReturnType<typeof useChapterLock>; projects?: ReturnType<typeof useChapterLock> } = {};

function Pair({ aboutLogo, projectsLogo }: { aboutLogo: ChapterLogo; projectsLogo: ChapterLogo }) {
  const aboutRef = useRef<HTMLElement>(null);
  const projectsRef = useRef<HTMLElement>(null);
  const [aboutIndex, setAboutIndex] = useState(0);
  const [projectsIndex, setProjectsIndex] = useState(0);
  const aboutCurrent = useRef(0);
  const projectsCurrent = useRef(0);
  const about = useChapterLock({ ref: aboutRef, count: 3, current: () => aboutCurrent.current,
    choose: index => { aboutCurrent.current = index; setAboutIndex(index); }, logo: aboutLogo, stepMs: 1000, disabled: false, blocked: false });
  const projects = useChapterLock({ ref: projectsRef, count: 6, current: () => projectsCurrent.current,
    choose: index => { projectsCurrent.current = index; setProjectsIndex(index); }, logo: projectsLogo, awayDefers: true, pinWhileFlying: true, stepMs: 800, disabled: false, blocked: false });
  handles.about = about;
  handles.projects = projects;
  return (
    <>
      <section ref={aboutRef} id="about" data-locked={String(about.locked)} data-index={aboutIndex} />
      <section ref={projectsRef} id="projects" data-locked={String(projects.locked)} data-index={projectsIndex} />
    </>
  );
}

beforeEach(() => {
  documentY = 0; clock = 10_000;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => documentY });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  vi.spyOn(window, 'scrollTo').mockImplementation(((options: ScrollToOptions) => { documentY = options.top ?? documentY; }) as typeof window.scrollTo);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const top = (this.id === 'about' ? ABOUT : this.id === 'projects' ? PROJECTS : 0) - documentY;
    return { top, bottom: top + 900, left: 0, right: 600, width: 600, height: 900, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true });
});

const stamp = <T extends Event>(event: T, at: number) => {
  clock = at;
  Object.defineProperty(event, 'timeStamp', { value: at });
  act(() => { window.dispatchEvent(event); });
  return event;
};
// cancelable false는 비차단으로 보낸 wheel이다. 컴포지터가 메인 스레드를 기다리지 않고 이미 그만큼 스크롤했다(헤드 실측).
const wheel = (deltaY: number, at: number, cancelable = true) => stamp(new WheelEvent('wheel', { deltaY, cancelable }), at);
const scrollAt = (top: number, at: number) => { documentY = top; stamp(new Event('scroll'), at); };
const mount = (top: number, logos: { aboutLogo?: ChapterLogo; projectsLogo?: ChapterLogo } = {}) => {
  documentY = top;
  return render(<Pair aboutLogo={logos.aboutLogo ?? 'landed'} projectsLogo={logos.projectsLogo ?? 'landed'} />);
};
const locked = (id: string) => document.getElementById(id)!.getAttribute('data-locked') === 'true';
const index = (id: string) => Number(document.getElementById(id)!.getAttribute('data-index'));

describe('useChapterLock 두 인스턴스 (M4 Task 13)', () => {
  it('About이 잠긴 채 받은 큰 아래 wheel로 Projects가 따로 잠가 끌어가지 않는다', () => {
    mount(ABOUT);
    expect(locked('about')).toBe(true);
    expect(wheel(900, 20_000).defaultPrevented).toBe(true);
    expect(index('about')).toBe(1);
    expect(locked('projects')).toBe(false);
    expect(documentY).toBe(ABOUT);
    expect(window.scrollTo).not.toHaveBeenCalledWith({ top: PROJECTS, behavior: 'instant' });
  });

  it('Projects가 잠긴 채 받은 큰 위 wheel로 About이 따로 잠가 끌어가지 않는다', () => {
    mount(PROJECTS);
    expect(locked('projects')).toBe(true);
    act(() => handles.projects!.select(2));
    expect(wheel(-900, 20_000).defaultPrevented).toBe(true);
    expect(index('projects')).toBe(1);
    expect(locked('about')).toBe(false);
    expect(documentY).toBe(PROJECTS);
    expect(window.scrollTo).not.toHaveBeenCalledWith({ top: ABOUT, behavior: 'instant' });
  });

  it('한쪽을 클릭으로 잠그면 다른 쪽 잠금은 풀려 넘침 창 안의 스크롤에도 서로 되돌리지 않는다', () => {
    mount(ABOUT);
    wheel(100, 20_000);
    expect(index('about')).toBe(1);
    act(() => handles.projects!.select(3));
    expect(documentY).toBe(PROJECTS);
    scrollAt(PROJECTS, 20_050);
    expect(locked('about')).toBe(false);
    expect(locked('projects')).toBe(true);
    expect(documentY).toBe(PROJECTS);
  });

  it('Projects 첫 이름에서 위로 넘긴 큰 wheel이 About 잠금 자리를 지나치면 그때 About이 넘친 만큼만 되돌려 잠근다', () => {
    mount(PROJECTS);
    // 첫 이름에서 위로 한 제스처는 문서로 돌려준다. 큰 wheel은 About 잠금 자리를 210px 지나친다.
    expect(wheel(-1010, 20_000).defaultPrevented).toBe(false);
    expect(locked('projects')).toBe(false);
    expect(locked('about')).toBe(false);
    scrollAt(PROJECTS - 1010, 20_050);
    expect(locked('about')).toBe(true);
    expect(index('about')).toBe(2);
    expect(documentY).toBe(ABOUT);
  });

  it('비차단으로 늦게 받은 wheel은 이미 스크롤된 것으로 보고, 아래에서 올라올 때 입력이 닿지 않은 Projects 잠금 자리까지 당기지 않는다', () => {
    // 실측: Experience 쪽 3340에서 -960 wheel을 2572에서 처리했고, y+delta로 잠금 자리(1632)를 넘었다고 보고 940px를 더 당겼다.
    mount(PROJECTS + 940);
    expect(wheel(-960, 20_000, false).defaultPrevented).toBe(false);
    expect(locked('projects')).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(documentY).toBe(PROJECTS + 940);
    // 실제로 잠금 자리를 넘으면 그때 넘친 만큼만 되돌려 잠근다.
    scrollAt(PROJECTS - 30, 20_100);
    expect(locked('projects')).toBe(true);
    expect(index('projects')).toBe(5);
    expect(documentY).toBe(PROJECTS);
  });

  it('비차단으로 늦게 받은 wheel은 위에서 들어올 때도 아직 닿지 않은 About 잠금 자리로 당기지 않는다', () => {
    mount(ABOUT - 300);
    expect(wheel(700, 20_000, false).defaultPrevented).toBe(false);
    expect(locked('about')).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    // 차단해서 받은 wheel은 아직 스크롤되지 않았으므로 지금처럼 미리 잠근다.
    expect(wheel(400, 20_400).defaultPrevented).toBe(false);
    expect(locked('about')).toBe(true);
    expect(documentY).toBe(ABOUT);
  });
});
