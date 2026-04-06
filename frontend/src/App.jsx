import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchGitHubFeedback, fetchGitHubInsight } from './api/github'
import { deleteSavedResult, fetchSavedResults, getCurrentSession, saveAnalysisResult, signInWithGoogle, signOutFromSupabase, subscribeToAuthChanges } from './lib/supabase'
import { AuthMenu } from './components/AuthMenu'
import { MyPage } from './components/MyPage'
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
  about: {
    title: '서비스 소개',
    sections: [
      {
        heading: 'Git Insight는 무엇인가요?',
        body: 'Git Insight는 공개 GitHub 활동을 바탕으로 활동 흐름, 언어 분포, 이벤트 패턴을 요약해서 보여주는 분석 서비스입니다.',
      },
      {
        heading: '이번 회원 기능에서 무엇이 달라지나요?',
        body: 'Google 로그인 이후 결과 저장, 마이페이지 조회, 이후 결과 비교와 성장 피드백까지 확장할 수 있는 뼈대를 먼저 만드는 단계입니다.',
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
    title: '개인정보 처리 안내',
    sections: [
      {
        heading: '어떤 정보를 다루나요?',
        body: '로그인 시에는 Google 계정 기반의 Supabase Auth 세션이 사용되며, 분석 요청 시에는 사용자가 입력한 GitHub ID와 저장한 결과 스냅샷이 저장될 수 있습니다.',
      },
      {
        heading: '결과 저장은 어떻게 사용되나요?',
        body: '사용자가 직접 저장한 분석 결과는 마이페이지에서 다시 확인하고, 이후 비교/성장 피드백 기능의 기반 데이터로 활용됩니다.',
      },
    ],
  },
  terms: {
    title: '이용 안내',
    sections: [
      {
        heading: '서비스 성격',
        body: 'Git Insight는 공개 데이터를 기반으로 한 참고용 분석 도구이며, 저장된 결과는 사용자 경험 개선과 기능 확장을 위한 기반으로 활용됩니다.',
      },
      {
        heading: '현재 단계',
        body: '이번 단계는 로그인/세션/저장 구조의 뼈대를 우선 구현하는 상태이며, 저장 비교와 성장 피드백은 다음 단계에서 확장할 예정입니다.',
      },
    ],
  },
}

const HOW_IT_WORKS_STEPS = [
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

const LANDING_CONTENT_SECTIONS = [
  {
    kicker: 'Why It Matters',
    title: 'GitHub 활동 분석이 중요한 이유',
    summary: '포트폴리오나 공개 프로필에서 결과물뿐 아니라 과정과 리듬도 함께 읽히는 시대입니다.',
    points: [
      '최근 활동의 흐름과 간격을 빠르게 읽을 수 있습니다.',
      '채용, 협업, 포트폴리오 검토에서 공개 기록을 설명하기 쉬워집니다.',
    ],
    tags: ['공개 기록', '포트폴리오'],
  },
  {
    kicker: 'What We Read',
    title: '이 서비스가 읽는 데이터',
    summary: '공개 레포, 저장소 언어, 이벤트 기록을 기반으로 최근 흐름을 기간별로 다시 정리합니다.',
    points: [
      '공개 프로필과 저장소, 이벤트를 기준으로 현재 흐름을 요약합니다.',
      '비공개 저장소와 조직 내부 작업은 충분히 반영되지 않을 수 있습니다.',
    ],
    tags: ['공개 데이터', '이벤트'],
  },
]

const CONTENT_LINKS = [
  {
    href: '/guide.html',
    title: '결과 해석 가이드',
    description: '결과 화면의 숫자와 차트를 어떤 기준으로 읽으면 좋은지 정리한 페이지입니다.',
  },
  {
    href: '/github-portfolio-guide.html',
    title: '좋은 GitHub 포트폴리오 만드는 법',
    description: '공개 사용자 정보, README, 활동 흐름을 어떻게 정리하면 더 설득력 있게 보이는지 설명합니다.',
  },
  {
    href: '/readme-writing-guide.html',
    title: 'README 작성 가이드',
    description: '프로젝트 목적, 주요 기능, 실행 방법, 기술 선택 배경을 문서화하는 방법을 안내합니다.',
  },
  {
    href: '/github-activity-interpretation.html',
    title: 'GitHub 활동 기록 해석법',
    description: '활동량과 기록 패턴이 어떤 의미로 읽히는지 차분하게 풀어 설명합니다.',
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

  if (window.location.pathname === '/result') {
    return 'result'
  }

  if (window.location.pathname === '/mypage') {
    return 'mypage'
  }

  return 'landing'
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
  const [openIndex, setOpenIndex] = useState(0)

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
          <button type="button" className="policy-modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="policy-modal-body">
          {policy.sections.map((section, index) => {
            const isOpen = openIndex === index

            return (
              <article key={section.heading} className="policy-modal-section">
                <button
                  type="button"
                  className="policy-accordion-trigger"
                  onClick={() => setOpenIndex((current) => (current === index ? -1 : index))}
                  aria-expanded={isOpen}
                >
                  <span>{section.heading}</span>
                  <span className={`policy-accordion-caret${isOpen ? ' is-open' : ''}`} aria-hidden="true">
                    ▾
                  </span>
                </button>
                {isOpen ? (
                  <div className="policy-accordion-content">
                    <p>{section.body}</p>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function App() {
  const initialState = readSharedState()
  const initialStateRef = useRef(initialState)
  const initialRouteRef = useRef(readCurrentRoute())
  const initialSearchDoneRef = useRef(false)
  const latestRequestRef = useRef('')

  const [route, setRoute] = useState(readCurrentRoute())
  const [username, setUsername] = useState(initialState.username)
  const [selectedDays, setSelectedDays] = useState(initialState.days)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [error, setError] = useState('')
  const [policyModalKey, setPolicyModalKey] = useState('')
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authActionLoading, setAuthActionLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [savedResults, setSavedResults] = useState([])
  const [savedResultsLoading, setSavedResultsLoading] = useState(false)
  const [savedResultsError, setSavedResultsError] = useState('')
  const [deletingSavedResultId, setDeletingSavedResultId] = useState('')

  const activePolicy = policyModalKey ? POLICY_MODAL_CONTENT[policyModalKey] : null

  const syncFromLocation = () => {
    const nextRoute = readCurrentRoute()
    const nextState = readSharedState()
    setRoute(nextRoute)
    setUsername(nextState.username)
    setSelectedDays(nextState.days)

    if (nextRoute === 'landing') {
      setUserData(null)
      setError('')
      setFeedbackLoading(false)
      setLoading(false)
    }

    return { nextRoute, nextState }
  }

  const navigateToLanding = () => {
    window.history.pushState({}, '', '/')
    syncFromLocation()
  }

  const navigateToResult = (nextUsername, nextDays, replace = false) => {
    const nextUrl = buildResultUrl(nextUsername, nextDays)
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextUrl)
    setRoute('result')
  }

  const navigateToMyPage = () => {
    window.history.pushState({}, '', '/mypage')
    setRoute('mypage')
  }

  const loadSavedResults = useCallback(async (activeSession) => {
    if (!activeSession) {
      setSavedResults([])
      setSavedResultsError('')
      return
    }

    setSavedResultsLoading(true)
    setSavedResultsError('')

    try {
      const nextItems = await fetchSavedResults(activeSession)
      setSavedResults(nextItems)
    } catch (loadError) {
      setSavedResultsError(
        loadError.message || '저장한 결과 목록을 불러오지 못했습니다. saved_results 테이블 구조를 확인해주세요.',
      )
    } finally {
      setSavedResultsLoading(false)
    }
  }, [])

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
          message.includes('응답') ||
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
            feedback_meta: feedbackData.feedback_meta,
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

  const handleGoogleLogin = async () => {
    setAuthActionLoading(true)
    setAuthMessage('')

    try {
      await signInWithGoogle()
    } catch (loginError) {
      setAuthMessage(loginError.message || 'Google 로그인 연결에 실패했습니다.')
      setAuthActionLoading(false)
    }
  }

  const handleLogout = async () => {
    setAuthActionLoading(true)
    setAuthMessage('')

    try {
      await signOutFromSupabase()
      setSavedResults([])
      setSavedResultsError('')
      if (route === 'mypage') {
        navigateToLanding()
      }
    } catch (logoutError) {
      setAuthMessage(logoutError.message || '로그아웃에 실패했습니다.')
    } finally {
      setAuthActionLoading(false)
    }
  }

  const handleSaveCurrentResult = async () => {
    if (!session) {
      setAuthMessage('로그인 후 결과를 저장할 수 있습니다.')
      return
    }

    if (!userData) {
      return
    }

    setSaveLoading(true)
    setAuthMessage('')

    try {
      await saveAnalysisResult(session, userData)
      setAuthMessage('현재 결과를 저장했습니다.')
      await loadSavedResults(session)
    } catch (saveError) {
      setAuthMessage(
        saveError.message ||
          '결과 저장에 실패했습니다. saved_results 테이블 컬럼(user_id, github_username, window_days, profile_name, headline, snapshot)을 확인해주세요.',
      )
    } finally {
      setSaveLoading(false)
    }
  }

  const handleOpenSavedResult = (savedResult) => {
    const snapshot = savedResult.snapshot
    if (!snapshot) {
      return
    }

    setUserData(snapshot)
    setUsername(savedResult.github_username || snapshot.username || '')
    setSelectedDays(savedResult.window_days || snapshot?.stats?.activity_summary?.window_days || DEFAULT_DAYS)
    setError('')
    setFeedbackLoading(false)
    navigateToResult(
      savedResult.github_username || snapshot.username || '',
      savedResult.window_days || snapshot?.stats?.activity_summary?.window_days || DEFAULT_DAYS,
    )
  }

  const handleDeleteSavedResult = async (savedResult) => {
    if (!session || !savedResult?.id) {
      return
    }

    const shouldDelete = window.confirm(
      `${savedResult.github_username} 분석 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
    )

    if (!shouldDelete) {
      return
    }

    setDeletingSavedResultId(savedResult.id)
    setSavedResultsError('')
    setAuthMessage('')

    try {
      await deleteSavedResult(session, savedResult.id)
      setSavedResults((current) => current.filter((item) => item.id !== savedResult.id))
      setAuthMessage('저장한 결과를 삭제했습니다.')
    } catch (deleteError) {
      setSavedResultsError(deleteError.message || '저장한 결과를 삭제하지 못했습니다.')
    } finally {
      setDeletingSavedResultId('')
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      const { nextRoute, nextState } = syncFromLocation()

      if (nextRoute === 'result' && nextState.username) {
        void performSearch(nextState.username, nextState.days)
      }

      if (nextRoute === 'mypage' && session) {
        void loadSavedResults(session)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [loadSavedResults, session])

  useEffect(() => {
    if (initialSearchDoneRef.current) {
      return
    }

    initialSearchDoneRef.current = true

    if (initialRouteRef.current === 'result' && initialStateRef.current.username) {
      void performSearch(initialStateRef.current.username, initialStateRef.current.days)
    }
  }, [loadSavedResults])

  useEffect(() => {
    let mounted = true

    const bootstrapSession = async () => {
      try {
        const currentSession = await getCurrentSession()
        if (!mounted) {
          return
        }

        setSession(currentSession)
        if (readCurrentRoute() === 'mypage' && currentSession) {
          void loadSavedResults(currentSession)
        }
      } catch (sessionError) {
        if (mounted) {
          setAuthMessage(sessionError.message || '세션을 불러오지 못했습니다.')
        }
      } finally {
        if (mounted) {
          setAuthLoading(false)
          setAuthActionLoading(false)
        }
      }
    }

    bootstrapSession()

    const unsubscribe = subscribeToAuthChanges((nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
      setAuthActionLoading(false)

      if (nextSession) {
        void loadSavedResults(nextSession)
      } else {
        setSavedResults([])
        setSavedResultsError('')
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [loadSavedResults])

  useEffect(() => {
    if (!activePolicy) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPolicyModalKey('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activePolicy])

  return (
    <main className={`app-shell ${route === 'result' ? 'result-shell' : route === 'mypage' ? 'mypage-shell' : 'landing-shell'}`}>
      {route === 'landing' ? (
        <header className="app-topbar app-topbar-landing">
          <div className="app-topbar-actions">
            {authMessage ? <p className="auth-status-message">{authMessage}</p> : null}
            <AuthMenu
              session={session}
              loading={authLoading || authActionLoading}
              onLogin={handleGoogleLogin}
              onLogout={handleLogout}
              onNavigateToMyPage={navigateToMyPage}
            />
          </div>
        </header>
      ) : (
        <header className="app-topbar">
          <button type="button" className="app-home-link" onClick={navigateToLanding}>
            <img src="/favicon-branchicorn.png" alt="Git Insight logo" />
            <span>Git Insight</span>
          </button>

          <div className="app-topbar-actions">
            {authMessage ? <p className="auth-status-message">{authMessage}</p> : null}
            <AuthMenu
              session={session}
              loading={authLoading || authActionLoading}
              onLogin={handleGoogleLogin}
              onLogout={handleLogout}
              onNavigateToMyPage={navigateToMyPage}
            />
          </div>
        </header>
      )}

      {route === 'result' ? (
        <>
          <section className="result-header-panel">
            <SearchForm
              variant="compact"
              username={username}
              loading={loading}
              periods={PERIOD_OPTIONS}
              selectedDays={selectedDays}
              onUsernameChange={setUsername}
              onPeriodChange={(days) => {
                setSelectedDays(days)
                if (route === 'result' && username.trim()) {
                  void handleSearch(days, { navigate: true, replace: true })
                }
              }}
              onSearch={() => handleSearch(selectedDays, { navigate: true, replace: true })}
            />

            {error ? <p className="status-message error-message">{error}</p> : null}
          </section>

          <section className="content-panel">
            {userData ? (
              <ProfileCard
                userData={userData}
                feedbackLoading={feedbackLoading}
                onSaveResult={handleSaveCurrentResult}
                saveLoading={saveLoading}
                canSave={Boolean(session)}
              />
            ) : (
              <div className="empty-state result-empty-state">
                <p className="empty-kicker">Result</p>
                <h2>분석 결과를 준비하고 있습니다</h2>
                <p>GitHub 아이디와 기간을 입력하면 요약, 언어 분포, 다음 액션까지 바로 보여드립니다.</p>
              </div>
            )}
          </section>
        </>
      ) : null}

      {route === 'mypage' ? (
        <MyPage
          session={session}
          items={savedResults}
          loading={savedResultsLoading}
          error={savedResultsError}
          onRefresh={() => loadSavedResults(session)}
          onOpenResult={handleOpenSavedResult}
          onLogin={handleGoogleLogin}
          onDeleteResult={handleDeleteSavedResult}
          deletingId={deletingSavedResultId}
        />
      ) : null}

      {route === 'landing' ? (
        <>
          <section className="landing-hero">
            <div className="landing-brand-mark">
              <img src="/favicon-branchicorn.png" alt="Git Insight logo" />
            </div>
            <p className="landing-kicker">GitHub Activity Reader</p>
            <h1>Git Insight</h1>
            <p className="landing-subtitle">
              GitHub 활동을 한 번에 읽기 쉽게 보고, 다음에 무엇을 보면 좋을지 바로 이어지는 시작 화면입니다.
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

            <div className="editorial-grid">
              {LANDING_CONTENT_SECTIONS.map((section) => (
                <article key={section.title} className="editorial-card">
                  <div className="editorial-kicker-row">
                    <span className="editorial-kicker-dot" aria-hidden="true" />
                    <p className="editorial-kicker">{section.kicker}</p>
                  </div>
                  <h3>{section.title}</h3>
                  <p className="editorial-summary">{section.summary}</p>
                  <ul className="editorial-points">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <div className="editorial-tags">
                    {section.tags.map((tag) => (
                      <span key={tag} className="editorial-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="landing-section-heading editorial-heading">
              <p className="landing-section-kicker">More To Read</p>
              <h2>함께 보면 좋은 읽을거리</h2>
            </div>

            <div className="content-link-grid">
              {CONTENT_LINKS.map((item) => (
                <a key={item.href} href={item.href} className="content-link-card">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </a>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <footer className="landing-footer">
        <span className="landing-footer-line" aria-hidden="true" />
        <nav className="landing-footer-links" aria-label="정책 및 안내 링크">
          <button type="button" className="footer-link-button" onClick={() => setPolicyModalKey('about')}>
            서비스 소개
          </button>
          <button type="button" className="footer-link-button" onClick={() => setPolicyModalKey('guide')}>
            결과 해석 가이드
          </button>
          <button type="button" className="footer-link-button" onClick={() => setPolicyModalKey('faq')}>
            자주 묻는 질문
          </button>
          <button type="button" className="footer-link-button" onClick={() => setPolicyModalKey('privacy')}>
            개인정보 안내
          </button>
          <button type="button" className="footer-link-button" onClick={() => setPolicyModalKey('terms')}>
            이용 안내
          </button>
          <a href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer">
            문의/오류 제보
          </a>
        </nav>
        <p>© 2026 Git Insight. All Rights Reserved.</p>
      </footer>

      <PolicyModal policy={activePolicy} onClose={() => setPolicyModalKey('')} />
    </main>
  )
}

export default App
