'use client';

// 임시 계측 라우트 — 계획 3 Task 1 Step 2/3 전용. 측정이 끝나면
// app/spike/와 components/spike/를 통째로 삭제한다.
//
// 하강 사다리를 URL 파라미터로 전환하며 실기기에서 p95 프레임 간격을 잰다.
// 폰에는 콘솔이 없으므로 결과를 화면에 직접 찍는다. 안드로이드 Chrome에서
// 이미 같은 방식으로 About 잼의 원인을 갈라낸 전례가 있다.

import { useEffect, useRef, useState } from 'react';
import HyperspeedSpike from '@/components/spike/HyperspeedSpike';

// 계획 3 Task 1이 정한 예산. 30fps에 해당한다.
const FRAME_BUDGET_MS = 33.3;
const MEASURE_SECONDS = 30;

// 벤더 기본값. fov는 three.js에서 세로 화각이라 세로 화면의 폰에서는 가로
// 화각이 크게 좁아진다 — 같은 도로를 절반 폭으로 보게 된다. 실기기에서 값을
// 골라야 하므로 노브로 뺀다.
const DEFAULT_FOV = 90;
const DEFAULT_FOV_SPEED_UP = 150;

interface Knobs {
  rays: number;
  sticks: number;
  maxDpr: number;
  bloom: boolean;
  bloomScale: number;
  fov: number;
  overlay: boolean;
}

// useSearchParams는 Suspense 경계를 요구해 정적 렌더를 깬다. 임시 페이지에
// 그만한 구조를 세울 이유가 없어 location을 직접 읽는다.
function readKnobs(): Knobs {
  const params = new URLSearchParams(window.location.search);
  const num = (key: string, fallback: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    rays: num('rays', 40),
    sticks: num('sticks', 20),
    maxDpr: num('dpr', 0),
    bloom: params.get('bloom') !== 'off',
    bloomScale: num('bloomScale', 1),
    fov: num('fov', DEFAULT_FOV),
    // 폴백 이미지용 깨끗한 프레임을 캡처하려면 오버레이를 꺼야 한다.
    overlay: params.get('overlay') !== 'off',
  };
}

// 이보다 긴 간격은 프레임 지연이 아니다 — 화면이 꺼졌거나 탭이 백그라운드로
// 간 것이다. 실측에서 66,675ms(66.7초) 간격이 한 번 나와 표본 수와 평균
// fps를 통째로 오염시켰고, 알림 하나가 원인이었다. deviceQuality.ts의
// FrameQualityGovernor에는 이를 위한 resetWindow()가 있는데 이 계측기에는
// 없어서 조용히 잘못된 숫자를 냈다. 감추지 않고 측정을 무효로 표시한다.
const SUSPEND_THRESHOLD_MS = 1000;

interface Result {
  samples: number;
  p50: number;
  p95: number;
  worst: number;
  over: number;
  overRatio: number;
  averageFps: number;
  suspensions: number;
  longestSuspensionMs: number;
}

function summarize(intervals: number[]): Result {
  const sorted = [...intervals].sort((a, b) => a - b);
  // deviceQuality.ts의 FrameQualityGovernor와 같은 nearest-rank 정의를 쓴다.
  // 두 곳의 p95가 다르면 이 측정으로 정한 값이 런타임 판정과 어긋난다.
  const rank = (q: number) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? 0;
  const over = intervals.filter((interval) => interval > FRAME_BUDGET_MS).length;
  const total = intervals.reduce((sum, interval) => sum + interval, 0);

  const suspensions = intervals.filter((interval) => interval > SUSPEND_THRESHOLD_MS);

  return {
    samples: intervals.length,
    p50: rank(0.5),
    p95: rank(0.95),
    worst: sorted[sorted.length - 1] ?? 0,
    over,
    overRatio: intervals.length ? (over / intervals.length) * 100 : 0,
    averageFps: total ? (intervals.length / total) * 1000 : 0,
    suspensions: suspensions.length,
    longestSuspensionMs: suspensions.length ? Math.max(...suspensions) : 0,
  };
}

export default function SpikeClient() {
  const [knobs, setKnobs] = useState<Knobs | null>(null);
  const [remaining, setRemaining] = useState(MEASURE_SECONDS);
  const [result, setResult] = useState<Result | null>(null);
  const [contextLost, setContextLost] = useState(0);
  const intervalsRef = useRef<number[]>([]);

  useEffect(() => {
    setKnobs(readKnobs());
  }, []);

  useEffect(() => {
    if (!knobs) return;

    let frame = 0;
    let previous: number | null = null;
    const startedAt = performance.now();
    intervalsRef.current = [];

    const tick = (now: number) => {
      // 첫 간격은 측정 시작 시점의 인공물이라 버린다.
      if (previous !== null) intervalsRef.current.push(now - previous);
      previous = now;

      const elapsed = (now - startedAt) / 1000;
      setRemaining(Math.max(0, Math.ceil(MEASURE_SECONDS - elapsed)));

      if (elapsed >= MEASURE_SECONDS) {
        setResult(summarize(intervalsRef.current));
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [knobs]);

  // WebGL 컨텍스트 손실은 계획 3 Task 1의 판정 기준 셋 중 하나다(0건이어야 한다).
  useEffect(() => {
    const onLost = () => setContextLost((count) => count + 1);
    document.addEventListener('webglcontextlost', onLost, true);
    return () => document.removeEventListener('webglcontextlost', onLost, true);
  }, []);

  if (!knobs) return null;

  // three.js PerspectiveCamera의 fov는 세로 화각이다. 실제로 프레이밍을
  // 결정하는 가로 화각은 화면 비율에 끌려간다 — 폰 세로 화면에서 도로가
  // 좁게 보이는 원인이라, 재는 사람이 바로 볼 수 있게 함께 찍는다.
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const aspect = viewport.width / viewport.height;
  const horizontalFov =
    (2 * Math.atan(Math.tan((knobs.fov * Math.PI) / 360) * aspect) * 180) / Math.PI;

  const effectOptions = {
    lightPairsPerRoadWay: knobs.rays,
    totalSideLightSticks: knobs.sticks,
    maxDpr: knobs.maxDpr,
    bloomEnabled: knobs.bloom,
    bloomResolutionScale: knobs.bloomScale,
    fov: knobs.fov,
    // 가속 시 화각도 같은 비율로 벌어져야 원본의 연출이 유지된다.
    fovSpeedUp: (knobs.fov / DEFAULT_FOV) * DEFAULT_FOV_SPEED_UP,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <HyperspeedSpike effectOptions={effectOptions} />

      {knobs.overlay ? (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 999999,
          pointerEvents: 'none',
          background: 'rgba(0,0,0,0.85)',
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: 1.5,
          padding: '6px 8px',
          whiteSpace: 'pre-wrap',
        }}
      >
        <div style={{ color: '#0ff' }}>
          광선 {knobs.rays} | 스틱 {knobs.sticks} | DPR{' '}
          {knobs.maxDpr === 0 ? '네이티브' : knobs.maxDpr} | bloom{' '}
          {knobs.bloom ? `켬 x${knobs.bloomScale}` : '끔'}
        </div>
        <div style={{ color: '#0ff' }}>
          세로 fov {knobs.fov}° → 실제 가로 {horizontalFov.toFixed(0)}° (화면{' '}
          {viewport.width}x{viewport.height}, DPR {devicePixelRatio.toFixed(1)})
        </div>

        {result === null ? (
          <div>측정 중… {remaining}초 남음 (화면을 그대로 두세요)</div>
        ) : result.suspensions > 0 ? (
          // 중단이 섞인 측정은 p95도 표본 수도 평균도 전부 못 믿는다.
          // 부분적으로 보정해 내보내면 그 숫자가 그대로 표에 들어간다.
          <div style={{ color: '#f66' }}>
            측정 무효 — 중단 {result.suspensions}회 (최장{' '}
            {(result.longestSuspensionMs / 1000).toFixed(1)}초).{'\n'}
            알림·화면 꺼짐·탭 전환 때문입니다. 방해 금지로 두고 다시 재세요.
          </div>
        ) : (
          <>
            <div style={{ color: result.p95 <= FRAME_BUDGET_MS ? '#0f0' : '#f66' }}>
              p95 {result.p95.toFixed(1)}ms {result.p95 <= FRAME_BUDGET_MS ? '통과' : '초과'}
              {'  '}(예산 {FRAME_BUDGET_MS}ms)
            </div>
            <div>
              p50 {result.p50.toFixed(1)}ms | 최악 {result.worst.toFixed(1)}ms
            </div>
            <div>
              33.3ms 초과 {result.over}/{result.samples} ({result.overRatio.toFixed(1)}%)
            </div>
            <div>
              표본 {result.samples} | 평균 {result.averageFps.toFixed(1)}fps
            </div>
            <div style={{ color: contextLost === 0 ? '#0f0' : '#f66' }}>
              컨텍스트 손실 {contextLost}건
            </div>
          </>
        )}
      </div>
      ) : null}
    </div>
  );
}
