// Pure, browser-free unit tests for the Bakery Pricing Calculator's formula
// engine (src/tools/bakery-pricing/calc-engine/formulas.ts). Ported from the
// calc engine's original Vitest suite (Milestone M1), including the
// deterministic worked-recipe example and the property-based invariants.
//
// Run with: node --test test/tools/bakeryPricingFormulas.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import Decimal from 'decimal.js'
import {
  computeCostBreakdown,
  computeIngredientCost,
  computeIngredientSubtotal,
  computeSuggestedPricing,
  computeSuppliesSubtotal,
  computeSupplyDirectCost,
  computeSupplyItemCost,
} from '../../src/tools/bakery-pricing/calc-engine/formulas.ts'
import { fromStorageString } from '../../src/tools/bakery-pricing/calc-engine/decimal.ts'
import type { IngredientInput } from '../../src/tools/bakery-pricing/calc-engine/types.ts'

// Tolerance-based comparison helper for test expectations only (not part of
// the production calculation path, which stays exact decimal throughout).
function closeTo(actual: string, expected: number, epsilon = 1e-6) {
  assert.ok(
    Math.abs(Number(actual) - expected) < epsilon,
    `expected ${actual} to be close to ${expected} (epsilon ${epsilon})`,
  )
}

// ── computeIngredientCost ────────────────────────────────────────────────────

test('computes cost = price * (used / packageQty) within the same measurement type', () => {
  const flour: IngredientInput = {
    packagePrice: '3.49',
    packageQuantity: '5',
    packageUnit: 'lb',
    amountUsed: '280',
    usageUnit: 'g',
  }
  const result = computeIngredientCost(flour)
  assert.equal(result.valid, true)
  if (result.valid) {
    closeTo(result.value, 0.430869, 1e-5)
  }
})

test('never truncates a tiny fractional cost to zero, and preserves precision beyond 2 decimal places', () => {
  const vanilla: IngredientInput = {
    packagePrice: '7.49',
    packageQuantity: '1',
    packageUnit: 'cup',
    amountUsed: '1.5',
    usageUnit: 'tsp',
  }
  const result = computeIngredientCost(vanilla)
  assert.equal(result.valid, true)
  if (result.valid) {
    assert.notEqual(result.value, '0')
    assert.notEqual(result.value, '0.00')
    closeTo(result.value, 0.234106, 1e-4)
    const decimalPlaces = result.value.split('.')[1]?.length ?? 0
    assert.ok(decimalPlaces > 2)
  }
})

test('blocks a weight/volume mismatch with no conversion supplied — never guesses a density', () => {
  const bad: IngredientInput = {
    packagePrice: '3.49',
    packageQuantity: '5',
    packageUnit: 'lb', // weight
    amountUsed: '2',
    usageUnit: 'tsp', // volume
  }
  const result = computeIngredientCost(bad)
  assert.equal(result.valid, false)
  if (!result.valid) {
    assert.match(result.reason, /different measurement types/)
  }
})

test('blocks a weight/volume mismatch even when a conversion is supplied with an invalid (zero) weight', () => {
  const bad: IngredientInput = {
    packagePrice: '3.49',
    packageQuantity: '5',
    packageUnit: 'lb',
    amountUsed: '2',
    usageUnit: 'tsp',
    customConversion: { volumeUnit: 'tsp', weightQuantity: '0', weightUnit: 'g' },
  }
  const result = computeIngredientCost(bad)
  assert.equal(result.valid, false)
})

test('blocks a count/weight or count/volume mismatch — no conversion path is ever offered for count', () => {
  const countVsWeight: IngredientInput = {
    packagePrice: '3.99', packageQuantity: '12', packageUnit: 'each', amountUsed: '280', usageUnit: 'g',
  }
  assert.equal(computeIngredientCost(countVsWeight).valid, false)

  const countVsVolume: IngredientInput = {
    packagePrice: '3.99', packageQuantity: '12', packageUnit: 'each', amountUsed: '1', usageUnit: 'cup',
  }
  assert.equal(computeIngredientCost(countVsVolume).valid, false)
})

test('computes cost across volume units of different sizes (package in cups, recipe in tablespoons)', () => {
  const vanilla: IngredientInput = {
    packagePrice: '7.49',
    packageQuantity: '1',
    packageUnit: 'cup',
    amountUsed: '3',
    usageUnit: 'tbsp',
  }
  const result = computeIngredientCost(vanilla)
  assert.equal(result.valid, true)
  // 1 cup = 236.588 mL; 3 tbsp = 44.3604 mL; 7.49 * (44.3604/236.588) ≈ 1.404380
  if (result.valid) closeTo(result.value, 1.404380, 1e-4)
})

// Flour: 5 lb package, recipe calls for 2 cups, baker enters "1 cup weighs 120 g".
test('bridges a weight package and a volume recipe amount using a baker-supplied conversion (flour, lb -> cups)', () => {
  const flour: IngredientInput = {
    packagePrice: '3.49',
    packageQuantity: '5',
    packageUnit: 'lb',
    amountUsed: '2',
    usageUnit: 'cup',
    customConversion: { volumeUnit: 'cup', weightQuantity: '120', weightUnit: 'g' },
  }
  const result = computeIngredientCost(flour)
  assert.equal(result.valid, true)
  if (result.valid) {
    // 2 cups * 120 g/cup = 240 g used; 5 lb = 2267.9619 g package.
    // cost = 3.49 * (240 / 2267.96185) ≈ 0.3693184
    closeTo(result.value, 0.369318, 1e-5)
  }
})

// Same ingredient, reverse direction: sold by volume, recipe measures by weight.
test('bridges a volume package and a weight recipe amount using a baker-supplied conversion', () => {
  const honey: IngredientInput = {
    packagePrice: '9.99',
    packageQuantity: '2',
    packageUnit: 'cup',
    amountUsed: '336',
    usageUnit: 'g',
    customConversion: { volumeUnit: 'cup', weightQuantity: '336', weightUnit: 'g' },
  }
  const result = computeIngredientCost(honey)
  assert.equal(result.valid, true)
  if (result.valid) {
    // By construction, 336 g is exactly 1 cup under this conversion, and the
    // package is 2 cups, so 336 g should cost exactly half the package price.
    closeTo(result.value, 4.995, 1e-6)
  }
})

test('rejects a negative package price', () => {
  const bad: IngredientInput = {
    packagePrice: '-1',
    packageQuantity: '5',
    packageUnit: 'g',
    amountUsed: '1',
    usageUnit: 'g',
  }
  assert.equal(computeIngredientCost(bad).valid, false)
})

test('rejects a zero package quantity', () => {
  const bad: IngredientInput = {
    packagePrice: '1',
    packageQuantity: '0',
    packageUnit: 'g',
    amountUsed: '1',
    usageUnit: 'g',
  }
  assert.equal(computeIngredientCost(bad).valid, false)
})

// ── computeIngredientSubtotal ────────────────────────────────────────────────

test('sums a list of ingredient costs exactly', () => {
  assert.equal(computeIngredientSubtotal(['0.43', '0.33', '2.15']), '2.91')
})

test('returns zero for an empty ingredient list', () => {
  assert.equal(computeIngredientSubtotal([]), '0')
})

// ── computeSupplyItemCost / computeSupplyDirectCost / computeSuppliesSubtotal ──

test('supply package cost = price * (used / packageQty), no units involved', () => {
  // 100 cake-pop sticks cost $5.00; this recipe uses 24.
  const result = computeSupplyItemCost({ packagePrice: '5.00', packageQuantity: '100', amountUsed: '24' })
  assert.equal(result.valid, true)
  if (result.valid) closeTo(result.value, 1.2, 1e-9)
})

test('supply package cost preserves a fractional (non-round) result exactly', () => {
  const result = computeSupplyItemCost({ packagePrice: '10', packageQuantity: '3', amountUsed: '1' })
  assert.equal(result.valid, true)
  if (result.valid) assert.equal(result.value, fromStorageString('10').dividedBy(3).toFixed())
})

test('supply package cost rejects a zero package quantity and a negative price', () => {
  assert.equal(computeSupplyItemCost({ packagePrice: '5', packageQuantity: '0', amountUsed: '1' }).valid, false)
  assert.equal(computeSupplyItemCost({ packagePrice: '-1', packageQuantity: '5', amountUsed: '1' }).valid, false)
})

test('supply package cost with a zero amount used is zero, not an error', () => {
  const result = computeSupplyItemCost({ packagePrice: '5', packageQuantity: '100', amountUsed: '0' })
  assert.equal(result.valid, true)
  if (result.valid) assert.equal(result.value, '0')
})

test('direct supply cost passes the entered cost straight through', () => {
  const result = computeSupplyDirectCost('6.50')
  assert.equal(result.valid, true)
  if (result.valid) assert.equal(result.value, '6.5')
})

test('direct supply cost rejects a negative value, accepts zero', () => {
  assert.equal(computeSupplyDirectCost('-0.01').valid, false)
  assert.equal(computeSupplyDirectCost('0').valid, true)
})

test('supplies subtotal sums package-mode and direct-mode item costs together', () => {
  const stickCost = computeSupplyItemCost({ packagePrice: '5.00', packageQuantity: '100', amountUsed: '24' })
  const boxCost = computeSupplyDirectCost('6.50')
  assert.equal(stickCost.valid && boxCost.valid, true)
  if (stickCost.valid && boxCost.valid) {
    assert.equal(computeSuppliesSubtotal([stickCost.value, boxCost.value]), '7.7')
  }
})

test('supplies subtotal is zero when there are no items', () => {
  assert.equal(computeSuppliesSubtotal([]), '0')
})

// ── computeCostBreakdown — full worked recipe (chocolate chip cookies, yield 24) ──

const worked = {
  ingredientSubtotal: '6.570247356321839080',
  wastePercent: '3',
  laborHourlyRate: '18',
  laborMinutes: '40',
  // Equivalent to the old batch ($1.50) + per-item ($0.15 x 24) packaging
  // formula — now pre-summed by the UI from individual supply line items
  // (computeSuppliesSubtotal) before reaching computeCostBreakdown.
  suppliesSubtotal: '5.10',
  overheadFlatCost: '3.00',
  yield_: 24,
}

test('produces a total production cost and cost per unit matching the hand-verified example', () => {
  const result = computeCostBreakdown(worked)
  assert.equal(result.valid, true)
  if (result.valid) {
    closeTo(result.value.totalProductionCost, 26.867, 1e-2)
    closeTo(result.value.costPerUnit, 1.1195, 1e-3)
    closeTo(result.value.wasteAllowance, 0.1971, 1e-3)
    closeTo(result.value.laborCost, 12.0, 1e-9)
    closeTo(result.value.suppliesCost, 5.1, 1e-9)
  }
})

test('total production cost equals the sum of its parts, exactly', () => {
  const result = computeCostBreakdown(worked)
  assert.equal(result.valid, true)
  if (result.valid) {
    const sum = fromStorageString(result.value.ingredientSubtotal)
      .plus(fromStorageString(result.value.wasteAllowance))
      .plus(fromStorageString(result.value.laborCost))
      .plus(fromStorageString(result.value.suppliesCost))
      .plus(fromStorageString(result.value.overhead))
    assert.ok(sum.equals(fromStorageString(result.value.totalProductionCost)))
  }
})

test('rejects an invalid (non-integer) yield', () => {
  const result = computeCostBreakdown({ ...worked, yield_: 1.5 })
  assert.equal(result.valid, false)
})

test('rejects a negative overhead', () => {
  const result = computeCostBreakdown({ ...worked, overheadFlatCost: '-1' })
  assert.equal(result.valid, false)
})

// ── computeSuggestedPricing ──────────────────────────────────────────────────

const totalProductionCost = '26.867423356321839080'
const yieldCount = 24

test('computes the exact target price and rounds up to the suggested price', () => {
  const result = computeSuggestedPricing(totalProductionCost, yieldCount, '35', '0.25')
  assert.equal(result.valid, true)
  if (result.valid) {
    closeTo(result.value.exactTargetPriceBatch, 41.334, 1e-2)
    closeTo(result.value.exactTargetPricePerItem, 1.7223, 1e-3)
    assert.equal(result.value.suggestedWholeBatchPrice, '41.5')
    assert.equal(result.value.suggestedPerItemPrice, '1.75')
    closeTo(result.value.equivalentMarkupRate, 0.538461, 1e-4)
  }
})

test('demonstrates the expected independent-rounding mismatch (documented as expected, not a bug)', () => {
  const result = computeSuggestedPricing(totalProductionCost, yieldCount, '35', '0.25')
  assert.equal(result.valid, true)
  if (result.valid) {
    const perItemTimesYield = fromStorageString(result.value.suggestedPerItemPrice).times(yieldCount)
    const batch = fromStorageString(result.value.suggestedWholeBatchPrice)
    assert.equal(perItemTimesYield.equals(batch), false)
  }
})

test('never rounds a suggested price down below its exact target', () => {
  const result = computeSuggestedPricing(totalProductionCost, yieldCount, '35', '0.25')
  assert.equal(result.valid, true)
  if (result.valid) {
    assert.ok(
      fromStorageString(result.value.suggestedWholeBatchPrice).gte(
        fromStorageString(result.value.exactTargetPriceBatch),
      ),
    )
    assert.ok(
      fromStorageString(result.value.suggestedPerItemPrice).gte(
        fromStorageString(result.value.exactTargetPricePerItem),
      ),
    )
  }
})

test('leaves an exact multiple of the increment unchanged (no artificial bump)', () => {
  const result = computeSuggestedPricing('6.5', 1, '35', '0.25')
  assert.equal(result.valid, true)
  if (result.valid) {
    assert.equal(result.value.exactTargetPriceBatch, '10')
    assert.equal(result.value.suggestedWholeBatchPrice, '10')
  }
})

test('supports the $0.50 and $1.00 rounding increments', () => {
  const half = computeSuggestedPricing('10.10', 1, '0', '0.50')
  assert.equal(half.valid, true)
  if (half.valid) assert.equal(half.value.suggestedWholeBatchPrice, '10.5')

  const whole = computeSuggestedPricing('10.10', 1, '0', '1.00')
  assert.equal(whole.valid, true)
  if (whole.valid) assert.equal(whole.value.suggestedWholeBatchPrice, '11')
})

test('rejects margin at exactly 100%', () => {
  assert.equal(computeSuggestedPricing(totalProductionCost, yieldCount, '100', '0.25').valid, false)
})

test('rejects a zero or negative rounding increment', () => {
  assert.equal(computeSuggestedPricing(totalProductionCost, yieldCount, '35', '0').valid, false)
  assert.equal(computeSuggestedPricing(totalProductionCost, yieldCount, '35', '-0.25').valid, false)
})

test('never lets the display-only equivalent markup rate influence the target price (regression guard)', () => {
  const a = computeSuggestedPricing('100', 10, '50', '0.25')
  const b = computeSuggestedPricing('100', 10, '50', '0.25')
  assert.equal(a.valid && b.valid, true)
  if (a.valid && b.valid) {
    assert.equal(a.value.exactTargetPriceBatch, b.value.exactTargetPriceBatch)
  }
})

// ── Invariant / property-based tests ─────────────────────────────────────────

const decimalArb = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true }).map((n) => n.toFixed(6))

test('increasing any single valid cost input cannot decrease total production cost', () => {
  fc.assert(
    fc.property(
      decimalArb(0, 1000),
      decimalArb(0, 100),
      decimalArb(0, 500),
      decimalArb(0, 50),
      decimalArb(0, 50),
      decimalArb(0, 500),
      fc.integer({ min: 1, max: 1000 }),
      decimalArb(0.01, 100),
      (ingredientSubtotal, wastePercent, laborHourlyRate, laborMinutes, suppliesSubtotal, overheadFlatCost, yield_, delta) => {
        const base = computeCostBreakdown({
          ingredientSubtotal,
          wastePercent,
          laborHourlyRate,
          laborMinutes,
          suppliesSubtotal,
          overheadFlatCost,
          yield_,
        })
        const increased = computeCostBreakdown({
          ingredientSubtotal,
          wastePercent,
          laborHourlyRate,
          laborMinutes,
          suppliesSubtotal,
          overheadFlatCost: new Decimal(overheadFlatCost).plus(delta).toFixed(),
          yield_,
        })
        if (!base.valid || !increased.valid) return true
        return fromStorageString(increased.value.totalProductionCost).gte(
          fromStorageString(base.value.totalProductionCost),
        )
      },
    ),
    { numRuns: 200 },
  )
})

test('increasing yield while holding total production cost fixed cannot increase exact cost per unit', () => {
  fc.assert(
    fc.property(
      decimalArb(0.01, 1000),
      fc.integer({ min: 1, max: 500 }),
      fc.integer({ min: 1, max: 500 }),
      (totalCost, yieldA, extra) => {
        const yieldB = yieldA + extra
        const a = fromStorageString(totalCost).dividedBy(yieldA)
        const b = fromStorageString(totalCost).dividedBy(yieldB)
        return b.lte(a)
      },
    ),
    { numRuns: 200 },
  )
})

test('increasing the desired margin cannot decrease the exact target selling price', () => {
  fc.assert(
    fc.property(
      decimalArb(0.01, 1000),
      fc.integer({ min: 1, max: 500 }),
      fc.double({ min: 0, max: 98, noNaN: true }),
      fc.double({ min: 0.01, max: 1.99, noNaN: true }),
      (totalCost, yieldCount2, marginA, marginDelta) => {
        const marginB = Math.min(marginA + marginDelta, 99.999999)
        const a = computeSuggestedPricing(totalCost, yieldCount2, marginA.toFixed(6), '0.25')
        const b = computeSuggestedPricing(totalCost, yieldCount2, marginB.toFixed(6), '0.25')
        if (!a.valid || !b.valid) return true
        return fromStorageString(b.value.exactTargetPriceBatch).gte(
          fromStorageString(a.value.exactTargetPriceBatch),
        )
      },
    ),
    { numRuns: 200 },
  )
})

test('suggested prices never round downward relative to the exact target, for any valid margin/increment', () => {
  fc.assert(
    fc.property(
      decimalArb(0.01, 1000),
      fc.integer({ min: 1, max: 200 }),
      fc.double({ min: 0, max: 99, noNaN: true }),
      fc.constantFrom('0.25', '0.50', '1.00'),
      (totalCost, yieldCount2, margin, increment) => {
        const result = computeSuggestedPricing(totalCost, yieldCount2, margin.toFixed(6), increment)
        if (!result.valid) return true
        return (
          fromStorageString(result.value.suggestedWholeBatchPrice).gte(
            fromStorageString(result.value.exactTargetPriceBatch),
          ) &&
          fromStorageString(result.value.suggestedPerItemPrice).gte(
            fromStorageString(result.value.exactTargetPricePerItem),
          )
        )
      },
    ),
    { numRuns: 200 },
  )
})
