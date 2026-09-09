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
  // jsdom 기본은 1024x768이라 Compact로 떨어진다. 덱 경로를 보려면 올려야 한다
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

// 셸의 .section-scroll을 흉내 낸 상자에 담아 그린다. jsdom은 레이아웃을 하지
// 않아 clientHeight가 늘 0이고 선언하지 않은 padding은 빈 문자열로 나오므로,
// 섹션이 상자를 못 재고 초기 기하에 머문다. 그래서 실제 셸이 주는 높이와 아래
// 여백을 직접 심고 resize로 다시 재게 한다.
// boxClientH는 스크롤 컨테이너의 clientHeight다. 섹션이 쓰는 상자는 여기서
// 아래 여백 40을 뺀 값이 된다
const SHELL_PAD_BOTTOM = 40;

function renderInShell(boxClientH: number, active: NavId = SECTION_IDS.PROJECTS) {
  const view = render(
    <div
      className="section-scroll"
      style={{ paddingTop: 0, paddingBottom: SHELL_PAD_BOTTOM }}
    >
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
    </div>
  );
  const box = document.querySelector<HTMLElement>('.section-scroll')!;
  Object.defineProperty(box, 'clientHeight', { configurable: true, value: boxClientH });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
  return view;
}

const N = projects.length;

describe('ProjectsSection 슬롯 계약', () => {
  it('프로젝트가 몇 개든 카드는 4장이다', () => {
    renderSection();
    expect(document.querySelectorAll('[data-slot]')).toHaveLength(Math.min(4, N));
  });

  it('슬롯 k가 projects[(active + k) % N]을 가리킨다', () => {
    renderSection();
    for (let k = 0; k < Math.min(4, N); k += 1) {
      const card = document.querySelector(`[data-slot="${k}"]`)!;
      expect(card.getAttribute('data-global-index')).toBe(String(k % N));
    }
  });

  it('k=0만 본문을 갖는다. 뒤 카드는 헤더 바뿐이다', () => {
    renderSection();
    expect(
      document.querySelector('[data-slot="0"] [data-part="preview"]')
    ).not.toBeNull();
    for (const k of [1, 2, 3]) {
      expect(
        document.querySelector(`[data-slot="${k}"] [data-part="preview"]`)
      ).toBeNull();
      expect(
        document.querySelector(`[data-slot="${k}"] [data-part="header"]`)
      ).not.toBeNull();
    }
  });

  it('두께 밴드가 N-4장을 헤어라인으로 압축한다', () => {
    renderSection();
    // N=6이면 2줄이다. 밴드는 "많다"를 말하고 정확한 수는 인덱스 행이 맡는다
    expect(document.querySelectorAll('[data-band]')).toHaveLength(
      N > 4 ? Math.min(N - 4, 6) : 0
    );
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

  it('메타 첫 줄은 접히지 않고 말줄임으로 끊는다', () => {
    // 390x844에서 카드 폭이 310이 되면 이 줄이 두 줄로 접힌다. 메타 띠 높이는
    // 기하가 정한 값으로 고정이고 카드는 넘침을 감추므로, 접히는 만큼 아래
    // 태그 칩이 카드 밖으로 밀려 잘린다. 실측으로 3px 넘쳤다.
    // jsdom에는 레이아웃 엔진이 없어 줄바꿈도 넘침도 잴 수 없다. 그래서 결과
    // 대신 한 줄로 묶는 유틸리티 클래스가 붙어 있는지를 잠근다
    renderSection();
    const meta = document.querySelector('[data-part="meta"]')!;
    expect(meta.firstElementChild!.className).toContain('truncate');
  });

  it('카드가 세로 flex를 유지한다', () => {
    renderSection();
    // jsdom에는 레이아웃 엔진이 없어 프리뷰가 실제로 무너지는 것을 못 본다.
    // 카드가 <button>이라 items-stretch가 빠지면 프리뷰가 405px 자리에서
    // 17px이 되는데, 시안에서 실제로 밟았고 스크린샷을 봐야 드러났다.
    // 그래서 결과 대신 클래스 자체를 잠근다
    const card = document.querySelector('[data-slot="0"]')!;
    expect(card.className).toContain('flex-col');
    expect(card.className).toContain('items-stretch');
  });
});

describe('ProjectsSection Compact', () => {
  // Compact 판정은 마운트 뒤 measure가 window를 읽어야 나온다. 상자를 못 재면
  // 섹션은 초기 기하(1440x900)에 머물러 덱으로 그려지므로 셸에 담아 그린다.
  // 768과 844에서 셸이 세로로 117을 먹고 남는 값이 651, 727이다
  it('덱을 접고 카드 1장만 세운다', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    renderInShell(651);
    expect(document.querySelectorAll('[data-slot]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-band]')).toHaveLength(0);
  });

  it('Compact에서도 인덱스 행은 같은 컴포넌트를 그대로 쓴다', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    renderInShell(727);
    const row = document.querySelector('[data-part="index"]')!;
    expect(row.getAttribute('role')).toBe('tablist');
    expect(row.querySelectorAll('[role="tab"]')).toHaveLength(N);
  });

  it('Compact에서 원근을 걸지 않는다', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    renderInShell(651);
    const deck = document.querySelector<HTMLElement>('[data-part="deck"]')!;
    expect(deck.style.perspective).toBe('');
  });
});

describe('ProjectsSection 셸이 준 상자', () => {
  function deckBox() {
    const deck = document.querySelector<HTMLElement>('[data-part="deck"]')!;
    return { w: deck.style.width, h: deck.style.height };
  }

  it('뷰포트가 아니라 스크롤 컨테이너 상자로 카드를 잡는다', () => {
    // 1440x900에서 셸이 내주는 clientHeight가 783, 아래 여백 40을 빼면 743이다.
    // 그 상자로 재면 640x468이고, 뷰포트 900을 그대로 넣으면 800x558이 된다.
    // 후자는 인덱스 행이 고정 푸터 밑으로 깔리던 그 값이다
    renderInShell(783);
    expect(deckBox()).toEqual({ w: '640px', h: '468px' });
  });

  it('상자가 줄면 카드도 같이 준다', () => {
    // 한 지점만 잠그면 상수를 박아 넣어도 통과한다. 상자를 바꿔 따라오는지 본다.
    // 1280x800 상자 643 -> cardH 368, cardW 4160/9 = 462.2 -> 반올림 462
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    renderInShell(683);
    expect(deckBox()).toEqual({ w: '462px', h: '368px' });
  });

  it('상자를 못 재면 초기 기하를 그대로 둔다', () => {
    // 셸 없이 그리면(다른 테스트 대부분이 이 경로다) measure가 빠져나가고
    // SSR용 초기값 1440x900 상자 743이 남는다. 0이나 NaN으로 계산하지 않는다
    renderSection();
    expect(deckBox()).toEqual({ w: '640px', h: '468px' });
  });

  it('섹션의 세로 여백이 기하가 예산에 잡은 값과 같다', () => {
    // 기하는 위아래 24씩을 예산에서 뺀다. 실제 CSS가 그보다 크면 그 차이만큼
    // 아래로 밀려 푸터에 먹힌다. 두 숫자는 반드시 붙어 다녀야 한다
    renderInShell(783);
    const section = document.getElementById(SECTION_IDS.PROJECTS)!;
    expect(section.className).toContain('py-6');
    expect(section.className).toContain('px-10');
  });
});

describe('ProjectsSection 인덱스 행', () => {
  it('칩이 프로젝트 수만큼 있고 tablist다', () => {
    renderSection();
    const row = document.querySelector('[data-part="index"]')!;
    expect(row.getAttribute('role')).toBe('tablist');
    expect(row.querySelectorAll('[role="tab"]')).toHaveLength(N);
  });

  it('탭 정지점이 N과 무관하게 2개다', () => {
    renderSection();
    // 앞 카드 버튼 1개 + 활성 칩 1개. 나머지 칩은 -1이다
    const stops = Array.from(
      document.querySelectorAll<HTMLElement>('button, [tabindex]')
    ).filter((el) => el.tabIndex === 0 && !el.hasAttribute('disabled'));
    expect(stops).toHaveLength(2);

    const chips = document.querySelectorAll<HTMLElement>('[data-chip]');
    expect(Array.from(chips).filter((c) => c.tabIndex === 0)).toHaveLength(1);
  });

  it('ArrowRight가 끝에서 처음으로 감긴다', () => {
    renderSection();
    const row = document.querySelector('[data-part="index"]')!;
    for (let i = 0; i < N; i += 1) fireEvent.keyDown(row, { key: 'ArrowRight' });
    // N번 누르면 제자리다. 순환이 안 되면 마지막에 멈춘다
    expect(
      document.querySelector('[data-slot="0"]')!.getAttribute('data-global-index')
    ).toBe('0');
  });

  it('ArrowLeft가 처음에서 끝으로 감긴다', () => {
    renderSection();
    const row = document.querySelector('[data-part="index"]')!;
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    expect(
      document.querySelector('[data-slot="0"]')!.getAttribute('data-global-index')
    ).toBe(String(N - 1));
  });

  it('Home은 0으로, End는 N-1로 간다', () => {
    renderSection();
    const row = document.querySelector('[data-part="index"]')!;
    fireEvent.keyDown(row, { key: 'End' });
    expect(
      document.querySelector('[data-slot="0"]')!.getAttribute('data-global-index')
    ).toBe(String(N - 1));
    fireEvent.keyDown(row, { key: 'Home' });
    expect(
      document.querySelector('[data-slot="0"]')!.getAttribute('data-global-index')
    ).toBe('0');
  });

  it('active가 N-1일 때 슬롯이 순환한다', () => {
    // 덱의 핵심 로직이고 경계에서만 틀린다
    renderSection();
    fireEvent.keyDown(document.querySelector('[data-part="index"]')!, { key: 'End' });
    for (let k = 0; k < Math.min(4, N); k += 1) {
      const card = document.querySelector(`[data-slot="${k}"]`)!;
      expect(card.getAttribute('data-global-index')).toBe(String((N - 1 + k) % N));
    }
  });

  it('활성 칩만 aria-selected가 true다', () => {
    renderSection();
    const selected = document.querySelectorAll('[data-chip][aria-selected="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute('data-chip')).toBe('0');
  });

  it('뒤 카드를 누르면 그 카드로 이동하고 모달은 안 열린다', () => {
    // 포인터 편의일 뿐이다. 키보드는 인덱스 행이 전부 커버한다
    renderSection();
    fireEvent.click(document.querySelector('[data-slot="2"]')!);
    expect(
      document.querySelector('[data-slot="0"]')!.getAttribute('data-global-index')
    ).toBe('2');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('뒤 카드는 탭 정지점이 아니다', () => {
    renderSection();
    for (const k of [1, 2, 3]) {
      const card = document.querySelector<HTMLElement>(`[data-slot="${k}"]`)!;
      expect(card.tabIndex).toBe(-1);
    }
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

  it('영상이 있는 카드가 활성이면 첫 구현 기능 영상을 건다', () => {
    renderSection();
    goToIndex(withVideo);
    const video = document.querySelector<HTMLVideoElement>('[data-part="preview-video"]')!;
    expect(video.getAttribute('src')).toBe(
      projects[withVideo].implementations!.filter((i) => i.video)[0].video
    );
    // 카드 전체가 모달을 여는 단일 버튼이다. 영상이 클릭을 가로채면 안 된다
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

  it('카드가 바뀌면 src를 놓고 순환 인덱스가 0으로 되돌아온다', () => {
    renderSection();
    goToIndex(withVideo);
    act(() => {
      vi.advanceTimersByTime(CYCLE_MS);
    });
    goToIndex(withVideo);   // 한 바퀴 돌아 같은 카드로 되돌아온다
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

// 인덱스 칩을 눌러 그 프로젝트로 간다
function goToIndex(i: number) {
  fireEvent.click(document.querySelector(`[data-chip="${i}"]`)!);
}

// ProjectModal은 next/dynamic({ssr:false})로 실제 import()를 거쳐 로드된다
// (HomeClient.test.tsx의 findByRole(..., {timeout: 20_000}) 관례와 같은 이유).
// 이 describe 안의 클릭·popstate 시나리오는 dialog가 실제로 그려지길 기다려야
// 하므로 findByRole/waitFor로 기다린다 — getByRole 동기 단정은 청크 로드 전에
// 거짓 실패한다
describe('ProjectsSection modal-only History', { timeout: 30_000 }, () => {
  it('모달을 열면 projectModalId를 pushState한다', () => {
    const push = vi.spyOn(window.history, 'pushState');
    renderSection();
    fireEvent.click(document.querySelector('[data-slot="0"]')!);
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

  it('계약 미달 프로젝트의 카드는 탭 정지점을 만들지 않는다', () => {
    const unready = projects.findIndex((p) => !isProjectModalReady(p));
    if (unready === -1) return;
    renderSection();
    goToIndex(unready);
    const front = document.querySelector('[data-slot="0"]')!;
    expect(front.tagName).toBe('DIV');
  });

  // 계획서 테스트 네 개는 위까지다. 아래는 함정 하나(복구된 모달을 History.back()으로
  // 닫으면 우리 사이트 밖으로 나갈 수 있다)와 mount·popstate가 정말 하나의
  // 함수를 공유하는지, 그리고 pushState가 기존 state를 날리지 않는지를
  // 추가로 고정한다. 계획서에는 없지만 이 계약을 지키는 테스트가 없으면
  // 위 네 개만으로는 회귀를 못 잡는다.

  it('모달을 열 때 기존 history.state 필드를 펼쳐 담는다', () => {
    window.history.replaceState({ __NA: 'next가 쓰는 필드' }, '', '#projects');
    const push = vi.spyOn(window.history, 'pushState');
    renderSection();
    fireEvent.click(document.querySelector('[data-slot="0"]')!);
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
    // activeIndex도 복구된 모달과 맞아야 한다 — 슬롯0이 그 프로젝트를 가리킨다
    expect(
      document.querySelector('[data-slot="0"]')!.getAttribute('data-global-index')
    ).toBe(String(readyIndex));
  });

  it('popstate로 무효한 projectModalId가 오면 열려 있던 모달을 닫는다', async () => {
    renderSection();
    fireEvent.click(document.querySelector('[data-slot="0"]')!);
    expect(await screen.findByRole('dialog', {}, { timeout: 20_000 })).toBeTruthy();

    act(() => {
      window.history.replaceState({}, '', '#projects');
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('클릭으로 연 모달을 닫으면 history.back을 부르고 replaceState는 부르지 않는다', async () => {
    renderSection();
    fireEvent.click(document.querySelector('[data-slot="0"]')!);
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
