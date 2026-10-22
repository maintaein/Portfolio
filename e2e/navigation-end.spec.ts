import { test, expect, type Page } from '@playwright/test';
import { enter, SLOW, waitFrames } from './helpers';

const chapter = (page: Page) => page.locator('[data-section="about"] [data-position="active"]').getAttribute('data-chapter');

// Chrome의 키보드 smooth scroll은 컴포지터 애니메이션이다. 소프트웨어 GL로 프레임이 1초 넘게 걸리면 End가 애니메이션 도중
// 아무 스크롤 없이 scrollend로 끝나(앱의 scrollTo 호출도, 속성 변화도 없다. 스킬 섹션에서도 같다) 20초를 기다려도 바닥에 닿지 않는다.
// 이 검사는 End 뒤에 앱이 끌어당기지 않는지 보는 것이라 애니메이션 자체는 끈다. test.use의 launchOptions는 파일 단위라 이 파일에는 이 한 건만 둔다.
test.use({ launchOptions: { args: ['--disable-smooth-scrolling'] } });

test('keyboard steps About chapters while End and programmatic scroll leave without a pull back', async ({ page }) => {
  await enter(page, 'about');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => chapter(page), SLOW).toBe('QUALITY');
  await page.keyboard.press('End');
  const atEnd = () => page.evaluate(() => window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
  await expect.poll(atEnd, SLOW).toBe(true);
  await waitFrames(page, 20); expect(await atEnd()).toBe(true);
  const top = await page.locator('#about').evaluate(el => el.getBoundingClientRect().top + scrollY - 92 + 300);
  await page.evaluate(y => window.scrollTo(0, y), top);
  await waitFrames(page, 20);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - top)).toBeLessThanOrEqual(1);
});
