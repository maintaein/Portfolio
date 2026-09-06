import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ExperienceSection from '@/components/sections/ExperienceSection';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'components/sections/ExperienceSection/index.tsx'),
  'utf8'
);

// PNG는 8바이트 시그니처 뒤에 바로 IHDR이 오고, 폭과 높이가 16~23바이트에
// 빅엔디언 4바이트씩 들어 있다. 라이브러리 없이 읽는다.
function pngSize(file: string): { width: number; height: number } {
  const buffer = readFileSync(resolve(process.cwd(), 'public/logos-mono', file));
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// 슬롯은 높이 32px에 폭 상한 96px이다. 마스크가 contain이라 실제 렌더 폭은
// 원본 비율로 정해지고, 워드마크는 상한에 걸린다.
const SLOT_HEIGHT = 32;
const SLOT_MAX_WIDTH = 96;

// jsdom은 레이아웃을 하지 않아 scrollLeft가 늘 0이다. 휠과 드래그가 정말
// 가로로 미는지 보려면 스크롤 가능한 요소를 흉내 내야 한다.
function makeScrollable(element: HTMLElement, scrollWidth = 1200, clientWidth = 400) {
  let left = 0;
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: (value: number) => {
      left = Math.max(0, Math.min(value, scrollWidth - clientWidth));
    },
  });
  Object.defineProperty(element, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => clientWidth });
}

// jsdom에는 PointerEvent 생성자가 없다. fireEvent.pointerDown은 그럴 때
// 밋밋한 Event로 떨어져 clientX도 button도 실어 보내지 못한다. MouseEvent로
// 만들고 포인터 전용 속성만 얹는다.
function firePointer(
  element: HTMLElement,
  type: string,
  init: MouseEventInit & { pointerType?: string } = {}
) {
  const { pointerType = 'mouse', ...mouse } = init;
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...mouse });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  fireEvent(element, event);
}

describe('ExperienceSection', () => {
  it('세 조직을 최신순 DOM 순서로 렌더한다', () => {
    render(<ExperienceSection />);

    const nodes = document.querySelectorAll('[data-experience-node]');
    expect([...nodes].map((node) => node.getAttribute('data-experience-node'))).toEqual([
      'FASOO',
      '삼성청년SW아카데미',
      '지능정보SW아카데미',
    ]);
  });

  it('노드 안의 DOM 순서가 화면에 읽히는 순서와 같다', () => {
    render(<ExperienceSection />);

    const node = document.querySelector('[data-experience-node="FASOO"]')!;
    const fields = [...node.querySelectorAll('[data-experience-field]')].map((element) =>
      element.getAttribute('data-experience-field')
    );

    expect(fields).toEqual(['period', 'company', 'position', 'responsibilities', 'skills']);
  });

  // 카드는 축 한 줄에 나란히 앉는다. 지그재그를 되살리면 카드가 축
  // 중심에서 벗어나 마름모가 카드의 50%와 어긋난다.
  it('노드가 축 한 줄에 나란히 앉고 번호가 순서대로 붙는다', () => {
    render(<ExperienceSection />);

    const nodes = [...document.querySelectorAll('[data-experience-node]')];

    expect(nodes.map((node) => node.getAttribute('data-experience-side'))).toEqual([
      null,
      null,
      null,
    ]);
    expect(nodes.map((node) => (node as HTMLElement).style.gridColumn)).toEqual(['', '', '']);
    for (const [index, node] of nodes.entries()) {
      expect(node.textContent).toContain(`NODE_0${index + 1}`);
    }
  });

  // 제목을 화면에서 뺐다. 섹션 이름을 쥔 유일한 요소라 접근성 트리에는
  // 남아 있어야 한다.
  it('제목은 화면에서 빠지되 접근성 이름으로 남는다', () => {
    const { container } = render(<ExperienceSection />);

    const heading = screen.getByRole('heading', { name: 'Experience', level: 2 });
    expect(heading.className).toContain('sr-only');
    expect(container.querySelector('section')).toHaveAttribute(
      'aria-labelledby',
      heading.id
    );
  });

  it('휠 세로 회전을 가로 스크롤로 돌린다', () => {
    render(<ExperienceSection />);

    const rail = screen.getByRole('region', { name: /타임라인/ });
    makeScrollable(rail);

    const wheel = new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true });
    rail.dispatchEvent(wheel);

    expect(rail.scrollLeft).toBe(120);
    expect(wheel.defaultPrevented).toBe(true);
  });

  // 오른쪽 끝에서까지 기본 동작을 막으면 카드가 세로로 넘칠 때 바깥
  // 스크롤이 죽는다.
  it('더 밀 수 없으면 휠의 기본 동작을 막지 않는다', () => {
    render(<ExperienceSection />);

    const rail = screen.getByRole('region', { name: /타임라인/ });
    makeScrollable(rail);
    rail.scrollLeft = 9999;

    const wheel = new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true });
    rail.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(false);
  });

  it('마우스 클릭 드래그로 좌우를 민다', () => {
    render(<ExperienceSection />);

    const rail = screen.getByRole('region', { name: /타임라인/ });
    makeScrollable(rail);

    firePointer(rail, 'pointerdown', { button: 0, clientX: 300 });
    firePointer(rail, 'pointermove', { clientX: 220 });
    expect(rail.scrollLeft).toBe(80);

    firePointer(rail, 'pointerup', {});
    firePointer(rail, 'pointermove', { clientX: 100 });
    expect(rail.scrollLeft).toBe(80);
  });

  // 터치는 브라우저의 관성 스크롤과 useSectionSwipe가 나눠 갖는다.
  it('터치 포인터는 드래그로 잡지 않는다', () => {
    render(<ExperienceSection />);

    const rail = screen.getByRole('region', { name: /타임라인/ });
    makeScrollable(rail);

    firePointer(rail, 'pointerdown', { pointerType: 'touch', button: 0, clientX: 300 });
    firePointer(rail, 'pointermove', { pointerType: 'touch', clientX: 100 });

    expect(rail.scrollLeft).toBe(0);
  });

  it('진행 중인 경력 하나에만 CURRENT를 준다', () => {
    render(<ExperienceSection />);

    const current = document.querySelectorAll('[data-experience-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute('data-experience-node')).toBe('FASOO');
    expect(screen.getByText('CURRENT')).toBeInTheDocument();
  });

  it('로고 마스크가 실제로 있는 파일을 가리킨다', () => {
    render(<ExperienceSection />);

    const logos = [...document.querySelectorAll('[data-experience-logo]')];
    expect(logos).toHaveLength(experiences.length);

    for (const logo of logos) {
      const source = (logo as HTMLElement).style.getPropertyValue('--org-logo-src');
      const file = source.match(/\/logos-mono\/([\w-]+\.png)\)/)?.[1];
      expect(file, `--org-logo-src를 읽을 수 없다: ${source}`).toBeDefined();
      // 파일이 없으면 여기서 예외가 난다.
      expect(pngSize(file!).width).toBeGreaterThan(0);
    }
  });

  it('로고 슬롯 폭이 원본 비율에서 나온 값과 맞는다', () => {
    render(<ExperienceSection />);

    for (const logo of document.querySelectorAll('[data-experience-logo]')) {
      const element = logo as HTMLElement;
      const file = element.style
        .getPropertyValue('--org-logo-src')
        .match(/\/logos-mono\/([\w-]+\.png)\)/)![1];
      const { width, height } = pngSize(file);
      const expected = Math.min(SLOT_MAX_WIDTH, Math.round((SLOT_HEIGHT * width) / height));

      expect(Number.parseInt(element.style.width, 10), `${file}의 슬롯 폭`).toBe(expected);
    }
  });

  it('가로 레일이 섹션 스와이프를 가로채지 않고 키보드로 잡힌다', () => {
    render(<ExperienceSection />);

    const rail = screen.getByRole('region', { name: /타임라인/ });
    expect(rail).toHaveAttribute('data-section-swipe-ignore');
    expect(rail).toHaveAttribute('tabindex', '0');
    expect(rail.className).toContain('section-horizontal-scroll');
    expect(rail.className).toContain('overflow-x-auto');
  });

  it('기술 칩을 노드마다 그대로 둔다', () => {
    render(<ExperienceSection />);

    for (const experience of experiences) {
      const node = document.querySelector(`[data-experience-node="${experience.company}"]`)!;
      const skills = node.querySelector('[data-experience-field="skills"]')!;
      for (const skill of experience.skills ?? []) {
        expect(skills.textContent).toContain(skill);
      }
    }
  });

  it('둥근 모서리와 팔레트 색을 쓰지 않는다', () => {
    expect(SOURCE).not.toMatch(/\bBadge\b/);
    expect(SOURCE).not.toMatch(/rounded-(?:xl|2xl|3xl)/);
    expect(SOURCE).not.toMatch(/\bshadow-/);
    expect(findTailwindPaletteColorUtilities(SOURCE)).toEqual([]);
  });

  it('섹션 id를 유지한다', () => {
    const { container } = render(<ExperienceSection />);
    expect(container.querySelector(`#${SECTION_IDS.EXPERIENCE}`)).not.toBeNull();
  });
});
