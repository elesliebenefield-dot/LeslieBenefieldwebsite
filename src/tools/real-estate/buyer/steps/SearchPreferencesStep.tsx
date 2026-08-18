import { OptionCard } from '../../../core/components/OptionCard'
import type { BuyerAnswers } from '../buyerTypes'

interface Props {
  answers: BuyerAnswers
  onChange: (partial: Partial<BuyerAnswers>) => void
  showErrors: boolean
}

const PROPERTY_TYPE_OPTIONS = [
  { value: 'singleFamily', label: 'Single-family home' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhome', label: 'Townhome' },
  { value: 'multiUnit', label: 'Multi-unit property' },
  { value: 'openToAll', label: 'Open to different types' },
]

const FEATURE_OPTIONS = [
  { value: 'garage', label: 'Garage or covered parking' },
  { value: 'yard', label: 'Private yard or outdoor space' },
  { value: 'homeOffice', label: 'Home office space' },
  { value: 'primaryMain', label: 'Primary bedroom on main floor' },
  { value: 'storage', label: 'Ample storage' },
  { value: 'accessibility', label: 'Accessibility features' },
  { value: 'newConstruction', label: 'New or recent construction' },
  { value: 'openLayout', label: 'Open floor plan' },
]

const TARGET_AREA_OPTIONS = [
  { value: 'yes', label: 'Yes — I have a specific area in mind' },
  { value: 'no', label: "No — I haven't defined an area yet" },
  { value: 'open', label: "I'm open and would like guidance" },
]

function togglePropertyType(current: string[], value: string): string[] {
  if (value === 'openToAll') {
    return current.includes('openToAll') ? [] : ['openToAll']
  }
  const withoutOpen = current.filter(v => v !== 'openToAll')
  return withoutOpen.includes(value)
    ? withoutOpen.filter(v => v !== value)
    : [...withoutOpen, value]
}

export function SearchPreferencesStep({ answers, onChange, showErrors }: Props) {
  function handleMustHaveChange(val: string) {
    const isAdding = !answers.mustHaves.includes(val)
    const newMustHaves = isAdding
      ? [...answers.mustHaves, val]
      : answers.mustHaves.filter(v => v !== val)
    const newNiceToHaves = isAdding
      ? answers.niceToHaves.filter(v => v !== val)
      : answers.niceToHaves
    onChange({ mustHaves: newMustHaves, niceToHaves: newNiceToHaves })
  }

  function handleNiceToHaveChange(val: string) {
    const isAdding = !answers.niceToHaves.includes(val)
    const newNiceToHaves = isAdding
      ? [...answers.niceToHaves, val]
      : answers.niceToHaves.filter(v => v !== val)
    const newMustHaves = isAdding
      ? answers.mustHaves.filter(v => v !== val)
      : answers.mustHaves
    onChange({ mustHaves: newMustHaves, niceToHaves: newNiceToHaves })
  }

  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className="tool-question-legend">
            What types of properties are you interested in?
            <span className="tool-question-optional-tag">(select all that apply — optional)</span>
          </legend>
          <div className="option-cards">
            {PROPERTY_TYPE_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`propertyTypes-${opt.value}`}
                name="propertyTypes"
                value={opt.value}
                label={opt.label}
                checked={answers.propertyTypes.includes(opt.value)}
                type="checkbox"
                onChange={val => onChange({ propertyTypes: togglePropertyType(answers.propertyTypes, val) })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className="tool-question-legend">
            Which features are must-haves for you?
            <span className="tool-question-optional-tag">(select all that apply — optional)</span>
          </legend>
          <p className="tool-question-hint">Selecting a feature here will remove it from the other category.</p>
          <div className="option-cards">
            {FEATURE_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`mustHaves-${opt.value}`}
                name="mustHaves"
                value={opt.value}
                label={opt.label}
                checked={answers.mustHaves.includes(opt.value)}
                type="checkbox"
                onChange={handleMustHaveChange}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className="tool-question-legend">
            Which features would be nice to have but are not required?
            <span className="tool-question-optional-tag">(select all that apply — optional)</span>
          </legend>
          <p className="tool-question-hint">Selecting a feature here will remove it from the other category.</p>
          <div className="option-cards">
            {FEATURE_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`niceToHaves-${opt.value}`}
                name="niceToHaves"
                value={opt.value}
                label={opt.label}
                checked={answers.niceToHaves.includes(opt.value)}
                type="checkbox"
                onChange={handleNiceToHaveChange}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.hasTargetArea ? ' has-error' : ''}`}>
            Do you have a target area or neighborhood in mind?
          </legend>
          <div className="option-cards">
            {TARGET_AREA_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`hasTargetArea-${opt.value}`}
                name="hasTargetArea"
                value={opt.value}
                label={opt.label}
                checked={answers.hasTargetArea === opt.value}
                type="radio"
                onChange={val => onChange({ hasTargetArea: val })}
                hasError={showErrors && !answers.hasTargetArea}
              />
            ))}
          </div>
          {showErrors && !answers.hasTargetArea && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>
    </div>
  )
}
