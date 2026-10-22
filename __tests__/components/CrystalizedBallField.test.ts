import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALL_ICONS, DRIFT, FIELD_GLSL, HOVER, ICON_MARGIN, ICON_SIZE, LIMIT, driftPoint, fieldPoint, iconStyle, type Vec3 } from '@/components/blocks/CrystalizedBall/field';
import { STIR, STIR_GLSL, stiffness, stirStep, trackBrush, type Brush } from '@/components/blocks/CrystalizedBall/stir';
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

  it('adds the stir offset to the drift point and keeps every point inside the glass', () => {
    const base = driftPoint(home, seed, 1, [.2, .1]);
    expect(fieldPoint(home, seed, 1, [.2, .1], [.1, -.05, .02])).toEqual([base[0] + .1, base[1] - .05, base[2] + .02].map(v => expect.closeTo(v, 12)));
    const p = fieldPoint([.99, 0, .1], seed, 0, REST, NONE);
    expect(length(p)).toBeCloseTo(LIMIT, 10);
  });

  it('the dust vertex shader carries the same drift formula and constants', () => {
    expect(FIELD_GLSL).toContain('vec3 driftPoint(vec3 home, vec3 seed, float t, vec2 turn)');
    expect(FIELD_GLSL).toContain('vec3 fieldPoint(vec3 home, vec3 seed, float t, vec2 turn, vec3 offset)');
    for (const value of [DRIFT, LIMIT]) expect(FIELD_GLSL).toContain(value.toFixed(4));
    for (const literal of ['t * 0.37 + seed.x * 17.0', 't * 0.83 + seed.y * 5.0', 't * 0.29 + seed.y * 11.0', 't * 0.61 + seed.z * 7.0', 't * 0.33 + seed.z * 23.0'])
      expect(FIELD_GLSL).toContain(literal);
  });
});

// The reference stir pass (designRefactoring2/CrystalizedBall/index.tsx stirFragment + frame loop), transcribed literally
// as the oracle. Only the spring constant source differs: the reference hashed the particle id, here it is the seed's k.
type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function referenceSwirl(p: V3, dustTime: number): V3 {
  const t = dustTime * 0.15;
  const a: V3 = [1.7 * p[1] + t, 1.9 * p[2] + 1.2, 1.5 * p[0] + 2.1];
  const b: V3 = [2.3 * p[2] + 0.4, 2.1 * p[0] + t * 1.3, 2.7 * p[1] + 0.9];
  const ca: V3 = [Math.cos(a[0]) * 1.7, Math.cos(a[1]) * 1.9, Math.cos(a[2]) * 1.5];
  const cb: V3 = [Math.cos(b[0]) * 2.3, Math.cos(b[1]) * 2.1, Math.cos(b[2]) * 2.7];
  return [ca[2] - cb[0], cb[1] - ca[0], ca[1] - cb[2]];
}
function referenceStir(state: { o: V3; v: V3 }, base: V3, k: number, uDustTime: number, uDt: number, uBrush: number[], uBrushPower: number) {
  let { o, v } = state;
  const p = add(base, o);
  let acc = sub(mul(o, -k), mul(v, 1.5 * Math.sqrt(k)));
  const gap = [p[0] - uBrush[0], p[1] - uBrush[1]];
  const touch = Math.exp(-(gap[0] ** 2 + gap[1] ** 2) / 0.07) * uBrushPower;
  acc = add(acc, mul(sub([uBrush[2], uBrush[3], 0], v), touch * 14));
  const pace = Math.hypot(...v);
  if (pace > 1e-4) {
    const heading = mul(v, 1 / pace);
    const curl = referenceSwirl(mul(p, 1.6), uDustTime);
    acc = add(acc, mul(sub(curl, mul(heading, dot(curl, heading))), Math.min(pace, 2) * 1.8));
  }
  v = add(v, mul(acc, uDt));
  o = add(o, mul(v, uDt));
  const q = add(base, o);
  const len = Math.hypot(...q);
  if (len > 0.97) {
    const n = mul(q, 1 / len);
    o = sub(o, mul(n, len - 0.97));
    v = sub(v, mul(n, Math.max(dot(v, n), 0) * 1.5));
  }
  state.o = o; state.v = v;
}
// Reference frame loop: brush follow, stir energy, 7 s settle with reset. Pointer x/y in ball radii, inside = over the canvas.
function referenceFrames(path: { x: number; y: number; inside: boolean }[], dt: number, step: (stirring: boolean, input: { t: number; dt: number; brush: number[]; power: number }) => void) {
  const brush = { x: 0, y: 0, vx: 0, vy: 0 };
  let fresh = true, wasInside = false, stirEnergy = 0, stirring = 0, dustTime = 0;
  for (const { x: bx, y: by, inside } of path) {
    if (inside && !wasInside) fresh = true;
    wasInside = inside;
    dustTime += dt;
    if (Math.hypot(bx - brush.x, by - brush.y) > 0.6) fresh = true;
    if (fresh) { Object.assign(brush, { x: bx, y: by, vx: 0, vy: 0 }); fresh = false; }
    const follow = 1 - Math.exp(-dt / 0.05);
    brush.vx += ((bx - brush.x) / dt - brush.vx) * follow;
    brush.vy += ((by - brush.y) / dt - brush.vy) * follow;
    brush.x = bx; brush.y = by;
    const brushSpeed = Math.hypot(brush.vx, brush.vy);
    const cap = brushSpeed > 4 ? 4 / brushSpeed : 1;
    const inBall = Math.exp(-Math.max(0, Math.hypot(bx, by) - 1) * 6);
    const brushPower = inside ? 0.7 * inBall : 0;
    stirEnergy = stirEnergy * Math.exp(-dt / 1.2) + brushPower * Math.min(brushSpeed, 4) * dt;
    if (stirEnergy > 0.002) stirring = 7;
    if (stirring > 0) {
      step(true, { t: dustTime, dt: Math.min(dt, 1 / 30), brush: [brush.x, brush.y, brush.vx * cap, brush.vy * cap], power: brushPower });
      stirring -= dt;
      if (stirring <= 0) { stirring = 0; step(false, { t: dustTime, dt: 0, brush: [], power: 0 }); }
    }
  }
}
// Cursor enters left of the point, sweeps across it, stops on it for 10 s, leaves.
const sweep = () => {
  const path: { x: number; y: number; inside: boolean }[] = [];
  for (let i = 0; i < 6; i++) path.push({ x: -1.6, y: 0, inside: false });
  for (let i = 0; i <= 40; i++) path.push({ x: -0.6 + i * .03, y: -0.1 + i * .006, inside: true });
  for (let i = 0; i < 600; i++) path.push({ x: .6, y: .14, inside: true });
  for (let i = 0; i < 120; i++) path.push({ x: -1.6, y: -1.2, inside: false });
  return path;
};

describe('stir: the reference pointer response, one particle at a time', () => {
  it('stirStep and trackBrush equal the reference equations step by step along a scripted cursor path', () => {
    const icon = BALL_ICONS[0];
    const k = stiffness(icon.seed);
    expect(k).toBeGreaterThanOrEqual(.8); expect(k).toBeLessThan(2.2);
    const ref = { o: [0, 0, 0] as V3, v: [0, 0, 0] as V3 };
    const mine = { o: [0, 0, 0] as Vec3, v: [0, 0, 0] as Vec3 };
    const brush: Brush = { x: 0, y: 0, vx: 0, vy: 0, fresh: true };
    const dt = 1 / 30;
    let compared = 0, maxOffset = 0, wasInside = false, frame = 0;
    const path = sweep();
    referenceFrames(path, dt, (stirring, input) => {
      if (!stirring) { ref.o = [0, 0, 0]; ref.v = [0, 0, 0]; return; }
      const turn = [.1, -.05];
      const base = driftPoint(icon.home, icon.seed, input.t, turn) as V3;
      referenceStir(ref, base, k, input.t, input.dt, input.brush, input.power);
      stirStep(mine.o, mine.v, base, k, input);
      for (let i = 0; i < 3; i++) { expect(mine.o[i]).toBeCloseTo(ref.o[i], 12); expect(mine.v[i]).toBeCloseTo(ref.v[i], 12); }
      maxOffset = Math.max(maxOffset, Math.hypot(...mine.o));
      compared++;
    });
    // The brush follower, replayed on the same path.
    let rx = 0, ry = 0, rvx = 0, rvy = 0, fresh = true;
    for (const { x, y, inside } of path) {
      if (inside && !wasInside) { fresh = true; brush.fresh = true; }
      wasInside = inside;
      if (Math.hypot(x - rx, y - ry) > .6) fresh = true;
      if (fresh) { [rx, ry, rvx, rvy, fresh] = [x, y, 0, 0, false]; }
      const follow = 1 - Math.exp(-dt / .05);
      rvx += ((x - rx) / dt - rvx) * follow; rvy += ((y - ry) / dt - rvy) * follow; rx = x; ry = y;
      trackBrush(brush, x, y, dt);
      expect([brush.x, brush.y, brush.vx, brush.vy]).toEqual([rx, ry, rvx, rvy].map(value => expect.closeTo(value, 12)));
      frame++;
    }
    expect(frame).toBe(path.length);
    expect(compared).toBeGreaterThan(200);
    // The sweep drags the point into a visible wake.
    expect(maxOffset).toBeGreaterThan(.05);
  });

  it('a moving cursor drags points along its velocity and they spring back; a resting cursor moves nothing', () => {
    const base: Vec3 = [.1, 0, .2];
    const o: Vec3 = [0, 0, 0], v: Vec3 = [0, 0, 0];
    const k = 1.5;
    // Moving right at 2 radii/s right over the point.
    for (let i = 0; i < 6; i++) stirStep(o, v, base, k, { t: i / 30, dt: 1 / 30, brush: [.1, 0, 2, 0], power: HOVER });
    expect(o[0]).toBeGreaterThan(.01);
    expect(Math.abs(o[0])).toBeGreaterThan(Math.abs(o[1]));
    // A cursor resting on the point only damps: the drag velocity dies out instead of being fed.
    const dragged = Math.hypot(...v);
    for (let i = 0; i < 30; i++) stirStep(o, v, base, k, { t: .2 + i / 30, dt: 1 / 30, brush: [.1, 0, 0, 0], power: HOVER });
    expect(Math.hypot(...v)).toBeLessThan(dragged / 5);
    // Once the cursor is away the spring brings it home, swirling (the curl turns the return path; the settle reset ends it).
    const away = Math.hypot(...o);
    for (let i = 0; i < 300; i++) stirStep(o, v, base, k, { t: 1.2 + i / 30, dt: 1 / 30, brush: [-1.5, 0, 0, 0], power: 0 });
    expect(Math.hypot(...o)).toBeLessThan(away / 3);
    const still: Vec3 = [0, 0, 0], at: Vec3 = [0, 0, 0];
    for (let i = 0; i < 300; i++) stirStep(still, at, base, k, { t: i / 30, dt: 1 / 30, brush: [.1, 0, 0, 0], power: HOVER });
    expect(still).toEqual([0, 0, 0]);
  });

  it('the stir shader carries the same equations and constants', () => {
    expect(STIR_GLSL).toContain('void stir(inout vec3 o, inout vec3 v, vec3 base, float k, float t, float dt, vec4 brush, float power)');
    expect(STIR_GLSL).toContain('float stiffness(vec3 seed) { return 0.8 + 1.4 * fract(seed.x * 53.0); }');
    for (const value of [STIR.width, STIR.grip, STIR.scale, STIR.curl, STIR.wall, STIR.bounce]) expect(STIR_GLSL).toContain(value.toFixed(4));
    for (const line of ['vec3 acc = -k * o - 1.5 * sqrt(k) * v;', 'acc += (vec3(brush.zw, 0.0) - v) * touch *', 'acc += (curl - heading * dot(curl, heading)) * min(pace, 2.0) *',
      'v += acc * dt;', 'o += v * dt;', 'v -= n * max(dot(v, n), 0.0) *', 'vec3 a = vec3(1.7, 1.9, 1.5) * p.yzx + vec3(s, 1.2, 2.1);', 'vec3 b = vec3(2.3, 2.1, 2.7) * p.zxy + vec3(0.4, s * 1.3, 0.9);'])
      expect(STIR_GLSL).toContain(line);
    expect(STIR).toMatchObject({ settle: 7, maxStep: 1 / 30 });
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

  // Drift alone never reaches iconStyle's soft rim limit, so unstirred icons sit exactly on the particle field (Task 11 limits stirred ones).
  it('are smaller than the study prototype (12.5% of the ball) and stay inside the glass under drift and any turn', () => {
    expect(ICON_SIZE).toBeLessThan(.125);
    for (const icon of BALL_ICONS) for (let t = 0; t < 60; t += .37) for (const turn of [[.6, .3], [-.6, -.3], [.6, -.3]]) {
      const p = fieldPoint(icon.home, icon.seed, t, turn, NONE);
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

  // Task 11(사용자 요청 2026-10-22). A stir can carry an icon to the stir wall (.97 radii), past the rim with its box.
  // The icon box (half side ICON_SIZE x depth scale, plus ICON_MARGIN) stays inside the rim circle (radius 1), pressed in softly.
  it('keeps the whole icon box inside the rim for any point, presses it in smoothly from a knee, and leaves inner points alone', () => {
    const box = (point: Vec3) => {
      const [x, y, scale] = iconStyle(point).transform.match(/-?\d+(\.\d+)?/g)!.map(Number);
      return { cx: (x / 100 + .5) * 2 * ICON_SIZE, cy: -(y / 100 + .5) * 2 * ICON_SIZE, half: ICON_SIZE * scale };
    };
    expect(ICON_MARGIN).toBeGreaterThan(0);
    expect(ICON_MARGIN).toBeLessThan(.06);
    // Asserted once at the end: per-point expects time out under the full suite's load.
    let corner = 0, back = 0, jump = 0;
    for (const z of [-1, 0, .5, 1]) for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      let last = 0;
      for (let r = 0; r <= 1.2; r += .005) {
        const { cx, cy, half } = box([r * Math.cos(a), r * Math.sin(a), z]);
        // The farthest corner of the box, plus the margin, is inside the rim.
        corner = Math.max(corner, Math.hypot(Math.abs(cx) + half, Math.abs(cy) + half) + ICON_MARGIN);
        // No snap: the shown radius never goes back and never moves faster than the point does.
        const shown = Math.hypot(cx, cy);
        back = Math.max(back, last - shown);
        jump = Math.max(jump, shown - last);
        last = shown;
      }
    }
    expect(corner).toBeLessThanOrEqual(1 + 1e-3);
    expect(back).toBeLessThanOrEqual(1e-3);
    expect(jump).toBeLessThanOrEqual(.005 + 1e-3);
    // Points well inside (every drift position, the rest pose of the static ball) are placed exactly as before.
    for (const point of [[.3, -.2, 1], [-.5, .3, .1], [.55, .3, -1]] as Vec3[]) {
      const { cx, cy } = box(point);
      expect(cx).toBeCloseTo(point[0], 3);
      expect(cy).toBeCloseTo(point[1], 3);
    }
  });
});
