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
  items,
  loading,
  error,
  onRefresh,
  onOpenResult,
  onLogin,
  onDeleteResult,
  deletingId,
}) {
  if (!session) {
    return (
      <section className="mypage-panel">
        <div className="mypage-empty">
          <p className="mypage-kicker">My Page</p>
          <h2>로그인하면 저장한 결과를 모아볼 수 있어요.</h2>
          <p>Google 로그인으로 연결하면 결과 저장, 목록 확인, 이후 비교 기능까지 이어서 확장할 수 있습니다.</p>
          <button type="button" className="mypage-primary-button" onClick={onLogin}>
            Google로 로그인
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="mypage-panel">
      <div className="mypage-header">
        <div>
          <p className="mypage-kicker">My Page</p>
          <h2>저장한 GitHub 분석 기록</h2>
          <p>현재 계정으로 저장한 분석 결과를 모아보고, 이후 비교와 성장 피드백의 기반으로 사용할 수 있습니다.</p>
        </div>

        <button type="button" className="mypage-secondary-button" onClick={onRefresh} disabled={loading}>
          {loading ? '불러오는 중...' : '새로고침'}
        </button>
      </div>

      {error ? <p className="status-message error-message">{error}</p> : null}

      {loading ? (
        <div className="mypage-empty">
          <h3>저장한 결과를 불러오는 중입니다.</h3>
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="mypage-empty">
          <h3>아직 저장된 결과가 없습니다.</h3>
          <p>분석 결과 화면에서 '결과 저장'을 누르면 여기에 기록이 쌓입니다.</p>
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
