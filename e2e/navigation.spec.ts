import { test, expect } from '@playwright/test';
import { enter, expectActive, historyLength, navButton } from './helpers';

// 계획 6 Task 5b-2. 항해 계약 4건. History 스택, 휠 입력, 섹션을 떠났다
// 돌아왔을 때의 scrollTop, 같은 id 재선택은 전부 진짜 브라우저가 있어야
// 잴 수 있다. jsdom에는 뒤로가기도 휠도 스크롤 위치 보존도 없다.

test.describe('항해', () => {
  test('뒤로가기가 이전 섹션으로 돌아가고 앞으로가기가 다시 간다 @smoke', async ({
    page,
  }) => {
    await enter(page, 'about');
    const before = await historyLength(page);

    await navButton(page, 'Projects').click();
    await expectActive(page, 'projects');
    expect(page.url()).toContain('#projects');
    // setActive가 pushState로 항목을 하나만 쌓는다(hooks/useSectionNav.ts).
    expect(await historyLength(page)).toBe(before + 1);

    await page.goBack();
    await expectActive(page, 'about');
    expect(page.url()).toContain('#about');

    await page.goForward();
    await expectActive(page, 'projects');
    expect(page.url()).toContain('#projects');
  });

  test('휠 세로 스크롤이 활성 섹션을 바꾸지 않는다', async ({ page }) => {
    // 이 높이에서 Skills 내용이 상자보다 길어 실제로 스크롤된다.
    await page.setViewportSize({ width: 1280, height: 620 });
    await enter(page, 'skills');

    const section = page.locator('[data-section="skills"]');
    // 스크롤될 여지가 없으면 이 시나리오는 아무것도 증명하지 못한다.
    // 그것부터 못 박는다.
    const overflow = await section.evaluate(
      (el) => el.scrollHeight - el.clientHeight
    );
    expect(overflow).toBeGreaterThan(0);

    const before = await historyLength(page);
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 300);

    // 휠이 먹혔다는 증거. 이것 없이 "섹션이 안 바뀌었다"만 재면 휠이 아무
    // 데도 닿지 않았을 때도 통과한다.
    await expect
      .poll(() => section.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);

    await expectActive(page, 'skills');
    expect(page.url()).toContain('#skills');
    expect(await historyLength(page)).toBe(before);
  });

  test('섹션을 떠났다 돌아오면 안쪽 scrollTop이 유지된다', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 620 });
    await enter(page, 'skills');

    const section = page.locator('[data-section="skills"]');
    await section.evaluate((el) => {
      el.scrollTop = 120;
    });
    expect(await section.evaluate((el) => el.scrollTop)).toBe(120);

    await navButton(page, 'About').click();
    await expectActive(page, 'about');
    await navButton(page, 'Skills').click();
    await expectActive(page, 'skills');

    // 섹션이 언마운트되지 않고 DOM에 상주하므로 브라우저가 스크롤 위치를
    // 그대로 들고 있다. 언마운트로 바뀌면 여기가 0이 되어 걸린다.
    expect(await section.evaluate((el) => el.scrollTop)).toBe(120);
  });

  test('이미 활성인 섹션을 다시 골라도 History가 늘지 않는다', async ({
    page,
  }) => {
    await enter(page, 'skills');
    const before = await historyLength(page);

    await navButton(page, 'Skills').click();
    await navButton(page, 'Skills').click();

    await expectActive(page, 'skills');
    expect(page.url()).toContain('#skills');
    // setActive가 같은 id면 pushState 전에 빠져나간다.
    expect(await historyLength(page)).toBe(before);
  });
});
