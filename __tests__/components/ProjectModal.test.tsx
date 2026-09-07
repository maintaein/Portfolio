import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectModal from '@/components/blocks/ProjectModal';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
import type { Project } from '@/types';

const project: Project = {
  title: 'Accessible Project',
  image: '/projects/test.webp',
  tags: [],
};

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const MODAL = read('components/blocks/ProjectModal/index.tsx');
const SECTION = read('components/sections/ProjectsSection/index.tsx');
const RICH_TEXT = read('lib/utils/richText.tsx');

describe('ProjectModal accessibility', () => {
  it('gives the dialog an accessible name through its existing title', async () => {
    render(<ProjectModal isOpen onClose={vi.fn()} project={project} />);

    const dialog = await screen.findByRole('dialog', { name: project.title });
    expect(dialog).toHaveAccessibleName(project.title);
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
  });
});

// 모달은 검정 위에 뜨는 흰 문서였다. 나머지 섹션과 테마가 끊겨 있었고,
// 섹션의 좌우 페이드는 검은 페이지 위에 흰 띠로 남아 있었다.
describe('프로젝트 섹션과 모달의 어두운 테마', () => {
  it('테일윈드 팔레트 색을 쓰지 않는다', () => {
    expect(findTailwindPaletteColorUtilities(MODAL)).toEqual([]);
    expect(findTailwindPaletteColorUtilities(SECTION)).toEqual([]);
    expect(findTailwindPaletteColorUtilities(RICH_TEXT)).toEqual([]);
  });

  it('강조색은 시안 하나뿐이다', () => {
    // 파랑·초록·보라·주황·빨강이 단계마다 하나씩 붙어 있어 아무것도
    // 강조되지 않았다. 남은 색은 사이트 공용 시안 토큰뿐이어야 한다.
    for (const source of [MODAL, SECTION, RICH_TEXT]) {
      expect(source).not.toMatch(/rgba?\(\s*49[,\s]+130[,\s]+246/);
      expect(source).not.toMatch(/rgba?\(\s*99[,\s]+160[,\s]+255/);
      expect(source.match(/--color-cyan-(?:core|hi)/g)?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('모달 판은 흰색이 아니라 거의 불투명한 검정이다', () => {
    expect(MODAL).toContain('bg-[rgb(6_8_10_/_0.97)]');
    expect(MODAL).not.toContain('bg-white');
  });

  it('섹션의 좌우 페이드가 페이지 바탕과 같은 검정에서 시작한다', () => {
    expect(SECTION).not.toContain('rgba(255,255,255,0.95)');
    expect(SECTION.match(/linear-gradient\((?:90|270)deg, rgba\(0,0,0,0\.9\)/g)).toHaveLength(2);
  });

  // 모서리는 판(2xl)과 그 안의 면(lg), 그리고 칩(full) 세 단만 쓴다.
  it('모서리 반경을 세 단으로 묶는다', () => {
    expect(MODAL).not.toMatch(/rounded-(?:xl|sm|none)\b/);
    expect(MODAL.match(/rounded-2xl/g)).toHaveLength(1);
  });
});

// 다섯 단계가 똑같은 상자 다섯 개였다. 순서만 있고 흐름이 없었고,
// 라벨이 내용보다 크고 밝아서 이미 아는 단어가 증거보다 크게 읽혔다.
describe('리뷰는 상자가 아니라 한 줄기로 읽힌다', () => {
  it('다섯 단계가 축 하나 위의 마디로 놓인다', () => {
    // 단계마다 두르던 면이 사라졌다.
    expect(MODAL).not.toContain('rounded-lg border-l border-[rgb(255_255_255_/_0.14)]');
    expect(MODAL.match(/<Stage(?=[\s>])/g)).toHaveLength(5);
  });

  it('단계 라벨은 내용보다 작고 흐리다', () => {
    // 라벨은 발판이라 3단 회색 10px, 문제 진술이 리뷰에서 제일 큰 글자다.
    expect(MODAL).toContain(
      'text-[10px] font-bold uppercase tracking-[0.16em] text-[rgb(255_255_255_/_0.42)]'
    );
    expect(MODAL).toContain(
      'text={review.problem} className="text-[14px] text-[var(--color-text-primary)]'
    );
  });

  it('분석에서 채워진 선택지는 고른 것 하나뿐이다', () => {
    // 탈락한 대안은 테두리만 남는다. 시안은 고른 순간과 도착한 순간에만 붙는다.
    expect(MODAL).toContain("      : 'border border-[rgb(255_255_255_/_0.12)]'");
    expect(MODAL.match(/bg-\[var\(--color-cyan-core\)\]/g)?.length ?? 0).toBeGreaterThan(0);
  });
});
