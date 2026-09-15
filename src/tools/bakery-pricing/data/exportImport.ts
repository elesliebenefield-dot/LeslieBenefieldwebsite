// Local backup/restore: export every bakery-pricing record (ingredients,
// recipes, recipe-ingredient usages) to one human-readable JSON file, and
// validate + restore that file later — including in a fresh browser with
// an empty database.
//
// Design rules this module exists to enforce:
// - The entire file is validated BEFORE any IndexedDB write is attempted.
//   `importAndReplaceAll` always validates internally; there is no code
//   path that can reach a write without having passed validation first.
// - The actual replace is one native IndexedDB transaction across all
//   three stores. IndexedDB transactions are all-or-nothing, so if a write
//   fails partway through, the abort rolls back every request in it
//   (including the preceding clears) — the existing database is left
//   completely unchanged. Nothing here needs to hand-roll a rollback.
// - Every decimal/currency field is copied verbatim as the exact string it
//   already is in `StoredIngredient`/`StoredRecipe`/`StoredRecipeIngredientUsage`
//   — never parsed into a number and back — so no precision can be lost in
//   either direction.
// - Replacing existing data is destructive, so the function that performs
//   it requires an explicit `{ confirmed: true }` — refusing to run
//   without it is enforced here, not left to callers to remember.

import Decimal from 'decimal.js'
import { fromStorageString } from '../calc-engine/decimal.ts'
import { COUNT_TO_EACH, VOLUME_TO_ML, WEIGHT_TO_GRAMS, areCompatible, measurementTypeOf } from '../calc-engine/units.ts'
import type { CustomIngredientConversion, DecimalString, Unit, VolumeUnit, WeightUnit } from '../calc-engine/types.ts'
import { promisifyRequest, promisifyTransaction } from './db.ts'
import { nowIso } from './clock.ts'
import { DB_NAME, DB_VERSION, STORE_INGREDIENTS, STORE_RECIPES, STORE_USAGES } from './schema.ts'
import type { AcknowledgedZeroCostFlags, StoredIngredient, StoredRecipe, StoredRecipeIngredientUsage, StoredSupplyItem } from './types.ts'
import {
  DuplicateIdentifierError,
  ImportFormatError,
  ImportNotConfirmedError,
  IncompatibleUnitError,
  InvalidDecimalStringError,
  InvalidUnitError,
  MissingReferenceError,
  UnsupportedImportVersionError,
} from './errors.ts'

// Versions the JSON file's own shape — independent of DB_VERSION, which
// versions the IndexedDB schema. They happen to both be 1 today; they will
// not necessarily move together in the future.
export const EXPORT_FORMAT_VERSION = 1

const KNOWN_UNITS = new Set<string>([
  ...Object.keys(WEIGHT_TO_GRAMS),
  ...Object.keys(VOLUME_TO_ML),
  ...Object.keys(COUNT_TO_EACH),
])

function isKnownUnit(value: unknown): value is Unit {
  return typeof value === 'string' && KNOWN_UNITS.has(value)
}

export interface ExportFile {
  app: string
  exportFormatVersion: number
  schemaVersion: number
  exportedAt: string
  data: {
    ingredients: StoredIngredient[]
    recipes: StoredRecipe[]
    recipeIngredientUsages: StoredRecipeIngredientUsage[]
  }
}

export interface ImportSummary {
  ingredients: number
  recipes: number
  recipeIngredientUsages: number
}

// --- Export -----------------------------------------------------------

export async function buildExport(db: IDBDatabase): Promise<ExportFile> {
  const tx = db.transaction([STORE_INGREDIENTS, STORE_RECIPES, STORE_USAGES], 'readonly')
  const [ingredients, recipes, recipeIngredientUsages] = await Promise.all([
    promisifyRequest<StoredIngredient[]>(tx.objectStore(STORE_INGREDIENTS).getAll()),
    promisifyRequest<StoredRecipe[]>(tx.objectStore(STORE_RECIPES).getAll()),
    promisifyRequest<StoredRecipeIngredientUsage[]>(tx.objectStore(STORE_USAGES).getAll()),
  ])
  await promisifyTransaction(tx)

  return {
    app: DB_NAME,
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: DB_VERSION,
    exportedAt: nowIso(),
    data: { ingredients, recipes, recipeIngredientUsages },
  }
}

// Pretty-printed so the file is genuinely human-readable, not just
// technically valid JSON.
export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file, null, 2)
}

// --- Validation ---------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(obj: Record<string, unknown>, key: string, context: string): string {
  const value = obj[key]
  if (typeof value !== 'string') {
    throw new ImportFormatError(`${context} is missing required text field "${key}".`)
  }
  return value
}

function requireDecimalString(entity: string, id: string, obj: Record<string, unknown>, field: string): DecimalString {
  const value = obj[field]
  if (typeof value !== 'string') {
    throw new InvalidDecimalStringError(entity, id, field, value)
  }
  let decimal: Decimal
  try {
    decimal = fromStorageString(value)
  } catch {
    throw new InvalidDecimalStringError(entity, id, field, value)
  }
  if (!decimal.isFinite()) {
    throw new InvalidDecimalStringError(entity, id, field, value)
  }
  return value
}

function requireUnit(entity: string, id: string, obj: Record<string, unknown>, field: string): Unit {
  const value = obj[field]
  if (!isKnownUnit(value)) {
    throw new InvalidUnitError(entity, id, field, value)
  }
  return value
}

function requireId(obj: Record<string, unknown>, field: string, context: string): string {
  const value = obj[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new ImportFormatError(`${context} is missing a valid "${field}".`)
  }
  return value
}

// `commonIngredientId` is intentionally NOT checked against the current
// ingredient library's contents — the library can be extended, renamed, or
// restructured over time without invalidating an older export file.
function validateOptionalCommonIngredientId(obj: Record<string, unknown>, context: string): string | undefined {
  const value = obj.commonIngredientId
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length === 0) {
    throw new ImportFormatError(`${context}: "commonIngredientId" must be a non-empty string when present.`)
  }
  return value
}

function isVolumeUnit(value: unknown): value is VolumeUnit {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(VOLUME_TO_ML, value)
}

function isWeightUnit(value: unknown): value is WeightUnit {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WEIGHT_TO_GRAMS, value)
}

function validateOptionalCustomConversion(
  entity: string,
  id: string,
  obj: Record<string, unknown>,
): CustomIngredientConversion | undefined {
  const value = obj.customConversion
  if (value === undefined) return undefined
  if (!isPlainObject(value)) throw new ImportFormatError(`${entity} ${id}: "customConversion" must be an object.`)
  if (!isVolumeUnit(value.volumeUnit)) throw new InvalidUnitError(entity, id, 'customConversion.volumeUnit', value.volumeUnit)
  const weightQuantity = requireDecimalString(entity, id, value, 'weightQuantity')
  if (!isWeightUnit(value.weightUnit)) throw new InvalidUnitError(entity, id, 'customConversion.weightUnit', value.weightUnit)
  return { volumeUnit: value.volumeUnit, weightQuantity, weightUnit: value.weightUnit }
}

function validateIngredient(raw: unknown, index: number, seenIds: Set<string>): StoredIngredient {
  if (!isPlainObject(raw)) throw new ImportFormatError(`ingredients[${index}] is not an object.`)
  const id = requireId(raw, 'id', `ingredients[${index}]`)
  if (seenIds.has(id)) throw new DuplicateIdentifierError('ingredient', id)
  seenIds.add(id)

  const name = requireString(raw, 'name', `Ingredient ${id}`)
  const packagePrice = requireDecimalString('Ingredient', id, raw, 'packagePrice')
  const packageQuantity = requireDecimalString('Ingredient', id, raw, 'packageQuantity')
  const packageUnit = requireUnit('Ingredient', id, raw, 'packageUnit')
  const commonIngredientId = validateOptionalCommonIngredientId(raw, `Ingredient ${id}`)
  const customConversion = validateOptionalCustomConversion('Ingredient', id, raw)
  const createdAt = requireString(raw, 'createdAt', `Ingredient ${id}`)
  const updatedAt = requireString(raw, 'updatedAt', `Ingredient ${id}`)

  return {
    id,
    name,
    packagePrice,
    packageQuantity,
    packageUnit,
    // Recomputed rather than trusted from the file — it is derived data,
    // and must always agree with packageUnit. Safe to call unguarded:
    // requireUnit above has already guaranteed packageUnit is known.
    measurementType: measurementTypeOf(packageUnit),
    ...(commonIngredientId !== undefined ? { commonIngredientId } : {}),
    ...(customConversion !== undefined ? { customConversion } : {}),
    createdAt,
    updatedAt,
  }
}

function validateAcknowledgedZeroCostFlags(raw: unknown, context: string): AcknowledgedZeroCostFlags {
  if (!isPlainObject(raw)) throw new ImportFormatError(`${context}: "acknowledgedZeroCostFlags" is missing or not an object.`)
  for (const key of ['labor', 'supplies', 'overhead', 'waste'] as const) {
    if (typeof raw[key] !== 'boolean') {
      throw new ImportFormatError(`${context}: "acknowledgedZeroCostFlags.${key}" must be a boolean.`)
    }
  }
  return {
    labor: raw.labor as boolean,
    supplies: raw.supplies as boolean,
    overhead: raw.overhead as boolean,
    waste: raw.waste as boolean,
  }
}

// Validates one "Supplies & Packaging" line item — either package math
// (price/quantity/amount-used, no units) or a direct flat cost.
function validateSupplyItem(raw: unknown, recipeContext: string, index: number, seenIds: Set<string>): StoredSupplyItem {
  if (!isPlainObject(raw)) throw new ImportFormatError(`${recipeContext}: supplyItems[${index}] is not an object.`)
  const id = requireId(raw, 'id', `${recipeContext} supplyItems[${index}]`)
  if (seenIds.has(id)) throw new DuplicateIdentifierError('supplyItem', id)
  seenIds.add(id)

  const context = `${recipeContext} supply item ${id}`
  const name = requireString(raw, 'name', context)

  const mode = raw.mode
  if (mode === 'package') {
    const packagePrice = requireDecimalString('Supply item', id, raw, 'packagePrice')
    const packageQuantity = requireDecimalString('Supply item', id, raw, 'packageQuantity')
    const amountUsed = requireDecimalString('Supply item', id, raw, 'amountUsed')
    return { id, name, mode, packagePrice, packageQuantity, amountUsed }
  }
  if (mode === 'direct') {
    const directCost = requireDecimalString('Supply item', id, raw, 'directCost')
    return { id, name, mode, directCost }
  }
  throw new ImportFormatError(`${context}: "mode" must be "package" or "direct".`)
}

function validateRecipe(raw: unknown, index: number, seenIds: Set<string>): StoredRecipe {
  if (!isPlainObject(raw)) throw new ImportFormatError(`recipes[${index}] is not an object.`)
  const id = requireId(raw, 'id', `recipes[${index}]`)
  if (seenIds.has(id)) throw new DuplicateIdentifierError('recipe', id)
  seenIds.add(id)

  const context = `Recipe ${id}`
  const name = requireString(raw, 'name', context)

  const yield_ = raw.yield
  if (typeof yield_ !== 'number' || !Number.isInteger(yield_) || yield_ <= 0) {
    throw new ImportFormatError(`${context}: "yield" must be a positive whole number.`)
  }

  const laborHourlyRate = requireDecimalString('Recipe', id, raw, 'laborHourlyRate')
  const laborMinutes = requireDecimalString('Recipe', id, raw, 'laborMinutes')

  const rawSupplyItems = raw.supplyItems
  if (!Array.isArray(rawSupplyItems)) throw new ImportFormatError(`${context}: "supplyItems" must be an array.`)
  const supplyItemIds = new Set<string>()
  const supplyItems = rawSupplyItems.map((s, i) => validateSupplyItem(s, context, i, supplyItemIds))

  const overheadFlatCost = requireDecimalString('Recipe', id, raw, 'overheadFlatCost')
  const wastePercent = requireDecimalString('Recipe', id, raw, 'wastePercent')
  const desiredMarginPercent = requireDecimalString('Recipe', id, raw, 'desiredMarginPercent')

  const roundingIncrementRaw = raw.roundingIncrement
  if (roundingIncrementRaw !== '0.25' && roundingIncrementRaw !== '0.50' && roundingIncrementRaw !== '1.00') {
    throw new ImportFormatError(`${context}: "roundingIncrement" must be one of "0.25", "0.50", "1.00".`)
  }

  const acknowledgedZeroCostFlags = validateAcknowledgedZeroCostFlags(raw.acknowledgedZeroCostFlags, context)
  const currencyCode = requireString(raw, 'currencyCode', context)
  if (currencyCode.length === 0) throw new ImportFormatError(`${context}: "currencyCode" cannot be empty.`)

  const createdAt = requireString(raw, 'createdAt', context)
  const updatedAt = requireString(raw, 'updatedAt', context)

  return {
    id,
    name,
    yield: yield_,
    laborHourlyRate,
    laborMinutes,
    supplyItems,
    overheadFlatCost,
    wastePercent,
    desiredMarginPercent,
    roundingIncrement: roundingIncrementRaw,
    acknowledgedZeroCostFlags,
    currencyCode,
    createdAt,
    updatedAt,
  }
}

function validateUsage(
  raw: unknown,
  index: number,
  seenIds: Set<string>,
  recipeIds: ReadonlySet<string>,
  ingredientsById: ReadonlyMap<string, StoredIngredient>,
): StoredRecipeIngredientUsage {
  if (!isPlainObject(raw)) throw new ImportFormatError(`recipeIngredientUsages[${index}] is not an object.`)
  const id = requireId(raw, 'id', `recipeIngredientUsages[${index}]`)
  if (seenIds.has(id)) throw new DuplicateIdentifierError('recipeIngredientUsage', id)
  seenIds.add(id)

  const recipeId = requireId(raw, 'recipeId', `Usage ${id}`)
  const ingredientId = requireId(raw, 'ingredientId', `Usage ${id}`)
  const amountUsed = requireDecimalString('Recipe ingredient usage', id, raw, 'amountUsed')
  const amountUsedUnit = requireUnit('Recipe ingredient usage', id, raw, 'amountUsedUnit')

  if (!recipeIds.has(recipeId)) throw new MissingReferenceError(id, 'recipeId', recipeId)
  const ingredient = ingredientsById.get(ingredientId)
  if (!ingredient) throw new MissingReferenceError(id, 'ingredientId', ingredientId)

  // A weight/volume mismatch is allowed when the ingredient carries a
  // customConversion to bridge it (the same rule the M3 guided UI applies
  // live) — count never bridges with either, matching computeIngredientCost.
  const usageType = measurementTypeOf(amountUsedUnit)
  const packageType = measurementTypeOf(ingredient.packageUnit)
  const bridgeable = (packageType === 'weight' && usageType === 'volume') || (packageType === 'volume' && usageType === 'weight')
  if (!areCompatible(amountUsedUnit, ingredient.packageUnit) && !(bridgeable && ingredient.customConversion)) {
    throw new IncompatibleUnitError(id, ingredientId)
  }

  return { id, recipeId, ingredientId, amountUsed, amountUsedUnit }
}

// Validates a parsed JSON value against every rule this module enforces —
// structure, versions, decimal strings, units, and referential integrity —
// and returns a fully-typed ExportFile only if every check passes. Throws
// the first typed error it finds; never touches IndexedDB.
export function validateExportFile(raw: unknown): ExportFile {
  if (!isPlainObject(raw)) throw new ImportFormatError('the file is not a JSON object.')

  const app = raw.app
  if (typeof app !== 'string' || app !== DB_NAME) {
    throw new ImportFormatError(`this file was not produced by the Bakery Pricing Planner (unexpected "app": ${JSON.stringify(app)}).`)
  }

  const exportFormatVersion = raw.exportFormatVersion
  if (typeof exportFormatVersion !== 'number') throw new ImportFormatError('missing or invalid "exportFormatVersion".')
  if (exportFormatVersion !== EXPORT_FORMAT_VERSION) {
    throw new UnsupportedImportVersionError('exportFormatVersion', exportFormatVersion, EXPORT_FORMAT_VERSION)
  }

  const schemaVersion = raw.schemaVersion
  if (typeof schemaVersion !== 'number') throw new ImportFormatError('missing or invalid "schemaVersion".')
  if (schemaVersion !== DB_VERSION) {
    throw new UnsupportedImportVersionError('schemaVersion', schemaVersion, DB_VERSION)
  }

  const exportedAt = raw.exportedAt
  if (typeof exportedAt !== 'string' || exportedAt.length === 0) {
    throw new ImportFormatError('missing or invalid "exportedAt".')
  }

  const data = raw.data
  if (!isPlainObject(data)) throw new ImportFormatError('missing "data" section.')
  const { ingredients: rawIngredients, recipes: rawRecipes, recipeIngredientUsages: rawUsages } = data
  if (!Array.isArray(rawIngredients)) throw new ImportFormatError('"data.ingredients" must be an array.')
  if (!Array.isArray(rawRecipes)) throw new ImportFormatError('"data.recipes" must be an array.')
  if (!Array.isArray(rawUsages)) throw new ImportFormatError('"data.recipeIngredientUsages" must be an array.')

  const ingredientIds = new Set<string>()
  const ingredients = rawIngredients.map((r, i) => validateIngredient(r, i, ingredientIds))
  const ingredientsById = new Map(ingredients.map((i) => [i.id, i]))

  const recipeIds = new Set<string>()
  const recipes = rawRecipes.map((r, i) => validateRecipe(r, i, recipeIds))

  const usageIds = new Set<string>()
  const recipeIngredientUsages = rawUsages.map((u, i) => validateUsage(u, i, usageIds, recipeIds, ingredientsById))

  return {
    app,
    exportFormatVersion,
    schemaVersion,
    exportedAt,
    data: { ingredients, recipes, recipeIngredientUsages },
  }
}

// Parses raw file text and validates it in one step. A JSON syntax error is
// reported as an ImportFormatError alongside every other malformed-file
// case, rather than leaking a raw SyntaxError to callers.
export function parseAndValidateExportFile(jsonText: string): ExportFile {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch (err) {
    throw new ImportFormatError(`the file is not valid JSON (${err instanceof Error ? err.message : String(err)}).`)
  }
  return validateExportFile(raw)
}

// --- Import (atomic full restore/replace) --------------------------------

// Replaces every ingredient, recipe, and recipe-ingredient usage in the
// database with the contents of `file`. This is a full restore, not a
// merge: anything currently saved that is not in `file` is gone afterward.
// Requires `{ confirmed: true }` — there is no way to reach the write path
// without it — and always re-validates `file` itself first, so there is no
// way to reach the write path with unvalidated data either.
export async function importAndReplaceAll(
  db: IDBDatabase,
  file: ExportFile,
  options: { confirmed: boolean },
): Promise<ImportSummary> {
  if (!options.confirmed) throw new ImportNotConfirmedError()

  // Re-validate even though callers are expected to have validated already
  // (e.g. to preview the file before asking for confirmation) — importing
  // unvalidated data is not a mistake this function can be talked into.
  const validated = validateExportFile(file)

  const tx = db.transaction([STORE_INGREDIENTS, STORE_RECIPES, STORE_USAGES], 'readwrite')
  const ingredientStore = tx.objectStore(STORE_INGREDIENTS)
  const recipeStore = tx.objectStore(STORE_RECIPES)
  const usageStore = tx.objectStore(STORE_USAGES)

  ingredientStore.clear()
  recipeStore.clear()
  usageStore.clear()

  for (const ingredient of validated.data.ingredients) ingredientStore.add(ingredient)
  for (const recipe of validated.data.recipes) recipeStore.add(recipe)
  for (const usage of validated.data.recipeIngredientUsages) usageStore.add(usage)

  // If any request above fails, this rejects and the transaction aborts —
  // including the clear() calls — so a failure here leaves the database
  // exactly as it was before this function was called.
  await promisifyTransaction(tx)

  return {
    ingredients: validated.data.ingredients.length,
    recipes: validated.data.recipes.length,
    recipeIngredientUsages: validated.data.recipeIngredientUsages.length,
  }
}

// --- Browser download helper ---------------------------------------------

// Triggers a real file download in a browser. Thin and untested by design:
// it is a one-line wrapper around Blob/URL/anchor-click browser APIs with
// no branching logic of its own, so there is nothing here for a unit test
// to usefully exercise beyond what jsdom-style mocks would fake anyway.
// The UI that calls this belongs to Milestone M3.
export function downloadExportFile(file: ExportFile, filename = 'bakery-pricing-backup.json'): void {
  const blob = new Blob([serializeExport(file)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
