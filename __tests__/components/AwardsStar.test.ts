import { describe, expect, it } from 'vitest';
import { AWARD_ORBIT, CERT_ORBIT, awardAngle, certAngle, orbitPoint, toScreen } from '@/components/sections/AwardAndCertificatesSection/orbit';
import { STAR_SECONDS, createTrail, rideHead, rideRange, starPose, type RideGeo, type StarGeo } from '@/components/sections/AwardAndCertificatesSection/star';

const DEG = Math.PI / 180;
// 1440×900 실측: 첫 줄(React) 헤드 문서 y 716, 원판 가운데 1739, 출발 높이 288, 도착 높이 488
const ride = (over: Partial<RideGeo> = {}): RideGeo => ({
  home: { x: 184, y: 716 }, center: { x: 712, y: 1739 }, departY: 288, landY: 488, ...over,
});
const star: StarGeo = { center: { x: 712, y: 488 }, discR: 137, angle: 0.4, stage: { scale: .86, tilt: -14 * DEG } };

describe('rideRange', () => {
  it('출발은 고른 줄 헤드가 출발 높이에 올 때, 도착은 원판 가운데가 도착 높이에 올 때다', () => {
    expect(rideRange(ride())).toEqual({ sD: 428, sA: 1251 });
  });

  it('맨 아래 줄(Figma, +504)이면 출발이 그만큼 늦다', () => {
    expect(rideRange(ride({ home: { x: 184, y: 716 + 504 } })).sD).toBe(932);
  });

  it('떠 있는 구간이 120px보다 짧으면 출발을 sA - 120으로 앞당긴다', () => {
    const { sD, sA } = rideRange(ride({ center: { x: 712, y: 716 + 300 } }));
    expect(sD).toBe(sA - 120);
  });
});

describe('rideHead', () => {
  it('출발 전에는 헤드 열에, 도착부터는 원판 가운데에 있다', () => {
    const g = ride(), { sD, sA } = rideRange(g);
    expect(rideHead(g, 0)).toEqual(g.home);
    expect(rideHead(g, sD)).toEqual(g.home);
    expect(rideHead(g, sA)).toEqual(g.center);
    expect(rideHead(g, sA + 400)).toEqual(g.center);
  });

  it('떠 있는 동안 화면 y는 출발 높이 근처에서 도착 높이로 단조롭게 간다', () => {
    const g = ride(), { sD, sA } = rideRange(g);
    let prev = -Infinity;
    for (let s = sD; s <= sA; s += 10) {
      const y = rideHead(g, s).y - s;
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = y;
    }
    expect(rideHead(g, sD + 1).y - (sD + 1)).toBeCloseTo(g.departY, 0);
    expect(rideHead(g, sA - 1).y - (sA - 1)).toBeCloseTo(g.landY, 0);
  });
});

describe('createTrail', () => {
  it('한 번에 400px 밀면 잔상이 7개 이하로 생기고 먼 것일수록 작고 옅다', () => {
    const trail = createTrail();
    trail.reset({ x: 184, y: 700 });
    trail.push({ x: 184, y: 1100 });
    const ghosts = trail.ghosts(12);
    expect(ghosts.length).toBeGreaterThan(0);
    expect(ghosts.length).toBeLessThanOrEqual(7);
    // 먼 것부터 낸다
    for (let i = 1; i < ghosts.length; i++) {
      expect(ghosts[i].r).toBeGreaterThan(ghosts[i - 1].r);
      expect(ghosts[i].a).toBeGreaterThan(ghosts[i - 1].a);
      expect(ghosts[i].y).toBeGreaterThan(ghosts[i - 1].y);
    }
  });

  it('push 없이 1초 동안 step하면 꼬리가 헤드에 감겨 잔상이 없다. 그동안 꼬리는 헤드를 넘지 않는다', () => {
    const trail = createTrail();
    trail.reset({ x: 184, y: 700 });
    trail.push({ x: 184, y: 1100 });
    let count = trail.ghosts(12).length;
    for (let i = 0; i < 60; i++) {
      trail.step(1 / 60);
      const ghosts = trail.ghosts(12);
      // 잔상은 지나온 길 위(700~1100)에만 있고, 수는 늘지 않는다(지나쳤다 돌아오지 않는다)
      for (const q of ghosts) {
        expect(q.y).toBeGreaterThanOrEqual(700);
        expect(q.y).toBeLessThanOrEqual(1100);
      }
      expect(ghosts.length).toBeLessThanOrEqual(count);
      count = ghosts.length;
    }
    expect(trail.ghosts(12)).toEqual([]);
  });

  it('0.5px 아래 이동은 버리고, 큰 dt에서도 꼬리가 헤드를 넘지 않는다', () => {
    const trail = createTrail();
    trail.reset({ x: 0, y: 0 });
    trail.push({ x: 0, y: 0.3 });
    expect(trail.ghosts(12)).toEqual([]);
    trail.push({ x: 0, y: 200 });
    for (let i = 0; i < 20; i++) {
      trail.step(0.05);
      for (const q of trail.ghosts(12)) expect(q.y).toBeLessThanOrEqual(200);
    }
    expect(trail.ghosts(12)).toEqual([]);
  });
});

describe('starPose', () => {
  const scattered = [
    { x: 700, y: 400, r: 10, a: .5 }, { x: 705, y: 380, r: 8, a: .4 },
    { x: 710, y: 360, r: 6, a: .3 }, { x: 712, y: 340, r: 5, a: .2 },
  ];

  it('도착 순간(since 0)에는 헤드 크기이고 DOM과 카드는 모두 감춰져 있다', () => {
    const { overlay, dom } = starPose(star, 0, scattered);
    expect(overlay.orb.r).toBeCloseTo(12);
    expect(overlay.orb.alpha).toBeCloseTo(1);
    expect([dom.disc, dom.text, dom.plane, dom.awardLine, dom.certLine]).toEqual([0, 0, 0, 0, 0]);
    expect(dom.cards).toEqual([0, 0, 0, 0]);
    // 점은 도착 순간의 잔상 자리에서 출발한다
    expect(overlay.fliers[0].x).toBeCloseTo(700);
    expect(overlay.fliers[0].y).toBeCloseTo(400);
  });

  it('끝(since 1.6)에는 원판·글씨·궤도선·카드가 다 서고 점과 자국은 사라진다', () => {
    const { overlay, dom } = starPose(star, STAR_SECONDS, scattered);
    expect(STAR_SECONDS).toBe(1.6);
    expect(overlay.orb.alpha).toBeCloseTo(.1);
    expect(overlay.orb.r).toBeCloseTo(137);
    expect([dom.disc, dom.text, dom.awardLine, dom.certLine]).toEqual([1, 1, 1, 1]);
    expect(dom.cards).toEqual([1, 1, 1, 1]);
    expect(overlay.fliers.map(q => q.a)).toEqual([0, 0, 0, 0]);
    expect(overlay.traces).toEqual([]);
  });

  it('점 i의 마지막 자리는 그 카드의 궤도 자리다(수상 0~2, 자격증 3)', () => {
    const { overlay } = starPose(star, STAR_SECONDS, scattered);
    const homes = [0, 1, 2].map(i => orbitPoint(AWARD_ORBIT, awardAngle(star.angle, i))).concat(orbitPoint(CERT_ORBIT, certAngle(star.angle)));
    homes.forEach((p, i) => {
      const q = toScreen(star.center, star.stage, p);
      expect(Math.hypot(overlay.fliers[i].x - q.x, overlay.fliers[i].y - q.y)).toBeLessThan(1);
    });
  });

  it('since가 늘면 DOM 값과 카드는 줄지 않는다(거꾸로 재생이 같은 그림을 낸다)', () => {
    let prev = starPose(star, 0, scattered).dom;
    for (let s = 0.02; s <= STAR_SECONDS + 1e-9; s += 0.02) {
      const { dom } = starPose(star, s, scattered);
      for (const k of ['disc', 'text', 'plane', 'awardLine', 'certLine'] as const) expect(dom[k]).toBeGreaterThanOrEqual(prev[k]);
      dom.cards.forEach((c, i) => expect(c).toBeGreaterThanOrEqual(prev.cards[i]));
      prev = dom;
    }
  });

  it('궤도에 다 오른 점 뒤로 자국이 따라온다', () => {
    const traces = Array.from({ length: 80 }, (_, i) => starPose(star, i * 0.02, scattered).overlay.traces).flat();
    expect(traces.length).toBeGreaterThan(0);
    for (const t of traces) {
      expect(t.to - t.from).toBeCloseTo(1.2);
      expect([AWARD_ORBIT, CERT_ORBIT]).toContain(t.orbit);
    }
  });

  it('잔상이 없어도 원판 가운데 근처에서 점 4개가 출발한다', () => {
    const { overlay } = starPose(star, 0, []);
    expect(overlay.fliers).toHaveLength(4);
    overlay.fliers.forEach((q, i) => {
      expect(q.x).toBeCloseTo(star.center.x + (i - 1.5) * 10);
      expect(q.y).toBeCloseTo(star.center.y - 16 - 12 * i);
      expect(q.r).toBeCloseTo(6.6);
      expect(q.a).toBeCloseTo(.35);
    });
  });
});
