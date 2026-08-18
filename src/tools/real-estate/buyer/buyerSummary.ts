import type { ResultSection } from '../../core/types'
import type { BuyerAnswers } from './buyerTypes'
import { buildBuyerAnswerRecap } from './buyerLabels.ts'

export function buildBuyerSummaryText(sections: ResultSection[], answers: BuyerAnswers): string {
  const lines: string[] = [
    'BUYER READINESS PLANNER — Planning Summary',
    '='.repeat(43),
    '',
  ]

  const recap = buildBuyerAnswerRecap(answers)
  if (recap.length > 0) {
    const heading = 'Your Answers at a Glance'
    lines.push(heading)
    lines.push('-'.repeat(heading.length))
    for (const row of recap) {
      lines.push(`${row.field}: ${row.value}`)
    }
    lines.push('')
  }

  for (const section of sections) {
    lines.push(section.title)
    lines.push('-'.repeat(section.title.length))
    for (const item of section.items) {
      lines.push(`• ${item.label}`)
      if (item.detail) {
        lines.push(`  ${item.detail}`)
      }
    }
    lines.push('')
  }
  lines.push('='.repeat(43))
  lines.push('This planning summary is for informational and discussion purposes only.')
  lines.push('It does not constitute real estate, legal, financial, or tax advice.')
  return lines.join('\n')
}
