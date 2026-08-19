import { useState, useId } from 'react'
import type { PlanTask, PlanningPeriod, Responsibility, TaskStatus } from '../listingTypes'
import {
  STATUS_LABELS,
  RESPONSIBILITY_LABELS,
  PLANNING_PERIOD_LABELS,
  PLANNING_PERIOD_ORDER,
} from '../listingTypes'
import { makeCustomTask, TASK_LIBRARY } from '../listingTaskLibrary'

interface Props {
  tasks: PlanTask[]
  onTasksChange: (tasks: PlanTask[]) => void
}

interface ReviewCardProps {
  task: PlanTask
  onUpdate: (id: string, updates: Partial<PlanTask>) => void
  onRemove: (id: string) => void
}

function ReviewCard({ task, onUpdate, onRemove }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const baseId = useId()

  return (
    <div className={`listing-task-card${task.status === 'complete' ? ' listing-task-card--complete' : ''}`} data-task-id={task.id}>
      <div className="listing-task-card__header">
        <div className="listing-task-card__title-wrap">
          <span className="listing-task-card__title">{task.title}</span>
          <div className="listing-task-card__badges">
            <span className={`listing-status-badge listing-status-badge--${task.status}`}>
              {STATUS_LABELS[task.status]}
            </span>
            {task.responsibility !== 'unassigned' && (
              <span className="listing-resp-badge">{RESPONSIBILITY_LABELS[task.responsibility]}</span>
            )}
            {task.needsAgentInput && (
              <span className="listing-agent-badge" aria-label="Discuss with agent">Agent input</span>
            )}
          </div>
        </div>
        <div className="listing-task-card__actions">
          <button
            type="button"
            className="listing-task-card__edit-btn"
            aria-expanded={expanded}
            aria-controls={`review-fields-${baseId}`}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Close' : 'Edit'}
          </button>
          <button
            type="button"
            className="listing-task-card__remove-btn"
            aria-label={`Remove task: ${task.title}`}
            onClick={() => onRemove(task.id)}
          >
            ×
          </button>
        </div>
      </div>

      {!expanded && (
        <div className="listing-task-card__summary">
          <span className="listing-task-card__period">{PLANNING_PERIOD_LABELS[task.planningPeriod]}</span>
          {task.responsibility === 'unassigned' && (
            <span className="listing-unassigned-flag" aria-label="No one assigned yet">Unassigned</span>
          )}
        </div>
      )}

      {expanded && (
        <div id={`review-fields-${baseId}`} className="listing-task-card__fields">
          <div className="listing-task-field">
            <label htmlFor={`rv-title-${baseId}`} className="listing-field-label">Task title</label>
            <input
              id={`rv-title-${baseId}`}
              type="text"
              className="tool-input"
              value={task.title}
              onChange={e => onUpdate(task.id, { title: e.target.value })}
              maxLength={200}
            />
          </div>
          <div className="listing-task-field">
            <label htmlFor={`rv-status-${baseId}`} className="listing-field-label">Status</label>
            <select
              id={`rv-status-${baseId}`}
              className="listing-field-select"
              value={task.status}
              onChange={e => onUpdate(task.id, { status: e.target.value as TaskStatus })}
            >
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="listing-task-field">
            <label htmlFor={`rv-resp-${baseId}`} className="listing-field-label">Responsible</label>
            <select
              id={`rv-resp-${baseId}`}
              className="listing-field-select"
              value={task.responsibility}
              onChange={e => onUpdate(task.id, { responsibility: e.target.value as Responsibility })}
            >
              {(Object.keys(RESPONSIBILITY_LABELS) as Responsibility[]).map(r => (
                <option key={r} value={r}>{RESPONSIBILITY_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div className="listing-task-field">
            <label htmlFor={`rv-period-${baseId}`} className="listing-field-label">Planning period</label>
            <select
              id={`rv-period-${baseId}`}
              className="listing-field-select"
              value={task.planningPeriod}
              onChange={e => onUpdate(task.id, { planningPeriod: e.target.value as PlanningPeriod })}
            >
              {PLANNING_PERIOD_ORDER.map(p => (
                <option key={p} value={p}>{PLANNING_PERIOD_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div className="listing-task-field">
            <label htmlFor={`rv-date-${baseId}`} className="listing-field-label">
              Target date <span className="tool-question-optional-tag">(optional)</span>
            </label>
            <input
              id={`rv-date-${baseId}`}
              type="date"
              className="tool-input"
              value={task.targetDate}
              onChange={e => onUpdate(task.id, { targetDate: e.target.value })}
            />
          </div>
          <div className="listing-task-field">
            <label htmlFor={`rv-notes-${baseId}`} className="listing-field-label">
              Notes <span className="tool-question-optional-tag">(optional)</span>
            </label>
            <textarea
              id={`rv-notes-${baseId}`}
              className="tool-textarea listing-field-textarea"
              rows={2}
              value={task.notes}
              onChange={e => onUpdate(task.id, { notes: e.target.value })}
              placeholder="Any details or reminders"
            />
          </div>
          <div className="listing-task-field listing-task-field--checkbox">
            <label className="listing-agent-input-label">
              <input
                type="checkbox"
                className="listing-agent-input-check"
                checked={task.needsAgentInput}
                onChange={e => onUpdate(task.id, { needsAgentInput: e.target.checked })}
              />
              <span>Needs agent input before proceeding</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomTaskForm({ onAdd, onCancel }: { onAdd: (task: PlanTask) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [categoryKey, setCategoryKey] = useState('')
  const [titleError, setTitleError] = useState(false)
  const formId = useId()

  function handleSubmit() {
    if (!title.trim()) { setTitleError(true); return }
    const cat = TASK_LIBRARY.find(c => c.key === categoryKey)
    onAdd(makeCustomTask(title.trim(), categoryKey, cat?.title ?? 'Custom'))
    setTitle('')
    setCategoryKey('')
    setTitleError(false)
    onCancel()
  }

  return (
    <div className="listing-custom-form" role="group" aria-label="Add custom task">
      <div className="listing-task-field">
        <label htmlFor={`rv-custom-title-${formId}`} className="listing-field-label">
          Task title <span className="listing-required-mark" aria-hidden="true">*</span>
        </label>
        {titleError && <span className="tool-question-error" role="alert">A task title is required.</span>}
        <input
          id={`rv-custom-title-${formId}`}
          type="text"
          className={`tool-input${titleError ? ' tool-input--error' : ''}`}
          placeholder="Describe the task"
          value={title}
          onChange={e => { setTitle(e.target.value); if (e.target.value.trim()) setTitleError(false) }}
          maxLength={200}
          aria-required="true"
          aria-invalid={titleError}
        />
      </div>
      <div className="listing-task-field">
        <label htmlFor={`rv-custom-cat-${formId}`} className="listing-field-label">
          Category <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <select
          id={`rv-custom-cat-${formId}`}
          className="listing-field-select"
          value={categoryKey}
          onChange={e => setCategoryKey(e.target.value)}
        >
          <option value="">— General / Other —</option>
          {TASK_LIBRARY.map(cat => (
            <option key={cat.key} value={cat.key}>{cat.title}</option>
          ))}
        </select>
      </div>
      <div className="listing-custom-form__actions">
        <button type="button" className="listing-custom-form__add" onClick={handleSubmit}>Add task</button>
        <button type="button" className="listing-custom-form__cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export function ReviewStage({ tasks, onTasksChange }: Props) {
  const [showCustomForm, setShowCustomForm] = useState(false)

  function updateTask(id: string, updates: Partial<PlanTask>) {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  function removeTask(id: string) {
    onTasksChange(tasks.filter(t => t.id !== id))
  }

  function addCustomTask(task: PlanTask) {
    onTasksChange([...tasks, task])
    setShowCustomForm(false)
  }

  const needsAgentCount = tasks.filter(t => t.needsAgentInput).length
  const unassignedCount = tasks.filter(t => t.responsibility === 'unassigned').length
  const waitingCount = tasks.filter(t => t.status === 'waiting').length

  return (
    <div>
      <p className="listing-stage-intro">
        Review your plan before generating the final action plan. You can still edit, remove, or add tasks.
      </p>

      {(needsAgentCount > 0 || unassignedCount > 0 || waitingCount > 0) && (
        <div className="listing-review-flags" role="note">
          {needsAgentCount > 0 && (
            <span className="listing-flag listing-flag--agent">
              {needsAgentCount} task{needsAgentCount === 1 ? '' : 's'} need{needsAgentCount === 1 ? 's' : ''} agent input
            </span>
          )}
          {unassignedCount > 0 && (
            <span className="listing-flag listing-flag--unassigned">
              {unassignedCount} task{unassignedCount === 1 ? '' : 's'} unassigned
            </span>
          )}
          {waitingCount > 0 && (
            <span className="listing-flag listing-flag--waiting">
              {waitingCount} task{waitingCount === 1 ? '' : 's'} waiting
            </span>
          )}
        </div>
      )}

      {PLANNING_PERIOD_ORDER.map(period => {
        const periodTasks = tasks.filter(t => t.planningPeriod === period)
        if (periodTasks.length === 0) return null
        return (
          <section key={period} aria-labelledby={`review-period-${period}`} className="listing-review-period">
            <h2 id={`review-period-${period}`} className="listing-review-period__heading">
              {PLANNING_PERIOD_LABELS[period]}
            </h2>
            {periodTasks.map(task => (
              <ReviewCard
                key={task.id}
                task={task}
                onUpdate={updateTask}
                onRemove={removeTask}
              />
            ))}
          </section>
        )
      })}

      {tasks.length === 0 && (
        <p className="listing-my-plan__empty">
          No tasks in your plan yet. Go back to add tasks from the library.
        </p>
      )}

      {showCustomForm ? (
        <CustomTaskForm onAdd={addCustomTask} onCancel={() => setShowCustomForm(false)} />
      ) : (
        <button
          type="button"
          className="listing-add-custom-btn"
          onClick={() => setShowCustomForm(true)}
        >
          + Add custom task
        </button>
      )}
    </div>
  )
}
