import { test, expect, type Page } from '@playwright/test';
import {
  enter,
  expectActive,
  expectModalOpen,
  historyLength,
  openProjectModal,
  SLOW,
} from './helpers';
import { projects } from '@/lib/data/projects';
import { isProjectModalReady } from '@/lib/utils/projectContract';

// 계획 6 Task 5b-3. modal-only History는 섹션 History와 같은 스택에 쌓이면서도
// 해시를 바꾸지 않는다. 그 둘이 섞이는 순서, 새로고침 복구, inert와 포커스
// 복귀는 실제 브라우저 없이 신뢰할 수 없다.

// 고정된 제목을 박지 않는다. 상세 계약(lib/utils/projectContract.ts)을
// 통과하는 프로젝트만 열리고, 그 목록은 사용자 소유 데이터라 바뀐다.
const ready = projects.find((project) => isProjectModalReady(project));

test.describe('프로젝트 상세', () => {
  test.skip(!ready, '상세 계약을 통과하는 프로젝트가 없다');

  test('뒤로가기는 모달만 닫고 앞으로가기는 같은 프로젝트를 되살린다 @smoke', async ({
    page,
  }) => {
    await enter(page, 'projects');
    const before = await historyLength(page);
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await openProjectModal(page, ready!.title);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    // 모달은 항목 하나만 쌓는다. 해시는 그대로다.
    expect(await historyLength(page)).toBe(before + 1);
    expect(new URL(page.url()).hash).toBe('#projects');

    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0, SLOW);
    // 섹션은 움직이지 않았다. 뒤로가기가 모달만 걷어 갔다.
    await expectActive(page, 'projects');
    expect(new URL(page.url()).hash).toBe('#projects');

    await page.goForward();
    await expectModalOpen(page);
    await expect(page.getByRole('dialog')).toHaveAccessibleName(ready!.title, SLOW);
    await expectActive(page, 'projects');
  });

  test('새로고침은 모달을 되살리고, 없는 프로젝트 id는 그 키만 지운다', async ({ page }) => {
    await enter(page, 'projects');
    await openProjectModal(page, ready!.title);

    await page.reload();
    await expect(page.locator('main')).toHaveAttribute('data-route-resolved', 'true', {
      timeout: 20_000,
    });
    await expectModalOpen(page);
    await expect(page.getByRole('dialog')).toHaveAccessibleName(ready!.title, SLOW);

    // 없는 id를 심는다. 같은 항목의 다른 필드는 살아남아야 한다 -
    // Next.js가 쓰는 필드가 여기 같이 산다.
    await page.evaluate(() => {
      history.replaceState(
        { ...history.state, projectModalId: '없는 프로젝트', e2eKeep: 'keep' },
        '',
        location.hash
      );
    });
    const before = await historyLength(page);

    await page.reload();
    await expect(page.locator('main')).toHaveAttribute('data-route-resolved', 'true', {
      timeout: 20_000,
    });
    await expect(page.getByRole('dialog')).toHaveCount(0, SLOW);

    const state = await page.evaluate(() => history.state);
    expect(state).toMatchObject({ e2eKeep: 'keep' });
    expect(state).not.toHaveProperty('projectModalId');
    // 정리는 replaceState다. 스택이 늘지 않는다.
    expect(await historyLength(page)).toBe(before);
  });

  test('모달이 열리면 셸이 inert이고 포커스가 갇히며 닫으면 목록으로 돌아온다', async ({
    page,
  }) => {
    await enter(page, 'projects');
    await openProjectModal(page, ready!.title);

    // 모달 뒤의 무대와 내비는 격리된다. 뒤에서 섹션이 갈리면 모순이다.
    await expect(page.locator('main')).toHaveAttribute('inert', '', SLOW);

    // 누를 때마다 evaluate를 부르면 프로토콜 호출이 두 배로 늘어 느린 프레임에서 60초 상한에 닿는다.
    // keyup은 keydown의 포커스 이동이 끝난 뒤에 오므로, 페이지 안에서 매 Tab의 위치를 기록하고
    // 15번을 다 누른 뒤 한 번에 읽는다. 판정은 같다.
    await page.evaluate(() => {
      const log: boolean[] = [];
      (window as unknown as { __tabLog: boolean[] }).__tabLog = log;
      document.addEventListener(
        'keyup',
        (event) => {
          if (event.key === 'Tab') log.push(!!document.activeElement?.closest('[role="dialog"]'));
        },
        true
      );
    });
    for (let i = 0; i < 15; i += 1) await page.keyboard.press('Tab');
    const tabLog = await page.evaluate(() => (window as unknown as { __tabLog: boolean[] }).__tabLog);
    expect(tabLog).toHaveLength(15);
    tabLog.forEach((inDialog, i) =>
      expect(inDialog, `Tab ${i + 1}번째에 포커스가 모달 밖으로 나갔다`).toBe(true)
    );

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0, SLOW);

    // 포커스는 연 자리로 돌아온다. 정확한 노드(이름 단추 또는 섹션 fallback)는
    // 닫는 경로에 따라 갈리므로 섹션 안이라는 것까지만 계약이다.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document.activeElement?.closest('[data-section]')?.getAttribute('data-section') ??
              null
          ),
        SLOW
      )
      .toBe('projects');
  });

  // M4 Task 2. 로고가 프리뷰로 날아가는 도중의 입력은 비행을 끝 자리로 정착시킨 뒤 원래 동작을 한 번만 한다.
  // 소프트웨어 GL에서는 프로토콜 호출이 느려 클릭도 페이지 안에서 프레임에 맞춰 낸다. 날기 시작 3프레임 뒤에 누르고, 그 뒤 60프레임 동안 비행이 되살아나는지 본다.
  const duringFlight = async (page: Page, selector: string) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'about');
    const owner = page.locator('.portfolio-document');
    await expect(owner).toHaveAttribute('data-logo-owner', 'about', { timeout: 20_000 });
    await expect(owner).toHaveAttribute('data-logo-live', '', { timeout: 30_000 });
    const start = await page.evaluate(() => {
      const top = (query: string) => document.querySelector(query)!.getBoundingClientRect().top + scrollY;
      const margin = (query: string) => parseFloat(getComputedStyle(document.querySelector(query)!).scrollMarginTop);
      const lock = top('[data-section="projects"]') - margin('[data-section="projects"]');
      return lock - innerHeight / 2 - .15 * innerHeight;
    });
    const result = page.evaluate(query => new Promise<{ clickedWhile: string | null; after: string | null; revived: number; y: number }>(resolve => {
      const stage = () => document.querySelector('.portfolio-document')!.getAttribute('data-logo-owner');
      let flying = 0;
      const wait = () => {
        const el = document.querySelector<HTMLElement>(query)!;
        // opacity는 상속되지 않으므로 조상까지 곱한다. 보이지 않는 단추는 사람이 누를 수 없다. 보이기 시작한 뒤, 아직 날고 있을 때 누른다.
        let shown = 1;
        for (let node: Element | null = el; node; node = node.parentElement) shown *= Number(getComputedStyle(node).opacity);
        // M4 Task 4: 프리뷰 그림을 GL 로고가 그리는 동안 DOM 틀은 도착까지 불투명도 0이고, .65부터 보이는 GL 그림 아래 같은 창에서 포인터를 받는다.
        const logo = Number(getComputedStyle(document.querySelector('[data-logo-host] > div')!).opacity);
        const standIn = logo > 0 && getComputedStyle(el).pointerEvents !== 'none';
        if (stage() === 'preview' && ++flying >= 3 && (shown > 0 || standIn)) {
          const clickedWhile = stage();
          // Chrome이 마우스 누름에서 내는 순서: 포커스(mousedown) 다음 click. 마우스 포커스는 스크롤하지 않는다.
          el.focus({ preventScroll: true });
          el.click();
          let frames = 0;
          let revived = 0;
          const watch = () => {
            if (stage() === 'preview') revived++;
            if (++frames < 60) requestAnimationFrame(watch);
            else resolve({ clickedWhile, after: stage(), revived, y: scrollY });
          };
          requestAnimationFrame(watch);
        } else requestAnimationFrame(wait);
      };
      wait();
    }), selector);
    const y = Math.ceil(start) + 10;
    await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), y);
    return { seen: await result, y };
  };
  const target = projects.findIndex((project, i) => i !== 0 && isProjectModalReady(project));

  test('날아가는 도중 선택 안 된 이름의 첫 클릭은 비행을 끝내고 그 프로젝트를 고르기만 한다', async ({ page }) => {
    test.skip(target === -1, '첫 항목이 아닌 상세 통과 프로젝트가 없다');
    test.setTimeout(240_000);
    const { seen, y } = await duringFlight(page, `#projects [role="tab"][data-name="${target}"]`);
    expect(seen.clickedWhile).toBe('preview');
    expect(seen.after).toBe('projects');
    expect(seen.revived).toBe(0);
    expect(seen.y).toBeCloseTo(y, 0);
    await expect(page.locator(`#projects [role="tab"][data-name="${target}"]`)).toHaveAttribute('aria-selected', 'true', SLOW);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-motion-anchor="projects-preview"] > div')).toHaveCSS('opacity', '1');
  });

  test('날아가는 도중 프리뷰 클릭은 비행을 끝내고 선택된 프로젝트의 상세를 한 번만 연다', async ({ page }) => {
    test.skip(!isProjectModalReady(projects[0]), '첫 항목이 상세 계약 미달이면 열리지 않는다');
    test.setTimeout(240_000);
    const { seen, y } = await duringFlight(page, '[data-part="preview-open"]');
    expect(seen.clickedWhile).toBe('preview');
    expect(seen.revived).toBe(0);
    await expectModalOpen(page);
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toHaveAccessibleName(projects[0].title, SLOW);
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0, SLOW);
    // 정착은 스크롤을 옮기지 않는다. 열고 닫아도 읽던 자리 그대로다.
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  });
});
