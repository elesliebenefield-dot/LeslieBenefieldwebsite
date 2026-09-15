import { useState } from 'react'
import Decimal from 'decimal.js'
import { toStorageString } from './calc-engine/decimal.ts'
import { safeCompute } from './bakeryPricingValidationDisplay.ts'
import { validateLaborMinutes } from './calc-engine/validation.ts'
import type { DecimalString } from './calc-engine/types.ts'

interface TaskRow {
  key: string
  label: string
}

// Active time only — deliberately excludes passive baking/cooling itself.
// "Active baking supervision" and "Cooling / decorating" represent the
// active portion of those phases (checking on it, decorating once cool),
// never the full passive duration.
const TASK_ROWS: TaskRow[] = [
  { key: 'shopping', label: 'Shopping / ingredient pickup' },
  { key: 'prep', label: 'Preparation and mixing' },
  { key: 'supervision', label: 'Active baking supervision' },
  { key: 'decorating', label: 'Cooling / decorating' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'cleanup', label: 'Cleanup' },
  { key: 'communication', label: 'Customer communication' },
  { key: 'delivery', label: 'Delivery or handoff' },
]

// Each row is a casual, non-blocking estimate input — an invalid or blank
// entry simply contributes nothing to the running total, rather than
// blocking the whole estimator the way the real laborMinutes field does.
function parseMinutes(raw: string): Decimal {
  if (raw.trim() === '') return new Decimal(0)
  const result = safeCompute(() => validateLaborMinutes(raw))
  return result.valid ? result.value : new Decimal(0)
}

interface Props {
  onApply: (minutes: DecimalString) => void
}

export function LaborEstimator({ onApply }: Props) {
  const [rows, setRows] = useState<Record<string, string>>({})

  const total = TASK_ROWS.reduce((sum, row) => sum.plus(parseMinutes(rows[row.key] ?? '')), new Decimal(0))

  return (
    <div className="bp-estimator">
      <p className="bp-helper">
        Add the active minutes for whatever applies to this recipe. Passive time — dough resting, the oven doing
        its own thing, a cake cooling untouched — isn't counted here unless you're actually working during it.
        Leave any row blank if it doesn't apply.
      </p>

      <div className="bp-estimator-rows">
        {TASK_ROWS.map(row => (
          <div className="bp-estimator-row" key={row.key}>
            <label htmlFor={`bp-labor-task-${row.key}`}>{row.label}</label>
            <input
              id={`bp-labor-task-${row.key}`}
              type="text"
              inputMode="decimal"
              value={rows[row.key] ?? ''}
              onChange={e => setRows(r => ({ ...r, [row.key]: e.target.value }))}
              placeholder="minutes"
            />
          </div>
        ))}
      </div>

      <p className="bp-estimator-total" aria-live="polite">
        Total active minutes: <strong>{total.toString()}</strong>
      </p>

      <button
        type="button"
        className="bp-btn bp-btn-secondary"
        onClick={() => onApply(toStorageString(total))}
        disabled={total.isZero()}
      >
        Use this total ({total.toString()} minutes)
      </button>
    </div>
  )
}
