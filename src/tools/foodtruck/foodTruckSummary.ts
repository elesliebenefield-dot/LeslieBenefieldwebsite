import type { FoodTruckAnswers, EventType, PublicPrivate, AttendanceRange, ServiceWindow, SettingType, PaymentArrangement, BudgetRange, SetupSpaceType, VehicleAccess, SurfaceType, UtilityAnswer, SetupTime } from './foodTruckTypes'
import {
  EVENT_TYPE_LABELS,
  PUBLIC_PRIVATE_LABELS,
  ATTENDANCE_LABELS,
  SERVICE_WINDOW_LABELS,
  SETTING_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  PAYMENT_LABELS,
  BUDGET_LABELS,
  SETUP_SPACE_LABELS,
  VEHICLE_ACCESS_LABELS,
  SURFACE_TYPE_LABELS,
  UTILITY_LABELS,
  SETUP_TIME_LABELS,
} from './foodTruckTypes'

function label<T extends string>(map: Record<Exclude<T, ''>, string>, value: T): string {
  return value ? (map as Record<string, string>)[value] ?? '' : ''
}

function formatDate(dateString: string): string {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function buildInquiryBriefText(answers: FoodTruckAnswers): string {
  const lines: string[] = []
  const SEP = '='.repeat(42)
  const sec = '-'.repeat(42)
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  lines.push('FOOD TRUCK EVENT INQUIRY BRIEF')
  lines.push(SEP)
  lines.push('Prepared for: Your Mobile Food Business')
  if (answers.organizerName.trim()) {
    lines.push(`Prepared by:  ${answers.organizerName.trim()}`)
  }
  lines.push(`Date:         ${today}`)
  lines.push('')

  // ─── The Event ──────────────────────────────────────────────────────────────
  lines.push('THE EVENT')
  lines.push(sec)
  if (answers.eventType) {
    lines.push(`Event type:        ${label<EventType>(EVENT_TYPE_LABELS, answers.eventType)}`)
  }
  if (answers.eventDateStatus === 'confirmed' && answers.eventDate) {
    lines.push(`Event date:        ${formatDate(answers.eventDate)}`)
  } else if (answers.eventDateStatus === 'tbd') {
    lines.push('Event date:        Date not yet confirmed')
  }
  if (answers.dateNotes.trim()) {
    lines.push(`Date notes:        ${answers.dateNotes.trim()}`)
  }
  if (answers.venueName.trim()) {
    lines.push(`Location or venue: ${answers.venueName.trim()}`)
  }
  if (answers.isPublic) {
    lines.push(`Event status:      ${label<PublicPrivate>(PUBLIC_PRIVATE_LABELS, answers.isPublic)}`)
  }
  if (answers.attendance) {
    lines.push(`Attendance:        ${label<AttendanceRange>(ATTENDANCE_LABELS, answers.attendance)}`)
  }
  if (answers.serviceWindow) {
    lines.push(`Service window:    ${label<ServiceWindow>(SERVICE_WINDOW_LABELS, answers.serviceWindow)}`)
  }
  if (answers.specificHours.trim()) {
    lines.push(`Service hours:     ${answers.specificHours.trim()}`)
  }
  if (answers.settingType) {
    lines.push(`Setting:           ${label<SettingType>(SETTING_TYPE_LABELS, answers.settingType)}`)
  }
  lines.push('')

  // ─── Service Requested ──────────────────────────────────────────────────────
  lines.push('SERVICE REQUESTED')
  lines.push(sec)
  if (answers.serviceTypes.length > 0) {
    const typeLabels = answers.serviceTypes.map(t => SERVICE_TYPE_LABELS[t]).join(', ')
    lines.push(`Service type:         ${typeLabels}`)
  }
  if (answers.additionalInterests.trim()) {
    lines.push(`Additional interests: ${answers.additionalInterests.trim()}`)
  }
  if (answers.paymentArrangement) {
    lines.push(`Payment arrangement:  ${label<PaymentArrangement>(PAYMENT_LABELS, answers.paymentArrangement)}`)
  }
  if (answers.guestsServed.trim()) {
    lines.push(`Guests to be served:  ${answers.guestsServed.trim()}`)
  }
  if (answers.budget && answers.budget !== 'prefer_not_say') {
    lines.push(`Budget:               ${label<BudgetRange>(BUDGET_LABELS, answers.budget)}`)
  }
  if (answers.dietaryNotes.trim()) {
    lines.push(`Dietary notes:        ${answers.dietaryNotes.trim()}`)
  }
  lines.push('')

  // ─── Venue & Logistics ──────────────────────────────────────────────────────
  lines.push('VENUE & LOGISTICS')
  lines.push(sec)
  if (answers.setupSpace) {
    lines.push(`Setup space:        ${label<SetupSpaceType>(SETUP_SPACE_LABELS, answers.setupSpace)}`)
  }
  if (answers.vehicleAccess) {
    lines.push(`Vehicle access:     ${label<VehicleAccess>(VEHICLE_ACCESS_LABELS, answers.vehicleAccess)}`)
  }
  if (answers.surfaceType) {
    lines.push(`Surface type:       ${label<SurfaceType>(SURFACE_TYPE_LABELS, answers.surfaceType)}`)
  }
  if (answers.electricity) {
    lines.push(`Electricity:        ${label<UtilityAnswer>(UTILITY_LABELS, answers.electricity)}`)
  }
  if (answers.waterAccess) {
    lines.push(`Water access:       ${label<UtilityAnswer>(UTILITY_LABELS, answers.waterAccess)}`)
  }
  if (answers.venueRestrictions.trim()) {
    lines.push(`Venue restrictions: ${answers.venueRestrictions.trim()}`)
  }
  if (answers.dayOfContact.trim()) {
    lines.push(`Day-of contact:     ${answers.dayOfContact.trim()}`)
  }
  if (answers.setupBreakdown) {
    lines.push(`Setup & breakdown:  ${label<SetupTime>(SETUP_TIME_LABELS, answers.setupBreakdown)}`)
  }

  // ─── Questions ──────────────────────────────────────────────────────────────
  if (answers.questions.trim()) {
    lines.push('')
    lines.push('QUESTIONS FOR THE VENDOR')
    lines.push(sec)
    lines.push(answers.questions.trim())
  }

  lines.push('')
  lines.push('—')
  lines.push(
    'This brief summarizes information prepared by the event organizer. It does not ' +
    'confirm availability or reserve the date, guarantee menu items or service capacity, ' +
    'establish pricing, confirm venue suitability, or confirm permits, licenses, utilities, ' +
    'or other event requirements.'
  )

  return lines.join('\n')
}

export function buildMailtoSubject(answers: FoodTruckAnswers): string {
  const eventType = answers.eventType
    ? EVENT_TYPE_LABELS[answers.eventType as Exclude<EventType, ''>]
    : 'Event inquiry'

  const datePart = answers.eventDateStatus === 'confirmed' && answers.eventDate
    ? formatDate(answers.eventDate)
    : 'Date TBD'

  return `Food Truck Event Inquiry – ${eventType} · ${datePart}`
}
