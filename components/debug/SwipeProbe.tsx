'use client';

// 임시 현장 계측기 — ?debug=swipe. DebugGate에서만 동적 import된다.
// 원인 확정 후 DebugGate.tsx와 함께 삭제한다 (제거 목록은 debug-probe-report.md).
//
// .section-stage에 캡처 단계 리스너를 붙여 훅(useSectionSwipe)의 판정을 그대로
// 재현하면서 관찰만 한다 — 기존 버블 단계 핸들러를 가로채거나 방해하지 않는다.
// 판정식·상수는 hooks/useSectionSwipe.ts에서 그대로 가져온다.
//
// 2차 확장: 1차 계측기는 pointermove를 "판정에 성공했을 때만" 기록했다.
// 그래서 실기기에서 MOVE 줄이 하나도 안 보였는데, 그것이 "pointermove가 오지
// 않는다"는 뜻인지 "오지만 임계에 못 미친다"는 뜻인지 구별할 수 없었다.
// 이제 제스처마다 이동 횟수·최대 변위·경과 시간을 무조건 누적하고,
// 취소/종료 시점에 요약을 남긴다. touch-action 조상 체인도 함께 찍어
// 브라우저가 어느 요소 때문에 제스처를 가져가는지 확인한다.

import { useEffect, useRef, useState } from 'react';
import {
  EDGE_GUARD_PX,
  HORIZONTAL_DOMINANCE_RATIO,
  IGNORE_SELECTOR,
  MIN_SWIPE_DISTANCE_PX,
} from '@/hooks/useSectionSwipe';

const MAX_LOG_LINES = 9;
const MAX_CHAIN_ENTRIES = 6;

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

// 판정 대상이 아니어도(경고가 붙어도) 모든 제스처를 추적한다.
// 판정 경로는 startRef가 따로 담당한다.
interface Gesture {
  pointerId: number;
  x: number;
  y: number;
  time: number;
  moves: number;
  maxAbsDx: number;
  maxAbsDy: number;
  lastDx: number;
  lastDy: number;
}

function describeElement(element: Element): string {
  const firstClass = element.classList.item(0);
  return firstClass
    ? `${element.tagName}.${firstClass}`
    : element.tagName.toLowerCase();
}

// 손가락이 닿은 요소부터 .section-stage까지 올라가며 실제 계산된
// touch-action을 수집한다. 브라우저는 이 체인 전체를 보고 제스처를
// 가져갈지 결정하므로, .section-stage 하나만 확인해서는 알 수 없다.
function touchActionChain(target: EventTarget | null): string {
  if (!(target instanceof Element)) return 'TA: (요소 아님)';

  const entries: string[] = [];
  let node: Element | null = target;

  while (node && entries.length < MAX_CHAIN_ENTRIES) {
    const touchAction = window.getComputedStyle(node).touchAction;
    entries.push(`${describeElement(node)}(${touchAction})`);
    if (node.classList.contains('section-stage')) break;
    node = node.parentElement;
  }

  return `TA: ${entries.join(' < ')}`;
}

export default function SwipeProbe() {
  const [lines, setLines] = useState<string[]>([]);
  const [counts, setCounts] = useState<Counts>(INITIAL_COUNTS);
  const [summary, setSummary] = useState('최근: (아직 제스처 없음)');
  const [chain, setChain] = useState('TA: (아직 제스처 없음)');
  const startRef = useRef<{ pointerId: number; x: number; y: number } | null>(
    null
  );
  const gestureRef = useRef<Gesture | null>(null);

  useEffect(() => {
    const stage = document.querySelector('.section-stage');
    if (!stage) return;

    const log = (line: string) => {
      setLines((prev) => [...prev, line].slice(-MAX_LOG_LINES));
    };

    // 취소든 종료든 같은 요약을 낸다. moves가 0이면 브라우저가 pointermove를
    // 단 한 번도 주지 않았다는 뜻이고, moves가 있는데 판정이 0이면 임계에
    // 도달하기 전에 가져갔다는 뜻이다. 이 둘의 구별이 이번 계측의 목적이다.
    const summarize = (label: string) => {
      const gesture = gestureRef.current;
      if (!gesture) return `${label} (추적 정보 없음)`;

      const elapsed = Math.round(performance.now() - gesture.time);
      return (
        `${label} moves=${gesture.moves}` +
        ` dx=${gesture.lastDx.toFixed(0)} dy=${gesture.lastDy.toFixed(0)}` +
        ` max=${gesture.maxAbsDx.toFixed(0)}/${gesture.maxAbsDy.toFixed(0)}` +
        ` t=${elapsed}ms`
      );
    };

    const onDown = (event: PointerEvent) => {
      startRef.current = null;
      setCounts((prev) => ({ ...prev, gesture: prev.gesture + 1 }));

      gestureRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
        moves: 0,
        maxAbsDx: 0,
        maxAbsDy: 0,
        lastDx: 0,
        lastDy: 0,
      };

      setChain(touchActionChain(event.target));

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
      const targetLabel =
        target instanceof Element ? describeElement(target) : '?';
      log(
        `DOWN x=${event.clientX.toFixed(0)} type=${event.pointerType}` +
          ` tgt=${targetLabel}${suffix}`
      );

      if (warnings.length === 0) {
        startRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
      }
    };

    // 판정 여부와 무관하게 모든 pointermove를 센다. 1차 계측기가 놓친 지점이다.
    const onMove = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (gesture && event.pointerId === gesture.pointerId) {
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        gesture.moves += 1;
        gesture.lastDx = dx;
        gesture.lastDy = dy;
        gesture.maxAbsDx = Math.max(gesture.maxAbsDx, Math.abs(dx));
        gesture.maxAbsDy = Math.max(gesture.maxAbsDy, Math.abs(dy));

        // 첫 이동만 찍는다. pointermove가 도착한다는 사실 자체가 증거이고,
        // 전부 찍으면 로그가 넘쳐 취소 요약이 밀려난다.
        if (gesture.moves === 1) {
          log(`MOVE#1 dx=${dx.toFixed(0)} dy=${dy.toFixed(0)}`);
        }
      }

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
        log(
          `판정=true (조기) dx=${dx.toFixed(0)} dy=${dy.toFixed(0)}` +
            ` move#${gesture ? gesture.moves : '?'}`
        );
      }
    };

    const onCancel = () => {
      startRef.current = null;
      setCounts((prev) => ({ ...prev, cancel: prev.cancel + 1 }));
      const line = summarize('CANCEL');
      setSummary(`최근: ${line}`);
      log(line);
      gestureRef.current = null;
    };

    const onUp = (event: PointerEvent) => {
      const start = startRef.current;
      startRef.current = null;
      setCounts((prev) => ({ ...prev, up: prev.up + 1 }));

      const line = summarize('UP');
      setSummary(`최근: ${line}`);

      if (!start || event.pointerId !== start.pointerId) {
        log(`${line} (판정 대상 아님 — 조기 판정됐거나 무시된 제스처)`);
        gestureRef.current = null;
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
      log(`${line} 판정=${judged}`);
      gestureRef.current = null;
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
        maxHeight: '52vh',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
      }}
    >
      <div>
        제스처 {counts.gesture} | 취소 {counts.cancel} | UP {counts.up} | 판정{' '}
        {counts.judged} | 실제이동 {counts.moved}
      </div>
      <div style={{ color: '#ff0' }}>{summary}</div>
      <div style={{ color: '#0ff' }}>{chain}</div>
      {lines.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  );
}
