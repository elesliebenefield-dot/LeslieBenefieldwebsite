// Shared helper for turning an engine ValidationResult into calm,
// field-specific display text — never a silent correction, never a generic
// "invalid input" message, and never shown for a field the user simply
// hasn't finished typing into yet.
//
// The engine's own validate*/compute* functions assume a syntactically
// parseable decimal string and throw (via decimal.js) on a fragment that
// isn't one yet — e.g. "-" or "." alone, which a real keystroke-by-keystroke
// typist passes through momentarily on the way to "-5" or "0.5". A
// controlled text input must never let that become an uncaught render-time
// exception, so every call into the engine from a live, as-typed field goes
// through safeCompute, which turns that specific failure into a calm,
// ordinary ValidationResult instead of letting it crash the component tree.
import type Decimal from 'decimal.js'
import { fromStorageString, toStorageString } from './calc-engine/decimal.ts'
import type { DecimalString, ValidationResult } from './calc-engine/types.ts'

// Whether a raw decimal-string field reads as "effectively nothing entered"
// for calm display purposes (a zero-cost notice, a completeness check) —
// blank counts the same as zero, and a syntactically invalid fragment never
// throws here (treated as not-zero, since the field's own inline error is
// what should surface that, not this helper).
export function isZeroOrBlank(raw: DecimalString): boolean {
  if (raw.trim() === '') return true
  try {
    return fromStorageString(raw).isZero()
  } catch {
    return false
  }
}

export function safeCompute<T>(compute: () => ValidationResult<T>): ValidationResult<T> {
  try {
    return compute()
  } catch {
    return { valid: false, reason: 'Enter a valid number.' }
  }
}

export function fieldError<T>(raw: string, validate: (value: string) => ValidationResult<T>): string | null {
  if (raw.trim() === '') return null
  const result = safeCompute(() => validate(raw))
  return result.valid ? null : result.reason
}

// Rounds a value derived from a "Help me estimate this" helper (e.g. a
// dollar-to-percent or monthly-to-per-batch division) to a sensible,
// human-editable precision before it is written into a real direct-entry
// field — this is the display/input boundary between a helper's own
// full-precision decimal.js arithmetic and the plain number a baker would
// have typed themselves. A division like 0.07 / 0.70 * 100 can resolve to
// something like "9.9999999999999999999" at decimal.js's default working
// precision; rounding here collapses that into "10", the same way
// decimal.js's own no-argument toFixed() naturally drops now-insignificant
// trailing zeros (10.00 -> "10", 9.86 stays "9.86"). This never reduces the
// precision decimal.js uses to *compute* the value, and it is never applied
// to a stored monetary value elsewhere in the app — only to a helper's own
// applied result, at the moment it becomes an ordinary editable field value.
export function roundForDirectEntry(value: Decimal, decimalPlaces: number): DecimalString {
  return toStorageString(value.toDecimalPlaces(decimalPlaces))
}
