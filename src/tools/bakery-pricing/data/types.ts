import type { CustomIngredientConversion, DecimalString, MeasurementType, RoundingIncrement, Unit } from '../calc-engine/types.ts'

// Every decimal/currency quantity below is stored as an exact DecimalString
// — never a native JavaScript number — all the way into IndexedDB. Only
// genuinely non-decimal whole-number fields (yield) use `number`.

export interface StoredIngredient {
  id: string
  name: string
  packagePrice: DecimalString
  packageQuantity: DecimalString
  packageUnit: Unit
  measurementType: MeasurementType
  // Set only when this ingredient was identified from the common-ingredient
  // reference library (bakeryIngredientLibrary.ts, not this data layer) —
  // absent for a fully custom ingredient. Never validated against the
  // library's current contents on import: the library can change shape
  // over time without invalidating an older export.
  commonIngredientId?: string
  // A baker-supplied (or baker-overridden) weight/volume bridge for this
  // ingredient — see CustomIngredientConversion. Present only when the
  // package and recipe-usage units are different measurement types and a
  // conversion was supplied, whether that came from the library's standard
  // estimate or the baker's own "Change" entry. Never guessed here.
  customConversion?: CustomIngredientConversion
  createdAt: string
  updatedAt: string
}

export type NewIngredient = Omit<StoredIngredient, 'id' | 'measurementType' | 'createdAt' | 'updatedAt'>
export type IngredientPatch = Partial<Omit<StoredIngredient, 'id' | 'measurementType' | 'createdAt' | 'updatedAt'>>

export interface AcknowledgedZeroCostFlags {
  labor: boolean
  supplies: boolean
  overhead: boolean
  waste: boolean
}

// A "Supplies & Packaging" line item, embedded directly on the recipe (not
// a shared/reusable store like ingredients — a box of cake-pop sticks
// belongs to this recipe alone). Never stores its computed cost — that is
// always recomputed from these inputs, same as every other calculated
// value in this data layer.
export type StoredSupplyItem =
  | {
      id: string
      name: string
      mode: 'package'
      packagePrice: DecimalString
      packageQuantity: DecimalString
      amountUsed: DecimalString
    }
  | {
      id: string
      name: string
      mode: 'direct'
      directCost: DecimalString
    }

export interface StoredRecipe {
  id: string
  name: string
  yield: number
  laborHourlyRate: DecimalString
  laborMinutes: DecimalString
  supplyItems: StoredSupplyItem[]
  overheadFlatCost: DecimalString
  wastePercent: DecimalString
  desiredMarginPercent: DecimalString
  roundingIncrement: RoundingIncrement
  acknowledgedZeroCostFlags: AcknowledgedZeroCostFlags
  currencyCode: string
  createdAt: string
  updatedAt: string
}

export type NewRecipe = Omit<StoredRecipe, 'id' | 'createdAt' | 'updatedAt'>
export type RecipePatch = Partial<Omit<StoredRecipe, 'id' | 'createdAt' | 'updatedAt'>>

export interface StoredRecipeIngredientUsage {
  id: string
  recipeId: string
  ingredientId: string
  amountUsed: DecimalString
  amountUsedUnit: Unit
}

export type NewUsage = Omit<StoredRecipeIngredientUsage, 'id' | 'recipeId'>

export interface RecipeWithUsages {
  recipe: StoredRecipe
  usages: StoredRecipeIngredientUsage[]
}
