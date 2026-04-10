export const PERIOD_OPTIONS = [
  { days: 7, label: '7일' },
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
  { days: 180, label: '6개월' },
  { days: 365, label: '1년' },
]

export const DEFAULT_DAYS = 30
export const ALLOWED_PERIOD_DAYS = new Set(PERIOD_OPTIONS.map((option) => option.days))
export const TRANSIENT_AUTH_MESSAGES = new Set(['결과를 저장했어요.', '저장한 결과를 삭제했습니다.'])
export const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdjVwQ8UH1s-Oc4szZ5N1Bej49aiMBBRPhOg7HxZngZcz4lpw/viewform?usp=publish-editor'

export const POLICY_MODAL_CONTENT = {
  about: {
    title: '서비스 소개',
    sections: [
      {
        heading: 'Git Insight는 무엇인가요?',
        body: 'Git Insight는 공개 GitHub 활동을 바탕으로 활동 흐름, 언어 분포, 이벤트 패턴을 요약해서 보여주는 분석 서비스입니다.',
      },
      {
        heading: '로그인하면 무엇을 할 수 있나요?',
        body: 'Google 로그인 이후 결과 저장, 마이페이지 아카이브 확인, 날짜별 기록 비교를 더 편하게 사용할 수 있습니다.',
      },
    ],
  },
  guide: {
    title: '결과 해석 가이드',
    sections: [
      {
        heading: 'Push 이벤트',
        body: 'Push 이벤트는 코드 반영 빈도를 보여주지만, 품질이나 협업 수준을 단독으로 판단해주지는 않습니다.',
      },
      {
        heading: '활동 일수',
        body: '여러 날짜에 걸쳐 활동이 분산되어 있으면 꾸준한 개발 리듬으로 읽히고, 특정 시기에 몰리면 스프린트형 패턴으로 보일 수 있습니다.',
      },
      {
        heading: '언어 분포',
        body: '언어 분포는 공개 저장소 기준이라 실제 실무 전체 스택과 다를 수 있으므로 README와 프로젝트 설명을 함께 보는 편이 좋습니다.',
      },
    ],
  },
  faq: {
    title: '자주 묻는 질문',
    sections: [
      {
        heading: '비공개 저장소도 포함되나요?',
        body: '아니요. 현재 분석은 GitHub 공개 API 기준으로만 동작합니다.',
      },
      {
        heading: '저장한 결과는 어디서 보나요?',
        body: '로그인 후 우측 상단 프로필 메뉴에서 마이페이지로 이동하면 저장된 분석 기록 목록을 확인할 수 있습니다.',
      },
    ],
  },
  privacy: {
    title: '개인정보처리방침',
    sections: [
      {
        heading: '어떤 정보를 다루나요?',
        body: '로그인 시에는 Google 계정 기반의 Supabase Auth 세션이 사용되며, 프로필 닉네임/아바타, 사용자가 입력한 GitHub ID, 직접 저장한 결과 스냅샷이 서비스 기능 제공 범위에서 처리될 수 있습니다.',
      },
      {
        heading: '결과 저장은 어떻게 사용되나요?',
        body: '사용자가 직접 저장한 분석 결과는 마이페이지에서 다시 확인하고, 날짜별 비교와 기록 관리 기능에 활용됩니다.',
      },
    ],
  },
  terms: {
    title: '이용약관',
    sections: [
      {
        heading: '서비스 성격',
        body: 'Git Insight는 공개 데이터를 기반으로 한 참고용 분석 도구이며, 결과는 절대적인 평가가 아니라 공개 기록을 점검하기 위한 해석 자료로 제공됩니다.',
      },
      {
        heading: '저장과 이용 범위',
        body: '로그인 사용자는 분석 결과를 저장하고 마이페이지에서 다시 열람하거나 삭제할 수 있습니다. 비공개 저장소나 조직 내부 활동은 분석 범위에 포함되지 않을 수 있습니다.',
      },
    ],
  },
}

export const HOW_IT_WORKS_STEPS = [
  {
    step: 'Step 1',
    title: 'GitHub ID 입력',
    description: '분석하고 싶은 GitHub 사용자 아이디만 입력하면 바로 결과를 확인할 수 있습니다.',
  },
  {
    step: 'Step 2',
    title: '활동 흐름 분석',
    description: '레포지토리, 이벤트, 언어 분포를 기준으로 읽기 쉬운 요약을 만듭니다.',
  },
  {
    step: 'Step 3',
    title: '다음 액션 확인',
    description: '현재 강점과 보완 포인트, 그리고 다음에 무엇을 보면 좋을지 이어서 보여줍니다.',
  },
]

export const LANDING_CONTENT_SECTIONS = [
  {
    kicker: 'Why It Matters',
    title: 'GitHub 활동 분석이 중요한 이유',
    summary: '포트폴리오와 공개 프로필에서는 결과물뿐 아니라 작업 과정과 활동 흐름도 함께 읽히는 시대입니다.',
    points: [
      '최근 활동의 흐름과 간격을 빠르게 파악할 수 있습니다.',
      '채용, 협업, 포트폴리오 검토 상황에서 공개 기록을 더 쉽게 설명할 수 있습니다.',
    ],
    tags: ['공개 기록', '포트폴리오'],
  },
  {
    kicker: 'What We Read',
    title: '이 서비스가 읽는 데이터',
    summary: '공개 저장소, 사용 언어, 이벤트 기록을 바탕으로 최근 활동 흐름을 기간별로 다시 정리합니다.',
    points: [
      '공개 프로필, 저장소, 이벤트를 기준으로 현재 활동 흐름을 요약합니다.',
      '비공개 저장소와 조직 내부 작업은 충분히 반영되지 않을 수 있습니다.',
    ],
    tags: ['공개 데이터', '이벤트'],
  },
]

export const CONTENT_LINKS = [
  {
    href: '/guide.html',
    title: '결과 해석 가이드',
    description: '결과 화면의 숫자와 차트를 어떤 기준으로 읽으면 좋은지 정리한 페이지입니다.',
  },
  {
    href: '/github-portfolio-guide.html',
    title: '좋은 GitHub 포트폴리오 만드는 법',
    description: '공개 프로필, README, 활동 흐름을 어떻게 정리하면 더 설득력 있게 보이는지 설명하는 페이지입니다.',
  },
  {
    href: '/readme-writing-guide.html',
    title: 'README 작성 가이드',
    description: '프로젝트 목적, 주요 기능, 실행 방법, 기술 선택 배경을 어떻게 문서화하면 좋은지 안내하는 페이지입니다.',
  },
  {
    href: '/github-activity-interpretation.html',
    title: 'GitHub 활동 기록 해석법',
    description: '활동량과 기록 패턴이 어떤 의미로 읽히는지 차분하게 풀어 설명한 페이지입니다.',
  },
]
