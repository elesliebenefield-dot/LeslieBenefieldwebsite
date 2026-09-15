import { useCallback, useState } from 'react'
import './bakeryPricing.css'
import { ConfirmDialog } from '../core/components/ConfirmDialog'
import { computeIngredientSubtotal } from './calc-engine/formulas.ts'
import {
  validateHourlyRate,
  validateLaborMinutes,
  validateOverhead,
  validatePackagingBatchCost,
  validatePackagingPerItemCost,
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
    fieldError(costs.packagingBatchCost, validatePackagingBatchCost),
    fieldError(costs.packagingPerItemCost, validatePackagingPerItemCost),
    fieldError(costs.overheadFlatCost, validateOverhead),
    fieldError(costs.wastePercent, validateWastePercent),
  ].some(Boolean)
}

function recipeStepIsValid(yieldStr: string): boolean {
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
  const [costs, setCosts] = useState<DraftCostInputs>(EMPTY_DRAFT_COST_INPUTS)
  const [ack, setAck] = useState<ZeroCostAcknowledgement>(EMPTY_ZERO_COST_ACK)
  const [marginPercent, setMarginPercent] = useState('35')
  const [roundingIncrement, setRoundingIncrement] = useState<RoundingIncrement>('0.25')
  const [showRecipeErrors, setShowRecipeErrors] = useState(false)
  const [showCostErrors, setShowCostErrors] = useState(false)
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false)

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleNext = useCallback(() => {
    if (step === 'recipe') {
      if (!recipeStepIsValid(yieldStr)) {
        setShowRecipeErrors(true)
        return
      }
      setShowRecipeErrors(false)
      setStep('costs')
      scrollTop()
      return
    }
    if (step === 'costs') {
      if (costsStepHasError(costs)) {
        setShowCostErrors(true)
        return
      }
      setShowCostErrors(false)
      setStep('breakdown')
      scrollTop()
    }
  }, [step, yieldStr, costs, scrollTop])

  const handleBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
    scrollTop()
  }, [step, scrollTop])

  const handleConfirmStartOver = useCallback(() => {
    setRecipeName('')
    setYieldStr('')
    setIngredients([])
    setCosts(EMPTY_DRAFT_COST_INPUTS)
    setAck(EMPTY_ZERO_COST_ACK)
    setMarginPercent('35')
    setRoundingIncrement('0.25')
    setShowRecipeErrors(false)
    setShowCostErrors(false)
    setShowStartOverConfirm(false)
    setStep('recipe')
    scrollTop()
  }, [scrollTop])

  const stepIndex = STEP_ORDER.indexOf(step)
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEP_ORDER.length - 1
  const ingredientSubtotal = computeIngredientSubtotal(ingredients.map(i => i.cost))
  const yieldCount = Number.parseInt(yieldStr, 10)

  return (
    <div className="tool-page">
      <header className="tool-header">
        <span className="tool-header-title">Free Home Bakery Pricing Calculator</span>
      </header>

      <main className="bakery-pricing-calculator">
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
          />
        )}

        {step === 'costs' && (
          <AdditionalCostsStep
            costs={costs}
            onChange={patch => setCosts(prev => ({ ...prev, ...patch }))}
            ack={ack}
            onAcknowledge={key => setAck(prev => ({ ...prev, [key]: true }))}
            showErrors={showCostErrors}
          />
        )}

        {step === 'breakdown' && (
          <>
            <CostBreakdownStep
              ingredientSubtotal={ingredientSubtotal}
              costs={costs}
              yieldCount={yieldCount}
              marginPercent={marginPercent}
              onMarginChange={setMarginPercent}
              roundingIncrement={roundingIncrement}
              onRoundingChange={setRoundingIncrement}
            />
            <button type="button" className="bp-link-btn" onClick={() => setShowStartOverConfirm(true)}>
              Start over with a new recipe
            </button>
          </>
        )}

        <nav className="bp-nav" aria-label="Step navigation">
          <button type="button" className="bp-btn bp-btn-secondary" onClick={handleBack} disabled={isFirst}>
            ← Back
          </button>
          {!isLast && (
            <button type="button" className="bp-btn bp-btn-primary" onClick={handleNext}>
              {step === 'recipe' ? 'Continue to Additional Costs →' : 'See Cost Breakdown & Pricing →'}
            </button>
          )}
        </nav>
      </main>

      <div className="tool-disclaimer" role="note">
        <p>
          These figures are planning estimates based on what you entered. Bakery Pricing Planner is not
          accounting, tax, or financial advice, does not guarantee a profit, and does not replace your own
          judgment about your costs, local rules, and final pricing. All calculations happen in your browser —
          nothing you enter here is stored or transmitted anywhere.
        </p>
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
