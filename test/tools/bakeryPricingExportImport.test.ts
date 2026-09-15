// Tests for the local backup/restore module (M2-5): export to JSON,
// validate an import file before touching IndexedDB, and atomic full
// restore/replace. Uses fake-indexeddb; see bakeryPricingRealBrowserData
// .test.ts for the companion real-browser export/import round trip.
//
// Run with: node --test test/tools/bakeryPricingExportImport.test.ts

import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openAppDatabase, DB_NAME, DB_VERSION, STORE_INGREDIENTS, STORE_RECIPES, STORE_USAGES } from '../../src/tools/bakery-pricing/data/schema.ts'
import { promisifyRequest, promisifyTransaction } from '../../src/tools/bakery-pricing/data/db.ts'
import { createIngredient, listIngredients } from '../../src/tools/bakery-pricing/data/ingredientRepository.ts'
import { createRecipe, listRecipes, getRecipeWithUsages } from '../../src/tools/bakery-pricing/data/recipeRepository.ts'
import {
  buildExport,
  serializeExport,
  validateExportFile,
  parseAndValidateExportFile,
  importAndReplaceAll,
  EXPORT_FORMAT_VERSION,
  type ExportFile,
} from '../../src/tools/bakery-pricing/data/exportImport.ts'
import {
  DuplicateIdentifierError,
  ImportFormatError,
  ImportNotConfirmedError,
  IncompatibleUnitError,
  InvalidDecimalStringError,
  InvalidUnitError,
  MissingReferenceError,
  UnsupportedImportVersionError,
} from '../../src/tools/bakery-pricing/data/errors.ts'

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

// Populates a database with one ingredient, one recipe, and one usage
// linking them, with a deliberately awkward-precision decimal value so the
// exact-decimal-round-trip requirement is exercised throughout.
async function seedDb(db: IDBDatabase) {
  const flour = await createIngredient(db, {
    name: 'Flour',
    packagePrice: '7.490000001',
    packageQuantity: '5',
    packageUnit: 'lb',
  })
  const { recipe } = await createRecipe(db, baseRecipe, [
    { ingredientId: flour.id, amountUsed: '280', amountUsedUnit: 'g' },
  ])
  return { flour, recipe }
}

function cloneExport(file: ExportFile): ExportFile {
  return JSON.parse(JSON.stringify(file)) as ExportFile
}

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------

test('export includes an app identifier, format version, schema version, and timestamp', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    assert.equal(file.app, DB_NAME)
    assert.equal(file.exportFormatVersion, EXPORT_FORMAT_VERSION)
    assert.equal(file.schemaVersion, DB_VERSION)
    assert.equal(new Date(file.exportedAt).toISOString(), file.exportedAt)
  } finally {
    closeAndWipe(db)
  }
})

test('export contains exactly the ingredients, recipes, and usages in the database — nothing else', async () => {
  const db = await freshDb()
  try {
    const { flour, recipe } = await seedDb(db)
    const file = await buildExport(db)
    assert.equal(file.data.ingredients.length, 1)
    assert.equal(file.data.recipes.length, 1)
    assert.equal(file.data.recipeIngredientUsages.length, 1)
    assert.equal(file.data.ingredients[0]?.id, flour.id)
    assert.equal(file.data.recipes[0]?.id, recipe.id)
  } finally {
    closeAndWipe(db)
  }
})

test('serialized export is human-readable (pretty-printed) JSON, with decimal fields kept as quoted strings', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const text = serializeExport(file)

    assert.ok(text.includes('\n  '), 'expected indented, human-readable JSON, not a single minified line')
    // The awkward-precision decimal must appear as a quoted string in the
    // raw JSON text, never as a bare (and therefore lossy) JSON number.
    assert.ok(text.includes('"packagePrice": "7.490000001"'), 'decimal fields must be serialized as exact strings')
  } finally {
    closeAndWipe(db)
  }
})

// ---------------------------------------------------------------------
// Round trip: export, wipe the database (simulating a fresh browser with
// no prior data), import, and confirm the restored database is equivalent.
// ---------------------------------------------------------------------

test('a fresh database restored from an export is equivalent to the original, with exact decimal round-tripping', async () => {
  const db = await freshDb()
  try {
    const { flour, recipe } = await seedDb(db)
    const file = await buildExport(db)

    // Simulate a fresh browser: wipe everything, then reopen an empty DB.
    db.close()
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
    const freshDbInstance = await openAppDatabase()

    try {
      const summary = await importAndReplaceAll(freshDbInstance, file, { confirmed: true })
      assert.deepEqual(summary, { ingredients: 1, recipes: 1, recipeIngredientUsages: 1 })

      const ingredients = await listIngredients(freshDbInstance)
      assert.equal(ingredients.length, 1)
      assert.equal(ingredients[0]?.id, flour.id)
      assert.equal(ingredients[0]?.packagePrice, '7.490000001', 'exact decimal must survive export -> import')

      const restoredRecipe = await getRecipeWithUsages(freshDbInstance, recipe.id)
      assert.equal(restoredRecipe.recipe.name, baseRecipe.name)
      assert.equal(restoredRecipe.usages.length, 1)
      assert.equal(restoredRecipe.usages[0]?.ingredientId, flour.id)
      assert.equal(restoredRecipe.usages[0]?.amountUsed, '280')
    } finally {
      freshDbInstance.close()
      indexedDB.deleteDatabase(DB_NAME)
    }
  } finally {
    // db was already closed above; guard against double-close.
  }
})

test('round trip through serializeExport/parseAndValidateExportFile (a real file on disk) is lossless', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const text = serializeExport(file)
    const reparsed = parseAndValidateExportFile(text)
    assert.deepEqual(reparsed, file)
  } finally {
    closeAndWipe(db)
  }
})

// ---------------------------------------------------------------------
// Common-ingredient identity and custom (or overridden standard) weight/
// volume conversions must survive export/import — see the common-
// ingredient library correction in design.md.
// ---------------------------------------------------------------------

test('a common-ingredient id and a custom weight/volume conversion round-trip through export/import', async () => {
  const db = await freshDb()
  try {
    const flour = await createIngredient(db, {
      name: 'All-purpose flour',
      packagePrice: '3.49',
      packageQuantity: '5',
      packageUnit: 'lb',
      commonIngredientId: 'all-purpose-flour',
      customConversion: { volumeUnit: 'cup', weightQuantity: '120', weightUnit: 'g' },
    })
    // Package (weight) and recipe usage (volume) are a cross-type pair —
    // only valid because the ingredient carries a customConversion.
    const { recipe } = await createRecipe(db, baseRecipe, [
      { ingredientId: flour.id, amountUsed: '2', amountUsedUnit: 'cup' },
    ])
    const file = await buildExport(db)

    const text = serializeExport(file)
    const reparsed = parseAndValidateExportFile(text)
    const reparsedIngredient = reparsed.data.ingredients.find((i) => i.id === flour.id)
    assert.equal(reparsedIngredient?.commonIngredientId, 'all-purpose-flour')
    assert.deepEqual(reparsedIngredient?.customConversion, { volumeUnit: 'cup', weightQuantity: '120', weightUnit: 'g' })

    db.close()
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
    const freshDbInstance = await openAppDatabase()
    try {
      await importAndReplaceAll(freshDbInstance, file, { confirmed: true })
      const restoredIngredients = await listIngredients(freshDbInstance)
      assert.equal(restoredIngredients[0]?.commonIngredientId, 'all-purpose-flour')
      assert.deepEqual(restoredIngredients[0]?.customConversion, { volumeUnit: 'cup', weightQuantity: '120', weightUnit: 'g' })
      const restoredRecipe = await getRecipeWithUsages(freshDbInstance, recipe.id)
      assert.equal(restoredRecipe.usages[0]?.amountUsedUnit, 'cup', 'the cross-type usage itself must also survive the round trip')
    } finally {
      freshDbInstance.close()
      indexedDB.deleteDatabase(DB_NAME)
    }
  } finally {
    // db was already closed above; guard against double-close.
  }
})

test('an ingredient with no commonIngredientId or customConversion (a fully custom ingredient) still round-trips cleanly', async () => {
  const db = await freshDb()
  try {
    const { flour } = await seedDb(db)
    const file = await buildExport(db)
    const reparsed = parseAndValidateExportFile(serializeExport(file))
    const reparsedIngredient = reparsed.data.ingredients.find((i) => i.id === flour.id)
    assert.equal(reparsedIngredient?.commonIngredientId, undefined)
    assert.equal(reparsedIngredient?.customConversion, undefined)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects an ingredient whose customConversion has an invalid weight quantity', async () => {
  const db = await freshDb()
  try {
    const { recipe } = await seedDb(db)
    const file = await buildExport(db)
    const broken = cloneExport(file)
    broken.data.ingredients[0] = {
      ...broken.data.ingredients[0]!,
      customConversion: { volumeUnit: 'cup', weightQuantity: 'not-a-number', weightUnit: 'g' },
    }
    assert.throws(() => validateExportFile(broken), InvalidDecimalStringError)
    void recipe
  } finally {
    closeAndWipe(db)
  }
})

test('rejects an ingredient whose customConversion has an invalid volume unit', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const broken = cloneExport(file)
    broken.data.ingredients[0] = {
      ...broken.data.ingredients[0]!,
      customConversion: { volumeUnit: 'lb', weightQuantity: '120', weightUnit: 'g' } as never,
    }
    assert.throws(() => validateExportFile(broken), InvalidUnitError)
  } finally {
    closeAndWipe(db)
  }
})

// ---------------------------------------------------------------------
// Import requires explicit confirmation
// ---------------------------------------------------------------------

test('import refuses to run without explicit confirmation, and the database is left unchanged', async () => {
  const db = await freshDb()
  try {
    const { flour } = await seedDb(db)
    const file = await buildExport(db)
    const emptyFile: ExportFile = { ...cloneExport(file), data: { ingredients: [], recipes: [], recipeIngredientUsages: [] } }

    await assert.rejects(() => importAndReplaceAll(db, emptyFile, { confirmed: false }), ImportNotConfirmedError)

    const stillThere = await listIngredients(db)
    assert.equal(stillThere.length, 1)
    assert.equal(stillThere[0]?.id, flour.id)
  } finally {
    closeAndWipe(db)
  }
})

// ---------------------------------------------------------------------
// Import is a full restore/replace, not a merge
// ---------------------------------------------------------------------

test('import replaces all existing data rather than merging with it', async () => {
  const db = await freshDb()
  try {
    await seedDb(db) // one ingredient/recipe already saved

    const replacement = await createIngredient(db, { name: 'Sugar', packagePrice: '2.99', packageQuantity: '4', packageUnit: 'lb' })
    const replacementFile: ExportFile = {
      app: DB_NAME,
      exportFormatVersion: EXPORT_FORMAT_VERSION,
      schemaVersion: DB_VERSION,
      exportedAt: new Date().toISOString(),
      data: { ingredients: [replacement], recipes: [], recipeIngredientUsages: [] },
    }

    await importAndReplaceAll(db, replacementFile, { confirmed: true })

    const ingredients = await listIngredients(db)
    assert.equal(ingredients.length, 1, 'the original seeded ingredient must be gone — this is a replace, not a merge')
    assert.equal(ingredients[0]?.id, replacement.id)
    const recipes = await listRecipes(db)
    assert.equal(recipes.length, 0, 'the original seeded recipe must be gone too')
  } finally {
    closeAndWipe(db)
  }
})

// ---------------------------------------------------------------------
// Validation: every rejection category, with clear typed errors.
// Each test seeds the database first and confirms it is UNCHANGED after
// the rejected import — proving validation runs before any IndexedDB
// write, per the atomicity requirement.
// ---------------------------------------------------------------------

async function assertDbUnchangedAfterRejectedImport(
  db: IDBDatabase,
  attempt: () => Promise<unknown>,
  errorClass: new (...args: any[]) => Error,
) {
  const beforeIngredients = await listIngredients(db)
  const beforeRecipes = await listRecipes(db)
  await assert.rejects(attempt, errorClass)
  const afterIngredients = await listIngredients(db)
  const afterRecipes = await listRecipes(db)
  assert.deepEqual(afterIngredients, beforeIngredients, 'ingredients must be unchanged after a rejected import')
  assert.deepEqual(afterRecipes, beforeRecipes, 'recipes must be unchanged after a rejected import')
}

test('rejects malformed JSON text', async () => {
  assert.throws(() => parseAndValidateExportFile('{ not valid json'), ImportFormatError)
})

test('rejects a file that is valid JSON but not an object', () => {
  assert.throws(() => validateExportFile([1, 2, 3]), ImportFormatError)
  assert.throws(() => validateExportFile('a string'), ImportFormatError)
  assert.throws(() => validateExportFile(null), ImportFormatError)
})

test('rejects a file from a different application', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = { ...cloneExport(file), app: 'some-other-app' }
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile as ExportFile, { confirmed: true }), ImportFormatError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects an unsupported exportFormatVersion', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = { ...cloneExport(file), exportFormatVersion: 999 }
    await assertDbUnchangedAfterRejectedImport(
      db,
      () => importAndReplaceAll(db, badFile as ExportFile, { confirmed: true }),
      UnsupportedImportVersionError,
    )
  } finally {
    closeAndWipe(db)
  }
})

test('rejects an unsupported schemaVersion', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = { ...cloneExport(file), schemaVersion: 999 }
    await assertDbUnchangedAfterRejectedImport(
      db,
      () => importAndReplaceAll(db, badFile as ExportFile, { confirmed: true }),
      UnsupportedImportVersionError,
    )
  } finally {
    closeAndWipe(db)
  }
})

test('rejects an invalid decimal string (not parseable as a decimal)', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    badFile.data.ingredients[0].packagePrice = 'not-a-number'
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), InvalidDecimalStringError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects a decimal field that was serialized as a JSON number instead of a string', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    // @ts-expect-error deliberately corrupting the field under test
    badFile.data.ingredients[0].packagePrice = 7.49
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), InvalidDecimalStringError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects a non-finite decimal (NaN / Infinity)', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    badFile.data.ingredients[0].packagePrice = 'Infinity'
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), InvalidDecimalStringError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects an unrecognized unit', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    // @ts-expect-error deliberately corrupting the field under test
    badFile.data.ingredients[0].packageUnit = 'furlong'
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), InvalidUnitError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects a recipe-ingredient usage whose unit is a different measurement type than its ingredient (incompatible unit)', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    // The ingredient is weight-based (lb); switch the usage to a volume unit.
    badFile.data.recipeIngredientUsages[0]!.amountUsedUnit = 'cup'
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), IncompatibleUnitError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects a recipe-ingredient usage referencing an ingredientId that does not exist in the file', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    badFile.data.recipeIngredientUsages[0]!.ingredientId = 'does-not-exist'
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), MissingReferenceError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects a recipe-ingredient usage referencing a recipeId that does not exist in the file', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    badFile.data.recipeIngredientUsages[0]!.recipeId = 'does-not-exist'
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), MissingReferenceError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects duplicate ingredient identifiers within the file', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    const dup = { ...badFile.data.ingredients[0]!, name: 'Duplicate Flour' }
    badFile.data.ingredients.push(dup)
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), DuplicateIdentifierError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects duplicate recipe identifiers within the file', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    const dup = { ...badFile.data.recipes[0]!, name: 'Duplicate Recipe' }
    badFile.data.recipes.push(dup)
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), DuplicateIdentifierError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects duplicate recipe-ingredient usage identifiers within the file', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    const dup = { ...badFile.data.recipeIngredientUsages[0]! }
    badFile.data.recipeIngredientUsages.push(dup)
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), DuplicateIdentifierError)
  } finally {
    closeAndWipe(db)
  }
})

test('rejects a file missing required top-level fields', async () => {
  assert.throws(() => validateExportFile({ app: DB_NAME }), ImportFormatError)
  assert.throws(() => validateExportFile({ app: DB_NAME, exportFormatVersion: 1, schemaVersion: 1, exportedAt: 'x' }), ImportFormatError)
})

test('rejects a recipe with an invalid yield', async () => {
  const db = await freshDb()
  try {
    await seedDb(db)
    const file = await buildExport(db)
    const badFile = cloneExport(file)
    badFile.data.recipes[0].yield = 0
    await assertDbUnchangedAfterRejectedImport(db, () => importAndReplaceAll(db, badFile, { confirmed: true }), ImportFormatError)
  } finally {
    closeAndWipe(db)
  }
})

// ---------------------------------------------------------------------
// Atomicity of the underlying write transaction
// ---------------------------------------------------------------------

test('atomicity: if the write transaction fails partway through, the existing data (including what was about to be cleared) is left completely unchanged', async () => {
  const db = await freshDb()
  try {
    const { flour, recipe } = await seedDb(db)

    // This reproduces importAndReplaceAll's exact transaction shape
    // (clear then add, across all three stores in one transaction) but
    // forces a ConstraintError by adding the same usage id twice — the
    // only way to exercise a genuine mid-write failure, since
    // importAndReplaceAll's own validation (already covered above) never
    // lets a caller reach the write phase with data that could collide.
    const tx = db.transaction([STORE_INGREDIENTS, STORE_RECIPES, STORE_USAGES], 'readwrite')
    tx.objectStore(STORE_INGREDIENTS).clear()
    tx.objectStore(STORE_RECIPES).clear()
    const usageStore = tx.objectStore(STORE_USAGES)
    usageStore.clear()
    const duplicateId = 'forced-duplicate'
    usageStore.add({ id: duplicateId, recipeId: 'r', ingredientId: 'i', amountUsed: '1', amountUsedUnit: 'g' })
    usageStore.add({ id: duplicateId, recipeId: 'r', ingredientId: 'i', amountUsed: '2', amountUsedUnit: 'g' })

    await assert.rejects(() => promisifyTransaction(tx))

    // The clear() calls must have been rolled back along with the failed
    // add() — the original seeded data must still be exactly there.
    const ingredients = await listIngredients(db)
    assert.equal(ingredients.length, 1)
    assert.equal(ingredients[0]?.id, flour.id)
    const recipes = await listRecipes(db)
    assert.equal(recipes.length, 1)
    assert.equal(recipes[0]?.id, recipe.id)
    const usagesTx = db.transaction([STORE_USAGES], 'readonly')
    const usages = await promisifyRequest(usagesTx.objectStore(STORE_USAGES).getAll())
    assert.equal((usages as unknown[]).length, 1, 'the original usage row must still be there — the forced duplicate must not have partially applied')
  } finally {
    closeAndWipe(db)
  }
})
