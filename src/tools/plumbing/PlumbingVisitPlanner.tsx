import { useState, useCallback } from 'react'
import { PlannerProgress } from '../core/components/PlannerProgress'
import { ConfirmDialog } from '../core/components/ConfirmDialog'
import { WhatIsHappeningStage } from './stages/WhatIsHappeningStage'
import { WhereAndWhenStage } from './stages/WhereAndWhenStage'
import { AboutYourHomeStage } from './stages/AboutYourHomeStage'
import { PlumbingResults } from './PlumbingResults'
import { EMPTY_PLUMBING_ANSWERS, type PlumbingAnswers } from './plumbingTypes'

type AppStage = 'what' | 'where' | 'home' | 'results'

const STAGE_LABELS: Record<AppStage, string> = {
  what:    "What's happening?",
  where:   'Where and when?',
  home:    'About your home and the visit',
  results: 'Your service visit brief',
}

const STAGE_ORDER: AppStage[] = ['what', 'where', 'home', 'results']

function validateStage(stage: AppStage, answers: PlumbingAnswers): boolean {
  if (stage === 'what') {
    return !!(answers.concernType && answers.activeWater)
  }
  if (stage === 'where') {
    return !!(
      answers.homeArea &&
      answers.firstNoticed &&
      answers.changeAnswer &&
      answers.history &&
      answers.waterElsewhere
    )
  }
  if (stage === 'home') {
    return !!(answers.propertyType && answers.recentWork)
  }
  return true
}

export function PlumbingVisitPlanner() {
  const [answers, setAnswers] = useState<PlumbingAnswers>(EMPTY_PLUMBING_ANSWERS)
  const [stage, setStage] = useState<AppStage>('what')
  const [showErrors, setShowErrors] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleChange = useCallback((partial: Partial<PlumbingAnswers>) => {
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
    setAnswers(EMPTY_PLUMBING_ANSWERS)
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
        <span className="tool-header-brand">Your Plumbing Company</span>
        <span className="tool-header-sep" aria-hidden="true">›</span>
        <span className="tool-header-title">Plumbing Service Visit Planner</span>
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
          <PlumbingResults
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
                Your answers stay in your browser during this session — nothing is stored or transmitted.
              </div>
            )}

            {stage === 'what'  && <WhatIsHappeningStage answers={answers} onChange={handleChange} showErrors={showErrors} />}
            {stage === 'where' && <WhereAndWhenStage    answers={answers} onChange={handleChange} showErrors={showErrors} />}
            {stage === 'home'  && <AboutYourHomeStage   answers={answers} onChange={handleChange} showErrors={showErrors} />}
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
              aria-label={stage === 'home' ? 'Build my service visit brief' : 'Continue to next step'}
            >
              {stage === 'home' ? 'Build My Visit Brief →' : 'Next →'}
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
