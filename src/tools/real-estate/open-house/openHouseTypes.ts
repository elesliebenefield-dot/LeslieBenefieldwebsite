// ── Shared identifier factory ─────────────────────────────────────────────────

let _nextId = 0
export function makeOhId(): string { return `oh-${++_nextId}` }

// ── Stage 1: Event Setup ──────────────────────────────────────────────────────

export type SellerUpdateNeeded = 'yes' | 'no' | 'not_sure' | ''

export interface EventSetup {
  propertyLabel: string
  date: string
  startTime: string
  endTime: string
  hostingAgent: string
  sellerUpdateNeeded: SellerUpdateNeeded
  estimatedAttendance: string
  eventNotes: string
}

export function makeEmptyEventSetup(): EventSetup {
  return {
    propertyLabel: '',
    date: '',
    startTime: '',
    endTime: '',
    hostingAgent: '',
    sellerUpdateNeeded: '',
    estimatedAttendance: '',
    eventNotes: '',
  }
}

// ── Stage 2: Event Outcomes ───────────────────────────────────────────────────

export type AttendanceOutcome = 'no_visitors' | 'light' | 'moderate' | 'busy' | 'prefer_not' | ''

export const ATTENDANCE_LABELS: Record<AttendanceOutcome, string> = {
  no_visitors: 'No visitors',
  light: 'Light',
  moderate: 'Moderate',
  busy: 'Busy',
  prefer_not: 'Prefer not to categorize',
  '': 'Not recorded',
}

export type VisitorContext =
  | 'prospective_buyer'
  | 'neighbor'
  | 're_professional'
  | 'vendor'
  | 'other'
  | 'prefer_not'
  | ''

export const VISITOR_CONTEXT_LABELS: Record<VisitorContext, string> = {
  prospective_buyer: 'Prospective buyer',
  neighbor: 'Neighbor / community member',
  re_professional: 'Real-estate professional',
  vendor: 'Vendor / service provider',
  other: 'Other',
  prefer_not: 'Prefer not to categorize',
  '': 'Not recorded',
}

export type FollowUpPermission = 'confirmed' | 'unknown' | 'declined' | 'not_applicable' | ''

export const PERMISSION_LABELS: Record<FollowUpPermission, string> = {
  confirmed: 'Confirmed',
  unknown: 'Unknown — confirm before proceeding',
  declined: 'Declined — no outreach',
  not_applicable: 'Not applicable',
  '': 'Not recorded',
}

export type ContactMethod =
  | 'email'
  | 'phone'
  | 'text'
  | 'agent_to_agent'
  | 'other'
  | 'not_provided'
  | ''

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  email: 'Email',
  phone: 'Phone',
  text: 'Text',
  agent_to_agent: 'Agent-to-agent',
  other: 'Other',
  not_provided: 'Not provided',
  '': 'Not recorded',
}

export const MAX_VISITORS = 12

export interface VisitorRecord {
  id: string
  label: string
  context: VisitorContext
  permission: FollowUpPermission
  contactMethod: ContactMethod
  requested: string
  questions: string
  feedback: string
  notes: string
}

export function makeEmptyVisitor(id: string): VisitorRecord {
  return {
    id,
    label: '',
    context: '',
    permission: '',
    contactMethod: '',
    requested: '',
    questions: '',
    feedback: '',
    notes: '',
  }
}

export interface EventOutcomes {
  attendanceOutcome: AttendanceOutcome
  feedbackThemes: string
  commonQuestions: string
  concernsForReview: string
  marketingObservations: string
  planningNotes: string
  visitors: VisitorRecord[]
}

export function makeEmptyEventOutcomes(): EventOutcomes {
  return {
    attendanceOutcome: '',
    feedbackThemes: '',
    commonQuestions: '',
    concernsForReview: '',
    marketingObservations: '',
    planningNotes: '',
    visitors: [],
  }
}

// ── Stage 3: Follow-Up Plan ───────────────────────────────────────────────────

export type ActionCategory =
  | 'wrap_up'
  | 'seller_comm'
  | 'visitor_fu'
  | 'agent_questions'
  | 'marketing_admin'

export const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  wrap_up: 'Property & event wrap-up',
  seller_comm: 'Seller / client communication',
  visitor_fu: 'Visitor follow-up',
  agent_questions: 'Agent & professional questions',
  marketing_admin: 'Marketing & administrative',
}

export type ActionTiming = 'today' | 'next_business_day' | 'this_week' | 'later' | 'no_date'

export const ACTION_TIMING_LABELS: Record<ActionTiming, string> = {
  today: 'Today',
  next_business_day: 'Next business day',
  this_week: 'This week',
  later: 'Later',
  no_date: 'No date selected',
}

export type ActionStatus = 'not_started' | 'in_progress' | 'waiting' | 'complete' | 'not_applicable'

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  waiting: 'Waiting',
  complete: 'Complete',
  not_applicable: 'Not applicable',
}

// scope: 'event_wide' or a visitorId
export type ActionScope = 'event_wide' | string

export interface FollowUpAction {
  id: string
  label: string
  category: ActionCategory
  scope: ActionScope
  responsible: string
  timing: ActionTiming
  targetDate: string
  status: ActionStatus
  channel: string
  notes: string
  needsBrokerInput: boolean
  isCustom: boolean
}

export function makeEmptyAction(id: string, label: string, category: ActionCategory, isCustom = false): FollowUpAction {
  return {
    id,
    label,
    category,
    scope: 'event_wide',
    responsible: '',
    timing: 'no_date',
    targetDate: '',
    status: 'not_started',
    channel: '',
    notes: '',
    needsBrokerInput: false,
    isCustom,
  }
}
