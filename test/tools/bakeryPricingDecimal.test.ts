// Pure, browser-free unit tests for the Bakery Pricing Calculator's decimal
// round-trip helpers (src/tools/bakery-pricing/calc-engine/decimal.ts).
// Ported from the calc engine's original Vitest suite (Milestone M1) to this
// repository's node:test + fast-check convention. No browser, no build step.
//
// Run with: node --test test/tools/bakeryPricingDecimal.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { fromStorageString, toStorageString } from '../../src/tools/bakery-pricing/calc-engine/decimal.ts'

test('preserves a value that IEEE-754 float arithmetic would corrupt', () => {
  const a = fromStorageString('0.1')
  const b = fromStorageString('0.2')
  assert.equal(toStorageString(a.plus(b)), '0.3')
})

test('never produces a value equal to what native-number math would (regression guard)', () => {
  const decimalResult = toStorageString(fromStorageString('10').times(fromStorageString('1').dividedBy(3)))
  const floatResult = 10 * (1 / 3)
  assert.notEqual(decimalResult, String(floatResult))
})

test('round-trips arbitrary decimal strings to a stable canonical form', () => {
  fc.assert(
    fc.property(
      fc.tuple(fc.integer({ min: 0, max: 999999 }), fc.integer({ min: 0, max: 999999999 })),
      ([whole, frac]) => {
        const input = `${whole}.${String(frac).padStart(9, '0')}`
        const written = toStorageString(fromStorageString(input))
        const rereadThenWritten = toStorageString(fromStorageString(written))
        assert.equal(rereadThenWritten, written)
      },
    ),
  )
})
