import { OptionCard } from '../../../core/components/OptionCard'
import type { BuyerAnswers } from '../buyerTypes'

interface Props {
  answers: BuyerAnswers
  onChange: (partial: Partial<BuyerAnswers>) => void
  showErrors: boolean
}

const FINANCING_OPTIONS = [
  { value: 'notSpoken', label: "I haven't spoken with a lender yet" },
  { value: 'begun', label: "I've started conversations with a lender" },
  { value: 'preapproved', label: "I have a pre-approval letter" },
  { value: 'noFinancing', label: "I plan to purchase without a loan" },
  { value: 'unsure', label: "I'm not sure yet" },
]

export function FinancingStep({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.financingStatus ? ' has-error' : ''}`}>
            Where are you in the financing process?
          </legend>
          <div className="option-cards">
            {FINANCING_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`financingStatus-${opt.value}`}
                name="financingStatus"
                value={opt.value}
                label={opt.label}
                checked={answers.financingStatus === opt.value}
                type="radio"
                onChange={val => onChange({ financingStatus: val })}
                hasError={showErrors && !answers.financingStatus}
              />
            ))}
          </div>
          {showErrors && !answers.financingStatus && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>
    </div>
  )
}
