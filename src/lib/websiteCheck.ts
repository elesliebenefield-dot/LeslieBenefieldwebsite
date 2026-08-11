// Shared between the browser (CheckPage) and the serverless function (api/check-website).
// Keep this file free of Node-only or DOM-only APIs so it works in both environments.

// 'unverified' is for checks the tool genuinely could not assess (e.g. a page that
// renders its content via browser scripts) — distinct from 'improve', which means we
// checked and found something worth fixing.
export type FindingBucket = 'good' | 'improve' | 'specialist' | 'unverified'

export interface Finding {
  id: string
  label: string
  bucket: FindingBucket
  detail: string
  /** Points actually earned for this finding — 0 for an unscored/
   *  informational finding (response-time, ecommerce) or an 'unverified'
   *  check (which is excluded from possiblePoints entirely, not scored
   *  as a failure — see CHECK_WEIGHTS/buildReport). The single source
   *  the score explanation disclosure reads from — never re-derived or
   *  guessed from `bucket` alone, since a partial-credit result (e.g.
   *  page title) can legitimately earn some but not all of a check's
   *  weight. */
  points: number
}

export interface CheckSuccess {
  ok: true
  input: string
  finalUrl: string
  score: number
  summary: string
  findings: Finding[]
  checksCompleted: number
  checksTotal: number
  /** Pre-rounding numerator/denominator behind `score`
   *  (`score = round((rawScore / possiblePoints) * 100)`), exposed so a
   *  later contact/homepage-links fallback resolution (see
   *  api/check-visual.ts, CheckPage.tsx) can correctly renormalize the
   *  displayed score after replacing an 'unverified' finding — using
   *  the exact same formula server-side scoring already applies,
   *  without re-implementing any check's detection/threshold logic on
   *  the client. */
  rawScore: number
  possiblePoints: number
}

export interface CheckFailure {
  ok: false
  error: string
}

export type CheckResponse = CheckSuccess | CheckFailure

// ─── Technical Basics Score: single source of truth ─────────────────
// Score-explanation release: the per-check point weights and score-band
// thresholds/labels used to live only as inline magic numbers in
// api/check-website.ts's buildReport (weights) and CheckPage.tsx's
// scoreLabel (band thresholds) — two independent places that happened
// to agree, with nothing enforcing that they would keep agreeing. Both
// now read from here instead, and so does the "How this score is
// calculated" disclosure (CheckPage.tsx) — one definition, every
// consumer, never a duplicated/hand-reconstructed number. Values are
// UNCHANGED from what buildReport already computed; this only names
// them once.

/** Max points for each of the 7 counted Technical Basics checks — sums
 *  to 100. `response-time`, `ecommerce`, and `content-checks` are
 *  deliberately absent: they're informational/scope findings, never
 *  counted checks (see SCORED_CHECK_COUNT in api/check-website.ts). */
export const CHECK_WEIGHTS: Record<string, number> = {
  availability: 30,
  https: 25,
  mobile: 15,
  title: 10,
  'meta-description': 10,
  contact: 5,
  links: 5,
}

/** Canonical display order for the score explanation disclosure — matches
 *  the order buildReport computes them in. */
export const CHECK_ORDER: string[] = ['availability', 'https', 'mobile', 'title', 'meta-description', 'contact', 'links']

export const CHECK_LABELS: Record<string, string> = {
  availability: 'Homepage availability',
  https: 'HTTPS / secure connection',
  mobile: 'Mobile setup',
  title: 'Page title',
  'meta-description': 'Meta description',
  contact: 'Contact information',
  links: 'Homepage links',
}

/** Ordered highest-threshold-first. The first band whose minScore the
 *  score meets or exceeds is the one that applies — see scoreBandFor. */
export interface ScoreBand {
  minScore: number
  label: string
}

export const SCORE_BANDS: ScoreBand[] = [
  { minScore: 85, label: 'Looking strong' },
  { minScore: 65, label: 'Solid, with room to improve' },
  { minScore: 40, label: 'A few things to address' },
  { minScore: 0, label: 'Needs attention' },
]

export function scoreBandFor(score: number): ScoreBand {
  return SCORE_BANDS.find((band) => score >= band.minScore) ?? SCORE_BANDS[SCORE_BANDS.length - 1]
}

/**
 * Turns ordinary user input ("example.com", "www.example.com", "https://example.com")
 * into a normalized URL, or returns null if the input can't reasonably be a public
 * website address. This is a first-pass UX check only — the server performs the
 * authoritative safety validation before making any request.
 */
export function normalizeWebsiteUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let candidate = trimmed
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const hostname = url.hostname.toLowerCase()
  if (!hostname) return null
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return null
  }

  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')
  if (!isIpLiteral && !hostname.includes('.')) return null

  return url
}

// Scoped to what was actually checked, not the website as a whole — this
// is a limited set of technical basics (see WHAT_WE_CHECK in
// CheckPage.tsx), not a verdict on the site overall. `hasImproveFindings`
// gates the "a few small things"/"room to improve" language — a
// completed, fully-verified result with zero 'improve' findings must
// not claim there's something worth a look when there genuinely isn't
// one. `checksCompleted`/`checksTotal` add a qualification when not
// everything could be verified, so a high score from a partial check
// doesn't read as more complete than it was.
//
// Shared here (not left in api/check-website.ts) so it's ONE calculation
// both the initial static result AND a later contact/links rendered-DOM
// fallback resolution (see src/lib/technicalFallbackMerge.ts) call —
// never two slightly-different summary rules that could disagree about
// the same final findings.
export function summaryFor(score: number, hasImproveFindings: boolean, checksCompleted: number, checksTotal: number): string {
  const incompleteNote = checksCompleted < checksTotal ? ' Not every check could be completed, so this reflects only what was verified.' : ''
  const band = scoreBandFor(score)

  if (band.minScore >= 85) {
    const base = hasImproveFindings ? 'The technical basics checked look great, with just a few small things worth a look.' : 'The technical basics checked look great.'
    return `${base}${incompleteNote}`
  }
  if (band.minScore >= 65) {
    const base = hasImproveFindings ? 'The technical basics checked look solid, with some room to improve.' : 'The technical basics checked look solid.'
    return `${base}${incompleteNote}`
  }
  if (band.minScore >= 40) return `The technical basics checked are working, but a few common issues could be affecting visitors.${incompleteNote}`
  return `The technical basics checked ran into some notable issues. A closer look would likely help.${incompleteNote}`
}
