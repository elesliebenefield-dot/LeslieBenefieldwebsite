import { OptionCard } from '../../../core/components/OptionCard'
import type { SellerAnswers } from '../sellerTypes'

interface Props {
  answers: SellerAnswers
  onChange: (partial: Partial<SellerAnswers>) => void
}

const PRIORITY_OPTIONS = [
  { value: 'timing', label: 'Getting the timing right' },
  { value: 'process', label: 'Understanding the full process' },
  { value: 'preparation', label: 'Making the home show-ready' },
  { value: 'coordination', label: 'Coordinating with a home purchase' },
  { value: 'disruption', label: 'Minimizing disruption during the sale' },
  { value: 'listing', label: 'Getting listed quickly' },
]

function togglePriority(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter(v => v !== value)
    : [...current, value]
}

export function PrioritiesStep({ answers, onChange }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className="tool-question-legend">
            Which of these are most important to you?
            <span className="tool-question-optional-tag">(select all that apply — optional)</span>
          </legend>
          <div className="option-cards">
            {PRIORITY_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`priority-${opt.value}`}
                name="priorities"
                value={opt.value}
                label={opt.label}
                checked={answers.priorities.includes(opt.value)}
                type="checkbox"
                onChange={val => onChange({ priorities: togglePriority(answers.priorities, val) })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="tool-question">
        <label htmlFor="agentQuestions" className="tool-question-legend">
          Are there specific questions you'd like to discuss with an agent?
          <span className="tool-question-optional-tag">(optional)</span>
        </label>
        <textarea
          id="agentQuestions"
          className="tool-textarea"
          value={answers.agentQuestions}
          onChange={e => onChange({ agentQuestions: e.target.value })}
          placeholder="List any questions here — they will appear in your planning summary."
          rows={4}
        />
        <span className="tool-input-note">
          Your answers stay in your browser — nothing is stored or transmitted.
        </span>
      </div>
    </div>
  )
}
