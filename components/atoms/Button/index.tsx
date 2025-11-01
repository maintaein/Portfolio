// components/atoms/Button/index.tsx
'use client';

import { cn } from '@/lib/utils/cn';
import { ButtonHTMLAttributes, ReactNode, useState } from 'react';

type ButtonVariant = 'fill' | 'weak' | 'outline' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'large';
type ButtonColor = 'blue' | 'purple' | 'gray' | 'green' | 'red';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  color?: ButtonColor;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const colorStyles: Record<ButtonColor, Record<ButtonVariant, string>> = {
  blue: {
    fill: 'bg-blue-600 text-white hover:bg-blue-700',
    weak: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
    ghost: 'text-blue-600 hover:bg-blue-50',
  },
  purple: {
    fill: 'bg-purple-600 text-white hover:bg-purple-700',
    weak: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    outline: 'border-2 border-purple-600 text-purple-600 hover:bg-purple-50',
    ghost: 'text-purple-600 hover:bg-purple-50',
  },
  gray: {
    fill: 'bg-gray-600 text-white hover:bg-gray-700',
    weak: 'bg-gray-50 text-gray-700 hover:bg-gray-100',
    outline: 'border-2 border-gray-600 text-gray-600 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-50',
  },
  green: {
    fill: 'bg-green-600 text-white hover:bg-green-700',
    weak: 'bg-green-50 text-green-700 hover:bg-green-100',
    outline: 'border-2 border-green-600 text-green-600 hover:bg-green-50',
    ghost: 'text-green-600 hover:bg-green-50',
  },
  red: {
    fill: 'bg-red-600 text-white hover:bg-red-700',
    weak: 'bg-red-50 text-red-700 hover:bg-red-100',
    outline: 'border-2 border-red-600 text-red-600 hover:bg-red-50',
    ghost: 'text-red-600 hover:bg-red-50',
  },
};

const sizeStyles: Record<ButtonSize, { base: string; icon: string }> = {
  small: {
    base: 'px-3 py-1.5 text-sm',
    icon: 'w-4 h-4',
  },
  medium: {
    base: 'px-4 py-2 text-base',
    icon: 'w-5 h-5',
  },
  large: {
    base: 'px-6 py-3 text-lg',
    icon: 'w-6 h-6',
  },
};

export default function Button({
  children,
  variant = 'fill',
  size = 'medium',
  color = 'blue',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  onClick,
  ...props
}: ButtonProps) {
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
      disabled={disabled || isLoading}
      onClick={handleClick}
      className={cn(
        // 기본 스타일
        'inline-flex items-center justify-center gap-2',
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
        sizeStyles[size].base,
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <svg
          className={cn('animate-spin', sizeStyles[size].icon)}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <>
          {leftIcon && <span className={sizeStyles[size].icon}>{leftIcon}</span>}
          {children}
          {rightIcon && <span className={sizeStyles[size].icon}>{rightIcon}</span>}
        </>
      )}
    </button>
  );
}