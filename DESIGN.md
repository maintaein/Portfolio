# 디자인 정본

이 파일은 인덱스다. 값과 설명은 여기 적지 않는다. 복제하는 순간 둘이
어긋나기 때문이다.

| 무엇 | 어디 |
|---|---|
| 값 정본 | [`styles/design-tokens.css`](./styles/design-tokens.css) |
| 설명 정본 | [`.claude/DESIGN_GUIDE.md`](./.claude/DESIGN_GUIDE.md) |
| 결정 기록 | [`.claude/designRefactoring/`](./.claude/designRefactoring/) |

색, 타입 스케일, 지속, 이징, 간격은 **전부 `styles/design-tokens.css`의
`@theme` 블록에 있다.** 컴포넌트에 리터럴로 적지 마라. 왜 그 값인지는
설명 정본에 있다.

`.claude/`는 git 추적 대상이 아니다. 문서 계약 테스트
([`__tests__/docs/designCanon.test.ts`](./__tests__/docs/designCanon.test.ts))가
지키는 것은 이 파일과 `styles/design-tokens.css`와 `app/layout.tsx`뿐이다.

## 새 UI를 만들기 전에

1. 값 정본에 이미 토큰이 있는지 본다. 없으면 토큰부터 추가한다
2. 설명 정본의 해당 절을 읽는다
3. 이 문서 아래의 **살아 있는 계약**을 어기지 않는지 확인한다

## 살아 있는 계약

아래는 구현과 테스트가 함께 지키고 있는 것이다. 문서만 고치고 코드를
안 고치면 테스트가 잡는다. 반대도 마찬가지다.

### 모션

- 애니메이션하는 속성은 `transform`과 `opacity`와 `filter`뿐이다. 레이아웃
  속성은 애니메이션하지 않는다
- 지속과 이징은 토큰만 쓴다. 새 숫자를 넣지 않는다
- `prefers-reduced-motion: reduce`에서는 움직임이 없다. 이 저장소는
  `transition: none`과 `animation: none`을 언제나 짝지어 왔다
- 무한 루프 장식은 두지 않는다. 지속 모션은 Hyperspeed 배경이 소유한다

### 섹션 전환

- overview가 터널 입구이고 섹션이 더 안쪽이다. 들어가면 전진, 나오면 후진
- 표식(`data-section-direction`, `data-section-leaving`)은 들어오는 섹션
  하나와 나가는 섹션 하나에만 붙는다. 전부에 붙이면 비활성 여섯이 함께 뛴다
- 전환 키프레임은 `transform`과 `filter`만 맡는다. **`opacity`를 건드리지
  않는다.** 페이드는 `.section-hidden`과 `.section-visible`의
  `transition: opacity`가 한다. 키프레임이 `opacity`를 건드리면 클래스가
  바뀌는 순간 전후 계산값이 같아져 전환이 시작되지 않고, `transitionend`가
  오지 않아 전환 상태가 굳는다
- `animation-fill-mode`에 `forwards`와 `both`를 쓰지 않는다. 애니메이션이
  끝난 뒤 남는 `transform`이 조상 컨테이닝 블록이 되어 그 안의
  `position: fixed`를 가둔다
- 흐림은 뷰포트 상대 단위로 준다. 고정 px이면 큰 화면에서 글자가 커질수록
  안 보인다

### 배경

- 섹션에 머무는 동안 Hyperspeed 배경의 불투명도는
  `HyperspeedBackground`의 상수 하나가 소유한다. **이 값은 사용자가 실기기로
  확정했다.** 문서나 옛 계획에 다른 숫자가 적혀 있으면 그 문서가 낡은 것이다
- 본문 대비가 모자라면 전면 카드를 씌우지 않는다. 텍스트 영역에만 국소
  그라데이션 스크림을 둔다(About의 `scrim.ts`가 그 예다)

### 섹션 은닉과 SEO

- 전 섹션이 언제나 DOM에 있다. 크롤러는 HTML을 읽지 Ctrl+F를 쓰지 않는다
- 비활성 섹션은 `opacity`와 `pointer-events`로 감추고 `inert`를 건다.
  조건부 렌더로 지우지 않는다
- 비활성 섹션의 첫 렌더 비용은 유휴 시간에 미리 치른다. 전환이 시작되는
  프레임에 몰리면 메인 스레드가 막혀 애니메이션의 절반이 그려지지 않는다

### 레이아웃

- 브레이크포인트는 Tailwind 기본값이다
- 모바일 우선으로 쓰고 `sm:` `md:` `lg:`로 확장한다
- `styles/design-tokens.css`가 `env(safe-area-inset-*)`로 푸터 높이와 무대
  여백을 계산한다. 그래서 `app/layout.tsx`가 `viewportFit: 'cover'`를
  켠다. 이 선언이 없으면 iOS에서 `env()`가 언제나 0이라 계산이 조용히
  무의미해진다. 문서 계약 테스트가 이 짝을 지킨다

## 폐기된 처방

아래는 더 이상 쓰지 않는다. 옛 문서나 옛 커밋에서 보이면 따르지 마라.

| 폐기 | 지금 |
|---|---|
| `whileInView`로 진입 애니메이션 | `WhenVisible`의 `shouldEnter`를 소비한다 |
| `AnimatePresence`로 모달 진입과 퇴장 | 공용 `Modal`이 소유한다 |
| framer-motion | 걷어내는 중이다. 새 코드에 넣지 마라 |
| About과 Experience의 좌우 교차 카드 | About은 12칸 격자와 라벨 레일, Experience는 단일 방향 레저 |
| Skills의 탭과 아이콘 격자와 숙련도 막대 | 증거 우선 레저 |
| 트로피 이모지와 장식 배지 | 쓰지 않는다 |
