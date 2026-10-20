import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INTRO_GATE_SCRIPT } from '@/lib/introGate';
vi.mock('@/components/blocks/LuminousFlowBackground', () => ({ default: () => null }));
vi.mock('@/components/sections/AboutSection/styles.module.css', () => ({ default: {} }));
vi.mock('@/components/sections/AboutSection/chapter-focus.module.css', () => ({ default: {} }));
import HomeClient from '@/components/sections/HomeClient';
import {
  awards,
  coreValues,
  experiences,
  projects,
  skillCategories,
} from '@/lib/data';
import {
  HOME_SECTION_CONFIG,
  SECTION_IDS,
  type HomeSectionId,
} from '@/lib/constants';

const alphaMail = projects.find(({ title }) => title === 'AlphaMail')!;
const reactSkill = skillCategories
  .flatMap((category) => category.skills)
  .find((skill) => skill.name === 'React')!;
const semanticMarkerBySection = {
  [SECTION_IDS.ABOUT]: coreValues[0].description.split('\n\n')[0],
  [SECTION_IDS.PROJECTS]: alphaMail.title,
  [SECTION_IDS.EXPERIENCE]: experiences[0].position,
  [SECTION_IDS.SKILLS]: reactSkill.description,
  [SECTION_IDS.AWARDS_CERTIFICATES]: awards[0].title,
} satisfies Record<HomeSectionId, string>;

describe('HomeClient 실제 섹션 SSR 상주', () => {
  it('실제 lib/data의 다섯 의미 콘텐츠를 각 section shell 안에 렌더한다', () => {
    const html = renderToString(<HomeClient />);

    for (const [index, { id }] of HOME_SECTION_CONFIG.entries()) {
      const start = html.indexOf(`data-section="${id}"`);
      const nextId = HOME_SECTION_CONFIG[index + 1]?.id;
      const end = nextId
        ? html.indexOf(`data-section="${nextId}"`)
        : html.length;

      expect(start, `${id} 래퍼가 서버 HTML에 없다`).toBeGreaterThan(-1);
      expect(end, `${id} 다음 섹션 경계를 찾지 못했다`).toBeGreaterThan(start);
      expect(
        html.slice(start, end),
        `${id} 실제 의미 콘텐츠가 서버 HTML에 없다`
      ).toContain(semanticMarkerBySection[id]);
    }
  });

  it('AWARDS-CERTIFICATES(다섯 번째 섹션)가 실제 데이터와 함께 SSR HTML에 상주한다', () => {
    // 위 테스트는 HOME_SECTION_CONFIG를 순회하므로 AWARDS-CERTIFICATES가
    // 설정에서 통째로 빠지면(뮤테이션 b) 순회 범위 자체가 줄어 못 잡는다.
    // 'awards-certificates'를 리터럴로 직접 찾는 이 테스트가 그 구멍을 막는다.
    const html = renderToString(<HomeClient />);

    expect(html).toContain('data-section="awards-certificates"');
    expect(html).toContain(awards[0].title);
  });
});

it('keeps the approved static Hero text and real future name destinations in SSR', () => {
  const html = renderToString(<HomeClient />);
  expect(html).toMatch(/<h1[^>]*>안녕하세요.\nSW개발자 김태인입니다.<\/h1>/);
  expect(html).not.toContain('탄탄한 기본기를');
  expect(html).toContain('data-motion-anchor="hero-name"');
  expect(html).toContain('data-motion-anchor="nav-name"');
  expect(html).not.toContain('section-hidden');
});

// 사용자 결정(2026-10-20). 커튼과 네 인사말이 없다. JS가 없으면 표시가 붙지 않아 완성된 첫 화면이다.
it('ships no curtain and no greeting paragraph in SSR', () => {
  const html = renderToString(<HomeClient />);
  expect(html).not.toMatch(/intro-curtain|intro-greeting|잘부탁드립니다/);
  expect(html).not.toContain('data-intro=');
  const hero = html.slice(html.indexOf('id="overview"'), html.indexOf('data-section="about"'));
  expect(hero).not.toContain('<p');
  // 이름 버튼은 안쪽 span 하나를 품는다. 인트로는 그 span만, 경계는 버튼만 움직인다.
  expect(html).toMatch(/data-testid="wordmark"[^>]*><span class="inline-block">KIM TAEIN<\/span><\/button>/);
});

// Task 5. JS가 없거나 오기 전에도 이름은 Hero 자리(CSS 배치)에 크게 선다. 빈 띠도, nav에서 뛰어내리는 첫 그림도 없다.
it('ships the one name button in its Hero rest state inside the Hero name slot', () => {
  const html = renderToString(<HomeClient />);
  const hero = html.slice(html.indexOf('id="overview"'), html.indexOf('data-section="about"'));
  expect(hero).toMatch(/data-motion-anchor="hero-name"[^>]*><button[^>]*data-testid="wordmark"[^>]*data-wordmark-mode="hero"/);
  expect(html.match(/data-testid="wordmark"/g)).toHaveLength(1);
  expect(html.match(/data-wordmark-mode=/g)).toHaveLength(1);
  const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
  expect(nav).toMatch(/data-motion-anchor="nav-name"[^>]*><\/div>/);
  const css = readFileSync('styles/design-tokens.css', 'utf8');
  expect(css).toMatch(/\.site-name\[data-wordmark-mode='hero'\] \{[^}]*position: absolute;[^}]*left: 0; right: 0; margin-inline: auto; width: max-content; font-size: var\(--hero-name-size\);/);
  expect(css).toMatch(/\.site-name\[data-wordmark-mode='nav'\] \{ position: fixed; z-index: 51; \}/);
  // 쉬는 자리에는 transform이 없다. 누르는 상자가 보이는 글자 줄이다.
  expect(css).not.toMatch(/\.site-name[^{]*\{[^}]*(transform|scale)/);
});

// 최종 리뷰 I2. JS가 없거나 하이드레이션 전, 본 번들이 실패해도 About의 활성 chapter는 읽혀야 한다.
// 숨긴 출발점은 HomeClient가 하이드레이션 뒤에 켜는 main[data-route-resolved="true"] 아래에서만 건다.
it('About의 BASICS chapter와 단어는 서버 상태에서 CSS로 숨지 않는다', () => {
  const html = renderToString(<HomeClient />);
  expect(html).toMatch(/<main[^>]*data-route-resolved="false"/);
  const basics = html.match(/<article[^>]*data-chapter="BASICS"[^>]*>/)![0];
  expect(basics).toContain('data-position="active"');
  expect(basics).not.toMatch(/inert|aria-hidden="true"/);
  expect(html).toMatch(/data-chapter-word="BASICS"[^>]*><span>BASICS<\/span>/);
  const css = ['styles.module.css', 'chapter-focus.module.css']
    .map(name => readFileSync(`components/sections/AboutSection/${name}`, 'utf8'))
    .join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const hidden = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , body]) => /(^|[\s;])opacity:\s*0\s*(;|$)/.test(body))
    .flatMap(([, selectors]) => selectors.split(',').map(selector => selector.trim()))
    .filter(selector => /\.(articles|rail|word|label)(\[[^\]]*\]|:[\w-]+(\([^)]*\))?)*$/.test(selector));
  expect(hidden.length).toBeGreaterThan(0);
  for (const selector of hidden) expect(selector).toMatch(/^main\[data-route-resolved="true"\] /);
});

describe('그리기 전 인트로 판정(lib/introGate.ts)', () => {
  const run = ({ path = '/', hash = '', reduced = false, type = 'navigate', saved }: { path?: string; hash?: string; reduced?: boolean; type?: string; saved?: number }) => {
    document.documentElement.removeAttribute('data-intro');
    window.history.replaceState(saved === undefined ? null : { sectionScrollY: saved }, '', `${path}${hash}`);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query.includes('reduce') }));
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type } as unknown as PerformanceEntry]);
    new Function(INTRO_GATE_SCRIPT)();
    return document.documentElement.hasAttribute('data-intro');
  };
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); document.documentElement.removeAttribute('data-intro'); });

  it('첫 방문 / 와 #overview만 진입 출발 상태를 건다', () => {
    expect(run({})).toBe(true);
    expect(run({ hash: '#overview' })).toBe(true);
    expect(run({ type: 'reload', saved: 0 })).toBe(true);
  });
  it.each([
    ['직접 해시', { hash: '#about' }],
    ['모션 감소', { reduced: true }],
    ['앞뒤 이동', { type: 'back_forward' }],
    ['저장된 읽기 위치가 있는 새로고침', { type: 'reload', saved: 900 }],
    // 최종 리뷰 triage. 다른 경로에 표시가 남으면 load 뒤 3초 안의 클라이언트 이동으로 / 에서 인트로가 시작된다.
    ['/ 밖의 경로', { path: '/background-preview' }],
  ] as const)('%s는 완성된 첫 화면으로 바로 간다', (_, options) => {
    expect(run(options)).toBe(false);
  });
  // 리뷰 Important 3. 시간을 나눠 도는 하이드레이션이 load 뒤 1초를 넘길 수 있다.
  it('본 번들이 진입을 맡지 못하면 load 3초 뒤 숨긴 출발 상태를 걷고, 맡으면 손대지 않는다', () => {
    vi.useFakeTimers();
    run({});
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(2999);
    expect(document.documentElement.hasAttribute('data-intro')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(document.documentElement.hasAttribute('data-intro')).toBe(false);
    run({});
    document.documentElement.setAttribute('data-intro', 'playing');
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(10_000);
    expect(document.documentElement.getAttribute('data-intro')).toBe('playing');
  });
});
