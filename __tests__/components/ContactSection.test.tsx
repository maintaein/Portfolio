import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContactSection from '@/components/sections/ContactSection';
import { contact } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ContactSection — Footer의 CTA를 옮겨받은 여섯 번째 섹션', () => {
  it('id·eyebrow·대형 문구·이메일을 모두 담는다', () => {
    const { container } = render(<ContactSection />);

    expect(container.querySelector(`#${SECTION_IDS.CONTACT}`)).not.toBeNull();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /함께 만들 기회가 있다면/ })
    ).toBeInTheDocument();
    expect(screen.getByText(contact.email)).toBeInTheDocument();
  });

  it('팔레트 위반(text-blue-*)이 0건이다', () => {
    // 옛 Footer:57의 text-blue-400을 그대로 옮기면 이 어서션이 FAIL해야
    // 한다 — 시스템 팔레트는 시안(--color-cyan-core/--color-cyan-hi)이다.
    const { container } = render(<ContactSection />);

    expect(container.innerHTML.match(/\btext-blue-\d+/g)).toBeNull();
  });

  it('복사 버튼을 누르면 이메일이 클립보드로 복사되고 상태 문구가 바뀐다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ContactSection />);
    fireEvent.click(screen.getByRole('button', { name: '이메일 복사' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(contact.email));
    await screen.findByText('복사됨');
  });
});
