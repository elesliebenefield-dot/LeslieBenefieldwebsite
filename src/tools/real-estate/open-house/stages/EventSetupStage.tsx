import type { EventSetup, SellerUpdateNeeded } from '../openHouseTypes'

interface Props {
  setup: EventSetup
  onChange: (s: EventSetup) => void
  showErrors: boolean
  onNext: () => void
}

export function EventSetupStage({ setup, onChange, showErrors, onNext }: Props) {
  function field<K extends keyof EventSetup>(key: K, val: EventSetup[K]) {
    onChange({ ...setup, [key]: val })
  }

  const missingLabel = showErrors && !setup.propertyLabel.trim()
  const missingDate  = showErrors && !setup.date

  return (
    <div className="oh-stage">
      <p className="oh-stage-intro">
        Record the basics about this open house. All information stays in your current browser
        session and is not stored or transmitted anywhere.
      </p>

      <div className="oh-privacy-notice" role="note">
        <strong>Session-only workspace.</strong> Nothing you enter here is saved, sent, or shared
        outside of this browser tab. Close or refresh the page to clear all information.
      </div>

      {/* Property label */}
      <div className="oh-field-group">
        <label className="oh-label oh-label--required" htmlFor="oh-property-label">
          Property label or address
        </label>
        <p className="oh-field-hint">Use a neutral description such as a street name or internal reference.</p>
        <input
          id="oh-property-label"
          type="text"
          className={`tool-input${missingLabel ? ' tool-input--error' : ''}`}
          value={setup.propertyLabel}
          onChange={e => field('propertyLabel', e.target.value)}
          placeholder="e.g. 123 Maple Street, or Unit 4B"
          aria-required="true"
          aria-describedby={missingLabel ? 'oh-property-label-error' : undefined}
        />
        {missingLabel && (
          <p id="oh-property-label-error" className="oh-field-error" role="alert">
            Property label is required.
          </p>
        )}
      </div>

      {/* Date */}
      <div className="oh-field-group">
        <label className="oh-label oh-label--required" htmlFor="oh-date">
          Open house date
        </label>
        <input
          id="oh-date"
          type="date"
          className={`tool-input oh-input-date${missingDate ? ' tool-input--error' : ''}`}
          value={setup.date}
          onChange={e => field('date', e.target.value)}
          aria-required="true"
          aria-describedby={missingDate ? 'oh-date-error' : undefined}
        />
        {missingDate && (
          <p id="oh-date-error" className="oh-field-error" role="alert">
            Open house date is required.
          </p>
        )}
      </div>

      {/* Times */}
      <div className="oh-field-row">
        <div className="oh-field-group oh-field-group--half">
          <label className="oh-label" htmlFor="oh-start-time">Start time <span className="oh-optional">(optional)</span></label>
          <input
            id="oh-start-time"
            type="time"
            className="tool-input oh-input-time"
            value={setup.startTime}
            onChange={e => field('startTime', e.target.value)}
          />
        </div>
        <div className="oh-field-group oh-field-group--half">
          <label className="oh-label" htmlFor="oh-end-time">End time <span className="oh-optional">(optional)</span></label>
          <input
            id="oh-end-time"
            type="time"
            className="tool-input oh-input-time"
            value={setup.endTime}
            onChange={e => field('endTime', e.target.value)}
          />
        </div>
      </div>

      {/* Hosting agent */}
      <div className="oh-field-group">
        <label className="oh-label" htmlFor="oh-hosting-agent">
          Hosting agent or team label <span className="oh-optional">(optional)</span>
        </label>
        <input
          id="oh-hosting-agent"
          type="text"
          className="tool-input"
          value={setup.hostingAgent}
          onChange={e => field('hostingAgent', e.target.value)}
          placeholder="e.g. Alex Chen, or Metro Realty Team"
        />
      </div>

      {/* Seller update */}
      <fieldset className="oh-fieldset">
        <legend className="oh-label">Seller / client update needed?</legend>
        <div className="oh-radio-group">
          {(['yes', 'no', 'not_sure', ''] as SellerUpdateNeeded[]).map(val => (
            <label key={val} className="oh-radio-label">
              <input
                type="radio"
                name="oh-seller-update"
                value={val}
                checked={setup.sellerUpdateNeeded === val}
                onChange={() => field('sellerUpdateNeeded', val)}
              />
              {val === '' ? 'Not sure yet' : val === 'yes' ? 'Yes' : val === 'no' ? 'No' : 'Not sure'}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Estimated attendance */}
      <div className="oh-field-group">
        <label className="oh-label" htmlFor="oh-attendance">
          Estimated attendance <span className="oh-optional">(optional)</span>
        </label>
        <input
          id="oh-attendance"
          type="number"
          min="0"
          className="tool-input oh-input-number"
          value={setup.estimatedAttendance}
          onChange={e => field('estimatedAttendance', e.target.value)}
          placeholder="e.g. 12"
        />
      </div>

      {/* Event notes */}
      <div className="oh-field-group">
        <label className="oh-label" htmlFor="oh-event-notes">
          Event notes <span className="oh-optional">(optional)</span>
        </label>
        <textarea
          id="oh-event-notes"
          className="tool-input oh-textarea"
          value={setup.eventNotes}
          onChange={e => field('eventNotes', e.target.value)}
          placeholder="General observations, setup notes, or context for this event"
          rows={3}
        />
      </div>

      <div className="oh-stage-actions">
        <button
          type="button"
          className="listing-planner-btn listing-planner-btn--primary"
          onClick={onNext}
        >
          Next: Record Event Outcomes
        </button>
      </div>
    </div>
  )
}
