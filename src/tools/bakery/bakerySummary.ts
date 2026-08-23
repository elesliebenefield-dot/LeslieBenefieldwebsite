import type { BakeryAnswers } from './bakeryTypes'
import { PRODUCT_TYPE_LABELS, OCCASION_LABELS, RECIPIENT_LABELS, BUDGET_LABELS } from './bakeryTypes'

function formatDate(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(y, m - 1, day)
  return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function buildOrderBriefText(answers: BakeryAnswers): string {
  const name = answers.customerName.trim()
  const lines: string[] = [
    'ORDER REQUEST BRIEF',
    '='.repeat(40),
    '',
    'WHAT I\'M ORDERING',
    '-'.repeat(18),
  ]

  if (answers.productType) lines.push(`Product: ${PRODUCT_TYPE_LABELS[answers.productType]}`)
  if (answers.occasion)    lines.push(`Occasion: ${OCCASION_LABELS[answers.occasion]}`)
  if (answers.recipient)   lines.push(`For: ${RECIPIENT_LABELS[answers.recipient]}`)
  lines.push('')

  lines.push('PERSONALIZATION & DESIGN')
  lines.push('-'.repeat(24))

  if (answers.noInscription) {
    lines.push('Inscription: No inscription needed')
  } else if (answers.inscriptionText.trim()) {
    lines.push(`Inscription: "${answers.inscriptionText.trim()}"`)
  }

  if (answers.openToColorSuggestions && !answers.colors.trim()) {
    lines.push('Colors: Open to baker\'s suggestions')
  } else if (answers.colors.trim()) {
    const suffix = answers.openToColorSuggestions ? ' (open to baker\'s suggestions)' : ''
    lines.push(`Colors: ${answers.colors.trim()}${suffix}`)
  }

  if (answers.styleTheme.trim()) lines.push(`Style / theme: ${answers.styleTheme.trim()}`)
  if (answers.sizeQuantity.trim()) lines.push(`Size & quantity: ${answers.sizeQuantity.trim()}`)
  lines.push('')

  lines.push('TIMING & LOGISTICS')
  lines.push('-'.repeat(18))

  if (answers.neededByDate) lines.push(`Needed by: ${formatDate(answers.neededByDate)}`)
  if (answers.timingNote.trim()) lines.push(`Timing note: ${answers.timingNote.trim()}`)
  if (answers.budget && answers.budget !== 'prefer_not_say') {
    lines.push(`Budget: ${BUDGET_LABELS[answers.budget]}`)
  }
  if (answers.dietaryRestrictions.trim()) {
    lines.push(`Dietary / allergy notes: ${answers.dietaryRestrictions.trim()}`)
  }
  lines.push('')

  if (answers.questionsForBaker.trim()) {
    lines.push('QUESTIONS FOR THE BAKER')
    lines.push('-'.repeat(23))
    lines.push(answers.questionsForBaker.trim())
    lines.push('')
  }

  if (name) {
    lines.push(`Prepared by: ${name}`)
    lines.push('')
  }

  lines.push('='.repeat(40))

  if (answers.dietaryRestrictions.trim()) {
    lines.push('')
    lines.push('Note: Dietary and allergy information must be confirmed directly with the bakery.')
    lines.push('Completing this planner does not guarantee allergen-free preparation or accommodation.')
  }

  return lines.join('\n')
}

export function buildMailtoSubject(answers: BakeryAnswers): string {
  const product = answers.productType ? PRODUCT_TYPE_LABELS[answers.productType] : 'Custom order'
  const occasion = answers.occasion ? OCCASION_LABELS[answers.occasion] : ''
  return occasion
    ? `Custom Order Request – ${product} for ${occasion}`
    : `Custom Order Request – ${product}`
}

export { formatDate as formatBriefDate }
