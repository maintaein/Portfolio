// components/atoms/Border/index.tsx
import { cn } from '@/lib/utils/cn';

type BorderPosition = 'top' | 'bottom' | 'left' | 'right' | 'all';
type BorderStyle = 'solid' | 'dashed' | 'dotted';
type BorderWidth = 'thin' | 'medium' | 'thick';
type BorderColor = 'gray' | 'primary' | 'secondary' | 'accent';

interface BorderProps {
  position?: BorderPosition;
  style?: BorderStyle;
  width?: BorderWidth;
  color?: BorderColor;
  className?: string;
}

const positionStyles: Record<BorderPosition, string> = {
  top: 'border-t',
  bottom: 'border-b',
  left: 'border-l',
  right: 'border-r',
  all: 'border',
};

const styleStyles: Record<BorderStyle, string> = {
  solid: 'border-solid',
  dashed: 'border-dashed',
  dotted: 'border-dotted',
};

const widthStyles: Record<BorderWidth, string> = {
  thin: 'border-[1px]',
  medium: 'border-2',
  thick: 'border-4',
};

const colorStyles: Record<BorderColor, string> = {
  gray: 'border-gray-200',
  primary: 'border-blue-500',
  secondary: 'border-purple-500',
  accent: 'border-orange-500',
};

export default function Border({
  position = 'all',
  style = 'solid',
  width = 'thin',
  color = 'gray',
  className,
}: BorderProps) {
  return (
    <div
      className={cn(
        positionStyles[position],
        styleStyles[style],
        widthStyles[width],
        colorStyles[color],
        className
      )}
    />
  );
}