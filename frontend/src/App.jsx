import { useRef, useState } from 'react'
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

function App() {
  const [username, setUsername] = useState('')
  const [selectedDays, setSelectedDays] = useState(30)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [error, setError] = useState('')
  const latestRequestRef = useRef('')

  const handleSearch = async (overrideDays = selectedDays) => {
    const normalizedUsername = username.trim()

    if (!normalizedUsername) {
      setError('GitHub 아이디를 먼저 입력해주세요.')
      setUserData(null)
      return
    }

    const requestKey = `${normalizedUsername}:${overrideDays}`
    latestRequestRef.current = requestKey
    setLoading(true)
    setFeedbackLoading(false)
    setError('')

    try {
      const data = await fetchGitHubInsight(normalizedUsername, overrideDays)
      if (latestRequestRef.current !== requestKey) {
        return
      }

      setUserData(data)

      if (!data.feedback_pending) {
        return
      }

      setFeedbackLoading(true)

      try {
        const feedbackData = await fetchGitHubFeedback(normalizedUsername, overrideDays)
        if (latestRequestRef.current !== requestKey) {
          return
        }

        setUserData((current) => {
          if (!current || current.username !== normalizedUsername) {
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
            if (!current || current.username !== normalizedUsername) {
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

  const handlePeriodChange = (days) => {
    setSelectedDays(days)

    if (username.trim()) {
      handleSearch(days)
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-heading">
          <div className="hero-heading-brand">
            <img className="hero-heading-logo" src="/branchicorn-tight.png" alt="Git Insight logo" />
            <p className="eyebrow">GitHub Activity Reader</p>
          </div>
          <p className="hero-badge">초보자도 바로 읽히는 활동 요약</p>
        </div>

        <div className="hero-copy-wrap">
          <h1>Git Insight</h1>
          <p className="hero-copy">
            내 GitHub 활동을 한 번에 읽기 쉽게 보고, 다음에 무엇을 보면 좋을지
            바로 이어지는 시작 화면입니다.
          </p>
        </div>

        <div className="hero-notes">
          <p className="hero-note-title">바로 확인할 수 있는 것</p>
          <ul className="hero-note-list">
            <li>최근 공개 활동의 흐름</li>
            <li>레포지토리와 언어 분포</li>
            <li>다음에 보면 좋은 핵심 인사이트</li>
          </ul>
        </div>

        <SearchForm
          username={username}
          loading={loading}
          periods={PERIOD_OPTIONS}
          selectedDays={selectedDays}
          onUsernameChange={setUsername}
          onPeriodChange={handlePeriodChange}
          onSearch={() => handleSearch(selectedDays)}
        />

        {error ? <p className="status-message error-message">{error}</p> : null}
      </section>

      <section className="content-panel">
        {userData ? (
          <ProfileCard userData={userData} feedbackLoading={feedbackLoading} />
        ) : (
          <div className="empty-state">
            <p className="empty-kicker">Preview</p>
            <h2>검색 대기 상태</h2>
            <p>
              GitHub 아이디를 입력하고 기간을 고르면 프로필, 레포 수, 최근 활동,
              언어 분포를 이 영역에서 바로 보여줍니다.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
