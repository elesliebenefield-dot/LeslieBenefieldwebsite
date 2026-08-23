export type ConcernType =
  | 'no_hot_water'
  | 'low_pressure'
  | 'slow_drain'
  | 'backing_up'
  | 'leak'
  | 'running_toilet'
  | 'smell_color'
  | 'water_heater'
  | 'other'
  | ''

export type ActiveWaterStatus = 'flowing_spreading' | 'slow_drip' | 'none_visible' | 'not_sure' | ''

export type HomeArea =
  | 'kitchen'
  | 'main_bathroom'
  | 'other_bathroom'
  | 'laundry'
  | 'basement'
  | 'outdoors'
  | 'multiple'
  | 'not_sure'
  | ''

export type TimelineAnswer = 'today' | 'last_few_days' | 'week_or_two' | 'more_than_two_weeks' | 'not_sure' | ''

export type ChangeAnswer = 'getting_worse' | 'same' | 'comes_and_goes' | 'may_be_settling' | 'not_sure' | ''

export type HistoryAnswer = 'yes_same' | 'yes_different' | 'no_first_time' | 'not_sure' | ''

export type WaterElsewhereAnswer = 'yes_normal' | 'partially' | 'no_unavailable' | 'not_checked' | ''

export type PropertyType = 'single_family' | 'condo_apartment' | 'townhouse_duplex' | 'mobile' | 'other' | ''

export type AccessAnswer = 'easy' | 'need_to_move' | 'tricky' | 'not_sure' | ''

export type RecentWorkAnswer = 'yes' | 'no' | 'not_sure' | ''

export type TimingAnswer = 'asap' | 'next_few_days' | 'flexible' | 'gathering_info' | ''

export const CONCERN_LABELS: Record<Exclude<ConcernType, ''>, string> = {
  no_hot_water:   'No hot water or inconsistent water temperature',
  low_pressure:   'Low or no water pressure',
  slow_drain:     'Slow or blocked drain',
  backing_up:     'Water backing up or overflowing',
  leak:           'Leak, drip, or unexplained damp spot',
  running_toilet: 'Running or constantly refilling toilet',
  smell_color:    'Unusual smell or change in water color',
  water_heater:   'Water heater leak, noise, or other concern',
  other:          "Something else or I'm not sure",
}

export const ACTIVE_WATER_LABELS: Record<Exclude<ActiveWaterStatus, ''>, string> = {
  flowing_spreading: 'Yes — water is actively flowing or spreading',
  slow_drip:         'Yes — a slow or controlled drip',
  none_visible:      'No — no active water visible right now',
  not_sure:          "I'm not sure",
}

export const HOME_AREA_LABELS: Record<Exclude<HomeArea, ''>, string> = {
  kitchen:        'Kitchen',
  main_bathroom:  'Main bathroom',
  other_bathroom: 'Second or additional bathroom',
  laundry:        'Laundry room or utility area',
  basement:       'Basement or crawl space',
  outdoors:       'Outdoors or yard area',
  multiple:       'Throughout the home / multiple areas',
  not_sure:       "I'm not sure",
}

export const TIMELINE_LABELS: Record<Exclude<TimelineAnswer, ''>, string> = {
  today:               'Today',
  last_few_days:       'Within the last few days',
  week_or_two:         'About a week or two ago',
  more_than_two_weeks: 'More than two weeks ago',
  not_sure:            "I'm not sure",
}

export const CHANGE_LABELS: Record<Exclude<ChangeAnswer, ''>, string> = {
  getting_worse:   'It seems to be getting worse',
  same:            'About the same',
  comes_and_goes:  'It comes and goes',
  may_be_settling: 'It may be settling on its own',
  not_sure:        "I'm not sure",
}

export const HISTORY_LABELS: Record<Exclude<HistoryAnswer, ''>, string> = {
  yes_same:      'Yes — the same issue has come back',
  yes_different: 'Something similar, but this seems different',
  no_first_time: 'No — this is the first time',
  not_sure:      "I'm not sure",
}

export const WATER_ELSEWHERE_LABELS: Record<Exclude<WaterElsewhereAnswer, ''>, string> = {
  yes_normal:     'Yes — everything else seems normal',
  partially:      'Partially — some other areas are also affected',
  no_unavailable: 'No — water seems unavailable or off throughout',
  not_checked:    "I haven't checked yet",
}

export const PROPERTY_LABELS: Record<Exclude<PropertyType, ''>, string> = {
  single_family:    'Single-family home',
  condo_apartment:  'Condo or apartment',
  townhouse_duplex: 'Townhouse or duplex',
  mobile:           'Mobile or manufactured home',
  other:            "Other / I'm not sure",
}

export const ACCESS_LABELS: Record<Exclude<AccessAnswer, ''>, string> = {
  easy:         'Yes, easy to reach',
  need_to_move: 'I may need to move some things first',
  tricky:       'Access could be tricky (e.g., crawl space, tight area)',
  not_sure:     "I'm not sure",
}

export const RECENT_WORK_LABELS: Record<Exclude<RecentWorkAnswer, ''>, string> = {
  yes:      'Yes',
  no:       'No',
  not_sure: "I'm not sure",
}

export const TIMING_LABELS: Record<Exclude<TimingAnswer, ''>, string> = {
  asap:          'As soon as possible',
  next_few_days: 'Within the next few days',
  flexible:      "I'm flexible",
  gathering_info: "I'm only gathering information right now",
}

export interface PlumbingAnswers {
  customerName:     string
  concernType:      ConcernType
  observations:     string
  activeWater:      ActiveWaterStatus
  homeArea:         HomeArea
  fixture:          string
  firstNoticed:     TimelineAnswer
  changeAnswer:     ChangeAnswer
  history:          HistoryAnswer
  waterElsewhere:   WaterElsewhereAnswer
  propertyType:     PropertyType
  accessAnswer:     AccessAnswer
  accessNotes:      string
  recentWork:       RecentWorkAnswer
  recentWorkDetail: string
  timing:           TimingAnswer
  questions:        string
}

export const EMPTY_PLUMBING_ANSWERS: PlumbingAnswers = {
  customerName:     '',
  concernType:      '',
  observations:     '',
  activeWater:      '',
  homeArea:         '',
  fixture:          '',
  firstNoticed:     '',
  changeAnswer:     '',
  history:          '',
  waterElsewhere:   '',
  propertyType:     '',
  accessAnswer:     '',
  accessNotes:      '',
  recentWork:       '',
  recentWorkDetail: '',
  timing:           '',
  questions:        '',
}
