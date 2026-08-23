import { OptionCard } from '../../core/components/OptionCard'
import type { PlumbingAnswers, PropertyType, AccessAnswer, RecentWorkAnswer, TimingAnswer } from '../plumbingTypes'

interface Props {
  answers: PlumbingAnswers
  onChange: (partial: Partial<PlumbingAnswers>) => void
  showErrors: boolean
}

const PROPERTY_OPTIONS = [
  { value: 'single_family',    label: 'Single-family home' },
  { value: 'condo_apartment',  label: 'Condo or apartment' },
  { value: 'townhouse_duplex', label: 'Townhouse or duplex' },
  { value: 'mobile',           label: 'Mobile or manufactured home' },
  { value: 'other',            label: "Other / I'm not sure" },
]

const ACCESS_OPTIONS = [
  { value: 'easy',         label: 'Yes, easy to reach' },
  { value: 'need_to_move', label: 'I may need to move some things first' },
  { value: 'tricky',       label: 'Access could be tricky (e.g., crawl space, tight area)' },
  { value: 'not_sure',     label: "I'm not sure" },
]

const RECENT_WORK_OPTIONS = [
  { value: 'yes',      label: 'Yes' },
  { value: 'no',       label: 'No' },
  { value: 'not_sure', label: "I'm not sure" },
]

const TIMING_OPTIONS = [
  { value: 'asap',          label: 'As soon as possible' },
  { value: 'next_few_days', label: 'Within the next few days' },
  { value: 'flexible',      label: "I'm flexible" },
  { value: 'gathering_info',label: "I'm only gathering information right now" },
]

export function AboutYourHomeStage({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.propertyType ? ' has-error' : ''}`}>
            What type of property is it?
          </legend>
          <div className="option-cards">
            {PROPERTY_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`propertyType-${opt.value}`}
                name="propertyType"
                value={opt.value}
                label={opt.label}
                checked={answers.propertyType === opt.value}
                type="radio"
                onChange={val => onChange({ propertyType: val as PropertyType })}
                hasError={showErrors && !answers.propertyType}
              />
            ))}
          </div>
          {showErrors && !answers.propertyType && (
            <span className="tool-question-error" role="alert">Please select a property type.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className="tool-question-legend">
            Is the affected area easy to access? <span className="tool-question-optional">(optional)</span>
          </legend>
          <div className="option-cards">
            {ACCESS_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`accessAnswer-${opt.value}`}
                name="accessAnswer"
                value={opt.value}
                label={opt.label}
                checked={answers.accessAnswer === opt.value}
                type="radio"
                onChange={val => onChange({ accessAnswer: val as AccessAnswer })}
                hasError={false}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="tool-question">
        <label htmlFor="accessNotes" className="tool-question-legend">
          Access notes <span className="tool-question-optional">(optional)</span>
        </label>
        <textarea
          id="accessNotes"
          className="tool-textarea"
          rows={2}
          placeholder="e.g., 'Friendly dog in yard,' 'I'll need to notify building management,' 'Narrow driveway'"
          value={answers.accessNotes}
          onChange={e => onChange({ accessNotes: e.target.value })}
        />
        <p className="tool-question-hint">
          For your privacy, don't include gate codes, alarm codes, account numbers, or other private access information.
        </p>
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.recentWork ? ' has-error' : ''}`}>
            Any plumbing work done in the past year?
          </legend>
          <div className="option-cards">
            {RECENT_WORK_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`recentWork-${opt.value}`}
                name="recentWork"
                value={opt.value}
                label={opt.label}
                checked={answers.recentWork === opt.value}
                type="radio"
                onChange={val => onChange({ recentWork: val as RecentWorkAnswer })}
                hasError={showErrors && !answers.recentWork}
              />
            ))}
          </div>
          {showErrors && !answers.recentWork && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
        </fieldset>

        {answers.recentWork === 'yes' && (
          <div style={{ marginTop: '0.75rem' }}>
            <label htmlFor="recentWorkDetail" className="tool-question-legend">
              Please briefly describe what was done <span className="tool-question-optional">(optional)</span>
            </label>
            <input
              id="recentWorkDetail"
              type="text"
              className="tool-input"
              placeholder="e.g., replaced kitchen faucet, had water heater serviced"
              value={answers.recentWorkDetail}
              onChange={e => onChange({ recentWorkDetail: e.target.value })}
            />
            <p className="tool-question-hint">
              Don't include account, invoice, or payment information.
            </p>
          </div>
        )}
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className="tool-question-legend">
            Preferred timing for the visit <span className="tool-question-optional">(optional)</span>
          </legend>
          <p className="tool-question-hint">
            This is a preference, not an appointment request.
          </p>
          <div className="option-cards">
            {TIMING_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`timing-${opt.value}`}
                name="timing"
                value={opt.value}
                label={opt.label}
                checked={answers.timing === opt.value}
                type="radio"
                onChange={val => onChange({ timing: val as TimingAnswer })}
                hasError={false}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="tool-question">
        <label htmlFor="questions" className="tool-question-legend">
          Questions or anything else for the plumber? <span className="tool-question-optional">(optional)</span>
        </label>
        <textarea
          id="questions"
          className="tool-textarea"
          rows={4}
          placeholder="Anything you'd like to ask or flag ahead of the visit"
          value={answers.questions}
          onChange={e => onChange({ questions: e.target.value })}
        />
      </div>
    </div>
  )
}
