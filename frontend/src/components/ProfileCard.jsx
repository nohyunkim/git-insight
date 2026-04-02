import { ActivityChart, LanguageChart } from './InsightCharts'

function toChartData(entries, limit = 5) {
  return entries
    .sort(([, leftValue], [, rightValue]) => rightValue - leftValue)
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }))
}

function ProfileCard({ userData, feedbackLoading = false }) {
  const { profile, stats, username, feedback, feedback_source: feedbackSource } = userData
  const languageChartData = toChartData(Object.entries(stats.languages ?? {}))
  const eventChartData = toChartData(Object.entries(stats.event_types ?? {}))
  const repositoryCount = profile.total_repos ?? profile.public_repos ?? 0
  const summary = stats.activity_summary ?? {
    window_days: 30,
    total_events_30d: 0,
    push_events_30d: 0,
    active_days_30d: 0,
  }
  const strengthText =
    feedback?.strength ?? '활동 흐름을 바탕으로 강점을 정리하고 있습니다.'
  const improvementText =
    feedback?.improvement ?? '보완 포인트를 함께 읽기 쉽게 정리하고 있습니다.'
  const nextStepText =
    feedback?.next_step ?? '다음 작업에서 바로 적용할 수 있는 제안을 준비 중입니다.'
  const feedbackBadge = feedbackLoading
    ? 'AI 요약 보강 중'
    : feedbackSource === 'ai'
      ? 'AI 요약 반영됨'
      : '빠른 기본 요약'

  return (
    <article className="profile-card">
      <div className="profile-top">
        <div className="profile-header">
          <img
            className="avatar"
            src={profile.avatar_url}
            alt={`${profile.name || username} avatar`}
            width="108"
            height="108"
          />

          <div>
            <p className="profile-kicker">@{username}</p>
            <h2>{profile.name || username}</h2>
            <p className="profile-summary">
              공개 레포 {repositoryCount}개와 최근 공개 Push 이벤트
              {` ${stats.recent_push_events}개`}를 확인했습니다.
            </p>
          </div>
        </div>

        <div className="profile-sidecard">
          <span className="sidecard-label">현재 활동 온도</span>
          <strong>{summary.total_events_30d > 0 ? '활동 중' : '준비 중'}</strong>
          <p>최근 30일 공개 이벤트와 레포지토리 언어 분포를 기준으로 요약했습니다.</p>
        </div>
      </div>

      <section className="insight-card">
        <div className="insight-heading">
          <p className="insight-label">집중 인사이트</p>
          <span className="insight-status">{feedbackBadge}</span>
        </div>
        <h3>{feedback?.headline ?? '활동 데이터를 기반으로 요약을 준비 중입니다.'}</h3>
        <p>{strengthText}</p>
        <p>{improvementText}</p>
        <p>{nextStepText}</p>
      </section>

      <div className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">최근 공개 Push 이벤트</span>
          <strong>{stats.recent_push_events}</strong>
        </div>

        <div className="metric-card">
          <span className="metric-label">전체 공개 레포</span>
          <strong>{repositoryCount}</strong>
        </div>

        <div className="metric-card accent-card">
          <span className="metric-label">최근 30일 이벤트</span>
          <strong>{summary.total_events_30d}</strong>
        </div>

        <div className="metric-card accent-card">
          <span className="metric-label">최근 30일 Push</span>
          <strong>{summary.push_events_30d}</strong>
        </div>

        <div className="metric-card accent-card">
          <span className="metric-label">활동한 날짜</span>
          <strong>{summary.active_days_30d}</strong>
        </div>
      </div>

      <div className="detail-grid">
        <section className="detail-card">
          <div className="section-heading">
            <h3>언어 분포</h3>
            <p>레포지토리 기준 상위 언어</p>
          </div>
          <LanguageChart languages={languageChartData} />
        </section>

        <section className="detail-card">
          <div className="section-heading">
            <h3>최근 이벤트</h3>
            <p>공개 활동 상위 이벤트 유형</p>
          </div>
          <ActivityChart events={eventChartData} />
        </section>
      </div>
    </article>
  )
}

export { ProfileCard }
