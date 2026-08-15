import type { ResultSection } from '../../core/types'

export function buildSummaryText(sections: ResultSection[], agentQuestions: string): string {
  const lines: string[] = [
    'SELLER READINESS PLANNER — Planning Summary',
    '='.repeat(44),
    '',
  ]
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
  if (agentQuestions.trim()) {
    lines.push('Your Written Questions')
    lines.push('-'.repeat(21))
    lines.push(agentQuestions.trim())
    lines.push('')
  }
  lines.push('='.repeat(44))
  lines.push('This planning summary is for informational and discussion purposes only.')
  lines.push('It does not constitute real estate, legal, financial, or tax advice.')
  return lines.join('\n')
}
