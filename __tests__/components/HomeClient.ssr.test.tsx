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
  expect(html).toContain('탄탄한 기본기를 바탕으로 꾸준히 개선하고, 협업으로 함께 성장하는 개발자.');
  expect(html).toContain('data-motion-anchor="hero-name"');
  expect(html).toContain('data-motion-anchor="nav-name"');
  expect(html).not.toContain('section-hidden');
});

// 커튼은 서버 HTML에 있지만 CSS가 html[data-intro]일 때만 보인다. JS가 없으면 표시가 붙지 않아 완성된 첫 화면이다.
it('ships the curtain hidden by default and the greetings once for readers in SSR', () => {
  const html = renderToString(<HomeClient />);
  expect(html).toContain('class="intro-curtain" aria-hidden="true"');
  expect(html).not.toContain('data-intro=');
  const hero = html.slice(html.indexOf('id="overview"'), html.indexOf('data-section="about"'));
  expect(hero).toContain('<p class="sr-only">안녕하세요. SW개발자. 김태인입니다. 잘부탁드립니다.</p>');
  expect(hero.match(/<p/g)).toHaveLength(1);
  // 이름 버튼은 안쪽 span 하나를 품는다. 인트로는 그 span만, 경계는 버튼만 움직인다.
  expect(html).toMatch(/data-testid="wordmark"[^>]*><span class="inline-block">KIM TAEIN<\/span><\/button>/);
});

describe('그리기 전 인트로 판정(lib/introGate.ts)', () => {
  const run = ({ hash = '', reduced = false, type = 'navigate', saved }: { hash?: string; reduced?: boolean; type?: string; saved?: number }) => {
    document.documentElement.removeAttribute('data-intro');
    window.history.replaceState(saved === undefined ? null : { sectionScrollY: saved }, '', `/${hash}`);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query.includes('reduce') }));
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type } as unknown as PerformanceEntry]);
    new Function(INTRO_GATE_SCRIPT)();
    return document.documentElement.hasAttribute('data-intro');
  };
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); document.documentElement.removeAttribute('data-intro'); });

  it('첫 방문 / 와 #overview만 커튼을 건다', () => {
    expect(run({})).toBe(true);
    expect(run({ hash: '#overview' })).toBe(true);
    expect(run({ type: 'reload', saved: 0 })).toBe(true);
  });
  it.each([
    ['직접 해시', { hash: '#about' }],
    ['모션 감소', { reduced: true }],
    ['앞뒤 이동', { type: 'back_forward' }],
    ['저장된 읽기 위치가 있는 새로고침', { type: 'reload', saved: 900 }],
  ] as const)('%s는 커튼 없이 바로 간다', (_, options) => {
    expect(run(options)).toBe(false);
  });
  it('본 번들이 인트로를 맡지 못하면 load 1초 뒤 커튼을 걷고, 맡으면 손대지 않는다', () => {
    vi.useFakeTimers();
    run({});
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(1000);
    expect(document.documentElement.hasAttribute('data-intro')).toBe(false);
    run({});
    document.documentElement.setAttribute('data-intro', 'playing');
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(10_000);
    expect(document.documentElement.getAttribute('data-intro')).toBe('playing');
  });
});
