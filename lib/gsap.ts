import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Flip } from 'gsap/Flip';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

export { gsap, Flip };

// DESIGN_GUIDE.md가 정한 프로젝트 공용 진입 커브.
// framer-motion 시절 [0.22, 1, 0.36, 1] 배열로 쓰던 것과 같은 값이다.
export const SITE_EASE = 'site';
export const SITE_EASE_CUBIC = 'cubic-bezier(0.22, 1, 0.36, 1)';

let registered = false;

// 멱등. 여러 컴포넌트가 각자 호출해도 안전하다.
export function registerGsap(): void {
  if (registered) return;

  gsap.registerPlugin(CustomEase, MotionPathPlugin, Flip);
  CustomEase.create(SITE_EASE, '0.22, 1, 0.36, 1');

  registered = true;
}
