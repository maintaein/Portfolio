import { test, expect } from '@playwright/test';

// 계획 6 Task 5b-1이 발판으로 2건을 놓았고, Task 6이 해시 정본 계약 1건을
// 얹었다. 나머지 시나리오는 navigation·a11y·motion·modal·media가 나눠 가졌다.

test.describe('SEO / 초기 렌더', () => {
  test('루트 응답 원문 HTML에 About 수치와 프로젝트 제목이 있다 @smoke', async ({
    request,
  }) => {
    // 브라우저로 열어 DOM을 보면 자바스크립트가 돈 뒤의 결과를 재는 것이라
    // SSR(서버가 실제로 채워 보낸 HTML)을 증명하지 못한다. request.get은
    // 페이지를 띄우지 않고 원문 응답만 받는다.
    const response = await request.get('/');
    expect(response.status()).toBe(200);

    const html = await response.text();
    // components/sections/AboutSection/index.tsx의 EVIDENCE[0] 고정 텍스트.
    expect(html).toContain('2년 6개월');
    // lib/data/projects/AlphaMail.ts의 프로젝트 title.
    expect(html).toContain('AlphaMail');
  });

  test('overview 상태에서 비활성 섹션의 글자가 content-visibility로 사라지지 않는다', async ({
    page,
  }) => {
    // 스크립트 요청을 막아 React가 마운트되지 않게 한다. 마운트되면
    // HomeClient의 유휴 예열(warmedSectionIds)이 곧 About에 section-prewarm을
    // 붙여 content-visibility를 visible로 덮어쓴다(HomeClient/index.tsx,
    // .section-prewarm이 .section-hidden보다 소스 순서가 뒤라 이긴다). 그
    // 타이밍은 requestIdleCallback에 달려 있어 테스트마다 달라지므로,
    // .section-hidden 규칙 자체를 재려면 그 경쟁을 피해야 한다. 스크립트만
    // 막으면 SSR이 만든 HTML에 CSS만 적용된, React 개입 이전 상태를 실제
    // 레이아웃 엔진이 어떻게 계산하는지를 그대로 본다.
    await page.route('**/*', (route) => {
      if (route.request().resourceType() === 'script') return route.abort();
      return route.continue();
    });
    // 해시 없이 들어가면 useSectionNav의 초기 상태가 overview다
    // (hooks/useSectionNav.ts). 그 상태에서 About은 비활성이라
    // .section-hidden이 걸린다(design-tokens.css).
    await page.goto('/');

    const about = page.locator('[data-section="about"]');
    const text = await about.textContent();
    expect(text).toContain('2년 6개월');

    // CSS 문자열 자체는 __tests__/styles/sectionVisibility.test.ts가 이미
    // 잠갔으므로 여기서는 실제 엔진이 그 문자열을 어떻게 계산하는지만 본다.
    const contentVisibility = await about.evaluate(
      (el) => getComputedStyle(el).contentVisibility
    );
    expect(contentVisibility).toBe('auto');
  });

  test('섹션 경로 /projects는 없다. 해시가 정본이다 @smoke', async ({ request }) => {
    // 섹션 주소는 `/#projects` 하나뿐이다. 경로를 하나 더 만들면 같은 화면에
    // 주소가 둘이 되고, 크롤러도 공유 카드도 어느 쪽이 정본인지 모른다.
    // DESIGN.md 살아 있는 계약의 "진입 경로"가 이 짝을 문서 쪽에서 지킨다.
    const response = await request.get('/projects');
    expect(response.status()).toBe(404);
  });
});
