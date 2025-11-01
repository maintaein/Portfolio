// Modal을 동적 import로 사용하기 위한 래퍼

'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

// Modal 컴포넌트를 동적으로 로드 (SSR 비활성화)
const DynamicModal = dynamic(() => import('./index'), {
  ssr: false,
  loading: () => null, // 로딩 중에는 아무것도 표시하지 않음
});

type ModalSize = 'small' | 'medium' | 'large' | 'full';

interface DynamicModalProps {
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

export default function Modal(props: DynamicModalProps) {
  return <DynamicModal {...props} />;
}

