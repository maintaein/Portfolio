import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AwardsAndCertificatesSection from '@/components/sections/AwardAndCertificatesSection';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
import { awards, certificates } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'components/sections/AwardAndCertificatesSection/index.tsx'),
  'utf8'
);

// PNG는 8바이트 시그니처 뒤에 바로 IHDR이 오고 폭과 높이가 16~23바이트에
// 빅엔디언 4바이트씩 들어 있다. 라이브러리 없이 읽는다.
function pngSize(file: string): { width: number; height: number } {
  const buffer = readFileSync(resolve(process.cwd(), 'public/logos-mono', file));
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function logoFile(element: HTMLElement): string {
  const source = element.style.getPropertyValue('--org-logo-src');
  const file = source.match(/\/logos-mono\/([\w-]+\.png)\)/)?.[1];
  expect(file, `--org-logo-src를 읽을 수 없다: ${source}`).toBeDefined();
  return file!;
}

describe('수상과 자격증 데이터', () => {
  // 이 섹션이 파는 것은 스스로 쓴 설명이 아니라 바깥에서 받은 검증이다.
  // 열 하나가 비면 행이 어긋나는 정도가 아니라 검증 자체가 반쪽이 된다.
  it('수상 행의 필수 열이 하나도 비어 있지 않다', () => {
    expect(awards.length).toBeGreaterThan(0);

    for (const award of awards) {
      for (const field of ['title', 'organization', 'date', 'rank', 'project', 'logo'] as const) {
        expect(award[field].trim(), `${award.title}의 ${field}`).not.toBe('');
      }
    }
  });

  it('자격증 행의 필수 열이 하나도 비어 있지 않다', () => {
    expect(certificates.length).toBeGreaterThan(0);

    for (const certificate of certificates) {
      for (const field of ['name', 'organization', 'date', 'logo'] as const) {
        expect(certificate[field].trim(), `${certificate.name}의 ${field}`).not.toBe('');
      }
    }
  });

  // 트로피 이모지는 등급 문자열 안에 섞여 있었다. 데이터에 남아 있으면
  // 컴포넌트를 아무리 정리해도 화면에 그대로 다시 나온다.
  it('등급 문자열에 장식 이모지가 없다', () => {
    for (const award of awards) {
      expect(award.rank, `${award.title}의 등급`).toMatch(/^[가-힣\s]+$/);
    }
  });
});

describe('AwardsAndCertificatesSection', () => {
  it('수상을 데이터 순서 그대로 렌더한다', () => {
    render(<AwardsAndCertificatesSection />);

    const rows = [...document.querySelectorAll('[data-award-row]')];
    expect(rows.map((row) => row.getAttribute('data-award-row'))).toEqual(
      awards.map((award) => award.title)
    );
  });

  // D4: 등급·대회·관련 프로젝트·주관사·날짜가 한 행에 모두 있어야 한다.
  it('각 행이 등급·대회·주관사·프로젝트·날짜를 모두 담는다', () => {
    render(<AwardsAndCertificatesSection />);

    const rows = [...document.querySelectorAll('[data-award-row]')];
    rows.forEach((row, index) => {
      const award = awards[index];
      const read = (field: string) =>
        row.querySelector(`[data-award-field="${field}"]`)?.textContent ?? '';

      expect(read('rank')).toBe(award.rank);
      expect(read('title')).toBe(award.title);
      expect(read('date')).toBe(award.date);
      expect(read('meta')).toContain(award.organization);
      expect(read('meta')).toContain(award.project);
    });
  });

  // 화면에서 읽는 순서와 DOM 순서가 어긋나면 스크린리더 사용자만 다른
  // 이야기를 듣는다.
  it('행 안 DOM 순서가 시각 순서와 같다', () => {
    render(<AwardsAndCertificatesSection />);

    const row = document.querySelector('[data-award-row]')!;
    const order = [...row.querySelectorAll('[data-award-field]')].map((node) =>
      node.getAttribute('data-award-field')
    );
    expect(order).toEqual(['rank', 'title', 'description', 'meta', 'date']);
  });

  // D4: 자격증 한 건 때문에 탭을 만들지 않는다. 같은 화면 안에 있어야
  // 하고, 위계는 수상보다 낮아야 한다.
  it('자격증이 탭 없이 같은 화면의 낮은 위계 행으로 있다', () => {
    render(<AwardsAndCertificatesSection />);

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();

    const rows = [...document.querySelectorAll('[data-credential-row]')];
    expect(rows.map((row) => row.getAttribute('data-credential-row'))).toEqual(
      certificates.map((certificate) => certificate.name)
    );

    // 수상 제목은 t4, 자격증 이름은 t5다. 같은 크기면 둘의 위계가 무너진다.
    const title = document.querySelector('[data-award-field="title"]')!;
    const name = document.querySelector('[data-credential-field="name"]')!;
    expect(title.className).toContain('text-t4');
    expect(name.className).toContain('text-t5');
  });

  it('계기 줄의 개수가 실제 데이터 개수와 맞는다', () => {
    render(<AwardsAndCertificatesSection />);

    expect(document.querySelector('[data-award-count]')!.textContent).toBe(
      String(awards.length).padStart(2, '0')
    );
    expect(document.querySelector('[data-credential-count]')!.textContent).toBe(
      String(certificates.length).padStart(2, '0')
    );
  });

  it('로고 마스크가 실제로 있는 파일을 가리키고 슬롯 폭이 원본 비율과 맞는다', () => {
    render(<AwardsAndCertificatesSection />);

    const logos = [
      ...document.querySelectorAll('[data-award-logo], [data-credential-logo]'),
    ] as HTMLElement[];
    expect(logos).toHaveLength(awards.length + certificates.length);

    for (const logo of logos) {
      const file = logoFile(logo);
      const { width, height } = pngSize(file);
      const slotHeight = Number.parseInt(logo.style.height, 10);
      expect(slotHeight, `${file}의 슬롯 높이`).toBeGreaterThan(0);
      expect(Number.parseInt(logo.style.width, 10), `${file}의 슬롯 폭`).toBe(
        Math.round((slotHeight * width) / height)
      );
    }
  });

  // 로고 폭이 30px에서 97px까지 벌어진다. 열을 auto로 두면 행마다 로고
  // 폭이 그 행의 열 너비가 돼서 넓은 로고가 있는 행만 제목이 밀린다.
  // jsdom은 레이아웃을 하지 않으므로 열 정의가 두 목록에서 같은지 본다.
  it('수상과 자격증이 같은 고정 폭 로고 열을 쓴다', () => {
    render(<AwardsAndCertificatesSection />);

    const columns = [
      ...document.querySelectorAll('[data-award-row], [data-credential-row]'),
    ].map((row) => [...row.classList].find((name) => name.includes('grid-cols-')));

    expect(columns).toHaveLength(awards.length + certificates.length);
    expect(new Set(columns).size, `행마다 다른 열 정의: ${columns.join(', ')}`).toBe(1);
    expect(columns[0]).not.toContain('auto_1fr');
  });

  // A-0: 화면에 보이는 섹션 제목은 전부 뺐고 h2는 접근성 트리에만 남는다.
  it('섹션 제목이 sr-only로만 남는다', () => {
    const { container } = render(<AwardsAndCertificatesSection />);

    const section = container.querySelector('section')!;
    expect(section.id).toBe(SECTION_IDS.AWARDS_CERTIFICATES);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.className).toContain('sr-only');
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  // 밝은 테마의 흔적. 이 섹션은 카드·배지·흰 배경을 통째로 걷어냈다.
  it('테일윈드 팔레트 색을 쓰지 않는다', () => {
    expect(findTailwindPaletteColorUtilities(SOURCE)).toEqual([]);
  });

  // A-0: 콘텐츠가 앉는 상자에만 검정 판을 깐다. 섹션 전체에 깔면 판의
  // 경계가 푸터와 맞닿는 자리에서 색 단차로 드러난다.
  it('콘텐츠 상자에만 어두운 판을 깐다', () => {
    const { container } = render(<AwardsAndCertificatesSection />);

    expect(container.querySelector('section')!.className).not.toContain('section-plate');
    expect(container.querySelector('.section-plate')).not.toBeNull();
  });
});
