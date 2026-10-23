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

  // M4 Task 1. About 로고가 프리뷰로 내려앉은 뒤에도 고른 프로젝트·상세 영상 재생은 그대로다.
  test('About에서 내려와 로고가 프리뷰에 넘겨진 뒤에도 선택은 그대로이고 상세 영상이 재생된다', async ({ page }) => {
    test.skip(!withVideo, '영상이 있는 프로젝트가 없다');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'projects');
    const tab = page.getByRole('tab', { name: withVideo!.title, exact: true });
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    // GL이 준비됐으면 2.1초 비행, 아니면 정적 인계다. 소프트웨어 GL에서는 비행이 수십 프레임이라 페이지 쪽 rAF로 기다린다.
    const landed = () => page.evaluate(() => new Promise<void>(resolve => {
      const read = () => {
        if (document.querySelector('.portfolio-document')!.getAttribute('data-logo-owner') !== 'preview') resolve();
        else requestAnimationFrame(read);
      };
      read();
    }));
    const lockAt = (section: string) => page.locator(`[data-section="${section}"]`).evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(el).scrollMarginTop), behavior: 'instant' }));
    await lockAt('about');
    await expectActive(page, 'about');
    await landed();
    await lockAt('projects');
    await expectActive(page, 'projects');
    await landed();
    const frame = page.locator('[data-motion-anchor="projects-preview"] > div');
    await expect(frame).toHaveCSS('opacity', '1');
    await expect(frame).toHaveCSS('transform', 'none');
    // 들어올 때 첫 프로젝트로 되돌리지 않는다. 떠나기 전에 고른 것이 그대로다.
    await expect(tab).toHaveAttribute('aria-selected', 'true');

    await openProjectModal(page, withVideo!.title);
    const playing = () => page.locator('[data-modal-part="stage"] video').evaluateAll(
      (videos) => (videos as HTMLVideoElement[]).filter((video) => !video.paused).length
    );
    await expect.poll(playing, { timeout: 20_000 }).toBe(1);
  });

  test('About ElectricLogo는 문항·섹션 전환 뒤에도 캔버스와 청크를 재사용한다', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/\/_next\/static\/chunks\/.+\.js/.test(url)) requested.push(url);
    });

    await enter(page, 'about');
    const rail = page.getByRole('navigation', { name: 'About 문항' }).getByRole('button');
    // 공유 로고는 셸의 host 하나에 산다. About은 앵커만 둔다.
    const canvas = page.locator('[data-logo-host] canvas');
    await expect(canvas).toBeAttached({ timeout: 20_000 });
    await canvas.evaluate((el) => {
      el.setAttribute('data-e2e-mark', 'electric-logo');
    });

    const loadedChunks = new Set(requested);
    await rail.nth(1).click();
    await expect(canvas).toHaveAttribute('data-e2e-mark', 'electric-logo');

    await navButton(page, 'Skills').click();
    await expectActive(page, 'skills');
    await navButton(page, 'About').click();
    await expectActive(page, 'about');
    await rail.nth(1).click();

    // 표식이 남아 있다 = 같은 노드다. 떠났다 와도 다시 마운트하지 않는다.
    await expect(canvas).toHaveAttribute('data-e2e-mark', 'electric-logo');
    const refetched = [...loadedChunks].filter(
      (url) => requested.filter((seen) => seen === url).length > 1
    );
    expect(refetched).toEqual([]);
  });
});
