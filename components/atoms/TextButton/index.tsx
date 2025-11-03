'use client';

import { cn } from '@/lib/utils/cn';
import { ButtonHTMLAttributes, ReactNode, useState } from 'react';

type TextButtonSize = 'small' | 'medium' | 'large';
type TextButtonColor = 'blue' | 'purple' | 'gray' | 'green' | 'red';

interface TextButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  children: ReactNode;
  size?: TextButtonSize;
  color?: TextButtonColor;
  underline?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const colorStyles: Record<TextButtonColor, string> = {
  blue: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
  purple: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50',
  gray: 'text-gray-600 hover:text-gray-700 hover:bg-gray-50',
  green: 'text-green-600 hover:text-green-700 hover:bg-green-50',
  red: 'text-red-600 hover:text-red-700 hover:bg-red-50',
};

const sizeStyles: Record<TextButtonSize, { base: string; icon: string }> = {
  small: {
    base: 'text-sm px-2 py-1',
    icon: 'w-4 h-4',
  },
  medium: {
    base: 'text-base px-3 py-1.5',
    icon: 'w-5 h-5',
  },
  large: {
    base: 'text-lg px-4 py-2',
    icon: 'w-6 h-6',
  },
};

export default function TextButton({
  children,
  size = 'medium',
  color = 'blue',
  underline = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  onClick,
  ...props
}: TextButtonProps) {
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
        'inline-flex items-center justify-center gap-2',
        'rounded-md font-medium',
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
        
        // 밑줄
        underline && 'underline underline-offset-2',
        
        colorStyles[color],
        sizeStyles[size].base,
        className
      )}
      {...props}
    >
      {leftIcon && <span className={sizeStyles[size].icon}>{leftIcon}</span>}
      {children}
      {rightIcon && <span className={sizeStyles[size].icon}>{rightIcon}</span>}
    </button>
  );
}