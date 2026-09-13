import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HyperspeedBackground from '@/components/blocks/HyperspeedBackground';
import { OVERVIEW } from '@/hooks/useSectionNav';

// 계획 브리프 「구멍 2」: vi.doMock은 이미 평가된 모듈에는 적용되지 않고,
// next/dynamic의 loader가 언제 그 모듈을 요구하는지에 따라 mock이 안 걸릴
// 수 있다. 이 파일은 다른 어떤 테스트도 '@/components/blocks/Hyperspeed'를
// 성공적으로 로드한 적이 없는 독립 파일이다(task-4-report.md의
// HyperspeedApi/HyperspeedEngine 분리와 같은 이유 — vi.mock은 파일 단위로
// 호이스팅되고, 한 파일 안에서 "성공 mock"과 "실패 mock"을 describe별로
// 다르게 가져갈 수 없다). vi.mock을 파일 최상단에 두면 이 파일의 유일한
// 렌더 시도가 실제로 그 mock을 거쳐 실패한다는 것이 구조적으로 보장된다.
vi.mock('@/components/blocks/Hyperspeed', () => {
  throw new Error('chunk load failed');
});

describe('HyperspeedBackground — 청크 로드 실패', () => {
  it('청크 로드가 실패해도 정적 폴백을 보여준다', async () => {
    render(
      <HyperspeedBackground
        active={OVERVIEW}
        isTransitioning={false}
        obscured={false}
        pageVisible={true}
        routeResolved={true}
        motionReady={true}
        reducedMotion={false}
        heroRevealed={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('hyperspeed-fallback')).toBeInTheDocument();
    });

    // 구멍 2·3: "아직 로딩 중"과 "로드 실패"가 같은 data-testid로 뭉개지지
    // 않는지 — mock이 실제로 걸렸다면 최종 상태는 반드시 load-error다.
    // pending으로 멈춰 있다면 mock이 안 걸리고 그냥 로딩 중인 것이므로 이
    // assertion이 그 차이를 드러낸다.
    await waitFor(() => {
      expect(screen.getByTestId('hyperspeed-fallback')).toHaveAttribute(
        'data-fallback-reason',
        'load-error'
      );
    });
    expect(screen.getByTestId('hyperspeed-fallback')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });
});
