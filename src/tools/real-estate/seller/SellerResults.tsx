import type { ResultSection } from '../../core/types'

interface Props {
  sections: ResultSection[]
  onStartOver: () => void
}

export function SellerResults({ sections, onStartOver }: Props) {
  return (
    <div>
      <div className="tool-results-header">
        <h1 className="tool-results-title">Your Planning Summary</h1>
        <p className="tool-results-subtitle">
          Based on your answers, here are the topics most relevant to your situation.
          Use this as a starting point for conversations with a licensed real estate agent.
        </p>
      </div>

      <div className="result-sections">
        {sections.map(section => (
          <div key={section.id} className={`result-section result-section--${section.id}`}>
            <div className="result-section-header">
              <p className="result-section-title">{section.title}</p>
            </div>
            <div className="result-items">
              {section.items.map(item => (
                <div key={item.id} className="result-item">
                  <p className="result-item-label">
                    <span className="result-item-arrow" aria-hidden="true">→</span>
                    {item.label}
                  </p>
                  {item.detail && (
                    <p className="result-item-detail">{item.detail}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="tool-start-over-wrap">
        <button type="button" className="tool-start-over-btn" onClick={onStartOver}>
          Start Over
        </button>
      </div>

      <div className="tool-disclaimer" role="note">
        <p>
          This planning summary is for informational and discussion purposes only.
          It does not constitute real estate, legal, financial, or tax advice.
          Please consult qualified professionals for guidance specific to your situation.
        </p>
        <p>
          Results are based solely on the information you entered and are not a
          prediction, valuation, or professional assessment of your property or situation.
        </p>
        <p className="tool-eho">
          <span aria-hidden="true">⊜</span>
          Equal Housing Opportunity
        </p>
        <p>
          Demo created by{' '}
          <a href="https://websitesbyleslie.com" target="_blank" rel="noopener noreferrer">
            Websites by Leslie
          </a>
        </p>
      </div>
    </div>
  )
}
