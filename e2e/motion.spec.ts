import { test, expect } from '@playwright/test';
import { enter, expectActive, navButton, openProjectModal, waitFrames } from './helpers';
import { projects } from '@/lib/data/projects';
import { isProjectModalReady } from '@/lib/utils/projectContract';
declare global { interface Window { __drawsFor: (selector: string) => number; __setHidden: (hidden: boolean) => void; } }

test.describe('Native motion activity', () => {
  test('다른 섹션으로 가면 About ElectricLogo가 멈추고 돌아오면 다시 그린다', async ({ page }) => {
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
    // 한 캔버스가 문항별 로고를 바꾼다. 라벨 대신 문항 순서로 고른다.
    await page
      .getByRole('navigation', { name: 'About 문항' })
      .getByRole('button')
      .nth(1)
      .click();

    // 공유 로고는 셸의 host 하나에 산다. About은 앵커만 둔다.
    const logo = '[data-logo-host] canvas';
    // 장식이라 aria-hidden이다. 보이는지가 아니라 붙었는지만 본다.
    await expect(page.locator(logo)).toBeAttached({ timeout: 20_000 });
    const draws = () => page.evaluate((selector) => window.__drawsFor(selector), logo);
    await expect.poll(draws).toBeGreaterThan(0);

    await navButton(page, 'Skills').click();
    await expectActive(page, 'skills');

    // 떠나는 순간 날던 프레임 하나는 도착한다. 그 뒤로 멈춰 있는지를 본다.
    await waitFrames(page, 30);
    const settled = await draws();
    await waitFrames(page, 30);
    expect(await draws()).toBe(settled);
    await navButton(page, 'About').click();
    await expectActive(page, 'about');
    await expect.poll(draws).toBeGreaterThan(settled);
  });

  test('Luminous는 화면 밖에서 렌더링을 멈추고 돌아오면 재개한다', async ({ page }) => {
    await page.addInitScript(() => {
      const counts = new WeakMap<HTMLCanvasElement, number>();
      const original = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        counts.set(this.canvas, (counts.get(this.canvas) ?? 0) + 1);
        return original.apply(this, args);
      };
      window.__drawsFor = (selector: string) => {
        const canvas = document.querySelector<HTMLCanvasElement>(selector);
        return canvas ? (counts.get(canvas) ?? 0) : -1;
      };
    });
    await page.goto('/background-preview');
    const canvas = page.locator('main canvas');
    await expect(canvas).toHaveCount(1);
    const draws = () => page.evaluate(() => window.__drawsFor('main canvas'));
    await expect.poll(draws).toBeGreaterThan(0);

    // DOM을 유지한 채 가시성만 바꿔 IntersectionObserver의 정지 계약을 검증한다.
    await canvas.evaluate((el) => {
      el.parentElement!.style.transform = 'translateX(200vw)';
    });
    await waitFrames(page, 30);
    const settled = await draws();
    await waitFrames(page, 30);
    expect(await draws()).toBe(settled);

    await canvas.evaluate((el) => {
      el.parentElement!.style.transform = '';
    });
    await expect.poll(draws).toBeGreaterThan(settled);
  });

  test('Luminous는 탭이 숨으면 멈추고 창 크기가 바뀌어도 같은 캔버스로 이어 그린다', async ({ page }) => {
    await page.addInitScript(() => {
      const counts = new WeakMap<HTMLCanvasElement, number>(); const original = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) { counts.set(this.canvas, (counts.get(this.canvas) ?? 0) + 1); return original.apply(this, args); };
      window.__drawsFor = selector => { const canvas = document.querySelector<HTMLCanvasElement>(selector); return canvas ? counts.get(canvas) ?? 0 : -1; };
      // 헤드리스 탭은 실제로 숨지 않으므로 visibilitychange 계약만 흉내 낸다.
      let hidden = false;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      window.__setHidden = value => { hidden = value; document.dispatchEvent(new Event('visibilitychange')); };
    });
    await page.goto('/background-preview');
    const canvas = page.locator('main canvas');
    await canvas.evaluate(el => el.setAttribute('data-e2e-mark', 'same'));
    const draws = () => page.evaluate(() => window.__drawsFor('main canvas'));
    await expect.poll(draws).toBeGreaterThan(0);

    await page.evaluate(() => window.__setHidden(true)); await waitFrames(page, 30);
    const hidden = await draws(); await waitFrames(page, 30); expect(await draws()).toBe(hidden);
    await page.evaluate(() => window.__setHidden(false));
    await expect.poll(draws).toBeGreaterThan(hidden);

    const beforeResize = await draws();
    await page.setViewportSize({ width: 900, height: 700 });
    await expect(canvas).toHaveCSS('width', '900px');
    await expect(canvas).toHaveAttribute('data-e2e-mark', 'same');
    await expect.poll(draws).toBeGreaterThan(beforeResize);
  });

  test('wordmark remains one persistent node through document navigation', async ({ page, request }) => {
    const html = await (await request.get('/')).text(); expect(html.split('data-wordmark-mode').length - 1).toBe(1);
    await enter(page, 'overview'); const wordmark = page.getByTestId('wordmark');
    await wordmark.evaluate(el => el.setAttribute('data-e2e-mark', 'same'));
    await navButton(page, 'About').click(); await expectActive(page, 'about');
    await expect(wordmark).toHaveAttribute('data-e2e-mark', 'same');
    await expect(page.getByRole('button', { name: 'START' })).toHaveCount(0);
  });
  test('Hero→About 경계는 이름 버튼 하나와 로고 host 하나를 실제 앵커 사이로 옮기고 되감으면 돌려놓는다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'overview');
    const name = page.getByTestId('wordmark');
    const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
    const singles = () => page.evaluate(() => [document.querySelectorAll('[data-testid="wordmark"]').length, document.querySelectorAll('[data-logo-host]').length]);
    // nav: 왼쪽 끝과 세로 가운데가 앵커에 맞는다.
    const offAnchor = async (selector: string) => {
      const [a, b] = [await box(selector), (await name.boundingBox())!];
      return Math.max(Math.abs(a.x - b.x), Math.abs(a.y + a.height / 2 - b.y - b.height / 2));
    };
    // Hero: 세로 가운데는 이름 자리에, 가로 가운데는 Hero에 맞는다. 버튼 상자는 끝 자간(0.1em × 배율)의 절반만큼 오른쪽으로 비켜 있다.
    const offHero = async () => {
      const [a, hero, b] = [await box('[data-motion-anchor="hero-name"]'), await box('#overview'), (await name.boundingBox())!];
      return Math.max(Math.abs(a.y + a.height / 2 - b.y - b.height / 2), Math.abs(hero.x + hero.width / 2 - b.x - b.width / 2) - 10);
    };
    const offLogo = async () => {
      const [a, b] = [await box('[data-motion-anchor="about-logo"]'), await box('[data-logo-host]')];
      return Math.max(Math.abs(a.x + a.width / 2 - b.x - b.width / 2), Math.abs(a.y + a.height / 2 - b.y - b.height / 2));
    };
    // /#overview 첫 방문은 진입을 돌고 GL 로고는 그 뒤에 뜬다. 이 검사는 경계만 보므로 아무 키로 진입을 끝낸다.
    await page.keyboard.press('Shift');
    await expect(page.locator('html')).not.toHaveAttribute('data-intro', { timeout: 30_000 });
    await expect.poll(offHero).toBeLessThan(1.5);
    await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'hero', { timeout: 20_000 });
    // 첫 GL 그림(문맥 생성)이 끝난 뒤에 스크롤한다. 그 사이 프레임이 멈춰 경계가 늦게 따라온다.
    await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-live', '', { timeout: 30_000 });
    expect(await singles()).toEqual([1, 1]);

    // 경계 한가운데: 이름은 nav에 닿았고 로고는 아직 떠나는 중이다.
    const end = await page.evaluate(() => { const about = document.querySelector<HTMLElement>('[data-section="about"]')!; return about.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(about).scrollMarginTop); });
    await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), Math.round(end * .6));
    await waitFrames(page, 4);
    await expect.poll(() => offAnchor('[data-motion-anchor="nav-name"]')).toBeLessThan(1.5);
    await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'boundary');
    expect(await singles()).toEqual([1, 1]);

    await navButton(page, 'About').click(); await expectActive(page, 'about');
    await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'about');
    await expect.poll(offLogo).toBeLessThan(1.5);
    expect(await singles()).toEqual([1, 1]);

    // 창이 줄면 host도 줄어든 앵커를 따라간다.
    await page.setViewportSize({ width: 1100, height: 760 });
    await expect.poll(async () => {
      const [a, b] = [await box('[data-motion-anchor="about-logo"]'), await box('[data-logo-host]')];
      return Math.abs(a.width - b.width);
    }).toBeLessThan(1.5);
    await page.setViewportSize({ width: 1440, height: 900 });

    await navButton(page, '개요로 이동').click(); await expectActive(page, 'overview');
    await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'hero');
    await expect.poll(offHero).toBeLessThan(1.5);
    expect(await singles()).toEqual([1, 1]);
  });
  test('첫 방문은 커튼 없이 바로 진입해 완성된 첫 화면으로 끝나고 큰 이름은 Hero 가운데에 있다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-intro', /^(playing)?$/);
    await expect(page.locator('.intro-curtain, .intro-greeting')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-intro', { timeout: 30_000 });
    const headline = page.getByRole('heading', { level: 1 });
    await expect(headline).toHaveText('안녕하세요. SW개발자 김태인입니다.');
    expect(await headline.evaluate(el => el.children.length)).toBe(0);
    const [anchor, hero, name] = [(await page.locator('[data-motion-anchor="hero-name"]').boundingBox())!, (await page.locator('#overview').boundingBox())!, (await page.getByTestId('wordmark').boundingBox())!];
    expect(Math.abs(anchor.y + anchor.height / 2 - name.y - name.height / 2)).toBeLessThan(1.5);
    expect(Math.abs(hero.x + hero.width / 2 - name.x - name.width / 2)).toBeLessThan(10);
    // 자리 높이는 이름 글자 크기의 1.5배다. 왼쪽 문장(48px)의 1.5배를 넘는다.
    expect(anchor.height / 1.5).toBeGreaterThan(48 * 1.5);
    await expect(page.getByTestId('wordmark').locator('span')).toHaveCSS('opacity', '1');
    // 다시 위로 와도 진입은 돌지 않는다.
    await navButton(page, 'About').click(); await expectActive(page, 'about');
    await navButton(page, '개요로 이동').click(); await expectActive(page, 'overview');
    await expect(page.locator('html')).not.toHaveAttribute('data-intro');
  });
  test('직접 해시와 첫 휠은 진입을 기다리지 않는다', async ({ page }) => {
    await page.goto('/#projects');
    await expect(page.locator('html')).not.toHaveAttribute('data-intro');
    await enter(page, 'projects');
    await page.goto('about:blank');
    await page.goto('/');
    // React가 진입을 맡은 직후에 휠을 보낸다. 진입이 끝나도 휠은 그대로 문서를 내린다.
    await page.locator('html[data-intro="playing"]').waitFor({ state: 'attached', timeout: 20_000 });
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 400);
    await expect(page.locator('html')).not.toHaveAttribute('data-intro');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
  test('reduced motion leaves the name in the navigation and mounts no GL logo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'overview');
    await expect(page.getByTestId('wordmark')).toHaveCSS('transform', 'none');
    await expect(page.locator('[data-logo-host]')).toHaveCount(1);
    await expect(page.locator('[data-logo-host] canvas')).toHaveCount(0);
    await expect(page.locator('[data-motion-anchor="hero-object"] .about-electric-static')).toBeVisible();
  });
  test('reduced motion deep links settle with native readable sections @smoke', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await enter(page, 'projects');
    await expect(page.locator('main')).toHaveAttribute('data-reduced-motion', 'true');
    await expect(page.locator('[data-section][inert], [data-section][aria-hidden="true"]')).toHaveCount(0);
    await navButton(page, 'Experience').click(); await expectActive(page, 'experience');
    await expect(page.locator('[data-section="experience"]')).toBeFocused();
  });
  test('modal pauses the document flow renderer and closing resumes the same canvas', async ({ page }) => {
    await page.addInitScript(() => {
      const counts = new WeakMap<HTMLCanvasElement, number>(); const original = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) { counts.set(this.canvas, (counts.get(this.canvas) ?? 0) + 1); return original.apply(this, args); };
      window.__drawsFor = selector => { const canvas = document.querySelector<HTMLCanvasElement>(selector); return canvas ? counts.get(canvas) ?? 0 : -1; };
    });
    await enter(page, 'projects'); const selector = '.portfolio-document > [aria-hidden="true"] canvas';
    const canvas = page.locator(selector); await canvas.evaluate(el => el.setAttribute('data-e2e-mark', 'same'));
    const draws = () => page.evaluate(selector => window.__drawsFor(selector), selector);
    await expect.poll(draws).toBeGreaterThan(0);
    await openProjectModal(page, projects.find(isProjectModalReady)!.title); await waitFrames(page, 30);
    const paused = await draws(); await waitFrames(page, 30); expect(await draws()).toBe(paused);
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(canvas).toHaveAttribute('data-e2e-mark', 'same'); await expect.poll(draws).toBeGreaterThan(paused);
  });
});
