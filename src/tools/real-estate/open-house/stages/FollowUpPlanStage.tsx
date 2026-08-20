import { useState } from 'react'
import { STARTER_ACTIONS } from '../openHouseActions'
import type {
  FollowUpAction,
  EventOutcomes,
  ActionCategory,
  ActionTiming,
  ActionStatus,
  ActionScope,
} from '../openHouseTypes'
import {
  ACTION_CATEGORY_LABELS,
  ACTION_TIMING_LABELS,
  ACTION_STATUS_LABELS,
  makeEmptyAction,
  makeOhId,
} from '../openHouseTypes'

interface Props {
  actions: FollowUpAction[]
  outcomes: EventOutcomes
  onChange: (actions: FollowUpAction[]) => void
  onNext: () => void
  onBack: () => void
}

interface ActionCardProps {
  action: FollowUpAction
  scopeOptions: Array<{ value: ActionScope; label: string }>
  onUpdate: (a: FollowUpAction) => void
  onRemove: () => void
}

function ActionCard({ action, scopeOptions, onUpdate, onRemove }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false)

  function field<K extends keyof FollowUpAction>(key: K, val: FollowUpAction[K]) {
    onUpdate({ ...action, [key]: val })
  }

  const cardId = `oh-action-card-${action.id}`

  return (
    <div className="oh-action-card" data-action-id={action.id} data-action-key={action.label}>
      <div className="oh-action-card-header">
        <span className="oh-action-card-title">{action.label}</span>
        <div className="oh-action-card-controls">
          <button
            type="button"
            className="listing-task-card__edit-btn"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            aria-controls={cardId}
          >
            {expanded ? 'Collapse' : 'Edit details'}
          </button>
          {action.isCustom && (
            <button
              type="button"
              className="listing-task-card__remove-btn"
              onClick={onRemove}
              aria-label={`Remove action: ${action.label}`}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div id={cardId} className="oh-action-card-body">
          {/* Scope */}
          {scopeOptions.length > 1 && (
            <div className="oh-field-group">
              <label className="oh-label" htmlFor={`oh-action-scope-${action.id}`}>Scope</label>
              <select
                id={`oh-action-scope-${action.id}`}
                className="tool-input oh-select"
                value={action.scope}
                onChange={e => field('scope', e.target.value as ActionScope)}
              >
                {scopeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Responsible */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-action-responsible-${action.id}`}>
              Responsible <span className="oh-optional">(optional)</span>
            </label>
            <input
              id={`oh-action-responsible-${action.id}`}
              type="text"
              className="tool-input"
              value={action.responsible}
              onChange={e => field('responsible', e.target.value)}
              placeholder="Agent, team, or brokerage"
            />
          </div>

          {/* Timing */}
          <div className="oh-field-row">
            <div className="oh-field-group oh-field-group--half">
              <label className="oh-label" htmlFor={`oh-action-timing-${action.id}`}>Timing</label>
              <select
                id={`oh-action-timing-${action.id}`}
                className="tool-input oh-select"
                value={action.timing}
                onChange={e => field('timing', e.target.value as ActionTiming)}
              >
                {(Object.entries(ACTION_TIMING_LABELS) as [ActionTiming, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="oh-field-group oh-field-group--half">
              <label className="oh-label" htmlFor={`oh-action-date-${action.id}`}>
                Target date <span className="oh-optional">(optional)</span>
              </label>
              <input
                id={`oh-action-date-${action.id}`}
                type="date"
                className="tool-input oh-input-date"
                value={action.targetDate}
                onChange={e => field('targetDate', e.target.value)}
              />
            </div>
          </div>

          {/* Status */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-action-status-${action.id}`}>Status</label>
            <select
              id={`oh-action-status-${action.id}`}
              className="tool-input oh-select"
              value={action.status}
              onChange={e => field('status', e.target.value as ActionStatus)}
            >
              {(Object.entries(ACTION_STATUS_LABELS) as [ActionStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Channel */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-action-channel-${action.id}`}>
              Channel or method <span className="oh-optional">(optional)</span>
            </label>
            <input
              id={`oh-action-channel-${action.id}`}
              type="text"
              className="tool-input"
              value={action.channel}
              onChange={e => field('channel', e.target.value)}
              placeholder="e.g. Email, phone call, in-person"
            />
          </div>

          {/* Notes */}
          <div className="oh-field-group">
            <label className="oh-label" htmlFor={`oh-action-notes-${action.id}`}>
              Notes <span className="oh-optional">(optional)</span>
            </label>
            <textarea
              id={`oh-action-notes-${action.id}`}
              className="tool-input oh-textarea oh-textarea--sm"
              value={action.notes}
              onChange={e => field('notes', e.target.value)}
              placeholder="Additional context or details for this action"
              rows={2}
            />
          </div>

          {/* Broker input */}
          <label className="oh-checkbox-label">
            <input
              type="checkbox"
              checked={action.needsBrokerInput}
              onChange={e => field('needsBrokerInput', e.target.checked)}
            />
            Needs broker or brokerage input before proceeding
          </label>
        </div>
      )}
    </div>
  )
}

const CATEGORY_ORDER: ActionCategory[] = [
  'wrap_up',
  'seller_comm',
  'visitor_fu',
  'agent_questions',
  'marketing_admin',
]

export function FollowUpPlanStage({ actions, outcomes, onChange, onNext, onBack }: Props) {
  const [customLabel, setCustomLabel] = useState('')
  const [customCategory, setCustomCategory] = useState<ActionCategory>('wrap_up')
  const [showValidation, setShowValidation] = useState(false)

  // Visitor scope options: only visitors who have not declined
  const eligibleVisitors = outcomes.visitors.filter(v => v.permission !== 'declined')
  const scopeOptions: Array<{ value: ActionScope; label: string }> = [
    { value: 'event_wide', label: 'Entire event' },
    ...eligibleVisitors.map(v => ({
      value: v.id,
      label: v.label ? `Visitor: ${v.label}` : `Visitor record ${outcomes.visitors.indexOf(v) + 1}`,
    })),
  ]

  const activeKeys = new Set(
    actions.filter(a => !a.isCustom).map(a => a.label)
  )

  function toggleStarter(label: string, category: ActionCategory, checked: boolean) {
    if (checked) {
      const id = makeOhId()
      onChange([...actions, makeEmptyAction(id, label, category)])
    } else {
      onChange(actions.filter(a => a.isCustom || a.label !== label))
    }
  }

  function addCustom() {
    const trimmed = customLabel.trim()
    if (!trimmed) return
    const id = makeOhId()
    onChange([...actions, makeEmptyAction(id, trimmed, customCategory, true)])
    setCustomLabel('')
  }

  function updateAction(id: string, updated: FollowUpAction) {
    onChange(actions.map(a => a.id === id ? updated : a))
  }

  function removeAction(id: string) {
    onChange(actions.filter(a => a.id !== id))
  }

  function handleNext() {
    if (actions.length === 0) {
      setShowValidation(true)
      return
    }
    onNext()
  }

  const actionsByCategory = CATEGORY_ORDER.map(cat => ({
    cat,
    starters: STARTER_ACTIONS.filter(s => s.category === cat),
    custom: actions.filter(a => a.isCustom && a.category === cat),
    active: actions.filter(a => !a.isCustom && a.category === cat),
  }))

  return (
    <div className="oh-stage">
      <p className="oh-stage-intro">
        Select the actions that apply to this event and add any custom tasks. At least one action
        is required before moving to the results view. You can edit details like timing, status,
        and notes by expanding any action card.
      </p>

      {showValidation && actions.length === 0 && (
        <div className="oh-field-error oh-action-validation" role="alert">
          Select or add at least one follow-up action before continuing.
        </div>
      )}

      {/* Starter actions by category */}
      {actionsByCategory.map(({ cat, starters, active }) => (
        <section key={cat} className="oh-section">
          <h2 className="oh-section-heading">{ACTION_CATEGORY_LABELS[cat]}</h2>

          {/* Checkboxes */}
          <div className="oh-starter-list">
            {starters.map(s => {
              const isChecked = activeKeys.has(s.label)
              return (
                <label key={s.key} className="oh-starter-label">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={e => toggleStarter(s.label, s.category, e.target.checked)}
                  />
                  {s.label}
                </label>
              )
            })}
          </div>

          {/* Expanded detail cards for active starters in this category */}
          {active.length > 0 && (
            <div className="oh-action-cards">
              {active.map(a => (
                <ActionCard
                  key={a.id}
                  action={a}
                  scopeOptions={scopeOptions}
                  onUpdate={u => updateAction(a.id, u)}
                  onRemove={() => removeAction(a.id)}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Custom actions */}
      <section className="oh-section">
        <h2 className="oh-section-heading">Custom actions</h2>

        <div className="oh-custom-action-row">
          <input
            type="text"
            className="tool-input oh-custom-action-input"
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            placeholder="Describe the action"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
            aria-label="Custom action description"
          />
          <select
            className="tool-input oh-select oh-custom-action-category"
            value={customCategory}
            onChange={e => setCustomCategory(e.target.value as ActionCategory)}
            aria-label="Category for custom action"
          >
            {(Object.entries(ACTION_CATEGORY_LABELS) as [ActionCategory, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            type="button"
            className="listing-planner-btn listing-planner-btn--secondary oh-custom-action-add"
            onClick={addCustom}
            disabled={!customLabel.trim()}
          >
            Add
          </button>
        </div>

        {/* Custom action cards (all categories combined) */}
        {actions.filter(a => a.isCustom).length > 0 && (
          <div className="oh-action-cards">
            {actions.filter(a => a.isCustom).map(a => (
              <ActionCard
                key={a.id}
                action={a}
                scopeOptions={scopeOptions}
                onUpdate={u => updateAction(a.id, u)}
                onRemove={() => removeAction(a.id)}
              />
            ))}
          </div>
        )}

        {actions.filter(a => a.isCustom).length === 0 && (
          <p className="oh-empty-custom">No custom actions added yet.</p>
        )}
      </section>

      <div className="oh-stage-actions oh-stage-actions--split">
        <button type="button" className="listing-planner-btn listing-planner-btn--secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="listing-planner-btn listing-planner-btn--primary" onClick={handleNext}>
          View Follow-Up Results
        </button>
      </div>
    </div>
  )
}
