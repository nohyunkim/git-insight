import { SearchForm } from './SearchForm'

export function LandingPage({
  username,
  loading,
  periods,
  selectedDays,
  onUsernameChange,
  onPeriodChange,
  onSearch,
  error,
  howItWorksSteps,
  landingContentSections,
  contentLinks,
  onOpenPolicy,
  feedbackFormUrl,
}) {
  return (
    <>
      <section className="landing-hero">
        <div className="landing-brand-mark">
          <img src="/favicon-branchicorn.png" alt="Git Insight logo" />
        </div>
        <p className="landing-kicker">GitHub Activity Reader</p>
        <h1>Git Insight</h1>
        <p className="landing-subtitle">
          GitHub 활동을 한 번에 읽기 쉽게 보고, 다음에 무엇을 보면 좋을지 바로 이어지는 시작 화면입니다.
        </p>

        <SearchForm
          variant="landing"
          username={username}
          loading={loading}
          periods={periods}
          selectedDays={selectedDays}
          onUsernameChange={onUsernameChange}
          onPeriodChange={onPeriodChange}
          onSearch={onSearch}
        />

        {error ? <p className="status-message error-message landing-error">{error}</p> : null}
      </section>

      <section className="landing-steps">
        <div className="landing-section-heading">
          <p className="landing-section-kicker">How It Works</p>
          <h2>결과를 보는 방식</h2>
        </div>

        <div className="landing-step-grid">
          {howItWorksSteps.map((item) => (
            <article key={item.step} className="landing-step-card">
              <span className="landing-step-number">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <div className="editorial-grid">
          {landingContentSections.map((section) => (
            <article key={section.title} className="editorial-card">
              <div className="editorial-kicker-row">
                <span className="editorial-kicker-dot" aria-hidden="true" />
                <p className="editorial-kicker">{section.kicker}</p>
              </div>
              <h3>{section.title}</h3>
              <p className="editorial-summary">{section.summary}</p>
              <ul className="editorial-points">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className="editorial-tags">
                {section.tags.map((tag) => (
                  <span key={tag} className="editorial-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="landing-section-heading editorial-heading">
          <p className="landing-section-kicker">More To Read</p>
          <h2>함께 보면 좋은 읽을거리</h2>
        </div>

        <div className="content-link-grid">
          {contentLinks.map((item) => (
            <a key={item.href} href={item.href} className="content-link-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </a>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <span className="landing-footer-line" aria-hidden="true" />
        <nav className="landing-footer-links" aria-label="정책 및 안내 링크">
          <button type="button" className="footer-link-button" onClick={() => onOpenPolicy('about')}>
            서비스 소개
          </button>
          <button type="button" className="footer-link-button" onClick={() => onOpenPolicy('guide')}>
            결과 해석 가이드
          </button>
          <button type="button" className="footer-link-button" onClick={() => onOpenPolicy('faq')}>
            자주 묻는 질문
          </button>
          <button type="button" className="footer-link-button" onClick={() => onOpenPolicy('privacy')}>
            개인정보처리방침
          </button>
          <button type="button" className="footer-link-button" onClick={() => onOpenPolicy('terms')}>
            이용약관
          </button>
          <a href={feedbackFormUrl} target="_blank" rel="noreferrer">
            문의 및 오류 제보
          </a>
        </nav>
        <p>© 2026 Git Insight. All Rights Reserved.</p>
      </footer>
    </>
  )
}
