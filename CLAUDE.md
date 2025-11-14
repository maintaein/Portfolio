# CLAUDE 개발 지침서

Portfolio 프로젝트의 개발 가이드라인입니다. 모든 코드 작업은 이 지침을 준수하여 진행합니다.

---

## 1. Next.js + TypeScript 기본 원칙

### Next.js 문법 및 구조
- Next.js가 지향하는 App Router 패턴 준수
- 서버 컴포넌트와 클라이언트 컴포넌트 명확히 구분
- Dynamic Import로 번들 크기 최적화

### TypeScript 엄격 모드 준수
- **any 사용 절대 금지**
  - 제네릭, Union 타입, 타입 가드 등으로 해결
  - Union 타입 문제는 공통 props 인터페이스를 정의하고 제네릭 파라미터로 전달
  - 예시: `cloneElement<CommonProps>(element, props)` 형태로 작성

---

## 2. React Hooks 사용 규칙

### useEffect의 dependency array 엄격 관리
- useEffect 내부에서 사용하는 **모든 함수, 변수는 dependency array에 포함**
- 컴포넌트 내부 함수가 dependency인 경우 **useCallback으로 메모이제이션**
- **exhaustive-deps 경고 무시 금지** - 반드시 해결할 것
- 예시: 이벤트 핸들러를 useEffect 내부에서 사용 시 useCallback 적용

```typescript
// ❌ 잘못된 예
useEffect(() => {
  handleClick();
}, []); // handleClick이 dependency에 없음

// ✅ 올바른 예
const handleClick = useCallback(() => {
  // 로직
}, [dependency]);

useEffect(() => {
  handleClick();
}, [handleClick]);
```

---

## 3. Import 최적화

### Import 관리 규칙
- **사용하지 않는 import는 즉시 제거**
- 타입만 import할 경우 **type 키워드 사용**
  - `import type { MyType } from '...'`
- 컴파일 타임에만 필요한 타입은 런타임 번들에 포함되지 않도록 관리

```typescript
// ✅ 올바른 예
import type { FC } from 'react';
import { useState } from 'react';
```

---

## 4. 개발 프로세스

### Phase별 단계 구분
- 개발의 단계를 **큰 단위로 Phase**별로 나누기
- 각 Phase 안에 **Step**별로 세분화

### 재사용 가능한 단위 우선 설계
- 컴포넌트, 로직 **재사용성과 효율적인 상태관리**를 우선
- **단일 책임 원칙(SRP)** 준수

### 오류 처리
- 오류 발생 시 이유를 탐구하고 **재발생하지 않도록 스스로 발전**

---

## 5. UI/UX 설계 원칙

### 모바일 친화적 개발
- **모바일 → 태블릿 → 데스크톱 순**으로 UI를 설계
- 모든 화면에서 **가독성과 직관성**이 좋은 UI 설계

### 레이아웃 및 스타일 일관성 유지
- **Flex/Grid**를 활용
- 간격 단위(rem, px) 통일
- **React Bits를 기본**으로 하되, 필요 시 대체 라이브러리 사용 가능
- 전환 시 **transition 효과 기본 사용**

### 반응형 디자인
- **sm / md / lg / xl** 브레이크포인트 기준
- 모바일 → 데스크톱 순서 적용

### 인터랙션 & 애니메이션
- **Hover/Active/Focus** 상태 구현
- 주요 이벤트에 **시각적 피드백**(Spinner, Toast 등) 제공

---

## 6. 코드 구조 및 명명 규칙

### 명명 규칙
- **파일명**: PascalCase
- **변수**: camelCase
- **클래스명**: kebab-case

### 상태 관리 및 데이터 흐름 명확화
- 데이터 흐름: **부모→자식(props), 자식→부모(event)**
- **props나 event를 함부로 예측해서 작성하지 말고, 부모나 자식의 props를 꼭 확인할 것!**

### 생성 전 사고(Pre-Think)
- 코드 생성 전 **UI 구조, 데이터 흐름, 재사용성 여부**를 먼저 분석

### 주석 작성
- 주석은 **한국말로 작성**
- **아이콘 사용 금지**
- **코드가 복잡한 부분에만** 작성

### 인코딩
- 한글 인코딩: **UTF-8**

---

## 7. Lighthouse 평가 최적화

### Ⅰ. Performance (성능) — "사용자에게 즉시 보이게"
- **LCP < 1.8초**
- **TBT < 100ms**
- **CLS < 0.1**
- **INP < 200ms**
- **Total JS < 200KB**

### Ⅱ. Accessibility (접근성) — "누구나 사용할 수 있게"
- **WCAG 2.2 기준 준수**
- **ARIA role, label 완비**
- **시맨틱 구조** (h1~h6, nav, main, footer)
- **모든 인터랙션은 키보드 접근 가능**

### Ⅲ. Best Practices (보안 및 최신 기술) — "안전하고 신뢰 가능한 앱"
- **최신 브라우저 API 사용**
- **HTTPS 100%**
- **콘솔 오류 0개**
- **안전한 리소스만 사용**

### Ⅳ. SEO (검색 최적화) — "검색엔진이 이해할 수 있게"
- **메타데이터**: title, description, viewport 필수
- **문서 구조**: h1은 한 번만, 의미 있는 순서로
- **robots.txt / sitemap.xml**: 검색엔진 접근 허용
- **모바일 친화성**: viewport + 반응형 디자인

---

## 체크리스트

### 코드 작성 전
- [ ] UI 구조 분석 완료
- [ ] 데이터 흐름 파악 완료
- [ ] 재사용성 여부 판단 완료
- [ ] Phase 및 Step 계획 수립

### 코드 작성 중
- [ ] TypeScript any 사용 여부 확인
- [ ] useEffect dependency array 올바른지 확인
- [ ] 사용하지 않는 import 제거
- [ ] 모바일 우선 설계 적용

### 코드 작성 후
- [ ] Lighthouse 평가 실행
- [ ] 접근성 검증
- [ ] 콘솔 오류 0개 확인
- [ ] PROJECT.md 업데이트

---

**마지막 업데이트**: 2025-11-14
