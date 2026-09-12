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
// 재지 않는다. 원인(호출 여부와 인자)만 고정하고 결과(좌표)는 고정하지 않는다.

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

// 비행 손잡이를 쥔 노드는 단추가 아니라 그 안쪽 글자 상자다. 단추가 열 전체
// 너비였을 때는 그 너비 비율이 첫 프레임 scaleX로 박혔다(크롬 실측 5.07배).
// 지금은 단추도 글자 너비지만 py만큼 세로로 더 커서 배율이 세로로 남는다
function nameFlipEl(i: number) {
  return nameEl(i).firstElementChild as HTMLElement;
}

function previewEl() {
  return document.querySelector<HTMLElement>('[data-part="preview"]')!;
}

// READY_INDEX가 아닌 곳에 선택이 있는 상태에서, 같은 렌더 안에서
// READY_INDEX를 두 번 누른다. 포커스는 이제 선택을 안 옮기므로 그 자리를
// 만들 필요가 없다. 마운트 직후 활성 인덱스는 이미 OTHER_INDEX(0)이고
// READY_INDEX는 정의상 0이 아니므로, 초기 상태 자체가 이미 이 조건을
// 채운다. 여기서 OTHER_INDEX를 클릭하는 것은 안 된다. 0은 계약을 통과하는
// 프로젝트라 클릭 한 번에 모달이 열려 아래 시나리오가 아예 성립하지 않는다.
// goTo가 activeIndexRef.current를 동기로 갱신하므로 두 번째 클릭이 볼 때
// ref는 이미 READY_INDEX인데 DOM의 aria-selected와 data-flip-id는 아직
// OTHER_INDEX 것인 창이 열린다. 이 창에서 소스가 눌린 인덱스가 아니라
// activeIndex로 이름 노드를 집으면 getState 인자가 달라진다
function openStale() {
  // 두 클릭 사이에 렌더가 끼면 안 된다. fireEvent는 하나씩 act로 감싸
  // 매번 커밋시키므로, 여기서는 act 한 덩어리 안에서 직접 이벤트를 쏜다
  act(() => {
    const el = nameEl(READY_INDEX);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

// 실제 마우스·키보드 경로. 첫 클릭이 선택을 옮기고, 이미 선택된 이름을
// 다시 누르는 두 번째 클릭이 연다
function open() {
  fireEvent.click(nameEl(READY_INDEX));
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

describe('ProjectsFlip. 펼치기 비행', { timeout: 30_000 }, () => {
  it('이름을 누르면 Flip.getState가 정확히 한 번, 프리뷰 상자와 눌린 이름 노드로 불린다', async () => {
    const getState = vi.spyOn(Flip, 'getState');
    renderSection();
    await flushGsapImport();

    const preview = previewEl();
    const pressed = nameFlipEl(READY_INDEX);
    // 이 테스트의 전제. 누르기 직전의 활성 이름이 눌릴 이름과 달라야
    // "눌린 인덱스로 집는다"가 "활성 인덱스로 집는다"와 구분된다. 데이터가
    // 바뀌어 둘이 같아지면 테스트가 이빨을 잃으므로 여기서 소리내어 깨진다
    expect(document.querySelector('[aria-selected="true"]')).not.toBe(nameEl(READY_INDEX));

    openStale();

    expect(getState).toHaveBeenCalledTimes(1);
    expect(getState).toHaveBeenCalledWith([preview, pressed]);
  });

  // 이 과제가 존재하는 이유. 두 노드의 상자가 다르면 Flip.from은 그 비율을
  // 비행 첫 프레임의 배율로 박는다. 크롬 실측으로 단추 504px 대 제목
  // 99.33px, 배율 5.07이었다. 단추를 글자 너비로 줄인 뒤에도 py만큼 세로가
  // 남으므로 원인은 그대로다. jsdom에는 레이아웃이 없어 픽셀은 못 재니
  // 원인을 잠근다: 상태를 뜨는 노드가 단추가 아니라 그 안쪽 글자 상자다
  it('상태를 뜨는 노드는 단추가 아니라 그 안쪽 글자 너비 상자다', async () => {
    const getState = vi.spyOn(Flip, 'getState');
    renderSection();
    await flushGsapImport();

    const button = nameEl(READY_INDEX);
    const handle = nameFlipEl(READY_INDEX);

    // 단추는 회전한 빈 영역이 남의 줄을 덮지 않도록 글자 너비다. 여기에
    // w-full이 돌아오면 히트 영역 겹침도 함께 돌아온다
    expect(button.className.split(/\s+/)).not.toContain('w-full');
    // 손잡이는 글자 너비다. w-fit이 fit-content 상자를 만든다. block인 것은
    // inline-block의 기준선 여백이 단추 높이를 바꾸지 않게 하기 위해서다
    const handleClasses = handle.className.split(/\s+/);
    expect(handleClasses).toContain('w-fit');
    expect(handleClasses).not.toContain('w-full');
    expect(handleClasses).toContain('block');
    // 과녁과 손잡이가 같은 노드로 되돌아가면 이 과제가 원위치다
    expect(handle).not.toBe(button);
    expect(button.contains(handle)).toBe(true);

    open();

    expect(getState.mock.calls[0][0]).toEqual([previewEl(), handle]);
  });

  it('같은 렌더 안에서 두 번 눌러도 접힘 손잡이가 눌린 프로젝트 것으로 맞춰진 뒤 상태가 뜬다', async () => {
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

    // openStale이 여는 창. 두 번째 클릭이 열 시점에 이 이름에는 아직 손잡이가
    // 없고 프리뷰 손잡이는 다른 프로젝트 것이다
    openStale();

    expect(getState).toHaveBeenCalledTimes(1);
    expect(captured).toEqual([`pv-${title}`, `title-${title}`]);
    // 뜬 뒤에는 되돌린다. 다만 이 시점엔 렌더도 이미 커밋돼 모달이 열린 뒤
    // 손잡이를 지우는 렌더 규칙과 겹친다. 되돌리기 자체가 실제로 동작했다는
    // 증거는 이미 위 captured 값이 쥐고 있다
    expect(nameFlipEl(READY_INDEX).dataset.flipId).toBeUndefined();
  });

  it('stage가 박히면 Flip.from이 뜬 상태로, 펼침 노드를 targets로 지정해 두 번(stage·제목) 불린다', async () => {
    const getState = vi.spyOn(Flip, 'getState');
    const from = vi.spyOn(Flip, 'from');
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    const stage = document.querySelector('[data-modal-part="stage"]');
    const title = document.getElementById('pm-title');
    expect(stage).not.toBeNull();
    // stage(500ms)와 제목(600ms)이 길이가 달라(S-1) Flip.from이 둘로 갈린다
    expect(from).toHaveBeenCalledTimes(2);
    // 상태는 클릭 시점에 뜬 그것이어야 한다. 새로 뜨면 이미 늦었다. 둘 다
    // 같은 상태를 봐야 stage와 제목이 같은 출발점에서 난다
    expect(from.mock.calls[0][0]).toBe(getState.mock.results[0]!.value);
    expect(from.mock.calls[1][0]).toBe(getState.mock.results[0]!.value);

    // Flip.from은 넘겨받은 vars를 그 자리에서 확장한다(WordmarkFlip.test.tsx와
    // 같은 이유). 우리가 지정한 값만 본다
    const stageVars = from.mock.calls[0][1] as Record<string, unknown>;
    expect(stageVars).toMatchObject({
      duration: 0.5,
      ease: SITE_EASE,
      scale: true,
      absolute: true,
    });
    // targets를 안 넘기면 GSAP이 상태를 뜬 접힘 노드를 날린다. 우리가 날릴 건
    // 펼침 노드다
    expect(stageVars.targets as Element[]).toContain(stage);
    expect(stageVars.targets as Element[]).not.toContain(previewEl());
    expect(stageVars.targets as Element[]).not.toContain(title);

    const titleVars = from.mock.calls[1][1] as Record<string, unknown>;
    expect(titleVars).toMatchObject({
      duration: 0.6,
      ease: SITE_EASE,
      scale: true,
      absolute: true,
    });
    expect(titleVars.targets as Element[]).toEqual([title]);
  });

  // 제목이 착지점 이름 자리 위에서 출발한다(S-1). 그 위에 진짜 이름 글자가
  // 그대로 남아 있으면 날아가는 제목과 제자리 이름이 한 프레임에 겹쳐
  // 읽힌다(S-5). 제목 비행을 실제로 만드는 이 커밋에서 감춰야 한다
  it('제목 비행이 뜨는 순간 착지점 이름이 opacity 0으로 감춰지고, 모달이 닫히면 되돌아온다', async () => {
    renderSection();
    await flushGsapImport();

    const landing = nameFlipEl(READY_INDEX);
    expect(landing.style.opacity).toBe('');

    open();
    await findDialog();

    expect(landing.style.opacity).toBe('0');

    // 비행 중에는 머리띠가 아직 안 나와 '닫기' 단추가 접근성 트리에 없다
    // (land를 안 불렀으므로). 버튼을 누르지 않고, 뒤로가기가 곧장 모달을
    // 걷어가는 popstate 경로로 modalOpen을 false로 만든다. 소비 효과가
    // 유일한 되돌림 경로임을 이걸로 본다
    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(landing.style.opacity).toBe('');
  });
});

describe('ProjectsFlip. 등장은 비행이 끝난 뒤다', { timeout: 30_000 }, () => {
  it('비행 중에는 상세 판 내용이 감춰져 있고, 절반에 머리띠가 먼저 나온 뒤 onComplete가 와야 몸통이 등장한다', async () => {
    const from = vi.spyOn(Flip, 'from');
    // stage 타임라인에 건 tl.call(...)이 무엇을 부르는지 직접 보려고
    // Timeline.call 자체에 spy를 건다(call-through라 실제 동작은 그대로다).
    // ProjectModal의 reveal 배선은 Task R이 실제로 짜 둔 것을 그대로
    // 태우므로 여기서 별도로 흉내내지 않는다
    const timelineCall = vi.spyOn(gsap.core.Timeline.prototype, 'call');
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    // 스크린샷의 증상: 논증 열이 이미 다 그려진 채로 비행이 끝났다
    expect(scrollColumn().style.visibility).toBe('hidden');
    // 이 시점엔 아직 머리띠도 안 나왔다 - getByRole은 visibility:hidden인
    // 노드를 접근성 트리에서 빼므로, scrollColumn처럼 raw DOM으로 집는다
    const headActions = document.querySelector<HTMLElement>('[aria-label="닫기"]')!
      .parentElement!;
    expect(headActions.style.visibility).not.toBe('visible');

    // 비행 절반(0.25s)에 머리띠만 먼저 등장한다(S-3)
    const headCall = timelineCall.mock.calls.find((call) => call[2] === 0.25);
    expect(headCall).toBeDefined();
    act(() => {
      (headCall![0] as () => void)();
    });
    expect(headActions.style.visibility).toBe('visible');
    // 머리띠만 나왔을 뿐 몸통은 그대로 감춰져 있다
    expect(scrollColumn().style.visibility).toBe('hidden');

    // stage 착지(500ms)에야 몸통이 등장한다
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
    // stage(500ms)와 제목(600ms)이 길이가 달라(S-1) Flip.from이 둘로 갈린다
    expect(from).toHaveBeenCalledTimes(2);

    act(() => {
      stageRef(null);
      stageRef(stageEl);
    });

    // 비행은 여전히 둘뿐이고, 등장은 아직 열리지 않았다
    expect(from).toHaveBeenCalledTimes(2);
    expect(scrollColumn().style.visibility).toBe('hidden');

    // 열쇠는 그대로 비행의 onComplete가 쥔다
    land(from);
    expect(scrollColumn().style.visibility).toBe('visible');
  });

  it('관문이 닫힌 경로에서는 감추지 않는다. 안무 없이 처음부터 보인다', async () => {
    installMatchMedia(false);
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    expect(scrollColumn().style.visibility).toBe('');
  });

  it('모달 틀 넷(셸·머리띠·증거 열)이 비행 전체 길이로 power2.in으로 차오른다', async () => {
    // frameTl은 handleStageMount가 만드는 gsap.timeline() 인스턴스의
    // .fromTo()다. 최상위 gsap.fromTo가 아니라 Timeline.prototype.fromTo에
    // 걸어야 한다. 프리뷰 겹 전환(mod.gsap.fromTo)은 최상위 쪽이라 안 섞인다
    const fromTo = vi.spyOn(gsap.core.Timeline.prototype, 'fromTo');
    renderSection();
    await flushGsapImport();

    // open()을 풀어 쓴다. 앞쪽 첫 클릭은 프로젝트 전환 tween을 하나 태우는데
    // 그건 비행이 아니라 프리뷰 안쪽 겹의 일이다. 이 테스트가 묻는 것은
    // "비행이 무엇을 만지느냐"라 그 앞의 것은 잘라 낸다
    fireEvent.click(nameEl(READY_INDEX));
    const beforeFlight = fromTo.mock.calls.length;
    fireEvent.click(nameEl(READY_INDEX));
    await findDialog();

    // 내용 불투명도는 ProjectModal로 넘어갔다. 여기가 크롬에 트윈을 걸면
    // 착지 순간 컨테이너와 자식이 서로 다른 프레임에 되살아나 번쩍인다.
    // 대상이 셸 하나에서 틀 넷으로 넓어졌다(S-2)
    const shell = document.getElementById('pm-shell');
    const head = document.querySelector('[data-modal-part="head"]');
    const evidence = document.querySelector('[data-modal-part="evidence"]');
    const flightCalls = fromTo.mock.calls.slice(beforeFlight);
    expect(flightCalls.map((call) => call[0])).toEqual([shell, head, evidence]);
    // 앞 60%로 끊으면 비행 중반에 접힘 섹션 글자가 날아가는 이미지 너머로
    // 비친다. 이제는 비행 전체 길이(0.5)로 power2.in이다
    for (const call of flightCalls) {
      const to = call[2] as Record<string, unknown>;
      expect(to.duration).toBeCloseTo(0.5);
      expect(to.ease).toBe('power2.in');
    }
  });
});

describe('ProjectsFlip. 관문 넷은 서로 다르다', { timeout: 30_000 }, () => {
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

  // 닫기 비행이 아예 안 뜨는 경로(popstate가 closeModal을 거치지 않고
  // 곧장 modalOpen을 false로 내린다)에서도, 소비 효과가 spread와 프리뷰를
  // 기본값으로 되돌려야 한다. 열기 비행으로 spread를 1까지 밀어붙인 뒤에
  // 봐야 "원래 0이라 아무 것도 안 바뀐" 거짓 통과를 피한다
  it('모달을 비행 없이 닫으면 spread가 0으로, 프리뷰 opacity가 지워진 채로 남는다', async () => {
    const rowHeight = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(69);
    try {
      const to = vi.spyOn(gsap, 'to');
      let onFirstTick: (() => void) | undefined;
      vi.spyOn(gsap.ticker, 'add').mockImplementation(
        (cb: Parameters<typeof gsap.ticker.add>[0]) => {
          onFirstTick = cb as unknown as () => void;
          return cb;
        }
      );
      renderSection();
      await flushGsapImport();

      open();
      await findDialog();
      act(() => {
        onFirstTick!();
      });

      const spreadCall = to.mock.calls.find(
        (call) => typeof (call[0] as { v?: unknown }).v === 'number'
      );
      expect(spreadCall).toBeDefined();
      const [target, vars] = spreadCall as [{ v: number }, { onUpdate: () => void }];
      target.v = 1;
      act(() => {
        vars.onUpdate();
      });

      const other = nameEl(OTHER_INDEX);
      // 벌어진 채로 - spread=1에서 활성 아닌 항목의 opacity는 정확히 0이다
      expect(other.style.opacity).toBe('0');

      act(() => {
        window.history.replaceState(null, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(previewEl().style.opacity).toBe('');
      expect(other.style.opacity).not.toBe('0');
    } finally {
      rowHeight.mockRestore();
    }
  });
});

describe('ProjectsFlip. 닫기 비행', { timeout: 30_000 }, () => {
  // 닫기는 등장이 끝난 판에서만 누를 수 있다. 비행 중에는 머리띠의 단추
  // 묶음이 visibility:hidden이라 접근성 트리에 없다. 실제 사용자도 그
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

  it("붕괴 시작은 'head'(몸통만 접힘)이고, 배경 복원이 착지보다 먼저 온다", async () => {
    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    const closeButton = await openAndGetCloseButton();
    const to = vi.spyOn(gsap, 'to');
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    expect(obscured()).toBe('true');
    const headActions = screen.getByRole('button', { name: '닫기' }).parentElement!;

    fireEvent.click(closeButton);

    // t=0. 붕괴만 시작한다. 비행도 배경 복원도 아직이다.
    // 접기 자체는 ProjectModal 몫이라 여기서는 reveal이 'head'로 내려갔다는
    // 증거를 본다(S-3, 이전에는 false였다). 몸통(논증 열)을 담은 트윈만
    // 퇴장 길이로 뜨고, 머리띠는 이 트윈의 대상에 없어야 한다
    const collapse = to.mock.calls.find((call) =>
      (call[0] as Element[]).includes?.(scrollColumn())
    );
    expect(collapse).toBeDefined();
    expect(collapse![1]).toMatchObject({ opacity: 0, duration: REVEAL_OUT_MS / 1000 });
    expect((collapse![0] as Element[])).not.toContain(headActions);
    expect(fit).not.toHaveBeenCalled();
    expect(obscured()).toBe('true');
    expect(reservations).toHaveLength(1);
    expect(reservations[0].delay).toBeCloseTo(REVEAL_OUT_MS / 1000);

    act(() => {
      reservations[0].run();
    });

    // t=220. 배경이 먼저 돌아오고 비행이 같이 뜬다. finishClose를 통해
    // 간접적으로 두면 착지한 뒤에야 배경이 돌아와 열기와 대칭이 아니다.
    // 머리띠도 이제 비행과 함께 접힌다(reveal 'head' -> false, S-3)
    expect(obscured()).toBe('false');
    expect(fit).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeNull();
    const headOut = to.mock.calls.find(
      (call) =>
        (call[0] as Element[])?.includes?.(headActions) &&
        (call[1] as Record<string, unknown>).duration === 0.2
    );
    expect(headOut).toBeDefined();
  });

  it('닫기의 틀 넷(셸·머리띠·증거 열)은 비행 전체 길이로 power2.out, 비행과 동시에 시작한다', async () => {
    const reservations = stubDelayedCall();
    const to = vi.spyOn(gsap, 'to');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    fireEvent.click(closeButton);
    act(() => {
      reservations[0].run();
    });

    const shell = document.getElementById('pm-shell');
    const head = document.querySelector('[data-modal-part="head"]');
    const evidence = document.querySelector('[data-modal-part="evidence"]');
    for (const target of [shell, head, evidence]) {
      const call = to.mock.calls.find((c) => c[0] === target);
      expect(call).toBeDefined();
      const vars = call![1] as Record<string, unknown>;
      expect(vars.duration).toBeCloseTo(0.5);
      expect(vars.ease).toBe('power2.out');
      // 소스는 delay를 안 넘긴다. GSAP의 Tween 생성자가 넘겨받은 vars
      // 객체에 기본값(0)을 그 자리에서 채워 넣으므로(호출 시점엔 undefined,
      // 관찰 시점엔 0), falsy로 본다. 양수 delay(옛 SHELL_FADE_OUT_DELAY_MS
      // 0.2 같은)가 아니라는 것이 이 테스트의 계약이다
      expect(vars.delay).toBeFalsy();
    }
  });

  it('비행 동안에는 캡션을 치워만 두고 모달이 내려간 뒤에 띠와 글자를 같이 들여보낸다', async () => {
    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    const set = vi.spyOn(gsap, 'set');
    const to = vi.spyOn(gsap, 'to');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    fireEvent.click(closeButton);
    act(() => {
      reservations[0].run();
    });

    const band = document.querySelector('[data-part="preview-caption"]')!;
    const text = document.querySelector('[data-part="preview-caption-text"]')!;
    // 비행이 뜨는 순간에는 치우기만 한다. 이 구간의 프리뷰 상자는 아직
    // 투명한 데다 착지하는 stage가 그 위를 덮으므로, 여기서 열면 아무도
    // 못 본다. 여기서 여는 코드로 되돌리면 이 어서션이 FAIL해야 한다
    const bandStash = set.mock.calls.filter((call) => call[0] === band);
    expect(bandStash).toHaveLength(1);
    // 띠는 폭이 0인 채로 왼쪽 변에 붙어 있다. 오른쪽 변만 100퍼센트 안으로
    // 들어와 있는 값이다
    expect(bandStash[0][1]).toMatchObject({ clipPath: 'inset(0% 100% 0% 0%)' });
    const textStash = set.mock.calls.filter((call) => call[0] === text);
    expect(textStash).toHaveLength(1);
    expect(textStash[0][1]).toMatchObject({ xPercent: -8, opacity: 0 });
    expect(
      to.mock.calls.some((call) => call[0] === band || call[0] === text)
    ).toBe(false);

    // 착지 둘을 다 태워야 모달이 내려간다(S-1과 같은 순서)
    act(() => {
      (fit.mock.calls[0][2] as { onComplete: () => void }).onComplete();
    });
    act(() => {
      (fit.mock.calls[1][2] as { onComplete: () => void }).onComplete();
    });

    const open = to.mock.calls.find((call) => call[0] === band);
    expect(open).toBeDefined();
    const bandVars = open![1] as Record<string, unknown>;
    expect(bandVars.clipPath).toBe('inset(0% 0% 0% 0%)');
    // 인라인 값을 안 걷으면 다음 전환이 이 자리에서 시작한다
    expect(bandVars.clearProps).toBe('clipPath');

    const slide = to.mock.calls.find((call) => call[0] === text);
    expect(slide).toBeDefined();
    const textVars = slide![1] as Record<string, unknown>;
    expect(textVars.xPercent).toBe(0);
    expect(textVars.opacity).toBe(1);
    expect(textVars.clearProps).toBe('transform,opacity');

    // 띠와 글자가 한 덩어리로 읽히려면 길이와 이징이 같아야 한다. 하나라도
    // 어긋나면 어둠이 글자를 앞지르거나 뒤처져 두 겹으로 보인다
    expect(bandVars.ease).toBe(SITE_EASE);
    expect(textVars.ease).toBe(SITE_EASE);
    expect(textVars.duration).toBe(bandVars.duration);
    // 이 등장은 비행이 다 끝나고 혼자 도는 구간이라 비행(500ms)보다 길다
    expect(textVars.duration as number).toBeGreaterThan(0.5);
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

  // 제목 비행이 있는 한(landingEl이 있는 한) stage의 onComplete는 모달을
  // 내리지 않는다. 제목의 onComplete가 100ms 뒤에 대신 내린다. 먼저
  // 내리면 제목이 허공에서 사라진다(S-1)
  it('stage가 착지해도 제목이 아직 날고 있으면 모달이 안 닫히고, 제목의 onComplete가 와야 닫힌다', async () => {
    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    fireEvent.click(closeButton);
    act(() => {
      reservations[0].run();
    });

    expect(fit).toHaveBeenCalledTimes(2);
    const [flying, landing, stageVars] = fit.mock.calls[0] as [
      Element,
      Element,
      Record<string, unknown>,
    ];
    // 날아가는 건 펼침 stage, 착지점은 접힘 프리뷰다. 반대로 두면 접힘 노드가
    // 섹션 상자 밖에서 잘린다
    expect(flying).toBe(document.querySelector('[data-modal-part="stage"]'));
    expect(landing).toBe(previewEl());
    expect(stageVars).toMatchObject({ duration: 0.5, ease: SITE_EASE, scale: true });
    // Flip.fit에 absolute를 주면 안 된다. transform만으로 옮긴다
    expect(stageVars.absolute).toBeUndefined();

    // 착지 전. 모달은 아직 살아 있다
    expect(screen.queryByRole('dialog')).not.toBeNull();

    act(() => {
      (stageVars.onComplete as () => void)();
    });
    // stage만 착지했다. 제목이 아직 안 왔으니 모달은 그대로 열려 있다
    expect(screen.queryByRole('dialog')).not.toBeNull();

    const titleVars = fit.mock.calls[1][2] as Record<string, unknown>;
    act(() => {
      (titleVars.onComplete as () => void)();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // 이 과제의 두 번째 이유. 닫기는 Flip.fit 하나만 돌려서 이미지만 접히고
  // 제목은 셸이 사라질 때 같이 사라졌다. 여는 쪽 Flip.from은 stage와 제목을
  // 한 타임라인에 태우므로 닫는 쪽도 둘 다 되돌려야 대칭이다
  it('제목은 같은 시점에 시작하지만 stage보다 100ms 더 걸려 접힘 이름 자리로 되돌아간다', async () => {
    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    fireEvent.click(closeButton);
    act(() => {
      reservations[0].run();
    });

    expect(fit).toHaveBeenCalledTimes(2);
    const [titleFlying, titleLanding, titleVars] = fit.mock.calls[1] as [
      Element,
      Element,
      Record<string, unknown>,
    ];
    expect(titleFlying).toBe(document.getElementById('pm-title'));
    expect(titleLanding).toBe(nameFlipEl(READY_INDEX));
    // stage는 0.5초, 제목은 0.6초. 길이가 같다고 가정하면 다음에 둘 중
    // 하나만 바뀌어도 안 걸린다. 값을 각각 못 박는다
    const stageVars = fit.mock.calls[0][2] as Record<string, unknown>;
    expect(stageVars.duration).toBeCloseTo(0.5);
    expect(titleVars.duration).toBeCloseTo(0.6);
    expect(titleVars.ease).toBe(stageVars.ease);
    expect(titleVars).toMatchObject({ duration: 0.6, ease: SITE_EASE, scale: true });
  });

  // 펼친 상태에서는 프로젝트를 못 바꾸니 지금은 activeIndex와 열 때 눌린
  // 인덱스가 같다. 같다는 사실에 기대면 언젠가 깨지므로 둘을 갈라 놓고 잰다
  it('착지점은 activeIndex가 아니라 열 때 눌린 인덱스의 이름이다', async () => {
    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    // 펼친 채로 활성 인덱스만 흔든다. 이 시점에 활성은 READY_INDEX이고
    // OTHER_INDEX는 활성이 아니므로, 클릭 한 번은 선택만 옮기고 다시 열지
    // 않는다
    fireEvent.click(nameEl(OTHER_INDEX));
    expect(document.querySelector('[aria-selected="true"]')).toBe(nameEl(OTHER_INDEX));

    fireEvent.click(closeButton);
    act(() => {
      reservations[0].run();
    });

    expect(fit.mock.calls[1][1]).toBe(nameFlipEl(READY_INDEX));
    expect(fit.mock.calls[1][1]).not.toBe(nameFlipEl(OTHER_INDEX));
  });

  // 착지점 이름은 비행 내내 제자리에 그려져 있다. 셸 배경이 비행의 뒤 60%에
  // 빠지므로 마지막 200ms에 날아오는 제목과 제자리 이름이 두 겹으로 읽힌다.
  // visibility가 아니라 opacity인 것은 이 노드가 착지 좌표의 기준이라
  // 레이아웃이 살아 있어야 하기 때문이다
  it('착지점 이름은 비행 동안 opacity로 감췄다가 착지에 되돌린다', async () => {
    const reservations = stubDelayedCall();
    const fit = vi.spyOn(Flip, 'fit');
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    const landing = nameFlipEl(READY_INDEX);
    // 이미 열기 비행이 뜨는 순간부터 감춰져 있다(S-5). 모달이 열려 있는
    // 내내 감춘 채로 있다가 이 닫기 비행에서도 그대로 이어진다
    expect(landing.style.opacity).toBe('0');

    fireEvent.click(closeButton);
    act(() => {
      reservations[0].run();
    });

    expect(landing.style.opacity).toBe('0');
    // 레이아웃이 사라지면 착지 좌표가 어긋난다
    expect(landing.style.visibility).toBe('');
    expect(landing.style.display).toBe('');

    act(() => {
      (fit.mock.calls[1][2] as { onComplete: () => void }).onComplete();
    });
    expect(landing.style.opacity).toBe('');
  });

  it('비행이 중간에 죽어도 착지점 이름은 되돌아온다', async () => {
    const reservations = stubDelayedCall();
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});

    const landing = nameFlipEl(READY_INDEX);
    fireEvent.click(closeButton);
    act(() => {
      reservations[0].run();
    });
    expect(landing.style.opacity).toBe('0');

    // 착지 onComplete가 오지 않는다. popstate가 비행 중에 모달을 걷어간다 -
    // 되돌리는 일이 onComplete 한 곳에만 있으면 이름이 영영 안 보인다
    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(nameFlipEl(READY_INDEX).style.opacity).toBe('');
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
    expect(fit).toHaveBeenCalledTimes(2);
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

describe('ProjectsFlip. 접힘 손잡이는 펼침 중에 뗀다', { timeout: 30_000 }, () => {
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
    expect(nameFlipEl(READY_INDEX).getAttribute('data-flip-id')).toBeNull();
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
    // stage만 착지해서는 모달이 안 닫힌다(S-1). 제목의 onComplete가 와야
    // 손잡이가 돌아온다
    act(() => {
      (fit.mock.calls[1][2] as { onComplete: () => void }).onComplete();
    });

    // 닫히면 접힘 쪽 손잡이가 돌아온다. 다음 펼치기가 짝을 지으려면 필요하다
    expect(previewEl().getAttribute('data-flip-id')).toBe(`pv-${title}`);
    expect(nameFlipEl(READY_INDEX).getAttribute('data-flip-id')).toBe(`title-${title}`);
  });
});

// 첫 클릭이 프로젝트 전환 tween을 띄운 직후 두 번째 클릭이 오는 것은 마우스
// 경로의 기본값이다(openStale/open 둘 다 첫 클릭으로 시작한다). 그 tween이
// 비행의 출발 좌표를 건드리면 펼치기가 통째로 비뚤어진다. 여기서는 모의 없이
// 진짜 gsap을 태우고, 인라인 transform이 어느 노드에 박히는지로 본다.
// jsdom에는 레이아웃 엔진이 없어 좌표는 못 재므로, 좌표를 바꾸는 유일한
// 경로(손잡이 상자 자신의 transform)가 비어 있는지를 대신 본다
describe('ProjectsFlip. 전환 tween이 비행 기하를 안 건드린다', { timeout: 30_000 }, () => {
  it('전환은 프리뷰 안쪽 겹만 움직이고 손잡이 상자는 제자리다', async () => {
    renderSection();
    await flushGsapImport();

    const preview = previewEl();
    const layer = document.querySelector<HTMLElement>('[data-part="preview-media"]')!;
    expect(preview.contains(layer)).toBe(true);
    expect(layer).not.toBe(preview);

    // 활성 인덱스가 실제로 움직여야 전환이 뜬다. 0을 눌러도 이미
    // 0이라 아무 일도 안 일어나고, 그러면 이 테스트는 빈 값을 빈 값과
    // 비교하며 조용히 통과한다
    expect(READY_INDEX).not.toBe(0);
    // 300ms짜리 tween이라 끝나면 clearProps가 transform을 걷어 간다.
    // 첫 프레임을 확실히 붙잡으려고 전역 시계를 세운다
    gsap.globalTimeline.pause();
    try {
      fireEvent.click(nameEl(READY_INDEX));

      // fromTo는 시작 프레임을 즉시 그린다. 겹에는 값이 박혀 있어야 하고
      // (안 박히면 이 테스트가 아무 것도 안 보는 것이다)
      expect(layer.style.transform).not.toBe('');
      expect(layer.style.opacity).not.toBe('');
      // 손잡이 상자에는 하나도 안 묻어야 한다. 여기에 transform이 묻으면
      // Flip.getState가 뜨는 getBoundingClientRect가 그만큼 어긋난다
      expect(preview.style.transform).toBe('');
      expect(preview.style.opacity).toBe('');
    } finally {
      gsap.globalTimeline.play();
    }
  });

  it('전환이 도는 중에 클릭이 와도 getState는 프리뷰 상자를 그대로 뜬다', async () => {
    const getState = vi.spyOn(Flip, 'getState');
    renderSection();
    await flushGsapImport();

    // 전환이 아직 진행 중인 상태에서 곧바로 누른다
    fireEvent.click(nameEl(READY_INDEX));
    const layer = document.querySelector<HTMLElement>('[data-part="preview-media"]')!;
    expect(layer.style.transform).not.toBe('');

    const preview = previewEl();
    fireEvent.click(nameEl(READY_INDEX));

    expect(getState).toHaveBeenCalledTimes(1);
    const targets = getState.mock.calls[0][0] as HTMLElement[];
    expect(targets[0]).toBe(preview);
    // 뜨는 순간에도 손잡이 상자는 여전히 깨끗하다. 전환을 프리뷰 자신에
    // 걸면 여기서 FAIL한다 - openModal이 tween을 먼저 죽이지 않는 한
    expect(preview.style.transform).toBe('');
  });
});

// 계획 5 T2 phase D task Q-2. 새로고침으로 복구된 모달은 openModal을 안
// 거치므로 snapWheel도 없다. 휠 effect가 modalOpen이면 그냥 돌아가 버리면
// 휠 pos는 마운트 때의 기본값(0)에 멈춘 채 DOM에는 그 어떤 자리도
// 못박히지 않는다. 나중에 닫을 때 이 이름의 rect로 제목이 착지해 놓고,
// 모달이 내려간 뒤에야 휠이 비로소 돌아 제자리로 옮겨 가며 튄다
describe('ProjectsFlip. 새로고침 복구 모달의 휠', { timeout: 30_000 }, () => {
  it('복구된 모달이 열린 채로 커밋되면 활성 이름의 휠 자리가 즉시 못박힌다', () => {
    // jsdom은 offsetHeight가 늘 0이라 반지름도 0이고 휠 수식 전체가 죽는다.
    // ProjectsSection.test.tsx의 휠 테스트와 같은 크롬 실측값을 상수로
    // 세워야 pos에 따라 rotate가 갈린다
    const rowHeight = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(69);
    try {
      window.history.replaceState(
        { projectModalId: projects[READY_INDEX].title },
        '',
        '/'
      );

      renderSection();

      const transform = nameEl(READY_INDEX).style.transform;
      const rot = /rotate\((-?[\d.]+)deg\)/.exec(transform)?.[1];
      // 못박히면 활성 이름은 d(=index-pos)가 0이라 회전이 없다. 못박지
      // 않으면 이 효과가 한 번도 안 돌아 transform 자체가 안 걸려 있다 -
      // 어느 쪽이든 '0.000'과는 다른 값(undefined)이 나온다
      expect(rot).toBe('0.000');
    } finally {
      rowHeight.mockRestore();
    }
  });
});

// 계획 5 T2 phase D task Q-1. 새로고침 뒤 첫 열기는 stage의 첫 커밋 자체가
// 무겁다(청크 평가, 첫 렌더). GSAP 트윈은 마지막 tick을 기준으로 시작
// 시각을 잡으므로, 무거운 커밋 안에서 곧바로 play하면 그 막힌 시간이
// 통째로 첫 프레임 진행도에 실린다(node 실측: 60ms 막으면 +46ms). paused로
// 만들고 다음 gsap tick에 play하면 막힘이 안 실린다
describe('ProjectsFlip. 열기 비행이 막힌 프레임을 안 삼킨다', { timeout: 30_000 }, () => {
  // gsap.ticker.add를 관찰만 하면 실제 ticker가 실제 requestAnimationFrame으로
  // 돈다 - findDialog가 기다리는 동안 real time이 흐르므로 콜백이 테스트가
  // 보기도 전에 이미 불려 버려 결과가 요행에 갈린다(레이스). 그래서 add
  // 자체를 가로막아 콜백을 손에만 쥐고, 실제 ticker에는 등록하지 않는다 -
  // 우리가 무엇을 넘겼는가와 kill이 무엇을 빼는가만 결정적으로 본다
  function interceptTickerAdd() {
    let captured: (() => void) | undefined;
    const add = vi
      .spyOn(gsap.ticker, 'add')
      .mockImplementation((cb: Parameters<typeof gsap.ticker.add>[0]) => {
        // 소스가 넘기는 onFirstTick은 인자를 안 받는 () => void다. 실제
        // ticker.add 시그니처(time, deltaTime, frame, elapsed)와는 안
        // 맞지만, 여기선 콜백을 호출 없이 참조만 쥐고 있을 뿐이라 무해하다.
        // 반환값(Callback)도 실제로 안 쓰이니 콜백 자신을 그대로 돌려준다
        captured = cb as unknown as () => void;
        return cb;
      });
    return { add, get callback() { return captured; } };
  }

  it('Flip.from은 stage·제목 둘 다 paused로 뜨고, 재생은 다음 gsap tick의 콜백 안에서만 불린다', async () => {
    const from = vi.spyOn(Flip, 'from');
    const ticker = interceptTickerAdd();
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    // stage와 제목이 길이가 달라(S-1) Flip.from이 둘로 갈린다
    expect(from).toHaveBeenCalledTimes(2);
    const vars = from.mock.calls[0][1] as Record<string, unknown>;
    expect(vars.paused).toBe(true);
    const titleVars = from.mock.calls[1][1] as Record<string, unknown>;
    expect(titleVars.paused).toBe(true);

    // Flip.from이 vars.paused를 그대로 만든 timeline에 넘기므로, 만들자마자는
    // 재생 전이다. 이 시점에 메인 스레드가 아무리 막혀도 그 시간이 비행에
    // 실리지 않는다
    const tl = from.mock.results[0]!.value as { paused: () => boolean };
    const titleTl = from.mock.results[1]!.value as { paused: () => boolean };
    expect(tl.paused()).toBe(true);
    expect(titleTl.paused()).toBe(true);

    expect(ticker.add).toHaveBeenCalledTimes(1);
    expect(ticker.callback).toBeTypeOf('function');

    ticker.callback!();

    expect(tl.paused()).toBe(false);
    expect(titleTl.paused()).toBe(false);
  });

  it('첫 tick 전에 모달이 통째로 사라지면 kill이 ticker에서도 콜백을 뺀다', async () => {
    const from = vi.spyOn(Flip, 'from');
    const ticker = interceptTickerAdd();
    const tickerRemove = vi.spyOn(gsap.ticker, 'remove');
    const view = renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    expect(from).toHaveBeenCalledTimes(2);
    expect(ticker.callback).toBeTypeOf('function');
    expect(tickerRemove).not.toHaveBeenCalledWith(ticker.callback);

    // 첫 tick이 오기 전에 컴포넌트가 통째로 사라진다. 콜백이 죽은
    // timeline을 붙들고 있으면 다음 테스트로 흘러들어 갈 수 있다
    view.unmount();

    expect(tickerRemove).toHaveBeenCalledWith(ticker.callback);
  });

  // 휠이 벌어지는 것(S-4)과 접힘 프리뷰가 빠지는 것(S-6)도 stage·제목
  // 타임라인과 같은 첫 tick 콜백 안에서 같이 만들어진다. 따로 놀면 stage가
  // 이미 날아가는데 휠은 아직 안 벌어진 프레임이 생긴다
  it('첫 tick 콜백이 stage·제목 재생과 함께 spread 트윈·프리뷰 트윈도 만든다', async () => {
    const to = vi.spyOn(gsap, 'to');
    const ticker = interceptTickerAdd();
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    // tick 전에는 아직 안 만들어져 있다
    expect(
      to.mock.calls.some(
        (call) => typeof (call[0] as { v?: unknown }).v === 'number'
      )
    ).toBe(false);

    ticker.callback!();

    const spreadCall = to.mock.calls.find(
      (call) => typeof (call[0] as { v?: unknown }).v === 'number'
    );
    expect(spreadCall).toBeDefined();
    expect(spreadCall![1]).toMatchObject({ v: 1, duration: 0.4, ease: SITE_EASE });

    const previewCall = to.mock.calls.find((call) => call[0] === previewEl());
    expect(previewCall).toBeDefined();
    expect(previewCall![1]).toMatchObject({ opacity: 0, duration: 0.25, ease: SITE_EASE });
  });
});

// 비행하는 상자 안의 그림이 바뀌지 않게 하는 미디어 다리(Task T). jsdom은
// getContext('2d')가 기본 null이라 mock 없이는 snapshotMedia가 늘 null이고
// 다리도 안 생긴다. 그게 기존 테스트 전부가 이 작업 이후로도 그대로 통과하는
// 첫 잠금이다. 아래는 그 mock을 켠 채로 다리 자체의 계약만 본다
describe('ProjectsFlip. 미디어 다리', { timeout: 30_000 }, () => {
  // getContext('2d')를 drawImage가 있는 객체로, video와 img의 내재 크기를
  // 상수로 바꾼다. 이게 없으면(기본 jsdom) snapshotMedia는 늘 null이다
  function mockMediaBridge() {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
      kind: string
    ) => {
      if (kind === '2d') return { drawImage: vi.fn() };
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext);
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1920);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(1080);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1280);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(720);
  }

  async function openAndGetCloseButton() {
    const from = vi.spyOn(Flip, 'from');
    renderSection();
    await flushGsapImport();
    open();
    await findDialog();
    land(from);
    return screen.getByRole('button', { name: '닫기' });
  }

  it('열기 비행이 뜨면 stage 안에 다리가 하나 있고, 착지 뒤 opacity 트윈을 거쳐 사라진다', async () => {
    mockMediaBridge();
    const from = vi.spyOn(Flip, 'from');
    const to = vi.spyOn(gsap, 'to');
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    const stage = document.querySelector('[data-modal-part="stage"]')!;
    const bridges = stage.querySelectorAll('[data-part="media-bridge"]');
    expect(bridges).toHaveLength(1);
    const bridge = bridges[0] as HTMLCanvasElement;
    // 가로 1280 캡(비율 유지, mock 영상은 1920x1080이라 720이 나와야 한다).
    // object-fit과 pointer-events는 프리뷰의 잘림과 맞추고 클릭을 막지
    // 않기 위한 것이라 값 자체가 계약이다
    expect(bridge.width).toBe(1280);
    expect(bridge.height).toBe(720);
    expect(bridge.style.objectFit).toBe('cover');
    expect(bridge.style.pointerEvents).toBe('none');

    land(from);

    // 착지 onComplete가 다리를 곧장 지우지 않는다. 크로스페이드 뒤에
    // 지운다. stage 영상은 착지 시점에 이미 돌고 있으니 그 뒤가 살아 있는
    // 영상이다
    expect(stage.contains(bridge)).toBe(true);
    const fadeCall = to.mock.calls.find((call) => call[0] === bridge);
    expect(fadeCall).toBeDefined();
    expect(fadeCall![1]).toMatchObject({ opacity: 0, duration: 0.25, ease: SITE_EASE });

    act(() => {
      (fadeCall![1] as { onComplete?: () => void }).onComplete?.();
    });
    expect(stage.contains(bridge)).toBe(false);
  });

  it('닫기 비행이 뜨면 stage와 프리뷰 상자에 각각 다리가 하나씩 있고, 모달이 다 내려간 뒤 프리뷰 쪽 것이 사라진다', async () => {
    const fit = vi.spyOn(Flip, 'fit');
    const reservations = stubDelayedCall();
    const closeButton = await openAndGetCloseButton();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    // 열기 비행은 mock 없이(다리 없이) 이미 착지했다. 여기서부터 켜야
    // stage 안에 열기 쪽 다리가 남아 닫기 쪽 개수를 헷갈리게 하지 않는다
    mockMediaBridge();
    const to = vi.spyOn(gsap, 'to');

    const stage = document.querySelector('[data-modal-part="stage"]')!;
    const preview = previewEl();

    fireEvent.click(closeButton);
    act(() => {
      reservations[0].run();
    });

    const stageBridges = stage.querySelectorAll('[data-part="media-bridge"]');
    expect(stageBridges).toHaveLength(1);
    const previewBridges = preview.querySelectorAll('[data-part="media-bridge"]');
    expect(previewBridges).toHaveLength(1);
    expect(stageBridges[0]).not.toBe(previewBridges[0]);
    const previewBridge = previewBridges[0] as HTMLCanvasElement;
    expect(preview.contains(previewBridge)).toBe(true);
    // preview-open 단추의 클릭을 막지 않아야 한다(T-3-2)
    expect(previewBridge.style.pointerEvents).toBe('none');
    // 캡션보다 앞서 있어야 캡션이 다리 위에 그려져 글자가 안 덮인다.
    // ProjectsSection.test.tsx의 모프 캔버스 순서 검사와 같은 방식이다
    const caption = preview.querySelector('[data-part="preview-caption"]')!;
    expect(caption).not.toBeNull();
    expect(
      previewBridge.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // stage 착지와 제목 착지를 둘 다 완료시켜야 모달이 다 내려간다(S-1과
    // 같은 순서, 위 '닫기 비행' describe의 패턴을 그대로 따른다)
    act(() => {
      (fit.mock.calls[0][2] as { onComplete: () => void }).onComplete();
    });
    act(() => {
      (fit.mock.calls[1][2] as { onComplete: () => void }).onComplete();
    });

    // stage 쪽 다리는 모달과 함께 이미 사라졌다(따로 안 지운다, T-3-3).
    // 프리뷰 쪽은 정리 effect가 크로스페이드로 걷는다. 그 시점에 playable이
    // 다시 참이 되어 프리뷰 영상이 이어서 돈다
    const fadeCall = to.mock.calls.find((call) => call[0] === previewBridge);
    expect(fadeCall).toBeDefined();
    expect(fadeCall![1]).toMatchObject({ opacity: 0, duration: 0.25, ease: SITE_EASE });

    act(() => {
      (fadeCall![1] as { onComplete?: () => void }).onComplete?.();
    });
    expect(preview.contains(previewBridge)).toBe(false);
  });

  // 비행이 중간에 죽어도(popstate가 곧장 modalOpen을 false로 내리는 경로)
  // stage는 모달 전체와 함께 통째로 사라지므로, "다리가 DOM에 없다"만
  // 보면 remove()를 안 불러도 그냥 통과한다(부모 서브트리 통째 제거가
  // 이미 그 결과를 만든다). remove가 실제로 불렸는지 자체를 스파이로 본다 -
  // React의 언마운트는 부모의 removeChild를 쓰지 instance의 remove()를
  // 부르지 않으므로, 이 스파이는 오직 flightRef.current.kill의
  // bridge?.remove() 호출에만 반응한다
  it('열기 비행이 중간에 죽으면(popstate) stage 쪽 다리의 remove가 곧장 불린다', async () => {
    mockMediaBridge();
    renderSection();
    await flushGsapImport();

    open();
    await findDialog();

    const stage = document.querySelector('[data-modal-part="stage"]')!;
    const bridge = stage.querySelector('[data-part="media-bridge"]') as HTMLCanvasElement | null;
    expect(bridge).not.toBeNull();
    const removeSpy = vi.spyOn(bridge!, 'remove');

    // 착지 onComplete가 안 왔다 - popstate가 비행 중에 모달을 걷어간다
    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(removeSpy).toHaveBeenCalled();
  });
});
