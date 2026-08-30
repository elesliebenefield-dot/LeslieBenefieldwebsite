// Unit Conversion Registry — the PRD's authoritative constants and the
// explicit count-to-count equivalence table. No conversion between weight
// and volume exists anywhere in this file, deliberately: v1 blocks that
// mismatch rather than approximating it.

import Decimal from "decimal.js";
import type { CountUnit, MeasurementType, Unit, VolumeUnit, WeightUnit } from "./types.js";

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
