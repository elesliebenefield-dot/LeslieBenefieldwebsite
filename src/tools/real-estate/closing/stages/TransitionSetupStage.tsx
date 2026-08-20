import type {
  TransitionSetup,
  TransitionType,
  InvolvedParty,
  MovingMethod,
} from '../closingTypes'
import {
  TRANSITION_TYPE_LABELS,
  INVOLVED_PARTY_LABELS,
  MOVING_METHOD_LABELS,
  ALL_INVOLVED_PARTIES,
} from '../closingTypes'

interface Props {
  setup: TransitionSetup
  onChange: (s: TransitionSetup) => void
  showErrors: boolean
  onNext: () => void
}

const TRANSITION_TYPES: TransitionType[] = ['buying', 'selling', 'selling_buying', 'moving_only', 'other']
const MOVING_METHODS: MovingMethod[] = ['professional', 'self', 'hybrid', 'not_decided', 'not_applicable']

export function TransitionSetupStage({ setup, onChange, showErrors, onNext }: Props) {
  function field<K extends keyof TransitionSetup>(key: K, val: TransitionSetup[K]) {
    onChange({ ...setup, [key]: val })
  }

  function dateField(key: keyof TransitionSetup['dates'], val: string) {
    onChange({ ...setup, dates: { ...setup.dates, [key]: val } })
  }

  function toggleParty(party: InvolvedParty) {
    const next = setup.involvedParties.includes(party)
      ? setup.involvedParties.filter(p => p !== party)
      : [...setup.involvedParties, party]
    field('involvedParties', next)
  }

  const missingType = showErrors && !setup.transitionType

  const showLeaving = setup.transitionType === 'selling'
    || setup.transitionType === 'selling_buying'
    || setup.transitionType === 'other'
  const showArriving = setup.transitionType === 'buying'
    || setup.transitionType === 'selling_buying'
    || setup.transitionType === 'other'
  const showMoveOut = setup.transitionType === 'selling'
    || setup.transitionType === 'selling_buying'
    || setup.transitionType === 'moving_only'
    || setup.transitionType === 'other'
  const showMoveIn = setup.transitionType === 'buying'
    || setup.transitionType === 'selling_buying'
    || setup.transitionType === 'moving_only'
    || setup.transitionType === 'other'
  const showClosing = setup.transitionType !== 'moving_only'

  return (
    <div className="cm-stage">

      <div className="cm-wire-fraud-notice" role="note">
        <strong>Wire-fraud safety:</strong> Do not enter payment details, wire instructions, bank
        account numbers, or government identification numbers into this planner. Always independently
        verify payment instructions through a trusted, previously established contact method. This
        notice does not eliminate risk.
      </div>

      <div className="cm-privacy-notice" role="note">
        <strong>Session-only workspace.</strong> Nothing you enter here is saved, sent, or shared
        outside of this browser tab. Close or refresh the page to clear all information. Dates
        entered are for your personal planning only — they are not calculated, verified, or
        contractual.
      </div>

      {/* Transition type */}
      <fieldset className="cm-fieldset">
        <legend className={`cm-legend${missingType ? ' cm-legend--error' : ''}`}>
          Transition type <span className="cm-required-mark" aria-hidden="true">*</span>
        </legend>
        {TRANSITION_TYPES.map(type => (
          <label key={type} className={`cm-radio-card${setup.transitionType === type ? ' cm-radio-card--selected' : ''}`}>
            <input
              type="radio"
              name="cm-transition-type"
              value={type}
              checked={setup.transitionType === type}
              onChange={() => field('transitionType', type)}
              className="cm-radio-input"
            />
            <span className="cm-radio-label-text">{TRANSITION_TYPE_LABELS[type]}</span>
          </label>
        ))}
        {missingType && (
          <p className="cm-field-error" role="alert" id="cm-type-error">
            Please select a transition type to continue.
          </p>
        )}
      </fieldset>

      {/* Plan name */}
      <div className="cm-field-group">
        <label className="cm-label" htmlFor="cm-plan-name">
          Plan name <span className="cm-optional">(optional)</span>
        </label>
        <p className="cm-field-hint">A short label to identify this plan, for your reference only.</p>
        <input
          id="cm-plan-name"
          type="text"
          className="tool-input"
          value={setup.planName}
          onChange={e => field('planName', e.target.value)}
          placeholder="e.g. Oak Street Move, or Spring Closing"
        />
      </div>

      {/* Property labels */}
      {showLeaving && (
        <div className="cm-field-group">
          <label className="cm-label" htmlFor="cm-leaving-label">
            Leaving property label <span className="cm-optional">(optional)</span>
          </label>
          <p className="cm-field-hint">A neutral identifier you choose — not stored or transmitted.</p>
          <input
            id="cm-leaving-label"
            type="text"
            className="tool-input"
            value={setup.leavingPropertyLabel}
            onChange={e => field('leavingPropertyLabel', e.target.value)}
            placeholder="e.g. Oak Street, Current home, Unit 4B"
          />
        </div>
      )}

      {showArriving && (
        <div className="cm-field-group">
          <label className="cm-label" htmlFor="cm-arriving-label">
            Arriving property label <span className="cm-optional">(optional)</span>
          </label>
          <p className="cm-field-hint">A neutral identifier you choose — not stored or transmitted.</p>
          <input
            id="cm-arriving-label"
            type="text"
            className="tool-input"
            value={setup.arrivingPropertyLabel}
            onChange={e => field('arrivingPropertyLabel', e.target.value)}
            placeholder="e.g. Maple Ave, New home, Unit 12"
          />
        </div>
      )}

      {/* Involved parties */}
      <fieldset className="cm-fieldset">
        <legend className="cm-legend">
          Who may be involved <span className="cm-optional">(optional — select all that apply)</span>
        </legend>
        <div className="cm-checkbox-grid">
          {ALL_INVOLVED_PARTIES.map(party => (
            <label key={party} className="cm-checkbox-label">
              <input
                type="checkbox"
                checked={setup.involvedParties.includes(party)}
                onChange={() => toggleParty(party)}
                className="cm-checkbox-input"
              />
              {INVOLVED_PARTY_LABELS[party]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Planning dates */}
      <fieldset className="cm-fieldset">
        <legend className="cm-legend">
          Planning dates <span className="cm-optional">(optional — all user-entered, not verified)</span>
        </legend>
        <p className="cm-field-hint">
          These dates are for your personal planning only. They are not calculated, verified, or contractual.
          Confirm any binding dates with the appropriate professional.
        </p>
        <div className="cm-dates-grid">
          {showClosing && (
            <div className="cm-date-field">
              <label className="cm-date-label" htmlFor="cm-date-closing">Closing or signing</label>
              <input
                id="cm-date-closing"
                type="date"
                className="tool-input cm-input-date"
                value={setup.dates.closingSigning}
                onChange={e => dateField('closingSigning', e.target.value)}
              />
            </div>
          )}
          {showClosing && (
            <div className="cm-date-field">
              <label className="cm-date-label" htmlFor="cm-date-possession">Possession or key handoff</label>
              <input
                id="cm-date-possession"
                type="date"
                className="tool-input cm-input-date"
                value={setup.dates.possessionHandoff}
                onChange={e => dateField('possessionHandoff', e.target.value)}
              />
            </div>
          )}
          {showMoveOut && (
            <div className="cm-date-field">
              <label className="cm-date-label" htmlFor="cm-date-moveout">Move-out</label>
              <input
                id="cm-date-moveout"
                type="date"
                className="tool-input cm-input-date"
                value={setup.dates.moveOut}
                onChange={e => dateField('moveOut', e.target.value)}
              />
            </div>
          )}
          {showMoveIn && (
            <div className="cm-date-field">
              <label className="cm-date-label" htmlFor="cm-date-movein">Move-in</label>
              <input
                id="cm-date-movein"
                type="date"
                className="tool-input cm-input-date"
                value={setup.dates.moveIn}
                onChange={e => dateField('moveIn', e.target.value)}
              />
            </div>
          )}
          <div className="cm-date-field">
            <label className="cm-date-label" htmlFor="cm-date-lease-end">Lease end</label>
            <input
              id="cm-date-lease-end"
              type="date"
              className="tool-input cm-input-date"
              value={setup.dates.leaseEnd}
              onChange={e => dateField('leaseEnd', e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {/* Moving method */}
      <fieldset className="cm-fieldset">
        <legend className="cm-legend">
          Moving method <span className="cm-optional">(optional)</span>
        </legend>
        <div className="cm-radio-row">
          {MOVING_METHODS.map(method => (
            <label key={method} className={`cm-radio-chip${setup.movingMethod === method ? ' cm-radio-chip--selected' : ''}`}>
              <input
                type="radio"
                name="cm-moving-method"
                value={method}
                checked={setup.movingMethod === method}
                onChange={() => field('movingMethod', method)}
                className="cm-radio-input"
              />
              {MOVING_METHOD_LABELS[method]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Notes */}
      <div className="cm-field-group">
        <label className="cm-label" htmlFor="cm-notes">
          Overall notes <span className="cm-optional">(optional)</span>
        </label>
        <textarea
          id="cm-notes"
          className="tool-input cm-textarea"
          value={setup.notes}
          onChange={e => field('notes', e.target.value)}
          placeholder="Any context, priorities, or reminders for this transition"
          rows={3}
        />
      </div>

      <div className="cm-stage-actions">
        <button
          type="button"
          className="listing-planner-btn listing-planner-btn--primary"
          onClick={onNext}
        >
          Next: Build the Organizer
        </button>
      </div>
    </div>
  )
}
