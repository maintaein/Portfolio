'use client';

// 임시 현장 계측기 게이트 — plan2-state-machine-navigation/debug-probe-brief.md
// 실기기(Galaxy S25) 스와이프 무동작 · About 잼 원인 확정용. 원인 확정 후 삭제한다.
// 제거 시: 이 디렉터리(components/debug) 전체와, HomeClient에서 이 컴포넌트를
// import·렌더하는 두 줄을 지운다. 자세한 목록은 debug-probe-report.md 참고.
//
// ?debug=swipe / ?debug=jank 쿼리가 없으면 이 컴포넌트는 null만 반환하며,
// Probe(SwipeProbe·JankProbe 포함) 청크는 next/dynamic(ssr:false)이라
// 요청조차 되지 않는다. 두 probe를 한 청크로 묶어 dynamic() 경계를 하나로
// 줄인 것은 First Load JS를 최대한 아끼기 위한 선택이다.

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Probe = dynamic(() => import('./Probe'), { ssr: false });

type DebugMode = 'swipe' | 'jank';

function readDebugMode(): DebugMode | null {
  const value = new URLSearchParams(window.location.search).get('debug');
  return value === 'swipe' || value === 'jank' ? value : null;
}

export default function DebugGate() {
  const [mode, setMode] = useState<DebugMode | null>(null);

  useEffect(() => {
    setMode(readDebugMode());
  }, []);

  if (!mode) return null;
  return <Probe mode={mode} />;
}
