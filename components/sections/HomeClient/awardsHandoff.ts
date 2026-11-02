import type { Ghost } from '@/components/sections/ExperienceSection/orb';
import type { ExperienceOverlay } from '@/components/sections/ExperienceSection/overlay';
import type { AwardsSectionHandle } from '@/components/sections/AwardAndCertificatesSection';
import { readStage } from '@/components/sections/AwardAndCertificatesSection/orbit';
import { STAR_SECONDS, createTrail, rideHead, rideRange, starPose, type RideFrame, type RideGeo, type StarDom } from '@/components/sections/AwardAndCertificatesSection/star';
import { gsap } from '@/lib/gsap';
import { SECTION_IDS } from '@/lib/constants';

export interface AwardsHandoff {
  setOverlay(overlay: ExperienceOverlay | null): void;
  setAwards(awards: AwardsSectionHandle | null): void;
  setPaused(paused: boolean): void;
  // Experience 쪽에서 Skills 헤드가 와 있는가. 오지 않았으면(헤드가 없으면) 떠나지 않고 Awards는 쉰다(Ruling 9).
  setHeadArrived(arrived: boolean): void;
  // Skills가 돌아온 헤드를 제 자리에 그렸다. 잡아 둔 넘김 헤드를 놓는다.
  release(): void;
  destroy(): void;
}

// 떠 있는 헤드 반지름(Skills 헤드와 같다), 출발 파동 길이(초), 돌아온 헤드를 Skills가 그릴 때까지 잡아 두는 상한(초)
const R = 12;
const RING_SECONDS = .6;
const HOLD_SECONDS = .5;

// Skills 헤드가 화면에 머물며 내려가 Awards 항성이 되는 넘김의 재생. 떠 있는 구간은 스크롤에 묶이고,
// 도착 장면만 Exp → Skills처럼 정해진 시간 동안 끝까지 돈다(되돌아 지나면 지금 진행도에서 거꾸로). 판정 규칙은 skillsHandoff.ts와 같다.
export function createAwardsHandoff({ root, reduced, onAway }: { root: HTMLElement; reduced: boolean; onAway: (away: boolean) => void }): AwardsHandoff {
  const skills = root.querySelector<HTMLElement>('[data-skill-map]');
  const head = skills?.querySelector<HTMLElement>('[data-graph="head"]') ?? null;
  const disc = root.querySelector<HTMLElement>('[data-orbit-center]');
  const stage = disc?.closest<HTMLElement>('.awards-stage') ?? null;
  const section = disc?.closest('section') ?? null;
  const wide = window.matchMedia?.('(min-width: 768px)');
  const trail = createTrail();
  const pose = { p: 0 };
  // -1: 아직 자리를 정하지 않았다(처음, 자격을 다시 얻음). 그때는 재생 없이 놓는다.
  let goal = -1;
  let tween: gsap.core.Tween | null = null;
  let hold: gsap.core.Tween | null = null;
  let overlay: ExperienceOverlay | null = null;
  let awards: AwardsSectionHandle | null = null;
  // home: Skills가 헤드를 그린다. ride: 떠 있는 헤드. star: 도착 장면(p > 0, 1이면 Awards가 쉰다).
  let side: 'home' | 'ride' | 'star' = 'home';
  // 오버레이에 ride 프레임을 넘겨 둔 상태인가. 비울 때만 setRide(null)을 부른다.
  let shown = false;
  let away = false;
  let star: 'wait' | StarDom | null = null;
  // 도착 장면이 시작될 때 붙잡은 잔상(화면 좌표, 가까운 것부터)과 Awards 각도
  let scattered: Ghost[] = [];
  let angle = 0;
  let departAt = -Infinity;
  let raf = 0;
  let lastTime = 0;
  let paused = false;
  let headArrived = true;
  let alive = true;
  // 바로 이동(nav, 화면 높이 넘는 한 번의 점프)으로 온 뒤 사용자가 아직 직접 스크롤하지 않았는지. 도착 장면을 재생하지 않는다.
  let lastY = window.scrollY;
  let jumped = false;

  const report = (next: boolean) => {
    if (next === away) return;
    away = next;
    onAway(next);
  };
  const setStar = (next: 'wait' | StarDom | null) => {
    if (next === star) return;
    star = next;
    awards?.setStar(next);
  };
  const send = (frame: RideFrame | null) => {
    if (!frame && !shown) return;
    shown = !!frame;
    overlay?.setRide(frame);
  };
  const stopHold = () => {
    hold?.kill();
    hold = null;
  };
  // 문서 좌표의 자리와 화면 높이. header 높이는 매번 잰다.
  const geo = (): (RideGeo & { r: number }) | null => {
    const row = skills?.querySelector('[data-skill-row][aria-pressed="true"]')?.getBoundingClientRect();
    const canvas = head?.getBoundingClientRect(), c = disc?.getBoundingClientRect();
    if (!row || !canvas || !c) return null;
    const top = Math.max(0, document.querySelector('[data-scroll-header]')?.getBoundingClientRect().bottom ?? 0);
    const span = window.innerHeight - top, y = window.scrollY;
    return {
      home: { x: canvas.left + canvas.width / 2, y: row.top + row.height / 2 + y },
      center: { x: c.left + c.width / 2, y: c.top + c.height / 2 + y },
      departY: top + .15 * span, landY: top + .5 * span, r: c.width / 2,
    };
  };
  // Trail은 문서 좌표, 먼 것부터다
  const ghosts = () => trail.ghosts(R).map(q => ({ ...q, y: q.y - window.scrollY }));
  const headFrame = (at: { x: number; y: number }, dt: number, ring: RideFrame['ring']) => {
    trail.push(at);
    trail.step(dt);
    send({ head: { x: at.x, y: at.y - window.scrollY, r: R }, ghosts: ghosts(), ring, star: null });
  };
  // 지금 진행도와 스크롤로 한 프레임을 보낸다. 출발, 돌아옴, 도착 끝의 맞바꿈도 여기서 한다. dt: 꼬리를 쫓는 시간(초).
  const place = (dt = 0) => {
    const g = geo();
    if (!g) return;
    const y = window.scrollY;
    if (pose.p > 0) {
      side = 'star';
      report(true);
      // 도착 끝: DOM 원판과 테두리가 같은 자리에서 이어받는다. 빈 프레임을 남기지 않는다(Ruling 3).
      if (pose.p >= 1) {
        send(null);
        return setStar(null);
      }
      const since = pose.p * STAR_SECONDS;
      const { overlay: o, dom } = starPose({ center: { x: g.center.x, y: g.center.y - y }, discR: g.r, angle, stage: stage ? readStage(stage) : { scale: .86, tilt: -14 * Math.PI / 180 } }, since, scattered);
      send({ head: null, ghosts: [], ring: null, star: o });
      return setStar(dom);
    }
    if (side === 'star') {
      // 도착 장면이 거꾸로 0에 닿았다. 헤드는 원판 가운데에서 다시 떠 있다(바로 이동이면 지금 자리에서).
      side = 'ride';
      trail.reset(jumped ? rideHead(g, y) : g.center);
      departAt = -Infinity;
      setStar('wait');
      start();
    }
    if (y > rideRange(g).sD) {
      if (side === 'home') {
        // 출발: Skills 헤드를 먼저 지우고(손잡이, 같은 scroll 안) 같은 자리에서 떠 있는 헤드를 세운다
        stopHold();
        side = 'ride';
        trail.reset(jumped ? rideHead(g, y) : g.home);
        departAt = jumped ? -Infinity : performance.now();
        report(true);
        setStar('wait');
        start();
      }
      const pulse = 1 - (performance.now() - departAt) / 1000 / RING_SECONDS;
      return headFrame(rideHead(g, y), dt, pulse > 0 ? { x: g.home.x, y: g.home.y - y, r: R, pulse } : null);
    }
    if (side === 'ride') {
      // 돌아옴: home 자리 헤드 프레임을 보낸 뒤 Skills 헤드를 세운다. Skills가 그릴 때까지(release, 500ms) 잡아 둔다.
      side = 'home';
      headFrame(g.home, dt, null);
      report(false);
      setStar(null);
      stopHold();
      hold = gsap.delayedCall(HOLD_SECONDS, release);
      return;
    }
    if (hold) return headFrame(g.home, dt, null);
    send(null);
    report(false);
    setStar(null);
  };
  // 떠 있는 동안(그리고 잡아 둔 동안)은 스크롤이 없어도 꼬리를 감아 들인다
  const loop = (time: number) => {
    raf = 0;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
    lastTime = time;
    if (side === 'ride' || hold) {
      place(dt);
      start();
    } else lastTime = 0;
  };
  const start = () => {
    if (!raf && alive) raf = requestAnimationFrame(loop);
  };
  const release = () => {
    if (!hold) return;
    stopHold();
    if (side === 'home') send(null);
  };
  // 재생 없이 끝 상태에 놓는다
  const land = (next: number) => {
    tween?.kill();
    tween = null;
    pose.p = next;
    place();
  };
  // Awards가 화면을 벗어났다(재생 중 세게 튕김). 끝으로 바로 놓는다.
  const awardsOff = () => {
    const box = section?.getBoundingClientRect();
    return !box || box.bottom <= 0 || box.top >= window.innerHeight;
  };
  const move = (next: number) => {
    goal = next;
    if (paused || document.hidden || jumped || awardsOff()) return land(next);
    tween?.kill();
    tween = null;
    // 도착 장면이 0에서 오르는 순간의 잔상과 각도를 붙잡는다. 점은 그 잔상 자리에서 흩어지고 카드는 그 각도에서 공전을 잇는다.
    // 한 scroll이 sD와 sA를 함께 넘었으면 먼저 떠난다(꼬리는 home에서 시작한다).
    if (pose.p <= 0 && next) {
      place();
      scattered = side === 'ride' ? ghosts().reverse() : [];
      angle = awards?.angle() ?? 0;
    }
    if (pose.p !== next) {
      tween = gsap.to(pose, {
        p: next, duration: Math.abs(next - pose.p) * STAR_SECONDS, ease: 'none',
        onUpdate: place, onComplete: () => { tween = null; place(); },
      });
    }
    place();
  };
  const reset = () => {
    tween?.kill();
    tween = null;
    stopHold();
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
    send(null);
    pose.p = 0;
    side = 'home';
  };
  const decide = () => {
    if (!alive) return;
    if (reduced || !overlay || (wide && !wide.matches) || !headArrived) {
      reset();
      goal = -1;
      setStar(null);
      return report(false);
    }
    // Projects → Experience, Exp → Skills와 같은 표시(data-navigation-target)로 nav 이동을 안다
    const y = window.scrollY, dy = Math.abs(y - lastY);
    lastY = y;
    const target = root.getAttribute('data-navigation-target');
    if (target !== null) {
      // nav 중에는 떠 있지 않는다. 목적지 쪽 끝에 바로 놓고(Awards면 도착, 그 밖이면 home), 표시가 걷히면 첫 배치처럼 다시 놓는다(Ruling 8).
      const arrived = target === SECTION_IDS.AWARDS_CERTIFICATES;
      reset();
      goal = -1;
      if (arrived) {
        pose.p = 1;
        side = 'star';
      }
      setStar(null);
      return report(arrived);
    }
    if (root.hasAttribute('data-navigation-target') || dy > window.innerHeight) jumped = true;
    else if (dy) jumped = false;
    const g = geo();
    if (!g) return;
    const next = y >= rideRange(g).sA ? 1 : 0;
    if (goal === -1) {
      // 처음 놓인 자리(#awards 새로 고침, 복원)는 바로 이동이다
      jumped = true;
      goal = next;
      return land(next);
    }
    if (next !== goal) move(next);
    else if (tween && (jumped || awardsOff())) land(goal);
    else place();
  };
  // 재생 중 숨거나 멈추면 지금 향하던 끝으로 바로 놓는다
  const finish = () => { if (tween) land(goal); };
  const onVisibility = () => { if (document.hidden) finish(); };

  window.addEventListener('scroll', decide, { passive: true });
  window.addEventListener('resize', decide);
  // 떠 있는 동안 다른 기술 줄을 고르면 출발 자리와 돌아갈 자리가 바뀐다
  const selection = typeof MutationObserver === 'undefined' || !skills ? null : new MutationObserver(decide);
  selection?.observe(skills!, { subtree: true, attributeFilter: ['aria-pressed'] });
  // nav 표시가 서고 걷히는 때도 다시 판정한다(걷힌 뒤 scroll이 없을 수 있다)
  const navigation = typeof MutationObserver === 'undefined' ? null : new MutationObserver(decide);
  navigation?.observe(root, { attributeFilter: ['data-navigation-target'] });
  document.addEventListener('visibilitychange', onVisibility);
  decide();

  return {
    setOverlay(next) {
      if (next === overlay) return;
      send(null);
      overlay = next;
      // 새 오버레이에는 재생 없이 지금 쪽을 놓는다
      tween?.kill();
      tween = null;
      goal = -1;
      decide();
    },
    setAwards(next) {
      if (next === awards) return;
      awards = next;
      if (star) next?.setStar(star);
    },
    setPaused(next) {
      paused = next;
      if (next) finish();
      else decide();
    },
    setHeadArrived(next) {
      if (next === headArrived) return;
      headArrived = next;
      goal = -1;
      decide();
    },
    release,
    destroy() {
      reset();
      alive = false;
      setStar(null);
      window.removeEventListener('scroll', decide);
      window.removeEventListener('resize', decide);
      selection?.disconnect();
      navigation?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
