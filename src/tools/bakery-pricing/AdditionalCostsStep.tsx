import { fromStorageString } from './calc-engine/decimal.ts'
import {
  validateHourlyRate,
  validateLaborMinutes,
  validateOverhead,
  validatePackagingBatchCost,
  validatePackagingPerItemCost,
  validateWastePercent,
} from './calc-engine/validation.ts'
import { fieldError } from './bakeryPricingValidationDisplay.ts'
import type { DraftCostInputs, ZeroCostAcknowledgement } from './bakeryPricingDraftTypes.ts'

interface Props {
  costs: DraftCostInputs
  onChange: (patch: Partial<DraftCostInputs>) => void
  ack: ZeroCostAcknowledgement
  onAcknowledge: (key: keyof ZeroCostAcknowledgement) => void
  showErrors: boolean
  // Zero-cost notices only appear once the baker has tried to leave this
  // step (Back or Next) — never while a section is merely being opened or
  // typed into. Set by the parent when that first happens.
  reviewed: boolean
}

function isZeroOrBlank(raw: string): boolean {
  if (raw.trim() === '') return true
  try {
    return fromStorageString(raw).isZero()
  } catch {
    return false
  }
}

export function AdditionalCostsStep({ costs, onChange, ack, onAcknowledge, showErrors, reviewed }: Props) {
  const laborIsZero = isZeroOrBlank(costs.laborHourlyRate) || isZeroOrBlank(costs.laborMinutes)
  const packagingIsZero = isZeroOrBlank(costs.packagingBatchCost) && isZeroOrBlank(costs.packagingPerItemCost)
  const overheadIsZero = isZeroOrBlank(costs.overheadFlatCost)
  const wasteIsZero = isZeroOrBlank(costs.wastePercent)

  const hourlyRateError = fieldError(costs.laborHourlyRate, validateHourlyRate)
  const laborMinutesError = fieldError(costs.laborMinutes, validateLaborMinutes)
  const packagingBatchError = fieldError(costs.packagingBatchCost, validatePackagingBatchCost)
  const packagingPerItemError = fieldError(costs.packagingPerItemCost, validatePackagingPerItemCost)
  const overheadError = fieldError(costs.overheadFlatCost, validateOverhead)
  const wasteError = fieldError(costs.wastePercent, validateWastePercent)

  return (
    <div className="bp-step">
      <h2 className="bp-h2">Additional Costs</h2>
      <p className="bp-helper">Optional costs are tucked away until you want them — nothing here is required to see a basic ingredient cost.</p>

      {showErrors && (hourlyRateError || laborMinutesError || packagingBatchError || packagingPerItemError || overheadError || wasteError) && (
        <div className="bp-error-banner" role="alert">Please fix the highlighted field before continuing.</div>
      )}

      <details className="bp-cost-group" open>
        <summary>Labor <span className="bp-chev" aria-hidden="true">›</span></summary>
        <div className="bp-details-body">
          <div className="bp-inline-fields">
            <div className="bp-field">
              <label htmlFor="bp-labor-rate">Hourly rate</label>
              <input
                id="bp-labor-rate"
                type="text"
                inputMode="decimal"
                value={costs.laborHourlyRate}
                onChange={e => onChange({ laborHourlyRate: e.target.value })}
                aria-invalid={!!hourlyRateError}
              />
              {hourlyRateError && <p className="bp-error" role="alert">{hourlyRateError}</p>}
            </div>
            <div className="bp-field">
              <label htmlFor="bp-labor-minutes">Active minutes</label>
              <input
                id="bp-labor-minutes"
                type="text"
                inputMode="decimal"
                value={costs.laborMinutes}
                onChange={e => onChange({ laborMinutes: e.target.value })}
                aria-invalid={!!laborMinutesError}
              />
              {laborMinutesError && <p className="bp-error" role="alert">{laborMinutesError}</p>}
            </div>
          </div>
          <p className="bp-helper">Active time only — prep, decorating, packaging, cleanup. Passive baking or cooling time isn't included automatically.</p>
          {reviewed && laborIsZero && !ack.labor && (
            <div className="bp-zero-notice">
              <span>This is $0 — is that intentional?</span>
              <button type="button" onClick={() => onAcknowledge('labor')}>Yes, that's right</button>
            </div>
          )}
        </div>
      </details>

      <details className="bp-cost-group">
        <summary>Packaging <span className="bp-chev" aria-hidden="true">›</span></summary>
        <div className="bp-details-body">
          <div className="bp-inline-fields">
            <div className="bp-field">
              <label htmlFor="bp-pkg-batch">Batch-level cost</label>
              <input
                id="bp-pkg-batch"
                type="text"
                inputMode="decimal"
                value={costs.packagingBatchCost}
                onChange={e => onChange({ packagingBatchCost: e.target.value })}
                aria-invalid={!!packagingBatchError}
              />
              {packagingBatchError && <p className="bp-error" role="alert">{packagingBatchError}</p>}
            </div>
            <div className="bp-field">
              <label htmlFor="bp-pkg-item">Per-item cost</label>
              <input
                id="bp-pkg-item"
                type="text"
                inputMode="decimal"
                value={costs.packagingPerItemCost}
                onChange={e => onChange({ packagingPerItemCost: e.target.value })}
                aria-invalid={!!packagingPerItemError}
              />
              {packagingPerItemError && <p className="bp-error" role="alert">{packagingPerItemError}</p>}
            </div>
          </div>
          <p className="bp-helper">Use either, both, or neither — whichever matches how this recipe is actually packaged.</p>
          {reviewed && packagingIsZero && !ack.packaging && (
            <div className="bp-zero-notice">
              <span>This is $0 — is that intentional?</span>
              <button type="button" onClick={() => onAcknowledge('packaging')}>Yes, that's right</button>
            </div>
          )}
        </div>
      </details>

      <details className="bp-cost-group">
        <summary>Overhead <span className="bp-chev" aria-hidden="true">›</span></summary>
        <div className="bp-details-body">
          <div className="bp-field">
            <label htmlFor="bp-overhead">Flat amount for this batch</label>
            <input
              id="bp-overhead"
              type="text"
              inputMode="decimal"
              value={costs.overheadFlatCost}
              onChange={e => onChange({ overheadFlatCost: e.target.value })}
              aria-invalid={!!overheadError}
            />
            {overheadError && <p className="bp-error" role="alert">{overheadError}</p>}
          </div>
          <p className="bp-helper">A flat dollar amount covering this batch's share of rent, utilities, and similar costs.</p>
          {reviewed && overheadIsZero && !ack.overhead && (
            <div className="bp-zero-notice">
              <span>This is $0 — is that intentional?</span>
              <button type="button" onClick={() => onAcknowledge('overhead')}>Yes, that's right</button>
            </div>
          )}
        </div>
      </details>

      <details className="bp-cost-group">
        <summary>Ingredient Waste Allowance <span className="bp-chev" aria-hidden="true">›</span></summary>
        <div className="bp-details-body">
          <div className="bp-field">
            <label htmlFor="bp-waste">Waste percentage</label>
            <input
              id="bp-waste"
              type="text"
              inputMode="decimal"
              value={costs.wastePercent}
              onChange={e => onChange({ wastePercent: e.target.value })}
              aria-invalid={!!wasteError}
            />
            {wasteError && <p className="bp-error" role="alert">{wasteError}</p>}
          </div>
          <p className="bp-helper">Applied to your ingredient cost only — covers spoilage, burnt batches, or trimmed scraps. Not every recipe needs this set above zero.</p>
          {reviewed && wasteIsZero && !ack.waste && (
            <div className="bp-zero-notice">
              <span>This is $0 — is that intentional?</span>
              <button type="button" onClick={() => onAcknowledge('waste')}>Yes, that's right</button>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
