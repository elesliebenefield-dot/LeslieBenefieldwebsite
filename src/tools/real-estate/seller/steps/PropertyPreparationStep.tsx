import { OptionCard } from '../../../core/components/OptionCard'
import type { SellerAnswers } from '../sellerTypes'

interface Props {
  answers: SellerAnswers
  onChange: (partial: Partial<SellerAnswers>) => void
  showErrors: boolean
}

const KNOWN_REPAIRS_OPTIONS = [
  { value: 'yesList', label: 'Yes — I have a list in mind' },
  { value: 'maybeFew', label: 'Maybe a few items' },
  { value: 'noneAware', label: "None that I'm aware of" },
  { value: 'notSure', label: "Not sure" },
]

const DECLUTTER_OPTIONS = [
  { value: 'done', label: 'Done or nearly complete' },
  { value: 'inProgress', label: 'In progress' },
  { value: 'planned', label: 'Planned but not started' },
  { value: 'notSure', label: "Haven't thought about it yet" },
]

const IMPROVEMENTS_OPTIONS = [
  { value: 'yesMajor', label: 'Yes — major renovations or additions' },
  { value: 'yesMinor', label: 'Yes — minor updates or cosmetic work' },
  { value: 'none', label: 'No significant improvements' },
]

const ACCESS_OPTIONS = [
  { value: 'straightforward', label: 'Should be straightforward' },
  { value: 'needsCoordination', label: 'Will need some coordination' },
  { value: 'haveQuestions', label: 'I have questions about this' },
]

const PREP_QUESTIONS_OPTIONS = [
  { value: 'yes', label: 'Yes, I have questions' },
  { value: 'no', label: 'No, I feel prepared' },
  { value: 'notSure', label: 'Not sure yet' },
]

export function PropertyPreparationStep({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.knownRepairs ? ' has-error' : ''}`}>
            Are there known repairs or deferred maintenance?
          </legend>
          <div className="option-cards">
            {KNOWN_REPAIRS_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`knownRepairs-${opt.value}`}
                name="knownRepairs"
                value={opt.value}
                label={opt.label}
                checked={answers.knownRepairs === opt.value}
                type="radio"
                onChange={val => onChange({ knownRepairs: val })}
                hasError={showErrors && !answers.knownRepairs}
              />
            ))}
          </div>
          {showErrors && !answers.knownRepairs && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.declutterStatus ? ' has-error' : ''}`}>
            How is your decluttering and packing plan?
          </legend>
          <div className="option-cards">
            {DECLUTTER_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`declutterStatus-${opt.value}`}
                name="declutterStatus"
                value={opt.value}
                label={opt.label}
                checked={answers.declutterStatus === opt.value}
                type="radio"
                onChange={val => onChange({ declutterStatus: val })}
                hasError={showErrors && !answers.declutterStatus}
              />
            ))}
          </div>
          {showErrors && !answers.declutterStatus && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.recentImprovements ? ' has-error' : ''}`}>
            Have you made significant improvements to the property recently?
          </legend>
          <div className="option-cards">
            {IMPROVEMENTS_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`recentImprovements-${opt.value}`}
                name="recentImprovements"
                value={opt.value}
                label={opt.label}
                checked={answers.recentImprovements === opt.value}
                type="radio"
                onChange={val => onChange({ recentImprovements: val })}
                hasError={showErrors && !answers.recentImprovements}
              />
            ))}
          </div>
          {showErrors && !answers.recentImprovements && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.accessArrangement ? ' has-error' : ''}`}>
            How is access for showings?
          </legend>
          <div className="option-cards">
            {ACCESS_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`accessArrangement-${opt.value}`}
                name="accessArrangement"
                value={opt.value}
                label={opt.label}
                checked={answers.accessArrangement === opt.value}
                type="radio"
                onChange={val => onChange({ accessArrangement: val })}
                hasError={showErrors && !answers.accessArrangement}
              />
            ))}
          </div>
          {showErrors && !answers.accessArrangement && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.prepQuestions ? ' has-error' : ''}`}>
            Do you have questions about preparing your property for listing?
          </legend>
          <div className="option-cards">
            {PREP_QUESTIONS_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`prepQuestions-${opt.value}`}
                name="prepQuestions"
                value={opt.value}
                label={opt.label}
                checked={answers.prepQuestions === opt.value}
                type="radio"
                onChange={val => onChange({ prepQuestions: val })}
                hasError={showErrors && !answers.prepQuestions}
              />
            ))}
          </div>
          {showErrors && !answers.prepQuestions && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>
    </div>
  )
}
