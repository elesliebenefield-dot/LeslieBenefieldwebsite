import type { ListingPlanSetup, PlanTask } from './listingTypes.ts'
import {
  PLANNING_PERIOD_ORDER,
  PLANNING_PERIOD_LABELS,
  STATUS_LABELS,
  RESPONSIBILITY_LABELS,
} from './listingTypes.ts'

function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

const HEADER = 'LISTING PREPARATION ACTION PLAN'

const DISCLAIMER = [
  'This action plan is for organizational and planning purposes only. It does not',
  'constitute real estate, legal, financial, tax, inspection, construction, or',
  'contractor advice. Tasks are customizable and not automatically required.',
  '',
  'Consult your real estate professional before spending money or beginning any',
  'projects. Target dates are user-entered planning dates, not contractual deadlines.',
  'This tool does not estimate costs, home value, repair requirements, or return on',
  'investment. Results are based solely on information you entered.',
  '',
  'Consult appropriate licensed or qualified professionals when needed.',
].join('\n')

export function buildActionPlanText(setup: ListingPlanSetup, tasks: PlanTask[]): string {
  const lines: string[] = []

  lines.push(HEADER)
  lines.push('='.repeat(HEADER.length))
  lines.push('')

  if (setup.planName) {
    lines.push(`Plan: ${setup.planName}`)
    lines.push('')
  }

  const dateLines = [
    setup.photographyDate ? `Photography: ${formatDate(setup.photographyDate)}` : '',
    setup.listingDate ? `Listing: ${formatDate(setup.listingDate)}` : '',
    setup.showingDate ? `First showing or open house: ${formatDate(setup.showingDate)}` : '',
  ].filter(Boolean)

  if (dateLines.length > 0) {
    lines.push('Target Dates (planning purposes only, not contractual deadlines):')
    dateLines.forEach(d => lines.push(`  ${d}`))
    lines.push('')
  }

  const total = tasks.length
  const complete = tasks.filter(t => t.status === 'complete').length
  const inProgress = tasks.filter(t => t.status === 'inProgress').length
  const waiting = tasks.filter(t => t.status === 'waiting').length
  const notStarted = tasks.filter(t => t.status === 'notStarted').length

  lines.push('Progress Overview:')
  lines.push(`  Total tasks: ${total}`)
  if (complete > 0) lines.push(`  Complete: ${complete}`)
  if (inProgress > 0) lines.push(`  In progress: ${inProgress}`)
  if (waiting > 0) lines.push(`  Waiting on someone: ${waiting}`)
  if (notStarted > 0) lines.push(`  Not started: ${notStarted}`)
  lines.push('')

  for (const period of PLANNING_PERIOD_ORDER) {
    const periodTasks = tasks.filter(t => t.planningPeriod === period)
    if (periodTasks.length === 0) continue

    lines.push(PLANNING_PERIOD_LABELS[period].toUpperCase())
    lines.push('-'.repeat(PLANNING_PERIOD_LABELS[period].length))

    for (const task of periodTasks) {
      const statusMark = task.status === 'complete' ? '[✓]' : '[ ]'
      lines.push(`${statusMark} ${task.title}`)
      lines.push(`    Status: ${STATUS_LABELS[task.status]}`)
      if (task.responsibility !== 'unassigned') {
        lines.push(`    Responsible: ${RESPONSIBILITY_LABELS[task.responsibility]}`)
      }
      if (task.targetDate) {
        lines.push(`    Target date: ${formatDate(task.targetDate)}`)
      }
      if (task.needsAgentInput) {
        lines.push('    * Discuss with agent before proceeding')
      }
      if (task.notes) {
        lines.push(`    Notes: ${task.notes}`)
      }
    }
    lines.push('')
  }

  const agentTasks = tasks.filter(t => t.needsAgentInput)
  if (agentTasks.length > 0) {
    lines.push('TASKS NEEDING AGENT INPUT')
    lines.push('-'.repeat(25))
    agentTasks.forEach(t => lines.push(`  • ${t.title}`))
    lines.push('')
  }

  const unassigned = tasks.filter(t => t.responsibility === 'unassigned')
  if (unassigned.length > 0) {
    lines.push('UNASSIGNED TASKS')
    lines.push('-'.repeat(16))
    unassigned.forEach(t => lines.push(`  • ${t.title}`))
    lines.push('')
  }

  const waitingTasks = tasks.filter(t => t.status === 'waiting')
  if (waitingTasks.length > 0) {
    lines.push('WAITING ON SOMEONE')
    lines.push('-'.repeat(18))
    waitingTasks.forEach(t => lines.push(`  • ${t.title}`))
    lines.push('')
  }

  if (setup.planNotes) {
    lines.push('PLAN NOTES')
    lines.push('-'.repeat(10))
    lines.push(setup.planNotes)
    lines.push('')
  }

  lines.push('─'.repeat(HEADER.length))
  lines.push(DISCLAIMER)

  return lines.join('\n')
}
