import { useState } from 'react'
import type { Priority } from '../comparisonTypes'
import { MAX_PRIORITIES } from '../comparisonTypes'
import { STARTER_PRIORITY_DEFS, makeCustomPriority, makeStarterPriority } from '../comparisonPriorities'

interface Props {
  priorities: Priority[]
  onChange: (priorities: Priority[]) => void
  showErrors: boolean
}

export function PrioritiesStage({ priorities, onChange, showErrors }: Props) {
  const [customLabel, setCustomLabel] = useState('')
  const [customError, setCustomError] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const selectedStarterKeys = new Set(
    priorities.filter(p => !p.isCustom).map(p => p.label)
  )
  const atMax = priorities.length >= MAX_PRIORITIES
  const noneSelected = showErrors && priorities.length === 0

  function toggleStarter(def: (typeof STARTER_PRIORITY_DEFS)[0]) {
    const existing = priorities.find(p => !p.isCustom && p.label === def.label)
    if (existing) {
      onChange(priorities.filter(p => p.id !== existing.id))
    } else {
      if (atMax) return
      onChange([...priorities, makeStarterPriority(def)])
    }
  }

  function addCustom() {
    if (!customLabel.trim()) { setCustomError(true); return }
    if (atMax) return
    onChange([...priorities, makeCustomPriority(customLabel)])
    setCustomLabel('')
    setCustomError(false)
  }

  function removePriority(id: string) {
    onChange(priorities.filter(p => p.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    const arr = [...priorities]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    onChange(arr)
  }

  function moveDown(idx: number) {
    if (idx === priorities.length - 1) return
    const arr = [...priorities]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    onChange(arr)
  }

  function startEdit(p: Priority) {
    setEditingId(p.id)
    setEditLabel(p.label)
  }

  function saveEdit(id: string) {
    if (!editLabel.trim()) return
    onChange(priorities.map(p => p.id === id ? { ...p, label: editLabel.trim() } : p))
    setEditingId(null)
  }

  return (
    <div>
      <p className="cmp-stage-intro">
        Choose the criteria that matter most to you on a home tour.
        You can select up to {MAX_PRIORITIES} priorities, add custom ones, and adjust the order.
        These are your personal tour priorities — they can be updated at any time.
      </p>

      {noneSelected && (
        <div className="tool-error-banner" role="alert">
          Choose at least one comparison priority to continue.
        </div>
      )}

      <div className="cmp-section">
        <h2 className="cmp-section-heading">
          Starter priorities
          {atMax && <span className="cmp-limit-note"> (maximum {MAX_PRIORITIES} reached)</span>}
        </h2>
        <p className="cmp-section-hint">Select the ones that apply to your search. You can add custom priorities below.</p>
        <div className="cmp-starter-grid" role="group" aria-label="Starter priorities">
          {STARTER_PRIORITY_DEFS.map(def => {
            const isSelected = selectedStarterKeys.has(def.label)
            const isDisabled = !isSelected && atMax
            return (
              <label
                key={def.key}
                className={`cmp-starter-item${isSelected ? ' cmp-starter-item--selected' : ''}${isDisabled ? ' cmp-starter-item--disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  className="cmp-starter-checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => toggleStarter(def)}
                  aria-label={def.label}
                />
                <span className="cmp-starter-label">{def.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="cmp-section">
        <h2 className="cmp-section-heading">
          Your active priorities
          <span className="cmp-priority-count"> ({priorities.length} of {MAX_PRIORITIES})</span>
        </h2>

        {priorities.length === 0 && (
          <p className="cmp-empty-hint">No priorities selected yet. Choose from the starters above or add a custom one below.</p>
        )}

        <ol className="cmp-priority-list" aria-label="Active priorities in order">
          {priorities.map((p, idx) => (
            <li key={p.id} className="cmp-priority-item" data-priority-id={p.id}>
              {editingId === p.id ? (
                <div className="cmp-priority-edit">
                  <input
                    type="text"
                    className="tool-input cmp-priority-edit-input"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(p.id); if (e.key === 'Escape') setEditingId(null) }}
                    aria-label="Edit priority label"
                    maxLength={120}
                    autoFocus
                  />
                  <button type="button" className="cmp-edit-save-btn" onClick={() => saveEdit(p.id)}>Save</button>
                  <button type="button" className="cmp-edit-cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <div className="cmp-priority-row">
                  <span className="cmp-priority-num" aria-hidden="true">{idx + 1}.</span>
                  <span className="cmp-priority-label">{p.label}</span>
                  <div className="cmp-priority-controls" role="group" aria-label={`Controls for ${p.label}`}>
                    <button
                      type="button"
                      className="cmp-move-btn"
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      aria-label={`Move "${p.label}" up`}
                    >↑</button>
                    <button
                      type="button"
                      className="cmp-move-btn"
                      onClick={() => moveDown(idx)}
                      disabled={idx === priorities.length - 1}
                      aria-label={`Move "${p.label}" down`}
                    >↓</button>
                    {p.isCustom && (
                      <button
                        type="button"
                        className="cmp-edit-btn"
                        onClick={() => startEdit(p)}
                        aria-label={`Rename "${p.label}"`}
                      >Rename</button>
                    )}
                    <button
                      type="button"
                      className="cmp-remove-priority-btn"
                      onClick={() => removePriority(p.id)}
                      aria-label={`Remove "${p.label}" from priorities`}
                    >×</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>

        <div className="cmp-add-custom" role="group" aria-label="Add custom priority">
          <h3 className="cmp-add-custom-heading">Add a custom priority</h3>
          {customError && <span className="tool-question-error" role="alert">Enter a label for your custom priority.</span>}
          <div className="cmp-add-custom-row">
            <input
              type="text"
              className={`tool-input cmp-custom-input${customError ? ' tool-input--error' : ''}`}
              placeholder='e.g. "Sunroom" or "Basement storage"'
              value={customLabel}
              onChange={e => { setCustomLabel(e.target.value); if (e.target.value.trim()) setCustomError(false) }}
              onKeyDown={e => { if (e.key === 'Enter') addCustom() }}
              disabled={atMax}
              maxLength={120}
              aria-label="Custom priority label"
              aria-describedby={atMax ? 'cmp-limit-msg' : undefined}
            />
            <button
              type="button"
              className="cmp-add-custom-btn"
              onClick={addCustom}
              disabled={atMax}
            >Add</button>
          </div>
          {atMax && (
            <p id="cmp-limit-msg" className="cmp-limit-note">
              Maximum of {MAX_PRIORITIES} priorities reached. Remove one to add another.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
