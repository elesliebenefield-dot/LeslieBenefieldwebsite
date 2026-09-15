// Shared helpers for turning a saved RecipeWithUsages into computed costs by
// looking up each usage's ingredient live (never copying stored values) —
// used by the Saved Recipes list (quick cost summaries) and by the guided
// flow when loading an existing recipe back in for editing/what-if.
import { getIngredient } from './data/ingredientRepository.ts'
import {
  computeCostBreakdown,
  computeIngredientCost,
  computeIngredientSubtotal,
  computeSuggestedPricing,
  computeSupplyDirectCost,
  computeSupplyItemCost,
  computeSuppliesSubtotal,
} from './calc-engine/formulas.ts'
import type { DecimalString, RoundingIncrement, Unit } from './calc-engine/types.ts'
import type { RecipeWithUsages, StoredIngredient, StoredSupplyItem } from './data/types.ts'

export interface ResolvedIngredientLine {
  usageId: string
  ingredientId: string
  ingredient: StoredIngredient
  amountUsed: DecimalString
  amountUsedUnit: Unit
  // null only if the live ingredient's stored values can no longer produce a
  // valid cost (for example, an incompatible measurement type slipped in
  // through import) — callers must treat this as "can't be priced," never
  // silently substitute zero.
  cost: DecimalString | null
}

export async function resolveRecipeIngredientLines(
  db: IDBDatabase,
  recipeWithUsages: RecipeWithUsages,
): Promise<ResolvedIngredientLine[]> {
  return Promise.all(
    recipeWithUsages.usages.map(async (usage) => {
      const ingredient = await getIngredient(db, usage.ingredientId)
      const result = computeIngredientCost({
        packagePrice: ingredient.packagePrice,
        packageQuantity: ingredient.packageQuantity,
        packageUnit: ingredient.packageUnit,
        amountUsed: usage.amountUsed,
        usageUnit: usage.amountUsedUnit,
        customConversion: ingredient.customConversion,
      })
      return {
        usageId: usage.id,
        ingredientId: ingredient.id,
        ingredient,
        amountUsed: usage.amountUsed,
        amountUsedUnit: usage.amountUsedUnit,
        cost: result.valid ? result.value : null,
      }
    }),
  )
}

export function supplyItemCost(item: StoredSupplyItem): DecimalString | null {
  const result =
    item.mode === 'package'
      ? computeSupplyItemCost({ packagePrice: item.packagePrice, packageQuantity: item.packageQuantity, amountUsed: item.amountUsed })
      : computeSupplyDirectCost(item.directCost)
  return result.valid ? result.value : null
}

export interface RecipeCostSummary {
  ingredientSubtotal: DecimalString
  suppliesSubtotal: DecimalString
  totalProductionCost: DecimalString
  costPerUnit: DecimalString
  suggestedPerItemPrice: DecimalString | null
}

interface SummarizableRecipe {
  yield: number
  laborHourlyRate: DecimalString
  laborMinutes: DecimalString
  overheadFlatCost: DecimalString
  wastePercent: DecimalString
  desiredMarginPercent: DecimalString
  roundingIncrement: RoundingIncrement
}

// A blank decimal field should never reach decimal.js — normal saves never
// write one (see BakeryPricingCalculator's own blankToZero), but this stays
// defensive against any other write path (e.g. a future import) leaving one
// behind, treating it the same way the guided flow always has: as $0.
function blankToZero(v: DecimalString): DecimalString {
  return v.trim() === '' ? '0' : v
}

// Returns null (rather than throwing) whenever any piece can't be priced —
// callers show a calm "can't be priced right now" state instead of a crash.
export function computeRecipeCostSummary(
  recipe: SummarizableRecipe,
  ingredientLines: ResolvedIngredientLine[],
  supplyItems: StoredSupplyItem[],
): RecipeCostSummary | null {
  if (ingredientLines.some((l) => l.cost === null)) return null
  const ingredientSubtotal = computeIngredientSubtotal(ingredientLines.map((l) => l.cost as DecimalString))

  const supplyCosts = supplyItems.map(supplyItemCost)
  if (supplyCosts.some((c) => c === null)) return null
  const suppliesSubtotal = computeSuppliesSubtotal(supplyCosts as DecimalString[])

  const breakdown = computeCostBreakdown({
    ingredientSubtotal,
    suppliesSubtotal,
    laborHourlyRate: blankToZero(recipe.laborHourlyRate),
    laborMinutes: blankToZero(recipe.laborMinutes),
    overheadFlatCost: blankToZero(recipe.overheadFlatCost),
    wastePercent: blankToZero(recipe.wastePercent),
    yield_: recipe.yield,
  })
  if (!breakdown.valid) return null

  const pricing = computeSuggestedPricing(
    breakdown.value.totalProductionCost,
    recipe.yield,
    blankToZero(recipe.desiredMarginPercent),
    recipe.roundingIncrement,
  )

  return {
    ingredientSubtotal,
    suppliesSubtotal,
    totalProductionCost: breakdown.value.totalProductionCost,
    costPerUnit: breakdown.value.costPerUnit,
    suggestedPerItemPrice: pricing.valid ? pricing.value.suggestedPerItemPrice : null,
  }
}
