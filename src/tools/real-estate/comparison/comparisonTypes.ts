export type MatchStatus = 'meets' | 'partlyMeets' | 'doesNotMeet' | 'notSure' | 'notEvaluated'

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  meets: 'Meets',
  partlyMeets: 'Partly meets',
  doesNotMeet: 'Does not meet',
  notSure: 'Not sure',
  notEvaluated: 'Not evaluated',
}

export const MATCH_STATUS_ORDER: MatchStatus[] = [
  'meets', 'partlyMeets', 'doesNotMeet', 'notSure', 'notEvaluated',
]

export interface Priority {
  id: string
  label: string
  isCustom: boolean
}

export type PropertyType = 'singleFamily' | 'condo' | 'townhouse' | 'multiFamily' | 'other' | ''

export const PROPERTY_TYPE_LABELS: Record<Exclude<PropertyType, ''>, string> = {
  singleFamily: 'Single-family home',
  condo: 'Condominium',
  townhouse: 'Townhouse',
  multiFamily: 'Multi-family',
  other: 'Other',
}

export type PeriodType = 'monthly' | 'annual' | ''

export interface Property {
  id: string
  nickname: string
  address: string
  listingUrl: string
  tourDate: string
  askingPrice: string
  propertyType: PropertyType
  bedrooms: string
  bathrooms: string
  sqft: string
  yearBuilt: string
  parking: string
  propertyTaxes: string
  propertyTaxesPeriod: PeriodType
  hoaFee: string
  hoaFeePeriod: PeriodType
  insuranceEstimate: string
  insurancePeriod: PeriodType
  otherExpense: string
  otherExpenseLabel: string
  otherExpensePeriod: PeriodType
}

export function makeEmptyProperty(id: string): Property {
  return {
    id,
    nickname: '',
    address: '',
    listingUrl: '',
    tourDate: '',
    askingPrice: '',
    propertyType: '',
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    yearBuilt: '',
    parking: '',
    propertyTaxes: '',
    propertyTaxesPeriod: '',
    hoaFee: '',
    hoaFeePeriod: '',
    insuranceEstimate: '',
    insurancePeriod: '',
    otherExpense: '',
    otherExpenseLabel: '',
    otherExpensePeriod: '',
  }
}

export const STARTER_FOLLOW_UP_OPTIONS: string[] = [
  'Ask the agent a question',
  'Request available property documents',
  'Consider a second showing',
  'Revisit at a different time of day',
  'Discuss observations with an appropriate professional',
]

export interface PropertyObservations {
  propertyId: string
  priorityMatches: Record<string, MatchStatus>
  positives: string
  concerns: string
  layoutNotes: string
  conditionNotes: string
  lightNotes: string
  storageNotes: string
  parkingNotes: string
  outdoorNotes: string
  accessibilityNotes: string
  commuteNotes: string
  noiseNotes: string
  agentQuestions: string
  professionalQuestions: string
  infoNeeded: string
  followUpNotes: string
  followUpActions: string[]
  customFollowUps: string[]
}

export function makeEmptyObservations(propertyId: string): PropertyObservations {
  return {
    propertyId,
    priorityMatches: {},
    positives: '',
    concerns: '',
    layoutNotes: '',
    conditionNotes: '',
    lightNotes: '',
    storageNotes: '',
    parkingNotes: '',
    outdoorNotes: '',
    accessibilityNotes: '',
    commuteNotes: '',
    noiseNotes: '',
    agentQuestions: '',
    professionalQuestions: '',
    infoNeeded: '',
    followUpNotes: '',
    followUpActions: [],
    customFollowUps: [],
  }
}

export const MAX_PRIORITIES = 8
export const MAX_PROPERTIES = 4
export const MIN_PROPERTIES = 2
