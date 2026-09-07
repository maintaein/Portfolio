'use client';

import { useState } from 'react';
import { awards, certificates } from '@/lib/data';
import { orgLogoStyle } from '@/lib/logos';
import { SECTION_IDS } from '@/lib/constants';

// 이 섹션이 파는 것은 내가 쓴 설명이 아니라 바깥에서 받은 검증이다. 그래서
// 목록의 머리에 서는 것은 제목이 아니라 준 쪽의 마크고, 같은 기관이 준 상은
// 한 마크 아래로 묶인다. 그러면 1번과 2번이 "삼성청년SW아카데미"를 두 번
// 반복하지 않아도 어디서 받은 것인지 읽힌다.
type Award = (typeof awards)[number];

interface AwardGroup {
  organization: string;
  logo: string;
  entries: Award[];
}

// 데이터 순서를 지킨 채 이웃한 것만 묶는다. 정렬을 다시 하면 아래의 번호가
// 데이터 순서와 어긋난다.
const AWARD_GROUPS = awards.reduce<AwardGroup[]>((groups, award) => {
  const last = groups[groups.length - 1];

  if (last && last.organization === award.organization) {
    last.entries.push(award);
  } else {
    groups.push({
      organization: award.organization,
      logo: award.logo,
      entries: [award],
    });
  }

  return groups;
}, []);

// 그룹 머리글이 이미 말한 부분은 제목에서 뺀다. 세 건뿐이라 규칙을 유추하지
// 않고 그대로 적는다. 표에 없는 기관이 들어오면 제목이 통째로 남을 뿐이라
// 잘못 잘릴 일이 없다.
const TITLE_PREFIX: Record<string, string> = {
  삼성전자: '삼성청년SW아카데미 ',
  한국경제: '한국경제 ',
};

function rowTitle(award: Award): string {
  const prefix = TITLE_PREFIX[award.organization];

  return prefix && award.title.startsWith(prefix)
    ? award.title.slice(prefix.length)
    : award.title;
}

// 로고 슬롯. 24px에서는 글씨가 뭉갠다. 40px면 읽힌다. 폭 상한은 가로로 긴
// 마크를 눌러 시각 크기를 맞춘다. 마스크가 contain이라 폭을 조이면 높이도
// 같이 줄어든다.
const LOGO_HEIGHT = 40;
const LOGO_MAX_WIDTH = 120;

// 자격증 마크는 상보다 작게 앉는다. 줄 안에 글자와 나란히 서는 크기다.
const CREDENTIAL_LOGO_HEIGHT = 26;
const CREDENTIAL_LOGO_MAX_WIDTH = 96;

// 두 판의 머리글은 같은 옷을 입는다. 어느 항목이 어느 주제에 속하는지는
// 이 줄 하나가 쥐므로 본문보다 크고 밝다. 계기의 이름표다.
const HEADING =
  'flex items-baseline justify-between gap-4 border-b-2 border-[var(--color-hairline)] pb-3 text-t5 font-semibold uppercase tracking-[0.28em] text-[var(--color-text-primary)]';
const HEADING_COUNT =
  'text-t7 font-normal tracking-normal tabular-nums text-[var(--color-text-secondary)]';

export default function AwardsAndCertificatesSection() {
  // 한 번에 하나만 펼친다. 여러 개가 열리면 세로 가운데 정렬이 화면 밖으로
  // 밀려 방금 누른 줄이 눈에서 사라진다.
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section
      id={SECTION_IDS.AWARDS_CERTIFICATES}
      aria-labelledby="awards-heading"
      className="flex min-h-full py-6 lg:py-8"
    >
      {/* min-h-full과 자식의 m-auto가 세로 가운데 정렬이다. 줄이 펼쳐져
          상자가 커져도 auto 마진이 매 프레임 다시 계산되므로 가운데를
          유지한 채 위아래로 자란다. flex의 items-center를 쓰면 내용이
          상자보다 길 때 위쪽이 잘려 스크롤로도 닿지 못한다. */}
      <div className="m-auto flex w-full max-w-3xl flex-col gap-4">
        {/* 화면에서는 뺀 제목. 섹션 이름을 쥔 유일한 요소라 접근성 트리에는
            남긴다. About·Skills·Experience와 같은 방식이다. */}
        <h2 id="awards-heading" className="sr-only">
          Awards & Certificates
        </h2>

        {/* 수상과 자격증은 각자의 판에 앉는다. 사이의 틈으로 배경이 그대로
            지나가서, 선 하나로 나누는 것보다 경계가 확실하다. */}
        <div className="section-plate px-4 py-6 sm:px-6">
          <p className={HEADING}>
            <span>Awards</span>
            <span data-ledger-count className={HEADING_COUNT}>
              {awards.length}
            </span>
          </p>

          {AWARD_GROUPS.map((group) => (
            <div key={group.organization} data-ledger-group={group.organization}>
              {/* 마크가 이 묶음의 제목 노릇을 한다. 오른쪽으로 흐르는 실선이
                  마크를 받쳐 묶음의 시작을 긋는다. 화면에서는 로고가,
                  접근성 트리에서는 기관 이름이 같은 자리를 채운다. */}
              <p className="flex items-center gap-4 pt-8 pb-4">
                <span className="sr-only">{group.organization}</span>
                <span
                  aria-hidden
                  data-ledger-logo={group.logo}
                  className="org-logo"
                  style={orgLogoStyle(group.logo, LOGO_HEIGHT, LOGO_MAX_WIDTH)}
                />
                <span
                  aria-hidden
                  className="h-px flex-1 bg-[var(--color-hairline)]"
                />
              </p>

              <ul>
                {group.entries.map((award) => {
                  const id = `award-${award.id}`;
                  const open = openId === id;
                  const panelId = `ledger-panel-${id}`;

                  return (
                    <li
                      key={id}
                      // 화면에 찍히는 제목은 줄었지만 줄을 가리키는 이름은
                      // 데이터의 전체 제목 그대로다.
                      data-ledger-row={award.title}
                      data-ledger-open={open ? 'true' : undefined}
                      // 줄을 가르는 것은 실선 하나가 아니라 눈금 두 겹이다.
                      // before가 폭 전체의 머리카락선을, after가 번호 열
                      // 너비만큼의 밝은 눈금을 긋는다. 계기의 큰 눈금과 작은
                      // 눈금이고, after가 뒤에 칠해져 위에 얹힌다.
                      // 왼쪽 선은 접혀 있을 때도 자리를 차지한다. 열릴 때만
                      // 그리면 줄 전체가 2px 밀려 목록이 흔들린다. 이 선이
                      // 섹션에서 시안을 쓰는 유일한 자리다.
                      className={`relative border-l-2 transition-colors duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-[var(--color-hairline)] after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:h-px after:w-7 after:bg-[rgb(255_255_255_/_0.45)] ${
                        open
                          ? 'border-l-[var(--color-cyan-core)]'
                          : 'border-l-[rgb(255_255_255_/_0.12)] hover:border-l-[rgb(255_255_255_/_0.3)]'
                      }`}
                    >
                      <h3>
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={panelId}
                          onClick={() => setOpenId(open ? null : id)}
                          className="grid w-full cursor-pointer grid-cols-[1.75rem_1fr_auto] items-baseline gap-x-5 py-5 pl-3 text-left transition-colors duration-200 hover:bg-[rgb(255_255_255_/_0.04)] focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)] active:bg-[rgb(255_255_255_/_0.08)] sm:pl-4"
                        >
                          <span
                            data-ledger-field="index"
                            className="text-t7 tabular-nums text-[var(--color-text-secondary)]"
                          >
                            {String(awards.indexOf(award) + 1).padStart(2, '0')}
                          </span>

                          <span className="flex flex-col gap-1">
                            <span
                              data-ledger-field="title"
                              className="text-t4 font-medium text-balance text-[var(--color-text-primary)]"
                            >
                              {rowTitle(award)}
                            </span>

                            {/* 누르기 전에 이미 무엇으로 언제 받았는지 읽힌다.
                                1번과 2번은 이 줄에서 갈린다. */}
                            <span
                              data-ledger-field="meta"
                              className="text-t7 tabular-nums text-[var(--color-text-secondary)]"
                            >
                              {award.project} · {award.date}
                            </span>
                          </span>

                          <span
                            data-ledger-field="grade"
                            className="whitespace-nowrap border border-[var(--color-hairline)] px-2 py-0.5 text-t7 tracking-wide text-[var(--color-text-primary)]"
                          >
                            {award.rank}
                          </span>
                        </button>
                      </h3>

                      {/* 접힌 판도 DOM에 남긴다. grid-rows를 0fr에서 1fr로 옮기면
                          내용 높이를 재지 않고도 열림이 애니메이션되는데, 언마운트
                          하면 그 전환이 시작점을 잃는다. 대신 접힌 동안은
                          aria-hidden으로 접근성 트리에서 뺀다. 안에 초점 받을
                          것이 없어 이것으로 충분하다. */}
                      <div
                        id={panelId}
                        aria-hidden={!open}
                        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <p
                            data-ledger-field="description"
                            className="pb-6 pl-3 text-t5 leading-relaxed text-[var(--color-text-secondary)] sm:pl-4"
                          >
                            {award.description}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* 자격증은 상과 같은 목록에 세우지 않는다. 한 건뿐이라 번호를 이어
            붙이면 네 번째 상처럼 읽히고, 펼칠 것도 없어 여닫는 단추가
            아무것도 내주지 않는다. 상의 줄은 눈금 두 겹으로 갈리지만 자격증은
            줄이 하나뿐이라 가를 것이 없다. 대신 등급 하나를 크게 세우고 밑에
            선을 그어 계기의 측정값처럼 읽게 한다. */}
        <div className="section-plate px-4 py-6 sm:px-6">
          <p className={HEADING}>
            <span>Credentials</span>
            <span data-credential-count className={HEADING_COUNT}>
              {certificates.length}
            </span>
          </p>

          <ul className="flex flex-col gap-5 pt-6">
            {certificates.map((certificate) => (
              <li
                key={certificate.id}
                data-credential-row={certificate.name}
                className="flex flex-wrap items-center gap-x-6 gap-y-3"
              >
                {/* 마크가 곧 이름이다(OPIC). 글자로 한 번 더 적으면 같은
                    말이 두 번 나오므로 접근성 트리에만 남긴다. */}
                <span className="sr-only">{certificate.name}</span>
                <span
                  aria-hidden
                  data-ledger-logo={certificate.logo}
                  className="org-logo"
                  style={orgLogoStyle(
                    certificate.logo,
                    CREDENTIAL_LOGO_HEIGHT,
                    CREDENTIAL_LOGO_MAX_WIDTH
                  )}
                />

                <span className="border-b-2 border-[var(--color-hairline)] pb-1 text-t3 leading-none font-medium tracking-wide text-[var(--color-text-primary)]">
                  {certificate.grade}
                </span>

                <span className="ml-auto text-t7 tabular-nums text-[var(--color-text-secondary)]">
                  {certificate.organization} · {certificate.date} 취득
                  {certificate.validUntil
                    ? ` · ${certificate.validUntil}까지`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
