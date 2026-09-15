// Unit Conversion Registry — the PRD's authoritative constants and the
// explicit count-to-count equivalence table. No general conversion between
// weight and volume exists here, deliberately — grams-per-cup is a
// property of a specific ingredient (flour and honey weigh very
// differently), never a universal constant. Bridging weight and volume for
// one specific ingredient is only ever done via a CustomIngredientConversion
// the baker explicitly supplied (see resolveCustomConversionDensity below)
// — never guessed, hardcoded, or defaulted here.

import Decimal from "decimal.js";
import type { CountUnit, CustomIngredientConversion, MeasurementType, Unit, VolumeUnit, WeightUnit } from "./types.js";

// Weight -> grams.
export const WEIGHT_TO_GRAMS: Record<WeightUnit, string> = {
  g: "1",
  kg: "1000",
  oz: "28.349523125",
  lb: "453.59237",
};

// Volume -> milliliters.
export const VOLUME_TO_ML: Record<VolumeUnit, string> = {
  mL: "1",
  L: "1000",
  tsp: "4.92892",
  tbsp: "14.7868",
  cup: "236.588",
};

// Count -> individual units. Only explicit equivalences are defined here —
// no invented or assumed conversions.
export const COUNT_TO_EACH: Record<CountUnit, string> = {
  each: "1",
  dozen: "12",
};

const WEIGHT_UNITS = new Set(Object.keys(WEIGHT_TO_GRAMS));
const VOLUME_UNITS = new Set(Object.keys(VOLUME_TO_ML));
const COUNT_UNITS = new Set(Object.keys(COUNT_TO_EACH));

export function measurementTypeOf(unit: Unit): MeasurementType {
  if (WEIGHT_UNITS.has(unit)) return "weight";
  if (VOLUME_UNITS.has(unit)) return "volume";
  if (COUNT_UNITS.has(unit)) return "count";
  throw new Error(`Unknown unit: ${unit}`);
}

export function areCompatible(a: Unit, b: Unit): boolean {
  return measurementTypeOf(a) === measurementTypeOf(b);
}

// Normalizes a quantity to its measurement type's base unit (grams,
// milliliters, or individual count). Callers must check areCompatible()
// before normalizing two units together — this function does not perform
// that check itself, since normalizing a single unit is always well-defined
// on its own.
export function normalize(quantity: Decimal, unit: Unit): Decimal {
  const type = measurementTypeOf(unit);
  if (type === "weight") {
    return quantity.times(WEIGHT_TO_GRAMS[unit as WeightUnit]);
  }
  if (type === "volume") {
    return quantity.times(VOLUME_TO_ML[unit as VolumeUnit]);
  }
  return quantity.times(COUNT_TO_EACH[unit as CountUnit]);
}

export const UNIT_MISMATCH_MESSAGE =
  "Weight and volume are different measurement types. Enter an amount in a compatible unit to match this ingredient's package.";

// Returned defensively by computeIngredientCost if it is ever called with a
// weight/volume mismatch and no CustomIngredientConversion — the guided UI
// is expected to resolve this before calling the engine at all (see
// RecipeIngredientsStep's cross-type explanation), so reaching this in
// practice signals a UI bug, not a normal user-facing path.
export const CROSS_TYPE_CONVERSION_REQUIRED_MESSAGE =
  "This ingredient's package and recipe amount are different measurement types (weight vs. volume). A conversion for this ingredient is required before its cost can be calculated.";

// Derives a grams-per-milliliter density from a baker-supplied "1 [cup] of
// this ingredient weighs [120] [grams]" statement, so a weight quantity and
// a volume quantity of the *same specific ingredient* can be bridged. This
// is the only place weight and volume are ever related to each other in
// this engine, and it only ever uses a value the baker actually entered.
export function resolveCustomConversionDensity(
  volumeQuantity: Decimal,
  volumeUnit: VolumeUnit,
  weightQuantity: Decimal,
  weightUnit: WeightUnit,
): Decimal {
  const grams = weightQuantity.times(WEIGHT_TO_GRAMS[weightUnit]);
  const milliliters = volumeQuantity.times(VOLUME_TO_ML[volumeUnit]);
  return grams.dividedBy(milliliters);
}

// Normalizes a quantity to the OTHER domain's base unit (grams or
// milliliters) using a specific ingredient's custom conversion — the
// weight/volume equivalent of normalize() above, deliberately kept
// separate since it requires ingredient-specific information normalize()
// never has.
export function normalizeAcrossTypes(
  quantity: Decimal,
  unit: Unit,
  conversion: CustomIngredientConversion,
): Decimal {
  const density = resolveCustomConversionDensity(
    new Decimal(1),
    conversion.volumeUnit,
    new Decimal(conversion.weightQuantity),
    conversion.weightUnit,
  );
  const type = measurementTypeOf(unit);
  if (type === "volume") {
    // volume quantity (in its own unit) -> mL -> grams via density.
    return normalize(quantity, unit).times(density);
  }
  if (type === "weight") {
    // weight quantity (in its own unit) -> grams -> mL via density.
    return normalize(quantity, unit).dividedBy(density);
  }
  throw new Error(`normalizeAcrossTypes is only valid for weight or volume units, got: ${unit}`);
}
