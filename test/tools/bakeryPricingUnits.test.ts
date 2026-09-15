// Pure, browser-free unit tests for the Bakery Pricing Calculator's Unit
// Conversion Registry (src/tools/bakery-pricing/calc-engine/units.ts).
// Ported from the calc engine's original Vitest suite (Milestone M1).
//
// Run with: node --test test/tools/bakeryPricingUnits.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import Decimal from 'decimal.js'
import {
  areCompatible,
  measurementTypeOf,
  normalize,
  COUNT_TO_EACH,
  VOLUME_TO_ML,
  WEIGHT_TO_GRAMS,
} from '../../src/tools/bakery-pricing/calc-engine/units.ts'

test('classifies every weight unit correctly', () => {
  for (const unit of Object.keys(WEIGHT_TO_GRAMS)) {
    assert.equal(measurementTypeOf(unit as never), 'weight')
  }
})

test('classifies every volume unit correctly', () => {
  for (const unit of Object.keys(VOLUME_TO_ML)) {
    assert.equal(measurementTypeOf(unit as never), 'volume')
  }
})

test('classifies every count unit correctly', () => {
  for (const unit of Object.keys(COUNT_TO_EACH)) {
    assert.equal(measurementTypeOf(unit as never), 'count')
  }
})

test('normalizes weight units to grams using the pinned constants', () => {
  assert.equal(normalize(new Decimal(1), 'lb').toString(), '453.59237')
  assert.equal(normalize(new Decimal(1), 'oz').toString(), '28.349523125')
  assert.equal(normalize(new Decimal(1), 'kg').toString(), '1000')
  assert.equal(normalize(new Decimal(5), 'g').toString(), '5')
})

test('normalizes volume units to milliliters using the pinned constants', () => {
  assert.equal(normalize(new Decimal(1), 'cup').toString(), '236.588')
  assert.equal(normalize(new Decimal(1), 'tbsp').toString(), '14.7868')
  assert.equal(normalize(new Decimal(1), 'tsp').toString(), '4.92892')
  assert.equal(normalize(new Decimal(1), 'L').toString(), '1000')
})

test('normalizes count units via the explicit equivalence table only', () => {
  assert.equal(normalize(new Decimal(1), 'dozen').toString(), '12')
  assert.equal(normalize(new Decimal(3), 'each').toString(), '3')
})

test('treats every weight unit as compatible with every other weight unit', () => {
  assert.ok(areCompatible('g', 'kg'))
  assert.ok(areCompatible('oz', 'lb'))
})

test('treats every volume unit as compatible with every other volume unit', () => {
  assert.ok(areCompatible('tsp', 'cup'))
  assert.ok(areCompatible('mL', 'L'))
})

test('blocks every weight/volume pairing as incompatible — no conversion exists', () => {
  const weightUnits = Object.keys(WEIGHT_TO_GRAMS)
  const volumeUnits = Object.keys(VOLUME_TO_ML)
  for (const w of weightUnits) {
    for (const v of volumeUnits) {
      assert.equal(areCompatible(w as never, v as never), false)
    }
  }
})

test('blocks count against weight and against volume', () => {
  assert.equal(areCompatible('each', 'g'), false)
  assert.equal(areCompatible('dozen', 'mL'), false)
})
