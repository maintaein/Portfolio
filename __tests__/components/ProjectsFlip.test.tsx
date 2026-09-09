import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ProjectsSection from '@/components/sections/ProjectsSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { projects } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import { isProjectModalReady } from '@/lib/utils/projectContract';
import { Flip, SITE_EASE, gsap } from '@/lib/gsap';

// ProjectsSection의 FLIP 다리(접힘 프리뷰 -> 펼침 stage)를 검증한다.
// WordmarkFlip.test.tsx와 같은 방식이다: 실제 @/lib/gsap 모듈에 spy를 걸고
// 모듈 전체를 mock하지 않는다. jsdom에는 레이아웃 엔진이 없으므로 픽셀은
// 재지 않는다 - 원인(호출 여부와 인자)만 고정하고 결과(좌표)는 고정하지 않는다.

// 넓은 화면 관문(min-width: 1024px)을 켜고 끈다. ProjectsSection.test.tsx의
// beforeEach는 matches: false 고정이라 그 스위트에서는 FLIP이 전부 꺼진다
function installMatchMedia(wide: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: wide && query.includes('min-width'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
}

beforeEach(() => {
  installMatchMedia(true);
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  // 실제 Flip이 만든 tween이 다음 테스트로 흘러들어 사라진 컴포넌트의
  // setState를 부르지 않게 전역 타임라인을 비운다
  gsap.globalTimeline.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

interface Gates {
  routeResolved?: boolean;
  motionReady?: boolean;
  reducedMotion?: boolean;
}

function renderSection(gates: Gates = {}) {
  return render(
    <SectionActivityProvider
      active={SECTION_IDS.PROJECTS}
      entryAnimationTarget={null}
      pageVisible
      routeResolved={gates.routeResolved ?? true}
      motionReady={gates.motionReady ?? true}
      reducedMotion={gates.reducedMotion ?? false}
    >
      <ProjectsSection />
    </SectionActivityProvider>
  );
}

// ProjectsSection은 마운트 직후 useEffect에서 import('@/lib/gsap')을 걸고
// gsapModuleRef에 담는다. openModal은 이 ref를 동기적으로만 읽으므로,
// 흘려보내지 않으면 FLIP이 조용히 스킵된다(테스트 6이 그 상태를 노린다)
async function flushGsapImport() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// 계약을 통과한 프로젝트만 펼쳐진다. 첫 번째가 아니라 마지막 것을 고른다 -
// 인덱스 0은 초기 활성 인덱스와 같아서, 눌린 인덱스로 집는지 활성 인덱스로
// 집는지를 구분하지 못한다(뮤테이션 (a)가 실제로 그 구멍을 뚫고 지나갔다)
const READY_INDICES = projects
  .map((p, i) => (isProjectModalReady(p) ? i : -1))
  .filter((i) => i !== -1);
const READY_INDEX = READY_INDICES[READY_INDICES.length - 1];
// 눌린 인덱스와 그 시점의 활성 인덱스를 다르게 만들기 위한 다른 이름 하나
const OTHER_INDEX = READY_INDEX === 0 ? 1 : 0;

function nameEl(i: number) {
  return document.querySelector<HTMLButtonElement>(`[data-name="${i}"]`)!;
}

function previewEl() {
  return document.querySelector<HTMLElement>('[data-part="preview"]')!;
}

// 다른 이름에 먼저 호버해 활성 인덱스를 옮긴 뒤 READY_INDEX를 누른다.
// 클릭 시점의 activeIndex는 아직 OTHER_INDEX라, 소스가 눌린 인덱스가 아니라
// activeIndex로 이름 노드를 집으면 getState 인자가 달라진다
function openStale() {
  fireEvent.mouseEnter(nameEl(OTHER_INDEX));
  fireEvent.click(nameEl(READY_INDEX));
}

// 실제 마우스·키보드 경로. 호버(또는 포커스)가 항상 클릭보다 먼저 와서
// 활성 인덱스가 이미 눌린 것과 같다
function open() {
  fireEvent.mouseEnter(nameEl(READY_INDEX));
  fireEvent.click(nameEl(READY_INDEX));
}

async function findDialog() {
  return screen.findByRole('dialog', {}, { timeout: 20_000 });
}

describe('ProjectsFlip - 펼치기 비행', { timeout: 30_000 }, () => {
  it('이름을 누르면 Flip.getState가 정확히 한 번, 프리뷰 상자와 눌린 이름 노드로 불린다', async () => {
    const getState = vi.spyOn(Flip, 'getState');
    renderSection();
    await flushGsapImport();

    const preview = previewEl();
    const pressed = nameEl(READY_INDEX);
    // 이 테스트의 전제. 누르기 직전의 활성 이름이 눌릴 이름과 달라야
    // "눌린 인덱스로 집는다"가 "활성 인덱스로 집는다"와 구분된다. 데이터가
    // 바뀌어 둘이 같아지면 테스트가 이빨을 잃으므로 여기서 소리내어 깨진다
    expect(document.querySelector('[aria-selected="true"]')).not.toBe(pressed);

    openStale();

    expect(getState).toHaveBeenCalledTimes(1);
    expect(getState).toHaveBeenCalledWith([preview, pressed]);
  });

  it('호버 없이 곧장 눌러도 접힘 손잡이가 눌린 프로젝트 것으로 맞춰진 뒤 상태가 뜬다', async () => {
    const title = projects[READY_INDEX].title;
    const original = Flip.getState;
    let captured: (string | undefined)[] = [];
    // 손잡이는 뜬 직후 되돌아가므로 호출 시점에 읽어야 한다
    const getState = vi
      .spyOn(Flip, 'getState')
      .mockImplementation(((targets: Element[], vars?: unknown) => {
        captured = targets.map((el) => (el as HTMLElement).dataset.flipId);
        return original(targets, vars as never);
      }) as typeof Flip.getState);
    renderSection();
    await flushGsapImport();

    // 호버도 포커스도 없이 클릭만. 터치와 프로그램적 클릭이 이 모양이다.
    // 이 시점 눌린 이름에는 손잡이가 없고 프리뷰 손잡이는 다른 프로젝트 것이다
    fireEvent.click(nameEl(READY_INDEX));

    expect(getState).toHaveBeenCalledTimes(1);
    expect(captured).toEqual([`pv-${title}`, `title-${title}`]);
    // 뜬 뒤에는 되돌린다. 같은 손잡이를 가진 노드가 화면에 둘이면 안 된다
    expect(nameEl(READY_INDEX).dataset.flipId).toBeUndefined();
  });

  it('stage가 박히면 Flip.from이 뜬 상태로, 펼침 노드를 targets로 지정해 불린다', async () => {
    const getState = vi.spyOn(Flip, 'getState');
    const from = vi.spyOn(Flip, 'from');
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    const stage = document.querySelector('[data-modal-part="stage"]');
    expect(stage).not.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    // 상태는 클릭 시점에 뜬 그것이어야 한다. 새로 뜨면 이미 늦었다
    expect(from.mock.calls[0][0]).toBe(getState.mock.results[0]!.value);

    // Flip.from은 넘겨받은 vars를 그 자리에서 확장한다(WordmarkFlip.test.tsx와
    // 같은 이유). 우리가 지정한 값만 본다
    const vars = from.mock.calls[0][1] as Record<string, unknown>;
    expect(vars).toMatchObject({
      duration: 0.5,
      ease: SITE_EASE,
      scale: true,
      absolute: true,
    });
    // targets를 안 넘기면 GSAP이 상태를 뜬 접힘 노드를 날린다. 우리가 날릴 건
    // 펼침 노드다
    expect(vars.targets as Element[]).toContain(stage);
    expect(vars.targets as Element[]).not.toContain(previewEl());
  });
});

describe('ProjectsFlip - 관문 넷은 서로 다르다', { timeout: 30_000 }, () => {
  it('reducedMotion이면 getState도 from도 안 불리고 모달은 열린다', async () => {
    const getState = vi.spyOn(Flip, 'getState');
    const from = vi.spyOn(Flip, 'from');
    renderSection({ reducedMotion: true });
    await flushGsapImport();

    open();
    expect(await findDialog()).toBeTruthy();

    expect(getState).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('routeResolved가 거짓이면 getState도 from도 안 불리고 모달은 열린다', async () => {
    const getState = vi.spyOn(Flip, 'getState');
    const from = vi.spyOn(Flip, 'from');
    renderSection({ routeResolved: false });
    await flushGsapImport();

    open();
    expect(await findDialog()).toBeTruthy();

    expect(getState).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('motionReady가 거짓이면 getState도 from도 안 불리고 모달은 열린다', async () => {
    const getState = vi.spyOn(Flip, 'getState');
    const from = vi.spyOn(Flip, 'from');
    renderSection({ motionReady: false });
    await flushGsapImport();

    open();
    expect(await findDialog()).toBeTruthy();

    expect(getState).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('좁은 화면이면 getState도 from도 안 불리고 모달은 열린다', async () => {
    installMatchMedia(false);
    const getState = vi.spyOn(Flip, 'getState');
    const from = vi.spyOn(Flip, 'from');
    renderSection();
    await flushGsapImport();

    open();
    expect(await findDialog()).toBeTruthy();

    expect(getState).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('matchMedia가 아예 없는 환경이면 getState도 from도 안 불리고 모달은 열린다', async () => {
    vi.stubGlobal('matchMedia', undefined);
    const getState = vi.spyOn(Flip, 'getState');
    const from = vi.spyOn(Flip, 'from');
    renderSection();
    await flushGsapImport();

    open();
    expect(await findDialog()).toBeTruthy();

    expect(getState).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('GSAP 모듈이 아직 안 왔으면 getState도 from도 안 불리고 모달은 열린다', async () => {
    const getState = vi.spyOn(Flip, 'getState');
    const from = vi.spyOn(Flip, 'from');
    // 위 테스트들과 달리 flushGsapImport를 부르지 않는다. 클릭까지 await이
    // 하나도 없어야 gsapModuleRef가 비어 있는 그 순간이 재현된다
    renderSection();
    open();

    expect(getState).not.toHaveBeenCalled();
    expect(await findDialog()).toBeTruthy();
    // 모듈이 뒤늦게 도착해도 뜬 상태가 없으니 비행은 없다
    expect(from).not.toHaveBeenCalled();
  });
});

describe('ProjectsFlip - 닫기 비행', { timeout: 30_000 }, () => {
  async function openAndGetCloseButton() {
    renderSection();
    await flushGsapImport();
    open();
    await findDialog();
    return screen.getByRole('button', { name: '닫기' });
  }

  it('Flip.fit이 착지하기 전에는 모달이 아직 열려 있고, onComplete가 와야 닫힌다', async () => {
    const fit = vi.spyOn(Flip, 'fit');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    fireEvent.click(closeButton);

    expect(fit).toHaveBeenCalledTimes(1);
    const [flying, landing, vars] = fit.mock.calls[0] as [
      Element,
      Element,
      Record<string, unknown>,
    ];
    // 날아가는 건 펼침 stage, 착지점은 접힘 프리뷰다. 반대로 두면 접힘 노드가
    // 섹션 상자 밖에서 잘린다
    expect(flying).toBe(document.querySelector('[data-modal-part="stage"]'));
    expect(landing).toBe(previewEl());
    expect(vars).toMatchObject({ duration: 0.5, ease: SITE_EASE, scale: true });
    // Flip.fit에 absolute를 주면 안 된다. transform만으로 옮긴다
    expect(vars.absolute).toBeUndefined();

    // 착지 전 - 모달은 아직 살아 있다
    expect(screen.queryByRole('dialog')).not.toBeNull();

    act(() => {
      (vars.onComplete as () => void)();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('비행 중 Escape를 두 번 눌러도 Flip.fit은 한 번만 불린다', async () => {
    const fit = vi.spyOn(Flip, 'fit');
    await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(fit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });

  it('비행을 못 태우는 경우(좁은 화면)에는 Flip.fit 없이 즉시 닫는다', async () => {
    installMatchMedia(false);
    const fit = vi.spyOn(Flip, 'fit');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    fireEvent.click(closeButton);

    expect(fit).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ProjectsFlip - 접힘 손잡이는 펼침 중에 뗀다', { timeout: 30_000 }, () => {
  it('모달이 열린 동안 접힘 프리뷰와 활성 이름의 data-flip-id가 사라졌다가 닫으면 돌아온다', async () => {
    renderSection();
    await flushGsapImport();

    const title = projects[READY_INDEX].title;
    expect(previewEl().getAttribute('data-flip-id')).toBe(
      `pv-${projects[0].title}`
    );

    open();
    await findDialog();

    // 같은 id를 가진 노드가 둘이면 Flip이 짝을 못 짓는다
    expect(previewEl().getAttribute('data-flip-id')).toBeNull();
    expect(nameEl(READY_INDEX).getAttribute('data-flip-id')).toBeNull();
    // 펼침 쪽에는 그대로 살아 있다
    expect(
      document.querySelector('[data-modal-part="stage"]')!.getAttribute('data-flip-id')
    ).toBe(`pv-${title}`);
    expect(document.getElementById('pm-title')!.getAttribute('data-flip-id')).toBe(
      `title-${title}`
    );

    const fit = vi.spyOn(Flip, 'fit');
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    act(() => {
      (fit.mock.calls[0][2] as { onComplete: () => void }).onComplete();
    });

    // 닫히면 접힘 쪽 손잡이가 돌아온다 - 다음 펼치기가 짝을 지으려면 필요하다
    expect(previewEl().getAttribute('data-flip-id')).toBe(`pv-${title}`);
    expect(nameEl(READY_INDEX).getAttribute('data-flip-id')).toBe(`title-${title}`);
  });
});
