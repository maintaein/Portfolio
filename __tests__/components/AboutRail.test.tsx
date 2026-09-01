import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AboutRail from '@/components/sections/AboutSection/rail';
import { coreValues } from '@/lib/data';

const DESIGN_TOKENS_CSS = readFileSync(
  resolve(process.cwd(), 'styles/design-tokens.css'),
  'utf8'
);

describe('AboutRail', () => {
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

  it('활성 눈금에 광휘가 있다', () => {
    const rule = DESIGN_TOKENS_CSS.match(
      /\n {2}\.about-rail-tick-active\s*\{([\s\S]*?)\n {2}\}/
    )?.[1];
    expect(rule, '.about-rail-tick-active 규칙을 찾지 못했다').toBeDefined();
    expect(rule).toMatch(/box-shadow/);
    expect(rule).toMatch(/cyan/);
  });
});
