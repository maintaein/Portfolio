'use client';

import { useCopyToClipboard } from '@/hooks';
import { contact } from '@/lib/data';
import { GitHubIcon } from '@/components/atoms';


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

export default function Footer() {
  const year = new Date().getFullYear();
  const { copiedKey, copy } = useCopyToClipboard();
  const copied = copiedKey === 'email';

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        {/* CTA 영역 */}
        <div className="mb-10 sm:mb-12">
          <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-3">
            Contact
          </p>
          <p className="text-2xl sm:text-3xl font-semibold leading-snug text-white">
            함께 만들 기회가 있다면
            <br />
            언제든 연락 주세요.
          </p>

          {/* 이메일 복사 영역 */}
          <div className="inline-flex items-center gap-2.5 mt-5">
            <span className="text-white/70 text-sm">{contact.email}</span>
            <button
              onClick={() => copy(contact.email, 'email')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-300 ease-in-out ${
                copied
                  ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                  : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/80'
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

        {/* 구분선 */}
        <div className="border-t border-white/10" />

        {/* 하단 영역 */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-white/40">
            © {year} {contact.name}. All rights reserved.
          </p>
          <a
            href={contact.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white/50 hover:text-white transition-all duration-300 ease-in-out group"
            aria-label="GitHub 프로필"
          >
            <span className="text-sm group-hover:underline underline-offset-4 decoration-white/40">
              {contact.githubUrl.replace('https://', '')}
            </span>
            <GitHubIcon />
          </a>
        </div>
      </div>
    </footer>
  );
}
