import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../core/components/ConfirmDialog'
import { computeIngredientSubtotal, computeSuppliesSubtotal } from './calc-engine/formulas.ts'
import {
  validateHourlyRate,
  validateLaborMinutes,
  validateOverhead,
  validateWastePercent,
  validateYield,
} from './calc-engine/validation.ts'
import { fieldError } from './bakeryPricingValidationDisplay.ts'
import { RecipeIngredientsStep } from './RecipeIngredientsStep'
import { AdditionalCostsStep } from './AdditionalCostsStep'
import { CostBreakdownStep } from './CostBreakdownStep'
import { createIngredient, listIngredients, updateIngredient } from './data/ingredientRepository.ts'
import { createRecipe, getRecipeWithUsages, setRecipeUsages, updateRecipe } from './data/recipeRepository.ts'
import { resolveRecipeIngredientLines, supplyItemCost } from './bakeryPricingRecipeSummary.ts'
import {
  EMPTY_DRAFT_COST_INPUTS,
  EMPTY_ZERO_COST_ACK,
  type DraftCostInputs,
  type DraftIngredientLine,
  type DraftSupplyItem,
  type GuidedStep,
  type ZeroCostAcknowledgement,
} from './bakeryPricingDraftTypes.ts'
import type { NewUsage, StoredIngredient, StoredSupplyItem } from './data/types.ts'
import type { RoundingIncrement } from './calc-engine/types.ts'

const STEP_ORDER: GuidedStep[] = ['recipe', 'costs', 'breakdown']
const STEP_LABELS: Record<GuidedStep, string> = {
  recipe: 'Recipe & Ingredients',
  costs: 'Additional Costs',
  breakdown: 'Cost Breakdown & Pricing',
}

interface Props {
  // null when IndexedDB couldn't be opened (e.g. strict private-browsing) —
  // the guided flow still works in that case, exactly as it did in M3,
  // just without saving or saved-ingredient reuse.
  db: IDBDatabase | null
  // When set, this instance loads and edits that saved recipe instead of
  // starting a blank draft. The parent remounts this component (via a
  // changing `key`) whenever the target recipe changes.
  recipeIdToEdit?: string
  onSaved: () => void
  onDiscardEdit: () => void
  // Reports whether there is meaningful unsaved content, so the parent can
  // confirm before navigating away to another screen.
  onDirtyChange?: (dirty: boolean) => void
}

function costsStepHasError(costs: DraftCostInputs): boolean {
  return [
    fieldError(costs.laborHourlyRate, validateHourlyRate),
    fieldError(costs.laborMinutes, validateLaborMinutes),
    fieldError(costs.overheadFlatCost, validateOverhead),
    fieldError(costs.wastePercent, validateWastePercent),
  ].some(Boolean)
}

function yieldIsValid(yieldStr: string): boolean {
  if (yieldStr.trim() === '') return false
  const parsed = Number.parseInt(yieldStr, 10)
  const result = validateYield(parsed)
  return result.valid
}

export function BakeryPricingCalculator({ db, recipeIdToEdit, onSaved, onDiscardEdit, onDirtyChange }: Props) {
  const isEditing = !!recipeIdToEdit
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>(isEditing ? 'loading' : 'idle')
  const [loadSkippedSome, setLoadSkippedSome] = useState(false)

  const [step, setStep] = useState<GuidedStep>('recipe')
  const [recipeName, setRecipeName] = useState('')
  const [yieldStr, setYieldStr] = useState('')
  const [ingredients, setIngredients] = useState<DraftIngredientLine[]>([])
  const [supplyItems, setSupplyItems] = useState<DraftSupplyItem[]>([])
  const [costs, setCosts] = useState<DraftCostInputs>(EMPTY_DRAFT_COST_INPUTS)
  const [ack, setAck] = useState<ZeroCostAcknowledgement>(EMPTY_ZERO_COST_ACK)
  const [marginPercent, setMarginPercent] = useState('35')
  const [roundingIncrement, setRoundingIncrement] = useState<RoundingIncrement>('0.25')
  const [showRecipeErrors, setShowRecipeErrors] = useState(false)
  const [ingredientFormOpen, setIngredientFormOpen] = useState(false)
  const [showCostErrors, setShowCostErrors] = useState(false)
  const [costsReviewed, setCostsReviewed] = useState(false)
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false)
  // Gates the one-time suggested-price highlight — flips true the first
  // time a completed calculation is reached, and stays true so simply
  // navigating Back and Next again never replays it. Reset only by Start
  // Over, which is a genuinely new calculation.
  const [hasCelebrated, setHasCelebrated] = useState(false)

  const [savedIngredients, setSavedIngredients] = useState<StoredIngredient[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveNameError, setSaveNameError] = useState(false)

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // The baker's saved ingredients, offered in the add-ingredient
  // autocomplete alongside the common-ingredient reference library.
  useEffect(() => {
    if (!db) return
    let cancelled = false
    listIngredients(db).then((list) => {
      if (!cancelled) setSavedIngredients(list)
    })
    return () => {
      cancelled = true
    }
  }, [db])

  // Loads an existing saved recipe into the draft. Every ingredient's price,
  // quantity, and unit is looked up live from its current StoredIngredient
  // record here — never from a copy — per the PRD's saved-data rule.
  useEffect(() => {
    if (!recipeIdToEdit || !db) return
    let cancelled = false
    setLoadState('loading')
    ;(async () => {
      try {
        const withUsages = await getRecipeWithUsages(db, recipeIdToEdit)
        const lines = await resolveRecipeIngredientLines(db, withUsages)
        if (cancelled) return

        let anySkipped = false
        const draftIngredients: DraftIngredientLine[] = []
        for (const line of lines) {
          if (line.cost === null) {
            anySkipped = true
            continue
          }
          draftIngredients.push({
            id: crypto.randomUUID(),
            name: line.ingredient.name,
            packagePrice: line.ingredient.packagePrice,
            packageQuantity: line.ingredient.packageQuantity,
            packageUnit: line.ingredient.packageUnit,
            amountUsed: line.amountUsed,
            amountUsedUnit: line.amountUsedUnit,
            commonIngredientId: line.ingredient.commonIngredientId,
            customConversion: line.ingredient.customConversion,
            savedIngredientId: line.ingredientId,
            cost: line.cost,
          })
        }

        const draftSupplies: DraftSupplyItem[] = []
        for (const item of withUsages.recipe.supplyItems) {
          const cost = supplyItemCost(item)
          if (cost === null) {
            anySkipped = true
            continue
          }
          draftSupplies.push(
            item.mode === 'package'
              ? { id: item.id, name: item.name, mode: 'package', packagePrice: item.packagePrice, packageQuantity: item.packageQuantity, amountUsed: item.amountUsed, cost }
              : { id: item.id, name: item.name, mode: 'direct', directCost: item.directCost, cost },
          )
        }

        setRecipeName(withUsages.recipe.name)
        setYieldStr(String(withUsages.recipe.yield))
        setIngredients(draftIngredients)
        setSupplyItems(draftSupplies)
        setCosts({
          laborHourlyRate: withUsages.recipe.laborHourlyRate,
          laborMinutes: withUsages.recipe.laborMinutes,
          overheadFlatCost: withUsages.recipe.overheadFlatCost,
          wastePercent: withUsages.recipe.wastePercent,
        })
        setAck(withUsages.recipe.acknowledgedZeroCostFlags)
        setMarginPercent(withUsages.recipe.desiredMarginPercent)
        setRoundingIncrement(withUsages.recipe.roundingIncrement)
        setLoadSkippedSome(anySkipped)
        setLoadState('idle')
      } catch {
        if (!cancelled) setLoadState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [recipeIdToEdit, db])

  // Editing an existing recipe always warns before navigating away without
  // saving — simpler and safer than trying to detect a true no-op edit. A
  // brand-new, still-blank draft has nothing worth warning about.
  const dirty = isEditing || recipeName.trim() !== '' || ingredients.length > 0 || yieldStr.trim() !== ''
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const handleNext = useCallback(() => {
    if (step === 'recipe') {
      // The button is already disabled while the add-ingredient form is
      // open (see below) — this guards any other path to the same action,
      // so a visible, not-yet-added ingredient can never be mistaken for
      // one already included in the recipe.
      if (ingredientFormOpen) return
      if (!yieldIsValid(yieldStr) || ingredients.length === 0) {
        setShowRecipeErrors(true)
        return
      }
      setShowRecipeErrors(false)
      setStep('costs')
      scrollTop()
      return
    }
    if (step === 'costs') {
      setCostsReviewed(true)
      if (costsStepHasError(costs)) {
        setShowCostErrors(true)
        return
      }
      setShowCostErrors(false)
      setStep('breakdown')
      scrollTop()
    }
  }, [step, ingredientFormOpen, yieldStr, ingredients.length, costs, scrollTop])

  const handleBack = useCallback(() => {
    if (step === 'costs') setCostsReviewed(true)
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
    scrollTop()
  }, [step, scrollTop])

  const handleConfirmStartOver = useCallback(() => {
    setShowStartOverConfirm(false)
    if (isEditing) {
      onDiscardEdit()
      return
    }
    setRecipeName('')
    setYieldStr('')
    setIngredients([])
    setSupplyItems([])
    setCosts(EMPTY_DRAFT_COST_INPUTS)
    setAck(EMPTY_ZERO_COST_ACK)
    setMarginPercent('35')
    setRoundingIncrement('0.25')
    setShowRecipeErrors(false)
    setIngredientFormOpen(false)
    setShowCostErrors(false)
    setCostsReviewed(false)
    setHasCelebrated(false)
    setStep('recipe')
    scrollTop()
  }, [isEditing, onDiscardEdit, scrollTop])

  async function handleSave() {
    if (!db) {
      setSaveError("Saving isn't available in this browser right now.")
      return
    }
    if (recipeName.trim() === '') {
      setStep('recipe')
      setSaveNameError(true)
      scrollTop()
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const usages: NewUsage[] = []
      for (const line of ingredients) {
        let ingredientId: string
        if (line.savedIngredientId) {
          ingredientId = line.savedIngredientId
          const existing = savedIngredients.find((i) => i.id === line.savedIngredientId)
          // Remember a conversion the baker attached or changed this session
          // for next time this saved ingredient is used.
          if (existing && JSON.stringify(existing.customConversion) !== JSON.stringify(line.customConversion)) {
            await updateIngredient(db, ingredientId, { customConversion: line.customConversion })
          }
        } else {
          const created = await createIngredient(db, {
            name: line.name,
            packagePrice: line.packagePrice,
            packageQuantity: line.packageQuantity,
            packageUnit: line.packageUnit,
            commonIngredientId: line.commonIngredientId,
            customConversion: line.customConversion,
          })
          ingredientId = created.id
        }
        usages.push({ ingredientId, amountUsed: line.amountUsed, amountUsedUnit: line.amountUsedUnit })
      }

      const storedSupplyItems: StoredSupplyItem[] = supplyItems.map((item) =>
        item.mode === 'package'
          ? { id: item.id, name: item.name, mode: 'package', packagePrice: item.packagePrice, packageQuantity: item.packageQuantity, amountUsed: item.amountUsed }
          : { id: item.id, name: item.name, mode: 'direct', directCost: item.directCost },
      )

      // A blank cost or margin field is a valid, already-supported state in
      // the guided flow (the breakdown step treats it as $0 for display —
      // see CostBreakdownStep's own `blank()`) — but StoredRecipe's decimal
      // fields must never be a literal blank string, since re-deriving a
      // cost summary later (e.g. the Saved Recipes list) would otherwise
      // hand decimal.js an empty string and crash. Normalize once, here.
      const blankToZero = (v: string) => (v.trim() === '' ? '0' : v)

      const recipeFields = {
        name: recipeName.trim(),
        yield: Number.parseInt(yieldStr, 10),
        laborHourlyRate: blankToZero(costs.laborHourlyRate),
        laborMinutes: blankToZero(costs.laborMinutes),
        supplyItems: storedSupplyItems,
        overheadFlatCost: blankToZero(costs.overheadFlatCost),
        wastePercent: blankToZero(costs.wastePercent),
        desiredMarginPercent: blankToZero(marginPercent),
        roundingIncrement,
        acknowledgedZeroCostFlags: ack,
        currencyCode: 'USD',
      }

      if (recipeIdToEdit) {
        await updateRecipe(db, recipeIdToEdit, recipeFields)
        await setRecipeUsages(db, recipeIdToEdit, usages)
      } else {
        await createRecipe(db, recipeFields, usages)
      }
      setSaving(false)
      onSaved()
    } catch {
      setSaving(false)
      setSaveError('Something went wrong while saving. Please try again.')
    }
  }

  const stepIndex = STEP_ORDER.indexOf(step)
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEP_ORDER.length - 1
  const ingredientSubtotal = computeIngredientSubtotal(ingredients.map((i) => i.cost))
  const suppliesSubtotal = computeSuppliesSubtotal(supplyItems.map((i) => i.cost))
  const yieldCount = Number.parseInt(yieldStr, 10)

  if (loadState === 'loading') {
    return <p className="bp-helper">Loading recipe…</p>
  }

  if (loadState === 'error') {
    return (
      <div className="bp-error-banner" role="alert">
        <p>This recipe couldn't be loaded. It may have been deleted.</p>
        <button type="button" className="bp-link-btn" onClick={onDiscardEdit}>
          Back to Saved Recipes
        </button>
      </div>
    )
  }

  return (
    <>
      {isEditing && (
        <p className="bp-helper bp-editing-banner" role="status">
          Editing “{recipeName || 'this recipe'}”.
        </p>
      )}

      {loadSkippedSome && (
        <p className="bp-error" role="alert">
          One or more items in this recipe couldn't be priced automatically and were left out — please review your
          ingredients and Supplies &amp; Packaging.
        </p>
      )}

      <div className="bp-step-indicator" role="status" aria-label={`Step ${stepIndex + 1} of ${STEP_ORDER.length}: ${STEP_LABELS[step]}`}>
        <span className="bp-pill">Step {stepIndex + 1} of {STEP_ORDER.length}</span>
        <span className="bp-step-label">{STEP_LABELS[step]}</span>
      </div>

      {step === 'recipe' && (
        <RecipeIngredientsStep
          recipeName={recipeName}
          onRecipeNameChange={(value) => {
            setRecipeName(value)
            if (saveNameError) setSaveNameError(false)
          }}
          yieldStr={yieldStr}
          onYieldChange={setYieldStr}
          ingredients={ingredients}
          onAddIngredient={(line) => setIngredients((prev) => [...prev, line])}
          onRemoveIngredient={(id) => setIngredients((prev) => prev.filter((i) => i.id !== id))}
          showErrors={showRecipeErrors}
          savedIngredients={savedIngredients}
          onAddFormOpenChange={setIngredientFormOpen}
        />
      )}

      {step === 'recipe' && saveNameError && (
        <p className="bp-error" role="alert">Enter a name for this recipe before saving.</p>
      )}

      {step === 'costs' && (
        <AdditionalCostsStep
          costs={costs}
          onChange={(patch) => setCosts((prev) => ({ ...prev, ...patch }))}
          supplyItems={supplyItems}
          onAddSupplyItem={(item) => setSupplyItems((prev) => [...prev, item])}
          onUpdateSupplyItem={(item) => setSupplyItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))}
          onRemoveSupplyItem={(id) => setSupplyItems((prev) => prev.filter((i) => i.id !== id))}
          ack={ack}
          onAcknowledge={(key) => setAck((prev) => ({ ...prev, [key]: true }))}
          showErrors={showCostErrors}
          reviewed={costsReviewed}
        />
      )}

      {step === 'breakdown' && (
        <>
          <CostBreakdownStep
            ingredientSubtotal={ingredientSubtotal}
            suppliesSubtotal={suppliesSubtotal}
            costs={costs}
            yieldCount={yieldCount}
            marginPercent={marginPercent}
            onMarginChange={setMarginPercent}
            roundingIncrement={roundingIncrement}
            onRoundingChange={setRoundingIncrement}
            celebrateEligible={!hasCelebrated}
            onCelebrated={() => setHasCelebrated(true)}
          />

          {db && (
            <div className="bp-save-row">
              <button type="button" className="bp-btn bp-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : isEditing ? '💾 Save Changes' : '💾 Save This Recipe'}
              </button>
              {saveError && <p className="bp-error" role="alert">{saveError}</p>}
            </div>
          )}
          {!db && (
            <p className="bp-helper">Saving isn't available in this browser right now — your work here is still yours to use, it just won't be remembered.</p>
          )}

          <button type="button" className="bp-link-btn" onClick={() => setShowStartOverConfirm(true)}>
            {isEditing ? 'Discard changes' : 'Start over with a new recipe'}
          </button>
        </>
      )}

      {step === 'recipe' && ingredientFormOpen && (
        <p className="bp-helper bp-continue-blocked-note" role="status">Add or cancel this ingredient before continuing.</p>
      )}

      <nav className="bp-nav" aria-label="Step navigation">
        <button type="button" className="bp-btn bp-btn-secondary" onClick={handleBack} disabled={isFirst}>
          ← Back
        </button>
        {!isLast && (
          <button
            type="button"
            className="bp-btn bp-btn-primary"
            onClick={handleNext}
            disabled={step === 'recipe' && ingredientFormOpen}
          >
            {step === 'recipe' ? 'Continue to Additional Costs →' : 'See Cost Breakdown & Pricing →'}
          </button>
        )}
      </nav>

      <ConfirmDialog
        open={showStartOverConfirm}
        title={isEditing ? 'Discard changes?' : 'Start over?'}
        body={
          isEditing
            ? 'This will discard your changes and return to your saved recipes. Nothing you changed here will be kept.'
            : "This will clear this recipe's ingredients and costs. Nothing has been saved yet."
        }
        confirmLabel={isEditing ? 'Yes, Discard Changes' : 'Yes, Start Over'}
        cancelLabel="Go Back"
        onConfirm={handleConfirmStartOver}
        onCancel={() => setShowStartOverConfirm(false)}
      />
    </>
  )
}
