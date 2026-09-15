import { useState } from 'react'
import { computeSellingPriceTest } from './calc-engine/formulas.ts'
import { fromStorageString } from './calc-engine/decimal.ts'
import { safeCompute } from './bakeryPricingValidationDisplay.ts'
import { formatMoney } from './bakeryPricingFormat.ts'
import { SectionIcon } from './SectionIcon.tsx'
import type { DecimalString } from './calc-engine/types.ts'

interface Props {
  totalProductionCost: DecimalString
  yieldCount: number
}

// A collapsed-by-default "what if I charged X" check, deliberately
// separate from the calculator's own cost-plus-margin suggested price
// above — it never feeds back into that recommendation, and the pricing
// formula itself is untouched. It only reports what a hypothetical price
// would mean against costs already entered.
export function SellingPriceTest({ totalProductionCost, yieldCount }: Props) {
  const [batchPrice, setBatchPrice] = useState('')

  const result =
    batchPrice.trim() !== '' ? safeCompute(() => computeSellingPriceTest(batchPrice, totalProductionCost, yieldCount)) : null

  return (
    <details className="bp-cost-group bp-selling-price-test">
      <summary><span className="bp-summary-label"><SectionIcon symbol="🏷️" /> Test a selling price</span> <span className="bp-chev" aria-hidden="true">›</span></summary>
      <div className="bp-details-body">
        <p className="bp-helper">
          Curious what a specific price would actually mean? This is separate from the suggested price above — it
          just reports the numbers for a price you choose to test, based on the costs you've already entered.
        </p>
        <div className="bp-field">
          <label htmlFor="bp-selling-price-test">If you charged this for the whole batch</label>
          <input
            id="bp-selling-price-test"
            type="text"
            inputMode="decimal"
            value={batchPrice}
            onChange={e => setBatchPrice(e.target.value)}
            placeholder="e.g., 40.00"
          />
        </div>

        {result && !result.valid && <p className="bp-error" role="alert">{result.reason}</p>}

        {result && result.valid && (
          <div className="bp-selling-price-result" aria-live="polite">
            <p>Batch price: <strong>{formatMoney(result.value.batchPrice)}</strong></p>
            <p>Per item: <strong>{formatMoney(result.value.perItemPrice)}</strong></p>
            <p>Left after your entered production costs: <strong>{formatMoney(result.value.remainingAfterCosts)}</strong></p>
            <p>Actual margin: <strong>{fromStorageString(result.value.actualMarginPercent).toFixed(1)}%</strong></p>
            {result.value.belowBreakEven && (
              <p className="bp-below-break-even" role="alert">
                This price is below your break-even cost — based on what you've entered, you'd lose money at this price.
              </p>
            )}
          </div>
        )}
      </div>
    </details>
  )
}
