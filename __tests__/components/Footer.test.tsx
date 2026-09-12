import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Footer from '@/components/sections/Footer';
import { contact } from '@/lib/data';

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  // jsdom 기본값에는 navigator.clipboard가 없다. 심었던 것만 되돌린다.
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('Footer — 하단 한 줄 Contact Rail', () => {
  it('문서 흐름에서 빠져 뷰포트 하단에 고정된다(표제 계약의 구조적 증거)', () => {
    // 예전 버그: <footer>가 position:static이라 fixed 셸(.section-stage)
    // 아래 유일한 흐름 콘텐츠가 되어 문서 원점(y=0)에 렌더되고, 섹션 배경이
    // 투명해 모든 섹션 위로 비쳐 보였다. fixed + bottom-0이면 흐름에
    // 참여하지 않으므로 그 경로가 구조적으로 사라진다 — 이 클래스를 빼면(즉
    // 예전처럼 일반 흐름으로 되돌리면) 이 어서션이 FAIL해야 한다.
    render(<Footer atOverview={false} />);
    const footer = screen.getByRole('contentinfo');

    expect(footer).toHaveClass('fixed');
    expect(footer).toHaveClass('bottom-0');
    expect(footer).toHaveClass('inset-x-0');
  });

  it('overview에서는 감춰지고 섹션에서는 보인다', () => {
    // 착지 화면에 연락처 줄이 깔려 있으면 안 된다. 실제 이동과 페이드는
    // design-tokens.css가 쥐고 있고 jsdom에는 레이아웃 엔진이 없으므로,
    // 여기서는 그 규칙을 부르는 클래스가 맞게 갈리는지만 잠근다.
    const { rerender } = render(<Footer atOverview />);
    const footer = screen.getByRole('contentinfo');

    expect(footer).toHaveClass('site-footer-hidden');
    expect(footer).not.toHaveClass('site-footer-visible');

    rerender(<Footer atOverview={false} />);
    expect(footer).toHaveClass('site-footer-visible');
    expect(footer).not.toHaveClass('site-footer-hidden');
  });

  it('이메일 복사 버튼·저작권·github 링크가 모두 있다', () => {
    render(<Footer atOverview={false} />);
    const footer = screen.getByRole('contentinfo');
    const year = new Date().getFullYear();

    expect(
      screen.getByRole('button', { name: /이메일 주소.*복사/ })
    ).toBeInTheDocument();
    // 이번 변경의 핵심이라 반대 방향으로 잠근다 — mailto 앵커가 한 곳도
    // 남으면 안 된다. 되돌아가면 이 어서션이 FAIL해야 한다.
    expect(footer.querySelector('a[href^="mailto:"]')).toBeNull();
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
    render(<Footer atOverview={false} />);
    const footer = screen.getByRole('contentinfo');

    expect(footer).toHaveClass('site-footer');
    expect(footer).not.toHaveAttribute('style');
  });

  it('대형 CONTACT CTA 문구를 복제하지 않는다', () => {
    // CONTACT 섹션으로 "옮긴" 것이지 "복제"한 것이 아님을 반대 방향으로
    // 고정한다 — 이 문구가 하단 줄에도 남아 있으면 FAIL해야 한다.
    render(<Footer atOverview={false} />);
    const footer = screen.getByRole('contentinfo');

    expect(footer).not.toHaveTextContent('함께 만들 기회가 있다면');
  });

  it('이메일 버튼을 클릭하면 navigator.clipboard.writeText가 이메일 주소로 불린다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    render(<Footer atOverview={false} />);
    const button = screen.getByRole('button', { name: /이메일 주소.*복사/ });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeText).toHaveBeenCalledWith(contact.email);
  });

  it('접근 이름에 실제 이메일 주소가 포함된다(스크린리더가 주소를 알 수 있는 유일한 경로)', () => {
    // 보이는 두 span이 모두 aria-hidden이라, 접근 이름이 주소를 담지 않으면
    // 보조기술 사용자는 주소 자체를 알 방법이 없다. aria-label을 고정 문구로
    // 되돌리면 이 어서션이 FAIL해야 한다.
    render(<Footer atOverview={false} />);
    const button = screen.getByRole('button', { name: /이메일 주소.*복사/ });

    expect(button).toHaveAccessibleName(new RegExp(contact.email));
  });

  it('복사 성공 시 라벨이 COPIED가 되고, 2초 뒤 이메일 주소로 돌아온다', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    render(<Footer atOverview={false} />);
    const button = screen.getByRole('button', { name: /이메일 주소.*복사/ });

    await act(async () => {
      fireEvent.click(button);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(button).toHaveTextContent('COPIED');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(button).toHaveTextContent(contact.email);
  });

  it('복사 실패 시 라벨이 SELECT EMAIL이 되고, 2초 뒤 select-all 이메일 주소로 돌아온다', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubClipboard(writeText);

    render(<Footer atOverview={false} />);
    const button = screen.getByRole('button', { name: /이메일 주소.*복사/ });

    await act(async () => {
      fireEvent.click(button);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(button).toHaveTextContent('SELECT EMAIL');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(button).toHaveTextContent(contact.email);
    expect(button.querySelector('.select-all')).not.toBeNull();
  });

  it('aria-live 영역이 초기 렌더부터 DOM에 있다', () => {
    // live region은 내용이 바뀌기 전부터 DOM에 있어야 읽힌다. 나중에 끼워
    // 넣으면 스크린리더가 못 읽는다는 게 이 어서션의 존재 이유다.
    render(<Footer atOverview={false} />);
    const live = screen.getByRole('status');

    expect(live).toBeInTheDocument();
    expect(live).toHaveClass('sr-only');
  });

  it('이메일 버튼 안에 보이지 않는 고스트 라벨이 폭을 예약한다', () => {
    render(<Footer atOverview={false} />);
    const button = screen.getByRole('button', { name: /이메일 주소.*복사/ });
    const ghost = button.querySelector('span[aria-hidden="true"].invisible');

    expect(ghost).not.toBeNull();
    expect(ghost).toHaveTextContent(contact.email);
    // select-all은 복사가 한 번 실패한 뒤(SELECTABLE)에만 붙는다. 아직
    // 실패한 적 없는 기본 상태(IDLE)에 항상 붙어 있으면 실패 전용 탈출구가
    // 아니게 되므로 반대 방향으로도 잠근다.
    expect(button.querySelector('.select-all')).toBeNull();
  });

  it('언마운트 시 리셋 타이머가 clearTimeout으로 정리된다', async () => {
    // React 19부터 언마운트 후 setState는 조용히 no-op이라 콘솔 경고로는
    // 정리 누락을 잡을 수 없다. clearTimeout 호출 자체를 본다.
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    const { unmount } = render(<Footer atOverview={false} />);
    const button = screen.getByRole('button', { name: /이메일 주소.*복사/ });

    await act(async () => {
      fireEvent.click(button);
      await vi.advanceTimersByTimeAsync(0);
    });

    const clearSpy = vi.spyOn(global, 'clearTimeout');
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
