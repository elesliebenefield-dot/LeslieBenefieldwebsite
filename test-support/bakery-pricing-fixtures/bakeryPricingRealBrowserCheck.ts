// Runs INSIDE a real browser (via Puppeteer + a real Chrome instance) as an
// ES module, exercising the actual production repository code against the
// browser's real IndexedDB implementation — not fake-indexeddb, not a mock.
// Writes its outcome to window.__RESULT__ for the Node-side test to read.
import { openAppDatabase, DB_NAME } from '../../src/tools/bakery-pricing/data/schema.ts'
import { createIngredient, deleteIngredient, getIngredient } from '../../src/tools/bakery-pricing/data/ingredientRepository.ts'
import { createRecipe, deleteRecipe } from '../../src/tools/bakery-pricing/data/recipeRepository.ts'
import { IngredientInUseError } from '../../src/tools/bakery-pricing/data/errors.ts'
import { buildExport, importAndReplaceAll } from '../../src/tools/bakery-pricing/data/exportImport.ts'

declare global {
  interface Window {
    __RESULT__?: { ok: boolean; details: Record<string, unknown>; error?: string }
  }
}

function wipeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function run() {
  const details: Record<string, unknown> = {}
  let db = await openAppDatabase()

  const ingredient = await createIngredient(db, {
    name: 'Vanilla Extract',
    packagePrice: '7.490000001',
    packageQuantity: '1',
    packageUnit: 'cup',
  })
  details.exactDecimalRoundTrip = ingredient.packagePrice === '7.490000001'

  const { recipe } = await createRecipe(
    db,
    {
      name: 'Real Browser Check Recipe',
      yield: 12,
      laborHourlyRate: '0',
      laborMinutes: '0',
      packagingBatchCost: '0',
      packagingPerItemCost: '0',
      overheadFlatCost: '0',
      wastePercent: '0',
      desiredMarginPercent: '0',
      roundingIncrement: '0.25',
      acknowledgedZeroCostFlags: { labor: true, packaging: true, overhead: true, waste: true },
      currencyCode: 'USD',
    },
    [{ ingredientId: ingredient.id, amountUsed: '1.5', amountUsedUnit: 'tsp' }],
  )

  // Export/import round trip, in a REAL browser's IndexedDB: export the
  // current data, wipe the database (simulating a fresh browser with none
  // of this data), reopen it, and restore from the exported file. If this
  // works in a real browser the same way it does under fake-indexeddb,
  // the M2-5 requirement ("an exported file can restore an equivalent
  // database in a fresh browser") is proven, not just assumed.
  const exportedFile = await buildExport(db)
  db.close()
  await wipeDatabase()
  db = await openAppDatabase()
  const importSummary = await importAndReplaceAll(db, exportedFile, { confirmed: true })
  details.exportImportCountsMatch =
    importSummary.ingredients === 1 && importSummary.recipes === 1 && importSummary.recipeIngredientUsages === 1

  const restoredIngredient = await getIngredient(db, ingredient.id)
  details.exportImportExactDecimalRoundTrip = restoredIngredient.packagePrice === '7.490000001'

  let blockedCorrectly = false
  try {
    await deleteIngredient(db, ingredient.id)
  } catch (err) {
    blockedCorrectly = err instanceof IngredientInUseError
  }
  details.blockedDeletionWhileReferenced = blockedCorrectly

  await deleteRecipe(db, recipe.id)
  await deleteIngredient(db, ingredient.id)
  let deletedAfterUnreferenced = false
  try {
    await getIngredient(db, ingredient.id)
  } catch {
    deletedAfterUnreferenced = true
  }
  details.deletedOnceUnreferenced = deletedAfterUnreferenced

  db.close()
  await wipeDatabase()

  window.__RESULT__ = { ok: true, details }
}

run().catch((err: unknown) => {
  window.__RESULT__ = { ok: false, details: {}, error: err instanceof Error ? err.message : String(err) }
})
