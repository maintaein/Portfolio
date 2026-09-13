'use client';

// About AI WORKFLOW 문항의 시각 증거. 동심원이 안에서 밖으로 번져 나가며
// 잔상을 남긴다. 말을 걸면 응답이 퍼져 나오는 모양이다.
//
// 시안(.claude/designRefactoring/MagicRings/magicRings.tsx)에서 걷어낸 것:
// prop 22개 전부, 마우스 추적과 호버 확대와 클릭 버스트, 회전, coverage
// 알파 분기. 호출처가 하나이고 그 하나가 장식이라 조절 손잡이가 필요 없다.
// 값은 전부 셰이더 안 const로 굳혔다.
//
// 색은 시안의 마젠타 대신 이 사이트의 시안 두 단계를 쓴다. 배경(Hyperspeed)
// 과 같은 계열이라 묻힐 수 있어서, 색이 아니라 링 개수(8)와 낮은 감쇠가
// 만드는 잔상으로 구별한다.
//
// 이 캔버스는 Hyperspeed에 이은 두 번째 WebGL 컨텍스트다. 그래서 세 겹으로
// 잠근다. (1) 호출처가 next/dynamic으로 갈라 AI WORKFLOW를 처음 고를
// 때까지 이 모듈을 아예 내려받지 않는다. (2) running이 false면 rAF를
// 멈춘다. (3) 탭이 뒤로 가면 멈춘다.
//
// 교차 관찰은 쓰지 않는다. 감춰진 섹션도 교차한다고 보고하므로(불투명도와
// visibility를 보지 않는다) 켜짐을 판정하지 못하고, About은 스크롤되지
// 않는 한 화면짜리 무대라 상자가 뷰포트를 벗어나는 일도 없다. 활성 여부는
// 바깥에서 받는다.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// RING_COUNT와 ATTENUATION이 이 연출의 전부다. 링이 많을수록 층이 깊고,
// 감쇠가 낮을수록 지나간 자리에 빛이 오래 남는다.
const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;

const float HP = 1.5707963;
const float CYCLE = 3.45;

const int RING_COUNT = 8;
const float ATTENUATION = 9.0;
const float LINE_THICKNESS = 2.0;
const float BASE_RADIUS = 0.09;
const float RADIUS_STEP = 0.040;
const float SCALE_RATE = 0.12;
const float RING_GAP = 1.2;
const float FADE_IN = 0.7;
const float FADE_OUT = 0.5;
const float OPACITY = 0.75;
const float NOISE_AMOUNT = 0.06;

const vec3 COLOR_CORE = vec3(0.012, 0.702, 0.765);
const vec3 COLOR_HI = vec3(0.498, 0.890, 0.933);

float fade(float t) {
  return t < FADE_IN ? smoothstep(0.0, FADE_IN, t) : 1.0 - smoothstep(FADE_OUT, CYCLE - 0.2, t);
}

float ring(vec2 p, float ri, float cut, float t0, float px) {
  float t = mod(uTime + t0, CYCLE);
  float r = ri + t / CYCLE * SCALE_RATE;
  float d = abs(length(p) - r);
  float a = atan(abs(p.y), abs(p.x)) / HP;
  float th = max(1.0 - a, 0.5) * px * LINE_THICKNESS;
  float h = (1.0 - smoothstep(th, th * 1.5, d)) + 1.0;
  d += pow(cut * a, 3.0) * r;
  return h * exp(-ATTENUATION * d) * fade(t);
}

void main() {
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) * px;
  vec3 c = vec3(0.0);
  float coverage = 0.0;
  float rcf = float(RING_COUNT) - 1.0;
  for (int i = 0; i < RING_COUNT; i++) {
    float fi = float(i);
    vec3 rc = mix(COLOR_CORE, COLOR_HI, fi / rcf);
    float amount = ring(p, BASE_RADIUS + fi * RADIUS_STEP, pow(RING_GAP, fi), 2.95 * fi, px);
    c = mix(c, rc, vec3(amount));
    coverage = max(coverage, amount);
  }
  // 잡음은 선 위에만 얹는다. 사각형 전체에 더하면 알파가 바닥부터 떠서
  // 캔버스 네 변이 그대로 보인다(시안은 그 사각형을 안고 있었다).
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * NOISE_AMOUNT * coverage;
  float intensity = max(c.r, max(c.g, c.b));
  vec3 emissive = intensity > 0.0001 ? clamp(c / intensity, 0.0, 1.0) : vec3(0.0);
  gl_FragColor = vec4(emissive, clamp(coverage * OPACITY, 0.0, 1.0));
}
`;

// 한 바퀴에 3.45초인 주기를 조금 눕힌다. 배경 광선보다 느려야 둘이 서로
// 다른 층으로 읽힌다.
const TIME_SCALE = 0.75;

export interface AboutRingsProps {
  // About이 활성이고 AI WORKFLOW가 골라져 있을 때만 true. 이 값이 false로
  // 내려가면 rAF가 멎는다. 컨텍스트는 유지한다. 문항을 오갈 때마다
  // 컨텍스트를 만들고 버리면 그쪽이 훨씬 비싸다.
  running: boolean;
}

export default function AboutRings({ running }: AboutRingsProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runningRef = useRef(running);
  // rAF 구동은 effect 바깥에서도 켜고 꺼야 해서 ref에 함수를 담아 둔다.
  const startRef = useRef<(() => void) | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    } catch {
      return;
    }

    // WebGL2가 아니면 셰이더 정밀도를 장담할 수 없다. 조용히 빠진다.
    // 장식이라 대체물을 띄우지 않는다.
    if (!renderer.capabilities.isWebGL2) {
      renderer.dispose();
      return;
    }

    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.z = 1;

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    scene.add(quad);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h);
      uniforms.uResolution.value.set(w * dpr, h * dpr);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let frameId = 0;
    let pageVisible = !document.hidden;
    let elapsed = 0;
    let lastT = 0;

    const animate = (t: number) => {
      frameId = requestAnimationFrame(animate);
      // 첫 프레임의 dt는 0이다. 탭을 오래 비웠다 돌아오면 t가 크게 뛰므로
      // 100ms로 자른다. 안 자르면 링이 순간이동한다.
      const dt = lastT === 0 ? 0 : Math.min(t - lastT, 100);
      lastT = t;
      elapsed += dt * 0.001 * TIME_SCALE;
      uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
    };

    const start = () => {
      if (frameId !== 0) return;
      if (!runningRef.current || !pageVisible) return;
      lastT = 0;
      frameId = requestAnimationFrame(animate);
    };
    const stop = () => {
      if (frameId === 0) return;
      cancelAnimationFrame(frameId);
      frameId = 0;
    };
    startRef.current = start;
    stopRef.current = stop;

    const onVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible) start();
      else stop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // 멈춰 있어도 한 프레임은 그려 둔다. 켜지는 순간 빈 상자가 보이지
    // 않도록.
    renderer.render(scene, camera);
    start();

    return () => {
      stop();
      startRef.current = null;
      stopRef.current = null;
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      mount.removeChild(renderer.domElement);
      quad.geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    runningRef.current = running;
    if (running) startRef.current?.();
    else stopRef.current?.();
  }, [running]);

  return <div ref={mountRef} aria-hidden="true" className="h-full w-full" />;
}
