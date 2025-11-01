// components/atoms/SegmentedControl/index.tsx
'use client';

import { cn } from '@/lib/utils/cn';
import { useState, useRef, useEffect } from 'react';

interface SegmentOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const sizeStyles = {
  small: 'text-sm py-1.5 px-3',
  medium: 'text-base py-2 px-4',
  large: 'text-lg py-2.5 px-5',
};

export default function SegmentedControl({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  fullWidth = false,
  size = 'medium',
  className,
}: SegmentedControlProps) {
  // defaultValue가 있으면 사용, 없으면 첫 번째 활성화된 옵션 사용
  const getInitialValue = () => {
    if (defaultValue) return defaultValue;
    const firstEnabledOption = options.find(opt => !opt.disabled);
    return firstEnabledOption?.value || options[0]?.value || '';
  };

  const [internalValue, setInternalValue] = useState(getInitialValue());
  const currentValue = controlledValue ?? internalValue;

  // 배경 위치/크기 상태
  const [backgroundStyle, setBackgroundStyle] = useState({ left: 0, width: 0 });

  // 버튼 ref 배열
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // 선택된 버튼의 위치와 크기를 계산하여 배경 스타일 업데이트
  useEffect(() => {
    const selectedIndex = options.findIndex(opt => opt.value === currentValue);
    const selectedButton = buttonRefs.current[selectedIndex];
    const container = containerRef.current;

    if (selectedButton && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = selectedButton.getBoundingClientRect();

      // 컨테이너 기준으로 상대 위치 계산
      const left = buttonRect.left - containerRect.left;
      const width = buttonRect.width;

      setBackgroundStyle({ left, width });
    }
  }, [currentValue, options]);

  const handleChange = (newValue: string, disabled?: boolean) => {
    // disabled된 옵션은 선택 불가
    if (disabled) return;

    if (!controlledValue) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative inline-flex p-1 bg-gray-100 rounded-lg',
        fullWidth && 'w-full',
        className
      )}
    >
      {/* 선택된 세그먼트의 배경 (애니메이션) */}
      <div
        className="absolute bg-white rounded-md shadow-sm transition-all duration-300 ease-out"
        style={{
          left: `${backgroundStyle.left}px`,
          width: `${backgroundStyle.width}px`,
          top: '0.25rem',
          bottom: '0.25rem',
        }}
      />

      {/* 옵션 버튼들 */}
      {options.map((option, index) => {
        const isSelected = option.value === currentValue;
        const isDisabled = option.disabled || false;

        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onClick={() => handleChange(option.value, option.disabled)}
            disabled={isDisabled}
            className={cn(
              'relative z-10 flex-1 font-medium rounded-md whitespace-nowrap',
              'transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              sizeStyles[size],
              isDisabled
                ? 'text-gray-400 cursor-not-allowed'
                : isSelected
                  ? 'text-gray-900'
                  : 'text-gray-600 hover:text-gray-900',
              !fullWidth && 'min-w-[100px]'
            )}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}