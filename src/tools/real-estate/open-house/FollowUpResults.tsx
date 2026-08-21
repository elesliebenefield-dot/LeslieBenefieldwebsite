import { useRef, useState } from 'react'
import { ConfirmDialog } from '../../core/components/ConfirmDialog'
import type { EventSetup, EventOutcomes, FollowUpAction } from './openHouseTypes'
import {
  ATTENDANCE_LABELS,
  VISITOR_CONTEXT_LABELS,
  PERMISSION_LABELS,
  CONTACT_METHOD_LABELS,
  ACTION_CATEGORY_LABELS,
  ACTION_TIMING_LABELS,
  ACTION_STATUS_LABELS,
} from './openHouseTypes'
import { buildFollowUpSummary } from './followUpSummary'

interface Props {
  setup: EventSetup
  outcomes: EventOutcomes
  actions: FollowUpAction[]
  onStartOver: () => void
  onBack: () => void
}

function formatDate(d: string): string {
  if (!d) return ''
  const parts = d.split('-').map(Number)
  if (parts.length !== 3) return d
  const dt = new Date(parts[0], parts[1] - 1, parts[2])
  return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

interface ActionGroupProps {
  title: string
  items: FollowUpAction[]
  outcomes: EventOutcomes
}

function ActionGroup({ title, items, outcomes }: ActionGroupProps) {
  if (items.length === 0) return null
  return (
    <div className="oh-result-action-group">
      <h4 className="oh-result-period-heading">{title}</h4>
      <ul className="oh-result-action-list">
        {items.map(a => {
          const scopeLabel = a.scope === 'event_wide'
            ? null
            : (() => {
                const vis = outcomes.visitors.find(v => v.id === a.scope)
                return vis ? (vis.label || 'Visitor (no label)') : null
              })()
          return (
            <li key={a.id} className="oh-result-action-item" data-action-result-id={a.id}>
              <div className="oh-result-action-label">{a.label}</div>
              <div className="oh-result-action-meta">
                <span className="oh-result-meta-tag">{ACTION_CATEGORY_LABELS[a.category]}</span>
                {scopeLabel && <span className="oh-result-meta-tag oh-result-meta-tag--visitor">Visitor: {scopeLabel}</span>}
                <span className={`oh-result-meta-tag oh-result-status oh-result-status--${a.status}`}>
                  {ACTION_STATUS_LABELS[a.status]}
                </span>
                {a.needsBrokerInput && (
                  <span className="oh-result-meta-tag oh-result-meta-tag--broker">Broker input needed</span>
                )}
              </div>
              {a.responsible && <div className="oh-result-action-detail">Responsible: {a.responsible}</div>}
              {a.channel && <div className="oh-result-action-detail">Channel: {a.channel}</div>}
              {a.targetDate && <div className="oh-result-action-detail">Target date: {formatDate(a.targetDate)}</div>}
              {a.notes && <div className="oh-result-action-detail">Notes: {a.notes}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const TIMING_ORDER = ['today', 'next_business_day', 'this_week', 'later', 'no_date'] as const

export function FollowUpResults({ setup, outcomes, actions, onStartOver, onBack }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const eligibleVisitors = outcomes.visitors.filter(v => v.permission !== 'declined')
  const declinedVisitors = outcomes.visitors.filter(v => v.permission === 'declined')
  const unknownVisitors  = outcomes.visitors.filter(v => v.permission === 'unknown')

  const completedActions = actions.filter(a => a.status === 'complete')
  const inProgressActions = actions.filter(a => a.status === 'in_progress')
  const waitingActions = actions.filter(a => a.status === 'waiting')
  const notStartedActions = actions.filter(a => a.status === 'not_started')
  const brokerInputActions = actions.filter(a => a.needsBrokerInput)

  const actionsByTiming = TIMING_ORDER.map(t => ({
    key: t,
    label: ACTION_TIMING_LABELS[t],
    items: actions.filter(a => a.timing === t),
  }))

  async function handleCopy() {
    const text = buildFollowUpSummary(setup, outcomes, actions)
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2500)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 3000)
    }
  }

  function handleShare() {
    const text = buildFollowUpSummary(setup, outcomes, actions)
    const title = `Open House Follow-Up: ${setup.propertyLabel || 'Event'}`
    if (navigator.share) {
      navigator.share({ title, text }).catch(() => {})
    }
  }

  function handlePrint() {
    window.print()
  }

  const timeRange = [formatTime(setup.startTime), formatTime(setup.endTime)].filter(Boolean).join(' – ')
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <div className="oh-results" ref={printRef}>

      {/* ── Event overview ─────────────────────────────────────── */}
      <section className="oh-result-section">
        <h2 className="oh-result-section-heading">Event overview</h2>
        <dl className="oh-result-dl">
          <dt>Property</dt>
          <dd>{setup.propertyLabel || <em>Not recorded</em>}</dd>
          <dt>Date</dt>
          <dd>{setup.date ? formatDate(setup.date) : <em>Not recorded</em>}</dd>
          {timeRange && <><dt>Time</dt><dd>{timeRange}</dd></>}
          {setup.hostingAgent && <><dt>Hosting agent</dt><dd>{setup.hostingAgent}</dd></>}
          {setup.estimatedAttendance && <><dt>Estimated attendance</dt><dd>{setup.estimatedAttendance}</dd></>}
          {outcomes.attendanceOutcome && (
            <><dt>Attendance outcome</dt><dd>{ATTENDANCE_LABELS[outcomes.attendanceOutcome]}</dd></>
          )}
          {setup.sellerUpdateNeeded === 'yes' && (
            <><dt>Seller update</dt><dd>Needed</dd></>
          )}
          {setup.eventNotes && <><dt>Event notes</dt><dd>{setup.eventNotes}</dd></>}
        </dl>
      </section>

      {/* ── Event outcomes ─────────────────────────────────────── */}
      {(outcomes.feedbackThemes || outcomes.commonQuestions || outcomes.concernsForReview || outcomes.marketingObservations || outcomes.planningNotes) && (
        <section className="oh-result-section">
          <h2 className="oh-result-section-heading">Event outcomes</h2>
          {outcomes.feedbackThemes && (
            <div className="oh-result-field">
              <h3 className="oh-result-field-label">Property-feedback themes</h3>
              <p>{outcomes.feedbackThemes}</p>
            </div>
          )}
          {outcomes.commonQuestions && (
            <div className="oh-result-field">
              <h3 className="oh-result-field-label">Common questions</h3>
              <p>{outcomes.commonQuestions}</p>
            </div>
          )}
          {outcomes.concernsForReview && (
            <div className="oh-result-field">
              <h3 className="oh-result-field-label">Concerns for professional review</h3>
              <p>{outcomes.concernsForReview}</p>
            </div>
          )}
          {outcomes.marketingObservations && (
            <div className="oh-result-field">
              <h3 className="oh-result-field-label">Marketing & signage observations</h3>
              <p>{outcomes.marketingObservations}</p>
            </div>
          )}
          {outcomes.planningNotes && (
            <div className="oh-result-field">
              <h3 className="oh-result-field-label">Planning notes</h3>
              <p>{outcomes.planningNotes}</p>
            </div>
          )}
        </section>
      )}

      {/* ── Visitor summary ─────────────────────────────────────── */}
      {outcomes.visitors.length > 0 && (
        <section className="oh-result-section">
          <h2 className="oh-result-section-heading">Visitor follow-up records</h2>

          <div className="oh-result-visitor-totals">
            <span className="oh-result-total-badge">{outcomes.visitors.length} total</span>
            {eligibleVisitors.length > 0 && (
              <span className="oh-result-total-badge oh-result-total-badge--eligible">
                {eligibleVisitors.length} eligible for planning
              </span>
            )}
            {declinedVisitors.length > 0 && (
              <span className="oh-result-total-badge oh-result-total-badge--declined">
                {declinedVisitors.length} declined — no outreach
              </span>
            )}
            {unknownVisitors.length > 0 && (
              <span className="oh-result-total-badge oh-result-total-badge--unknown">
                {unknownVisitors.length} permission unknown
              </span>
            )}
          </div>

          {declinedVisitors.length > 0 && (
            <div className="oh-declined-summary" role="note">
              {declinedVisitors.length === 1
                ? 'One visitor record has Declined permission.'
                : `${declinedVisitors.length} visitor records have Declined permission.`}{' '}
              These records are not shown below and no outreach should be planned for them.
            </div>
          )}

          {unknownVisitors.length > 0 && (
            <div className="oh-unknown-summary" role="note">
              {unknownVisitors.length === 1
                ? 'One visitor record has Unknown permission.'
                : `${unknownVisitors.length} visitor records have Unknown permission.`}{' '}
              Confirm applicable requirements and brokerage policies before any outreach.
            </div>
          )}

          {eligibleVisitors.length > 0 && (
            <div className="oh-result-visitor-list">
              {eligibleVisitors.map((v) => (
                <div key={v.id} className="oh-result-visitor-card" data-visitor-result-id={v.id}>
                  <div className="oh-result-visitor-header">
                    {v.label || `Record ${outcomes.visitors.indexOf(v) + 1}`}
                    {v.permission && (
                      <span className={`oh-result-permission oh-result-permission--${v.permission}`}>
                        {PERMISSION_LABELS[v.permission]}
                      </span>
                    )}
                  </div>
                  <dl className="oh-result-visitor-dl">
                    {v.context && <><dt>Context</dt><dd>{VISITOR_CONTEXT_LABELS[v.context]}</dd></>}
                    {v.contactMethod && <><dt>Contact method</dt><dd>{CONTACT_METHOD_LABELS[v.contactMethod]}</dd></>}
                    {v.requested && <><dt>Requested</dt><dd>{v.requested}</dd></>}
                    {v.questions && <><dt>Questions to answer</dt><dd>{v.questions}</dd></>}
                    {v.feedback && <><dt>Property feedback</dt><dd>{v.feedback}</dd></>}
                    {v.notes && <><dt>Notes</dt><dd>{v.notes}</dd></>}
                  </dl>
                </div>
              ))}
            </div>
          )}

          {eligibleVisitors.length === 0 && outcomes.visitors.length > 0 && (
            <p className="oh-result-no-eligible">
              All visitor records have Declined permission. No visitor outreach is indicated.
            </p>
          )}
        </section>
      )}

      {/* ── Follow-up plan ─────────────────────────────────────── */}
      {actions.length > 0 && (
        <section className="oh-result-section">
          <h2 className="oh-result-section-heading">Follow-up plan</h2>

          {/* Status totals */}
          <div className="oh-result-status-row">
            <span className="oh-result-status-badge oh-result-status-badge--total">
              {actions.length} action{actions.length !== 1 ? 's' : ''}
            </span>
            {completedActions.length > 0 && (
              <span className="oh-result-status-badge oh-result-status-badge--complete">
                {completedActions.length} complete
              </span>
            )}
            {inProgressActions.length > 0 && (
              <span className="oh-result-status-badge oh-result-status-badge--in-progress">
                {inProgressActions.length} in progress
              </span>
            )}
            {waitingActions.length > 0 && (
              <span className="oh-result-status-badge oh-result-status-badge--waiting">
                {waitingActions.length} waiting
              </span>
            )}
            {notStartedActions.length > 0 && (
              <span className="oh-result-status-badge oh-result-status-badge--not-started">
                {notStartedActions.length} not started
              </span>
            )}
          </div>

          {/* Broker input callout */}
          {brokerInputActions.length > 0 && (
            <div className="oh-result-broker-callout" role="note">
              <strong>Broker or brokerage input needed:</strong>
              <ul className="oh-result-broker-list">
                {brokerInputActions.map(a => <li key={a.id}>{a.label}</li>)}
              </ul>
            </div>
          )}

          {/* Actions by timing period */}
          {actionsByTiming.map(({ key, label, items }) => (
            <ActionGroup key={key} title={label} items={items} outcomes={outcomes} />
          ))}
        </section>
      )}

      {/* ── Missing information ─────────────────────────────────── */}
      {(() => {
        const missing: string[] = []
        if (!setup.propertyLabel) missing.push('Property label')
        if (!setup.date) missing.push('Open house date')
        if (!outcomes.attendanceOutcome) missing.push('Attendance outcome')
        if (missing.length === 0) return null
        return (
          <section className="oh-result-section">
            <h2 className="oh-result-section-heading">Missing information</h2>
            <p className="oh-result-missing-intro">
              The following fields were left blank. This is noted for reference only — the plan is complete as entered.
            </p>
            <ul className="oh-result-missing-list">
              {missing.map(m => <li key={m}>{m}</li>)}
            </ul>
          </section>
        )
      })()}

      {/* ── Footer: disclaimer + single action bar ─────────────── */}
      <div className="oh-results-footer">
        <p className="oh-results-disclaimer">
          This planner is a session-only workspace. Nothing entered here has been saved, stored,
          or transmitted. Consult your brokerage policies and applicable regulations before taking
          any action based on this plan.
        </p>

        <div className="oh-results-actions">
          <button
            type="button"
            className="tool-action-btn"
            onClick={handleCopy}
            aria-live="polite"
          >
            {copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy Follow-Up Plan'}
          </button>
          {canShare && (
            <button type="button" className="tool-action-btn" onClick={handleShare}>
              Share Follow-Up Plan
            </button>
          )}
          <button type="button" className="tool-action-btn oh-print-btn" onClick={handlePrint}>
            Print Follow-Up Plan
          </button>
          <button type="button" className="tool-action-btn" onClick={onBack}>
            Review / Edit
          </button>
          <button type="button" className="tool-action-btn" onClick={() => setShowStartOverConfirm(true)}>
            Start Over
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showStartOverConfirm}
        title="Start over?"
        body="This will clear all entered information. Your plan cannot be recovered."
        confirmLabel="Start over"
        cancelLabel="Keep results"
        onConfirm={() => { setShowStartOverConfirm(false); onStartOver() }}
        onCancel={() => setShowStartOverConfirm(false)}
      />
    </div>
  )
}
