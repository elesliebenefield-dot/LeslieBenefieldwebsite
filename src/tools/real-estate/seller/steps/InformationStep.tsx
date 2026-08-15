import { OptionCard } from '../../../core/components/OptionCard'
import type { SellerAnswers } from '../sellerTypes'

interface Props {
  answers: SellerAnswers
  onChange: (partial: Partial<SellerAnswers>) => void
  showErrors: boolean
}

const HOA_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'notSure', label: "I'm not sure" },
]

const DOCUMENTS_OPTIONS = [
  { value: 'surveys', label: 'Survey documents' },
  { value: 'permits', label: 'Building permits for renovations' },
  { value: 'warranties', label: 'Appliance or system warranties' },
  { value: 'hoa', label: 'HOA documents (CC&Rs, meeting minutes)' },
  { value: 'taxRecords', label: 'Recent property tax records' },
  { value: 'none', label: 'None of these' },
]

const MULTIPLE_OWNERS_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No — just me, or just us as a couple' },
  { value: 'possibly', label: 'Possibly — I need to confirm' },
]

const TIMING_OPTIONS = [
  { value: 'yes', label: 'Yes — I have specific timing constraints' },
  { value: 'flexible', label: 'Mostly flexible, but prefer certain months' },
  { value: 'open', label: 'No particular timing constraints' },
]

function toggleDocument(current: string[], value: string): string[] {
  if (value === 'none') {
    return current.includes('none') ? [] : ['none']
  }
  const withoutNone = current.filter(v => v !== 'none')
  return withoutNone.includes(value)
    ? withoutNone.filter(v => v !== value)
    : [...withoutNone, value]
}

export function InformationStep({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.hoaInvolvement ? ' has-error' : ''}`}>
            Does your property have a homeowners association (HOA)?
          </legend>
          <div className="option-cards">
            {HOA_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`hoa-${opt.value}`}
                name="hoaInvolvement"
                value={opt.value}
                label={opt.label}
                checked={answers.hoaInvolvement === opt.value}
                type="radio"
                onChange={val => onChange({ hoaInvolvement: val })}
                hasError={showErrors && !answers.hoaInvolvement}
              />
            ))}
          </div>
          {showErrors && !answers.hoaInvolvement && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className="tool-question-legend">
            Which of these documents do you currently have access to?
            <span className="tool-question-optional-tag">(select all that apply)</span>
          </legend>
          <div className="option-cards">
            {DOCUMENTS_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`doc-${opt.value}`}
                name="documentsAvailable"
                value={opt.value}
                label={opt.label}
                checked={answers.documentsAvailable.includes(opt.value)}
                type="checkbox"
                onChange={val => onChange({ documentsAvailable: toggleDocument(answers.documentsAvailable, val) })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.multipleOwners ? ' has-error' : ''}`}>
            Are there multiple owners on the deed?
          </legend>
          <div className="option-cards">
            {MULTIPLE_OWNERS_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`multipleOwners-${opt.value}`}
                name="multipleOwners"
                value={opt.value}
                label={opt.label}
                checked={answers.multipleOwners === opt.value}
                type="radio"
                onChange={val => onChange({ multipleOwners: val })}
                hasError={showErrors && !answers.multipleOwners}
              />
            ))}
          </div>
          {showErrors && !answers.multipleOwners && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.timingComplications ? ' has-error' : ''}`}>
            Are there timing complications we should plan around?
          </legend>
          <div className="option-cards">
            {TIMING_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`timing-${opt.value}`}
                name="timingComplications"
                value={opt.value}
                label={opt.label}
                checked={answers.timingComplications === opt.value}
                type="radio"
                onChange={val => onChange({ timingComplications: val })}
                hasError={showErrors && !answers.timingComplications}
              />
            ))}
          </div>
          {showErrors && !answers.timingComplications && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>
    </div>
  )
}
