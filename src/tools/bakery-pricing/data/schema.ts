// The Bakery Pricing Calculator's IndexedDB schema. A distinctly-namespaced
// database name is used as good hygiene, even though nothing else on this
// site currently uses IndexedDB at all.
import { openDatabase, type Migration } from './db.ts'

export const DB_NAME = 'bakery-pricing-planner'
export const DB_VERSION = 1

export const STORE_INGREDIENTS = 'ingredients'
export const STORE_RECIPES = 'recipes'
export const STORE_USAGES = 'recipeIngredientUsages'

export const INDEX_USAGES_BY_RECIPE = 'byRecipeId'
export const INDEX_USAGES_BY_INGREDIENT = 'byIngredientId'
export const INDEX_INGREDIENTS_BY_NAME = 'byName'

const migrations: Record<number, Migration> = {
  1: (db) => {
    const ingredients = db.createObjectStore(STORE_INGREDIENTS, { keyPath: 'id' })
    ingredients.createIndex(INDEX_INGREDIENTS_BY_NAME, 'name', { unique: false })

    db.createObjectStore(STORE_RECIPES, { keyPath: 'id' })

    const usages = db.createObjectStore(STORE_USAGES, { keyPath: 'id' })
    usages.createIndex(INDEX_USAGES_BY_RECIPE, 'recipeId', { unique: false })
    usages.createIndex(INDEX_USAGES_BY_INGREDIENT, 'ingredientId', { unique: false })
  },
}

export function openAppDatabase(): Promise<IDBDatabase> {
  return openDatabase(DB_NAME, DB_VERSION, migrations)
}
