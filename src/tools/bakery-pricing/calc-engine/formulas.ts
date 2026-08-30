// Every formula from the PRD's Pricing & Calculation Rules section.
// Full decimal precision is kept through every intermediate step; rounding
// happens only where the PRD specifies (the final suggested-price step).

import Decimal from "decimal.js";
import { fromStorageString, toStorageString } from "./decimal.js";
import { normalize } from "./units.js";
import {
  validateAmountUsed,
  validateHourlyRate,
  validateLaborMinutes,
  validateMarginPercent,
  validateOverhead,
  validatePackageQuantity,
  validatePackagePrice,
  validatePackagingBatchCost,
  validatePackagingPerItemCost,
  validateRoundingIncrement,
  validateUnitCompatibility,
  validateWastePercent,
  validateYield,
} from "./validation.js";
import type {
  CostBreakdown,
  DecimalString,
  IngredientInput,
  RecipeCostInputs,
  SuggestedPricing,
  ValidationResult,
} from "./types.js";

function fail(reason: string): ValidationResult<never> {
  return { valid: false, reason };
}

/** Ingredient cost = package price × (normalized amount used ÷ normalized package quantity). */
export function computeIngredientCost(input: IngredientInput): ValidationResult<DecimalString> {
  const price = validatePackagePrice(input.packagePrice);
  if (!price.valid) return fail(price.reason);

  const packageQuantity = validatePackageQuantity(input.packageQuantity);
  if (!packageQuantity.valid) return fail(packageQuantity.reason);

  const amountUsed = validateAmountUsed(input.amountUsed);
  if (!amountUsed.valid) return fail(amountUsed.reason);

  const unitCheck = validateUnitCompatibility(input.packageUnit, input.usageUnit);
  if (!unitCheck.valid) return fail(unitCheck.reason);

  const normalizedUsed = normalize(amountUsed.value, input.usageUnit);
  const normalizedPackage = normalize(packageQuantity.value, input.packageUnit);

  const cost = price.value.times(normalizedUsed.dividedBy(normalizedPackage));
  return { valid: true, value: toStorageString(cost) };
}

/** Ingredient subtotal = sum of all ingredient costs in the recipe. */
export function computeIngredientSubtotal(costs: DecimalString[]): DecimalString {
  const sum = costs.reduce((acc, c) => acc.plus(fromStorageString(c)), new Decimal(0));
  return toStorageString(sum);
}

/**
 * Full cost breakdown: ingredient waste allowance, labor, packaging,
 * overhead, total production cost, and cost per unit.
 */
export function computeCostBreakdown(inputs: RecipeCostInputs): ValidationResult<CostBreakdown> {
  const ingredientSubtotal = fromStorageString(inputs.ingredientSubtotal);

  const wastePercent = validateWastePercent(inputs.wastePercent);
  if (!wastePercent.valid) return fail(wastePercent.reason);

  const hourlyRate = validateHourlyRate(inputs.laborHourlyRate);
  if (!hourlyRate.valid) return fail(hourlyRate.reason);

  const laborMinutes = validateLaborMinutes(inputs.laborMinutes);
  if (!laborMinutes.valid) return fail(laborMinutes.reason);

  const packagingBatchCost = validatePackagingBatchCost(inputs.packagingBatchCost);
  if (!packagingBatchCost.valid) return fail(packagingBatchCost.reason);

  const packagingPerItemCost = validatePackagingPerItemCost(inputs.packagingPerItemCost);
  if (!packagingPerItemCost.valid) return fail(packagingPerItemCost.reason);

  const overhead = validateOverhead(inputs.overheadFlatCost);
  if (!overhead.valid) return fail(overhead.reason);

  const yieldResult = validateYield(inputs.yield_);
  if (!yieldResult.valid) return fail(yieldResult.reason);

  const wasteRate = wastePercent.value.dividedBy(100);
  const wasteAllowance = ingredientSubtotal.times(wasteRate);

  const laborCost = hourlyRate.value.times(laborMinutes.value.dividedBy(60));

  const packagingCost = packagingBatchCost.value.plus(
    packagingPerItemCost.value.times(yieldResult.value),
  );

  const totalProductionCost = ingredientSubtotal
    .plus(wasteAllowance)
    .plus(laborCost)
    .plus(packagingCost)
    .plus(overhead.value);

  const costPerUnit = totalProductionCost.dividedBy(yieldResult.value);

  return {
    valid: true,
    value: {
      ingredientSubtotal: toStorageString(ingredientSubtotal),
      wasteAllowance: toStorageString(wasteAllowance),
      laborCost: toStorageString(laborCost),
      packagingCost: toStorageString(packagingCost),
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
