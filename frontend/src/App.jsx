import { useEffect, useRef, useState } from 'react'
import { fetchGitHubFeedback, fetchGitHubInsight } from './api/github'
import { ProfileCard } from './components/ProfileCard'
import { SearchForm } from './components/SearchForm'
import './App.css'

const PERIOD_OPTIONS = [
  { days: 7, label: '7일' },
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
  { days: 180, label: '6개월' },
  { days: 365, label: '1년' },
]

const DEFAULT_DAYS = 30
const ALLOWED_PERIOD_DAYS = new Set(PERIOD_OPTIONS.map((option) => option.days))
const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdjVwQ8UH1s-Oc4szZ5N1Bej49aiMBBRPhOg7HxZngZcz4lpw/viewform?usp=publish-editor'
const POLICY_MODAL_CONTENT = {
  guide: {
    title: '지표 해석 가이드',
    sections: [
      {
        heading: '이벤트 수',
        body: '선택한 기간 동안 발생한 공개 이벤트 총합입니다. 전체 활동량을 가장 넓게 보여주는 기준 지표이며, 기간을 바꿔 추세 변화를 비교하는 데 적합합니다.',
      },
      {
        heading: 'Push 수',
        body: '코드 반영 빈도에 가까운 지표입니다. 이벤트 수 대비 Push 비율이 높으면 구현 중심 활동, 낮으면 이슈/리뷰/협업 비중이 큰 활동일 가능성이 있습니다.',
      },
      {
        heading: '활동 일수',
        body: '기간 내 실제 활동이 발생한 날짜 수입니다. 같은 이벤트 수라도 활동 일수가 높으면 분산형, 낮으면 특정 구간 집중형 패턴으로 해석할 수 있습니다.',
      },
      {
        heading: '언어 분포',
        body: '공개 레포지토리 기준 상위 언어입니다. 최근 이벤트 유형과 함께 보면 현재 집중 기술 스택을 해석하기 쉽지만, 비공개 저장소 기반 작업은 충분히 반영되지 않을 수 있습니다.',
      },
      {
        heading: '해석 시 주의사항',
        body: '본 결과는 참고용 요약 지표입니다. API 응답 시차, 공개 설정, 기간 선택에 따라 수치가 달라질 수 있으므로 중요한 판단 전 원본 활동 내역을 함께 확인하세요.',
      },
    ],
  },
  faq: {
    title: '자주 묻는 질문',
    sections: [
      {
        heading: '왜 비공개 저장소 활동은 적게 보이나요?',
        body: '분석은 GitHub 공개 API 기준으로 수행되므로 비공개 저장소의 세부 활동은 포함되지 않거나 제한적으로 반영될 수 있습니다.',
      },
      {
        heading: '기간별 수치가 크게 달라지는 이유는?',
        body: '7일, 30일, 90일, 6개월, 1년은 서로 다른 집계 창(window)이라 기간이 달라지면 이벤트 집계 범위도 달라집니다.',
      },
      {
        heading: '결과 공유는 어떻게 하나요?',
        body: '결과 화면의 공유/저장 메뉴에서 링크 복사, 이미지 저장, PDF 저장을 사용할 수 있으며 링크에 아이디/기간이 포함됩니다.',
      },
      {
        heading: '결과가 이전과 다르게 보일 수 있나요?',
        body: '가능합니다. GitHub 데이터 반영 시점, 캐시 만료 시점, 공개 이벤트 업데이트 타이밍에 따라 일부 수치는 일시적으로 변동될 수 있습니다.',
      },
    ],
  },
  about: {
    title: '서비스 소개',
    sections: [
      {
        heading: '서비스 개요',
        body: 'Git Insight는 공개 GitHub 활동 데이터를 바탕으로 최근 개발 활동 흐름을 읽기 쉽게 요약해 보여주는 분석 서비스입니다.',
      },
      {
        heading: '제공 내용',
        body: '선택한 기간(7일, 30일, 90일, 6개월, 1년) 기준으로 이벤트 수, Push 활동, 활동 일수, 언어 분포, 이벤트 유형을 집계하고 시각화해 제공합니다.',
      },
      {
        heading: '데이터 범위',
        body: '분석은 GitHub 공개 API 기반으로 수행되며, 비공개 저장소 활동이나 계정 비공개 설정 데이터는 포함되지 않거나 제한적으로 반영될 수 있습니다.',
      },
      {
        heading: '문의 채널',
        body: '오류 제보, 개선 제안, 정책 관련 문의는 하단 문의/오류 제보 링크를 통해 접수할 수 있습니다.',
      },
    ],
  },
  privacy: {
    title: '개인정보처리방침',
    sections: [
      {
        heading: '수집 항목',
        body: '서비스는 분석 요청 시 사용자가 입력한 GitHub 아이디를 처리합니다. 별도 회원가입 정보나 민감정보를 직접 수집하지 않습니다.',
      },
      {
        heading: '처리 목적',
        body: '입력된 GitHub 아이디는 활동 분석 결과 생성, 화면 표시, 오류 대응을 위한 기술적 검증 목적으로만 사용됩니다.',
      },
      {
        heading: '보유 및 이용 기간',
        body: '입력값은 요청 처리 과정에서 일시적으로 사용되며, 서비스 운영 정책에 따라 필요한 최소 기간 동안만 보관됩니다.',
      },
      {
        heading: '제3자 제공 및 처리 위탁',
        body: '서비스 동작 과정에서 GitHub API 및 배포 인프라(예: Cloudflare, Render)와 통신이 발생할 수 있으며, 해당 플랫폼의 정책이 함께 적용될 수 있습니다.',
      },
      {
        heading: '이용자 권리',
        body: '이용자는 개인정보 처리 관련 문의 또는 정정/삭제 요청을 문의 채널로 접수할 수 있습니다. 법령상 보존이 필요한 경우를 제외하고 확인 후 처리합니다.',
      },
      {
        heading: '시행일',
        body: '본 방침은 2026-04-03부터 적용됩니다.',
      },
    ],
  },
  terms: {
    title: '이용약관',
    sections: [
      {
        heading: '서비스 성격',
        body: 'Git Insight는 공개 데이터를 기반으로 통계/요약 정보를 제공하는 참고용 서비스이며, 결과는 정보 제공 목적입니다.',
      },
      {
        heading: '면책',
        body: '제공되는 정보는 외부 API 상태, 공개 범위, 데이터 반영 시점의 영향을 받을 수 있습니다. 중요한 의사결정 전 추가 검토가 필요합니다.',
      },
      {
        heading: '금지 행위',
        body: '사용자는 관련 법령 및 플랫폼 정책을 준수해야 하며, 서비스 장애 유발 행위, 비정상적 자동 호출, 타인의 권리 침해 행위를 해서는 안 됩니다.',
      },
      {
        heading: '서비스 변경 및 중단',
        body: '서비스는 운영상 필요에 따라 기능 변경, 점검, 중단이 발생할 수 있습니다. 운영자는 안정적 제공을 위해 합리적인 범위 내에서 노력합니다.',
      },
      {
        heading: '준거 및 분쟁',
        body: '약관 해석 및 분쟁 해결에는 관련 법령이 적용되며, 세부 분쟁 처리 절차는 문의 채널을 통해 우선 협의합니다.',
      },
    ],
  },
}
const HOW_IT_WORKS_STEPS = [
  {
    step: 'Step 1',
    title: 'GitHub ID 입력',
    description: '보고 싶은 GitHub 사용자 아이디만 입력하면 바로 분석을 시작합니다.',
  },
  {
    step: 'Step 2',
    title: '활동 흐름 분석',
    description: '레포지토리, 이벤트, 언어 분포를 바탕으로 읽기 쉬운 요약을 만듭니다.',
  },
  {
    step: 'Step 3',
    title: '다음 액션 확인',
    description: '현재 강점과 보완 포인트, 다음에 보면 좋을 제안까지 한눈에 보여줍니다.',
  },
]

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function readCurrentRoute() {
  if (typeof window === 'undefined') {
    return 'landing'
  }

  return window.location.pathname === '/result' ? 'result' : 'landing'
}

function readSharedState() {
  if (typeof window === 'undefined') {
    return { username: '', days: DEFAULT_DAYS }
  }

  const params = new URLSearchParams(window.location.search)
  const username = params.get('u')?.trim() ?? ''
  const days = Number.parseInt(params.get('days') ?? `${DEFAULT_DAYS}`, 10)

  return {
    username,
    days: ALLOWED_PERIOD_DAYS.has(days) ? days : DEFAULT_DAYS,
  }
}

function buildResultUrl(username, days) {
  const params = new URLSearchParams()

  if (username) {
    params.set('u', username)
    params.set('days', `${days}`)
  }

  const queryString = params.toString()
  return `/result${queryString ? `?${queryString}` : ''}`
}

function PolicyModal({ policy, onClose }) {
  if (!policy) {
    return null
  }

  return (
    <div
      className="policy-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="policy-modal" role="dialog" aria-modal="true" aria-label={policy.title}>
        <div className="policy-modal-header">
          <h2>{policy.title}</h2>
          <button type="button" className="policy-modal-close" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="policy-modal-body">
          {policy.sections.map((section) => (
            <article key={section.heading} className="policy-modal-section">
              <h3>{section.heading}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function App() {
  const initialState = readSharedState()
  const initialStateRef = useRef(initialState)
  const initialRouteRef = useRef(readCurrentRoute())
  const [route, setRoute] = useState(readCurrentRoute())
  const [username, setUsername] = useState(initialState.username)
  const [selectedDays, setSelectedDays] = useState(initialState.days)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [error, setError] = useState('')
  const [policyModalKey, setPolicyModalKey] = useState('')
  const latestRequestRef = useRef('')
  const initialSearchDoneRef = useRef(false)
  const activePolicy = policyModalKey ? POLICY_MODAL_CONTENT[policyModalKey] : null

  const syncFromLocation = () => {
    const nextRoute = readCurrentRoute()
    const nextState = readSharedState()
    setRoute(nextRoute)
    setUsername(nextState.username)
    setSelectedDays(nextState.days)

    if (nextRoute !== 'result') {
      setUserData(null)
      setError('')
      setFeedbackLoading(false)
      setLoading(false)
    }

    return { nextRoute, nextState }
  }

  const navigateToLanding = () => {
    if (typeof window === 'undefined') {
      return
    }

    window.history.pushState({}, '', '/')
    syncFromLocation()
  }

  const closePolicyModal = () => {
    setPolicyModalKey('')
  }

  const openPolicyModal = (key) => {
    setPolicyModalKey(key)
  }

  const navigateToResult = (nextUsername, nextDays, replace = false) => {
    if (typeof window === 'undefined') {
      return
    }

    const nextUrl = buildResultUrl(nextUsername, nextDays)
    const historyMethod = replace ? 'replaceState' : 'pushState'
    window.history[historyMethod]({}, '', nextUrl)
    setRoute('result')
  }

  const performSearch = async (targetUsername, targetDays) => {
    const requestKey = `${targetUsername}:${targetDays}`
    latestRequestRef.current = requestKey
    setLoading(true)
    setFeedbackLoading(false)
    setError('')

    try {
      let data

      try {
        data = await fetchGitHubInsight(targetUsername, targetDays)
      } catch (firstError) {
        const message = String(firstError?.message ?? '')
        const shouldRetry =
          message.includes('잠시') ||
          message.includes('응답이 오래') ||
          message.includes('다시 시도')

        if (!shouldRetry) {
          throw firstError
        }

        await delay(900)
        data = await fetchGitHubInsight(targetUsername, targetDays)
      }

      if (latestRequestRef.current !== requestKey) {
        return
      }

      setUserData(data)

      if (!data.feedback_pending) {
        return
      }

      setFeedbackLoading(true)

      try {
        const feedbackData = await fetchGitHubFeedback(targetUsername, targetDays)
        if (latestRequestRef.current !== requestKey) {
          return
        }

        setUserData((current) => {
          if (!current || current.username !== targetUsername) {
            return current
          }

          return {
            ...current,
            feedback: feedbackData.feedback,
            feedback_source: feedbackData.feedback_source,
            feedback_pending: feedbackData.feedback_pending,
          }
        })
      } catch {
        if (latestRequestRef.current === requestKey) {
          setUserData((current) => {
            if (!current || current.username !== targetUsername) {
              return current
            }

            return {
              ...current,
              feedback_pending: false,
            }
          })
        }
      } finally {
        if (latestRequestRef.current === requestKey) {
          setFeedbackLoading(false)
        }
      }
    } catch (requestError) {
      if (latestRequestRef.current === requestKey) {
        setUserData(null)
        setError(requestError.message)
      }
    } finally {
      if (latestRequestRef.current === requestKey) {
        setLoading(false)
      }
    }
  }

  const handleSearch = async (
    overrideDays = selectedDays,
    options = { navigate: true, replace: false },
  ) => {
    const normalizedUsername = username.trim()

    if (!normalizedUsername) {
      setError('GitHub 아이디를 먼저 입력해주세요.')
      setUserData(null)
      return
    }

    if (options.navigate !== false) {
      navigateToResult(normalizedUsername, overrideDays, options.replace)
    }

    await performSearch(normalizedUsername, overrideDays)
  }

  const handlePeriodChange = (days) => {
    setSelectedDays(days)

    if (route === 'result' && username.trim()) {
      void handleSearch(days, { navigate: true, replace: true })
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      const { nextRoute, nextState } = syncFromLocation()

      if (nextRoute === 'result' && nextState.username) {
        void performSearch(nextState.username, nextState.days)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (initialSearchDoneRef.current) {
      return
    }

    initialSearchDoneRef.current = true

    if (initialRouteRef.current === 'result' && initialStateRef.current.username) {
      void performSearch(initialStateRef.current.username, initialStateRef.current.days)
    }
  }, [])

  useEffect(() => {
    if (!activePolicy) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closePolicyModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activePolicy])

  if (route === 'result') {
    return (
      <main className="app-shell result-shell">
        <section className="result-header-panel">
          <button type="button" className="result-home-link" onClick={navigateToLanding}>
            <img src="/favicon-branchicorn.png" alt="Git Insight logo" />
            <span>Git Insight</span>
          </button>

          <SearchForm
            variant="compact"
            username={username}
            loading={loading}
            periods={PERIOD_OPTIONS}
            selectedDays={selectedDays}
            onUsernameChange={setUsername}
            onPeriodChange={handlePeriodChange}
            onSearch={() => handleSearch(selectedDays, { navigate: true, replace: true })}
          />

          {error ? <p className="status-message error-message">{error}</p> : null}
        </section>

        <section className="content-panel">
          {userData ? (
            <ProfileCard userData={userData} feedbackLoading={feedbackLoading} />
          ) : (
            <div className="empty-state result-empty-state">
              <p className="empty-kicker">Result</p>
              <h2>분석 결과를 준비하고 있습니다</h2>
              <p>
                GitHub 아이디를 입력하고 기간을 고르면 요약, 언어 분포, 다음 액션까지 결과로
                바로 보여드립니다.
              </p>
            </div>
          )}
        </section>

        <footer className="landing-footer result-footer">
          <span className="landing-footer-line" aria-hidden="true" />
          <nav className="landing-footer-links" aria-label="정책 및 안내 링크">
            <button type="button" className="footer-link-button" onClick={() => openPolicyModal('about')}>
              서비스 소개
            </button>
            <button type="button" className="footer-link-button" onClick={() => openPolicyModal('guide')}>
              지표 해석 가이드
            </button>
            <button type="button" className="footer-link-button" onClick={() => openPolicyModal('faq')}>
              자주 묻는 질문
            </button>
            <button
              type="button"
              className="footer-link-button"
              onClick={() => openPolicyModal('privacy')}
            >
              개인정보처리방침
            </button>
            <button type="button" className="footer-link-button" onClick={() => openPolicyModal('terms')}>
              이용약관
            </button>
            <a href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer">
              문의/오류 제보
            </a>
          </nav>
          <p>© 2026 Git Insight. All Rights Reserved.</p>
        </footer>

        <PolicyModal policy={activePolicy} onClose={closePolicyModal} />
      </main>
    )
  }

  return (
    <main className="app-shell landing-shell">
      <section className="landing-hero">
        <div className="landing-brand-mark">
          <img src="/favicon-branchicorn.png" alt="Git Insight logo" />
        </div>
        <p className="landing-kicker">GitHub Activity Reader</p>
        <h1>Git Insight</h1>
        <p className="landing-subtitle">
          GitHub 활동을 한 번에 읽기 쉽게 보고, 다음에 무엇을 보면 좋을지 바로 이어지는
          시작 화면입니다.
        </p>

        <SearchForm
          variant="landing"
          username={username}
          loading={loading}
          periods={PERIOD_OPTIONS}
          selectedDays={selectedDays}
          onUsernameChange={setUsername}
          onPeriodChange={setSelectedDays}
          onSearch={() => handleSearch(selectedDays)}
        />

        {error ? <p className="status-message error-message landing-error">{error}</p> : null}
      </section>

      <section className="landing-steps">
        <div className="landing-section-heading">
          <p className="landing-section-kicker">How It Works</p>
          <h2>결과를 보는 방식</h2>
        </div>

        <div className="landing-step-grid">
          {HOW_IT_WORKS_STEPS.map((item) => (
            <article key={item.step} className="landing-step-card">
              <span className="landing-step-number">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <footer className="landing-footer">
          <span className="landing-footer-line" aria-hidden="true" />
          <nav className="landing-footer-links" aria-label="정책 및 안내 링크">
            <button type="button" className="footer-link-button" onClick={() => openPolicyModal('about')}>
              서비스 소개
            </button>
            <button type="button" className="footer-link-button" onClick={() => openPolicyModal('guide')}>
              지표 해석 가이드
            </button>
            <button type="button" className="footer-link-button" onClick={() => openPolicyModal('faq')}>
              자주 묻는 질문
            </button>
            <button
              type="button"
              className="footer-link-button"
              onClick={() => openPolicyModal('privacy')}
            >
              개인정보처리방침
            </button>
            <button type="button" className="footer-link-button" onClick={() => openPolicyModal('terms')}>
              이용약관
            </button>
            <a href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer">
              문의/오류 제보
            </a>
          </nav>
          <p>© 2026 Git Insight. All Rights Reserved.</p>
        </footer>
      </section>

      <PolicyModal policy={activePolicy} onClose={closePolicyModal} />
    </main>
  )
}

export default App
