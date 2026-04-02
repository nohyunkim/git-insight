import { useEffect, useRef, useState } from 'react'

function SearchForm({
  username,
  loading,
  periods,
  selectedDays,
  onUsernameChange,
  onPeriodChange,
  onSearch,
}) {
  const [isPeriodOpen, setIsPeriodOpen] = useState(false)
  const periodMenuRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!periodMenuRef.current?.contains(event.target)) {
        setIsPeriodOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const selectedPeriod =
    periods.find((period) => period.days === selectedDays) ?? periods[0]

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      onSearch()
    }
  }

  const handlePeriodSelect = (days) => {
    onPeriodChange(days)
    setIsPeriodOpen(false)
  }

  return (
    <div className="search-card">
      <div className="search-meta-row">
        <div className="search-copy">
          <p className="search-kicker">GitHub Profile</p>
          <label className="search-title" htmlFor="github-username">
            GitHub 아이디
          </label>
          <p className="search-help">예: `torvalds`, `gaearon`, `octocat`</p>
        </div>

        <div className="period-menu" ref={periodMenuRef}>
          <p className="period-label">조회 기간</p>
          <button
            type="button"
            className={`period-trigger${isPeriodOpen ? ' is-open' : ''}`}
            onClick={() => setIsPeriodOpen((current) => !current)}
            aria-haspopup="listbox"
            aria-expanded={isPeriodOpen}
          >
            <span>{selectedPeriod.label}</span>
            <span className="period-caret" aria-hidden="true">
              ▾
            </span>
          </button>

          {isPeriodOpen ? (
            <div className="period-dropdown" role="listbox" aria-label="조회 기간 선택">
              {periods.map((period) => {
                const isActive = period.days === selectedDays

                return (
                  <button
                    key={period.days}
                    type="button"
                    className={`period-option${isActive ? ' is-active' : ''}`}
                    onClick={() => handlePeriodSelect(period.days)}
                    role="option"
                    aria-selected={isActive}
                  >
                    <span>{period.label}</span>
                    {isActive ? (
                      <span className="period-check" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>

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
