// Every formula from the PRD's Pricing & Calculation Rules section.
// Full decimal precision is kept through every intermediate step; rounding
// happens only where the PRD specifies (the final suggested-price step).

import Decimal from "decimal.js";
import { fromStorageString, toStorageString } from "./decimal.js";
import { CROSS_TYPE_CONVERSION_REQUIRED_MESSAGE, UNIT_MISMATCH_MESSAGE, measurementTypeOf, normalize, normalizeAcrossTypes } from "./units.js";
import {
  validateAmountUsed,
  validateConversionWeightQuantity,
  validateHourlyRate,
  validateLaborMinutes,
  validateMarginPercent,
  validateOverhead,
  validatePackageQuantity,
  validatePackagePrice,
  validateRoundingIncrement,
  validateSellingPrice,
  validateSupplyDirectCost,
  validateWastePercent,
  validateYield,
} from "./validation.js";
import type {
  CostBreakdown,
  DecimalString,
  IngredientInput,
  RecipeCostInputs,
  SellingPriceTestResult,
  SuggestedPricing,
  SupplyPackageInput,
  ValidationResult,
} from "./types.js";

function fail(reason: string): ValidationResult<never> {
  return { valid: false, reason };
}

/**
 * Ingredient cost = package price × (normalized amount used ÷ normalized
 * package quantity). When the package and recipe-usage units are the same
 * measurement type (weight-to-weight or volume-to-volume, in any units),
 * this normalizes through the shared conversion registry as always. When
 * they are different types (one weight, one volume), a baker-supplied
 * `customConversion` bridges them via that specific ingredient's density —
 * never a guessed or universal one. A weight/volume mismatch with no
 * conversion is rejected; count paired with either weight or volume is
 * always rejected (no conversion path exists or is offered for that case).
 */
export function computeIngredientCost(input: IngredientInput): ValidationResult<DecimalString> {
  const price = validatePackagePrice(input.packagePrice);
  if (!price.valid) return fail(price.reason);

  const packageQuantity = validatePackageQuantity(input.packageQuantity);
  if (!packageQuantity.valid) return fail(packageQuantity.reason);

  const amountUsed = validateAmountUsed(input.amountUsed);
  if (!amountUsed.valid) return fail(amountUsed.reason);

  const packageType = measurementTypeOf(input.packageUnit);
  const usageType = measurementTypeOf(input.usageUnit);
  const normalizedPackage = normalize(packageQuantity.value, input.packageUnit);

  let normalizedUsed: Decimal;

  if (packageType === usageType) {
    normalizedUsed = normalize(amountUsed.value, input.usageUnit);
  } else if (
    (packageType === "weight" && usageType === "volume") ||
    (packageType === "volume" && usageType === "weight")
  ) {
    if (!input.customConversion) return fail(CROSS_TYPE_CONVERSION_REQUIRED_MESSAGE);

    const weightQuantity = validateConversionWeightQuantity(input.customConversion.weightQuantity);
    if (!weightQuantity.valid) return fail(weightQuantity.reason);

    normalizedUsed = normalizeAcrossTypes(amountUsed.value, input.usageUnit, {
      volumeUnit: input.customConversion.volumeUnit,
      weightQuantity: toStorageString(weightQuantity.value),
      weightUnit: input.customConversion.weightUnit,
    });
  } else {
    // Count paired with weight or volume — never bridgeable, no conversion offered.
    return fail(UNIT_MISMATCH_MESSAGE);
  }

  const cost = price.value.times(normalizedUsed.dividedBy(normalizedPackage));
  return { valid: true, value: toStorageString(cost) };
}

/**
 * Supplies & Packaging line item costed by package math — a package price
 * divided across however many the package contains, times however many
 * this recipe/order uses. No units: always a plain count.
 */
export function computeSupplyItemCost(input: SupplyPackageInput): ValidationResult<DecimalString> {
  const price = validatePackagePrice(input.packagePrice);
  if (!price.valid) return fail(price.reason);

  const packageQuantity = validatePackageQuantity(input.packageQuantity);
  if (!packageQuantity.valid) return fail(packageQuantity.reason);

  const amountUsed = validateAmountUsed(input.amountUsed);
  if (!amountUsed.valid) return fail(amountUsed.reason);

  const cost = price.value.times(amountUsed.value.dividedBy(packageQuantity.value));
  return { valid: true, value: toStorageString(cost) };
}

/**
 * A "direct cost" Supplies & Packaging line item — the baker already knows
 * the exact cost for this recipe/order (a single cake box, a custom
 * topper), so there is nothing to divide.
 */
export function computeSupplyDirectCost(rawCost: DecimalString): ValidationResult<DecimalString> {
  const cost = validateSupplyDirectCost(rawCost);
  if (!cost.valid) return fail(cost.reason);
  return { valid: true, value: toStorageString(cost.value) };
}

function sumDecimalStrings(values: DecimalString[]): DecimalString {
  const sum = values.reduce((acc, v) => acc.plus(fromStorageString(v)), new Decimal(0));
  return toStorageString(sum);
}

/** Ingredient subtotal = sum of all ingredient costs in the recipe. */
export function computeIngredientSubtotal(costs: DecimalString[]): DecimalString {
  return sumDecimalStrings(costs);
}

/** Supplies & Packaging subtotal = sum of every line item's already-computed cost. */
export function computeSuppliesSubtotal(costs: DecimalString[]): DecimalString {
  return sumDecimalStrings(costs);
}

/**
 * Full cost breakdown: ingredient waste allowance, labor, Supplies &
 * Packaging, overhead, total production cost, and cost per unit.
 */
export function computeCostBreakdown(inputs: RecipeCostInputs): ValidationResult<CostBreakdown> {
  const ingredientSubtotal = fromStorageString(inputs.ingredientSubtotal);

  const wastePercent = validateWastePercent(inputs.wastePercent);
  if (!wastePercent.valid) return fail(wastePercent.reason);

  const hourlyRate = validateHourlyRate(inputs.laborHourlyRate);
  if (!hourlyRate.valid) return fail(hourlyRate.reason);

  const laborMinutes = validateLaborMinutes(inputs.laborMinutes);
  if (!laborMinutes.valid) return fail(laborMinutes.reason);

  const suppliesCost = fromStorageString(inputs.suppliesSubtotal);

  const overhead = validateOverhead(inputs.overheadFlatCost);
  if (!overhead.valid) return fail(overhead.reason);

  const yieldResult = validateYield(inputs.yield_);
  if (!yieldResult.valid) return fail(yieldResult.reason);

  const wasteRate = wastePercent.value.dividedBy(100);
  const wasteAllowance = ingredientSubtotal.times(wasteRate);

  const laborCost = hourlyRate.value.times(laborMinutes.value.dividedBy(60));

  const totalProductionCost = ingredientSubtotal
    .plus(wasteAllowance)
    .plus(laborCost)
    .plus(suppliesCost)
    .plus(overhead.value);

  const costPerUnit = totalProductionCost.dividedBy(yieldResult.value);

  return {
    valid: true,
    value: {
      ingredientSubtotal: toStorageString(ingredientSubtotal),
      wasteAllowance: toStorageString(wasteAllowance),
      laborCost: toStorageString(laborCost),
      suppliesCost: toStorageString(suppliesCost),
      overhead: toStorageString(overhead.value),
      totalProductionCost: toStorageString(totalProductionCost),
      costPerUnit: toStorageString(costPerUnit),
    },
  };
}

/** Break-even price is the total production cost, with no profit added. */
export function computeBreakEven(totalProductionCost: DecimalString, costPerUnit: DecimalString) {
  return { batch: totalProductionCost, perItem: costPerUnit };
}

function roundUpToIncrement(value: Decimal, increment: Decimal): Decimal {
  return value.dividedBy(increment).ceil().times(increment);
}

/**
 * Margin-based suggested pricing: exact target price (batch and per item),
 * independently-rounded suggested whole-batch and per-item prices, and the
 * display-only equivalent markup rate.
 */
export function computeSuggestedPricing(
  totalProductionCost: DecimalString,
  yieldCount: number,
  marginPercent: DecimalString,
  roundingIncrement: DecimalString,
): ValidationResult<SuggestedPricing> {
  const yieldResult = validateYield(yieldCount);
  if (!yieldResult.valid) return fail(yieldResult.reason);

  const margin = validateMarginPercent(marginPercent);
  if (!margin.valid) return fail(margin.reason);

  const increment = validateRoundingIncrement(roundingIncrement);
  if (!increment.valid) return fail(increment.reason);

  const totalCost = fromStorageString(totalProductionCost);
  const marginRate = margin.value.dividedBy(100);

  const exactTargetPriceBatch = totalCost.dividedBy(new Decimal(1).minus(marginRate));
  const exactTargetPricePerItem = exactTargetPriceBatch.dividedBy(yieldResult.value);

  const suggestedWholeBatchPrice = roundUpToIncrement(exactTargetPriceBatch, increment.value);
  const suggestedPerItemPrice = roundUpToIncrement(exactTargetPricePerItem, increment.value);

  const equivalentMarkupRate = marginRate.dividedBy(new Decimal(1).minus(marginRate));

  return {
    valid: true,
    value: {
      desiredMarginRate: toStorageString(marginRate),
      exactTargetPriceBatch: toStorageString(exactTargetPriceBatch),
      exactTargetPricePerItem: toStorageString(exactTargetPricePerItem),
      suggestedWholeBatchPrice: toStorageString(suggestedWholeBatchPrice),
      suggestedPerItemPrice: toStorageString(suggestedPerItemPrice),
      equivalentMarkupRate: toStorageString(equivalentMarkupRate),
    },
  };
}

/**
 * Tests an arbitrary, baker-entered whole-batch selling price against the
 * already-computed total production cost — reporting what that price would
 * actually mean (per-item equivalent, dollars remaining, actual margin, and
 * whether it's below break-even). This is deliberately independent of
 * computeSuggestedPricing: it never feeds a result back into the
 * calculator's own cost-plus-margin recommendation, and the pricing formula
 * itself is untouched — this only reports against costs already computed.
 */
export function computeSellingPriceTest(
  batchPrice: DecimalString,
  totalProductionCost: DecimalString,
  yieldCount: number,
): ValidationResult<SellingPriceTestResult> {
  const price = validateSellingPrice(batchPrice);
  if (!price.valid) return fail(price.reason);

  const yieldResult = validateYield(yieldCount);
  if (!yieldResult.valid) return fail(yieldResult.reason);

  const cost = fromStorageString(totalProductionCost);
  const perItemPrice = price.value.dividedBy(yieldResult.value);
  const remaining = price.value.minus(cost);
  const actualMarginPercent = price.value.isZero() ? new Decimal(0) : remaining.dividedBy(price.value).times(100);

  return {
    valid: true,
    value: {
      batchPrice: toStorageString(price.value),
      perItemPrice: toStorageString(perItemPrice),
      remainingAfterCosts: toStorageString(remaining),
      actualMarginPercent: toStorageString(actualMarginPercent),
      belowBreakEven: remaining.isNegative(),
    },
  };
}
