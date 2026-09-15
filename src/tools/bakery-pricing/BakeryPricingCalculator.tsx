import { useCallback, useState } from 'react'
import './bakeryPricing.css'
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
import {
  EMPTY_DRAFT_COST_INPUTS,
  EMPTY_ZERO_COST_ACK,
  type DraftCostInputs,
  type DraftIngredientLine,
  type DraftSupplyItem,
  type GuidedStep,
  type ZeroCostAcknowledgement,
} from './bakeryPricingDraftTypes.ts'
import type { RoundingIncrement } from './calc-engine/types.ts'

const STEP_ORDER: GuidedStep[] = ['recipe', 'costs', 'breakdown']
const STEP_LABELS: Record<GuidedStep, string> = {
  recipe: 'Recipe & Ingredients',
  costs: 'Additional Costs',
  breakdown: 'Cost Breakdown & Pricing',
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

export function BakeryPricingCalculator() {
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
  const [showFullDisclaimer, setShowFullDisclaimer] = useState(false)
  // Gates the one-time suggested-price highlight — flips true the first
  // time a completed calculation is reached, and stays true so simply
  // navigating Back and Next again never replays it. Reset only by Start
  // Over, which is a genuinely new calculation.
  const [hasCelebrated, setHasCelebrated] = useState(false)

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

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
    setShowStartOverConfirm(false)
    setHasCelebrated(false)
    setStep('recipe')
    scrollTop()
  }, [scrollTop])

  const stepIndex = STEP_ORDER.indexOf(step)
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEP_ORDER.length - 1
  const ingredientSubtotal = computeIngredientSubtotal(ingredients.map(i => i.cost))
  const suppliesSubtotal = computeSuppliesSubtotal(supplyItems.map(i => i.cost))
  const yieldCount = Number.parseInt(yieldStr, 10)

  return (
    <div className="tool-page">
      <header className="tool-header">
        <span className="tool-header-title">Bakery Pricing Calculator</span>
      </header>

      <main className="bakery-pricing-calculator">
        <h1 className="bp-page-heading">
          <span className="bp-page-heading-icon" aria-hidden="true">🥖</span> Free Home Bakery Pricing Calculator
        </h1>

        <div className="bp-step-indicator" role="status" aria-label={`Step ${stepIndex + 1} of ${STEP_ORDER.length}: ${STEP_LABELS[step]}`}>
          <span className="bp-pill">Step {stepIndex + 1} of {STEP_ORDER.length}</span>
          <span className="bp-step-label">{STEP_LABELS[step]}</span>
        </div>

        {step === 'recipe' && (
          <RecipeIngredientsStep
            recipeName={recipeName}
            onRecipeNameChange={setRecipeName}
            yieldStr={yieldStr}
            onYieldChange={setYieldStr}
            ingredients={ingredients}
            onAddIngredient={line => setIngredients(prev => [...prev, line])}
            onRemoveIngredient={id => setIngredients(prev => prev.filter(i => i.id !== id))}
            showErrors={showRecipeErrors}
            onAddFormOpenChange={setIngredientFormOpen}
          />
        )}

        {step === 'costs' && (
          <AdditionalCostsStep
            costs={costs}
            onChange={patch => setCosts(prev => ({ ...prev, ...patch }))}
            supplyItems={supplyItems}
            onAddSupplyItem={item => setSupplyItems(prev => [...prev, item])}
            onUpdateSupplyItem={item => setSupplyItems(prev => prev.map(i => (i.id === item.id ? item : i)))}
            onRemoveSupplyItem={id => setSupplyItems(prev => prev.filter(i => i.id !== id))}
            ack={ack}
            onAcknowledge={key => setAck(prev => ({ ...prev, [key]: true }))}
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
            <button type="button" className="bp-link-btn" onClick={() => setShowStartOverConfirm(true)}>
              Start over with a new recipe
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
      </main>

      <div className="tool-disclaimer bp-disclaimer-compact" role="note">
        <p className="bp-disclaimer-summary">
          Planning estimates only, not financial advice. Calculations stay on your device and are never
          transmitted anywhere.
        </p>
        <details onToggle={e => setShowFullDisclaimer(e.currentTarget.open)}>
          <summary>{showFullDisclaimer ? 'Hide full disclaimer' : 'Read the full disclaimer'}</summary>
          <p>
            These figures are planning estimates based on what you entered. Bakery Pricing Planner is not
            accounting, tax, or financial advice, does not guarantee a profit, and does not replace your own
            judgment about your costs, local rules, and final pricing. All calculations happen on your device —
            what you enter here is never transmitted anywhere.
          </p>
        </details>
      </div>

      <ConfirmDialog
        open={showStartOverConfirm}
        title="Start over?"
        body="This will clear this recipe's ingredients and costs. Nothing has been saved yet."
        confirmLabel="Yes, Start Over"
        cancelLabel="Go Back"
        onConfirm={handleConfirmStartOver}
        onCancel={() => setShowStartOverConfirm(false)}
      />
    </div>
  )
}
