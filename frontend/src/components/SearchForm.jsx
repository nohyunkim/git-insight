function SearchForm({ username, loading, onUsernameChange, onSearch }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div className="search-card">
      <label className="search-label" htmlFor="github-username">
        GitHub username
      </label>

      <div className="search-row">
        <div className="input-wrapper">
          <span className="input-prefix">github.com/</span>
          <input
            id="github-username"
            type="text"
            placeholder="예: nohyunkim"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button type="button" onClick={onSearch} disabled={loading}>
          {loading ? '불러오는 중' : '검색'}
        </button>
      </div>
    </div>
  )
}

export { SearchForm }
