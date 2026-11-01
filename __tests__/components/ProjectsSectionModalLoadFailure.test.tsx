import { useRef as useVisibilityRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ProjectsSection from '@/components/sections/ProjectsSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { useProjectModalObscured } from '@/hooks/useProjectModalObscured';
import { projects } from '@/lib/data';
import { isProjectModalReady } from '@/lib/utils/projectContract';

vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: true, hasEntered: true }) }));
// M4 Task 0. GSAP 청크를 못 받으면 그것을 품은 상세 판(ProjectModal)과 셰이더 모프(PreviewMorph)의 import()가 실패하고
// lazy 렌더가 던져 페이지 전체가 오류 화면으로 떨어졌다. 브라우저에서는 딸린 청크 하나만 실패해도 그 import()가 거절되므로
// 세 모듈 모두 거절로 바꾼다(GSAP만 거절하면 vitest는 그것을 정적으로 부르는 모듈을 그대로 불러온다).
// vi.mock은 파일 단위로 호이스팅되므로 실패만 보는 독립 파일이다(HyperspeedBackgroundLoadFailure와 같은 이유).
vi.mock('@/lib/gsap', () => {
  throw new Error('chunk load failed');
});
vi.mock('@/components/blocks/ProjectModal', () => {
  throw new Error('chunk load failed');
});
vi.mock('@/components/blocks/PreviewMorph', () => {
  throw new Error('chunk load failed');
});

function ObscuredProbe() {
  return <output data-testid="obscured">{String(useProjectModalObscured())}</output>;
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, media: '', addEventListener: () => {}, removeEventListener: () => {} }));
  window.history.replaceState(null, '', '/');
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const renderSection = () => render(
  <SectionActivityProvider obscured={false} pageVisible routeResolved motionReady reducedMotion={false}>
    <ProjectsSection />
    <ObscuredProbe />
  </SectionActivityProvider>
);
// next/dynamic의 loader가 실패로 끝날 때까지 기다린다. 실패가 오기 전의 클릭은 아무것도 증명하지 않는다.
const settleLoaders = () => act(() => new Promise(resolve => setTimeout(resolve, 100)));

it('GSAP 청크가 실패해도 페이지는 남고, 상세를 열면 아무것도 띄우지 않은 채 History와 가림을 되돌린다', async () => {
  const ready = projects.findIndex(project => isProjectModalReady(project));
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
  renderSection();
  await settleLoaders();
  const name = document.querySelector(`[data-name="${ready}"]`)!;
  // 두 클릭 계약: 활성이 아닌 이름은 첫 클릭이 선택만 옮긴다.
  if (name.getAttribute('aria-selected') !== 'true') fireEvent.click(name);
  const push = vi.spyOn(window.history, 'pushState');
  fireEvent.click(name);
  expect(push).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
  await settleLoaders();
  expect(back).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByTestId('obscured')).toHaveTextContent('false');
  // 누른 이름은 선택된 채로 남고 목록은 그대로 쓰인다.
  expect(document.querySelector(`[data-name="${ready}"]`)).toHaveAttribute('aria-selected', 'true');
});

it('새로고침으로 복구된 상세도 띄우지 못하면 History를 늘리거나 뒤로 가지 않고 그 키만 지운다', async () => {
  const ready = projects.find(project => isProjectModalReady(project))!;
  window.history.replaceState({ projectModalId: ready.title, __NA: 'next가 쓰는 필드' }, '', '#projects');
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
  renderSection();
  await settleLoaders();
  await waitFor(() => expect(window.history.state?.projectModalId).toBeUndefined());
  expect(window.history.state.__NA).toBe('next가 쓰는 필드');
  expect(back).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByTestId('obscured')).toHaveTextContent('false');
});
