import type { TransitionSetup, ClosingTask } from './closingTypes'
import {
  TRANSITION_TYPE_LABELS,
  INVOLVED_PARTY_LABELS,
  MOVING_METHOD_LABELS,
  TASK_TRACK_LABELS,
  PLANNING_PERIOD_LABELS,
  TASK_STATUS_LABELS,
  PROFESSIONAL_TYPE_LABELS,
  PLANNING_PERIOD_ORDER,
} from './closingTypes'

function line(label: string, value: string | undefined): string {
  return value?.trim() ? `${label}: ${value.trim()}` : ''
}

function section(title: string, lines: string[]): string {
  const body = lines.filter(Boolean).join('\n')
  return body ? `\n${title}\n${'─'.repeat(title.length)}\n${body}` : ''
}

function formatDate(d: string): string {
  if (!d) return ''
  const parts = d.split('-').map(Number)
  if (parts.length !== 3) return d
  const dt = new Date(parts[0], parts[1] - 1, parts[2])
  return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function buildClosingSummary(
  setup: TransitionSetup,
  tasks: ClosingTask[],
): string {
  const parts: string[] = ['CLOSING & MOVING ORGANIZER', '==========================']

  // ── Transition overview ──
  const overviewLines = [
    line('Transition', setup.transitionType ? TRANSITION_TYPE_LABELS[setup.transitionType] : ''),
    line('Plan name', setup.planName),
    line('Leaving', setup.leavingPropertyLabel),
    line('Arriving', setup.arrivingPropertyLabel),
    setup.involvedParties.length
      ? `Involved: ${setup.involvedParties.map(p => INVOLVED_PARTY_LABELS[p]).join(', ')}`
      : '',
    line('Moving method', setup.movingMethod ? MOVING_METHOD_LABELS[setup.movingMethod] : ''),
    line('Notes', setup.notes),
  ]
  parts.push(section('TRANSITION OVERVIEW', overviewLines))

  // ── Planning dates ──
  const { dates } = setup
  const dateLines = [
    dates.closingSigning ? `Closing or signing: ${formatDate(dates.closingSigning)} [planning date]` : '',
    dates.possessionHandoff ? `Possession or key handoff: ${formatDate(dates.possessionHandoff)} [planning date]` : '',
    dates.moveOut ? `Move-out: ${formatDate(dates.moveOut)} [planning date]` : '',
    dates.moveIn ? `Move-in: ${formatDate(dates.moveIn)} [planning date]` : '',
    dates.leaseEnd ? `Lease end: ${formatDate(dates.leaseEnd)} [planning date]` : '',
  ]
  parts.push(section('PLANNING DATES (user-entered, not verified)', dateLines))

  // ── Tasks by planning period ──
  const regularTasks = tasks.filter(t => !t.isQuestion)
  const questionTasks = tasks.filter(t => t.isQuestion)

  for (const period of PLANNING_PERIOD_ORDER) {
    const periodTasks = regularTasks.filter(t => t.period === period)
    if (periodTasks.length === 0) continue

    const taskLines = periodTasks.map(t => {
      const lines: string[] = [`- ${t.label}`]
      lines.push(`  Track: ${TASK_TRACK_LABELS[t.track]}`)
      if (t.responsible) lines.push(`  Responsible: ${t.responsible}`)
      if (t.targetDate) lines.push(`  Target date: ${formatDate(t.targetDate)} [planning date]`)
      lines.push(`  Status: ${TASK_STATUS_LABELS[t.status]}`)
      if (t.waitingOn) lines.push(`  Waiting on: ${t.waitingOn}`)
      if (t.notes) lines.push(`  Notes: ${t.notes}`)
      if (t.needsProfessionalConfirmation) lines.push('  Needs professional confirmation')
      return lines.join('\n')
    })

    parts.push(section(PLANNING_PERIOD_LABELS[period].toUpperCase(), taskLines))
  }

  // ── Questions for professionals ──
  if (questionTasks.length > 0) {
    const grouped = new Map<string, ClosingTask[]>()
    for (const q of questionTasks) {
      const key = q.questionFor || 'other_professional'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(q)
    }
    const qLines: string[] = []
    grouped.forEach((qs, prof) => {
      const label = PROFESSIONAL_TYPE_LABELS[prof as keyof typeof PROFESSIONAL_TYPE_LABELS] || prof
      qLines.push(`${label}:`)
      qs.forEach(q => {
        qLines.push(`  - ${q.label}`)
        if (q.notes) qLines.push(`    Notes: ${q.notes}`)
      })
    })
    parts.push(section('QUESTIONS FOR PROFESSIONALS', qLines))
  }

  // ── Status summary ──
  const total = tasks.length
  const byStatus = {
    complete: tasks.filter(t => t.status === 'complete').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    waiting: tasks.filter(t => t.status === 'waiting').length,
    not_started: tasks.filter(t => t.status === 'not_started').length,
    not_applicable: tasks.filter(t => t.status === 'not_applicable').length,
  }
  const summaryLines = [
    `Total tasks: ${total}`,
    byStatus.complete > 0 ? `Complete: ${byStatus.complete}` : '',
    byStatus.in_progress > 0 ? `In progress: ${byStatus.in_progress}` : '',
    byStatus.waiting > 0 ? `Waiting: ${byStatus.waiting}` : '',
    byStatus.not_started > 0 ? `Not started: ${byStatus.not_started}` : '',
    byStatus.not_applicable > 0 ? `Not applicable: ${byStatus.not_applicable}` : '',
  ]
  parts.push(section('PROGRESS SUMMARY', summaryLines))

  // ── Disclaimer ──
  parts.push('\n────────────────────────────────────────────────────────────────\nThis plan is for personal organization only. Tasks and dates are user-entered and customizable.\nNothing in this plan has been saved, stored, or transmitted. Contractual obligations and\ndeadlines must be confirmed with the appropriate professional. This tool does not provide\nlegal, financial, tax, insurance, inspection, title, escrow, moving, or real-estate advice,\nand does not calculate costs, proceeds, value, or transaction readiness.\n────────────────────────────────────────────────────────────────')

  return parts.filter(Boolean).join('\n')
}
