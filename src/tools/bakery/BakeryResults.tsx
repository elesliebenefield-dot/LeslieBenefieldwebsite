import { Fragment, useState } from 'react'
import { buildMailtoHref } from '../core/buildMailtoHref'
import { buildOrderBriefText, buildMailtoSubject, formatBriefDate } from './bakerySummary'
import type { BakeryAnswers } from './bakeryTypes'
import { PRODUCT_TYPE_LABELS, OCCASION_LABELS, RECIPIENT_LABELS, BUDGET_LABELS } from './bakeryTypes'

interface Props {
  answers: BakeryAnswers
  onEditAnswers: () => void
  onStartOver: () => void
  onNameChange: (name: string) => void
}

function BriefSection({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  const visible = rows.filter(r => r.value)
  if (visible.length === 0) return null
  return (
    <div className="result-section">
      <div className="result-section-header">
        <p className="result-section-title">{title}</p>
      </div>
      <div className="result-items" style={{ padding: '0.875rem 1.25rem' }}>
        <dl className="result-recap-list">
          {visible.map(row => (
            <Fragment key={row.label}>
              <dt className="result-recap-term">{row.label}</dt>
              <dd className="result-recap-detail">{row.value}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </div>
  )
}

export function BakeryResults({ answers, onEditAnswers, onStartOver, onNameChange }: Props) {
  const [copyStatus, setCopyStatus] = useState<'' | 'copied' | 'failed' | 'share-error'>('')
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const briefText = buildOrderBriefText(answers)
  const subject   = buildMailtoSubject(answers)
  const mailtoHref = buildMailtoHref('', subject, briefText)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(briefText)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(''), 4000)
    } catch {
      setCopyStatus('failed')
    }
  }

  async function handleShare() {
    try {
      await navigator.share({ title: 'My Custom Bakery Order Request', text: briefText })
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setCopyStatus('share-error')
        setTimeout(() => setCopyStatus(''), 6000)
      }
    }
  }

  // Build color value string
  let colorValue = ''
  if (answers.openToColorSuggestions && !answers.colors.trim()) {
    colorValue = "Open to baker's suggestions"
  } else if (answers.colors.trim()) {
    colorValue = answers.openToColorSuggestions
      ? `${answers.colors.trim()} (open to baker's suggestions)`
      : answers.colors.trim()
  }

  // Build inscription value string
  let inscriptionValue = ''
  if (answers.noInscription) {
    inscriptionValue = 'No inscription needed'
  } else if (answers.inscriptionText.trim()) {
    inscriptionValue = `"${answers.inscriptionText.trim()}"`
  }

  const isSuccess = copyStatus === 'copied'
  const isError   = copyStatus === 'failed' || copyStatus === 'share-error'

  return (
    <div>
      <div className="tool-results-header">
        <h1 className="tool-results-title">Your Order Request Brief</h1>
        <p className="tool-results-subtitle">
          Review your brief below. When you're ready, copy it, print it, or click{' '}
          <strong>Email the Bakery</strong> to open a pre-filled message in your email app.
        </p>
      </div>

      {/* Customer name */}
      <div className="bakery-name-row no-print">
        <label htmlFor="customerName" className="bakery-name-label">
          Your name <span className="tool-question-optional">(optional)</span>
        </label>
        <input
          id="customerName"
          type="text"
          className="tool-input"
          placeholder="e.g., Sarah"
          value={answers.customerName}
          onChange={e => onNameChange(e.target.value)}
          style={{ maxWidth: '20rem' }}
        />
        <span className="bakery-name-note">Used only to personalize the email greeting — not stored or sent by this tool.</span>
      </div>

      {/* Primary email CTA */}
      <div className="bakery-email-cta no-print">
        <a
          href={mailtoHref}
          className="bakery-email-btn"
          title="Opens your email app with your order brief pre-filled"
        >
          Email the Bakery →
        </a>
      </div>

      {/* Brief sections */}
      <div className="result-sections">
        <BriefSection
          title="What You're Ordering"
          rows={[
            { label: 'Product',  value: answers.productType ? PRODUCT_TYPE_LABELS[answers.productType] : '' },
            { label: 'Occasion', value: answers.occasion    ? OCCASION_LABELS[answers.occasion]        : '' },
            { label: 'For',      value: answers.recipient   ? RECIPIENT_LABELS[answers.recipient]      : '' },
          ]}
        />

        <BriefSection
          title="Personalization & Design"
          rows={[
            { label: 'Inscription',    value: inscriptionValue },
            { label: 'Colors',         value: colorValue },
            { label: 'Style / theme',  value: answers.styleTheme.trim() },
            { label: 'Size & quantity',value: answers.sizeQuantity.trim() },
          ]}
        />

        <BriefSection
          title="Timing & Logistics"
          rows={[
            { label: 'Needed by',   value: answers.neededByDate ? formatBriefDate(answers.neededByDate) : '' },
            { label: 'Timing note', value: answers.timingNote.trim() },
            {
              label: 'Budget',
              value: answers.budget && answers.budget !== 'prefer_not_say' ? BUDGET_LABELS[answers.budget] : '',
            },
            { label: 'Dietary / allergy notes', value: answers.dietaryRestrictions.trim() },
          ]}
        />

        {answers.questionsForBaker.trim() && (
          <div className="result-section">
            <div className="result-section-header">
              <p className="result-section-title">Questions for the Baker</p>
            </div>
            <div className="result-items" style={{ padding: '0.875rem 1.25rem' }}>
              <p style={{ fontSize: '0.9375rem', color: 'var(--color-text)', whiteSpace: 'pre-wrap', margin: 0, lineHeight: '1.65' }}>
                {answers.questionsForBaker.trim()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dietary disclaimer */}
      {answers.dietaryRestrictions.trim() && (
        <p className="bakery-dietary-disclaimer" role="note">
          Dietary and allergy information must be confirmed directly with the bakery. Completing this planner does not guarantee allergen-free preparation or accommodation.
        </p>
      )}

      {/* Action bar */}
      <div className="result-actions no-print">
        <button type="button" className="result-action-btn" onClick={handleCopy}>
          Copy Brief
        </button>
        {canShare && (
          <button type="button" className="result-action-btn" onClick={handleShare}>
            Share Brief
          </button>
        )}
        <button type="button" className="result-action-btn" onClick={() => window.print()}>
          Print Brief
        </button>
        <button type="button" className="result-action-btn" onClick={onEditAnswers}>
          Edit Answers
        </button>
        <button type="button" className="result-action-btn result-action-btn--ghost" onClick={onStartOver}>
          Start Over
        </button>
        {!canShare && (
          <p className="result-share-hint">
            To share your brief, choose Copy Brief and paste it into a message.
          </p>
        )}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`result-copy-status${isSuccess ? ' success' : isError ? ' failed' : ''}`}
        >
          {copyStatus === 'copied'      && 'Brief copied to clipboard.'}
          {copyStatus === 'failed'      && "Copy failed — use your device's select-all and copy instead."}
          {copyStatus === 'share-error' && 'Sharing failed. Use Copy Brief to copy and share manually.'}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="tool-disclaimer" role="note">
        <p>
          This order brief is a planning aid to help you organize your request before contacting a
          bakery. It does not constitute an order, booking, quote, or contract. All details —
          including availability, pricing, allergen handling, and production timelines — must be
          confirmed directly with the bakery.
        </p>
        <p>
          Interactive demo by{' '}
          <a href="https://websitesbyleslie.com" target="_blank" rel="noopener noreferrer">
            Websites by Leslie
          </a>
        </p>
      </div>

      {/* Websites by Leslie CTA */}
      <div className="tool-sales-cta no-print" aria-label="For custom-order businesses">
        <p className="tool-sales-cta-eyebrow">For custom-order businesses</p>
        <h2 className="tool-sales-cta-heading">
          Want an order planner like this for your business?
        </h2>
        <p className="tool-sales-cta-body">
          I can customize this experience around your products, ordering process, and brand —
          giving customers a clearer way to prepare before they contact you.
        </p>
        <ul className="tool-sales-cta-features" aria-label="What can be customized">
          <li>Your products, occasions, and ordering details</li>
          <li>Your colors, fonts, and brand voice</li>
          <li>Order inquiries delivered to your inbox</li>
          <li>Added to your existing website or built as a standalone page</li>
        </ul>
        <a
          href="mailto:websitesbyleslie01@gmail.com?subject=Custom%20order%20planner%20inquiry"
          className="tool-sales-cta-link"
          title="Opens your email application to contact Websites by Leslie"
        >
          Ask About a Custom Planner →
        </a>
      </div>
    </div>
  )
}
