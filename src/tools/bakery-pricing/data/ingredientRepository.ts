import { measurementTypeOf } from '../calc-engine/units.ts'
import { promisifyRequest, promisifyTransaction } from './db.ts'
import { nowIso } from './clock.ts'
import { STORE_INGREDIENTS, STORE_RECIPES, STORE_USAGES, INDEX_USAGES_BY_INGREDIENT } from './schema.ts'
import { IncompatibleMeasurementTypeError, IngredientInUseError, NotFoundError } from './errors.ts'
import type { IngredientPatch, NewIngredient, StoredIngredient, StoredRecipeIngredientUsage } from './types.ts'

export async function createIngredient(db: IDBDatabase, input: NewIngredient): Promise<StoredIngredient> {
  const timestamp = nowIso()
  const record: StoredIngredient = {
    id: crypto.randomUUID(),
    name: input.name,
    packagePrice: input.packagePrice,
    packageQuantity: input.packageQuantity,
    packageUnit: input.packageUnit,
    measurementType: measurementTypeOf(input.packageUnit),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const tx = db.transaction([STORE_INGREDIENTS], 'readwrite')
  tx.objectStore(STORE_INGREDIENTS).add(record)
  await promisifyTransaction(tx)
  return record
}

export async function getIngredient(db: IDBDatabase, id: string): Promise<StoredIngredient> {
  const tx = db.transaction([STORE_INGREDIENTS], 'readonly')
  const record = await promisifyRequest<StoredIngredient | undefined>(tx.objectStore(STORE_INGREDIENTS).get(id))
  if (!record) throw new NotFoundError('Ingredient', id)
  return record
}

export async function listIngredients(db: IDBDatabase): Promise<StoredIngredient[]> {
  const tx = db.transaction([STORE_INGREDIENTS], 'readonly')
  return promisifyRequest(tx.objectStore(STORE_INGREDIENTS).getAll())
}

async function usagesForIngredient(
  tx: IDBTransaction,
  ingredientId: string,
): Promise<StoredRecipeIngredientUsage[]> {
  const index = tx.objectStore(STORE_USAGES).index(INDEX_USAGES_BY_INGREDIENT)
  return promisifyRequest(index.getAll(ingredientId))
}

// Editing a shared ingredient's price/quantity/name is always safe: recipes
// reference ingredients live (never copy their values), so a change is
// automatically reflected the next time any recipe referencing it is
// recalculated — no explicit propagation step is needed.
//
// Changing the package unit to a different *measurement type*, however, can
// invalidate existing recipe usages, so that case is checked (and, if
// unsafe, rejected) inside the same read-write transaction as the write.
export async function updateIngredient(
  db: IDBDatabase,
  id: string,
  patch: IngredientPatch,
): Promise<StoredIngredient> {
  const tx = db.transaction([STORE_INGREDIENTS, STORE_USAGES], 'readwrite')
  const store = tx.objectStore(STORE_INGREDIENTS)
  const existing = await promisifyRequest<StoredIngredient | undefined>(store.get(id))
  if (!existing) {
    tx.abort()
    throw new NotFoundError('Ingredient', id)
  }

  const nextPackageUnit = patch.packageUnit ?? existing.packageUnit
  const nextMeasurementType = measurementTypeOf(nextPackageUnit)

  if (nextMeasurementType !== existing.measurementType) {
    const usages = await usagesForIngredient(tx, id)
    const incompatible = usages.filter((u) => measurementTypeOf(u.amountUsedUnit) !== nextMeasurementType)
    if (incompatible.length > 0) {
      tx.abort()
      throw new IncompatibleMeasurementTypeError(
        id,
        incompatible.map((u) => ({ usageId: u.id, recipeId: u.recipeId })),
      )
    }
  }

  const updated: StoredIngredient = {
    ...existing,
    ...patch,
    measurementType: nextMeasurementType,
    updatedAt: nowIso(),
  }
  store.put(updated)
  await promisifyTransaction(tx)
  return updated
}

// Blocks deletion while any saved recipe still references this ingredient,
// identifying the referencing recipes by name. Never cascade-deletes a
// recipe and never silently drops a recipe's reference to the ingredient.
export async function deleteIngredient(db: IDBDatabase, id: string): Promise<void> {
  const tx = db.transaction([STORE_INGREDIENTS, STORE_RECIPES, STORE_USAGES], 'readwrite')
  const usages = await usagesForIngredient(tx, id)

  if (usages.length > 0) {
    const recipeStore = tx.objectStore(STORE_RECIPES)
    const recipeIds = [...new Set(usages.map((u) => u.recipeId))]
    const recipes = await Promise.all(
      recipeIds.map((rid) => promisifyRequest<{ id: string; name: string } | undefined>(recipeStore.get(rid))),
    )
    tx.abort()
    throw new IngredientInUseError(
      id,
      recipes
        .filter((r): r is { id: string; name: string } => r != null)
        .map((r) => ({ id: r.id, name: r.name })),
    )
  }

  tx.objectStore(STORE_INGREDIENTS).delete(id)
  await promisifyTransaction(tx)
}
