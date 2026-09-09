import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ProjectsSection from '@/components/sections/ProjectsSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { projects } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import type { NavId } from '@/hooks/useSectionNav';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isProjectModalReady } from '@/lib/utils/projectContract';
import { contrastRatio, relativeLuminance } from '@/lib/utils/contrast';
import { gsap, SITE_EASE_CUBIC } from '@/lib/gsap';

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
  // jsdom에는 play/pause가 없다. 이름을 훑는 테스트는 영상 있는 프로젝트를
  // 지나가므로 여기서 한 번 막아 둔다
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
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

  it('프리뷰가 열 폭의 0.8배 16:9다', () => {
    renderSection();
    const preview = document.querySelector('[data-part="preview"]')!;
    expect(preview.className).toContain('w-[80%]');
    expect(preview.className).toContain('aspect-video');
  });

  it('이름이 프로젝트 수만큼 있고 전부 role=tab이다', () => {
    renderSection();
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(N);
  });

  it('활성 이름은 text-t3 lg:text-t2이고 비활성 이름은 MUTED 밝기다', () => {
    renderSection();
    const active = document.querySelector<HTMLElement>('[aria-selected="true"]')!;
    expect(active.className).toContain('text-t3');
    expect(active.className).toContain('lg:text-t2');
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
    for (const token of ['text-t3', 'lg:text-t2', 'font-bold', 'tracking-[-0.02em]']) {
      expect(titleAttrs).toContain(token);
      expect(name.className).toContain(token);
    }
    // 제목이 안 쓰는 것은 이름도 안 쓴다. text-t1은 크기가 어긋나고
    // leading-[1.35]는 text-t2 유틸리티가 넣는 줄높이를 덮는다
    expect(titleAttrs).not.toContain('text-t1');
    expect(name.className).not.toContain('text-t1');
    // text-t4는 이 저장소에서 금지된 칸이다
    expect(titleAttrs).not.toContain('text-t4');
    expect(name.className).not.toContain('text-t4');
    expect(name.className).not.toContain('leading-[1.35]');
    // truncate는 좁은 머리띠에서 제목이 버튼을 밀지 않게 하는 배치 장치다.
    // 밀어낼 버튼이 없는 이름 목록에는 오지 않는다
    expect(name.className).not.toContain('truncate');

    // 좁은 화면(lg 미만)에서도 두 노드의 글자 크기가 같아야, FLIP 비행이
    // 데스크톱 폭에서만 도는데도 첫 프레임 scaleX가 배율로 부풀지 않는다.
    // 손으로 두 토큰만 대조하면 한쪽이 세 번째 크기 토큰을 몰래 더 가져도
    // 못 잡으므로, 두 클래스 문자열에서 뽑은 text-* 토큰 집합 자체를 비교한다
    const extractTextSizeTokens = (classAttr: string) =>
      new Set(
        (classAttr.match(/(?:^|\s)(lg:)?text-t\d\b/g) ?? []).map((t) => t.trim())
      );
    const titleTokens = extractTextSizeTokens(titleAttrs);
    const nameTokens = extractTextSizeTokens(name.className);
    expect(titleTokens).toEqual(nameTokens);
    expect(titleTokens).toEqual(new Set(['text-t3', 'lg:text-t2']));
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

// ---------------------------------------------------------------------------
// 계획 5 T2 Task D. 접힘 Projects 조형·상호작용 개편의 계약을 고정한다.
// jsdom에는 레이아웃 엔진도 CSS 엔진도 없다. 그래서 픽셀과 실제 칠은 크롬
// 실측이 맡고, 여기서는 그 픽셀을 만들어 내는 구조와 값만 잠근다.
// ---------------------------------------------------------------------------

function classList(el: Element): string[] {
  return el.className.toString().split(/\s+/).filter(Boolean);
}

const TOKENS_CSS = readFileSync(
  resolve(process.cwd(), 'styles/design-tokens.css'),
  'utf8'
);

// 이 저장소가 직접 연 모서리 토큰들. 목록을 손으로 적지 않고 정본에서
// 읽는다 - 토큰 이름이 바뀌어도 이 판정은 따라간다
const RADIUS_TOKEN_CLASSES = Array.from(
  TOKENS_CSS.matchAll(/--radius-([a-z0-9-]+)\s*:/g)
).map((m) => `rounded-${m[1]}`);

function typeRamp(el: Element): number {
  const hit = classList(el).find((c) => /^text-t\d$/.test(c));
  expect(hit).toBeDefined();
  return Number(hit!.slice(-1));
}

describe('ProjectsSection 이름 목록 세로 간격', () => {
  // 이 작업이 존재하는 이유 그 자체다. 줄 사이를 목록의 gap으로 벌리면
  // 벌어진 만큼이 아무 것도 안 받는 죽은 띠가 되고, 목록을 세로로 훑을 때
  // 활성 표시가 그 띠마다 끊긴다. 간격은 과녁 안에 있어야 한다
  it('줄 간격을 목록의 gap이 아니라 단추 자신의 세로 여백이 먹는다', () => {
    renderSection();
    const list = document.querySelector<HTMLElement>('[data-part="index"]')!;
    // 값을 열거하지 않고 부류로 본다. gap-4든 gap-y-[13px]든 lg:gap-6이든
    // 똑같이 걸린다
    const deadBand = classList(list).filter((c) =>
      /^(?:[a-z]+:)?(?:gap|gap-y|space-y)-/.test(c)
    );
    expect(deadBand).toEqual([]);

    const names = Array.from(document.querySelectorAll<HTMLElement>('[data-name]'));
    expect(names).toHaveLength(N);
    for (const name of names) {
      const pad = classList(name).filter((c) => /^(?:py|pt|pb)-/.test(c));
      // 반대 방향: 단추가 세로 여백을 하나도 안 가지면 줄이 붙어 버린다
      expect(pad.length).toBeGreaterThan(0);
    }
  });
});

describe('ProjectsSection 미디어 모서리', () => {
  // 비행의 두 끝이 같은 반경을 쓰는지가 계약이다. 한쪽만 고치면 날아가는
  // 동안 모서리가 튄다. 그래서 상수를 양쪽에 손으로 적어 두고 비교하지
  // 않는다 - 접힘 쪽 DOM에서 읽어 낸 값으로 펼침 쪽 소스에 묻는다
  function roundedInPreview(): HTMLElement[] {
    const preview = document.querySelector<HTMLElement>('[data-part="preview"]')!;
    return Array.from(preview.querySelectorAll<HTMLElement>('*')).filter((el) =>
      classList(el).some((c) => RADIUS_TOKEN_CLASSES.includes(c))
    );
  }

  it('프리뷰를 자르는 상자와 상세 판 무대가 같은 모서리 토큰을 쓴다', () => {
    expect(RADIUS_TOKEN_CLASSES.length).toBeGreaterThan(0);
    renderSection();
    const rounded = roundedInPreview();
    expect(rounded).toHaveLength(1);

    // object-cover 영상은 상자를 넘쳐 흐른다. 반경과 자르기가 같은 요소에
    // 있지 않으면 모서리는 하나도 안 깎인다
    expect(classList(rounded[0])).toContain('overflow-hidden');

    const token = classList(rounded[0]).find((c) => RADIUS_TOKEN_CLASSES.includes(c))!;
    const modalSource = readFileSync(
      resolve(process.cwd(), 'components/blocks/ProjectModal/index.tsx'),
      'utf8'
    );
    // 이 표식은 좁은 화면 CSS 문자열에도 나온다. JSX 속성 자리(한 줄을
    // 통째로 차지하는 것)만 집는다
    const fromStage = modalSource.slice(
      modalSource.search(/\n\s*data-modal-part="stage"\s*\n/)
    );
    const stageClass = fromStage.match(/className="([^"]*)"/)![1];
    expect(stageClass.split(/\s+/)).toContain(token);
    // 무대도 자기 자리에서 잘라야 한다. collectClippedAncestors가 무대의
    // 부모부터 걷어내므로 이 자르기는 비행 중에도 살아남는다
    expect(stageClass.split(/\s+/)).toContain('overflow-hidden');
  });

  // 토큰이 정의돼 있지 않으면 Tailwind는 그 유틸리티를 아예 안 만든다.
  // 클래스 이름만 맞고 반경은 0인 상태가 조용히 통과하는 것을 막는다
  it('쓰는 모서리 토큰이 정본에 실제 값으로 정의돼 있다', () => {
    renderSection();
    const el = roundedInPreview()[0];
    const token = classList(el).find((c) => RADIUS_TOKEN_CLASSES.includes(c))!;
    const value = TOKENS_CSS.match(
      new RegExp(`--radius-${token.replace('rounded-', '')}\\s*:\\s*([^;]+);`)
    )![1];
    expect(Number.parseFloat(value)).toBeGreaterThan(0);
  });
});

describe('ProjectsSection 프리뷰 캡션', () => {
  function caption() {
    return document.querySelector<HTMLElement>('[data-part="preview-caption"]')!;
  }

  it('영상 위에 제목과 한 줄 설명을 얹고 설명은 project.subtitle에서 온다', () => {
    renderSection();
    for (let i = 0; i < N; i += 1) {
      goToIndex(i);
      const lines = Array.from(caption().querySelectorAll('p'));
      expect(lines[0].textContent).toBe(projects[i].title);
      if (projects[i].subtitle) {
        expect(lines[1].textContent).toBe(projects[i].subtitle);
        // subtitle은 길이도 줄바꿈도 제각각이다(TDS 것에는 리터럴 개행이
        // 들어 있다). 한 줄로 눌러 두는 것이 truncate다 - 이게 없으면
        // 긴 설명이 두 줄로 접혀 캡션이 영상을 덮는다
        expect(classList(lines[1])).toContain('truncate');
      } else {
        expect(lines).toHaveLength(1);
      }
    }
  });

  it('캡션이 흐름 밖에 있어 프로젝트마다 프리뷰 높이가 안 변한다', () => {
    renderSection();
    const preview = document.querySelector<HTMLElement>('[data-part="preview"]')!;
    // 프리뷰 높이는 곧 비행의 출발 좌표다. 여기가 프로젝트마다 흔들리면
    // 어떤 이름에서 열었느냐에 따라 비행이 달라진다. 높이를 못 박는 것은
    // 비율 상자이고, 캡션이 그 안에서 자리를 차지하지 않는 것은 absolute다
    expect(classList(preview)).toContain('aspect-video');
    expect(classList(caption())).toContain('absolute');
    expect(classList(caption())).toContain('bottom-0');
    // 전면 카드로 덮지 않는다. 국소 그라데이션이라 위쪽 영상은 그대로 보인다
    expect(classList(caption())).not.toContain('inset-0');
    expect(caption().style.background).toMatch(/gradient/);
  });

  it('캡션이 이름 목록에 종속돼 읽힌다', () => {
    renderSection();
    const preview = document.querySelector<HTMLElement>('[data-part="preview"]')!;
    // 같은 제목이 화면에 둘이다. 스크린리더에는 이름 목록 쪽만 준다
    expect(preview.getAttribute('aria-hidden')).toBe('true');
    expect(caption().closest('[aria-hidden="true"]')).toBe(preview);

    // 눈으로도 주종이 갈려야 한다. 사다리는 숫자가 클수록 작은 글자다
    const nameRamp = typeRamp(document.querySelector('[data-name="0"]')!);
    const lines = Array.from(caption().querySelectorAll('p'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(typeRamp(line)).toBeGreaterThan(nameRamp);
      // t4는 이 저장소에서 닫아 둔 칸이다
      expect(typeRamp(line)).not.toBe(4);
    }
    expect(nameRamp).not.toBe(4);
  });

  it('미디어가 깨진 자리에는 캡션을 겹치지 않는다', () => {
    renderSection();
    const noVideo = projects.findIndex(
      (p) => !p.implementations?.some((impl) => impl.video)
    );
    goToIndex(noVideo);
    fireEvent.error(document.querySelector('[data-part="preview-image"]')!);
    // 대체 화면이 이미 제목을 크게 쓰고 있다. 캡션까지 남으면 제목이 둘이다
    expect(document.querySelector('[data-part="preview-caption"]')).toBeNull();
  });
});

// 캡션은 남의 앱 화면 녹화 위에 앉는다. 여섯 중 다섯이 밝은 테마라 글자
// 뒤로 순백(255,255,255)이 그대로 온다. jsdom에는 영상도 합성기도 없으니
// 그 최악의 배경을 직접 만들어 판정한다. 여기서 고정하는 계약은 "글자가
// 앉는 구간의 스크림 알파는 한 값으로 평평하고, 그 알파로 순백을 덮은
// 색이 두 캡션 색 각각에 대해 AA를 넘는다"다. 기울기가 글자 구간까지
// 내려오면 어느 줄이 어디 앉느냐에 따라 대비가 달라져 잴 수가 없다
describe('ProjectsSection 캡션 대비', () => {
  const AA = 4.5;

  // 순백에 검정을 알파 a로 얹은 뒤 남는 회색. 대비 공식은 이 저장소의
  // lib/utils/contrast를 그대로 쓴다 - 여기서 다시 짜면 정본과 갈라진다
  function whiteUnderScrim(alpha: number) {
    const channel = Math.round(255 * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
    return `#${channel}${channel}${channel}`;
  }

  function tokenColor(varName: string) {
    const hex = TOKENS_CSS.match(
      new RegExp(`${varName}\\s*:\\s*(#[0-9a-fA-F]{6})`)
    );
    expect(hex).not.toBeNull();
    return hex![1];
  }

  // 소스 상수가 아니라 DOM에 실제로 박힌 값을 읽는다. 그려지는 쪽이 아닌
  // 곳을 보면 상수만 남기고 style을 떼도 테스트가 통과해 버린다
  function scrimStops() {
    const caption = document.querySelector<HTMLElement>(
      '[data-part="preview-caption"]'
    )!;
    const background = caption.style.background;
    // to top이라 0%가 아래(글자 쪽), 100%가 위다
    expect(background).toContain('to top');
    const stops = Array.from(
      background.matchAll(/rgb\(0 0 0 \/ ([\d.]+)\)\s+([\d.]+)%/g)
    ).map((match) => ({ alpha: Number(match[1]), pos: Number(match[2]) }));
    expect(stops.length).toBeGreaterThanOrEqual(3);
    return stops;
  }

  function captionColors() {
    return Array.from(
      document.querySelectorAll<HTMLElement>('[data-part="preview-caption"] p')
    ).map((line) => {
      const found = classList(line).find((cls) =>
        /^text-\[var\(--[a-z-]+\)\]$/.test(cls)
      );
      expect(found).toBeDefined();
      return {
        varName: found!.replace(/^text-\[var\(/, '').replace(/\)\]$/, ''),
        text: line.textContent ?? '',
      };
    });
  }

  it('글자가 앉는 아래쪽 구간의 알파가 한 값으로 평평하다', () => {
    renderSection();
    const stops = scrimStops();

    // 아래에서 위로 갈수록 옅어지고, 위치는 오름차순이다. 중간에 다시
    // 진해지면 글자 뒤에 밝은 띠가 생긴다
    for (let i = 1; i < stops.length; i += 1) {
      expect(stops[i].pos).toBeGreaterThan(stops[i - 1].pos);
      expect(stops[i].alpha).toBeLessThanOrEqual(stops[i - 1].alpha);
    }
    expect(stops[0].pos).toBe(0);
    expect(stops[stops.length - 1].alpha).toBe(0);

    // 첫 두 정지점의 알파가 같아야 그 사이가 평평하다
    expect(stops[1].alpha).toBe(stops[0].alpha);
    // 그 평평한 구간이 상자의 아래 절반을 다 덮어야 글자가 그 안에 든다.
    // 여백(pt-12)만 남기고 기울기가 위쪽에서만 지게 하는 것이 목적이다
    expect(stops[1].pos).toBeGreaterThanOrEqual(50);
  });

  it('평평한 구간의 알파가 순백 위에서 두 캡션 색 모두 AA를 넘긴다', () => {
    renderSection();
    const plateau = scrimStops()[0].alpha;
    const worstBackground = whiteUnderScrim(plateau);

    const lines = captionColors();
    // 제목과 설명 두 줄이 다 있어야 두 색을 다 잰다
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const ratio = contrastRatio(tokenColor(line.varName), worstBackground);
      expect(ratio).toBeGreaterThanOrEqual(AA);
    }
  });

  it('평평한 구간이 없으면 최악의 줄이 AA 밑으로 떨어진다', () => {
    renderSection();
    const stops = scrimStops();
    const plateau = stops[0].alpha;
    const dimmest = captionColors()
      .map((line) => tokenColor(line.varName))
      .reduce((worst, color) =>
        relativeLuminance(color) < relativeLuminance(worst) ? color : worst
      );

    // 이 계약이 진짜 빡빡한지 스스로 확인한다. 알파를 조금만 낮춰도 AA가
    // 깨져야 "평평한 0.78"이 임의로 고른 값이 아니라 하한에 붙은 값이다.
    // 여유가 무한하면 위 테스트는 아무 것도 안 지키고 있는 것이다
    expect(
      contrastRatio(dimmest, whiteUnderScrim(plateau - 0.12))
    ).toBeLessThan(AA);
    // 그렇다고 딱 붙어 있지도 않다. 영상 프레임은 순백보다 어두운 쪽이
    // 대부분이라 한 칸의 여유는 남긴다
    expect(
      contrastRatio(dimmest, whiteUnderScrim(plateau))
    ).toBeGreaterThanOrEqual(AA + 0.5);
  });
});

describe('ProjectsSection 이름 광휘', () => {
  it('이름마다 광휘 겹이 붙고 겹이 베끼는 글자가 진짜 글자와 같다', () => {
    renderSection();
    const names = Array.from(document.querySelectorAll<HTMLElement>('[data-name]'));
    expect(names).toHaveLength(N);
    for (const name of names) {
      const box = name.firstElementChild as HTMLElement;
      expect(classList(box)).toContain('pj-name-glow');
      // 겹은 content: attr()로 이 값을 그린다. 진짜 글자와 어긋나면
      // 번짐이 다른 낱말 모양으로 남는다
      expect(box.getAttribute('data-glow-text')).toBe(box.textContent);
      // 크롬은 가상 요소의 content를 접근성 이름 계산에 섞는다. 사본이 둘
      // 있으니 이름이 세 번 읽힌다 - aria-label로 못 박는다.
      // jsdom은 가상 요소를 안 그리므로 이 위험 자체는 여기서 못 재고,
      // 못 박아 두었다는 사실만 잠근다
      expect(name.getAttribute('aria-label')).toBe(box.textContent);
    }
  });
});

describe('Projects 이름 광휘 정본(design-tokens.css)', () => {
  // 선택자와 본문 쌍을 통째로 긁는다. 규칙 하나가 새로 생겨도 자동으로
  // 판정 대상에 들어온다 - 손으로 적은 목록에서만 새는 것을 막는다
  // 주석을 먼저 걷는다. 안 걷으면 규칙 바로 위에 붙은 설명이 선택자로
  // 딸려 들어와, 주석에 적힌 낱말을 규칙이 쓰는 것으로 잘못 읽는다
  const CSS = TOKENS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const GLOW_RULES = Array.from(
    CSS.matchAll(/([^{}]*pj-name-glow[^{}]*)\{([^}]*)\}/g)
  ).map((m) => ({ selector: m[1].trim(), body: m[2] }));

  function timings(body: string): string[] {
    const decl = body.match(/animation:\s*([^;]+);/)?.[1] ?? '';
    return decl
      .split(/\s+/)
      .filter((t) => /^var\(--animate-duration-[a-z]+\)$/.test(t) || /^\d+m?s$/.test(t));
  }

  function maxBlurPx(body: string): number {
    const shadow = body.match(/text-shadow:\s*([^;]+);/)?.[1] ?? '';
    const blurs = Array.from(shadow.matchAll(/\d+\s+\d+\s+(\d+)px/g)).map((m) =>
      Number(m[1])
    );
    return blurs.length > 0 ? Math.max(...blurs) : -1;
  }

  it('규칙이 존재하고 :hover가 아니라 활성 상태를 따라간다', () => {
    expect(GLOW_RULES.length).toBeGreaterThan(0);
    // 이름은 호버로 프로젝트를 바꾸고, 마우스를 떼도 프리뷰는 그 프로젝트를
    // 계속 보여준다. :hover를 따라가면 어느 이름 이야기인지가 끊긴다.
    // 키보드 포커스 경로도 aria-selected만 옮기므로 :hover로는 아예 안 켜진다
    for (const rule of GLOW_RULES) {
      expect(rule.selector).not.toContain(':hover');
    }
    const lit = GLOW_RULES.filter((r) => /opacity:\s*1/.test(r.body));
    expect(lit.length).toBeGreaterThan(0);
    for (const rule of lit) {
      expect(rule.selector).toContain('aria-selected="true"');
    }
  });

  it('움직이는 것이 opacity 하나뿐이다', () => {
    const names = new Set(
      GLOW_RULES.map((r) => r.body.match(/animation:\s*([a-zA-Z][\w-]*)/)?.[1]).filter(
        (n): n is string => Boolean(n) && n !== 'none'
      )
    );
    expect(names.size).toBeGreaterThan(0);
    for (const name of names) {
      const frames = CSS.match(
        new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\s*\\}\\n`)
      );
      expect(frames).not.toBeNull();
      // 프레임 안에서 건드리는 속성을 전부 뽑아 본다. 목록을 손으로 적지
      // 않으므로 모르는 속성이 들어와도 걸린다 - 번짐 반경을 전환하면
      // 매 프레임 알파를 다시 흐리게 만들어 호버가 끊긴다(Skills 판단)
      const props = Array.from(frames![1].matchAll(/([a-z-]+)\s*:\s*[^;]+;/g)).map(
        (m) => m[1]
      );
      expect(props.length).toBeGreaterThan(0);
      expect(Array.from(new Set(props))).toEqual(['opacity']);
    }
    // transition으로 번짐을 흘리는 우회로도 막는다
    for (const rule of GLOW_RULES) {
      expect(rule.body).not.toContain('transition');
    }
  });

  it('좁은 겹이 먼저 켜지고 넓은 겹이 그 뒤를 이어받는다', () => {
    const shadowRules = GLOW_RULES.filter((r) => maxBlurPx(r.body) >= 0);
    expect(shadowRules).toHaveLength(2);
    const wide = shadowRules.reduce((a, b) =>
      maxBlurPx(a.body) > maxBlurPx(b.body) ? a : b
    );
    const narrow = shadowRules.find((r) => r !== wide)!;
    expect(maxBlurPx(wide.body)).toBeGreaterThan(maxBlurPx(narrow.body));

    // 어느 가상 요소가 넓은 겹인지를 선택자에서 뽑아, 그쪽 애니메이션
    // 규칙을 찾는다. ::before/::after를 손으로 못 박지 않는다
    const pseudo = (sel: string) => (sel.includes('::before') ? '::before' : '::after');
    const animOf = (p: string) =>
      GLOW_RULES.find((r) => r.selector.includes(p) && /animation:/.test(r.body))!;

    const wideAnim = timings(animOf(pseudo(wide.selector)).body);
    const narrowAnim = timings(animOf(pseudo(narrow.selector)).body);
    // 좁은 겹은 바로 켜지고(시간값 하나 = 지속), 넓은 겹은 늦게 따라
    // 붙는다(시간값 둘 = 지속 + 지연). 뒤집으면 번짐이 바깥에서 안으로
    // 오므라들어 읽힌다
    expect(narrowAnim).toHaveLength(1);
    expect(wideAnim).toHaveLength(2);
    // 넓은 겹의 지연은 좁은 겹의 지속과 같다. 끊김 없이 이어받는다
    expect(wideAnim[1]).toBe(narrowAnim[0]);
  });

  it('reduce에서 전환만 죽이고 최종 상태는 남긴다', () => {
    const reduced = CSS.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^{]*pj-name-glow[\s\S]*?\{([^}]*)\}/
    );
    expect(reduced).not.toBeNull();
    expect(reduced![1]).toMatch(/animation:\s*none/);
    // 활성 표시가 통째로 사라지면 어느 이름 이야기인지 알 수 없다
    expect(reduced![1]).not.toMatch(/opacity:\s*0/);
    expect(reduced![1]).not.toMatch(/display:\s*none/);
    expect(reduced![1]).not.toMatch(/visibility:\s*hidden/);
  });

  it('겹이 손잡이 상자를 넓히지 않고 정본 시안만 쓴다', () => {
    const layer = GLOW_RULES.find((r) => /content:\s*attr\(/.test(r.body));
    expect(layer).toBeDefined();
    // 이 span은 상세 판 제목과 짝지어 나는 FLIP 손잡이다. 겹이 흐름에
    // 들어오면 상자가 글자 너비를 벗어나고 비행 첫 프레임이 배율로 부푼다
    expect(layer!.body).toMatch(/position:\s*absolute/);

    for (const rule of GLOW_RULES) {
      // 임의 색을 새로 만들지 않는다. 정본 토큰만 쓴다
      expect(rule.body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(rule.body).not.toMatch(/\brgba?\(/);
      for (const color of rule.body.match(/var\(--color-[a-z-]+\)/g) ?? []) {
        expect(color).toMatch(/^var\(--color-cyan-[a-z]+\)$/);
      }
    }
  });
});

describe('ProjectsSection 프로젝트 전환 모션', () => {
  // 이 모션이 전하는 것 하나: "보고 있는 프로젝트가 바뀌었다".
  // transform과 opacity만 만지는 tween이고, 아무리 빨리 훑어도 이전 것을
  // 죽이고 다음을 태우며, 무엇보다 비행의 출발 기하를 못 건드린다

  // tween 설정 자리의 열쇠들. 여기 없는 열쇠는 전부 "움직이는 속성"으로 본다
  const CONFIG_KEYS = new Set([
    'duration',
    'ease',
    'delay',
    'clearProps',
    'overwrite',
    'immediateRender',
    'paused',
    'onStart',
    'onComplete',
    'stagger',
  ]);
  // transform과 opacity만 허용한다. width·height·filter·boxShadow처럼
  // 배치나 칠을 건드리는 속성이 들어오면 걸린다
  const SAFE_PROPS = [
    'opacity',
    'scale',
    'scaleX',
    'scaleY',
    'x',
    'y',
    'z',
    'xPercent',
    'yPercent',
    'rotate',
    'rotation',
    'transformOrigin',
  ];

  function fakeTween() {
    return { kill: vi.fn() };
  }

  async function renderReady(reduced = false) {
    const view = render(
      <SectionActivityProvider
        active={SECTION_IDS.PROJECTS}
        entryAnimationTarget={null}
        pageVisible
        routeResolved
        motionReady
        reducedMotion={reduced}
      >
        <ProjectsSection />
      </SectionActivityProvider>
    );
    // gsap은 마운트 직후 동적 import로 온다. 흘려보내지 않으면 전환이
    // 조용히 스킵된다
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    return view;
  }

  function layerEl() {
    return document.querySelector<HTMLElement>('[data-part="preview-media"]')!;
  }

  afterEach(() => {
    gsap.globalTimeline.clear();
  });

  it('프로젝트가 갈리면 프리뷰 안쪽 겹에 transform·opacity tween을 태운다', async () => {
    const fromTo = vi
      .spyOn(gsap, 'fromTo')
      .mockImplementation(() => fakeTween() as unknown as gsap.core.Tween);
    await renderReady();
    expect(fromTo).not.toHaveBeenCalled();

    goToIndex(1);
    expect(fromTo).toHaveBeenCalledTimes(1);

    const [target, fromVars, toVars] = fromTo.mock.calls[0] as unknown as [
      HTMLElement,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    const preview = document.querySelector<HTMLElement>('[data-part="preview"]')!;
    // 여기가 이 설계의 핵심이다. Flip.getState는 프리뷰의
    // getBoundingClientRect를 뜨는데, 자손에 걸린 transform은 그 값에 안
    // 섞인다. 그래서 호버로 전환이 시작되자마자 클릭이 와도 비행이 안
    // 비뚤어진다. 프리뷰 자신에 걸면 이 성질이 그대로 사라진다
    expect(target).not.toBe(preview);
    expect(preview.contains(target)).toBe(true);
    expect(target).toBe(layerEl());

    for (const vars of [fromVars, toVars]) {
      for (const key of Object.keys(vars)) {
        if (CONFIG_KEYS.has(key)) continue;
        expect(SAFE_PROPS).toContain(key);
      }
    }
    // 한쪽 방향만 보면 안 된다. 시작과 끝이 실제로 달라야 움직임이다
    expect(fromVars.opacity).not.toBe(toVars.opacity);
    expect(toVars.duration as number).toBeGreaterThan(0);
  });

  it('훑는 속도가 빨라 전환이 겹치면 이전 것을 죽이고 다음을 태운다', async () => {
    const tweens: ReturnType<typeof fakeTween>[] = [];
    vi.spyOn(gsap, 'fromTo').mockImplementation(() => {
      const t = fakeTween();
      tweens.push(t);
      return t as unknown as gsap.core.Tween;
    });
    await renderReady();

    goToIndex(1);
    expect(tweens).toHaveLength(1);
    expect(tweens[0].kill).not.toHaveBeenCalled();

    goToIndex(2);
    expect(tweens).toHaveLength(2);
    // 안 죽이면 두 tween이 같은 겹의 transform을 서로 밀며 튄다
    expect(tweens[0].kill).toHaveBeenCalled();
    expect(tweens[1].kill).not.toHaveBeenCalled();
  });

  it('reduce에서는 tween 없이 즉시 갈린다', async () => {
    const fromTo = vi.spyOn(gsap, 'fromTo');
    await renderReady(true);
    goToIndex(1);
    expect(fromTo).not.toHaveBeenCalled();
    // 죽은 tween이 남긴 인라인 값도 걷혀 있어야 한다. 안 걷으면 opacity 0에
    // 얼어붙은 프리뷰가 남는다
    expect(layerEl().style.transform).toBe('');
    expect(layerEl().style.opacity).toBe('');
  });

  it('같은 프로젝트 안의 다음 장면으로 넘어갈 때는 전환을 안 태운다', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const fromTo = vi
      .spyOn(gsap, 'fromTo')
      .mockImplementation(() => fakeTween() as unknown as gsap.core.Tween);
    await renderReady();

    const many = projects.findIndex(
      (p) => (p.implementations ?? []).filter((i) => i.video).length > 1
    );
    expect(many).toBeGreaterThan(-1);
    goToIndex(many);
    expect(fromTo).toHaveBeenCalledTimes(1);

    // 순환 재생이 src를 갈아 끼운다. 같은 프로젝트 안의 다음 장면이라
    // 상태 전환이 아니다 - 여기에 걸면 3초마다 영원히 꿈틀대는 잔모션이 된다
    fireEvent.ended(document.querySelector('[data-part="preview-video"]')!);
    expect(fromTo).toHaveBeenCalledTimes(1);
  });
});

describe('ProjectsSection 목록 위치 표시', () => {
  function bar() {
    return document.querySelector<HTMLElement>('[data-part="index-progress"]')!;
  }

  function fill(): number {
    const hit = bar().style.transform.match(/scaleX\(([^)]+)\)/);
    expect(hit).not.toBeNull();
    return Number.parseFloat(hit![1]);
  }

  it('머리띠 선의 채움이 목록 위치를 그대로 옮긴다', () => {
    renderSection();
    const row = document.querySelector('[role="tablist"]')!;
    // 첫 항목에서 이미 한 칸 차 있다. 0이면 "아무 것도 안 고름"으로 읽힌다
    expect(fill()).toBeCloseTo(1 / N, 5);
    fireEvent.keyDown(row, { key: 'End' });
    expect(fill()).toBeCloseTo(1, 5);
    goToIndex(2);
    expect(fill()).toBeCloseTo(3 / N, 5);
    fireEvent.keyDown(row, { key: 'Home' });
    expect(fill()).toBeCloseTo(1 / N, 5);
  });

  it('transform만 움직이고 reduce에서는 즉시 뛴다', () => {
    renderSection();
    // 폭이 아니라 배율이다. 폭을 흘리면 매 프레임 배치가 다시 계산된다
    expect(bar().style.transition).toContain('transform');
    expect(bar().style.transition).not.toContain('width');
    expect(classList(bar())).toContain('origin-left');

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
    const bars = document.querySelectorAll<HTMLElement>('[data-part="index-progress"]');
    expect(bars[bars.length - 1].style.transition).toBe('none');
  });

  it('장식이라 스크린리더에 같은 말을 두 번 하지 않는다', () => {
    renderSection();
    // 목록 위치는 role=tab의 aria-selected가 이미 말하고 있다
    expect(bar().closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('ProjectsSection 곡선 정본', () => {
  it('CSS로 적어 둔 이징이 lib/gsap의 정본과 같은 곡선이다', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'components/sections/ProjectsSection/index.tsx'),
      'utf8'
    );
    const literal = source.match(/cubic-bezier\([^)]*\)/)?.[0];
    expect(literal).toBeDefined();
    // 이 파일은 gsap을 정적 import하면 지연 로드가 깨져서 곡선을 문자열로
    // 복제해 둔다. 복제본이 정본에서 떨어져 나가면 CSS 전환과 GSAP 전환이
    // 서로 다른 곡선으로 움직인다
    expect(literal).toBe(SITE_EASE_CUBIC);
  });
});
