import { useMemo, useState } from 'react'
import { fetchGitHubComparison } from '../api/github'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15.2 3.1a2.5 2.5 0 0 1 3.54 0l2.16 2.16a2.5 2.5 0 0 1 0 3.54l-9.8 9.8a3 3 0 0 1-1.44.8l-4.25.96a1 1 0 0 1-1.2-1.2l.96-4.25a3 3 0 0 1 .8-1.44l9.8-9.8ZM17.32 4.5l-9.8 9.8a1 1 0 0 0-.27.48l-.58 2.56 2.56-.58a1 1 0 0 0 .48-.27l9.8-9.8a.5.5 0 0 0 0-.7l-2.16-2.16a.5.5 0 0 0-.7 0Z"
        fill="currentColor"
      />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 4v5h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m14.5 6-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m9.5 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m14.5 6-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function parseDateValue(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    const plainDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (plainDateMatch) {
      const [, year, month, day] = plainDateMatch
      return new Date(Number(year), Number(month) - 1, Number(day))
    }
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatSavedDate(value, includeTime = true) {
  const date = parseDateValue(value)
  if (!date) {
    return ''
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  }).format(date)
}

function formatDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getSavedDateKey(savedResult) {
  const candidate =
    savedResult?.analysis_date ||
    savedResult?.analysis_generated_at ||
    savedResult?.snapshot?.generated_at ||
    savedResult?.created_at

  const date = parseDateValue(candidate)
  if (!date) {
    return ''
  }

  return formatDateKey(date)
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function isSameMonth(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  )
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatShortSavedLabel(savedResult) {
  const username =
    savedResult?.github_username || savedResult?.snapshot?.username || 'result'
  const days =
    savedResult?.window_days ||
    savedResult?.snapshot?.stats?.activity_summary?.window_days ||
    30
  return `${username} ${days}일`
}

function getSummary(savedResult) {
  const summary = savedResult?.snapshot?.stats?.activity_summary ?? {}
  const pushes = savedResult?.snapshot?.stats?.recent_push_events ?? 0

  return {
    days: savedResult?.window_days ?? summary.window_days ?? 30,
    pushes,
    headline:
      savedResult?.headline ||
      savedResult?.snapshot?.feedback?.headline ||
      '저장한 분석 결과입니다.',
  }
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
    30
  )
}

function buildCalendarDays(monthDate, itemsByDate) {
  const monthStart = getMonthStart(monthDate)
  const monthStartDay = monthStart.getDay()
  const firstVisible = new Date(monthStart)
  firstVisible.setDate(monthStart.getDate() - monthStartDay)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisible)
    date.setDate(firstVisible.getDate() + index)
    const dateKey = formatDateKey(date)

    return {
      date,
      dateKey,
      items: itemsByDate.get(dateKey) ?? [],
      isCurrentMonth: isSameMonth(date, monthDate),
    }
  })
}

function MyPage({
  session,
  profile,
  profileLoading,
  profileSaving,
  profileMessage,
  items,
  loading,
  error,
  onRefresh,
  onOpenResult,
  onGoogleLogin,
  onSaveNickname,
  onDeleteResult,
  deletingId,
}) {
  const [nicknameInput, setNicknameInput] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedDateKey, setSelectedDateKey] = useState('')
  const [compareSourceItem, setCompareSourceItem] = useState(null)
  const [selectedCompareTargetId, setSelectedCompareTargetId] = useState('')
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState('')
  const [comparisonData, setComparisonData] = useState(null)
  const [comparingSourceId, setComparingSourceId] = useState('')

  const groupedByDate = useMemo(() => {
    const map = new Map()

    items.forEach((item) => {
      const dateKey = getSavedDateKey(item)
      if (!dateKey) {
        return
      }

      const current = map.get(dateKey) ?? []
      current.push(item)
      map.set(dateKey, current)
    })

    for (const value of map.values()) {
      value.sort(
        (left, right) => getSavedResultTimestamp(right) - getSavedResultTimestamp(left),
      )
    }

    return map
  }, [items])

  const monthKeysWithItems = useMemo(() => {
    const keys = new Set()

    groupedByDate.forEach((_savedItems, dateKey) => {
      keys.add(dateKey.slice(0, 7))
    })

    return keys
  }, [groupedByDate])

  const latestDateKey = items.length ? getSavedDateKey(items[0]) : ''
  const resolvedMonth = useMemo(() => {
    if (selectedMonth instanceof Date && !Number.isNaN(selectedMonth.getTime())) {
      return selectedMonth
    }

    if (latestDateKey) {
      const latestDate = parseDateValue(latestDateKey)
      if (latestDate) {
        return getMonthStart(latestDate)
      }
    }

    return getMonthStart(new Date())
  }, [latestDateKey, selectedMonth])

  const monthKey = formatDateKey(resolvedMonth).slice(0, 7)
  const availableKeysInMonth = useMemo(() => {
    return [...groupedByDate.keys()]
      .filter((dateKey) => dateKey.startsWith(monthKey))
      .sort()
  }, [groupedByDate, monthKey])

  const selectedDateItems = groupedByDate.get(selectedDateKey) ?? []
  const calendarDays = useMemo(
    () => buildCalendarDays(resolvedMonth, groupedByDate),
    [groupedByDate, resolvedMonth],
  )

  const compareCandidates = useMemo(() => {
    if (!compareSourceItem?.id) {
      return []
    }

    const sourceUsername = getSavedResultUsername(compareSourceItem)
    const sourceWindowDays = getSavedResultWindowDays(compareSourceItem)
    const sourceTimestamp = getSavedResultTimestamp(compareSourceItem)

    return items
      .filter((item) => {
        if (!item?.id || item.id === compareSourceItem.id || !item.snapshot) {
          return false
        }

        return (
          getSavedResultUsername(item) === sourceUsername &&
          getSavedResultWindowDays(item) === sourceWindowDays &&
          getSavedResultTimestamp(item) < sourceTimestamp
        )
      })
      .sort((left, right) => getSavedResultTimestamp(right) - getSavedResultTimestamp(left))
  }, [compareSourceItem, items])

  const selectedCompareTarget =
    compareCandidates.find((item) => item.id === selectedCompareTargetId) ?? null

  const savedDayCountThisMonth = availableKeysInMonth.length
  const isDaySheetOpen = Boolean(selectedDateKey)
  const isCompareDialogOpen = Boolean(compareSourceItem)

  const openCompareDialog = (savedResult) => {
    const sourceCandidates = items
      .filter((item) => {
        if (!item?.id || item.id === savedResult.id || !item.snapshot) {
          return false
        }

        return (
          getSavedResultUsername(item) === getSavedResultUsername(savedResult) &&
          getSavedResultWindowDays(item) === getSavedResultWindowDays(savedResult) &&
          getSavedResultTimestamp(item) < getSavedResultTimestamp(savedResult)
        )
      })
      .sort((left, right) => getSavedResultTimestamp(right) - getSavedResultTimestamp(left))

    if (!sourceCandidates.length) {
      return
    }

    setCompareSourceItem(savedResult)
    setSelectedCompareTargetId(sourceCandidates[0].id)
    setComparisonError('')
    setComparisonData(null)
  }

  const closeCompareDialog = () => {
    setCompareSourceItem(null)
    setSelectedCompareTargetId('')
    setComparisonLoading(false)
    setComparisonError('')
    setComparisonData(null)
    setComparingSourceId('')
  }

  const handleRunComparison = async () => {
    if (!compareSourceItem?.snapshot || !selectedCompareTarget?.snapshot) {
      setComparisonError('비교할 이전 기록을 선택해주세요.')
      return
    }

    setComparisonLoading(true)
    setComparisonError('')
    setComparisonData(null)
    setComparingSourceId(compareSourceItem.id)

    try {
      const nextComparisonData = await fetchGitHubComparison(
        compareSourceItem.snapshot,
        selectedCompareTarget.snapshot,
      )
      setComparisonData(nextComparisonData)
    } catch (comparisonRequestError) {
      setComparisonError(
        comparisonRequestError.message || '이전 기록 비교 피드백을 불러오지 못했습니다.',
      )
    } finally {
      setComparisonLoading(false)
      setComparingSourceId('')
    }
  }

  if (!session) {
    return (
      <section className="mypage-panel">
        <div className="mypage-empty">
          <p className="mypage-kicker">My Page</p>
          <h2>로그인하면 저장한 결과를 모아볼 수 있어요</h2>
          <p>
            Google 로그인으로 연결하면 결과 저장과 다시 보기 기능을 바로 사용할 수
            있습니다.
          </p>
          <div className="saved-result-actions">
            <button
              type="button"
              className="mypage-primary-button"
              onClick={onGoogleLogin}
            >
              Google로 로그인
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mypage-panel">
      <section className="mypage-profile-card">
        <div className="mypage-profile-head">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile?.nickname ?? '프로필'}
              className="mypage-profile-avatar"
            />
          ) : (
            <div
              className="mypage-profile-avatar mypage-profile-avatar-fallback"
              aria-hidden="true"
            >
              {(profile?.nickname || session.user?.email || '?')
                .slice(0, 1)
                .toUpperCase()}
            </div>
          )}

          <div className="mypage-profile-meta">
            <p className="mypage-kicker">Profile</p>
            <div className="mypage-profile-title-row">
              <h3>{profile?.nickname || '사용자'}</h3>
              <button
                type="button"
                className="mypage-profile-edit-button"
                onClick={() => {
                  setNicknameInput(profile?.nickname ?? '')
                  setEditingNickname((current) => !current)
                }}
                aria-label="닉네임 수정"
              >
                <EditIcon />
              </button>
            </div>
            <p className="mypage-profile-email">
              {session.user?.email || '이메일 계정'}
            </p>
          </div>

          <div className="mypage-profile-actions">
            <button
              type="button"
              className="mypage-icon-button"
              onClick={onRefresh}
              disabled={loading || profileLoading}
              aria-label={loading || profileLoading ? '불러오는 중' : '새로고침'}
              title={loading || profileLoading ? '불러오는 중' : '새로고침'}
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        {editingNickname ? (
          <form
            className="mypage-profile-form"
            onSubmit={async (event) => {
              event.preventDefault()
              const saved = await onSaveNickname(nicknameInput)
              if (saved) {
                setEditingNickname(false)
              }
            }}
          >
            <div className="mypage-profile-controls">
              <input
                id="nickname"
                className="mypage-profile-input"
                value={nicknameInput}
                onChange={(event) => setNicknameInput(event.target.value)}
                maxLength={10}
                placeholder="닉네임을 입력하세요"
                disabled={profileLoading || profileSaving}
              />
              <button
                type="submit"
                className="mypage-primary-button"
                disabled={profileLoading || profileSaving}
              >
                {profileSaving ? '저장 중..' : '저장'}
              </button>
              <button
                type="button"
                className="mypage-secondary-button"
                onClick={() => {
                  setNicknameInput(profile?.nickname ?? '')
                  setEditingNickname(false)
                }}
                disabled={profileSaving}
              >
                취소
              </button>
            </div>
            <p className="mypage-profile-help">
              2자 이상 10자 이하로 입력해주세요. 중복 닉네임은 사용할 수 없습니다.
            </p>
          </form>
        ) : null}

        {profileMessage ? (
          <p className="mypage-profile-message">{profileMessage}</p>
        ) : null}
      </section>

      {error ? <p className="status-message error-message">{error}</p> : null}

      {loading ? (
        <div className="mypage-empty">
          <h3>저장한 결과를 불러오는 중입니다.</h3>
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="mypage-empty">
          <h3>아직 저장한 결과가 없어요</h3>
          <p>
            분석 결과 화면에서 저장 버튼을 누르면 여기에 날짜별로 기록이 쌓입니다.
          </p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <section className="mypage-calendar-shell">
          <div className="mypage-calendar-panel">
            <div className="mypage-calendar-header">
              <div>
                <p className="mypage-kicker">Archive</p>
                <h3>{formatMonthLabel(resolvedMonth)}</h3>
                <p>이달에 기록이 남은 날짜 {savedDayCountThisMonth}일</p>
              </div>

              <div className="mypage-calendar-nav">
                <button
                  type="button"
                  className="mypage-calendar-nav-button"
                  onClick={() =>
                    setSelectedMonth((current) =>
                      addMonths(current ?? resolvedMonth, -1),
                    )
                  }
                  aria-label="이전 달"
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  className="mypage-calendar-nav-button"
                  onClick={() =>
                    setSelectedMonth((current) =>
                      addMonths(current ?? resolvedMonth, 1),
                    )
                  }
                  aria-label="다음 달"
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </div>

            <div className="mypage-calendar-weekdays" aria-hidden="true">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="mypage-calendar-grid">
              {calendarDays.map((day) => {
                const isSelected = selectedDateKey === day.dateKey
                const previewItems = day.items.slice(0, 1)

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    className={`mypage-calendar-cell${
                      day.isCurrentMonth ? '' : ' is-muted'
                    }${day.items.length ? ' has-items' : ''}${
                      isSelected ? ' is-selected' : ''
                    }`}
                    onClick={() => {
                      setSelectedDateKey(day.dateKey)
                      if (!isSameMonth(day.date, resolvedMonth)) {
                        setSelectedMonth(getMonthStart(day.date))
                      }
                    }}
                  >
                    <span className="mypage-calendar-date-number">
                      {day.date.getDate()}
                    </span>

                    {day.items.length ? (
                      <div className="mypage-calendar-labels">
                        {previewItems.map((item) => (
                          <span key={item.id} className="mypage-calendar-chip">
                            {formatShortSavedLabel(item)}
                          </span>
                        ))}
                        {day.items.length > previewItems.length ? (
                          <span className="mypage-calendar-more">
                            +{day.items.length - previewItems.length}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="mypage-calendar-empty-dot" aria-hidden="true" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {isDaySheetOpen ? (
        <div
          className="mypage-day-sheet-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedDateKey('')
            }
          }}
        >
          <section
            className="mypage-day-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="저장 기록 상세"
          >
            <div className="mypage-day-sheet-topbar">
              <button
                type="button"
                className="mypage-day-sheet-back"
                onClick={() => setSelectedDateKey('')}
              >
                <BackIcon />
                <span>{`${resolvedMonth.getFullYear()}년 ${resolvedMonth.getMonth() + 1}월`}</span>
              </button>
              <span className="mypage-day-badge">
                {monthKeysWithItems.has(selectedDateKey.slice(0, 7)) &&
                selectedDateItems.length
                  ? 'Saved'
                  : 'Empty'}
              </span>
            </div>

            <div className="mypage-day-header mypage-day-header-sheet">
              <div>
                <p className="mypage-kicker">Selected Date</p>
                <h3>{selectedDateKey}</h3>
                <p>
                  {selectedDateItems.length
                    ? `${selectedDateItems.length}개의 저장 기록이 있습니다.`
                    : '이 날짜에는 저장한 기록이 없습니다.'}
                </p>
              </div>
            </div>

            <div className="mypage-day-list">
              {selectedDateItems.length ? (
                selectedDateItems.map((item) => {
                  const summary = getSummary(item)
                  const canCompare = items.some(
                    (candidate) =>
                      candidate.id !== item.id &&
                      candidate.snapshot &&
                      getSavedResultUsername(candidate) === getSavedResultUsername(item) &&
                      getSavedResultWindowDays(candidate) === getSavedResultWindowDays(item) &&
                      getSavedResultTimestamp(candidate) < getSavedResultTimestamp(item),
                  )

                  return (
                    <article key={item.id} className="saved-result-card saved-result-card-day">
                      <div className="saved-result-meta">
                        <span>{formatSavedDate(item.analysis_generated_at || item.created_at)}</span>
                        <span>{summary.days}일 기준</span>
                      </div>
                      <h3>{item.profile_name || item.github_username}</h3>
                      <p className="saved-result-username">@{item.github_username}</p>
                      <p className="saved-result-headline">{summary.headline}</p>
                      <p className="saved-result-stat">최근 Push 이벤트 {summary.pushes}개</p>
                      <div className="saved-result-actions">
                        <button
                          type="button"
                          className="mypage-primary-button"
                          onClick={() => onOpenResult(item)}
                        >
                          결과 열기
                        </button>
                        <button
                          type="button"
                          className="mypage-secondary-button"
                          onClick={() => openCompareDialog(item)}
                          disabled={!canCompare || comparingSourceId === item.id}
                        >
                          {!canCompare
                            ? '비교 기록 없음'
                            : comparingSourceId === item.id
                              ? '비교 중..'
                              : '비교하기'}
                        </button>
                        <button
                          type="button"
                          className="mypage-secondary-button"
                          onClick={() => onDeleteResult(item)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? '삭제 중..' : '삭제'}
                        </button>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="mypage-day-empty">
                  <h4>저장 기록이 없는 날짜예요</h4>
                  <p>
                    이 날짜에는 분석 결과를 저장하지 않았습니다. 다른 날짜를 눌러
                    기록을 확인해보세요.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {isCompareDialogOpen ? (
        <div
          className="mypage-compare-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeCompareDialog()
            }
          }}
        >
          <section
            className="mypage-compare-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="저장 기록 비교"
          >
            <div className="mypage-day-sheet-topbar">
              <button
                type="button"
                className="mypage-day-sheet-back"
                onClick={closeCompareDialog}
              >
                <BackIcon />
                <span>비교 창 닫기</span>
              </button>
              <span className="mypage-day-badge">Compare</span>
            </div>

            <div className="mypage-compare-header">
              <p className="mypage-kicker">Compare Saved Results</p>
              <h3>
                @{compareSourceItem?.github_username} {getSavedResultWindowDays(compareSourceItem)}일 기록 비교
              </h3>
              <p>
                아래에서 같은 사람, 같은 기간의 이전 저장 기록을 고른 뒤 비교를
                실행하세요.
              </p>
            </div>

            <section className="mypage-compare-current">
              <p className="mypage-compare-label">현재 선택한 기록</p>
              <h4>{formatSavedDate(compareSourceItem?.analysis_generated_at || compareSourceItem?.created_at)}</h4>
              <p>{getSummary(compareSourceItem).headline}</p>
            </section>

            <section className="mypage-compare-selector">
              <div className="mypage-compare-selector-head">
                <p className="mypage-compare-label">비교할 이전 기록 선택</p>
                <button
                  type="button"
                  className="mypage-primary-button"
                  onClick={handleRunComparison}
                  disabled={!selectedCompareTargetId || comparisonLoading}
                >
                  {comparisonLoading ? '비교 분석 중' : '비교 실행'}
                </button>
              </div>

              <div className="mypage-compare-candidate-list">
                {compareCandidates.map((item) => {
                  const summary = getSummary(item)
                  const isActive = selectedCompareTargetId === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`mypage-compare-candidate${isActive ? ' is-selected' : ''}`}
                      onClick={() => {
                        setSelectedCompareTargetId(item.id)
                        setComparisonError('')
                        setComparisonData(null)
                      }}
                    >
                      <div className="mypage-compare-candidate-meta">
                        <span>{formatSavedDate(item.analysis_generated_at || item.created_at, false)}</span>
                        <span>{summary.days}일 기준</span>
                      </div>
                      <strong>{item.profile_name || item.github_username}</strong>
                      <p>{summary.headline}</p>
                    </button>
                  )
                })}
              </div>
            </section>

            {comparisonError ? (
              <p className="comparison-error">{comparisonError}</p>
            ) : null}

            {comparisonData ? (
              <section className="comparison-card comparison-card-inline">
                <div className="insight-heading">
                  <p className="insight-label">비교 피드백</p>
                  <span className="insight-status">
                    {comparisonData.comparison_source === 'ai' ? 'AI 비교 반영' : '기본 비교'}
                  </span>
                </div>

                <div className="comparison-meta">
                  <p>
                    {`${formatSavedDate(
                      selectedCompareTarget?.analysis_generated_at ||
                        selectedCompareTarget?.created_at,
                      false,
                    )} 기록과 비교`}
                  </p>
                  <span>
                    {formatSavedDate(
                      compareSourceItem?.analysis_generated_at ||
                        compareSourceItem?.created_at,
                      false,
                    )} 기준
                  </span>
                </div>

                <h3>{comparisonData.comparison.headline}</h3>
                <p>{comparisonData.comparison.growth}</p>
                <p>{comparisonData.comparison.needs_attention}</p>
                <p>{comparisonData.comparison.next_step}</p>

                {comparisonData.comparison_summary?.reliability_note ? (
                  <p className="comparison-note">
                    {comparisonData.comparison_summary.reliability_note}
                  </p>
                ) : null}
              </section>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  )
}

export { MyPage }
