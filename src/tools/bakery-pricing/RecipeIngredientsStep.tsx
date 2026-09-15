import { useEffect, useState } from 'react'
import { computeIngredientCost, computeIngredientSubtotal } from './calc-engine/formulas.ts'
import { validateConversionWeightQuantity, validateYield } from './calc-engine/validation.ts'
import { measurementTypeOf, UNIT_MISMATCH_MESSAGE } from './calc-engine/units.ts'
import { UNIT_GROUPS, VOLUME_UNITS, defaultUnitFor } from './bakeryPricingUnitOptions.ts'
import { formatMoney } from './bakeryPricingFormat.ts'
import { safeCompute } from './bakeryPricingValidationDisplay.ts'
import type { DraftIngredientLine } from './bakeryPricingDraftTypes.ts'
import type { CustomIngredientConversion, MeasurementType, Unit, VolumeUnit, WeightUnit } from './calc-engine/types.ts'

// Display words for the volume-side unit in the two equally-weighted
// resolution choices and the conversion sentence — kept local to this
// component since it's UI copy, not a calc-engine concern.
const VOLUME_UNIT_WORDS: Record<VolumeUnit, { singular: string; plural: string }> = {
  mL: { singular: 'mL', plural: 'mL' },
  L: { singular: 'L', plural: 'L' },
  tsp: { singular: 'teaspoon', plural: 'teaspoons' },
  tbsp: { singular: 'tablespoon', plural: 'tablespoons' },
  cup: { singular: 'cup', plural: 'cups' },
}

// The recipe-friendly unit to switch to when the baker chooses to measure
// this ingredient by the package's own type — grams for weight, cups for
// volume, rather than each type's registry-order default (which would be
// mL for volume, an unnatural choice for a home baker to switch to).
const FRIENDLY_MATCHING_UNIT: Record<'weight' | 'volume', Unit> = { weight: 'g', volume: 'cup' }

interface Props {
  recipeName: string
  onRecipeNameChange: (value: string) => void
  yieldStr: string
  onYieldChange: (value: string) => void
  ingredients: DraftIngredientLine[]
  onAddIngredient: (line: DraftIngredientLine) => void
  onRemoveIngredient: (id: string) => void
  showErrors: boolean
}

interface DraftForm {
  name: string
  packageUnit: Unit
  amountUsedUnit: Unit
  packagePrice: string
  packageQuantity: string
  amountUsed: string
  showConversionForm: boolean
  conversionVolumeUnit: VolumeUnit
  conversionWeightQuantity: string
  conversionWeightUnit: WeightUnit
}

function initialForm(): DraftForm {
  return {
    name: '',
    packageUnit: defaultUnitFor('weight'),
    amountUsedUnit: defaultUnitFor('weight'),
    packagePrice: '',
    packageQuantity: '',
    amountUsed: '',
    showConversionForm: false,
    conversionVolumeUnit: 'cup',
    conversionWeightQuantity: '',
    conversionWeightUnit: 'g',
  }
}

function unitSelectOptions() {
  return UNIT_GROUPS.map(group => (
    <optgroup key={group.type} label={group.label}>
      {group.units.map(u => (
        <option key={u} value={u}>{u}</option>
      ))}
    </optgroup>
  ))
}

// Weight and volume are the only two types a per-ingredient conversion can
// bridge — count never mixes with either, and no resolution path is
// offered for that case (the old, plain unit-mismatch message still
// applies there).
function isBridgeableCrossType(a: MeasurementType, b: MeasurementType): boolean {
  return (a === 'weight' && b === 'volume') || (a === 'volume' && b === 'weight')
}

export function RecipeIngredientsStep({
  recipeName,
  onRecipeNameChange,
  yieldStr,
  onYieldChange,
  ingredients,
  onAddIngredient,
  onRemoveIngredient,
  showErrors,
}: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState<DraftForm>(initialForm())
  const [addError, setAddError] = useState<string | null>(null)

  const yieldResult = yieldStr.trim() === '' ? null : validateYield(Number.parseInt(yieldStr, 10))
  const yieldError = showErrors && (yieldStr.trim() === '' ? 'Enter how many items or servings this recipe makes.' : yieldResult && !yieldResult.valid ? yieldResult.reason : null)
  const hasNoIngredients = ingredients.length === 0

  const subtotal = computeIngredientSubtotal(ingredients.map(i => i.cost))

  const packageType = measurementTypeOf(form.packageUnit)
  const usageType = measurementTypeOf(form.amountUsedUnit)
  const typesMatch = packageType === usageType
  const isBridgeable = !typesMatch && isBridgeableCrossType(packageType, usageType)
  const isHardMismatch = !typesMatch && !isBridgeable

  const hasValidConversion =
    form.conversionWeightQuantity.trim() !== '' &&
    safeCompute(() => validateConversionWeightQuantity(form.conversionWeightQuantity)).valid

  const customConversion: CustomIngredientConversion | undefined =
    isBridgeable && hasValidConversion
      ? {
          volumeUnit: form.conversionVolumeUnit,
          weightQuantity: form.conversionWeightQuantity,
          weightUnit: form.conversionWeightUnit,
        }
      : undefined

  const crossTypeUnresolved = isBridgeable && !customConversion
  const ingredientLabel = form.name.trim() || 'this ingredient'
  // "the Flour" once named, but plain "this ingredient" (no dangling "the")
  // before a name has been entered.
  const weighSubject = form.name.trim() ? `the ${form.name.trim()}` : 'this ingredient'
  // Whichever side is the volume one — used for both the "measure in cups"
  // choice's wording and the conversion sentence's unit select.
  const volumeSideUnit = (packageType === 'volume' ? form.packageUnit : form.amountUsedUnit) as VolumeUnit

  const [focusUsagePending, setFocusUsagePending] = useState(false)
  useEffect(() => {
    if (focusUsagePending) {
      document.getElementById('bp-ing-use-qty')?.focus()
      setFocusUsagePending(false)
    }
  }, [focusUsagePending])

  function handlePackageUnitChange(unit: Unit) {
    setForm(f => ({ ...f, packageUnit: unit }))
    setAddError(null)
  }

  function handleUsageUnitChange(unit: Unit) {
    setForm(f => ({ ...f, amountUsedUnit: unit }))
    setAddError(null)
  }

  // "I can weigh it" / "I can measure it by volume" — switches the recipe
  // amount's unit to match the package's own type, so no per-ingredient
  // conversion is needed at all.
  function handleMatchPackageType() {
    setForm(f => ({ ...f, amountUsedUnit: FRIENDLY_MATCHING_UNIT[packageType as 'weight' | 'volume'], showConversionForm: false }))
    setFocusUsagePending(true)
  }

  // "I measure it in cups" — reveals the baker-supplied density conversion.
  function handleOpenConversionForm() {
    setForm(f => ({ ...f, showConversionForm: true, conversionVolumeUnit: volumeSideUnit, conversionWeightUnit: 'g' }))
  }

  const previewResult =
    !crossTypeUnresolved &&
    !isHardMismatch &&
    form.packagePrice.trim() !== '' &&
    form.packageQuantity.trim() !== '' &&
    form.amountUsed.trim() !== ''
      ? safeCompute(() =>
          computeIngredientCost({
            packagePrice: form.packagePrice,
            packageQuantity: form.packageQuantity,
            packageUnit: form.packageUnit,
            amountUsed: form.amountUsed,
            usageUnit: form.amountUsedUnit,
            customConversion,
          }),
        )
      : null

  function handleAdd() {
    if (form.name.trim() === '') {
      setAddError('Enter an ingredient name.')
      return
    }
    if (isHardMismatch) {
      setAddError(UNIT_MISMATCH_MESSAGE)
      return
    }
    if (crossTypeUnresolved) {
      setAddError('Choose how to resolve the weight/volume difference above before adding this ingredient.')
      return
    }
    const result = safeCompute(() =>
      computeIngredientCost({
        packagePrice: form.packagePrice,
        packageQuantity: form.packageQuantity,
        packageUnit: form.packageUnit,
        amountUsed: form.amountUsed,
        usageUnit: form.amountUsedUnit,
        customConversion,
      }),
    )
    if (!result.valid) {
      setAddError(result.reason)
      return
    }
    onAddIngredient({
      id: crypto.randomUUID(),
      name: form.name.trim(),
      packagePrice: form.packagePrice,
      packageQuantity: form.packageQuantity,
      packageUnit: form.packageUnit,
      amountUsed: form.amountUsed,
      amountUsedUnit: form.amountUsedUnit,
      customConversion,
      cost: result.value,
    })
    setForm(initialForm())
    setAddError(null)
    setIsAdding(false)
  }

  const addDisabled = isHardMismatch || crossTypeUnresolved

  return (
    <div className="bp-step">
      <div className="bp-intro">
        <p className="bp-intro-lead">This calculator estimates your recipe's true cost in three quick steps.</p>
        <p className="bp-intro-checklist">
          Before you start, have these ready: how many items or servings the recipe makes, each ingredient's
          package price and size, how much of each you use, and — if you'd like a fuller picture — your labor
          and packaging costs.
        </p>
      </div>

      <h2 className="bp-h2">Your Recipe</h2>

      <div className="bp-field">
        <label htmlFor="bp-recipe-name">What are you pricing? <span className="bp-optional">(optional)</span></label>
        <input
          id="bp-recipe-name"
          type="text"
          value={recipeName}
          onChange={e => onRecipeNameChange(e.target.value)}
          placeholder="e.g., Classic Chocolate Chip Cookies"
        />
      </div>

      <div className="bp-field">
        <label htmlFor="bp-yield">How many items or servings does this recipe make?</label>
        <input
          id="bp-yield"
          type="text"
          inputMode="numeric"
          value={yieldStr}
          onChange={e => onYieldChange(e.target.value)}
          placeholder="e.g., 24"
          aria-describedby="bp-yield-help"
          aria-invalid={!!yieldError}
        />
        <p className="bp-helper" id="bp-yield-help">A whole number — for example, 24 cookies or 8 servings, not a number of batches.</p>
        {yieldError && <p className="bp-error" role="alert">{yieldError}</p>}
      </div>

      <hr className="bp-divider" />

      <h2 className="bp-h2">Ingredients</h2>

      {hasNoIngredients ? (
        <div className={`bp-empty-state${showErrors ? ' bp-empty-state-error' : ''}`} role={showErrors ? 'alert' : undefined}>
          <p>
            {showErrors
              ? 'Add at least one ingredient before continuing — every recipe needs at least one to calculate a cost.'
              : "No ingredients yet. Add at least one below — this is what your recipe's cost is built from."}
          </p>
        </div>
      ) : (
        <ul className="bp-ingredient-list">
          {ingredients.map(line => (
            <li key={line.id} className="bp-ingredient-row">
              <span>
                {line.name} <span className="bp-ingredient-amount">({line.amountUsed} {line.amountUsedUnit})</span>
              </span>
              <span className="bp-ingredient-cost">{formatMoney(line.cost)}</span>
              <button
                type="button"
                className="bp-remove-btn"
                onClick={() => onRemoveIngredient(line.id)}
                aria-label={`Remove ${line.name}`}
              >
                ✕
              </button>
            </li>
          ))}
          <li className="bp-ingredient-row bp-ingredient-subtotal">
            <strong>Ingredient Subtotal</strong>
            <strong>{formatMoney(subtotal)}</strong>
          </li>
        </ul>
      )}

      {!isAdding ? (
        <button type="button" className="bp-btn bp-btn-ghost" onClick={() => setIsAdding(true)}>
          + Add an ingredient
        </button>
      ) : (
        <div className="bp-card bp-add-ingredient-form">
          <div className="bp-field">
            <label htmlFor="bp-ing-name">Ingredient name</label>
            <input
              id="bp-ing-name"
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g., All-Purpose Flour"
            />
          </div>

          <div className="bp-field">
            <label htmlFor="bp-ing-price">What did the package cost?</label>
            <input
              id="bp-ing-price"
              type="text"
              inputMode="decimal"
              value={form.packagePrice}
              onChange={e => setForm(f => ({ ...f, packagePrice: e.target.value }))}
              placeholder="e.g., 3.49"
            />
          </div>

          <div className="bp-amount-compare">
            <p className="bp-amount-compare-label">
              The package and your recipe can use different units — we'll convert automatically:
            </p>
            <div className="bp-amount-compare-grid">
              <div className="bp-amount-block">
                <span className="bp-amount-block-title">Package</span>
                <label htmlFor="bp-ing-pkg-qty">How much came in the package?</label>
                <div className="bp-inline-fields">
                  <input
                    id="bp-ing-pkg-qty"
                    type="text"
                    inputMode="decimal"
                    value={form.packageQuantity}
                    onChange={e => setForm(f => ({ ...f, packageQuantity: e.target.value }))}
                    placeholder="e.g., 5"
                  />
                  <select
                    aria-label="Package amount unit"
                    value={form.packageUnit}
                    onChange={e => handlePackageUnitChange(e.target.value as Unit)}
                  >
                    {unitSelectOptions()}
                  </select>
                </div>
              </div>

              <div className="bp-amount-compare-arrow" aria-hidden="true">→</div>

              <div className="bp-amount-block">
                <span className="bp-amount-block-title">This recipe</span>
                <label htmlFor="bp-ing-use-qty">How much does this recipe use?</label>
                <div className="bp-inline-fields">
                  <input
                    id="bp-ing-use-qty"
                    type="text"
                    inputMode="decimal"
                    value={form.amountUsed}
                    onChange={e => setForm(f => ({ ...f, amountUsed: e.target.value }))}
                    placeholder="e.g., 280"
                  />
                  <select
                    aria-label="Amount used unit"
                    value={form.amountUsedUnit}
                    onChange={e => handleUsageUnitChange(e.target.value as Unit)}
                  >
                    {unitSelectOptions()}
                  </select>
                </div>
              </div>
            </div>

            {isHardMismatch && (
              <p className="bp-error" role="alert">{UNIT_MISMATCH_MESSAGE}</p>
            )}

            {isBridgeable && (
              <div className="bp-cross-type-help" role="status">
                <p>
                  This ingredient is sold by {packageType}, but your recipe measures it by {usageType}. Because
                  every ingredient weighs differently, we need one more detail to calculate its cost accurately.
                </p>

                <div className="bp-choice-group" role="group" aria-label="How to resolve this weight/volume difference">
                  <button type="button" className="bp-choice-card bp-choice-card-weigh" onClick={handleMatchPackageType}>
                    <span className="bp-choice-card-title">
                      {packageType === 'weight' ? `I can weigh ${weighSubject}` : `I can measure ${weighSubject} by volume`}
                    </span>
                    <span className="bp-choice-card-helper">
                      {packageType === 'weight'
                        ? 'Switch to grams and enter the amount you use.'
                        : 'Switch to cups and enter the amount you use.'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`bp-choice-card bp-choice-card-convert${form.showConversionForm ? ' bp-choice-card-selected' : ''}`}
                    onClick={handleOpenConversionForm}
                  >
                    <span className="bp-choice-card-title">
                      I measure {ingredientLabel} in {VOLUME_UNIT_WORDS[volumeSideUnit].plural}
                    </span>
                    <span className="bp-choice-card-helper">
                      Tell us what one {VOLUME_UNIT_WORDS[volumeSideUnit].singular} of this ingredient weighs.
                    </span>
                  </button>
                </div>

                {form.showConversionForm && (
                  <div className="bp-conversion-form">
                    <p className="bp-conversion-row">
                      <span>1</span>
                      <select
                        aria-label="Conversion volume unit"
                        value={form.conversionVolumeUnit}
                        onChange={e => setForm(f => ({ ...f, conversionVolumeUnit: e.target.value as VolumeUnit }))}
                      >
                        {VOLUME_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <span>of</span>
                      <strong>{ingredientLabel}</strong>
                      <span>weighs</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label="Conversion weight amount"
                        value={form.conversionWeightQuantity}
                        onChange={e => setForm(f => ({ ...f, conversionWeightQuantity: e.target.value }))}
                        placeholder="e.g., 120"
                      />
                      <span>grams.</span>
                    </p>
                    <p className="bp-helper">
                      Use the weight provided by your recipe or flour brand, or weigh one cup with a kitchen scale.
                      We won't guess this value.
                    </p>
                  </div>
                )}

                {crossTypeUnresolved && (
                  <p className="bp-helper bp-cross-type-unresolved-note">Choose one of the options above before adding this ingredient.</p>
                )}
              </div>
            )}

            {addError ? (
              <p className="bp-error" role="alert">{addError}</p>
            ) : previewResult && previewResult.valid ? (
              <p className="bp-helper">
                This ingredient costs about <strong>{formatMoney(previewResult.value)}</strong> for the amount used.
              </p>
            ) : null}
          </div>

          <div className="bp-inline-fields">
            <button type="button" className="bp-btn bp-btn-secondary" onClick={() => { setIsAdding(false); setForm(initialForm()); setAddError(null) }}>
              Cancel
            </button>
            <button type="button" className="bp-btn bp-btn-primary" onClick={handleAdd} disabled={addDisabled}>
              Add to recipe
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
