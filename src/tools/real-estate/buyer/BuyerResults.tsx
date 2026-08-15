import { useState } from 'react'
import type { ResultSection } from '../../core/types'
import type { BuyerAnswers } from './buyerTypes'
import { buildBuyerSummaryText } from './buyerSummary'

export { buildBuyerSummaryText }

interface Props {
  sections: ResultSection[]
  answers: BuyerAnswers
  onStartOver: () => void
  onEditAnswers: () => void
}

export function BuyerResults({ sections, answers, onStartOver, onEditAnswers }: Props) {
  const [copyStatus, setCopyStatus] = useState<'' | 'copied' | 'failed'>('')

  async function handleCopy() {
    const text = buildBuyerSummaryText(sections, answers.agentQuestions)
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(''), 4000)
    } catch {
      setCopyStatus('failed')
    }
  }

  return (
    <div>
      <div className="tool-results-header">
        <h1 className="tool-results-title">Your Planning Summary</h1>
        <p className="tool-results-subtitle">
          Based on your answers, here are the topics most relevant to your situation.
          Use this as a starting point for conversations with a licensed real estate agent.
        </p>
      </div>

      <div className="result-actions no-print">
        <button type="button" className="result-action-btn" onClick={handleCopy}>
          Copy Summary
        </button>
        <button type="button" className="result-action-btn" onClick={() => window.print()}>
          Print Summary
        </button>
        <button type="button" className="result-action-btn" onClick={onEditAnswers}>
          Review / Edit Answers
        </button>
        <button type="button" className="result-action-btn result-action-btn--ghost" onClick={onStartOver}>
          Start Over
        </button>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`result-copy-status${copyStatus === 'copied' ? ' success' : copyStatus === 'failed' ? ' failed' : ''}`}
        >
          {copyStatus === 'copied' && 'Copied to clipboard.'}
          {copyStatus === 'failed' && "Copy failed — use your device's select-all and copy instead."}
        </div>
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

      {answers.agentQuestions.trim() && (
        <div className="result-section result-written-questions">
          <div className="result-section-header">
            <p className="result-section-title">Your Written Questions</p>
          </div>
          <div className="result-items">
            <div className="result-item">
              <p className="result-item-detail result-item-detail--questions">
                {answers.agentQuestions.trim()}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="tool-disclaimer" role="note">
        <p>
          This planning summary is for informational and discussion purposes only.
          It does not constitute real estate, legal, financial, or tax advice.
          Please consult qualified professionals for guidance specific to your situation.
        </p>
        <p>
          Results are based solely on the information you entered and are not a
          prediction, valuation, or professional assessment of your situation.
        </p>
        <p>
          Interactive demo by{' '}
          <a href="https://websitesbyleslie.com" target="_blank" rel="noopener noreferrer">
            Websites by Leslie
          </a>
        </p>
      </div>

      <div className="tool-sales-cta no-print" aria-label="For real estate professionals">
        <p className="tool-sales-cta-eyebrow">For real estate professionals</p>
        <h2 className="tool-sales-cta-heading">
          Want this planner customized for your business?
        </h2>
        <p className="tool-sales-cta-body">
          Websites by Leslie can build a version of this tool tailored to your brand and clients.
        </p>
        <ul className="tool-sales-cta-features" aria-label="What can be customized">
          <li>Your branding and agent information</li>
          <li>Questions and guidance for your market</li>
          <li>Lead delivery to your inbox</li>
          <li>Integration with your existing website</li>
        </ul>
        <a
          href="https://websitesbyleslie.com/#contact"
          className="tool-sales-cta-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get in touch →
        </a>
      </div>
    </div>
  )
}
