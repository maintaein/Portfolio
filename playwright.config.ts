import { defineConfig, devices } from '@playwright/test';

// 계획 6 Task 5b-1. 발판만 놓는다. 시나리오는 e2e/seo.spec.ts 2건뿐이고
// 나머지 Chromium 19건, Firefox/WebKit smoke 6건은 뒤이은 두 작업이 얹는다.
//
// firefox/webkit에는 @smoke 태그가 붙은 시나리오만 돌린다. 세 엔진을 전부
// 매 커밋마다 19건씩 돌리면 CI가 느려지기만 하고, 브라우저별 회귀는 대개
// smoke 수준(SSR 문자열, 레이아웃 엔진 차이)에서 이미 드러난다. chromium은
// grep 없이 전부 돈다.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 이 사이트는 한 장면마다 Three.js 배경과 GSAP 타임라인을 돌린다. 워커를
  // 둘 이상 띄우면 엔진 셋이 같은 머신의 소프트웨어 래스터라이저를 두고
  // 다투다가 page.goto 하나가 30초를 넘긴다. 실제로 계획 6 Task 5b-2에서
  // 그렇게 깨졌다. 한 번에 하나만 돌린다.
  workers: 1,
  // 기본 30초는 이 페이지의 최초 로드에 빠듯하다. 성공 조건이 아니라
  // 실패 상한이다.
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html']] : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  // webServer가 프로덕션 빌드(`next start`)로 뜬다. dev 서버는 HMR·빠른
  // 리프레시가 SSR HTML을 바꿔 재는 값을 왜곡하므로 쓰지 않는다. 이 저장소가
  // dev 서버로 3000번대 앞쪽을 쓰므로 3100으로 떼어 놓아 둘이 부딪히지
  // 않는다.
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grep: /@smoke/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      grep: /@smoke/,
    },
  ],
});
