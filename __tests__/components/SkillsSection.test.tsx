import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import SkillsSection from '@/components/sections/SkillsSection';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
import { skillLedger, skillInventory } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'components/sections/SkillsSection/index.tsx'),
  'utf8'
);

// SectionHeader(T5 소유)가 framer-motion whileInView로 IntersectionObserver를
// 쓴다. jsdom에는 없어 HomeClient.test.tsx와 같은 방식으로 스텁한다.
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      takeRecords: vi.fn(() => []),
      unobserve: vi.fn(),
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SkillsSection — 증거 우선 레저', () => {
  it('id를 SECTION_IDS.SKILLS로 렌더한다', () => {
    const { container } = render(<SkillsSection />);
    expect(container.querySelector(`#${SECTION_IDS.SKILLS}`)).not.toBeNull();
  });

  // 이 섹션이 존재하는 이유. 채용 담당자가 기술 이름이 아니라 증거를
  // 먼저 읽어야 한다. D23 표의 이름·증거·연결 프로젝트 문구를 하나라도
  // 바꾸거나 행을 지우면 FAIL한다.
  it('핵심 6개의 이름·증거·연결 프로젝트가 D23 표 그대로 각자 행에 있다', () => {
    const { container } = render(<SkillsSection />);
    expect(skillLedger).toHaveLength(6);

    for (const entry of skillLedger) {
      const row = container.querySelector(
        `[data-skill-ledger-entry="${entry.name}"]`
      );
      expect(row, `${entry.name} 행이 없다`).not.toBeNull();
      expect(row?.textContent, `${entry.name}의 증거가 없다`).toContain(
        entry.evidence
      );
      expect(
        row?.textContent,
        `${entry.name}의 연결 프로젝트가 없다`
      ).toContain(entry.projects);
    }
  });

  // D23 표 자체를 문자열로 고정한다. 위 테스트는 렌더가 데이터를 그대로
  // 옮기는지만 보므로 데이터 자체가 D23과 다르게 바뀌어도 못 잡는다.
  // 여섯 행 전부를 리터럴로 고정해야 어느 한 행만 조용히 바뀌는 것도
  // 잡힌다.
  it('D23 표 문구 자체가 여섯 행 전부 정확하다', () => {
    expect(skillLedger).toEqual([
      {
        name: 'React',
        evidence:
          '컴포넌트 구독 범위를 Profiler로 진단하고 불필요한 연쇄 렌더를 제거',
        projects: 'AlphaMail · TDS · Ttabong',
      },
      {
        name: 'TypeScript',
        evidence:
          'strict/no-any와 타입 기반 디자인 토큰으로 잘못된 참조를 컴파일 단계에서 차단',
        projects: 'TDS · AlphaMail · Portfolio · Ttabong',
      },
      {
        name: 'Next.js',
        evidence: 'SSG/SSR·SEO를 적용하고 hydration 경고를 0건으로 정리',
        projects: 'Portfolio',
      },
      {
        name: 'React Query',
        evidence:
          '중복 폴링을 단일 20초 전략으로 통합하고 사용자 액션 완료 시 캐시를 즉시 무효화',
        projects: 'AlphaMail',
      },
      {
        name: 'Zustand',
        evidence:
          '입력 한 번당 4~5회 연쇄 렌더를 해당 필드 구독 컴포넌트 1회로 축소',
        projects: 'AlphaMail · Ttabong',
      },
      {
        name: 'Tailwind CSS',
        evidence:
          '세 웹 프로젝트에서 반응형 UI와 공통 스타일 규칙을 일관되게 적용',
        projects: 'AlphaMail · Portfolio · Ttabong',
      },
    ]);
  });

  // 목록 하나가 다른 항목으로 조용히 바뀌어도 길이(11)는 그대로일 수
  // 있다. 순서까지 포함해 브리프의 11개 그대로인지 리터럴로 고정한다.
  it('Inventory 11개가 브리프 목록 그대로이고 GitHub 표기가 정상화됐다', () => {
    expect(skillInventory).toEqual([
      'JavaScript',
      'Python',
      'Java',
      'Node.js',
      'Spring Framework',
      'MySQL',
      'Linux',
      'GitHub',
      'Figma',
      'Notion',
      'Jira',
    ]);

    const { container } = render(<SkillsSection />);
    const inventory = container.querySelector('[data-skill-inventory]');
    expect(inventory, 'Inventory 컨테이너가 없다').not.toBeNull();
    const inventoryText = inventory?.textContent ?? '';

    for (const item of skillInventory) {
      expect(inventoryText, `${item}이 Inventory에 없다`).toContain(item);
    }
  });

  // Inventory는 핵심 6개와 달리 설명·숙련도·아이콘이 없는 낮은 위계다.
  // 개별 아이콘(next/image)이나 핵심 6개와 같은 행 강조가 새어 들어오면
  // 이 계약이 깨진다.
  it('Inventory 항목에는 설명도 숙련도도 아이콘도 없다', () => {
    const { container } = render(<SkillsSection />);
    expect(container.querySelectorAll('img')).toHaveLength(0);

    const inventory = container.querySelector('[data-skill-inventory]');
    // 핵심 6개 행과 같은 강조(border-b 헤어라인 행)를 Inventory 안에
    // 만들면 이 계약이 깨진다.
    expect(inventory?.querySelectorAll('[data-skill-ledger-entry]')).toHaveLength(
      0
    );
  });

  // 컨트롤러가 프로덕션 빌드 1920x1080에서 실측: Hyperspeed 광선이 정확히
  // Inventory 줄 높이를 지나가 GitHub·Figma·Notion·Jira 뒷부분과
  // INVENTORY 라벨의 대비가 무너졌다. 스크림이 없어지거나 전면 카드(불투명
  // 단색 배경)로 바뀌면 이 테스트가 잡는다.
  it('Inventory 텍스트 뒤에 스크림이 있고 평평한 막이 아니라 그라데이션이다', () => {
    const { container } = render(<SkillsSection />);
    const scrim = container.querySelector('[data-skill-inventory-scrim]');
    expect(scrim, 'Inventory 스크림이 없다').not.toBeNull();

    // 장식이라 스크린리더에서 빠지고 클릭을 가로채지 않아야 한다.
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    expect(scrim?.className).toMatch(/\bpointer-events-none\b/);
    // 콘텐츠보다 아래에 깔려야 텍스트를 가리지 않는다. absolute 없이
    // -z만 있으면 문서 흐름이 무너지고, -z 없이 absolute만 있으면
    // z-index:auto라 뒤에 오는 정적 배치 문단 위로 올라온다(같은 z-index
    // auto에서는 나중에 그려지는 비배치 콘텐츠가 이긴다).
    expect(scrim?.className).toMatch(/\babsolute\b/);
    expect(scrim?.className).toMatch(/-z-\[1\]/);

    const background = (scrim as HTMLElement).style.background;
    expect(background, '평평한 단색이 아니라 그라데이션이어야 한다').toMatch(
      /gradient/
    );
  });

  it('탭과 AnimatePresence와 아이콘 격자를 쓰지 않는다 (framer-motion import가 0개)', () => {
    expect(SOURCE).not.toMatch(/framer-motion/);
    expect(SOURCE).not.toMatch(/AnimatePresence/);
    expect(SOURCE).not.toMatch(/SegmentedControl/);
    expect(SOURCE).not.toMatch(/next\/image/);
    expect(SOURCE).not.toMatch(/whileInView/);
  });

  it('증거가 line-clamp나 말줄임으로 잘리지 않는다', () => {
    expect(SOURCE).not.toMatch(/line-clamp/);
    expect(SOURCE).not.toMatch(/truncate/);
    expect(SOURCE).not.toMatch(/text-ellipsis/);
  });

  // SectionHeader(T5 소유, 아직 라이트 팔레트)는 이 검사 범위에서 뺀다.
  // 이 태스크가 새로 쓴 레저·Inventory 마크업만 다크 팔레트를 지키면 된다.
  it('레저와 Inventory 마크업에 팔레트 위반이 0건이다', () => {
    const { container } = render(<SkillsSection />);
    const rows = Array.from(
      container.querySelectorAll('[data-skill-ledger-entry]')
    );
    const inventory = container.querySelector('[data-skill-inventory]');
    const scopedHtml = [...rows, inventory]
      .map((el) => el?.innerHTML ?? '')
      .join('');

    expect(scopedHtml.length, '검사 대상 마크업을 못 찾았다').toBeGreaterThan(0);
    expect(findTailwindPaletteColorUtilities(scopedHtml)).toEqual([]);
  });

  // 이 저장소의 SEO 계약. 크롤러는 HTML을 읽지 Ctrl+F를 쓰지 않는다.
  it('의미 콘텐츠가 SSR HTML에 존재한다', () => {
    const html = renderToString(<SkillsSection />);
    expect(html).toContain(`id="${SECTION_IDS.SKILLS}"`);
    for (const entry of skillLedger) {
      expect(html).toContain(entry.name);
      expect(html).toContain(entry.evidence);
      expect(html).toContain(entry.projects);
    }
    for (const item of skillInventory) {
      expect(html).toContain(item);
    }
  });
});
