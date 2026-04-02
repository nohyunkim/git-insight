import { useRef, useState } from 'react'
import { fetchGitHubFeedback, fetchGitHubInsight } from './api/github'
import { ProfileCard } from './components/ProfileCard'
import { SearchForm } from './components/SearchForm'
import './App.css'

function App() {
  const [username, setUsername] = useState('')
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [error, setError] = useState('')
  const latestRequestRef = useRef('')

  const handleSearch = async () => {
    const normalizedUsername = username.trim()

    if (!normalizedUsername) {
      setError('GitHub 아이디를 먼저 입력해주세요.')
      setUserData(null)
      return
    }

    latestRequestRef.current = normalizedUsername
    setLoading(true)
    setFeedbackLoading(false)
    setError('')

    try {
      const data = await fetchGitHubInsight(normalizedUsername)
      if (latestRequestRef.current !== normalizedUsername) {
        return
      }

      setUserData(data)

      if (!data.feedback_pending) {
        return
      }

      setFeedbackLoading(true)

      try {
        const feedbackData = await fetchGitHubFeedback(normalizedUsername)
        if (latestRequestRef.current !== normalizedUsername) {
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
        if (latestRequestRef.current === normalizedUsername) {
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
        if (latestRequestRef.current === normalizedUsername) {
          setFeedbackLoading(false)
        }
      }
    } catch (requestError) {
      if (latestRequestRef.current === normalizedUsername) {
        setUserData(null)
        setError(requestError.message)
      }
    } finally {
      if (latestRequestRef.current === normalizedUsername) {
        setLoading(false)
      }
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-heading">
          <p className="eyebrow">GitHub Activity Reader</p>
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
          onUsernameChange={setUsername}
          onSearch={handleSearch}
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
              GitHub 아이디를 입력하면 프로필, 레포 수, 최근 활동, 언어 분포를
              이 영역에서 바로 보여줍니다.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
