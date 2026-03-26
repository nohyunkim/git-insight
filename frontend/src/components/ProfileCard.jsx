function ProfileCard({ userData }) {
  const { profile, stats, username } = userData
  const languageEntries = Object.entries(stats.languages)
  const eventEntries = Object.entries(stats.event_types ?? {})

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
            공개 레포 {profile.total_repos ?? profile.public_repos ?? 0}개, 최근
            Push 기준 커밋 {stats.recent_commits}개
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
          <strong>{profile.total_repos ?? profile.public_repos ?? 0}</strong>
        </div>
      </div>

      <div className="detail-grid">
        <section className="detail-card">
          <h3>언어 분포</h3>
          {languageEntries.length ? (
            <ul className="chip-list">
              {languageEntries.map(([language, count]) => (
                <li key={language}>
                  <span>{language}</span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">표시할 언어 데이터가 아직 없습니다.</p>
          )}
        </section>

        <section className="detail-card">
          <h3>최근 이벤트</h3>
          {eventEntries.length ? (
            <ul className="chip-list">
              {eventEntries.map(([eventName, count]) => (
                <li key={eventName}>
                  <span>{eventName}</span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">표시할 활동 이벤트가 아직 없습니다.</p>
          )}
        </section>
      </div>
    </article>
  )
}

export { ProfileCard }
