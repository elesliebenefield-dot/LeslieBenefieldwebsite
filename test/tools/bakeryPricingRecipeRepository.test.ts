// Tests for the recipe repository: create/read/edit/duplicate/delete,
// what-if non-persistence, and transaction rollback/atomicity. Uses
// fake-indexeddb; see bakeryPricingRealBrowserData.test.ts for the
// companion real-browser check.
//
// Run with: node --test test/tools/bakeryPricingRecipeRepository.test.ts

import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openAppDatabase, DB_NAME, STORE_RECIPES, STORE_USAGES } from '../../src/tools/bakery-pricing/data/schema.ts'
import { promisifyRequest } from '../../src/tools/bakery-pricing/data/db.ts'
import { createIngredient } from '../../src/tools/bakery-pricing/data/ingredientRepository.ts'
import {
  createRecipe,
  deleteRecipe,
  duplicateRecipe,
  getRecipeWithUsages,
  listRecipes,
  setRecipeUsages,
  updateRecipe,
} from '../../src/tools/bakery-pricing/data/recipeRepository.ts'
import { NotFoundError } from '../../src/tools/bakery-pricing/data/errors.ts'

async function freshDb() {
  return openAppDatabase()
}

function closeAndWipe(db: IDBDatabase) {
  db.close()
  indexedDB.deleteDatabase(DB_NAME)
}

const baseRecipe = {
  name: 'Chocolate Chip Cookies',
  yield: 24,
  laborHourlyRate: '18',
  laborMinutes: '40',
  supplyItems: [{ id: 'supply-1', name: 'Box', mode: 'direct' as const, directCost: '1.50' }],
  overheadFlatCost: '3.00',
  wastePercent: '3',
  desiredMarginPercent: '35',
  roundingIncrement: '0.25' as const,
  acknowledgedZeroCostFlags: { labor: false, supplies: false, overhead: false, waste: false },
  currencyCode: 'USD',
}

test('creates a recipe with its ingredient usages in one transaction', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })
    const { recipe, usages } = await createRecipe(db, baseRecipe, [
      { ingredientId: flour.id, amountUsed: '280', amountUsedUnit: 'g' },
    ])
    assert.equal(recipe.name, 'Chocolate Chip Cookies')
    assert.equal(usages.length, 1)
    assert.equal(usages[0]?.ingredientId, flour.id)
  } finally {
    closeAndWipe(db)
  }
})

test('reads a recipe back with its usages', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })
    const { recipe } = await createRecipe(db, baseRecipe, [{ ingredientId: flour.id, amountUsed: '280', amountUsedUnit: 'g' }])
    const fetched = await getRecipeWithUsages(db, recipe.id)
    assert.equal(fetched.recipe.name, 'Chocolate Chip Cookies')
    assert.equal(fetched.usages.length, 1)
  } finally {
    closeAndWipe(db)
  }
})

test('lists all saved recipes with no limit (the tool is free)', async () => {
  const db = await freshDb()
  try {
    for (let i = 0; i < 10; i++) {
      await createRecipe(db, { ...baseRecipe, name: `Recipe ${i}` }, [])
    }
    const all = await listRecipes(db)
    assert.equal(all.length, 10, 'no saved-recipe limit should apply')
  } finally {
    closeAndWipe(db)
  }
})

test('edits a recipe field', async () => {
  const db = await freshDb()
  try {
    const { recipe } = await createRecipe(db, baseRecipe, [])
    const updated = await updateRecipe(db, recipe.id, { desiredMarginPercent: '40' })
    assert.equal(updated.desiredMarginPercent, '40')
    assert.equal(updated.id, recipe.id)
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
    const { recipe } = await createRecipe(db, baseRecipe, [])

    const firstEdit = await updateRecipe(db, recipe.id, { desiredMarginPercent: '40' })
    assert.ok(
      new Date(firstEdit.updatedAt).getTime() > new Date(recipe.createdAt).getTime(),
      `expected updatedAt (${firstEdit.updatedAt}) strictly later than createdAt (${recipe.createdAt})`,
    )

    // No delay between these two edits — this is exactly the case where a
    // millisecond-resolution `Date.now()` timestamp could produce two
    // identical values. The clock must still keep them strictly ordered.
    const secondEdit = await updateRecipe(db, recipe.id, { desiredMarginPercent: '45' })
    assert.ok(
      new Date(secondEdit.updatedAt).getTime() > new Date(firstEdit.updatedAt).getTime(),
      `expected second updatedAt (${secondEdit.updatedAt}) strictly later than first (${firstEdit.updatedAt})`,
    )
  } finally {
    closeAndWipe(db)
  }
})

test('replaces a recipe\'s ingredient usages atomically', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })
    const sugar = await createIngredient(db, { name: 'Sugar', packagePrice: '2.99', packageQuantity: '4', packageUnit: 'lb' })
    const { recipe } = await createRecipe(db, baseRecipe, [{ ingredientId: flour.id, amountUsed: '280', amountUsedUnit: 'g' }])

    await setRecipeUsages(db, recipe.id, [{ ingredientId: sugar.id, amountUsed: '200', amountUsedUnit: 'g' }])

    const { usages } = await getRecipeWithUsages(db, recipe.id)
    assert.equal(usages.length, 1)
    assert.equal(usages[0]?.ingredientId, sugar.id)
  } finally {
    closeAndWipe(db)
  }
})

test('duplicating a recipe creates an independent copy referencing the same ingredients', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })
    const { recipe: original } = await createRecipe(db, baseRecipe, [
      { ingredientId: flour.id, amountUsed: '280', amountUsedUnit: 'g' },
    ])

    const { recipe: copy, usages: copyUsages } = await duplicateRecipe(db, original.id, 'Chocolate Chip Cookies (Copy)')

    assert.notEqual(copy.id, original.id)
    assert.equal(copy.name, 'Chocolate Chip Cookies (Copy)')
    assert.equal(copyUsages.length, 1)
    assert.equal(copyUsages[0]?.ingredientId, flour.id)
    assert.notEqual(copyUsages[0]?.id, undefined)

    // Editing the copy's usages must not affect the original.
    await setRecipeUsages(db, copy.id, [])
    const originalStill = await getRecipeWithUsages(db, original.id)
    assert.equal(originalStill.usages.length, 1, 'duplicate must not share usage rows with the original')

    const all = await listRecipes(db)
    assert.equal(all.length, 2)
  } finally {
    closeAndWipe(db)
  }
})

test('deletes a recipe and its own usage rows, without touching the referenced ingredient', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, { name: 'Flour', packagePrice: '3.49', packageQuantity: '5', packageUnit: 'lb' })
    const { recipe } = await createRecipe(db, baseRecipe, [{ ingredientId: flour.id, amountUsed: '280', amountUsedUnit: 'g' }])

    await deleteRecipe(db, recipe.id)

    await assert.rejects(() => getRecipeWithUsages(db, recipe.id), NotFoundError)

    const tx = db.transaction([STORE_USAGES], 'readonly')
    const remainingUsages = await promisifyRequest(tx.objectStore(STORE_USAGES).getAll())
    assert.equal(remainingUsages.length, 0, 'the recipe\'s own usage rows must be removed')

    // The ingredient itself is untouched — this is not the forbidden
    // ingredient cascade-delete, only cleanup of the recipe's own rows.
    const ingredients = await promisifyRequest(
      db.transaction(['ingredients'], 'readonly').objectStore('ingredients').getAll(),
    )
    assert.equal(ingredients.length, 1)
  } finally {
    closeAndWipe(db)
  }
})

test('deleting an already-deleted recipe throws NotFoundError', async () => {
  const db = await freshDb()
  try {
    const { recipe } = await createRecipe(db, baseRecipe, [])
    await deleteRecipe(db, recipe.id)
    await assert.rejects(() => deleteRecipe(db, recipe.id), NotFoundError)
  } finally {
    closeAndWipe(db)
  }
})

test('what-if: mutating an in-memory copy of a recipe never affects saved data unless explicitly saved', async () => {
  const db = await freshDb()
  try {
    const { recipe } = await createRecipe(db, baseRecipe, [])

    // Simulates a what-if scenario: take the fetched recipe, change values
    // in memory, but never call updateRecipe().
    const whatIf = { ...recipe, desiredMarginPercent: '75', laborHourlyRate: '999' }
    void whatIf // the scratch copy is deliberately never persisted

    const stillSaved = await getRecipeWithUsages(db, recipe.id)
    assert.equal(stillSaved.recipe.desiredMarginPercent, baseRecipe.desiredMarginPercent)
    assert.equal(stillSaved.recipe.laborHourlyRate, baseRecipe.laborHourlyRate)

    // Only an explicit save (updateRecipe) changes what's stored.
    await updateRecipe(db, recipe.id, { desiredMarginPercent: '75' })
    const afterSave = await getRecipeWithUsages(db, recipe.id)
    assert.equal(afterSave.recipe.desiredMarginPercent, '75')
  } finally {
    closeAndWipe(db)
  }
})

test('transaction rollback: a failed write inside a multi-store transaction leaves no partial data behind', async () => {
  const db = await freshDb()
  try {
    const recipeId = crypto.randomUUID()
    const duplicateUsageId = crypto.randomUUID()

    const tx = db.transaction([STORE_RECIPES, STORE_USAGES], 'readwrite')
    tx.objectStore(STORE_RECIPES).add({ ...baseRecipe, id: recipeId, createdAt: 'x', updatedAt: 'x' })
    const usageStore = tx.objectStore(STORE_USAGES)
    usageStore.add({ id: duplicateUsageId, recipeId, ingredientId: 'i1', amountUsed: '1', amountUsedUnit: 'g' })
    // Adding the same key twice triggers a ConstraintError, aborting the
    // whole transaction — including the recipe insert above.
    usageStore.add({ id: duplicateUsageId, recipeId, ingredientId: 'i2', amountUsed: '2', amountUsedUnit: 'g' })

    await assert.rejects(() => new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(undefined)
      tx.onabort = () => reject(new Error('aborted'))
    }))

    await assert.rejects(() => getRecipeWithUsages(db, recipeId), NotFoundError, 'the recipe must NOT exist — the whole transaction rolled back')
  } finally {
    closeAndWipe(db)
  }
})
