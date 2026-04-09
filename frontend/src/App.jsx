import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchGitHubComparison,
  fetchGitHubFeedback,
  fetchGitHubInsight,
} from './api/github'
import {
  deleteSavedResult,
  ensureUserProfile,
  fetchSavedResults,
  getAnalysisDateKey,
  getCurrentSession,
  saveAnalysisResult,
  signInWithGoogle,
  signOutFromSupabase,
  subscribeToAuthChanges,
  updateUserNickname,
} from './lib/supabase'
import { AuthMenu } from './components/AuthMenu'
import { LandingPage } from './components/LandingPage'
import { MyPage } from './components/MyPage'
import { PolicyModal } from './components/PolicyModal'
import { ProfileCard } from './components/ProfileCard'
import { SearchForm } from './components/SearchForm'
import {
  CONTENT_LINKS,
  DEFAULT_DAYS,
  FEEDBACK_FORM_URL,
  HOW_IT_WORKS_STEPS,
  LANDING_CONTENT_SECTIONS,
  PERIOD_OPTIONS,
  POLICY_MODAL_CONTENT,
  TRANSIENT_AUTH_MESSAGES,
} from './constants/appContent'
import {
  buildResultUrl,
  delay,
  readCurrentRoute,
  readSharedState,
} from './utils/appRoute'
import './App.css'

function getSavedResultUsername(savedResult) {
  return (
    savedResult?.github_username ||
    savedResult?.snapshot?.username ||
    ''
  )
    .trim()
    .toLowerCase()
}

function getSavedResultWindowDays(savedResult) {
  return (
    savedResult?.window_days ||
    savedResult?.snapshot?.stats?.activity_summary?.window_days ||
    DEFAULT_DAYS
  )
}

function getSavedResultTimestamp(savedResult) {
  const value =
    savedResult?.analysis_generated_at ||
    savedResult?.created_at ||
    savedResult?.snapshot?.generated_at ||
    ''
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

const AUTH_MESSAGE_AUTO_CLEAR_VALUES = new Set([
  ...TRANSIENT_AUTH_MESSAGES,
  '결과를 저장했어요.',
  '저장한 결과를 삭제했습니다.',
])

function App() {
  const initialState = readSharedState()
  const initialStateRef = useRef(initialState)
  const initialRouteRef = useRef(readCurrentRoute())
  const initialSearchDoneRef = useRef(false)
  const latestRequestRef = useRef('')
  const latestComparisonRequestRef = useRef('')

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
  const [userProfile, setUserProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [savedResults, setSavedResults] = useState([])
  const [savedResultsLoading, setSavedResultsLoading] = useState(false)
  const [savedResultsError, setSavedResultsError] = useState('')
  const [deletingSavedResultId, setDeletingSavedResultId] = useState('')
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonData, setComparisonData] = useState(null)
  const [comparisonError, setComparisonError] = useState('')
  const [comparisonContext, setComparisonContext] = useState(null)
  const [comparingSavedResultId, setComparingSavedResultId] = useState('')

  const activePolicy = policyModalKey ? POLICY_MODAL_CONTENT[policyModalKey] : null

  const clearComparisonState = useCallback(() => {
    latestComparisonRequestRef.current = ''
    setComparisonLoading(false)
    setComparisonData(null)
    setComparisonError('')
    setComparisonContext(null)
    setComparingSavedResultId('')
  }, [])

  const syncFromLocation = useCallback(() => {
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
      clearComparisonState()
    }

    return { nextRoute, nextState }
  }, [clearComparisonState])

  const navigateToLanding = useCallback(() => {
    window.history.pushState({}, '', '/')
    syncFromLocation()
  }, [syncFromLocation])

  const navigateToResult = useCallback((nextUsername, nextDays, replace = false) => {
    const nextUrl = buildResultUrl(nextUsername, nextDays)
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextUrl)
    setRoute('result')
  }, [])

  const navigateToMyPage = useCallback(() => {
    window.history.pushState({}, '', '/mypage')
    setRoute('mypage')
  }, [])

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
        loadError.message ||
          '저장한 결과 목록을 불러오지 못했습니다. saved_results 테이블 구성을 확인해주세요.',
      )
    } finally {
      setSavedResultsLoading(false)
    }
  }, [])

  const loadUserProfile = useCallback(async (activeSession) => {
    if (!activeSession) {
      setUserProfile(null)
      setProfileMessage('')
      return
    }

    setProfileLoading(true)

    try {
      const nextProfile = await ensureUserProfile(activeSession)
      setUserProfile(nextProfile)
    } catch (profileError) {
      setProfileMessage(
        profileError.message ||
          '프로필 정보를 불러오지 못했습니다. profiles 테이블 설정을 확인해주세요.',
      )
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const findPreviousComparableResult = useCallback(
    (savedResult) => {
      if (!savedResult?.id) {
        return null
      }

      const targetUsername = getSavedResultUsername(savedResult)
      const targetWindowDays = getSavedResultWindowDays(savedResult)
      const relatedItems = savedResults
        .filter((item) => {
          return (
            item?.id &&
            item.snapshot &&
            getSavedResultUsername(item) === targetUsername &&
            getSavedResultWindowDays(item) === targetWindowDays
          )
        })
        .sort(
          (left, right) =>
            getSavedResultTimestamp(right) - getSavedResultTimestamp(left),
        )

      const currentIndex = relatedItems.findIndex((item) => item.id === savedResult.id)
      if (currentIndex === -1) {
        return null
      }

      return relatedItems[currentIndex + 1] ?? null
    },
    [savedResults],
  )

  const openSavedResultSnapshot = useCallback(
    (savedResult) => {
      const snapshot = savedResult?.snapshot
      if (!snapshot) {
        return false
      }

      const nextUsername = savedResult.github_username || snapshot.username || ''
      const nextDays =
        savedResult.window_days ||
        snapshot?.stats?.activity_summary?.window_days ||
        DEFAULT_DAYS

      setUserData(snapshot)
      setUsername(nextUsername)
      setSelectedDays(nextDays)
      setError('')
      setFeedbackLoading(false)
      navigateToResult(nextUsername, nextDays)
      return true
    },
    [navigateToResult],
  )

  const performSearch = useCallback(
    async (targetUsername, targetDays) => {
      const requestKey = `${targetUsername}:${targetDays}`
      latestRequestRef.current = requestKey
      setLoading(true)
      setFeedbackLoading(false)
      setError('')
      clearComparisonState()

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
    },
    [clearComparisonState],
  )

  const handleSearch = useCallback(
    async (
      overrideDays = selectedDays,
      options = { navigate: true, replace: false },
    ) => {
      const normalizedUsername = username.trim()

      if (!normalizedUsername) {
        clearComparisonState()
        setError('GitHub 아이디를 먼저 입력해주세요.')
        setUserData(null)
        return
      }

      if (options.navigate !== false) {
        navigateToResult(normalizedUsername, overrideDays, options.replace)
      }

      await performSearch(normalizedUsername, overrideDays)
    },
    [
      clearComparisonState,
      navigateToResult,
      performSearch,
      selectedDays,
      username,
    ],
  )

  const handleGoogleLogin = useCallback(async () => {
    setAuthActionLoading(true)
    setAuthMessage('')

    try {
      await signInWithGoogle()
    } catch (loginError) {
      setAuthMessage(loginError.message || 'Google 로그인 연결에 실패했습니다.')
      setAuthActionLoading(false)
    }
  }, [])

  const handleLogout = useCallback(async () => {
    setAuthActionLoading(true)
    setAuthMessage('')

    try {
      await signOutFromSupabase()
      setSavedResults([])
      setSavedResultsError('')
      setUserProfile(null)
      setProfileMessage('')
      clearComparisonState()
      if (route === 'mypage') {
        navigateToLanding()
      }
    } catch (logoutError) {
      setAuthMessage(logoutError.message || '로그아웃에 실패했습니다.')
    } finally {
      setAuthActionLoading(false)
    }
  }, [clearComparisonState, navigateToLanding, route])

  const handleSaveCurrentResult = useCallback(async () => {
    if (!session) {
      setAuthMessage('로그인 후에 결과를 저장할 수 있어요.')
      return
    }

    if (!userData) {
      return
    }

    if (feedbackLoading || userData.feedback_pending) {
      setAuthMessage('AI 요약 정리가 끝난 뒤 저장할 수 있어요.')
      return
    }

    const currentUsername = (userData.username ?? '').trim().toLowerCase()
    const currentWindowDays =
      userData.stats?.activity_summary?.window_days ?? selectedDays
    const currentAnalysisDate = getAnalysisDateKey(new Date())
    const isAlreadySaved = savedResults.some((item) => {
      const savedUsername = (item.github_username ?? '').trim().toLowerCase()
      const savedWindowDays =
        item.window_days ?? item.snapshot?.stats?.activity_summary?.window_days
      const savedAnalysisDate = getAnalysisDateKey(item)

      return (
        savedUsername === currentUsername &&
        savedWindowDays === currentWindowDays &&
        savedAnalysisDate === currentAnalysisDate
      )
    })

    if (isAlreadySaved) {
      setAuthMessage('오늘 기준으로 같은 사용자와 기간 기록은 이미 저장되어 있어요.')
      return
    }

    setSaveLoading(true)
    setAuthMessage('')

    try {
      await saveAnalysisResult(session, userData)
      setAuthMessage('결과를 저장했어요.')
      await loadSavedResults(session)
    } catch (saveError) {
      setAuthMessage(saveError.message || '결과 저장에 실패했습니다.')
    } finally {
      setSaveLoading(false)
    }
  }, [
    feedbackLoading,
    loadSavedResults,
    savedResults,
    selectedDays,
    session,
    userData,
  ])

  const handleSaveNickname = useCallback(
    async (nickname) => {
      if (!session) {
        setProfileMessage('로그인 후에 닉네임을 변경할 수 있습니다.')
        return false
      }

      setProfileSaving(true)
      setProfileMessage('')

      try {
        const nextProfile = await updateUserNickname(session, nickname)
        setUserProfile(nextProfile)
        setProfileMessage('닉네임이 저장되었습니다.')
        return true
      } catch (profileError) {
        setProfileMessage(profileError.message || '닉네임을 저장하지 못했습니다.')
        return false
      } finally {
        setProfileSaving(false)
      }
    },
    [session],
  )

  const handleOpenSavedResult = useCallback(
    (savedResult) => {
      clearComparisonState()
      openSavedResultSnapshot(savedResult)
    },
    [clearComparisonState, openSavedResultSnapshot],
  )

  const handleCompareSavedResult = useCallback(
    async (savedResult) => {
      const previousSavedResult = findPreviousComparableResult(savedResult)

      if (!savedResult?.snapshot || !previousSavedResult?.snapshot) {
        setSavedResultsError('같은 기간의 이전 저장 기록이 없어 비교할 수 없습니다.')
        return
      }

      const opened = openSavedResultSnapshot(savedResult)
      if (!opened) {
        return
      }

      const requestKey = `${savedResult.id}:${previousSavedResult.id}`
      latestComparisonRequestRef.current = requestKey
      setComparisonLoading(true)
      setComparisonData(null)
      setComparisonError('')
      setSavedResultsError('')
      setComparingSavedResultId(savedResult.id)
      setComparisonContext({
        currentSavedResultId: savedResult.id,
        previousSavedResultId: previousSavedResult.id,
        currentGeneratedAt:
          savedResult.analysis_generated_at ||
          savedResult.created_at ||
          savedResult.snapshot?.generated_at ||
          '',
        previousGeneratedAt:
          previousSavedResult.analysis_generated_at ||
          previousSavedResult.created_at ||
          previousSavedResult.snapshot?.generated_at ||
          '',
        previousHeadline:
          previousSavedResult.headline ||
          previousSavedResult.snapshot?.feedback?.headline ||
          '',
        windowDays: getSavedResultWindowDays(savedResult),
      })

      try {
        const nextComparisonData = await fetchGitHubComparison(
          savedResult.snapshot,
          previousSavedResult.snapshot,
        )
        if (latestComparisonRequestRef.current !== requestKey) {
          return
        }

        setComparisonData(nextComparisonData)
      } catch (comparisonRequestError) {
        if (latestComparisonRequestRef.current === requestKey) {
          setComparisonError(
            comparisonRequestError.message ||
              '이전 기록 비교 피드백을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (latestComparisonRequestRef.current === requestKey) {
          setComparisonLoading(false)
          setComparingSavedResultId('')
        }
      }
    },
    [findPreviousComparableResult, openSavedResultSnapshot],
  )

  const handleDeleteSavedResult = useCallback(
    async (savedResult) => {
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
        setSavedResults((current) =>
          current.filter((item) => item.id !== savedResult.id),
        )
        setAuthMessage('저장한 결과를 삭제했습니다.')
      } catch (deleteError) {
        setSavedResultsError(
          deleteError.message || '저장한 결과를 삭제하지 못했습니다.',
        )
      } finally {
        setDeletingSavedResultId('')
      }
    },
    [session],
  )

  useEffect(() => {
    const handlePopState = () => {
      const { nextRoute, nextState } = syncFromLocation()

      if (nextRoute === 'result' && nextState.username) {
        clearComparisonState()
        void performSearch(nextState.username, nextState.days)
      }

      if (nextRoute === 'mypage' && session) {
        void loadSavedResults(session)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [clearComparisonState, loadSavedResults, performSearch, session, syncFromLocation])

  useEffect(() => {
    if (initialSearchDoneRef.current) {
      return
    }

    initialSearchDoneRef.current = true

    if (
      initialRouteRef.current === 'result' &&
      initialStateRef.current.username
    ) {
      void performSearch(
        initialStateRef.current.username,
        initialStateRef.current.days,
      )
    }
  }, [performSearch])

  useEffect(() => {
    let mounted = true

    const bootstrapSession = async () => {
      try {
        const currentSession = await getCurrentSession()
        if (!mounted) {
          return
        }

        setSession(currentSession)
        if (currentSession) {
          void loadUserProfile(currentSession)
        }
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
        void loadUserProfile(nextSession)
        void loadSavedResults(nextSession)
      } else {
        setUserProfile(null)
        setProfileMessage('')
        setSavedResults([])
        setSavedResultsError('')
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [loadSavedResults, loadUserProfile])

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

  useEffect(() => {
    if (!AUTH_MESSAGE_AUTO_CLEAR_VALUES.has(authMessage)) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setAuthMessage((currentMessage) =>
        AUTH_MESSAGE_AUTO_CLEAR_VALUES.has(currentMessage) ? '' : currentMessage,
      )
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [authMessage])

  useEffect(() => {
    if (profileMessage !== '닉네임이 저장되었습니다.') {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setProfileMessage((currentMessage) =>
        currentMessage === '닉네임이 저장되었습니다.' ? '' : currentMessage,
      )
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [profileMessage])

  return (
    <main
      className={`app-shell ${
        route === 'result'
          ? 'result-shell'
          : route === 'mypage'
            ? 'mypage-shell'
            : 'landing-shell'
      }`}
    >
      {route === 'landing' ? (
        <header className="app-topbar app-topbar-landing">
          <div className="app-topbar-actions">
            {authMessage ? <p className="auth-status-message">{authMessage}</p> : null}
            <AuthMenu
              session={session}
              profile={userProfile}
              loading={authLoading || authActionLoading}
              onGoogleLogin={handleGoogleLogin}
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
              profile={userProfile}
              loading={authLoading || authActionLoading}
              onGoogleLogin={handleGoogleLogin}
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
              onSearch={() =>
                handleSearch(selectedDays, { navigate: true, replace: true })
              }
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
                comparisonLoading={comparisonLoading}
                comparisonData={comparisonData}
                comparisonError={comparisonError}
                comparisonContext={comparisonContext}
              />
            ) : (
              <div className="empty-state result-empty-state">
                <p className="empty-kicker">Result</p>
                <h2>분석 결과를 준비하고 있습니다</h2>
                <p>
                  GitHub 아이디와 기간을 입력하면 요약, 언어 분포, 다음 액션까지
                  바로 보여드립니다.
                </p>
              </div>
            )}
          </section>
        </>
      ) : null}

      {route === 'mypage' ? (
        <MyPage
          session={session}
          profile={userProfile}
          profileLoading={profileLoading}
          profileSaving={profileSaving}
          profileMessage={profileMessage}
          items={savedResults}
          loading={savedResultsLoading}
          error={savedResultsError}
          onRefresh={() => loadSavedResults(session)}
          onOpenResult={handleOpenSavedResult}
          onCompareResult={handleCompareSavedResult}
          getComparableSavedResult={findPreviousComparableResult}
          onGoogleLogin={handleGoogleLogin}
          onSaveNickname={handleSaveNickname}
          onDeleteResult={handleDeleteSavedResult}
          deletingId={deletingSavedResultId}
          comparingId={comparingSavedResultId}
        />
      ) : null}

      {route === 'landing' ? (
        <LandingPage
          username={username}
          loading={loading}
          periods={PERIOD_OPTIONS}
          selectedDays={selectedDays}
          onUsernameChange={setUsername}
          onPeriodChange={setSelectedDays}
          onSearch={() => handleSearch(selectedDays)}
          error={error}
          howItWorksSteps={HOW_IT_WORKS_STEPS}
          landingContentSections={LANDING_CONTENT_SECTIONS}
          contentLinks={CONTENT_LINKS}
          onOpenPolicy={setPolicyModalKey}
          feedbackFormUrl={FEEDBACK_FORM_URL}
        />
      ) : null}

      <PolicyModal policy={activePolicy} onClose={() => setPolicyModalKey('')} />
    </main>
  )
}

export default App
