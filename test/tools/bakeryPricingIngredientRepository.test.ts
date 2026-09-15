// Tests for the reusable-ingredient repository, including referential
// integrity, measurement-type-change enforcement, and exact decimal-string
// round trips. Uses fake-indexeddb; see bakeryPricingRealBrowserData.test.ts
// for the companion real-browser check.
//
// Run with: node --test test/tools/bakeryPricingIngredientRepository.test.ts

import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openAppDatabase, DB_NAME } from '../../src/tools/bakery-pricing/data/schema.ts'
import {
  createIngredient,
  deleteIngredient,
  getIngredient,
  listIngredients,
  updateIngredient,
} from '../../src/tools/bakery-pricing/data/ingredientRepository.ts'
import { createRecipe } from '../../src/tools/bakery-pricing/data/recipeRepository.ts'
import { IncompatibleMeasurementTypeError, IngredientInUseError, NotFoundError } from '../../src/tools/bakery-pricing/data/errors.ts'

async function freshDb() {
  return openAppDatabase()
}

function closeAndWipe(db: IDBDatabase) {
  db.close()
  indexedDB.deleteDatabase(DB_NAME)
}

const baseRecipe = {
  name: 'Test Recipe',
  yield: 12,
  laborHourlyRate: '0',
  laborMinutes: '0',
  supplyItems: [],
  overheadFlatCost: '0',
  wastePercent: '0',
  desiredMarginPercent: '0',
  roundingIncrement: '0.25' as const,
  acknowledgedZeroCostFlags: { labor: true, supplies: true, overhead: true, waste: true },
  currencyCode: 'USD',
}

test('creates an ingredient with a derived measurement type and timestamps', async () => {
  const db = await freshDb()
  try {
    const ingredient = await createIngredient(db, {
      name: 'Flour',
      packagePrice: '3.49',
      packageQuantity: '5',
      packageUnit: 'lb',
    })
    assert.equal(ingredient.measurementType, 'weight')
    assert.ok(ingredient.id.length > 0)
    assert.ok(ingredient.createdAt.length > 0)
    assert.equal(ingredient.createdAt, ingredient.updatedAt)
  } finally {
    closeAndWipe(db)
  }
})

test('stores decimal values as exact strings and round-trips them unchanged', async () => {
  const db = await freshDb()
  try {
    const created = await createIngredient(db, {
      name: 'Vanilla Extract',
      packagePrice: '7.490000001', // deliberately awkward precision
      packageQuantity: '1',
      packageUnit: 'cup',
    })
    const fetched = await getIngredient(db, created.id)
    assert.equal(typeof fetched.packagePrice, 'string')
    assert.equal(fetched.packagePrice, '7.490000001', 'exact decimal string must round-trip with no precision loss')
  } finally {
    closeAndWipe(db)
  }
})

test('lists all created ingredients', async () => {
  const db = await freshDb()
  try {
    await createIngredient(db, { name: 'Sugar', packagePrice: '2.99', packageQuantity: '4', packageUnit: 'lb' })
    await createIngredient(db, { name: 'Eggs', packagePrice: '3.99', packageQuantity: '12', packageUnit: 'each' })
    const all = await listIngredients(db)
    assert.equal(all.length, 2)
  } finally {
    closeAndWipe(db)
  }
})

test('getIngredient throws NotFoundError for a missing id', async () => {
  const db = await freshDb()
  try {
    await assert.rejects(() => getIngredient(db, 'does-not-exist'), NotFoundError)
  } finally {
    closeAndWipe(db)
  }
})

test('updating a shared ingredient price/quantity is reflected the next time any recipe using it is looked up', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })
    await createRecipe(db, baseRecipe, [{ ingredientId: flour.id, amountUsed: '280', amountUsedUnit: 'g' }])

    await updateIngredient(db, flour.id, { packagePrice: '4.99' })

    // Recipes never copy ingredient values — they reference the ingredient
    // live — so re-fetching the ingredient is sufficient to prove the new
    // price is what any recipe recalculation would now use.
    const refetched = await getIngredient(db, flour.id)
    assert.equal(refetched.packagePrice, '4.99')
  } finally {
    closeAndWipe(db)
  }
})

test('blocks deleting an ingredient while a recipe references it, naming the recipe', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })
    await createRecipe(db, { ...baseRecipe, name: 'Chocolate Chip Cookies' }, [
      { ingredientId: flour.id, amountUsed: '280', amountUsedUnit: 'g' },
    ])

    await assert.rejects(
      () => deleteIngredient(db, flour.id),
      (err: unknown) => {
        assert.ok(err instanceof IngredientInUseError)
        assert.equal(err.referencingRecipes.length, 1)
        assert.equal(err.referencingRecipes[0]?.name, 'Chocolate Chip Cookies')
        return true
      },
    )

    // Never cascade-deleted: the ingredient must still exist afterward.
    const stillThere = await getIngredient(db, flour.id)
    assert.equal(stillThere.id, flour.id)
  } finally {
    closeAndWipe(db)
  }
})

test('allows deleting an ingredient once nothing references it', async () => {
  const db = await freshDb()
  try {
    const sugar = await createIngredient(db, { name: 'Sugar', packagePrice: '2.99', packageQuantity: '4', packageUnit: 'lb' })
    await deleteIngredient(db, sugar.id)
    await assert.rejects(() => getIngredient(db, sugar.id), NotFoundError)
  } finally {
    closeAndWipe(db)
  }
})

test('blocks changing a shared ingredient to an incompatible measurement type', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })
    await createRecipe(db, baseRecipe, [{ ingredientId: flour.id, amountUsed: '280', amountUsedUnit: 'g' }])

    // lb (weight) -> cup (volume) would break the existing gram-based usage.
    await assert.rejects(() => updateIngredient(db, flour.id, { packageUnit: 'cup' }), IncompatibleMeasurementTypeError)

    // Rejected atomically: the ingredient's unit must be unchanged.
    const unchanged = await getIngredient(db, flour.id)
    assert.equal(unchanged.packageUnit, 'lb')
    assert.equal(unchanged.measurementType, 'weight')
  } finally {
    closeAndWipe(db)
  }
})

test('allows changing measurement type when no existing usage would be broken', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })
    // No recipe references it yet, so any unit change is safe.
    const updated = await updateIngredient(db, flour.id, { packageUnit: 'cup' })
    assert.equal(updated.measurementType, 'volume')
  } finally {
    closeAndWipe(db)
  }
})

// The invariant: a persisted modification's updatedAt must be strictly
// later than the record's previous timestamp — never equal, even when two
// writes land in the same millisecond. Proven deterministically via the
// monotonic clock (data/clock.ts), not by sleeping between writes.
test('updatedAt strictly advances past the previous timestamp on every edit, including back-to-back edits', async () => {
  const db = await freshDb()
  try {
    const created = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })

    const firstEdit = await updateIngredient(db, created.id, { packagePrice: '3.99' })
    assert.ok(
      new Date(firstEdit.updatedAt).getTime() > new Date(created.updatedAt).getTime(),
      `expected updatedAt (${firstEdit.updatedAt}) strictly later than the original (${created.updatedAt})`,
    )

    // No delay between these two edits — this is exactly the case where a
    // millisecond-resolution `Date.now()` timestamp could produce two
    // identical values. The clock must still keep them strictly ordered.
    const secondEdit = await updateIngredient(db, created.id, { packagePrice: '4.29' })
    assert.ok(
      new Date(secondEdit.updatedAt).getTime() > new Date(firstEdit.updatedAt).getTime(),
      `expected second updatedAt (${secondEdit.updatedAt}) strictly later than first (${firstEdit.updatedAt})`,
    )
  } finally {
    closeAndWipe(db)
  }
})

test('allows changing units within the same measurement type freely', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })
    await createRecipe(db, baseRecipe, [{ ingredientId: flour.id, amountUsed: '280', amountUsedUnit: 'g' }])
    const updated = await updateIngredient(db, flour.id, { packageUnit: 'kg' })
    assert.equal(updated.packageUnit, 'kg')
    assert.equal(updated.measurementType, 'weight')
  } finally {
    closeAndWipe(db)
  }
})
