import { darkTokens } from '@/lib/theme/darkTokens';

// CSS 파일 요청 이전에 적용되어 첫 페인트의 배경색을 결정한다.
// 이 문자열이 라이트를 가리키면 사이트가 흰 화면으로 번쩍인 뒤 검게 바뀐다.
// 부팅 시퀀스의 첫인상 자리라 여기서 틀리면 되돌릴 수 없다.
export const CRITICAL_CSS = [
  '*,*::before,*::after{box-sizing:border-box}',
  `body{margin:0;background:${darkTokens.background};color:${darkTokens.text.primary};-webkit-font-smoothing:antialiased;overflow-x:hidden}`,
].join('');
