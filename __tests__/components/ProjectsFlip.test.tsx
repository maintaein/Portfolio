import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ProjectsSection from '@/components/sections/ProjectsSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { projects } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import { isProjectModalReady } from '@/lib/utils/projectContract';
import { Flip, REVEAL_OUT_MS, SITE_EASE, gsap } from '@/lib/gsap';
import {
  setProjectModalObscured,
  useProjectModalObscured,
} from '@/hooks/useProjectModalObscured';

// ProjectsSection이 stage에 걸어 둔 콜백 ref를 붙잡는다. React가 fiber에
// 넣어 둔 것을 밖에서 읽을 방법이 없어서, 진짜 ProjectModal을 그대로
// 렌더하는 투명 래퍼로 감싸 prop만 기록한다
const modalProbe = vi.hoisted(() => ({
  stageRef: null as ((el: HTMLDivElement | null) => void) | null,
}));

vi.mock('@/components/blocks/ProjectModal', async () => {
  const actual = await vi.importActual<typeof import('@/components/blocks/ProjectModal')>(
    '@/components/blocks/ProjectModal'
  );
  const Real = actual.default;
  return {
    ...actual,
    default: (props: React.ComponentProps<typeof Real>) => {
      modalProbe.stageRef = props.onStageMount ?? null;
      return <Real {...props} />;
    },
  };
});

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
  // 배경 알림은 모듈 스코프 싱글턴이라 테스트 사이에 흘러넘친다
  setProjectModalObscured(false);
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

// 배경 알림 싱글턴을 DOM으로 끌어내는 탐침. 닫기에서 배경이 언제 돌아오는지가
// 계약이므로 호출 순서를 볼 채널이 필요하다
function ObscuredProbe() {
  return <span data-testid="obscured">{String(useProjectModalObscured())}</span>;
}

function obscured() {
  return screen.getByTestId('obscured').textContent;
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
      <ObscuredProbe />
    </SectionActivityProvider>
  );
}

// 닫기는 붕괴 220ms를 기다렸다 비행을 띄운다. 그 기다림을 GSAP 시계에
// 맡기므로(setTimeout이 아니다) 테스트는 예약을 가로채 직접 흘려보낸다
interface Reservation {
  delay: number;
  run: () => void;
  killed: boolean;
}

function stubDelayedCall(): Reservation[] {
  const made: Reservation[] = [];
  vi.spyOn(gsap, 'delayedCall').mockImplementation(((delay: number, run: () => void) => {
    const reservation: Reservation = { delay, run, killed: false };
    made.push(reservation);
    return {
      kill: () => {
        reservation.killed = true;
      },
    } as unknown as gsap.core.Tween;
  }) as typeof gsap.delayedCall);
  return made;
}

function scrollColumn() {
  return document.querySelector<HTMLElement>('[data-modal-part="scroll"]')!;
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

// 비행을 착지시킨다. Flip.from의 onComplete가 setRevealed(true)를 부르고
// 그제서야 내용이 감춤에서 풀린다. 관문이 닫힌 경로에서는 Flip.from이 아예
// 안 불리므로(내용이 처음부터 보인다) 호출이 없으면 조용히 지나간다
function land(from: { mock: { calls: unknown[][] } }) {
  const vars = from.mock.calls[0]?.[1] as { onComplete?: () => void } | undefined;
  act(() => {
    vars?.onComplete?.();
  });
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

describe('ProjectsFlip - 등장은 비행이 끝난 뒤다', { timeout: 30_000 }, () => {
  it('비행 중에는 상세 판 내용이 감춰져 있고 onComplete가 와야 등장한다', async () => {
    const from = vi.spyOn(Flip, 'from');
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    // 스크린샷의 증상: 논증 열이 이미 다 그려진 채로 비행이 끝났다
    expect(scrollColumn().style.visibility).toBe('hidden');

    const vars = from.mock.calls[0][1] as { onComplete: () => void };
    act(() => {
      vars.onComplete();
    });
    expect(scrollColumn().style.visibility).toBe('visible');
  });

  // next.config.ts가 reactStrictMode: true다. dev에서 React 19는 콜백 ref를
  // el -> null -> el 세 번 부른다. 세 번째 호출에는 비행 상태가 이미 소진돼
  // null이라, 되돌아가는 갈래가 날고 있는 비행을 놔둔 채 등장을 열어 버렸다.
  // 크롬 실측: stage mount t=145, 등장 시작 t=180, 착지 t=570.
  //
  // jsdom의 StrictMode는 이 stage ref를 다시 붙이지 않는다(portal이 Modal
  // 아톰의 mounted 커밋에서 뒤늦게 서기 때문이다). 그래서 재부착 자체를
  // 흉내내지 않고 콜백을 직접 세 번 부른다. 두 번짜리로는 안 잡힌다
  it('stage 콜백 ref가 el -> null -> el로 다시 불려도 등장은 착지까지 열리지 않는다', async () => {
    const from = vi.spyOn(Flip, 'from');
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    const stageEl = document.querySelector<HTMLDivElement>('[data-modal-part="stage"]')!;
    const stageRef = modalProbe.stageRef!;
    expect(stageRef).toBeTypeOf('function');
    expect(from).toHaveBeenCalledTimes(1);

    act(() => {
      stageRef(null);
      stageRef(stageEl);
    });

    // 비행은 여전히 하나뿐이고, 등장은 아직 열리지 않았다
    expect(from).toHaveBeenCalledTimes(1);
    expect(scrollColumn().style.visibility).toBe('hidden');

    // 열쇠는 그대로 비행의 onComplete가 쥔다
    land(from);
    expect(scrollColumn().style.visibility).toBe('visible');
  });

  it('관문이 닫힌 경로에서는 감추지 않는다 - 안무 없이 처음부터 보인다', async () => {
    installMatchMedia(false);
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    expect(scrollColumn().style.visibility).toBe('');
  });

  it('셸 배경만 여기서 다루고 그마저 비행의 앞 60%에 끝난다', async () => {
    const fromTo = vi.spyOn(gsap, 'fromTo');
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    // 내용 불투명도는 ProjectModal로 넘어갔다. 여기가 크롬에 트윈을 걸면
    // 착지 순간 컨테이너와 자식이 서로 다른 프레임에 되살아나 번쩍인다
    const shell = document.getElementById('pm-shell');
    expect(fromTo.mock.calls.map((call) => call[0])).toEqual([shell]);
    // 앞 60%를 넘겨 잡으면 비행 중반에 접힘 섹션 글자가 날아가는 이미지
    // 너머로 비친다
    const to = fromTo.mock.calls[0][2] as Record<string, unknown>;
    expect(to.duration).toBeCloseTo(0.3);
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
  // 닫기는 등장이 끝난 판에서만 누를 수 있다. 비행 중에는 머리띠의 단추
  // 묶음이 visibility:hidden이라 접근성 트리에 없다 - 실제 사용자도 그
  // 500ms 동안은 못 누른다. 착지를 태워 실제 순서를 그대로 재현한다
  async function openAndGetCloseButton() {
    const from = vi.spyOn(Flip, 'from');
    renderSection();
    await flushGsapImport();
    open();
    await findDialog();
    land(from);
    return screen.getByRole('button', { name: '닫기' });
  }

  it('붕괴가 끝나야 비행이 뜨고, 배경 복원이 착지보다 먼저 온다', async () => {
    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    const closeButton = await openAndGetCloseButton();
    const to = vi.spyOn(gsap, 'to');
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    expect(obscured()).toBe('true');

    fireEvent.click(closeButton);

    // t=0 - 붕괴만 시작한다. 비행도 배경 복원도 아직이다.
    // 접기 자체는 ProjectModal 몫이라 여기서는 reveal이 false로 내려갔다는
    // 증거만 본다 - 논증 열을 담은 트윈이 퇴장 길이로 떴는가
    const collapse = to.mock.calls.find((call) =>
      (call[0] as Element[]).includes?.(scrollColumn())
    );
    expect(collapse).toBeDefined();
    expect(collapse![1]).toMatchObject({ opacity: 0, duration: REVEAL_OUT_MS / 1000 });
    expect(fit).not.toHaveBeenCalled();
    expect(obscured()).toBe('true');
    expect(reservations).toHaveLength(1);
    expect(reservations[0].delay).toBeCloseTo(REVEAL_OUT_MS / 1000);

    act(() => {
      reservations[0].run();
    });

    // t=220 - 배경이 먼저 돌아오고 비행이 같이 뜬다. finishClose를 통해
    // 간접적으로 두면 착지한 뒤에야 배경이 돌아와 열기와 대칭이 아니다
    expect(obscured()).toBe('false');
    expect(fit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });

  it('닫기의 셸 배경은 비행의 뒤 60%다 - 열기의 앞 60%를 뒤집은 값', async () => {
    const reservations = stubDelayedCall();
    const to = vi.spyOn(gsap, 'to');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    fireEvent.click(closeButton);
    act(() => {
      reservations[0].run();
    });

    const shell = document.getElementById('pm-shell');
    const shellCall = to.mock.calls.find((call) => call[0] === shell);
    expect(shellCall).toBeDefined();
    expect(shellCall![1]).toMatchObject({ duration: 0.3, delay: 0.2 });
  });

  it('붕괴 중에 모달이 걷혀 가면 예약된 비행이 취소된다', async () => {
    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    fireEvent.click(closeButton);
    // 붕괴가 도는 220ms 사이에 popstate가 모달을 걷어간다. 예약이 살아
    // 있으면 사라진 stage로 비행을 띄운다
    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(reservations[0].killed).toBe(true);
    expect(fit).not.toHaveBeenCalled();
  });

  it('Flip.fit이 착지하기 전에는 모달이 아직 열려 있고, onComplete가 와야 닫힌다', async () => {
    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    fireEvent.click(closeButton);
    act(() => {
      reservations[0].run();
    });

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

  it('붕괴 중 Escape를 두 번 눌러도 비행 예약은 하나뿐이다', async () => {
    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    // 붕괴 220ms 동안에도 모달은 살아 있고 포커스 트랩도 돈다
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(reservations).toHaveLength(1);

    act(() => {
      reservations[0].run();
    });
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
    const flipFrom = vi.spyOn(Flip, 'from');
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

    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    land(flipFrom);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    act(() => {
      reservations[0].run();
    });
    act(() => {
      (fit.mock.calls[0][2] as { onComplete: () => void }).onComplete();
    });

    // 닫히면 접힘 쪽 손잡이가 돌아온다 - 다음 펼치기가 짝을 지으려면 필요하다
    expect(previewEl().getAttribute('data-flip-id')).toBe(`pv-${title}`);
    expect(nameEl(READY_INDEX).getAttribute('data-flip-id')).toBe(`title-${title}`);
  });
});
