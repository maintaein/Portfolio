import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Flip } from 'gsap/Flip';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { SplitText } from 'gsap/SplitText';

export { gsap, Flip, SplitText };

// DESIGN_GUIDE.md가 정한 프로젝트 공용 진입 커브.
// framer-motion 시절 [0.22, 1, 0.36, 1] 배열로 쓰던 것과 같은 값이다.
export const SITE_EASE = 'site';
export const SITE_EASE_CUBIC = 'cubic-bezier(0.22, 1, 0.36, 1)';

// 프리뷰 모프 전용 커브. 사이트 공용 진입 커브(SITE_EASE)는 감속이라
// 전환이 첫 15%에 다 끝나 버린다. 모프는 반대로 초반을 눌러 두고 중후반에
// 가속해야 녹는 과정이 보인다. 최고 속도는 타임라인 0.67 지점이다
export const MORPH_EASE = 'morph';

// ProjectModal 내용의 등장·퇴장 길이. ProjectsSection이 닫기 안무를 짤 때
// 같은 숫자를 봐야 하는데, ProjectModal은 next/dynamic으로 실리므로 그
// 모듈에서 상수를 가져오면 지연 로드가 깨진다. 두 쪽이 다 닿는 자리가 여기다.
export const REVEAL_IN_MS = 620;
export const REVEAL_OUT_MS = 220;

let registered = false;

// 멱등. 여러 컴포넌트가 각자 호출해도 안전하다.
export function registerGsap(): void {
  if (registered) return;

  gsap.registerPlugin(CustomEase, MotionPathPlugin, Flip, SplitText);
  CustomEase.create(SITE_EASE, '0.22, 1, 0.36, 1');
  CustomEase.create(MORPH_EASE, '0.85, 0, 0.5, 1');

  registered = true;
}
