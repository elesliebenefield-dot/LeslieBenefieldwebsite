// Every validation rule from the PRD's Pricing & Calculation Rules section.
// Returns a discriminated ValidationResult rather than throwing, so calling
// code (eventually the UI layer) can show calm, specific, plain-language
// guidance without try/catch-driven control flow.

import Decimal from "decimal.js";
import { fromStorageString } from "./decimal.js";
import { areCompatible, UNIT_MISMATCH_MESSAGE } from "./units.js";
import type { DecimalString, Unit, ValidationResult } from "./types.js";

function nonNegative(raw: DecimalString, fieldName: string): ValidationResult<Decimal> {
  const value = fromStorageString(raw);
  if (value.isNegative()) {
    return { valid: false, reason: `${fieldName} cannot be negative.` };
  }
  return { valid: true, value };
}

function positive(raw: DecimalString, fieldName: string): ValidationResult<Decimal> {
  const value = fromStorageString(raw);
  // decimal.js's isPositive() is true for zero (it only checks the sign),
  // so a strict greater-than-zero check must compare against zero directly.
  if (value.lte(0)) {
    return { valid: false, reason: `${fieldName} must be greater than zero.` };
  }
  return { valid: true, value };
}

export function validatePackagePrice(raw: DecimalString): ValidationResult<Decimal> {
  return nonNegative(raw, "Package price");
}

export function validateAmountUsed(raw: DecimalString): ValidationResult<Decimal> {
  return nonNegative(raw, "Amount used");
}

export function validatePackageQuantity(raw: DecimalString): ValidationResult<Decimal> {
  return positive(raw, "Package quantity");
}

export function validateYield(value: number): ValidationResult<number> {
  if (!Number.isInteger(value) || value <= 0) {
    return { valid: false, reason: "Yield must be a positive whole number." };
  }
  return { valid: true, value };
}

export function validateHourlyRate(raw: DecimalString): ValidationResult<Decimal> {
  return nonNegative(raw, "Hourly rate");
}

export function validateLaborMinutes(raw: DecimalString): ValidationResult<Decimal> {
  return nonNegative(raw, "Labor minutes");
}

export function validatePackagingBatchCost(raw: DecimalString): ValidationResult<Decimal> {
  return nonNegative(raw, "Batch-level packaging cost");
}

export function validatePackagingPerItemCost(raw: DecimalString): ValidationResult<Decimal> {
  return nonNegative(raw, "Per-item packaging cost");
}

export function validateOverhead(raw: DecimalString): ValidationResult<Decimal> {
  return nonNegative(raw, "Overhead");
}

export function validateWastePercent(raw: DecimalString): ValidationResult<Decimal> {
  return nonNegative(raw, "Waste percentage");
}

export function validateMarginPercent(raw: DecimalString): ValidationResult<Decimal> {
  const value = fromStorageString(raw);
  if (value.isNegative()) {
    return { valid: false, reason: "Desired margin must be at least 0%." };
  }
  if (value.gte(100)) {
    return {
      valid: false,
      reason: "Desired margin must be less than 100% — at 100% or above, the price calculation is undefined.",
    };
  }
  return { valid: true, value };
}

export function validateRoundingIncrement(raw: DecimalString): ValidationResult<Decimal> {
  return positive(raw, "Rounding increment");
}

export function validateUnitCompatibility(packageUnit: Unit, usageUnit: Unit): ValidationResult<true> {
  if (!areCompatible(packageUnit, usageUnit)) {
    return { valid: false, reason: UNIT_MISMATCH_MESSAGE };
  }
  return { valid: true, value: true };
}
