import { useState } from 'react'
import type { Priority, Property, PropertyObservations, MatchStatus } from '../comparisonTypes'
import { MATCH_STATUS_LABELS, MATCH_STATUS_ORDER, STARTER_FOLLOW_UP_OPTIONS } from '../comparisonTypes'
import { makeEmptyObservations } from '../comparisonTypes'

interface Props {
  priorities: Priority[]
  properties: Property[]
  observations: Record<string, PropertyObservations>
  onChange: (id: string, obs: PropertyObservations) => void
}

interface SectionProps {
  obs: PropertyObservations
  onUpdate: (updates: Partial<PropertyObservations>) => void
  priorities: Priority[]
  propId: string
}

function PriorityMatchSection({ obs, onUpdate, priorities }: SectionProps) {
  if (priorities.length === 0) return null
  return (
    <fieldset className="cmp-obs-section">
      <legend className="cmp-obs-section-legend">How does this property match your priorities?</legend>
      <p className="cmp-obs-section-hint">
        Reflect on what you observed during the tour. These are your impressions, not professional assessments.
      </p>
      <div className="cmp-priority-match-list">
        {priorities.map(pr => {
          const current: MatchStatus = obs.priorityMatches[pr.id] ?? 'notEvaluated'
          return (
            <div key={pr.id} className="cmp-priority-match-row" data-priority-id={pr.id}>
              <label htmlFor={`match-${obs.propertyId}-${pr.id}`} className="cmp-priority-match-label">
                {pr.label}
              </label>
              <select
                id={`match-${obs.propertyId}-${pr.id}`}
                className="listing-field-select cmp-match-select"
                value={current}
                onChange={e => onUpdate({
                  priorityMatches: { ...obs.priorityMatches, [pr.id]: e.target.value as MatchStatus }
                })}
              >
                {MATCH_STATUS_ORDER.map(s => (
                  <option key={s} value={s}>{MATCH_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

function OverallObservationsSection({ obs, onUpdate }: SectionProps) {
  return (
    <fieldset className="cmp-obs-section">
      <legend className="cmp-obs-section-legend">Overall impressions</legend>
      <div className="cmp-obs-field">
        <label htmlFor={`positives-${obs.propertyId}`} className="listing-field-label">
          What stood out positively? <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <textarea
          id={`positives-${obs.propertyId}`}
          className="tool-input cmp-obs-textarea"
          rows={3}
          value={obs.positives}
          onChange={e => onUpdate({ positives: e.target.value })}
          placeholder="Things you liked or that exceeded your expectations…"
        />
      </div>
      <div className="cmp-obs-field">
        <label htmlFor={`concerns-${obs.propertyId}`} className="listing-field-label">
          What gave you pause? <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <textarea
          id={`concerns-${obs.propertyId}`}
          className="tool-input cmp-obs-textarea"
          rows={3}
          value={obs.concerns}
          onChange={e => onUpdate({ concerns: e.target.value })}
          placeholder="Things you noticed that concerned you or need more attention…"
        />
      </div>
    </fieldset>
  )
}

type NoteField = {
  label: string
  field: keyof PropertyObservations
  placeholder: string
}

const NOTE_FIELDS: NoteField[] = [
  { label: 'Layout and flow', field: 'layoutNotes', placeholder: 'Room arrangement, traffic flow, openness, compartmentalization…' },
  { label: 'Condition and maintenance', field: 'conditionNotes', placeholder: 'Signs of deferred maintenance, cosmetic issues, age of systems…' },
  { label: 'Natural light', field: 'lightNotes', placeholder: 'Brightness, window placement, time of day during tour…' },
  { label: 'Storage', field: 'storageNotes', placeholder: 'Closets, pantry, garage, basement, attic storage…' },
  { label: 'Parking', field: 'parkingNotes', placeholder: 'Garage, driveway, street parking availability…' },
  { label: 'Outdoor space', field: 'outdoorNotes', placeholder: 'Yard, patio, deck, landscaping, privacy…' },
  { label: 'Accessibility', field: 'accessibilityNotes', placeholder: 'Entry, interior movement, stairs, bathroom…' },
  { label: 'Commute and travel', field: 'commuteNotes', placeholder: 'Distance, traffic, transit, walkability…' },
  { label: 'Noise noticed during tour', field: 'noiseNotes', placeholder: 'Street noise, neighbors, mechanical sounds, HVAC…' },
]

function DetailedNotesSection({ obs, onUpdate }: SectionProps) {
  return (
    <fieldset className="cmp-obs-section">
      <legend className="cmp-obs-section-legend">
        Detailed notes <span className="tool-question-optional-tag">(all optional — fill in what's relevant)</span>
      </legend>
      {NOTE_FIELDS.map(({ label, field, placeholder }) => (
        <div key={field} className="cmp-obs-field">
          <label htmlFor={`${field}-${obs.propertyId}`} className="listing-field-label">{label}</label>
          <textarea
            id={`${field}-${obs.propertyId}`}
            className="tool-input cmp-obs-textarea"
            rows={2}
            value={obs[field] as string}
            onChange={e => onUpdate({ [field]: e.target.value })}
            placeholder={placeholder}
          />
        </div>
      ))}
    </fieldset>
  )
}

function FollowUpSection({ obs, onUpdate }: SectionProps) {
  const [customInput, setCustomInput] = useState('')
  const [customError, setCustomError] = useState(false)

  function toggleAction(label: string) {
    const current = obs.followUpActions
    const next = current.includes(label)
      ? current.filter(a => a !== label)
      : [...current, label]
    onUpdate({ followUpActions: next })
  }

  function addCustom() {
    if (!customInput.trim()) { setCustomError(true); return }
    onUpdate({ customFollowUps: [...obs.customFollowUps, customInput.trim()] })
    setCustomInput('')
    setCustomError(false)
  }

  function removeCustom(idx: number) {
    onUpdate({ customFollowUps: obs.customFollowUps.filter((_, i) => i !== idx) })
  }

  return (
    <fieldset className="cmp-obs-section">
      <legend className="cmp-obs-section-legend">Questions and next steps</legend>

      <div className="cmp-obs-field">
        <label htmlFor={`agentQ-${obs.propertyId}`} className="listing-field-label">
          Questions for the listing agent <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <textarea
          id={`agentQ-${obs.propertyId}`}
          className="tool-input cmp-obs-textarea"
          rows={2}
          value={obs.agentQuestions}
          onChange={e => onUpdate({ agentQuestions: e.target.value })}
          placeholder="What would you ask the agent or seller?…"
        />
      </div>

      <div className="cmp-obs-field">
        <label htmlFor={`profQ-${obs.propertyId}`} className="listing-field-label">
          Questions for an inspector or other professional <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <textarea
          id={`profQ-${obs.propertyId}`}
          className="tool-input cmp-obs-textarea"
          rows={2}
          value={obs.professionalQuestions}
          onChange={e => onUpdate({ professionalQuestions: e.target.value })}
          placeholder="Things you'd want a professional to evaluate or explain…"
        />
      </div>

      <div className="cmp-obs-field">
        <label htmlFor={`infoNeeded-${obs.propertyId}`} className="listing-field-label">
          Information you still need <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <textarea
          id={`infoNeeded-${obs.propertyId}`}
          className="tool-input cmp-obs-textarea"
          rows={2}
          value={obs.infoNeeded}
          onChange={e => onUpdate({ infoNeeded: e.target.value })}
          placeholder="Documents, disclosures, clarifications, details you want to look up…"
        />
      </div>

      <div className="cmp-obs-field">
        <p className="listing-field-label">Follow-up actions <span className="tool-question-optional-tag">(optional)</span></p>
        <div className="cmp-followup-options" role="group" aria-label="Follow-up actions">
          {STARTER_FOLLOW_UP_OPTIONS.map(opt => (
            <label key={opt} className="cmp-followup-item">
              <input
                type="checkbox"
                checked={obs.followUpActions.includes(opt)}
                onChange={() => toggleAction(opt)}
              />
              {opt}
            </label>
          ))}
        </div>

        {obs.customFollowUps.length > 0 && (
          <ul className="cmp-custom-followups">
            {obs.customFollowUps.map((item, idx) => (
              <li key={idx} className="cmp-custom-followup-item">
                <span>{item}</span>
                <button
                  type="button"
                  className="cmp-remove-priority-btn"
                  aria-label={`Remove follow-up: ${item}`}
                  onClick={() => removeCustom(idx)}
                >×</button>
              </li>
            ))}
          </ul>
        )}

        <div className="cmp-add-custom-row">
          {customError && <span className="tool-question-error" role="alert">Enter a follow-up item.</span>}
          <input
            type="text"
            className={`tool-input cmp-custom-input${customError ? ' tool-input--error' : ''}`}
            placeholder="Add a custom follow-up action…"
            value={customInput}
            onChange={e => { setCustomInput(e.target.value); if (e.target.value.trim()) setCustomError(false) }}
            onKeyDown={e => { if (e.key === 'Enter') addCustom() }}
            maxLength={200}
            aria-label="Custom follow-up action"
          />
          <button type="button" className="cmp-add-custom-btn" onClick={addCustom}>Add</button>
        </div>
      </div>

      <div className="cmp-obs-field">
        <label htmlFor={`followUpNotes-${obs.propertyId}`} className="listing-field-label">
          Additional follow-up notes <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <textarea
          id={`followUpNotes-${obs.propertyId}`}
          className="tool-input cmp-obs-textarea"
          rows={2}
          value={obs.followUpNotes}
          onChange={e => onUpdate({ followUpNotes: e.target.value })}
          placeholder="Any other notes about next steps or things to revisit…"
        />
      </div>
    </fieldset>
  )
}

export function ObservationsStage({ priorities, properties, observations, onChange }: Props) {
  const [activePropertyId, setActivePropertyId] = useState<string>(
    properties.length > 0 ? properties[0].id : ''
  )

  const activeProp = properties.find(p => p.id === activePropertyId) ?? properties[0]

  function getObs(propId: string): PropertyObservations {
    return observations[propId] ?? makeEmptyObservations(propId)
  }

  function updateObs(propId: string, updates: Partial<PropertyObservations>) {
    const current = getObs(propId)
    onChange(propId, { ...current, ...updates })
  }

  if (!activeProp) return null

  const obs = getObs(activeProp.id)
  const sectionProps: SectionProps = {
    obs,
    onUpdate: updates => updateObs(activeProp.id, updates),
    priorities,
    propId: activeProp.id,
  }

  return (
    <div>
      <p className="cmp-stage-intro">
        Record your observations for each property. Work through one property at a time —
        use the tabs to switch between properties. Everything is optional.
      </p>

      <div className="cmp-property-tabs" role="tablist" aria-label="Properties">
        {properties.map(prop => (
          <button
            key={prop.id}
            role="tab"
            type="button"
            aria-selected={prop.id === activeProp.id}
            className={`cmp-property-tab${prop.id === activeProp.id ? ' cmp-property-tab--active' : ''}`}
            onClick={() => setActivePropertyId(prop.id)}
            data-property-id={prop.id}
          >
            {prop.nickname || 'Unnamed'}
          </button>
        ))}
      </div>

      <div
        className="cmp-property-panel"
        role="tabpanel"
        aria-label={`Observations for ${activeProp.nickname || 'this property'}`}
      >
        <PriorityMatchSection {...sectionProps} />
        <OverallObservationsSection {...sectionProps} />
        <DetailedNotesSection {...sectionProps} />
        <FollowUpSection {...sectionProps} />
      </div>
    </div>
  )
}
