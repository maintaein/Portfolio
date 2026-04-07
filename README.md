# Portfolio — 김태인의 프론트엔드 포트폴리오

사용자 경험을 최우선으로 생각하는 프론트엔드 개발자 김태인의 포트폴리오 웹사이트입니다.
Atomic Design 패턴과 TypeScript 기반의 타입 안정성으로 구축된 SPA 포트폴리오입니다.

https://kimtaein.vercel.app/

## 특징

- **Atomic Design** — Atoms, Blocks, Sections 계층 구조로 컴포넌트를 체계적으로 설계
- **TypeScript Strict** — 엄격 모드 기반의 완전한 타입 안정성 보장
- **동적 Import** — Next.js dynamic import로 초기 번들 크기 최적화
- **SEO 최적화** — OpenGraph, JSON-LD, sitemap, robots.txt 등 검색엔진 최적화 완비
- **디자인 토큰** — CSS Custom Properties 기반 일관된 디자인 시스템 운영
- **반응형 디자인** — 모바일부터 데스크톱까지 sm/md/lg/xl 브레이크포인트 대응
- **성능 최적화** — Vercel Analytics, Speed Insights, 이미지 AVIF/WebP 포맷 지원

## 섹션 구성

| 섹션 | 설명 |
|------|------|
| **Hero** | 메인 인트로 영역 |
| **About** | 핵심 가치와 자기소개 |
| **Skills** | 기술 스택 (Language, Frontend, Backend, DevTools) |
| **Projects** | 프로젝트 상세 소개 및 트러블슈팅 |
| **Awards** | 수상 이력 및 자격증 |
| **Experience** | 경력 및 교육 이력 |

## 프로젝트 목록

| 프로젝트 | 설명 | 기술 스택 |
|----------|------|-----------|
| **Portfolio** | 개인 포트폴리오 웹사이트 | Next.js, TypeScript, TailwindCSS |
| **AlphaMail** | AI 기반 업무 자동화 웹 메일 서비스 | React, TypeScript, React-query, Zustand, TailwindCSS |
| **ReBirth** | 카드 혜택 기반 모바일 금융 서비스 | Kotlin, Jetpack Compose |
| **Ttabong** | 봉사 기관-봉사자 매칭 웹 SNS 플랫폼 | React, TypeScript |
| **PoseTive** | AI 기반 이미지 포즈 변환 서비스 | Python, Deep Learning |

## 프로젝트 구조

```
portfolio/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 루트 레이아웃 (메타데이터, SEO)
│   ├── page.tsx            # 메인 페이지
│   ├── sitemap.ts          # 사이트맵 생성
│   ├── robots.ts           # 로봇 설정
│   └── manifest.ts         # PWA 매니페스트
├── components/
│   ├── atoms/              # 기본 UI 컴포넌트 (Button, Badge, Modal 등)
│   ├── blocks/             # 조합 컴포넌트 (Navigation, ProjectModal 등)
│   ├── sections/           # 페이지 섹션 (Hero, About, Skills 등)
│   └── seo/                # SEO 컴포넌트 (JSON-LD)
├── hooks/                  # 커스텀 Hooks (useModal, useScroll, useIntersection)
├── lib/
│   ├── data/               # 정적 데이터 (프로필, 프로젝트, 스킬 등)
│   ├── utils/              # 유틸리티 함수 (cn, format, scroll)
│   ├── constants.ts        # 상수 정의
│   └── fonts.ts            # 폰트 설정 (Pretendard)
├── styles/
│   ├── design-tokens.css   # 디자인 토큰 (색상, 간격, 타이포그래피)
│   └── design-tokens.ts    # TypeScript 디자인 토큰
├── types/                  # TypeScript 타입 정의
└── public/
    ├── fonts/              # Pretendard 웹폰트
    ├── icons/              # 기술 스택 아이콘
    └── projects/           # 프로젝트 이미지 및 영상
```

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 (App Router) |
| 언어 | TypeScript 5 (strict) |
| 스타일링 | Tailwind CSS 4 + 디자인 토큰 |
| UI | Headless UI, Heroicons |
| 상태 관리 | React Hooks (useState, useRef) |
| 폰트 | Pretendard Variable |
| 분석 | Vercel Analytics, Speed Insights |
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

# 린트 실행
npm run lint
```

## 디자인 원칙

- **Atomic Design** — Atoms(Button, Badge) → Blocks(Navigation, ProjectModal) → Sections(HeroSection, SkillsSection) 계층 구조
- **SRP** — 각 컴포넌트는 단일 책임 원칙을 준수
- **타입 안정성** — 모든 데이터 모델에 TypeScript 인터페이스 정의
- **커스텀 Hooks** — `useModal`, `useScroll`, `useIntersection`으로 로직 재사용
