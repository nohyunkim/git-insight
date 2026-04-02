function SearchForm({
  username,
  loading,
  periods,
  selectedDays,
  onUsernameChange,
  onPeriodChange,
  onSearch,
}) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div className="search-card">
      <div className="period-toolbar">
        <span className="search-label">조회 기간</span>
        <div className="period-group" role="tablist" aria-label="조회 기간 선택">
          {periods.map((period) => {
            const isActive = period.days === selectedDays

            return (
              <button
                key={period.days}
                type="button"
                className={`period-chip${isActive ? ' is-active' : ''}`}
                onClick={() => onPeriodChange(period.days)}
                aria-pressed={isActive}
              >
                {period.label}
              </button>
            )
          })}
        </div>
      </div>

      <label className="search-label" htmlFor="github-username">
        GitHub 아이디
      </label>
      <p className="search-help">예: `torvalds`, `gaearon`, `octocat`</p>

      <div className="search-row">
        <div className="input-wrapper">
          <span className="input-prefix">github.com/</span>
          <input
            id="github-username"
            type="text"
            placeholder="예: github-id"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          type="button"
          onClick={onSearch}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <span className="button-loading">
              <span className="button-spinner" aria-hidden="true" />
              불러오는 중
            </span>
          ) : (
            '분석 시작'
          )}
        </button>
      </div>
    </div>
  )
}

export { SearchForm }
