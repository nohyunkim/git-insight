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
      <div className="search-head">
        <div className="search-copy">
          <p className="search-kicker">Start With A Username</p>
          <h2 className="search-title">GitHub ID로 바로 분석</h2>
          <p className="search-subtitle">
            선택한 기간 기준으로 활동 흐름, 언어 분포, 추천 인사이트를 한 번에 정리합니다.
          </p>
        </div>

        <div className="period-menu" ref={periodMenuRef}>
          <button
            type="button"
            className={`period-trigger${isPeriodOpen ? ' is-open' : ''}`}
            onClick={() => setIsPeriodOpen((current) => !current)}
            aria-haspopup="listbox"
            aria-expanded={isPeriodOpen}
          >
            <span className="period-trigger-label">기간</span>
            <span className="period-trigger-value">{selectedPeriod.label}</span>
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
            placeholder="예: torvalds, gaearon, octocat"
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
