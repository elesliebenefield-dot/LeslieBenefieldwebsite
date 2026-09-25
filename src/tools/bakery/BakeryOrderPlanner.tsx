import { useState, useCallback } from 'react'
import { PlannerProgress } from '../core/components/PlannerProgress'
import { ConfirmDialog } from '../core/components/ConfirmDialog'
import { WhatAreYouOrderingStage } from './stages/WhatAreYouOrderingStage'
import { CustomizeItStage } from './stages/CustomizeItStage'
import { TimingDetailsStage } from './stages/TimingDetailsStage'
import { BakeryResults } from './BakeryResults'
import { EMPTY_BAKERY_ANSWERS, type BakeryAnswers } from './bakeryTypes'

type AppStage = 'what' | 'customize' | 'timing' | 'results'

const STAGE_LABELS: Record<AppStage, string> = {
  what:      'What are you ordering?',
  customize: 'Customize it',
  timing:    'Details & questions',
  results:   'Your order request brief',
}

const STAGE_ORDER: AppStage[] = ['what', 'customize', 'timing', 'results']

function validateStage(stage: AppStage, answers: BakeryAnswers): boolean {
  if (stage === 'what') {
    return !!(answers.productType && answers.neededByDate && answers.occasion && answers.recipient)
  }
  if (stage === 'customize') {
    const inscriptionOk = answers.noInscription || !!answers.inscriptionText.trim()
    return inscriptionOk && !!answers.sizeQuantity.trim()
  }
  if (stage === 'timing') {
    return !!answers.budget
  }
  return true
}

export function BakeryOrderPlanner() {
  const [answers, setAnswers] = useState<BakeryAnswers>(EMPTY_BAKERY_ANSWERS)
  const [stage, setStage] = useState<AppStage>('what')
  const [showErrors, setShowErrors] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleChange = useCallback((partial: Partial<BakeryAnswers>) => {
    setAnswers(prev => ({ ...prev, ...partial }))
  }, [])

  const handleNext = useCallback(() => {
    if (!validateStage(stage, answers)) {
      setShowErrors(true)
      scrollTop()
      return
    }
    setShowErrors(false)
    const idx = STAGE_ORDER.indexOf(stage)
    setStage(STAGE_ORDER[idx + 1])
    scrollTop()
  }, [stage, answers, scrollTop])

  const handleBack = useCallback(() => {
    setShowErrors(false)
    const idx = STAGE_ORDER.indexOf(stage)
    if (idx > 0) setStage(STAGE_ORDER[idx - 1])
    scrollTop()
  }, [stage, scrollTop])

  const handleStartOver = useCallback(() => {
    setShowConfirm(true)
  }, [])

  const handleConfirmStartOver = useCallback(() => {
    setAnswers(EMPTY_BAKERY_ANSWERS)
    setStage('what')
    setShowErrors(false)
    setShowConfirm(false)
    scrollTop()
  }, [scrollTop])

  const handleEditAnswers = useCallback(() => {
    setStage('what')
    setShowErrors(false)
    scrollTop()
  }, [scrollTop])

  const isResults = stage === 'results'
  const stageIndex = STAGE_ORDER.indexOf(stage)
  const isFirst = stageIndex === 0
  const TOTAL_INPUT_STAGES = 3

  return (
    <div className="tool-page">
      <header className="tool-header">
        <span className="tool-header-brand">Your Custom Bakery</span>
        <span className="tool-header-sep" aria-hidden="true">›</span>
        <span className="tool-header-title">Custom Order Planner</span>
        <span className="tool-header-demo no-print">Interactive demo · Websites by Leslie</span>
      </header>

      {!isResults && (
        <PlannerProgress
          step={stageIndex + 1}
          totalSteps={TOTAL_INPUT_STAGES}
          stepLabel={STAGE_LABELS[stage]}
        />
      )}

      <main className="tool-content">
        {isResults ? (
          <BakeryResults
            answers={answers}
            onEditAnswers={handleEditAnswers}
            onStartOver={handleStartOver}
            onNameChange={name => handleChange({ customerName: name })}
          />
        ) : (
          <>
            {showErrors && (
              <div className="tool-error-banner" role="alert">
                Please answer all required questions before continuing.
              </div>
            )}

            {stage === 'what' && (
              <div className="tool-privacy-note" role="note">
                <span className="tool-privacy-icon" aria-hidden="true">🔒</span>
                Your answers stay in your browser during this session — nothing is stored or transmitted. Because nothing is saved, refreshing or leaving this page can erase your answers — copy or print your results (or share them, where available) before you go.
              </div>
            )}

            {stage === 'what'      && <WhatAreYouOrderingStage answers={answers} onChange={handleChange} showErrors={showErrors} />}
            {stage === 'customize' && <CustomizeItStage        answers={answers} onChange={handleChange} showErrors={showErrors} />}
            {stage === 'timing'    && <TimingDetailsStage      answers={answers} onChange={handleChange} showErrors={showErrors} />}
          </>
        )}
      </main>

      {!isResults && (
        <div className="tool-nav-wrap">
          <nav className="tool-nav" aria-label="Step navigation">
            <button
              type="button"
              className="tool-nav-back"
              onClick={handleBack}
              disabled={isFirst}
              aria-label="Go to previous step"
            >
              ← Back
            </button>
            <button
              type="button"
              className="tool-nav-next"
              onClick={handleNext}
              aria-label={stage === 'timing' ? 'Build my order brief' : 'Continue to next step'}
            >
              {stage === 'timing' ? 'Build My Order Brief →' : 'Next →'}
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
