import { Fragment, useState } from 'react'
import { buildMailtoHref } from '../core/buildMailtoHref'
import { buildInquiryBriefText, buildMailtoSubject } from './foodTruckSummary'
import type { FoodTruckAnswers, EventType, PublicPrivate, AttendanceRange, ServiceWindow, SettingType, PaymentArrangement, BudgetRange, SetupSpaceType, VehicleAccess, SurfaceType, UtilityAnswer, SetupTime } from './foodTruckTypes'
import {
  EVENT_TYPE_LABELS,
  PUBLIC_PRIVATE_LABELS,
  ATTENDANCE_LABELS,
  SERVICE_WINDOW_LABELS,
  SETTING_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  PAYMENT_LABELS,
  BUDGET_LABELS,
  SETUP_SPACE_LABELS,
  VEHICLE_ACCESS_LABELS,
  SURFACE_TYPE_LABELS,
  UTILITY_LABELS,
  SETUP_TIME_LABELS,
} from './foodTruckTypes'

interface Props {
  answers: FoodTruckAnswers
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

function formatDate(dateString: string): string {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function lbl<T extends string>(map: Record<Exclude<T, ''>, string>, value: T): string {
  return value ? (map as Record<string, string>)[value] ?? '' : ''
}

export function FoodTruckResults({ answers, onEditAnswers, onStartOver, onNameChange }: Props) {
  const [copyStatus, setCopyStatus] = useState<'' | 'copied' | 'failed' | 'share-error'>('')
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const briefText  = buildInquiryBriefText(answers)
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
      await navigator.share({ title: 'My Food Truck Event Inquiry Brief', text: briefText })
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setCopyStatus('share-error')
        setTimeout(() => setCopyStatus(''), 6000)
      }
    }
  }

  const isSuccess = copyStatus === 'copied'
  const isError   = copyStatus === 'failed' || copyStatus === 'share-error'

  // Event date display
  const eventDateValue = answers.eventDateStatus === 'confirmed' && answers.eventDate
    ? formatDate(answers.eventDate)
    : answers.eventDateStatus === 'tbd'
      ? 'Date not yet confirmed'
      : ''

  // Service types — joined labels
  const serviceTypesValue = answers.serviceTypes.length > 0
    ? answers.serviceTypes.map(t => SERVICE_TYPE_LABELS[t]).join(', ')
    : ''

  // Budget — suppress "Prefer not to say"
  const budgetValue = answers.budget && answers.budget !== 'prefer_not_say'
    ? lbl<BudgetRange>(BUDGET_LABELS, answers.budget)
    : ''

  return (
    <div>
      <div className="tool-results-header">
        <h1 className="tool-results-title">Your Event Service Inquiry Brief</h1>
        <p className="tool-results-subtitle">
          Review your brief below. When you're ready, copy it, print it, or click{' '}
          <strong>Email the Vendor</strong> to open a pre-filled message in your email app.
        </p>
      </div>

      <div className="food-truck-name-row no-print">
        <label htmlFor="organizerName" className="food-truck-name-label">
          Your name <span className="tool-question-optional">(optional)</span>
        </label>
        <input
          id="organizerName"
          type="text"
          className="tool-input"
          placeholder="e.g., Jordan"
          value={answers.organizerName}
          onChange={e => onNameChange(e.target.value)}
          style={{ maxWidth: '20rem' }}
        />
        <span className="food-truck-name-note">Used only to personalize the email greeting — not stored or sent by this tool.</span>
      </div>

      <div className="food-truck-email-cta no-print">
        <a
          href={mailtoHref}
          className="food-truck-email-btn"
          title="Opens your email app with your event service inquiry brief pre-filled"
        >
          Email the Vendor →
        </a>
      </div>

      <div className="result-sections">
        <BriefSection
          title="The Event"
          rows={[
            { label: 'Event type',        value: lbl<EventType>(EVENT_TYPE_LABELS, answers.eventType) },
            { label: 'Event date',        value: eventDateValue },
            { label: 'Date notes',        value: answers.dateNotes.trim() },
            { label: 'Location or venue', value: answers.venueName.trim() },
            { label: 'Event status',      value: lbl<PublicPrivate>(PUBLIC_PRIVATE_LABELS, answers.isPublic) },
            { label: 'Attendance',        value: lbl<AttendanceRange>(ATTENDANCE_LABELS, answers.attendance) },
            { label: 'Service window',    value: lbl<ServiceWindow>(SERVICE_WINDOW_LABELS, answers.serviceWindow) },
            { label: 'Service hours',     value: answers.specificHours.trim() },
            { label: 'Setting',           value: lbl<SettingType>(SETTING_TYPE_LABELS, answers.settingType) },
          ]}
        />

        <BriefSection
          title="Service Requested"
          rows={[
            { label: 'Service type',         value: serviceTypesValue },
            { label: 'Additional interests', value: answers.additionalInterests.trim() },
            { label: 'Payment arrangement',  value: lbl<PaymentArrangement>(PAYMENT_LABELS, answers.paymentArrangement) },
            { label: 'Guests to be served',  value: answers.guestsServed.trim() },
            { label: 'Budget',               value: budgetValue },
            { label: 'Dietary notes',        value: answers.dietaryNotes.trim() },
          ]}
        />

        <BriefSection
          title="Venue & Logistics"
          rows={[
            { label: 'Setup space',        value: lbl<SetupSpaceType>(SETUP_SPACE_LABELS, answers.setupSpace) },
            { label: 'Vehicle access',     value: lbl<VehicleAccess>(VEHICLE_ACCESS_LABELS, answers.vehicleAccess) },
            { label: 'Surface type',       value: lbl<SurfaceType>(SURFACE_TYPE_LABELS, answers.surfaceType) },
            { label: 'Electricity',        value: lbl<UtilityAnswer>(UTILITY_LABELS, answers.electricity) },
            { label: 'Water access',       value: lbl<UtilityAnswer>(UTILITY_LABELS, answers.waterAccess) },
            { label: 'Venue restrictions', value: answers.venueRestrictions.trim() },
            { label: 'Day-of contact',     value: answers.dayOfContact.trim() },
            { label: 'Setup & breakdown',  value: lbl<SetupTime>(SETUP_TIME_LABELS, answers.setupBreakdown) },
          ]}
        />

        <BriefSection
          title="Questions for the Vendor"
          rows={[
            { label: 'Questions', value: answers.questions.trim() },
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
          This brief summarizes information prepared by the event organizer. It does not confirm
          availability or reserve the date, guarantee menu items or service capacity, establish
          pricing, confirm venue suitability, or confirm permits, licenses, utilities, or other
          event requirements. Contact Your Mobile Food Business directly to discuss the details
          of your event.
        </p>
        <p>
          Interactive demo by{' '}
          <a href="https://websitesbyleslie.com" target="_blank" rel="noopener noreferrer">
            Websites by Leslie
          </a>
        </p>
      </div>

      <div className="tool-sales-cta no-print" aria-label="For mobile food and beverage businesses">
        <p className="tool-sales-cta-eyebrow">For mobile food and beverage businesses</p>
        <h2 className="tool-sales-cta-heading">
          Want an event inquiry planner like this for your business?
        </h2>
        <p className="tool-sales-cta-body">
          A guided inquiry tool can help customers share the details you need before the first
          conversation. Websites by Leslie can customize the branding, questions, and workflow
          for your business.
        </p>
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
