import type { PlumbingAnswers } from './plumbingTypes'
import {
  CONCERN_LABELS,
  ACTIVE_WATER_LABELS,
  HOME_AREA_LABELS,
  TIMELINE_LABELS,
  CHANGE_LABELS,
  HISTORY_LABELS,
  WATER_ELSEWHERE_LABELS,
  PROPERTY_LABELS,
  ACCESS_LABELS,
  RECENT_WORK_LABELS,
  TIMING_LABELS,
  type ConcernType,
  type ActiveWaterStatus,
  type HomeArea,
  type TimelineAnswer,
  type ChangeAnswer,
  type HistoryAnswer,
  type WaterElsewhereAnswer,
  type PropertyType,
  type AccessAnswer,
  type RecentWorkAnswer,
  type TimingAnswer,
} from './plumbingTypes'

function label<T extends string>(map: Record<Exclude<T, ''>, string>, value: T): string {
  return value ? (map as Record<string, string>)[value] ?? '' : ''
}

export function buildVisitBriefText(answers: PlumbingAnswers): string {
  const lines: string[] = []
  const SEP = '='.repeat(42)
  const sec = '-'.repeat(42)

  lines.push('PLUMBING SERVICE VISIT BRIEF')
  lines.push(SEP)
  lines.push('Prepared for: Your Plumbing Company')
  if (answers.customerName.trim()) {
    lines.push(`Prepared by: ${answers.customerName.trim()}`)
  }
  lines.push(`Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`)
  lines.push('')

  lines.push('THE CONCERN')
  lines.push(sec)
  if (answers.concernType) {
    lines.push(`Type of concern:           ${label<ConcernType>(CONCERN_LABELS, answers.concernType)}`)
  }
  if (answers.observations.trim()) {
    lines.push(`What I observed:           ${answers.observations.trim()}`)
  }
  if (answers.activeWater) {
    lines.push(`Active water present:      ${label<ActiveWaterStatus>(ACTIVE_WATER_LABELS, answers.activeWater)}`)
  }
  if (answers.activeWater === 'flowing_spreading') {
    lines.push('⚠ Active water noted:     Water was actively flowing or spreading at the time this brief was prepared.')
  }
  lines.push('')

  lines.push('LOCATION & HISTORY')
  lines.push(sec)
  if (answers.homeArea) {
    lines.push(`Area of home:              ${label<HomeArea>(HOME_AREA_LABELS, answers.homeArea)}`)
  }
  if (answers.fixture.trim()) {
    lines.push(`Fixture or area:           ${answers.fixture.trim()}`)
  }
  if (answers.firstNoticed) {
    lines.push(`First noticed:             ${label<TimelineAnswer>(TIMELINE_LABELS, answers.firstNoticed)}`)
  }
  if (answers.changeAnswer) {
    lines.push(`Change since then:         ${label<ChangeAnswer>(CHANGE_LABELS, answers.changeAnswer)}`)
  }
  if (answers.history) {
    lines.push(`Previous occurrence:       ${label<HistoryAnswer>(HISTORY_LABELS, answers.history)}`)
  }
  if (answers.waterElsewhere) {
    lines.push(`Water available elsewhere: ${label<WaterElsewhereAnswer>(WATER_ELSEWHERE_LABELS, answers.waterElsewhere)}`)
  }
  lines.push('')

  lines.push('PROPERTY & ACCESS')
  lines.push(sec)
  if (answers.propertyType) {
    lines.push(`Property type:             ${label<PropertyType>(PROPERTY_LABELS, answers.propertyType)}`)
  }
  if (answers.accessAnswer) {
    lines.push(`Access:                    ${label<AccessAnswer>(ACCESS_LABELS, answers.accessAnswer)}`)
  }
  if (answers.accessNotes.trim()) {
    lines.push(`Access notes:              ${answers.accessNotes.trim()}`)
  }
  if (answers.recentWork) {
    const baseLabel = label<RecentWorkAnswer>(RECENT_WORK_LABELS, answers.recentWork)
    const detail = answers.recentWork === 'yes' && answers.recentWorkDetail.trim()
      ? ` — ${answers.recentWorkDetail.trim()}`
      : ''
    lines.push(`Recent plumbing work:      ${baseLabel}${detail}`)
  }
  lines.push('')

  const hasVisitSection = answers.timing || answers.questions.trim()
  if (hasVisitSection) {
    lines.push('THE VISIT')
    lines.push(sec)
    if (answers.timing) {
      lines.push(`Preferred timing:          ${label<TimingAnswer>(TIMING_LABELS, answers.timing)}`)
    }
    if (answers.questions.trim()) {
      lines.push('Questions for the plumber:')
      lines.push(`  ${answers.questions.trim()}`)
    }
    lines.push('')
  }

  lines.push('—')
  lines.push('This brief summarizes what I\'ve observed. It is not a diagnosis, estimate, or confirmed service request.')

  return lines.join('\n')
}

export function buildMailtoSubject(answers: PlumbingAnswers): string {
  const concern = answers.concernType
    ? CONCERN_LABELS[answers.concernType as Exclude<ConcernType, ''>]
    : 'plumbing concern'
  return `Plumbing Service Visit Brief – ${concern}`
}
