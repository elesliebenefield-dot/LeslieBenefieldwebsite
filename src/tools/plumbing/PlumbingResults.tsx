import { Fragment, useState } from 'react'
import { buildMailtoHref } from '../core/buildMailtoHref'
import { buildVisitBriefText, buildMailtoSubject } from './plumbingSummary'
import type { PlumbingAnswers } from './plumbingTypes'
import {
  CONCERN_LABELS,
  ACTIVE_WATER_LABELS,
  HOME_AREA_LABELS,
  TIMELINE_LABELS,
  CHANGE_LABELS,
  HISTORY_LABELS,
  WATER_ELSEWHERE_LABELS,
  PROPERTY_LABELS,
  ACCESS_LABELS,
  RECENT_WORK_LABELS,
  TIMING_LABELS,
} from './plumbingTypes'

interface Props {
  answers: PlumbingAnswers
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

export function PlumbingResults({ answers, onEditAnswers, onStartOver, onNameChange }: Props) {
  const [copyStatus, setCopyStatus] = useState<'' | 'copied' | 'failed' | 'share-error'>('')
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const briefText  = buildVisitBriefText(answers)
  const subject    = buildMailtoSubject(answers)
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
      await navigator.share({ title: 'My Plumbing Service Visit Brief', text: briefText })
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setCopyStatus('share-error')
        setTimeout(() => setCopyStatus(''), 6000)
      }
    }
  }

  const recentWorkValue = answers.recentWork
    ? RECENT_WORK_LABELS[answers.recentWork as Exclude<typeof answers.recentWork, ''>]
      + (answers.recentWork === 'yes' && answers.recentWorkDetail.trim()
        ? ` — ${answers.recentWorkDetail.trim()}`
        : '')
    : ''

  const isSuccess = copyStatus === 'copied'
  const isError   = copyStatus === 'failed' || copyStatus === 'share-error'

  return (
    <div>
      <div className="tool-results-header">
        <h1 className="tool-results-title">Your Service Visit Brief</h1>
        <p className="tool-results-subtitle">
          Review your brief below. When you're ready, copy it, print it, or click{' '}
          <strong>Email the Plumber</strong> to open a pre-filled message in your email app.
        </p>
      </div>

      <div className="plumbing-name-row no-print">
        <label htmlFor="customerName" className="plumbing-name-label">
          Your name <span className="tool-question-optional">(optional)</span>
        </label>
        <input
          id="customerName"
          type="text"
          className="tool-input"
          placeholder="e.g., Karen"
          value={answers.customerName}
          onChange={e => onNameChange(e.target.value)}
          style={{ maxWidth: '20rem' }}
        />
        <span className="plumbing-name-note">Used only to personalize the email greeting — not stored or sent by this tool.</span>
      </div>

      <div className="plumbing-email-cta no-print">
        <a
          href={mailtoHref}
          className="plumbing-email-btn"
          title="Opens your email app with your service visit brief pre-filled"
        >
          Email the Plumber →
        </a>
      </div>

      <div className="result-sections">
        <BriefSection
          title="The Concern"
          rows={[
            { label: 'Type of concern',   value: answers.concernType ? CONCERN_LABELS[answers.concernType as Exclude<typeof answers.concernType, ''>] : '' },
            { label: 'What I observed',   value: answers.observations.trim() },
            { label: 'Active water',      value: answers.activeWater ? ACTIVE_WATER_LABELS[answers.activeWater as Exclude<typeof answers.activeWater, ''>] : '' },
            { label: '⚠ Active water noted', value: answers.activeWater === 'flowing_spreading' ? 'Water was actively flowing or spreading at the time this brief was prepared.' : '' },
          ]}
        />

        <BriefSection
          title="Location & History"
          rows={[
            { label: 'Area of home',              value: answers.homeArea      ? HOME_AREA_LABELS[answers.homeArea as Exclude<typeof answers.homeArea, ''>]             : '' },
            { label: 'Fixture or area',           value: answers.fixture.trim() },
            { label: 'First noticed',             value: answers.firstNoticed  ? TIMELINE_LABELS[answers.firstNoticed as Exclude<typeof answers.firstNoticed, ''>]       : '' },
            { label: 'Change since then',         value: answers.changeAnswer  ? CHANGE_LABELS[answers.changeAnswer as Exclude<typeof answers.changeAnswer, ''>]         : '' },
            { label: 'Previous occurrence',       value: answers.history       ? HISTORY_LABELS[answers.history as Exclude<typeof answers.history, ''>]                  : '' },
            { label: 'Water available elsewhere', value: answers.waterElsewhere ? WATER_ELSEWHERE_LABELS[answers.waterElsewhere as Exclude<typeof answers.waterElsewhere, ''>] : '' },
          ]}
        />

        <BriefSection
          title="Property & Access"
          rows={[
            { label: 'Property type',        value: answers.propertyType ? PROPERTY_LABELS[answers.propertyType as Exclude<typeof answers.propertyType, ''>] : '' },
            { label: 'Access',               value: answers.accessAnswer ? ACCESS_LABELS[answers.accessAnswer as Exclude<typeof answers.accessAnswer, ''>]   : '' },
            { label: 'Access notes',         value: answers.accessNotes.trim() },
            { label: 'Recent plumbing work', value: recentWorkValue },
          ]}
        />

        <BriefSection
          title="The Visit"
          rows={[
            { label: 'Preferred timing',           value: answers.timing    ? TIMING_LABELS[answers.timing as Exclude<typeof answers.timing, ''>] : '' },
            { label: 'Questions for the plumber',  value: answers.questions.trim() },
          ]}
        />
      </div>

      <div className="result-actions no-print">
        <button type="button" className="tool-action-btn" onClick={handleCopy}>
          Copy Brief
        </button>
        {canShare && (
          <button type="button" className="tool-action-btn" onClick={handleShare}>
            Share Brief
          </button>
        )}
        <button type="button" className="tool-action-btn" onClick={() => window.print()}>
          Print Brief
        </button>
        <button type="button" className="tool-action-btn" onClick={onEditAnswers}>
          Edit Answers
        </button>
        <button type="button" className="tool-action-btn" onClick={onStartOver}>
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

      <div className="tool-disclaimer" role="note">
        <p>
          This brief summarizes what you've observed. It is not a plumbing diagnosis, repair
          estimate, or confirmed service request. Contact your plumber directly to discuss
          availability, scheduling, and next steps.
        </p>
        <p>
          Interactive demo by{' '}
          <a href="https://websitesbyleslie.com" target="_blank" rel="noopener noreferrer">
            Websites by Leslie
          </a>
        </p>
      </div>

      <div className="tool-sales-cta no-print" aria-label="For plumbing and service businesses">
        <p className="tool-sales-cta-eyebrow">For plumbing and service businesses</p>
        <h2 className="tool-sales-cta-heading">
          Want a service visit planner like this for your business?
        </h2>
        <p className="tool-sales-cta-body">
          I can customize this experience around your services, customer questions, and
          brand—helping customers prepare useful information before they contact you. Automatic
          inquiry delivery and integrations can be quoted separately.
        </p>
        <ul className="tool-sales-cta-features" aria-label="What can be customized">
          <li>Your service types, customer questions, and intake fields</li>
          <li>Your colors, fonts, and brand voice</li>
          <li>Customers prepare a service request and send it to you from their own email app</li>
          <li>Hosted as a standalone page your website provider can link to, or built into a new Websites by Leslie project</li>
        </ul>
        <a
          href="mailto:websitesbyleslie01@gmail.com?subject=Plumbing%20Service%20Visit%20Inquiry"
          className="tool-sales-cta-link"
          title="Opens your email application to contact Websites by Leslie"
        >
          Ask About a Custom Planner →
        </a>
      </div>
    </div>
  )
}
