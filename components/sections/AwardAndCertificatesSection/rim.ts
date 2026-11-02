import { blobPath, n2 } from '../ExperienceSection/orb';

// 원판 둘레의 일렁이는 항성 테두리. 시안 ride.html star()의 테두리 선과 바깥 빛을 옮겼다.
export interface StarRim {
  // time: 초
  draw(time: number): void;
  resize(): void;
  clear(): void;
}

// .awards-center 320px의 반. 캔버스(CSS 500px)는 원판과 같은 가운데에 놓인다.
const R = 160;

// 2D 컨텍스트가 없으면 null이다. 그때는 원판의 CSS border가 남는다.
export function createStarRim(canvas: HTMLCanvasElement): StarRim | null {
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
    draw(time) {
      // 크기가 0이면(모바일에서 궤도와 함께 숨음) 그리지 않는다.
      if (!canvas.width || !canvas.height) return;
      clear();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x = canvas.width / dpr / 2, y = canvas.height / dpr / 2;
      // shadowBlur는 변환을 따르지 않아 dpr을 곱한다.
      g.shadowColor = 'rgba(3,179,195,1)';
      g.shadowBlur = 18 * dpr;
      blobPath(g, x, y, R, 0.018, 0, time, 120);
      g.strokeStyle = 'rgba(160,240,246,.85)';
      g.lineWidth = 1.6;
      g.stroke();
      g.shadowBlur = 0;
      const halo = g.createRadialGradient(x, y, R, x, y, R * 1.5);
      halo.addColorStop(0, `rgba(3,179,195,${0.16 * (0.85 + 0.15 * n2(time * 1.3, 4))})`);
      halo.addColorStop(1, 'rgba(3,179,195,0)');
      g.fillStyle = halo;
      // 바깥 고리만 칠한다. 캔버스가 원판 위에 있어 안까지 칠하면 글씨가 흐려진다.
      g.beginPath();
      g.arc(x, y, R * 1.5, 0, Math.PI * 2);
      g.arc(x, y, R, 0, Math.PI * 2, true);
      g.fill();
    },
  };
}
