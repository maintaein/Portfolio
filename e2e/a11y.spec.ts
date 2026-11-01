import { test, expect } from '@playwright/test';
import { enter, expectActive, SLOW } from './helpers';
import { projects } from '@/lib/data/projects';
import { coreValues } from '@/lib/data/profile';

// 계획 6 Task 5b-2. 접근성 계약 3건. 포커스 순서, 리플로, 레이아웃 이동은
// 실제 레이아웃 엔진이 있어야 잴 수 있다.

// layout-shift는 브라우저가 넘겨주는 항목에만 있는 필드라 여기서 좁힌다.
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

declare global {
  interface Window {
    __clsTotal: number;
  }
}

test.describe('접근성', () => {
  test('첫 화면에 페이지 제목이 하나 있다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('About 대비 스크림은 배경 위·본문 아래에 깔리고 Projects가 읽기선을 가지면 투명하다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await enter(page, 'about');
    const scrim = page.locator('[data-about-scrim][data-about-scrim-index="0"]').first();
    await expect(scrim).toHaveCSS('opacity', '1');
    // pointer-events는 칠하는 순서를 바꾸지 않는다. 히트 테스트에 잡히게만 연다.
    const order = await page.evaluate(() => {
      const scrimEl = document.querySelector<HTMLElement>('[data-about-scrim][data-about-scrim-index="0"]')!;
      const background = document.querySelector<HTMLElement>('.portfolio-document > [aria-hidden="true"]')!;
      scrimEl.style.pointerEvents = 'auto'; background.style.pointerEvents = 'auto';
      const stack = document.elementsFromPoint(1400, 500);
      scrimEl.style.pointerEvents = ''; background.style.pointerEvents = '';
      return {
        section: stack.findIndex(el => el.closest('[data-section="about"]')),
        scrim: stack.indexOf(scrimEl),
        background: stack.findIndex(el => background.contains(el)),
      };
    });
    expect(order.scrim).toBeGreaterThanOrEqual(0);
    expect(order.scrim).toBeLessThan(order.background);
    expect(order.section).toBeLessThan(order.scrim);
    await page.locator('[data-section="projects"]').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 400));
    await expectActive(page, 'projects');
    for (const layer of await page.locator('[data-about-scrim]').all()) await expect(layer).toHaveCSS('opacity', '0');
  });

  test('About chapter 단어는 44px 표적이고 chapter 제목은 섹션 h2 아래 h3다', async ({ page }) => {
    await enter(page, 'about');
    const words = page.getByRole('navigation', { name: 'About 문항' }).getByRole('button');
    await expect(words).toHaveCount(3);
    for (const word of await words.all()) {
      const box = await word.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.locator('#about').locator('h1, h2, h3').evaluateAll(els => els.map(el => el.tagName))).toEqual(['H2', 'H3', 'H3', 'H3']);
  });

  test('모션 감소와 낮은 화면에서는 About의 세 chapter를 정적 원문으로 읽는다', async ({ page }) => {
    for (const { reducedMotion, height } of [{ reducedMotion: 'reduce', height: 720 }, { reducedMotion: 'no-preference', height: 600 }] as const) {
      await page.emulateMedia({ reducedMotion });
      await page.setViewportSize({ width: 1280, height });
      await enter(page, 'about');
      await expect(page.locator('[data-motion-layout="reading"][data-static]')).toHaveCount(1);
      await expect(page.locator('#about article[inert]')).toHaveCount(0);
      for (const { title } of coreValues) await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible();
      // 세 chapter가 한 칸에 겹치지 않고 차례로 쌓인다.
      const boxes = await page.locator('#about article').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
      for (let i = 1; i < boxes.length; i += 1) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom - 1);
    }
  });

  // M4 Task 8. lg 아래에는 이름 목록이 없고 프리뷰 캡션이 지금 프로젝트의 제목을 보여 준다
  test('긴 프로젝트 제목이 모바일 화면 안에 보인다', async ({ page }) => {
    const longest = projects.reduce((at, project, i) => project.title.length > projects[at].title.length ? i : at, 0);
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 812 });
      await enter(page, 'projects');
      await expect(page.locator('#projects [data-part="index"]')).toBeHidden();
      for (let i = 0; i < longest; i += 1) await page.getByRole('button', { name: '다음 프로젝트' }).click();
      const title = page.locator('#projects [data-part="preview-caption-text"] p').first();
      await expect(title).toHaveText(projects[longest].title);
      const bounds = await title.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
  });

  // M4 Task 8. lg 아래에서 포인터 없이 넘기는 길은 보이는 이전·다음 단추다. 끝에서는 순환하지 않는다
  test('모바일 Projects 진행 안내가 키보드의 이전·다음과 함께 갱신된다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await enter(page, 'projects');
    const status = page.locator('#projects [data-part="mobile-status"]');
    const count = projects.length;
    const of = (n: number) => `${String(n).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
    const next = page.getByRole('button', { name: '다음 프로젝트' });
    const prev = page.getByRole('button', { name: '이전 프로젝트' });
    for (const button of [prev, next]) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(status).toContainText(of(1));
    await expect(status).toContainText(projects[0].title);
    await next.focus();
    for (let i = 1; i < count + 1; i += 1) await page.keyboard.press('Enter');
    await expect(status).toContainText(of(count));
    await expect(status).toContainText(projects[count - 1].title);
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toBeFocused();
    await prev.focus();
    await page.keyboard.press('Enter');
    await expect(status).toContainText(of(count - 1));
    await expect(status).toContainText(projects[count - 2].title);
  });

  // M4 Task 8. lg 아래에서는 프리뷰를 가로로 끌어 넘긴다. 실제 터치(CDP)로 끌고, 끝에서는 순환하지 않고, 탭은 상세를 연다
  test('모바일(390x844)에서 프리뷰를 가로로 끌면 이웃 프로젝트로 넘어가고 끝에서는 돌아온다', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'CDP 터치 입력');
    await page.setViewportSize({ width: 390, height: 844 });
    await enter(page, 'projects');
    await expect(page.locator('#projects')).toHaveAttribute('data-locked', 'false');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const status = page.locator('#projects [data-part="mobile-status"]');
    const box = (await page.locator('[data-part="preview-swipe"]').boundingBox())!;
    const y = Math.round(box.y + box.height / 2);
    const swipe = async (from: number, dx: number) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y, id: 1 }] });
      for (let k = 1; k <= 10; k += 1) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(from + (dx * k) / 10), y, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const start = await page.evaluate(() => window.scrollY);
    await swipe(120, 200);
    await expect(status).toContainText(`01 / `);
    await swipe(300, -200);
    await expect(status).toContainText(`02 / `, SLOW);
    await expect(status).toContainText(projects[1].title);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(start);
  });

  test('모바일 Skills에서 선택 기술 설명과 적용 근거가 첫 화면에 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await enter(page, 'skills');
    const slot = page.getByTestId('skill-result');
    const map = page.locator('[data-skill-map]');
    await expect(slot).toBeInViewport();
    await expect(slot).toContainText('React');
    await expect(map).toHaveAttribute('data-active-skill', 'React');
    await expect(map).toBeInViewport();
    const links = map.getByRole('link');
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all()) {
      const title = (await link.getAttribute('aria-label'))!.replace(/ GitHub$/, '');
      expect(projects.some((project) => project.title === title)).toBe(true);
    }
    await page.getByRole('button', { name: 'Python' }).click();
    await expect(map).toHaveAttribute('data-active-skill', 'Python');
    await expect(slot).toContainText('Python');
    await expect(slot).toBeInViewport();
    // 모바일은 그래프 선과 허브 없이 썸네일·이름·subtitle 목록으로 읽힌다.
    await expect(map.getByRole('link', { name: 'PoseTive GitHub' })).toBeVisible();
    await expect(map.locator('[data-graph="hub"]')).toBeHidden();
  });

  test('Skills 그래프는 Experience 선과 같은 x의 헤드 열에서 키보드로 8개 기술을 고르고 프로젝트는 GitHub 새 탭 링크다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'skills');
    const map = page.locator('[data-skill-map]');
    const center = (selector: string) => page.locator(selector).first().evaluate(el => { const box = el.getBoundingClientRect(); return box.left + box.width / 2; });
    // 레일은 빠졌다(b8a9311). 1440px부터 헤드 열이 Experience 축과 같은 x라 넘김이 곧은 세로선이다.
    expect(Math.abs(await center('[data-graph="head"]') - await center('[data-part="experience-axis"]'))).toBeLessThan(1);
    const names = ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Python', 'React Query', 'Zustand', 'Figma'];
    await page.getByRole('button', { name: 'React', exact: true }).focus();
    for (const [index, name] of names.entries()) {
      if (index) await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name, exact: true })).toBeFocused();
      await expect(map).toHaveAttribute('data-active-skill', name);
    }
    // 빠지는 노드가 거둬지고 Figma의 ReBirth 하나만 남는다.
    await expect(map.locator('[data-project-node]')).toHaveCount(1, SLOW);
    const link = map.getByRole('link', { name: 'ReBirth GitHub' });
    await expect(link).toHaveAttribute('href', projects.find(project => project.title === 'ReBirth')!.githubUrl!);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('Tab으로 문서의 다음 섹션에도 접근한다 @smoke', async ({ page }) => {
    await enter(page, 'about');

    // 셸(내비, Footer)은 어느 섹션에도 속하지 않으므로 shell로 센다.
    const visited = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return (
          el.closest('[data-section]')?.getAttribute('data-section') ?? 'shell'
        );
      });
      if (where) visited.add(where);
    }

    // All root sections remain keyboard reachable in document order.
    expect([...visited].some(id => id !== 'shell' && id !== 'about')).toBe(true);
    await expect(page.locator('[data-section][inert], [data-section][aria-hidden="true"]')).toHaveCount(0);
    // 활성 섹션에는 실제로 들어갔어야 한다. 안 그러면 위 단언이 공허하다.
    expect(visited.has('about')).toBe(true);
  });

  test('200% 확대와 320px 폭에서 문서 본문이 가로로 잘리지 않는다 @smoke', async ({
    page,
  }) => {
    // 브라우저 200% 확대는 CSS 픽셀 기준 뷰포트가 절반이 되는 것과 같다.
    // 1280x768의 200%가 640x384다. 320은 WCAG 1.4.10 리플로 기준 폭이다.
    const viewports = [
      { width: 640, height: 384 },
      { width: 320, height: 512 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await enter(page, 'about');

      const doc = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);

      const section = page.locator('[data-section="about"]');
      const width = await section.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(width.scrollWidth).toBeLessThanOrEqual(width.clientWidth);

      // 가로로 안 잘리는 것만으로는 부족하다. 세로로 끝까지 읽을 수 있어야
      // 리플로 기준을 만족한다.
      const reachedEnd = await section.evaluate(el => {
        window.scrollTo(0, el.getBoundingClientRect().bottom + window.scrollY - window.innerHeight);
        return el.getBoundingClientRect().bottom <= window.innerHeight + 1;
      });
      expect(reachedEnd).toBe(true);
    }
  });

  test('최초 진입의 누적 레이아웃 이동이 0.1 미만이다', async ({ page }) => {
    // buffered를 켜야 관찰자를 붙이기 전에 일어난 이동까지 들어온다. 문서가
    // 만들어지기 전에 심어야 첫 프레임을 놓치지 않는다.
    await page.addInitScript(() => {
      window.__clsTotal = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as LayoutShiftEntry;
          if (!shift.hadRecentInput) window.__clsTotal += shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto('/');
    // 부팅 안무가 끝나 START가 올라오는 시점까지가 최초 진입 장면이다.
    // 고정 sleep 대신 이 조건을 기다린다.
    await expect(page.locator('main')).toHaveAttribute('data-route-resolved', 'true');
    await page.evaluate(() => new Promise<void>(resolve => { let count = 0; const tick = () => ++count > 90 ? resolve() : requestAnimationFrame(tick); tick(); }));

    const cls = await page.evaluate(() => window.__clsTotal);
    expect(cls).toBeLessThan(0.1);
  });
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test('Projects open controls and aria-hidden-focus at ' + viewport.width + 'x' + viewport.height, async ({ page }) => {
    await page.setViewportSize(viewport);
    await enter(page, 'projects');
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: typeof import('axe-core') }).axe;
      return (await axe.run('#projects', { runOnly: { type: 'rule', values: ['aria-hidden-focus'] } })).violations;
    });
    expect(violations).toEqual([]);
    const preview = page.locator('#projects [data-part="preview-open"]');
    if (viewport.width >= 1024) {
      await expect(preview).toHaveAttribute('tabindex', '-1');
      return;
    }
    await page.getByRole('button', { name: '다음 프로젝트' }).click();
    const opener = page.getByRole('button', { name: projects[1].title + ' 자세히 보기' });
    const box = (await opener.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#projects [data-part="preview-media"]')).toHaveAttribute('aria-hidden', 'true');
    await page.getByRole('button', { name: '이전 프로젝트' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(opener).toBeFocused();
    await expect(opener).toHaveCSS('outline-style', 'solid');
    await expect(opener).toHaveCSS('outline-offset', '-2px');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeAttached(SLOW);
    await expect(page.locator('#pm-title')).toHaveText(projects[1].title, SLOW);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0, SLOW);
    await expect(opener).toBeFocused(SLOW);
  });
}
