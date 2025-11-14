'use client';

import { Aurora, Spotlight, BlurFade } from '@/components/ui';

export default function HeroSection() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      role="banner"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Aurora + Spotlight 배경 */}
      <Aurora className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Spotlight
          className="absolute inset-0"
          spotlightColor="rgba(139, 92, 246, 0.15)"
          size={800}
        >
          {/* 빈 div - Spotlight는 마우스 효과만 제공 */}
          <div className="absolute inset-0" />
        </Spotlight>
      </Aurora>

      {/* 컨텐츠 */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex flex-col items-center text-center space-y-8 sm:space-y-12">

          {/* 프로필 이미지 영역 (선택적) */}
          <BlurFade delay={0.2} duration={0.8}>
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48">
              {/* 프로필 이미지 플레이스홀더 */}
              <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 p-1">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                  <span className="text-4xl sm:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                    김
                  </span>
                </div>
              </div>

              {/* 장식 링 */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 opacity-20 blur-xl animate-pulse" />
            </div>
          </BlurFade>

          {/* 인사말 */}
          <BlurFade delay={0.4} duration={0.8}>
            <div className="space-y-2 sm:space-y-3">
              <h1
                id="hero-title"
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white"
              >
                안녕하세요 👋
              </h1>
            </div>
          </BlurFade>

          {/* 메인 메시지 */}
          <BlurFade delay={0.6} duration={0.8}>
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-white/90">
                <span className="inline-block bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  사용자의 눈과 마음
                </span>
                을 고려하는
              </h2>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-white/90">
                프론트엔드 개발자{' '}
                <span className="inline-block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent font-bold">
                  김태인
                </span>
                입니다
              </h2>
            </div>
          </BlurFade>

          {/* 부제목 */}
          <BlurFade delay={0.8} duration={0.8}>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/70 max-w-3xl leading-relaxed px-4">
              코드로 아름다운 경험을 만들고,
              <br className="hidden sm:block" />
              디테일로 완벽한 인터페이스를 구현합니다
            </p>
          </BlurFade>

          {/* CTA 버튼들 */}
          <BlurFade delay={1} duration={0.8}>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-4 sm:pt-8">
              <a
                href="#projects"
                className="group relative px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
              >
                <span className="relative z-10">프로젝트 보기</span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </a>

              <a
                href="#about"
                className="group px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl border-2 border-white/20 transition-all duration-300 hover:bg-white/20 hover:border-white/40 hover:scale-105"
              >
                <span>소개 읽기</span>
              </a>
            </div>
          </BlurFade>

          {/* 스크롤 인디케이터 */}
          <BlurFade delay={1.2} duration={0.8}>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
              <span className="text-white/50 text-sm">아래로 스크롤</span>
              <svg
                className="w-6 h-6 text-white/50"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
              </svg>
            </div>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
