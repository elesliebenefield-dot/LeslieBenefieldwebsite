export interface BuyerAnswers {
  // Step 1: Buying Plans
  timeframe: string       // 'within3' | '3to6' | '6to12' | 'exploring' | ''
  stage: string           // 'justExploring' | 'actively' | 'ready' | ''
  purchaseType: string    // 'firstHome' | 'anotherHome' | 'investment' | 'land' | ''
  // Step 2: Search Preferences
  propertyTypes: string[] // multi: 'singleFamily' | 'condo' | 'townhome' | 'multiUnit' | 'openToAll'
  mustHaves: string[]     // multi: feature values
  niceToHaves: string[]   // multi: feature values
  hasTargetArea: string   // 'yes' | 'no' | 'open' | ''
  // Step 3: Financing Status
  financingStatus: string // 'notSpoken' | 'begun' | 'preapproved' | 'noFinancing' | 'unsure' | ''
  // Step 4: Timing & Coordination
  housingTiming: string        // 'leaseSoon' | 'monthToMonth' | 'ownNoRush' | 'flexible' | 'urgent' | ''
  mustSellFirst: string        // 'yes' | 'no' | 'unsure' | ''
  showingAvailability: string  // 'flexible' | 'limited' | 'weekendsOnly' | ''
  otherDecisionMakers: string  // 'yes' | 'no' | ''
  movingFlexibility: string    // 'flexible' | 'specific' | 'unsure' | ''
  // Step 5: Priorities & Questions
  priorities: string[]  // multi: priority values
  agentQuestions: string
}

export const EMPTY_BUYER_ANSWERS: BuyerAnswers = {
  timeframe: '',
  stage: '',
  purchaseType: '',
  propertyTypes: [],
  mustHaves: [],
  niceToHaves: [],
  hasTargetArea: '',
  financingStatus: '',
  housingTiming: '',
  mustSellFirst: '',
  showingAvailability: '',
  otherDecisionMakers: '',
  movingFlexibility: '',
  priorities: [],
  agentQuestions: '',
}
