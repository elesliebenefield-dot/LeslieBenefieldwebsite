export interface SellerAnswers {
  // Step 1: Selling Plans
  timeframe: string        // 'asap' | '3to6' | '6to12' | 'over12' | 'notSure' | ''
  stage: string            // 'exploring' | 'preparing' | 'ready' | ''
  coordination: string     // 'sellOnly' | 'buyFirst' | 'sellFirst' | 'simultaneously' | 'notSure' | ''
  // Step 2: Property Basics
  propertyType: string     // 'singleFamily' | 'condoTownhome' | 'multiUnit' | 'land' | 'other' | ''
  occupancy: string        // 'ownerOccupied' | 'vacant' | 'tenantOccupied' | 'other' | ''
  ownershipDuration: string // 'under2' | '2to5' | '5to10' | 'over10' | 'preferNotSay' | ''
  // Step 3: Property Preparation
  knownRepairs: string     // 'yesList' | 'maybeFew' | 'noneAware' | 'notSure' | ''
  declutterStatus: string  // 'done' | 'inProgress' | 'planned' | 'notSure' | ''
  recentImprovements: string // 'yesMajor' | 'yesMinor' | 'none' | ''
  accessArrangement: string  // 'straightforward' | 'needsCoordination' | 'haveQuestions' | ''
  prepQuestions: string    // 'yes' | 'no' | 'notSure' | ''
  // Step 4: Information to Gather
  hoaInvolvement: string   // 'yes' | 'no' | 'notSure' | ''
  documentsAvailable: string[] // multi-select: 'surveys' | 'permits' | 'warranties' | 'hoa' | 'taxRecords' | 'none'
  multipleOwners: string   // 'yes' | 'no' | 'possibly' | ''
  timingComplications: string // 'yes' | 'flexible' | 'open' | ''
  // Step 5: Priorities & Next Steps
  priorities: string[]     // multi-select: 'timing' | 'process' | 'preparation' | 'coordination' | 'disruption' | 'listing'
  agentQuestions: string   // optional free text
  name: string             // optional, demo only
  email: string            // optional, demo only
}

export const EMPTY_SELLER_ANSWERS: SellerAnswers = {
  timeframe: '',
  stage: '',
  coordination: '',
  propertyType: '',
  occupancy: '',
  ownershipDuration: '',
  knownRepairs: '',
  declutterStatus: '',
  recentImprovements: '',
  accessArrangement: '',
  prepQuestions: '',
  hoaInvolvement: '',
  documentsAvailable: [],
  multipleOwners: '',
  timingComplications: '',
  priorities: [],
  agentQuestions: '',
  name: '',
  email: '',
}
