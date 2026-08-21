import { useState, Fragment } from 'react'
import type { ResultSection } from '../../core/types'
import type { BuyerAnswers } from './buyerTypes'
import { buildBuyerSummaryText } from './buyerSummary'
import { buildBuyerAnswerRecap, type RecapRow } from './buyerLabels'

export { buildBuyerSummaryText }

export const BUYER_SHARE_TITLE = 'My Buyer Readiness Planning Summary'

interface Props {
  sections: ResultSection[]
  answers: BuyerAnswers
  onStartOver: () => void
  onEditAnswers: () => void
}

export function BuyerResults({ sections, answers, onStartOver, onEditAnswers }: Props) {
  const [copyStatus, setCopyStatus] = useState<'' | 'copied' | 'failed' | 'share-error'>('')
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  async function handleCopy() {
    const text = buildBuyerSummaryText(sections, answers)
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(''), 4000)
    } catch {
      setCopyStatus('failed')
    }
  }

  async function handleShare() {
    const text = buildBuyerSummaryText(sections, answers)
    try {
      await navigator.share({ title: BUYER_SHARE_TITLE, text })
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setCopyStatus('share-error')
        setTimeout(() => setCopyStatus(''), 6000)
      }
      // AbortError (user cancelled): quiet, no status message
    }
  }

  const isSuccess = copyStatus === 'copied'
  const isError = copyStatus === 'failed' || copyStatus === 'share-error'

  const recapRows: RecapRow[] = buildBuyerAnswerRecap(answers)

  return (
    <div>
      <div className="tool-results-header">
        <h1 className="tool-results-title">Your Planning Summary</h1>
        <p className="tool-results-subtitle">
          Based on your answers, here are the topics most relevant to your situation.
          Use this as a starting point for conversations with a licensed real estate agent.
        </p>
      </div>

      {recapRows.length > 0 && (
        <div className="result-section result-section--answers-recap">
          <div className="result-section-header">
            <p className="result-section-title">Your Answers at a Glance</p>
          </div>
          <dl className="result-recap-list">
            {recapRows.map(row => (
              <Fragment key={row.field}>
                <dt className="result-recap-term">{row.field}</dt>
                <dd className="result-recap-detail">{row.value}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      )}

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

      <div className="result-actions no-print">
        <button type="button" className="tool-action-btn" onClick={handleCopy}>
          Copy Summary
        </button>
        {canShare && (
          <button
            type="button"
            className="tool-action-btn result-share-action"
            title="Shares the complete planning summary via your device's share options"
            onClick={handleShare}
          >
            Share Summary
          </button>
        )}
        <button type="button" className="tool-action-btn" onClick={() => window.print()}>
          Print Summary
        </button>
        <button type="button" className="tool-action-btn" onClick={onEditAnswers}>
          Review / Edit Answers
        </button>
        <button type="button" className="tool-action-btn" onClick={onStartOver}>
          Start Over
        </button>
        {!canShare && (
          <p className="result-share-hint">
            To email your summary, choose Copy Summary and paste it into your email.
          </p>
        )}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`result-copy-status${isSuccess ? ' success' : isError ? ' failed' : ''}`}
        >
          {copyStatus === 'copied' && 'Complete summary copied to clipboard.'}
          {copyStatus === 'failed' && "Copy failed — use your device's select-all and copy instead."}
          {copyStatus === 'share-error' && 'Sharing failed. Use Copy Summary to copy your summary and share it manually.'}
        </div>
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
          href="mailto:websitesbyleslie01@gmail.com?subject=Custom%20planner%20inquiry"
          className="tool-sales-cta-link"
          title="Opens your email application to contact Websites by Leslie"
        >
          Email Leslie →
        </a>
      </div>
    </div>
  )
}
