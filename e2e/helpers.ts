import { expect, type Page } from '@playwright/test';

// 계획 6 Task 5b. 여러 스펙이 같이 쓰는 진입·판정 도구. 파일 이름에 spec이
// 없으므로 Playwright가 이 파일을 테스트로 수집하지 않는다.

// 활성 섹션은 aria-hidden이 false이고 inert가 붙지 않는다. 비활성은 그
// 반대다(components/sections/HomeClient/index.tsx). 클래스 이름보다 이쪽이
// 안정된 계약이라 여기에 건다. 사용자에게 실제로 닿는 상태이기도 하다.
export async function expectActive(page: Page, id: string) {
  await expect(page.locator(`[data-section="${id}"]`)).toHaveAttribute(
    'aria-hidden',
    'false'
  );
}

// 해시로 바로 들어간다. overview에서는 내비 스트립이 pointer-events: none이라
// (.nav-strip-hidden, styles/design-tokens.css) 단추를 누를 수 없다. 섹션에
// 한 번 들어가야 스트립이 살아난다.
export async function enter(page: Page, id: string) {
  await page.goto(`/#${id}`);
  // 하이드레이션이 끝나야 routeResolved가 열린다. 혼자 재면 1.2초에서
  // 3.4초지만 워커 여럿이 같은 서버에 붙으면 기본 상한 5초를 넘긴다.
  // 이 숫자는 성공 조건이 아니라 실패 상한이다.
  await expect(page.locator('main')).toHaveAttribute(
    'data-route-resolved',
    'true',
    { timeout: 20_000 }
  );
  await expectActive(page, id);
}

export function navButton(page: Page, label: string) {
  return page
    .getByRole('navigation', { name: '메인 네비게이션' })
    .getByRole('button', { name: label, exact: true });
}

export const historyLength = (page: Page) =>
  page.evaluate(() => history.length);
