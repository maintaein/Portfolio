import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExperienceSection from '@/components/sections/ExperienceSection';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'components/sections/ExperienceSection/index.tsx'),
  'utf8'
);

// PNG는 8바이트 시그니처 뒤에 바로 IHDR이 오고, 폭과 높이가 16~23바이트에
// 빅엔디언 4바이트씩 들어 있다. 라이브러리 없이 읽는다.
function pngSize(file: string): { width: number; height: number } {
  const buffer = readFileSync(resolve(process.cwd(), 'public/logos-mono', file));
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// 슬롯은 높이 44px에 폭 상한 120px이다. 마스크가 contain이라 실제 렌더 폭은
// 원본 비율로 정해지고, 워드마크는 상한에 걸린다.
const SLOT_HEIGHT = 44;
const SLOT_MAX_WIDTH = 120;

describe('ExperienceSection', () => {
  it('세 조직을 최신순 DOM 순서로 렌더한다', () => {
    render(<ExperienceSection />);

    const nodes = document.querySelectorAll('[data-experience-node]');
    expect([...nodes].map((node) => node.getAttribute('data-experience-node'))).toEqual([
      'FASOO',
      '삼성청년SW아카데미',
      '지능정보SW아카데미',
    ]);
  });

  it('노드 안의 DOM 순서가 화면에 읽히는 순서와 같다', () => {
    render(<ExperienceSection />);

    const node = document.querySelector('[data-experience-node="FASOO"]')!;
    const fields = [...node.querySelectorAll('[data-experience-field]')].map((element) =>
      element.getAttribute('data-experience-field')
    );

    expect(fields).toEqual(['period', 'company', 'position', 'responsibilities', 'skills']);
  });

  it('노드가 축 위아래로 번갈아 앉는다', () => {
    render(<ExperienceSection />);

    const sides = [...document.querySelectorAll('[data-experience-node]')].map((node) =>
      node.getAttribute('data-experience-side')
    );

    expect(sides).toEqual(['above', 'below', 'above']);
  });

  it('진행 중인 경력 하나에만 CURRENT를 준다', () => {
    render(<ExperienceSection />);

    const current = document.querySelectorAll('[data-experience-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute('data-experience-node')).toBe('FASOO');
    expect(screen.getByText('CURRENT')).toBeInTheDocument();
  });

  it('로고 마스크가 실제로 있는 파일을 가리킨다', () => {
    render(<ExperienceSection />);

    const logos = [...document.querySelectorAll('[data-experience-logo]')];
    expect(logos).toHaveLength(experiences.length);

    for (const logo of logos) {
      const source = (logo as HTMLElement).style.getPropertyValue('--org-logo-src');
      const file = source.match(/\/logos-mono\/([\w-]+\.png)\)/)?.[1];
      expect(file, `--org-logo-src를 읽을 수 없다: ${source}`).toBeDefined();
      // 파일이 없으면 여기서 예외가 난다.
      expect(pngSize(file!).width).toBeGreaterThan(0);
    }
  });

  it('로고 슬롯 폭이 원본 비율에서 나온 값과 맞는다', () => {
    render(<ExperienceSection />);

    for (const logo of document.querySelectorAll('[data-experience-logo]')) {
      const element = logo as HTMLElement;
      const file = element.style
        .getPropertyValue('--org-logo-src')
        .match(/\/logos-mono\/([\w-]+\.png)\)/)![1];
      const { width, height } = pngSize(file);
      const expected = Math.min(SLOT_MAX_WIDTH, Math.round((SLOT_HEIGHT * width) / height));

      expect(Number.parseInt(element.style.width, 10), `${file}의 슬롯 폭`).toBe(expected);
    }
  });

  it('가로 레일이 섹션 스와이프를 가로채지 않고 키보드로 잡힌다', () => {
    render(<ExperienceSection />);

    const rail = screen.getByRole('region', { name: /타임라인/ });
    expect(rail).toHaveAttribute('data-section-swipe-ignore');
    expect(rail).toHaveAttribute('tabindex', '0');
    expect(rail.className).toContain('section-horizontal-scroll');
    expect(rail.className).toContain('overflow-x-auto');
  });

  it('기술 칩을 노드마다 그대로 둔다', () => {
    render(<ExperienceSection />);

    for (const experience of experiences) {
      const node = document.querySelector(`[data-experience-node="${experience.company}"]`)!;
      const skills = node.querySelector('[data-experience-field="skills"]')!;
      for (const skill of experience.skills ?? []) {
        expect(skills.textContent).toContain(skill);
      }
    }
  });

  it('카드 박스와 팔레트 색을 쓰지 않는다', () => {
    expect(SOURCE).not.toMatch(/\bBadge\b/);
    expect(SOURCE).not.toMatch(/rounded-(?:xl|2xl|3xl)/);
    expect(SOURCE).not.toMatch(/\bshadow-/);
    expect(findTailwindPaletteColorUtilities(SOURCE)).toEqual([]);
  });

  it('섹션 id를 유지한다', () => {
    const { container } = render(<ExperienceSection />);
    expect(container.querySelector(`#${SECTION_IDS.EXPERIENCE}`)).not.toBeNull();
  });
});
