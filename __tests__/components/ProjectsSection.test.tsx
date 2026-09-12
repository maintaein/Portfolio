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
import { gsap } from '@/lib/gsap';


// 셰이더 모프는 WebGL이 있어야 하고 jsdom에는 없다. 이 파일이 잠그는 것은
// 픽셀이 아니라 배선이다. 모프가 참을 돌려줄 때와 거짓을 돌려줄 때 두 방향
// 모두에서 프리뷰 전환 계약이 지켜지는가. 그래서 모듈 경계에서 가짜로 바꾸고
// 반환값을 테스트가 정한다. 기본값은 거짓이라 이 파일의 나머지 테스트는
// 지금까지와 같은 폴백 경로를 그대로 본다
const { morphState } = vi.hoisted(() => ({
  morphState: {
    result: false,
    // morph를 부른 시점에 넘어온 출발 엘리먼트의 상태를 그 자리에서 뜬다.
    // 나중에 읽으면 이미 새 프로젝트로 갈려 있어 아무것도 증명하지 못한다
    calls: [] as Array<{ tag: string | null; poster: string | null; to: string }>,
  },
}));

vi.mock('@/components/blocks/PreviewMorph', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  const FakePreviewMorph = forwardRef<
    { morph: (el: HTMLVideoElement | HTMLImageElement | null, to: string) => boolean },
    { className?: string }
  >(function FakePreviewMorph({ className }, ref) {
    useImperativeHandle(
      ref,
      () => ({
        morph(fromEl, toImageSrc) {
          morphState.calls.push({
            tag: fromEl?.tagName ?? null,
            poster: fromEl?.getAttribute('poster') ?? fromEl?.getAttribute('src') ?? null,
            to: toImageSrc,
          });
          return morphState.result;
        },
      }),
      []
    );
    return <canvas data-part="preview-morph" className={className} />;
  });
  return { default: FakePreviewMorph };
});

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false, media: '', addEventListener: () => {}, removeEventListener: () => {},
    })
  );
  morphState.result = false;
  morphState.calls.length = 0;
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

  it('활성 이름은 text-t1 lg:text-d3이고 비활성 이름은 MUTED 밝기다', () => {
    renderSection();
    const active = document.querySelector<HTMLElement>('[aria-selected="true"]')!;
    expect(active.className).toContain('text-t1');
    expect(active.className).toContain('lg:text-d3');
    const inactive = document.querySelector<HTMLElement>('[aria-selected="false"]')!;
    // 휠이 --pj-wheel-p로 활성색을 섞어 넣지만 비활성은 그 비율이 0이라 색은
    // 여전히 MUTED다. 기본값 0이 식 안에 박혀 있어야 휠이 아직 한 프레임도
    // 안 돈 첫 그림에서도 이 밝기 계약이 지켜진다
    expect(inactive.style.color).toContain('rgb(255 255 255 / 0.62)');
    expect(inactive.style.color).toContain('var(--pj-wheel-p, 0)');
  });

  // 이름은 상세 판 제목과 더 이상 같은 크기 토큰을 쓰지 않는다. 이름은
  // 이번 작업으로 text-t1/lg:text-d3로 두 배 가까이 커졌고, 제목(pm-title)은
  // ProjectModal 소스라 이 작업의 범위 밖이라 손대지 않는다. 그래서 FLIP
  // 비행 첫 프레임이 이제 배율로 살짝 부푼다. 알려진 대가이고, task-M 범위
  // 밖의 후속 작업 몫이다. 여기서는 두 파일이 여전히 공유하는 서체 표현
  // (굵기·자간·금지 칸)만 잠그고, 크기 토큰은 이름 쪽 자기 계약만 본다
  it('이름 글자 표현이 상세 판 제목과 굵기·자간을 공유하고 금지 칸을 안 쓴다', async () => {
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
    for (const token of ['font-bold', 'tracking-[-0.02em]']) {
      expect(titleAttrs).toContain(token);
      expect(name.className).toContain(token);
    }
    // text-t4는 이 저장소에서 금지된 칸이다
    expect(titleAttrs).not.toContain('text-t4');
    expect(name.className).not.toContain('text-t4');
    expect(name.className).not.toContain('leading-[1.35]');
    // 착지 직후 제목이 세로로 튀지 않으려면 줄 높이 비율도 같아야 한다.
    // 이름 쪽은 d3 토큰(line-height)이 주고 제목 쪽은 클래스가 주므로,
    // 정본에서 읽은 숫자와 제목 클래스에 박힌 숫자를 맞대어 본다
    const d3LineHeight = TOKENS_CSS.match(/--line-height-d3:\s*([\d.]+)/)![1];
    expect(titleAttrs).toContain(`leading-[${d3LineHeight}]`);
    // lg 이상에서는 lg:text-t2가 line-height도 같이 정하는 유틸리티라
    // 변형 없는 leading-[1.1]을 CSS 소스 순서에서 뒤집는다(lg:text-t2가
    // Tailwind 출력에서 leading-[1.1]보다 뒤에 온다). lg: 변형이 붙은
    // leading 유틸리티로 그 lg 블록 안에서도 이겨야 한다
    expect(titleAttrs).toContain(`lg:leading-[${d3LineHeight}]`);
    // truncate는 좁은 머리띠에서 제목이 버튼을 밀지 않게 하는 배치 장치다.
    // 밀어낼 버튼이 없는 이름 목록에는 오지 않는다
    expect(name.className).not.toContain('truncate');

    // 이름 자신의 크기 계약: text-t1/lg:text-d3 정확히 그 둘뿐이다
    const extractTextSizeTokens = (classAttr: string) =>
      new Set(
        (classAttr.match(/(?:^|\s)(lg:)?text-[td]\d\b/g) ?? []).map((t) => t.trim())
      );
    const nameTokens = extractTextSizeTokens(name.className);
    expect(nameTokens).toEqual(new Set(['text-t1', 'lg:text-d3']));
  });

  it('첫 클릭이 프리뷰를 그 프로젝트로 갈아 끼운다', () => {
    renderSection();
    fireEvent.click(document.querySelector('[data-name="1"]')!);
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
  // 이름 쪽 구르는 tabindex는 N과 무관하게 언제나 1개다. 프리뷰 과녁 단추가
  // 새로 정지점 하나를 더하지만, 그것은 활성 프로젝트가 계약을 통과했을
  // 때만이다. disabled 단추는 이 필터(hasAttribute('disabled'))에서 빠진다
  it('탭 정지점이 N과 무관하게 이름 1개다, 프리뷰는 계약 통과일 때만 하나 더한다', () => {
    renderSection();
    const stops = Array.from(
      document.querySelectorAll<HTMLElement>('button, [tabindex]')
    ).filter((el) => el.tabIndex === 0 && !el.hasAttribute('disabled'));
    const nameStops = stops.filter((el) => el.hasAttribute('data-name'));
    expect(nameStops).toHaveLength(1);
    const otherStops = stops.filter((el) => !el.hasAttribute('data-name'));
    expect(otherStops).toHaveLength(isProjectModalReady(projects[0]) ? 1 : 0);

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

describe('ProjectsSection 프리뷰 미디어', () => {
  it('영상을 가진 프로젝트여도 프리뷰에는 그림만 놓는다', () => {
    // 영상은 상세 판에서만 튼다. 섹션 프리뷰는 어느 프로젝트든 그림 한 장이다.
    // 영상을 섹션 프리뷰로 되돌리면 이 어서션이 FAIL해야 한다
    const withVideo = projects.findIndex((p) =>
      p.implementations?.some((impl) => impl.video)
    );
    expect(withVideo).toBeGreaterThan(-1);

    renderSection();
    goToIndex(withVideo);

    expect(document.querySelector('[data-part="preview-video"]')).toBeNull();
    const img = document.querySelector('[data-part="preview-image"]')!;
    expect(img.getAttribute('src')).toContain(
      projects[withVideo].image.split('/').pop()
    );
  });

  it('그림 아래쪽 어둠 띠 안에 글자 묶음이 따로 들어 있다', () => {
    // 띠는 전환과 무관하게 늘 있다. 상세에서 돌아올 때 띠와 글자가 같이
    // 왼쪽부터 열리는데, 띠는 clip으로 열고 글자만 민다. 띠까지 같이 밀면
    // 민 폭만큼 오른쪽 끝이 안 어두운 채로 남기 때문이다
    renderSection();
    const caption = document.querySelector<HTMLElement>(
      '[data-part="preview-caption"]'
    )!;
    const text = caption.querySelector<HTMLElement>(
      '[data-part="preview-caption-text"]'
    );
    expect(text).not.toBeNull();
    // 글자가 한 줄도 밖에 남으면 안 된다. 남은 줄은 안 움직여 따로 논다
    expect(caption.querySelectorAll('p')).toHaveLength(
      text!.querySelectorAll('p').length
    );

    // 그림보다 뒤 = 그림 위에 깔린다
    const img = document.querySelector('[data-part="preview-image"]')!;
    expect(
      img.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

// 이름을 클릭해 그 프로젝트로 간다. 포커스는 이제 선택을 안 옮기므로
// click을 써야 한다. 다만 이미 활성인 인덱스를 그대로 다시 클릭하면
// 두 번째 클릭이 되어 계약을 채운 프로젝트에서 모달이 열려 버린다.
// 이 헬퍼는 "선택만 옮긴다"는 계약을 대신하는 자리이니, 이미 활성이면
// 아무것도 안 하고 돌아간다
function goToIndex(i: number) {
  const el = document.querySelector(`[data-name="${i}"]`)!;
  if (el.getAttribute('aria-selected') === 'true') return;
  fireEvent.click(el);
}

// ProjectModal은 next/dynamic({ssr:false})로 실제 import()를 거쳐 로드된다
// (HomeClient.test.tsx의 findByRole(..., {timeout: 20_000}) 관례와 같은 이유).
// 이 describe 안의 클릭·popstate 시나리오는 dialog가 실제로 그려지길 기다려야
// 하므로 findByRole/waitFor로 기다린다. getByRole 동기 단정은 청크 로드 전에
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

  it('계약 미달 이름은 두 번 눌러도 안 펼쳐진다', () => {
    const unready = projects.findIndex((p) => !isProjectModalReady(p));
    if (unready === -1) return;
    const push = vi.spyOn(window.history, 'pushState');
    renderSection();
    const target = document.querySelector(`[data-name="${unready}"]`)!;
    // 첫 클릭은 선택만 옮긴다(두 클릭 계약). 계약 게이트만 따로 보려면 이미
    // 활성인 상태에서 다시 눌러야 한다. 한 번만 누르면 "아직 선택 전이라
    // 안 열렸다"와 "계약이 막아서 안 열렸다"가 구분이 안 된다
    fireEvent.click(target);
    fireEvent.click(target);
    expect(
      document.querySelector('[aria-selected="true"]')!.getAttribute('data-name')
    ).toBe(String(unready));
    // 뮤테이션: handleNameClick이 계약을 안 보고 항상 openModal을 부르면
    // pushState가 불려 여기서 FAIL한다
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // 이 작업(task-M)이 새로 요구하는 두 클릭 계약과 프리뷰 과녁을 잠근다.
  // 계획서 네 개 다음, 아래 추가 함정들 앞에 둔다. 순서 자체는 의미가 없다

  it('활성이 아닌 이름은 한 번은 선택만, 다시 눌러야 펼친다', () => {
    const target = projects.findIndex((p, i) => i !== 0 && isProjectModalReady(p));
    expect(target).toBeGreaterThan(-1);
    const push = vi.spyOn(window.history, 'pushState');
    renderSection();
    const el = document.querySelector(`[data-name="${target}"]`)!;

    // 첫 클릭: 선택만 옮긴다. 아직 안 펼친다
    fireEvent.click(el);
    expect(
      document.querySelector('[aria-selected="true"]')!.getAttribute('data-name')
    ).toBe(String(target));
    // 뮤테이션: handleNameClick이 alreadyActive를 안 보고 매 클릭마다 열면
    // 여기서 push가 이미 불려 FAIL한다
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    // 둘째 클릭: 이미 활성인 이름을 다시 누른 것이라 이제 펼친다
    fireEvent.click(el);
    // 뮤테이션: alreadyActive 검사가 반대로 뒤집히면(이미 활성일 때만 막으면)
    // 여기서 push가 안 불려 FAIL한다
    expect(push).toHaveBeenCalled();
  });

  // 진짜 마우스는 mousedown이 단추에 포커스를 준 다음에야 click을 쏜다.
  // fireEvent.click만 쓰는 테스트는 포커스 이벤트를 아예 안 겪으므로 이
  // 순서 버그를 영원히 못 잡는다. 그래서 여기서만 focus와 click을 손으로
  // 따로 쏴 실제 mousedown -> click 순서를 재현한다
  it('클릭 전에 focus가 먼저 와도 첫 클릭은 선택만 옮긴다', () => {
    const target = projects.findIndex((p, i) => i !== 0 && isProjectModalReady(p));
    expect(target).toBeGreaterThan(-1);
    const push = vi.spyOn(window.history, 'pushState');
    renderSection();
    const el = document.querySelector(`[data-name="${target}"]`)!;

    fireEvent.focus(el); // mousedown이 하는 일
    fireEvent.click(el); // 그 다음에 오는 click
    expect(
      document.querySelector('[aria-selected="true"]')!.getAttribute('data-name')
    ).toBe(String(target));
    // 뮤테이션: onFocus가 goTo를 다시 부르면 위 focus에서 이미
    // activeIndexRef가 target으로 바뀌어, click이 볼 때 alreadyActive가
    // 참이 되고 여기서 push가 불려 FAIL한다
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    // 같은 단추를 한 번 더 클릭하면 이제 진짜 두 번째 클릭이라 열린다
    fireEvent.click(el);
    expect(push).toHaveBeenCalled();
  });

  it('프리뷰를 누르면 현재 선택의 상세를 열고, 계약 미달이면 아무 일도 안 한다', () => {
    const ready = projects.findIndex((p) => isProjectModalReady(p));
    const unready = projects.findIndex((p) => !isProjectModalReady(p));
    expect(ready).toBeGreaterThan(-1);

    const push = vi.spyOn(window.history, 'pushState');
    renderSection();

    if (unready !== -1) {
      // 계약 미달 프로젝트로 선택을 옮기면 프리뷰 과녁은 disabled다 -
      // 눌러도 아무 일도 없다
      fireEvent.click(document.querySelector(`[data-name="${unready}"]`)!);
      const previewBtn = document.querySelector<HTMLButtonElement>(
        '[data-part="preview-open"]'
      )!;
      expect(previewBtn.disabled).toBe(true);
      fireEvent.click(previewBtn);
      expect(push).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    }

    // 계약을 통과한 프로젝트로 선택을 옮기면 프리뷰 과녁은 활성화되고,
    // 눌렀을 때 그 프로젝트의 상세를 연다. 선택은 다시 안 옮긴다
    fireEvent.click(document.querySelector(`[data-name="${ready}"]`)!);
    const previewBtn = document.querySelector<HTMLButtonElement>(
      '[data-part="preview-open"]'
    )!;
    expect(previewBtn.disabled).toBe(false);
    fireEvent.click(previewBtn);
    expect(push).toHaveBeenCalled();
    const state = push.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(state.projectModalId).toBe(projects[ready].title);
    expect(
      document.querySelector('[aria-selected="true"]')!.getAttribute('data-name')
    ).toBe(String(ready));
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

  it('새로고침으로 복구된 모달을 닫으면 history.back이 아니라 replaceState로 키만 지운다. 페이지 이탈 방지', async () => {
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
    // 여기서 back이 불려 FAIL한다. 새로고침으로 들어온 항목 앞에는 우리
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
// 읽는다. 토큰 이름이 바뀌어도 이 판정은 따라간다
const RADIUS_TOKEN_CLASSES = Array.from(
  TOKENS_CSS.matchAll(/--radius-([a-z0-9-]+)\s*:/g)
).map((m) => `rounded-${m[1]}`);

// t-사다리와 d-사다리는 숫자가 반대로 간다. d3(48px)가 t3(22px)보다 크다.
// 이름 단추가 text-t1 lg:text-d3를 쓰면서 옛 /^text-t\d$/ 정규식만으로는
// 안 걸리므로, 토큰 이름 대신 정본(design-tokens.css)에서 읽은 실제 px
// 크기로 비교한다. lg: 접두 없는(좁은 화면) 크기만 본다. 이 파일의 다른
// 크기 비교도 그 관례를 따른다
const FONT_SIZE_PX = new Map(
  Array.from(TOKENS_CSS.matchAll(/--font-size-([td]\d):\s*([\d.]+)rem/g)).map(
    (m) => [`text-${m[1]}`, Number(m[2]) * 16]
  )
);

function typeRamp(el: Element): number {
  const hit = classList(el).find((c) => FONT_SIZE_PX.has(c));
  expect(hit).toBeDefined();
  return FONT_SIZE_PX.get(hit!)!;
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
  // 않는다. 접힘 쪽 DOM에서 읽어 낸 값으로 펼침 쪽 소스에 묻는다
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
        // 들어 있다). 한 줄로 눌러 두는 것이 truncate다. 이게 없으면
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

    // 눈으로도 주종이 갈려야 한다. typeRamp는 실제 px다. 캡션이 이름보다
    // 작아야 한다(사다리 스텝 비교가 아니라 크기 비교다)
    const nameRamp = typeRamp(document.querySelector('[data-name="0"]')!);
    const forbiddenT4 = FONT_SIZE_PX.get('text-t4')!;
    const lines = Array.from(caption().querySelectorAll('p'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(typeRamp(line)).toBeLessThan(nameRamp);
      // t4는 이 저장소에서 닫아 둔 칸이다
      expect(typeRamp(line)).not.toBe(forbiddenT4);
    }
    expect(nameRamp).not.toBe(forbiddenT4);
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
  // lib/utils/contrast를 그대로 쓴다. 여기서 다시 짜면 정본과 갈라진다
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
});

describe('ProjectsSection 프리뷰 셰이더 모프', () => {
  function fakeTween() {
    return { kill: vi.fn() };
  }

  async function renderWithMorph(reduced = false) {
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
    // gsap 동적 import와 next/dynamic 청크가 둘 다 풀려야 배선이 완성된다
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    return view;
  }

  function layerEl() {
    return document.querySelector<HTMLElement>('[data-part="preview-media"]')!;
  }

  function morphEl() {
    return document.querySelector<HTMLElement>('[data-part="preview-morph"]');
  }

  afterEach(() => {
    gsap.globalTimeline.clear();
  });

  it('모프가 태워지면 겹에 gsap 교체를 걸지 않고, 못 태우면 그대로 건다', async () => {
    const fromTo = vi
      .spyOn(gsap, 'fromTo')
      .mockImplementation(() => fakeTween() as unknown as gsap.core.Tween);
    morphState.result = true;
    await renderWithMorph();

    goToIndex(1);
    expect(morphState.calls).toHaveLength(1);
    // 이것이 이 과제의 표제다. 셰이더가 두 화면을 잇는 동안 겹까지 같이
    // 움직이면 모프한 그림이 밑에서 또 밀려 올라온다
    expect(fromTo).not.toHaveBeenCalled();
    // 죽은 tween이 남긴 인라인 값도 없어야 한다
    expect(layerEl().style.transform).toBe('');
    expect(layerEl().style.opacity).toBe('');

    // 반대 방향. WebGL이 없거나 출발 프레임을 못 굳히면 여기로 떨어진다
    morphState.result = false;
    goToIndex(2);
    expect(morphState.calls).toHaveLength(2);
    expect(fromTo).toHaveBeenCalledTimes(1);
    expect(fromTo.mock.calls[0][0]).toBe(layerEl());
  });

  it('모프에 넘기는 출발 화면은 DOM이 새 프로젝트로 갈리기 전의 것이다', async () => {
    morphState.result = true;
    await renderWithMorph();

    // 영상 없는 프로젝트는 next/image가 src를 /_next/image?url=...로 바꾼다.
    // 어느 프로젝트의 그림을 들고 있었는지만 본다
    const wasShowing = (i: number) => decodeURIComponent(morphState.calls[i].poster ?? '');

    goToIndex(1);
    // 여기가 이 과제에서 가장 틀리기 쉬운 곳이다. 전환 effect에서 부르면
    // 그때 <video>의 poster는 이미 새 프로젝트라 두 텍스처가 같은 그림이 되고
    // 모프가 아무것도 안 한다
    expect(wasShowing(0)).toContain(projects[0].image);
    expect(wasShowing(0)).not.toContain(projects[1].image);
    expect(morphState.calls[0].to).toBe(projects[1].image);

    goToIndex(2);
    expect(wasShowing(1)).toContain(projects[1].image);
    expect(wasShowing(1)).not.toContain(projects[2].image);
    expect(morphState.calls[1].to).toBe(projects[2].image);
  });

  it('모프 캔버스는 잘라내는 상자 안, 미디어 위, 캡션 아래다', async () => {
    await renderWithMorph();
    const canvas = morphEl()!;
    expect(canvas).not.toBeNull();

    // 잘라내는 상자 밖에 있으면 모서리가 안 깎여 사각형이 삐져나온다
    const clip = document.querySelector<HTMLElement>('[data-part="preview"] .rounded-media')!;
    expect(clip.contains(canvas)).toBe(true);
    expect(layerEl().contains(canvas)).toBe(true);

    // 미디어보다 뒤 = 미디어 위에 그려진다
    const media = document.querySelector('[data-part="preview-image"]')!;
    expect(
      media.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // 캡션보다 앞 = 캡션이 위에 남는다. 캡션까지 같이 녹으면 글자가 안 읽힌다
    const caption = document.querySelector('[data-part="preview-caption"]')!;
    expect(
      canvas.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(canvas.className).toContain('pointer-events-none');
    expect(canvas.className).toContain('inset-0');
  });

  it('reduce에서는 캔버스를 아예 만들지 않는다', async () => {
    morphState.result = true;
    await renderWithMorph(true);
    // 셰이더에 분기를 넣는 것보다 캔버스를 안 만드는 쪽이 싸다
    expect(morphEl()).toBeNull();
    goToIndex(1);
    expect(morphState.calls).toHaveLength(0);
  });

  it('같은 프로젝트에 다시 호버해도 모프를 태우지 않는다', async () => {
    morphState.result = true;
    await renderWithMorph();
    goToIndex(1);
    expect(morphState.calls).toHaveLength(1);
    // 같은 그림 사이를 녹이는 것은 아무것도 전하지 않는 모션이다
    goToIndex(1);
    expect(morphState.calls).toHaveLength(1);
  });

  it('이름을 빠르게 다섯 개 훑어도 남는 gsap tween이 없다', async () => {
    const tweens: ReturnType<typeof fakeTween>[] = [];
    vi.spyOn(gsap, 'fromTo').mockImplementation(() => {
      const t = fakeTween();
      tweens.push(t);
      return t as unknown as gsap.core.Tween;
    });
    morphState.result = true;
    await renderWithMorph();

    const sweep = Math.min(5, N);
    for (let i = 1; i < sweep; i += 1) goToIndex(i);
    expect(morphState.calls).toHaveLength(sweep - 1);
    expect(tweens).toHaveLength(0);
    expect(layerEl().style.transform).toBe('');
    expect(layerEl().style.opacity).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 이름 휠
// ---------------------------------------------------------------------------
// 조형의 정본은 .claude/designRefactoring/optionWheel/optionWheel.tsx다.
// jsdom에는 레이아웃 엔진이 없어 offsetHeight가 0이고, 0이면 반지름이 0이 되어
// 호 수학이 통째로 0으로 무너진다. 그 상태에서 "회전이 걸렸는가"를 물으면
// 구현이 어떻게 생겼든 늘 0이 나와 참 같은 거짓만 잡는다. 그래서 줄 높이를
// 크롬 실측값으로 세우고 rAF를 손으로 몰아 프레임을 결정적으로 만든다.
// 픽셀은 여전히 못 잡는다. 여기서 잠그는 것은 배치의 원인이다
const WHEEL_ROW_H = 69; // 크롬 실측(48px 글자 + py-2)
const WHEEL_TILT_DEG = 7;
const WHEEL_BLUR_PX = 1.6;
const WHEEL_FADE = 0.3;
const WHEEL_MIN_OPACITY = 0.18;
// 소스의 CENTER와 같은 식이다. 활성 항목이 항상 오는 목록의 세로 한가운데
const WHEEL_CENTER = (N - 1) / 2;

function installWheelRig(rowH = WHEEL_ROW_H) {
  const spies: Array<{ mockRestore: () => void }> = [];
  spies.push(
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(rowH)
  );
  // 시계까지 우리가 쥔다. 루프가 performance.now()로 기준을 잡으므로 프레임
  // 시각만 가짜로 주면 첫 dt가 음수가 되어 수렴이 거꾸로 간다
  let clock = 10_000;
  spies.push(vi.spyOn(performance, 'now').mockImplementation(() => clock));

  let nextId = 0;
  const queue: Array<{ id: number; cb: FrameRequestCallback }> = [];
  const rafSpy = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      nextId += 1;
      queue.push({ id: nextId, cb });
      return nextId;
    });
  spies.push(rafSpy);
  spies.push(
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      const at = queue.findIndex((f) => f.id === id);
      if (at !== -1) queue.splice(at, 1);
    })
  );

  const step = (ms = 50) => {
    const frame = queue.shift();
    if (!frame) return false;
    clock += ms;
    act(() => {
      frame.cb(clock);
    });
    return true;
  };
  // dt는 0.05초에서 잘리므로 50ms보다 큰 걸음은 수렴을 왜곡한다
  const settle = (ms = 50, max = 300) => {
    let n = 0;
    while (n < max && step(ms)) n += 1;
    return n;
  };
  return {
    queue,
    rafSpy,
    step,
    settle,
    uninstall: () => spies.forEach((s) => s.mockRestore()),
  };
}

function nameEl(i: number) {
  return document.querySelector<HTMLElement>(`[data-name="${i}"]`)!;
}

function wheelStyle(i: number) {
  const el = nameEl(i);
  const m = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\) rotate\((-?[\d.]+)deg\)$/.exec(
    el.style.transform
  );
  const b = /^blur\(([\d.]+)px\)$/.exec(el.style.filter);
  return {
    transform: el.style.transform,
    x: m ? Number(m[1]) : null,
    y: m ? Number(m[2]) : null,
    rot: m ? Number(m[3]) : null,
    opacity: el.style.opacity === '' ? null : Number(el.style.opacity),
    filter: el.style.filter,
    blur: el.style.filter === 'none' ? 0 : b ? Number(b[1]) : null,
    p: el.style.getPropertyValue('--pj-wheel-p'),
  };
}

function flipSpan(i: number) {
  return nameEl(i).firstElementChild as HTMLElement;
}

function renderWheel(reduced = false) {
  return render(
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
}

describe('ProjectsSection 이름 휠', () => {
  // 이 작업이 존재하는 이유 그 자체다. 평평하게 쌓인 단추 줄이 원호를 따라
  // 휘고, 고른 것에서 멀어질수록 흐려지고 번진다
  it('활성에서 멀어질수록 기울고 흐려지고 번진다. 위아래 양쪽 다', () => {
    const rig = installWheelRig();
    try {
      renderWheel();
      const mid = Math.floor((N - 1) / 2);
      const row = document.querySelector('[role="tablist"]')!;
      for (let i = 0; i < mid; i += 1) fireEvent.keyDown(row, { key: 'ArrowDown' });
      rig.settle();
      expect(nameEl(mid).getAttribute('aria-selected')).toBe('true');
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThan(N - 1);

      // 활성 항목은 x, rot이 항등이다. 제목 비행의 출발 rect가 여기서
      // 나온다. y만은 항등이 아니다. 목록의 세로 한가운데로 고정되는
      // centerShift가 얹힌다(활성이 어디 있든 같은 자리로 온다는 계약은
      // 바로 아래 별도 테스트가 본다)
      const active = wheelStyle(mid);
      expect(active.x).toBe(0);
      expect(active.y).toBeCloseTo((WHEEL_CENTER - mid) * WHEEL_ROW_H, 6);
      expect(active.rot).toBe(0);
      expect(active.opacity).toBe(1);
      expect(active.blur).toBe(0);
      // 'none'이지 blur(0px)가 아니다. filter는 값이 무엇이든 새 스택 문맥을
      // 만들고 자손 fixed의 기준 상자를 바꾼다. 이 단추 안에 비행 출발
      // 손잡이가 들어 있으므로 활성에서는 속성 자체가 없어야 한다
      expect(nameEl(mid).style.filter).toBe('none');

      // 회전축은 글자가 시작하는 왼쪽 모서리이고 상자는 글자 너비다. 축이
      // 오른쪽으로 가면 한 칸마다 수십 px씩 위아래로 튀고, 상자가 열 전체
      // 너비로 넓어지면 글자 뒤의 빈 영역이 실려 올라가 남의 줄 위를 덮어
      // 이름을 겨냥하지 않은 자리에서 엉뚱한 프로젝트가 잡힌다(크롬 실측:
      // 상자 527px, 글자 87~321px). jsdom에는 레이아웃이 없어 그 결과를 못
      // 재니 축과 상자 폭을 문자열로 잠근다. 약한 대리 검사임을 안다
      for (let i = 0; i < N; i += 1) {
        const cls = nameEl(i).className.split(/\s+/);
        expect(cls, `item ${i} origin`).toContain('origin-left');
        expect(cls, `item ${i} box`).toContain('w-fit');
        expect(cls, `item ${i} box`).not.toContain('w-full');
        // rowH가 첫 항목 하나로 모든 줄의 간격을 대표하려면 어떤 이름도
        // 줄바꿈하면 안 된다. jsdom은 레이아웃이 없어 줄바꿈이 실제로
        // 일어나는지 못 재니, 줄바꿈을 막는 클래스가 있는지로 대신 잠근다.
        // 약한 대리 검사다
        expect(cls, `item ${i} wrap`).toContain('whitespace-nowrap');
      }

      // 부류로 본다. 값을 손으로 나열하면 나열 안 한 항목에서 샌다
      for (let i = 0; i < N; i += 1) {
        const s = wheelStyle(i);
        const d = i - mid;
        expect(s.rot, `item ${i} rot`).not.toBeNull();
        // 회전 부호는 위와 아래가 반대다. 한쪽만 보면 전부 같은 방향으로
        // 기우는 구현(호가 아니라 미끄러짐)을 놓친다
        // d === 0을 따로 쓰는 것은 -Math.sign(0)이 -0이라 Object.is가 0과
        // 갈라지기 때문이다. 부호 계약 자체는 그대로다
        expect(Math.sign(s.rot!), `item ${i} rot sign`).toBe(d === 0 ? 0 : -Math.sign(d));
        // 부풂은 양쪽 다 같은 방향(오른쪽)이다. 원기둥이 한쪽으로 누워야
        // 휠로 읽힌다. side='right'이므로 부호는 +다
        expect(s.x!, `item ${i} x`).toBeGreaterThanOrEqual(0);
        expect(s.blur!, `item ${i} blur`).toBeCloseTo(Math.abs(d) * WHEEL_BLUR_PX, 2);
        expect(s.opacity!, `item ${i} opacity`).toBeCloseTo(
          Math.max(WHEEL_MIN_OPACITY, 1 - Math.abs(d) * WHEEL_FADE),
          4
        );
      }
      // 거리에 따라 단조롭게 세진다. 이웃보다 먼 항목이 덜 기울면 호가 아니다
      for (let d = 1; mid + d < N && mid - d >= 0; d += 1) {
        expect(Math.abs(wheelStyle(mid + d).rot!)).toBeGreaterThan(
          Math.abs(wheelStyle(mid + d - 1).rot!)
        );
        expect(Math.abs(wheelStyle(mid - d).rot!)).toBeGreaterThan(
          Math.abs(wheelStyle(mid - d + 1).rot!)
        );
        expect(wheelStyle(mid + d).x!).toBeGreaterThan(wheelStyle(mid + d - 1).x!);
        expect(wheelStyle(mid - d).x!).toBeGreaterThan(wheelStyle(mid - d + 1).x!);
      }
    } finally {
      rig.uninstall();
    }
  });

  // 브리프가 못박은 네 숫자를 값 자체가 아니라 그 숫자가 만드는 결과에서
  // 되짚어 잠근다. 상수 하나를 바꾸면 여기서 갈린다
  it('기울기 7도, 번짐 1.6px, 감쇠 0.3, 바닥 투명도 0.18이다', () => {
    const rig = installWheelRig();
    try {
      renderWheel();
      rig.settle();
      // 활성은 0번이다. d = i
      expect(Math.abs(wheelStyle(1).rot!)).toBeCloseTo(WHEEL_TILT_DEG, 3);
      expect(Math.abs(wheelStyle(2).rot!)).toBeCloseTo(WHEEL_TILT_DEG * 2, 3);
      expect(wheelStyle(1).blur!).toBeCloseTo(WHEEL_BLUR_PX, 3);
      expect(1 - wheelStyle(1).opacity!).toBeCloseTo(WHEEL_FADE, 4);
      // 세 칸 이상은 식이 0.18 아래로 내려간다. 바닥이 없으면 여기서 갈린다
      expect(1 - 3 * WHEEL_FADE).toBeLessThan(WHEEL_MIN_OPACITY);
      for (let i = 3; i < N; i += 1) {
        expect(wheelStyle(i).opacity!, `item ${i}`).toBeCloseTo(WHEEL_MIN_OPACITY, 4);
      }
      // 반지름은 이웃 사이 호의 길이가 줄 높이와 같아지게 잡는다. 그래서
      // 세로 어긋남은 sin 압축분만큼만 나고 줄 간격 자체는 안 바뀐다
      const tiltRad = (WHEEL_TILT_DEG * Math.PI) / 180;
      const R = WHEEL_ROW_H / tiltRad;
      // 활성은 0번이라(pos=0) centerShift는 WHEEL_CENTER * WHEEL_ROW_H다
      const centerShift = WHEEL_CENTER * WHEEL_ROW_H;
      expect(wheelStyle(2).y!).toBeCloseTo(
        R * Math.sin(2 * tiltRad) - 2 * WHEEL_ROW_H + centerShift,
        1
      );
      expect(wheelStyle(2).x!).toBeCloseTo(R * (1 - Math.cos(2 * tiltRad)), 1);
    } finally {
      rig.uninstall();
    }
  });

  // 이게 이번 작업이 존재하는 이유 그 자체다: 고른 항목은 어느 것이든
  // 목록의 세로 한가운데라는 같은 자리로 온다. pos가 다르면 흐름상 자리
  // (pos * WHEEL_ROW_H)도 다르므로, 그 흐름 자리를 y에 다시 더해야
  // 숫자를 하드코딩하지 않고 "다 같다"를 볼 수 있다. 그 합이 곧
  // WHEEL_CENTER * WHEEL_ROW_H이고, pos와 무관하게 항상 같다
  it('고른 항목의 세로 자리는 처음/가운데/끝 어디를 골라도 같다', () => {
    const rig = installWheelRig();
    try {
      renderWheel();
      const row = document.querySelector('[role="tablist"]')!;
      const mid = Math.floor((N - 1) / 2);
      const positions = [0, mid, N - 1];
      const centers: number[] = [];
      for (const pos of positions) {
        fireEvent.keyDown(row, { key: 'Home' });
        rig.settle();
        for (let i = 0; i < pos; i += 1) fireEvent.keyDown(row, { key: 'ArrowDown' });
        rig.settle();
        expect(nameEl(pos).getAttribute('aria-selected')).toBe('true');
        centers.push(wheelStyle(pos).y! + pos * WHEEL_ROW_H);
      }
      expect(centers[1]).toBeCloseTo(centers[0], 6);
      expect(centers[2]).toBeCloseTo(centers[0], 6);
    } finally {
      rig.uninstall();
    }
  });

  it('색은 --pj-wheel-p로 활성색과 기본색 사이를 보간한다', () => {
    const rig = installWheelRig();
    try {
      renderWheel();
      rig.settle();
      expect(Number(wheelStyle(0).p)).toBe(1);
      // 한 칸을 넘으면 0에서 멈춘다. 음수로 내려가면 color-mix가 무효가 된다
      for (let i = 1; i < N; i += 1) {
        expect(Number(wheelStyle(i).p), `item ${i}`).toBe(0);
      }
      fireEvent.click(nameEl(1));
      rig.step(50); // 절반쯤 간 자리
      const half = Number(wheelStyle(1).p);
      expect(half).toBeGreaterThan(0);
      expect(half).toBeLessThan(1);
      const color = nameEl(1).style.color;
      expect(color).toContain('color-mix');
      expect(color).toContain('--pj-wheel-p');
    } finally {
      rig.uninstall();
    }
  });

  // 이 과제에서 가장 위험한 곳이다. 훑다가 곧바로 누르면 pos가 아직 목표에
  // 못 갔는데 제목 비행이 시작된다. Flip.getState가 뜨는 rect는 조상의
  // transform을 반영하므로 회전이 남아 있으면 첫 프레임이 기운다
  it('훑다가 곧바로 누르면 눌린 이름을 항등 변형으로 못박는다', () => {
    const rig = installWheelRig();
    try {
      renderWheel();
      rig.settle();
      const ready = projects.findIndex((p, i) => i > 0 && isProjectModalReady(p));
      expect(ready).toBeGreaterThan(0);

      // 클릭으로 먼저 선택만 옮긴다(훑는 동작의 대리). 다음 클릭이 이미
      // 활성인 이름을 다시 누르는 것이라 그 클릭 하나로 상세가 열린다
      fireEvent.click(nameEl(ready));
      // 수렴을 안 기다린다. 아직 옛 자리에 회전이 남아 있어야 시나리오가 산다
      expect(Math.abs(wheelStyle(ready).rot!)).toBeGreaterThan(1);

      // 못박기가 openModal '앞'이어야 한다는 것이 계약이다. 뒤로 밀면 아래
      // 최종 상태 검사는 그대로 통과한다. 둘 다 같은 tick 안에서 끝나기
      // 때문이다. 그래서 openModal 안에서 한 점을 잡아 그 시점의 변형을 본다.
      // 진짜 기준점은 Flip.getState지만 이 스위트는 matchMedia를 좁은 화면으로
      // 고정해 두어 비행 관문이 닫혀 있다. pushState는 같은 openModal 몸통
      // 안, getState 바로 뒤라 순서를 똑같이 가른다
      let atOpen: string | null = null;
      const push = vi
        .spyOn(window.history, 'pushState')
        .mockImplementation(function (this: History, ...args: Parameters<History['pushState']>) {
          atOpen = nameEl(ready).style.transform;
          return History.prototype.pushState.apply(this, args);
        });

      fireEvent.click(nameEl(ready));
      push.mockRestore();
      expect(atOpen, 'openModal이 실제로 불렸다').not.toBeNull();
      // y는 0이 아니라 목록 세로 한가운데로의 centerShift다. ready가
      // 몇 번이든 이 자리가 못박기의 목표다
      const expectedY = ((WHEEL_CENTER - ready) * WHEEL_ROW_H).toFixed(2);
      expect(atOpen).toBe(`translate(0.00px, ${expectedY}px) rotate(0.000deg)`);

      const snapped = wheelStyle(ready);
      expect(snapped.x).toBe(0);
      expect(snapped.y).toBeCloseTo((WHEEL_CENTER - ready) * WHEEL_ROW_H, 6);
      expect(snapped.rot).toBe(0);
      expect(snapped.blur).toBe(0);
      expect(snapped.opacity).toBe(1);
      // 못박기는 눌린 항목만이 아니라 판 전체를 목표 배치로 옮긴다
      expect(Math.abs(wheelStyle(0).rot!)).toBeCloseTo(ready * WHEEL_TILT_DEG, 3);
    } finally {
      rig.uninstall();
    }
  });

  it('비행 손잡이를 쥔 안쪽 노드에는 filter도 transform도 안 건다', () => {
    const rig = installWheelRig();
    try {
      renderWheel();
      rig.settle();
      // 손잡이는 그대로 활성 이름의 안쪽 노드다
      const handle = document.querySelector<HTMLElement>('[data-flip-id^="title-"]')!;
      expect(handle).toBe(flipSpan(0));
      expect(handle.getAttribute('data-flip-id')).toBe(`title-${projects[0].title}`);
      // filter가 걸린 요소는 새 스택 문맥을 만들고 자손의 fixed 기준을 바꾼다
      for (let i = 0; i < N; i += 1) {
        expect(flipSpan(i).style.filter, `span ${i} filter`).toBe('');
        expect(flipSpan(i).style.transform, `span ${i} transform`).toBe('');
        expect(flipSpan(i).style.opacity, `span ${i} opacity`).toBe('');
      }
      // 반대쪽: 배치는 단추가 받는다. 아무도 안 받으면 휠이 아니다
      expect(nameEl(1).style.filter).not.toBe('');
      expect(nameEl(1).style.transform).not.toBe('');
    } finally {
      rig.uninstall();
    }
  });

  it('reducedMotion이면 휠을 만들지도 돌리지도 않는다', () => {
    const rig = installWheelRig();
    try {
      renderWheel(true);
      expect(rig.queue).toHaveLength(0);
      rig.settle();
      for (let i = 0; i < N; i += 1) {
        expect(nameEl(i).style.transform, `item ${i}`).toBe('');
        expect(nameEl(i).style.filter, `item ${i}`).toBe('');
        expect(nameEl(i).style.opacity, `item ${i}`).toBe('');
        expect(nameEl(i).style.getPropertyValue('--pj-wheel-p'), `item ${i}`).toBe('');
      }
      // 그래도 활성 표시는 남는다. 색만 갈린다
      expect(classList(nameEl(0))).toContain('text-[var(--color-text-primary)]');
      expect(nameEl(0).style.color).toBe('');
      expect(nameEl(1).style.color).not.toBe('');
      expect(nameEl(1).style.color).not.toContain('color-mix');
    } finally {
      rig.uninstall();
    }
  });

  it('reduce가 켜지면 이미 걸린 휠을 걷는다', () => {
    const rig = installWheelRig();
    try {
      const view = renderWheel(false);
      rig.settle();
      expect(nameEl(1).style.transform).not.toBe('');
      view.rerender(
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
      for (let i = 0; i < N; i += 1) {
        expect(nameEl(i).style.transform, `item ${i}`).toBe('');
        expect(nameEl(i).style.filter, `item ${i}`).toBe('');
        expect(nameEl(i).style.opacity, `item ${i}`).toBe('');
      }
    } finally {
      rig.uninstall();
    }
  });

  it('모달이 펼쳐진 동안은 rAF가 안 돌고, 접으면 다시 돈다', () => {
    const rig = installWheelRig();
    try {
      renderWheel();
      rig.settle();
      const ready = projects.findIndex((p) => isProjectModalReady(p));
      expect(ready).toBeGreaterThanOrEqual(0);
      fireEvent.click(nameEl(ready === 0 ? 1 : 0));
      // 열림 직전에는 휠이 프레임을 잡고 있다. 이 사실이 아래 0의 대조군이다
      expect(rig.queue.length).toBeGreaterThan(0);

      // 두 클릭 계약: 먼저 선택을 ready로 옮기고, 다시 눌러야 열린다
      fireEvent.click(nameEl(ready));
      fireEvent.click(nameEl(ready));
      // 펼친 상태에서는 프로젝트를 못 바꾸니 휠이 움직일 일이 없다
      expect(rig.queue).toHaveLength(0);
      expect(rig.settle()).toBe(0);

      // 접으면 다시 돈다. popstate로 접는 경로가 동기라 여기서 쓴다
      window.history.replaceState(null, '', '');
      act(() => {
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(rig.queue.length).toBeGreaterThan(0);
    } finally {
      rig.uninstall();
    }
  });

  it('수렴이 프레임률과 무관하다', () => {
    // 같은 경과 시간이면 같은 자리다. k를 상수로 박으면 빠른 프레임이 더
    // 빨리 수렴해 두 값이 갈린다
    const rotAfter = (stepMs: number, totalMs: number) => {
      const rig = installWheelRig();
      const view = renderWheel();
      rig.settle();
      fireEvent.click(nameEl(N - 1));
      for (let t = 0; t < totalMs; t += stepMs) rig.step(stepMs);
      const rot = wheelStyle(N - 1).rot!;
      view.unmount();
      rig.uninstall();
      return rot;
    };
    const fast = rotAfter(10, 200);
    const slow = rotAfter(50, 200);
    // 아직 수렴 전이어야 비교가 의미 있다
    expect(Math.abs(fast)).toBeGreaterThan(1);
    expect(fast).toBeCloseTo(slow, 3);
  });

  it('휠이 서도 마크업과 이벤트 계약은 그대로다', () => {
    const rig = installWheelRig();
    try {
      renderWheel();
      rig.settle();
      for (let i = 0; i < N; i += 1) {
        expect(nameEl(i).tagName).toBe('BUTTON');
        expect(nameEl(i).getAttribute('role')).toBe('tab');
      }
      // 클릭이 프로젝트를 옮긴다. 아직 활성이 아닌 이름의 첫 클릭은 선택만 옮긴다
      fireEvent.click(nameEl(2));
      expect(nameEl(2).getAttribute('aria-selected')).toBe('true');
      expect(
        document.querySelector('[data-part="preview"]')!.getAttribute('data-flip-id')
      ).toBe(`pv-${projects[2].title}`);
      // 방향키가 옮긴다
      fireEvent.keyDown(document.querySelector('[role="tablist"]')!, { key: 'ArrowDown' });
      expect(nameEl(3 % N).getAttribute('aria-selected')).toBe('true');
    } finally {
      rig.uninstall();
    }
  });

  // 6.E를 갚는 논거가 "가만히 있으면 rAF가 안 돈다"인데, 그 말이 참인지는
  // 여기서만 잠긴다. 이게 없으면 목록이 놀고 있는 내내 프레임을 태우는
  // 구현도 위 검사를 전부 통과한다
  it('수렴하면 rAF가 스스로 멈추고, 선택이 바뀌면 다시 돈다', () => {
    const rig = installWheelRig();
    try {
      renderWheel();
      const row = document.querySelector('[role="tablist"]')!;
      rig.settle();
      // 선택을 옮겨야 수렴할 거리가 생긴다. 처음에는 pos와 target이 같아
      // 한 프레임에 끝나므로 "멈췄다"가 참 같은 거짓이 된다
      fireEvent.keyDown(row, { key: 'ArrowDown' });
      expect(rig.queue.length, '선택이 바뀌면 다시 돈다').toBeGreaterThan(0);
      const frames = rig.settle();
      // 실제로 여러 프레임 돌았다. 1이면 감쇠가 아니라 순간이동이다
      expect(frames).toBeGreaterThan(1);
      // 그리고 멈췄다. settle은 큐가 빌 때까지 돌리므로 여기서 큐가 비어 있다
      expect(rig.queue.length, '수렴하면 멈춘다').toBe(0);
      // 멈춘 뒤 프레임을 더 태우지 않는다
      const before = rig.rafSpy.mock.calls.length;
      rig.step();
      expect(rig.rafSpy.mock.calls.length).toBe(before);
      // 정확히 목표에 앉았다. 0.001 문턱에서 멈추기만 하고 목표로 못박지
      // 않으면 활성 항목에 회전 부스러기가 남아 비행 첫 프레임이 기운다
      expect(nameEl(1).getAttribute('aria-selected')).toBe('true');
      expect(wheelStyle(1).rot).toBe(0);
      // y는 0이 아니라 목록 세로 한가운데로의 centerShift다(pos=1)
      const expectedY = ((WHEEL_CENTER - 1) * WHEEL_ROW_H).toFixed(2);
      expect(wheelStyle(1).transform).toBe(
        `translate(0.00px, ${expectedY}px) rotate(0.000deg)`
      );
    } finally {
      rig.uninstall();
    }
  });

  // 사라진 뒤에도 도는 루프가 이 효과의 유일한 누수 경로다. 정리에서
  // 프레임을 안 거두면 떼어 낸 노드에 계속 스타일을 바르고 프레임을 태운다
  it('컴포넌트가 사라지면 잡고 있던 프레임을 거둔다', () => {
    const rig = installWheelRig();
    try {
      const view = renderWheel();
      rig.settle();
      fireEvent.click(nameEl(N - 1));
      // 아직 수렴 중이다. 이 사실이 아래 0의 대조군이다
      expect(rig.queue.length).toBeGreaterThan(0);
      view.unmount();
      expect(rig.queue).toHaveLength(0);
    } finally {
      rig.uninstall();
    }
  });

  // 줄 높이를 못 재는 순간이 실제로 있다. 첫 그림, 숨은 섹션, jsdom.
  // 그때 반지름이 rowH/tiltRad로 무한대가 되면 좌표가 NaN이 되고,
  // NaN이 든 transform 문자열은 CSS가 통째로 버려 목록이 제자리에 굳는다
  it('줄 높이를 못 재면 휠을 안 건다 - NaN을 뱉지 않는다', () => {
    const rig = installWheelRig(0);
    try {
      renderWheel();
      rig.settle();
      for (let i = 0; i < N; i += 1) {
        const s = wheelStyle(i);
        expect(s.transform, `item ${i}`).not.toContain('NaN');
        expect(s.x, `item ${i} x`).toBe(0);
        expect(s.y, `item ${i} y`).toBe(0);
        expect(s.rot, `item ${i} rot`).toBe(0);
      }
      // 그래도 거리 표현은 살아 있다. 높이를 모르는 것은 호일 뿐이다
      expect(wheelStyle(1).blur).toBeCloseTo(WHEEL_BLUR_PX, 3);
      expect(wheelStyle(0).opacity).toBe(1);
    } finally {
      rig.uninstall();
    }
  });
});

// 계획 5 T2 phase D task S-4. 모달이 열리는 비행 동안 휠의 나머지 이름이
// 활성 자리에서 갈라져 안쪽(제목이 날아가는 쪽)이 비어 보인다. applyWheel은
// wheelSpreadRef.current.v(0→1)를 추가항으로만 쓰므로, spread=0이면 이
// 파일의 다른 휠 테스트가 이미 잠근 값과 바이트 단위로 같아야 한다
describe('ProjectsSection 휠 벌어짐(spread)', { timeout: 30_000 }, () => {
  it('모달이 열리는 비행에서 spread가 1이면 활성 아닌 항목만 갈라지고, 0이면 기존 값 그대로다', async () => {
    // 이 파일의 top beforeEach는 matchMedia.matches를 늘 false로 고정해
    // FLIP을 끈다(다른 테스트들은 History 배선만 보므로 무관하다). 여기서는
    // 비행이 실제로 떠야 하므로 넓은 화면으로 다시 세운다
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('min-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }))
    );
    const rowHeight = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(WHEEL_ROW_H);
    try {
      // 0은 초기 활성 인덱스라 열기의 두 클릭 계약(선택 -> 열기)을 못
      // 구분한다. 0이 아닌 것을 고른다
      const ready = projects.findIndex((p, i) => i !== 0 && isProjectModalReady(p));
      expect(ready).toBeGreaterThan(-1);
      const other = ready === 0 ? 1 : 0;

      // 첫 tick 콜백을 손에 쥔다. 실제 ticker에 맡기면 rAF 실시간에 걸려
      // findByRole이 보기 전에 이미 불려 버리는 레이스가 생긴다
      let onFirstTick: (() => void) | undefined;
      vi.spyOn(gsap.ticker, 'add').mockImplementation(
        (cb: Parameters<typeof gsap.ticker.add>[0]) => {
          onFirstTick = cb as unknown as () => void;
          return cb;
        }
      );
      const to = vi.spyOn(gsap, 'to');

      const view = renderWheel();
      // gsap은 마운트 직후 동적 import로 온다. 흘려보내지 않으면
      // flipModule이 아직 비어 있어 비행 자체가 조용히 스킵된다
      await act(async () => {
        await new Promise((done) => setTimeout(done, 0));
      });

      fireEvent.click(nameEl(ready));
      fireEvent.click(nameEl(ready));
      await screen.findByRole('dialog', {}, { timeout: 20_000 });

      // spread=0. 이 파일의 다른 휠 테스트들과 같은 baseline이다
      const before = wheelStyle(other);
      expect(before.opacity).not.toBe(0);

      expect(onFirstTick).toBeTypeOf('function');
      act(() => {
        onFirstTick!();
      });

      // 스프레드 트윈을 붙잡아 값만 목표(1)로 밀어붙인다. target은
      // wheelSpreadRef.current 그 자신이라 이렇게 바꾼 값이 다음
      // applyWheel 호출에 그대로 실린다
      const spreadCall = to.mock.calls.find(
        (call) => typeof (call[0] as { v?: unknown }).v === 'number'
      );
      expect(spreadCall).toBeDefined();
      const [target, vars] = spreadCall as [{ v: number }, { onUpdate: () => void }];
      expect(vars).toMatchObject({ duration: 0.4 });
      target.v = 1;
      act(() => {
        vars.onUpdate();
      });

      const after = wheelStyle(other);
      const d = other - ready;
      // WHEEL_SPLIT_PX(56), WHEEL_SPLIT_BLUR_PX(6). 소스 상수 그대로
      expect(after.y).toBeCloseTo((before.y ?? 0) + d * 56, 1);
      expect(after.opacity).toBe(0);
      expect(after.blur).toBeCloseTo((before.blur ?? 0) + 6, 2);
      view.unmount();
    } finally {
      rowHeight.mockRestore();
    }
  });
});

describe('ProjectsSection 머리띠 제거', () => {
  it('MY PROJECTS 글자와 목록 위치 궤도가 문서에 없다', () => {
    renderSection();
    expect(screen.queryByText('MY PROJECTS')).toBeNull();
    expect(document.querySelector('[data-part="index-progress"]')).toBeNull();
  });
});
