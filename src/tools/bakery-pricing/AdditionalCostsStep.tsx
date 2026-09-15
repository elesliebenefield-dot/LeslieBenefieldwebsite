import { useState } from 'react'
import {
  validateHourlyRate,
  validateLaborMinutes,
  validateOverhead,
  validateWastePercent,
} from './calc-engine/validation.ts'
import { fieldError, isZeroOrBlank } from './bakeryPricingValidationDisplay.ts'
import { SuppliesSection } from './SuppliesSection.tsx'
import { SectionIcon } from './SectionIcon.tsx'
import { EstimateModeToggle, type EstimateMode } from './EstimateModeToggle.tsx'
import { LaborEstimator } from './LaborEstimator.tsx'
import { OverheadEstimator } from './OverheadEstimator.tsx'
import { WasteEstimator } from './WasteEstimator.tsx'
import type { DraftCostInputs, DraftSupplyItem, ZeroCostAcknowledgement } from './bakeryPricingDraftTypes.ts'
import type { DecimalString } from './calc-engine/types.ts'

interface Props {
  costs: DraftCostInputs
  onChange: (patch: Partial<DraftCostInputs>) => void
  supplyItems: DraftSupplyItem[]
  onAddSupplyItem: (item: DraftSupplyItem) => void
  onUpdateSupplyItem: (item: DraftSupplyItem) => void
  onRemoveSupplyItem: (id: string) => void
  ack: ZeroCostAcknowledgement
  onAcknowledge: (key: keyof ZeroCostAcknowledgement) => void
  showErrors: boolean
  // Zero-cost notices only appear once the baker has tried to leave this
  // step (Back or Next) — never while a section is merely being opened or
  // typed into. Set by the parent when that first happens.
  reviewed: boolean
  // Read-only — used only by the Waste "Help me estimate this" panel to
  // convert a baker-entered dollar amount into a percentage of this
  // recipe's own ingredient cost. Never written to from this step.
  ingredientSubtotal: DecimalString
}

export function AdditionalCostsStep({
  costs,
  onChange,
  supplyItems,
  onAddSupplyItem,
  onUpdateSupplyItem,
  onRemoveSupplyItem,
  ack,
  onAcknowledge,
  showErrors,
  reviewed,
  ingredientSubtotal,
}: Props) {
  const laborIsZero = isZeroOrBlank(costs.laborHourlyRate) || isZeroOrBlank(costs.laborMinutes)
  const suppliesIsZero = supplyItems.length === 0
  const overheadIsZero = isZeroOrBlank(costs.overheadFlatCost)
  const wasteIsZero = isZeroOrBlank(costs.wastePercent)

  const hourlyRateError = fieldError(costs.laborHourlyRate, validateHourlyRate)
  const laborMinutesError = fieldError(costs.laborMinutes, validateLaborMinutes)
  const overheadError = fieldError(costs.overheadFlatCost, validateOverhead)
  const wasteError = fieldError(costs.wastePercent, validateWastePercent)

  // Each estimator is its own optional, progressively-disclosed path — the
  // direct-entry field is what's shown by default in every group, exactly
  // as before this enhancement. Switching to 'estimate' never clears or
  // hides a value already entered directly; applying an estimate switches
  // back to 'direct' so the result is visible in the ordinary field.
  const [laborMinutesMode, setLaborMinutesMode] = useState<EstimateMode>('direct')
  const [overheadMode, setOverheadMode] = useState<EstimateMode>('direct')
  const [wasteMode, setWasteMode] = useState<EstimateMode>('direct')

  return (
    <div className="bp-step">
      <h2 className="bp-h2">Additional Costs</h2>
      <p className="bp-helper">Optional costs are tucked away until you want them — nothing here is required to see a basic ingredient cost.</p>

      {showErrors && (hourlyRateError || laborMinutesError || overheadError || wasteError) && (
        <div className="bp-error-banner" role="alert">Please fix the highlighted field before continuing.</div>
      )}

      <details className="bp-cost-group" open>
        <summary><span className="bp-summary-label"><SectionIcon symbol="⏱️" /> Labor</span> <span className="bp-chev" aria-hidden="true">›</span></summary>
        <div className="bp-details-body">
          <p className="bp-helper">
            Labor pays you for the time you spend on this order. Profit — the margin you'll choose in the next
            step — is different: it belongs to the business itself, to cover risk, growth, and rebuilding a
            financial cushion.
          </p>

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
            <p className="bp-helper">
              Thinking about what to charge yourself? Consider what would make this work worth your time, and
              what you might need to pay someone else with comparable skill.
            </p>
          </div>

          <EstimateModeToggle
            name="bp-labor-minutes-mode"
            mode={laborMinutesMode}
            onChange={setLaborMinutesMode}
            estimateLabel="Help me estimate my minutes"
          />

          {laborMinutesMode === 'direct' ? (
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
              <p className="bp-helper">Active time only — prep, decorating, packaging, cleanup. Passive baking or cooling time isn't included automatically.</p>
            </div>
          ) : (
            <LaborEstimator
              onApply={minutes => {
                onChange({ laborMinutes: minutes })
                setLaborMinutesMode('direct')
              }}
            />
          )}

          {reviewed && laborIsZero && !ack.labor && (
            <div className="bp-zero-notice">
              <span>This is $0 — is that intentional?</span>
              <button type="button" onClick={() => onAcknowledge('labor')}>Yes, that's right</button>
            </div>
          )}
        </div>
      </details>

      <details className="bp-cost-group">
        <summary><span className="bp-summary-label"><SectionIcon symbol="📦" tone="raspberry" /> Supplies &amp; Packaging</span> <span className="bp-chev" aria-hidden="true">›</span></summary>
        <div className="bp-details-body">
          <SuppliesSection
            items={supplyItems}
            onAddItem={onAddSupplyItem}
            onUpdateItem={onUpdateSupplyItem}
            onRemoveItem={onRemoveSupplyItem}
          />
          {reviewed && suppliesIsZero && !ack.supplies && (
            <div className="bp-zero-notice">
              <span>No supplies or packaging added — is that intentional?</span>
              <button type="button" onClick={() => onAcknowledge('supplies')}>Yes, that's right</button>
            </div>
          )}
        </div>
      </details>

      <details className="bp-cost-group">
        <summary>Overhead <span className="bp-chev" aria-hidden="true">›</span></summary>
        <div className="bp-details-body">
          <EstimateModeToggle name="bp-overhead-mode" mode={overheadMode} onChange={setOverheadMode} />

          {overheadMode === 'direct' ? (
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
              <p className="bp-helper">A flat dollar amount covering this batch's share of rent, utilities, and similar costs.</p>
            </div>
          ) : (
            <OverheadEstimator
              onApply={amount => {
                onChange({ overheadFlatCost: amount })
                setOverheadMode('direct')
              }}
            />
          )}

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
          <p className="bp-helper">
            Waste can include spills, trimming, broken or rejected products, leftovers, test batches, and failed
            batches. The most reliable personal estimate comes from tracking a few real batches over time.
          </p>

          <EstimateModeToggle name="bp-waste-mode" mode={wasteMode} onChange={setWasteMode} />

          {wasteMode === 'direct' ? (
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
              <p className="bp-helper">Applied to your ingredient cost only — covers spoilage, burnt batches, or trimmed scraps. Not every recipe needs this set above zero.</p>
            </div>
          ) : (
            <WasteEstimator
              ingredientSubtotal={ingredientSubtotal}
              onApply={percent => {
                onChange({ wastePercent: percent })
                setWasteMode('direct')
              }}
            />
          )}

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
