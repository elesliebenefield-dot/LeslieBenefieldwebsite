import { OptionCard } from '../../core/components/OptionCard'
import type { FoodTruckAnswers, SetupSpaceType, VehicleAccess, SurfaceType, UtilityAnswer, SetupTime } from '../foodTruckTypes'
import {
  SETUP_SPACE_LABELS,
  VEHICLE_ACCESS_LABELS,
  SURFACE_TYPE_LABELS,
  UTILITY_LABELS,
  SETUP_TIME_LABELS,
} from '../foodTruckTypes'

interface Props {
  answers: FoodTruckAnswers
  onChange: (partial: Partial<FoodTruckAnswers>) => void
  showErrors: boolean
}

type SetupSpaceKey  = Exclude<SetupSpaceType, ''>
type VehicleKey     = Exclude<VehicleAccess, ''>
type SurfaceKey     = Exclude<SurfaceType, ''>
type UtilityKey     = Exclude<UtilityAnswer, ''>
type SetupTimeKey   = Exclude<SetupTime, ''>

export function VenueAndLogisticsStage({ answers, onChange, showErrors }: Props) {
  const setupSpaceError = showErrors && !answers.setupSpace

  return (
    <div>
      {/* Q14 — Setup space */}
      <div className="tool-question">
        <fieldset aria-describedby={setupSpaceError ? 'setupSpace-error' : undefined}>
          <legend className={`tool-question-legend${setupSpaceError ? ' has-error' : ''}`}>
            Is there space for a food truck or trailer to set up?
            <span className="tool-question-required" aria-hidden="true"> *</span>
          </legend>
          {setupSpaceError && (
            <span id="setupSpace-error" className="tool-question-error" role="alert">Please select an option.</span>
          )}
          <div className="option-cards">
            {(Object.keys(SETUP_SPACE_LABELS) as SetupSpaceKey[]).map(key => (
              <OptionCard
                key={key}
                id={`setupSpace-${key}`}
                name="setupSpace"
                value={key}
                label={SETUP_SPACE_LABELS[key]}
                checked={answers.setupSpace === key}
                type="radio"
                onChange={val => onChange({ setupSpace: val as SetupSpaceType })}
                hasError={setupSpaceError}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q15 — Vehicle access */}
      <div className="tool-question">
        <fieldset>
          <legend className="tool-question-legend">
            Is the location easily accessible for a large vehicle? <span className="tool-question-optional">(optional)</span>
          </legend>
          <div className="option-cards">
            {(Object.keys(VEHICLE_ACCESS_LABELS) as VehicleKey[]).map(key => (
              <OptionCard
                key={key}
                id={`vehicleAccess-${key}`}
                name="vehicleAccess"
                value={key}
                label={VEHICLE_ACCESS_LABELS[key]}
                checked={answers.vehicleAccess === key}
                type="radio"
                onChange={val => onChange({ vehicleAccess: val as VehicleAccess })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q16 — Surface type */}
      <div className="tool-question">
        <fieldset>
          <legend className="tool-question-legend">
            What type of surface will the vehicle be parked on? <span className="tool-question-optional">(optional)</span>
          </legend>
          <div className="option-cards option-cards--compact">
            {(Object.keys(SURFACE_TYPE_LABELS) as SurfaceKey[]).map(key => (
              <OptionCard
                key={key}
                id={`surfaceType-${key}`}
                name="surfaceType"
                value={key}
                label={SURFACE_TYPE_LABELS[key]}
                checked={answers.surfaceType === key}
                type="radio"
                onChange={val => onChange({ surfaceType: val as SurfaceType })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q17 — Electricity */}
      <div className="tool-question">
        <fieldset>
          <legend className="tool-question-legend">
            Is electricity available at the setup location? <span className="tool-question-optional">(optional)</span>
          </legend>
          <div className="option-cards option-cards--compact">
            {(Object.keys(UTILITY_LABELS) as UtilityKey[]).map(key => (
              <OptionCard
                key={key}
                id={`electricity-${key}`}
                name="electricity"
                value={key}
                label={UTILITY_LABELS[key]}
                checked={answers.electricity === key}
                type="radio"
                onChange={val => onChange({ electricity: val as UtilityAnswer })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q18 — Water access */}
      <div className="tool-question">
        <fieldset>
          <legend className="tool-question-legend">
            Is water access available at the setup location? <span className="tool-question-optional">(optional)</span>
          </legend>
          <div className="option-cards option-cards--compact">
            {(Object.keys(UTILITY_LABELS) as UtilityKey[]).map(key => (
              <OptionCard
                key={key}
                id={`waterAccess-${key}`}
                name="waterAccess"
                value={key}
                label={UTILITY_LABELS[key]}
                checked={answers.waterAccess === key}
                type="radio"
                onChange={val => onChange({ waterAccess: val as UtilityAnswer })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q19 — Venue restrictions */}
      <div className="tool-question">
        <label htmlFor="venueRestrictions" className="tool-question-legend">
          Venue restrictions or instructions <span className="tool-question-optional">(optional)</span>
        </label>
        <textarea
          id="venueRestrictions"
          className="tool-textarea"
          rows={3}
          placeholder="e.g., 'Venue requires proof of liability insurance,' 'Vendor parking is behind the main building,' 'No amplified sound after 9pm'"
          value={answers.venueRestrictions}
          onChange={e => onChange({ venueRestrictions: e.target.value })}
        />
        <p className="tool-question-hint">
          Only share what the venue has communicated to you. The vendor is responsible for verifying their own permit, license, and compliance requirements.
        </p>
      </div>

      {/* Q20 — Day-of contact */}
      <div className="tool-question">
        <label htmlFor="dayOfContact" className="tool-question-legend">
          On-site contact name and how to reach them <span className="tool-question-optional">(optional)</span>
        </label>
        <input
          id="dayOfContact"
          type="text"
          className="tool-input"
          placeholder="e.g., 'Sarah M., event coordinator — she'll be at the main entrance'"
          value={answers.dayOfContact}
          onChange={e => onChange({ dayOfContact: e.target.value })}
        />
        <p className="tool-question-hint">
          Anything you enter here will appear in the generated brief and email. Don't include financial account numbers, passwords, or other sensitive information.
        </p>
      </div>

      {/* Q21 — Setup & breakdown time */}
      <div className="tool-question">
        <fieldset>
          <legend className="tool-question-legend">
            How much time is needed for setup and breakdown? <span className="tool-question-optional">(optional)</span>
          </legend>
          <div className="option-cards">
            {(Object.keys(SETUP_TIME_LABELS) as SetupTimeKey[]).map(key => (
              <OptionCard
                key={key}
                id={`setupBreakdown-${key}`}
                name="setupBreakdown"
                value={key}
                label={SETUP_TIME_LABELS[key]}
                checked={answers.setupBreakdown === key}
                type="radio"
                onChange={val => onChange({ setupBreakdown: val as SetupTime })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {/* Q22 — Questions for vendor */}
      <div className="tool-question">
        <label htmlFor="questions" className="tool-question-legend">
          Questions for the vendor <span className="tool-question-optional">(optional)</span>
        </label>
        <textarea
          id="questions"
          className="tool-textarea"
          rows={3}
          placeholder="Anything you'd like to ask or confirm before reaching out"
          value={answers.questions}
          onChange={e => onChange({ questions: e.target.value })}
        />
      </div>
    </div>
  )
}
