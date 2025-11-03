import { cn } from '@/lib/utils/cn';
import { ReactNode } from 'react';

type BoardRowAlign = 'start' | 'center' | 'end' | 'stretch';
type BoardRowJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
type BoardRowGap = 'none' | 'small' | 'medium' | 'large' | 'xlarge';
type BoardRowWrap = 'wrap' | 'nowrap' | 'wrap-reverse';

interface BoardRowProps {
  children: ReactNode;
  align?: BoardRowAlign;
  justify?: BoardRowJustify;
  gap?: BoardRowGap;
  wrap?: BoardRowWrap;
  fullWidth?: boolean;
  className?: string;
}

const alignStyles: Record<BoardRowAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyStyles: Record<BoardRowJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const gapStyles: Record<BoardRowGap, string> = {
  none: 'gap-0',
  small: 'gap-2',
  medium: 'gap-4',
  large: 'gap-6',
  xlarge: 'gap-8',
};

const wrapStyles: Record<BoardRowWrap, string> = {
  wrap: 'flex-wrap',
  nowrap: 'flex-nowrap',
  'wrap-reverse': 'flex-wrap-reverse',
};

export default function BoardRow({
  children,
  align = 'center',
  justify = 'start',
  gap = 'medium',
  wrap = 'nowrap',
  fullWidth = false,
  className,
}: BoardRowProps) {
  return (
    <div
      className={cn(
        'flex flex-row',
        alignStyles[align],
        justifyStyles[justify],
        gapStyles[gap],
        wrapStyles[wrap],
        fullWidth && 'w-full',
        className
      )}
    >
      {children}
    </div>
  );
}