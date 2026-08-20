import { useState } from 'react'
import { STARTER_TASKS_BY_TRACK, STAGE2_SECTION_TITLES } from '../closingActions'
import type { ClosingTask, TransitionSetup, TaskTrack } from '../closingTypes'
import { makeCmId, makeEmptyTask, getVisibleTracks, MAX_TASKS } from '../closingTypes'

interface Props {
  tasks: ClosingTask[]
  setup: TransitionSetup
  onChange: (tasks: ClosingTask[]) => void
  onNext: () => void
  onBack: () => void
}

export function TaskLibraryStage({ tasks, setup, onChange, onNext, onBack }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const visibleTracks = getVisibleTracks(setup.transitionType)
    return new Set(visibleTracks)
  })
  const [customLabel, setCustomLabel] = useState('')
  const [customTrack, setCustomTrack] = useState<TaskTrack>('general')

  const visibleTracks = getVisibleTracks(setup.transitionType)
  const activeKeys = new Set(tasks.filter(t => !t.isCustom && !t.isQuestion).map(t => t.label))
  const atMax = tasks.length >= MAX_TASKS

  function toggleSection(track: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(track)) next.delete(track)
      else next.add(track)
      return next
    })
  }

  function toggleStarter(label: string, track: TaskTrack, checked: boolean) {
    if (checked) {
      if (atMax) return
      const starter = STARTER_TASKS_BY_TRACK[track].find(s => s.label === label)
      const task = makeEmptyTask(makeCmId(), label, track)
      task.period = starter?.defaultPeriod ?? 'no_timing'
      onChange([...tasks, task])
    } else {
      onChange(tasks.filter(t => t.isCustom || t.isQuestion || t.label !== label))
    }
  }

  function addCustom() {
    const trimmed = customLabel.trim()
    if (!trimmed || atMax) return
    onChange([...tasks, makeEmptyTask(makeCmId(), trimmed, customTrack, true)])
    setCustomLabel('')
  }

  const selectedCount = tasks.length

  return (
    <div className="cm-stage">
      <p className="cm-stage-intro">
        Select the tasks that apply to your transition. Every item is optional — none implies a
        contractual or legal obligation. You can edit details, timing, and status in the next step.
        Add custom tasks for anything not listed.
      </p>

      {atMax && (
        <div className="cm-max-notice" role="status">
          Maximum of {MAX_TASKS} tasks reached. Remove a task to add another.
        </div>
      )}

      {selectedCount > 0 && (
        <div className="cm-selection-summary" role="status">
          {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected
        </div>
      )}

      {/* Starter task library */}
      {visibleTracks.map(track => {
        const starters = STARTER_TASKS_BY_TRACK[track as keyof typeof STARTER_TASKS_BY_TRACK]
        if (!starters || starters.length === 0) return null
        const isOpen = openSections.has(track)
        const activeInSection = starters.filter(s => activeKeys.has(s.label)).length
        const sectionTitle = STAGE2_SECTION_TITLES[track]

        return (
          <div key={track} className="cm-section-card" data-track={track}>
            <button
              type="button"
              className="cm-section-header"
              onClick={() => toggleSection(track)}
              aria-expanded={isOpen}
              aria-controls={`cm-section-body-${track}`}
            >
              <span className="cm-section-title">{sectionTitle}</span>
              <span className="cm-section-meta">
                {activeInSection > 0 && (
                  <span className="cm-section-count">{activeInSection}</span>
                )}
                <span className="cm-section-chevron" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
              </span>
            </button>

            {isOpen && (
              <ul className="cm-starter-list" id={`cm-section-body-${track}`}>
                {starters.map(s => {
                  const checked = activeKeys.has(s.label)
                  return (
                    <li key={s.key} className={`cm-starter-item${checked ? ' cm-starter-item--selected' : ''}`}>
                      <label className="cm-starter-label">
                        <input
                          type="checkbox"
                          className="cm-starter-checkbox"
                          checked={checked}
                          onChange={e => toggleStarter(s.label, track, e.target.checked)}
                          disabled={!checked && atMax}
                        />
                        <span className="cm-starter-text">{s.label}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}

      {/* Custom tasks */}
      <div className="cm-section-card cm-custom-section">
        <div className="cm-section-header cm-section-header--static">
          <span className="cm-section-title">Custom tasks</span>
        </div>
        <div className="cm-custom-task-body">
          <div className="cm-custom-row">
            <input
              type="text"
              className="tool-input cm-custom-input"
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              placeholder="Describe the task"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              aria-label="Custom task description"
              disabled={atMax}
            />
            <select
              className="tool-input cm-select cm-custom-track"
              value={customTrack}
              onChange={e => setCustomTrack(e.target.value as TaskTrack)}
              aria-label="Track for custom task"
            >
              <option value="general">General</option>
              <option value="closing_coordination">Closing coordination</option>
              <option value="leaving">Leaving</option>
              <option value="arriving">Arriving</option>
              <option value="moving_day">Moving day</option>
              <option value="first_week">First week</option>
            </select>
            <button
              type="button"
              className="listing-planner-btn listing-planner-btn--secondary cm-add-btn"
              onClick={addCustom}
              disabled={!customLabel.trim() || atMax}
            >
              Add
            </button>
          </div>

          {tasks.filter(t => t.isCustom && !t.isQuestion).length > 0 && (
            <ul className="cm-custom-list">
              {tasks.filter(t => t.isCustom && !t.isQuestion).map(t => (
                <li key={t.id} className="cm-custom-item">
                  <span className="cm-custom-item-label">{t.label}</span>
                  <span className="cm-custom-item-track">{t.track}</span>
                  <button
                    type="button"
                    className="cm-remove-btn"
                    onClick={() => onChange(tasks.filter(x => x.id !== t.id))}
                    aria-label={`Remove: ${t.label}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="cm-stage-actions cm-stage-actions--split">
        <button type="button" className="listing-planner-btn listing-planner-btn--secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="listing-planner-btn listing-planner-btn--primary" onClick={onNext}>
          Next: Organize the Timeline
        </button>
      </div>
    </div>
  )
}
