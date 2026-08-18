import type { ResultSection } from '../../core/types'
import type { SellerAnswers } from './sellerTypes'
import { buildSellerAnswerRecap } from './sellerLabels.ts'

export function buildSummaryText(sections: ResultSection[], answers: SellerAnswers): string {
  const lines: string[] = [
    'SELLER READINESS PLANNER — Planning Summary',
    '='.repeat(44),
    '',
  ]

  const recap = buildSellerAnswerRecap(answers)
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
  lines.push('='.repeat(44))
  lines.push('This planning summary is for informational and discussion purposes only.')
  lines.push('It does not constitute real estate, legal, financial, or tax advice.')
  return lines.join('\n')
}
