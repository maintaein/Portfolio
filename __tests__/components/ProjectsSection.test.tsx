import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ProjectsSection from '@/components/sections/ProjectsSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { projects } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import type { NavId } from '@/hooks/useSectionNav';
import { isProjectModalReady } from '@/lib/utils/projectContract';

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false, media: '', addEventListener: () => {}, removeEventListener: () => {},
    })
  );
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  // History 테스트가 남긴 state가 다음 테스트로 새지 않게 매번 깨끗하게 시작한다
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderSection(active: NavId = SECTION_IDS.PROJECTS) {
  return render(
    <SectionActivityProvider
      active={active}
      entryAnimationTarget={null}
      pageVisible
      routeResolved
      motionReady
      reducedMotion={false}
    >
      <ProjectsSection />
    </SectionActivityProvider>
  );
}

const N = projects.length;

describe('ProjectsSection 접힘 레이아웃', () => {
  it('섹션 패딩이 py-6 px-10이다', () => {
    renderSection();
    const section = document.getElementById(SECTION_IDS.PROJECTS)!;
    expect(section.className).toContain('py-6');
    expect(section.className).toContain('px-10');
  });

  it('격자가 lg에서 3fr:2fr이다', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(process.cwd(), 'components/sections/ProjectsSection/index.tsx'),
      'utf8'
    );
    expect(source).toContain('lg:grid-cols-[3fr_2fr]');
  });

  it('프리뷰가 열 폭의 0.6배 16:9다', () => {
    renderSection();
    const preview = document.querySelector('[data-part="preview"]')!;
    expect(preview.className).toContain('w-[60%]');
    expect(preview.className).toContain('aspect-video');
  });

  it('이름이 프로젝트 수만큼 있고 전부 role=tab이다', () => {
    renderSection();
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(N);
  });

  it('활성 이름은 text-t3이고 비활성 이름은 MUTED 밝기다', () => {
    renderSection();
    const active = document.querySelector<HTMLElement>('[aria-selected="true"]')!;
    expect(active.className).toContain('text-t3');
    const inactive = document.querySelector<HTMLElement>('[aria-selected="false"]')!;
    // jsdom이 CSS 색을 rgba(...) 콤마 표기로 정규화한다. 소스의 리터럴과 다르다
    expect(inactive.style.color).toBe('rgba(255, 255, 255, 0.62)');
  });

  // 이름과 상세 판 제목은 GSAP Flip으로 짝지어 날아간다. 두 노드의 글자
  // 크기가 다르면 비행 내내 배율로 늘어나 흐려지므로, 글자 표현은 같은
  // 토큰을 써야 한다. 어느 한쪽만 바뀌어도 이 테스트가 FAIL한다 -
  // 이름 쪽만 손으로 적어 두면 제목이 움직였을 때 아무도 모른다
  it('이름 글자 표현이 상세 판 제목과 같은 토큰을 쓴다', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const modalSource = readFileSync(
      resolve(process.cwd(), 'components/blocks/ProjectModal/index.tsx'),
      'utf8'
    );
    const fromTitle = modalSource.slice(modalSource.indexOf('id="pm-title"'));
    const titleAttrs = fromTitle.slice(0, fromTitle.indexOf('>'));

    renderSection();
    const name = document.querySelector<HTMLElement>('[data-name="0"]')!;
    for (const token of ['text-t3', 'font-bold', 'tracking-[-0.02em]']) {
      expect(titleAttrs).toContain(token);
      expect(name.className).toContain(token);
    }
    // 제목이 안 쓰는 것은 이름도 안 쓴다. text-t1은 크기가 어긋나고
    // leading-[1.35]는 text-t3 유틸리티가 넣는 줄높이를 덮는다
    expect(titleAttrs).not.toContain('text-t1');
    expect(name.className).not.toContain('text-t1');
    expect(name.className).not.toContain('leading-[1.35]');
    // truncate는 좁은 머리띠에서 제목이 버튼을 밀지 않게 하는 배치 장치다.
    // 밀어낼 버튼이 없는 이름 목록에는 오지 않는다
    expect(name.className).not.toContain('truncate');
  });

  it('호버가 프리뷰를 그 프로젝트로 갈아 끼운다', () => {
    renderSection();
    fireEvent.mouseEnter(document.querySelector('[data-name="1"]')!);
    const preview = document.querySelector('[data-part="preview"]')!;
    expect(preview.getAttribute('data-flip-id')).toBe(`pv-${projects[1].title}`);
  });

  it('FLIP 손잡이가 프리뷰 하나와 활성 이름 하나에만 붙는다', () => {
    renderSection();
    const preview = document.querySelector('[data-part="preview"]')!;
    expect(preview.getAttribute('data-flip-id')).toBe(`pv-${projects[0].title}`);
    expect(document.querySelectorAll('[data-flip-id^="title-"]')).toHaveLength(1);
    expect(
      document.querySelector('[data-flip-id^="title-"]')!.getAttribute('data-flip-id')
    ).toBe(`title-${projects[0].title}`);
  });
});

describe('ProjectsSection 모양 잠금', () => {
  it('framer-motion을 쓰지 않는다', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(process.cwd(), 'components/sections/ProjectsSection/index.tsx'),
      'utf8'
    );
    expect(source).not.toContain('framer-motion');
  });

  it('시안을 글자색으로 쓰지 않는다', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(process.cwd(), 'components/sections/ProjectsSection/index.tsx'),
      'utf8'
    );
    // 어두운 바탕 위 시안 글자가 ai-color-palette를 부른다.
    // 점·채움·테두리·밑줄·포커스 링의 시안은 걸리지 않는다
    expect(source).not.toMatch(/(?:^|[^-])color:\s*(?:var\(--cyan|#03b3c3)/i);
    expect(source).not.toMatch(/\btext-\[#03b3c3\]/i);
  });

  it('섹션 제목은 sr-only다', () => {
    renderSection();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.className).toContain('sr-only');
  });
});

describe('ProjectsSection 이름 목록', () => {
  it('탭 정지점이 N과 무관하게 1개다', () => {
    renderSection();
    // 활성 이름 1개만 tabIndex 0이다. 나머지는 -1이다
    const stops = Array.from(
      document.querySelectorAll<HTMLElement>('button, [tabindex]')
    ).filter((el) => el.tabIndex === 0 && !el.hasAttribute('disabled'));
    expect(stops).toHaveLength(1);

    const names = document.querySelectorAll<HTMLElement>('[data-name]');
    expect(Array.from(names).filter((c) => c.tabIndex === 0)).toHaveLength(1);
  });

  it('ArrowDown이 끝에서 처음으로 감긴다', () => {
    renderSection();
    const row = document.querySelector('[role="tablist"]')!;
    for (let i = 0; i < N; i += 1) fireEvent.keyDown(row, { key: 'ArrowDown' });
    // N번 누르면 제자리다. 순환이 안 되면 마지막에 멈춘다
    expect(
      document.querySelector('[aria-selected="true"]')!.getAttribute('data-name')
    ).toBe('0');
  });

  it('ArrowUp이 처음에서 끝으로 감긴다', () => {
    renderSection();
    const row = document.querySelector('[role="tablist"]')!;
    fireEvent.keyDown(row, { key: 'ArrowUp' });
    expect(
      document.querySelector('[aria-selected="true"]')!.getAttribute('data-name')
    ).toBe(String(N - 1));
  });

  it('Home은 0으로, End는 N-1로 간다', () => {
    renderSection();
    const row = document.querySelector('[role="tablist"]')!;
    fireEvent.keyDown(row, { key: 'End' });
    expect(
      document.querySelector('[aria-selected="true"]')!.getAttribute('data-name')
    ).toBe(String(N - 1));
    fireEvent.keyDown(row, { key: 'Home' });
    expect(
      document.querySelector('[aria-selected="true"]')!.getAttribute('data-name')
    ).toBe('0');
  });

  it('active가 N-1일 때 프리뷰가 그 프로젝트를 가리킨다', () => {
    renderSection();
    fireEvent.keyDown(document.querySelector('[role="tablist"]')!, { key: 'End' });
    expect(
      document.querySelector('[data-part="preview"]')!.getAttribute('data-flip-id')
    ).toBe(`pv-${projects[N - 1].title}`);
  });

  it('활성 이름만 aria-selected가 true다', () => {
    renderSection();
    const selected = document.querySelectorAll('[data-name][aria-selected="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute('data-name')).toBe('0');
  });
});

const CYCLE_MS = 3000;
const withVideo = projects.findIndex((p) =>
  p.implementations?.some((impl) => impl.video)
);

describe('ProjectsSection 영상', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom에는 play/pause가 없다
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('영상이 있는 프로젝트가 활성이면 첫 구현 기능 영상을 건다', () => {
    renderSection();
    goToIndex(withVideo);
    const video = document.querySelector<HTMLVideoElement>('[data-part="preview-video"]')!;
    expect(video.getAttribute('src')).toBe(
      projects[withVideo].implementations!.filter((i) => i.video)[0].video
    );
    // 프리뷰는 손잡이일 뿐 클릭은 이름 버튼이 받는다
    expect(video.getAttribute('aria-hidden')).toBe('true');
    expect(video.hasAttribute('controls')).toBe(false);
    expect(video.muted).toBe(true);
    expect(video.hasAttribute('loop')).toBe(false);
    expect(video.getAttribute('poster')).toBe(projects[withVideo].image);
  });

  it('3초마다 다음 구현 기능으로 넘어가고 마지막에서 처음으로 감긴다', () => {
    renderSection();
    goToIndex(withVideo);
    const videos = projects[withVideo].implementations!
      .filter((i) => i.video)
      .map((i) => i.video);
    for (let step = 1; step <= videos.length; step += 1) {
      act(() => {
        vi.advanceTimersByTime(CYCLE_MS);
      });
      const video = document.querySelector<HTMLVideoElement>('[data-part="preview-video"]')!;
      expect(video.getAttribute('src')).toBe(videos[step % videos.length]);
    }
  });

  it('3초가 차기 전에 영상이 끝나면 그 자리에서 다음으로 넘어간다', () => {
    renderSection();
    goToIndex(withVideo);
    const videos = projects[withVideo].implementations!
      .filter((i) => i.video)
      .map((i) => i.video);
    const video = document.querySelector<HTMLVideoElement>('[data-part="preview-video"]')!;
    fireEvent.ended(video);
    expect(
      document.querySelector('[data-part="preview-video"]')!.getAttribute('src')
    ).toBe(videos[1]);
  });

  it('프로젝트가 바뀌면 src를 놓고 순환 인덱스가 0으로 되돌아온다', () => {
    renderSection();
    goToIndex(withVideo);
    act(() => {
      vi.advanceTimersByTime(CYCLE_MS);
    });
    goToIndex(withVideo);   // 한 바퀴 돌아 같은 프로젝트로 되돌아온다
    const video = document.querySelector<HTMLVideoElement>('[data-part="preview-video"]')!;
    expect(video.getAttribute('src')).toBe(
      projects[withVideo].implementations!.filter((i) => i.video)[0].video
    );
  });

  it('섹션이 비활성이면 영상을 걸지 않는다', () => {
    renderSection(SECTION_IDS.ABOUT);
    goToIndex(withVideo);
    const video = document.querySelector<HTMLVideoElement>('[data-part="preview-video"]');
    expect(video?.getAttribute('src') ?? null).toBeNull();
  });

  it('reducedMotion이면 영상을 걸지 않고 poster만 남는다', () => {
    render(
      <SectionActivityProvider
        active={SECTION_IDS.PROJECTS}
        entryAnimationTarget={null}
        pageVisible
        routeResolved
        motionReady
        reducedMotion
      >
        <ProjectsSection />
      </SectionActivityProvider>
    );
    goToIndex(withVideo);
    expect(
      document.querySelector('[data-part="preview-video"]')?.getAttribute('src') ?? null
    ).toBeNull();
  });

  it('pageVisible이 false면 3초 타이머가 멈춘다', () => {
    const { rerender } = renderSection();
    goToIndex(withVideo);
    const before = document
      .querySelector('[data-part="preview-video"]')!
      .getAttribute('src');
    rerender(
      <SectionActivityProvider
        active={SECTION_IDS.PROJECTS}
        entryAnimationTarget={null}
        pageVisible={false}
        routeResolved
        motionReady
        reducedMotion={false}
      >
        <ProjectsSection />
      </SectionActivityProvider>
    );
    act(() => {
      vi.advanceTimersByTime(CYCLE_MS * 3);
    });
    expect(
      document.querySelector('[data-part="preview-video"]')!.getAttribute('src')
    ).toBe(before);
  });

  it('video가 없는 프로젝트는 image로 떨어진다', () => {
    const noVideo = projects.findIndex(
      (p) => !p.implementations?.some((impl) => impl.video)
    );
    renderSection();
    goToIndex(noVideo);
    expect(document.querySelector('[data-part="preview-video"]')).toBeNull();
    const img = document.querySelector('[data-part="preview-image"]')!;
    expect(img.getAttribute('src')).toContain(
      projects[noVideo].image.split('/').pop()
    );
  });
});

// 이름에 호버해 그 프로젝트로 간다. click을 쓰면 계약을 채운 프로젝트에서
// 모달이 열려 !modalOpen 게이트가 재생을 끊는다 — 이 describe는 프리뷰
// 재생만 보는 것이라 호버로 선택만 옮긴다
function goToIndex(i: number) {
  fireEvent.mouseEnter(document.querySelector(`[data-name="${i}"]`)!);
}

// ProjectModal은 next/dynamic({ssr:false})로 실제 import()를 거쳐 로드된다
// (HomeClient.test.tsx의 findByRole(..., {timeout: 20_000}) 관례와 같은 이유).
// 이 describe 안의 클릭·popstate 시나리오는 dialog가 실제로 그려지길 기다려야
// 하므로 findByRole/waitFor로 기다린다 — getByRole 동기 단정은 청크 로드 전에
// 거짓 실패한다
describe('ProjectsSection modal-only History', { timeout: 30_000 }, () => {
  it('이름을 눌러 펼치면 projectModalId를 pushState한다', () => {
    const push = vi.spyOn(window.history, 'pushState');
    renderSection();
    fireEvent.click(document.querySelector('[data-name="0"]')!);
    expect(push).toHaveBeenCalled();
    const state = push.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(typeof state.projectModalId).toBe('string');
  });

  it('유효한 projectModalId로 mount하면 History를 늘리지 않고 모달을 복구한다', async () => {
    const ready = projects.find((p) => isProjectModalReady(p))!;
    window.history.replaceState({ projectModalId: ready.title }, '', '#projects');
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    renderSection();
    expect(
      await screen.findByRole('dialog', { name: ready.title }, { timeout: 20_000 })
    ).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('무효한 projectModalId는 그 키만 replaceState로 지운다', () => {
    window.history.replaceState(
      { projectModalId: '없는프로젝트', __NA: 'next가 쓰는 필드' },
      '',
      '#projects'
    );
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    renderSection();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
    const state = replace.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(state.projectModalId).toBeUndefined();
    // 다른 Next.js History 필드는 그대로 둔다
    expect(state.__NA).toBe('next가 쓰는 필드');
  });

  it('계약 미달 이름은 눌러도 안 펼쳐진다', () => {
    const unready = projects.findIndex((p) => !isProjectModalReady(p));
    if (unready === -1) return;
    const push = vi.spyOn(window.history, 'pushState');
    renderSection();
    // 클릭으로 직접 열기를 시도한다. goToIndex(hover)로는 애초에 openModal
    // 경로를 안 타므로 이 시나리오를 못 잡는다
    fireEvent.click(document.querySelector(`[data-name="${unready}"]`)!);
    expect(
      document.querySelector('[aria-selected="true"]')!.getAttribute('data-name')
    ).toBe(String(unready));
    // 뮤테이션: handleNameClick이 계약을 안 보고 항상 openModal을 부르면
    // pushState가 불려 여기서 FAIL한다
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // 계획서 테스트 네 개는 위까지다. 아래는 함정 하나(복구된 모달을 History.back()으로
  // 닫으면 우리 사이트 밖으로 나갈 수 있다)와 mount·popstate가 정말 하나의
  // 함수를 공유하는지, 그리고 pushState가 기존 state를 날리지 않는지를
  // 추가로 고정한다. 계획서에는 없지만 이 계약을 지키는 테스트가 없으면
  // 위 네 개만으로는 회귀를 못 잡는다.

  it('펼칠 때 기존 history.state 필드를 펼쳐 담는다', () => {
    window.history.replaceState({ __NA: 'next가 쓰는 필드' }, '', '#projects');
    const push = vi.spyOn(window.history, 'pushState');
    renderSection();
    fireEvent.click(document.querySelector('[data-name="0"]')!);
    const state = push.mock.calls.at(-1)![0] as Record<string, unknown>;
    // 뮤테이션: pushState({ projectModalId })로 스프레드를 빼면 __NA가
    // 사라져 여기서 FAIL한다
    expect(state.__NA).toBe('next가 쓰는 필드');
    expect(typeof state.projectModalId).toBe('string');
  });

  it('popstate로 유효한 projectModalId가 오면 mount와 같은 판정으로 모달을 연다', async () => {
    const ready = projects.find((p) => isProjectModalReady(p))!;
    const readyIndex = projects.findIndex((p) => p.title === ready.title);
    renderSection();
    expect(screen.queryByRole('dialog')).toBeNull();

    // 뮤테이션: reconcileProjectModal이 mount에서만 불리고 popstate 경로가
    // 따로 있으면(또는 아예 없으면) 여기서 다이얼로그가 안 뜬다
    act(() => {
      window.history.replaceState({ projectModalId: ready.title }, '', '#projects');
      window.dispatchEvent(
        new PopStateEvent('popstate', { state: { projectModalId: ready.title } })
      );
    });

    expect(
      await screen.findByRole('dialog', { name: ready.title }, { timeout: 20_000 })
    ).toBeTruthy();
    // 활성 이름도 복구된 모달과 맞아야 한다
    expect(
      document.querySelector('[aria-selected="true"]')!.getAttribute('data-name')
    ).toBe(String(readyIndex));
  });

  it('popstate로 무효한 projectModalId가 오면 열려 있던 모달을 닫는다', async () => {
    renderSection();
    fireEvent.click(document.querySelector('[data-name="0"]')!);
    expect(await screen.findByRole('dialog', {}, { timeout: 20_000 })).toBeTruthy();

    act(() => {
      window.history.replaceState({}, '', '#projects');
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('클릭으로 연 모달을 닫으면 history.back을 부르고 replaceState는 부르지 않는다', async () => {
    renderSection();
    fireEvent.click(document.querySelector('[data-name="0"]')!);
    const closeButton = await screen.findByRole(
      'button',
      { name: '닫기' },
      { timeout: 20_000 }
    );
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const replace = vi.spyOn(window.history, 'replaceState');

    fireEvent.click(closeButton);

    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('새로고침으로 복구된 모달을 닫으면 history.back이 아니라 replaceState로 키만 지운다 — 페이지 이탈 방지', async () => {
    const ready = projects.find((p) => isProjectModalReady(p))!;
    window.history.replaceState(
      { projectModalId: ready.title, __NA: 'next가 쓰는 필드' },
      '',
      '#projects'
    );
    renderSection();
    const closeButton = await screen.findByRole(
      'button',
      { name: '닫기' },
      { timeout: 20_000 }
    );
    expect(screen.getByRole('dialog', { name: ready.title })).toBeTruthy();

    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const replace = vi.spyOn(window.history, 'replaceState');

    fireEvent.click(closeButton);

    // 뮤테이션: closeModal이 push 여부와 무관하게 항상 history.back을 부르면
    // 여기서 back이 불려 FAIL한다 — 새로고침으로 들어온 항목 앞에는 우리
    // 사이트가 아닌 페이지가 있을 수 있다
    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
    const state = replace.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(state.projectModalId).toBeUndefined();
    expect(state.__NA).toBe('next가 쓰는 필드');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
