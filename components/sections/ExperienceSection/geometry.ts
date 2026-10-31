// transform을 뺀 레이아웃 좌표(문서 기준). 공개 전 translateY(18px)가 잰 값을 흔들지 않는다.
export const docOffset = (el: HTMLElement, key: 'offsetTop' | 'offsetLeft') => {
  let v = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) v += node[key];
  return v;
};

// 타임라인 축 x, 장마다 노드 y, 선 끝 y(마지막 장 아래 −80px). 모두 문서 좌표다. ExperienceSection과 Skills 넘김이 같은 식을 쓴다.
export function measureTimeline(section: HTMLElement): { axisX: number; nodes: number[]; tail: number } {
  const axis = section.querySelector<HTMLElement>('[data-part="experience-axis"]');
  const chapters = [...section.querySelectorAll<HTMLElement>('article')];
  const end = chapters.at(-1);
  return {
    axisX: axis ? docOffset(axis, 'offsetLeft') + axis.offsetWidth / 2 : 0,
    nodes: chapters.map(c => { const h = c.querySelector<HTMLElement>('[data-part="experience-node"]')!; return docOffset(h, 'offsetTop') + Math.min(h.offsetHeight, 60) / 2; }),
    tail: end ? docOffset(end, 'offsetTop') + end.offsetHeight - 80 : 0,
  };
}
