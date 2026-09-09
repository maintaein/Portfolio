import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// design-tokens.css의 @utility text-t1..t8은 Tailwind 테마가 아니라 직접 만든 유틸이라
// tailwind-merge가 정체를 모른다. 그러면 text-<무엇이든> 규칙에 걸려 글자 "색"으로 분류되고,
// 크기 클래스와 색 클래스를 cn으로 함께 넘기면 크기 쪽이 조용히 지워졌다.
// 크기 그룹에 이름을 직접 등록해서 색과 겹치지 않게 한다.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-t1', 'text-t2', 'text-t3', 'text-t4', 'text-t5', 'text-t6', 'text-t7', 'text-t8'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
