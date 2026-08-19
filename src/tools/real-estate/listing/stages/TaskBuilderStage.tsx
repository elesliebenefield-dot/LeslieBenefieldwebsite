import { useState, useId } from 'react'
import type { PlanTask, PlanningPeriod, Responsibility, TaskStatus } from '../listingTypes'
import {
  STATUS_LABELS,
  RESPONSIBILITY_LABELS,
  PLANNING_PERIOD_LABELS,
  PLANNING_PERIOD_ORDER,
} from '../listingTypes'
import {
  TASK_LIBRARY,
  makeCustomTask,
  makePlanTask,
  getCategoryByKey,
} from '../listingTaskLibrary'

interface Props {
  tasks: PlanTask[]
  onTasksChange: (tasks: PlanTask[]) => void
}

// ── Task Card (expandable editor) ─────────────────────────────────────────────

interface TaskCardProps {
  task: PlanTask
  onUpdate: (id: string, updates: Partial<PlanTask>) => void
  onRemove: (id: string) => void
  defaultExpanded?: boolean
}

function TaskCard({ task, onUpdate, onRemove, defaultExpanded = false }: TaskCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const baseId = useId()

  const statusClass = task.status === 'complete'
    ? 'listing-task-card listing-task-card--complete'
    : 'listing-task-card'

  return (
    <div className={statusClass} data-task-id={task.id}>
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
            aria-controls={`task-fields-${baseId}`}
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

      {expanded && (
        <div id={`task-fields-${baseId}`} className="listing-task-card__fields">
          <div className="listing-task-field">
            <label htmlFor={`title-${baseId}`} className="listing-field-label">Task title</label>
            <input
              id={`title-${baseId}`}
              type="text"
              className="tool-input"
              value={task.title}
              onChange={e => onUpdate(task.id, { title: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="listing-task-field">
            <label htmlFor={`status-${baseId}`} className="listing-field-label">Status</label>
            <select
              id={`status-${baseId}`}
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
            <label htmlFor={`resp-${baseId}`} className="listing-field-label">Responsible</label>
            <select
              id={`resp-${baseId}`}
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
            <label htmlFor={`period-${baseId}`} className="listing-field-label">Planning period</label>
            <select
              id={`period-${baseId}`}
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
            <label htmlFor={`date-${baseId}`} className="listing-field-label">
              Target date <span className="tool-question-optional-tag">(optional)</span>
            </label>
            <input
              id={`date-${baseId}`}
              type="date"
              className="tool-input"
              value={task.targetDate}
              onChange={e => onUpdate(task.id, { targetDate: e.target.value })}
            />
          </div>

          <div className="listing-task-field">
            <label htmlFor={`notes-${baseId}`} className="listing-field-label">
              Notes <span className="tool-question-optional-tag">(optional)</span>
            </label>
            <textarea
              id={`notes-${baseId}`}
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

// ── Custom Task Form ───────────────────────────────────────────────────────────

interface CustomTaskFormProps {
  onAdd: (task: PlanTask) => void
  onCancel: () => void
}

function CustomTaskForm({ onAdd, onCancel }: CustomTaskFormProps) {
  const [title, setTitle] = useState('')
  const [categoryKey, setCategoryKey] = useState('')
  const [titleError, setTitleError] = useState(false)
  const formId = useId()

  function handleSubmit() {
    if (!title.trim()) {
      setTitleError(true)
      return
    }
    const cat = getCategoryByKey(categoryKey)
    const task = makeCustomTask(title.trim(), categoryKey, cat?.title ?? 'Custom')
    onAdd(task)
    setTitle('')
    setCategoryKey('')
    setTitleError(false)
    onCancel()
  }

  return (
    <div className="listing-custom-form" role="group" aria-label="Add custom task">
      <div className="listing-task-field">
        <label htmlFor={`custom-title-${formId}`} className="listing-field-label">
          Task title <span className="listing-required-mark" aria-hidden="true">*</span>
        </label>
        {titleError && (
          <span className="tool-question-error" role="alert">A task title is required.</span>
        )}
        <input
          id={`custom-title-${formId}`}
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
        <label htmlFor={`custom-cat-${formId}`} className="listing-field-label">
          Category <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <select
          id={`custom-cat-${formId}`}
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
        <button type="button" className="listing-custom-form__add" onClick={handleSubmit}>
          Add task
        </button>
        <button type="button" className="listing-custom-form__cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main Stage ────────────────────────────────────────────────────────────────

export function TaskBuilderStage({ tasks, onTasksChange }: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [showCustomForm, setShowCustomForm] = useState(false)

  const selectedStarterKeys = new Set(tasks.map(t => t.starterKey).filter(Boolean))

  function toggleCategory(key: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  function toggleStarterTask(taskDef: { key: string; title: string; defaultNeedsAgentInput?: boolean; defaultResponsibility?: Responsibility; defaultPlanningPeriod?: PlanningPeriod }, cat: typeof TASK_LIBRARY[0]) {
    if (selectedStarterKeys.has(taskDef.key)) {
      onTasksChange(tasks.filter(t => t.starterKey !== taskDef.key))
    } else {
      onTasksChange([...tasks, makePlanTask(taskDef, cat)])
    }
  }

  function updateTask(id: string, updates: Partial<PlanTask>) {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  function removeTask(id: string) {
    onTasksChange(tasks.filter(t => t.id !== id))
  }

  function addCustomTask(task: PlanTask) {
    onTasksChange([...tasks, task])
  }

  return (
    <div>
      <p className="listing-stage-intro">
        Select the tasks relevant to your property. These are a starting point — your agent can help
        you decide what applies. You can customize every task after adding it.
      </p>

      <section aria-labelledby="library-heading" className="listing-library">
        <h2 id="library-heading" className="listing-section-heading">Starter Task Library</h2>
        <p className="listing-section-hint">
          Choose from common preparation tasks below. Expand a category to see its tasks.
        </p>

        {TASK_LIBRARY.map(cat => {
          const selectedCount = cat.tasks.filter(t => selectedStarterKeys.has(t.key)).length
          const isExpanded = expandedCategories.has(cat.key)

          return (
            <div key={cat.key} className="listing-category">
              <button
                type="button"
                className="listing-category__header"
                aria-expanded={isExpanded}
                aria-controls={`cat-tasks-${cat.key}`}
                onClick={() => toggleCategory(cat.key)}
              >
                <span className="listing-category__name">{cat.title}</span>
                <span className="listing-category__meta">
                  {selectedCount > 0 && (
                    <span className="listing-category__count" aria-label={`${selectedCount} task${selectedCount === 1 ? '' : 's'} selected`}>
                      {selectedCount} selected
                    </span>
                  )}
                  <span className="listing-category__chevron" aria-hidden="true">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </span>
              </button>

              {isExpanded && (
                <ul id={`cat-tasks-${cat.key}`} className="listing-category__tasks" role="list">
                  {cat.tasks.map(taskDef => {
                    const isSelected = selectedStarterKeys.has(taskDef.key)
                    return (
                      <li key={taskDef.key} className="listing-task-item">
                        <label className={`listing-task-item__label${isSelected ? ' listing-task-item__label--selected' : ''}`}>
                          <input
                            type="checkbox"
                            className="listing-task-item__checkbox"
                            checked={isSelected}
                            onChange={() => toggleStarterTask(taskDef, cat)}
                            aria-label={`${isSelected ? 'Remove' : 'Add'}: ${taskDef.title}`}
                          />
                          <span className="listing-task-item__text">{taskDef.title}</span>
                          {taskDef.defaultNeedsAgentInput && (
                            <span className="listing-task-item__agent-hint" aria-label="Discuss with agent">Agent</span>
                          )}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </section>

      <section aria-labelledby="myplan-heading" className="listing-my-plan">
        <div className="listing-my-plan__header">
          <h2 id="myplan-heading" className="listing-section-heading">
            My Action Plan
          </h2>
          <span className="listing-my-plan__count" aria-live="polite" aria-atomic="true">
            {tasks.length === 0 ? 'No tasks yet' : `${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {tasks.length === 0 ? (
          <p className="listing-my-plan__empty">
            Select tasks from the library above, or add a custom task below.
          </p>
        ) : (
          <div className="listing-task-list" role="list">
            {tasks.map(task => (
              <div key={task.id} role="listitem">
                <TaskCard
                  task={task}
                  onUpdate={updateTask}
                  onRemove={removeTask}
                />
              </div>
            ))}
          </div>
        )}

        {showCustomForm ? (
          <CustomTaskForm
            onAdd={addCustomTask}
            onCancel={() => setShowCustomForm(false)}
          />
        ) : (
          <button
            type="button"
            className="listing-add-custom-btn"
            onClick={() => setShowCustomForm(true)}
          >
            + Add custom task
          </button>
        )}
      </section>
    </div>
  )
}
