import { useState } from 'react'
import type { ListingPlanSetup, PlanTask } from './listingTypes'
import {
  PLANNING_PERIOD_ORDER,
  PLANNING_PERIOD_LABELS,
  STATUS_LABELS,
  RESPONSIBILITY_LABELS,
} from './listingTypes'
import { buildActionPlanText } from './listingSummary'

const SHARE_TITLE = 'My Listing Preparation Action Plan'

function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

interface TaskRowProps {
  task: PlanTask
}

function TaskRow({ task }: TaskRowProps) {
  const completeCls = task.status === 'complete' ? ' listing-plan-task--complete' : ''
  return (
    <div className={`listing-plan-task${completeCls}`} data-task-id={task.id}>
      <div className="listing-plan-task__title-row">
        <span
          className="listing-plan-task__status-indicator"
          aria-hidden="true"
        >
          {task.status === 'complete' ? '✓' : '○'}
        </span>
        <span className="listing-plan-task__title">{task.title}</span>
        {task.status === 'complete' && (
          <span className="listing-plan-task__complete-label" aria-label="Complete">Complete</span>
        )}
      </div>
      <div className="listing-plan-task__details">
        {task.status !== 'complete' && (
          <span className="listing-plan-task__detail">
            <span className="listing-plan-task__detail-key">Status:</span>{' '}
            {STATUS_LABELS[task.status]}
          </span>
        )}
        {task.responsibility !== 'unassigned' && (
          <span className="listing-plan-task__detail">
            <span className="listing-plan-task__detail-key">Responsible:</span>{' '}
            {RESPONSIBILITY_LABELS[task.responsibility]}
          </span>
        )}
        {task.targetDate && (
          <span className="listing-plan-task__detail">
            <span className="listing-plan-task__detail-key">Target:</span>{' '}
            {formatDate(task.targetDate)}
          </span>
        )}
        {task.needsAgentInput && (
          <span className="listing-plan-task__agent-flag" aria-label="Discuss with agent before proceeding">
            Discuss with agent
          </span>
        )}
        {task.notes && (
          <span className="listing-plan-task__notes">{task.notes}</span>
        )}
      </div>
    </div>
  )
}

interface Props {
  setup: ListingPlanSetup
  tasks: PlanTask[]
  onReviewEdit: () => void
  onStartOver: () => void
}

export function ActionPlanResults({ setup, tasks, onReviewEdit, onStartOver }: Props) {
  const [copyStatus, setCopyStatus] = useState<'' | 'copied' | 'failed' | 'share-error'>('')
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  async function handleCopy() {
    const text = buildActionPlanText(setup, tasks)
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(''), 4000)
    } catch {
      setCopyStatus('failed')
    }
  }

  async function handleShare() {
    const text = buildActionPlanText(setup, tasks)
    try {
      await navigator.share({ title: SHARE_TITLE, text })
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setCopyStatus('share-error')
        setTimeout(() => setCopyStatus(''), 6000)
      }
    }
  }

  const isSuccess = copyStatus === 'copied'
  const isError = copyStatus === 'failed' || copyStatus === 'share-error'

  const total = tasks.length
  const complete = tasks.filter(t => t.status === 'complete').length
  const inProgress = tasks.filter(t => t.status === 'inProgress').length
  const waiting = tasks.filter(t => t.status === 'waiting').length
  const notStarted = tasks.filter(t => t.status === 'notStarted').length

  const agentTasks = tasks.filter(t => t.needsAgentInput)
  const unassigned = tasks.filter(t => t.responsibility === 'unassigned')
  const waitingTasks = tasks.filter(t => t.status === 'waiting')

  const hasAnyDate = setup.photographyDate || setup.listingDate || setup.showingDate

  return (
    <div>
      <div className="tool-results-header">
        <h1 className="tool-results-title">Your Listing Preparation Action Plan</h1>
        {setup.planName && (
          <p className="listing-plan-name">{setup.planName}</p>
        )}
      </div>

      {hasAnyDate && (
        <div className="listing-plan-dates result-section">
          <div className="result-section-header">
            <p className="result-section-title">Target Dates</p>
          </div>
          <div className="listing-plan-dates__body">
            <p className="listing-plan-dates__note">
              Planning purposes only — not contractual deadlines.
            </p>
            <dl className="listing-plan-dates__list">
              {setup.photographyDate && (
                <>
                  <dt className="listing-plan-dates__term">Photography</dt>
                  <dd className="listing-plan-dates__detail">{formatDate(setup.photographyDate)}</dd>
                </>
              )}
              {setup.listingDate && (
                <>
                  <dt className="listing-plan-dates__term">Listing goes live</dt>
                  <dd className="listing-plan-dates__detail">{formatDate(setup.listingDate)}</dd>
                </>
              )}
              {setup.showingDate && (
                <>
                  <dt className="listing-plan-dates__term">First showing or open house</dt>
                  <dd className="listing-plan-dates__detail">{formatDate(setup.showingDate)}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      )}

      <div className="listing-plan-progress result-section" aria-label="Progress overview">
        <div className="result-section-header">
          <p className="result-section-title">Progress Overview</p>
        </div>
        <div className="listing-plan-progress__body">
          <div className="listing-progress-grid">
            <span className="listing-progress-item">
              <span className="listing-progress-count">{total}</span>
              <span className="listing-progress-label">Total</span>
            </span>
            {complete > 0 && (
              <span className="listing-progress-item listing-progress-item--complete">
                <span className="listing-progress-count">{complete}</span>
                <span className="listing-progress-label">Complete</span>
              </span>
            )}
            {inProgress > 0 && (
              <span className="listing-progress-item">
                <span className="listing-progress-count">{inProgress}</span>
                <span className="listing-progress-label">In progress</span>
              </span>
            )}
            {waiting > 0 && (
              <span className="listing-progress-item">
                <span className="listing-progress-count">{waiting}</span>
                <span className="listing-progress-label">Waiting</span>
              </span>
            )}
            {notStarted > 0 && (
              <span className="listing-progress-item">
                <span className="listing-progress-count">{notStarted}</span>
                <span className="listing-progress-label">Not started</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="result-sections">
        {PLANNING_PERIOD_ORDER.map(period => {
          const periodTasks = tasks.filter(t => t.planningPeriod === period)
          if (periodTasks.length === 0) return null
          return (
            <div key={period} className={`result-section listing-plan-section listing-plan-section--${period}`}>
              <div className="result-section-header">
                <p className="result-section-title">{PLANNING_PERIOD_LABELS[period]}</p>
              </div>
              <div className="listing-plan-section__tasks">
                {periodTasks.map(task => <TaskRow key={task.id} task={task} />)}
              </div>
            </div>
          )
        })}

        {agentTasks.length > 0 && (
          <div className="result-section listing-plan-section listing-plan-section--agent">
            <div className="result-section-header">
              <p className="result-section-title">Needs Agent Input</p>
            </div>
            <div className="listing-plan-section__tasks">
              {agentTasks.map(task => (
                <div key={task.id} className="listing-plan-task__flag-row">
                  <span className="listing-agent-badge">Agent input</span>
                  <span className="listing-plan-task__flag-title">{task.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(unassigned.length > 0 || waitingTasks.length > 0) && (
          <div className="result-section listing-plan-section listing-plan-section--attention">
            <div className="result-section-header">
              <p className="result-section-title">Needs Attention</p>
            </div>
            <div className="listing-plan-section__tasks">
              {unassigned.map(task => (
                <div key={task.id} className="listing-plan-task__flag-row">
                  <span className="listing-unassigned-flag">Unassigned</span>
                  <span className="listing-plan-task__flag-title">{task.title}</span>
                </div>
              ))}
              {waitingTasks.map(task => (
                <div key={task.id} className="listing-plan-task__flag-row">
                  <span className="listing-status-badge listing-status-badge--waiting">Waiting</span>
                  <span className="listing-plan-task__flag-title">{task.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {setup.planNotes && (
          <div className="result-section listing-plan-section listing-plan-section--notes">
            <div className="result-section-header">
              <p className="result-section-title">Plan Notes</p>
            </div>
            <div className="listing-plan-section__tasks">
              <p className="listing-plan-notes-text">{setup.planNotes}</p>
            </div>
          </div>
        )}
      </div>

      <div className="tool-disclaimer" role="note">
        <p>
          This action plan is for organizational and planning purposes only. Tasks are customizable
          and not automatically required for any property or sale.
        </p>
        <p>
          Consult your real estate professional before spending money or beginning projects.
          Target dates are user-entered planning dates, not contractual deadlines.
          This tool does not estimate costs, home value, repair requirements, or return on investment.
          It does not provide real estate, legal, financial, tax, inspection, construction, or contractor advice.
          Results are based solely on information you entered.
        </p>
        <p>
          Interactive demo by{' '}
          <a href="https://websitesbyleslie.com" target="_blank" rel="noopener noreferrer">
            Websites by Leslie
          </a>
        </p>
      </div>

      <div className="result-actions no-print">
        <button type="button" className="result-action-btn" onClick={handleCopy}>
          Copy Action Plan
        </button>
        {canShare && (
          <button
            type="button"
            className="result-action-btn result-share-action"
            title="Shares the complete action plan via your device's share options"
            onClick={handleShare}
          >
            Share Action Plan
          </button>
        )}
        <button type="button" className="result-action-btn" onClick={() => window.print()}>
          Print Action Plan
        </button>
        <button type="button" className="result-action-btn" onClick={onReviewEdit}>
          Review / Edit Plan
        </button>
        <button type="button" className="result-action-btn result-action-btn--ghost" onClick={onStartOver}>
          Start Over
        </button>
        {!canShare && (
          <p className="result-share-hint">
            To email your plan, choose Copy Action Plan and paste it into your email.
          </p>
        )}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`result-copy-status${isSuccess ? ' success' : isError ? ' failed' : ''}`}
        >
          {copyStatus === 'copied' && 'Complete action plan copied to clipboard.'}
          {copyStatus === 'failed' && "Copy failed — use your device's select-all and copy instead."}
          {copyStatus === 'share-error' && 'Sharing failed. Use Copy Action Plan and share it manually.'}
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
          <li>A customized task library for your market</li>
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
