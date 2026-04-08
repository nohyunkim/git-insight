import { useMemo, useState } from 'react'

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

function formatSavedDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

  const date = new Date(candidate)
  if (Number.isNaN(date.getTime())) {
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
  const username = savedResult?.github_username || savedResult?.snapshot?.username || 'result'
  const days = savedResult?.window_days || savedResult?.snapshot?.stats?.activity_summary?.window_days || 30
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
      value.sort((left, right) => {
        const leftTime = new Date(left.analysis_generated_at || left.created_at || 0).getTime()
        const rightTime = new Date(right.analysis_generated_at || right.created_at || 0).getTime()
        return rightTime - leftTime
      })
    }

    return map
  }, [items])

  const monthKeysWithItems = useMemo(() => {
    const keys = new Set()

    groupedByDate.forEach((_items, dateKey) => {
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
      return getMonthStart(new Date(latestDateKey))
    }

    return getMonthStart(new Date())
  }, [latestDateKey, selectedMonth])

  const monthKey = formatDateKey(resolvedMonth).slice(0, 7)
  const availableKeysInMonth = useMemo(
    () =>
      [...groupedByDate.keys()]
        .filter((dateKey) => dateKey.startsWith(monthKey))
        .sort(),
    [groupedByDate, monthKey],
  )

  const selectedDateItems = groupedByDate.get(selectedDateKey) ?? []
  const calendarDays = useMemo(
    () => buildCalendarDays(resolvedMonth, groupedByDate),
    [groupedByDate, resolvedMonth],
  )

  const savedDayCountThisMonth = useMemo(() => {
    return availableKeysInMonth.length
  }, [availableKeysInMonth.length])
  const isDaySheetOpen = Boolean(selectedDateKey)

  if (!session) {
    return (
      <section className="mypage-panel">
        <div className="mypage-empty">
          <p className="mypage-kicker">My Page</p>
          <h2>로그인하면 저장한 결과를 모아볼 수 있어요</h2>
          <p>Google 로그인으로 연결하면 결과 저장과 다시 보기 기능을 바로 사용할 수 있습니다.</p>
          <div className="saved-result-actions">
            <button type="button" className="mypage-primary-button" onClick={onGoogleLogin}>
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
            <div className="mypage-profile-avatar mypage-profile-avatar-fallback" aria-hidden="true">
              {(profile?.nickname || session.user?.email || '?').slice(0, 1).toUpperCase()}
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
            <div className="mypage-profile-subrow">
              <p>{session.user?.email || '소셜 로그인 계정'}</p>
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
        </div>

        {editingNickname ? (
          <form
            className="mypage-profile-form"
            onSubmit={async (event) => {
              event.preventDefault()
              await onSaveNickname(nicknameInput)
              setEditingNickname(false)
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
              <button type="submit" className="mypage-primary-button" disabled={profileLoading || profileSaving}>
                {profileSaving ? '저장 중...' : '저장'}
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
              2자 이상 10자 이하로 입력해주세요. 중복 닉네임은 저장할 수 없습니다.
            </p>
          </form>
        ) : null}

        {profileMessage ? <p className="mypage-profile-message">{profileMessage}</p> : null}
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
          <p>분석 결과 화면에서 저장 버튼을 누르면 여기에 기록이 날짜별로 쌓입니다.</p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <section className="mypage-calendar-shell">
          <div className="mypage-calendar-panel">
            <div className="mypage-calendar-header">
              <div>
                <p className="mypage-kicker">Archive</p>
                <h3>{formatMonthLabel(resolvedMonth)}</h3>
                <p>이달에 기록된 저장 날짜 {savedDayCountThisMonth}일</p>
              </div>

              <div className="mypage-calendar-nav">
                <button
                  type="button"
                  className="mypage-calendar-nav-button"
                  onClick={() => setSelectedMonth((current) => addMonths(current ?? resolvedMonth, -1))}
                  aria-label="이전 달"
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  className="mypage-calendar-nav-button"
                  onClick={() => setSelectedMonth((current) => addMonths(current ?? resolvedMonth, 1))}
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
                    className={`mypage-calendar-cell${day.isCurrentMonth ? '' : ' is-muted'}${day.items.length ? ' has-items' : ''}${isSelected ? ' is-selected' : ''}`}
                    onClick={() => {
                      setSelectedDateKey(day.dateKey)
                      if (!isSameMonth(day.date, resolvedMonth)) {
                        setSelectedMonth(getMonthStart(day.date))
                      }
                    }}
                  >
                    <span className="mypage-calendar-date-number">{day.date.getDate()}</span>

                    {day.items.length ? (
                      <div className="mypage-calendar-labels">
                        {previewItems.map((item) => (
                          <span key={item.id} className="mypage-calendar-chip">
                            {formatShortSavedLabel(item)}
                          </span>
                        ))}
                        {day.items.length > previewItems.length ? (
                          <span className="mypage-calendar-more">+{day.items.length - previewItems.length}</span>
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
          <section className="mypage-day-sheet" role="dialog" aria-modal="true" aria-label="저장 기록 상세">
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
                {monthKeysWithItems.has(selectedDateKey.slice(0, 7)) && selectedDateItems.length ? 'Saved' : 'Empty'}
              </span>
            </div>

            <div className="mypage-day-header mypage-day-header-sheet">
              <div>
                <p className="mypage-kicker">Selected Date</p>
                <h3>{selectedDateKey}</h3>
                <p>
                  {selectedDateItems.length
                    ? `${selectedDateItems.length}개의 저장 기록이 있습니다.`
                    : '이 날짜에는 저장된 기록이 없습니다.'}
                </p>
              </div>
            </div>

            <div className="mypage-day-list">
              {selectedDateItems.length ? (
                selectedDateItems.map((item) => {
                  const summary = getSummary(item)

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
                          onClick={() => onDeleteResult(item)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? '삭제 중...' : '삭제'}
                        </button>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="mypage-day-empty">
                  <h4>저장 기록이 없는 날짜예요</h4>
                  <p>이 날짜에는 분석 결과를 저장하지 않았습니다. 다른 날짜를 눌러 기록을 확인해보세요.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

export { MyPage }
