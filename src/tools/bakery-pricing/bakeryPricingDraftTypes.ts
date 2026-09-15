// Local, UI-only, in-memory draft types for the M3 guided flow. These are
// deliberately NOT StoredIngredient/StoredRecipe from data/types.ts — this
// milestone never reads or writes the M2 repositories (see design.md's
// scope boundary). Every price/quantity/percentage field is a DecimalString
// (a plain string) end to end, never a native number.
import type { DecimalString, MeasurementType, RoundingIncrement, Unit } from './calc-engine/types.ts'

export interface DraftIngredientLine {
  id: string
  name: string
  measurementType: MeasurementType
  packagePrice: DecimalString
  packageQuantity: DecimalString
  packageUnit: Unit
  amountUsed: DecimalString
  amountUsedUnit: Unit
  cost: DecimalString
}

export interface DraftCostInputs {
  laborHourlyRate: DecimalString
  laborMinutes: DecimalString
  packagingBatchCost: DecimalString
  packagingPerItemCost: DecimalString
  overheadFlatCost: DecimalString
  wastePercent: DecimalString
}

export const EMPTY_DRAFT_COST_INPUTS: DraftCostInputs = {
  laborHourlyRate: '',
  laborMinutes: '',
  packagingBatchCost: '',
  packagingPerItemCost: '',
  overheadFlatCost: '',
  wastePercent: '',
}

export interface ZeroCostAcknowledgement {
  labor: boolean
  packaging: boolean
  overhead: boolean
  waste: boolean
}

export const EMPTY_ZERO_COST_ACK: ZeroCostAcknowledgement = {
  labor: false,
  packaging: false,
  overhead: false,
  waste: false,
}

export type GuidedStep = 'recipe' | 'costs' | 'breakdown'

export const ROUNDING_INCREMENTS: RoundingIncrement[] = ['0.25', '0.50', '1.00']
