// Awards 궤도 기하. 단위는 .awards-stage 안의 px이고 원점은 stage 가운데다.
// Skills → Awards 넘김(M6 Task 2~4)이 같은 함수로 카드 자리를 계산하므로 여기 한 곳에만 둔다.

export type Orbit = { rx: number; ry: number; tilt: number };

const DEG = Math.PI / 180;

export const AWARD_ORBIT: Orbit = { rx: 415, ry: 255, tilt: 0 };
// stage의 -14°와 합쳐 화면에서 -22°로 보인다. 시작 시안 300×180에서는 앞 반의 카드가 가운데 원판에
// 화면 50px까지 가려 CERT 라벨이 잘렸다. 340×230이면 9px 안(카드 안쪽 여백)이고 수상 궤도선과도 떨어져 있다.
export const CERT_ORBIT: Orbit = { rx: 340, ry: 230, tilt: -8 * DEG };
export const CERT_PHASE = 1.3;
export const AWARD_COUNT = 3;

// 로컬 타원 위의 점을 궤도 기울기만큼 돌린다. depth는 앞(+1)과 뒤(-1)다.
export function orbitPoint(o: Orbit, phi: number, s = 1) {
  const lx = o.rx * Math.cos(phi) * s;
  const ly = o.ry * Math.sin(phi) * s;
  const cos = Math.cos(o.tilt);
  const sin = Math.sin(o.tilt);
  return { x: lx * cos - ly * sin, y: lx * sin + ly * cos, depth: Math.sin(phi) };
}

export const awardAngle = (angle: number, i: number) => angle + i * Math.PI * 2 / AWARD_COUNT;
// 자격증은 수상과 같은 angleRef, 같은 속도로 돈다.
export const certAngle = (angle: number) => angle + CERT_PHASE;

export type StageTransform = { scale: number; tilt: number };

export function readStage(stage: HTMLElement): StageTransform {
  const m = /^matrix\(\s*([^,]+),\s*([^,]+)/.exec(getComputedStyle(stage).transform);
  if (!m) return { scale: .86, tilt: -14 * DEG };
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  return { scale: Math.hypot(a, b), tilt: Math.atan2(b, a) };
}

export function toScreen(center: { x: number; y: number }, st: StageTransform, p: { x: number; y: number }) {
  const cos = Math.cos(st.tilt);
  const sin = Math.sin(st.tilt);
  return {
    x: center.x + (p.x * cos - p.y * sin) * st.scale,
    y: center.y + (p.x * sin + p.y * cos) * st.scale,
  };
}
