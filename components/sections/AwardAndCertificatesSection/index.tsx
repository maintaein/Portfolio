import { awards, certificates } from '@/lib/data';
import { orgLogoStyle } from '@/lib/logos';
import { SECTION_IDS } from '@/lib/constants';

// 계기 줄의 개수는 두 자리로 읽는다. `AWARDS 03`처럼 자릿수가 고정돼야
// 수상이 한 건 늘어도 줄이 흔들리지 않는다.
const count = (n: number) => String(n).padStart(2, '0');

// 로고 슬롯 높이. 자격증 행은 수상 행보다 한 단 낮은 위계라 4px 작다.
// 폭 상한은 걸지 않는다. 여기 오는 로고 중 가장 납작한 한국경제도 24px
// 높이에서 97px이라 줄을 밀어내지 않는다.
const AWARD_LOGO_HEIGHT = 24;
const CREDENTIAL_LOGO_HEIGHT = 20;

// 로고 열은 폭을 고정한다. auto로 두면 행마다 로고 폭이 그 행의 열 너비가
// 돼서, 97px짜리 한국경제가 있는 행만 제목이 오른쪽으로 밀린다. 원장의
// 값은 열이 맞아야 읽히므로 가장 넓은 로고에 맞춰 잠그고 로고는 오른쪽에
// 붙여 텍스트 열과의 간격을 고르게 둔다. 두 목록이 같은 값을 써야 수상과
// 자격증의 제목 시작점도 맞는다.
const ROW_COLUMNS = 'sm:grid-cols-[104px_1fr_auto]';

// 탭이 사라지면서 유일한 클라이언트 상태였던 activeTab도 같이 사라져
// 이 파일에는 훅도 핸들러도 없다. HomeClient가 클라이언트 경계 안에서
// 부르므로 번들에는 함께 들어가지만 실행할 상태가 없다.
export default function AwardsAndCertificatesSection() {
  return (
    <section
      id={SECTION_IDS.AWARDS_CERTIFICATES}
      aria-labelledby="awards-heading"
      className="flex min-h-full py-6 lg:py-8"
    >
      {/* min-h-full과 자식의 m-auto가 세로 가운데 정렬이다. flex의
          items-center를 쓰면 내용이 상자보다 길 때 위쪽이 잘려 스크롤로도
          닿지 못한다. SkillsSection과 같은 처방이다. */}
      <div className="section-plate m-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        {/* 화면에서는 뺀 제목. 섹션 이름을 쥔 유일한 요소라 접근성 트리에는
            남긴다. About·Skills·Experience와 같은 방식이다. */}
        <h2 id="awards-heading" className="sr-only">
          Awards & Certificates
        </h2>

        <p className="flex items-baseline justify-between gap-4 border-b border-[var(--color-hairline)] pb-2.5 text-t7 font-medium uppercase tracking-widest text-[var(--color-text-secondary)]">
          <span>Awards</span>
          <span data-award-count className="text-[var(--color-cyan-hi)]">
            {count(awards.length)}
          </span>
        </p>

        <ol>
          {awards.map((award) => (
            <li
              key={award.id}
              data-award-row={award.title}
              className={`grid gap-x-6 gap-y-2 border-b border-[var(--color-hairline)] py-4 ${ROW_COLUMNS}`}
            >
              {/* 주관사 로고를 행 맨 앞에 둔다. 이 섹션이 파는 것은 스스로
                  쓴 설명이 아니라 바깥에서 받은 검증이라, 먼저 눈에 닿는
                  자리에 발급처를 놓는다. */}
              <span
                aria-hidden
                data-award-logo={award.logo}
                className="org-logo shrink-0 sm:mt-1 sm:justify-self-end"
                style={orgLogoStyle(award.logo, AWARD_LOGO_HEIGHT)}
              />

              <div className="flex flex-col gap-2">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    data-award-field="rank"
                    className="text-t7 font-medium uppercase tracking-widest text-[var(--color-cyan-hi)]"
                  >
                    {award.rank}
                  </span>
                  <span
                    data-award-field="title"
                    className="text-t4 font-semibold text-[var(--color-text-primary)]"
                  >
                    {award.title}
                  </span>
                </p>

                {award.description && (
                  <p
                    data-award-field="description"
                    className="text-t5 leading-relaxed text-[var(--color-text-secondary)]"
                  >
                    {award.description}
                  </p>
                )}

                <p
                  data-award-field="meta"
                  className="text-t7 text-[var(--color-text-secondary)]"
                >
                  {award.organization}
                  <span aria-hidden className="px-2 text-[var(--color-hairline)]">
                    ·
                  </span>
                  {award.project}
                </p>
              </div>

              <p
                data-award-field="date"
                className="text-t7 uppercase tracking-widest text-[var(--color-text-secondary)] sm:text-right"
              >
                {award.date}
              </p>
            </li>
          ))}
        </ol>

        {/* 자격증은 한 건뿐이라 탭으로 나누지 않는다. 같은 화면의 아래쪽에
            낮은 위계로 붙여 읽기 흐름을 끊지 않는다. */}
        <p className="mt-8 flex items-baseline justify-between gap-4 border-b border-[var(--color-hairline)] pb-2.5 text-t7 font-medium uppercase tracking-widest text-[var(--color-text-secondary)]">
          <span>Credential</span>
          <span data-credential-count>{count(certificates.length)}</span>
        </p>

        <ul>
          {certificates.map((certificate) => (
            <li
              key={certificate.id}
              data-credential-row={certificate.name}
              className={`grid gap-x-6 gap-y-1 border-b border-[var(--color-hairline)] py-3 ${ROW_COLUMNS}`}
            >
              <span
                aria-hidden
                data-credential-logo={certificate.logo}
                className="org-logo shrink-0 sm:justify-self-end"
                style={orgLogoStyle(certificate.logo, CREDENTIAL_LOGO_HEIGHT)}
              />

              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  data-credential-field="name"
                  className="text-t5 font-medium text-[var(--color-text-primary)]"
                >
                  {certificate.name}
                </span>
                <span
                  data-credential-field="organization"
                  className="text-t7 text-[var(--color-text-secondary)]"
                >
                  {certificate.organization}
                </span>
                {certificate.validUntil && (
                  <span
                    data-credential-field="validUntil"
                    className="text-t7 text-[var(--color-text-secondary)]"
                  >
                    유효 {certificate.validUntil}
                  </span>
                )}
              </p>

              <p
                data-credential-field="date"
                className="text-t7 uppercase tracking-widest text-[var(--color-text-secondary)] sm:text-right"
              >
                {certificate.date}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
