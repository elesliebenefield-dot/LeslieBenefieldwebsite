import { useState } from 'react'
import { fromStorageString, toStorageString } from './calc-engine/decimal.ts'
import { validateOverhead } from './calc-engine/validation.ts'
import { roundForDirectEntry, safeCompute } from './bakeryPricingValidationDisplay.ts'
import { formatMoney } from './bakeryPricingFormat.ts'
import type { DecimalString } from './calc-engine/types.ts'

interface Props {
  ingredientSubtotal: DecimalString
  onApply: (percent: DecimalString) => void
}

// Deliberately offers only the dollar-based path, not a menu of preset
// percentages — a preset ("~5% is typical") would read as exactly the
// universal default this feature must never imply. Converting a baker's
// own dollar estimate into a percentage of *this* recipe's ingredient
// cost stays honestly personal to their own numbers.
export function WasteEstimator({ ingredientSubtotal, onApply }: Props) {
  const [dollarAmount, setDollarAmount] = useState('')

  const subtotal = (() => {
    try {
      return fromStorageString(ingredientSubtotal)
    } catch {
      return null
    }
  })()
  const hasIngredients = subtotal !== null && subtotal.isPositive()

  const amount = (() => {
    if (dollarAmount.trim() === '') return null
    const result = safeCompute(() => validateOverhead(dollarAmount))
    return result.valid ? result.value : null
  })()

  const percent = hasIngredients && amount ? amount.dividedBy(subtotal!).times(100) : null

  return (
    <div className="bp-estimator">
      <p className="bp-helper">
        Waste can include spills, trimming, broken or rejected products, leftovers, test batches, and failed
        batches. The most reliable personal estimate comes from tracking a few real batches over time — this is
        just a starting point, not a substitute for that.
      </p>

      {!hasIngredients ? (
        <p className="bp-helper">Add this recipe's ingredients in Step 1 to use this estimator.</p>
      ) : (
        <>
          <div className="bp-field">
            <label htmlFor="bp-waste-dollar">About how much (in ingredient cost) do you typically lose per batch?</label>
            <input
              id="bp-waste-dollar"
              type="text"
              inputMode="decimal"
              value={dollarAmount}
              onChange={e => setDollarAmount(e.target.value)}
              placeholder="e.g., 2.50"
            />
            <p className="bp-helper">This recipe's ingredient cost is {formatMoney(ingredientSubtotal)}.</p>
          </div>

          {percent && amount && (
            <>
              <p className="bp-helper" aria-live="polite">
                {formatMoney(toStorageString(amount))} is about <strong>{percent.toFixed(1)}%</strong> of this
                recipe's ingredient cost.
              </p>
              <button type="button" className="bp-btn bp-btn-secondary" onClick={() => onApply(roundForDirectEntry(percent, 1))}>
                Use this percentage (~{percent.toFixed(1)}%)
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
