import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeClient from '@/components/sections/HomeClient';

vi.mock('@/hooks/useMotionPreference', () => ({ useMotionPreference: () => ({ ready: true, reduced: false }) }));
vi.mock('@/components/blocks/LuminousFlowBackground', () => ({ default: () => null }));
vi.mock('@/components/sections/BootSequence', () => ({ default: () => null }));
vi.mock('@/components/sections', () => ({ AboutSection: () => <p>About</p>, ProjectsSection: () => null, ExperienceSection: () => null, SkillsSection: () => null, AwardAndCertificateSection: () => null, Footer: () => null }));
// M4 Task 0 리뷰. 경계 청크(motion.ts, GSAP을 품는다)를 못 받으면 import()가 거절되고 아무도 받지 않았다.
// vi.mock은 파일 단위로 호이스팅되므로 실패만 보는 독립 파일이다(HyperspeedBackgroundLoadFailure와 같은 이유).
vi.mock('@/components/sections/HomeClient/motion', () => {
  throw new Error('chunk load failed');
});

const unhandled = vi.fn();
beforeEach(() => {
  process.on('unhandledRejection', unhandled);
  window.history.replaceState(null, '', '/#about');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })));
});
afterEach(() => {
  process.off('unhandledRejection', unhandled);
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-name-side');
});

it('경계 청크가 실패하면 정적 쉬는 자리를 그대로 두고 처리되지 않은 거절을 남기지 않는다', async () => {
  // 직접 해시로 들어온 방문이다. 그리기 전 판정이 붙인 nav 표시가 남아 이름은 nav 줄에 그대로 선다.
  document.documentElement.setAttribute('data-name-side', 'nav');
  const { container } = render(<HomeClient />);
  await act(async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(unhandled).not.toHaveBeenCalled();
  expect(document.documentElement.getAttribute('data-name-side')).toBe('nav');
  expect(screen.getByTestId('wordmark')).toHaveAttribute('data-wordmark-mode', 'hero');
  expect(screen.getByTestId('wordmark').style.cssText).toBe('');
  expect(container.querySelector('.portfolio-document')).toHaveAttribute('data-logo-owner', 'none');
  expect((container.querySelector('[data-logo-host]') as HTMLElement).style.cssText).toBe('');
});
