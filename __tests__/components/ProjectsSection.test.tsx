import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ProjectsSection from '@/components/sections/ProjectsSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { projects } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import type { NavId } from '@/hooks/useSectionNav';

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
  it('덱을 접고 카드 1장만 세운다', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    renderSection();
    expect(document.querySelectorAll('[data-slot]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-band]')).toHaveLength(0);
  });

  it('Compact에서도 인덱스 행은 같은 컴포넌트를 그대로 쓴다', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    renderSection();
    const row = document.querySelector('[data-part="index"]')!;
    expect(row.getAttribute('role')).toBe('tablist');
    expect(row.querySelectorAll('[role="tab"]')).toHaveLength(N);
  });

  it('Compact에서 원근을 걸지 않는다', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1366 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    renderSection();
    const deck = document.querySelector<HTMLElement>('[data-part="deck"]')!;
    expect(deck.style.perspective).toBe('');
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
