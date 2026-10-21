import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALL_ICONS, DRIFT, FIELD_GLSL, HOVER, ICON_SIZE, LIMIT, PUSH, REACH, fieldPoint, iconStyle } from '@/components/blocks/CrystalizedBall/field';
import { skillCategories } from '@/lib/data';

const REST = [0, 0] as const;
const NONE = [0, 0, 0] as const;
const home = [0.2, -0.1, 0.3] as const;
const seed = [0.4, 3.2, 0.25] as const;
const length = (p: number[]) => Math.hypot(...p);

describe('fieldPoint: the inner particles motion model', () => {
  it('drifts around the home point over time, at most 1.5 x DRIFT per axis', () => {
    const at0 = fieldPoint(home, seed, 0, REST, NONE);
    const at3 = fieldPoint(home, seed, 3, REST, NONE);
    expect(at0).not.toEqual(at3);
    for (let t = 0; t < 40; t += .53) {
      const p = fieldPoint(home, seed, t, REST, NONE);
      p.forEach((value, axis) => expect(Math.abs(value - home[axis])).toBeLessThanOrEqual(1.5 * DRIFT + 1e-9));
    }
  });

  it('the turn (sway and pointer gaze) rotates the field without changing distances', () => {
    const a = fieldPoint(home, seed, 2, REST, NONE);
    const b = fieldPoint(home, seed, 2, [.4, -.2], NONE);
    expect(length(b)).toBeCloseTo(length(a), 10);
    expect(b[0]).not.toBeCloseTo(a[0], 3);
  });

  it('the hovering pointer pushes nearby points away from it, scaled by its power, and leaves far points alone', () => {
    const free = fieldPoint(home, seed, 1, REST, NONE);
    const brush = [free[0] - .15, free[1] - .1] as const;
    const pushed = fieldPoint(home, seed, 1, REST, [...brush, 1]);
    const gap = [free[0] - brush[0], free[1] - brush[1]];
    const moved = [pushed[0] - free[0], pushed[1] - free[1]];
    // Straight away from the pointer, with the gaussian falloff of the shared constants.
    expect(moved[0] * gap[1] - moved[1] * gap[0]).toBeCloseTo(0, 10);
    expect(moved[0] * gap[0] + moved[1] * gap[1]).toBeGreaterThan(0);
    expect(Math.hypot(...moved)).toBeCloseTo(Math.hypot(...gap) * PUSH * Math.exp(-(gap[0] ** 2 + gap[1] ** 2) / REACH), 10);
    expect(pushed[2]).toBe(free[2]);
    const half = fieldPoint(home, seed, 1, REST, [...brush, .5]);
    expect(half[0] - free[0]).toBeCloseTo(moved[0] / 2, 10);
    expect(fieldPoint(home, seed, 1, REST, [free[0] + 1.5, free[1], 1])[0]).toBeCloseTo(free[0], 6);
  });

  it('keeps every point inside the glass', () => {
    const p = fieldPoint([.99, 0, .1], seed, 0, REST, NONE);
    expect(length(p)).toBeCloseTo(LIMIT, 10);
  });

  it('the dust vertex shader carries the same formula and constants', () => {
    expect(FIELD_GLSL).toContain('vec3 fieldPoint(vec3 home, vec3 seed, float t, vec2 turn, vec3 brush)');
    for (const value of [DRIFT, PUSH, REACH, LIMIT]) expect(FIELD_GLSL).toContain(value.toFixed(4));
    for (const literal of ['t * 0.37 + seed.x * 17.0', 't * 0.83 + seed.y * 5.0', 't * 0.29 + seed.y * 11.0', 't * 0.61 + seed.z * 7.0', 't * 0.33 + seed.z * 23.0'])
      expect(FIELD_GLSL).toContain(literal);
    expect(FIELD_GLSL).toMatch(/p\.xy \+= gap \* PUSH \* brush\.z \* exp\(-dot\(gap, gap\) \/ REACH\);/);
  });
});

describe('BALL_ICONS', () => {
  it('are the six core skills from the skills data, with existing mono icons', () => {
    const skills = skillCategories.flatMap(category => category.skills.map(skill => skill.icon));
    expect(BALL_ICONS.map(icon => icon.name)).toEqual(['react', 'typescript', 'nextjs', 'react-query', 'zustand', 'tailwind']);
    for (const { name } of BALL_ICONS) {
      expect(skills).toContain(name);
      expect(existsSync(`public/icons-mono/${name}.svg`)).toBe(true);
    }
  });

  it('are smaller than the study prototype (12.5% of the ball) and never leave the glass under drift, any turn and a full-power pointer', () => {
    expect(ICON_SIZE).toBeLessThan(.125);
    for (const icon of BALL_ICONS) for (let t = 0; t < 60; t += .37) for (const turn of [[.6, .3], [-.6, -.3], [.6, -.3]]) for (const bx of [-.8, 0, .8]) {
      const p = fieldPoint(icon.home, icon.seed, t, turn, [bx, icon.home[1] - .1, HOVER]);
      // Half the icon side is ICON_SIZE ball radii at scale 1; the front scale tops out at 1.18.
      expect(Math.hypot(p[0], p[1]) + ICON_SIZE * 1.18 * Math.SQRT2).toBeLessThan(.955);
    }
  });

  it('do not overlap at rest', () => {
    const rest = BALL_ICONS.map(icon => fieldPoint(icon.home, icon.seed, 0, REST, NONE));
    rest.forEach((a, i) => rest.slice(i + 1).forEach(b => expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(3 * ICON_SIZE * 1.18)));
  });
});

describe('iconStyle', () => {
  it('places an icon (side = ICON_SIZE of the ball, centred at 50% 50%) at the field point with depth scale and light', () => {
    const style = iconStyle([.3, -.2, 1]);
    const [x, y] = style.transform.match(/-?\d+(\.\d+)?/g)!.map(Number);
    // translate percentages are of the icon side: offset in ball radii = (pct / 100 + .5) * 2 * ICON_SIZE.
    expect((x / 100 + .5) * 2 * ICON_SIZE).toBeCloseTo(.3, 3);
    expect(-(y / 100 + .5) * 2 * ICON_SIZE).toBeCloseTo(-.2, 3);
    expect(style.transform).toMatch(/scale\(1\.180\)$/);
    expect(style.opacity).toBe(1);
    const back = iconStyle([0, 0, -1]);
    expect(back.transform).toMatch(/scale\(0\.820\)$/);
    expect(back.opacity).toBeCloseTo(.61, 3);
    expect(back.zIndex).toBeLessThan(style.zIndex);
  });
});
