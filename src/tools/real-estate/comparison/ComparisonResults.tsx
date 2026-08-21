import { useState } from 'react'
import type { Priority, Property, PropertyObservations } from './comparisonTypes'
import {
  MATCH_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from './comparisonTypes'
import { buildComparisonText } from './comparisonSummary'

interface Props {
  priorities: Priority[]
  properties: Property[]
  observations: Record<string, PropertyObservations>
  onEdit: () => void
  onStartOver: () => void
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

function periodLabel(period: string): string {
  if (period === 'monthly') return '/mo'
  if (period === 'annual') return '/yr'
  return ''
}

function matchClass(status: string): string {
  const map: Record<string, string> = {
    meets: 'cmp-match--meets',
    partlyMeets: 'cmp-match--partly',
    doesNotMeet: 'cmp-match--no',
    notSure: 'cmp-match--unsure',
    notEvaluated: 'cmp-match--na',
  }
  return map[status] ?? 'cmp-match--na'
}

interface GridSectionProps {
  priorities: Priority[]
  properties: Property[]
  observations: Record<string, PropertyObservations>
}

function PriorityGrid({ priorities, properties, observations }: GridSectionProps) {
  if (priorities.length === 0) return null
  const propCount = properties.length
  return (
    <section className="cmp-results-section">
      <h2 className="cmp-results-heading">Priority comparison</h2>
      <div
        className={`cmp-comparison-grid cmp-comparison-grid--${propCount}`}
        style={{ '--cmp-prop-count': propCount } as React.CSSProperties}
      >
        {/* Header row */}
        <div className="cmp-grid-corner" aria-hidden="true" />
        {properties.map(prop => (
          <div key={prop.id} className="cmp-grid-prop-header">
            <span className="cmp-grid-prop-name">{prop.nickname}</span>
            {prop.address && <span className="cmp-grid-prop-address">{prop.address}</span>}
          </div>
        ))}

        {/* Data rows */}
        {priorities.map(priority => (
          <div key={priority.id} className="cmp-grid-row" role="row">
            <div className="cmp-grid-criterion" role="rowheader">{priority.label}</div>
            {properties.map(prop => {
              const obs = observations[prop.id]
              const status = obs?.priorityMatches[priority.id] ?? 'notEvaluated'
              const label = MATCH_STATUS_LABELS[status]
              return (
                <div
                  key={prop.id}
                  className={`cmp-grid-cell ${matchClass(status)}`}
                  role="cell"
                  data-prop-name={prop.nickname}
                  aria-label={`${prop.nickname}: ${label}`}
                >
                  <span className="cmp-match-label">{label}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

function BasicFactsSection({ properties }: { properties: Property[] }) {
  const rows: [string, (p: Property) => string][] = [
    ['Property type', p => p.propertyType ? (PROPERTY_TYPE_LABELS[p.propertyType as keyof typeof PROPERTY_TYPE_LABELS] ?? p.propertyType) : ''],
    ['Bedrooms', p => p.bedrooms],
    ['Bathrooms', p => p.bathrooms],
    ['Approx. sq ft', p => p.sqft],
    ['Year built', p => p.yearBuilt],
    ['Parking', p => p.parking],
    ['Asking price', p => p.askingPrice],
    ['Tour date', p => formatDate(p.tourDate)],
  ]
  const activeRows = rows.filter(([, fn]) => properties.some(p => fn(p)))
  if (activeRows.length === 0) return null

  return (
    <section className="cmp-results-section">
      <h2 className="cmp-results-heading">Basic facts</h2>
      <p className="cmp-disclaimer-note">Asking price and other figures were entered by you and have not been verified.</p>
      <div className="cmp-facts-table">
        <div className="cmp-facts-header-row">
          <div className="cmp-facts-label-cell" aria-hidden="true" />
          {properties.map(p => (
            <div key={p.id} className="cmp-facts-prop-cell cmp-facts-prop-header">{p.nickname}</div>
          ))}
        </div>
        {activeRows.map(([label, fn]) => (
          <div key={label} className="cmp-facts-row">
            <div className="cmp-facts-label-cell">{label}</div>
            {properties.map(p => (
              <div key={p.id} className="cmp-facts-prop-cell" data-prop-name={p.nickname}>
                {fn(p) || <span className="cmp-em-dash">—</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function ExpensesSection({ properties }: { properties: Property[] }) {
  const rows: [string, (p: Property) => string][] = [
    ['Property taxes', p => p.propertyTaxes ? `${p.propertyTaxes}${periodLabel(p.propertyTaxesPeriod)}` : ''],
    ['HOA / association fee', p => p.hoaFee ? `${p.hoaFee}${periodLabel(p.hoaFeePeriod)}` : ''],
    ['Homeowners insurance (est.)', p => p.insuranceEstimate ? `${p.insuranceEstimate}${periodLabel(p.insurancePeriod)}` : ''],
    ['Other', p => p.otherExpense ? `${p.otherExpenseLabel ? p.otherExpenseLabel + ': ' : ''}${p.otherExpense}${periodLabel(p.otherExpensePeriod)}` : ''],
  ]
  const activeRows = rows.filter(([, fn]) => properties.some(p => fn(p)))
  if (activeRows.length === 0) return null

  return (
    <section className="cmp-results-section">
      <h2 className="cmp-results-heading">User-entered expenses</h2>
      <p className="cmp-disclaimer-note">Figures entered by you for comparison only. Not independently verified.</p>
      <div className="cmp-facts-table">
        <div className="cmp-facts-header-row">
          <div className="cmp-facts-label-cell" aria-hidden="true" />
          {properties.map(p => (
            <div key={p.id} className="cmp-facts-prop-cell cmp-facts-prop-header">{p.nickname}</div>
          ))}
        </div>
        {activeRows.map(([label, fn]) => (
          <div key={label} className="cmp-facts-row">
            <div className="cmp-facts-label-cell">{label}</div>
            {properties.map(p => (
              <div key={p.id} className="cmp-facts-prop-cell" data-prop-name={p.nickname}>
                {fn(p) || <span className="cmp-em-dash">—</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function ObservationNotesSection({ properties, observations }: { properties: Property[]; observations: Record<string, PropertyObservations> }) {
  const hasPositives = properties.some(p => observations[p.id]?.positives)
  const hasConcerns = properties.some(p => observations[p.id]?.concerns)

  const noteFields: [string, keyof PropertyObservations][] = [
    ['Layout and flow', 'layoutNotes'],
    ['Condition and maintenance', 'conditionNotes'],
    ['Natural light', 'lightNotes'],
    ['Storage', 'storageNotes'],
    ['Parking', 'parkingNotes'],
    ['Outdoor space', 'outdoorNotes'],
    ['Accessibility', 'accessibilityNotes'],
    ['Commute and travel', 'commuteNotes'],
    ['Noise noticed', 'noiseNotes'],
  ]
  const activeNoteFields = noteFields.filter(([, key]) => properties.some(p => observations[p.id]?.[key]))

  if (!hasPositives && !hasConcerns && activeNoteFields.length === 0) return null

  return (
    <section className="cmp-results-section">
      <h2 className="cmp-results-heading">Tour observations</h2>
      <p className="cmp-disclaimer-note">Your personal observations from the tour. Not a professional evaluation.</p>

      {hasPositives && (
        <div className="cmp-obs-results-block">
          <h3 className="cmp-obs-results-subheading">What stood out positively</h3>
          {properties.map(p => {
            const val = observations[p.id]?.positives
            if (!val) return null
            return (
              <div key={p.id} className="cmp-obs-results-item">
                <strong className="cmp-obs-prop-label">{p.nickname}</strong>
                <p className="cmp-obs-text">{val}</p>
              </div>
            )
          })}
        </div>
      )}

      {hasConcerns && (
        <div className="cmp-obs-results-block">
          <h3 className="cmp-obs-results-subheading">What gave you pause</h3>
          {properties.map(p => {
            const val = observations[p.id]?.concerns
            if (!val) return null
            return (
              <div key={p.id} className="cmp-obs-results-item">
                <strong className="cmp-obs-prop-label">{p.nickname}</strong>
                <p className="cmp-obs-text">{val}</p>
              </div>
            )
          })}
        </div>
      )}

      {activeNoteFields.map(([label, key]) => (
        <div key={key} className="cmp-obs-results-block">
          <h3 className="cmp-obs-results-subheading">{label}</h3>
          {properties.map(p => {
            const val = observations[p.id]?.[key] as string
            if (!val) return null
            return (
              <div key={p.id} className="cmp-obs-results-item">
                <strong className="cmp-obs-prop-label">{p.nickname}</strong>
                <p className="cmp-obs-text">{val}</p>
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}

function MissingInfoSection({ priorities, properties, observations }: GridSectionProps) {
  const items: { propName: string; text: string }[] = []

  for (const prop of properties) {
    const obs = observations[prop.id]
    const unevaluated = priorities.filter(pr => {
      const status = obs?.priorityMatches[pr.id]
      return !status || status === 'notEvaluated'
    })
    unevaluated.forEach(pr => {
      items.push({ propName: prop.nickname, text: `Priority not yet evaluated: ${pr.label}` })
    })
    if (obs?.infoNeeded) {
      items.push({ propName: prop.nickname, text: `Information needed: ${obs.infoNeeded}` })
    }
  }

  if (items.length === 0) return null

  return (
    <section className="cmp-results-section">
      <h2 className="cmp-results-heading">Information still needed</h2>
      <ul className="cmp-missing-list">
        {items.map((item, idx) => (
          <li key={idx} className="cmp-missing-item">
            <strong>{item.propName}:</strong> {item.text}
          </li>
        ))}
      </ul>
    </section>
  )
}

function QuestionsSection({ properties, observations }: { properties: Property[]; observations: Record<string, PropertyObservations> }) {
  const hasAny = properties.some(p => {
    const obs = observations[p.id]
    return obs?.agentQuestions || obs?.professionalQuestions ||
      (obs?.followUpActions?.length ?? 0) > 0 ||
      (obs?.customFollowUps?.length ?? 0) > 0 ||
      obs?.followUpNotes
  })
  if (!hasAny) return null

  return (
    <section className="cmp-results-section">
      <h2 className="cmp-results-heading">Questions and follow-up items</h2>
      {properties.map(prop => {
        const obs = observations[prop.id]
        if (!obs) return null
        const hasAnyProp = obs.agentQuestions || obs.professionalQuestions ||
          obs.followUpActions.length > 0 || obs.customFollowUps.length > 0 || obs.followUpNotes
        if (!hasAnyProp) return null
        return (
          <div key={prop.id} className="cmp-questions-block">
            <h3 className="cmp-questions-prop-heading">{prop.nickname}</h3>
            {obs.agentQuestions && (
              <div className="cmp-questions-item">
                <strong>For the listing agent:</strong>
                <p>{obs.agentQuestions}</p>
              </div>
            )}
            {obs.professionalQuestions && (
              <div className="cmp-questions-item">
                <strong>For an inspector or professional:</strong>
                <p>{obs.professionalQuestions}</p>
              </div>
            )}
            {(obs.followUpActions.length > 0 || obs.customFollowUps.length > 0) && (
              <div className="cmp-questions-item">
                <strong>Follow-up actions:</strong>
                <ul className="cmp-followup-result-list">
                  {obs.followUpActions.map(a => <li key={a}>{a}</li>)}
                  {obs.customFollowUps.map((a, i) => <li key={`c-${i}`}>{a}</li>)}
                </ul>
              </div>
            )}
            {obs.followUpNotes && (
              <div className="cmp-questions-item">
                <strong>Additional follow-up notes:</strong>
                <p>{obs.followUpNotes}</p>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

const DISCLAIMER_TEXT = [
  'This comparison is for personal organization and discussion purposes only.',
  'Information and observations were entered by you and are not independently verified.',
  'Priority matches reflect your own assessment, not a professional evaluation.',
  'This tool does not recommend a property, rank homes, or select a winner.',
  'It does not provide real estate, legal, financial, tax, mortgage, appraisal, inspection, construction, insurance, or safety advice.',
  'Asking prices and expense figures entered by you may be incomplete or inaccurate — verify with appropriate sources.',
  'This tool does not evaluate schools, crime, demographics, neighborhood quality, property value, or future appreciation.',
  'Consult appropriate licensed or qualified professionals before making decisions.',
  'Results are based solely on information you entered.',
]

export function ComparisonResults({ priorities, properties, observations, onEdit, onStartOver }: Props) {
  const [copyDone, setCopyDone] = useState(false)
  const [shareUnavailable, setShareUnavailable] = useState(false)
  const [startOverConfirm, setStartOverConfirm] = useState(false)

  const summaryText = buildComparisonText(priorities, properties, observations)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summaryText)
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2500)
    } catch {
      // fallback
    }
  }

  async function handleShare() {
    if (!navigator.share) { setShareUnavailable(true); return }
    try {
      await navigator.share({ title: 'Home Tour & Property Comparison', text: summaryText })
    } catch {
      // cancelled
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="cmp-results-root">
      {shareUnavailable && (
        <p className="cmp-share-note" role="alert">
          Sharing is not available in this browser. Use Copy or Print instead.
        </p>
      )}

      {/* Comparison content */}
      <div className="cmp-results-body">
        <header className="cmp-results-header">
          <h1 className="cmp-results-title">Home Tour &amp; Property Comparison</h1>
          <p className="cmp-results-subtitle">
            {properties.length} {properties.length === 1 ? 'property' : 'properties'} ·{' '}
            {priorities.length} {priorities.length === 1 ? 'priority' : 'priorities'}
          </p>
        </header>

        <PriorityGrid priorities={priorities} properties={properties} observations={observations} />
        <BasicFactsSection properties={properties} />
        <ExpensesSection properties={properties} />
        <ObservationNotesSection properties={properties} observations={observations} />
        <MissingInfoSection priorities={priorities} properties={properties} observations={observations} />
        <QuestionsSection properties={properties} observations={observations} />
      </div>

      {/* Disclaimer — comes before the action bar */}
      <section className="cmp-results-section cmp-disclaimer-section" aria-label="Disclaimer">
        <h2 className="cmp-results-heading cmp-disclaimer-heading">About this comparison</h2>
        <ul className="cmp-disclaimer-list">
          {DISCLAIMER_TEXT.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      </section>

      {/* Single action bar — after disclaimer, before CTA */}
      <div className="cmp-action-bar" aria-label="Result actions">
        <div className="cmp-action-bar-left">
          <button type="button" className="tool-action-btn" onClick={handleCopy}>
            {copyDone ? 'Copied!' : 'Copy text'}
          </button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button type="button" className="tool-action-btn" onClick={handleShare}>Share</button>
          )}
          <button type="button" className="tool-action-btn" onClick={handlePrint}>Print</button>
          <button type="button" className="tool-action-btn" onClick={onEdit}>
            Edit responses
          </button>
        </div>
        {!startOverConfirm ? (
          <button
            type="button"
            className="tool-action-btn"
            onClick={() => setStartOverConfirm(true)}
          >
            Start over
          </button>
        ) : (
          <div className="cmp-start-over-confirm" role="alert">
            <span>Start over and clear all responses?</span>
            <button type="button" className="cmp-action-btn cmp-action-btn--danger" onClick={onStartOver}>Yes, start over</button>
            <button type="button" className="tool-action-btn" onClick={() => setStartOverConfirm(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* CTA — after action bar */}
      <section className="cmp-results-section cmp-cta-section">
        <h2 className="cmp-results-heading">Ready to take the next step?</h2>
        <p>
          A real estate professional can help you evaluate what you've observed, clarify listing details,
          and guide you through what comes next.
        </p>
        <a
          href="/contact"
          className="cmp-cta-btn"
          target="_blank"
          rel="noopener noreferrer"
        >
          Connect with a professional
        </a>
      </section>
    </div>
  )
}
