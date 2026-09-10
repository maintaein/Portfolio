'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { gsap, registerGsap, SITE_EASE } from '@/lib/gsap';

// 프리뷰 전환용 셰이더 모프.
//
// 원본은 `.claude/designRefactoring/mothSlider/mothSlider.tsx`의 melt 전환이고,
// 거기서 ogl로 하던 것을 이 저장소에 이미 있는 three로 옮겼다. 옮긴 것은 melt
// 하나뿐이라 ripple/shear/swirl이 쓰던 uMode·uDir·uPointer·rot()은 없다.
//
// 캔버스는 전환 0.56초 동안만 그린다. 프리뷰의 미디어는 계속 재생돼야 하는
// <video>이고 그 위에 캡션이 DOM으로 얹혀 있어서 캔버스가 미디어 자체를 대신할
// 수 없다. 대신 전환 순간에만 직전 화면 한 장과 도착 이미지 한 장을 텍스처로
// 물려 그 사이를 녹인다. 전환이 끝나면 tween이 멈추고 캔버스는 다시 투명해진다.

// mothSlider 기본값 1.1초는 클릭으로 넘기는 슬라이더 기준이다. 이름을 훑으면
// 전환이 연달아 터지므로 그보다 짧아야 하고, 폴백 경로의 300ms로는 melt가
// 녹을 시간이 안 난다. 0.56이 그 사이다
const DURATION_S = 0.56;
const INTENSITY = 0.55;
const NOISE_SCALE = 2.4;
// 기본값 0.35는 색테두리가 눈에 띈다. 이 사이트 배경이 순검정이라 더 도드라진다
const ABERRATION = 0.22;
// 상시 흔들림. 캔버스가 0.56초만 살아서 흔들 시간이 없고, 켜두면 정지 화면이
// 미세하게 떠는 것만 보인다. 원본의 흔들림 식은 그대로 옮기고 값만 껐다
const DRIFT = 0;
// --color-ink와 같은 순검정
const OVERLAY_RGB: [number, number, number] = [0, 0, 0];
const DPR_CAP = 2;

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// hash21/noise/fbm/coverUV와 melt 본체는 mothSlider 원본을 그대로 옮긴 것이다.
// hash11은 shear 전용이라 뺐고 rot는 swirl 전용이라 뺐다
const fragmentShader = `
precision highp float;

uniform sampler2D tCurrent;
uniform sampler2D tNext;
uniform vec2 uResolution;
uniform vec2 uCurrentSize;
uniform vec2 uNextSize;
uniform float uProgress;
uniform float uIntensity;
uniform float uScale;
uniform float uAberration;
uniform float uDrift;
uniform float uTime;
uniform vec3 uOverlay;

varying vec2 vUv;

const float PI = 3.14159265359;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec2 coverUV(vec2 uv, vec2 res, vec2 img) {
  float rA = res.x / max(res.y, 1.0);
  float iA = img.x / max(img.y, 1.0);
  vec2 s = vec2(1.0);
  float ratio = rA / max(iA, 0.0001);
  if (ratio > 1.0) {
    s.y = 1.0 / ratio;
  } else {
    s.x = ratio;
  }
  return (uv - 0.5) * s + 0.5;
}

void main() {
  float p = clamp(uProgress, 0.0, 1.0);
  float env = sin(p * PI);

  vec2 uv = vUv;

  uv += vec2(sin(uTime * 0.25 + uv.y * 4.0), cos(uTime * 0.22 + uv.x * 4.0)) * uDrift * 0.008;
  uv = (uv - 0.5) * (1.0 - uDrift * 0.02 * sin(uTime * 0.4)) + 0.5;

  float nn = fbm(uv * uScale + uTime * 0.03);
  float warp = fbm(uv * uScale * 1.7 - uTime * 0.02);
  vec2 g = vec2(nn, warp) - 0.5;
  vec2 uvC = uv + g * uIntensity * 0.5 * p;
  vec2 uvN = uv - g * uIntensity * 0.5 * (1.0 - p);
  float m = smoothstep(nn - 0.15, nn + 0.15, p);

  vec2 sC = coverUV(uvC, uResolution, uCurrentSize);
  vec2 sN = coverUV(uvN, uResolution, uNextSize);

  float ca = uAberration * env * 0.03;

  vec3 colC = vec3(
    texture2D(tCurrent, sC + vec2(ca, 0.0)).r,
    texture2D(tCurrent, sC).g,
    texture2D(tCurrent, sC - vec2(ca, 0.0)).b
  );
  vec3 colN = vec3(
    texture2D(tNext, sN + vec2(ca, 0.0)).r,
    texture2D(tNext, sN).g,
    texture2D(tNext, sN - vec2(ca, 0.0)).b
  );

  vec3 col = mix(colC, colN, m);

  float vig = smoothstep(1.25, 0.25, length(uv - 0.5));
  col = mix(col, uOverlay, (1.0 - vig) * 0.28);

  gl_FragColor = vec4(col, 1.0);
}
`;

export interface PreviewMorphHandle {
  // 지금 화면(fromEl)에서 toImageSrc로 모프를 태운다.
  // 태울 수 없으면 false를 돌려준다. 부르는 쪽은 false를 받으면
  // 기존 gsap 교체로 떨어진다.
  morph(fromEl: HTMLVideoElement | HTMLImageElement | null, toImageSrc: string): boolean;
}

export interface PreviewMorphProps {
  // 캔버스가 덮을 상자의 크기를 부모가 정한다. 캔버스는 absolute inset-0이다.
  className?: string;
}

// 도착 이미지가 아직 안 왔을 때 tNext에 물릴 4x4 판. mothSlider의
// makeFallbackTexture와 같은 색이다. 배경이 순검정이라 눈에 안 띈다
function makeFallbackTexture(): THREE.DataTexture {
  const size = 4;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = 24;
    data[i * 4 + 1] = 24;
    data[i * 4 + 2] = 28;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.needsUpdate = true;
  return tex;
}

interface Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  geometry: THREE.PlaneGeometry;
  material: THREE.ShaderMaterial;
  fallback: THREE.DataTexture;
  // 직전 화면을 굳히는 오프스크린 2D 캔버스. 매 전환마다 다시 그린다
  freeze: HTMLCanvasElement;
  freezeCtx: CanvasRenderingContext2D;
  freezeTexture: THREE.CanvasTexture;
  // 도착 이미지를 담는 자리. 전환마다 image만 갈아 끼우고 텍스처 객체는 하나다
  nextTexture: THREE.Texture;
}

const PreviewMorph = forwardRef<PreviewMorphHandle, PreviewMorphProps>(function PreviewMorph(
  { className },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  // 이미 받아 둔 도착 이미지. 같은 프로젝트를 다시 훑으면 첫 프레임부터 물린다
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  // 지금 전환이 향하는 도착지. 늦게 온 이미지가 자기 차례인지 이걸로 판정한다
  const destSrcRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // three 0.185의 WebGLRenderer는 webgl2만 시도한다. 컨텍스트가 없는
    // 브라우저(샌드박스, GPU 비활성 등)에서 그 생성자를 그대로 부르면 three가
    // 실패 원인을 가리려고 getContext를 두 번 부르며 console.error를 두 줄
    // 찍고, 생성자가 던진 에러를 Next dev 오버레이가 한 줄 더 찍는다. 렌더러를
    // 만들기 전에 컨텍스트를 얻을 수 있는지 직접 물어 그 세 줄을 막는다.
    // 탐침이 성공하면 컨텍스트를 하나 실제로 만든 것이므로 크롬의 탭당
    // 컨텍스트 한도를 넘기지 않도록 즉시 반납한다.
    let canCreateWebGL2 = false;
    try {
      const probeCanvas = document.createElement('canvas');
      const probeGl = probeCanvas.getContext('webgl2');
      if (probeGl) {
        canCreateWebGL2 = true;
        probeGl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch {
      canCreateWebGL2 = false;
    }
    if (!canCreateWebGL2) return;

    // 탐침을 통과하고도 컨텍스트 한도 같은 이유로 생성이 실패하는 경로가 남아
    // 있으므로 아래 try/catch는 그대로 둔다
    let engine: Engine;
    try {
      const freeze = document.createElement('canvas');
      const freezeCtx = freeze.getContext('2d');
      if (!freezeCtx) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));

      const fallback = makeFallbackTexture();
      const freezeTexture = new THREE.CanvasTexture(freeze);
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          tCurrent: { value: freezeTexture },
          tNext: { value: fallback },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uCurrentSize: { value: new THREE.Vector2(1, 1) },
          uNextSize: { value: new THREE.Vector2(1, 1) },
          uProgress: { value: 0 },
          uIntensity: { value: INTENSITY },
          uScale: { value: NOISE_SCALE },
          uAberration: { value: ABERRATION },
          uDrift: { value: DRIFT },
          uTime: { value: 0 },
          uOverlay: { value: new THREE.Vector3(...OVERLAY_RGB) },
        },
      });
      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      // gl_Position을 정점 셰이더가 직접 쓰므로 카메라 절두체와 무관하다.
      // 컬링에 걸려 통째로 안 그려지는 것만 막으면 된다
      mesh.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(mesh);

      engine = {
        renderer,
        scene,
        camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
        geometry,
        material,
        fallback,
        freeze,
        freezeCtx,
        freezeTexture,
        nextTexture: new THREE.Texture(),
      };
    } catch {
      return;
    }

    registerGsap();
    engineRef.current = engine;

    return () => {
      tweenRef.current?.kill();
      tweenRef.current = null;
      engineRef.current = null;
      engine.nextTexture.dispose();
      engine.freezeTexture.dispose();
      engine.fallback.dispose();
      engine.material.dispose();
      engine.geometry.dispose();
      engine.renderer.dispose();
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      morph(fromEl, toImageSrc) {
        const engine = engineRef.current;
        const canvas = canvasRef.current;
        if (!engine || !canvas || !fromEl) return false;

        // 출발 프레임의 원본 크기. 비디오가 아직 첫 프레임도 못 그렸으면 0이고,
        // 그때는 굳힐 화면이 없으니 폴백으로 떨어진다
        const sw = 'videoWidth' in fromEl ? fromEl.videoWidth : fromEl.naturalWidth;
        const sh = 'videoHeight' in fromEl ? fromEl.videoHeight : fromEl.naturalHeight;
        if (!sw || !sh) return false;

        const box = canvas.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) return false;

        // 우리 미디어는 전부 같은 출처라 캔버스가 오염되지 않지만, 디코드 전에
        // 부르면 drawImage가 던지는 경로가 남아 있다
        try {
          engine.freeze.width = sw;
          engine.freeze.height = sh;
          engine.freezeCtx.drawImage(fromEl, 0, 0, sw, sh);
        } catch {
          return false;
        }
        engine.freezeTexture.needsUpdate = true;

        const u = engine.material.uniforms;
        u.tCurrent.value = engine.freezeTexture;
        u.uCurrentSize.value.set(sw, sh);

        // 도착 이미지. 캐시에 있으면 첫 프레임부터 물리고, 없으면 어두운 판으로
        // 시작해 도착하는 대로 갈아 끼운다. 이 이미지는 지금 <video>의 poster로도
        // 쓰이는 파일이라 대개 곧바로 온다
        destSrcRef.current = toImageSrc;
        const cached = imageCacheRef.current.get(toImageSrc);
        if (cached) {
          engine.nextTexture.image = cached;
          engine.nextTexture.needsUpdate = true;
          u.tNext.value = engine.nextTexture;
          u.uNextSize.value.set(cached.naturalWidth, cached.naturalHeight);
        } else {
          u.tNext.value = engine.fallback;
          u.uNextSize.value.set(1, 1);
          const img = new Image();
          img.onload = () => {
            if (!img.naturalWidth) return;
            imageCacheRef.current.set(toImageSrc, img);
            // 그 사이 다음 전환이 시작됐으면 이 이미지는 이미 늦었다. 캐시에는
            // 넣되(다음 번엔 첫 프레임부터 쓴다) 남의 도착지에 물리지는 않는다.
            // 두 전환이 겹치면 둘 다 tNext가 fallback이라 그것만으론 못 가른다
            if (engineRef.current !== engine || destSrcRef.current !== toImageSrc) return;
            engine.nextTexture.image = img;
            engine.nextTexture.needsUpdate = true;
            u.tNext.value = engine.nextTexture;
            u.uNextSize.value.set(img.naturalWidth, img.naturalHeight);
          };
          img.src = toImageSrc;
        }

        engine.renderer.setSize(box.width, box.height, false);
        u.uResolution.value.set(canvas.width, canvas.height);

        // 이름을 빠르게 훑으면 전환이 겹친다. 이전 tween을 죽이고 처음부터 새로
        // 태운다 - 출발 텍스처는 직전 모프가 그리던 화면이 아니라 방금 굳힌
        // fromEl 한 장이다
        tweenRef.current?.kill();
        tweenRef.current = gsap.fromTo(
          u.uProgress,
          { value: 0 },
          {
            value: 1,
            duration: DURATION_S,
            ease: SITE_EASE,
            onUpdate: () => {
              u.uTime.value = performance.now() * 0.001;
              engine.renderer.render(engine.scene, engine.camera);
            },
            onComplete: () => {
              tweenRef.current = null;
              canvas.style.opacity = '0';
            },
          }
        );
        // fromTo의 immediateRender가 위에서 p=0을 이미 한 장 그렸다. 그 뒤에
        // 캔버스를 켜야 직전 전환이 남긴 화면이나 빈 캔버스가 안 비친다
        canvas.style.opacity = '1';
        return true;
      },
    }),
    []
  );

  return (
    <canvas
      ref={canvasRef}
      data-part="preview-morph"
      aria-hidden="true"
      className={className}
      style={{ opacity: 0 }}
    />
  );
});

export default PreviewMorph;
