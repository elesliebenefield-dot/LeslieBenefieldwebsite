import { OptionCard } from '../../../core/components/OptionCard'
import type { BuyerAnswers } from '../buyerTypes'

interface Props {
  answers: BuyerAnswers
  onChange: (partial: Partial<BuyerAnswers>) => void
  showErrors: boolean
}

const TIMEFRAME_OPTIONS = [
  { value: 'within3', label: 'Within the next 3 months' },
  { value: '3to6', label: 'Within 3–6 months' },
  { value: '6to12', label: 'Within 6–12 months' },
  { value: 'exploring', label: 'Just exploring for now' },
]

const STAGE_OPTIONS = [
  { value: 'justExploring', label: 'Just learning about the process' },
  { value: 'actively', label: 'Actively looking at homes' },
  { value: 'ready', label: 'Ready to start making offers' },
]

const PURCHASE_TYPE_OPTIONS = [
  { value: 'firstHome', label: 'A primary residence (first home)' },
  { value: 'anotherHome', label: 'A primary residence (moving from another)' },
  { value: 'investment', label: 'An investment property' },
  { value: 'land', label: 'Land or a lot' },
]

export function BuyingPlansStep({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.timeframe ? ' has-error' : ''}`}>
            When are you hoping to purchase?
          </legend>
          <div className="option-cards">
            {TIMEFRAME_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`timeframe-${opt.value}`}
                name="timeframe"
                value={opt.value}
                label={opt.label}
                checked={answers.timeframe === opt.value}
                type="radio"
                onChange={val => onChange({ timeframe: val })}
                hasError={showErrors && !answers.timeframe}
              />
            ))}
          </div>
          {showErrors && !answers.timeframe && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.stage ? ' has-error' : ''}`}>
            Where are you in the buying process?
          </legend>
          <div className="option-cards">
            {STAGE_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`stage-${opt.value}`}
                name="stage"
                value={opt.value}
                label={opt.label}
                checked={answers.stage === opt.value}
                type="radio"
                onChange={val => onChange({ stage: val })}
                hasError={showErrors && !answers.stage}
              />
            ))}
          </div>
          {showErrors && !answers.stage && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.purchaseType ? ' has-error' : ''}`}>
            What type of property are you looking to purchase?
          </legend>
          <div className="option-cards">
            {PURCHASE_TYPE_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`purchaseType-${opt.value}`}
                name="purchaseType"
                value={opt.value}
                label={opt.label}
                checked={answers.purchaseType === opt.value}
                type="radio"
                onChange={val => onChange({ purchaseType: val })}
                hasError={showErrors && !answers.purchaseType}
              />
            ))}
          </div>
          {showErrors && !answers.purchaseType && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>
    </div>
  )
}
