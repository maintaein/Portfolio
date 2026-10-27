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

  it('Projects 첫 이름에서 위로 넘긴 큰 wheel은 Projects를 풀면서 About이 받아 잠그고, 넘친 착지는 About 잠금 자리로 되돌린다', () => {
    mount(PROJECTS);
    // 첫 이름에서 위로 한 제스처는 문서로 돌려준다. 같은 wheel이 About 잠금 자리를 넘으므로 About이 이어받는다(수정 1, B1).
    // About은 진입 wheel을 막지 않으므로 기본 스크롤은 그대로 가고(210px 넘침), 넘침 창 안의 착지를 되돌린다.
    expect(wheel(-1010, 20_000).defaultPrevented).toBe(false);
    expect(locked('projects')).toBe(false);
    expect(locked('about')).toBe(true);
    expect(documentY).toBe(ABOUT);
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

  // 수정 1 B1. 이 harness에서 About의 select가 About의 잠금 wheel 리스너를 다시 달아 Projects 진입 리스너보다 뒤에 둔다(앱의 흔한 순서).
  // 예전에는 Projects가 About이 아직 잠겨 있다고 보고 먼저 거절했고, 그 뒤 About이 풀려 아무도 기본 스크롤을 막지 않았다.
  it('About 마지막 문항에서 큰 아래 wheel 하나로 About이 풀리면 같은 wheel로 Projects가 고정하고 기본 스크롤을 막는다', () => {
    mount(ABOUT);
    act(() => handles.about!.select(2));
    const event = wheel(PROJECTS - ABOUT + 100, 20_000);
    expect(locked('about')).toBe(false);
    expect(locked('projects')).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(index('projects')).toBe(0);
    expect(documentY).toBe(PROJECTS);
    // 막았으므로 400ms 뒤의 착지는 자리를 옮기지 않는다. 고정은 그대로다.
    scrollAt(PROJECTS, 20_400);
    expect(locked('projects')).toBe(true);
    expect(locked('about')).toBe(false);
    expect(documentY).toBe(PROJECTS);
  });

  it('About이 풀리지 않는 wheel(다음 문항으로 넘기는 걸음)에는 Projects가 이어받지 않는다', () => {
    mount(ABOUT);
    act(() => handles.about!.select(1));
    expect(wheel(PROJECTS - ABOUT + 100, 20_000).defaultPrevented).toBe(true);
    expect(index('about')).toBe(2);
    expect(locked('about')).toBe(true);
    expect(locked('projects')).toBe(false);
    expect(documentY).toBe(ABOUT);
    // 다른 입력(시각이 다른 wheel)은 앞의 이어받기를 쓰지 않는다. 걸음 간격 안이라 About이 삼킨다.
    wheel(100, 20_100);
    expect(locked('projects')).toBe(false);
    expect(documentY).toBe(ABOUT);
  });

  // 수정 1 N1. cancelable false는 Chrome의 추정일 뿐이라 스크롤이 아직 안 됐을 수 있다. 그러면 보정한 위치로는 넘지 않지만
  // 나중에 실제로 넘는 스크롤은 350ms 넘침 창이 지나도 잠가야 한다(키 스크롤과 같은 긴 창, scrollend나 다른 입력이 닫는다).
  it('비차단 wheel의 스크롤이 늦게 적용되어 잠금 자리를 넘으면 350ms가 지나도 잠근다', () => {
    mount(PROJECTS + 500);
    expect(wheel(-700, 20_000, false).defaultPrevented).toBe(false);
    expect(locked('projects')).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    scrollAt(PROJECTS - 200, 20_600);
    expect(locked('projects')).toBe(true);
    expect(index('projects')).toBe(5);
    expect(documentY).toBe(PROJECTS);
  });

  it('비차단 wheel 뒤 스크롤이 끝나면(scrollend) 그 뒤 스크롤바로 넘는 것은 잠그지 않는다', () => {
    mount(PROJECTS + 500);
    wheel(-700, 20_000, false);
    stamp(new Event('scrollend'), 20_300);
    scrollAt(PROJECTS - 200, 20_600);
    expect(locked('projects')).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});

// M4 Task 15. About은 진입 wheel을 막지 않는다(수동 리스너). 그 wheel의 네이티브 스크롤이 350ms 넘침 창 뒤에 착지하면 About이 풀려
// 사용자 입력 방향으로 About을 지나쳤다(헤드 실측 1280x720: 881에서 -1031 wheel로 잠근 뒤 369ms 뒤 착지, 628 -> 0).
describe('About 진입 wheel의 늦은 착지 (M4 Task 15)', () => {
  it('Projects 첫 이름에서 위 wheel 하나로 About이 이어받아 잠그면, 그 wheel의 착지가 350ms 뒤에 와도 About 잠금 자리를 지킨다', () => {
    mount(PROJECTS);
    expect(wheel(-1010, 20_000).defaultPrevented).toBe(false);
    expect(locked('about')).toBe(true);
    expect(documentY).toBe(ABOUT);
    scrollAt(0, 20_400);
    expect(locked('about')).toBe(true);
    expect(index('about')).toBe(2);
    expect(documentY).toBe(ABOUT);
  });

  it('About 잠금 자리 바로 위에서 아래 wheel 하나로 About이 잠그면, 그 wheel의 착지가 350ms 뒤에 와도 About 잠금 자리를 지킨다', () => {
    mount(ABOUT - 60);
    expect(wheel(500, 20_000).defaultPrevented).toBe(false);
    expect(locked('about')).toBe(true);
    scrollAt(ABOUT + 500, 20_400);
    expect(locked('about')).toBe(true);
    expect(index('about')).toBe(0);
    expect(locked('projects')).toBe(false);
    expect(documentY).toBe(ABOUT);
  });

  it('로고가 날아오는 동안 미룬 About 잠금은 진입 wheel을 막지 않고 착지를 되돌리지도 않는다', () => {
    mount(ABOUT - 60, { aboutLogo: 'flying' });
    expect(wheel(500, 20_000).defaultPrevented).toBe(false);
    expect(locked('about')).toBe(false);
    scrollAt(ABOUT + 440, 20_400);
    expect(locked('about')).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(documentY).toBe(ABOUT + 440);
  });

  // 헤드 실측(1280x720, 아래 opener): 로고가 막 내려앉던 중이라 미룬 잠금이 454ms 뒤 착지에서 걸렸고, 그 뒤 106ms에 온 wheel의 착지로 풀렸다.
  it('미룬 잠금이 로고 착지로 걸린 뒤 그 wheel의 착지가 늦게 와도 About 잠금 자리를 지킨다', () => {
    const view = mount(ABOUT - 60, { aboutLogo: 'flying' });
    expect(wheel(500, 20_000).defaultPrevented).toBe(false);
    clock = 20_450;
    view.rerender(<Pair aboutLogo="landed" projectsLogo="landed" />);
    expect(locked('about')).toBe(true);
    expect(documentY).toBe(ABOUT);
    scrollAt(ABOUT + 500, 20_560);
    expect(locked('about')).toBe(true);
    expect(documentY).toBe(ABOUT);
  });

  it('잠금 자리 자신의 scrollend는 착지 창을 닫지 않고, 착지를 되돌린 뒤의 scrollend가 닫아 그 뒤 스크롤바 이동은 잠금에서 빠져나간다', () => {
    mount(ABOUT - 60);
    wheel(500, 20_000);
    stamp(new Event('scrollend'), 20_050);
    scrollAt(ABOUT + 500, 20_400);
    expect(documentY).toBe(ABOUT);
    stamp(new Event('scrollend'), 20_450);
    scrollAt(ABOUT + 400, 20_600);
    expect(locked('about')).toBe(false);
    expect(documentY).toBe(ABOUT + 400);
  });

  it('착지가 오지 않으면 pointerdown이나 상한(1500ms)이 착지 창을 닫는다', () => {
    const { unmount } = mount(ABOUT - 60);
    wheel(500, 20_000);
    stamp(new Event('pointerdown'), 20_100);
    scrollAt(ABOUT + 400, 20_400);
    expect(locked('about')).toBe(false);
    expect(documentY).toBe(ABOUT + 400);
    unmount();
    mount(ABOUT - 60);
    wheel(500, 30_000);
    scrollAt(ABOUT + 400, 31_600);
    expect(locked('about')).toBe(false);
    expect(documentY).toBe(ABOUT + 400);
  });
});
