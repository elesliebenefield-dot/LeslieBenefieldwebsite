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

// A baker-supplied bridge between an ingredient's package measurement type
// and its recipe-usage measurement type when the two are different domains
// (weight vs. volume — e.g. a package sold by the pound, used in the
// recipe by the cup). Expressed as "1 [volumeUnit] of this ingredient
// weighs [weightQuantity] [weightUnit]", matching exactly how a baker
// would describe it. Never invented or defaulted by the engine — this
// type only ever holds a value the baker explicitly entered.
export interface CustomIngredientConversion {
  volumeUnit: VolumeUnit;
  weightQuantity: DecimalString;
  weightUnit: WeightUnit;
}

export interface IngredientInput {
  packagePrice: DecimalString;
  packageQuantity: DecimalString;
  packageUnit: Unit;
  amountUsed: DecimalString;
  usageUnit: Unit;
  // Required only when packageUnit and usageUnit are different measurement
  // types (one weight, one volume) — see computeIngredientCost.
  customConversion?: CustomIngredientConversion;
}

// A single "Supplies & Packaging" line item costed by package math — a
// package price divided across however many the package contains, times
// however many this recipe/order uses. No units: these are always plain
// counts (100 cake-pop sticks, 24 used), never weight or volume.
export interface SupplyPackageInput {
  packagePrice: DecimalString;
  packageQuantity: DecimalString;
  amountUsed: DecimalString;
}

export interface RecipeCostInputs {
  ingredientSubtotal: DecimalString;
  wastePercent: DecimalString;
  laborHourlyRate: DecimalString;
  laborMinutes: DecimalString;
  suppliesSubtotal: DecimalString;
  overheadFlatCost: DecimalString;
  yield_: number;
}

export interface CostBreakdown {
  ingredientSubtotal: DecimalString;
  wasteAllowance: DecimalString;
  laborCost: DecimalString;
  suppliesCost: DecimalString;
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

// The result of testing an arbitrary, baker-entered selling price against
// the already-computed cost breakdown — deliberately separate from
// SuggestedPricing (the calculator's own cost-plus-margin recommendation).
// This never feeds back into the suggested price; it only reports what a
// hypothetical price would mean given the costs already entered.
export interface SellingPriceTestResult {
  batchPrice: DecimalString;
  perItemPrice: DecimalString;
  remainingAfterCosts: DecimalString;
  actualMarginPercent: DecimalString;
  belowBreakEven: boolean;
}
