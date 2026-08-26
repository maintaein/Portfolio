'use client';

import { contact } from '@/lib/data';

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

  return (
    <footer className="site-footer fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 text-center text-t8 text-[var(--color-text-secondary)]">
      <a
        href={`mailto:${contact.email}`}
        className="hover:text-[var(--color-cyan-core)] transition-colors duration-300"
      >
        {contact.email}
      </a>
      <span>
        © {year} {contact.name}. All rights reserved.
      </span>
      <a
        href={contact.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-[var(--color-cyan-core)] transition-colors duration-300"
      >
        {contact.githubUrl.replace('https://', '')}
      </a>
    </footer>
  );
}
