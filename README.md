# Portfolio · 김태인의 프론트엔드 포트폴리오

스크롤 대신 전환으로 읽는 단일 페이지 포트폴리오로 구성해봤습니다. 배경은 three.js + GSAP 기반입니다. 부팅부터 마지막 섹션까지 배경이 끊기지 않고 돌고, 다섯 섹션은 그 위에서 교차하는 식으로 설계했습니다.

https://kimtaein.vercel.app/

## 섹션 구성

부팅 시퀀스를 지나면 아래 다섯 섹션이 이 순서로 놓입니다.

| 섹션 | 설명 |
|------|------|
| **Boot** | 파티클이 이름으로 뭉치는 진입 화면. START를 누르면 터널이 가속하며 여정이 시작됩니다 |
| **About** | 세 문항으로 나눈 자기소개. 문항을 넘길 때마다 해당 문항에 대한 설명이 나옵니다 |
| **Projects** | 프로젝트 이름 목록과 프리뷰. 이름을 고르면 프로젝트에 대한 상세 설명이 전체 화면으로 표시됩니다. |
| **Experience** | 경력과 교육을 단일 타임라인 축 위에 올려 표시했습니다. |
| **Skills** | 카테고리별 레인에 놓인 기술 스택. 호버하면 해당 기술 스택에 대한 설명이 하단에 표시됩니다 |
| **Awards** | 수상과 자격증을 주관사 마크로 묶은 테이블. 줄을 눌러 펼칩니다 |

## 프로젝트 목록

<table>
<tr>
<td width="180"><img src="public/projects/TDS.webp" width="180" alt="TDS" /></td>
<td>

### TDS (Taein Design System)
`2025.12 - 2026.07` · 1인 설계 및 개발

직접 만들며 배우려고 시작한 개인 디자인 시스템. 직접 활용해보며 고도화를 진행중입니다.


`React 19` `TypeScript` `Vanilla Extract` `Vite` `Vitest` `pnpm Monorepo` `TDD`

</td>
</tr>
<tr>
<td width="180"><img src="public/projects/Portfolio.webp" width="180" alt="Portfolio" /></td>
<td>

### Portfolio
`2025.08 - 현재` · 1인 개발

지금 보고 계신 이 repo입니다. 1차 MVP 이후 전면 디자인 리팩토링을 거쳤습니다.


`Next.js 15` `React 19` `TypeScript` `Tailwind CSS 4` `GSAP` `three.js`

</td>
</tr>
<tr>
<td width="180"><img src="public/projects/Alphamail.webp" width="180" alt="AlphaMail" /></td>
<td>

### AlphaMail
`2025.04 - 2025.05` · 6명 · 프론트엔드 리더

메일 내용을 읽어 업무로 정리해주는 AI 업무 자동화 웹 메일 서비스.


`React` `TypeScript` `React Query` `Zustand` `TailwindCSS` `MaterialUI` `FSD`

</td>
</tr>
<tr>
<td width="180"><img src="public/projects/Rebirth.webp" width="180" alt="ReBirth" /></td>
<td>

### ReBirth
`2025.02 - 2025.04` · 6명 · 모바일 프론트엔드

가진 카드의 혜택을 따져 결제 수단을 골라주는 모바일 페이 서비스.


`Kotlin` `Jetpack Compose` `Coroutines` `MVVM` `Retrofit` `Material3`

</td>
</tr>
<tr>
<td width="180"><img src="public/projects/Ttabong.webp" width="180" alt="Ttabong" /></td>
<td>

### Ttabong
`2025.01 - 2025.02` · 6명 · 웹 프론트엔드

따뜻한 봉사, 따봉. 봉사 기관과 봉사자를 잇는 SNS 큐레이팅 매칭 플랫폼.

`React` `TypeScript` `TailwindCSS` `Zustand`

</td>
</tr>
<tr>
<td width="180"><img src="public/projects/DragonBar.webp" width="180" alt="Dragon Bar" /></td>
<td>

### Dragon Bar
`2026.08 - 현재` · 1인 외주 · 기획부터 구현까지

Dragonvape 자사 무니코틴 액상 브랜드의 독립몰. 설계와 구현을 혼자 맡았습니다.


`Next.js 16` `React 19` `TypeScript` `Tailwind CSS 4` `Zod` `Prisma` `PostgreSQL` `Playwright`

</td>
</tr>
<tr>
<td width="180"><img src="public/projects/Posetive.webp" width="180" alt="PoseTive" /></td>
<td>

### PoseTive
`2024.03 - 2024.06` · 6명 · AI 모델링

사용자가 그린 대로 이미지 속 인물의 포즈를 바꿔주는 AI 웹 서비스.

`Python` `PyTorch` `Pose Estimation` `Pandas` `NumPy`

</td>
</tr>
</table>

## 고도화

1차 MVP를 만든 뒤 화면 전체를 다시 설계했습니다. 배경과 부팅부터 갈아엎었고 섹션을 하나씩 재작성한 다음, 죽은 코드를 걷어내고 검증 장치를 얹었습니다.

## 프로젝트 구조

```
portfolio/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 루트 레이아웃 (메타데이터, 임계 CSS)
│   ├── page.tsx                # 진입점
│   ├── opengraph-image.tsx     # OG 이미지 동적 생성
│   ├── icon.tsx                # 파비콘·앱 아이콘
│   ├── sitemap.ts              # 사이트맵
│   ├── robots.ts               # 로봇 설정
│   └── manifest.ts             # PWA 매니페스트
├── components/
│   ├── atoms/                  # Icon, Modal
│   ├── blocks/
│   │   ├── Hyperspeed/         # three.js 터널 (distortions, presets)
│   │   ├── HyperspeedBackground.tsx  # 배경 배선과 동적 로딩
│   │   ├── ParticleText/       # 이름을 뭉치는 파티클
│   │   ├── PreviewMorph/       # 프로젝트 사이 셰이더 모프
│   │   ├── ProjectModal/       # 좌증거·우논증 상세 판
│   │   ├── Navigation/
│   │   └── About*/             # About 시각 증거 (Folder, Rings, Teamwork)
│   ├── common/                 # SectionActivityContext, WhenVisible
│   ├── sections/               # BootSequence, HomeClient, 다섯 섹션
│   └── seo/                    # JSON-LD
├── hooks/                      # useSectionNav, useSectionSwipe, useModal 등 8개
├── lib/
│   ├── data/                   # 프로필, 경력, 스킬, 프로젝트 7개
│   ├── utils/                  # cn, contrast, format, projectContract, richText
│   ├── theme/darkTokens.ts     # 첫 페인트용 다크 토큰
│   ├── constants.ts            # 섹션 순서와 내비게이션 정본
│   ├── criticalCss.ts          # 흰 화면 번쩍임을 막는 인라인 CSS
│   ├── deviceQuality.ts        # 기기 등급 사다리
│   └── gsap.ts                 # GSAP 지연 등록
├── styles/design-tokens.css    # 값 정본 (색, 타입, 지속, 이징, 간격)
├── types/                      # 데이터 모델 타입
├── __tests__/                  # Vitest 48개 파일
├── e2e/                        # Playwright 6개 스펙
├── scripts/check-bundle.mjs    # 번들 예산 검사
├── DESIGN.md                   # 디자인 정본 진입점
└── public/
    ├── fonts/                  # Pretendard 웹폰트
    └── projects/               # 프로젝트 이미지와 구현 화면 녹화
```

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 (App Router) |
| 언어 | TypeScript 5 (strict) |
| 스타일링 | Tailwind CSS 4 + 디자인 토큰 |
| 애니메이션 | GSAP 3 (Flip 포함) |
| 3D | three.js, postprocessing |
| 아이콘 | Heroicons |
| 상태 관리 | React Hooks + Context |
| 폰트 | Pretendard Variable |
| 테스트 | Vitest, Testing Library, Playwright |
| 분석 | Vercel Analytics, Speed Insights |
| CI | GitHub Actions (린트·타입·단위·빌드·번들 예산·E2E) |
| 배포 | Vercel |

## 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start

# 린트 · 타입 검사
npm run lint
npm run type-check

# 단위 테스트 (48개 파일, 903개)
npm test
npm run test:watch

# 브라우저 테스트 (Chromium · Firefox · WebKit)
npm run test:e2e

# 번들 예산 검사 (빌드 후 실행)
npm run check:bundle
```

