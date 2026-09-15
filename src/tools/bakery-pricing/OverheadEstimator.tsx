import { useState } from 'react'
import Decimal from 'decimal.js'
import { fromStorageString, toStorageString } from './calc-engine/decimal.ts'
import { validateOverhead } from './calc-engine/validation.ts'
import { roundForDirectEntry, safeCompute } from './bakeryPricingValidationDisplay.ts'
import { formatMoney } from './bakeryPricingFormat.ts'
import type { DecimalString } from './calc-engine/types.ts'

interface CategoryRow {
  key: string
  label: string
}

const CATEGORY_ROWS: CategoryRow[] = [
  { key: 'permits', label: 'Permits and licenses' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'cleaning', label: 'Cleaning supplies' },
  { key: 'equipment', label: 'Equipment replacement' },
  { key: 'software', label: 'Website, software, or phone' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'mileage', label: 'Mileage or delivery expenses' },
  { key: 'other', label: 'Other recurring business costs' },
]

type Period = 'month' | 'year'

// Each row is a casual, non-blocking estimate input, same as LaborEstimator
// — an invalid or blank amount simply contributes nothing to the running
// total rather than blocking the whole estimator.
function parseAmount(raw: string): Decimal {
  if (raw.trim() === '') return new Decimal(0)
  const result = safeCompute(() => validateOverhead(raw))
  return result.valid ? result.value : new Decimal(0)
}

function monthlyAmount(raw: string, period: Period): Decimal {
  const amount = parseAmount(raw)
  return period === 'year' ? amount.dividedBy(12) : amount
}

interface Props {
  onApply: (overheadPerBatch: DecimalString) => void
}

export function OverheadEstimator({ onApply }: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [periods, setPeriods] = useState<Record<string, Period>>({})
  const [monthlyBatches, setMonthlyBatches] = useState('')

  const monthlyOverhead = CATEGORY_ROWS.reduce(
    (sum, row) => sum.plus(monthlyAmount(amounts[row.key] ?? '', periods[row.key] ?? 'month')),
    new Decimal(0),
  )

  const batchesValue = (() => {
    if (monthlyBatches.trim() === '') return null
    try {
      const value = fromStorageString(monthlyBatches)
      return value.isPositive() ? value : null
    } catch {
      return null
    }
  })()

  const perBatch = batchesValue ? monthlyOverhead.dividedBy(batchesValue) : null

  return (
    <div className="bp-estimator">
      <p className="bp-helper">
        Add your recurring monthly business costs below. If you only know a cost per year, mark it "per year" and
        we'll divide it out for you.
      </p>

      <div className="bp-estimator-rows">
        {CATEGORY_ROWS.map(row => (
          <div className="bp-estimator-row bp-estimator-row-with-period" key={row.key}>
            <label htmlFor={`bp-overhead-cat-${row.key}`}>{row.label}</label>
            <div className="bp-inline-fields">
              <input
                id={`bp-overhead-cat-${row.key}`}
                type="text"
                inputMode="decimal"
                value={amounts[row.key] ?? ''}
                onChange={e => setAmounts(a => ({ ...a, [row.key]: e.target.value }))}
                placeholder="amount"
              />
              <select
                aria-label={`${row.label} billing period`}
                value={periods[row.key] ?? 'month'}
                onChange={e => setPeriods(p => ({ ...p, [row.key]: e.target.value as Period }))}
              >
                <option value="month">per month</option>
                <option value="year">per year</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <p className="bp-estimator-total" aria-live="polite">
        Estimated monthly overhead: <strong>{formatMoney(toStorageString(monthlyOverhead))}</strong>
      </p>

      <div className="bp-field">
        <label htmlFor="bp-overhead-monthly-batches">About how many batches or orders do you expect in a typical month?</label>
        <input
          id="bp-overhead-monthly-batches"
          type="text"
          inputMode="decimal"
          value={monthlyBatches}
          onChange={e => setMonthlyBatches(e.target.value)}
          placeholder="e.g., 20"
        />
      </div>

      {perBatch ? (
        <>
          <p className="bp-helper">
            {formatMoney(toStorageString(monthlyOverhead))} ÷ {monthlyBatches} batches ≈{' '}
            <strong>{formatMoney(toStorageString(perBatch))} per batch</strong>. This is an allocation estimate
            based on your own numbers, not a market benchmark.
          </p>
          <button
            type="button"
            className="bp-btn bp-btn-secondary"
            onClick={() => onApply(roundForDirectEntry(perBatch, 2))}
            disabled={monthlyOverhead.isZero()}
          >
            Use this amount ({formatMoney(toStorageString(perBatch))} per batch)
          </button>
        </>
      ) : (
        <p className="bp-helper">Enter your expected monthly batches above to see an estimated overhead per batch.</p>
      )}
    </div>
  )
}
