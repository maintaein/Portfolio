// 임시 계측 라우트 — 계획 3 Task 1 Step 2/3(하강 사다리 실기기 측정) 전용.
// 측정이 끝나 QUALITY_PROFILES 표가 채워지면 app/spike/와 components/spike/를
// 통째로 삭제한다.
//
// 별도 라우트라 App Router가 자체 청크로 쪼갠다 — `/`의 First Load JS는
// 변하지 않아야 한다(scripts/check-bundle.mjs --measure로 확인).

import type { Metadata } from 'next';
import SpikeClient from './SpikeClient';

// 계측 페이지가 색인되면 안 된다.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SpikePage() {
  return <SpikeClient />;
}
