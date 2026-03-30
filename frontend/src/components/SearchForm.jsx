function SearchForm({ username, loading, onUsernameChange, onSearch }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div className="search-card">
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

        <button type="button" onClick={onSearch} disabled={loading}>
          {loading ? '검색 중' : '분석 시작'}
        </button>
      </div>
    </div>
  )
}

export { SearchForm }
