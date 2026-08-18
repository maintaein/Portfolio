'use client';

// 임시 현장 계측기 — ?debug=swipe. DebugGate에서만 동적 import된다.
// 원인 확정 후 DebugGate.tsx와 함께 삭제한다 (제거 목록은 debug-probe-report.md).
//
// .section-stage에 캡처 단계 리스너를 붙여 훅(useSectionSwipe)의 판정을 그대로
// 재현하면서 관찰만 한다 — 기존 버블 단계 핸들러를 가로채거나 방해하지 않는다.
// 판정식·상수는 hooks/useSectionSwipe.ts에서 그대로 가져온다.

import { useEffect, useRef, useState } from 'react';
import {
  EDGE_GUARD_PX,
  HORIZONTAL_DOMINANCE_RATIO,
  IGNORE_SELECTOR,
  MIN_SWIPE_DISTANCE_PX,
} from '@/hooks/useSectionSwipe';

const MAX_LOG_LINES = 12;

interface Counts {
  gesture: number;
  cancel: number;
  up: number;
  judged: number;
  moved: number;
}

const INITIAL_COUNTS: Counts = {
  gesture: 0,
  cancel: 0,
  up: 0,
  judged: 0,
  moved: 0,
};

export default function SwipeProbe() {
  const [lines, setLines] = useState<string[]>([]);
  const [counts, setCounts] = useState<Counts>(INITIAL_COUNTS);
  const startRef = useRef<{ pointerId: number; x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    const stage = document.querySelector('.section-stage');
    if (!stage) return;

    const log = (line: string) => {
      setLines((prev) => [...prev, line].slice(-MAX_LOG_LINES));
    };

    const onDown = (event: PointerEvent) => {
      startRef.current = null;
      setCounts((prev) => ({ ...prev, gesture: prev.gesture + 1 }));

      const warnings: string[] = [];
      if (event.pointerType !== 'touch') warnings.push('non-touch');

      const target = event.target;
      if (target instanceof Element && target.closest(IGNORE_SELECTOR)) {
        warnings.push('ignore-selector');
      }

      const nearEdge =
        event.clientX <= EDGE_GUARD_PX ||
        event.clientX >= window.innerWidth - EDGE_GUARD_PX;
      if (nearEdge) warnings.push('edge-guard');

      const suffix = warnings.length ? ` WARN:${warnings.join(',')}` : '';
      log(
        `DOWN x=${event.clientX.toFixed(0)} type=${event.pointerType}${suffix}`
      );

      if (warnings.length === 0) {
        startRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
      }
    };

    const onCancel = () => {
      startRef.current = null;
      setCounts((prev) => ({ ...prev, cancel: prev.cancel + 1 }));
      log('CANCEL (브라우저가 제스처를 가져감)');
    };

    // 훅(useSectionSwipe)이 pointerup 대신 pointermove에서 조기 판정하도록
    // 고쳤으므로, 계측기도 같은 경로를 재현해야 실기기에서 판정 카운트가
    // 의미를 가진다. pointerup은 30/30 취소 세션에서 단 한 번도 오지
    // 않았으므로 이 리스너 없이는 '판정'이 항상 0으로 보인다.
    const onMove = (event: PointerEvent) => {
      const start = startRef.current;
      if (!start || event.pointerId !== start.pointerId) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const judged =
        Math.abs(dx) >= MIN_SWIPE_DISTANCE_PX &&
        Math.abs(dx) > Math.abs(dy) * HORIZONTAL_DOMINANCE_RATIO;

      if (judged) {
        startRef.current = null;
        setCounts((prev) => ({ ...prev, judged: prev.judged + 1 }));
        log(`MOVE dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} 판정=true (조기)`);
      }
    };

    const onUp = (event: PointerEvent) => {
      const start = startRef.current;
      startRef.current = null;
      setCounts((prev) => ({ ...prev, up: prev.up + 1 }));

      if (!start || event.pointerId !== start.pointerId) {
        log('UP (시작점 없음, 추적 대상 아님 — 조기 판정됐거나 무시된 제스처)');
        return;
      }

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const judged =
        Math.abs(dx) >= MIN_SWIPE_DISTANCE_PX &&
        Math.abs(dx) > Math.abs(dy) * HORIZONTAL_DOMINANCE_RATIO;

      if (judged) {
        setCounts((prev) => ({ ...prev, judged: prev.judged + 1 }));
      }
      log(`UP dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} 판정=${judged}`);
    };

    stage.addEventListener('pointerdown', onDown as EventListener, {
      capture: true,
    });
    stage.addEventListener('pointercancel', onCancel, { capture: true });
    stage.addEventListener('pointermove', onMove as EventListener, {
      capture: true,
    });
    stage.addEventListener('pointerup', onUp as EventListener, {
      capture: true,
    });

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes') continue;
        const el = mutation.target;
        if (!(el instanceof HTMLElement)) continue;
        if (!el.classList.contains('section-visible')) continue;

        setCounts((prev) => ({ ...prev, moved: prev.moved + 1 }));
        log(`실제이동 -> ${el.getAttribute('data-section')}`);
      }
    });
    document.querySelectorAll('[data-section]').forEach((el) => {
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });

    return () => {
      stage.removeEventListener('pointerdown', onDown as EventListener, {
        capture: true,
      });
      stage.removeEventListener('pointercancel', onCancel, { capture: true });
      stage.removeEventListener('pointermove', onMove as EventListener, {
        capture: true,
      });
      stage.removeEventListener('pointerup', onUp as EventListener, {
        capture: true,
      });
      observer.disconnect();
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
      <div>
        제스처 {counts.gesture} | 취소 {counts.cancel} | UP {counts.up} | 판정{' '}
        {counts.judged} | 실제이동 {counts.moved}
      </div>
      {lines.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  );
}
