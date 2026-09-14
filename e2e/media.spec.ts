import { test, expect } from '@playwright/test';
import { enter, expectActive, navButton, openProjectModal } from './helpers';
import { projects } from '@/lib/data/projects';
import { isProjectModalReady } from '@/lib/utils/projectContract';

// 계획 6 Task 5b-3. 자동재생 정책, 무대 생명주기, dynamic import의 실제
// 네트워크 요청은 실제 브라우저에서만 재현된다.

const hasVideo = (title: string) =>
  projects
    .find((project) => project.title === title)
    ?.implementations?.some((impl) => impl.video) ?? false;

const withVideo = projects.find(
  (project) => isProjectModalReady(project) && hasVideo(project.title)
);
const withoutVideo = projects.find(
  (project) => isProjectModalReady(project) && !hasVideo(project.title)
);

test.describe('미디어', () => {
  test('무대에는 영상 하나 또는 이미지 폴백 하나만 올라간다 @smoke', async ({ page }) => {
    const target = withVideo ?? withoutVideo;
    test.skip(!target, '상세 계약을 통과하는 프로젝트가 없다');

    await enter(page, 'projects');
    await openProjectModal(page, target!.title);

    const stage = page.locator('[data-modal-part="stage"]');
    const shown = stage.locator('figure:not([hidden])');
    await expect(shown).toHaveCount(1);

    // 영상이 있으면 영상이, 없으면 그림이 그 자리를 채운다. 어느 쪽이든
    // 무대가 비지 않는다는 것이 계약이다(projectContract.ts는 video를
    // 요구하지 않는다).
    if (hasVideo(target!.title)) {
      await expect(shown.locator('video')).toHaveCount(1);
      await expect(shown.locator('video')).toHaveAttribute('src', /.+/);
    } else {
      await expect(shown.locator('img')).toHaveCount(1);
    }
  });

  test('정지 단추가 영상을 멈추고 무대를 넘겨도 정지가 유지된다', async ({ page }) => {
    test.skip(!withVideo, '영상이 있는 프로젝트가 없다');
    const impls = withVideo!.implementations ?? [];
    test.skip(impls.length < 2, '무대를 넘길 구현 기능이 둘 미만이다');

    await enter(page, 'projects');
    await openProjectModal(page, withVideo!.title);

    const stage = page.locator('[data-modal-part="stage"]');
    const playingCount = () =>
      stage
        .locator('video')
        .evaluateAll(
          (videos) => (videos as HTMLVideoElement[]).filter((video) => !video.paused).length
        );

    // muted·loop·playsInline이라 자동재생이 허용된다. 재생 중인 것은
    // 무대에 올라간 하나뿐이다.
    await expect.poll(playingCount).toBe(1);

    await page.getByRole('button', { name: '영상 일시정지' }).click();
    await expect.poll(playingCount).toBe(0);

    // WCAG 2.2.2의 정지는 이 영상 하나가 아니라 무대 전체에 걸린다.
    await page.getByRole('button', { name: '다음 기능 영상' }).click();
    await expect(page.getByRole('button', { name: '영상 재생' })).toBeVisible();
    await expect.poll(playingCount).toBe(0);
  });

  test('About 링 청크는 최초 진입에 없고 처음 고를 때 한 번만 온다', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/\/_next\/static\/chunks\/.+\.js/.test(url)) requested.push(url);
    });

    await enter(page, 'about');
    const beforeRings = new Set(requested);

    const rail = page.getByRole('navigation', { name: 'About 문항' }).getByRole('button');
    await rail.nth(1).click();

    const canvas = page.locator('[data-about-visual-index="1"] canvas');
    await expect(canvas).toBeAttached({ timeout: 20_000 });
    await canvas.evaluate((el) => {
      el.setAttribute('data-e2e-mark', 'rings');
    });

    // 최초 진입에는 없던 청크다. three는 링을 고르는 순간에야 온다.
    const ringsChunks = requested.filter((url) => !beforeRings.has(url));
    expect(ringsChunks.length).toBeGreaterThan(0);

    await navButton(page, 'Skills').click();
    await expectActive(page, 'skills');
    await navButton(page, 'About').click();
    await expectActive(page, 'about');
    await rail.nth(1).click();

    // 표식이 남아 있다 = 같은 노드다. 떠났다 와도 다시 마운트하지 않는다.
    await expect(canvas).toHaveAttribute('data-e2e-mark', 'rings');
    const refetched = ringsChunks.filter(
      (url) => requested.filter((seen) => seen === url).length > 1
    );
    expect(refetched).toEqual([]);
  });
});
