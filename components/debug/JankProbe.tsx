'use client';

// 임시 현장 계측기 — ?debug=jank. DebugGate에서만 동적 import된다.
// 원인 확정 후 DebugGate.tsx와 함께 삭제한다 (제거 목록은 debug-probe-report.md).
//
// About 화면 잼(p95 67.2ms)의 원인을 3단계로 자동 좁힌다:
// ① 현재 상태 → ② 전역 CSS 애니메이션 정지 → ③ About 장식 요소 숨김.
// 각 단계 9초, rAF 간격을 모아 p50·p95·33.3ms 초과 비율을 낸다.
// 주입한 스타일은 각 단계가 끝나면 반드시 제거한다.

import { useEffect, useState } from 'react';

const STAGE_DURATION_MS = 9000;
const JANK_THRESHOLD_MS = 33.3;
const MAX_LOG_LINES = 12;

const STAGE_CSS = {
  baseline: null,
  pauseAnimations: '*, *::before, *::after { animation-play-state: paused !important }',
  hideAboutDecorations:
    '[data-section="about"] [class*="animate-"] { display: none !important }',
} as const;

interface StageStats {
  label: string;
  p50: number;
  p95: number;
  jankCount: number;
  jankPercent: number;
  frameCount: number;
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length)
  );
  return sorted[index];
}

function computeStats(label: string, deltas: number[]): StageStats {
  const sorted = [...deltas].sort((a, b) => a - b);
  const jankCount = deltas.filter((d) => d > JANK_THRESHOLD_MS).length;
  return {
    label,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    jankCount,
    jankPercent: deltas.length ? (jankCount / deltas.length) * 100 : 0,
    frameCount: deltas.length,
  };
}

// rAF 간격을 수집한다. 첫 간격(측정 시작 시점의 인공물)은 버린다.
function collectFrameDeltas(durationMs: number): Promise<number[]> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let prevTimestamp: number | null = null;
    let startTimestamp: number | null = null;
    let firstDeltaDiscarded = false;

    const tick = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;

      if (prevTimestamp !== null) {
        const delta = timestamp - prevTimestamp;
        if (!firstDeltaDiscarded) {
          firstDeltaDiscarded = true;
        } else {
          deltas.push(delta);
        }
      }
      prevTimestamp = timestamp;

      if (timestamp - startTimestamp >= durationMs) {
        resolve(deltas);
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

function formatStats(stats: StageStats) {
  return `${stats.label} 완료: p50=${stats.p50.toFixed(1)}ms p95=${stats.p95.toFixed(1)}ms jank=${stats.jankCount}/${stats.frameCount}(${stats.jankPercent.toFixed(1)}%)`;
}

function buildConclusion(
  baseline: StageStats,
  paused: StageStats,
  hidden: StageStats
) {
  if (paused.jankPercent <= baseline.jankPercent / 2) {
    return '결론: CSS 애니메이션이 원인 (②에서 잼이 절반 이하로 감소)';
  }
  if (hidden.jankPercent < paused.jankPercent) {
    return '결론: 요소의 페인트/레이아웃이 원인 (②는 그대로, ③에서 개선)';
  }
  return '결론: 장식 밖이 원인 (③에서도 개선 없음)';
}

export default function JankProbe() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const log = (line: string) => {
      setLines((prev) => [...prev, line].slice(-MAX_LOG_LINES));
    };

    let cancelled = false;

    async function runStage(label: string, css: string | null) {
      let styleEl: HTMLStyleElement | null = null;
      if (css) {
        styleEl = document.createElement('style');
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
      }

      log(`${label} 측정 중... (${STAGE_DURATION_MS / 1000}s)`);
      const deltas = await collectFrameDeltas(STAGE_DURATION_MS);

      if (styleEl) styleEl.remove();

      const stats = computeStats(label, deltas);
      log(formatStats(stats));
      return stats;
    }

    async function run() {
      const baseline = await runStage('①현재 상태', STAGE_CSS.baseline);
      if (cancelled) return;
      const paused = await runStage(
        '②애니메이션 정지',
        STAGE_CSS.pauseAnimations
      );
      if (cancelled) return;
      const hidden = await runStage(
        '③About 장식 숨김',
        STAGE_CSS.hideAboutDecorations
      );
      if (cancelled) return;

      log(buildConclusion(baseline, paused, hidden));
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
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
        fontSize: '11px',
        lineHeight: 1.4,
        padding: '4px 8px',
        maxHeight: '42vh',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
      }}
    >
      {lines.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  );
}
