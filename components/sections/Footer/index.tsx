'use client';

import { useState } from 'react';
import { contact } from '@/lib/data';
import { useCopyToClipboard } from '@/hooks';

const EMAIL_KEY = 'footer-email';

// 모든 섹션 위에 항상 보이는 크롬 한 줄이다 — CONTACT 목적지와 달리 콘텐츠가
// 아니므로 CTA 문구를 담지 않는다.
//
// .section-stage(styles/design-tokens.css)가 inset으로 하단
// 45px + safe-area를 이미 비워 두므로 그 자리에 고정한다. 예전처럼
// position:static 흐름에 두면 fixed 셸(.section-stage) 아래 유일한 흐름
// 콘텐츠가 되어 문서 원점(y=0)에 렌더되고, section 배경이 투명해 모든 섹션
// 위로 비쳐 보인다 — position:fixed로 문서 흐름 자체에서 빠지면 그 경로가
// 구조적으로 없어진다.
export default function Footer() {
  const year = new Date().getFullYear();
  const { state, copy } = useCopyToClipboard();
  // 복사가 한 번 실패하면 이 페이지가 살아 있는 동안 이메일 라벨을
  // 드래그로 통째로 선택 가능하게 유지한다. 훅의 state는 2초 뒤 null로
  // 돌아가므로 이 플래그는 훅이 아니라 여기서 로컬로 들고 있어야 한다.
  const [selectable, setSelectable] = useState(false);

  const isCopied = state?.key === EMAIL_KEY && state.status === 'copied';
  const isFailed = state?.key === EMAIL_KEY && state.status === 'failed';

  async function handleCopyEmail() {
    const ok = await copy(contact.email, EMAIL_KEY);
    if (!ok) {
      setSelectable(true);
    }
  }

  const emailLabel = isCopied ? 'COPIED' : isFailed ? 'SELECT EMAIL' : contact.email;
  const liveMessage = isCopied
    ? '이메일 주소가 클립보드에 복사됐습니다.'
    : isFailed
      ? '복사에 실패했습니다. 이메일 주소를 직접 선택해 복사하세요.'
      : '';

  return (
    <footer className="site-footer fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-x-6 border-t border-[rgb(255_255_255_/_0.08)] bg-[rgb(0_0_0_/_0.35)] backdrop-blur-md px-4 pb-[env(safe-area-inset-bottom,0px)] text-t8 text-[var(--color-text-secondary)]">
      <button
        type="button"
        onClick={handleCopyEmail}
        aria-label={`이메일 주소 ${contact.email} 복사`}
        className="relative flex h-11 items-center px-2 transition-colors duration-300 hover:text-[var(--color-cyan-core)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
      >
        {/* 라벨이 바뀔 때 레일이 흔들리면 안 된다. 가장 긴 문자열(이메일
            주소)을 정상 흐름에 깔아 폭을 예약하고, 살아 있는 라벨은 그 위에
            절대 배치로 얹는다. */}
        <span aria-hidden="true" className="invisible">
          {contact.email}
        </span>
        <span
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center whitespace-nowrap ${
            selectable && !isCopied && !isFailed ? 'select-all' : ''
          }`}
        >
          {emailLabel}
        </span>
      </button>
      <span className="hidden sm:inline">
        © {year} {contact.name}. All rights reserved.
      </span>
      <a
        href={contact.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-11 items-center transition-colors duration-300 hover:text-[var(--color-cyan-core)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
      >
        {contact.githubUrl.replace('https://', '')}
      </a>
      {/* live region은 내용이 바뀌기 전부터 DOM에 있어야 읽힌다. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>
    </footer>
  );
}
