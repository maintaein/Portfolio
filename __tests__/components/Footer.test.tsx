import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Footer from '@/components/sections/Footer';
import { contact } from '@/lib/data';

describe('Footer — 하단 한 줄 크롬', () => {
  it('문서 흐름에서 빠져 뷰포트 하단에 고정된다(표제 계약의 구조적 증거)', () => {
    // 예전 버그: <footer>가 position:static이라 fixed 셸(.section-stage)
    // 아래 유일한 흐름 콘텐츠가 되어 문서 원점(y=0)에 렌더되고, 섹션 배경이
    // 투명해 모든 섹션 위로 비쳐 보였다. fixed + bottom-0이면 흐름에
    // 참여하지 않으므로 그 경로가 구조적으로 사라진다 — 이 클래스를 빼면(즉
    // 예전처럼 일반 흐름으로 되돌리면) 이 어서션이 FAIL해야 한다.
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');

    expect(footer).toHaveClass('fixed');
    expect(footer).toHaveClass('bottom-0');
    expect(footer).toHaveClass('inset-x-0');
  });

  it('이메일·저작권·github 세 항목이 모두 있다', () => {
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    const year = new Date().getFullYear();

    // 셋 중 하나라도 빠지면 FAIL해야 한다 — 각각 독립 어서션.
    expect(
      screen.getByRole('link', { name: contact.email })
    ).toHaveAttribute('href', `mailto:${contact.email}`);
    expect(footer).toHaveTextContent(
      `© ${year} ${contact.name}. All rights reserved.`
    );
    expect(
      screen.getByRole('link', {
        name: contact.githubUrl.replace('https://', ''),
      })
    ).toHaveAttribute('href', contact.githubUrl);
  });

  it('높이를 인라인 style이 아니라 site-footer 토큰 클래스로 소유한다', () => {
    // 320px에서 세 줄로 접히는 문제(H4)를 좁은 화면 미디어쿼리로 풀려면
    // 높이가 CSS 클래스여야 한다. 인라인 style은 media query를 못 받는다.
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');

    expect(footer).toHaveClass('site-footer');
    expect(footer).not.toHaveAttribute('style');
  });

  it('대형 CONTACT CTA 문구를 복제하지 않는다', () => {
    // CONTACT 섹션으로 "옮긴" 것이지 "복제"한 것이 아님을 반대 방향으로
    // 고정한다 — 이 문구가 하단 줄에도 남아 있으면 FAIL해야 한다.
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');

    expect(footer).not.toHaveTextContent('함께 만들 기회가 있다면');
    expect(footer.querySelector('button')).toBeNull();
  });
});
