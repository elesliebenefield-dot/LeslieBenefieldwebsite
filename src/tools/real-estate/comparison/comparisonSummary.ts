import type { Priority, Property, PropertyObservations } from './comparisonTypes'
import { MATCH_STATUS_LABELS, PROPERTY_TYPE_LABELS } from './comparisonTypes'

const HEADER = 'HOME TOUR & PROPERTY COMPARISON'

const DISCLAIMER = [
  'This comparison is for personal organization and discussion purposes only.',
  'Information and observations were entered by you and are not independently verified.',
  'Priority matches reflect your own assessment, not a professional evaluation.',
  '',
  'This tool does not recommend a property, rank homes, or select a winner.',
  'It does not provide real estate, legal, financial, tax, mortgage, appraisal,',
  'inspection, construction, insurance, or safety advice.',
  '',
  'Asking prices and expense figures are entered by you and may be incomplete or',
  'inaccurate. Verify material information with appropriate sources.',
  '',
  'This tool does not evaluate schools, crime, demographics, neighborhood quality,',
  'property value, or future appreciation. Consult appropriate licensed or qualified',
  'professionals before making decisions.',
  '',
  'Results are based solely on information you entered.',
].join('\n')

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

export function buildComparisonText(
  priorities: Priority[],
  properties: Property[],
  observations: Record<string, PropertyObservations>
): string {
  const lines: string[] = []

  lines.push(HEADER)
  lines.push('='.repeat(HEADER.length))
  lines.push('')

  // Properties list
  lines.push('Properties Being Compared:')
  properties.forEach((p, i) => {
    const parts = [`${i + 1}. ${p.nickname}`]
    if (p.address) parts.push(p.address)
    if (p.tourDate) parts.push(`Tour: ${formatDate(p.tourDate)}`)
    lines.push(`  ${parts.join(' | ')}`)
  })
  lines.push('')

  // Priorities list
  if (priorities.length > 0) {
    lines.push('Tour Priorities:')
    priorities.forEach((p, i) => lines.push(`  ${i + 1}. ${p.label}`))
    lines.push('')
  }

  // Priority comparison
  if (priorities.length > 0) {
    lines.push('PRIORITY COMPARISON')
    lines.push('-'.repeat(19))
    for (const priority of priorities) {
      lines.push(`${priority.label}:`)
      for (const prop of properties) {
        const obs = observations[prop.id]
        const match = obs?.priorityMatches[priority.id] ?? 'notEvaluated'
        lines.push(`  ${prop.nickname}: ${MATCH_STATUS_LABELS[match]}`)
      }
    }
    lines.push('')
  }

  // Basic facts
  const factRows: [string, (p: Property) => string][] = [
    ['Property type', p => p.propertyType ? (PROPERTY_TYPE_LABELS[p.propertyType as keyof typeof PROPERTY_TYPE_LABELS] ?? p.propertyType) : ''],
    ['Bedrooms', p => p.bedrooms],
    ['Bathrooms', p => p.bathrooms],
    ['Approx. sq ft', p => p.sqft],
    ['Year built', p => p.yearBuilt],
    ['Parking', p => p.parking],
    ['Asking price (entered by you)', p => p.askingPrice],
    ['Tour date', p => formatDate(p.tourDate)],
  ]

  const hasAnyFact = factRows.some(([, fn]) => properties.some(p => fn(p)))
  if (hasAnyFact) {
    lines.push('BASIC FACTS')
    lines.push('-'.repeat(11))
    for (const [label, fn] of factRows) {
      const values = properties.map(p => fn(p))
      if (values.some(v => v)) {
        const row = values.map((v, i) => `  ${properties[i].nickname}: ${v || '—'}`).join('\n')
        lines.push(`${label}:`)
        lines.push(row)
      }
    }
    lines.push('')
  }

  // Expenses
  const expenseRows: [string, (p: Property) => string][] = [
    ['Property taxes', p => p.propertyTaxes ? `${p.propertyTaxes}${periodLabel(p.propertyTaxesPeriod)}` : ''],
    ['HOA / association fee', p => p.hoaFee ? `${p.hoaFee}${periodLabel(p.hoaFeePeriod)}` : ''],
    ['Homeowners-insurance estimate', p => p.insuranceEstimate ? `${p.insuranceEstimate}${periodLabel(p.insurancePeriod)}` : ''],
    ['Other expense', p => {
      if (!p.otherExpense) return ''
      const label = p.otherExpenseLabel ? `${p.otherExpenseLabel}: ` : ''
      return `${label}${p.otherExpense}${periodLabel(p.otherExpensePeriod)}`
    }],
  ]

  const hasAnyExpense = expenseRows.some(([, fn]) => properties.some(p => fn(p)))
  if (hasAnyExpense) {
    lines.push('USER-ENTERED EXPENSES')
    lines.push('(Figures entered by you for comparison only. Not independently verified.)')
    lines.push('-'.repeat(21))
    for (const [label, fn] of expenseRows) {
      const values = properties.map(p => fn(p))
      if (values.some(v => v)) {
        lines.push(`${label}:`)
        lines.push(values.map((v, i) => `  ${properties[i].nickname}: ${v || '—'}`).join('\n'))
      }
    }
    lines.push('')
  }

  // Positive observations
  const hasPositives = properties.some(p => observations[p.id]?.positives)
  if (hasPositives) {
    lines.push('POSITIVE OBSERVATIONS')
    lines.push('-'.repeat(21))
    lines.push('(Your observations from the tour)')
    for (const prop of properties) {
      const obs = observations[prop.id]
      if (obs?.positives) {
        lines.push(`${prop.nickname}:`)
        lines.push(`  ${obs.positives}`)
      }
    }
    lines.push('')
  }

  // Concerns
  const hasConcerns = properties.some(p => observations[p.id]?.concerns)
  if (hasConcerns) {
    lines.push('CONCERNS NOTICED DURING TOUR')
    lines.push('-'.repeat(28))
    lines.push('(Your observations, not professional findings)')
    for (const prop of properties) {
      const obs = observations[prop.id]
      if (obs?.concerns) {
        lines.push(`${prop.nickname}:`)
        lines.push(`  ${obs.concerns}`)
      }
    }
    lines.push('')
  }

  // Detailed observation notes (only if filled)
  const obsNoteFields: [string, keyof PropertyObservations][] = [
    ['Layout and flow', 'layoutNotes'],
    ['Condition or maintenance', 'conditionNotes'],
    ['Natural light', 'lightNotes'],
    ['Storage', 'storageNotes'],
    ['Parking', 'parkingNotes'],
    ['Outdoor space', 'outdoorNotes'],
    ['Accessibility', 'accessibilityNotes'],
    ['Commute or travel', 'commuteNotes'],
    ['Noise observed', 'noiseNotes'],
    ['Follow-up notes', 'followUpNotes'],
  ]
  for (const [label, key] of obsNoteFields) {
    const hasNote = properties.some(p => observations[p.id]?.[key])
    if (hasNote) {
      lines.push(`${label.toUpperCase()}`)
      lines.push('-'.repeat(label.length))
      for (const prop of properties) {
        const val = observations[prop.id]?.[key] as string
        if (val) lines.push(`  ${prop.nickname}: ${val}`)
      }
      lines.push('')
    }
  }

  // Information still needed
  const infoNeededItems: string[] = []
  for (const prop of properties) {
    const obs = observations[prop.id]
    const unevaluated = priorities.filter(pr => {
      const status = obs?.priorityMatches[pr.id]
      return !status || status === 'notEvaluated'
    })
    if (obs?.infoNeeded) {
      infoNeededItems.push(`${prop.nickname} — Information needed: ${obs.infoNeeded}`)
    }
    if (unevaluated.length > 0) {
      unevaluated.forEach(pr => {
        infoNeededItems.push(`${prop.nickname} — Priority not yet evaluated: ${pr.label}`)
      })
    }
  }
  if (infoNeededItems.length > 0) {
    lines.push('INFORMATION STILL NEEDED')
    lines.push('-'.repeat(24))
    infoNeededItems.forEach(item => lines.push(`  • ${item}`))
    lines.push('')
  }

  // Questions and follow-up
  const hasQuestionsOrFollowUp = properties.some(p => {
    const obs = observations[p.id]
    return obs?.agentQuestions || obs?.professionalQuestions ||
      (obs?.followUpActions && obs.followUpActions.length > 0) ||
      (obs?.customFollowUps && obs.customFollowUps.length > 0)
  })
  if (hasQuestionsOrFollowUp) {
    lines.push('QUESTIONS & FOLLOW-UP ITEMS')
    lines.push('-'.repeat(27))
    for (const prop of properties) {
      const obs = observations[prop.id]
      if (!obs) continue
      const hasAny = obs.agentQuestions || obs.professionalQuestions ||
        obs.followUpActions.length > 0 || obs.customFollowUps.length > 0
      if (!hasAny) continue
      lines.push(`${prop.nickname}:`)
      if (obs.agentQuestions) lines.push(`  For agent: ${obs.agentQuestions}`)
      if (obs.professionalQuestions) lines.push(`  For inspector/professional: ${obs.professionalQuestions}`)
      obs.followUpActions.forEach(a => lines.push(`  Follow-up: ${a}`))
      obs.customFollowUps.forEach(a => lines.push(`  Follow-up: ${a}`))
    }
    lines.push('')
  }

  lines.push('─'.repeat(HEADER.length))
  lines.push(DISCLAIMER)

  return lines.join('\n')
}
