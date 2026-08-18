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

interface Knobs {
  rays: number;
  sticks: number;
  maxDpr: number;
  bloom: boolean;
  bloomScale: number;
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
  };
}

interface Result {
  samples: number;
  p50: number;
  p95: number;
  worst: number;
  over: number;
  overRatio: number;
  averageFps: number;
}

function summarize(intervals: number[]): Result {
  const sorted = [...intervals].sort((a, b) => a - b);
  // deviceQuality.ts의 FrameQualityGovernor와 같은 nearest-rank 정의를 쓴다.
  // 두 곳의 p95가 다르면 이 측정으로 정한 값이 런타임 판정과 어긋난다.
  const rank = (q: number) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? 0;
  const over = intervals.filter((interval) => interval > FRAME_BUDGET_MS).length;
  const total = intervals.reduce((sum, interval) => sum + interval, 0);

  return {
    samples: intervals.length,
    p50: rank(0.5),
    p95: rank(0.95),
    worst: sorted[sorted.length - 1] ?? 0,
    over,
    overRatio: intervals.length ? (over / intervals.length) * 100 : 0,
    averageFps: total ? (intervals.length / total) * 1000 : 0,
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

  const effectOptions = {
    lightPairsPerRoadWay: knobs.rays,
    totalSideLightSticks: knobs.sticks,
    maxDpr: knobs.maxDpr,
    bloomEnabled: knobs.bloom,
    bloomResolutionScale: knobs.bloomScale,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <HyperspeedSpike effectOptions={effectOptions} />

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

        {result === null ? (
          <div>측정 중… {remaining}초 남음 (화면을 그대로 두세요)</div>
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
    </div>
  );
}
