import { useState } from 'react'
import { ConfirmDialog } from '../../core/components/ConfirmDialog'
import type { TransitionSetup, ClosingTask, PlanningPeriod, TaskTrack } from './closingTypes'
import {
  TRANSITION_TYPE_LABELS,
  INVOLVED_PARTY_LABELS,
  MOVING_METHOD_LABELS,
  TASK_TRACK_LABELS,
  TASK_STATUS_LABELS,
  PROFESSIONAL_TYPE_LABELS,
  PLANNING_PERIOD_LABELS,
  PLANNING_PERIOD_ORDER,
} from './closingTypes'
import { buildClosingSummary } from './closingSummary'

interface Props {
  setup: TransitionSetup
  tasks: ClosingTask[]
  onBack: () => void
  onStartOver: () => void
}

function formatDate(d: string): string {
  if (!d) return ''
  const parts = d.split('-').map(Number)
  if (parts.length !== 3) return d
  const dt = new Date(parts[0], parts[1] - 1, parts[2])
  return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

interface TaskGroupProps {
  period: PlanningPeriod
  tasks: ClosingTask[]
  leavingLabel: string
  arrivingLabel: string
}

function TaskGroup({ period, tasks, leavingLabel, arrivingLabel }: TaskGroupProps) {
  if (tasks.length === 0) return null

  function trackDisplay(track: TaskTrack): string {
    if (track === 'leaving' && leavingLabel) return `Leaving – ${leavingLabel}`
    if (track === 'arriving' && arrivingLabel) return `Arriving – ${arrivingLabel}`
    return TASK_TRACK_LABELS[track]
  }

  return (
    <div className="cm-result-period-group">
      <h3 className="cm-result-period-heading">{PLANNING_PERIOD_LABELS[period]}</h3>
      <ul className="cm-result-task-list">
        {tasks.map(task => (
          <li key={task.id} className="cm-result-task-item" data-task-result-id={task.id}>
            <div className="cm-result-task-label">{task.label}</div>
            <div className="cm-result-task-meta">
              <span className="cm-result-meta-tag">{trackDisplay(task.track)}</span>
              <span className={`cm-result-status cm-result-status--${task.status}`}>
                {TASK_STATUS_LABELS[task.status]}
              </span>
              {task.needsProfessionalConfirmation && (
                <span className="cm-result-meta-tag cm-result-meta-tag--confirm">Needs professional confirmation</span>
              )}
            </div>
            {task.responsible && (
              <div className="cm-result-task-detail">Responsible: {task.responsible}</div>
            )}
            {task.targetDate && (
              <div className="cm-result-task-detail">Target date: {formatDate(task.targetDate)} <em className="cm-planning-date-note">(planning date)</em></div>
            )}
            {task.waitingOn && (
              <div className="cm-result-task-detail cm-result-task-detail--waiting">Waiting on: {task.waitingOn}</div>
            )}
            {task.notes && (
              <div className="cm-result-task-detail">Notes: {task.notes}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ClosingResults({ setup, tasks, onBack, onStartOver }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false)

  const regularTasks = tasks.filter(t => !t.isQuestion)
  const questionTasks = tasks.filter(t => t.isQuestion)

  const completedCount    = tasks.filter(t => t.status === 'complete').length
  const inProgressCount   = tasks.filter(t => t.status === 'in_progress').length
  const waitingCount      = tasks.filter(t => t.status === 'waiting').length
  const notStartedCount   = tasks.filter(t => t.status === 'not_started').length
  const notApplicableCount = tasks.filter(t => t.status === 'not_applicable').length

  const confirmTasks = tasks.filter(t => t.needsProfessionalConfirmation && !t.isQuestion)
  const waitingTasks = tasks.filter(t => t.waitingOn.trim())

  // Determine which track labels are present in regular tasks
  const presentTracks = new Set(regularTasks.map(t => t.track))

  // Missing-detail items
  const missingDetails: string[] = []
  const unassigned = regularTasks.filter(t => !t.responsible).length
  const unscheduled = regularTasks.filter(t => t.period === 'no_timing').length
  if (unassigned > 0) missingDetails.push(`${unassigned} task${unassigned !== 1 ? 's' : ''} without a responsible person`)
  if (unscheduled > 0) missingDetails.push(`${unscheduled} task${unscheduled !== 1 ? 's' : ''} without a planning period`)

  const { leavingPropertyLabel, arrivingPropertyLabel } = setup

  const hasAnyDates = Object.values(setup.dates).some(d => d)
  const hasLeaving = presentTracks.has('leaving')
  const hasArriving = presentTracks.has('arriving')

  async function handleCopy() {
    const text = buildClosingSummary(setup, tasks)
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
    const text = buildClosingSummary(setup, tasks)
    const title = setup.planName
      ? `Closing & Moving Plan – ${setup.planName}`
      : 'Closing & Moving Plan'
    if (navigator.share) {
      navigator.share({ title, text }).catch(() => {})
    }
  }

  function handlePrint() {
    window.print()
  }

  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <div className="cm-results">

      {/* ── Transition overview ─────────────────────────────── */}
      <section className="cm-result-section">
        <h2 className="cm-result-section-heading">Transition overview</h2>
        <dl className="cm-result-dl">
          {setup.transitionType && (
            <><dt>Transition type</dt><dd>{TRANSITION_TYPE_LABELS[setup.transitionType]}</dd></>
          )}
          {setup.planName && (
            <><dt>Plan name</dt><dd>{setup.planName}</dd></>
          )}
          {(hasLeaving || setup.leavingPropertyLabel) && setup.leavingPropertyLabel && (
            <><dt>Leaving property</dt><dd>{setup.leavingPropertyLabel}</dd></>
          )}
          {(hasArriving || setup.arrivingPropertyLabel) && setup.arrivingPropertyLabel && (
            <><dt>Arriving property</dt><dd>{setup.arrivingPropertyLabel}</dd></>
          )}
          {setup.involvedParties.length > 0 && (
            <><dt>Involved</dt><dd>{setup.involvedParties.map(p => INVOLVED_PARTY_LABELS[p]).join(', ')}</dd></>
          )}
          {setup.movingMethod && (
            <><dt>Moving method</dt><dd>{MOVING_METHOD_LABELS[setup.movingMethod]}</dd></>
          )}
          {setup.notes && (
            <><dt>Notes</dt><dd>{setup.notes}</dd></>
          )}
        </dl>
      </section>

      {/* ── Planning dates ──────────────────────────────────── */}
      {hasAnyDates && (
        <section className="cm-result-section">
          <h2 className="cm-result-section-heading">Planning dates</h2>
          <p className="cm-result-dates-note">
            These dates are user-entered for personal planning only. They have not been calculated,
            verified, or confirmed by any professional and are not contractual.
          </p>
          <dl className="cm-result-dl">
            {setup.dates.closingSigning && (
              <><dt>Closing or signing</dt><dd>{formatDate(setup.dates.closingSigning)}</dd></>
            )}
            {setup.dates.possessionHandoff && (
              <><dt>Possession or key handoff</dt><dd>{formatDate(setup.dates.possessionHandoff)}</dd></>
            )}
            {setup.dates.moveOut && (
              <><dt>Move-out</dt><dd>{formatDate(setup.dates.moveOut)}</dd></>
            )}
            {setup.dates.moveIn && (
              <><dt>Move-in</dt><dd>{formatDate(setup.dates.moveIn)}</dd></>
            )}
            {setup.dates.leaseEnd && (
              <><dt>Lease end</dt><dd>{formatDate(setup.dates.leaseEnd)}</dd></>
            )}
          </dl>
        </section>
      )}

      {/* ── Progress summary ─────────────────────────────────── */}
      {tasks.length > 0 && (
        <section className="cm-result-section">
          <h2 className="cm-result-section-heading">Progress summary</h2>
          <div className="cm-result-status-row">
            <span className="cm-status-badge cm-status-badge--total">
              {tasks.length} item{tasks.length !== 1 ? 's' : ''}
            </span>
            {completedCount > 0 && (
              <span className="cm-status-badge cm-status-badge--complete">{completedCount} complete</span>
            )}
            {inProgressCount > 0 && (
              <span className="cm-status-badge cm-status-badge--in-progress">{inProgressCount} in progress</span>
            )}
            {waitingCount > 0 && (
              <span className="cm-status-badge cm-status-badge--waiting">{waitingCount} waiting</span>
            )}
            {notStartedCount > 0 && (
              <span className="cm-status-badge cm-status-badge--not-started">{notStartedCount} not started</span>
            )}
            {notApplicableCount > 0 && (
              <span className="cm-status-badge cm-status-badge--na">{notApplicableCount} not applicable</span>
            )}
          </div>
        </section>
      )}

      {/* ── Tasks by planning period ─────────────────────────── */}
      {regularTasks.length > 0 && (
        <section className="cm-result-section">
          <h2 className="cm-result-section-heading">Closing & moving plan</h2>
          {PLANNING_PERIOD_ORDER.map(period => {
            const periodTasks = regularTasks.filter(t => t.period === period)
            return (
              <TaskGroup
                key={period}
                period={period}
                tasks={periodTasks}
                leavingLabel={leavingPropertyLabel}
                arrivingLabel={arrivingPropertyLabel}
              />
            )
          })}
        </section>
      )}

      {/* ── Professional confirmation callout ────────────────── */}
      {confirmTasks.length > 0 && (
        <section className="cm-result-section">
          <h2 className="cm-result-section-heading">Items needing professional confirmation</h2>
          <div className="cm-result-confirm-callout" role="note">
            <ul className="cm-result-confirm-list">
              {confirmTasks.map(t => <li key={t.id}>{t.label}</li>)}
            </ul>
          </div>
        </section>
      )}

      {/* ── Waiting items ────────────────────────────────────── */}
      {waitingTasks.length > 0 && (
        <section className="cm-result-section">
          <h2 className="cm-result-section-heading">Waiting or dependencies</h2>
          <ul className="cm-result-waiting-list">
            {waitingTasks.map(t => (
              <li key={t.id} className="cm-result-waiting-item">
                <strong>{t.label}</strong>: {t.waitingOn}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Questions for professionals ──────────────────────── */}
      {questionTasks.length > 0 && (
        <section className="cm-result-section">
          <h2 className="cm-result-section-heading">Questions to confirm with professionals</h2>
          <p className="cm-result-questions-note">
            These questions are for your reference. This planner does not answer them or provide
            professional advice.
          </p>
          {Array.from(new Set(questionTasks.map(q => q.questionFor))).map(prof => {
            const qs = questionTasks.filter(q => q.questionFor === prof)
            const label = prof ? PROFESSIONAL_TYPE_LABELS[prof] : 'Professional'
            return (
              <div key={prof} className="cm-result-question-group">
                <h3 className="cm-result-question-heading">{label}</h3>
                <ul className="cm-result-question-list">
                  {qs.map(q => (
                    <li key={q.id} className="cm-result-question-item">
                      {q.label}
                      {q.notes && <div className="cm-result-task-detail">Notes: {q.notes}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      )}

      {/* ── Missing detail callout ───────────────────────────── */}
      {missingDetails.length > 0 && (
        <section className="cm-result-section">
          <h2 className="cm-result-section-heading">Items to complete</h2>
          <p className="cm-result-missing-intro">
            These details were left blank. The plan is complete as entered — these are noted for
            your reference only.
          </p>
          <ul className="cm-result-missing-list">
            {missingDetails.map(d => <li key={d}>{d}</li>)}
          </ul>
        </section>
      )}

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="cm-results-footer">
        <p className="cm-results-disclaimer">
          This planner is a session-only workspace for personal organization and discussion. Tasks
          and dates are user-entered and customizable. Nothing entered here has been saved, stored,
          or transmitted. Contractual obligations and deadlines must be confirmed with the
          appropriate professional. This tool does not provide legal, financial, tax, insurance,
          inspection, title, escrow, moving, or real-estate advice, and does not calculate costs,
          proceeds, value, or transaction readiness.
        </p>

        <div className="cm-results-actions">
          <button
            type="button"
            className="listing-planner-btn listing-planner-btn--secondary"
            onClick={handleCopy}
            aria-live="polite"
          >
            {copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy Closing & Moving Plan'}
          </button>
          {canShare && (
            <button
              type="button"
              className="listing-planner-btn listing-planner-btn--secondary"
              onClick={handleShare}
            >
              Share Closing & Moving Plan
            </button>
          )}
          <button
            type="button"
            className="listing-planner-btn listing-planner-btn--secondary cm-print-btn"
            onClick={handlePrint}
          >
            Print Closing & Moving Plan
          </button>
          <button
            type="button"
            className="listing-planner-btn listing-planner-btn--secondary"
            onClick={onBack}
          >
            Review / Edit
          </button>
          <button
            type="button"
            className="listing-planner-btn listing-planner-btn--secondary"
            onClick={() => setShowStartOverConfirm(true)}
          >
            Start Over
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showStartOverConfirm}
        title="Start over?"
        body="This will clear all entered information. Your plan cannot be recovered."
        confirmLabel="Start over"
        cancelLabel="Keep plan"
        onConfirm={() => { setShowStartOverConfirm(false); onStartOver() }}
        onCancel={() => setShowStartOverConfirm(false)}
      />
    </div>
  )
}
