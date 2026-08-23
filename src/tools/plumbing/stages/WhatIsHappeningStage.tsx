import { OptionCard } from '../../core/components/OptionCard'
import type { PlumbingAnswers, ConcernType, ActiveWaterStatus } from '../plumbingTypes'

interface Props {
  answers: PlumbingAnswers
  onChange: (partial: Partial<PlumbingAnswers>) => void
  showErrors: boolean
}

const CONCERN_OPTIONS = [
  { value: 'no_hot_water',   label: 'No hot water or inconsistent water temperature' },
  { value: 'low_pressure',   label: 'Low or no water pressure' },
  { value: 'slow_drain',     label: 'Slow or blocked drain' },
  { value: 'backing_up',     label: 'Water backing up or overflowing' },
  { value: 'leak',           label: 'Leak, drip, or unexplained damp spot' },
  { value: 'running_toilet', label: 'Running or constantly refilling toilet' },
  { value: 'smell_color',    label: 'Unusual smell or change in water color' },
  { value: 'water_heater',   label: 'Water heater leak, noise, or other concern' },
  { value: 'other',          label: "Something else or I'm not sure" },
]

const ACTIVE_WATER_OPTIONS = [
  { value: 'flowing_spreading', label: 'Yes — water is actively flowing or spreading' },
  { value: 'slow_drip',         label: 'Yes — a slow or controlled drip' },
  { value: 'none_visible',      label: 'No — no active water visible right now' },
  { value: 'not_sure',          label: "I'm not sure" },
]

export function WhatIsHappeningStage({ answers, onChange, showErrors }: Props) {
  return (
    <div>
      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.concernType ? ' has-error' : ''}`}>
            What type of concern are you dealing with?
          </legend>
          <div className="option-cards">
            {CONCERN_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`concernType-${opt.value}`}
                name="concernType"
                value={opt.value}
                label={opt.label}
                checked={answers.concernType === opt.value}
                type="radio"
                onChange={val => onChange({ concernType: val as ConcernType })}
                hasError={showErrors && !answers.concernType}
              />
            ))}
          </div>
          {showErrors && !answers.concernType && (
            <span className="tool-question-error" role="alert">Please select a concern type.</span>
          )}
        </fieldset>
      </div>

      <div className="tool-question">
        <label htmlFor="observations" className="tool-question-legend">
          What can you see, hear, or smell? <span className="tool-question-optional">(optional)</span>
        </label>
        <p className="tool-question-hint">
          Describe what you're noticing in your own words — you don't need to identify the cause.
        </p>
        <p className="tool-question-hint">
          For example: "There's a dripping sound under the kitchen sink" or "The water coming out looks slightly orange."
        </p>
        <textarea
          id="observations"
          className="tool-textarea"
          rows={3}
          placeholder="Describe what you're noticing in your own words — you don't need to identify the cause."
          value={answers.observations}
          onChange={e => onChange({ observations: e.target.value })}
        />
      </div>

      <div className="tool-question">
        <fieldset className="tool-question-fieldset">
          <legend className={`tool-question-legend${showErrors && !answers.activeWater ? ' has-error' : ''}`}>
            Is water currently running, dripping, or collecting somewhere it shouldn't be?
          </legend>
          <div className="option-cards">
            {ACTIVE_WATER_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                id={`activeWater-${opt.value}`}
                name="activeWater"
                value={opt.value}
                label={opt.label}
                checked={answers.activeWater === opt.value}
                type="radio"
                onChange={val => onChange({ activeWater: val as ActiveWaterStatus })}
                hasError={showErrors && !answers.activeWater}
              />
            ))}
          </div>
          {showErrors && !answers.activeWater && (
            <span className="tool-question-error" role="alert">Please select an option.</span>
          )}
          {answers.activeWater === 'flowing_spreading' && (
            <div className="plumbing-urgency-notice" role="note">
              If water is actively flowing or spreading, contact a licensed plumber or emergency plumbing service directly. You do not need to finish this planner first. If anyone may be in immediate danger, contact local emergency services.
            </div>
          )}
        </fieldset>
      </div>
    </div>
  )
}
