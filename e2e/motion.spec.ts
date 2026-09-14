import { test, expect, type Page } from '@playwright/test';
import { enter, expectActive, navButton, openProjectModal, waitFrames } from './helpers';
import { projects } from '@/lib/data/projects';
import { isProjectModalReady } from '@/lib/utils/projectContract';

// 계획 6 Task 5b-3. 5a가 심은 관측 속성(data-entry-motion,
// data-hyperspeed-motion, data-hyperspeed-visibility, data-wordmark-mode)으로
// 모션 상태 전이를 재는 자리다. 픽셀도 Three.js 프레임도 성공 조건으로
// 쓰지 않는다.

declare global {
  interface Window {
    __motionSeen: (string | null)[];
    __drawsFor: (selector: string) => number;
  }
}

// 잠금(isTransitioning)은 DOM 속성이 아니다. 대신 전환이 끝나야 활성 섹션의
// region이 포커스를 받는다(HomeClient/index.tsx의 포커스 effect가
// !isTransitioning일 때만 돈다). 이게 잠금이 풀렸다는, 사용자에게 닿는 증거다.
async function expectSettledOn(page: Page, id: string) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.activeElement?.closest('[data-section]')?.getAttribute('data-section') ??
          null
      )
    )
    .toBe(id);
}

// data-hyperspeed-motion은 전환이 끝나면 원래 값으로 돌아가므로 폴링으로는
// 중간 값을 놓칠 수 있다. 변화를 빠짐없이 적어 두고 나중에 확인한다.
async function recordMotionStates(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-hyperspeed-motion]');
    window.__motionSeen = [el?.getAttribute('data-hyperspeed-motion') ?? null];
    if (!el) return;
    new MutationObserver(() => {
      window.__motionSeen.push(el.getAttribute('data-hyperspeed-motion'));
    }).observe(el, { attributes: true, attributeFilter: ['data-hyperspeed-motion'] });
  });
}

test.describe('모션', () => {
  test('전환이 취소돼도 마지막 목적지만 활성이다', async ({ page }) => {
    await enter(page, 'about');

    // 첫 전환이 끝나기를 기다리지 않고 다음 목적지를 누른다. 진행 중인
    // opacity 전환이 잘리면서 transitioncancel이 난다.
    await navButton(page, 'Projects').click();
    await navButton(page, 'Experience').click();

    await expectActive(page, 'experience');
    await expect(page.locator('[data-section][aria-hidden="false"]')).toHaveCount(1);
    // 잘린 전환이 잠금을 들고 죽지 않았다. 다음 이동이 그대로 된다.
    await expectSettledOn(page, 'experience');
    await navButton(page, 'Skills').click();
    await expectActive(page, 'skills');
  });

  test('섹션의 최초 진입만 진입 애니메이션이다', async ({ page }) => {
    const stage = page.locator('main');
    await enter(page, 'about');
    await expect(stage).toHaveAttribute('data-entry-motion', 'enter');

    await navButton(page, 'Skills').click();
    await expectActive(page, 'skills');
    await expect(stage).toHaveAttribute('data-entry-motion', 'enter');

    // 이미 본 섹션이다. 다시 와도 처음처럼 등장하지 않는다.
    await navButton(page, 'About').click();
    await expectActive(page, 'about');
    await expect(stage).toHaveAttribute('data-entry-motion', 'steady');
  });

  test('워드마크는 SSR부터 부팅 FLIP 뒤까지 같은 노드 하나다', async ({ page, request }) => {
    // 서버가 보낸 원문에서 이미 하나다. 하이드레이션이 둘로 만들지 않는다.
    const html = await (await request.get('/')).text();
    expect(html.split('data-wordmark-mode').length - 1).toBe(1);

    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-route-resolved', 'true', {
      timeout: 20_000,
    });

    const wordmark = page.locator('[data-wordmark-mode]');
    await expect(wordmark).toHaveCount(1);
    await expect(wordmark).toHaveAttribute('data-wordmark-mode', 'hero');
    // 이 노드에만 표식을 남긴다. 전환 뒤에도 표식이 그대로면 지웠다 새로
    // 만든 것이 아니라 같은 노드가 날아간 것이다.
    await wordmark.evaluate((el) => {
      el.setAttribute('data-e2e-mark', 'wordmark');
    });

    await page.getByRole('button', { name: 'START' }).click();
    await expectActive(page, 'about');
    await expect(wordmark).toHaveAttribute('data-wordmark-mode', 'compact');
    await expect(wordmark).toHaveCount(1);
    await expect(wordmark).toHaveAttribute('data-e2e-mark', 'wordmark');
  });

  test('Hyperspeed는 이동 중 boost, 정착 뒤 slow이고 모달은 속도를 바꾸지 않는다', async ({
    page,
  }) => {
    const ready = projects.find((project) => isProjectModalReady(project));
    test.skip(!ready, '상세 계약을 통과하는 프로젝트가 없다');

    await enter(page, 'about');
    const background = page.locator('[data-testid="hyperspeed-background"]');
    await expect(background).toHaveAttribute('data-hyperspeed-motion', 'slow');

    await recordMotionStates(page);
    await navButton(page, 'Projects').click();
    await expectActive(page, 'projects');
    await expect(background).toHaveAttribute('data-hyperspeed-motion', 'slow');
    expect(await page.evaluate(() => window.__motionSeen)).toContain('boost');

    // 모달은 섹션 이동이 아니다. 초점과 밝기만 물러나고 속도는 그대로다.
    await recordMotionStates(page);
    await openProjectModal(page, ready!.title);
    await expect(background).toHaveAttribute('data-hyperspeed-visibility', 'obscured');
    expect(await page.evaluate(() => window.__motionSeen)).not.toContain('boost');
    await expect(background).toHaveAttribute('data-hyperspeed-motion', 'slow');
  });

  test('다른 섹션으로 가면 About 링이 프레임을 그리지 않는다', async ({ page }) => {
    // three가 프레임마다 부르는 그리기 호출을 캔버스별로 센다. 픽셀을 읽지
    // 않으므로 비결정적인 셰이더 출력에 기대지 않는다.
    await page.addInitScript(() => {
      const counts = new WeakMap<HTMLCanvasElement, number>();
      const patch = (proto: Record<string, unknown> | undefined) => {
        if (!proto) return;
        for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced']) {
          const original = proto[name];
          if (typeof original !== 'function') continue;
          proto[name] = function (this: WebGLRenderingContext, ...args: unknown[]) {
            const canvas = this.canvas as HTMLCanvasElement;
            if (canvas) counts.set(canvas, (counts.get(canvas) ?? 0) + 1);
            return (original as (...a: unknown[]) => unknown).apply(this, args);
          };
        }
      };
      const glProto = (
        window.WebGLRenderingContext as unknown as { prototype: Record<string, unknown> }
      )?.prototype;
      const gl2Proto = (
        window.WebGL2RenderingContext as unknown as { prototype: Record<string, unknown> }
      )?.prototype;
      patch(glProto);
      patch(gl2Proto);
      window.__drawsFor = (selector: string) => {
        const canvas = document.querySelector<HTMLCanvasElement>(selector);
        return canvas ? (counts.get(canvas) ?? 0) : -1;
      };
    });

    await enter(page, 'about');
    // 링은 두 번째 문항(AI WORKFLOW)을 고를 때 비로소 청크가 풀린다.
    // 라벨은 사용자 콘텐츠라 순서로 집는다.
    await page
      .getByRole('navigation', { name: 'About 문항' })
      .getByRole('button')
      .nth(1)
      .click();

    const rings = '[data-about-visual-index="1"] canvas';
    // 장식이라 aria-hidden이다. 보이는지가 아니라 붙었는지만 본다.
    await expect(page.locator(rings)).toBeAttached({ timeout: 20_000 });
    const draws = () => page.evaluate((selector) => window.__drawsFor(selector), rings);
    await expect.poll(draws).toBeGreaterThan(0);

    await navButton(page, 'Skills').click();
    await expectActive(page, 'skills');

    // 떠나는 순간 날던 프레임 하나는 도착한다. 그 뒤로 멈춰 있는지를 본다.
    await waitFrames(page, 30);
    const settled = await draws();
    await waitFrames(page, 30);
    expect(await draws()).toBe(settled);
  });

  test('해시로 바로 들어가면 overview 부팅도 Hyperspeed boost도 없다 @smoke', async ({
    page,
  }) => {
    // 페이지가 뜨기 전에 감시자를 심는다. 속성이 붙는 순간부터 값을 전부
    // 적어 두므로 route-resolution 이전의 짧은 boost도 놓치지 않는다.
    await page.addInitScript(() => {
      window.__motionSeen = [];
      const record = () => {
        const el = document.querySelector('[data-hyperspeed-motion]');
        if (el) window.__motionSeen.push(el.getAttribute('data-hyperspeed-motion'));
      };
      new MutationObserver(record).observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-hyperspeed-motion'],
      });
    });

    await enter(page, 'projects');
    await expect(page.locator('[data-testid="hyperspeed-background"]')).toHaveAttribute(
      'data-hyperspeed-motion',
      'slow'
    );

    expect(await page.evaluate(() => window.__motionSeen)).not.toContain('boost');
    // 부팅 안무는 overview의 것이다. 여기서는 시작조차 하지 않는다.
    await expect(page.getByRole('button', { name: 'START' })).toBeHidden();
    await expect(page.locator('[data-wordmark-mode]')).toHaveAttribute(
      'data-wordmark-mode',
      'compact'
    );
  });
});

test.describe('모션을 끈 사용자', () => {
  test.use({ reducedMotion: 'reduce' });

  test('0ms 전환에서도 잠금이 풀리고 마지막 목적지만 활성이다 @smoke', async ({ page }) => {
    await enter(page, 'about');
    await expect(page.locator('main')).toHaveAttribute('data-reduced-motion', 'true');

    // 계산된 전환이 실제로 0이다. CSS 문자열이 아니라 엔진이 계산한 값이다.
    const duration = await page
      .locator('[data-section="about"]')
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe('0s');

    await navButton(page, 'Projects').click();
    await navButton(page, 'Experience').click();

    await expectActive(page, 'experience');
    await expect(page.locator('[data-section][aria-hidden="false"]')).toHaveCount(1);
    // transitionend가 영영 오지 않는 경로다. 잠금이 그래도 풀린다.
    await expectSettledOn(page, 'experience');
    await navButton(page, 'Skills').click();
    await expectActive(page, 'skills');
  });
});
