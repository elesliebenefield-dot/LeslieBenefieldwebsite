import { promisifyRequest, promisifyTransaction } from './db.ts'
import { STORE_RECIPES, STORE_USAGES, INDEX_USAGES_BY_RECIPE } from './schema.ts'
import { NotFoundError } from './errors.ts'
import type { NewRecipe, NewUsage, RecipePatch, RecipeWithUsages, StoredRecipe, StoredRecipeIngredientUsage } from './types.ts'

function nowIso(): string {
  return new Date().toISOString()
}

function toStoredUsage(recipeId: string, usage: NewUsage): StoredRecipeIngredientUsage {
  return {
    id: crypto.randomUUID(),
    recipeId,
    ingredientId: usage.ingredientId,
    amountUsed: usage.amountUsed,
    amountUsedUnit: usage.amountUsedUnit,
  }
}

// Creates a recipe and its ingredient usages together, in one transaction —
// either both are saved, or neither is.
export async function createRecipe(
  db: IDBDatabase,
  input: NewRecipe,
  usages: NewUsage[],
): Promise<RecipeWithUsages> {
  const timestamp = nowIso()
  const recipe: StoredRecipe = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const storedUsages = usages.map((u) => toStoredUsage(recipe.id, u))

  const tx = db.transaction([STORE_RECIPES, STORE_USAGES], 'readwrite')
  tx.objectStore(STORE_RECIPES).add(recipe)
  const usageStore = tx.objectStore(STORE_USAGES)
  for (const u of storedUsages) usageStore.add(u)
  await promisifyTransaction(tx)

  return { recipe, usages: storedUsages }
}

export async function getRecipeWithUsages(db: IDBDatabase, id: string): Promise<RecipeWithUsages> {
  const tx = db.transaction([STORE_RECIPES, STORE_USAGES], 'readonly')
  const recipe = await promisifyRequest<StoredRecipe | undefined>(tx.objectStore(STORE_RECIPES).get(id))
  if (!recipe) throw new NotFoundError('Recipe', id)
  const usages = await promisifyRequest<StoredRecipeIngredientUsage[]>(
    tx.objectStore(STORE_USAGES).index(INDEX_USAGES_BY_RECIPE).getAll(id),
  )
  return { recipe, usages }
}

export async function listRecipes(db: IDBDatabase): Promise<StoredRecipe[]> {
  const tx = db.transaction([STORE_RECIPES], 'readonly')
  return promisifyRequest(tx.objectStore(STORE_RECIPES).getAll())
}

export async function updateRecipe(db: IDBDatabase, id: string, patch: RecipePatch): Promise<StoredRecipe> {
  const tx = db.transaction([STORE_RECIPES], 'readwrite')
  const store = tx.objectStore(STORE_RECIPES)
  const existing = await promisifyRequest<StoredRecipe | undefined>(store.get(id))
  if (!existing) {
    tx.abort()
    throw new NotFoundError('Recipe', id)
  }
  const updated: StoredRecipe = { ...existing, ...patch, updatedAt: nowIso() }
  store.put(updated)
  await promisifyTransaction(tx)
  return updated
}

// Replaces a recipe's full set of ingredient usages atomically — the
// existing usage rows are removed and the new set inserted in the same
// transaction, so a partial edit can never be observed.
export async function setRecipeUsages(
  db: IDBDatabase,
  recipeId: string,
  usages: NewUsage[],
): Promise<StoredRecipeIngredientUsage[]> {
  const tx = db.transaction([STORE_RECIPES, STORE_USAGES], 'readwrite')
  const recipe = await promisifyRequest(tx.objectStore(STORE_RECIPES).get(recipeId))
  if (!recipe) {
    tx.abort()
    throw new NotFoundError('Recipe', recipeId)
  }

  const usageStore = tx.objectStore(STORE_USAGES)
  const index = usageStore.index(INDEX_USAGES_BY_RECIPE)
  const existingUsages = await promisifyRequest<StoredRecipeIngredientUsage[]>(index.getAll(recipeId))
  for (const u of existingUsages) usageStore.delete(u.id)

  const storedUsages = usages.map((u) => toStoredUsage(recipeId, u))
  for (const u of storedUsages) usageStore.add(u)

  await promisifyTransaction(tx)
  return storedUsages
}

// Duplicating a recipe creates an entirely new saved recipe (new id, its own
// usage rows referencing the same ingredients) — it never shares rows with
// the original, and there is no limit for it to count against, since the
// tool is free.
export async function duplicateRecipe(db: IDBDatabase, id: string, newName: string): Promise<RecipeWithUsages> {
  const { recipe, usages } = await getRecipeWithUsages(db, id)
  const timestamp = nowIso()
  const duplicate: StoredRecipe = {
    ...recipe,
    id: crypto.randomUUID(),
    name: newName,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const duplicateUsages = usages.map((u) => toStoredUsage(duplicate.id, { ingredientId: u.ingredientId, amountUsed: u.amountUsed, amountUsedUnit: u.amountUsedUnit }))

  const tx = db.transaction([STORE_RECIPES, STORE_USAGES], 'readwrite')
  tx.objectStore(STORE_RECIPES).add(duplicate)
  const usageStore = tx.objectStore(STORE_USAGES)
  for (const u of duplicateUsages) usageStore.add(u)
  await promisifyTransaction(tx)

  return { recipe: duplicate, usages: duplicateUsages }
}

// Deletes a recipe and its own usage rows together. This is not the
// forbidden "cascade delete" — that term refers to deleting an *ingredient*
// out from under a recipe. A recipe's usage rows belong to the recipe
// itself; removing them when the recipe goes away is required cleanup, not
// a referential-integrity violation. Confirmation is a UI-level concern
// (Milestone M3); this function performs the deletion once called.
export async function deleteRecipe(db: IDBDatabase, id: string): Promise<void> {
  const tx = db.transaction([STORE_RECIPES, STORE_USAGES], 'readwrite')
  const recipeStore = tx.objectStore(STORE_RECIPES)
  const existing = await promisifyRequest(recipeStore.get(id))
  if (!existing) {
    tx.abort()
    throw new NotFoundError('Recipe', id)
  }
  const index = tx.objectStore(STORE_USAGES).index(INDEX_USAGES_BY_RECIPE)
  const usages = await promisifyRequest<StoredRecipeIngredientUsage[]>(index.getAll(id))
  const usageStore = tx.objectStore(STORE_USAGES)
  for (const u of usages) usageStore.delete(u.id)
  recipeStore.delete(id)
  await promisifyTransaction(tx)
}
