import { describe, expect, it } from 'vitest';
import { AWARD_ORBIT, CERT_ORBIT, orbitPoint, readStage, toScreen } from '@/components/sections/AwardAndCertificatesSection/orbit';

const DEG = Math.PI / 180;

describe('Awards 궤도 기하', () => {
  it('수상 궤도는 기울기 없이 415×255 타원 위의 점과 앞뒤 깊이를 낸다', () => {
    const right = orbitPoint(AWARD_ORBIT, 0);
    expect(right.x).toBeCloseTo(415);
    expect(right.y).toBeCloseTo(0);
    expect(right.depth).toBeCloseTo(0);
    const front = orbitPoint(AWARD_ORBIT, Math.PI / 2);
    expect(front.x).toBeCloseTo(0);
    expect(front.y).toBeCloseTo(255);
    expect(front.depth).toBeCloseTo(1);
  });

  it('자격증 궤도의 점은 궤도 기울기 -8°만큼 돌아간다', () => {
    const p = orbitPoint(CERT_ORBIT, 0);
    // 시작 시안 300에서 라벨 겹침을 보고 340으로 키웠다(orbit.ts).
    expect(p.x).toBeCloseTo(340 * Math.cos(-8 * DEG));
    expect(p.y).toBeCloseTo(340 * Math.sin(-8 * DEG));
  });

  it('stage의 computed matrix에서 배율과 회전을 읽고 transform이 없으면 기본값을 쓴다', () => {
    const stage = document.createElement('div');
    document.body.append(stage);
    stage.style.transform = 'matrix(0.8344, -0.2081, 0.2081, 0.8344, 0, 0)';
    const read = readStage(stage);
    expect(read.scale).toBeCloseTo(.86, 2);
    expect(read.tilt).toBeCloseTo(-14 * DEG, 3);
    stage.style.transform = '';
    expect(readStage(stage)).toEqual({ scale: .86, tilt: -14 * DEG });
    stage.remove();
  });

  it('stage 점을 회전과 배율을 거쳐 화면 가운데 기준 자리로 옮긴다', () => {
    const p = toScreen({ x: 100, y: 100 }, { scale: .5, tilt: 0 }, { x: 10, y: -10 });
    expect(p.x).toBeCloseTo(105);
    expect(p.y).toBeCloseTo(95);
  });
});
