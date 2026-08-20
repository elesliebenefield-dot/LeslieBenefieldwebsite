import { useState } from 'react'
import { PlannerProgress } from '../../core/components/PlannerProgress'
import { PrioritiesStage } from './stages/PrioritiesStage'
import { PropertiesStage } from './stages/PropertiesStage'
import { ObservationsStage } from './stages/ObservationsStage'
import { ComparisonResults } from './ComparisonResults'
import type { Priority, Property, PropertyObservations } from './comparisonTypes'
import { MIN_PROPERTIES } from './comparisonTypes'
import { makeId } from './comparisonPriorities'
import { makeEmptyProperty } from './comparisonTypes'

type AppStage = 'priorities' | 'properties' | 'observations' | 'review'

export function PropertyComparisonPlanner() {
  const [stage, setStage] = useState<AppStage>('priorities')
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [properties, setProperties] = useState<Property[]>([
    makeEmptyProperty(makeId()),
    makeEmptyProperty(makeId()),
  ])
  const [observations, setObservations] = useState<Record<string, PropertyObservations>>({})
  const [showErrors, setShowErrors] = useState(false)

  function updateObservation(propId: string, obs: PropertyObservations) {
    setObservations(prev => ({ ...prev, [propId]: obs }))
  }

  function handlePropertiesChange(next: Property[]) {
    // Clean up observations for removed properties
    const nextIds = new Set(next.map(p => p.id))
    setObservations(prev => {
      const cleaned: Record<string, PropertyObservations> = {}
      for (const id of Object.keys(prev)) {
        if (nextIds.has(id)) cleaned[id] = prev[id]
      }
      return cleaned
    })
    setProperties(next)
  }

  function handlePrioritiesChange(next: Priority[]) {
    // Clean up priorityMatches for removed priorities
    const nextIds = new Set(next.map(p => p.id))
    setObservations(prev => {
      const cleaned: Record<string, PropertyObservations> = {}
      for (const propId of Object.keys(prev)) {
        const obs = prev[propId]
        const cleanedMatches: Record<string, any> = {}
        for (const prId of Object.keys(obs.priorityMatches)) {
          if (nextIds.has(prId)) cleanedMatches[prId] = obs.priorityMatches[prId]
        }
        cleaned[propId] = { ...obs, priorityMatches: cleanedMatches }
      }
      return cleaned
    })
    setPriorities(next)
  }

  function canAdvanceFrom(s: AppStage): boolean {
    if (s === 'priorities') return priorities.length > 0
    if (s === 'properties') {
      return properties.filter(p => p.nickname.trim()).length >= MIN_PROPERTIES
    }
    return true
  }

  function advanceTo(next: AppStage) {
    const currentStage = next === 'properties' ? 'priorities'
      : next === 'observations' ? 'properties'
      : next === 'review' ? 'observations'
      : 'priorities'
    if (!canAdvanceFrom(currentStage as AppStage)) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    setStage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleNext() {
    if (stage === 'priorities') advanceTo('properties')
    else if (stage === 'properties') advanceTo('observations')
    else if (stage === 'observations') advanceTo('review')
  }

  function handleBack() {
    setShowErrors(false)
    if (stage === 'properties') setStage('priorities')
    else if (stage === 'observations') setStage('properties')
    else if (stage === 'review') setStage('observations')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleStartOver() {
    setPriorities([])
    setProperties([makeEmptyProperty(makeId()), makeEmptyProperty(makeId())])
    setObservations({})
    setShowErrors(false)
    setStage('priorities')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const stepMap: Record<AppStage, number> = {
    priorities: 1,
    properties: 2,
    observations: 3,
    review: 4,
  }

  const stepLabelMap: Record<AppStage, string> = {
    priorities: 'Set tour priorities',
    properties: 'Add properties',
    observations: 'Record observations',
    review: 'Review comparison',
  }

  const isReview = stage === 'review'

  return (
    <div className="listing-planner-root cmp-planner-root">
      <header className="listing-planner-header">
        <div className="listing-planner-header-inner">
          <p className="listing-planner-eyebrow">Real estate tool</p>
          <h1 className="listing-planner-title">Home Tour &amp; Property Comparison Planner</h1>
          <p className="listing-planner-subtitle">
            Organize your tour observations, compare what you saw, and identify what questions still need answers.
            This tool does not recommend a property or rank homes — it helps you think through what you observed.
          </p>
        </div>
      </header>

      {!isReview && (
        <PlannerProgress
          step={stepMap[stage]}
          totalSteps={3}
          stepLabel={stepLabelMap[stage]}
        />
      )}

      <main className="listing-planner-main">
        {stage === 'priorities' && (
          <>
            <PrioritiesStage
              priorities={priorities}
              onChange={handlePrioritiesChange}
              showErrors={showErrors}
            />
            <div className="listing-planner-nav listing-planner-nav--single">
              <button
                type="button"
                className="listing-planner-btn listing-planner-btn--primary"
                onClick={handleNext}
              >
                Continue to Properties →
              </button>
            </div>
          </>
        )}

        {stage === 'properties' && (
          <>
            <PropertiesStage
              properties={properties}
              onChange={handlePropertiesChange}
              showErrors={showErrors}
            />
            <div className="listing-planner-nav">
              <button
                type="button"
                className="listing-planner-btn listing-planner-btn--secondary"
                onClick={handleBack}
              >
                ← Back
              </button>
              <button
                type="button"
                className="listing-planner-btn listing-planner-btn--primary"
                onClick={handleNext}
              >
                Continue to Observations →
              </button>
            </div>
          </>
        )}

        {stage === 'observations' && (
          <>
            <ObservationsStage
              priorities={priorities}
              properties={properties}
              observations={observations}
              onChange={updateObservation}
            />
            <div className="listing-planner-nav">
              <button
                type="button"
                className="listing-planner-btn listing-planner-btn--secondary"
                onClick={handleBack}
              >
                ← Back
              </button>
              <button
                type="button"
                className="listing-planner-btn listing-planner-btn--primary"
                onClick={handleNext}
              >
                Review comparison →
              </button>
            </div>
          </>
        )}

        {stage === 'review' && (
          <ComparisonResults
            priorities={priorities}
            properties={properties}
            observations={observations}
            onEdit={handleBack}
            onStartOver={handleStartOver}
          />
        )}
      </main>
    </div>
  )
}
