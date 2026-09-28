import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { gsap } from 'gsap';
import AboutRail from '@/components/sections/AboutSection/rail';
import { coreValues } from '@/lib/data';

const DESIGN_TOKENS_CSS = readFileSync(
  resolve(process.cwd(), 'styles/design-tokens.css'),
  'utf8'
);

afterEach(() => vi.restoreAllMocks());

describe('AboutRail', () => {
  it('keeps one marker centered on the measured active button and moves it through a stretching trail', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      const index = Array.from(this.parentElement?.querySelectorAll('button') ?? []).indexOf(this as HTMLButtonElement);
      return index < 0 ? 0 : [10, 67, 151][index];
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'BUTTON' ? 44 : 0;
    });
    const timeline = vi.spyOn(gsap, 'timeline');
    const { container, rerender } = render(<AboutRail activeIndex={0} onSelect={vi.fn()} />);
    const marker = container.querySelector<HTMLElement>('[data-about-rail-marker]');
    expect(marker).not.toBeNull();
    expect(container.querySelectorAll('[data-about-rail-marker]')).toHaveLength(1);
    expect(marker?.style.top).toBe('32px');

    rerender(<AboutRail activeIndex={2} onSelect={vi.fn()} />);
    const motion = timeline.mock.results.at(-1)?.value as gsap.core.Timeline;
    expect(motion).toBeDefined();
    motion.time(0.3);
    const stretchedHeight = parseFloat(marker!.style.height);
    expect(stretchedHeight).toBeGreaterThan(24);
    motion.time(0.45);
    expect(parseFloat(marker!.style.height)).toBeLessThan(stretchedHeight);
    expect(parseFloat(marker!.style.top)).toBeLessThan(173);
    motion.progress(1);
    expect(marker?.style.top).toBe('173px');
    expect(marker?.style.height).toBe('24px');
  });

  it('snaps the marker to the measured center with reduced motion', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      const index = Array.from(this.parentElement?.querySelectorAll('button') ?? []).indexOf(this as HTMLButtonElement);
      return index < 0 ? 0 : [10, 67, 151][index];
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'BUTTON' ? 44 : 0;
    });
    const timeline = vi.spyOn(gsap, 'timeline');
    const { container, rerender } = render(
      <AboutRail activeIndex={0} onSelect={vi.fn()} reducedMotion />
    );
    rerender(<AboutRail activeIndex={1} onSelect={vi.fn()} reducedMotion />);
    const marker = container.querySelector<HTMLElement>('[data-about-rail-marker]');
    expect(marker?.style.top).toBe('89px');
    expect(marker?.style.height).toBe('24px');
    expect(timeline).not.toHaveBeenCalled();
  });

  it('measures the marker when About becomes active', () => {
    let buttonTop = -200;
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'BUTTON' ? buttonTop : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'BUTTON' ? 44 : 0;
    });
    const timeline = vi.spyOn(gsap, 'timeline');
    const { container, rerender } = render(
      <AboutRail activeIndex={0} onSelect={vi.fn()} active={false} />
    );
    buttonTop = 168;
    rerender(<AboutRail activeIndex={0} onSelect={vi.fn()} active />);
    const marker = container.querySelector<HTMLElement>('[data-about-rail-marker]');
    expect(marker?.style.top).toBe('190px');
    expect(timeline).not.toHaveBeenCalled();
  });
  // 첫 시안은 순번을 11px 회색으로 뒀는데 02와 03이 있다는 것조차 보이지
  // 않았다. 채용 담당자가 못 보면 콘텐츠 3분의 2가 없는 것과 같다.
  it('세 라벨이 전부 텍스트로 존재한다', () => {
    render(<AboutRail activeIndex={0} onSelect={vi.fn()} />);
    for (const v of coreValues) {
      expect(screen.getByText(v.label)).toBeInTheDocument();
    }
  });

  it('라벨이 순번이 아니라 뜻을 담는다', () => {
    expect(coreValues.map((v) => v.label)).toEqual([
      'BASICS',
      'AI WORKFLOW',
      'TEAMWORK',
    ]);
  });

  it('활성 항목에 aria-current를 준다', () => {
    render(<AboutRail activeIndex={1} onSelect={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: new RegExp(coreValues[1].label) })
    ).toHaveAttribute('aria-current', 'true');
  });

  it('누르면 그 번호로 onSelect를 부른다', async () => {
    const onSelect = vi.fn();
    render(<AboutRail activeIndex={0} onSelect={onSelect} />);
    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(coreValues[2].label) })
    );
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  // 리뷰 발견 1: 브리프 테스트 주석은 "순번을 11px 회색으로 뒀더니 안
  // 보였다"고 경고했는데 코드 예시는 text-t8(11px)을 그대로 썼다. 가독성이
  // 레일 폭보다 우선이라 활성 t6(15px)·비활성 t7(13px)로 올렸고, 활성과
  // 비활성의 크기 차이도 이걸로 생긴다. 최소값 t8로 되돌리면 FAIL한다.
  it('활성 라벨은 t6, 비활성 라벨은 t7이다 (t8로 되돌리면 FAIL)', () => {
    render(<AboutRail activeIndex={0} onSelect={vi.fn()} />);
    const active = screen.getByText(coreValues[0].label);
    const inactive = screen.getByText(coreValues[1].label);
    expect(active.className).toMatch(/\btext-t6\b/);
    expect(active.className).not.toMatch(/\btext-t8\b/);
    expect(inactive.className).toMatch(/\btext-t7\b/);
    expect(inactive.className).not.toMatch(/\btext-t8\b/);
  });

  // 모바일에 hover가 없다. 정지 상태에서 눌린다는 것이 드러나야 한다.
  it('세 항목 전부 44px 터치 타깃을 갖는다', () => {
    const { container } = render(<AboutRail activeIndex={0} onSelect={vi.fn()} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(3);
    for (const b of buttons) {
      expect(b.className).toMatch(/\bh-11\b/);
    }
  });

  // 구분선에 디자인이 있다. 굵기가 변하고 끝이 둥글고 활성 눈금에 광휘가
  // 번진다. 선 하나로 되돌리면 FAIL한다.
  it('구분선이 그라데이션이고 끝이 둥글다', () => {
    const rule = DESIGN_TOKENS_CSS.match(
      /\n {2}\.about-rail-line\s*\{([\s\S]*?)\n {2}\}/
    )?.[1];
    expect(rule, '.about-rail-line 규칙을 찾지 못했다').toBeDefined();
    expect(rule).toMatch(/linear-gradient/);
    expect(rule).toMatch(/border-radius/);
  });

  // Task 7 조사: 버튼 세 개가 전부 absolute로 top: %에 걸려 있으면 nav
  // 자체가 흐름 안 자식을 하나도 못 봐서 높이가 0으로 무너지고, top: %
  // 값도 0을 기준으로 계산돼 세 버튼이 전부 같은 자리에 겹친다. lg
  // 미만에서는 버튼을 흐름에 두고 쌓아 실제 높이를 만든 뒤, lg부터
  // absolute + top: %로 되돌려 깊이 배치를 쓴다.
  it('lg 미만에서 버튼이 흐름에 남아 nav에 실제 높이를 준다 (0px 붕괴 방지)', () => {
    const { container } = render(<AboutRail activeIndex={0} onSelect={vi.fn()} />);
    const buttons = container.querySelectorAll('button');
    for (const b of buttons) {
      const tokens = b.className.split(/\s+/);
      expect(tokens).not.toContain('absolute');
      expect(tokens).toContain('lg:absolute');
    }
  });

  it('활성 눈금에 광휘가 있다', () => {
    const rule = DESIGN_TOKENS_CSS.match(
      /\n {2}\.about-rail-tick-active\s*\{([\s\S]*?)\n {2}\}/
    )?.[1];
    expect(rule, '.about-rail-tick-active 규칙을 찾지 못했다').toBeDefined();
    expect(rule).toMatch(/box-shadow/);
    expect(rule).toMatch(/cyan/);
  });
});
