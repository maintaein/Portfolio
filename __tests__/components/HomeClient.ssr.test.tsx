import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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
const semanticMarkerBySection = {
  [SECTION_IDS.ABOUT]: coreValues[0].description,
  [SECTION_IDS.PROJECTS]: alphaMail.title,
  [SECTION_IDS.EXPERIENCE]: experiences[0].position,
  [SECTION_IDS.SKILLS]: skillCategories[0].label,
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
});
