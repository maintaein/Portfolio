import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorPage from '@/app/error';

describe('app/error.tsx', () => {
  const err = Object.assign(new Error('boom'), { digest: 'abc123' });

  it('제목과 안내 문구를 보여준다', () => {
    render(<ErrorPage error={err} reset={() => {}} />);
    expect(screen.getByRole('heading', { name: '문제가 발생했습니다' })).toBeInTheDocument();
  });

  it('다시 시도 버튼이 reset을 호출한다', async () => {
    const reset = vi.fn();
    render(<ErrorPage error={err} reset={reset} />);
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('라이트 테마 클래스가 남아 있지 않다', () => {
    const { container } = render(<ErrorPage error={err} reset={() => {}} />);
    const html = container.innerHTML;
    for (const cls of ['bg-white', 'text-gray-900', 'text-gray-500', 'bg-gray-900', 'text-white']) {
      expect(html, `${cls}가 남아 있다`).not.toContain(cls);
    }
  });

  it('버튼이 채워진 박스가 아니라 헤어라인 테두리를 쓴다', () => {
    const { container } = render(<ErrorPage error={err} reset={() => {}} />);
    const button = screen.getByRole('button', { name: '다시 시도' });
    expect(button.className).toContain('border');
    expect(container.innerHTML).not.toContain('rounded-lg');
  });
});
