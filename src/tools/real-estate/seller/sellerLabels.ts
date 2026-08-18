import type { SellerAnswers } from './sellerTypes'

export const TIMEFRAME_LABELS: Record<string, string> = {
  asap: 'As soon as possible',
  '3to6': 'Within 3–6 months',
  '6to12': 'Within 6–12 months',
  over12: 'More than 12 months from now',
  notSure: "I'm not sure yet",
}

export const STAGE_LABELS: Record<string, string> = {
  exploring: 'Just exploring my options',
  preparing: 'Actively preparing to sell',
  ready: 'Ready to begin the listing process',
}

export const COORDINATION_LABELS: Record<string, string> = {
  sellOnly: "No — I'm only selling",
  buyFirst: "I'm buying another home first",
  sellFirst: "I'll purchase after selling",
  simultaneously: 'Aiming to do both at the same time',
  notSure: 'Not sure yet',
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  singleFamily: 'Single-family home',
  condoTownhome: 'Condo or townhome',
  multiUnit: 'Multi-unit (duplex, triplex, etc.)',
  land: 'Land or vacant lot',
  other: 'Other',
}

export const OCCUPANCY_LABELS: Record<string, string> = {
  ownerOccupied: 'I live there',
  vacant: 'Currently vacant',
  tenantOccupied: 'Tenant-occupied',
  other: 'Other arrangement',
}

export const OWNERSHIP_DURATION_LABELS: Record<string, string> = {
  under2: 'Less than 2 years',
  '2to5': '2–5 years',
  '5to10': '5–10 years',
  over10: 'More than 10 years',
  preferNotSay: 'Prefer not to say',
}

export const KNOWN_REPAIRS_LABELS: Record<string, string> = {
  yesList: 'Yes — I have a list in mind',
  maybeFew: 'Maybe a few items',
  noneAware: "None that I'm aware of",
  notSure: 'Not sure',
}

export const DECLUTTER_STATUS_LABELS: Record<string, string> = {
  done: 'Done or nearly complete',
  inProgress: 'In progress',
  planned: 'Planned but not started',
  notSure: "Haven't thought about it yet",
}

export const RECENT_IMPROVEMENTS_LABELS: Record<string, string> = {
  yesMajor: 'Yes — major renovations or additions',
  yesMinor: 'Yes — minor updates or cosmetic work',
  none: 'No significant improvements',
}

export const ACCESS_ARRANGEMENT_LABELS: Record<string, string> = {
  straightforward: 'Should be straightforward',
  needsCoordination: 'Will need some coordination',
  haveQuestions: 'I have questions about this',
}

export const PREP_QUESTIONS_LABELS: Record<string, string> = {
  yes: 'Yes, I have questions',
  no: 'No, I feel prepared',
  notSure: 'Not sure yet',
}

export const HOA_INVOLVEMENT_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  notSure: "I'm not sure",
}

export const DOCUMENTS_AVAILABLE_LABELS: Record<string, string> = {
  surveys: 'Survey documents',
  permits: 'Building permits for renovations',
  warranties: 'Appliance or system warranties',
  hoa: 'HOA documents (CC&Rs, meeting minutes)',
  taxRecords: 'Recent property tax records',
  none: 'None of these',
}

export const MULTIPLE_OWNERS_LABELS: Record<string, string> = {
  one: 'One owner',
  multiple: 'Multiple owners',
  needToConfirm: 'I need to confirm',
}

export const TIMING_COMPLICATIONS_LABELS: Record<string, string> = {
  yes: 'Yes — I have specific timing constraints',
  flexible: 'Mostly flexible, but prefer certain months',
  open: 'No particular timing constraints',
}

export const PRIORITY_LABELS: Record<string, string> = {
  timing: 'Getting the timing right',
  process: 'Understanding the full process',
  preparation: 'Making the home show-ready',
  coordination: 'Coordinating with a home purchase',
  disruption: 'Minimizing disruption during the sale',
  listing: 'Getting listed quickly',
}

export interface RecapRow {
  field: string
  value: string
}

export function buildSellerAnswerRecap(answers: SellerAnswers): RecapRow[] {
  const rows: RecapRow[] = []

  if (answers.timeframe && TIMEFRAME_LABELS[answers.timeframe]) {
    rows.push({ field: 'Listing timing', value: TIMEFRAME_LABELS[answers.timeframe] })
  }
  if (answers.stage && STAGE_LABELS[answers.stage]) {
    rows.push({ field: 'Current selling stage', value: STAGE_LABELS[answers.stage] })
  }
  if (answers.coordination && COORDINATION_LABELS[answers.coordination]) {
    rows.push({ field: 'Purchase-and-sale coordination', value: COORDINATION_LABELS[answers.coordination] })
  }
  if (answers.propertyType && PROPERTY_TYPE_LABELS[answers.propertyType]) {
    rows.push({ field: 'Property type', value: PROPERTY_TYPE_LABELS[answers.propertyType] })
  }
  if (answers.occupancy && OCCUPANCY_LABELS[answers.occupancy]) {
    rows.push({ field: 'Occupancy', value: OCCUPANCY_LABELS[answers.occupancy] })
  }
  if (answers.ownershipDuration && OWNERSHIP_DURATION_LABELS[answers.ownershipDuration]) {
    rows.push({ field: 'Ownership duration', value: OWNERSHIP_DURATION_LABELS[answers.ownershipDuration] })
  }
  if (answers.knownRepairs && KNOWN_REPAIRS_LABELS[answers.knownRepairs]) {
    rows.push({ field: 'Repairs or deferred maintenance', value: KNOWN_REPAIRS_LABELS[answers.knownRepairs] })
  }
  if (answers.declutterStatus && DECLUTTER_STATUS_LABELS[answers.declutterStatus]) {
    rows.push({ field: 'Decluttering status', value: DECLUTTER_STATUS_LABELS[answers.declutterStatus] })
  }
  if (answers.recentImprovements && RECENT_IMPROVEMENTS_LABELS[answers.recentImprovements]) {
    rows.push({ field: 'Recent improvements', value: RECENT_IMPROVEMENTS_LABELS[answers.recentImprovements] })
  }
  if (answers.accessArrangement && ACCESS_ARRANGEMENT_LABELS[answers.accessArrangement]) {
    rows.push({ field: 'Showing access', value: ACCESS_ARRANGEMENT_LABELS[answers.accessArrangement] })
  }
  if (answers.prepQuestions && PREP_QUESTIONS_LABELS[answers.prepQuestions]) {
    rows.push({ field: 'Preparation-question status', value: PREP_QUESTIONS_LABELS[answers.prepQuestions] })
  }
  if (answers.hoaInvolvement && HOA_INVOLVEMENT_LABELS[answers.hoaInvolvement]) {
    rows.push({ field: 'HOA status', value: HOA_INVOLVEMENT_LABELS[answers.hoaInvolvement] })
  }
  if (answers.documentsAvailable.length > 0) {
    const value = answers.documentsAvailable
      .map(v => DOCUMENTS_AVAILABLE_LABELS[v] ?? v)
      .join(', ')
    rows.push({ field: 'Available documents', value })
  }
  if (answers.multipleOwners && MULTIPLE_OWNERS_LABELS[answers.multipleOwners]) {
    rows.push({ field: 'Number of owners', value: MULTIPLE_OWNERS_LABELS[answers.multipleOwners] })
  }
  if (answers.timingComplications && TIMING_COMPLICATIONS_LABELS[answers.timingComplications]) {
    rows.push({ field: 'Timing constraints', value: TIMING_COMPLICATIONS_LABELS[answers.timingComplications] })
  }
  if (answers.priorities.length > 0) {
    const value = answers.priorities
      .map(v => PRIORITY_LABELS[v] ?? v)
      .join(', ')
    rows.push({ field: 'Selected priorities', value })
  }
  if (answers.agentQuestions.trim()) {
    rows.push({ field: 'Written questions', value: answers.agentQuestions.trim() })
  }

  return rows
}
