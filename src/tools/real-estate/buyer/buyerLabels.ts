import type { BuyerAnswers } from './buyerTypes'

export const TIMEFRAME_LABELS: Record<string, string> = {
  within3: 'Within the next 3 months',
  '3to6': 'Within 3–6 months',
  '6to12': 'Within 6–12 months',
  moreThan12: 'More than 12 months from now',
  unsure: "I'm not sure yet",
}

export const STAGE_LABELS: Record<string, string> = {
  justExploring: 'Just learning about the process',
  actively: 'Actively looking at homes',
  ready: 'Ready to start making offers',
}

export const PURCHASE_TYPE_LABELS: Record<string, string> = {
  firstHome: 'A primary residence (first home)',
  anotherHome: 'A primary residence (moving from another)',
  investment: 'An investment property',
  land: 'Land or a lot',
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  singleFamily: 'Single-family home',
  condo: 'Condo',
  townhome: 'Townhome',
  multiUnit: 'Multi-unit property',
  openToAll: 'Open to different types',
}

export const FEATURE_LABELS: Record<string, string> = {
  garage: 'Garage or covered parking',
  yard: 'Private yard or outdoor space',
  homeOffice: 'Home office space',
  primaryMain: 'Primary bedroom on main floor',
  storage: 'Ample storage',
  accessibility: 'Accessibility features',
  newConstruction: 'New or recent construction',
  openLayout: 'Open floor plan',
}

export const HAS_TARGET_AREA_LABELS: Record<string, string> = {
  yes: 'Yes — I have a specific area in mind',
  no: "No — I haven't defined an area yet",
  open: "I'm open and would like guidance",
}

export const FINANCING_STATUS_LABELS: Record<string, string> = {
  notSpoken: "I haven't spoken with a lender yet",
  begun: "I've started conversations with a lender",
  preapproved: 'I have a pre-approval letter',
  noFinancing: 'I plan to purchase without a loan',
  unsure: "I'm not sure yet",
}

export const HOUSING_TIMING_LABELS: Record<string, string> = {
  leaseSoon: 'My lease is ending soon',
  monthToMonth: "I'm on a month-to-month lease",
  ownNoRush: 'I own my current home and have flexibility',
  flexible: "I'm flexible — no immediate housing pressure",
  urgent: 'I have an urgent situation driving my timeline',
}

export const MUST_SELL_FIRST_LABELS: Record<string, string> = {
  yes: 'Yes — I need to sell before I can buy',
  no: 'No — my purchase is not tied to a sale',
  unsure: "I'm not sure yet",
}

export const SHOWING_AVAILABILITY_LABELS: Record<string, string> = {
  flexible: 'Flexible — I can generally schedule showings when needed',
  weekendsOnly: 'Weekends only',
  limited: 'Limited — my schedule is constrained',
}

export const OTHER_DECISION_MAKERS_LABELS: Record<string, string> = {
  yes: 'Yes — another person will be involved in the decision',
  no: "No — I'm the sole decision-maker",
}

export const MOVING_FLEXIBILITY_LABELS: Record<string, string> = {
  flexible: "I'm flexible on when I move in",
  specific: 'I have a specific date or window I need to hit',
  unsure: "I'm not sure how flexible I can be",
}

export const PRIORITY_LABELS: Record<string, string> = {
  timing: 'Getting the timing right',
  process: 'Understanding the full buying process',
  searchScope: 'Narrowing down my search criteria',
  financing: 'Getting financing in place',
  competition: 'Navigating competitive offer situations',
  inspection: 'Understanding inspections and contingencies',
}

export interface RecapRow {
  field: string
  value: string
}

export function buildBuyerAnswerRecap(answers: BuyerAnswers): RecapRow[] {
  const rows: RecapRow[] = []

  if (answers.timeframe && TIMEFRAME_LABELS[answers.timeframe]) {
    rows.push({ field: 'Purchase timing', value: TIMEFRAME_LABELS[answers.timeframe] })
  }
  if (answers.stage && STAGE_LABELS[answers.stage]) {
    rows.push({ field: 'Current buying stage', value: STAGE_LABELS[answers.stage] })
  }
  if (answers.purchaseType && PURCHASE_TYPE_LABELS[answers.purchaseType]) {
    rows.push({ field: 'Intended property purpose', value: PURCHASE_TYPE_LABELS[answers.purchaseType] })
  }
  if (answers.propertyTypes.length > 0) {
    const value = answers.propertyTypes
      .map(v => PROPERTY_TYPE_LABELS[v] ?? v)
      .join(', ')
    rows.push({ field: 'Selected property types', value })
  }
  if (answers.mustHaves.length > 0) {
    const value = answers.mustHaves
      .map(v => FEATURE_LABELS[v] ?? v)
      .join(', ')
    rows.push({ field: 'Must-have features', value })
  }
  if (answers.niceToHaves.length > 0) {
    const value = answers.niceToHaves
      .map(v => FEATURE_LABELS[v] ?? v)
      .join(', ')
    rows.push({ field: 'Nice-to-have features', value })
  }
  if (answers.hasTargetArea && HAS_TARGET_AREA_LABELS[answers.hasTargetArea]) {
    rows.push({ field: 'Target-area status', value: HAS_TARGET_AREA_LABELS[answers.hasTargetArea] })
  }
  if (answers.financingStatus && FINANCING_STATUS_LABELS[answers.financingStatus]) {
    rows.push({ field: 'Financing status', value: FINANCING_STATUS_LABELS[answers.financingStatus] })
  }
  if (answers.housingTiming && HOUSING_TIMING_LABELS[answers.housingTiming]) {
    rows.push({ field: 'Current housing situation', value: HOUSING_TIMING_LABELS[answers.housingTiming] })
  }
  if (answers.mustSellFirst && MUST_SELL_FIRST_LABELS[answers.mustSellFirst]) {
    rows.push({ field: 'Must sell a home first', value: MUST_SELL_FIRST_LABELS[answers.mustSellFirst] })
  }
  if (answers.showingAvailability && SHOWING_AVAILABILITY_LABELS[answers.showingAvailability]) {
    rows.push({ field: 'Showing availability', value: SHOWING_AVAILABILITY_LABELS[answers.showingAvailability] })
  }
  if (answers.otherDecisionMakers && OTHER_DECISION_MAKERS_LABELS[answers.otherDecisionMakers]) {
    rows.push({ field: 'Other decision-makers', value: OTHER_DECISION_MAKERS_LABELS[answers.otherDecisionMakers] })
  }
  if (answers.movingFlexibility && MOVING_FLEXIBILITY_LABELS[answers.movingFlexibility]) {
    rows.push({ field: 'Move-in flexibility', value: MOVING_FLEXIBILITY_LABELS[answers.movingFlexibility] })
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
