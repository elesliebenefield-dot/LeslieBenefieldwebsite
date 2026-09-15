import { useEffect, useState } from 'react'
import { computeBreakEven, computeCostBreakdown, computeSuggestedPricing } from './calc-engine/formulas.ts'
import { fromStorageString } from './calc-engine/decimal.ts'
import { formatMoney } from './bakeryPricingFormat.ts'
import { safeCompute } from './bakeryPricingValidationDisplay.ts'
import { ROUNDING_INCREMENTS } from './bakeryPricingDraftTypes.ts'
import { SectionIcon } from './SectionIcon.tsx'
import type { DraftCostInputs } from './bakeryPricingDraftTypes.ts'
import type { RoundingIncrement } from './calc-engine/types.ts'

interface Props {
  ingredientSubtotal: string
  suppliesSubtotal: string
  costs: DraftCostInputs
  yieldCount: number
  marginPercent: string
  onMarginChange: (value: string) => void
  roundingIncrement: RoundingIncrement
  onRoundingChange: (value: RoundingIncrement) => void
  // True only while this specific mount should play the one-time
  // suggested-price highlight — captured once at mount via lazy state
  // below, so a later remount of this same step (Back, then Next again)
  // never replays it. See BakeryPricingCalculator.tsx's hasCelebrated gate.
  celebrateEligible?: boolean
  onCelebrated?: () => void
}

const blank = (v: string) => (v.trim() === '' ? '0' : v)

export function CostBreakdownStep({
  ingredientSubtotal,
  suppliesSubtotal,
  costs,
  yieldCount,
  marginPercent,
  onMarginChange,
  roundingIncrement,
  onRoundingChange,
  celebrateEligible = false,
  onCelebrated,
}: Props) {
  // Lazy initializer reads celebrateEligible only at the moment THIS
  // component instance mounts — later prop changes (the parent flipping
  // its gate once notified) never affect an already-mounted instance, and
  // a fresh mount after Back/Next again reads the gate's new (false) value.
  const [shouldCelebrate] = useState(() => celebrateEligible)
  // Runs exactly once, on mount, by design — see the comment on shouldCelebrate.
  // Intentionally NOT re-run on prop changes: onCelebrated is only ever
  // meaningful at the moment this instance first mounts.
  useEffect(() => {
    if (shouldCelebrate) onCelebrated?.()
    // eslint-disable-next-line
  }, [])
  const breakdown = safeCompute(() =>
    computeCostBreakdown({
      ingredientSubtotal,
      wastePercent: blank(costs.wastePercent),
      laborHourlyRate: blank(costs.laborHourlyRate),
      laborMinutes: blank(costs.laborMinutes),
      suppliesSubtotal,
      overheadFlatCost: blank(costs.overheadFlatCost),
      yield_: yieldCount,
    }),
  )

  if (!breakdown.valid) {
    return (
      <div className="bp-step">
        <p className="bp-error" role="alert">{breakdown.reason}</p>
      </div>
    )
  }

  const breakEven = computeBreakEven(breakdown.value.totalProductionCost, breakdown.value.costPerUnit)
  const pricing = safeCompute(() =>
    computeSuggestedPricing(breakdown.value.totalProductionCost, yieldCount, blank(marginPercent), roundingIncrement),
  )

  const marginRaw = marginPercent.trim() === '' ? '0' : marginPercent

  return (
    <div className="bp-step">
      <h2 className="bp-h2">Choose Your Profit Margin</h2>
      <p className="bp-helper">Margin is the percentage of your selling price left over after estimated costs.</p>

      <div className="bp-field">
        <label htmlFor="bp-margin-range">Desired profit margin</label>
        <div className="bp-inline-fields">
          <input
            id="bp-margin-range"
            type="range"
            min={0}
            max={95}
            step={1}
            value={marginRaw}
            onChange={e => onMarginChange(e.target.value)}
          />
          <input
            type="text"
            inputMode="decimal"
            aria-label="Desired profit margin percentage"
            value={marginPercent}
            onChange={e => onMarginChange(e.target.value)}
          />
        </div>
        {!pricing.valid && <p className="bp-error" role="alert">{pricing.reason}</p>}
      </div>

      {pricing.valid && (
        <>
          <h2 className="bp-h2"><SectionIcon symbol="✨" tone="gold" /> Your Suggested Price</h2>
          <p className="bp-script-accent">Priced with confidence.</p>
          <div className={`bp-price-callout bp-price-callout-gold bp-price-lead${shouldCelebrate ? ' bp-price-lead-celebrate' : ''}`}>
            <div className="bp-price-sub">Suggested whole-batch price</div>
            <div className="bp-price-big">{formatMoney(pricing.value.suggestedWholeBatchPrice)}</div>
            <div className="bp-price-sub">Suggested per-item price</div>
            <div className="bp-price-big">{formatMoney(pricing.value.suggestedPerItemPrice)}</div>

            <div className="bp-increment-row" role="group" aria-label="Rounding increment">
              {ROUNDING_INCREMENTS.map(inc => (
                <button
                  key={inc}
                  type="button"
                  className={inc === roundingIncrement ? 'is-active' : ''}
                  onClick={() => onRoundingChange(inc)}
                >
                  ${inc}
                </button>
              ))}
            </div>
            <p className="bp-helper">
              These two prices are rounded independently — {formatMoney(pricing.value.suggestedPerItemPrice)} × {yieldCount} won't
              always exactly match the whole-batch price of {formatMoney(pricing.value.suggestedWholeBatchPrice)}. That's expected, not an error.
            </p>
          </div>

          <details className="bp-cost-group bp-breakdown-details">
            <summary><span className="bp-summary-label"><SectionIcon symbol="🧾" /> See how this was calculated</span> <span className="bp-chev" aria-hidden="true">›</span></summary>
            <div className="bp-details-body">
              <div className="bp-ledger">
                <div className="bp-ledger-row">
                  <span>Ingredient Subtotal</span>
                  <span>{formatMoney(breakdown.value.ingredientSubtotal)}</span>
                </div>
                <div className="bp-ledger-row">
                  <span>Ingredient Waste Allowance ({blank(costs.wastePercent)}%)</span>
                  <span>{formatMoney(breakdown.value.wasteAllowance)}</span>
                </div>
                <div className="bp-ledger-row">
                  <span>Labor ({blank(costs.laborMinutes)} min @ {formatMoney(blank(costs.laborHourlyRate))}/hr)</span>
                  <span>{formatMoney(breakdown.value.laborCost)}</span>
                </div>
                <div className="bp-ledger-row">
                  <span>Supplies &amp; Packaging</span>
                  <span>{formatMoney(breakdown.value.suppliesCost)}</span>
                </div>
                <div className="bp-ledger-row">
                  <span>Overhead</span>
                  <span>{formatMoney(breakdown.value.overhead)}</span>
                </div>
                <div className="bp-ledger-row bp-ledger-total">
                  <span>Total Production Cost</span>
                  <span>{formatMoney(breakdown.value.totalProductionCost)}</span>
                </div>
                <div className="bp-ledger-row">
                  <span>Cost Per Item (÷{yieldCount})</span>
                  <span>{formatMoney(breakdown.value.costPerUnit)}</span>
                </div>
                <div className="bp-ledger-row">
                  <span>Break-Even Price</span>
                  <span>{formatMoney(breakEven.batch)} batch / {formatMoney(breakEven.perItem)} each</span>
                </div>
              </div>

              <div className="bp-price-callout">
                <div className="bp-price-sub">Exact target price (before rounding)</div>
                <div className="bp-price-big">{formatMoney(pricing.value.exactTargetPriceBatch)} batch</div>
                <div className="bp-price-sub">{formatMoney(pricing.value.exactTargetPricePerItem)} each</div>
              </div>

              <p className="bp-markup-note">
                For reference, a {marginRaw}% margin is the same price as an equivalent markup of{' '}
                <strong>≈ {fromStorageString(pricing.value.equivalentMarkupRate).times(100).toFixed(1)}%</strong> — markup is a
                different way of describing the same price, shown here for comparison only; it never drives the calculation.
              </p>
            </div>
          </details>
        </>
      )}
    </div>
  )
}
