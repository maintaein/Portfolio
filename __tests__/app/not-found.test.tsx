import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotFound from '@/app/not-found';

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

  it('라이트 테마 클래스가 남아 있지 않다', () => {
    const { container } = render(<NotFound />);
    const html = container.innerHTML;
    for (const cls of ['bg-white', 'text-gray-900', 'text-gray-500', 'bg-blue-600', 'text-blue-500']) {
      expect(html, `${cls}가 남아 있다`).not.toContain(cls);
    }
  });
});
