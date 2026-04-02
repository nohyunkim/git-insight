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
  const latestRequestRef = useRef('')
  const initialSearchDoneRef = useRef(false)

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
          <p>© 2026 Git Insight. All Rights Reserved.</p>
        </footer>
      </section>
    </main>
  )
}

export default App
