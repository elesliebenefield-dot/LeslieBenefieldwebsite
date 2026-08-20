import { useState } from 'react'
import type {
  ClosingTask,
  TaskTrack,
  PlanningPeriod,
  TaskStatus,
  ProfessionalType,
} from '../closingTypes'
import {
  TASK_TRACK_LABELS,
  PLANNING_PERIOD_LABELS,
  TASK_STATUS_LABELS,
  PROFESSIONAL_TYPE_LABELS,
  ALL_PROFESSIONAL_TYPES,
  makeCmId,
  makeEmptyQuestion,
  MAX_TASKS,
} from '../closingTypes'

interface Props {
  tasks: ClosingTask[]
  onChange: (tasks: ClosingTask[]) => void
  onNext: () => void
  onBack: () => void
}

interface TaskCardProps {
  task: ClosingTask
  onUpdate: (t: ClosingTask) => void
  onRemove: () => void
}

const TRACK_ORDER: TaskTrack[] = ['closing_coordination', 'leaving', 'arriving', 'moving_day', 'general', 'first_week']
const PERIOD_ORDER: PlanningPeriod[] = ['before_closing', 'closing_day', 'before_move_out', 'moving_day', 'first_week', 'later', 'no_timing']
const STATUS_ORDER: TaskStatus[] = ['not_started', 'in_progress', 'waiting', 'complete', 'not_applicable']

function TaskCard({ task, onUpdate, onRemove }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const cardId = `cm-task-body-${task.id}`

  function field<K extends keyof ClosingTask>(key: K, val: ClosingTask[K]) {
    onUpdate({ ...task, [key]: val })
  }

  const isQuestion = task.isQuestion

  return (
    <div className={`cm-task-card${isQuestion ? ' cm-task-card--question' : ''}`} data-task-id={task.id} data-task-label={task.label}>
      <div className="cm-task-card-header">
        <div className="cm-task-card-title-row">
          <span className="cm-task-card-title">{task.label}</span>
          {isQuestion && task.questionFor && (
            <span className="cm-task-card-badge cm-task-card-badge--question">
              Q: {PROFESSIONAL_TYPE_LABELS[task.questionFor]}
            </span>
          )}
          {task.needsProfessionalConfirmation && !isQuestion && (
            <span className="cm-task-card-badge cm-task-card-badge--confirm">Needs confirmation</span>
          )}
        </div>
        <div className="cm-task-card-controls">
          <button
            type="button"
            className="cm-edit-btn"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            aria-controls={cardId}
          >
            {expanded ? 'Collapse' : 'Edit details'}
          </button>
          <button
            type="button"
            className="cm-remove-btn"
            onClick={onRemove}
            aria-label={`Remove task: ${task.label}`}
          >
            Remove
          </button>
        </div>
      </div>

      {expanded && (
        <div id={cardId} className="cm-task-card-body">
          {/* Track */}
          <div className="cm-field-group">
            <label className="cm-label" htmlFor={`cm-track-${task.id}`}>Track</label>
            <select
              id={`cm-track-${task.id}`}
              className="tool-input cm-select"
              value={task.track}
              onChange={e => field('track', e.target.value as TaskTrack)}
            >
              {TRACK_ORDER.map(t => (
                <option key={t} value={t}>{TASK_TRACK_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Responsible */}
          <div className="cm-field-group">
            <label className="cm-label" htmlFor={`cm-responsible-${task.id}`}>
              Responsible <span className="cm-optional">(optional)</span>
            </label>
            <input
              id={`cm-responsible-${task.id}`}
              type="text"
              className="tool-input"
              value={task.responsible}
              onChange={e => field('responsible', e.target.value)}
              placeholder="Person, role, or team"
            />
          </div>

          {/* Period + target date */}
          <div className="cm-field-row">
            <div className="cm-field-group cm-field-group--half">
              <label className="cm-label" htmlFor={`cm-period-${task.id}`}>Planning period</label>
              <select
                id={`cm-period-${task.id}`}
                className="tool-input cm-select"
                value={task.period}
                onChange={e => field('period', e.target.value as PlanningPeriod)}
              >
                {PERIOD_ORDER.map(p => (
                  <option key={p} value={p}>{PLANNING_PERIOD_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="cm-field-group cm-field-group--half">
              <label className="cm-label" htmlFor={`cm-date-${task.id}`}>
                Target date <span className="cm-optional">(planning only)</span>
              </label>
              <input
                id={`cm-date-${task.id}`}
                type="date"
                className="tool-input cm-input-date"
                value={task.targetDate}
                onChange={e => field('targetDate', e.target.value)}
              />
            </div>
          </div>

          {/* Status */}
          <div className="cm-field-group">
            <label className="cm-label" htmlFor={`cm-status-${task.id}`}>Status</label>
            <select
              id={`cm-status-${task.id}`}
              className="tool-input cm-select"
              value={task.status}
              onChange={e => field('status', e.target.value as TaskStatus)}
            >
              {STATUS_ORDER.map(s => (
                <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Waiting on */}
          <div className="cm-field-group">
            <label className="cm-label" htmlFor={`cm-waiting-${task.id}`}>
              Waiting on / dependency <span className="cm-optional">(optional)</span>
            </label>
            <input
              id={`cm-waiting-${task.id}`}
              type="text"
              className="tool-input"
              value={task.waitingOn}
              onChange={e => field('waitingOn', e.target.value)}
              placeholder="e.g. Awaiting lender response"
            />
          </div>

          {/* Notes */}
          <div className="cm-field-group">
            <label className="cm-label" htmlFor={`cm-notes-${task.id}`}>
              Notes <span className="cm-optional">(optional)</span>
            </label>
            <textarea
              id={`cm-notes-${task.id}`}
              className="tool-input cm-textarea cm-textarea--sm"
              value={task.notes}
              onChange={e => field('notes', e.target.value)}
              placeholder="Additional details, context, or reminders"
              rows={2}
            />
          </div>

          {/* Professional confirmation flag */}
          <label className="cm-checkbox-label">
            <input
              type="checkbox"
              className="cm-checkbox-input"
              checked={task.needsProfessionalConfirmation}
              onChange={e => field('needsProfessionalConfirmation', e.target.checked)}
            />
            Needs confirmation from a professional before proceeding
          </label>
        </div>
      )}
    </div>
  )
}

export function OrganizeTimelineStage({ tasks, onChange, onNext, onBack }: Props) {
  const [showValidation, setShowValidation] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [questionFor, setQuestionFor] = useState<ProfessionalType>('agent')

  const regularTasks = tasks.filter(t => !t.isQuestion)
  const questionTasks = tasks.filter(t => t.isQuestion)
  const atMax = tasks.length >= MAX_TASKS

  function updateTask(id: string, updated: ClosingTask) {
    onChange(tasks.map(t => t.id === id ? updated : t))
  }

  function removeTask(id: string) {
    onChange(tasks.filter(t => t.id !== id))
  }

  function addQuestion() {
    const trimmed = questionText.trim()
    if (!trimmed || atMax) return
    onChange([...tasks, makeEmptyQuestion(makeCmId(), trimmed, questionFor)])
    setQuestionText('')
  }

  function handleNext() {
    if (tasks.length === 0) {
      setShowValidation(true)
      const el = document.querySelector('.cm-task-validation')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        ;(el as HTMLElement).focus?.()
      }
      return
    }
    onNext()
  }

  return (
    <div className="cm-stage">
      <p className="cm-stage-intro">
        Set details for each task: track, responsible person, planning period, status, and any
        waiting-on notes. Expand a card to edit. Add questions for professionals in the section
        below. At least one task or question is required before viewing results.
      </p>

      {showValidation && tasks.length === 0 && (
        <div
          className="cm-field-error cm-task-validation"
          role="alert"
          tabIndex={-1}
        >
          Add or select at least one task before continuing.
        </div>
      )}

      {/* Task cards */}
      {regularTasks.length > 0 && (
        <div className="cm-task-cards" aria-label="Task list">
          {regularTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={u => updateTask(task.id, u)}
              onRemove={() => removeTask(task.id)}
            />
          ))}
        </div>
      )}

      {regularTasks.length === 0 && (
        <p className="cm-empty-tasks">
          No tasks selected yet. Go back to the task library to add starter tasks, or add a custom
          task below.
        </p>
      )}

      {/* Add a custom task inline */}
      <div className="cm-inline-custom-section">
        <h3 className="cm-inline-section-heading">Add a custom task</h3>
        <div className="cm-custom-row">
          <input
            type="text"
            className="tool-input cm-custom-input"
            value=""
            onChange={() => {}}
            aria-label="Custom task description (go back to library stage to add)"
            placeholder="Go back to the task library to add tasks"
            disabled
          />
        </div>
      </div>

      {/* Questions for professionals */}
      <div className="cm-questions-section">
        <h3 className="cm-inline-section-heading">Questions for professionals</h3>
        <p className="cm-field-hint">
          Record questions to confirm with your agent, lender, attorney, title professional, or
          other contact. This planner does not answer these questions or provide professional advice.
        </p>

        <div className="cm-custom-row">
          <input
            type="text"
            className="tool-input cm-custom-input"
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            placeholder="Question to confirm"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuestion() } }}
            aria-label="Question text"
            disabled={atMax}
          />
          <select
            className="tool-input cm-select cm-question-for"
            value={questionFor}
            onChange={e => setQuestionFor(e.target.value as ProfessionalType)}
            aria-label="Ask this question to which professional"
          >
            {ALL_PROFESSIONAL_TYPES.map(pt => (
              <option key={pt} value={pt}>{PROFESSIONAL_TYPE_LABELS[pt]}</option>
            ))}
          </select>
          <button
            type="button"
            className="listing-planner-btn listing-planner-btn--secondary cm-add-btn"
            onClick={addQuestion}
            disabled={!questionText.trim() || atMax}
          >
            Add
          </button>
        </div>

        {questionTasks.length > 0 && (
          <div className="cm-task-cards cm-question-cards">
            {questionTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onUpdate={u => updateTask(task.id, u)}
                onRemove={() => removeTask(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="cm-stage-actions cm-stage-actions--split">
        <button type="button" className="listing-planner-btn listing-planner-btn--secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="listing-planner-btn listing-planner-btn--primary" onClick={handleNext}>
          View Closing & Moving Plan
        </button>
      </div>
    </div>
  )
}
