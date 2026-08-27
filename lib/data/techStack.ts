export interface TechStackIcon {
  name: string;
  path: string;
}

// 삭제된 TechParticleStorm(components/blocks/TechParticleStorm)의 techIcons
// 배열에서 그대로 옮긴 15개 목록이다. Cubes 격자와 그 옆의 sr-only 목록이
// 함께 쓴다. gridX·gridY·direction·distance는 파티클이 사방에서 날아와
// 모이는 연출 전용 값이라 격자에는 필요 없어 옮기지 않았다.
//
// lib/data/skills.tsx에 이미 있는 skillCategories와 합치지 않았다. 그쪽은
// Skills 섹션(계획 5)이 쓰는 다른 목록이다. 항목 구성이 다르고(HTML·CSS·
// Vite가 없고 Linux·Github·Figma·Notion·Jira가 있다) experience 설명까지
// 딸려 있어, 합치면 원본에 없는 매핑을 지어내야 한다.
export const techStack: TechStackIcon[] = [
  { name: 'JavaScript', path: '/icons/JS.webp' },
  { name: 'TypeScript', path: '/icons/TS.webp' },
  { name: 'React', path: '/icons/React.webp' },
  { name: 'Next.js', path: '/icons/next.webp' },
  { name: 'Python', path: '/icons/Python.webp' },
  { name: 'Java', path: '/icons/Java.webp' },
  { name: 'HTML', path: '/icons/HTML.webp' },
  { name: 'CSS', path: '/icons/CSS.webp' },
  { name: 'Tailwind', path: '/icons/Tailwind.webp' },
  { name: 'React Query', path: '/icons/react-query.webp' },
  { name: 'Zustand', path: '/icons/zustand.webp' },
  { name: 'Vite', path: '/icons/Vite.webp' },
  { name: 'Spring', path: '/icons/Spring.webp' },
  { name: 'MySQL', path: '/icons/MySQL.webp' },
  { name: 'Node.js', path: '/icons/nodejs.webp' },
];
