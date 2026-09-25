import { OptionCard } from '../../core/components/OptionCard'
import type { BakeryAnswers } from '../bakeryTypes'

interface Props {
  answers: BakeryAnswers
  onChange: (partial: Partial<BakeryAnswers>) => void
  showErrors: boolean
}

const BUDGET_OPTIONS = [
  { value: 'under_75',      label: 'Under $75' },
  { value: '75_150',        label: '$75–$150' },
  { value: '150_300',       label: '$150–$300' },
  { value: '300_plus',      label: '$300 or more' },
  { value: 'prefer_not_say',label: 'Prefer not to say' },
]

export function TimingDetailsStage({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      {/* Timing note */}
      <div className="tool-question">
        <label htmlFor="timingNote" className="tool-question-legend">
          Timing notes <span className="tool-question-optional">(optional)</span>
        </label>
        <p className="tool-question-hint">
          Any details about pickup, delivery, or flexibility — e.g., "can pick up the evening before" or "date is somewhat flexible."
        </p>
        <textarea
          id="timingNote"
          className="tool-textarea"
          rows={2}
          placeholder="e.g., can pick up the evening before the party"
          value={answers.timingNote}
          onChange={e => onChange({ timingNote: e.target.value })}
        />
      </div>

      {/* Budget */}
      <div className="tool-question">
        <fieldset className="tool-question-fieldset" aria-describedby={showErrors && !answers.budget ? 'budget-error' : undefined}>
          <legend className={`tool-question-legend${showErrors && !answers.budget ? ' has-error' : ''}`}>
            Approximate budget
          </legend>
          <div className="option-cards">
            {BUDGET_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`budget-${opt.value}`}
                name="budget"
                value={opt.value}
                label={opt.label}
                checked={answers.budget === opt.value}
                type="radio"
                onChange={val => onChange({ budget: val as BakeryAnswers['budget'] })}
                hasError={showErrors && !answers.budget}
              />
            ))}
          </div>
          {showErrors && !answers.budget && (
            <span id="budget-error" className="tool-question-error" role="alert">Please select a budget range.</span>
          )}
        </fieldset>
      </div>

      {/* Dietary restrictions */}
      <div className="tool-question">
        <label htmlFor="dietaryRestrictions" className="tool-question-legend">
          Dietary or allergy information <span className="tool-question-optional">(optional)</span>
        </label>
        <p className="tool-question-hint">
          List any known allergies or dietary needs for guests who will be eating this order.
        </p>
        <textarea
          id="dietaryRestrictions"
          className="tool-textarea"
          rows={3}
          placeholder="e.g., one guest has a severe nut allergy; another is gluten-free"
          value={answers.dietaryRestrictions}
          onChange={e => onChange({ dietaryRestrictions: e.target.value })}
        />
        <p className="bakery-dietary-disclaimer" role="note">
          Dietary and allergy information must be confirmed directly with the bakery. Completing this planner does not guarantee allergen-free preparation or accommodation.
        </p>
      </div>

      {/* Questions */}
      <div className="tool-question">
        <label htmlFor="questionsForBaker" className="tool-question-legend">
          Questions for the baker <span className="tool-question-optional">(optional)</span>
        </label>
        <textarea
          id="questionsForBaker"
          className="tool-textarea"
          rows={4}
          placeholder="e.g., Do you offer a gluten-free sponge option? Can you match a specific sage green if I send a photo?"
          value={answers.questionsForBaker}
          onChange={e => onChange({ questionsForBaker: e.target.value })}
        />
      </div>
    </div>
  )
}
