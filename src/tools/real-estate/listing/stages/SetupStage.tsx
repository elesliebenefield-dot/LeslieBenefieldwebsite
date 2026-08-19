import { OptionCard } from '../../../core/components/OptionCard'
import type { InvolvedParty, ListingPlanSetup, OccupancyType } from '../listingTypes'
import { INVOLVED_PARTY_LABELS } from '../listingTypes'

interface Props {
  setup: ListingPlanSetup
  onChange: (partial: Partial<ListingPlanSetup>) => void
  showErrors: boolean
}

const OCCUPANCY_OPTIONS: { value: OccupancyType; label: string }[] = [
  { value: 'livingIn', label: 'Living in the home' },
  { value: 'tenantOccupied', label: 'Tenant occupied' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'other', label: 'Other' },
]

const PARTY_OPTIONS: InvolvedParty[] = [
  'homeowner', 'coOwner', 'agent', 'tenant', 'propertyManager', 'vendors',
]

function toggleParty(current: InvolvedParty[], party: InvolvedParty): InvolvedParty[] {
  return current.includes(party)
    ? current.filter(p => p !== party)
    : [...current, party]
}

export function SetupStage({ setup, onChange, showErrors }: Props) {
  const occupancyError = showErrors && !setup.occupancy

  return (
    <div>
      <p className="listing-stage-intro">
        Tell us a little about your situation so we can organize your action plan.
        All fields except current occupancy are optional — you can add or update information at any time.
      </p>

      <div className="tool-question">
        <label htmlFor="planName" className="tool-question-legend">
          Plan name or property label <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <input
          id="planName"
          type="text"
          className="tool-input"
          placeholder='e.g. "Maple Street preparation"'
          value={setup.planName}
          onChange={e => onChange({ planName: e.target.value })}
          maxLength={100}
        />
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${occupancyError ? ' has-error' : ''}`}>
            Current occupancy
          </legend>
          {occupancyError && (
            <span className="tool-question-error">Please select one option to continue.</span>
          )}
          <div className="option-cards">
            {OCCUPANCY_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`occupancy-${opt.value}`}
                type="radio"
                name="occupancy"
                value={opt.value}
                label={opt.label}
                checked={setup.occupancy === opt.value}
                onChange={() => onChange({ occupancy: opt.value })}
                hasError={occupancyError}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className="tool-question-legend">
            Who may be involved <span className="tool-question-optional-tag">(optional, select all that apply)</span>
          </legend>
          <div className="option-cards">
            {PARTY_OPTIONS.map(party => (
              <OptionCard
                key={party}
                id={`party-${party}`}
                type="checkbox"
                name="involvedParties"
                value={party}
                label={INVOLVED_PARTY_LABELS[party]}
                checked={setup.involvedParties.includes(party)}
                onChange={() => onChange({ involvedParties: toggleParty(setup.involvedParties, party) })}
                hasError={false}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="listing-dates-group">
        <p className="listing-dates-heading">
          Target dates <span className="tool-question-optional-tag">(optional — planning purposes only, not contractual deadlines)</span>
        </p>
        <div className="listing-dates-fields">
          <div className="listing-date-field">
            <label htmlFor="photographyDate" className="listing-date-label">Photography</label>
            <input
              id="photographyDate"
              type="date"
              className="tool-input"
              value={setup.photographyDate}
              onChange={e => onChange({ photographyDate: e.target.value })}
            />
          </div>
          <div className="listing-date-field">
            <label htmlFor="listingDate" className="listing-date-label">Listing goes live</label>
            <input
              id="listingDate"
              type="date"
              className="tool-input"
              value={setup.listingDate}
              onChange={e => onChange({ listingDate: e.target.value })}
            />
          </div>
          <div className="listing-date-field">
            <label htmlFor="showingDate" className="listing-date-label">First showing or open house</label>
            <input
              id="showingDate"
              type="date"
              className="tool-input"
              value={setup.showingDate}
              onChange={e => onChange({ showingDate: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="tool-question">
        <label htmlFor="planNotes" className="tool-question-legend">
          Overall preparation notes <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <textarea
          id="planNotes"
          className="tool-textarea"
          rows={3}
          placeholder="Any context, goals, or details you want to keep with this plan"
          value={setup.planNotes}
          onChange={e => onChange({ planNotes: e.target.value })}
        />
      </div>
    </div>
  )
}
