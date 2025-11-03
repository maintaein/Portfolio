import { cn } from '@/lib/utils/cn';

type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'rounded';
type SkeletonAnimation = 'pulse' | 'wave' | 'none';

interface SkeletonProps {
  variant?: SkeletonVariant;
  animation?: SkeletonAnimation;
  width?: string | number;
  height?: string | number;
  className?: string;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'rounded h-4',
  circular: 'rounded-full',
  rectangular: 'rounded-none',
  rounded: 'rounded-lg',
};

const animationStyles: Record<SkeletonAnimation, string> = {
  pulse: 'animate-pulse',
  wave: 'animate-shimmer bg-gradient-to-r from-grey-200 via-grey-100 to-grey-200 bg-[length:200%_100%]',
  none: '',
};

export default function Skeleton({
  variant = 'text',
  animation = 'pulse',
  width,
  height,
  className,
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  
  if (width) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  
  if (height) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }

  return (
    <div
      className={cn(
        'bg-grey-200',
        variantStyles[variant],
        animation !== 'wave' && animationStyles[animation],
        animation === 'wave' && animationStyles.wave,
        className
      )}
      style={style}
      aria-label="로딩 중"
      role="status"
    >
      <span className="sr-only">로딩 중...</span>
    </div>
  );
}

// 편의를 위한 조합 컴포넌트들
export function SkeletonText({ 
  lines = 3, 
  className 
}: { 
  lines?: number; 
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={index === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 bg-white rounded-lg border border-grey-200', className)}>
      <Skeleton variant="rectangular" height={200} className="mb-4" />
      <Skeleton variant="text" width="60%" className="mb-2" />
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonAvatar({ 
  size = 40,
  className 
}: { 
  size?: number;
  className?: string;
}) {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
      className={className}
    />
  );
}