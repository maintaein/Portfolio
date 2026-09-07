import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AwardsAndCertificatesSection from '@/components/sections/AwardAndCertificatesSection';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
import { awards, certificates } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'components/sections/AwardAndCertificatesSection/index.tsx'),
  'utf8'
);

// 원장의 줄 순서. 수상이 먼저, 자격증이 뒤에 오고 번호는 이어진다.
const TITLES = [
  ...awards.map((award) => award.title),
  ...certificates.map((certificate) => certificate.name),
];

// 펼친 판의 로고 폭 상한. 컴포넌트와 같은 값이어야 비율 검사가 성립한다.
const PANEL_LOGO_MAX_WIDTH = 148;

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

function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-ledger-row]')];
}

function toggle(title: string): HTMLElement {
  const row = rows().find((node) => node.dataset.ledgerRow === title);
  expect(row, `${title} 줄이 없다`).toBeDefined();
  return row!.querySelector('button')!;
}

function panelOf(title: string): HTMLElement {
  const id = toggle(title).getAttribute('aria-controls')!;
  const panel = document.getElementById(id);
  expect(panel, `${title}의 판이 없다`).not.toBeNull();
  return panel!;
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
      for (const field of ['name', 'organization', 'date', 'grade', 'logo'] as const) {
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

    for (const certificate of certificates) {
      expect(certificate.grade, `${certificate.name}의 등급`).toMatch(/^[가-힣A-Z0-9\s]+$/);
    }
  });
});

describe('AwardsAndCertificatesSection', () => {
  it('수상과 자격증을 한 원장에 번호를 이어 세운다', () => {
    render(<AwardsAndCertificatesSection />);

    expect(rows().map((row) => row.dataset.ledgerRow)).toEqual(TITLES);

    const indexes = [...document.querySelectorAll('[data-ledger-field="index"]')].map(
      (node) => node.textContent
    );
    expect(indexes).toEqual(TITLES.map((_, index) => String(index + 1)));
  });

  it('계기 줄의 개수가 두 목록을 합친 수와 맞는다', () => {
    render(<AwardsAndCertificatesSection />);

    expect(document.querySelector('[data-ledger-count]')!.textContent).toBe(
      String(awards.length + certificates.length)
    );
  });

  // 처음에는 제목과 등급만 보이는 표다. 상세는 누른 뒤에 온다.
  it('처음에는 모든 줄이 접혀 있다', () => {
    render(<AwardsAndCertificatesSection />);

    for (const title of TITLES) {
      expect(toggle(title).getAttribute('aria-expanded')).toBe('false');
    }
    expect(rows().filter((row) => row.dataset.ledgerOpen === 'true')).toHaveLength(0);
  });

  it('줄을 누르면 상세가 펼쳐진다', async () => {
    const user = userEvent.setup();
    render(<AwardsAndCertificatesSection />);

    const award = awards[0];
    await user.click(toggle(award.title));

    expect(toggle(award.title).getAttribute('aria-expanded')).toBe('true');

    const panel = panelOf(award.title);
    expect(panel.getAttribute('aria-hidden')).toBe('false');
    expect(panel.textContent).toContain(award.organization);
    expect(panel.textContent).toContain(award.project);
    expect(panel.textContent).toContain(award.date);
    expect(panel.textContent).toContain(award.description);
  });

  // 여러 줄이 한꺼번에 열리면 가운데 정렬이 화면 밖으로 밀려 방금 누른
  // 줄이 눈에서 사라진다.
  it('다른 줄을 누르면 앞서 열린 줄이 닫힌다', async () => {
    const user = userEvent.setup();
    render(<AwardsAndCertificatesSection />);

    await user.click(toggle(awards[0].title));
    await user.click(toggle(awards[1].title));

    expect(toggle(awards[0].title).getAttribute('aria-expanded')).toBe('false');
    expect(toggle(awards[1].title).getAttribute('aria-expanded')).toBe('true');
    expect(rows().filter((row) => row.dataset.ledgerOpen === 'true')).toHaveLength(1);
  });

  it('열린 줄을 다시 누르면 닫힌다', async () => {
    const user = userEvent.setup();
    render(<AwardsAndCertificatesSection />);

    await user.click(toggle(awards[0].title));
    await user.click(toggle(awards[0].title));

    expect(toggle(awards[0].title).getAttribute('aria-expanded')).toBe('false');
    expect(rows().filter((row) => row.dataset.ledgerOpen === 'true')).toHaveLength(0);
  });

  // 높이를 재지 않고 여는 방식이라 판이 DOM에 남아 있어야 한다. 언마운트로
  // 바꾸면 전환이 시작점을 잃고 툭 튀어나온다.
  it('접힌 판도 DOM에 남되 접근성 트리에서는 빠진다', () => {
    render(<AwardsAndCertificatesSection />);

    for (const title of TITLES) {
      const panel = panelOf(title);
      expect(panel.getAttribute('aria-hidden')).toBe('true');
      expect(panel.className).toContain('grid-rows-[0fr]');
    }
  });

  it('자격증도 같은 줄 모양으로 발급처와 유효 기간을 편다', async () => {
    const user = userEvent.setup();
    render(<AwardsAndCertificatesSection />);

    const certificate = certificates[0];
    await user.click(toggle(certificate.name));

    const panel = panelOf(certificate.name);
    expect(panel.textContent).toContain(certificate.organization);
    expect(panel.textContent).toContain(certificate.date);
    expect(panel.textContent).toContain(certificate.validUntil!);
    expect(toggle(certificate.name).textContent).toContain(certificate.grade);
  });

  // 줄이 열려 상자가 커져도 세로 가운데 정렬은 auto 마진이 쥔다.
  // items-center로 바꾸면 내용이 길 때 위쪽이 잘려 스크롤로도 닿지 못한다.
  it('상자가 커져도 세로 가운데 정렬을 auto 마진으로 유지한다', () => {
    const { container } = render(<AwardsAndCertificatesSection />);

    const section = container.querySelector('section')!;
    expect(section.className).toContain('min-h-full');
    expect(section.className).not.toContain('items-center');
    expect(container.querySelector('.section-plate')!.className).toContain('m-auto');
  });

  it('로고 마스크가 실제로 있는 파일을 가리키고 원본 비율과 맞는다', () => {
    render(<AwardsAndCertificatesSection />);

    const logos = [...document.querySelectorAll<HTMLElement>('.org-logo')];
    expect(logos).toHaveLength(TITLES.length);

    for (const logo of logos) {
      const file = logoFile(logo);
      const source = pngSize(file);
      const height = Number.parseFloat(logo.style.height);
      const width = Number.parseFloat(logo.style.width);

      expect(width, `${file}의 슬롯 폭`).toBe(
        Math.min(PANEL_LOGO_MAX_WIDTH, Math.round((height * source.width) / source.height))
      );
    }
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
