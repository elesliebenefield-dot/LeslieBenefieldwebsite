// ── Identifier factory ─────────────────────────────────────────────────────────

let _nextId = 0
export function makeCmId(): string { return `cm-${++_nextId}` }

// ── Stage 1: Transition Setup ──────────────────────────────────────────────────

export type TransitionType = 'buying' | 'selling' | 'selling_buying' | 'moving_only' | 'other'

export const TRANSITION_TYPE_LABELS: Record<TransitionType, string> = {
  buying: 'Buying and moving in',
  selling: 'Selling and moving out',
  selling_buying: 'Selling and buying simultaneously',
  moving_only: 'Moving without a sale or purchase',
  other: 'Other transition',
}

export type InvolvedParty =
  | 'user'
  | 'co_owner_family'
  | 'agent'
  | 'lender'
  | 'attorney_title_escrow'
  | 'mover_vendor'
  | 'property_manager'
  | 'other'

export const INVOLVED_PARTY_LABELS: Record<InvolvedParty, string> = {
  user: 'Me',
  co_owner_family: 'Co-owner or family member',
  agent: 'Real-estate agent',
  lender: 'Lender',
  attorney_title_escrow: 'Attorney, title, or escrow professional',
  mover_vendor: 'Mover or vendor',
  property_manager: 'Property manager',
  other: 'Other',
}

export const ALL_INVOLVED_PARTIES: InvolvedParty[] = [
  'user',
  'co_owner_family',
  'agent',
  'lender',
  'attorney_title_escrow',
  'mover_vendor',
  'property_manager',
  'other',
]

export type MovingMethod = 'professional' | 'self' | 'hybrid' | 'not_decided' | 'not_applicable'

export const MOVING_METHOD_LABELS: Record<MovingMethod, string> = {
  professional: 'Professional movers',
  self: 'Self-move',
  hybrid: 'Hybrid (movers + self)',
  not_decided: 'Not decided yet',
  not_applicable: 'Not applicable',
}

export interface UserDates {
  closingSigning: string
  possessionHandoff: string
  moveOut: string
  moveIn: string
  leaseEnd: string
}

export interface TransitionSetup {
  transitionType: TransitionType | ''
  planName: string
  leavingPropertyLabel: string
  arrivingPropertyLabel: string
  involvedParties: InvolvedParty[]
  dates: UserDates
  movingMethod: MovingMethod | ''
  notes: string
}

export function makeEmptyTransitionSetup(): TransitionSetup {
  return {
    transitionType: '',
    planName: '',
    leavingPropertyLabel: '',
    arrivingPropertyLabel: '',
    involvedParties: [],
    dates: {
      closingSigning: '',
      possessionHandoff: '',
      moveOut: '',
      moveIn: '',
      leaseEnd: '',
    },
    movingMethod: '',
    notes: '',
  }
}

// ── Task model ─────────────────────────────────────────────────────────────────

export type TaskTrack = 'general' | 'closing_coordination' | 'leaving' | 'arriving' | 'moving_day' | 'first_week'

export const TASK_TRACK_LABELS: Record<TaskTrack, string> = {
  general: 'General',
  closing_coordination: 'Closing coordination',
  leaving: 'Leaving',
  arriving: 'Arriving',
  moving_day: 'Moving day',
  first_week: 'First week',
}

export type PlanningPeriod =
  | 'before_closing'
  | 'closing_day'
  | 'before_move_out'
  | 'moving_day'
  | 'first_week'
  | 'later'
  | 'no_timing'

export const PLANNING_PERIOD_LABELS: Record<PlanningPeriod, string> = {
  before_closing: 'Before closing or signing',
  closing_day: 'Closing or possession day',
  before_move_out: 'Before move-out',
  moving_day: 'Moving day',
  first_week: 'First week',
  later: 'Later',
  no_timing: 'No timing selected',
}

export const PLANNING_PERIOD_ORDER: PlanningPeriod[] = [
  'before_closing',
  'closing_day',
  'before_move_out',
  'moving_day',
  'first_week',
  'later',
  'no_timing',
]

export type TaskStatus = 'not_started' | 'in_progress' | 'waiting' | 'complete' | 'not_applicable'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  waiting: 'Waiting',
  complete: 'Complete',
  not_applicable: 'Not applicable',
}

export type ProfessionalType =
  | 'agent'
  | 'lender'
  | 'attorney_title_escrow'
  | 'mover_vendor'
  | 'property_manager'
  | 'other_professional'

export const PROFESSIONAL_TYPE_LABELS: Record<ProfessionalType, string> = {
  agent: 'Agent',
  lender: 'Lender',
  attorney_title_escrow: 'Attorney, title, or escrow professional',
  mover_vendor: 'Mover or vendor',
  property_manager: 'Property manager',
  other_professional: 'Other professional',
}

export const ALL_PROFESSIONAL_TYPES: ProfessionalType[] = [
  'agent',
  'lender',
  'attorney_title_escrow',
  'mover_vendor',
  'property_manager',
  'other_professional',
]

export const MAX_TASKS = 80

export interface ClosingTask {
  id: string
  label: string
  track: TaskTrack
  responsible: string
  period: PlanningPeriod
  targetDate: string
  status: TaskStatus
  waitingOn: string
  notes: string
  needsProfessionalConfirmation: boolean
  isCustom: boolean
  isQuestion: boolean
  questionFor: ProfessionalType | ''
}

export function makeEmptyTask(id: string, label: string, track: TaskTrack, isCustom = false): ClosingTask {
  return {
    id,
    label,
    track,
    responsible: '',
    period: 'no_timing',
    targetDate: '',
    status: 'not_started',
    waitingOn: '',
    notes: '',
    needsProfessionalConfirmation: false,
    isCustom,
    isQuestion: false,
    questionFor: '',
  }
}

export function makeEmptyQuestion(id: string, label: string, questionFor: ProfessionalType): ClosingTask {
  return {
    id,
    label,
    track: 'general',
    responsible: '',
    period: 'no_timing',
    targetDate: '',
    status: 'not_started',
    waitingOn: '',
    notes: '',
    needsProfessionalConfirmation: true,
    isCustom: true,
    isQuestion: true,
    questionFor,
  }
}

export interface StarterTaskDef {
  key: string
  label: string
  track: TaskTrack
  defaultPeriod: PlanningPeriod
}

// Which tracks to show in Stage 2 based on transition type
export function getVisibleTracks(type: TransitionType | ''): TaskTrack[] {
  switch (type) {
    case 'buying':
      return ['closing_coordination', 'arriving', 'moving_day', 'general', 'first_week']
    case 'selling':
      return ['closing_coordination', 'leaving', 'moving_day', 'general', 'first_week']
    case 'selling_buying':
      return ['closing_coordination', 'leaving', 'arriving', 'moving_day', 'general', 'first_week']
    case 'moving_only':
      return ['moving_day', 'general', 'first_week']
    case 'other':
      return ['closing_coordination', 'leaving', 'arriving', 'moving_day', 'general', 'first_week']
    default:
      return ['closing_coordination', 'leaving', 'arriving', 'moving_day', 'general', 'first_week']
  }
}
