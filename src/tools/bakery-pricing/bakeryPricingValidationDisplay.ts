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
import type { ValidationResult } from './calc-engine/types.ts'

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
