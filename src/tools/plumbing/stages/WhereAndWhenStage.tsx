import { OptionCard } from '../../core/components/OptionCard'
import type { PlumbingAnswers, HomeArea, TimelineAnswer, ChangeAnswer, HistoryAnswer, WaterElsewhereAnswer } from '../plumbingTypes'

interface Props {
  answers: PlumbingAnswers
  onChange: (partial: Partial<PlumbingAnswers>) => void
  showErrors: boolean
}

const HOME_AREA_OPTIONS = [
  { value: 'kitchen',        label: 'Kitchen' },
  { value: 'main_bathroom',  label: 'Main bathroom' },
  { value: 'other_bathroom', label: 'Second or additional bathroom' },
  { value: 'laundry',        label: 'Laundry room or utility area' },
  { value: 'basement',       label: 'Basement or crawl space' },
  { value: 'outdoors',       label: 'Outdoors or yard area' },
  { value: 'multiple',       label: 'Throughout the home / multiple areas' },
  { value: 'not_sure',       label: "I'm not sure" },
]

const TIMELINE_OPTIONS = [
  { value: 'today',               label: 'Today' },
  { value: 'last_few_days',       label: 'Within the last few days' },
  { value: 'week_or_two',         label: 'About a week or two ago' },
  { value: 'more_than_two_weeks', label: 'More than two weeks ago' },
  { value: 'not_sure',            label: "I'm not sure" },
]

const CHANGE_OPTIONS = [
  { value: 'getting_worse',   label: 'It seems to be getting worse' },
  { value: 'same',            label: 'About the same' },
  { value: 'comes_and_goes',  label: 'It comes and goes' },
  { value: 'may_be_settling', label: 'It may be settling on its own' },
  { value: 'not_sure',        label: "I'm not sure" },
]

const HISTORY_OPTIONS = [
  { value: 'yes_same',      label: 'Yes — the same issue has come back' },
  { value: 'yes_different', label: 'Something similar, but this seems different' },
  { value: 'no_first_time', label: 'No — this is the first time' },
  { value: 'not_sure',      label: "I'm not sure" },
]

const WATER_ELSEWHERE_OPTIONS = [
  { value: 'yes_normal',     label: 'Yes — everything else seems normal' },
  { value: 'partially',      label: 'Partially — some other areas are also affected' },
  { value: 'no_unavailable', label: 'No — water seems unavailable or off throughout' },
  { value: 'not_checked',    label: "I haven't checked yet" },
]

export function WhereAndWhenStage({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.homeArea ? ' has-error' : ''}`}>
            Where in your home is the issue?
          </legend>
          <div className="option-cards">
            {HOME_AREA_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`homeArea-${opt.value}`}
                name="homeArea"
                value={opt.value}
                label={opt.label}
                checked={answers.homeArea === opt.value}
                type="radio"
                onChange={val => onChange({ homeArea: val as HomeArea })}
                hasError={showErrors && !answers.homeArea}
              />
            ))}
          </div>
          {showErrors && !answers.homeArea && (
            <span className="tool-question-error" role="alert">Please select a location.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <label htmlFor="fixture" className="tool-question-legend">
          Any specific fixture or area you can point to? <span className="tool-question-optional">(optional)</span>
        </label>
        <input
          id="fixture"
          type="text"
          className="tool-input"
          placeholder="e.g., kitchen sink, upstairs shower, water heater, outdoor spigot"
          value={answers.fixture}
          onChange={e => onChange({ fixture: e.target.value })}
        />
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.firstNoticed ? ' has-error' : ''}`}>
            When did you first notice this?
          </legend>
          <div className="option-cards">
            {TIMELINE_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`firstNoticed-${opt.value}`}
                name="firstNoticed"
                value={opt.value}
                label={opt.label}
                checked={answers.firstNoticed === opt.value}
                type="radio"
                onChange={val => onChange({ firstNoticed: val as TimelineAnswer })}
                hasError={showErrors && !answers.firstNoticed}
              />
            ))}
          </div>
          {showErrors && !answers.firstNoticed && (
            <span className="tool-question-error" role="alert">Please select when you first noticed this.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.changeAnswer ? ' has-error' : ''}`}>
            Has the situation changed since you first noticed it?
          </legend>
          <div className="option-cards">
            {CHANGE_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`changeAnswer-${opt.value}`}
                name="changeAnswer"
                value={opt.value}
                label={opt.label}
                checked={answers.changeAnswer === opt.value}
                type="radio"
                onChange={val => onChange({ changeAnswer: val as ChangeAnswer })}
                hasError={showErrors && !answers.changeAnswer}
              />
            ))}
          </div>
          {showErrors && !answers.changeAnswer && (
            <span className="tool-question-error" role="alert">Please select how it has changed.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.history ? ' has-error' : ''}`}>
            Has something like this happened before?
          </legend>
          <div className="option-cards">
            {HISTORY_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`history-${opt.value}`}
                name="history"
                value={opt.value}
                label={opt.label}
                checked={answers.history === opt.value}
                type="radio"
                onChange={val => onChange({ history: val as HistoryAnswer })}
                hasError={showErrors && !answers.history}
              />
            ))}
          </div>
          {showErrors && !answers.history && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.waterElsewhere ? ' has-error' : ''}`}>
            Can you use water normally in other areas of your home?
          </legend>
          <div className="option-cards">
            {WATER_ELSEWHERE_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`waterElsewhere-${opt.value}`}
                name="waterElsewhere"
                value={opt.value}
                label={opt.label}
                checked={answers.waterElsewhere === opt.value}
                type="radio"
                onChange={val => onChange({ waterElsewhere: val as WaterElsewhereAnswer })}
                hasError={showErrors && !answers.waterElsewhere}
              />
            ))}
          </div>
          {showErrors && !answers.waterElsewhere && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>
      </div>
    </div>
  )
}
