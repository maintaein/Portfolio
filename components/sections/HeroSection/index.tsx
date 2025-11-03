'use client';

import { useState, useEffect } from 'react';

export default function HeroSection() {
  const [codeLines, setCodeLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [browserText, setBrowserText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const code = [
    'body {',
    '  font-family: Pretendard;',
    '  margin: 0;',
    '}',
    '',
    'h1 {',
    '  font-size: 3rem;',
    '  font-weight: bold;',
    '  color: #1a1a1a;',
    '}',
    '',
    '.highlight {',
    '  background: linear-gradient(',
    '    to right,',
    '    #667eea,',
    '    #764ba2',
    '  );',
    '  -webkit-background-clip: text;',
    '  color: transparent;',
    '}',
  ];

  // 줄바꿈 포함된 텍스트 - 배열로 관리
  const textLines = ['사용자의 눈과 마음을', '고려하는 프론트엔드'];
  const fullText = textLines.join('');

  // 타이핑 애니메이션
  useEffect(() => {
    if (currentLine >= code.length) return;

    const currentText = code[currentLine];
    
    if (currentChar < currentText.length) {
      const timer = setTimeout(() => {
        setCodeLines(prev => {
          const newLines = [...prev];
          if (newLines[currentLine] !== undefined) {
            newLines[currentLine] = currentText.slice(0, currentChar + 1);
          } else {
            newLines.push(currentText.slice(0, currentChar + 1));
          }
          return newLines;
        });
        setCurrentChar(prev => prev + 1);
        
        // 코드 1글자마다 브라우저 텍스트 1글자 추가
        if (currentChar % 7 === 0 && browserText.length < fullText.length) {
          setBrowserText(fullText.slice(0, browserText.length + 1));
        }
      }, 10);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setCurrentLine(prev => prev + 1);
        setCurrentChar(0);
      }, 25);
      return () => clearTimeout(timer);
    }
  }, [currentLine, currentChar, browserText.length, code, fullText]);

  // 브라우저 텍스트 완성
  useEffect(() => {
    if (browserText.length < fullText.length && currentLine >= code.length) {
      const timer = setTimeout(() => {
        setBrowserText(fullText.slice(0, browserText.length + 1));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [browserText, code.length, currentLine, fullText]);

  // 타이핑 완료 후 커서 숨기기
  useEffect(() => {
    if (browserText.length >= fullText.length) {
      const timer = setTimeout(() => {
        setShowCursor(false);
      }, 500); // 0.5초 후 커서 사라짐
      return () => clearTimeout(timer);
    }
  }, [browserText.length, fullText.length]);

  // 애니메이션 완료 상태 설정
  useEffect(() => {
    if (!showCursor && browserText.length >= fullText.length) {
      const timer = setTimeout(() => {
        setIsAnimationComplete(true);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [showCursor, browserText.length, fullText.length]);

  // 텍스트를 줄바꿈에 맞게 분리
  const getDisplayText = () => {
    const line1Length = textLines[0].length;
    
    if (browserText.length <= line1Length) {
      return { line1: browserText, line2: '', showCursorOnLine: 1 };
    } else {
      return {
        line1: textLines[0],
        line2: browserText.slice(line1Length),
        showCursorOnLine: 2
      };
    }
  };

  const displayText = getDisplayText();

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      role="banner"
      className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center pt-0 pb-4 px-4 sm:pt-0 sm:pb-6 sm:px-6 lg:pt-0 lg:pb-8 lg:px-8 relative"
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 transition-opacity duration-1000 pointer-events-none ${
          isAnimationComplete ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ zIndex: 1 }}
      />

      <div className="w-full max-w-7xl flex flex-col items-center relative z-10">
        
        <div className="relative w-full max-w-[1200px] mb-8 sm:mb-12 lg:mb-16" style={{ aspectRatio: '16/9' }}>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full max-w-[95%] max-h-[95%]">
              
              <div className="absolute left-0 top-[5%] w-[50%] h-[80%] z-20">
                <div className="w-full h-full bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700 flex flex-col">
                  <div className="bg-gray-800 px-4 py-3 flex items-center gap-2 border-b border-gray-700 flex-shrink-0">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="ml-4 text-gray-400 text-sm font-mono">styles.css</span>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-6 font-mono text-sm ide-scrollbar">
                    {codeLines.map((line, index) => (
                      <div key={index} className="flex leading-relaxed">
                        <span className="text-gray-600 mr-6 select-none w-8 text-right flex-shrink-0">
                          {index + 1}
                        </span>
                        <pre className="text-green-400 whitespace-pre flex-1">
                          {line}
                          {index === currentLine && currentChar < code[currentLine]?.length && (
                            <span className="inline-block w-2 h-5 bg-green-400 animate-pulse ml-0.5"></span>
                          )}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute right-0 top-[10%] w-[63%] h-[85%] z-10">
                <div className="w-full h-full bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-300 flex flex-col">
                  <div className="bg-gray-200 px-4 py-3 flex items-center gap-2 border-b border-gray-300 flex-shrink-0">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <div className="ml-4 flex-1 bg-white rounded-md px-4 py-1.5 text-sm text-gray-600 flex items-center gap-2 border border-gray-300">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="truncate">https://kimtaein.vercel.app/</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-8 lg:p-12 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
                    <div className="h-full flex flex-col justify-center">
                      <div className="mb-8">
                        <div className="h-2 w-32 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"></div>
                      </div>
                      
                      <div className="ml-auto w-full pl-[20%]">
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                          <div className="flex items-center">
                            <span>
                              {displayText.line1}
                            </span>
                            {browserText.length < fullText.length && displayText.showCursorOnLine === 1 && showCursor && (
                              <span className="inline-block w-1 h-10 lg:h-12 bg-gray-900 animate-blink ml-1"></span>
                            )}
                          </div>
                          
                          {displayText.line2 && (
                            <div className="flex items-center">
                              <span>
                                {displayText.line2}
                              </span>
                              {browserText.length < fullText.length && displayText.showCursorOnLine === 2 && showCursor && (
                                <span className="inline-block w-1 h-10 lg:h-12 bg-gray-900 animate-blink ml-1"></span>
                              )}
                            </div>
                          )}
                        </h1>
                        
                        <div 
                          className={`space-y-3 transition-all duration-1000 ${
                            browserText.length >= fullText.length 
                              ? 'opacity-100 translate-y-0' 
                              : 'opacity-0 translate-y-4'
                          }`}
                        >
                          <div className="h-4 bg-gradient-to-r from-gray-200 to-transparent rounded w-full"></div>
                          <div className="h-4 bg-gradient-to-r from-gray-200 to-transparent rounded w-2/3"></div>
                          <div className="h-4 bg-gradient-to-r from-gray-200 to-transparent rounded w-4/5"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`text-center px-4 transition-all duration-1000 ${
            isAnimationComplete
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <h1 id="hero-title" className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
            안녕하세요
          </h1>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-700 mb-3 sm:mb-4">
            프론트엔드 개발자{' '}
            <span className="bg-gradient-to-r from-blue-600 to-blue-300 bg-clip-text text-transparent">
              김태인
            </span>
            입니다.
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
            사용자 경험을 최우선으로 생각하며,<br />
            코드로 아름다운 인터페이스를 만듭니다.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 50% {
            opacity: 1;
          }
          51%, 100% {
            opacity: 0;
          }
        }
        
        .animate-blink {
          animation: blink 0.8s infinite;
        }

        .ide-scrollbar::-webkit-scrollbar {
          width: 14px;
          height: 14px;
        }
        
        .ide-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.3);
          border-radius: 10px;
        }
        
        .ide-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(75, 85, 99, 0.5);
          border-radius: 10px;
          border: 3px solid rgba(31, 41, 55, 0.3);
        }
        
        .ide-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.7);
        }

        .ide-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(75, 85, 99, 0.5) rgba(31, 41, 55, 0.3);
        }
      `}</style>
    </section>
  );
}