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

// 상세가 열렸다는 판정. role="dialog" 노드는 높이 0인 껍데기다 -
// ProjectModal이 자기 레이아웃을 직접 잡고 내용은 [&>div]:overflow-visible로
// 껍데기 밖으로 흘러나온다. 그래서 dialog에 toBeVisible을 걸면 열려 있어도
// 실패한다. 사용자가 실제로 보는 것은 제목과 무대 쪽이다.
export async function expectModalOpen(page: Page) {
  await expect(page.getByRole('dialog')).toBeAttached();
  await expect(page.locator('#pm-title')).toBeVisible();
}

// 프로젝트 상세를 연다. 첫 클릭은 선택만 옮기고, 이미 고른 이름을 다시
// 눌러야 열린다(components/sections/ProjectsSection/index.tsx의
// handleNameClick). 목록의 첫 항목은 처음부터 골라져 있으므로 한 번이면
// 열린다 - 무조건 두 번 누르면 이미 열린 모달이 두 번째 클릭을 가로챈다.
export async function openProjectModal(page: Page, title: string) {
  const tab = page.getByRole('tab', { name: title, exact: true });
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
  await tab.click();
  await expectModalOpen(page);
}

// 프레임 n개가 실제로 지나가기를 기다린다. waitForTimeout과 달리 벽시계가
// 아니라 브라우저의 렌더 루프를 센다. "아무 일도 일어나지 않는다"를 재려면
// 창이 필요한데, 그 창을 시간이 아니라 프레임으로 잡는다.
export function waitFrames(page: Page, count: number) {
  return page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const tick = () => {
          if (++seen >= n) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count
  );
}
