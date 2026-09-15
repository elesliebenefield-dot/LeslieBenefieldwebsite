// A curated library of common home-baking ingredients with standard,
// documented volume-to-weight conversions — added so the guided flow can
// resolve the common "sold by weight, measured by volume" case
// automatically (flour, sugar, cocoa, ...) instead of always making the
// baker resolve it by hand. See design.md section 12 for the product
// reasoning behind this correction.
//
// PRIMARY REFERENCE:
//   King Arthur Baking Company — "Ingredient Weight Chart"
//   https://www.kingarthurbaking.com/learn/ingredient-weight-chart
//   Every `standardConversion` value below was captured from that page on
//   2026-09-15. The page itself carries no publication/version date, so
//   this retrieval date is this library's own version marker — re-check
//   the live chart before changing any figure below, and update the date
//   in INGREDIENT_LIBRARY_SOURCE whenever it's refreshed.
//
// An entry WITHOUT a `standardConversion` (e.g. unpacked brown sugar,
// sifted confectioners' sugar, fine sea salt) is still a real, distinctly
// named, searchable ingredient — it just has no trustworthy reference
// weight on the primary chart. Selecting one of these falls back to the
// manual resolution panel, exactly like a fully unrecognized ingredient —
// never a guessed density.
//
// This file is read-only reference data. A baker's own override (entered
// via the "Change" control) is stored on that ingredient's own
// DraftIngredientLine/StoredIngredient, never written back here.
import type { DecimalString, VolumeUnit } from './calc-engine/types.ts'

export const INGREDIENT_LIBRARY_SOURCE =
  'King Arthur Baking Company — Ingredient Weight Chart (kingarthurbaking.com/learn/ingredient-weight-chart), captured 2026-09-15'

export interface StandardConversion {
  volumeUnit: VolumeUnit
  weightGrams: DecimalString
}

export interface CommonIngredientEntry {
  id: string
  name: string
  aliases: string[]
  standardConversion?: StandardConversion
}

export const COMMON_INGREDIENTS: readonly CommonIngredientEntry[] = [
  {
    id: 'all-purpose-flour',
    name: 'All-purpose flour',
    aliases: ['ap flour', 'all purpose flour', 'plain flour'],
    standardConversion: { volumeUnit: 'cup', weightGrams: '120' },
  },
  {
    id: 'bread-flour',
    name: 'Bread flour',
    aliases: ['bread flour'],
    standardConversion: { volumeUnit: 'cup', weightGrams: '120' },
  },
  {
    id: 'cake-flour',
    name: 'Cake flour',
    aliases: ['cake flour', 'unbleached cake flour'],
    standardConversion: { volumeUnit: 'cup', weightGrams: '120' },
  },
  {
    id: 'granulated-sugar',
    name: 'Granulated white sugar',
    aliases: ['white sugar', 'granulated sugar', 'granulated white sugar'],
    standardConversion: { volumeUnit: 'cup', weightGrams: '198' },
  },
  {
    id: 'brown-sugar-packed',
    name: 'Packed light or dark brown sugar',
    aliases: [
      'brown sugar', 'packed brown sugar', 'light brown sugar', 'dark brown sugar',
      'brown sugar packed', 'light brown sugar packed', 'dark brown sugar packed',
    ],
    standardConversion: { volumeUnit: 'cup', weightGrams: '213' },
  },
  {
    // No standard conversion: loose/unpacked brown sugar's volume is not a
    // standardized measurement the way "packed" is — deliberately left
    // without a reference weight rather than guessing one.
    id: 'brown-sugar-unpacked',
    name: 'Brown sugar (lightly spooned, not packed)',
    aliases: ['unpacked brown sugar', 'brown sugar not packed', 'brown sugar unpacked', 'loose brown sugar', 'lightly spooned brown sugar'],
  },
  {
    id: 'confectioners-sugar',
    name: "Confectioners' sugar",
    aliases: ['powdered sugar', 'icing sugar', 'confectioners sugar'],
    standardConversion: { volumeUnit: 'cup', weightGrams: '113' },
  },
  {
    // No standard conversion: the primary reference does not list a
    // sifted-confectioners'-sugar weight (sifting can meaningfully change
    // the volume of the same mass), so this stays a distinct, unconverted
    // entry rather than reusing the unsifted figure.
    id: 'confectioners-sugar-sifted',
    name: "Confectioners' sugar (sifted)",
    aliases: ['sifted powdered sugar', 'sifted confectioners sugar', 'sifted icing sugar'],
  },
  {
    id: 'cocoa-powder',
    name: 'Unsweetened cocoa powder',
    aliases: ['cocoa', 'cocoa powder', 'unsweetened cocoa'],
    standardConversion: { volumeUnit: 'cup', weightGrams: '84' },
  },
  {
    id: 'cornstarch',
    name: 'Cornstarch',
    aliases: ['corn starch'],
    standardConversion: { volumeUnit: 'cup', weightGrams: '112' },
  },
  {
    id: 'rolled-oats',
    name: 'Rolled oats',
    aliases: ['old-fashioned oats', 'old fashioned oats'],
    standardConversion: { volumeUnit: 'cup', weightGrams: '113' },
  },
  {
    id: 'chocolate-chips',
    name: 'Chocolate chips',
    aliases: ['choc chips', 'semisweet chocolate chips', 'semi-sweet chocolate chips'],
    standardConversion: { volumeUnit: 'cup', weightGrams: '170' },
  },
  {
    id: 'butter',
    name: 'Butter',
    aliases: ['unsalted butter', 'salted butter'],
    standardConversion: { volumeUnit: 'cup', weightGrams: '226' },
  },
  {
    id: 'honey',
    name: 'Honey',
    aliases: [],
    standardConversion: { volumeUnit: 'tbsp', weightGrams: '21' },
  },
  {
    id: 'baking-powder',
    name: 'Baking powder',
    aliases: [],
    standardConversion: { volumeUnit: 'tsp', weightGrams: '4' },
  },
  {
    id: 'baking-soda',
    name: 'Baking soda',
    aliases: ['bicarbonate of soda', 'sodium bicarbonate'],
    standardConversion: { volumeUnit: 'tsp', weightGrams: '6' },
  },
  {
    id: 'instant-yeast',
    name: 'Instant yeast',
    aliases: ['rapid rise yeast', 'instant dry yeast'],
    standardConversion: { volumeUnit: 'tsp', weightGrams: '3' },
  },
  {
    id: 'table-salt',
    name: 'Table salt',
    aliases: [],
    standardConversion: { volumeUnit: 'tbsp', weightGrams: '18' },
  },
  {
    // Kosher salt brands are not interchangeable by volume — Diamond
    // Crystal's larger, hollow flakes are roughly half the density of
    // Morton's — so these are two distinct entries, never one generic
    // "kosher salt," per the primary reference's own separate rows.
    id: 'kosher-salt-diamond-crystal',
    name: 'Kosher salt (Diamond Crystal)',
    aliases: ['diamond crystal kosher salt', 'diamond crystal salt'],
    standardConversion: { volumeUnit: 'tbsp', weightGrams: '8' },
  },
  {
    id: 'kosher-salt-mortons',
    name: "Kosher salt (Morton's)",
    aliases: ["morton's kosher salt", 'mortons kosher salt', 'morton kosher salt'],
    standardConversion: { volumeUnit: 'tbsp', weightGrams: '16' },
  },
  {
    // No standard conversion: not on the primary reference chart.
    id: 'fine-sea-salt',
    name: 'Fine sea salt',
    aliases: ['sea salt'],
  },
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/['".]/g, '').replace(/\s+/g, ' ').trim()
}

const MIN_QUERY_LENGTH = 2

// Ranked substring search across each entry's canonical name and its
// aliases — never an automatic selection. Ordering (exact match, then
// "starts with", then any other substring) only affects which suggestion
// is listed first; every matching entry is still returned, so a broad
// query like "flour" or "salt" surfaces every distinct variety rather than
// resolving to one on the baker's behalf.
export function searchCommonIngredients(query: string, limit = 8): CommonIngredientEntry[] {
  const q = normalize(query)
  if (q.length < MIN_QUERY_LENGTH) return []

  const scored: { entry: CommonIngredientEntry; rank: number }[] = []
  for (const entry of COMMON_INGREDIENTS) {
    const candidates = [entry.name, ...entry.aliases].map(normalize)
    let best: number | null = null
    for (const candidate of candidates) {
      if (candidate === q) { best = 0; break }
      if (candidate.startsWith(q)) { best = best === null ? 1 : Math.min(best, 1); continue }
      if (candidate.includes(q)) best = best === null ? 2 : Math.min(best, 2)
    }
    if (best !== null) scored.push({ entry, rank: best })
  }

  scored.sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name))
  return scored.slice(0, limit).map(s => s.entry)
}

export function getCommonIngredientById(id: string): CommonIngredientEntry | undefined {
  return COMMON_INGREDIENTS.find(e => e.id === id)
}
