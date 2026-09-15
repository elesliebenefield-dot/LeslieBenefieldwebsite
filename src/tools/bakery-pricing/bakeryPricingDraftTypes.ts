// Local, UI-only, in-memory draft types for the M3 guided flow. These are
// deliberately NOT StoredIngredient/StoredRecipe from data/types.ts — this
// milestone never reads or writes the M2 repositories (see design.md's
// scope boundary). Every price/quantity/percentage field is a DecimalString
// (a plain string) end to end, never a native number.
import type { CustomIngredientConversion, DecimalString, RoundingIncrement, Unit } from './calc-engine/types.ts'

// The package and recipe-usage units are independent — an ingredient can be
// bought by weight and used by volume (a 5 lb bag of flour, 2 cups used),
// so there is no single "measurement type" for a line as a whole.
// `customConversion` is present only when the two units are cross-type
// (weight vs. volume) and the baker has supplied a conversion for this
// specific ingredient — never guessed or defaulted.
export interface DraftIngredientLine {
  id: string
  name: string
  packagePrice: DecimalString
  packageQuantity: DecimalString
  packageUnit: Unit
  amountUsed: DecimalString
  amountUsedUnit: Unit
  // Set only when the baker selected a specific entry from the common-
  // ingredient library (bakeryIngredientLibrary.ts) — never inferred from
  // typed text alone. Carried so M4 can save and re-offer this identity
  // (and its standard/overridden conversion) the next time this ingredient
  // is used, instead of asking the baker to resolve it again.
  commonIngredientId?: string
  customConversion?: CustomIngredientConversion
  // Set only when this line was added by picking an entry from the baker's
  // own saved ingredients (data/ingredientRepository.ts), never by typing a
  // name — mirrors commonIngredientId's "selection only ever explicit" rule.
  // When present, saving this recipe reuses that ingredient record instead
  // of creating a new one, per the PRD's "looked up live, not copied" rule.
  savedIngredientId?: string
  cost: DecimalString
}

// A "Supplies & Packaging" line item. `cost` is computed once, at the
// moment the item is added or edited (same pattern as DraftIngredientLine)
// — recomputed from the inputs whenever they change, never treated as
// independent of them.
export type DraftSupplyItem =
  | {
      id: string
      name: string
      mode: 'package'
      packagePrice: DecimalString
      packageQuantity: DecimalString
      amountUsed: DecimalString
      cost: DecimalString
    }
  | {
      id: string
      name: string
      mode: 'direct'
      directCost: DecimalString
      cost: DecimalString
    }

export interface DraftCostInputs {
  laborHourlyRate: DecimalString
  laborMinutes: DecimalString
  overheadFlatCost: DecimalString
  wastePercent: DecimalString
}

export const EMPTY_DRAFT_COST_INPUTS: DraftCostInputs = {
  laborHourlyRate: '',
  laborMinutes: '',
  overheadFlatCost: '',
  wastePercent: '',
}

export interface ZeroCostAcknowledgement {
  labor: boolean
  supplies: boolean
  overhead: boolean
  waste: boolean
}

export const EMPTY_ZERO_COST_ACK: ZeroCostAcknowledgement = {
  labor: false,
  supplies: false,
  overhead: false,
  waste: false,
}

export type GuidedStep = 'recipe' | 'costs' | 'breakdown'

export const ROUNDING_INCREMENTS: RoundingIncrement[] = ['0.25', '0.50', '1.00']
