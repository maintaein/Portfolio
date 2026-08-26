import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContactSection from '@/components/sections/ContactSection';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
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

  it('팔레트 위반이 0건이다, 기본 상태와 복사됨 상태 둘 다', async () => {
    // 옛 Footer:57의 text-blue-400을 옮겨온 흔적, 그리고 감사에서 지적된
    // text-white·border-white/20·emerald-500·emerald-400이 되살아나면
    // findTailwindPaletteColorUtilities가 잡는다. 시스템 팔레트는 시안
    // (--color-cyan-core/--color-cyan-hi)과 --color-text-*, --color-elevation-*,
    // --color-hairline 같은 시맨틱 토큰이다. 뮤테이션 (g)는 copied 분기(복사됨
    // 상태)에서만 등장하므로 클릭 전후 둘 다 확인해야 잡힌다.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { container } = render(<ContactSection />);
    expect(findTailwindPaletteColorUtilities(container.innerHTML)).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: '이메일 복사' }));
    await screen.findByText('복사됨');
    expect(findTailwindPaletteColorUtilities(container.innerHTML)).toEqual([]);
  });

  it('transition-all이 아니라 실제로 애니메이션하는 속성만 지정한다, 뮤테이션 (f)', () => {
    // transition-all은 의도치 않은 속성(레이아웃 속성 포함)까지 전부
    // 애니메이션한다. 이 버튼이 실제로 바꾸는 것은 색·배경·테두리 색뿐이므로
    // transition-colors로 좁힌다.
    const { container } = render(<ContactSection />);

    expect(container.innerHTML).not.toMatch(/transition-all/);
    expect(container.innerHTML).toMatch(/transition-colors/);
  });

  it('ease-in-out이 아니라 이 저장소의 이징 토큰을 쓴다', () => {
    // design-tokens.css의 .section-hidden/.section-visible/.nav-strip-visible이
    // 전부 cubic-bezier(0.22, 1, 0.36, 1)을 쓴다. 이 버튼도 같은 곡선으로
    // 맞춘다.
    const { container } = render(<ContactSection />);

    expect(container.innerHTML).not.toMatch(/\bease-in-out\b/);
    expect(container.innerHTML).toMatch(
      /ease-\[cubic-bezier\(0\.22,1,0\.36,1\)\]/
    );
  });

  it('제목 크기가 text-2xl/text-3xl이 아니라 t1~t8 스케일이다', () => {
    render(<ContactSection />);
    const heading = screen.getByRole('heading', {
      name: /함께 만들 기회가 있다면/,
    });

    expect(heading.className).not.toMatch(/\btext-2xl\b|\btext-3xl\b/);
    expect(heading.className).toMatch(/\btext-t\d\b/);
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
