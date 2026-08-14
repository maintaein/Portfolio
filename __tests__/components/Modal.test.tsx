import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '@/components/atoms/Modal';

function Harness({
  open,
  inertOpener = false,
  ariaHiddenOpener = false,
  includeFocusableContent = true,
  closeOnEsc = true,
  onRestoreFocusFallback,
}: {
  open: boolean;
  inertOpener?: boolean;
  ariaHiddenOpener?: boolean;
  includeFocusableContent?: boolean;
  closeOnEsc?: boolean;
  onRestoreFocusFallback?: () => void;
}) {
  return (
    <>
      <div
        inert={inertOpener || undefined}
        aria-hidden={ariaHiddenOpener || undefined}
      >
        <button data-testid="opener">열기</button>
      </div>
      <button data-testid="outside">바깥 버튼</button>
      <button data-testid="after-outside">바깥 다음 버튼</button>
      <Modal
        isOpen={open}
        onClose={() => {}}
        showCloseButton={false}
        closeOnEsc={closeOnEsc}
        onRestoreFocusFallback={onRestoreFocusFallback}
      >
        {includeFocusableContent ? (
          <>
            <button data-testid="first">첫 버튼</button>
            <button data-testid="last">끝 버튼</button>
          </>
        ) : (
          <p>포커스 가능한 요소 없음</p>
        )}
      </Modal>
    </>
  );
}

describe('Modal 포커스 관리', () => {
  it('열리면 내부 첫 포커스 가능 요소로 포커스가 간다', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    render(<Harness open />);
    const first = screen.getByTestId('first');

    await vi.waitFor(() => {
      expect(first).toHaveFocus();
    });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('Tab이 모달 밖으로 새지 않는다', async () => {
    render(<Harness open />);
    await vi.waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());

    await userEvent.tab();
    expect(screen.getByTestId('last')).toHaveFocus();

    const firstFocus = vi.spyOn(screen.getByTestId('first'), 'focus');
    await userEvent.tab();
    expect(screen.getByTestId('first')).toHaveFocus();
    expect(firstFocus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('Shift+Tab이 첫 요소에서 마지막으로 순환한다', async () => {
    render(<Harness open />);
    await vi.waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());

    const lastFocus = vi.spyOn(screen.getByTestId('last'), 'focus');
    await userEvent.tab({ shift: true });
    expect(screen.getByTestId('last')).toHaveFocus();
    expect(lastFocus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('패널 밖에서 시작한 Tab은 모달 첫 요소로 되돌린다', async () => {
    render(<Harness open />);
    const outside = screen.getByTestId('outside');
    await vi.waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());

    outside.focus();
    await userEvent.tab();
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('패널 밖에서 시작한 Shift+Tab은 모달 마지막 요소로 되돌린다', async () => {
    render(<Harness open />);
    const outside = screen.getByTestId('outside');
    await vi.waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());

    outside.focus();
    await userEvent.tab({ shift: true });
    expect(screen.getByTestId('last')).toHaveFocus();
  });

  it('닫히면 열기 전 요소로 포커스가 돌아온다', async () => {
    const { rerender } = render(<Harness open={false} />);
    const opener = screen.getByTestId('opener');
    opener.focus();

    rerender(<Harness open />);
    await vi.waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());

    const openerFocus = vi.spyOn(opener, 'focus');
    rerender(<Harness open={false} />);
    await vi.waitFor(() => expect(opener).toHaveFocus());
    expect(openerFocus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('열기 전 요소가 제거되면 안전한 포커스 fallback을 호출한다', async () => {
    const fallback = vi.fn();
    const { rerender } = render(
      <Harness open={false} onRestoreFocusFallback={fallback} />
    );
    screen.getByTestId('opener').focus();

    rerender(<Harness open onRestoreFocusFallback={fallback} />);
    await vi.waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());
    rerender(
      <Modal
        isOpen={false}
        onClose={() => {}}
        onRestoreFocusFallback={fallback}
      >
        <p>열린 요소 제거됨</p>
      </Modal>
    );

    await vi.waitFor(() => expect(fallback).toHaveBeenCalledTimes(1));
  });

  it('열기 전 요소가 inert가 되면 안전한 포커스 fallback을 호출한다', async () => {
    const fallback = vi.fn();
    const { rerender } = render(
      <Harness open={false} onRestoreFocusFallback={fallback} />
    );
    screen.getByTestId('opener').focus();

    rerender(<Harness open onRestoreFocusFallback={fallback} />);
    await vi.waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());
    rerender(
      <Harness
        open={false}
        inertOpener
        onRestoreFocusFallback={fallback}
      />
    );

    await vi.waitFor(() => expect(fallback).toHaveBeenCalledTimes(1));
  });

  it('열기 전 요소가 aria-hidden 아래로 이동하면 안전한 포커스 fallback을 호출한다', async () => {
    const fallback = vi.fn();
    const { rerender } = render(
      <Harness open={false} onRestoreFocusFallback={fallback} />
    );
    screen.getByTestId('opener').focus();

    rerender(<Harness open onRestoreFocusFallback={fallback} />);
    await vi.waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());
    rerender(
      <Harness
        open={false}
        ariaHiddenOpener
        onRestoreFocusFallback={fallback}
      />
    );

    await vi.waitFor(() => expect(fallback).toHaveBeenCalledTimes(1));
  });

  it('포커스 가능한 요소가 하나면 정방향과 역방향 Tab이 그 요소에 머문다', async () => {
    render(
      <Modal isOpen onClose={() => {}} showCloseButton={false}>
        <button data-testid="only">유일한 버튼</button>
      </Modal>
    );
    const only = screen.getByTestId('only');
    await vi.waitFor(() => expect(only).toHaveFocus());

    await userEvent.tab();
    expect(only).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(only).toHaveFocus();
  });

  it('포커스 가능한 요소가 없어도 Tab 리스너에서 예외가 발생하지 않는다', async () => {
    const errors: ErrorEvent[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(event);
      event.preventDefault();
    };
    window.addEventListener('error', onError);

    try {
      const { rerender } = render(
        <Harness open={false} includeFocusableContent={false} />
      );
      const outside = screen.getByTestId('outside');
      outside.focus();

      rerender(<Harness open includeFocusableContent={false} />);
      await vi.waitFor(() => {
        expect(screen.getByText('포커스 가능한 요소 없음')).toBeInTheDocument();
      });

      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      expect(errors).toHaveLength(0);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(outside);
    } finally {
      window.removeEventListener('error', onError);
    }
  });

  it('닫힌 뒤에는 Tab 트랩 리스너가 남지 않고 포커스가 연결된 요소에 머문다', async () => {
    const removeEventListener = vi.spyOn(document, 'removeEventListener');

    try {
      const { rerender } = render(<Harness open={false} closeOnEsc={false} />);
      const opener = screen.getByTestId('opener');
      const outside = screen.getByTestId('outside');
      opener.focus();

      rerender(<Harness open closeOnEsc={false} />);
      await vi.waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());
      rerender(<Harness open={false} closeOnEsc={false} />);
      await vi.waitFor(() => expect(opener).toHaveFocus());

      outside.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(outside);
      expect(
        removeEventListener.mock.calls.filter(([type]) => type === 'keydown')
      ).toHaveLength(1);
    } finally {
      removeEventListener.mockRestore();
    }
  });

  it('ESC로 onClose가 불린다', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} showCloseButton={false}>
        <button>내용</button>
      </Modal>
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
