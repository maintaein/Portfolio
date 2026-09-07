'use client';

import { useState } from 'react';
import { awards, certificates } from '@/lib/data';
import { orgLogoStyle } from '@/lib/logos';
import { SECTION_IDS } from '@/lib/constants';

// 수상과 자격증을 한 원장에 세운다. 둘 다 바깥에서 받은 검증이라는 같은
// 값을 팔고, 자격증은 한 건뿐이라 목록을 나누면 빈 칸이 생긴다. 번호는
// 두 출처를 가로질러 이어진다.
interface LedgerEntry {
  id: string;
  title: string;
  // 오른쪽 끝에 붙는 한 낱말. 수상은 등급, 자격증은 취득 등급이다.
  grade: string;
  logo: string;
  // 펼친 뒤 첫 줄. 누가 줬고 무엇으로 받았는지.
  issuer: string;
  timeline: string;
  description?: string;
}

const ENTRIES: LedgerEntry[] = [
  ...awards.map((award) => ({
    id: `award-${award.id}`,
    title: award.title,
    grade: award.rank,
    logo: award.logo,
    issuer: `${award.organization} / ${award.project}`,
    timeline: `${award.date} 수상`,
    description: award.description,
  })),
  ...certificates.map((certificate) => ({
    id: `credential-${certificate.id}`,
    title: certificate.name,
    grade: certificate.grade,
    logo: certificate.logo,
    issuer: certificate.organization,
    timeline: certificate.validUntil
      ? `${certificate.date} 취득 · ${certificate.validUntil}까지`
      : `${certificate.date} 취득`,
  })),
];

// 펼친 판의 로고 크기. 접힌 줄에는 로고가 없다. 24px 슬롯에서는 글씨가
// 네 줄인 SSAFY 마크가 뭉개졌는데, 여기서는 상자가 커서 읽힌다.
const PANEL_LOGO_HEIGHT = 44;
const PANEL_LOGO_MAX_WIDTH = 148;

export default function AwardsAndCertificatesSection() {
  // 한 번에 하나만 펼친다. 여러 개가 열리면 세로 가운데 정렬이 화면
  // 밖으로 밀려 방금 누른 줄이 눈에서 사라진다.
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
      <div className="section-plate m-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {/* 화면에서는 뺀 제목. 섹션 이름을 쥔 유일한 요소라 접근성 트리에는
            남긴다. About·Skills·Experience와 같은 방식이다. */}
        <h2 id="awards-heading" className="sr-only">
          Awards & Certificates
        </h2>

        <p className="flex items-baseline justify-between gap-4 border-b border-[var(--color-hairline)] pb-2.5 text-t7 font-medium uppercase tracking-widest text-[var(--color-text-secondary)]">
          <span>Awards & Credentials</span>
          <span data-ledger-count className="text-[var(--color-cyan-hi)]">
            {ENTRIES.length}
          </span>
        </p>

        <ul>
          {ENTRIES.map((entry, index) => {
            const open = openId === entry.id;
            const panelId = `ledger-panel-${entry.id}`;

            return (
              <li
                key={entry.id}
                data-ledger-row={entry.title}
                data-ledger-open={open ? 'true' : undefined}
                // 왼쪽 선은 접혀 있을 때도 자리를 차지한다. 열릴 때만
                // 그리면 줄 전체가 2px 밀려 목록이 흔들린다.
                className={`border-b border-l-2 border-b-[var(--color-hairline)] pl-3 sm:pl-4 ${
                  open ? 'border-l-[var(--color-cyan-core)]' : 'border-l-transparent'
                }`}
              >
                <h3>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenId(open ? null : entry.id)}
                    className="grid w-full cursor-pointer grid-cols-[1.5rem_1fr_auto] items-center gap-x-4 py-4 text-left focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
                  >
                    <span
                      data-ledger-field="index"
                      className="text-t7 tabular-nums text-[var(--color-text-secondary)]"
                    >
                      {index + 1}
                    </span>

                    <span
                      data-ledger-field="title"
                      className={`text-t4 font-medium transition-colors ${
                        open
                          ? 'text-[var(--color-cyan-hi)]'
                          : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      {entry.title}
                    </span>

                    <span
                      data-ledger-field="grade"
                      className="flex items-center gap-2 text-t7 uppercase tracking-widest text-[var(--color-text-secondary)]"
                    >
                      <span
                        aria-hidden
                        className="block size-1 rounded-full bg-[var(--color-cyan-core)]"
                      />
                      {entry.grade}
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
                    <div className="grid gap-5 pb-6 sm:grid-cols-[minmax(0,180px)_1fr] sm:gap-8">
                      <span
                        aria-hidden
                        data-ledger-logo={entry.logo}
                        className="flex h-28 items-center justify-center border border-[var(--color-hairline)] bg-[rgb(0_0_0_/_0.35)] sm:h-40"
                      >
                        <span
                          className="org-logo"
                          style={orgLogoStyle(
                            entry.logo,
                            PANEL_LOGO_HEIGHT,
                            PANEL_LOGO_MAX_WIDTH
                          )}
                        />
                      </span>

                      <div className="flex flex-col gap-2">
                        <p
                          data-ledger-field="issuer"
                          className="text-t7 uppercase tracking-widest text-[var(--color-cyan-hi)]"
                        >
                          {entry.issuer}
                        </p>

                        <p
                          data-ledger-field="timeline"
                          className="text-t7 text-[var(--color-text-secondary)]"
                        >
                          {entry.timeline}
                        </p>

                        {entry.description && (
                          <p
                            data-ledger-field="description"
                            className="mt-1 text-t5 leading-relaxed text-[var(--color-text-secondary)]"
                          >
                            {entry.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
