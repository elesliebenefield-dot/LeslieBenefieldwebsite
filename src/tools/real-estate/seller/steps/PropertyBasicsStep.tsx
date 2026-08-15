import { OptionCard } from '../../../core/components/OptionCard'
import type { SellerAnswers } from '../sellerTypes'

interface Props {
  answers: SellerAnswers
  onChange: (partial: Partial<SellerAnswers>) => void
  showErrors: boolean
}

const PROPERTY_TYPE_OPTIONS = [
  { value: 'singleFamily', label: 'Single-family home' },
  { value: 'condoTownhome', label: 'Condo or townhome' },
  { value: 'multiUnit', label: 'Multi-unit (duplex, triplex, etc.)' },
  { value: 'land', label: 'Land or vacant lot' },
  { value: 'other', label: 'Other' },
]

const OCCUPANCY_OPTIONS = [
  { value: 'ownerOccupied', label: 'I live there' },
  { value: 'vacant', label: 'Currently vacant' },
  { value: 'tenantOccupied', label: 'Tenant-occupied' },
  { value: 'other', label: 'Other arrangement' },
]

const OWNERSHIP_DURATION_OPTIONS = [
  { value: 'under2', label: 'Less than 2 years' },
  { value: '2to5', label: '2–5 years' },
  { value: '5to10', label: '5–10 years' },
  { value: 'over10', label: 'More than 10 years' },
  { value: 'preferNotSay', label: 'Prefer not to say' },
]

export function PropertyBasicsStep({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.propertyType ? ' has-error' : ''}`}>
            What type of property are you selling?
          </legend>
          <div className="option-cards">
            {PROPERTY_TYPE_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`propertyType-${opt.value}`}
                name="propertyType"
                value={opt.value}
                label={opt.label}
                checked={answers.propertyType === opt.value}
                type="radio"
                onChange={val => onChange({ propertyType: val })}
                hasError={showErrors && !answers.propertyType}
              />
            ))}
          </div>
          {showErrors && !answers.propertyType && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.occupancy ? ' has-error' : ''}`}>
            How is the property currently occupied?
          </legend>
          <div className="option-cards">
            {OCCUPANCY_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`occupancy-${opt.value}`}
                name="occupancy"
                value={opt.value}
                label={opt.label}
                checked={answers.occupancy === opt.value}
                type="radio"
                onChange={val => onChange({ occupancy: val })}
                hasError={showErrors && !answers.occupancy}
              />
            ))}
          </div>
          {showErrors && !answers.occupancy && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className="tool-question-legend">
            How long have you owned the property?
            <span className="tool-question-optional-tag">(optional)</span>
          </legend>
          <div className="option-cards">
            {OWNERSHIP_DURATION_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`ownershipDuration-${opt.value}`}
                name="ownershipDuration"
                value={opt.value}
                label={opt.label}
                checked={answers.ownershipDuration === opt.value}
                type="radio"
                onChange={val => onChange({ ownershipDuration: val })}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
