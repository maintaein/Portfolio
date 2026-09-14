import { Project } from '@/types';

export const alphaMail: Project = {
  title: 'AlphaMail',
  subtitle: 'AI 기반 업무 자동화 웹 메일 서비스',
  image: '/projects/Alphamail.webp',
  tags: ['React', 'TypeScript', 'React-query', 'Zustand', 'TailwindCSS', 'MaterialUI', 'FSD', 'Atomic'],
  duration: '2025.04 - 2025.05',
  role: '웹 프론트엔드 개발 / 프론트엔드 리더',
  teamSize: '6명',

  motivation: '메일로 쌓이는 히스토리를 관리하고 반복 작업은 대신 처리해주는 서비스. 실무에서 메일로 쌓이는 히스토리를 매번 파악하는것이 번거로웠습니다. 메일에 들어온 내용을 읽고, 해야 할 일을 정리하고, 간단한 작업은 직접 처리하여 반복 작업을 단순화할 수 있을 것이라 생각해 제작했습니다.',
  implementations: [
    {
      category: 'AI 업무 비서',
      items: ['메일 내용을 자동으로 분석하여 홈 대시보드에 업무를 정리하고 수행'],
      intent:'대시보드만으로도 대부분의 업무를 파악하고 처리할 수 있도록 하는 것이 목표였습니다. 이를 위해 기능의 핵심들을 대시보드에서 정리해서 볼 수 있도록 구현했습니다.',
      video: '/projects/alphamail/alphaHomeService.mp4',
    },
    {
      category: '스마트 메일 서비스',
      items: ['AI 기반 스레드 요약과 자동 메일 작성 기능'],
      intent:'메일 서비스는 기존 서비스들의 UI/UX에서 크게 벗어나지 않되, AI 기능을 도입하여 차별화를 주고자 했습니다.',
      video: '/projects/alphamail/mailService.mp4',
    },
    {
      category: '전역 챗봇',
      items: ['모든 화면에서 동작하는 업무 지원 챗봇'],
      intent:'1차 MVP를 구현하고 나니 AI의 역할이 서비스 내에서 잘 느껴지지 않는다는 피드백이 있었습니다. 해당 피드백을 수용하여 서비스 전체를 관리하는 AI챗봇으로 사용자가 좀 더 직관적으로 AI의 도움을 받도록 했습니다.',
      video: '/projects/alphamail/chatbotService.mp4',
    },
    {
      category: '문서 작업 자동화',
      items: ['거래처, 발주서, 견적서 관리 등 문서 업무 자동 처리'],
      intent:'AI가 처리한 작업이 잘 수행되었는지 확인할 수 있도록 업무에 대한 상세 화면을 구현했습니다.',
      video: '/projects/alphamail/workService.mp4',
    },
  ],

  reviews: [
    {
      title: '홈 대시보드: 메일로 들어온 내용이 실시간으로 대시보드에 정리되지 않는 현상',
      problem: '기존에는 `setInterval`로 10초마다 대시보드 데이터를 가져왔습니다. 새 메일로 생성된 AI 업무가 다음 조회 시점까지 보이지 않았고, 대시보드에서 업무를 등록하거나 삭제해도 화면이 바로 바뀌지 않았습니다. 10초 주기를 더 짧게 줄이면 요청 수가 늘어나는 문제도 있었습니다.',
      analysis: [
        '**진단: 10초마다 확인하는 방식은 정해진 주기만 기다려야 했다**: `setInterval`은 새 메일이 들어온 시점이나 사용자의 업무 처리 시점을 알지 못합니다. 결국 다음 10초가 지나야 대시보드가 바뀌는 구조였습니다.',
        '**선택지 1: 조회 주기를 더 짧게 줄이기**: 새 메일은 더 빨리 확인할 수 있지만 요청 수와 서버 부하가 함께 늘어납니다. 사용자가 직접 처리한 업무도 여전히 정해진 주기를 기다려야 합니다.',
        '**선택지 2: WebSocket으로 교체하기**: 서버 변경을 즉시 받을 수 있지만, 현재 서비스에는 별도 연결을 유지할 만큼의 실시간 협업 요구가 없습니다. 구현 비용도 현재 문제보다 큽니다.',
        '**선택지 3: React Query의 갱신 기능으로 교체하기 (선택)**: react query 공식 문서를 확인하여 방법을 찾아냈습니다. 새 메일은 `refetchInterval`로 주기적으로 확인하고, 사용자가 처리한 업무는 `invalidateQueries`로 즉시 갱신합니다. 브라우저로 돌아왔을 때도 `refetchOnWindowFocus`로 최신 데이터를 가져오도록 했습니다.',
      ],
      action: [
        'AI 업무 비서와 안 읽은 메일은 React Query의 `refetchInterval: 20000`으로 주기 갱신하도록 했습니다.',
        '홈 화면에서 직접 사용하던 10초 `setInterval`과 수동 갱신 코드를 제거했습니다.',
        'AI 업무 등록·삭제와 메일 읽음 상태 변경이 성공하면 관련 쿼리를 무효화해 즉시 다시 가져오도록 했습니다.',
      ],
      resultHeadline: '10초 주기 조회에서 실시간에 가까운 갱신 방식으로 개선',
      result: [
        { label: '새 메일 반영 방식', before: '10초마다 `setInterval`로 데이터를 다시 조회', after: 'React Query가 20초마다 대시보드 데이터를 확인', measuredBy: '`useHome.ts`와 `useUnreadMails.ts` 코드 확인' },
        { label: '업무 처리 반영 속도', before: '업무 등록·삭제 후 다음 조회 주기까지 대기', after: '처리 성공 직후 `invalidateQueries`로 목록 갱신', measuredBy: '등록·삭제 뮤테이션의 성공 콜백 확인' },
        { label: '페이지 복귀 후 데이터', before: '다음 10초 주기까지 이전 데이터가 보일 수 있음', after: '창에 돌아오면 `refetchOnWindowFocus`로 최신 데이터 확인', measuredBy: '홈 쿼리의 React Query 설정 확인' },
      ],
      tradeOffs: [
        '`refetchInterval`이 20초이므로 다른 사용자의 변경은 최대 20초 뒤 반영될 수 있습니다. 서버 변경을 즉시 받아야 하는 협업 기능이 추가되면 WebSocket이나 SSE를 검토해야 합니다.',
        '주기 조회는 서버 요청을 완전히 없애지는 못합니다. 사용자가 늘어날 때 응답 지연이 다시 커지면 서버 캐싱을 추가로 검토해야 합니다.',
      ],
    }
  ],

  githubUrl: 'https://github.com/mail-coding/AlphaMail',
};
