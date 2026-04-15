'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

type LineType = 'command' | 'output' | 'blank';

interface TerminalLine {
  type: LineType;
  text: string;
  delay: number;
}

const BOOT_SEQUENCE: TerminalLine[] = [
  { type: 'command', text: 'whoami',              delay: 500 },
  { type: 'output',  text: 'kimtaein — Frontend Developer', delay: 100 },
  { type: 'blank',   text: '',                    delay: 260 },
  { type: 'command', text: 'cat profile.json',    delay: 180 },
  { type: 'output',  text: '{',                   delay: 80 },
  { type: 'output',  text: '  "name": "김태인",',  delay: 55 },
  { type: 'output',  text: '  "role": "Frontend Engineer",', delay: 55 },
  { type: 'output',  text: '  "focus": ["UX", "Performance", "DX"],', delay: 55 },
  { type: 'output',  text: '  "stack": ["React", "Next.js", "TypeScript"]', delay: 55 },
  { type: 'output',  text: '}',                   delay: 55 },
  { type: 'blank',   text: '',                    delay: 240 },
  { type: 'command', text: 'npm run portfolio',   delay: 180 },
  { type: 'output',  text: '> portfolio@2025.04 start', delay: 70 },
  { type: 'output',  text: '> Building interface...', delay: 110 },
  { type: 'output',  text: '✓ Components compiled  (0.8s)', delay: 230 },
  { type: 'output',  text: '✓ Animations ready     (0.2s)', delay: 190 },
  { type: 'output',  text: '✓ Portfolio is live  →  https://kimtaein.vercel.app/', delay: 200 },
];

const NPM_RUN_IDX = 11;
const TYPING_SPEED = 36;

// CLI 고정 높이 — 전체 시퀀스가 들어가도록 여기서 조정
const CLI_HEIGHT = 450;

interface DisplayLine {
  id: number;
  type: LineType;
  text: string;
  done: boolean;
}

interface HeroSectionProps {
  onUnlock?: () => void;
  burstPhase?: 'idle' | 'burst' | 'done';
}

// 번개 제거 → 부드러운 곡선 플레어 (베지어 기반)
// border 4면에서 시작해 바깥으로 뻗어나가다 사라짐
interface FlareCanvasProps {
  termRect: DOMRect | null;
  active: boolean;
}

// 플레어 정의: bend로 곡선 레일 휘어짐 결정 (양수=한 방향, 음수=반대 방향)
const FLARE_DEFS = [
  // 상단 변
  { px: 0.15, py: 0, angle: -1.65, len: 900,  w: 3.0, d: 0,   bend:  250 },
  { px: 0.35, py: 0, angle: -1.45, len: 950,  w: 4.0, d: 80,  bend: -300 },
  { px: 0.55, py: 0, angle: -1.57, len: 1100, w: 4.5, d: 20,  bend:  180 },
  { px: 0.75, py: 0, angle: -1.70, len: 900,  w: 3.5, d: 110, bend: -250 },
  { px: 0.90, py: 0, angle: -1.48, len: 800,  w: 2.8, d: 55,  bend:  200 },
  // 우측 변
  { px: 1, py: 0.20, angle: -0.25, len: 900,  w: 3.0, d: 40,  bend: -220 },
  { px: 1, py: 0.50, angle:  0.10, len: 1000, w: 4.2, d: 90,  bend:  280 },
  { px: 1, py: 0.75, angle: -0.05, len: 950,  w: 3.8, d: 15,  bend: -150 },
  // 하단 변
  { px: 0.85, py: 1, angle:  1.48, len: 850,  w: 3.0, d: 50,  bend: -200 },
  { px: 0.60, py: 1, angle:  1.70, len: 950,  w: 3.8, d: 100, bend:  300 },
  { px: 0.40, py: 1, angle:  1.57, len: 1100, w: 4.5, d: 10,  bend: -250 },
  { px: 0.20, py: 1, angle:  1.45, len: 900,  w: 3.5, d: 85,  bend:  200 },
  // 좌측 변
  { px: 0, py: 0.20, angle:  3.40, len: 850,  w: 3.0, d: 60,  bend:  220 },
  { px: 0, py: 0.50, angle:  3.05, len: 1000, w: 4.0, d: 25,  bend: -280 },
  { px: 0, py: 0.75, angle:  3.20, len: 950,  w: 3.8, d: 95,  bend:  150 },
  // 코너 대각선 (가장 크고 길게 뻗어나가는 메인 플레어)
  { px: 0.05, py: 0.05, angle: -2.35, len: 1300, w: 5.5, d: 0,  bend:  400 },
  { px: 0.95, py: 0.05, angle: -0.79, len: 1200, w: 5.0, d: 30, bend: -350 },
  { px: 0.95, py: 0.95, angle:  0.79, len: 1250, w: 5.0, d: 15, bend:  380 },
  { px: 0.05, py: 0.95, angle:  2.35, len: 1200, w: 4.8, d: 50, bend: -350 },
];

function FlareCanvas({ termRect, active }: FlareCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const startRef  = useRef<number>(0);

  useEffect(() => {
    if (!active || !termRect || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const tx = termRect.left;
    const ty = termRect.top;
    const tw = termRect.width;
    const th = termRect.height;

    const FLARE_DUR = 9000;
    startRef.current = performance.now();

    const easeOutExp = (t: number) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const easeInQuad = (t: number) => t * t;

    const getPoint = (t: number, ox: number, oy: number, cpx: number, cpy: number, ex: number, ey: number) => {
      const inv = 1 - t;
      return {
        x: inv * inv * ox + 2 * inv * t * cpx + t * t * ex,
        y: inv * inv * oy + 2 * inv * t * cpy + t * t * ey,
      };
    };

    // 시각적 fadeout 전용 duration — FLARE_DUR과 독립. 발산 직후 이 시간 안에 완전히 사라짐
    const FADE_DUR = 3000;

    const drawBlobTrail = (
      tail: number, head: number,
      fadeT: number,   // 0~1, 절대 시간 기준 fadeout 진행률
      ox: number, oy: number, cpx: number, cpy: number, ex: number, ey: number,
      blobR: number, peakAlpha: number,
      r: number, g: number, b: number,
    ) => {
      const span = head - tail;
      if (span <= 0) return;

      const COUNT = Math.max(10, Math.round(span * 80));
      for (let i = 0; i <= COUNT; i++) {
        const t = tail + span * (i / COUNT);
        const pt = getPoint(t, ox, oy, cpx, cpy, ex, ey);

        // border 쪽(t가 작을수록)부터 점차 fadeout — fadeT가 진행될수록 전선이 밀려남
        const fadeStart = Math.max(0, (fadeT - 0.15) * 1.3);
        const localAlpha = Math.min(1, Math.max(0, (t - fadeStart) / 0.3));

        // 절대 시간 기준 전체 기화: FADE_DUR 이내에 완전히 사라짐
        const globalFade = 1 - Math.pow(fadeT, 2);

        const a = peakAlpha * localAlpha * globalFade;
        if (a <= 0.001) continue;

        const rad = blobR * (1 + t * 0.5);
        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
        grad.addColorStop(0, `rgba(${r},${g},${b},${a.toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    };

    const draw = (now: number) => {
      const elapsed = now - startRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';

      // 절대 시간 기준 fadeout 진행률 — FLARE_DUR과 독립
      const fadeT = Math.min(elapsed / FADE_DUR, 1);

      // 시각적으로 완전히 사라진 후 루프 종료
      if (fadeT >= 1) return;

      let anyActive = false;

      FLARE_DEFS.forEach((def) => {
        const fe = elapsed - def.d;
        if (fe < 0) { anyActive = true; return; }

        const fp = Math.min(fe / FLARE_DUR, 1);
        if (fp >= 1) return;
        anyActive = true;

        const ox = tx + def.px * tw;
        const oy = ty + def.py * th;
        const ex = ox + Math.cos(def.angle) * def.len;
        const ey = oy + Math.sin(def.angle) * def.len;

        const perpAngle = def.angle + Math.PI / 2;
        const cpx = (ox + ex) / 2 + Math.cos(perpAngle) * def.bend;
        const cpy = (oy + ey) / 2 + Math.sin(perpAngle) * def.bend;

        // 머리: 빠르게 목표 도달 / 꼬리: 천천히 밀어냄 (FLARE_DUR 기반 위치 계산)
        const headP = Math.min(fp / 0.3, 1);
        const tailP = Math.min(Math.max(0, (fp - 0.1) / 0.9), 1);

        const head = easeOutExp(headP);
        const tail = easeInQuad(tailP);

        // 1레이어: 넓은 외곽 아우라
        drawBlobTrail(tail, head, fadeT, ox, oy, cpx, cpy, ex, ey,
          def.w * 12, 0.05, 49, 130, 246);

        // 2레이어: 중간 에너지 구름
        drawBlobTrail(tail, head, fadeT, ox, oy, cpx, cpy, ex, ey,
          def.w * 5,  0.15, 100, 168, 255);

        // 3레이어: 코어 흰 잔상
        drawBlobTrail(tail, head, fadeT, ox, oy, cpx, cpy, ex, ey,
          def.w * 1.5, 0.40, 220, 240, 255);
      });

      if (anyActive) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, termRect]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    />
  );
}

// 충전 입자 — border 주변 수렴. 크기 축소, 끊김 없이 연속 이동
const CHARGE_PARTICLES = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  side: i % 4 as 0 | 1 | 2 | 3,
  pos: (i * 0.118 + 0.03) % 1,
  startDist: 25 + (i * 17) % 70,   // 25~95px 밖
  size: 4 + (i * 5) % 3,           // 2~4px (소형)
  delay: (i * 0.13) % 1.6,
  duration: 1.0 + (i * 0.08) % 0.8,
  bright: 0.7 + (i % 4) * 0.075,
}));

// ===== 임팩트 링 Canvas =====
// 발산 직전 "완료" 강렬한 순간 효과: 터미널 중심에서 동심원 링이 팽창 후 소멸
interface ImpactCanvasProps {
  termRect: DOMRect | null;
  active: boolean;
}

function ImpactCanvas({ termRect, active }: ImpactCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const startRef  = useRef<number>(0);

  useEffect(() => {
    if (!active || !termRect || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    // 터미널 중심 좌표
    const cx = termRect.left + termRect.width  / 2;
    const cy = termRect.top  + termRect.height / 2;

    // 각 링: delay(ms), 최대반경, 선두께, 색상rgb
    const RINGS = [
      { d: 0,   maxR: Math.max(termRect.width, termRect.height) * 0.65, lw: 2.5, rgb: '190,225,255' },
      { d: 60,  maxR: Math.max(termRect.width, termRect.height) * 1.1,  lw: 1.8, rgb: '100,168,255' },
      { d: 130, maxR: Math.max(termRect.width, termRect.height) * 1.7,  lw: 1.2, rgb: '49,130,246'  },
      { d: 210, maxR: Math.max(termRect.width, termRect.height) * 2.4,  lw: 0.8, rgb: '80,140,240'  },
    ];

    // 중심 flare burst: 순간적으로 밝아졌다 사라지는 원형 광구
    const BURST_DUR  = 180;   // 광구 지속 ms
    const RING_DUR   = 700;   // 링 하나의 팽창~소멸 ms

    startRef.current = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const draw = (now: number) => {
      const elapsed = now - startRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';

      let anyActive = false;

      // 중심 광구 — 순간 백색 폭발
      if (elapsed < BURST_DUR) {
        anyActive = true;
        const bt = elapsed / BURST_DUR;
        // 빠르게 확장 후 fade
        const burstR = Math.max(1, termRect.width * 0.18 * easeOutCubic(bt));
        const burstA = (1 - bt) * (1 - bt) * 0.85;

        const g0 = ctx.createRadialGradient(cx, cy, 0, cx, cy, burstR);
        g0.addColorStop(0,   `rgba(255,255,255,${burstA.toFixed(3)})`);
        g0.addColorStop(0.3, `rgba(200,230,255,${(burstA * 0.7).toFixed(3)})`);
        g0.addColorStop(0.7, `rgba(49,130,246,${(burstA * 0.3).toFixed(3)})`);
        g0.addColorStop(1,   'rgba(49,130,246,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, burstR, 0, Math.PI * 2);
        ctx.fillStyle = g0;
        ctx.fill();
      }

      // 동심원 링
      RINGS.forEach((ring) => {
        const re = elapsed - ring.d;
        if (re < 0) { anyActive = true; return; }

        const rp = re / RING_DUR;
        if (rp >= 1) return;
        anyActive = true;

        const r = Math.max(1, ring.maxR * easeOutCubic(rp));

        // 링은 팽창하며 빠르게 fade — 앞 절반에서 밝고 뒤 절반에서 소멸
        const alpha = rp < 0.4
          ? (rp / 0.4) * 0.9          // 등장
          : (1 - (rp - 0.4) / 0.6) * 0.9; // 소멸

        // 링 본체
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth   = ring.lw;
        ctx.strokeStyle = `rgba(${ring.rgb},${alpha.toFixed(3)})`;
        ctx.globalCompositeOperation = 'lighter';
        ctx.stroke();

        // 링 외곽 아우라 (넓고 흐릿한 glow)
        const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15);
        glowGrad.addColorStop(0,   `rgba(${ring.rgb},0)`);
        glowGrad.addColorStop(0.5, `rgba(${ring.rgb},${(alpha * 0.18).toFixed(3)})`);
        glowGrad.addColorStop(1,   `rgba(${ring.rgb},0)`);
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.0, 0, Math.PI * 2);
        ctx.lineWidth   = r * 0.25;
        ctx.strokeStyle = glowGrad;
        ctx.stroke();
      });

      if (anyActive) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, termRect]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 6 }}
    />
  );
}

export default function HeroSection({ onUnlock, burstPhase = 'idle' }: HeroSectionProps) {
  const [lines, setLines] = useState<DisplayLine[]>([]);
  const [sequenceIdx, setSequenceIdx] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [termRect, setTermRect] = useState<DOMRect | null>(null);
  const [impactActive, setImpactActive] = useState(false);
  const [flashActive, setFlashActive]   = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const hasUnlockedRef = useRef(false);
  const terminalBorderControls = useAnimation();

  // 충전 단계: border glow 12단계 세분화 + 일렁임
  const chargeStyle = useMemo(() => {
    const t = chargeLevel;
    if (t <= 0) return { boxShadow: '0 0 0 1px rgba(100,168,255,0.12)' };

    const step = Math.floor(t * 12) / 12;
    const blur1 = 4  + step * 28;
    const blur2 = 10 + step * 54;
    const blur3 = 20 + step * 100;
    const blur4 = 40 + step * 160;
    const a1 = 0.15 + step * 0.70;
    const a2 = 0.08 + step * 0.52;
    const a3 = 0.04 + step * 0.30;
    const a4 = 0.02 + step * 0.14;
    const borderA = 0.10 + step * 0.72;
    const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.12 * step;

    return {
      boxShadow: [
        `0 0 0 1px rgba(140,200,255,${Math.min(borderA * pulse, 1).toFixed(2)})`,
        `0 0 ${Math.round(blur1 * pulse)}px rgba(49,130,246,${Math.min(a1 * pulse, 1).toFixed(2)})`,
        `0 0 ${Math.round(blur2 * pulse)}px rgba(80,160,255,${Math.min(a2 * pulse, 1).toFixed(2)})`,
        `0 0 ${Math.round(blur3 * pulse)}px rgba(100,168,255,${Math.min(a3 * pulse, 1).toFixed(2)})`,
        `0 0 ${Math.round(blur4 * pulse)}px rgba(147,197,253,${Math.min(a4 * pulse, 1).toFixed(2)})`,
      ].join(', '),
    };
  }, [chargeLevel]);

  // glow 일렁임 재렌더 트리거
  useEffect(() => {
    if (chargeLevel <= 0 || isComplete) return;
    const id = setInterval(() => setChargeLevel(p => p), 80);
    return () => clearInterval(id);
  }, [chargeLevel, isComplete]);

  const triggerUnlock = useCallback(async () => {
    if (hasUnlockedRef.current) return;
    hasUnlockedRef.current = true;

    if (terminalRef.current) {
      setTermRect(terminalRef.current.getBoundingClientRect());
    }

    setChargeLevel(1);

    // 에너지 최고조 수렴
    await terminalBorderControls.start({
      boxShadow: [
        '0 0 0 1px rgba(140,200,255,0.82), 0 0 30px rgba(49,130,246,0.80), 0 0 64px rgba(80,160,255,0.52), 0 0 120px rgba(100,168,255,0.30), 0 0 200px rgba(147,197,253,0.14)',
        '0 0 0 1px rgba(160,215,255,0.92), 0 0 44px rgba(49,130,246,0.92), 0 0 88px rgba(80,160,255,0.68), 0 0 160px rgba(100,168,255,0.42), 0 0 250px rgba(147,197,253,0.20)',
        '0 0 0 1px rgba(190,230,255,1.00), 0 0 58px rgba(49,130,246,1.00), 0 0 112px rgba(80,160,255,0.85), 0 0 200px rgba(100,168,255,0.55), 0 0 300px rgba(147,197,253,0.26)',
      ],
      transition: { duration: 1.2, ease: [0.4, 0, 0.6, 1] },
    });

    // 임팩트 효과 — 동심원 링 + 화면 플래시
    setImpactActive(true);
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 120);

    // 발산 순간 border 빠르게 소멸
    terminalBorderControls.start({
      boxShadow: [
        '0 0 0 1px rgba(190,230,255,1.00), 0 0 58px rgba(49,130,246,1.00), 0 0 112px rgba(80,160,255,0.85), 0 0 200px rgba(100,168,255,0.55), 0 0 300px rgba(147,197,253,0.26)',
        '0 0 0 1px rgba(100,168,255,0.12)',
      ],
      transition: {
        duration: 0.4,
        ease: [0.6, 0, 0.8, 0],  // 초반에 빠르게 소멸
      },
    });

    setIsComplete(true);
    onUnlock?.();
  }, [onUnlock, terminalBorderControls]);

  useEffect(() => {
    if (sequenceIdx >= BOOT_SEQUENCE.length) {
      triggerUnlock();
      return;
    }

    const seq = BOOT_SEQUENCE[sequenceIdx];

    if (sequenceIdx === NPM_RUN_IDX) setIsBuilding(false);
    if (sequenceIdx === NPM_RUN_IDX + 1) setIsBuilding(true);

    if (sequenceIdx <= NPM_RUN_IDX) {
      setChargeLevel(sequenceIdx / NPM_RUN_IDX);
    }

    const delayTimer = setTimeout(() => {
      if (seq.type === 'command') {
        const lineId = ++idRef.current;
        setLines(prev => [...prev, { id: lineId, type: 'command', text: '', done: false }]);
        let charIdx = 0;
        const typeNext = () => {
          charIdx++;
          setLines(prev => prev.map(l => l.id === lineId ? { ...l, text: seq.text.slice(0, charIdx) } : l));
          if (charIdx < seq.text.length) {
            setTimeout(typeNext, TYPING_SPEED);
          } else {
            setLines(prev => prev.map(l => l.id === lineId ? { ...l, done: true } : l));
            setTimeout(() => setSequenceIdx(i => i + 1), 150);
          }
        };
        setTimeout(typeNext, TYPING_SPEED);
      } else if (seq.type === 'blank') {
        setLines(prev => [...prev, { id: ++idRef.current, type: 'blank', text: '', done: true }]);
        setSequenceIdx(i => i + 1);
      } else {
        setLines(prev => [...prev, { id: ++idRef.current, type: 'output', text: seq.text, done: true }]);
        setSequenceIdx(i => i + 1);
      }
    }, seq.delay);

    return () => clearTimeout(delayTimer);
  }, [sequenceIdx, triggerUnlock]);

  const isBursting = burstPhase === 'burst';

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      role="banner"
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(150deg, #eef4ff 0%, #f8faff 55%, #edf3ff 100%)' }}
    >
      {/* dot grid 배경 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #b8ccee 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.45,
        }}
      />
      <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(49,130,246,0.08) 0%, transparent 65%)' }} />
      <div className="absolute -bottom-40 -right-40 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(100,168,255,0.05) 0%, transparent 65%)' }} />

      {/* 태양 플레어 Canvas — z-5, 터미널(z-15) 아래 */}
      <FlareCanvas termRect={termRect} active={isBursting} />

      {/* 임팩트 동심원 링 Canvas — z-6 */}
      <ImpactCanvas termRect={termRect} active={impactActive} />

      {/* 발산 순간 화면 플래시 오버레이 */}
      <AnimatePresence>
        {flashActive && (
          <motion.div
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 50, background: 'radial-gradient(ellipse 70% 55% at 50% 48%, rgba(210,235,255,0.72) 0%, rgba(180,220,255,0.38) 40%, transparent 75%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.07, exit: { duration: 0.18 } } as never}
          />
        )}
      </AnimatePresence>

      {/* 충전 입자 — 터미널 바깥에서 border로 수렴, 터미널 내부 침범 없음 */}
      <AnimatePresence>
        {chargeLevel > 0 && !isComplete && (
          // clip 범위: 터미널 창 바깥까지만. overflow-hidden으로 터미널 내부 침범 방지
          <div className="absolute inset-0 pointer-events-none z-20" style={{ overflow: 'hidden' }}>
            {CHARGE_PARTICLES.map((p) => {
              if (p.id / CHARGE_PARTICLES.length > chargeLevel + 0.12) return null;

              // 터미널 창 좌표 (viewport 비율)
              const termL = 0.5 - 0.25;
              const termR = 0.5 + 0.25;
              const termT = 0.28;
              const termB = 0.68;

              let startX: number, startY: number, endX: number, endY: number;
              const distFrac = p.startDist / 100;

              switch (p.side) {
                case 0: // top
                  endX = termL + p.pos * (termR - termL);
                  endY = termT;
                  startX = endX + (p.id % 3 - 1) * 0.08;
                  startY = endY - distFrac;
                  break;
                case 1: // right
                  endX = termR;
                  endY = termT + p.pos * (termB - termT);
                  startX = endX + distFrac;
                  startY = endY + (p.id % 3 - 1) * 0.06;
                  break;
                case 2: // bottom
                  endX = termL + p.pos * (termR - termL);
                  endY = termB;
                  startX = endX + (p.id % 3 - 1) * 0.08;
                  startY = endY + distFrac;
                  break;
                default: // left
                  endX = termL;
                  endY = termT + p.pos * (termB - termT);
                  startX = endX - distFrac;
                  startY = endY + (p.id % 3 - 1) * 0.06;
                  break;
              }

              const glowR = p.size * 2.5;

              return (
                <motion.div
                  key={p.id}
                  className="absolute rounded-full"
                  style={{
                    width: p.size,
                    height: p.size,
                    background: `radial-gradient(circle, rgba(255,255,255,${p.bright}) 0%, rgba(150,210,255,${p.bright * 0.85}) 40%, rgba(49,130,246,${p.bright * 0.6}) 80%, transparent 100%)`,
                    boxShadow: `0 0 ${glowR}px ${glowR * 0.5}px rgba(100,180,255,0.55)`,
                    left: `${startX * 100}%`,
                    top:  `${startY * 100}%`,
                  }}
                  animate={{
                    // 끊김 없이 startX/Y → endX/Y로 직선 이동
                    left: [`${startX * 100}%`, `${endX * 100}%`],
                    top:  [`${startY * 100}%`, `${endY * 100}%`],
                    opacity: [0, 0.9, 0],
                    scale: [0.4, 1.0, 0.3],
                  }}
                  transition={{
                    duration: p.duration,
                    delay: p.delay,
                    ease: 'easeIn',       // border에 가까워질수록 가속
                    repeat: Infinity,
                    repeatDelay: 0.1,    // 거의 연속 — 끊김 없음
                    times: [0, 0.75, 1],
                  }}
                />
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* 메인 컨테이너 */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 flex flex-col items-center">

        <div className="mb-6 h-5" aria-hidden="true" />

        {/* 터미널 윈도우 — z-15 */}
        <motion.div
          ref={terminalRef}
          animate={terminalBorderControls}
          className="w-full rounded-2xl overflow-hidden relative z-[15]"
          style={{
            background: 'rgba(14,19,32,0.97)',
            border: '1px solid rgba(100,168,255,0.15)',
            ...chargeStyle,
          }}
          initial={{ opacity: 0, y: 26, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3 border-b"
            style={{ background: 'rgba(20,26,42,0.98)', borderColor: 'rgba(255,255,255,0.05)' }}
          >
            <div className="w-3 h-3 rounded-full bg-red-500/75" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/75" />
            <div className="w-3 h-3 rounded-full bg-green-500/75" />
            <span className="ml-3 text-[11px] text-slate-500 font-mono tracking-wide select-none">
              kimtaein ~ zsh
            </span>
          </div>

          {/* CLI 고정 높이 + building overlay 래퍼 */}
          <div className="relative">
          {/* building progress 오버레이 — CLI 전체를 덮음 */}
          <AnimatePresence>
            {isBuilding && !isComplete && (
              <motion.div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-b-2xl"
                style={{
                  background: 'rgba(14,19,32,0.38)',
                  backdropFilter: 'blur(3px)',
                  WebkitBackdropFilter: 'blur(3px)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <span className="text-[11px] text-blue-300 font-mono tracking-[0.18em] uppercase select-none">
                  Building...
                </span>
                <div className="w-48 sm:w-64 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #3182f6, #64a8ff, #90c2ff)' }}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2.2, ease: 'easeInOut' }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-5 sm:p-6 font-mono text-[13px] sm:text-sm" style={{ height: CLI_HEIGHT, overflow: 'hidden' }}>
            <AnimatePresence initial={false}>
              {lines.map((line) => (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.12 }}
                  className="leading-[1.75]"
                >
                  {line.type === 'blank' && <div className="h-2" />}
                  {line.type === 'command' && (
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 select-none font-bold flex-shrink-0">❯</span>
                      <span className="text-slate-100">{line.text}</span>
                      {!line.done && (
                        <span
                          className="inline-block w-[7px] h-[14px] bg-blue-400 flex-shrink-0"
                          style={{ animation: 'termBlink 1s step-end infinite' }}
                        />
                      )}
                    </div>
                  )}
                  {line.type === 'output' && (
                    <div className="pl-5 whitespace-pre">
                      <OutputLine text={line.text} />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isComplete && (
              <motion.div
                className="flex items-center gap-2 mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                <span className="text-emerald-400 font-bold">❯</span>
                <span
                  className="inline-block w-[7px] h-[14px] bg-slate-500"
                  style={{ animation: 'termBlink 1s step-end infinite' }}
                />
              </motion.div>
            )}
          </div>
          </div>
        </motion.div>

        <motion.div
          className="mt-10 text-center relative z-[15]"
          initial={{ opacity: 0, y: 18 }}
          animate={isComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: 0.75, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 id="hero-title" className="text-2xl sm:text-3xl md:text-4xl font-bold text-grey-900 mb-3">
            프론트엔드 개발자{' '}
            <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              김태인
            </span>
          </h1>
          <p className="text-sm sm:text-base text-grey-500 leading-relaxed max-w-md mx-auto">
            사용자 경험을 최우선으로 생각하며,<br className="hidden sm:block" />
            코드로 아름다운 인터페이스를 만듭니다.
          </p>
        </motion.div>
      </div>

      <motion.div
        className="mt-10 mb-8 flex flex-col items-center gap-2 relative z-[15]"
        initial={{ opacity: 0 }}
        animate={isComplete ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.85 }}
        aria-hidden="true"
      >
        <span className="text-[10px] text-grey-400 tracking-[0.2em] uppercase font-medium">Scroll</span>
        <div className="w-5 h-8 border-2 border-grey-300 rounded-full flex justify-center pt-1.5">
          <motion.div
            className="w-1 h-2 bg-grey-400 rounded-full"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      <style jsx>{`
        @keyframes termBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </section>
  );
}

function OutputLine({ text }: { text: string }) {
  if (text.startsWith('✓')) {
    return (
      <span>
        <span className="text-emerald-400">✓</span>
        <span className="text-slate-300">{text.slice(1)}</span>
      </span>
    );
  }
  if (text.startsWith('>')) return <span className="text-slate-500">{text}</span>;

  const jsonMatch = text.match(/^(\s*)("[\w]+")(\s*:\s*)(.+?)(,?)$/);
  if (jsonMatch) {
    const [, indent, key, colon, val, comma] = jsonMatch;
    return (
      <span>
        {indent}
        <span className="text-sky-300">{key}</span>
        <span className="text-slate-500">{colon}</span>
        <span className={val.startsWith('"') || val.startsWith('[') ? 'text-amber-300' : 'text-emerald-300'}>{val}</span>
        {comma && <span className="text-slate-500">{comma}</span>}
      </span>
    );
  }
  if (text === '{' || text === '}') return <span className="text-slate-400">{text}</span>;
  return <span className="text-slate-400">{text}</span>;
}
