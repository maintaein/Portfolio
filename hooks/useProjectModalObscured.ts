'use client';

import { useSyncExternalStore } from 'react';

// ProjectModal 열림 여부를 ProjectsSection(발행자)과 HyperspeedBackground의
// 소비자인 HomeClient(구독자) 사이에서 공유하는 최소 채널.
//
// ProjectModal의 열림 상태는 ProjectsSection 로컬 useState이고, HomeClient는
// SECTION_COMPONENTS map을 통해 그 컴포넌트를 무프롭으로 렌더한다(다른 섹션과
// 같은 제네릭 패턴). Context를 새로 얹지 않은 이유: 발행자·소비자가 각각
// 하나뿐이라 Provider 배선을 추가할 이유가 없다 — 모듈 스코프 싱글턴 +
// useSyncExternalStore로 충분하다.
let obscured = false;
const listeners = new Set<() => void>();

export function setProjectModalObscured(value: boolean): void {
  if (obscured === value) return;
  obscured = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return obscured;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useProjectModalObscured(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
