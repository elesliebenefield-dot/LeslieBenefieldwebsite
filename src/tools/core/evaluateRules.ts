import type { Rule, ResultSection, ResultItem } from './types'

export function evaluateRules<TAnswers>(
  rules: Rule<TAnswers>[],
  answers: TAnswers,
  sectionOrder: string[],
  sectionTitles: Record<string, string>,
): ResultSection[] {
  const itemsBySection = new Map<string, ResultItem[]>()

  for (const rule of rules) {
    if (rule.condition(answers)) {
      const existing = itemsBySection.get(rule.sectionId) ?? []
      existing.push(rule.item)
      itemsBySection.set(rule.sectionId, existing)
    }
  }

  return sectionOrder
    .filter(id => itemsBySection.has(id))
    .map(id => ({
      id,
      title: sectionTitles[id],
      items: itemsBySection.get(id)!,
    }))
}
