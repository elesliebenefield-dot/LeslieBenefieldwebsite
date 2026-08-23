// ─── Event type ───────────────────────────────────────────────────────────────
export type EventType =
  | 'birthday_celebration'
  | 'corporate_workplace'
  | 'wedding_reception'
  | 'festival_fair_market'
  | 'school_nonprofit'
  | 'community_neighborhood'
  | 'other'
  | ''

export const EVENT_TYPE_LABELS: Record<Exclude<EventType, ''>, string> = {
  birthday_celebration:   'Birthday, party, or private celebration',
  corporate_workplace:    'Corporate or workplace event',
  wedding_reception:      'Wedding or reception',
  festival_fair_market:   'Festival, fair, or outdoor market',
  school_nonprofit:       'School or nonprofit event',
  community_neighborhood: 'Community or neighborhood event',
  other:                  'Other or I\'m not sure',
}

// ─── Date status ──────────────────────────────────────────────────────────────
export type EventDateStatus = 'confirmed' | 'tbd' | ''

export const EVENT_DATE_STATUS_LABELS: Record<Exclude<EventDateStatus, ''>, string> = {
  confirmed: 'Yes — I have a specific date',
  tbd:       'Date not confirmed yet',
}

// ─── Public / private ─────────────────────────────────────────────────────────
export type PublicPrivate = 'public' | 'private' | 'not_sure' | ''

export const PUBLIC_PRIVATE_LABELS: Record<Exclude<PublicPrivate, ''>, string> = {
  public:   'Public — open to the general public',
  private:  'Private — invitation-only or closed event',
  not_sure: 'I\'m not sure',
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export type AttendanceRange =
  | 'under_25'
  | '25_to_75'
  | '75_to_150'
  | '150_to_300'
  | 'over_300'
  | 'not_sure'
  | ''

export const ATTENDANCE_LABELS: Record<Exclude<AttendanceRange, ''>, string> = {
  under_25:   'Fewer than 25 guests',
  '25_to_75': '25–75 guests',
  '75_to_150':'75–150 guests',
  '150_to_300':'150–300 guests',
  over_300:   'More than 300 guests',
  not_sure:   'I\'m not sure',
}

// ─── Service window ───────────────────────────────────────────────────────────
export type ServiceWindow =
  | 'morning'
  | 'lunch_midday'
  | 'afternoon'
  | 'evening'
  | 'multiple_all_day'
  | 'not_sure'
  | ''

export const SERVICE_WINDOW_LABELS: Record<Exclude<ServiceWindow, ''>, string> = {
  morning:         'Morning service (before noon)',
  lunch_midday:    'Lunch or midday service',
  afternoon:       'Afternoon service',
  evening:         'Evening service (after 5pm)',
  multiple_all_day:'Multiple periods or all day',
  not_sure:        'I\'m not sure',
}

// ─── Setting type ─────────────────────────────────────────────────────────────
export type SettingType = 'outdoor' | 'indoor' | 'covered_tent' | 'not_sure' | ''

export const SETTING_TYPE_LABELS: Record<Exclude<SettingType, ''>, string> = {
  outdoor:     'Outdoors — open air',
  indoor:      'Indoors or under cover',
  covered_tent:'Covered or tent area',
  not_sure:    'I\'m not sure',
}

// ─── Service type (multi-select) ──────────────────────────────────────────────
export type ServiceType =
  | 'full_meals'
  | 'light_meals'
  | 'snacks'
  | 'baked_goods'
  | 'desserts'
  | 'coffee'
  | 'nonalcoholic'
  | 'frozen_treats'
  | 'other'

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  full_meals:    'Full meals or entrées',
  light_meals:   'Light meals or sandwiches',
  snacks:        'Snacks or small bites',
  baked_goods:   'Baked goods or pastries',
  desserts:      'Desserts or sweets',
  coffee:        'Coffee, espresso, or hot drinks',
  nonalcoholic:  'Nonalcoholic beverages',
  frozen_treats: 'Frozen treats or ice cream',
  other:         'Other or I\'m not sure',
}

export const ALL_SERVICE_TYPES: ServiceType[] = [
  'full_meals',
  'light_meals',
  'snacks',
  'baked_goods',
  'desserts',
  'coffee',
  'nonalcoholic',
  'frozen_treats',
  'other',
]

// ─── Payment arrangement ──────────────────────────────────────────────────────
export type PaymentArrangement = 'host_paid' | 'guest_paid' | 'combination' | 'not_sure' | ''

export const PAYMENT_LABELS: Record<Exclude<PaymentArrangement, ''>, string> = {
  host_paid:   'The event host covers everything (host-paid)',
  guest_paid:  'Guests pay individually at the truck',
  combination: 'A mix — some items covered, some purchased by guests',
  not_sure:    'I\'m not sure yet',
}

// ─── Budget ───────────────────────────────────────────────────────────────────
export type BudgetRange = 'under_500' | '500_to_1500' | '1500_to_3000' | 'over_3000' | 'prefer_not_say' | ''

export const BUDGET_LABELS: Record<Exclude<BudgetRange, ''>, string> = {
  under_500:      'Under $500',
  '500_to_1500':  '$500–$1,500',
  '1500_to_3000': '$1,500–$3,000',
  over_3000:      '$3,000 or more',
  prefer_not_say: 'Prefer not to say',
}

// ─── Setup space ──────────────────────────────────────────────────────────────
export type SetupSpaceType =
  | 'yes_dedicated'
  | 'believe_so'
  | 'limited_shared'
  | 'not_sure'
  | ''

export const SETUP_SPACE_LABELS: Record<Exclude<SetupSpaceType, ''>, string> = {
  yes_dedicated:  'Yes — there is a dedicated setup area',
  believe_so:     'I believe so, but I\'m not certain',
  limited_shared: 'Space may be limited or shared with other vendors',
  not_sure:       'I\'m not sure',
}

// ─── Vehicle access ───────────────────────────────────────────────────────────
export type VehicleAccess = 'easy' | 'tight' | 'depends_on_size' | 'not_sure' | ''

export const VEHICLE_ACCESS_LABELS: Record<Exclude<VehicleAccess, ''>, string> = {
  easy:          'Yes — easy street or parking lot access',
  tight:         'Access may be tight (narrow entrance, low clearance, or rough terrain)',
  depends_on_size: 'Depends on vehicle size — I can share more details',
  not_sure:      'I\'m not sure',
}

// ─── Surface type ─────────────────────────────────────────────────────────────
export type SurfaceType = 'paved' | 'gravel_dirt' | 'grass_turf' | 'not_sure' | ''

export const SURFACE_TYPE_LABELS: Record<Exclude<SurfaceType, ''>, string> = {
  paved:       'Paved — asphalt or concrete',
  gravel_dirt: 'Gravel or packed dirt',
  grass_turf:  'Grass or turf',
  not_sure:    'I\'m not sure',
}

// ─── Utility answer ───────────────────────────────────────────────────────────
export type UtilityAnswer = 'yes' | 'no' | 'not_sure' | ''

export const UTILITY_LABELS: Record<Exclude<UtilityAnswer, ''>, string> = {
  yes:      'Yes',
  no:       'No',
  not_sure: 'I\'m not sure',
}

// ─── Setup time ───────────────────────────────────────────────────────────────
export type SetupTime =
  | 'thirty_min'
  | 'one_hour'
  | 'two_hours'
  | 'more_than_two'
  | 'not_sure'
  | ''

export const SETUP_TIME_LABELS: Record<Exclude<SetupTime, ''>, string> = {
  thirty_min:    'About 30 minutes or less',
  one_hour:      'Up to 1 hour',
  two_hours:     'Up to 2 hours',
  more_than_two: 'More than 2 hours needed',
  not_sure:      'I\'m not sure',
}

// ─── Answers interface ────────────────────────────────────────────────────────
export interface FoodTruckAnswers {
  // Stage 1 — Event basics
  eventType:       EventType
  eventDateStatus: EventDateStatus
  eventDate:       string
  dateNotes:       string
  venueName:       string
  isPublic:        PublicPrivate
  attendance:      AttendanceRange
  serviceWindow:   ServiceWindow
  specificHours:   string
  settingType:     SettingType
  // Stage 2 — Food and service
  serviceTypes:    ServiceType[]
  additionalInterests: string
  paymentArrangement: PaymentArrangement
  budget:          BudgetRange
  dietaryNotes:    string
  guestsServed:    string
  // Stage 3 — Venue and logistics
  setupSpace:      SetupSpaceType
  vehicleAccess:   VehicleAccess
  surfaceType:     SurfaceType
  electricity:     UtilityAnswer
  waterAccess:     UtilityAnswer
  venueRestrictions: string
  dayOfContact:    string
  setupBreakdown:  SetupTime
  questions:       string
  // Results
  organizerName:   string
}

export const EMPTY_FOOD_TRUCK_ANSWERS: FoodTruckAnswers = {
  eventType:           '',
  eventDateStatus:     '',
  eventDate:           '',
  dateNotes:           '',
  venueName:           '',
  isPublic:            '',
  attendance:          '',
  serviceWindow:       '',
  specificHours:       '',
  settingType:         '',
  serviceTypes:        [],
  additionalInterests: '',
  paymentArrangement:  '',
  budget:              '',
  dietaryNotes:        '',
  guestsServed:        '',
  setupSpace:          '',
  vehicleAccess:       '',
  surfaceType:         '',
  electricity:         '',
  waterAccess:         '',
  venueRestrictions:   '',
  dayOfContact:        '',
  setupBreakdown:      '',
  questions:           '',
  organizerName:       '',
}
