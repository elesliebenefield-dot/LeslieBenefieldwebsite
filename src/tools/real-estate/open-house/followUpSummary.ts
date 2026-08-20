import type { EventSetup, EventOutcomes, FollowUpAction } from './openHouseTypes'
import {
  ATTENDANCE_LABELS,
  VISITOR_CONTEXT_LABELS,
  PERMISSION_LABELS,
  CONTACT_METHOD_LABELS,
  ACTION_CATEGORY_LABELS,
  ACTION_TIMING_LABELS,
  ACTION_STATUS_LABELS,
} from './openHouseTypes'

function line(label: string, value: string | undefined): string {
  return value?.trim() ? `${label}: ${value.trim()}` : ''
}

function section(title: string, lines: string[]): string {
  const body = lines.filter(Boolean).join('\n')
  return body ? `\n${title}\n${'─'.repeat(title.length)}\n${body}` : ''
}

function formatTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(d: string): string {
  if (!d) return ''
  const parts = d.split('-').map(Number)
  if (parts.length !== 3) return d
  const dt = new Date(parts[0], parts[1] - 1, parts[2])
  return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function buildFollowUpSummary(
  setup: EventSetup,
  outcomes: EventOutcomes,
  actions: FollowUpAction[],
): string {
  const lines: string[] = ['OPEN HOUSE FOLLOW-UP PLANNER', '============================']

  // ── Event setup ──
  const timeRange = [formatTime(setup.startTime), formatTime(setup.endTime)].filter(Boolean).join(' – ')
  const setupLines = [
    line('Property', setup.propertyLabel),
    line('Date', formatDate(setup.date)),
    timeRange ? `Time: ${timeRange}` : '',
    line('Hosting agent', setup.hostingAgent),
    setup.sellerUpdateNeeded === 'yes' ? 'Seller update: Needed' :
    setup.sellerUpdateNeeded === 'no'  ? 'Seller update: Not needed' :
    setup.sellerUpdateNeeded === 'not_sure' ? 'Seller update: Not sure yet' : '',
    setup.estimatedAttendance ? `Estimated attendance: ${setup.estimatedAttendance}` : '',
    line('Event notes', setup.eventNotes),
  ]
  lines.push(section('EVENT SETUP', setupLines))

  // ── Event outcomes ──
  const attendanceLabel = outcomes.attendanceOutcome
    ? ATTENDANCE_LABELS[outcomes.attendanceOutcome]
    : ''
  const outcomeLines = [
    attendanceLabel ? `Attendance: ${attendanceLabel}` : '',
    line('Feedback themes', outcomes.feedbackThemes),
    line('Common questions', outcomes.commonQuestions),
    line('Concerns for review', outcomes.concernsForReview),
    line('Marketing observations', outcomes.marketingObservations),
    line('Planning notes', outcomes.planningNotes),
  ]
  lines.push(section('EVENT OUTCOMES', outcomeLines))

  // ── Visitor records (exclude declined) ──
  const eligibleVisitors = outcomes.visitors.filter(v => v.permission !== 'declined')
  const declinedCount = outcomes.visitors.length - eligibleVisitors.length

  if (outcomes.visitors.length > 0) {
    const visitorBlocks: string[] = []

    if (declinedCount > 0) {
      visitorBlocks.push(`(${declinedCount} record(s) with Declined permission omitted from this summary)`)
    }

    eligibleVisitors.forEach((v, i) => {
      const label = v.label || `Record ${i + 1}`
      const vLines = [
        `Visitor: ${label}`,
        v.context ? `  Context: ${VISITOR_CONTEXT_LABELS[v.context]}` : '',
        v.permission ? `  Permission: ${PERMISSION_LABELS[v.permission]}` : '',
        v.contactMethod ? `  Contact method: ${CONTACT_METHOD_LABELS[v.contactMethod]}` : '',
        v.requested ? `  Requested: ${v.requested}` : '',
        v.questions ? `  Questions to answer: ${v.questions}` : '',
        v.feedback ? `  Property feedback: ${v.feedback}` : '',
        v.notes ? `  Notes: ${v.notes}` : '',
      ].filter(Boolean).join('\n')
      if (vLines) visitorBlocks.push(vLines)
    })

    if (visitorBlocks.length > 0) {
      lines.push(section('VISITOR FOLLOW-UP RECORDS', visitorBlocks))
    }
  }

  // ── Follow-up plan ──
  if (actions.length > 0) {
    // Group by timing period
    const byTiming: Record<string, FollowUpAction[]> = {}
    actions.forEach(a => {
      const key = ACTION_TIMING_LABELS[a.timing] ?? 'No date selected'
      byTiming[key] = byTiming[key] ?? []
      byTiming[key].push(a)
    })

    const planBlocks: string[] = []

    const timingOrder = ['Today', 'Next business day', 'This week', 'Later', 'No date selected']
    timingOrder.forEach(t => {
      if (!byTiming[t]) return
      planBlocks.push(`[${t.toUpperCase()}]`)
      byTiming[t].forEach(a => {
        const scopeLabel = a.scope === 'event_wide'
          ? 'Event-wide'
          : (() => {
              const vis = outcomes.visitors.find(v => v.id === a.scope)
              return vis ? `Visitor: ${vis.label || 'unnamed'}` : 'Visitor'
            })()
        const aLines = [
          `• ${a.label}`,
          `  Category: ${ACTION_CATEGORY_LABELS[a.category]}`,
          `  Scope: ${scopeLabel}`,
          a.responsible ? `  Responsible: ${a.responsible}` : '',
          a.targetDate ? `  Target date: ${formatDate(a.targetDate)}` : '',
          `  Status: ${ACTION_STATUS_LABELS[a.status]}`,
          a.channel ? `  Channel: ${a.channel}` : '',
          a.needsBrokerInput ? '  Needs broker input: Yes' : '',
          a.notes ? `  Notes: ${a.notes}` : '',
        ].filter(Boolean).join('\n')
        planBlocks.push(aLines)
      })
    })

    const brokerItems = actions.filter(a => a.needsBrokerInput)
    if (brokerItems.length > 0) {
      planBlocks.push('\n[BROKER / BROKERAGE INPUT NEEDED]')
      brokerItems.forEach(a => planBlocks.push(`• ${a.label}`))
    }

    lines.push(section('FOLLOW-UP PLAN', planBlocks))
  }

  // ── Footer ──
  lines.push('\n────────────────────────────────────')
  lines.push('Generated with Websites by Leslie — Open House Follow-Up Planner')
  lines.push('This is a planning workspace. All information was session-only and has not been stored or transmitted.')

  return lines.filter(l => l !== '').join('\n')
}
