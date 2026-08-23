import { useState, useCallback } from 'react'
import { PlannerProgress } from '../core/components/PlannerProgress'
import { ConfirmDialog } from '../core/components/ConfirmDialog'
import { EventBasicsStage } from './stages/EventBasicsStage'
import { FoodAndServiceStage } from './stages/FoodAndServiceStage'
import { VenueAndLogisticsStage } from './stages/VenueAndLogisticsStage'
import { FoodTruckResults } from './FoodTruckResults'
import { EMPTY_FOOD_TRUCK_ANSWERS, type FoodTruckAnswers } from './foodTruckTypes'

type AppStage = 'event' | 'food' | 'venue' | 'results'

const STAGE_LABELS: Record<AppStage, string> = {
  event:   'Event basics',
  food:    'Food and service',
  venue:   'Venue and logistics',
  results: 'Your event service inquiry brief',
}

const STAGE_ORDER: AppStage[] = ['event', 'food', 'venue', 'results']

function validateStage(stage: AppStage, answers: FoodTruckAnswers): boolean {
  if (stage === 'event') {
    return !!(
      answers.eventType &&
      answers.eventDateStatus &&
      (answers.eventDateStatus === 'tbd' || answers.eventDate.trim()) &&
      (answers.eventDateStatus === 'confirmed' || answers.dateNotes.trim()) &&
      answers.venueName.trim() &&
      answers.isPublic &&
      answers.attendance &&
      answers.serviceWindow
    )
  }
  if (stage === 'food') {
    return !!(answers.serviceTypes.length > 0 && answers.paymentArrangement)
  }
  if (stage === 'venue') {
    return !!answers.setupSpace
  }
  return true
}

export function FoodTruckEventPlanner() {
  const [answers, setAnswers] = useState<FoodTruckAnswers>(EMPTY_FOOD_TRUCK_ANSWERS)
  const [stage, setStage] = useState<AppStage>('event')
  const [showErrors, setShowErrors] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleChange = useCallback((partial: Partial<FoodTruckAnswers>) => {
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
    setAnswers(EMPTY_FOOD_TRUCK_ANSWERS)
    setStage('event')
    setShowErrors(false)
    setShowConfirm(false)
    scrollTop()
  }, [scrollTop])

  const handleEditAnswers = useCallback(() => {
    setStage('event')
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
        <span className="tool-header-brand">Your Mobile Food Business</span>
        <span className="tool-header-sep" aria-hidden="true">›</span>
        <span className="tool-header-title">Food Truck Event Planner</span>
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
          <FoodTruckResults
            answers={answers}
            onEditAnswers={handleEditAnswers}
            onStartOver={handleStartOver}
            onNameChange={name => handleChange({ organizerName: name })}
          />
        ) : (
          <>
            {showErrors && (
              <div className="tool-error-banner" role="alert">
                Please answer all required questions before continuing.
              </div>
            )}

            {stage === 'event' && (
              <div className="tool-privacy-note" role="note">
                <span className="tool-privacy-icon" aria-hidden="true">🔒</span>
                Your answers stay in your browser during this session — nothing is stored or transmitted.
              </div>
            )}

            {stage === 'event' && <EventBasicsStage    answers={answers} onChange={handleChange} showErrors={showErrors} />}
            {stage === 'food'  && <FoodAndServiceStage answers={answers} onChange={handleChange} showErrors={showErrors} />}
            {stage === 'venue' && <VenueAndLogisticsStage answers={answers} onChange={handleChange} showErrors={showErrors} />}
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
              aria-label={stage === 'venue' ? 'Build my event brief' : 'Continue to next step'}
            >
              {stage === 'venue' ? 'Build My Event Brief →' : 'Next →'}
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
