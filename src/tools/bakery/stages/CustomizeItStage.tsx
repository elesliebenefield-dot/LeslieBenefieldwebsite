import type { BakeryAnswers } from '../bakeryTypes'
import { getSizeQuantityPlaceholder } from '../bakeryTypes'

interface Props {
  answers: BakeryAnswers
  onChange: (partial: Partial<BakeryAnswers>) => void
  showErrors: boolean
}

export function CustomizeItStage({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      {/* Size & quantity */}
      <div className="tool-question">
        <label
          htmlFor="sizeQuantity"
          className={`tool-question-legend${showErrors && !answers.sizeQuantity.trim() ? ' has-error' : ''}`}
        >
          Size and quantity
        </label>
        <input
          id="sizeQuantity"
          type="text"
          className={`tool-input${showErrors && !answers.sizeQuantity.trim() ? ' tool-input--error' : ''}`}
          placeholder={getSizeQuantityPlaceholder(answers.productType)}
          value={answers.sizeQuantity}
          onChange={e => onChange({ sizeQuantity: e.target.value })}
          aria-required="true"
        />
        {showErrors && !answers.sizeQuantity.trim() && (
          <span className="tool-question-error" role="alert">Please describe the size and quantity.</span>
        )}
      </div>

      {/* Inscription */}
      <div className="tool-question">
        <label
          htmlFor="inscriptionText"
          className={`tool-question-legend${showErrors && !answers.noInscription && !answers.inscriptionText.trim() ? ' has-error' : ''}`}
        >
          What would you like written on it?
        </label>
        <p className="tool-question-hint">Include exact wording, names, or dates as you'd like them to appear.</p>
        <div className="bakery-inscription-row">
          <label className="bakery-inline-check">
            <input
              type="checkbox"
              checked={answers.noInscription}
              onChange={e => onChange({ noInscription: e.target.checked, inscriptionText: e.target.checked ? '' : answers.inscriptionText })}
            />
            <span className="bakery-inline-check-label">No inscription needed</span>
          </label>
        </div>
        {!answers.noInscription && (
          <textarea
            id="inscriptionText"
            className="tool-textarea"
            rows={3}
            placeholder='e.g., Happy 40th, Mom! ❤️'
            value={answers.inscriptionText}
            onChange={e => onChange({ inscriptionText: e.target.value })}
            aria-required="true"
          />
        )}
        {showErrors && !answers.noInscription && !answers.inscriptionText.trim() && (
          <span className="tool-question-error" role="alert">
            Enter the inscription text, or check "No inscription needed."
          </span>
        )}
      </div>

      {/* Colors */}
      <div className="tool-question">
        <label htmlFor="colors" className="tool-question-legend">
          Colors or palette <span className="tool-question-optional">(optional)</span>
        </label>
        <input
          id="colors"
          type="text"
          className="tool-input"
          placeholder="e.g., sage green, cream, and gold"
          value={answers.colors}
          onChange={e => onChange({ colors: e.target.value })}
        />
        <div className="bakery-inscription-row" style={{ marginTop: '0.5rem' }}>
          <label className="bakery-inline-check">
            <input
              type="checkbox"
              checked={answers.openToColorSuggestions}
              onChange={e => onChange({ openToColorSuggestions: e.target.checked })}
            />
            <span className="bakery-inline-check-label">Open to the baker's suggestions</span>
          </label>
        </div>
      </div>

      {/* Style / theme */}
      <div className="tool-question">
        <label htmlFor="styleTheme" className="tool-question-legend">
          Style or theme <span className="tool-question-optional">(optional)</span>
        </label>
        <p className="tool-question-hint">Describe the look and feel you have in mind.</p>
        <textarea
          id="styleTheme"
          className="tool-textarea"
          rows={3}
          placeholder="e.g., elegant and modern, no cartoon characters — clean lines with a floral accent"
          value={answers.styleTheme}
          onChange={e => onChange({ styleTheme: e.target.value })}
        />
      </div>
    </div>
  )
}
