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
describe('리뷰는 P/A/A/R 네 단으로 읽힌다', () => {
  it('네 단계가 축 하나 위의 마디로 놓인다', () => {
    // 단계마다 두르던 면이 사라졌고, 트레이드오프는 실행 밑으로 들어가
    // 축이 문제·분석·실행·결과 네 단이 됐다.
    expect(MODAL).not.toContain('rounded-lg border-l border-[rgb(255_255_255_/_0.14)]');
    expect(MODAL.match(/<Stage(?=[\s>])/g)).toHaveLength(4);
    expect(MODAL.indexOf('<TradeOffBlock')).toBeLessThan(MODAL.indexOf('<ResultBlock'));
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

  it('분석 항목을 제목 줄과 근거 줄로 가른다', () => {
    // 데이터가 "**머리**: 본문" 꼴이라 훑는 사람은 제목만 읽으면 된다.
    expect(MODAL).toContain('function splitHead(');
    expect(MODAL).toContain('function parseAnalysis(');
  });

  it('분석에서 채워진 선택지는 고른 것 하나뿐이다', () => {
    // 탈락한 대안은 테두리만 남는다. 시안은 고른 순간과 도착한 순간에만 붙는다.
    expect(MODAL).toContain(": 'border border-[rgb(255_255_255_/_0.12)]'");
    expect(MODAL.match(/bg-\[var\(--color-cyan-core\)\]/g)?.length ?? 0).toBeGreaterThan(0);
  });

  it('섹션에 상주하던 조작 설명서를 없앤다', () => {
    expect(SECTION).not.toContain('click again for detail');
  });
});

// 기능 목록이 두 번째에 앉아 있어서, 판단이 드러나는 리뷰와 기술 선정이
// 그 뒤로 밀렸다. 아무것도 감추지 않고 읽는 순서만 바꾼다.
describe('모달은 판단부터 보여주고 기능 목록으로 끝난다', () => {
  it('구현 사항이 맨 마지막이다', () => {
    const order = ['프로젝트 요약', 'Project Review', '기술 스택 & 선정 이유', '배운 점', '구현 사항'].map(
      (label) => MODAL.indexOf(`<SectionLabel>${label}</SectionLabel>`)
    );
    expect(Math.min(...order)).toBeGreaterThan(0);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('맨 뒤로 간 구현 사항도 앞 블록과 줄로 갈린다', () => {
    // 요약 밑에 붙어 있을 땐 필요 없던 가름줄을, 자리를 옮겼으니 붙인다.
    expect(MODAL.match(/border-t border-\[rgb\(255_255_255_\/_0\.10\)\] mb-6/g)).toHaveLength(5);
  });
});
