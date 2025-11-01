// components/atoms/Paragraph/index.tsx
import { cn } from '@/lib/utils/cn';
import { ReactNode, HTMLAttributes, CSSProperties } from 'react';

type TypographyVariant = 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7' | 't8';
type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';
type TextColor = 'blue' | 'grey-900' | 'grey-800' | 'grey-700' | 'grey-600' | 'grey-500';

interface ParagraphProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: TypographyVariant;
  weight?: FontWeight;
  color?: TextColor;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
  align?: 'left' | 'center' | 'right' | 'justify';
  className?: string;
}

const variantInlineStyles: Record<TypographyVariant, CSSProperties> = {
  t1: { fontSize: '30px', lineHeight: '40px' },
  t2: { fontSize: '26px', lineHeight: '35px' },
  t3: { fontSize: '22px', lineHeight: '31px' },
  t4: { fontSize: '20px', lineHeight: '29px' },
  t5: { fontSize: '17px', lineHeight: '25.5px' },
  t6: { fontSize: '15px', lineHeight: '22.5px' },
  t7: { fontSize: '13px', lineHeight: '19.5px' },
  t8: { fontSize: '11px', lineHeight: '16.5px' },
};

const variantStyles: Record<TypographyVariant, string> = {
  t1: 'text-t1',
  t2: 'text-t2',
  t3: 'text-t3',
  t4: 'text-t4',
  t5: 'text-t5',
  t6: 'text-t6',
  t7: 'text-t7',
  t8: 'text-t8',
};

const weightStyles: Record<FontWeight, string> = {
  regular: 'font-regular',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const colorStyles: Record<TextColor, string> = {
  'blue': 'text-blue-500',
  'grey-900': 'text-grey-900',
  'grey-800': 'text-grey-800',
  'grey-700': 'text-grey-700',
  'grey-600': 'text-grey-600',
  'grey-500': 'text-grey-500',
};

const alignStyles = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

export default function Paragraph({
  children,
  variant = 't5',
  weight = 'regular',
  color = 'grey-900',
  as = 'p',
  align = 'left',
  className,
  style,
  ...props
}: ParagraphProps) {
  const Component = as;

  return (
    <Component
      className={cn(
        'font-pretendard',
        variantStyles[variant],
        weightStyles[weight],
        colorStyles[color],
        alignStyles[align],
        className
      )}
      style={{
        ...variantInlineStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}