export type ProductType = 'cake' | 'cupcakes' | 'cookies' | 'cake_pops' | 'other' | ''

export type OccasionType =
  | 'birthday' | 'wedding' | 'baby_shower' | 'graduation' | 'anniversary'
  | 'corporate' | 'holiday' | 'just_because' | 'other' | ''

export type RecipientType = 'myself' | 'gift_one' | 'group_bulk' | ''

export type BudgetRange = 'under_75' | '75_150' | '150_300' | '300_plus' | 'prefer_not_say' | ''

export const PRODUCT_TYPE_LABELS: Record<Exclude<ProductType, ''>, string> = {
  cake: 'Cake',
  cupcakes: 'Cupcakes',
  cookies: 'Cookies',
  cake_pops: 'Cake pops',
  other: 'Other baked goods',
}

export const OCCASION_LABELS: Record<Exclude<OccasionType, ''>, string> = {
  birthday: 'Birthday',
  wedding: 'Wedding',
  baby_shower: 'Baby shower',
  graduation: 'Graduation',
  anniversary: 'Anniversary',
  corporate: 'Corporate or business event',
  holiday: 'Holiday',
  just_because: 'Just because',
  other: 'Other occasion',
}

export const RECIPIENT_LABELS: Record<Exclude<RecipientType, ''>, string> = {
  myself: 'For myself',
  gift_one: 'As a gift for one person',
  group_bulk: 'For a group or bulk order',
}

export const BUDGET_LABELS: Record<Exclude<BudgetRange, ''>, string> = {
  under_75: 'Under $75',
  '75_150': '$75–$150',
  '150_300': '$150–$300',
  '300_plus': '$300 or more',
  prefer_not_say: 'Prefer not to say',
}

export interface BakeryAnswers {
  // Stage 1: What Are You Ordering?
  productType: ProductType
  occasion: OccasionType
  recipient: RecipientType
  // Stage 2: Customize It
  noInscription: boolean
  inscriptionText: string
  colors: string
  openToColorSuggestions: boolean
  styleTheme: string
  sizeQuantity: string
  // Stage 3: Timing & Details
  neededByDate: string
  timingNote: string
  budget: BudgetRange
  dietaryRestrictions: string
  questionsForBaker: string
  // Results screen
  customerName: string
}

export const EMPTY_BAKERY_ANSWERS: BakeryAnswers = {
  productType: '',
  occasion: '',
  recipient: '',
  noInscription: false,
  inscriptionText: '',
  colors: '',
  openToColorSuggestions: false,
  styleTheme: '',
  sizeQuantity: '',
  neededByDate: '',
  timingNote: '',
  budget: '',
  dietaryRestrictions: '',
  questionsForBaker: '',
  customerName: '',
}

export function getSizeQuantityPlaceholder(productType: ProductType): string {
  switch (productType) {
    case 'cake':      return 'e.g., 2-tier round cake, serves approximately 20'
    case 'cupcakes':  return 'e.g., 2 dozen standard cupcakes'
    case 'cookies':   return 'e.g., 3 dozen decorated sugar cookies'
    case 'cake_pops': return 'e.g., 24 cake pops'
    default:          return 'e.g., quantity and approximate serving size'
  }
}
