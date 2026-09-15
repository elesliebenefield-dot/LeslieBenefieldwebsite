// A tiny, deliberately narrow local convenience: remember the hourly rate
// last used on a saved recipe, so starting a brand-new recipe doesn't
// require retyping it every time. This is NOT a business-profile system —
// it is one remembered value, per browser, never synced, never part of a
// saved recipe or export/import file, and never overwrites a value the
// baker has already entered. If localStorage is unavailable (private
// browsing, a locked-down browser), every function here degrades silently
// to a no-op/null rather than throwing — the calculator must work exactly
// the same either way.
import type { DecimalString } from './calc-engine/types.ts'

const KEY_LAST_HOURLY_RATE = 'bakery-pricing-planner:last-hourly-rate'

export function getLastHourlyRate(): DecimalString | null {
  try {
    return localStorage.getItem(KEY_LAST_HOURLY_RATE)
  } catch {
    return null
  }
}

export function setLastHourlyRate(value: DecimalString): void {
  try {
    localStorage.setItem(KEY_LAST_HOURLY_RATE, value)
  } catch {
    // Silently ignored — see file header.
  }
}
