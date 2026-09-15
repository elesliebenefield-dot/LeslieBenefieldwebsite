import { computeBreakEven, computeCostBreakdown, computeSuggestedPricing } from './calc-engine/formulas.ts'
import { fromStorageString } from './calc-engine/decimal.ts'
import { formatMoney } from './bakeryPricingFormat.ts'
import { safeCompute } from './bakeryPricingValidationDisplay.ts'
import { ROUNDING_INCREMENTS } from './bakeryPricingDraftTypes.ts'
import type { DraftCostInputs } from './bakeryPricingDraftTypes.ts'
import type { RoundingIncrement } from './calc-engine/types.ts'

interface Props {
  ingredientSubtotal: string
  costs: DraftCostInputs
  yieldCount: number
  marginPercent: string
  onMarginChange: (value: string) => void
  roundingIncrement: RoundingIncrement
  onRoundingChange: (value: RoundingIncrement) => void
}

const blank = (v: string) => (v.trim() === '' ? '0' : v)

export function CostBreakdownStep({
  ingredientSubtotal,
  costs,
  yieldCount,
  marginPercent,
  onMarginChange,
  roundingIncrement,
  onRoundingChange,
}: Props) {
  const breakdown = safeCompute(() =>
    computeCostBreakdown({
      ingredientSubtotal,
      wastePercent: blank(costs.wastePercent),
      laborHourlyRate: blank(costs.laborHourlyRate),
      laborMinutes: blank(costs.laborMinutes),
      packagingBatchCost: blank(costs.packagingBatchCost),
      packagingPerItemCost: blank(costs.packagingPerItemCost),
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
      <h2 className="bp-h2">Cost Breakdown</h2>

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
          <span>Packaging</span>
          <span>{formatMoney(breakdown.value.packagingCost)}</span>
        </div>
        <div className="bp-ledger-row bp-ledger-sub">
          {formatMoney(blank(costs.packagingBatchCost))} batch + {formatMoney(blank(costs.packagingPerItemCost))} × {yieldCount}
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

      <h2 className="bp-h2">Your Pricing Goal</h2>
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
          <div className="bp-margin-callout">
            <strong>Margin</strong> is the percentage of your selling price left over after estimated costs.{' '}
            <strong>Markup</strong> is the percentage added on top of your cost — a different number from margin, even at the same price.
            At a {marginRaw}% margin, the equivalent markup is{' '}
            <strong>≈ {fromStorageString(pricing.value.equivalentMarkupRate).times(100).toFixed(1)}%</strong> (shown for reference only — it never drives the calculation).
          </div>

          <h2 className="bp-h2">Suggested Pricing</h2>
          <div className="bp-price-callout">
            <div className="bp-price-sub">Exact target price</div>
            <div className="bp-price-big">{formatMoney(pricing.value.exactTargetPriceBatch)} batch</div>
            <div className="bp-price-sub">{formatMoney(pricing.value.exactTargetPricePerItem)} each</div>
          </div>

          <div className="bp-price-callout bp-price-callout-gold">
            <div className="bp-price-sub">Suggested menu price (rounded up)</div>
            <div className="bp-price-big">{formatMoney(pricing.value.suggestedWholeBatchPrice)} whole batch</div>
            <div className="bp-price-sub">{formatMoney(pricing.value.suggestedPerItemPrice)} each</div>
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
              These two suggested prices are rounded independently — {formatMoney(pricing.value.suggestedPerItemPrice)} × {yieldCount} won't
              always exactly match the whole-batch price of {formatMoney(pricing.value.suggestedWholeBatchPrice)}. That's expected, not an error.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
