import { OptionCard } from '../../core/components/OptionCard'
import type { FoodTruckAnswers, ServiceType, PaymentArrangement, BudgetRange } from '../foodTruckTypes'
import {
  ALL_SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  PAYMENT_LABELS,
  BUDGET_LABELS,
} from '../foodTruckTypes'

interface Props {
  answers: FoodTruckAnswers
  onChange: (partial: Partial<FoodTruckAnswers>) => void
  showErrors: boolean
}

type PaymentKey = Exclude<PaymentArrangement, ''>
type BudgetKey  = Exclude<BudgetRange, ''>

export function FoodAndServiceStage({ answers, onChange, showErrors }: Props) {
  const serviceTypeError = showErrors && answers.serviceTypes.length === 0
  const paymentError     = showErrors && !answers.paymentArrangement

  function handleServiceTypeToggle(value: string, checked: boolean) {
    const t = value as ServiceType
    const current = answers.serviceTypes
    const next = checked
      ? current.includes(t) ? current : [...current, t]
      : current.filter(s => s !== t)
    onChange({ serviceTypes: next })
  }

  return (
    <div>
      {/* Q8 — Service type (multi-select) */}
      <div className="tool-question">
        <fieldset aria-describedby={serviceTypeError ? 'serviceType-error' : undefined}>
          <legend className={`tool-question-legend${serviceTypeError ? ' has-error' : ''}`}>
            What type of service are you looking for?
            <span className="tool-question-required" aria-hidden="true"> *</span>
          </legend>
          <p className="tool-question-hint" style={{ marginBottom: '0.75rem' }}>Select all that apply.</p>
          {serviceTypeError && (
            <span id="serviceType-error" className="tool-question-error" role="alert">Please select at least one service type.</span>
          )}
          <div className="option-cards">
            {ALL_SERVICE_TYPES.map(key => (
              <OptionCard
                key={key}
                id={`serviceType-${key}`}
                name="serviceType"
                value={key}
                label={SERVICE_TYPE_LABELS[key]}
                checked={answers.serviceTypes.includes(key)}
                type="checkbox"
                onChange={handleServiceTypeToggle}
                hasError={serviceTypeError}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q8b — Additional interests */}
      <div className="tool-question">
        <label htmlFor="additionalInterests" className="tool-question-legend">
          Additional menu interests <span className="tool-question-optional">(optional)</span>
        </label>
        <textarea
          id="additionalInterests"
          className="tool-textarea"
          rows={2}
          placeholder="e.g., 'Also interested in desserts if available' or 'Hoping for a vegetarian-friendly main option'"
          value={answers.additionalInterests}
          onChange={e => onChange({ additionalInterests: e.target.value })}
        />
      </div>

      {/* Q9 — Payment arrangement */}
      <div className="tool-question">
        <fieldset aria-describedby={paymentError ? 'paymentArrangement-error' : undefined}>
          <legend className={`tool-question-legend${paymentError ? ' has-error' : ''}`}>
            How will guests pay for food and drink?
            <span className="tool-question-required" aria-hidden="true"> *</span>
          </legend>
          {paymentError && (
            <span id="paymentArrangement-error" className="tool-question-error" role="alert">Please select a payment arrangement.</span>
          )}
          <div className="option-cards">
            {(Object.keys(PAYMENT_LABELS) as PaymentKey[]).map(key => (
              <OptionCard
                key={key}
                id={`paymentArrangement-${key}`}
                name="paymentArrangement"
                value={key}
                label={PAYMENT_LABELS[key]}
                checked={answers.paymentArrangement === key}
                type="radio"
                onChange={val => onChange({ paymentArrangement: val as PaymentArrangement })}
                hasError={paymentError}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q10 — Budget */}
      <div className="tool-question">
        <fieldset>
          <legend className="tool-question-legend">
            Do you have a budget in mind for food service? <span className="tool-question-optional">(optional)</span>
          </legend>
          <div className="option-cards">
            {(Object.keys(BUDGET_LABELS) as BudgetKey[]).map(key => (
              <OptionCard
                key={key}
                id={`budget-${key}`}
                name="budget"
                value={key}
                label={BUDGET_LABELS[key]}
                checked={answers.budget === key}
                type="radio"
                onChange={val => onChange({ budget: val as BudgetRange })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q11 — Dietary notes */}
      <div className="tool-question">
        <label htmlFor="dietaryNotes" className="tool-question-legend">
          Dietary or allergy information <span className="tool-question-optional">(optional)</span>
        </label>
        <textarea
          id="dietaryNotes"
          className="tool-textarea"
          rows={2}
          placeholder="e.g., 'Several guests are vegetarian' or 'Nut allergy awareness is needed for this group'"
          value={answers.dietaryNotes}
          onChange={e => onChange({ dietaryNotes: e.target.value })}
        />
        <p className="food-truck-dietary-caution" role="note">
          Dietary and allergy information must be confirmed directly with the vendor. This inquiry does not guarantee any dietary accommodation.
        </p>
      </div>

      {/* Q12 — Guests served */}
      <div className="tool-question">
        <label htmlFor="guestsServed" className="tool-question-legend">
          Estimated guests to be served <span className="tool-question-optional">(optional)</span>
        </label>
        <input
          id="guestsServed"
          type="text"
          className="tool-input"
          placeholder="e.g., '150 of 300 guests are in the meal package' or 'All 75 guests'"
          value={answers.guestsServed}
          onChange={e => onChange({ guestsServed: e.target.value })}
        />
        <p className="tool-question-hint">Only fill this in if it differs significantly from your total attendance.</p>
      </div>
    </div>
  )
}
