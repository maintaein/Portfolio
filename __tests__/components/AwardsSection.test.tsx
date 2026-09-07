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

// 원장에 여닫는 줄로 서는 것은 수상뿐이다. 자격증은 한 건이라 아래 구분선
// 밑에 한 줄로 고정된다.
const TITLES = awards.map((award) => award.title);

// 로고 슬롯. 컴포넌트와 같은 값이어야 비율 검사가 성립한다.
const LOGO_MAX_WIDTH = 120;

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
  it('수상을 데이터 순서대로 번호를 이어 세운다', () => {
    render(<AwardsAndCertificatesSection />);

    expect(rows().map((row) => row.dataset.ledgerRow)).toEqual(TITLES);

    const indexes = [...document.querySelectorAll('[data-ledger-field="index"]')].map(
      (node) => node.textContent
    );
    expect(indexes).toEqual(TITLES.map((_, index) => String(index + 1)));
  });

  it('계기 줄의 개수가 수상 건수와 맞는다', () => {
    render(<AwardsAndCertificatesSection />);

    expect(document.querySelector('[data-ledger-count]')!.textContent).toBe(
      String(awards.length)
    );
  });

  // 같은 기관이 준 상은 한 마크 아래로 묶인다. 주관사 이름은 이 머리글이
  // 쥐고 있어서 줄마다 다시 적지 않는다.
  it('같은 주관사의 상을 한 묶음으로 세우고 머리글이 기관 이름을 쥔다', () => {
    render(<AwardsAndCertificatesSection />);

    const groups = [...document.querySelectorAll<HTMLElement>('[data-ledger-group]')];
    expect(groups.map((group) => group.dataset.ledgerGroup)).toEqual([
      ...new Set(awards.map((award) => award.organization)),
    ]);

    for (const group of groups) {
      expect(group.textContent).toContain(group.dataset.ledgerGroup);
    }
  });

  // 1번과 2번은 데이터상 제목의 앞부분이 같다. 그 앞부분은 묶음 머리글이
  // 이미 말하므로 줄에서는 뺀다. 남는 것은 두 줄을 실제로 가르는 부분이다.
  it('묶음 머리글이 말한 부분을 제목에서 뺀다', () => {
    render(<AwardsAndCertificatesSection />);

    for (const award of awards) {
      const shown = toggle(award.title).querySelector(
        '[data-ledger-field="title"]'
      )!.textContent!;

      expect(award.title.endsWith(shown), `${award.title}의 표시 제목`).toBe(true);
      expect(shown.startsWith(award.organization)).toBe(false);
    }

    const shownTitles = [...document.querySelectorAll('[data-ledger-field="title"]')].map(
      (node) => node.textContent
    );
    expect(new Set(shownTitles).size, '줄인 제목이 서로 겹친다').toBe(awards.length);
  });

  // 누르기 전에 무엇으로 언제 받았는지가 이미 읽힌다. 접힌 줄이 제목만
  // 보여 주면 무엇을 펼칠지 고를 근거가 없다.
  it('접힌 줄에서 이미 프로젝트와 날짜를 읽을 수 있다', () => {
    render(<AwardsAndCertificatesSection />);

    for (const award of awards) {
      const text = toggle(award.title).textContent!;
      expect(text, `${award.title}의 접힌 줄`).toContain(award.project);
      expect(text).toContain(award.date);
      expect(text).toContain(award.rank);
    }
  });

  // 처음에는 제목과 등급만 보이는 표다. 설명은 누른 뒤에 온다.
  it('처음에는 모든 줄이 접혀 있다', () => {
    render(<AwardsAndCertificatesSection />);

    for (const title of TITLES) {
      expect(toggle(title).getAttribute('aria-expanded')).toBe('false');
    }
    expect(rows().filter((row) => row.dataset.ledgerOpen === 'true')).toHaveLength(0);
  });

  it('줄을 누르면 설명이 펼쳐진다', async () => {
    const user = userEvent.setup();
    render(<AwardsAndCertificatesSection />);

    const award = awards[0];
    await user.click(toggle(award.title));

    expect(toggle(award.title).getAttribute('aria-expanded')).toBe('true');

    const panel = panelOf(award.title);
    expect(panel.getAttribute('aria-hidden')).toBe('false');
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

  // 누를 수 있게 생긴 것은 무언가를 내줘야 한다. 자격증은 펼칠 내용이 없어
  // 한 줄에 전부 적고 단추를 두지 않는다.
  it('자격증은 여닫는 단추 없이 한 줄에 전부 적는다', () => {
    render(<AwardsAndCertificatesSection />);

    const lines = [...document.querySelectorAll<HTMLElement>('[data-credential-row]')];
    expect(lines.map((line) => line.dataset.credentialRow)).toEqual(
      certificates.map((certificate) => certificate.name)
    );

    for (const [index, line] of lines.entries()) {
      const certificate = certificates[index];
      expect(line.querySelector('button'), '자격증 줄에 단추가 있다').toBeNull();
      expect(line.textContent).toContain(certificate.name);
      expect(line.textContent).toContain(certificate.organization);
      expect(line.textContent).toContain(certificate.date);
      expect(line.textContent).toContain(certificate.grade);
      expect(line.textContent).toContain(certificate.validUntil!);
    }
  });

  // 결함 수정: 눌리는 줄인데 손을 올려도 눌러도 아무 반응이 없었다.
  it('줄에 올림과 눌림과 초점 표시가 모두 있다', () => {
    render(<AwardsAndCertificatesSection />);

    const button = toggle(awards[0].title);
    expect(button.className).toContain('transition-colors');
    expect(button.className).toMatch(/hover:bg-/);
    expect(button.className).toMatch(/active:bg-/);
    expect(button.className).toContain('focus-visible:outline');
  });

  // 시안은 사용자의 한 상태에만 쓴다. 이 섹션에서 그 상태는 "열린 줄"이고,
  // 표시는 왼쪽 세로선 하나다. 초점 테두리가 나머지 하나다. 다른 자리에
  // 시안을 칠하면 강조가 아니라 그냥 글자색이 된다.
  it('시안을 열린 줄의 선과 초점 테두리에만 쓴다', () => {
    expect(SOURCE.match(/--color-cyan-/g) ?? []).toHaveLength(2);
    expect(SOURCE).toContain('border-l-[var(--color-cyan-core)]');
    expect(SOURCE).toContain('focus-visible:outline-[var(--color-cyan-hi)]');
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
    // 묶음마다 하나, 자격증마다 하나.
    expect(logos).toHaveLength(
      new Set(awards.map((award) => award.organization)).size + certificates.length
    );

    for (const logo of logos) {
      const file = logoFile(logo);
      const source = pngSize(file);
      const height = Number.parseFloat(logo.style.height);
      const width = Number.parseFloat(logo.style.width);

      expect(width, `${file}의 슬롯 폭`).toBe(
        Math.min(LOGO_MAX_WIDTH, Math.round((height * source.width) / source.height))
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
