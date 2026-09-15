// Pure, browser-free unit tests for the Bakery Pricing Calculator's
// validation rules (src/tools/bakery-pricing/calc-engine/validation.ts).
// Ported from the calc engine's original Vitest suite (Milestone M1).
//
// Run with: node --test test/tools/bakeryPricingValidation.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateAmountUsed,
  validateConversionWeightQuantity,
  validateHourlyRate,
  validateLaborMinutes,
  validateMarginPercent,
  validateOverhead,
  validatePackageQuantity,
  validatePackagePrice,
  validateRoundingIncrement,
  validateSupplyDirectCost,
  validateUnitCompatibility,
  validateWastePercent,
  validateYield,
} from '../../src/tools/bakery-pricing/calc-engine/validation.ts'

test('rejects a negative package price, accepts zero and positive', () => {
  assert.equal(validatePackagePrice('-0.01').valid, false)
  assert.equal(validatePackagePrice('0').valid, true)
  assert.equal(validatePackagePrice('4.99').valid, true)
})

test('rejects a negative amount used, accepts zero and positive', () => {
  assert.equal(validateAmountUsed('-1').valid, false)
  assert.equal(validateAmountUsed('0').valid, true)
})

test('requires package quantity to be strictly greater than zero', () => {
  assert.equal(validatePackageQuantity('0').valid, false)
  assert.equal(validatePackageQuantity('-5').valid, false)
  assert.equal(validatePackageQuantity('0.001').valid, true)
})

test('requires yield to be a positive whole number', () => {
  assert.equal(validateYield(0).valid, false)
  assert.equal(validateYield(-3).valid, false)
  assert.equal(validateYield(1.5).valid, false)
  assert.equal(validateYield(1).valid, true)
  assert.equal(validateYield(24).valid, true)
})

test('rejects negative labor/supply/overhead inputs, accepts zero', () => {
  assert.equal(validateHourlyRate('-1').valid, false)
  assert.equal(validateHourlyRate('0').valid, true)
  assert.equal(validateLaborMinutes('-1').valid, false)
  assert.equal(validateLaborMinutes('0').valid, true)
  assert.equal(validateSupplyDirectCost('-0.01').valid, false)
  assert.equal(validateSupplyDirectCost('0').valid, true)
  assert.equal(validateOverhead('-1').valid, false)
  assert.equal(validateOverhead('0').valid, true)
})

test('requires a conversion weight to be strictly greater than zero', () => {
  assert.equal(validateConversionWeightQuantity('0').valid, false)
  assert.equal(validateConversionWeightQuantity('-5').valid, false)
  assert.equal(validateConversionWeightQuantity('120').valid, true)
})

test('rejects a negative waste percentage, accepts zero', () => {
  assert.equal(validateWastePercent('-1').valid, false)
  assert.equal(validateWastePercent('0').valid, true)
})

test('accepts margin at exactly 0%', () => {
  assert.equal(validateMarginPercent('0').valid, true)
})

test('accepts margin just under 100%', () => {
  assert.equal(validateMarginPercent('99.9999').valid, true)
})

test('rejects margin at exactly 100%', () => {
  assert.equal(validateMarginPercent('100').valid, false)
})

test('rejects margin over 100%', () => {
  assert.equal(validateMarginPercent('150').valid, false)
})

test('rejects a negative margin', () => {
  assert.equal(validateMarginPercent('-1').valid, false)
})

test('requires the rounding increment to be strictly greater than zero', () => {
  assert.equal(validateRoundingIncrement('0').valid, false)
  assert.equal(validateRoundingIncrement('-0.25').valid, false)
  assert.equal(validateRoundingIncrement('0.25').valid, true)
})

test('flags a weight/volume unit mismatch with the exact PRD-specified message', () => {
  const result = validateUnitCompatibility('lb', 'tsp')
  assert.equal(result.valid, false)
  if (!result.valid) {
    assert.match(result.reason, /different measurement types/)
  }
})

test('passes a same-type unit pairing', () => {
  assert.equal(validateUnitCompatibility('g', 'kg').valid, true)
  assert.equal(validateUnitCompatibility('cup', 'tsp').valid, true)
  assert.equal(validateUnitCompatibility('each', 'dozen').valid, true)
})
