// Exact decimal values cross every boundary of this engine as strings —
// never a native JavaScript `number` — per the PRD's decimal-precision rule.
export type DecimalString = string;

export type MeasurementType = "weight" | "volume" | "count";

export type WeightUnit = "g" | "kg" | "oz" | "lb";
export type VolumeUnit = "mL" | "L" | "tsp" | "tbsp" | "cup";
export type CountUnit = "each" | "dozen";
export type Unit = WeightUnit | VolumeUnit | CountUnit;

export type RoundingIncrement = "0.25" | "0.50" | "1.00";

export type ValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; reason: string };

export interface IngredientInput {
  packagePrice: DecimalString;
  packageQuantity: DecimalString;
  packageUnit: Unit;
  amountUsed: DecimalString;
  usageUnit: Unit;
}

export interface RecipeCostInputs {
  ingredientSubtotal: DecimalString;
  wastePercent: DecimalString;
  laborHourlyRate: DecimalString;
  laborMinutes: DecimalString;
  packagingBatchCost: DecimalString;
  packagingPerItemCost: DecimalString;
  overheadFlatCost: DecimalString;
  yield_: number;
}

export interface CostBreakdown {
  ingredientSubtotal: DecimalString;
  wasteAllowance: DecimalString;
  laborCost: DecimalString;
  packagingCost: DecimalString;
  overhead: DecimalString;
  totalProductionCost: DecimalString;
  costPerUnit: DecimalString;
}

export interface SuggestedPricing {
  desiredMarginRate: DecimalString;
  exactTargetPriceBatch: DecimalString;
  exactTargetPricePerItem: DecimalString;
  suggestedWholeBatchPrice: DecimalString;
  suggestedPerItemPrice: DecimalString;
  equivalentMarkupRate: DecimalString;
}
