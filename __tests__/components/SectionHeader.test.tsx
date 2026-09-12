import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SectionHeader from '@/components/blocks/SectionHeader';
import { gsap, SITE_EASE } from '@/lib/gsap';

// WordmarkFlip.test.tsx와 같은 규약이다. '@/lib/gsap'을 모킹하지 않고
// 실제 모듈의 최상위 gsap.to/gsap.set을 spyOn으로만 관찰한다. 이 컴포넌트는
// gsap.timeline() 대신 delay로 위치를 준 개별 gsap.to(...) 호출을 쓴다
// (node_modules/gsap/gsap-core.js 확인: Timeline.prototype.to는
// _createTweenType을 부르고, 최상위로 내보내는 gsap.to는 Tween.to다. 둘은
// 서로 다른 함수라 타임라인 메서드 호출은 이 spy로 보이지 않는다).
function baseProps() {
  return {
    current: 1,
    total: 5,
    label: 'ABOUT',
    actionLabel: 'NEXT · PROJECTS',
    onAction: vi.fn(),
    motionReady: true,
    reducedMotion: false,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SectionHeader: 01/05 위치 텍스트', () => {
  it('한 자리 값을 두 자리로 0패딩한다', () => {
    render(<SectionHeader {...baseProps()} current={1} total={5} />);
    expect(screen.getByText('01/05')).toBeInTheDocument();
  });

  it('전체 개수가 두 자리(10 이상)여도 앞자리를 채운다', () => {
    render(<SectionHeader {...baseProps()} current={3} total={12} />);
    expect(screen.getByText('03/12')).toBeInTheDocument();
  });

  it('전체 개수가 두 자리이고 현재도 두 자리면 그대로 찍는다', () => {
    render(<SectionHeader {...baseProps()} current={12} total={12} />);
    expect(screen.getByText('12/12')).toBeInTheDocument();
  });
});

describe('SectionHeader: 장식 레일은 순수 장식이다', () => {
  it('레일 컨테이너는 aria-hidden이고 인터랙티브 자손이 없다', () => {
    render(<SectionHeader {...baseProps()} />);
    const rail = screen.getByTestId('section-rail');

    expect(rail).toHaveAttribute('aria-hidden', 'true');
    // 뮤테이션: 레일 안에 버튼/링크/입력을 하나라도 추가하면 이 질의가
    // 0보다 큰 길이를 돌려줘 FAIL한다.
    const interactive = rail.querySelectorAll(
      'button, a, input, select, textarea, [tabindex]'
    );
    expect(interactive).toHaveLength(0);
  });

  it('눈금 개수는 total과 정확히 같다', () => {
    render(<SectionHeader {...baseProps()} total={7} />);
    expect(screen.getAllByTestId('section-rail-tick')).toHaveLength(7);
  });

  it('total이 바뀌면 눈금 개수도 그만큼만 다시 그린다', () => {
    render(<SectionHeader {...baseProps()} total={2} />);
    expect(screen.getAllByTestId('section-rail-tick')).toHaveLength(2);
  });
});

describe('SectionHeader: 액션 버튼', () => {
  it('클릭 한 번에 onAction이 정확히 한 번 불린다', () => {
    const onAction = vi.fn();
    render(<SectionHeader {...baseProps()} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('버튼 문구는 actionLabel과 정확히 같다(대소문자·구분점 그대로)', () => {
    const { rerender } = render(
      <SectionHeader {...baseProps()} actionLabel="NEXT · PROJECTS" />
    );
    expect(screen.getByRole('button').textContent).toBe('NEXT · PROJECTS');

    rerender(<SectionHeader {...baseProps()} actionLabel="EMAIL" />);
    expect(screen.getByRole('button').textContent).toBe('EMAIL');

    rerender(<SectionHeader {...baseProps()} actionLabel="COPIED" />);
    expect(screen.getByRole('button').textContent).toBe('COPIED');
  });
});

describe('SectionHeader: GSAP 커서 이동', () => {
  it('최초 마운트는 gsap.set만 쓴다. 이동이 아니라 배치다', () => {
    const setSpy = vi.spyOn(gsap, 'set');
    const toSpy = vi.spyOn(gsap, 'to');

    render(<SectionHeader {...baseProps()} current={3} total={5} />);

    expect(setSpy).toHaveBeenCalled();
    expect(toSpy).not.toHaveBeenCalled();
  });

  it('motionReady && !reducedMotion에서 current가 바뀌면 gsap.to(left, 0.5s, SITE_EASE)로 커서를 옮긴다', () => {
    const toSpy = vi.spyOn(gsap, 'to');
    const { rerender } = render(
      <SectionHeader {...baseProps()} current={1} total={5} />
    );
    const cursor = screen.getByTestId('section-rail-cursor');
    toSpy.mockClear();

    rerender(<SectionHeader {...baseProps()} current={2} total={5} />);

    // current=2, total=5 -> progressPct = (2-1)/(5-1)*100 = 25%
    const moveCall = toSpy.mock.calls.find(
      (call) => call[0] === cursor && typeof call[1] === 'object' && 'left' in (call[1] as object)
    );
    expect(moveCall, 'left를 옮기는 gsap.to 호출을 찾지 못했다').toBeDefined();
    const [, vars] = moveCall!;
    expect(vars).toMatchObject({ left: '25%', duration: 0.5, ease: SITE_EASE });
  });

  it('reducedMotion이면 current가 바뀌어도 gsap.to는 절대 불리지 않고 gsap.set만 쓴다', () => {
    const setSpy = vi.spyOn(gsap, 'set');
    const toSpy = vi.spyOn(gsap, 'to');
    const { rerender } = render(
      <SectionHeader {...baseProps()} current={1} total={5} reducedMotion />
    );
    setSpy.mockClear();

    rerender(<SectionHeader {...baseProps()} current={2} total={5} reducedMotion />);

    expect(toSpy).not.toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalled();
  });

  it('motionReady가 false면 current가 바뀌어도 gsap.to는 절대 불리지 않고 gsap.set만 쓴다', () => {
    const setSpy = vi.spyOn(gsap, 'set');
    const toSpy = vi.spyOn(gsap, 'to');
    const { rerender } = render(
      <SectionHeader {...baseProps()} current={1} total={5} motionReady={false} />
    );
    setSpy.mockClear();

    rerender(
      <SectionHeader {...baseProps()} current={2} total={5} motionReady={false} />
    );

    expect(toSpy).not.toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalled();
  });

  it('두 칸 이상 건너뛰면 지나가는 눈금에도 gsap.to(height/opacity)가 걸린다', () => {
    const toSpy = vi.spyOn(gsap, 'to');
    const { rerender } = render(
      <SectionHeader {...baseProps()} current={1} total={5} />
    );
    const ticks = screen.getAllByTestId('section-rail-tick');
    toSpy.mockClear();

    // 1 -> 4(0-based 0 -> 3)로 건너뛰면 인덱스 1, 2 눈금이 "지나가는" 눈금이다.
    rerender(<SectionHeader {...baseProps()} current={4} total={5} />);

    const tickWaveCall = toSpy.mock.calls.find((call) => {
      const targets = Array.isArray(call[0]) ? call[0] : [call[0]];
      return (
        targets.includes(ticks[1]) &&
        targets.includes(ticks[2]) &&
        typeof call[1] === 'object' &&
        'height' in (call[1] as object)
      );
    });
    expect(tickWaveCall, '지나가는 눈금을 건드리는 gsap.to 호출을 찾지 못했다').toBeDefined();
  });
});

describe('SectionHeader: NEXT 미리보기(호버/포커스)', () => {
  it('다음 섹션이 있으면 호버로 목적지 눈금만 밝아지고, 언호버로 되돌아온다', async () => {
    render(<SectionHeader {...baseProps()} current={1} total={5} />);
    const ticks = screen.getAllByTestId('section-rail-tick');
    const button = screen.getByRole('button');

    // current=1(0-based 0)의 다음 눈금은 0-based 인덱스 1이다.
    expect(ticks[1]!.style.height).toBe('6px');

    await userEvent.hover(button);
    expect(ticks[1]!.style.height).toBe('10px');
    // 다른 눈금은 그대로다. 전부 밝아지는 뮤테이션을 잡는다.
    expect(ticks[0]!.style.height).toBe('6px');
    expect(ticks[2]!.style.height).toBe('6px');

    await userEvent.unhover(button);
    expect(ticks[1]!.style.height).toBe('6px');
  });

  it('포커스/블러도 같은 목적지 눈금을 밝히고 되돌린다', () => {
    render(<SectionHeader {...baseProps()} current={1} total={5} />);
    const ticks = screen.getAllByTestId('section-rail-tick');
    const button = screen.getByRole('button');

    fireEvent.focus(button);
    expect(ticks[1]!.style.height).toBe('10px');

    fireEvent.blur(button);
    expect(ticks[1]!.style.height).toBe('6px');
  });

  it('마지막 섹션(다음이 없음)이면 호버해도 어떤 눈금도 밝아지지 않는다', async () => {
    render(<SectionHeader {...baseProps()} current={5} total={5} />);
    const ticks = screen.getAllByTestId('section-rail-tick');
    const button = screen.getByRole('button');

    await userEvent.hover(button);

    for (const tick of ticks) {
      expect(tick.style.height).toBe('6px');
    }
  });
});
