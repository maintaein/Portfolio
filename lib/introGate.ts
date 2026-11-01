import { HOME_SECTION_CONFIG } from '@/lib/constants';

// 첫 페인트 전에 <head>에서 돈다. 홈(/)에서만 건다. 진입할 방문은 첫 프레임부터 출발 상태(이름·문장·오브젝트 숨김, 배경 안개 꺼짐)여야
// 완성된 첫 화면이 한 번 비치거나 이름이 nav에서 Hero로 뛰어내리는 것이 보이지 않는다. 해시 목적지·모션 감소·앞뒤 이동·저장된 읽기 위치는 바로 완성된 첫 화면이다.
// JS가 아예 없으면 속성이 붙지 않아 정적 첫 화면이다. 본 번들이 오지 않으면 load 3초 뒤(늦어도 10초) 숨김을 걷는다.
// 하이드레이션은 시간을 나눠 돌아 load 뒤에도 이어질 수 있다. 1초는 느린 기기에서 React가 맡기 전에 걷혔다.
// React가 진입을 맡으면 값이 'playing'으로 바뀌어 이 안전장치는 손대지 않는다.
// 이름 문턱 아래에서 시작하는 방문(새로고침·앞뒤 이동의 저장 위치, 아니면 섹션 해시. useSectionNav가 첫 스크롤을 정하는 규칙)은
// html[data-name-side='nav']를 붙여 경계 청크가 오기 전에도 이름이 nav 줄에 선다. 경계가 자리를 정하면 걷는다(motion.ts).
// shortcut: 180은 motion.ts NAME_DOWN을 옮겨 적었다. 문턱이 바뀌면 함께 고친다.
export const INTRO_GATE_SCRIPT = `(function(){try{var d=document.documentElement,h=location.hash,s=history.state,n=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];if(location.pathname==='/'&&(h===''||h==='#overview')&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!(n&&n.type==='back_forward')&&!(s&&s.sectionScrollY>0)){d.setAttribute('data-intro','');var drop=function(){if(d.getAttribute('data-intro')==='')d.removeAttribute('data-intro')};addEventListener('load',function(){setTimeout(drop,3000)});setTimeout(drop,10000)}var y=s&&s.sectionScrollY,t=n&&n.type;if(location.pathname==='/'&&((t==='reload'||t==='back_forward')&&typeof y==='number'&&isFinite(y)?y>=180:${JSON.stringify(HOME_SECTION_CONFIG.map(({ id }) => id))}.indexOf(h.slice(1))>-1))d.setAttribute('data-name-side','nav')}catch(e){}})();`;
