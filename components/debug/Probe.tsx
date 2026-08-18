'use client';

// 임시 현장 계측기 — DebugGate가 next/dynamic 하나로 불러오는 실제 구현.
// mode에 따라 SwipeProbe/JankProbe 중 하나를 렌더한다. 이 파일도 삭제 대상.

import SwipeProbe from './SwipeProbe';
import JankProbe from './JankProbe';

export default function Probe({ mode }: { mode: 'swipe' | 'jank' }) {
  return mode === 'swipe' ? <SwipeProbe /> : <JankProbe />;
}
