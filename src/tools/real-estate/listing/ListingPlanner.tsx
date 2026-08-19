import { useState, useCallback } from 'react'
import { PlannerProgress } from '../../core/components/PlannerProgress'
import { ConfirmDialog } from '../../core/components/ConfirmDialog'
import { EMPTY_SETUP, type ListingPlanSetup, type PlanTask } from './listingTypes'
import { SetupStage } from './stages/SetupStage'
import { TaskBuilderStage } from './stages/TaskBuilderStage'
import { ReviewStage } from './stages/ReviewStage'
import { ActionPlanResults } from './ActionPlanResults'

type AppStage = 'setup' | 'build' | 'review' | 'results'

const STAGE_LABELS: Record<Exclude<AppStage, 'results'>, string> = {
  setup: 'Set Up the Plan',
  build: 'Build Your Action List',
  review: 'Review Your Plan',
}

const STAGE_ORDER: Exclude<AppStage, 'results'>[] = ['setup', 'build', 'review']

function stageStep(stage: AppStage): number {
  const idx = STAGE_ORDER.indexOf(stage as Exclude<AppStage, 'results'>)
  return idx === -1 ? 3 : idx + 1
}

export function ListingPlanner() {
  const [stage, setStage] = useState<AppStage>('setup')
  const [setup, setSetup] = useState<ListingPlanSetup>(EMPTY_SETUP)
  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleSetupChange = useCallback((partial: Partial<ListingPlanSetup>) => {
    setSetup(prev => ({ ...prev, ...partial }))
  }, [])

  const handleTasksChange = useCallback((updated: PlanTask[]) => {
    setTasks(updated)
  }, [])

  const handleNext = useCallback(() => {
    if (stage === 'setup') {
      if (!setup.occupancy) {
        setShowErrors(true)
        scrollTop()
        return
      }
      setShowErrors(false)
      setStage('build')
      scrollTop()
      return
    }

    if (stage === 'build') {
      if (tasks.length === 0) {
        setShowErrors(true)
        scrollTop()
        return
      }
      setShowErrors(false)
      setStage('review')
      scrollTop()
      return
    }

    if (stage === 'review') {
      setShowErrors(false)
      setStage('results')
      scrollTop()
    }
  }, [stage, setup.occupancy, tasks.length, scrollTop])

  const handleBack = useCallback(() => {
    setShowErrors(false)
    if (stage === 'build') { setStage('setup'); scrollTop() }
    else if (stage === 'review') { setStage('build'); scrollTop() }
  }, [stage, scrollTop])

  const handleStartOver = useCallback(() => {
    setShowConfirm(true)
  }, [])

  const handleConfirmStartOver = useCallback(() => {
    setSetup(EMPTY_SETUP)
    setTasks([])
    setStage('setup')
    setShowErrors(false)
    setShowConfirm(false)
    scrollTop()
  }, [scrollTop])

  const handleReviewEdit = useCallback(() => {
    setStage('review')
    scrollTop()
  }, [scrollTop])

  const isResults = stage === 'results'
  const currentStep = stageStep(stage)
  const currentLabel = isResults ? '' : STAGE_LABELS[stage as Exclude<AppStage, 'results'>]

  const nextLabel =
    stage === 'setup' ? 'Continue to Task List' :
    stage === 'build' ? 'Review My Plan →' :
    'See My Action Plan'

  const buildError = showErrors && stage === 'build' && tasks.length === 0

  return (
    <div className="tool-page">
      <header className="tool-header">
        <span className="tool-header-brand">Your Real Estate Agent</span>
        <span className="tool-header-sep" aria-hidden="true">›</span>
        <span className="tool-header-title">Listing Preparation Action Planner</span>
        <span className="tool-header-demo no-print">Interactive demo · Websites by Leslie</span>
      </header>

      {!isResults && (
        <PlannerProgress
          step={currentStep}
          totalSteps={3}
          stepLabel={currentLabel}
        />
      )}

      <main className="tool-content">
        {isResults ? (
          <ActionPlanResults
            setup={setup}
            tasks={tasks}
            onReviewEdit={handleReviewEdit}
            onStartOver={handleStartOver}
          />
        ) : (
          <>
            {showErrors && stage === 'setup' && (
              <div className="tool-error-banner" role="alert">
                Please select the current occupancy to continue.
              </div>
            )}
            {buildError && (
              <div className="tool-error-banner" role="alert">
                Add at least one task to your action plan before continuing.
              </div>
            )}

            {stage === 'setup' && (
              <div className="tool-privacy-note" role="note">
                <span className="tool-privacy-icon" aria-hidden="true">🔒</span>
                Your plan stays in your browser during this session — nothing is stored or transmitted.
              </div>
            )}

            {stage === 'setup' && (
              <SetupStage setup={setup} onChange={handleSetupChange} showErrors={showErrors} />
            )}
            {stage === 'build' && (
              <TaskBuilderStage tasks={tasks} onTasksChange={handleTasksChange} />
            )}
            {stage === 'review' && (
              <ReviewStage tasks={tasks} onTasksChange={handleTasksChange} />
            )}
          </>
        )}
      </main>

      {!isResults && (
        <div className="tool-nav-wrap">
          <nav className="tool-nav" aria-label="Stage navigation">
            <button
              type="button"
              className="tool-nav-back"
              onClick={handleBack}
              disabled={stage === 'setup'}
              aria-label="Go to previous stage"
            >
              ← Back
            </button>
            <button
              type="button"
              className="tool-nav-next"
              onClick={handleNext}
              aria-label={stage === 'review' ? 'Generate my action plan' : 'Go to next stage'}
            >
              {nextLabel}
            </button>
          </nav>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Start over?"
        body="This will clear all your tasks and return to the beginning."
        confirmLabel="Yes, Start Over"
        cancelLabel="Go Back"
        onConfirm={handleConfirmStartOver}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
