import { K, lerp } from '../ExperienceSection/lineMotion';
import { drawGhosts, drawOrb, drawRing, ghostSpots } from '../ExperienceSection/orb';

// Skills 헤드: Experience 헤드와 같은 재질의 빛 덩어리. 헤드 열 위의 작은 캔버스에 그린다.
export interface HeadLayer {
  // 좌표는 무대 기준(graph의 geo와 같다). tailY는 줄을 옮길 때 헤드를 쫓는 꼬리 끝, ring은 고리 펄스(1 → 0).
  draw(x: number, y: number, tailY: number, time: number, ring: number): void;
  clear(): void;
  resize(): void;
}

const R = 12;

// 2D 컨텍스트가 없으면 null이다. 헤드는 장식이라 그리지 않는다.
export function createHeadLayer(canvas: HTMLCanvasElement): HeadLayer | null {
  const g = canvas.getContext('2d');
  if (!g) return null;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  };
  const clear = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
  };
  resize();
  return {
    resize,
    clear,
    draw(x, y, tailY, time, ring) {
      clear();
      // 캔버스는 무대 안 헤드 열에 있다. 그 왼쪽 위만큼 옮겨 무대 좌표로 그린다.
      g.setTransform(dpr, 0, 0, dpr, -canvas.offsetLeft * dpr, -canvas.offsetTop * dpr);
      drawGhosts(g, ghostSpots(Math.abs(y - tailY)).map(s => ({ x, y: lerp(y, tailY, s.f), r: R * s.scale, a: s.a })), time);
      drawOrb(g, x, y, R, 1, 0, time, K);
      drawRing(g, x, y, R, ring);
    },
  };
}
