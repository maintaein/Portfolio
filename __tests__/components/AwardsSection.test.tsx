import { Profiler, createRef, useRef as useVisibilityRef, type Ref } from 'react';
import { readFileSync } from 'node:fs';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
const visibility = vi.hoisted(() => ({ visible: true }));
vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: visibility.visible, hasEntered: true }) }));
function awardsView(visible = true, handle?: Ref<AwardsSectionHandle>, onRender: () => void = () => {}) {
  visibility.visible = visible;
  return <SectionActivityProvider obscured={false} pageVisible routeResolved motionReady reducedMotion={false}><Profiler id="awards" onRender={onRender}><AwardsSection ref={handle} /></Profiler></SectionActivityProvider>;
}
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AwardsSection, { type AwardsSectionHandle } from '@/components/sections/AwardAndCertificatesSection';
import type { StarDom } from '@/components/sections/AwardAndCertificatesSection/star';
import { awards, certificates } from '@/lib/data';
import { AWARD_ORBIT, CERT_ORBIT, certAngle, orbitPoint } from '@/components/sections/AwardAndCertificatesSection/orbit';
import { SECTION_IDS } from '@/lib/constants';

let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
let reducedMotion = false;
let pageHidden = false;
const requestFrame = vi.fn((callback: FrameRequestCallback) => {
  frames.set(++nextFrame, callback);
  return nextFrame;
});
const cancelFrame = vi.fn((id: number) => frames.delete(id));

function step(time: number) {
  const queued = [...frames.values()];
  frames.clear();
  act(() => queued.forEach((callback) => callback(time)));
}

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  reducedMotion = false;
  pageHidden = false;
  requestFrame.mockClear();
  cancelFrame.mockClear();
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  // jsdom에는 캔버스가 없다. 테두리 case만 2D 컨텍스트를 모의한다.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reducedMotion; },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => pageHidden ? 'hidden' : 'visible',
  });
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => pageHidden,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Awards orbit', () => {
  it('renders all award facts before interaction', () => {
    const rendered = new DOMParser().parseFromString(renderToString(awardsView()), 'text/html');
    expect(rendered.querySelector('section')?.id).toBe(SECTION_IDS.AWARDS_CERTIFICATES);
    for (const award of awards) {
      const card = rendered.querySelector(`[data-award-card="${award.id}"]`);
      const button = rendered.querySelector(`[data-award-select="${award.id}"]`);
      expect(card?.textContent).toContain(award.title);
      expect(card?.textContent).toContain(award.project);
      expect(card?.textContent).toContain(award.description);
      expect(button?.textContent).toContain(award.title);
      expect(button?.textContent).toContain(award.organization);
      expect(button?.textContent).toContain(award.description);
    }
    expect(rendered.querySelector('.awards-credentials')).not.toBeInTheDocument();
    expect(rendered.querySelectorAll('[data-orbit-node]')).toHaveLength(awards.length);
  });

  it('updates the center on hover, focus, and click without stopping orbit motion', () => {
    const { container } = render(awardsView());
    const nodes = [...container.querySelectorAll<HTMLElement>('[data-orbit-node]')];
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('[data-award-select]')];
    step(1000);
    const before = nodes[0].style.getPropertyValue('--orbit-x');
    fireEvent.pointerEnter(buttons[1]);
    expect(container.querySelector('[data-orbit-center]')?.textContent).toContain(awards[1].project);
    fireEvent.focus(buttons[2]);
    expect(container.querySelector('[data-orbit-center]')?.textContent).toContain(awards[2].project);
    fireEvent.click(buttons[0]);
    expect(container.querySelector('[data-orbit-center]')?.textContent).toContain(awards[0].project);
    expect(screen.queryByRole('button', { name: /resume|재개/i })).not.toBeInTheDocument();
    step(2000);
    expect(nodes[0].style.getPropertyValue('--orbit-x')).not.toBe(before);
    expect(frames.size).toBe(1);
  });

  it('stops offscreen, hidden, and for reduced motion, then cleans up', () => {
    const { rerender, unmount } = render(awardsView(false));
    expect(frames.size).toBe(0);
    rerender(awardsView());
    expect(frames.size).toBe(1);
    pageHidden = true;
    fireEvent(document, new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    pageHidden = false;
    fireEvent(document, new Event('visibilitychange'));
    expect(frames.size).toBe(1);
    rerender(awardsView(false));
    expect(frames.size).toBe(0);
    reducedMotion = true;
    rerender(awardsView());
    expect(frames.size).toBe(0);
    unmount();
    expect(frames.size).toBe(0);
    expect(cancelFrame).toHaveBeenCalled();
  });

  it('자격증 사실도 상호작용 전에 SSR 본문과 자격증 노드에 있다', () => {
    const rendered = new DOMParser().parseFromString(renderToString(awardsView()), 'text/html');
    const certificate = certificates[0];
    const card = rendered.querySelector(`[data-certificate-card="${certificate.id}"]`);
    const button = rendered.querySelector(`[data-certificate-select="${certificate.id}"]`);
    for (const fact of [certificate.name, certificate.grade, certificate.organization, certificate.date, certificate.validUntil!]) {
      expect(card?.textContent).toContain(fact);
      expect(button?.textContent).toContain(fact);
    }
    expect(button?.textContent).toContain('자격증');
    expect(rendered.querySelectorAll('[data-orbit-cert]')).toHaveLength(certificates.length);
  });

  it('수상 id 1과 자격증 id 1을 따로 고르고 자격증 hover, focus, click에서 원문을 가운데에 띄운다', () => {
    const { container } = render(awardsView());
    const award = container.querySelector<HTMLButtonElement>('[data-award-select="1"]')!;
    const certificate = container.querySelector<HTMLButtonElement>('[data-certificate-select="1"]')!;
    const center = () => container.querySelector('[data-orbit-center]')!;
    for (const select of [fireEvent.pointerEnter, fireEvent.focus, fireEvent.click]) {
      fireEvent.click(award);
      expect(award).toHaveAttribute('aria-pressed', 'true');
      expect(certificate).toHaveAttribute('aria-pressed', 'false');
      expect(center().textContent).toContain(awards[0].project);
      select(certificate);
      expect(certificate).toHaveAttribute('aria-pressed', 'true');
      expect(award).toHaveAttribute('aria-pressed', 'false');
      for (const fact of ['OPIC', 'IH', 'ACTFL', '2025. 03', '2027. 03']) expect(center().textContent).toContain(fact);
      expect(center().querySelector('img')?.getAttribute('src')).toBe('/logos-mono/opic.png');
    }
  });

  it('자격증 노드는 수상과 같은 angleRef의 certAngle 자리를 하나의 rAF로 돈다', () => {
    const { container } = render(awardsView());
    const award = container.querySelector<HTMLElement>('[data-orbit-node]')!;
    const certificate = container.querySelector<HTMLElement>('[data-orbit-cert]')!;
    const expectCertAtShared = () => {
      const x = Number(award.style.getPropertyValue('--orbit-x'));
      const y = Number(award.style.getPropertyValue('--orbit-y'));
      const expected = orbitPoint(CERT_ORBIT, certAngle(Math.atan2(y / AWARD_ORBIT.ry, x / AWARD_ORBIT.rx)));
      expect(Number(certificate.style.getPropertyValue('--orbit-x'))).toBeCloseTo(expected.x, 1);
      expect(Number(certificate.style.getPropertyValue('--orbit-y'))).toBeCloseTo(expected.y, 1);
    };
    expectCertAtShared();
    const before = certificate.style.getPropertyValue('--orbit-x');
    step(1000);
    step(2000);
    expect(certificate.style.getPropertyValue('--orbit-x')).not.toBe(before);
    expectCertAtShared();
    expect(frames.size).toBe(1);
  });
});

const STAR_VARS = ['--star-disc', '--star-text', '--star-plane', '--orbit-award', '--orbit-cert', '--card-0', '--card-1', '--card-2', '--card-3'];
const dom: StarDom = { disc: .4, text: .1, plane: .3, awardLine: .5, certLine: .6, cards: [.2, .3, .4, .7] };
const CSS = readFileSync('styles/design-tokens.css', 'utf8').replace(/\r\n/g, '\n');
const cssRule = (selector: string) => {
  const at = CSS.indexOf(`\n${selector} {`);
  return at < 0 ? '' : CSS.slice(at, CSS.indexOf('}', at));
};

type FakeContext = Record<string, ReturnType<typeof vi.fn>>;
function fakeContext(): FakeContext {
  const store: Record<string | symbol, unknown> = {};
  return new Proxy(store, {
    get(target, key) {
      if (!(key in target)) target[key] = key === 'createRadialGradient' ? vi.fn(() => ({ addColorStop: vi.fn() })) : vi.fn();
      return target[key];
    },
    set(target, key, value) { target[key] = value; return true; },
  }) as FakeContext;
}

describe('Awards 넘김 손잡이와 항성 테두리', () => {
  const stageOf = (container: HTMLElement) => container.querySelector<HTMLElement>('.awards-stage')!;

  it('손잡이가 없거나 setStar 전에는 data-star가 없고 원판과 카드가 SSR 그대로다', () => {
    const rendered = new DOMParser().parseFromString(renderToString(awardsView()), 'text/html');
    expect(rendered.querySelector('[data-star]')).toBeNull();
    expect(rendered.querySelector('[data-orbit-center]')?.textContent).toContain(awards[0].project);
    const plain = render(awardsView());
    expect(stageOf(plain.container)).not.toHaveAttribute('data-star');
    plain.unmount();
    const handle = createRef<AwardsSectionHandle>();
    const { container } = render(awardsView(true, handle));
    const stage = stageOf(container);
    expect(stage).not.toHaveAttribute('data-star');
    for (const name of STAR_VARS) expect(stage.style.getPropertyValue(name)).toBe('');
    expect(container.querySelector('[data-orbit-center]')?.textContent).toContain(awards[0].project);
    expect(container.querySelectorAll('[data-orbit-node], [data-orbit-cert]')).toHaveLength(awards.length + certificates.length);
    // 2D 컨텍스트가 없으면 테두리 캔버스는 준비되지 않고 원판의 CSS border가 남는다
    expect(container.querySelector('canvas[data-star-rim]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[data-star-rim]')).not.toHaveAttribute('data-ready');
  });

  it('setStar는 wait, play와 변수, null을 재렌더 없이 stage에 쓴다', () => {
    const handle = createRef<AwardsSectionHandle>();
    let renders = 0;
    const { container } = render(awardsView(true, handle, () => { renders += 1; }));
    const stage = stageOf(container);
    const before = renders;
    act(() => handle.current!.setStar('wait'));
    expect(stage).toHaveAttribute('data-star', 'wait');
    act(() => handle.current!.setStar(dom));
    expect(stage).toHaveAttribute('data-star', 'play');
    expect(stage.style.getPropertyValue('--card-3')).toBe(String(dom.cards[3]));
    expect(stage.style.getPropertyValue('--star-disc')).toBe(String(dom.disc));
    expect(stage.style.getPropertyValue('--orbit-cert')).toBe(String(dom.certLine));
    act(() => handle.current!.setStar(null));
    expect(stage).not.toHaveAttribute('data-star');
    for (const name of STAR_VARS) expect(stage.style.getPropertyValue(name)).toBe('');
    expect(renders).toBe(before);
  });

  it('wait와 play 동안 공전은 멈추고 null 뒤 같은 angle에서 다시 돈다', () => {
    const handle = createRef<AwardsSectionHandle>();
    render(awardsView(true, handle));
    step(1000);
    step(1050);
    const start = handle.current!.angle();
    expect(start).toBeGreaterThan(-Math.PI / 3);
    act(() => handle.current!.setStar('wait'));
    for (let t = 1100; t <= 2100; t += 50) step(t);
    expect(handle.current!.angle()).toBe(start);
    act(() => handle.current!.setStar(dom));
    for (let t = 2150; t <= 3150; t += 50) step(t);
    expect(handle.current!.angle()).toBe(start);
    act(() => handle.current!.setStar(null));
    step(3200);
    step(3250);
    expect(handle.current!.angle()).toBeGreaterThan(start);
  });

  it('CSS: wait에서 키보드 진입 전에는 감추고, play에서는 각자 변수를 따른다', () => {
    const wait = CSS.match(/\.awards-stage\[data-star='wait'\]:not\(:has\(:focus-visible\)\) :is\(([^)]*)\) \{ opacity: 0; \}/);
    expect(wait).not.toBeNull();
    for (const part of ['.awards-center', '.awards-node', '.awards-ring', '.awards-plane', '[data-star-rim]']) expect(wait![1]).toContain(part);
    // 보이지 않는 카드는 마우스를 받지 않는다(키보드 진입은 위 :has(:focus-visible) 예외로 그대로다)
    expect(CSS).toContain(".awards-stage[data-star='wait']:not(:has(:focus-visible)) .awards-node { pointer-events: none; }");
    // stage 밖의 바깥 타원도 기다리는 동안 감춘다(Ruling 10)
    expect(CSS).toContain(".awards-orbit:has(> .awards-stage[data-star='wait']):not(:has(:focus-visible))::before { opacity: 0; }");
    const play = ".awards-stage[data-star='play']:not(:has(:focus-visible))";
    expect(CSS).toContain(`${play} :is(.awards-center, [data-star-rim]) { opacity: var(--star-disc); }`);
    expect(CSS).toContain(`${play} .awards-center > * { opacity: var(--star-text); }`);
    expect(CSS).toContain(`${play} :is(.awards-plane, .awards-axis) { opacity: var(--star-plane); }`);
    expect(CSS).toContain(`${play} .awards-ring:not(.awards-cert-ring) { opacity: var(--orbit-award); }`);
    expect(CSS).toContain(`${play} .awards-cert-ring { opacity: var(--orbit-cert); }`);
    for (let i = 0; i < 4; i++) expect(CSS).toContain(`${play} [data-card='${i}'] { opacity: calc(var(--orbit-opacity, 1) * var(--card-${i})); }`);
    // 테두리 캔버스가 그릴 때만 원판 border를 지운다. 모바일에서는 .awards-orbit과 함께 숨는다.
    expect(cssRule('[data-star-rim][data-ready] + .awards-center')).toContain('border-color: transparent');
    expect(cssRule('[data-star-rim]')).toContain('pointer-events: none');
  });

  it('wait 중 카드에 focus를 주고 click하면 선택 정보가 원판에 뜬다', () => {
    const handle = createRef<AwardsSectionHandle>();
    const { container } = render(awardsView(true, handle));
    act(() => handle.current!.setStar('wait'));
    const button = container.querySelector<HTMLButtonElement>('[data-award-select="2"]')!;
    act(() => button.focus());
    fireEvent.click(button);
    expect(stageOf(container)).toHaveAttribute('data-star', 'wait');
    expect(container.querySelector('[data-orbit-center]')?.textContent).toContain(awards[1].project);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('테두리: 2D 컨텍스트가 있으면 활성일 때 프레임마다, 모션 감소면 한 번만 그린다', () => {
    const contexts: FakeContext[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => { const c = fakeContext(); contexts.push(c); return c; }) as unknown as HTMLCanvasElement['getContext']);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) { return this instanceof HTMLCanvasElement ? 500 : 0; });
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) { return this instanceof HTMLCanvasElement ? 500 : 0; });
    const strokes = () => contexts.reduce((n, c) => n + c.stroke.mock.calls.length, 0);

    const active = render(awardsView());
    expect(active.container.querySelector('[data-star-rim]')).toHaveAttribute('data-ready');
    const first = strokes();
    step(1000);
    step(1050);
    step(1100);
    expect(strokes()).toBe(first + 3);
    expect(frames.size).toBe(1);
    active.unmount();

    contexts.length = 0;
    reducedMotion = true;
    render(awardsView());
    expect(strokes()).toBe(1);
    step(1000);
    step(2000);
    expect(strokes()).toBe(1);
    expect(frames.size).toBe(0);
    // 크기를 다시 재면 캔버스가 지워진다. 멈춘 테두리도 한 번 다시 그린다.
    fireEvent(window, new Event('resize'));
    expect(strokes()).toBe(2);
    expect(frames.size).toBe(0);
  });

  it('앞에 온 자격증 카드는 두 궤도선(5) 위, 앞의 수상 카드 아래에 놓인다', () => {
    const { container } = render(awardsView());
    for (let t = 1000; t <= 1500; t += 50) step(t);
    const certificate = container.querySelector<HTMLElement>('[data-orbit-cert]')!;
    const frontAward = [...container.querySelectorAll<HTMLElement>('[data-orbit-node]')].find((node) => node.style.getPropertyValue('--orbit-layer') !== '2')!;
    expect(certificate.style.getPropertyValue('--orbit-layer')).toBe('6');
    expect(frontAward.style.getPropertyValue('--orbit-layer')).toBe('7');
    expect(cssRule('.awards-ring-front')).toContain('z-index: 5');
    expect(cssRule('.awards-center')).toContain('z-index: 8');
    expect(cssRule('[data-star-rim]')).toContain('z-index: 9');
  });
});
