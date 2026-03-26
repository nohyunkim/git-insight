import { ActivityChart, LanguageChart } from './InsightCharts'

function toChartData(entries, limit = 5) {
  return entries
    .sort(([, leftValue], [, rightValue]) => rightValue - leftValue)
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }))
}

function ProfileCard({ userData }) {
  const { profile, stats, username, feedback } = userData
  const languageChartData = toChartData(Object.entries(stats.languages ?? {}))
  const eventChartData = toChartData(Object.entries(stats.event_types ?? {}))
  const repositoryCount = profile.total_repos ?? profile.public_repos ?? 0
  const summary = stats.activity_summary ?? {
    window_days: 30,
    total_events_30d: 0,
    push_events_30d: 0,
    active_days_30d: 0,
  }

  return (
    <article className="profile-card">
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

      <section className="insight-card">
        <p className="insight-label">한 줄 인사이트</p>
        <h3>{feedback?.headline ?? '활동 데이터를 기반으로 요약을 준비 중입니다.'}</h3>
        <p>{feedback?.strength}</p>
        <p>{feedback?.next_step}</p>
      </section>

      <div className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">Recent Public Push Events</span>
          <strong>{stats.recent_push_events}</strong>
        </div>

        <div className="metric-card">
          <span className="metric-label">Repository Count</span>
          <strong>{repositoryCount}</strong>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <span className="metric-label">Last 30 Days Events</span>
          <strong>{summary.total_events_30d}</strong>
        </div>

        <div className="summary-card">
          <span className="metric-label">Last 30 Days Pushes</span>
          <strong>{summary.push_events_30d}</strong>
        </div>

        <div className="summary-card">
          <span className="metric-label">Active Days</span>
          <strong>{summary.active_days_30d}</strong>
        </div>
      </div>

      <div className="detail-grid">
        <section className="detail-card">
          <h3>언어 분포</h3>
          <LanguageChart languages={languageChartData} />
        </section>

        <section className="detail-card">
          <h3>최근 이벤트</h3>
          <ActivityChart events={eventChartData} />
        </section>
      </div>
    </article>
  )
}

export { ProfileCard }
