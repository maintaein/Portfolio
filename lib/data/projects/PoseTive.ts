import { Project } from '@/types';

export const poseTive: Project = {
  title: 'PoseTive',
  subtitle: '이미지의 포즈를 사용자가 그리는 대로 변환할 수 있는 AI 기반 웹 서비스',
  image: '/projects/Posetive.webp',
  tags: ['Python', 'PyTorch', 'Image Recognition', 'Pose Estimation', 'Pandas', 'NumPy'],
  duration: '2024.03 - 2024.06',
  role: 'AI 모델링',
  teamSize: '6명',

  motivation: '웹툰이나 일러스트를 그릴 때 캐릭터의 포즈를 매번 처음부터 그리는 것은 손목에도, 시간에도 큰 부담입니다. 캐릭터는 이미 있으니 포즈만 간단히 스케치해서 붙이면 그 포즈대로 캐릭터가 움직여주면 어떨까라는 아이디어에서 출발했습니다.',
  implementations: [
    {
      category: '모델 파인튜닝',
      items: ['자체 데이터셋 약 3,000장을 활용한 포즈 추정 모델 파인튜닝'],
    },
    {
      category: '과적합 해결',
      items: ['모델 레이어 분석을 통한 과적합 문제 해결', '조기 종료(Early Stopping)로 검증 정확도 88% 달성'],
    },
    {
      category: '전이 학습',
      items: ['사전 학습된 ResNet 초기 레이어 동결, 후반부만 재학습으로 60시간 단축'],
    },
    {
      category: '모델 최적화',
      items: ['8-bit 양자화 + 해상도 조정으로 모델 450MB → 45MB, 추론 속도 48% 개선'],
    },
  ],

  reviews: [
    {
      title: '조기 종료(Early Stopping)로 과적합 방지',
      problem: '모델이 학습 데이터에는 높은 정확도를 보이면서 실제 사용자의 드로잉에는 엉뚱한 결과를 내는 과적합 징후가 나타났습니다. 학습을 더 돌릴수록 검증 성능이 오히려 하락하는 패턴이 확인되었습니다.',
      analysis: [
        '**진단 — 더 돌릴수록 나빠지고 있었다**: 학습 데이터 정확도는 계속 올라가는데 검증 정확도는 어느 시점부터 도리어 떨어졌습니다. 모델이 3,000장짜리 학습 데이터에 과하게 맞춰지고 있다는 신호였고, 무엇을 더 넣느냐가 아니라 언제 멈추느냐가 성능을 가르는 상황이었습니다.',
        '**선택지 1 — 고정된 epoch 수로 학습**: 언제 멈춰야 할지 알기 어렵고, 지나치게 많이 학습하면 과적합이 심해집니다.',
        '**선택지 2 — 검증 성능 기반 조기 종료 (선택)**: 매 epoch마다 전체 검증셋을 한 번에 평가하고, 검증 성능이 더 이상 개선되지 않으면 학습을 조기에 멈춥니다. 학습 데이터가 아닌 검증 성능을 기준으로 삼기 때문에 과적합을 사전에 차단할 수 있습니다.',
      ],
      action: [
        '각 epoch마다 전체 검증셋 평가',
        '성능이 더 이상 개선되지 않으면 조기 종료(Early Stopping) 적용',
        '검증 정확도 88% · 범용 정확도 87% 달성',
      ],
      result: [
        { label: '검증 정확도', after: '88%', measuredBy: '매 epoch 학습에 쓰지 않은 검증셋 전체 평가' },
        { label: '범용 정확도', after: '87%' },
      ],
      tradeOffs: [
        '조기 종료 기준(patience)을 너무 엄격하게 설정하면 충분히 학습되지 않은 상태에서 멈출 수 있습니다. patience 값은 데이터셋 크기와 학습 곡선을 보며 경험적으로 조정해야 합니다.',
      ],
    }
  ],

  githubUrl: 'https://github.com/Kim-Taein/9jodae_pose'
};
