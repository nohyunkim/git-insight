import { useState } from 'react'

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
      <div className="mypage-header">
        <div>
          <p className="mypage-kicker">My Page</p>
          <h2>프로필과 저장한 GitHub 분석 기록</h2>
          <p>
            Google 로그인 정보를 바탕으로 프로필을 보여주고, 닉네임을 원하는 이름으로 바꿔가며
            계속 사용할 수 있습니다.
          </p>
        </div>

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
          <div>
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
            <p>{session.user?.email || '소셜 로그인 계정'}</p>
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
          <p>분석 결과 화면에서 저장 버튼을 누르면 여기에 기록이 쌓입니다.</p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="saved-results-grid">
          {items.map((item) => {
            const summary = getSummary(item)

            return (
              <article key={item.id} className="saved-result-card">
                <div className="saved-result-meta">
                  <span>{formatSavedDate(item.created_at)}</span>
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
                    저장한 결과 열기
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
          })}
        </div>
      ) : null}
    </section>
  )
}

export { MyPage }
