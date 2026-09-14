import { test, expect } from '@playwright/test';
import {
  enter,
  expectActive,
  expectModalOpen,
  historyLength,
  openProjectModal,
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

    await openProjectModal(page, ready!.title);
    // 모달은 항목 하나만 쌓는다. 해시는 그대로다.
    expect(await historyLength(page)).toBe(before + 1);
    expect(new URL(page.url()).hash).toBe('#projects');

    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // 섹션은 움직이지 않았다. 뒤로가기가 모달만 걷어 갔다.
    await expectActive(page, 'projects');
    expect(new URL(page.url()).hash).toBe('#projects');

    await page.goForward();
    await expectModalOpen(page);
    await expect(page.getByRole('dialog')).toHaveAccessibleName(ready!.title);
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
    await expect(page.getByRole('dialog')).toHaveAccessibleName(ready!.title);

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
    await expect(page.getByRole('dialog')).toHaveCount(0);

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
    await expect(page.locator('main')).toHaveAttribute('inert', '');

    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press('Tab');
      const inDialog = await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]')
      );
      expect(inDialog, `Tab ${i + 1}번째에 포커스가 모달 밖으로 나갔다`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 포커스는 연 자리로 돌아온다. 정확한 노드(이름 단추 또는 섹션 fallback)는
    // 닫는 경로에 따라 갈리므로 섹션 안이라는 것까지만 계약이다.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.activeElement?.closest('[data-section]')?.getAttribute('data-section') ??
            null
        )
      )
      .toBe('projects');
  });
});
