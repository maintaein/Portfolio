// 프리뷰 캡션의 드러냄(M4 Task 14, 사용자 선택 (가) 2026-10-27). 처음 Projects에 들어올 때(로고→프리뷰
// 넘김)와 상세에서 돌아올 때 같은 모양으로 들어온다. 어둠 띠는 그림의 녹음(PreviewMorph의 fbm 문턱)과 같은
// 잡음을 따라 아래부터 고르지 않게 차고, 글자는 줄마다 조금씩 늦게 흐림에서 또렷하게 떠오른다.
//
// 캡션([data-part="preview-caption"])과 그 글자 줄의 인라인 값은 이 모듈만 쓴다. motion.ts는 바깥 틀만,
// ProjectsSection은 다른 겹만 쓰고 여기는 부르기만 한다. 드러냄은 요소마다 하나이고 새로 부르거나 걷으면
// 앞의 것을 먼저 정리하므로, 어느 길로 끊겨도 반쯤 드러난 채나 감춘 채로 굳지 않는다.
//
// 띠는 CSS 마스크가 아니라 캔버스 2D로 그린다. 잡음 문턱(smoothstep)은 마스크 합성으로 못 만들고, SVG 필터
// 문턱을 프레임마다 바꾸면 feTurbulence를 매번 다시 래스터한다. 그래서 8px 칸의 작은 문턱 그림을 매 프레임
// 계산해(1440 화면에서 천삼백 칸 남짓) 캡션 크기로 늘려 그라데이션을 오려 낸다. WebGL 컨텍스트를 하나 더 만들지 않는다.

// 프리뷰 캡션 뒤 국소 그라데이션. 전면 카드로 덮지 않고 글자가 앉는
// 아래쪽에만 깐다 - SkillsSection의 SKILL_DESCRIPTION_SCRIM, About의
// ABOUT_SCRIMS_MOBILE와 같은 처방이고 방향(to top)도 같다. 알파 0.78도
// SKILL_DESCRIPTION_SCRIM에서 가져온 값이다.
//
// 다만 저 둘과 달리 뒷배경이 Hyperspeed가 아니라 남의 앱 화면 녹화다.
// 여섯 프로젝트 중 다섯이 밝은 테마라 캡션 뒤에 순백(255,255,255)이 그대로
// 온다. 형제 섹션처럼 기울기를 계속 태우면 글자 윗줄이 알파 0.47 자리에
// 앉아 대비가 3.25:1까지 내려간다(크롬 실측). 그래서 위 두 정지점의 알파를
// 같게 두어 글자가 앉는 구간 전체를 평평한 0.78로 만들고, 기울기는 글자가
// 없는 위쪽 여백(pt-12)에서만 진다. 어느 줄이 어디에 앉든 뒤가 같은 알파다.
// 드러냄의 캔버스도 같은 정지점을 그려야 끝에서 CSS 띠로 바뀔 때 안 튄다. 그래서 정지점을 한 곳에 둔다
export const SCRIM_STOPS = [
  [0, 0.78],
  [62, 0.78],
  [84, 0.3],
  [100, 0],
] as const;
export const PREVIEW_CAPTION_SCRIM = `linear-gradient(to top, ${SCRIM_STOPS.map(
  ([at, alpha]) => `rgb(0 0 0 / ${alpha}) ${at}%`
).join(', ')})`;

// 상세에서 돌아온 뒤 캡션이 들어오는 시간. 비행(500ms)이 다 끝나고 혼자 도는 구간이라 서둘 이유가 없다
export const CAPTION_REVEAL_MS = 800;
// 띠는 앞 70% 동안 차고 글자는 30%부터 떠오른다. 띠가 먼저 바닥을 깔아야 글자가 그 위에 앉는다
const SCRIM_SHARE = 0.7;
const LINE_LEAD = 0.3;
// 줄 사이 간격. 제목, 부제, 링크 세 줄 기준으로 마지막 줄이 전체 길이에 끝나게 줄 길이를 잡는다
const LINE_STAGGER_MS = 75;
const LINE_SLOTS = 3;
// 사이트 공용 진입 커브(lib/gsap의 SITE_EASE_CUBIC). 그 모듈을 부르면 GSAP이 이 청크에 정적으로 딸려 온다
const LINE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const LINE_KEYFRAMES: Keyframe[] = [
  { opacity: 0, filter: 'blur(6px)', transform: 'translateY(8px)' },
  // 끝값을 none이 아니라 0px로 둔다. transform이 남아 있는 동안은 글자 줄이 캔버스 위 겹에 그려진다
  { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' },
];

// 문턱 그림의 칸 크기(CSS px). 늘리면서 생기는 이중선형 번짐이 녹음 셰이더의 부드러운 경계(±0.15) 노릇을 한다
const CELL_PX = 8;
// PreviewMorph의 smoothstep(nn - 0.15, nn + 0.15, p) 문턱 폭. 경계가 같은 무르기로 녹는다
const BAND = 0.15;
// 무늬 배율. PreviewMorph의 NOISE_SCALE(2.4, 프리뷰 한 폭에 무늬 2.4개)의 1.6배다. 캡션은 프리뷰 아래 3분의 1
// 남짓이라 같은 배율이면 그 높이에 무늬가 반 개도 안 들어 물결 한 줄로만 읽혔다(헤드 크롬 실측)
const NOISE_SCALE = 2.4 * 1.6;
// 아래부터 차는 기울기와 잡음의 몫. 잡음 쪽이 커야 경계가 섬처럼 앞서 나간 조각을 남긴다
const NOISE_MIX = 0.65;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// PreviewMorph 셰이더의 hash21·noise·fbm을 그대로 옮겼다
function hash21(x: number, y: number) {
  const fr = (v: number) => v - Math.floor(v);
  let a = fr(x * 0.1031);
  let b = fr(y * 0.1031);
  let c = fr(x * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d;
  b += d;
  c += d;
  return fr((a + b) * c);
}
function noise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash21(ix, iy);
  const b = hash21(ix + 1, iy);
  const c = hash21(ix, iy + 1);
  const d = hash21(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}
function fbm(x: number, y: number) {
  let v = 0;
  let amp = 0.5;
  for (let i = 0; i < 5; i++) {
    v += amp * noise(x, y);
    x *= 2;
    y *= 2;
    amp *= 0.5;
  }
  return v;
}

// 칸마다 "언제 차는가"를 0–1로 미리 잰다. 아래 끝이 0 쪽이고 잡음이 그 순서를 흐트러뜨린다
function revealField(gw: number, gh: number, w: number) {
  const field = new Float32Array(gw * gh);
  // 드러냄마다 잡음 자리를 옮겨 매번 같은 무늬가 되풀이되지 않게 한다
  const seed = Math.random() * 100;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      // 가로세로 같은 배율. 캡션 폭이 곧 프리뷰 폭이라 그림 녹음과 같은 크기의 무늬가 된다
      const n = fbm(((x * CELL_PX) / w) * NOISE_SCALE + seed, ((y * CELL_PX) / w) * NOISE_SCALE);
      field[y * gw + x] = (1 - NOISE_MIX) * (1 - y / (gh - 1)) + NOISE_MIX * n;
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of field) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) / (max - min || 1);
  return field;
}

// 띠를 그리는 캔버스. 캡션의 첫 자식으로 꽂아 글자 줄보다 아래 겹에 둔다. 크기가 없거나 2D 컨텍스트를
// 못 얻으면 null이고, 그때 띠는 CSS 그대로 두고 글자만 들어온다
function scrimPainter(caption: HTMLElement) {
  const w = caption.clientWidth;
  const h = caption.clientHeight;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const gw = Math.ceil(w / CELL_PX) + 1;
  const gh = Math.ceil(h / CELL_PX) + 1;
  const grid = document.createElement('canvas');
  const gctx = grid.getContext('2d');
  if (!ctx || !gctx) return null;
  canvas.width = w;
  canvas.height = h;
  grid.width = gw;
  grid.height = gh;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  const gradient = ctx.createLinearGradient(0, h, 0, 0);
  for (const [at, alpha] of SCRIM_STOPS) gradient.addColorStop(at / 100, `rgba(0, 0, 0, ${alpha})`);
  const field = revealField(gw, gh, w);
  const image = gctx.createImageData(gw, gh);
  caption.insertBefore(canvas, caption.firstChild);
  return {
    draw(p: number) {
      const threshold = -BAND + (1 + 2 * BAND) * p;
      for (let i = 0; i < field.length; i++) {
        image.data[i * 4 + 3] = 255 * smoothstep(field[i] - BAND, field[i] + BAND, threshold);
      }
      gctx.putImageData(image, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(grid, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
    remove: () => canvas.remove(),
  };
}

const active = new WeakMap<HTMLElement, () => void>();

// 지금 도는 드러냄이나 감춤을 걷고 캡션을 CSS가 정한 모양으로 둔다. 끊기는 길은 전부 여기로 온다
export function clearCaptionReveal(caption: HTMLElement) {
  const stop = active.get(caption);
  active.delete(caption);
  stop?.();
}

// 드러냄 전까지 캡션을 통째로 감춘다(닫기 비행이 뜨는 순간). 드러냄이나 걷기가 이 값을 지운다
export function hideCaption(caption: HTMLElement) {
  clearCaptionReveal(caption);
  caption.style.opacity = '0';
  active.set(caption, () => caption.style.removeProperty('opacity'));
}

// 캡션을 잡음 띠와 흐림 글자로 들여보낸다. 모션 감소면 잡음도 흐림도 없이 바로 보인다.
// 캡션은 pointer-events-none이라 도는 동안에도 클릭을 막지 않는다
export function revealCaption(
  caption: HTMLElement,
  { duration = CAPTION_REVEAL_MS, reduced = false }: { duration?: number; reduced?: boolean } = {}
) {
  clearCaptionReveal(caption);
  if (reduced) return;

  const lines = Array.from(
    caption.querySelector('[data-part="preview-caption-text"]')?.children ?? []
  );
  const lineMs = duration * (1 - LINE_LEAD) - (LINE_SLOTS - 1) * LINE_STAGGER_MS;
  // WAAPI라 글자는 컴포지터에서 돈다. 인라인 값을 안 쓰니 끝나고 걷을 것도 animation뿐이다
  const animations =
    typeof Element.prototype.animate === 'function'
      ? lines.map((line, i) =>
          line.animate(LINE_KEYFRAMES, {
            duration: lineMs,
            delay: duration * LINE_LEAD + i * LINE_STAGGER_MS,
            easing: LINE_EASE,
            fill: 'both',
          })
        )
      : [];

  const scrim = scrimPainter(caption);
  const background = caption.style.background;
  if (scrim) {
    caption.style.background = 'none';
    scrim.draw(0);
  }

  const start = performance.now();
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    for (const animation of animations) animation.cancel();
    if (scrim) {
      scrim.remove();
      caption.style.background = background;
    }
  };
  const tick = () => {
    const elapsed = performance.now() - start;
    if (elapsed >= duration) {
      if (active.get(caption) === stop) clearCaptionReveal(caption);
      return;
    }
    // 문턱은 화면 위에서 모양이 바뀌는 움직임이라 ease-in-out(smoothstep)으로 민다. 감속 커브면 앞 3분의 1에 다 차서 잡음이 안 보였다
    scrim?.draw(smoothstep(0, 1, elapsed / (duration * SCRIM_SHARE)));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  active.set(caption, stop);
}
