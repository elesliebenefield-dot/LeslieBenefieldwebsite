import { useState } from 'react'
import { PlannerProgress } from '../../core/components/PlannerProgress'
import { EventSetupStage } from './stages/EventSetupStage'
import { EventOutcomesStage } from './stages/EventOutcomesStage'
import { FollowUpPlanStage } from './stages/FollowUpPlanStage'
import { FollowUpResults } from './FollowUpResults'
import type { EventSetup, EventOutcomes, FollowUpAction } from './openHouseTypes'
import { makeEmptyEventSetup, makeEmptyEventOutcomes } from './openHouseTypes'

type AppStage = 'setup' | 'outcomes' | 'plan' | 'review'

const STAGE_LABELS: Record<AppStage, string> = {
  setup: 'Event setup',
  outcomes: 'Event outcomes',
  plan: 'Follow-up plan',
  review: 'Results',
}

const STAGE_ORDER: AppStage[] = ['setup', 'outcomes', 'plan', 'review']

function stageNumber(stage: AppStage): number {
  return STAGE_ORDER.indexOf(stage) + 1
}

export function OpenHouseFollowUpPlanner() {
  const [stage, setStage] = useState<AppStage>('setup')
  const [setup, setSetup] = useState<EventSetup>(makeEmptyEventSetup())
  const [outcomes, setOutcomes] = useState<EventOutcomes>(makeEmptyEventOutcomes())
  const [actions, setActions] = useState<FollowUpAction[]>([])

  // Stage 1 validation state
  const [showSetupErrors, setShowSetupErrors] = useState(false)

  function goToSetup() { setStage('setup') }
  function goToOutcomes() { setStage('outcomes') }
  function goToPlan() { setStage('plan') }
  function goToReview() { setStage('review') }

  function handleSetupNext() {
    if (!setup.propertyLabel.trim() || !setup.date) {
      setShowSetupErrors(true)
      return
    }
    setShowSetupErrors(false)
    goToOutcomes()
  }

  function handleStartOver() {
    setSetup(makeEmptyEventSetup())
    setOutcomes(makeEmptyEventOutcomes())
    setActions([])
    setShowSetupErrors(false)
    setStage('setup')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isResults = stage === 'review'
  const stepNumber = stageNumber(stage)

  return (
    <div className="tool-shell">
      <header className="tool-header">
        <div className="tool-header-inner">
          <a href="/" className="tool-wordmark" aria-label="Websites by Leslie — home">
            Websites by Leslie
          </a>
        </div>
      </header>

      <main className="tool-main" id="main-content">
        <div className="tool-container">
          <div className="tool-hero">
            <h1 className="tool-title">Open House Follow-Up Planner</h1>
            <p className="tool-subtitle">
              Organize your post-event responsibilities, visitor follow-up permissions, property
              feedback, and next actions — all in one session-only workspace.
            </p>
          </div>

          {!isResults && (
            <PlannerProgress
              step={stepNumber}
              totalSteps={STAGE_ORDER.length}
              stepLabel={STAGE_LABELS[stage]}
            />
          )}

          {stage === 'setup' && (
            <EventSetupStage
              setup={setup}
              onChange={s => { setSetup(s); setShowSetupErrors(false) }}
              showErrors={showSetupErrors}
              onNext={() => { handleSetupNext(); scrollTop() }}
            />
          )}

          {stage === 'outcomes' && (
            <EventOutcomesStage
              outcomes={outcomes}
              onChange={setOutcomes}
              onNext={() => { goToPlan(); scrollTop() }}
              onBack={() => { goToSetup(); scrollTop() }}
            />
          )}

          {stage === 'plan' && (
            <FollowUpPlanStage
              actions={actions}
              outcomes={outcomes}
              onChange={setActions}
              onNext={() => { goToReview(); scrollTop() }}
              onBack={() => { goToOutcomes(); scrollTop() }}
            />
          )}

          {stage === 'review' && (
            <FollowUpResults
              setup={setup}
              outcomes={outcomes}
              actions={actions}
              onBack={() => { goToPlan(); scrollTop() }}
              onStartOver={handleStartOver}
            />
          )}
        </div>
      </main>

      <footer className="tool-footer">
        <div className="tool-footer-inner">
          <p>
            <a href="/">Websites by Leslie</a> &mdash; real-estate planning tools for agents and
            their clients.
          </p>
          <p className="tool-footer-privacy">
            Session-only workspace. Nothing you enter here is saved, sent, or shared.
          </p>
        </div>
      </footer>
    </div>
  )
}
