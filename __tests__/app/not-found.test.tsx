import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotFound from '@/app/not-found';
import { findTailwindPaletteColorUtilities } from '../helpers/tailwindPalette';

describe('app/not-found.tsx', () => {
  it('404 라벨과 제목을 보여준다', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument();
  });

  it('홈으로 가는 링크가 있다', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: '홈으로 돌아가기' });
    expect(link).toHaveAttribute('href', '/');
  });

  it('Tailwind 팔레트 색상 유틸리티가 남아 있지 않다', () => {
    const { container } = render(<NotFound />);
    expect(findTailwindPaletteColorUtilities(container.innerHTML)).toEqual([]);
  });

  it('링크가 채워진 박스가 아니라 헤어라인 테두리를 쓴다', () => {
    const { container } = render(<NotFound />);
    const link = screen.getByRole('link', { name: '홈으로 돌아가기' });
    expect(link.className).toContain('border');
    expect(container.innerHTML).not.toContain('rounded-lg');
  });
});
