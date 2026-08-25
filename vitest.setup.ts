import '@testing-library/jest-dom/vitest';

// jsdom에는 ResizeObserver가 없다(canvas와 마찬가지로 미구현). ClickSpark
// (components/blocks/ClickSpark)가 마운트 시 부모 크기에 캔버스를 맞추려고
// 이 API를 무조건 호출하므로, 없으면 "ResizeObserver is not defined"로
// 테스트가 즉시 던진다. 실제 리사이즈 동작은 검증 대상이 아니므로(그 값은
// 실기기 몫이다) 아무 일도 하지 않는 최소 스텁으로 존재만 보장한다.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
