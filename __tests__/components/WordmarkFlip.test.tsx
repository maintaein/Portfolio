import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
// M3 Task 3의 인트로는 이름 버튼 안쪽 span의 opacity·자세만 쓴다. 버튼 transform은 경계 채널의 것이다.
it('one static wordmark; the intro animates only its inner span, never the button or a FLIP clone', () => {
  const home = readFileSync('components/sections/HomeClient/index.tsx', 'utf8');
  const nav = readFileSync('components/blocks/Navigation/index.tsx', 'utf8');
  const boot = readFileSync('components/sections/BootSequence/index.tsx', 'utf8');
  expect(nav.match(/data-testid="wordmark"/g)).toHaveLength(1);
  expect(nav).toMatch(/tracking-widest"><span className="inline-block">\{PERSONAL_INFO\.NAME_EN\}<\/span><\/button>/);
  expect(home).toContain('wordmark = wordmarkRef.current?.firstElementChild');
  expect(home).toContain('<BootSequence'); expect(home).not.toContain('Flip.from'); expect(home).not.toContain('onStart');
  expect(boot).not.toMatch(/ParticleText|Flip|wordmarkRef/);
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
