import { ActivityChart, LanguageChart } from './InsightCharts'

function toChartData(entries, limit = 5) {
  return entries
    .sort(([, leftValue], [, rightValue]) => rightValue - leftValue)
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }))
}

function ProfileCard({ userData }) {
  const { profile, stats, username } = userData
  const languageChartData = toChartData(Object.entries(stats.languages ?? {}))
  const eventChartData = toChartData(Object.entries(stats.event_types ?? {}))
  const repositoryCount = profile.total_repos ?? profile.public_repos ?? 0

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
            공개 레포 {repositoryCount}개와 최근 Push 기준 커밋
            {` ${stats.recent_commits}개`}를 확인했습니다.
          </p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">Recent Push Commits</span>
          <strong>{stats.recent_commits}</strong>
        </div>

        <div className="metric-card">
          <span className="metric-label">Repository Count</span>
          <strong>{repositoryCount}</strong>
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
