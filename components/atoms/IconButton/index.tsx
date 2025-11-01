// components/atoms/IconButton/index.tsx
'use client';

import { cn } from '@/lib/utils/cn';
import { ButtonHTMLAttributes, ReactNode, useState } from 'react';

type IconButtonVariant = 'fill' | 'weak' | 'ghost';
type IconButtonSize = 'small' | 'medium' | 'large';
type IconButtonColor = 'blue' | 'purple' | 'gray' | 'green' | 'red';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  color?: IconButtonColor;
  'aria-label': string;
}

const colorStyles: Record<IconButtonColor, Record<IconButtonVariant, string>> = {
  blue: {
    fill: 'bg-blue-600 text-white hover:bg-blue-700',
    weak: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    ghost: 'text-blue-600 hover:bg-blue-50',
  },
  purple: {
    fill: 'bg-purple-600 text-white hover:bg-purple-700',
    weak: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    ghost: 'text-purple-600 hover:bg-purple-50',
  },
  gray: {
    fill: 'bg-gray-600 text-white hover:bg-gray-700',
    weak: 'bg-gray-50 text-gray-700 hover:bg-gray-100',
    ghost: 'text-gray-600 hover:bg-gray-50',
  },
  green: {
    fill: 'bg-green-600 text-white hover:bg-green-700',
    weak: 'bg-green-50 text-green-700 hover:bg-green-100',
    ghost: 'text-green-600 hover:bg-green-50',
  },
  red: {
    fill: 'bg-red-600 text-white hover:bg-red-700',
    weak: 'bg-red-50 text-red-700 hover:bg-red-100',
    ghost: 'text-red-600 hover:bg-red-50',
  },
};

const sizeStyles: Record<IconButtonSize, string> = {
  small: 'p-1.5 text-sm',
  medium: 'p-2 text-base',
  large: 'p-3 text-lg',
};

export default function IconButton({
  icon,
  variant = 'ghost',
  size = 'medium',
  color = 'gray',
  disabled,
  className,
  onClick,
  ...props
}: IconButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsPressed(true);
    onClick?.(e);
    
    // 최소 200ms 동안 pressed 상태 유지
    setTimeout(() => {
      setIsPressed(false);
    }, 150);
  };

  return (
    <button
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        // 기본 스타일
        'inline-flex items-center justify-center',
        'rounded-lg font-medium',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        
        // 색상별 focus ring
        color === 'blue' && 'focus-visible:ring-blue-500',
        color === 'purple' && 'focus-visible:ring-purple-500',
        color === 'gray' && 'focus-visible:ring-gray-500',
        color === 'green' && 'focus-visible:ring-green-500',
        color === 'red' && 'focus-visible:ring-red-500',
        
        // 클릭 효과 (최소 200ms 유지)
        isPressed ? 'scale-95' : 'scale-100',
        
        // 비활성화
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100',
        
        colorStyles[color][variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}