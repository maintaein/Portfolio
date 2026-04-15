import { Project } from '@/types';

export const reBirth: Project = {
  title: 'ReBirth',
  subtitle: '카드 사용 방식을 새롭게 정의하는 모바일 금융 서비스',
  description: '카드 혜택 기반 소비관리를 지원하는 모바일 금융 서비스',
  longDescription: 'ReBirth는 사용자가 결제를 할 때, 해당 결제 항목에 대한 **최적의 카드를 자동으로 골라서 결제**해주고, 소비 관리에 대한 전반적인 지원까지 해주는 모바일 금융 서비스입니다.',
  image: '/projects/Rebirth.png',
  imageAspect: 'landscape',
  tags: [ 'Android Studio', 'Figma' , 'Kotlin', 'Jetpack Compose', 'Coroutines', 'MVVM', 'Retrofit', 'material3'],
  duration: '2025.02 - 2025.04',
  role: '모바일 프론트엔드 개발',
  teamSize: '6명',

  implementations: [
    {
      text: '💳 **스마트 결제 시스템**: 결제 시점에 최적 혜택 카드 자동 선택, QR 코드 결제와 다중 인증 방식 지원',
    },
    {
      text: '🎯 **개인화 서비스**: AI 기반 소비패턴 분석을 통해 최적 카드 제안, 월별 소비 패턴 분석 및 리포트 제공',
    },
    {
      text: '📊 **데이터 관리**: 마이데이터 연동으로 실시간 거래 내역 동기화, 카드 혜택 요약 및 관리',
    }
  ],

  responsibilities: [
    '모바일 프론트엔드 개발'
  ],

  techReasons: [
    {
      name: 'Kotlin',
      reasons: [
        '모바일 개발에서 많이 사용되는 언어 중 하나. **카드 관리 및 결제 최적화** 모바일 앱이라는 특성상 안전성이 매우 중요했음.',
        'Kotlin의 **null-safety, sealed class** 등은 런타임에 발생할 수 있는 충돌을 **컴파일 단계에서 방지**할 수 있어, 금융을 다루는 프로젝트에 적합하다고 판단'
      ]
    },
    {
      name: 'Jetpack Compose',
      reasons: [
        '기존 XML 기반 View 시스템과 달리 Compose는 **선언적 UI**로 상태 변화에 따른 UI 업데이트를 직관적으로 구현할 수 있음.',
        '동적인 UI 요소들이 많았기 때문에, Compose의 **recomposition 메커니즘**으로 효율적인 상태 관리가 가능하다고 판단.'
      ]
    },
    {
      name: 'Coroutines',
      reasons: [
        'Kotlin Coroutines의 `suspend` 함수와 `launch`, `async` 빌더를 통해 **선언적이고 읽기 쉬운 비동기 코드**를 작성하고, 콜백이 반복되는 이슈를 방지.',
        '네트워크 요청(API 호출) 특히 결제 시 **SSE(Server-Sent Events) 연결** 등 비동기 작업이 매우 많은 프로젝트에 적합.'
      ]
    },
    {
      name: 'Retrofit',
      reasons: [
        '안드로이드 환경에서의 데이터 통신 표준 라이브러리.',
        '`@Interceptor`를 통해 **모든 요청에 자동으로 인증 토큰을 주입**하도록 구현, Converter를 통해 JSON 응답을 Kotlin 객체로 자동 변환하여 **타입 안전성** 확보'
      ]
    },
    {
      name: 'MVVM',
      reasons: [
        '**비즈니스 로직과 UI를 명확하게 분리**하기 위해 MVVM 아키텍처를 선택. **Repository 패턴**과 함께 사용.',
        '**단방향 데이터 흐름**으로 상태 관리가 예측 가능하고, 유지보수 하기 용이해질 것이라고 판단.'
      ]
    },
    {
      name: 'Material Design 3',
      reasons: [
        'ReBirth는 사용자의 **시각적 경험**에 많은 공을 들인 프로젝트. 이를 위해 **일관된 컴포넌트와 스타일링**이 필요.',
        '**색상 시스템, 타이포그래피, 그림자 효과** 등을 활용하면 빠르게 프로토타입을 만들 수 있음. 개발 속도 향상.'
      ]
    }
  ],

  reviews: [
    {
      id: 'payment',
      title: '1. 결제',
      image: [
        '/projects/rebirth/payment1.png',
        '/projects/rebirth/payment2.png',
        '/projects/rebirth/payment3.png'
      ],
      features: [
        '현재 결제 항목의 정보를 읽고, **가장 혜택을 많이 볼 수 있는 카드를 자동으로 선택**',
        '**바코드/QR 코드** 탭으로 결제 방식을 선택하여 적절한 결제 프로세스 제공',
        '**OCR 기술**로 카드 뒷면을 촬영하여 자동으로 카드 정보를 인식하고 등록, 수동 입력도 지원',
        '선택한 카드로 **토큰을 발급**받아 보안성을 높인 일회용 거래 수행'
      ],
      intent: '결제 화면은 Rebirth의 핵심 가치인 **"최적의 카드로 최대 혜택 얻기"**를 구현한 파트입니다. 추천 카드를 선택해서 결제하면, 현재 결제 항목에 대한 정보를 바탕으로 최적의 카드를 골라줍니다. 만약 카드가 아직 등록이 안되어 있더라도, **OCR 기반 카드 등록**으로 쉽고 빠르게 새로운 카드를 추가할 수 있습니다. 또한 결제 시 바코드와 QR 코드 두 가지 방식을 지원해서, 사용자는 상황에 맞는 결제 수단을 선택할 수 있습니다. 각 카드에는 고유한 별자리가 생성됩니다. 우주의 무수한 별처럼 흩어져 있는 혜택을 하나로 이어준다는 느낌을 위해, 별과 별을 이어서 별자리를 만들어 주었습니다. 각 카드가 고유의 정체성을 가진 존재이고, 결제라는 일상적 행동을 특별한 순간으로 변환하고자 했습니다.',
      troubleShooting: {
        title: '동시 결제 트랜잭션 시 대기 시간 증가 & 결제 실패 현상',
        initialImpl: '결제 시스템은 사용자가 QR 코드를 스캔한 후 **SSE(Server-Sent Events)**를 통해 실시간으로 결제 완료 이벤트를 받아야 합니다. 초기에는 이벤트 수신 즉시 상태를 변경하도록 구현했습니다.',
        problem: [
          '동시에 여러 사용자가 결제를 진행하도록 **부하 테스트** 중 문제 발견',
          '**사용자 수가 많아질수록 결제 완료까지의 대기 시간이 눈에 띄게 증가**',
          '일부 사용자의 결제가 **타임아웃으로 실패**'
        ],
        analysis: [
          'SSE 연결 안정성을 확인 → __SSE는 짧은 시간 동안 연결을 유지하는 특성상 재연결 로직이 반드시 필요__',
          '스레드 측면: 사용자 A의 상태 변경이 즉시 일어나면서 **UI 업데이트가 메인 스레드를 블로킹**함',
          '__블로킹 되는 시간 동안 다른 사용자 B의 작업이 대기하는 경합 상태__ 발생'
        ],
        solution: '**SSE heartbeat 감지와 재연결 로직**을 추가해 타임아웃을 방지, 메인 스레드의 여유를 확보하기 위해 **결제 상태 변경 전 지연 처리(동적 3초 delay)**를 적용했습니다.',
        solutionCode: `private var isReconnecting = false
private val reconnectDelay = 1000L

private fun connectToPaymentEvents() {
    viewModelScope.launch {
        paymentRepository.connectToPaymentEvents()
            .catch { e ->
                // 타임아웃 감지 시 자동 재연결
                if (e.message?.contains("timeout") == true && !isReconnecting) {
                    isReconnecting = true
                    Log.d("PaymentViewModel", "SSE 타임아웃으로 인한 재연결 시도")
                    delay(reconnectDelay)
                    isReconnecting = false
                    connectToPaymentEvents()  // 재귀 호출로 재연결
                }
            }
            .collect { event ->
                //그 외 등등..
            }
    }
}

// SSE 이벤트 수신 후
event.message?.startsWith("TXN") == true -> {
    try {
        val paymentData = event.message.split(",")
        _paymentResult.value = PaymentResult(
            amount = paymentData[1].toIntOrNull() ?: 0,
            createdAt = formatDateTime(paymentData[2]),
            approvalCode = paymentData[0]
        )

        viewModelScope.launch {
            if (_paymentState.value is PaymentState.Processing) {
                delay(3000)  // ← 최소 3초 지연
                _paymentState.value = PaymentState.Completed
                Log.d("PaymentViewModel", "결제 완료 상태로 변경")
            }
        }
    } catch (e: Exception) {
        Log.e("PaymentViewModel", "결제 데이터 파싱 오류: {e.message}")
    }
}

fun completePayment(token: String) {
    viewModelScope.launch {
        try {
            _paymentState.value = PaymentState.Processing
            val startTime = System.currentTimeMillis()
            val response = paymentRepository.completePayment(token)

            if (response.isSuccessful && response.body()?.success == true) {
                _paymentResult.value = PaymentResult(...)

                // 경과 시간을 고려한 동적 지연
                val elapsedTime = System.currentTimeMillis() - startTime
                val remainingTime = 3000 - elapsedTime

                if (remainingTime > 0) {
                    delay(remainingTime)  // ← 동적 3초 지연
                }
                _paymentState.value = PaymentState.Completed
            }
        } catch (e: Exception) {
            _paymentState.value = PaymentState.Error(...)
        }
    }
}`,
        results: [
          '**SSE 연결 안정성 강화**: 타임아웃이 발생하더라도 자동으로 재연결하여 SSE 연결 해제로 인한 결제 실패 문제 방지',
          '**메인 스레드 여유 확보**: 여러 사용자의 결제 작업을 각각의 coroutine에서 병렬 처리하여 결제 대기 시간을 **이전 대비 절반 이하로 감소**'
        ],
        lessons: [
          '**비동기 처리의 중요성**: 적절한 지연 처리로 시스템에 여유를 제공하는 것이 동시 처리 성능에 직접적인 영향을 미침',
          '__SSE는 단순 REST API 통신과 달리 연결을 유지해야 하는 방식이므로__, 재연결 로직이 없으면 타임아웃 시 이벤트를 영구적으로 수신하지 못한다. **연결 기반 통신에는 반드시 재연결 전략**이 필요하다.',
          '**3초 지연에 대한 의문**: 3초라는 시간은 임의로 설정한 값. 모든 상황에서 최적의 조건인지 **사용자 패턴 분석을 통한 동적 조정**이 더 필요하다.'
        ]
      }
    },
    {
      id: 'myCard',
      title: '2. 내 카드',
      image: [
        '/projects/rebirth/myCard1.png',
        '/projects/rebirth/myCard2.png',
        '/projects/rebirth/myCard3.png'
      ],
      features: [
        '**가로 스크롤**로 여러 카드를 확인하며, 각 카드의 이번 달 사용액과 받은 혜택을 한눈에 파악',
        '선택한 월의 거래 기록을 **날짜별로 그룹화**하여 표시하고, 각 거래에서 받은 혜택을 함께 노출',
        '해당 카드를 통해 받은 혜택을 **세분화하여 표시**하고, 각 카테고리의 혜택 사용 현황을 시각화',
        '**전월 실적 시각화**, 몇 구간 혜택을 받을 수 있는지 표시'
      ],
      intent: '내 카드 화면은 사용자가 자신의 카드 사용 패턴을 상세하게 되돌아볼 수 있는 공간입니다. 단순한 거래 기록이 아닌, **각 거래마다 받은 혜택을 함께 표시**함으로써 사용자에게 "이 거래에서 나는 이만큼의 가치를 얻었다"는 인식을 심어줍니다. 이를 통해 Rebirth를 통한 결제 생활 만족감을 높이고자 의도했습니다. 또한 **실적 관리**도 함께 진행함으로써, 어떤 카드로 소비를 해야겠다는 **소비 계획 수립**에도 도움이 되고자 했습니다.',
      troubleShooting: {
        title: '카드 상세의 소비 내역 상태 관리 불량 현상',
        initialImpl: '카드 상세 화면에서 사용자가 월을 선택하거나 탭(내역/혜택)을 전환할 때, Compose의 `LaunchedEffect`와 `remember`를 통해 상태를 관리했습니다. 초기에는 **월 변경(`selectedMonth`)만을 dependency**로 감지하여 데이터를 로드했습니다.',
        problem: [
          '**월별 탭 전환 시 해당 월과 불일치하는 데이터가 표시**되는 현상 발생',
          '10월에서 시작 → 9월로 월 변경 (내역과 혜택 모두 9월 표시) ✓',
          '9월 상태에서 혜택 탭으로 전환 (9월 혜택 표시) ✓',
          '다시 내역 탭으로 돌아옴 → **10월 내역이 표시** ❌ (내역 탭에서만 발생)',
        ],
        analysis: [
          '캐시 도입 이후 이 현상이 발생했기 때문에 **Compose의 `remember`/recomposition 캐시 메커니즘**을 분석',
          '탭 전환 시 UI는 리컴포지션되지만, __거래 내역 데이터(`transactionHistoryState`)는 이전 상태 그대로 유지되는 Compose의 캐시 메커니즘이 작동함__',
          '내역 탭으로 돌아올 때 `selectedMonth`는 변하지 않으므로 **`LaunchedEffect`가 재실행되지 않음**. 화면에 렌더링되는 것은 `remember`의 **캐시된 상태값**임.'
        ],
        solution: '`LaunchedEffect`의 **dependency 배열에 `selectedTab`을 추가**하고, 탭 변경 시 캐시 상태 재평가 로직을 추가했습니다.',
        solutionCode: `LaunchedEffect(key1 = cardId, key2 = selectedMonth, key3 = selectedTab) {
    val monthChanged = selectedMonth != viewModel.selectedMonth.value
    val cardChanged = cardId != viewModel.selectedCardId.value

    if (monthChanged || cardChanged) {
        viewModel.resetTransactionPagination()
        viewModel.getCardTransactionHistory(cardId, selectedMonth, 0, 50)
    }
    else if (selectedTab == 0) {
        val currentState = transactionHistoryState
        if (currentState !is MyCardViewModel.TransactionHistoryState.Success ||
            currentState.allTransactions.isEmpty()) {
            viewModel.getCardTransactionHistory(cardId, selectedMonth, 0, 50)
        }
    }
}`,
        results: [
          '**UI 상태 일관성 유지**: 어떤 경로로 탭을 전환하든 선택된 월의 올바른 데이터가 표시되도록 개선',
          '**상태 관리 안정성**: dependency를 명시적으로 선언하여 캐시 불일치로 인한 데이터 오표시 완전 해소'
        ],
        lessons: [
          '__UI 상태와 데이터 상태의 분리 필요성__: 단순히 "변수가 변했으니 재로드"가 아니라, **개발자가 원하는 상태 변화를 정확히 정의**해야 한다. `LaunchedEffect`의 dependency는 "언제 재실행되어야 하는가"의 명시적 계약이다.',
          '**명시적 검증의 필요성**: 검증 단계를 추가함으로써 예상치 못한 캐시 불일치를 방지할 수 있다. 단, __검증 단계도 추가적인 비용이 소모되므로 사용 여부를 신중히 결정__해야 한다.',
        ]
      }
    },
    {
      id: 'home',
      title:'3. 홈',
      image: [
        '/projects/rebirth/home1.png',
        '/projects/rebirth/home2.png',
        '/projects/rebirth/home3.png'
      ],
      features: [
        '이번 달 **소비 현황**: 월 지출액, 받은 혜택과 놓친 혜택 표시',
        '**최근 소비 리뷰**: 가장 최근의 소비에서 받은 혜택 또는 놓친 혜택과 추천 카드 표시',
        '**추천 카드 홍보**: 3개월 소비 통계를 기반으로 가장 혜택을 많이 볼 수 있는 카드를 추천',
      ],
      intent: 'Rebirth는 사용자가 **카드의 가치를 재발견하는 경험**을 핵심으로 삼았습니다. 홈 화면에서는 복잡한 네비게이션 없이도 **이번 달 나는 얼마를 썼고, 어느 정도의 혜택을 보았는지** 바로 확인할 수 있도록 구성했습니다. 또한 **3개월 소비 통계를 기반**으로, 추가적인 혜택을 볼 수 있는 카드를 추천합니다. 홈의 행성은 사용자의 소비 통계를 기반으로 나타납니다. 태양계 행성들 중 하나의 행성을 받게되며, 우주적인 느낌을 살리고자 반영했습니다. 모든 네비게이션은 마치 우주를 여행하듯이 진행되며, 이를 통해 **디자인 컨셉**을 유지하고자 했습니다.',
    },
    {
      id: 'report',
      title:'4. 소비 리포트',
      image: [
        '/projects/rebirth/report1.png',
        '/projects/rebirth/report2.png',
        '/projects/rebirth/report3.png'
      ],
      features: [
        '**월별 캘린더 기반** 거래내역 조회, 특정 날짜 선택 시 그날의 거래내역을 상세히 확인',
        '**결제 성향 분석**: 태양계 행성에 빗대어 사용자의 월별 결제 패턴과 특성을 시각적으로 분석하고 설명',
        '**소비그룹 벤치마킹**: 사용자의 월간 사용액 구간과 동일한 구간의 다른 사용자들이 받은 혜택과 비교하여 자신의 혜택 수준을 평가',
      ],
      intent: '소비 리포트는 사용자가 자신의 상세한 소비 데이터를 **직관적으로 확인**할 수 있도록 만든 화면입니다. 가계부는 토스의 월별 소비 내역에서 많은 레퍼런스를 얻었습니다. 일반적인 리스트 형식 대신 **캘린더를 사용**함으로써 월간 소비를 좀 더 한눈에 볼 수 있도록 만들어봤습니다. 또한 소비 리포트를 통해 지금까지의 소비에 대한 **인사이트를 제공**하고자 했습니다.',
    }
  ],

  githubUrl: 'https://github.com/Xylitol311/ReBirth',
};
