// hooks/useScroll.ts
import { useEffect, useState } from 'react';
import { getCurrentSection, getScrollProgress } from '@/lib/utils/scroll';

interface UseScrollOptions {
  offset?: number;
  throttle?: number;
}

interface UseScrollReturn {
  activeSection: string;
  scrollProgress: number;
}

export function useScroll(
  sections: string[],
  options: UseScrollOptions = {}
): UseScrollReturn {
  const { offset = 100, throttle = 16 } = options;

  const [activeSection, setActiveSection] = useState(sections[0]);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let rafId: number;
    let lastTime = 0;

    const handleScroll = () => {
      // requestAnimationFrame을 사용하여 부드럽고 빠른 업데이트
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame((timestamp) => {
        // throttle 적용
        if (timestamp - lastTime >= throttle) {
          lastTime = timestamp;

          // 현재 섹션 감지
          const current = getCurrentSection(sections, offset);
          setActiveSection(current);

          // 스크롤 진행률 계산
          const progress = getScrollProgress();
          setScrollProgress(progress);
        }
      });
    };

    // 스크롤 이벤트 등록
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 초기 실행
    handleScroll();

    // 클린업
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [sections, offset, throttle]);

  return {
    activeSection,
    scrollProgress,
  };
}