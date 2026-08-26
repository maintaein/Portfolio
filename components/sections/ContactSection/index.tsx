'use client';

import { useCopyToClipboard } from '@/hooks';
import { contact } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

// 예전 Footer의 CTA 영역(eyebrow · 대형 문구 · 이메일 복사)을 그대로
// 옮긴다 — overview의 START와 경쟁하지 않도록 독립된 여섯 번째 섹션이다.

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function ContactSection() {
  const { copiedKey, copy } = useCopyToClipboard();
  const copied = copiedKey === 'email';

  return (
    <section
      id={SECTION_IDS.CONTACT}
      aria-labelledby="contact-heading"
      className="text-[var(--color-text-primary)] py-16 sm:py-20 lg:py-24"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* 시스템 팔레트는 시안이다 — text-blue-400 대신 --color-cyan-core */}
        <p className="text-xs font-semibold tracking-widest text-[var(--color-cyan-core)] uppercase mb-3">
          Contact
        </p>
        {/* text-2xl(24px)/text-3xl(30px)은 t 스케일에 정확히 대응하는 값이
            없다. sm 쪽 30px과 정확히 같은 t1로 맞추고, 기본값은 가장 가까운
            t2(26px)로 옮긴다. */}
        <h2
          id="contact-heading"
          className="text-t2 sm:text-t1 font-semibold text-[var(--color-text-primary)]"
        >
          함께 만들 기회가 있다면
          <br />
          언제든 연락 주세요.
        </h2>

        {/* 이메일 복사 영역 */}
        <div className="inline-flex items-center gap-2.5 mt-5">
          <span className="text-[var(--color-text-secondary)] text-sm">{contact.email}</span>
          <button
            onClick={() => copy(contact.email, 'email')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              copied
                ? 'border-[var(--color-elevation-near)] text-[var(--color-cyan-hi)] bg-[var(--color-elevation-far)]'
                : 'border-[var(--color-hairline)] text-[var(--color-text-secondary)] hover:border-[var(--color-elevation-near)] hover:text-[var(--color-text-primary)]'
            }`}
            aria-label="이메일 복사"
          >
            {copied ? (
              <>
                <CheckIcon />
                <span>복사됨</span>
              </>
            ) : (
              <>
                <CopyIcon />
                <span>복사</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
