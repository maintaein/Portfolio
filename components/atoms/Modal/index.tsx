// components/atoms/Modal/index.tsx
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
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  className?: string;
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
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  className,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // SSR 대응: 클라이언트에서만 Portal 렌더링
  // Next.js에서 document를 사용하려면 클라이언트 확인 필수!
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

    // ✅ Next.js 권장: useEffect 내부에서 document 사용
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

      // ✅ Next.js 권장: useEffect 내부에서 document.body 접근
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // ✅ SSR 안전: mounted가 false면 렌더링 안 함
  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[1050] flex items-center justify-center p-4"
      style={{ zIndex: 1050 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-grey-opacity-800 transition-opacity duration-base"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          'relative bg-white rounded-xl shadow-xl w-full transition-all duration-base',
          'flex flex-col max-h-[90vh]', // 최대 높이 제한
          sizeStyles[size],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header - 고정 */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-grey-200 flex-shrink-0">
            {title && (
              <h2 id="modal-title" className="text-t3 font-bold text-grey-900">
                {title}
              </h2>
            )}
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
        )}

        {/* Content - 스크롤 가능 */}
        <div ref={contentRef} className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );

  // ✅ Next.js 권장: Portal은 클라이언트에서만 사용
  // mounted 체크로 SSR 안전성 확보
  return createPortal(modalContent, document.body);
}