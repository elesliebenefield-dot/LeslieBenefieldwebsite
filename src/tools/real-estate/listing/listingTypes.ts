export type TaskStatus = 'notStarted' | 'inProgress' | 'waiting' | 'complete'
export type Responsibility = 'homeowner' | 'coOwner' | 'agent' | 'vendor' | 'tenantManager' | 'unassigned'
export type PlanningPeriod = 'beforeSpending' | 'beforePhotography' | 'beforeListing' | 'beforeShowing' | 'laterOptional'
export type OccupancyType = 'livingIn' | 'tenantOccupied' | 'vacant' | 'other' | ''
export type InvolvedParty = 'homeowner' | 'coOwner' | 'agent' | 'tenant' | 'propertyManager' | 'vendors'

export interface PlanTask {
  id: string
  title: string
  category: string
  categoryKey: string
  status: TaskStatus
  responsibility: Responsibility
  planningPeriod: PlanningPeriod
  targetDate: string
  notes: string
  needsAgentInput: boolean
  isCustom: boolean
  starterKey: string
}

export interface ListingPlanSetup {
  planName: string
  photographyDate: string
  listingDate: string
  showingDate: string
  occupancy: OccupancyType
  involvedParties: InvolvedParty[]
  planNotes: string
}

export const EMPTY_SETUP: ListingPlanSetup = {
  planName: '',
  photographyDate: '',
  listingDate: '',
  showingDate: '',
  occupancy: '',
  involvedParties: [],
  planNotes: '',
}

export const PLANNING_PERIOD_ORDER: PlanningPeriod[] = [
  'beforeSpending',
  'beforePhotography',
  'beforeListing',
  'beforeShowing',
  'laterOptional',
]

export const PLANNING_PERIOD_LABELS: Record<PlanningPeriod, string> = {
  beforeSpending: 'Discuss Before Spending',
  beforePhotography: 'Before Photography',
  beforeListing: 'Before Listing',
  beforeShowing: 'Before First Showing or Open House',
  laterOptional: 'Later or Optional',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  notStarted: 'Not started',
  inProgress: 'In progress',
  waiting: 'Waiting on someone',
  complete: 'Complete',
}

export const RESPONSIBILITY_LABELS: Record<Responsibility, string> = {
  homeowner: 'Homeowner',
  coOwner: 'Co-owner or family',
  agent: 'Agent',
  vendor: 'Vendor',
  tenantManager: 'Tenant or property manager',
  unassigned: 'Unassigned',
}

export const OCCUPANCY_LABELS: Record<Exclude<OccupancyType, ''>, string> = {
  livingIn: 'Living in the home',
  tenantOccupied: 'Tenant occupied',
  vacant: 'Vacant',
  other: 'Other',
}

export const INVOLVED_PARTY_LABELS: Record<InvolvedParty, string> = {
  homeowner: 'Homeowner',
  coOwner: 'Co-owner or family member',
  agent: 'Real estate agent',
  tenant: 'Tenant',
  propertyManager: 'Property manager',
  vendors: 'Vendors',
}
