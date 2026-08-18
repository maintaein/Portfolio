import { describe, it, expect, vi } from 'vitest';
import { SITE_EASE, SITE_EASE_CUBIC, registerGsap, Flip as LibFlip } from '@/lib/gsap';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Flip } from 'gsap/Flip';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

// registerGsap이 이 파일 안에서 몇 번째 it()으로 처음 불리든 그 실제 등록 호출을
// 놓치지 않기 위해, 어떤 it()보다도 먼저(모듈 평가 시점에) 스파이를 건다.
// call-through(원래 구현을 그대로 실행)라서 실제 등록도 정상적으로 일어난다.
const registerPluginSpy = vi.spyOn(gsap, 'registerPlugin');
const customEaseCreateSpy = vi.spyOn(CustomEase, 'create');

/**
 * cubic-bezier(x1, y1, x2, y2) 문자열을 CSS 이징 의미 그대로 t(진행률) -> y(보간값)
 * 함수로 바꾸는 순수 함수. SITE_EASE_CUBIC 문자열 자체를 파싱해서 이론값을 만들기
 * 때문에, 상수 값이 바뀌면 기준값도 함께 움직인다 — 이론값을 하드코딩하면 상수와
 * 등록된 커브가 어긋나는 순간을 잡지 못한다.
 */
function parseCubicBezierEase(cssValue: string): (t: number) => number {
  const match = cssValue.match(
    /cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/
  );
  if (!match) {
    throw new Error(`cubic-bezier 형식이 아니다: ${cssValue}`);
  }
  const [, x1s, y1s, x2s, y2s] = match;
  const x1 = Number(x1s);
  const y1 = Number(y1s);
  const x2 = Number(x2s);
  const y2 = Number(y2s);

  const bezierComponent = (u: number, p1: number, p2: number) =>
    3 * (1 - u) ** 2 * u * p1 + 3 * (1 - u) * u ** 2 * p2 + u ** 3;

  // Bx(u) = t를 만족하는 u를 이분법으로 구한 뒤 By(u)를 돌려준다.
  return (t: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const x = bezierComponent(mid, x1, x2);
      if (x < t) lo = mid;
      else hi = mid;
    }
    const u = (lo + hi) / 2;
    return bezierComponent(u, y1, y2);
  };
}

describe('lib/gsap', () => {
  it('공용 이징 값이 DESIGN_GUIDE와 일치한다', () => {
    expect(SITE_EASE_CUBIC).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
  });

  it('SITE_EASE 등록명이 계획 인터페이스와 일치한다', () => {
    expect(SITE_EASE).toBe('site');
  });

  it('registerGsap 후 이징을 이름으로 참조할 수 있다', () => {
    registerGsap();
    expect(gsap.parseEase(SITE_EASE)).toBeTypeOf('function');
  });

  it('두 번 호출해도 안전하다', () => {
    registerGsap();
    registerGsap();
    expect(gsap.parseEase(SITE_EASE)).toBeTypeOf('function');
  });

  it('이징이 0에서 0, 1에서 1을 준다', () => {
    registerGsap();
    const ease = gsap.parseEase(SITE_EASE);
    expect(ease(0)).toBeCloseTo(0, 3);
    expect(ease(1)).toBeCloseTo(1, 3);
  });

  // --- 구멍 1: ease(0)=0, ease(1)=1은 모든 정상 이징이 만족한다. 등록된 SITE_EASE가
  // "cubic-bezier(0.22, 1, 0.36, 1)"과 실제로 같은 곡선인지는 아무도 확인하지 않았다.
  it('등록된 SITE_EASE가 SITE_EASE_CUBIC 문자열과 동일한 3차 베지어 곡선이다', () => {
    registerGsap();
    const registeredEase = gsap.parseEase(SITE_EASE);
    const referenceEase = parseCubicBezierEase(SITE_EASE_CUBIC);

    // 이 커브는 진출이 빠른 비대칭 ease-out이라 t=0.5에서 y가 약 0.96으로, 0.5보다
    // 뚜렷이 크다 — 대칭 커브('0.5, 0, 0.5, 1')나 선형으로 바뀌면 즉시 갈린다.
    for (const t of [0.25, 0.5, 0.75]) {
      expect(registeredEase(t)).toBeCloseTo(referenceEase(t), 3);
    }
  });

  // --- 구멍 2 + 3: 멱등성 가드가 실제로 재등록을 막는지, 계획이 요구한
  // CustomEase/MotionPathPlugin/Flip 셋이 정확히 등록되는지.
  // registerPluginSpy/customEaseCreateSpy는 파일 최상단에서 어떤 it()보다도 먼저
  // 걸렸다. registered 플래그는 모듈 스코프라 한 번 true가 되면 파일 생애주기
  // 내내 true로 남으므로, "실제 등록 호출이 파일 전체에서 몇 번 일어났는가"는
  // 이 테스트가 몇 번째 it()인지와 무관하게 항상 참이어야 하는 불변식이다.
  it('registerGsap은 파일 생애주기 전체에서 딱 한 번만 실제 등록을 수행하고, 계획이 요구한 플러그인 셋을 정확히 등록한다', () => {
    registerGsap();
    registerGsap();
    registerGsap();

    expect(registerPluginSpy).toHaveBeenCalledTimes(1);
    expect(customEaseCreateSpy).toHaveBeenCalledTimes(1);

    const registeredPlugins = registerPluginSpy.mock.calls[0];
    expect(registeredPlugins).toHaveLength(3);
    expect(new Set(registeredPlugins)).toEqual(new Set([CustomEase, MotionPathPlugin, Flip]));
  });

  it('lib/gsap가 재노출하는 Flip은 gsap/Flip과 동일한 참조다', () => {
    expect(LibFlip).toBe(Flip);
  });
});
