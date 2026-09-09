import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ProjectModal from '@/components/blocks/ProjectModal';
import { gsap, REVEAL_IN_MS, REVEAL_OUT_MS, SplitText } from '@/lib/gsap';
import { projects } from '@/lib/data';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
import { isProjectModalReady, selectFeaturedReview } from '@/lib/utils/projectContract';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'components/blocks/ProjectModal/index.tsx'),
  'utf8'
);

const ICON_SOURCE = readFileSync(
  resolve(process.cwd(), 'components/atoms/Icon/index.tsx'),
  'utf8'
);

const project = projects.find((p) => p.title === 'AlphaMail')!;

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false, media: '', addEventListener: () => {}, removeEventListener: () => {},
    })
  );
});

function renderModal() {
  return render(<ProjectModal project={project} isOpen onClose={() => {}} />);
}

describe('ProjectModal 두 판 구조', () => {
  it('dialog에 프로젝트 이름이 접근명으로 붙는다', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: project.title })).toBeTruthy();
  });

  it('좌측은 증거, 우측은 논증으로 갈린다', () => {
    renderModal();
    expect(document.querySelector('[data-modal-part="evidence"]')).not.toBeNull();
    expect(document.querySelector('[data-modal-part="scroll"]')).not.toBeNull();
    const caption = document.querySelector('[data-modal-part="caption"]')!;
    expect(caption.querySelector('[data-modal-field="metric"]')).toBeNull();
  });

  it('판 1과 판 2가 둘 다 있고 판 1이 먼저 온다', () => {
    renderModal();
    const panels = document.querySelectorAll('[data-modal-panel]');
    expect(Array.from(panels).map((p) => p.getAttribute('data-modal-panel'))).toEqual([
      '1', '2',
    ]);
  });

  it('판 안의 읽는 순서가 라벨 -> 주장 -> 본문이다', () => {
    renderModal();
    for (const n of ['1', '2']) {
      const panel = document.querySelector(`[data-modal-panel="${n}"]`)!;
      const fields = Array.from(
        panel.querySelectorAll('[data-modal-field]')
      ).map((el) => el.getAttribute('data-modal-field'));
      expect(fields.indexOf('step')).toBeLessThan(fields.indexOf('claim'));
      expect(fields.indexOf('claim')).toBeLessThan(fields.indexOf('body'));
    }
  });

  it('제목 위계가 h2 -> h3 -> h4로 흐른다', () => {
    renderModal();
    const claims = document.querySelectorAll('[data-modal-field="claim"]');
    expect(claims).toHaveLength(2);
    claims.forEach((el) => expect(el.tagName).toBe('H3'));
    document
      .querySelectorAll('[data-modal-field="step"]')
      .forEach((el) => expect(el.tagName).toBe('P'));
  });
});

describe('ProjectModal 판 1', () => {
  it('구현 기능을 전부 줄로 세우고 첫 줄만 활성이다', () => {
    renderModal();
    const feats = document.querySelectorAll('[data-modal-panel="1"] [data-feat]');
    expect(feats).toHaveLength(project.implementations!.length);
    expect(
      document.querySelectorAll('[data-feat][aria-current="true"]')
    ).toHaveLength(1);
  });

  it('영상이 없으면 무대가 project.image로 떨어진다', () => {
    const noVideo = projects.find(
      (p) => isProjectModalReady(p) && !p.implementations?.some((i) => i.video)
    )!;
    render(<ProjectModal project={noVideo} isOpen onClose={() => {}} />);
    const stage = document.querySelector('[data-modal-part="stage"]')!;
    expect(stage.querySelector('video')).toBeNull();
    expect(stage.querySelector('img')).not.toBeNull();
    expect(document.querySelector('[data-modal-part="caption"]')).not.toBeNull();
  });

  it('구현 기능 설명은 items[0]만 쓴다', () => {
    // AlphaMail은 items가 전부 한 개라 둘째를 안 그리는지 볼 수가 없다.
    // items가 여럿인 프로젝트를 골라야 이 계약이 실제로 검증된다(지금은 TDS)
    const multi = projects.find(
      (p) => isProjectModalReady(p) && (p.implementations?.[0]?.items.length ?? 0) > 1
    )!;
    render(<ProjectModal project={multi} isOpen onClose={() => {}} />);
    const first = multi.implementations![0];
    const row = document.querySelector('[data-modal-panel="1"] [data-feat="0"]')!;
    expect(row.textContent).toContain(first.items[0]);
    expect(row.textContent).not.toContain(first.items[1]);
  });

  it('구현 기능 줄은 상자를 쓰지 않고 번호로 가른다', () => {
    renderModal();
    const feats = document.querySelector('[data-modal-panel="1"] [data-feat="0"]')!;
    expect(feats.className).not.toMatch(/\bborder\b(?!-b|-t)/);
    expect(feats.textContent).toContain('01');
  });
});

describe('ProjectModal 모양 잠금', () => {
  it('framer-motion을 쓰지 않는다', () => {
    expect(SOURCE).not.toContain('framer-motion');
  });

  it('테일윈드 팔레트 색을 쓰지 않는다', () => {
    expect(findTailwindPaletteColorUtilities(SOURCE)).toEqual([]);
  });

  it('시안을 글자색으로 쓰지 않는다', () => {
    expect(SOURCE).not.toMatch(/(?:^|[^-])color:\s*(?:var\(--cyan|#03b3c3)/i);
    expect(SOURCE).not.toMatch(/\btext-\[(?:#03b3c3|rgb\(3_179_195)/i);
  });

  it('글자 밝기 하한이 0.62다', () => {
    expect(SOURCE).not.toContain('255_255_255_/_0.42');
    expect(SOURCE).not.toContain('255 255 255 / 0.42');
    expect(SOURCE).not.toContain('255_255_255_/_0.50');
  });

  it('라운드 사다리를 지킨다', () => {
    expect(SOURCE).not.toMatch(/\brounded-xl\b/);
    expect(SOURCE).not.toMatch(/\brounded-sm\b/);
    expect(SOURCE).not.toMatch(/\brounded-none\b/);
    // 셸이 fixed inset-0 전체 화면 판이 됐다. 화면 가장자리에 붙은 판에
    // 모서리는 없으므로 셸의 rounded-2xl은 사라졌다(다른 곳에도 없다).
    expect((SOURCE.match(/\brounded-2xl\b/g) ?? []).length).toBe(0);
  });

  it('글자 크기가 램프 안에만 있다', () => {
    const RAMP = new Set(['11', '13', '15', '17', '22', '26', '30']);
    const sizes = SOURCE.match(/text-\[(\d+(?:\.\d+)?)px\]/g) ?? [];
    const offRamp = sizes.filter(
      (s) => !RAMP.has(s.replace(/\D/g, ''))
    );
    expect(offRamp).toEqual([]);
    // 이 파일은 px 임의값 대신 text-t* 사다리를 쓴다. 그래서 위 검사만으로는
    // 잴 것이 하나도 없어 그냥 통과한다. t4가 20px이라 램프 밖이다
    expect(SOURCE).not.toMatch(/\btext-t4\b/);
  });

  it('box-shadow를 쓰지 않는다', () => {
    expect(SOURCE).not.toMatch(/\bshadow-(?:sm|md|lg|xl|2xl)\b/);
  });

  it('그림문자를 쓰지 않는다', () => {
    expect(SOURCE).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  // Tailwind는 소스를 바이트로 훑어 클래스 후보를 찾는다. `before:${DOT}`처럼
  // 접두어 뒤에 변수를 끼워 넣으면 실행 시점 문자열은 소스에 리터럴로 없어
  // 규칙이 안 만들어진다. 판 2 소제목 구슬 표식이 배경색 없이 뜬 사고가 이
  // 경로로 났다. className 자리의 템플릿 리터럴 끼워넣기를 막는다
  it('클래스 이름 자리에 문자열 끼워넣기를 쓰지 않는다', () => {
    expect(SOURCE).not.toMatch(
      /`[a-z-]+:\$\{|`(?:bg|text|border|outline|rounded|before|after)-\$\{/
    );
  });

  it('조작 설명서를 화면에 두지 않는다', () => {
    renderModal();
    expect(screen.queryByText(/스와이프|드래그하세요|클릭하세요/)).toBeNull();
  });

  // body 필드(motivation 나머지·review.problem)에 인라인 **강조**가 실제
  // 데이터에 섞여 있어(Portfolio review.problem 등) RichText를 계속 쓴다.
  // 옛 테스트가 지키던 팔레트락을 여기로 옮겨 유지한다.
  it('RichText도 테일윈드 팔레트 색을 쓰지 않는다', () => {
    const richText = readFileSync(
      resolve(process.cwd(), 'lib/utils/richText.tsx'),
      'utf8'
    );
    expect(findTailwindPaletteColorUtilities(richText)).toEqual([]);
  });
});

describe('ProjectModal 전체 화면 셸과 FLIP 손잡이', () => {
  it('셸이 fixed inset-0로 화면을 덮고 mx-auto로 가운데 정렬되지 않는다', () => {
    renderModal();
    const shell = document.querySelector('#pm-shell')!;
    const classes = shell.className.split(/ +/);
    expect(classes).toContain('fixed');
    expect(classes).toContain('inset-0');
    expect(classes).not.toContain('mx-auto');
  });

  it('셸에 크기 제약이 없다', () => {
    expect(SOURCE).not.toContain('min(880px,88vh)');
    expect(SOURCE).not.toContain('min(1400px,92vw)');
  });

  it('셸에 outline 테두리가 없다', () => {
    expect(SOURCE).not.toMatch(/outline-\[var\(--color-hairline\)\]/);
  });

  it('FLIP 손잡이 둘이 stage와 제목에 project.title로 그려진다', () => {
    renderModal();
    const stage = document.querySelector('[data-modal-part="stage"]')!;
    const heading = screen.getByRole('heading', { name: project.title });
    expect(stage.getAttribute('data-flip-id')).toBe(`pv-${project.title}`);
    expect(heading.getAttribute('data-flip-id')).toBe(`title-${project.title}`);
  });

  it('FLIP 대상 노드에 transform 유틸이 없다', () => {
    renderModal();
    const stage = document.querySelector('[data-modal-part="stage"]')!;
    const heading = screen.getByRole('heading', { name: project.title });
    for (const el of [stage, heading]) {
      expect(el.className).not.toMatch(/\btranslate-|\bscale-|\brotate-/);
    }
  });

  it('onStageMount가 stage 노드를 부모에게 준다', () => {
    let received: HTMLDivElement | null = null;
    render(
      <ProjectModal
        project={project}
        isOpen
        onClose={() => {}}
        onStageMount={(el) => {
          received = el;
        }}
      />
    );
    expect(received).not.toBeNull();
    expect((received as unknown as HTMLDivElement).getAttribute('data-modal-part')).toBe('stage');
  });
});

describe('ProjectModal 좁은 판', () => {
  it('경계가 1100px이다', () => {
    // 901px에서 우열 본문이 256px이라 판 2 제목이 세 줄로 쪼개졌다
    expect(SOURCE).toMatch(/1100px/);
    expect(SOURCE).not.toMatch(/max-width:\s*900px|\[900px\]/);
  });

  it('영상 위 조작부에 backdrop-filter를 쓰지 않는다', () => {
    // blur가 흰 앱 화면을 빨아들여 어두운 덮개가 밝은 덩어리가 됐다.
    // 영상 위에서는 blur가 대비를 만드는 게 아니라 부순다
    expect(SOURCE).not.toMatch(/backdrop-(?:filter|blur)/);
  });

  it('영상 조작부의 탭 영역이 44px이다', () => {
    // 시각 크기는 36과 32로 두고 ::after로 탭 영역만 넓힌다
    expect(SOURCE).toMatch(/44px/);
  });

  it('한 열에서도 기술 칩이 남는다', () => {
    renderModal();
    expect(
      document.querySelector('[data-modal-field="chips"]')
    ).not.toBeNull();
  });

  it('좁은 판 재배치에 order를 쓴다', () => {
    // order 없이 보이는 항목은 order:0으로 맨 위에 튄다.
    // 구분선이 두 번 이 사고를 냈다
    expect(SOURCE).toMatch(/display:\s*contents|display-contents/);
    expect(SOURCE).toMatch(/order:/);
  });

  // 목록이 사라진 좁은 판에서 무대를 넘기는 유일한 입구다. 방향이
  // 뒤집혀도 위 소스 잠금은 못 잡는다. jsdom이 실제로 클릭을 태울 수
  // 있으니 여기서 태운다
  it('영상 화살표가 무대를 다음/이전으로 넘긴다', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: '다음 기능 영상' }));
    expect(document.querySelector('[data-feat="1"][aria-current="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '이전 기능 영상' }));
    expect(document.querySelector('[data-feat="0"][aria-current="true"]')).not.toBeNull();
  });
});

describe('ProjectModal 헤더 버튼 묶음', () => {
  // jsdom은 레이아웃 엔진이 없어 390px 폭에서 실제로 33px로 찌그러지는
  // 결과 자체는 잴 수 없다. 대신 그 원인, 즉 버튼 묶음이 형제인 제목과
  // 함께 줄어들지 않도록 막는 유틸리티가 붙어 있는지를 잠근다
  it('닫기 버튼을 담은 묶음이 줄어들지 않는다', () => {
    renderModal();
    const closeButton = screen.getByRole('button', { name: '닫기' });
    expect(closeButton.parentElement!.className).toMatch(/\bshrink-0\b/);
  });
});

describe('ProjectModal 판 2', () => {
  const review = selectFeaturedReview(project)!;

  it('reviews[0]만 읽는다', () => {
    renderModal();
    const panel = document.querySelector('[data-modal-panel="2"]')!;
    expect(within(panel as HTMLElement).getByRole('heading', { level: 3 }).textContent)
      .toContain(review.title.replace(/^\d+\.\s*/, '').split('\u2014')[0].trim());
    // 나머지 리뷰는 모달에 안 나온다. 다만 데이터에서 지우지도 않는다
    for (const other of project.reviews!.slice(1)) {
      expect(panel.textContent).not.toContain(other.problem);
    }
  });

  it('판 안의 자리가 진단 -> 선택지 -> 한 일 -> 결과 -> 감수한 것 순서다', () => {
    renderModal();
    const panel = document.querySelector('[data-modal-panel="2"]')!;
    const fields = Array.from(panel.querySelectorAll('[data-modal-field]')).map((el) =>
      el.getAttribute('data-modal-field')
    );
    const order = ['diagnosis', 'options', 'did', 'metric', 'cost'];
    const found = order.map((f) => fields.indexOf(f));
    expect(found.every((i) => i >= 0)).toBe(true);
    expect([...found].sort((a, b) => a - b)).toEqual(found);
  });

  it('검토한 선택지가 2개 이상이고 채택이 정확히 하나다', () => {
    renderModal();
    const opts = document.querySelectorAll('[data-opt]');
    expect(opts.length).toBeGreaterThanOrEqual(2);
    expect(document.querySelectorAll('[data-opt-chosen]')).toHaveLength(1);
  });

  it('선택지 이름에서 (선택) 표식을 떼고 배지로 세운다', () => {
    renderModal();
    const chosen = document.querySelector('[data-opt-chosen]')!;
    expect(chosen.textContent).not.toContain('(선택)');
    expect(chosen.textContent).toContain('선택');
  });

  it('결과 수치가 판 2 본문에 있고 좌측 캡션에 없다', () => {
    renderModal();
    const metric = document.querySelector(
      '[data-modal-panel="2"] [data-modal-field="metric"]'
    )!;
    expect(metric.textContent).toContain(review.result![0].after);
  });

  it('구현 기능 목록과 선택지 목록의 문법이 다르다', () => {
    // 선택지가 얼굴이다. 테두리 상자 + 라디오 표식 + 선택 시 배경
    renderModal();
    const opt = document.querySelector('[data-opt]')!;
    expect(opt.className).toMatch(/\bborder\b/);
    expect(opt.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('한 일과 감수한 것을 자르지 않는다', () => {
    // action을 첫 줄만 그리는 변이가 살아남았다. 순서만 보는 검사는 목록이
    // 한 줄로 줄어도 그냥 통과하기 때문에 개수를 따로 센다
    renderModal();
    const panel = document.querySelector('[data-modal-panel="2"]')!;
    expect(panel.querySelectorAll('[data-modal-field="did"] li')).toHaveLength(
      review.action!.length
    );
    expect(panel.querySelectorAll('[data-modal-field="cost"] li')).toHaveLength(
      review.tradeOffs!.length
    );
    expect(panel.querySelectorAll('[data-opt]')).toHaveLength(
      review.analysis!.filter((a) => a.startsWith('**선택지')).length
    );
  });
});

describe('ProjectModal 영상 재생 제어', () => {
  // 자동재생 muted loop 영상에 정지 수단이 없으면 WCAG 2.2.2 위반이다.
  // 단추가 상태를 뒤집고 실제 pause()를 부르는지가 이 보정의 표제 계약이다.
  it('vidctl 단추가 재생중일 때 있고 누르면 정지로 뒤집힌다', () => {
    const pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {});
    renderModal();
    const playing = screen.getByRole('button', { name: '영상 일시정지' });
    fireEvent.click(playing);
    expect(screen.getByRole('button', { name: '영상 재생' })).toBeTruthy();
    expect(pauseSpy).toHaveBeenCalled();
    pauseSpy.mockRestore();
  });

  it('정지 상태에서 누르면 재생으로 되돌아간다', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => undefined as unknown as Promise<void>);
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: '영상 일시정지' }));
    const paused = screen.getByRole('button', { name: '영상 재생' });
    const callsBefore = playSpy.mock.calls.length;
    fireEvent.click(paused);
    expect(screen.getByRole('button', { name: '영상 일시정지' })).toBeTruthy();
    expect(playSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    playSpy.mockRestore();
  });

  it('영상이 없는 프로젝트에는 정지 단추가 없다', () => {
    const noVideo = projects.find(
      (p) => isProjectModalReady(p) && !p.implementations?.some((i) => i.video)
    )!;
    render(<ProjectModal project={noVideo} isOpen onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /^영상 (일시정지|재생)$/ })).toBeNull();
  });
});

describe('ProjectModal 소제목 표식', () => {
  // 시안은 축선 위의 구슬을 판 2의 다섯 소제목에만 두고, 판 1의
  // '구현 기능'에는 두지 않는다. 이전 브리프가 여섯 곳 전부에 붙이라고
  // 잘못 지시했던 것을 되돌린다
  it('판 2의 소제목 다섯만 표식을 갖고 판 1은 갖지 않는다', () => {
    renderModal();
    const p1Dots = document.querySelectorAll('[data-modal-panel="1"] h4.pm-substep-dot');
    const p2Dots = document.querySelectorAll('[data-modal-panel="2"] h4.pm-substep-dot');
    expect(p1Dots).toHaveLength(0);
    expect(p2Dots).toHaveLength(5);
  });

  it('판 1의 구현 기능도 h4로 남는다', () => {
    renderModal();
    const p1Headings = document.querySelectorAll('[data-modal-panel="1"] h4');
    expect(p1Headings).toHaveLength(1);
    expect(p1Headings[0].textContent).toBe('구현 기능');
  });
});

describe('ProjectModal 좁은 판 여백과 높이', () => {
  it('1100px 블록 안에서 바깥 여백을 0으로 되돌린다', () => {
    const media = SOURCE.slice(SOURCE.indexOf('@media (max-width: 1100px)'));
    expect(media).toMatch(/:has\([^)]*#pm-shell[^)]*\)\s*\{[^}]*padding:\s*0/);
  });

  it('1100px 블록 안에서 판까지 확정 높이 사슬을 세운다', () => {
    const media = SOURCE.slice(SOURCE.indexOf('@media (max-width: 1100px)'));
    // role=dialog까지 :has()로 짚어 height:100%를 준다. #pm-shell 자체의
    // height:100%(기존 규칙)만으로는 조상이 auto라 풀린다
    expect(media).toMatch(/\[role="dialog"\][^{]*\{[^}]*height:\s*100%/);
  });
});

describe('ProjectModal 아이콘과 글자 크기 한 칸 내리기', () => {
  // Icon 아톰에 재생 계열 이름 넷이 실제로 등록됐는지를 잠근다. 아톰이
  // outline만 그리므로 solid path가 잘못 섞여도 이 검사로는 못 잡지만,
  // 최소한 이름 자체가 유니온에서 빠지는 회귀는 여기서 걸린다
  it('Icon 아톰에 play·pause·chevron-left·chevron-right가 있다', () => {
    for (const name of ['play', 'pause', 'chevron-left', 'chevron-right']) {
      expect(ICON_SOURCE).toContain(`'${name}'`);
    }
  });

  // 재생/정지/화살표를 글자로 때우던 자리를 아이콘으로 갈아 끼웠다.
  // 글립 문자가 소스에 남아 있으면 아이콘 대신 문자를 다시 쓴 것이다
  it('재생·정지·화살표 글립 문자가 더는 소스에 없다', () => {
    expect(SOURCE).not.toContain('‹'); // ‹
    expect(SOURCE).not.toContain('›'); // ›
    expect(SOURCE).not.toContain('▶'); // ▶
    expect(SOURCE).not.toMatch(/\|\s\|/); // 정지 표시로 쓰던 파이프 두 개
  });

  // 제목은 실제로 그려진 class로 잠근다. 이 잠금은 cn이 크기 클래스를
  // 색과 헷갈려 지워 버리는 회귀도 같이 잡는다.
  // t2는 접힘 이름 목록과 짝을 맞춘 값이다 - 두 노드는 Flip으로 날아가는
  // 짝이라 글자 크기가 갈리면 비행 내내 배율로 늘어난다. 짝이 맞는지는
  // ProjectsSection.test.tsx의 교차 잠금이 보고, 여기서는 이 파일이
  // 혼자 옛 t3으로 되돌아가는 것을 막는다
  it('제목이 접힘 이름과 같은 t2로 그려진다', () => {
    renderModal();
    const heading = screen.getByRole('heading', { name: project.title });
    const classes = heading.className.split(/ +/);
    expect(classes).toContain('text-t2');
    expect(classes).not.toContain('text-t3');
  });

  // 좁은 화면 전용 축소 규칙을 여기에 되살리면 안 된다. FLIP은 lg(1024)
  // 위에서 도는데 NARROW_PANEL_CSS는 1100px 아래에 걸려 있어, 1024~1100
  // 구간에서 제목만 줄어들고 접힘 이름은 t2로 남는다 - 비행 첫 프레임이
  // 그 비율만큼 배율로 어긋난다. 제목이 버튼을 미는 문제는 truncate가 맡는다
  it('NARROW_PANEL_CSS에 head h2 font-size 규칙이 남지 않는다', () => {
    expect(SOURCE).not.toMatch(/\[data-modal-part="head"\]\s*h2\s*\{[^}]*font-size/);
  });
});

// 상세 판 내용의 등장·퇴장 소유권은 ProjectsSection이 아니라 ProjectModal에
// 있다. 부모가 컨테이너를 되살리는 커밋과 자식을 시작 상태로 누르는 순간이
// 갈리면 그 사이가 한 프레임 번쩍인다. 아래는 그 소유권 계약을 잠근다 -
// jsdom에는 레이아웃 엔진이 없으므로 픽셀이 아니라 원인만 본다
describe('ProjectModal 등장·퇴장 안무', () => {
  const HEAD_ACTIONS = '[data-modal-part="head"] > div';
  const SCROLL = '[data-modal-part="scroll"]';
  const CAPTION = '[data-modal-part="caption"]';

  function roots() {
    return [HEAD_ACTIONS, SCROLL, CAPTION].map(
      (sel) => document.querySelector<HTMLElement>(sel)!
    );
  }
  function el(sel: string) {
    return document.querySelector<HTMLElement>(sel)!;
  }
  // gsap.timeline을 감싸 실제로 만들어진 타임라인을 붙잡는다. 결과(픽셀)가
  // 아니라 안무 자체를 재는 유일한 채널이다
  function captureTimelines() {
    const made: gsap.core.Timeline[] = [];
    const original = gsap.timeline.bind(gsap);
    vi.spyOn(gsap, 'timeline').mockImplementation(((vars: never) => {
      const tl = original(vars);
      made.push(tl);
      return tl;
    }) as typeof gsap.timeline);
    return made;
  }
  function captureTweens() {
    const made: gsap.core.Tween[] = [];
    const original = gsap.to.bind(gsap);
    vi.spyOn(gsap, 'to').mockImplementation(((target: never, vars: never) => {
      const tween = original(target, vars);
      made.push(tween);
      return tween;
    }) as typeof gsap.to);
    return made;
  }
  function renderReveal(value: boolean | null | undefined) {
    return render(<ProjectModal project={project} isOpen onClose={() => {}} reveal={value} />);
  }
  function rerenderReveal(
    rerender: (ui: React.ReactElement) => void,
    value: boolean | null | undefined
  ) {
    rerender(<ProjectModal project={project} isOpen onClose={() => {}} reveal={value} />);
  }

  // 표제 계약. 미전달이 기본값이고 그 경로에서는 안무가 아예 없다 -
  // 좁은 화면·reducedMotion·gsap 미준비와 기존 테스트 전부가 여기를 탄다
  it('reveal을 안 주면 내용이 감춰지지도 눌리지도 않는다', () => {
    renderReveal(undefined);
    for (const root of roots()) expect(root.style.visibility).toBe('');
    expect(el('[data-modal-field="claim"]').children).toHaveLength(0);
    expect(el('[data-modal-field="meta"]').style.opacity).toBe('');
  });

  it('reveal={false}면 세 영역이 감춰지고 비행 대상 둘은 건드리지 않는다', () => {
    renderReveal(false);
    for (const root of roots()) expect(root.style.visibility).toBe('hidden');
    // 제목과 stage는 Flip이 나르는 중이다. 여기서 손대면 착지가 튄다.
    // 감추는 수단이 display가 아닌 것도 같은 이유다 - 레이아웃이 사라지면
    // 착지 좌표가 어긋난다
    expect(document.getElementById('pm-title')!.style.visibility).toBe('');
    expect(el('[data-modal-part="stage"]').style.visibility).toBe('');
    for (const root of roots()) expect(root.style.display).toBe('');
  });

  it('reveal이 false에서 true가 되면 감춤이 걷히고 등장 시작 상태로 눌린다', () => {
    const { rerender } = renderReveal(false);
    rerenderReveal(rerender, true);

    for (const root of roots()) expect(root.style.visibility).toBe('visible');
    // fromTo는 immediateRender라 시작 상태가 이 자리에서 이미 눌려 있다.
    // 그래서 컨테이너가 보이는 프레임과 자식이 눌리는 프레임이 같다
    expect(el('[data-modal-field="meta"]').style.opacity).toBe('0');
    expect(el(CAPTION).style.opacity).toBe('0');
    expect(el(SCROLL).style.opacity).toBe('0');
    // 비행 대상 둘은 여전히 무사하다
    expect(document.getElementById('pm-title')!.style.cssText).toBe('');
    expect(el('[data-modal-part="stage"]').style.cssText).toBe('');
  });

  it('주장과 부제만 단어 단위로 쪼갠다 - 음절로 부수지 않는다', () => {
    const { rerender } = renderReveal(false);
    const claim = el('[data-modal-field="claim"]');
    const words = claim.textContent!.trim().split(/\s+/).length;
    rerenderReveal(rerender, true);

    // 눌린 조각의 수가 어절 수와 같다. 음절로 쪼갰다면 훨씬 많고, 아예
    // 안 쪼갰다면 0이다
    const pressed = Array.from(claim.querySelectorAll<HTMLElement>('*')).filter(
      (node) => node.style.opacity === '0'
    );
    expect(pressed).toHaveLength(words);
    expect(words).toBeGreaterThan(1);
    // 통짜로 가는 블록은 쪼개지 않는다. RichText가 섞인 본문을 단어로
    // 부수면 인라인 요소가 깨진다
    expect(el('[data-modal-field="body"]').style.opacity).toBe('0');
  });

  it('등장 타임라인은 하나뿐이고 전체가 REVEAL_IN_MS 안에 끝난다', () => {
    const timelines = captureTimelines();
    const { rerender } = renderReveal(false);
    expect(timelines).toHaveLength(0);

    rerenderReveal(rerender, true);
    expect(timelines).toHaveLength(1);
    // 예산 밖으로 새면 비행 500 + 등장이 1초를 훌쩍 넘어 판이 늘어진다
    expect(timelines[0].duration()).toBeLessThanOrEqual(REVEAL_IN_MS / 1000);
    // 그렇다고 아무것도 안 하는 타임라인이면 안 된다
    expect(timelines[0].duration()).toBeGreaterThan(REVEAL_IN_MS / 2000);
  });

  it('reveal이 true에서 false가 되면 통짜로 접힌다 - 단어를 다시 쪼개지 않는다', () => {
    const { rerender } = renderReveal(false);
    rerenderReveal(rerender, true);

    const split = vi.spyOn(SplitText, 'create');
    const tweens = captureTweens();
    rerenderReveal(rerender, false);

    expect(split).not.toHaveBeenCalled();
    expect(tweens).toHaveLength(1);
    expect(tweens[0].duration()).toBeCloseTo(REVEAL_OUT_MS / 1000);
    act(() => {
      tweens[0].progress(1);
    });
    for (const root of roots()) expect(root.style.opacity).toBe('0');
  });

  it('감춘 적이 없는 판에는 등장을 걸지 않는다 - 그게 곧 번쩍임이다', () => {
    const timelines = captureTimelines();
    const { rerender } = renderReveal(null);
    rerenderReveal(rerender, true);
    expect(timelines).toHaveLength(0);
    expect(el('[data-modal-field="meta"]').style.opacity).toBe('');
  });

  it('안무가 끝나면 SplitText 래퍼가 걷혀 원래 글이 그대로 남는다', () => {
    const { rerender } = renderReveal(false);
    const claim = el('[data-modal-field="claim"]');
    const text = claim.textContent;
    rerenderReveal(rerender, true);
    expect(claim.children.length).toBeGreaterThan(0);

    rerenderReveal(rerender, null);
    // 안 걷으면 다음 열기에 래퍼가 겹쳐 쌓인다
    expect(claim.children).toHaveLength(0);
    expect(claim.textContent).toBe(text);
  });
});
