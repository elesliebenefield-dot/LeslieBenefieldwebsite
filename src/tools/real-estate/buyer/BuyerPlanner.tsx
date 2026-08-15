import { useState, useRef, useCallback } from 'react'
import { PlannerProgress } from '../../core/components/PlannerProgress'
import { ConfirmDialog } from '../../core/components/ConfirmDialog'
import { evaluateRules } from '../../core/evaluateRules'
import { BuyerResults } from './BuyerResults'
import { BuyingPlansStep } from './steps/BuyingPlansStep'
import { SearchPreferencesStep } from './steps/SearchPreferencesStep'
import { FinancingStep } from './steps/FinancingStep'
import { TimingStep } from './steps/TimingStep'
import { PrioritiesStep } from './steps/PrioritiesStep'
import { BUYER_RULES, SECTION_ORDER, SECTION_TITLES } from './buyerRules'
import { EMPTY_BUYER_ANSWERS, type BuyerAnswers } from './buyerTypes'

const STEP_LABELS = [
  'Buying Plans',
  'Search Preferences',
  'Financing Status',
  'Timing & Coordination',
  'Priorities & Questions',
]

const TOTAL_STEPS = 5

function validateStep(step: number, answers: BuyerAnswers): boolean {
  if (step === 1) return !!(answers.timeframe && answers.stage && answers.purchaseType)
  if (step === 2) return !!answers.hasTargetArea
  if (step === 3) return !!answers.financingStatus
  if (step === 4) return !!(answers.housingTiming && answers.mustSellFirst && answers.showingAvailability && answers.otherDecisionMakers && answers.movingFlexibility)
  return true
}

export function BuyerPlanner() {
  const [answers, setAnswers] = useState<BuyerAnswers>(EMPTY_BUYER_ANSWERS)
  const [step, setStep] = useState(1)
  const [showResults, setShowResults] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleChange = useCallback((partial: Partial<BuyerAnswers>) => {
    setAnswers(prev => ({ ...prev, ...partial }))
  }, [])

  const handleNext = useCallback(() => {
    if (!validateStep(step, answers)) {
      setShowErrors(true)
      scrollTop()
      return
    }
    setShowErrors(false)
    if (step === TOTAL_STEPS) {
      setShowResults(true)
      scrollTop()
    } else {
      setStep(s => s + 1)
      scrollTop()
    }
  }, [step, answers, scrollTop])

  const handleBack = useCallback(() => {
    setShowErrors(false)
    setStep(s => s - 1)
    scrollTop()
  }, [scrollTop])

  const handleStartOver = useCallback(() => {
    setShowConfirm(true)
  }, [])

  const handleConfirmStartOver = useCallback(() => {
    setAnswers(EMPTY_BUYER_ANSWERS)
    setStep(1)
    setShowResults(false)
    setShowErrors(false)
    setShowConfirm(false)
    scrollTop()
  }, [scrollTop])

  const handleEditAnswers = useCallback(() => {
    setShowResults(false)
    setStep(1)
    setShowErrors(false)
    scrollTop()
  }, [scrollTop])

  const results = showResults
    ? evaluateRules(BUYER_RULES, answers, [...SECTION_ORDER], SECTION_TITLES)
    : []

  return (
    <div className="tool-page">
      <header className="tool-header">
        <span className="tool-header-brand">Your Real Estate Agent</span>
        <span className="tool-header-sep" aria-hidden="true">›</span>
        <span className="tool-header-title">Buyer Readiness Planner</span>
        <span className="tool-header-demo no-print">Interactive demo · Websites by Leslie</span>
      </header>

      {!showResults && (
        <PlannerProgress
          step={step}
          totalSteps={TOTAL_STEPS}
          stepLabel={STEP_LABELS[step - 1]}
        />
      )}

      <main className="tool-content" ref={contentRef}>
        {showResults ? (
          <BuyerResults
            sections={results}
            answers={answers}
            onStartOver={handleStartOver}
            onEditAnswers={handleEditAnswers}
          />
        ) : (
          <>
            {showErrors && (
              <div className="tool-error-banner" role="alert">
                Please answer all required questions before continuing.
              </div>
            )}

            {step === 1 && (
              <div className="tool-privacy-note" role="note">
                <span className="tool-privacy-icon" aria-hidden="true">🔒</span>
                Your answers stay in your browser during this session — nothing is stored or transmitted.
              </div>
            )}

            {step === 1 && <BuyingPlansStep answers={answers} onChange={handleChange} showErrors={showErrors} />}
            {step === 2 && <SearchPreferencesStep answers={answers} onChange={handleChange} showErrors={showErrors} />}
            {step === 3 && <FinancingStep answers={answers} onChange={handleChange} showErrors={showErrors} />}
            {step === 4 && <TimingStep answers={answers} onChange={handleChange} showErrors={showErrors} />}
            {step === 5 && <PrioritiesStep answers={answers} onChange={handleChange} />}
          </>
        )}
      </main>

      {!showResults && (
        <div className="tool-nav-wrap">
          <nav className="tool-nav" aria-label="Step navigation">
            <button
              type="button"
              className="tool-nav-back"
              onClick={handleBack}
              disabled={step === 1}
              aria-label="Go to previous step"
            >
              ← Back
            </button>
            <button
              type="button"
              className="tool-nav-next"
              onClick={handleNext}
              aria-label={step === TOTAL_STEPS ? 'See my planning summary' : 'Go to next step'}
            >
              {step === TOTAL_STEPS ? 'See My Planning Summary' : 'Next →'}
            </button>
          </nav>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Start over?"
        body="This will clear all your answers and return to step 1."
        confirmLabel="Yes, Start Over"
        cancelLabel="Go Back"
        onConfirm={handleConfirmStartOver}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
