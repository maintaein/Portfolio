import { expect, type Page } from '@playwright/test';

// 소프트웨어 GL의 헤드리스 Chromium에서는 프로토콜 호출 하나가 1.2~1.4초 걸려 기본 5초 상한 안에
// 표본이 서너 개뿐이다. 이 상한은 성공 조건이 아니라 느린 프레임을 감안한 실패 상한이다.
export const SLOW = { timeout: 20_000 };

// Native document navigation exposes its reading destination on main.
export async function expectActive(page: Page, id: string) {
  await expect(page.locator('main')).toHaveAttribute('data-active-section', id, SLOW);
  await expect(page.locator('main')).not.toHaveAttribute('data-navigation-target', SLOW);
}

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
  await expect(page.getByRole('dialog')).toBeAttached(SLOW);
  await expect(page.locator('#pm-title')).toBeVisible(SLOW);
}

// 프로젝트 상세를 연다. 첫 클릭은 선택만 옮기고, 이미 고른 이름을 다시
// 눌러야 열린다(components/sections/ProjectsSection/index.tsx의
// handleNameClick). 목록의 첫 항목은 처음부터 골라져 있으므로 한 번이면
// 열린다 - 무조건 두 번 누르면 이미 열린 모달이 두 번째 클릭을 가로챈다.
export async function openProjectModal(page: Page, title: string) {
  const tab = page.getByRole('tab', { name: title, exact: true });
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', SLOW);
  }
  // WebKit's protocol scroll-into-view moves this transformed wheel before input.
  // Click the visible, settled title as a physical pointer would.
  // 소프트웨어 GL에서는 프로토콜 호출 하나가 1초 넘게 걸려, 호출마다 한 번씩 재는 폴링은 5초 안에
  // 표본이 서너 개뿐이다. 그래서 재는 일을 페이지 안으로 옮긴다: 렌더 프레임마다 위치를 읽어
  // 5프레임 연속(그리고 300ms 이상) 움직임이 .5px 아래이고 중심이 화면 안에 있을 때의 중심을 한 번에 돌려준다.
  // 프레임이 느려도 표본 수가 아니라 프레임 수로 센다. 20초는 성공 조건이 아니라 실패 상한이다.
  const center = await tab.evaluate(
    (el) =>
      new Promise<{ x: number; y: number }>((resolve, reject) => {
        const deadline = performance.now() + 20_000;
        let last: DOMRect | null = null;
        let calm = 0;
        let calmSince = 0;
        const read = () => {
          const box = el.getBoundingClientRect();
          const still = last && Math.abs(box.x - last.x) < .5 && Math.abs(box.y - last.y) < .5;
          // 클릭할 중심점이 화면 안에 있다.
          const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
          const visible = box.width > 0 && box.height > 0 && cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight;
          if (still && visible) {
            if (!calm++) calmSince = performance.now();
            if (calm >= 5 && performance.now() - calmSince >= 300) {
              return resolve({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
            }
          } else calm = 0;
          last = box;
          if (performance.now() > deadline) reject(new Error('project tab did not settle inside the viewport'));
          else requestAnimationFrame(read);
        };
        requestAnimationFrame(read);
      })
  );
  await page.mouse.click(center.x, center.y);
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
