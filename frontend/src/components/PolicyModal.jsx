import { useState } from 'react'

export function PolicyModal({ policy, onClose }) {
  const [openIndex, setOpenIndex] = useState(0)

  if (!policy) {
    return null
  }

  return (
    <div
      className="policy-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="policy-modal" role="dialog" aria-modal="true" aria-label={policy.title}>
        <div className="policy-modal-header">
          <h2>{policy.title}</h2>
          <button type="button" className="policy-modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="policy-modal-body">
          {policy.sections.map((section, index) => {
            const isOpen = openIndex === index

            return (
              <article key={section.heading} className="policy-modal-section">
                <button
                  type="button"
                  className="policy-accordion-trigger"
                  onClick={() => setOpenIndex((current) => (current === index ? -1 : index))}
                  aria-expanded={isOpen}
                >
                  <span>{section.heading}</span>
                  <span className={`policy-accordion-caret${isOpen ? ' is-open' : ''}`} aria-hidden="true">
                    ▾
                  </span>
                </button>
                {isOpen ? (
                  <div className="policy-accordion-content">
                    <p>{section.body}</p>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
