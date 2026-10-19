import { act, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import HomeClient from '@/components/sections/HomeClient';
import { HOME_SECTION_CONFIG } from '@/lib/constants';
import { coreValues } from '@/lib/data';
const flags = vi.hoisted(() => ({ obscured: false, pageVisible: true, reduced: false, wide: false }));
const motion = vi.hoisted(() => ({
  create: vi.fn(), destroy: vi.fn(), setPaused: vi.fn(), refresh: vi.fn(), settleProjects: vi.fn(),
  owner: null as ((owner: 'hero' | 'about' | 'boundary' | 'none') => void) | null,
}));
vi.mock('@/hooks/useProjectModalObscured', () => ({ useProjectModalObscured: () => flags.obscured }));
vi.mock('@/hooks/usePageVisibility', () => ({ usePageVisibility: () => flags.pageVisible }));
vi.mock('@/hooks/useMotionPreference', () => ({ useMotionPreference: () => ({ ready: true, reduced: flags.reduced }) }));
vi.mock('@/components/blocks/LuminousFlowBackground', () => ({ default: ({ paused }: { paused: boolean }) => <aside data-testid="flow" data-paused={paused} /> }));
vi.mock('@/components/sections', () => ({ AboutSection: ({ onChapterChange }: { onChapterChange: (index: number) => void }) => <p onClick={() => onChapterChange(2)}>About original body</p>, ProjectsSection: () => <p>Projects original body</p>, ExperienceSection: () => <p>Experience original body</p>, SkillsSection: () => <p>Skills original body</p>, AwardAndCertificateSection: () => <p>Awards original body</p>, Footer: () => <footer>Contacts</footer> }));
vi.mock('@/components/sections/HomeClient/motion', () => ({
  createPortfolioMotion: (options: { onLogoOwnerChange: (owner: 'hero' | 'about' | 'boundary' | 'none') => void }) => {
    motion.create(options); motion.owner = options.onLogoOwnerChange;
    return { destroy: motion.destroy, setPaused: motion.setPaused, refresh: motion.refresh, settleProjects: motion.settleProjects };
  },
}));
// App Router 빌드는 next/dynamic을 app-dynamic으로 바꿔 ref를 실제 컴포넌트까지 넘긴다.
// vitest에는 그 별칭이 없어 Pages용 loadable이 ref를 가로챈다.
vi.mock('next/dynamic', async () => {
  const appDynamic = await import('next/dist/shared/lib/app-dynamic') as unknown as { default?: unknown };
  return { default: appDynamic.default ?? appDynamic };
});
const handle = vi.hoisted(() => ({ beginBoundary: () => true, setBoundaryTarget: () => {}, seekBoundary: () => {}, endBoundary: () => {} }));
vi.mock('@/components/blocks/ElectricLogo', () => ({
  default: forwardRef<typeof handle, { src: string; active: boolean; onReady?: (src: string) => void }>(function Logo({ src, active, onReady }, ref) {
    useImperativeHandle(ref, () => handle, []);
    return <div data-electric-src={src} data-electric-active={active}><span data-signal-ready onClick={() => onReady?.(src)} /></div>;
  }),
}));
beforeEach(() => {
  flags.obscured = false; flags.pageVisible = true; flags.reduced = false; flags.wide = false;
  Object.values(motion).forEach(value => typeof value === 'function' && 'mockClear' in value && value.mockClear());
  motion.owner = null;
  window.history.replaceState(null, '', '/'); vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === '(min-width: 1024px)' && flags.wide, media: query, addEventListener: () => {}, removeEventListener: () => {} })));
});
// next/dynamic과 동적 import가 풀릴 때까지 기다린다.
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)); });
it('renders all section bodies in document order without single-active hiding or swipe capture', () => {
  const { container } = render(<HomeClient />);
  expect([...container.querySelectorAll('[data-section]')].map(el => el.getAttribute('data-section'))).toEqual(['overview', ...HOME_SECTION_CONFIG.map(section => section.id)]);
  expect(container.querySelector('[data-section][inert], [data-section][aria-hidden="true"]')).toBeNull();
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'START' })).toBeNull();
  expect(container.querySelector('#overview [data-motion-anchor="hero-object"] [style*="/icons-mono/react.svg"]')).not.toBeNull();
  fireEvent.pointerDown(screen.getByRole('main'), { clientX: 300, pointerId: 1 }); fireEvent.pointerUp(screen.getByRole('main'), { clientX: 20, pointerId: 1 });
  expect(location.hash).toBe('');
});
it.each(['obscured', 'pageVisible', 'reduced'] as const)('pauses the flow for %s', flag => {
  flags[flag] = flag !== 'pageVisible'; render(<HomeClient />); expect(screen.getByTestId('flow')).toHaveAttribute('data-paused', 'true');
});
it('only the modal obscures the readable main and navigation', () => {
  flags.obscured = true; const { container } = render(<HomeClient />);
  expect(screen.getByRole('main')).toHaveAttribute('inert'); expect(container.querySelector('nav')!.parentElement).toHaveAttribute('inert');
  expect(screen.getByText('Contacts').parentElement).toHaveAttribute('inert');
  expect(container.querySelectorAll('[data-section][inert]')).toHaveLength(0);
});

it('keeps one name button, one GL host and one Hero h1; anchors hold no readable text or controls', async () => {
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  expect(screen.getAllByRole('button', { name: '개요로 이동' })).toHaveLength(1);
  expect(container.querySelectorAll('[data-logo-host]')).toHaveLength(1);
  expect(container.querySelectorAll('[data-logo-host] [data-electric-src]')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  for (const name of ['hero-name', 'hero-object']) {
    const anchor = container.querySelector(`#overview [data-motion-anchor="${name}"]`)!;
    expect(anchor).toHaveAttribute('aria-hidden', 'true');
    expect(anchor.textContent).toBe('');
    expect(anchor.querySelector('a, button')).toBeNull();
  }
  expect(container.querySelector('[data-motion-anchor="nav-name"] [data-testid="wordmark"]')).not.toBeNull();
});

it('loads the boundary module after the route resolves and connects the real anchors and the GL handle', async () => {
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  expect(motion.create).toHaveBeenLastCalledWith(expect.objectContaining({
    root: screen.getByRole('main'), header: container.querySelector('nav'), wordmark: screen.getByTestId('wordmark'),
    logoHost: container.querySelector('[data-logo-host]'), logo: handle,
  }));
  expect(motion.setPaused).toHaveBeenLastCalledWith(false);
});

it('connects only the name channel when the GL logo is not mounted (narrow screens)', async () => {
  const { container } = render(<HomeClient />); await flush();
  expect(container.querySelector('[data-electric-src]')).toBeNull();
  expect(motion.create).toHaveBeenCalledTimes(1);
  expect(motion.create).toHaveBeenLastCalledWith(expect.objectContaining({ logo: null }));
});

it('reduced motion creates no motion context and no GL logo; static anchors stay', async () => {
  flags.reduced = true; flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  expect(motion.create).not.toHaveBeenCalled();
  expect(container.querySelector('[data-electric-src]')).toBeNull();
  expect(container.querySelector('.portfolio-document')).not.toHaveAttribute('data-logo-live');
  expect(screen.getByTestId('wordmark').style.transform).toBe('');
});

it('the shared logo follows the selected chapter at About and shows BASICS React on the first screen', async () => {
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  const logo = container.querySelector('[data-electric-src]')!;
  expect(logo).toHaveAttribute('data-electric-src', coreValues[0].logoSrc);
  expect(coreValues[0].logoSrc).toBe('/icons-mono/react.svg');
  act(() => motion.owner!('about'));
  fireEvent.click(screen.getByText('About original body'));
  expect(container.querySelector('[data-electric-src]')).toBe(logo);
  expect(logo).toHaveAttribute('data-electric-src', coreValues[2].logoSrc);
  act(() => motion.owner!('hero'));
  expect(logo).toHaveAttribute('data-electric-src', coreValues[0].logoSrc);
});

it('a chapter onReady never rebuilds the boundary; the static fallbacks hide once the GL logo is live', async () => {
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  const documentRoot = container.querySelector('.portfolio-document')!;
  act(() => motion.owner!('hero'));
  expect(documentRoot).not.toHaveAttribute('data-logo-live');
  fireEvent.click(container.querySelector('[data-signal-ready]')!);
  expect(documentRoot).toHaveAttribute('data-logo-live');
  act(() => motion.owner!('about'));
  fireEvent.click(screen.getByText('About original body'));
  fireEvent.click(container.querySelector('[data-signal-ready]')!);
  expect(motion.create).toHaveBeenCalledTimes(1);
  expect(motion.destroy).not.toHaveBeenCalled();
  act(() => motion.owner!('none'));
  expect(documentRoot).not.toHaveAttribute('data-logo-live');
});

it('pauses the boundary while the modal covers the page and destroys it on unmount', async () => {
  flags.wide = true;
  const view = render(<HomeClient />); await flush();
  flags.obscured = true; view.rerender(<HomeClient />);
  expect(motion.setPaused).toHaveBeenLastCalledWith(true);
  view.unmount();
  expect(motion.destroy).toHaveBeenCalledTimes(1);
});

// 브라우저 검사에서 잡혔다. aspect-ratio의 자동 최소 폭이 이전 크기의 캔버스를 붙잡아,
// 창을 줄이면 host가 줄어든 앵커보다 넓게 남았다.
it('the shared logo host lives outside clipping ancestors and can shrink with its anchor', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('styles/design-tokens.css', 'utf8');
  expect(css).toMatch(/\.logo-host \{[^}]*position: absolute;[^}]*min-width: 0;/);
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  const host = container.querySelector('[data-logo-host]')!;
  expect(host.parentElement).toBe(screen.getByRole('main'));
  expect(host.closest('#about, .about-electric')).toBeNull();
});

// D5-A: 1024px부터 왼쪽 문장·오른쪽 오브젝트, 그 아래는 이름·문장·오브젝트 순서. 크기는 소개 문장(h1)에 걸고
// 낮은 화면에서는 오브젝트가 먼저 준다. 로고는 날아가는 동안 chapter 단어 줄(z 3) 아래로 지나간다.
it('lays the Hero out as name, sentence, then object, and the object shrinks first on low screens', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('styles/design-tokens.css', 'utf8');
  const { container } = render(<HomeClient />);
  const order = [...container.querySelectorAll('#overview [data-motion-anchor], #overview h1')].map(el => el.getAttribute('data-motion-anchor') ?? el.tagName);
  expect(order).toEqual(['hero-name', 'H1', 'hero-object']);
  expect(css).toMatch(/\.portfolio-hero h1 \{[^}]*font-size: var\(--font-size-t1\)/);
  expect(css).toMatch(/@media \(min-width: 1024px\) \{[^@]*\.portfolio-hero \{[^}]*flex-direction: row;[^@]*\.portfolio-hero h1 \{ font-size: var\(--font-size-d3\)/);
  expect(css).toMatch(/@media \(min-width: 1536px\) \{[^@]*\.portfolio-hero h1 \{ font-size: var\(--font-size-d2\)/);
  expect(css).toMatch(/\.hero-object \{[^}]*width: min\([^}]*svh\)/);
  expect(css).not.toMatch(/\.portfolio-hero (p|h1) \{[^}]*svh/);
  expect(css).toMatch(/\.logo-host \{[^}]*z-index: 2;/);
});
