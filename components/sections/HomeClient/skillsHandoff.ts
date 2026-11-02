import { buildHandoffTable, handoffCurveLength, handoffPose, type HandoffFrame, type HandoffTable } from '@/components/sections/ExperienceSection/handoff';
import { measureTimeline } from '@/components/sections/ExperienceSection/geometry';
import type { ExperienceOverlay } from '@/components/sections/ExperienceSection/overlay';
import type { SkillsSectionHandle } from '@/components/sections/SkillsSection';
import { gsap } from '@/lib/gsap';

export interface SkillsHandoff {
  setOverlay(overlay: ExperienceOverlay | null): void;
  // Skills 헤드 손잡이. 도착이 바뀌는 그 자리에서 헤드를 숨기거나 세운다(React 커밋을 기다리지 않는다).
  setSkillsHead(head: SkillsSectionHandle | null): void;
  setPaused(paused: boolean): void;
  // Skills가 도착한 자리에 제 헤드를 그렸다. 잡아 둔 넘김 헤드를 놓는다.
  release(): void;
  destroy(): void;
}

// 첫 기술 줄 가운데가 창 높이의 이만큼 위로 오면 넘긴다
const TRIGGER = .7;
// 도착한 헤드를 Skills가 그릴 때까지 잡아 두는 상한(초). Skills가 그리지 못해도 오버레이가 스스로 비운다.
const HOLD_SECONDS = .5;
// 헤드를 Skills에 넘긴 뒤: 아무것도 그리지 않되 타임라인도 그리지 않는다
// 앞으로 가는 헤드가 곡선을 이만큼 지나면 Skills 목록이 나온다
const REVEAL_AT = .4;
const HANDED: HandoffFrame = { line: null, heads: [], head: null, ghosts: [] };

// Experience 선이 Skills 헤드로 빨려 가는 넘김의 재생. Projects → Experience 경계처럼 지점을 지나면 정해진 시간 동안 끝까지 돌고,
// 되돌아 지나면 지금 진행도에서 거꾸로 돈다. 그림은 오버레이가, 쉬는 헤드는 Skills가 그린다. 아래쪽 입력은 막지 않는다(설계 판단).
// onHold: 도착한 넘김 헤드를 Skills가 그릴 때까지 잡아 두기 시작(true)하고 놓았다(false). 그동안 Skills 헤드는 아직 화면에 없다.
export function createSkillsHandoff({ root, reduced, onArrive, onHold }: { root: HTMLElement; reduced: boolean; onArrive: (arrived: boolean) => void; onHold?: (held: boolean) => void }): SkillsHandoff {
  const line = root.querySelector<HTMLElement>('[data-part="experience-line"]');
  const section = line?.closest('section') ?? null;
  const skills = root.querySelector<HTMLElement>('[data-skill-map]');
  const skillsSection = skills?.closest('section') ?? skills;
  const head = skills?.querySelector<HTMLElement>('[data-graph="head"]') ?? null;
  const wide = window.matchMedia?.('(min-width: 768px)');
  const pose = { p: 0 };
  // -1: 아직 자리를 정하지 않았다(처음, 자격을 다시 얻음). 그때는 재생 없이 놓는다.
  let goal = -1;
  let tween: gsap.core.Tween | null = null;
  let hold: gsap.core.Tween | null = null;
  let table: HandoffTable | null = null;
  let overlay: ExperienceOverlay | null = null;
  let skillsHead: SkillsSectionHandle | null = null;
  // 오버레이에 넘김 프레임을 넘겨 둔 상태인가. 비울 때만 setHandoff(null)을 부른다.
  let shown = false;
  let arrived: boolean | null = null;
  let paused = false;
  let alive = true;
  // 지난 판정의 스크롤과, 바로 이동(nav, 화면 높이 넘는 한 번의 점프)으로 온 뒤 사용자가 아직 직접 스크롤하지 않았는지.
  // 바로 이동은 재생하지 않는다(설계 "재생하지 않는 경우"). 늦게 켜지는 완료(MutationObserver)도 이 표시를 본다.
  let lastY = window.scrollY;
  let jumped = false;

  const report = (next: boolean) => {
    if (next === arrived) return;
    arrived = next;
    // React 상태(onArrive)는 다음 작업에서야 커밋된다. 지점을 지난 scroll에서 오버레이 헤드와 같은 프레임에 맞바꾸려고 손잡이로 먼저 넘긴다.
    skillsHead?.setArrived(next);
    onArrive(next);
  };
  const send = (frame: HandoffFrame | null) => {
    if (!frame && !shown) return;
    shown = !!frame;
    overlay?.setHandoff(frame);
  };
  const stopHold = () => {
    if (!hold) return;
    hold.kill();
    hold = null;
    onHold?.(false);
  };
  const center = (el: Element | null | undefined) => el?.getBoundingClientRect();
  // 도착 자리: 고른 줄 가운데 y와 헤드 캔버스 가운데 x(화면 좌표). 매 프레임 다시 잰다.
  const target = () => {
    const row = center(skills?.querySelector('[data-skill-row][aria-pressed="true"]')), canvas = center(head);
    return { x: canvas ? canvas.left + canvas.width / 2 : 0, y: row ? row.top + row.height / 2 : 0 };
  };
  const screenGeo = () => {
    const t = section ? measureTimeline(section) : { axisX: 0, nodes: [], tail: 0 };
    return { ...t, tail: t.tail - window.scrollY, nodes: t.nodes.map(y => y - window.scrollY), target: target() };
  };
  const render = () => {
    if (pose.p <= 0) {
      stopHold();
      return send(null);
    }
    if (!table) return;
    const geo = screenGeo();
    // 표의 세로 길이로 길의 시작을 정한다(Ruling 15). 표는 출발 때 한 번 만들고, 도는 동안 바뀌는 것은 도착 자리뿐이다.
    send(handoffPose(table, { ...geo, top: geo.tail - table.lineLen }, pose.p));
    // 헤드는 처음부터 곡선 위다(세로선은 꼬리가 삼킨다). 곡선의 40%를 지나 옆으로 꺾이면 Skills 목록을 꺼낸다.
    // 내려앉기 약 0.4초 전이라 고른 줄(첫 줄, 240ms)이 그때 이미 보인다.
    if (goal === 1 && table.at(pose.p).head >= table.lineLen + table.curveLen * REVEAL_AT) skillsHead?.reveal();
    if (pose.p >= 1 && goal === 1) {
      // 잡아 두기를 도착보다 먼저 알린다. 도착을 알리는 그 호출에서 Awards 넘김이 아직 그려지지 않은 헤드를 데려가지 않게 한다.
      if (!hold) {
        hold = gsap.delayedCall(HOLD_SECONDS, release);
        onHold?.(true);
      }
      report(true);
    }
  };
  const release = () => {
    if (!hold) return;
    // 넘김 헤드를 먼저 비우고 잡아 두기를 푼다. 풀리는 그 호출에서 Awards 넘김이 떠나도 두 헤드가 함께 남지 않는다.
    send(HANDED);
    stopHold();
  };
  // 재생 없이 끝 상태에 놓는다. 1이면 넘김 헤드도 그리지 않고 바로 Skills에 넘긴다.
  const land = (next: number) => {
    tween?.kill();
    tween = null;
    stopHold();
    pose.p = next;
    if (next) {
      report(true);
      send(HANDED);
    } else send(null);
  };
  const tailOnScreen = () => {
    if (!section) return false;
    const y = measureTimeline(section).tail - window.scrollY;
    return y >= 0 && y <= window.innerHeight;
  };
  // Skills가 화면을 벗어났다(재생 중 세게 튕김). 끝으로 바로 놓는다.
  const skillsOff = () => {
    const box = center(skillsSection);
    return !box || box.bottom <= 0 || box.top >= window.innerHeight;
  };
  const skip = () => jumped || skillsOff();
  const move = (next: number) => {
    goal = next;
    if (!next) report(false);
    if (paused || document.hidden || !tailOnScreen() || skip()) return land(next);
    tween?.kill();
    tween = null;
    stopHold();
    // 아직 한 프레임도 가지 않은 채 되돌았다. 그 끝의 프레임을 다시 놓는다(1이면 Skills가 그릴 때까지 넘김 헤드를 잡아 둔다).
    if (pose.p === next) return render();
    // 출발(0이나 1)할 때만 표를 만든다. 길의 시작은 지금 화면에 보이는 선의 윗끝이다(그 위는 이미 삼킨 것으로 친다).
    if (pose.p <= 0 || pose.p >= 1 || !table) {
      const t = measureTimeline(section!), y = window.scrollY;
      const top = Math.max(y - 20, t.nodes[0] ?? t.tail);
      table = buildHandoffTable(t.tail - top, handoffCurveLength({ axisX: t.axisX, tail: t.tail - y, target: target() }));
    }
    tween = gsap.to(pose, {
      p: next, duration: Math.abs(next - pose.p) * table.total, ease: 'none',
      onUpdate: render, onComplete: () => { tween = null; render(); },
    });
    // 출발 프레임을 바로 보낸다. p 1에서 거꾸로 가면 위 report(false)가 Skills 헤드를 지운 같은 scroll에서 넘김 헤드가 선다.
    render();
  };
  const decide = () => {
    if (!alive) return;
    if (reduced || !overlay || (wide && !wide.matches)) {
      tween?.kill();
      tween = null;
      stopHold();
      send(null);
      pose.p = 0;
      goal = -1;
      return report(true);
    }
    // Projects → Experience 경계와 같은 표시(data-navigation-target)로 nav 이동을 안다
    const y = window.scrollY, dy = Math.abs(y - lastY);
    lastY = y;
    if (root.hasAttribute('data-navigation-target') || dy > window.innerHeight) jumped = true;
    else if (dy) jumped = false;
    const row = center(skills?.querySelector('[data-skill-row]'));
    const next = line?.dataset.complete === 'true' && !!row && row.top + row.height / 2 <= TRIGGER * window.innerHeight ? 1 : 0;
    if (goal === -1) {
      // 처음 놓인 자리(#skills 새로 고침, 복원)는 바로 이동이다. 손으로 scroll하기 전의 늦은 완료도 재생하지 않는다.
      jumped = true;
      goal = next;
      if (!next) report(false);
      return land(next);
    }
    if (next !== goal) move(next);
    else if (tween && skip()) land(goal);
  };
  // 재생 중 숨거나 멈추면 지금 향하던 끝으로 바로 놓는다
  const finish = () => { if (tween) land(goal); };
  const onVisibility = () => { if (document.hidden) finish(); };

  window.addEventListener('scroll', decide, { passive: true });
  window.addEventListener('resize', decide);
  // 완료는 React가 늦게 쓴다. 한 번의 scroll이 완료와 지점을 함께 넘으면 그 scroll의 판정은 옛 값을 읽는다.
  const completion = typeof MutationObserver === 'undefined' || !line ? null : new MutationObserver(decide);
  completion?.observe(line!, { attributeFilter: ['data-complete'] });
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
    setSkillsHead(next) {
      skillsHead = next;
    },
    setPaused(next) {
      paused = next;
      if (next) finish();
      else decide();
    },
    release,
    destroy() {
      alive = false;
      tween?.kill();
      stopHold();
      send(null);
      window.removeEventListener('scroll', decide);
      window.removeEventListener('resize', decide);
      completion?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
