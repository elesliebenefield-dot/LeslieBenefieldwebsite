// Currency display formatting using decimal.js exclusively — never a
// native JavaScript Number/toFixed — so that displaying a value can never
// introduce the float-precision artifacts the whole app exists to avoid.
import { fromStorageString } from './calc-engine/decimal.ts'
import type { DecimalString } from './calc-engine/types.ts'

// Tiny fractional ingredient costs (a pinch of salt, a splash of vanilla)
// are shown to 4 decimal places rather than rounding to $0.00, per the PRD.
// A value that is genuinely zero is not "tiny" — it displays as $0.00.
export function formatMoney(value: DecimalString): string {
  const decimal = fromStorageString(value)
  const digits = !decimal.isZero() && decimal.abs().lt('0.01') ? 4 : 2
  return `$${decimal.toFixed(digits)}`
}
