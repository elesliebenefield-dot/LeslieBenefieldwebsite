// Pure, browser-free unit tests for the common-ingredient reference
// library (src/tools/bakery-pricing/bakeryIngredientLibrary.ts).
//
// Run with: node --test test/tools/bakeryIngredientLibrary.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMMON_INGREDIENTS,
  getCommonIngredientById,
  searchCommonIngredients,
} from '../../src/tools/bakery-pricing/bakeryIngredientLibrary.ts'

test('every entry has a unique id and a non-empty name', () => {
  const ids = new Set<string>()
  for (const entry of COMMON_INGREDIENTS) {
    assert.ok(entry.id.length > 0)
    assert.ok(entry.name.length > 0)
    assert.equal(ids.has(entry.id), false, `duplicate id: ${entry.id}`)
    ids.add(entry.id)
  }
})

test('every standardConversion weight is a positive exact decimal string', () => {
  for (const entry of COMMON_INGREDIENTS) {
    if (!entry.standardConversion) continue
    const weight = entry.standardConversion.weightGrams
    assert.match(weight, /^\d+(\.\d+)?$/, `${entry.id}: "${weight}" is not a plain positive decimal string`)
    assert.ok(Number(weight) > 0, `${entry.id}: weight must be positive`)
  }
})

test('automatic all-purpose-flour lookup by exact name', () => {
  const results = searchCommonIngredients('All-purpose flour')
  assert.ok(results.some(r => r.id === 'all-purpose-flour'))
})

test('recognizes common aliases: "AP flour", "white sugar", "powdered sugar"', () => {
  assert.ok(searchCommonIngredients('AP flour').some(r => r.id === 'all-purpose-flour'))
  assert.ok(searchCommonIngredients('white sugar').some(r => r.id === 'granulated-sugar'))
  assert.ok(searchCommonIngredients('powdered sugar').some(r => r.id === 'confectioners-sugar'))
})

test('granulated sugar and packed brown sugar are distinct entries with distinct standard conversions', () => {
  const sugar = getCommonIngredientById('granulated-sugar')
  const brownSugar = getCommonIngredientById('brown-sugar-packed')
  assert.ok(sugar?.standardConversion)
  assert.ok(brownSugar?.standardConversion)
  assert.notEqual(sugar!.standardConversion!.weightGrams, brownSugar!.standardConversion!.weightGrams)
})

test('a bare "flour" query returns multiple distinct flour varieties, never a single confident match', () => {
  const results = searchCommonIngredients('flour')
  const ids = results.map(r => r.id)
  assert.ok(ids.includes('all-purpose-flour'))
  assert.ok(ids.includes('bread-flour'))
  assert.ok(ids.includes('cake-flour'))
  assert.ok(results.length >= 3, 'ambiguous "flour" must surface every matching variety, not resolve to one')
})

test('a bare "salt" query returns every distinct salt type, including the two different kosher-salt brands', () => {
  const results = searchCommonIngredients('salt')
  const ids = results.map(r => r.id)
  assert.ok(ids.includes('table-salt'))
  assert.ok(ids.includes('kosher-salt-diamond-crystal'))
  assert.ok(ids.includes('kosher-salt-mortons'))
  assert.ok(ids.includes('fine-sea-salt'))
})

test('kosher salt brands have very different standard conversions — never conflated', () => {
  const diamond = getCommonIngredientById('kosher-salt-diamond-crystal')
  const mortons = getCommonIngredientById('kosher-salt-mortons')
  assert.equal(diamond?.standardConversion?.weightGrams, '8')
  assert.equal(mortons?.standardConversion?.weightGrams, '16')
})

test('brown sugar packed vs. unpacked are distinct ids, and only "packed" has a standard conversion', () => {
  const packed = getCommonIngredientById('brown-sugar-packed')
  const unpacked = getCommonIngredientById('brown-sugar-unpacked')
  assert.ok(packed?.standardConversion)
  assert.equal(unpacked?.standardConversion, undefined, 'unpacked brown sugar must have no guessed conversion')
})

test('confectioners\' sugar sifted vs. unsifted are distinct ids, and only unsifted has a standard conversion', () => {
  const unsifted = getCommonIngredientById('confectioners-sugar')
  const sifted = getCommonIngredientById('confectioners-sugar-sifted')
  assert.ok(unsifted?.standardConversion)
  assert.equal(sifted?.standardConversion, undefined, 'sifted confectioners\' sugar must have no guessed conversion')
})

test('fine sea salt is a recognized, distinct ingredient with no standard conversion (not on the primary reference)', () => {
  const seaSalt = getCommonIngredientById('fine-sea-salt')
  assert.ok(seaSalt)
  assert.equal(seaSalt?.standardConversion, undefined)
})

test('an unknown, made-up ingredient name returns no matches', () => {
  const results = searchCommonIngredients('xyzzy plugh grault')
  assert.deepEqual(results, [])
})

test('a query shorter than the minimum length returns no suggestions (avoids single-letter noise)', () => {
  assert.deepEqual(searchCommonIngredients('a'), [])
  assert.deepEqual(searchCommonIngredients(''), [])
})

test('getCommonIngredientById returns undefined for an unknown id', () => {
  assert.equal(getCommonIngredientById('not-a-real-id'), undefined)
})
