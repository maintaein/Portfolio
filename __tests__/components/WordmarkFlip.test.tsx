import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('M1 owns a single static wordmark and defers intro/FLIP choreography', () => {
  const home = readFileSync('components/sections/HomeClient/index.tsx', 'utf8');
  const nav = readFileSync('components/blocks/Navigation/index.tsx', 'utf8');
  expect(nav.match(/data-testid="wordmark"/g)).toHaveLength(1);
  expect(home).not.toContain('BootSequence'); expect(home).not.toContain('Flip.from'); expect(home).not.toContain('onStart');
});
// 이름 자리는 경계 모듈(motion.ts)이 hero-name과 nav-name 사이에서 옮긴다. nav의 active로
// 배치를 바꾸면 스크롤 도중 CSS와 GSAP이 같은 버튼을 서로 덮는다.
it('the name channel moves the one wordmark; nav active only highlights', () => {
  const home = readFileSync('components/sections/HomeClient/index.tsx', 'utf8');
  const nav = readFileSync('components/blocks/Navigation/index.tsx', 'utf8');
  const motion = readFileSync('components/sections/HomeClient/motion.ts', 'utf8');
  expect(nav).not.toMatch(/active === ['"]overview['"]/);
  expect(nav).not.toMatch(/data-wordmark-mode=\{/);
  expect(home).toContain('wordmarkRef={wordmarkRef}');
  expect(home.match(/data-motion-anchor="hero-name"/g)).toHaveLength(1);
  expect(motion).toContain('data-motion-anchor="${');
  expect(motion).toContain('wordmark.style.transform');
});
