import { act, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import HomeClient from '@/components/sections/HomeClient';
import { HOME_SECTION_CONFIG } from '@/lib/constants';
import { coreValues } from '@/lib/data';
const flags = vi.hoisted(() => ({ obscured: false, pageVisible: true, reduced: false, wide: false, ready: true }));
const motion = vi.hoisted(() => ({
  create: vi.fn(), destroy: vi.fn(), setPaused: vi.fn(), setLogo: vi.fn(), refresh: vi.fn(), settleProjects: vi.fn(),
  owner: null as ((owner: 'hero' | 'about' | 'boundary' | 'preview' | 'projects' | 'none') => void) | null,
}));
vi.mock('@/hooks/useProjectModalObscured', () => ({ useProjectModalObscured: () => flags.obscured }));
vi.mock('@/hooks/usePageVisibility', () => ({ usePageVisibility: () => flags.pageVisible }));
vi.mock('@/hooks/useMotionPreference', () => ({ useMotionPreference: () => ({ ready: flags.ready, reduced: flags.reduced }) }));
const flow = vi.hoisted(() => ({ setRevealProgress: () => {} }));
vi.mock('@/components/blocks/LuminousFlowBackground', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return { default: forwardRef<typeof flow, { paused: boolean }>(function Flow({ paused }, ref) { useImperativeHandle(ref, () => flow, []); return <aside data-testid="flow" data-paused={paused} />; }) };
});
// 인트로 자체는 BootSequence 테스트가 본다. 여기서는 셸이 무엇을 넘기는지만 잡는다.
type BootProps = import('@/components/sections/BootSequence').BootSequenceProps;
const boot = vi.hoisted(() => ({ props: null as null | BootProps, finish: vi.fn() }));
vi.mock('@/components/sections/BootSequence', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    default: forwardRef<unknown, BootProps>(function Boot(props, ref) { boot.props = props; useImperativeHandle(ref, () => ({ finish: boot.finish }), []); return null; }),
  };
});
const projectsGate = vi.hoisted(() => ({ before: null as null | ((run: () => void) => void), release: vi.fn() }));
const projectsLock = vi.hoisted(() => ({ release: vi.fn(), props: null as null | { navigationPending?: boolean; logoOwner?: string } }));
vi.mock('@/components/sections', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  const About = forwardRef<unknown, { onChapterChange: (index: number) => void; logoOwner: string }>(function About({ onChapterChange, logoOwner }, ref) {
    useImperativeHandle(ref, () => ({ release: projectsGate.release }), []);
    return <p data-logo-owner-prop={logoOwner} onClick={() => onChapterChange(2)}>About original body</p>;
  });
  return { AboutSection: About, ProjectsSection: ({ ref, beforeAction, navigationPending, logoOwner }: { ref?: import('react').Ref<unknown>; beforeAction?: (run: () => void) => void; navigationPending?: boolean; logoOwner?: string }) => { projectsGate.before = beforeAction ?? null; projectsLock.props = { navigationPending, logoOwner }; useImperativeHandle(ref, () => ({ release: projectsLock.release }), []); return <p>Projects original body</p>; }, ExperienceSection: () => <p>Experience original body</p>, SkillsSection: () => <p>Skills original body</p>, AwardAndCertificateSection: () => <p>Awards original body</p>, Footer: () => <footer>Contacts</footer> };
});
const overlay = vi.hoisted(() => ({ setBoundary: vi.fn(), setTimeline: vi.fn(), setReduced: vi.fn(), destroy: vi.fn() }));
vi.mock('@/components/sections/ExperienceSection/overlay', () => ({ createExperienceOverlay: () => overlay }));
vi.mock('@/components/sections/HomeClient/motion', () => ({
  createPortfolioMotion: (options: { onLogoOwnerChange: (owner: 'hero' | 'about' | 'boundary' | 'preview' | 'projects' | 'none') => void }) => {
    motion.create(options); motion.owner = options.onLogoOwnerChange;
    return { destroy: motion.destroy, setPaused: motion.setPaused, setLogo: motion.setLogo, refresh: motion.refresh, settleProjects: motion.settleProjects };
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
  default: forwardRef<typeof handle, { src: string; active: boolean; prewarm?: boolean; onReady?: (src: string) => void }>(function Logo({ src, active, prewarm, onReady }, ref) {
    useImperativeHandle(ref, () => handle, []);
    return <div data-electric-src={src} data-electric-active={active} data-electric-prewarm={prewarm}><span data-signal-ready onClick={() => onReady?.(src)} /></div>;
  }),
}));
const ball = vi.hoisted(() => ({ icons: null as null | { current: HTMLElement | null }, handle: { setCollapse: () => {} } }));
vi.mock('@/components/blocks/CrystalizedBall', () => ({
  default: forwardRef<typeof ball.handle, { icons: { current: HTMLElement | null }; paused?: boolean; onReady?: () => void }>(function Ball({ icons, paused, onReady }, ref) {
    ball.icons = icons;
    useImperativeHandle(ref, () => ball.handle, []);
    return <div data-ball-gl data-ball-paused={String(!!paused)}><span data-ball-ready onClick={() => onReady?.()} /></div>;
  }),
}));
beforeEach(() => {
  flags.obscured = false; flags.pageVisible = true; flags.reduced = false; flags.wide = false; flags.ready = true;
  Object.values(motion).forEach(value => typeof value === 'function' && 'mockClear' in value && value.mockClear());
  Object.values(overlay).forEach(fn => fn.mockClear());
  motion.owner = null;
  boot.props = null; boot.finish.mockClear(); document.documentElement.removeAttribute('data-intro');
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
  // 최종 리뷰 M-4(WCAG 2.5.3): 읽기 이름이 보이는 글자로 시작해야 음성 입력의 "KIM TAEIN 클릭"이 닿는다.
  expect(screen.getAllByRole('button', { name: 'KIM TAEIN, 개요로 이동' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: '개요로 이동' })).toBeNull();
  expect(container.querySelectorAll('[data-logo-host]')).toHaveLength(1);
  expect(container.querySelectorAll('[data-logo-host] [data-electric-src]')).toHaveLength(1);
  // Hero 오브젝트의 GL host는 볼 하나다. Electric 로고 host는 About의 오브젝트로 남는다.
  expect(container.querySelectorAll('[data-ball-gl]')).toHaveLength(1);
  expect(container.querySelector('#overview [data-motion-anchor="hero-object"] [data-ball-gl]')).not.toBeNull();
  expect(container.querySelector('#overview [data-electric-src]')).toBeNull();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  const objectAnchor = container.querySelector('#overview [data-motion-anchor="hero-object"]')!;
  expect(objectAnchor).toHaveAttribute('aria-hidden', 'true');
  expect(objectAnchor.textContent).toBe('');
  expect(objectAnchor.querySelector('a, button')).toBeNull();
  // 이름 버튼은 서버 HTML부터 Hero 자리에 산다. nav의 이름 앵커는 경계가 옮겨 갈 빈 자리다.
  const nameAnchor = container.querySelector('#overview [data-motion-anchor="hero-name"]')!;
  expect(nameAnchor.querySelectorAll('button')).toEqual(expect.objectContaining({ length: 1 }));
  expect(nameAnchor.querySelector('button')).toBe(screen.getByTestId('wordmark'));
  expect(screen.getByTestId('wordmark')).toHaveAttribute('data-wordmark-mode', 'hero');
  expect(screen.getByTestId('wordmark')).toHaveClass('site-name', 'min-h-11');
  const navAnchor = container.querySelector('nav [data-motion-anchor="nav-name"]')!;
  expect(navAnchor.childElementCount).toBe(0);
  expect(navAnchor).toHaveClass('min-h-11');
});

it('the name button goes to the overview, smooth for a pointer click and instant for a keyboard click', () => {
  render(<HomeClient />);
  fireEvent.click(screen.getByTestId('wordmark'), { detail: 1 });
  expect(window.scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  window.history.replaceState(null, '', '/#about');
  fireEvent.click(screen.getByTestId('wordmark'), { detail: 0 });
  expect(window.scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'auto' }));
  expect(location.hash).toBe('#overview');
});

it('loads the boundary module after the route resolves, connects the real anchors and hands the GL handle over separately', async () => {
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  expect(motion.create).toHaveBeenCalledTimes(1);
  expect(motion.create).toHaveBeenLastCalledWith(expect.objectContaining({
    root: screen.getByRole('main'), header: container.querySelector('nav'), wordmark: screen.getByTestId('wordmark'),
    logoHost: container.querySelector('[data-logo-host]'), reduced: false,
  }));
  expect(motion.setLogo).toHaveBeenLastCalledWith(handle);
  expect(motion.setPaused).toHaveBeenLastCalledWith(false);
  // 볼 손잡이는 ref로 넘겨 경계가 매 프레임 접힘 정도를 쓴다. 볼이 늦게 떠도 다시 잇지 않는다.
  expect(motion.create.mock.calls[0][0].ball.current).toBe(ball.handle);
});

// Task 10. 쉬는 자리마다 그리는 GL host는 하나다. Hero에서는 볼만 돌고 Electric 로고는 한 장만 미리 그린 채 멈춰 있다.
// About에서는 로고만 돌고 볼은 멈춘다. 변신 동안(boundary)만 둘이 함께 그린다.
it('one GL host draws at each rest; both draw only during the transformation', async () => {
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  const drawing = () => [container.querySelector('[data-ball-gl]')!.getAttribute('data-ball-paused') === 'false', container.querySelector('[data-electric-src]')!.getAttribute('data-electric-active') === 'true'];
  act(() => motion.owner!('hero'));
  expect(drawing()).toEqual([true, false]);
  expect(container.querySelector('[data-electric-src]')).toHaveAttribute('data-electric-prewarm', 'true');
  act(() => motion.owner!('boundary'));
  expect(drawing()).toEqual([true, true]);
  act(() => motion.owner!('about'));
  expect(drawing()).toEqual([false, true]);
  act(() => motion.owner!('boundary'));
  expect(drawing()).toEqual([true, true]);
  act(() => motion.owner!('hero'));
  expect(drawing()).toEqual([true, false]);
});

// Task 9: Hero 오브젝트는 크리스털 볼이다. 정적 유리와 핵심 아이콘 여섯이 서버 HTML부터 쉬는 자리에 서고,
// GL은 같은 아이콘 층을 움직인다. 아이콘은 장식이라 읽히지 않는다(기술 이름은 Skills에 있다).
it('the Hero object is the crystal ball: one icon layer of the six core icons at rest that the GL ball drives', async () => {
  const { BALL_ICONS, fieldPoint, iconStyle } = await import('@/components/blocks/CrystalizedBall/field');
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  const anchor = container.querySelector('#overview [data-motion-anchor="hero-object"]')!;
  const shell = anchor.querySelector(':scope > .hero-ball')!;
  expect(shell.querySelector(':scope > .hero-ball-glass')).not.toBeNull();
  const icons = shell.querySelectorAll<HTMLElement>(':scope > .hero-ball-icons > span');
  expect(icons).toHaveLength(6);
  icons.forEach((icon, index) => {
    const rest = iconStyle(fieldPoint(BALL_ICONS[index].home, BALL_ICONS[index].seed, 0, [0, 0], [0, 0, 0]));
    expect(icon.style.transform).toBe(rest.transform);
    expect(icon.style.opacity).toBe(String(rest.opacity));
    expect(icon.firstElementChild!.getAttribute('style')).toContain(`/icons-mono/${BALL_ICONS[index].name}.svg`);
  });
  expect(ball.icons!.current).toBe(shell.querySelector('.hero-ball-icons'));
  expect(anchor.closest('[aria-hidden="true"]')).toBe(anchor);
  expect(screen.queryByRole('img')).toBeNull();
});

// 볼은 GL 로고와 같은 규칙으로 뜬다(1024px부터, 모션 감소가 아니고 진입이 끝난 뒤). 첫 그림 뒤에만 정적 유리가 물러난다.
// 모달, 숨은 탭, 로고가 About에 내려앉은 동안(볼이 접혀 사라진 동안)은 멈춘다.
it('the GL ball mounts like the GL logo, hides the static glass after its first frame and pauses on the activity flags', async () => {
  flags.wide = true;
  const view = render(<HomeClient />); await flush();
  const shell = view.container.querySelector('.hero-ball')!;
  const gl = () => view.container.querySelector('[data-ball-gl]');
  expect(shell).not.toHaveAttribute('data-ball-live');
  act(() => motion.owner!('hero'));
  expect(gl()).toHaveAttribute('data-ball-paused', 'false');
  fireEvent.click(view.container.querySelector('[data-ball-ready]')!);
  expect(shell).toHaveAttribute('data-ball-live');
  // 변신 동안 볼은 접히며 돌고, About에 내려앉으면 멈춘다.
  act(() => motion.owner!('boundary'));
  expect(gl()).toHaveAttribute('data-ball-paused', 'false');
  act(() => motion.owner!('about'));
  expect(gl()).toHaveAttribute('data-ball-paused', 'true');
  act(() => motion.owner!('hero'));
  expect(gl()).toHaveAttribute('data-ball-paused', 'false');
  flags.obscured = true; view.rerender(<HomeClient />);
  expect(gl()).toHaveAttribute('data-ball-paused', 'true');
  flags.obscured = false; flags.pageVisible = false; view.rerender(<HomeClient />);
  expect(gl()).toHaveAttribute('data-ball-paused', 'true');
  view.unmount();
  flags.pageVisible = true; flags.wide = false;
  const narrow = render(<HomeClient />); await flush();
  expect(narrow.container.querySelector('[data-ball-gl]')).toBeNull();
  expect(narrow.container.querySelectorAll('.hero-ball-icons > span')).toHaveLength(6);
});

// Task 10 리뷰 Minor 2. GL 볼도 로고처럼 Hero에서 쉬는 동안에만 정적 유리와 바뀐다. 변신 중(boundary)이나 About에서 준비돼도
// 접히는 정적 볼을 그대로 두고, Hero에 돌아와 쉴 때 바꾼다. 한 번 바뀐 뒤에는 변신 동안에도 그대로다.
it('the GL ball replaces the static glass only while it rests at the Hero, never during a flight', async () => {
  flags.wide = true;
  const view = render(<HomeClient />); await flush();
  const shell = view.container.querySelector('.hero-ball')!;
  act(() => motion.owner!('boundary'));
  fireEvent.click(view.container.querySelector('[data-ball-ready]')!);
  expect(shell).not.toHaveAttribute('data-ball-live');
  act(() => motion.owner!('about'));
  expect(shell).not.toHaveAttribute('data-ball-live');
  act(() => motion.owner!('boundary'));
  expect(shell).not.toHaveAttribute('data-ball-live');
  act(() => motion.owner!('hero'));
  expect(shell).toHaveAttribute('data-ball-live');
  for (const owner of ['boundary', 'about', 'boundary'] as const) {
    act(() => motion.owner!(owner));
    expect(shell).toHaveAttribute('data-ball-live');
  }
});

it('connects only the name channel when the GL logo is not mounted (narrow screens)', async () => {
  const { container } = render(<HomeClient />); await flush();
  expect(container.querySelector('[data-electric-src]')).toBeNull();
  expect(motion.create).toHaveBeenCalledTimes(1);
  expect(motion.setLogo).toHaveBeenLastCalledWith(null);
});

// 모션 감소도 같은 지점에서 이름 자리를 바꾼다. 재생은 없고 GL 로고도 없다.
it('reduced motion creates a reduced motion context and no GL logo; static anchors stay', async () => {
  flags.reduced = true; flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  expect(motion.create).toHaveBeenCalledTimes(1);
  expect(motion.create).toHaveBeenLastCalledWith(expect.objectContaining({ reduced: true }));
  expect(motion.setLogo).toHaveBeenLastCalledWith(null);
  expect(container.querySelector('[data-electric-src]')).toBeNull();
  expect(container.querySelector('[data-ball-gl]')).toBeNull();
  expect(container.querySelectorAll('.hero-ball-icons > span')).toHaveLength(6);
  expect(container.querySelector('.portfolio-document')).not.toHaveAttribute('data-logo-live');
  expect(screen.getByTestId('wordmark').style.transform).toBe('');
});

// GL 로고는 쉬는 자리에서만 정적 실루엣과 바뀐다. 날아가는 동안 준비돼도 내려앉은 뒤에 드러나고, 이미 드러났으면 날아가는 동안 그대로다.
// About은 로고가 내려앉은 뒤에만 잠근다.
it('the GL logo turns live only at rest and About is told whether the logo has landed', async () => {
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  const documentRoot = container.querySelector('.portfolio-document')!;
  const about = screen.getByText('About original body');
  act(() => motion.owner!('hero'));
  act(() => motion.owner!('boundary'));
  expect(about).toHaveAttribute('data-logo-owner-prop', 'boundary');
  fireEvent.click(container.querySelector('[data-signal-ready]')!);
  expect(documentRoot).not.toHaveAttribute('data-logo-live');
  act(() => motion.owner!('about'));
  expect(documentRoot).toHaveAttribute('data-logo-live');
  expect(about).toHaveAttribute('data-logo-owner-prop', 'about');
  act(() => motion.owner!('boundary'));
  expect(documentRoot).toHaveAttribute('data-logo-live');
  act(() => motion.owner!('hero'));
  expect(documentRoot).toHaveAttribute('data-logo-live');
  expect(motion.create).toHaveBeenCalledTimes(1);
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

// M4 Task 1. About↔Projects 비행(preview) 동안에는 로고만 돌고 볼은 멈춘다. 프리뷰에 넘긴 뒤(projects)에는 숨은 로고도 멈춘다.
// 로고는 그동안 chapter 모양 그대로라 되돌아올 때 About에서 보던 로고로 접힌다. GL은 날아가는 동안 받아들이지 않는다.
it('the logo keeps the chapter shape and draws only while flying to the preview; handed over it rests hidden', async () => {
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  const documentRoot = container.querySelector('.portfolio-document')!;
  const logo = () => container.querySelector('[data-electric-src]')!;
  const ballPaused = () => container.querySelector('[data-ball-gl]')!.getAttribute('data-ball-paused');
  act(() => motion.owner!('about'));
  fireEvent.click(screen.getByText('About original body'));
  act(() => motion.owner!('preview'));
  fireEvent.click(container.querySelector('[data-signal-ready]')!);
  expect(documentRoot).not.toHaveAttribute('data-logo-live');
  expect(logo()).toHaveAttribute('data-electric-src', coreValues[2].logoSrc);
  expect(logo()).toHaveAttribute('data-electric-active', 'true');
  expect(ballPaused()).toBe('true');
  act(() => motion.owner!('projects'));
  expect(documentRoot).toHaveAttribute('data-logo-live');
  expect(logo()).toHaveAttribute('data-electric-src', coreValues[2].logoSrc);
  expect(logo()).toHaveAttribute('data-electric-active', 'false');
  expect(ballPaused()).toBe('true');
  expect(screen.getByText('About original body')).toHaveAttribute('data-logo-owner-prop', 'projects');
  act(() => motion.owner!('preview'));
  act(() => motion.owner!('about'));
  expect(logo()).toHaveAttribute('data-electric-src', coreValues[2].logoSrc);
  expect(logo()).toHaveAttribute('data-electric-active', 'true');
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

it('Korean text breaks by word site-wide while long Latin strings can still wrap', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('styles/design-tokens.css', 'utf8');
  expect(css).toMatch(/@layer base \{[^@]*\n  body \{[^}]*word-break: keep-all;[^}]*overflow-wrap: anywhere;/);
});

// D5-A: 1024px부터 왼쪽 문장·오른쪽 오브젝트, 그 아래는 이름·문장·오브젝트 순서. 크기는 소개 문장(h1)에 걸고
// 낮은 화면에서는 오브젝트가 먼저 준다. 로고는 날아가는 동안 chapter 단어 줄(z 3) 아래로 지나간다.
// 이름 자리는 큰 이름의 줄 높이만큼 비워 둔다. 두 줄 인사는 원문 개행으로 나눈다.
it('lays the Hero out as name, sentence, then object, and the object shrinks first on low screens', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('styles/design-tokens.css', 'utf8');
  const { container } = render(<HomeClient />);
  const order = [...container.querySelectorAll('#overview [data-motion-anchor], #overview h1')].map(el => el.getAttribute('data-motion-anchor') ?? el.tagName);
  expect(order).toEqual(['hero-name', 'H1', 'hero-object']);
  expect(container.querySelector('#overview [data-motion-anchor="hero-name"]')).toHaveClass('hero-name');
  expect(css).toMatch(/\n\.hero-name \{[^}]*display: flex; align-items: center; height: calc\(var\(--hero-name-size\) \* 1\.5\);/);
  expect(css).toMatch(/\.portfolio-hero h1 \{[^}]*white-space: pre-line;/);
  expect(css).toMatch(/\.portfolio-hero h1 \{[^}]*font-size: var\(--font-size-t1\)/);
  // 1024–1535px은 큰 이름이 문장보다 크게 읽히도록 문장을 36px로 줄인다(사용자 결정 2026-10-20).
  expect(css).toMatch(/@media \(min-width: 1024px\) \{[^@]*\.portfolio-hero \{[^}]*flex-direction: row;[^@]*\.portfolio-hero h1 \{ font-size: 2\.25rem;/);
  expect(css).toMatch(/@media \(min-width: 1536px\) \{[^@]*\.portfolio-hero h1 \{ font-size: var\(--font-size-d2\)/);
  expect(css).toMatch(/--hero-object-size: min\([^;]*svh\);/);
  expect(css).toMatch(/\.hero-object \{ width: var\(--hero-object-size\); \}/);
  // JS 전·JS 없이도 큰 이름은 CSS만으로 볼 상자(광휘 포함) 앞에서 멈춘다(motion.ts의 볼 상한과 같은 식). 이름은 글 칸 왼쪽(8vw)에서 시작한다.
  expect(css).toMatch(/--hero-name-size: min\(clamp\(56px, 6\.5vw, 128px\), calc\(\(84vw - 1\.1 \* var\(--hero-object-size\) - 32px\) \/ 5\.67\)\);/);
  // 최종 리뷰 M-3: 1024px 아래도 CSS만으로 이름(끝 자간 포함 5.77em)이 글 칸에 든다. 경계가 첫 화면 뒤에 줄여 튀지 않는다.
  // 16px은 스크롤바 몫이다(1024px 규칙과 같다).
  expect(css).toMatch(/\.portfolio-hero \{ --hero-name-size: min\(clamp\(56px, 6\.5vw, 128px\), calc\(\(84vw - 16px\) \/ 5\.77\)\);/);
  for (const vw of [320, 360, 375, 390, 768, 1023]) {
    const size = Math.min(Math.max(56, Math.min(.065 * vw, 128)), (.84 * vw - 16) / 5.77);
    expect(size * 5.77, `${vw}px`).toBeLessThanOrEqual(vw - 16 - 2 * Math.max(24, .08 * vw) + 1e-9);
  }
  expect(css).not.toContain('2.835');
  expect(css).not.toMatch(/\.portfolio-hero (p|h1) \{[^}]*svh/);
  expect(css).toMatch(/\.logo-host \{[^}]*z-index: 2;/);
});

// Task 9: 볼은 정면이다(눕힌 평면 캔버스는 원을 타원으로 누른다). Task 10: 볼과 로고의 교대는 CSS 교차 페이드가 아니라
// 경계(motion.ts)가 진행도로 쓰는 변신이다. host는 GL이 살아 있으면 보이고, 안쪽 불투명도는 경계가 쓴다(Hero에서 0).
// GL 볼은 첫 그림 뒤에 정적 유리와 같은 길이로 엇갈려 나타난다(Task 9 리뷰 Minor 1: 툭 튀어나왔다).
it('the Hero ball is frontal; the ball/logo exchange is the boundary transformation, not a CSS cross-fade', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('styles/design-tokens.css', 'utf8');
  expect(css).not.toContain('hero-object-tilt');
  expect(css).toMatch(/\n\[data-logo-live\] \.logo-host \{ opacity: 1; \}/);
  expect(css).toMatch(/\.logo-host > div \{[^}]*opacity: 0;/);
  expect(css).not.toMatch(/data-logo-owner='(hero|boundary|about)'/);
  expect(css).not.toMatch(/\.hero-ball \{[^}]*transition/);
  expect(css).not.toMatch(/html\[data-intro\] \.hero-ball \{ transition/);
  expect(css).toMatch(/\.hero-ball\[data-ball-live\] \.hero-ball-glass \{ opacity: 0; \}/);
  expect(css).toMatch(/\.hero-ball:not\(\[data-ball-live\]\) canvas \{ opacity: 0; \}/);
  expect(css).toMatch(/\.hero-ball canvas \{ transition: opacity 250ms ease; \}/);
  // 가려진 실루엣의 충전 애니메이션이 GL 뒤에서 계속 돌면 첫 화면 프레임이 무거워진다(e2e에서 잡혔다).
  expect(css).toMatch(/\[data-logo-live\] \[data-motion-anchor\] \.about-electric-static-shape \{ animation: none; \}/);
  const { container } = render(<HomeClient />);
  expect(container.querySelector('#overview .about-electric-static')).toBeNull();
});

// 사용자 결정(2026-10-20). 인사말 교대와 커튼이 없다. Hero 왼쪽 두 줄 인사가 유일한 h1이고 옛 소개 문장은 없다.
it('the Hero text is the two-line greeting h1; no greeting paragraph and no old intro sentence', () => {
  const { container } = render(<HomeClient />);
  const hero = container.querySelector('#overview')!;
  expect(hero.querySelectorAll('p')).toHaveLength(0);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(hero.querySelector('h1')!.textContent).toBe('안녕하세요.\nSW개발자 김태인입니다.');
  expect(container.textContent).not.toContain('탄탄한 기본기를');
});

it('without the pre-paint gate (hash, revisit, reduced, no JS) the intro is disabled and nothing is held back', async () => {
  flags.wide = true;
  const { container } = render(<HomeClient />); await flush();
  expect(boot.props).toMatchObject({ enabled: false, reducedMotion: false, targets: null });
  expect(screen.getByTestId('flow')).toHaveAttribute('data-paused', 'false');
  expect(container.querySelector('[data-electric-src]')).toHaveAttribute('data-electric-active', 'false');
  // Hero에서 쉬는 동안 로고 host는 숨어 있어 돌지 않는다. 한 장만 미리 그려 준비를 알리고, Hero를 떠나면 돈다.
  expect(container.querySelector('[data-electric-src]')).toHaveAttribute('data-electric-prewarm', 'true');
  act(() => motion.owner!('hero'));
  expect(container.querySelector('[data-electric-src]')).toHaveAttribute('data-electric-active', 'false');
  for (const owner of ['boundary', 'about'] as const) {
    act(() => motion.owner!(owner));
    expect(container.querySelector('[data-electric-src]')).toHaveAttribute('data-electric-active', 'true');
  }
});

// 헤드 Chrome에서 WebGL 문맥 생성이 메인 스레드를 1.4–2.3초 막았다. GL 로고는 진입 뒤에 뜬다.
// 배경은 기다리지 않고 바로 돈다. 공개값 0은 대상보다 먼저 배경 손잡이에 건다.
it.each([['wide', true], ['narrow', false]] as const)('first visit (%s): the background runs at once with its handle passed before the targets, targets come after the boundary placed the name, and the GL logo mounts only after the entrance', async (_, wide) => {
  flags.wide = wide;
  document.documentElement.setAttribute('data-intro', '');
  const { container } = render(<HomeClient />);
  expect(boot.props).toMatchObject({ enabled: true, targets: null, background: flow });
  expect(boot.props).not.toHaveProperty('onRevealStart');
  await flush();
  expect(motion.create).toHaveBeenCalledTimes(1);
  expect(motion.setLogo).toHaveBeenLastCalledWith(null);
  const targets = boot.props!.targets!;
  expect(targets.wordmark).toBe(screen.getByTestId('wordmark').firstElementChild);
  expect(targets.headline).toBe(screen.getByRole('heading', { level: 1 }));
  expect(targets).not.toHaveProperty('background');
  // 오브젝트는 Hero 앵커 안 볼의 껍질이다. 경계가 재는 앵커 상자는 진입이 쓰지 않는다(리뷰 Minor 2).
  const anchor = container.querySelector('#overview [data-motion-anchor="hero-object"]')!;
  expect(targets.heroObject).toBe(anchor.querySelector(':scope > .hero-ball'));
  expect(targets.heroObject).not.toBe(anchor);
  expect((targets.heroObject as HTMLElement).querySelectorAll(':scope > .hero-ball-icons > span')).toHaveLength(6);
  expect(container.querySelector('[data-electric-src]')).toBeNull();
  expect(container.querySelector('[data-ball-gl]')).toBeNull();
  expect(screen.getByTestId('flow')).toHaveAttribute('data-paused', 'false');
  act(() => boot.props!.onComplete());
  await flush();
  if (wide) {
    expect(container.querySelector('[data-electric-src]')).not.toBeNull();
    expect(container.querySelector('[data-ball-gl]')).not.toBeNull();
    expect(motion.setLogo).toHaveBeenLastCalledWith(handle);
  } else {
    expect(container.querySelector('[data-electric-src]')).toBeNull();
    expect(container.querySelector('[data-ball-gl]')).toBeNull();
  }
  // GL 손잡이가 와도 경계를 다시 만들지 않는다. 날던 이름·로고가 끊기지 않는다.
  expect(motion.create).toHaveBeenCalledTimes(1);
});

// 헤드 Chrome에서 잡혔다. 준비 전 기본값 reduced: true가 첫 레이아웃에서 인트로를 끝냈다.
it('the pre-ready preference default does not end the intro; a resolved reduce does', () => {
  document.documentElement.setAttribute('data-intro', '');
  flags.ready = false; flags.reduced = true;
  const view = render(<HomeClient />);
  expect(boot.props).toMatchObject({ enabled: true, reducedMotion: false });
  flags.ready = true; view.rerender(<HomeClient />);
  expect(boot.props).toMatchObject({ reducedMotion: true });
});

it('a nav click during the intro finishes it first and keeps the navigation', async () => {
  document.documentElement.setAttribute('data-intro', '');
  render(<HomeClient />); await flush();
  fireEvent.click(screen.getAllByRole('button', { name: HOME_SECTION_CONFIG[1].label })[0]);
  expect(boot.finish).toHaveBeenCalledTimes(1);
  expect(location.hash).toBe(`#${HOME_SECTION_CONFIG[1].id}`);
});

it('hands Projects input to motion: releases the About lock, settles, then runs the original action exactly once', async () => {
  render(<HomeClient />); await flush();
  const order: string[] = [];
  projectsGate.release.mockImplementation(() => order.push('release'));
  motion.settleProjects.mockImplementation(() => order.push('settle'));
  expect(projectsGate.before).toEqual(expect.any(Function));
  const run = vi.fn(() => order.push('run'));
  projectsGate.before!(run);
  expect(order).toEqual(['release', 'settle', 'run']);
  expect(run).toHaveBeenCalledTimes(1);
});

it('the gate passed to Projects is stable across renders', async () => {
  const view = render(<HomeClient />); await flush();
  const first = projectsGate.before;
  view.rerender(<HomeClient />);
  expect(projectsGate.before).toBe(first);
});

// M4 Task 7. Projects도 About처럼 읽기 잠금을 가진다. 명시적 이동 직전에 둘 다 풀고, 이동 중 표시와 로고 자리를 About과 같이 넘긴다.
it('releases the Projects reading lock with About before a nav move and passes it the navigation and logo state', async () => {
  render(<HomeClient />); await flush();
  expect(projectsLock.props).toEqual({ navigationPending: false, logoOwner: 'none' });
  act(() => motion.owner!('projects'));
  expect(projectsLock.props!.logoOwner).toBe('projects');
  projectsGate.release.mockClear(); projectsLock.release.mockClear();
  fireEvent.click(screen.getAllByRole('button', { name: HOME_SECTION_CONFIG[2].label })[0]);
  expect(projectsGate.release).toHaveBeenCalledTimes(1);
  expect(projectsLock.release).toHaveBeenCalledTimes(1);
  expect(projectsLock.props!.navigationPending).toBe(true);
});

// 오버레이는 HomeClient가 쓰는 같은 선호(useMotionPreference)로 모션 감소를 받는다.
it('passes the reduced-motion preference to the experience overlay and follows changes', () => {
  flags.reduced = true;
  const { rerender } = render(<HomeClient />);
  expect(overlay.setReduced).toHaveBeenLastCalledWith(true);
  flags.reduced = false;
  rerender(<HomeClient />);
  expect(overlay.setReduced).toHaveBeenLastCalledWith(false);
});
