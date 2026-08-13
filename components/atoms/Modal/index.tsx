'use client';

import { cn } from '@/lib/utils/cn';
import { ReactNode, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/atoms/Icon';

type ModalSize = 'small' | 'medium' | 'large' | 'full';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  title?: string;
  headerAction?: ReactNode;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  className?: string;
  onRestoreFocusFallback?: () => void;
  ariaLabelledBy?: string;
}

const sizeStyles: Record<ModalSize, string> = {
  small: 'max-w-md',
  medium: 'max-w-2xl',
  large: 'max-w-4xl',
  full: 'max-w-7xl',
};

export default function Modal({
  isOpen,
  onClose,
  children,
  size = 'medium',
  title,
  headerAction,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  className,
  onRestoreFocusFallback,
  ariaLabelledBy,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFallbackRef = useRef(onRestoreFocusFallback);
  restoreFallbackRef.current = onRestoreFocusFallback;

  // SSR 대응: 클라이언트에서만 Portal 렌더링
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, closeOnEsc, onClose]);

  // body 스크롤 방지 및 모달 스크롤 위치 복원
  useEffect(() => {
    if (isOpen) {
      // 모달 열릴 때 스크롤 최상단으로 이동
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }

      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // 모달이 열리기 직전의 포커스를 기억하고, 닫힐 때 안전하게 복귀한다.
  useEffect(() => {
    if (!isOpen || !mounted) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (!panel) return;

    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter((element) => {
        const style = window.getComputedStyle(element);
        return (
          !element.hasAttribute('hidden') &&
          !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      });

    const first = focusables()[0];
    first?.focus({ preventScroll: true });

    // D7의 유일한 키보드 경로인 Tab이 모달 뒤 콘텐츠로 빠져나가지 않게 한다.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const list = focusables();
      if (list.length === 0) return;

      const firstFocusable = list[0];
      const lastFocusable = list[list.length - 1];
      const focusOutsidePanel = !panel.contains(document.activeElement);

      if (event.shiftKey && (document.activeElement === firstFocusable || focusOutsidePanel)) {
        event.preventDefault();
        lastFocusable.focus({ preventScroll: true });
      } else if (!event.shiftKey && (document.activeElement === lastFocusable || focusOutsidePanel)) {
        event.preventDefault();
        firstFocusable.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);

      const target = restoreRef.current;
      const unavailable =
        !target?.isConnected ||
        Boolean(target.closest('[inert], [aria-hidden="true"]'));

      if (unavailable) {
        restoreFallbackRef.current?.();
      } else {
        target.focus({ preventScroll: true });
      }
    };
  }, [isOpen, mounted]);

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[1050] flex items-center justify-center p-4"
      style={{ zIndex: 1050 }}
    >
      <div
        className="absolute inset-0 bg-grey-opacity-800 transition-opacity duration-base"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className={cn(
          'relative bg-white rounded-xl shadow-xl w-full transition-all duration-base',
          'flex flex-col max-h-[90vh]', // 최대 높이 제한
          sizeStyles[size],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : ariaLabelledBy}
      >
        {(title || headerAction || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-grey-200 flex-shrink-0">
            {title && (
              <h2 id="modal-title" className="text-t3 font-bold text-grey-900">
                {title}
              </h2>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {headerAction}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-grey-500 hover:text-grey-700 hover:bg-grey-100 rounded-lg transition-colors duration-fast"
                  aria-label="닫기"
                >
                  <Icon name="close" size="medium" />
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={contentRef} className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );

  // mounted 체크로 SSR 안전성 확보
  return createPortal(modalContent, document.body);
}
