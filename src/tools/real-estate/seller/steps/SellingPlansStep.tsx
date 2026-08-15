import { OptionCard } from '../../../core/components/OptionCard'
import type { SellerAnswers } from '../sellerTypes'

interface Props {
  answers: SellerAnswers
  onChange: (partial: Partial<SellerAnswers>) => void
  showErrors: boolean
}

const TIMEFRAME_OPTIONS = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '3to6', label: 'Within 3–6 months' },
  { value: '6to12', label: 'Within 6–12 months' },
  { value: 'over12', label: 'More than 12 months from now' },
  { value: 'notSure', label: "I'm not sure yet" },
]

const STAGE_OPTIONS = [
  { value: 'exploring', label: 'Just exploring my options' },
  { value: 'preparing', label: 'Actively preparing to sell' },
  { value: 'ready', label: 'Ready to begin the listing process' },
]

const COORDINATION_OPTIONS = [
  { value: 'sellOnly', label: "No — I'm only selling" },
  { value: 'buyFirst', label: "I'm buying another home first" },
  { value: 'sellFirst', label: "I'll purchase after selling" },
  { value: 'simultaneously', label: 'Aiming to do both at the same time' },
  { value: 'notSure', label: "Not sure yet" },
]

export function SellingPlansStep({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.timeframe ? ' has-error' : ''}`}>
            When are you hoping to list?
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
            Where are you in the selling process?
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
          <legend className={`tool-question-legend${showErrors && !answers.coordination ? ' has-error' : ''}`}>
            Does your home sale need to coordinate with a purchase?
          </legend>
          <div className="option-cards">
            {COORDINATION_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`coordination-${opt.value}`}
                name="coordination"
                value={opt.value}
                label={opt.label}
                checked={answers.coordination === opt.value}
                type="radio"
                onChange={val => onChange({ coordination: val })}
                hasError={showErrors && !answers.coordination}
              />
            ))}
          </div>
          {showErrors && !answers.coordination && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>
    </div>
  )
}
