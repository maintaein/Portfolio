import { cn } from '@/lib/utils/cn';
import { ReactNode } from 'react';

type BadgeColor = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'gray' | 'grey' | 'pink' | 'cyan';
type BadgeVariant = 'fill' | 'weak' | 'outline';
type BadgeSize = 'small' | 'medium' | 'large';

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const colorStyles: Record<BadgeColor, Record<BadgeVariant, string>> = {
  blue: {
    fill: 'bg-blue-500 text-white',
    weak: 'bg-blue-50 text-blue-700',
    outline: 'border border-blue-500 text-blue-700',
  },
  purple: {
    fill: 'bg-purple-500 text-white',
    weak: 'bg-purple-50 text-purple-700',
    outline: 'border border-purple-500 text-purple-700',
  },
  green: {
    fill: 'bg-green-500 text-white',
    weak: 'bg-green-50 text-green-700',
    outline: 'border border-green-500 text-green-700',
  },
  orange: {
    fill: 'bg-orange-500 text-white',
    weak: 'bg-orange-50 text-orange-700',
    outline: 'border border-orange-500 text-orange-700',
  },
  red: {
    fill: 'bg-red-500 text-white',
    weak: 'bg-red-50 text-red-700',
    outline: 'border border-red-500 text-red-700',
  },
  gray: {
    fill: 'bg-gray-500 text-white',
    weak: 'bg-gray-50 text-gray-700',
    outline: 'border border-gray-500 text-gray-700',
  },
  grey: {
    fill: 'bg-gray-500 text-white',
    weak: 'bg-gray-50 text-gray-700',
    outline: 'border border-gray-500 text-gray-700',
  },
  pink: {
    fill: 'bg-pink-500 text-white',
    weak: 'bg-pink-50 text-pink-700',
    outline: 'border border-pink-500 text-pink-700',
  },
  cyan: {
    fill: 'bg-cyan-500 text-white',
    weak: 'bg-cyan-50 text-cyan-700',
    outline: 'border border-cyan-500 text-cyan-700',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  small: 'px-2 py-0.5 text-xs',
  medium: 'px-3 py-1 text-sm',
  large: 'px-4 py-1.5 text-base',
};

export default function Badge({
  children,
  color = 'blue',
  variant = 'fill',
  size = 'medium',
  className,
}: BadgeProps) {
  // color와 variant가 유효한지 확인하고 기본값 제공
  const safeColor = colorStyles[color] ? color : 'blue';
  const safeVariant = colorStyles[safeColor]?.[variant] ? variant : 'fill';
  
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium',
        colorStyles[safeColor][safeVariant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}