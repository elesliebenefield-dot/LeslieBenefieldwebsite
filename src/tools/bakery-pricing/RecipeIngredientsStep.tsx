import { useState } from 'react'
import { computeIngredientCost, computeIngredientSubtotal } from './calc-engine/formulas.ts'
import { validateYield } from './calc-engine/validation.ts'
import { MEASUREMENT_TYPE_OPTIONS, UNIT_OPTIONS_BY_MEASUREMENT_TYPE, defaultUnitFor } from './bakeryPricingUnitOptions.ts'
import { formatMoney } from './bakeryPricingFormat.ts'
import { safeCompute } from './bakeryPricingValidationDisplay.ts'
import type { DraftIngredientLine } from './bakeryPricingDraftTypes.ts'
import type { MeasurementType, Unit } from './calc-engine/types.ts'

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
  measurementType: MeasurementType
  packageUnit: Unit
  amountUsedUnit: Unit
  packagePrice: string
  packageQuantity: string
  amountUsed: string
}

function initialForm(): DraftForm {
  return {
    name: '',
    measurementType: 'weight',
    packageUnit: defaultUnitFor('weight'),
    amountUsedUnit: defaultUnitFor('weight'),
    packagePrice: '',
    packageQuantity: '',
    amountUsed: '',
  }
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
  const yieldError = showErrors && (yieldStr.trim() === '' ? 'Yield must be a positive whole number.' : yieldResult && !yieldResult.valid ? yieldResult.reason : null)

  const subtotal = computeIngredientSubtotal(ingredients.map(i => i.cost))

  function handleMeasurementTypeChange(type: MeasurementType) {
    setForm(f => ({ ...f, measurementType: type, packageUnit: defaultUnitFor(type), amountUsedUnit: defaultUnitFor(type) }))
    setAddError(null)
  }

  const previewResult =
    form.packagePrice.trim() !== '' && form.packageQuantity.trim() !== '' && form.amountUsed.trim() !== ''
      ? safeCompute(() =>
          computeIngredientCost({
            packagePrice: form.packagePrice,
            packageQuantity: form.packageQuantity,
            packageUnit: form.packageUnit,
            amountUsed: form.amountUsed,
            usageUnit: form.amountUsedUnit,
          }),
        )
      : null

  function handleAdd() {
    if (form.name.trim() === '') {
      setAddError('Enter an ingredient name.')
      return
    }
    const result = safeCompute(() =>
      computeIngredientCost({
        packagePrice: form.packagePrice,
        packageQuantity: form.packageQuantity,
        packageUnit: form.packageUnit,
        amountUsed: form.amountUsed,
        usageUnit: form.amountUsedUnit,
      }),
    )
    if (!result.valid) {
      setAddError(result.reason)
      return
    }
    onAddIngredient({
      id: crypto.randomUUID(),
      name: form.name.trim(),
      measurementType: form.measurementType,
      packagePrice: form.packagePrice,
      packageQuantity: form.packageQuantity,
      packageUnit: form.packageUnit,
      amountUsed: form.amountUsed,
      amountUsedUnit: form.amountUsedUnit,
      cost: result.value,
    })
    setForm(initialForm())
    setAddError(null)
    setIsAdding(false)
  }

  return (
    <div className="bp-step">
      <h2 className="bp-h2">Recipe</h2>

      <div className="bp-field">
        <label htmlFor="bp-recipe-name">Recipe name <span className="bp-optional">(optional)</span></label>
        <input
          id="bp-recipe-name"
          type="text"
          value={recipeName}
          onChange={e => onRecipeNameChange(e.target.value)}
          placeholder="e.g., Classic Chocolate Chip Cookies"
        />
      </div>

      <div className="bp-field">
        <label htmlFor="bp-yield">Yield</label>
        <input
          id="bp-yield"
          type="text"
          inputMode="numeric"
          value={yieldStr}
          onChange={e => onYieldChange(e.target.value)}
          aria-describedby="bp-yield-help"
          aria-invalid={!!yieldError}
        />
        <p className="bp-helper" id="bp-yield-help">A whole number of items or servings this recipe makes.</p>
        {yieldError && <p className="bp-error" role="alert">{yieldError}</p>}
      </div>

      <hr className="bp-divider" />

      <h2 className="bp-h2">Ingredients</h2>

      {ingredients.length > 0 && (
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
          + Add Ingredient
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
            />
          </div>

          <div className="bp-field">
            <label htmlFor="bp-ing-type">Measurement type</label>
            <select
              id="bp-ing-type"
              value={form.measurementType}
              onChange={e => handleMeasurementTypeChange(e.target.value as MeasurementType)}
            >
              {MEASUREMENT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="bp-helper">Weight, volume, and count are kept strictly separate — no conversion is ever guessed between them.</p>
          </div>

          <div className="bp-field">
            <label htmlFor="bp-ing-price">Package price</label>
            <input
              id="bp-ing-price"
              type="text"
              inputMode="decimal"
              value={form.packagePrice}
              onChange={e => setForm(f => ({ ...f, packagePrice: e.target.value }))}
            />
          </div>

          <div className="bp-field">
            <span className="bp-group-label">Package quantity</span>
            <div className="bp-inline-fields">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Package quantity amount"
                value={form.packageQuantity}
                onChange={e => setForm(f => ({ ...f, packageQuantity: e.target.value }))}
              />
              <select
                aria-label="Package quantity unit"
                value={form.packageUnit}
                onChange={e => setForm(f => ({ ...f, packageUnit: e.target.value as Unit }))}
              >
                {UNIT_OPTIONS_BY_MEASUREMENT_TYPE[form.measurementType].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bp-field">
            <span className="bp-group-label">Amount used in this recipe</span>
            <div className="bp-inline-fields">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Amount used"
                value={form.amountUsed}
                onChange={e => setForm(f => ({ ...f, amountUsed: e.target.value }))}
              />
              <select
                aria-label="Amount used unit"
                value={form.amountUsedUnit}
                onChange={e => setForm(f => ({ ...f, amountUsedUnit: e.target.value as Unit }))}
              >
                {UNIT_OPTIONS_BY_MEASUREMENT_TYPE[form.measurementType].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
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
            <button type="button" className="bp-btn bp-btn-primary" onClick={handleAdd}>
              Save Ingredient
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
