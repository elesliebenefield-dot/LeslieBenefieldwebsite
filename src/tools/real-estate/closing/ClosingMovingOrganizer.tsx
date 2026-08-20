import { useState } from 'react'
import { PlannerProgress } from '../../core/components/PlannerProgress'
import { TransitionSetupStage } from './stages/TransitionSetupStage'
import { TaskLibraryStage } from './stages/TaskLibraryStage'
import { OrganizeTimelineStage } from './stages/OrganizeTimelineStage'
import { ClosingResults } from './ClosingResults'
import type { TransitionSetup, ClosingTask } from './closingTypes'
import { makeEmptyTransitionSetup } from './closingTypes'

type AppStage = 'setup' | 'library' | 'timeline' | 'results'

const STAGE_LABELS: Record<AppStage, string> = {
  setup: 'Transition setup',
  library: 'Build the organizer',
  timeline: 'Organize the timeline',
  results: 'Results',
}

const STAGE_ORDER: AppStage[] = ['setup', 'library', 'timeline', 'results']

function stageNumber(stage: AppStage): number {
  return STAGE_ORDER.indexOf(stage) + 1
}

export function ClosingMovingOrganizer() {
  const [stage, setStage] = useState<AppStage>('setup')
  const [setup, setSetup] = useState<TransitionSetup>(makeEmptyTransitionSetup())
  const [tasks, setTasks] = useState<ClosingTask[]>([])
  const [showSetupErrors, setShowSetupErrors] = useState(false)

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSetupNext() {
    if (!setup.transitionType) {
      setShowSetupErrors(true)
      return
    }
    setShowSetupErrors(false)
    setStage('library')
    scrollTop()
  }

  function handleStartOver() {
    setSetup(makeEmptyTransitionSetup())
    setTasks([])
    setShowSetupErrors(false)
    setStage('setup')
    scrollTop()
  }

  const isResults = stage === 'results'
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
            <h1 className="tool-title">Closing &amp; Moving Organizer</h1>
            <p className="tool-subtitle">
              Coordinate your transition from contract stage through property handoff, moving day,
              and first-week setup — all in one session-only workspace.
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
            <TransitionSetupStage
              setup={setup}
              onChange={s => { setSetup(s); setShowSetupErrors(false) }}
              showErrors={showSetupErrors}
              onNext={handleSetupNext}
            />
          )}

          {stage === 'library' && (
            <TaskLibraryStage
              tasks={tasks}
              setup={setup}
              onChange={setTasks}
              onNext={() => { setStage('timeline'); scrollTop() }}
              onBack={() => { setStage('setup'); scrollTop() }}
            />
          )}

          {stage === 'timeline' && (
            <OrganizeTimelineStage
              tasks={tasks}
              onChange={setTasks}
              onNext={() => { setStage('results'); scrollTop() }}
              onBack={() => { setStage('library'); scrollTop() }}
            />
          )}

          {stage === 'results' && (
            <ClosingResults
              setup={setup}
              tasks={tasks}
              onBack={() => { setStage('timeline'); scrollTop() }}
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
