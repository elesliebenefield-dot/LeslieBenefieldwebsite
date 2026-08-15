import { OptionCard } from '../../../core/components/OptionCard'
import type { BuyerAnswers } from '../buyerTypes'

interface Props {
  answers: BuyerAnswers
  onChange: (partial: Partial<BuyerAnswers>) => void
  showErrors: boolean
}

const HOUSING_TIMING_OPTIONS = [
  { value: 'leaseSoon', label: 'My lease is ending soon' },
  { value: 'monthToMonth', label: "I'm on a month-to-month lease" },
  { value: 'ownNoRush', label: 'I own my current home and have flexibility' },
  { value: 'flexible', label: "I'm flexible — no immediate housing pressure" },
  { value: 'urgent', label: 'I have an urgent situation driving my timeline' },
]

const MUST_SELL_OPTIONS = [
  { value: 'yes', label: 'Yes — I need to sell before I can buy' },
  { value: 'no', label: "No — my purchase is not tied to a sale" },
  { value: 'unsure', label: "I'm not sure yet" },
]

const SHOWING_OPTIONS = [
  { value: 'flexible', label: 'Flexible — I can generally schedule showings when needed' },
  { value: 'weekendsOnly', label: 'Weekends only' },
  { value: 'limited', label: 'Limited — my schedule is constrained' },
]

const DECISION_MAKER_OPTIONS = [
  { value: 'yes', label: 'Yes — another person will be involved in the decision' },
  { value: 'no', label: "No — I'm the sole decision-maker" },
]

const MOVING_FLEXIBILITY_OPTIONS = [
  { value: 'flexible', label: "I'm flexible on when I move in" },
  { value: 'specific', label: 'I have a specific date or window I need to hit' },
  { value: 'unsure', label: "I'm not sure how flexible I can be" },
]

export function TimingStep({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.housingTiming ? ' has-error' : ''}`}>
            What best describes your current housing situation?
          </legend>
          <div className="option-cards">
            {HOUSING_TIMING_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`housingTiming-${opt.value}`}
                name="housingTiming"
                value={opt.value}
                label={opt.label}
                checked={answers.housingTiming === opt.value}
                type="radio"
                onChange={val => onChange({ housingTiming: val })}
                hasError={showErrors && !answers.housingTiming}
              />
            ))}
          </div>
          {showErrors && !answers.housingTiming && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.mustSellFirst ? ' has-error' : ''}`}>
            Does your home purchase depend on selling a home first?
          </legend>
          <div className="option-cards">
            {MUST_SELL_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`mustSellFirst-${opt.value}`}
                name="mustSellFirst"
                value={opt.value}
                label={opt.label}
                checked={answers.mustSellFirst === opt.value}
                type="radio"
                onChange={val => onChange({ mustSellFirst: val })}
                hasError={showErrors && !answers.mustSellFirst}
              />
            ))}
          </div>
          {showErrors && !answers.mustSellFirst && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.showingAvailability ? ' has-error' : ''}`}>
            How available are you for scheduling home showings?
          </legend>
          <div className="option-cards">
            {SHOWING_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`showingAvailability-${opt.value}`}
                name="showingAvailability"
                value={opt.value}
                label={opt.label}
                checked={answers.showingAvailability === opt.value}
                type="radio"
                onChange={val => onChange({ showingAvailability: val })}
                hasError={showErrors && !answers.showingAvailability}
              />
            ))}
          </div>
          {showErrors && !answers.showingAvailability && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.otherDecisionMakers ? ' has-error' : ''}`}>
            Will other people be involved in the purchase decision?
          </legend>
          <div className="option-cards">
            {DECISION_MAKER_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`otherDecisionMakers-${opt.value}`}
                name="otherDecisionMakers"
                value={opt.value}
                label={opt.label}
                checked={answers.otherDecisionMakers === opt.value}
                type="radio"
                onChange={val => onChange({ otherDecisionMakers: val })}
                hasError={showErrors && !answers.otherDecisionMakers}
              />
            ))}
          </div>
          {showErrors && !answers.otherDecisionMakers && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.movingFlexibility ? ' has-error' : ''}`}>
            How flexible is your move-in date?
          </legend>
          <div className="option-cards">
            {MOVING_FLEXIBILITY_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`movingFlexibility-${opt.value}`}
                name="movingFlexibility"
                value={opt.value}
                label={opt.label}
                checked={answers.movingFlexibility === opt.value}
                type="radio"
                onChange={val => onChange({ movingFlexibility: val })}
                hasError={showErrors && !answers.movingFlexibility}
              />
            ))}
          </div>
          {showErrors && !answers.movingFlexibility && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>
    </div>
  )
}
