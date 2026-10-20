// 첫 페인트 전에 <head>에서 돈다. 홈(/)에서만 건다. 커튼이 첫 프레임부터 덮어야 이름이 nav에서 Hero로 옮겨지는 것과
// 배경의 초기 광휘가 보이지 않는다. 해시 목적지·모션 감소·앞뒤 이동·저장된 읽기 위치는 커튼 없이 바로 간다.
// JS가 아예 없으면 속성이 붙지 않아 정적 첫 화면이다. 본 번들이 오지 않으면 load 3초 뒤(늦어도 10초) 커튼을 걷는다.
// 하이드레이션은 시간을 나눠 돌아 load 뒤에도 이어질 수 있다. 1초는 느린 기기에서 React가 맡기 전에 걷혔다.
// React가 인트로를 맡으면 값이 'playing'으로 바뀌어 이 안전장치는 손대지 않는다.
export const INTRO_GATE_SCRIPT = `(function(){try{var d=document.documentElement,h=location.hash,s=history.state,n=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];if(location.pathname==='/'&&(h===''||h==='#overview')&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!(n&&n.type==='back_forward')&&!(s&&s.sectionScrollY>0)){d.setAttribute('data-intro','');var drop=function(){if(d.getAttribute('data-intro')==='')d.removeAttribute('data-intro')};addEventListener('load',function(){setTimeout(drop,3000)});setTimeout(drop,10000)}}catch(e){}})();`;
