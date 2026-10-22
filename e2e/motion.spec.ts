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
  test('Hero→About 경계는 지점을 넘을 때 이름 버튼 하나와 로고 host 하나를 실제 앵커 사이로 한 번 옮기고 되넘으면 돌려놓는다', async ({ page }) => {
    // 이 한 건이 진입, 스크롤 왕복, 리사이즈 두 번, 되돌기까지 쉬는 자리를 열 번 넘게 기다린다. 소프트웨어 GL에서는 호출 하나가
    // 1.2~1.4초라 설정의 60초 상한을 쉬는 자리 대기와 무관하게 넘긴다. 성공 조건이 아니라 실패 상한이다.
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'overview');
    const name = page.getByTestId('wordmark');
    const owner = page.locator('.portfolio-document');
    const singles = () => page.evaluate(() => [document.querySelectorAll('[data-testid="wordmark"]').length, document.querySelectorAll('[data-logo-host]').length]);
    const scrollTo = (top: number) => page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top);
    // 상자들은 한 번의 evaluate로 같은 프레임에서 읽는다. 소프트웨어 GL에서는 프레임이 1초 가까이 걸려 따로 읽으면 사이에 화면이 바뀐다.
    const offsets = () => page.evaluate(() => {
      const r = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const [name, slot, headline, nav, about, host] = ['[data-testid="wordmark"]', '[data-motion-anchor="hero-name"]', '#overview h1', '[data-motion-anchor="nav-name"]', '[data-motion-anchor="about-logo"]', '[data-logo-host]'].map(r);
      const centre = (a: DOMRect) => [a.left + a.width / 2, a.top + a.height / 2];
      const [, ny] = centre(name);
      return {
        // Hero: 세로 가운데는 이름 자리에, 왼쪽 끝은 자리와 바로 아래 문장의 왼쪽 끝에 맞는다(Task 9).
        hero: Math.max(Math.abs(centre(slot)[1] - ny), Math.abs(slot.left - name.left), Math.abs(headline.left - name.left)),
        // nav: 왼쪽 끝과 세로 가운데가 앵커에 맞는다.
        nav: Math.max(Math.abs(nav.left - name.left), Math.abs(centre(nav)[1] - ny)),
        logo: Math.max(Math.abs(centre(about)[0] - centre(host)[0]), Math.abs(centre(about)[1] - centre(host)[1])),
        width: Math.abs(about.width - host.width),
      };
    });
    const offHero = async () => (await offsets()).hero;
    const offNav = async () => (await offsets()).nav;
    const offLogo = async () => (await offsets()).logo;
    // 재생은 시간으로 간다. 소프트웨어 GL의 긴 프레임에는 GSAP 지연 보정이 프레임마다 33ms만 흘려 0.5초가 수십 초가 될 수 있다.
    // 그래서 쉬는 자리를 기다리는 상한을 넉넉히 둔다. 성공 조건이 아니라 실패 상한이고, 실제 재생 시간은 헤드 Chrome에서 잰다.
    const settled = { timeout: 20_000 };
    const atRest = async (mode: 'hero' | 'nav') => {
      await expect(name).toHaveAttribute('data-wordmark-mode', mode, settled);
      await expect(name).toHaveCSS('transform', 'none', settled);
    };
    // /#overview 첫 방문은 진입을 돌고 GL 로고는 그 뒤에 뜬다. 이 검사는 경계만 보므로 아무 키로 진입을 끝낸다.
    await page.keyboard.press('Shift');
    await expect(page.locator('html')).not.toHaveAttribute('data-intro', { timeout: 30_000 });
    await atRest('hero');
    await expect.poll(offHero, settled).toBeLessThan(1.5);
    // 쉬는 Hero 자리의 누르는 상자는 보이는 글자 줄이다. 왼쪽 문장을 덮지 않는다.
    const [rest, headline] = [(await name.boundingBox())!, (await page.getByRole('heading', { level: 1 }).boundingBox())!];
    expect(rest.y + rest.height).toBeLessThanOrEqual(headline.y);
    await expect(owner).toHaveAttribute('data-logo-owner', 'hero', { timeout: 20_000 });
    // 첫 GL 그림(문맥 생성)이 끝난 뒤에 스크롤한다. 그 사이 프레임이 멈춰 재생이 늦게 따라온다.
    await expect(owner).toHaveAttribute('data-logo-live', '', { timeout: 30_000 });
    expect(await singles()).toEqual([1, 1]);
    // Task 9·10: Hero에서 쉬는 동안은 볼(GL 캔버스 하나)만 보이고 Electric 로고는 숨어 있다(안쪽 불투명도 0).
    const ball = page.locator('#overview [data-motion-anchor="hero-object"]');
    const logoInner = page.locator('[data-logo-host] > div');
    await expect(page.locator('#overview [data-motion-anchor="hero-object"] canvas')).toHaveCount(1, settled);
    await expect(logoInner).toHaveCSS('opacity', '0');
    await expect(ball).toHaveCSS('opacity', '1');
    await expect(ball).toHaveCSS('transform', 'none');

    // 로고 지점(Task 10, Task 11에서 1.5초 비행에 맞춰 15%): About 본문이 나타나기 시작하는 R(잠금 자리 - 화면 절반)보다 화면 높이의 15% 앞, 이름 문턱(180) 아래로는 가지 않는다.
    const points = await page.evaluate(() => {
      const about = document.querySelector<HTMLElement>('[data-section="about"]')!;
      const lock = about.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(about).scrollMarginTop);
      const reveal = lock - innerHeight / 2;
      return { reveal, start: Math.max(180, reveal - .15 * innerHeight) };
    });
    // 휠 두 칸(200px): 이름만 nav로 간다. 로고 지점은 아직이다(1440x900에서 223).
    expect(points.start).toBeGreaterThan(200);
    await scrollTo(200);
    await atRest('nav');
    await expect.poll(offNav, settled).toBeLessThan(1.5);
    await expect(owner).toHaveAttribute('data-logo-owner', 'hero');
    // 한 칸 올라오면 Hero로 돌아온다.
    await scrollTo(100);
    await atRest('hero');
    await expect.poll(offHero, settled).toBeLessThan(1.5);
    expect(await singles()).toEqual([1, 1]);

    // 지점을 넘으면 한 번 재생해 About 앵커에 내려앉는다. 스크롤을 더 하지 않아도 끝까지 간다.
    // 바로 본문 등장 자리(R)까지 굴려도 본문은 로고가 내려앉은 뒤에 나타난다. 입력은 막지 않는다.
    const entered = page.locator('#about [data-motion-layout="reading"]');
    // 매 프레임 두 표시를 같이 읽어, 날아가는 동안 본문이 한 번이라도 나타났는지 센다.
    const gate = page.evaluate(() => new Promise<{ flying: number; early: number }>(resolve => {
      const counts = { flying: 0, early: 0 };
      const read = () => {
        const owner = document.querySelector('.portfolio-document')!.getAttribute('data-logo-owner');
        const shown = document.querySelector('#about [data-motion-layout="reading"]')!.getAttribute('data-entered') === 'true';
        if (owner === 'boundary') { counts.flying++; if (shown) counts.early++; }
        if (owner === 'about') resolve(counts); else requestAnimationFrame(read);
      };
      read();
    }));
    await scrollTo(Math.round(points.reveal) + 10);
    const seen = await gate;
    expect(seen.flying).toBeGreaterThan(0);
    expect(seen.early).toBe(0);
    await expect(entered).toHaveAttribute('data-entered', 'true');
    // 볼은 작은 고리로 접혀 사라지고 로고가 다 드러난다. 이 자리에서는 About 레일이 등장 transform 중이라 앵커는 레이아웃 자리로 잰다.
    await expect(ball).toHaveCSS('opacity', '0', settled);
    await expect(logoInner).toHaveCSS('opacity', '1', settled);
    await expect.poll(() => page.evaluate(() => {
      let [x, y] = [0, 0];
      const anchor = document.querySelector<HTMLElement>('[data-motion-anchor="about-logo"]')!;
      for (let node: HTMLElement | null = anchor; node; node = node.offsetParent as HTMLElement | null) { x += node.offsetLeft; y += node.offsetTop; }
      const host = document.querySelector('[data-logo-host]')!.getBoundingClientRect();
      return Math.max(Math.abs(x + anchor.offsetWidth / 2 - host.left - host.width / 2), Math.abs(y + anchor.offsetHeight / 2 - scrollY - host.top - host.height / 2));
    }), settled).toBeLessThan(1.5);
    await atRest('nav');
    expect(await singles()).toEqual([1, 1]);
    // 경로 지점(아래 Task 12)에 닿지 않고 돌아서면 되돌아오는 문턱은 지점 24px 위다(Task 11). 그 사이에서는 About에 머물고, R 위로 올라왔어도 본문이 그대로 보인다.
    await scrollTo(Math.round(points.start) - 12);
    await expect(owner).toHaveAttribute('data-logo-owner', 'about');
    await expect(entered).toHaveAttribute('data-entered', 'true');
    // 넘으면 로고가 원으로 접혀 돌아가고 볼이 다시 펼쳐진다. 본문은 되돌기가 시작한 프레임보다 먼저 사라지지 않는다.
    const back = page.evaluate(() => new Promise<number>(resolve => {
      let early = 0;
      const read = () => {
        const owner = document.querySelector('.portfolio-document')!.getAttribute('data-logo-owner');
        if (owner !== 'about') return resolve(early);
        if (document.querySelector('#about [data-motion-layout="reading"]')!.getAttribute('data-entered') !== 'true') early++;
        requestAnimationFrame(read);
      };
      read();
    }));
    await scrollTo(Math.round(points.start) - 28);
    expect(await back).toBe(0);
    await expect(owner).toHaveAttribute('data-logo-owner', 'hero', settled);
    await expect(ball).toHaveCSS('opacity', '1', settled);
    await expect(ball).toHaveCSS('transform', 'none', settled);
    await expect(logoInner).toHaveCSS('opacity', '0', settled);

    await navButton(page, 'About').click(); await expectActive(page, 'about');
    await expect(owner).toHaveAttribute('data-logo-owner', 'about', settled);
    await expect.poll(offLogo, settled).toBeLessThan(1.5);
    expect(await singles()).toEqual([1, 1]);

    // 창이 줄면 host도 줄어든 앵커를 따라간다.
    await page.setViewportSize({ width: 1100, height: 760 });
    // 재생 없이 다시 재는 일이지만 표본마다 프로토콜 호출 하나(소프트웨어 GL에서 1.2~1.4초)가 들어, 기본 5초에는 표본이 서너 개뿐이다.
    // 앵커를 지켜보므로 main 크기 변화를 기다리지 않는다. 상한은 성공 조건이 아니라 실패 상한이다.
    await expect.poll(async () => (await offsets()).width, settled).toBeLessThan(1.5);
    await page.setViewportSize({ width: 1440, height: 900 });

    await name.click(); await expectActive(page, 'overview');
    await expect(owner).toHaveAttribute('data-logo-owner', 'hero', settled);
    await atRest('hero');
    await expect.poll(offHero, settled).toBeLessThan(1.5);
    expect(await singles()).toEqual([1, 1]);

    // Task 12(사용자 요청 2026-10-22): 위로 갈 때 되돌기는 경로가 About에서 Overview로 바뀌는 스크롤에서 시작한다.
    // 경로 지점은 useSectionNav의 읽기선(실측 header 아래 화면의 40%)이 About 위끝에 닿는 스크롤이고, 1440x900에서는 로고 지점과 R보다 아래다.
    await navButton(page, 'About').click(); await expectActive(page, 'about');
    await expect(owner).toHaveAttribute('data-logo-owner', 'about', settled);
    const routeAt = await page.evaluate(() => {
      const top = document.querySelector('[data-section="about"]')!.getBoundingClientRect().top + scrollY;
      const header = document.querySelector('[data-scroll-header]')!.getBoundingClientRect().height;
      return top - (header + (innerHeight - header) * .4);
    });
    expect(routeAt).toBeGreaterThan(points.reveal);
    await scrollTo(Math.ceil(routeAt) + 2);
    await expectActive(page, 'about');
    await expect(owner).toHaveAttribute('data-logo-owner', 'about');
    await expect(entered).toHaveAttribute('data-entered', 'true');
    const leave = page.evaluate(() => new Promise<number>(resolve => {
      let early = 0;
      const read = () => {
        if (document.querySelector('.portfolio-document')!.getAttribute('data-logo-owner') !== 'about') return resolve(early);
        if (document.querySelector('#about [data-motion-layout="reading"]')!.getAttribute('data-entered') !== 'true') early++;
        requestAnimationFrame(read);
      };
      read();
    }));
    await scrollTo(Math.floor(routeAt) - 2);
    expect(await leave).toBe(0);
    await expectActive(page, 'overview');
    await expect(owner).toHaveAttribute('data-logo-owner', 'hero', settled);
    // Hero에 내려앉은 로고는 R 아래에서도 본문을 다시 열지 않는다.
    await expect(entered).toHaveAttribute('data-entered', 'false');
  });
  test('문턱 아래로 바로 온 해시는 처음부터 이름이 nav, 로고가 About 자리이고 재생하지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'about');
    const name = page.getByTestId('wordmark');
    await expect(name).toHaveAttribute('data-wordmark-mode', 'nav');
    await expect(name).toHaveCSS('transform', 'none');
    const [a, b] = [(await page.locator('[data-motion-anchor="nav-name"]').boundingBox())!, (await name.boundingBox())!];
    expect(Math.abs(a.x - b.x)).toBeLessThan(1.5);
    await expect(page.locator('.portfolio-document')).not.toHaveAttribute('data-logo-owner', /hero|boundary/, { timeout: 20_000 });
  });
  test('첫 방문은 커튼 없이 바로 진입해 완성된 첫 화면으로 끝나고 큰 이름은 문장 바로 위 같은 왼쪽 끝에 있다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // load를 기다리면 진입이 이미 끝났을 수 있다. 문서가 오자마자 표시를 본다.
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('html')).toHaveAttribute('data-intro', /^(playing)?$/);
    await expect(page.locator('.intro-curtain, .intro-greeting')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-intro', { timeout: 30_000 });
    const headline = page.getByRole('heading', { level: 1 });
    await expect(headline).toHaveText('안녕하세요. SW개발자 김태인입니다.');
    expect(await headline.evaluate(el => el.children.length)).toBe(0);
    const [anchor, text, name] = [(await page.locator('[data-motion-anchor="hero-name"]').boundingBox())!, (await headline.boundingBox())!, (await page.getByTestId('wordmark').boundingBox())!];
    expect(Math.abs(anchor.y + anchor.height / 2 - name.y - name.height / 2)).toBeLessThan(1.5);
    expect(Math.abs(text.x - name.x)).toBeLessThan(1.5);
    expect(name.y + name.height).toBeLessThanOrEqual(text.y);
    // 자리 높이는 이름 글자 크기의 1.5배다. 왼쪽 문장(1440에서 36px)의 1.5배를 넘는다.
    expect(anchor.height / 1.5).toBeGreaterThan(36 * 1.5);
    await expect(page.getByTestId('wordmark').locator('span')).toHaveCSS('opacity', '1');
    // 다시 위로 와도 진입은 돌지 않는다.
    await navButton(page, 'About').click(); await expectActive(page, 'about');
    await page.getByRole('button', { name: 'KIM TAEIN, 개요로 이동', exact: true }).click(); await expectActive(page, 'overview');
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
  test('reduced motion switches the name at the same point without playing and mounts no GL logo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'overview');
    const name = page.getByTestId('wordmark');
    await expect(name).toHaveAttribute('data-wordmark-mode', 'hero');
    await expect(page.locator('main')).toHaveAttribute('data-motion-ready', 'true');
    // 재생이 없으니 바뀐 다음 프레임에 이미 nav 자리다.
    const switched = await page.evaluate(() => new Promise<string[]>(resolve => {
      const button = document.querySelector<HTMLElement>('[data-testid="wordmark"]')!;
      const until = performance.now() + 5000;
      window.scrollTo({ top: 300, behavior: 'instant' });
      const check = () => button.dataset.wordmarkMode === 'nav' || performance.now() > until
        ? requestAnimationFrame(() => resolve([button.dataset.wordmarkMode!, getComputedStyle(button).transform]))
        : requestAnimationFrame(check);
      check();
    }));
    expect(switched).toEqual(['nav', 'none']);
    await expect(name).toHaveCSS('transform', 'none');
    await expect(page.locator('[data-logo-host]')).toHaveCount(1);
    await expect(page.locator('[data-logo-host] canvas')).toHaveCount(0);
    // Hero 오브젝트는 같은 구성의 정적 볼이다(유리 + 핵심 아이콘 여섯, 움직임 없음).
    await expect(page.locator('[data-motion-anchor="hero-object"] .hero-ball-glass')).toBeVisible();
    await expect(page.locator('[data-motion-anchor="hero-object"] .hero-ball-icons > span')).toHaveCount(6);
    await expect(page.locator('[data-motion-anchor="hero-object"] canvas')).toHaveCount(0);
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
