interface PlannerProgressProps {
  step: number
  totalSteps: number
  stepLabel: string
}

export function PlannerProgress({ step, totalSteps, stepLabel }: PlannerProgressProps) {
  const pct = Math.round((step / totalSteps) * 100)
  return (
    <div className="tool-progress" role="status" aria-label={`Step ${step} of ${totalSteps}: ${stepLabel}`}>
      <div className="tool-progress-meta">
        <span className="tool-progress-label">{stepLabel}</span>
        <span className="tool-progress-count">{step} of {totalSteps}</span>
      </div>
      <div className="tool-progress-track" aria-hidden="true">
        <div className="tool-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
