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

/**
 * Rubric-audit release: a numeric score/band is only meaningful once
 * Homepage availability is CONFIRMED good — that's the structural
 * precondition every content check (mobile/title/meta/contact/links) is
 * gated behind, so it's the one evidence-based gate for "is there enough
 * here to show an aggregate number." Two failure shapes both fall short
 * of that bar, for different reasons:
 *  - a confirmed non-2xx/3xx response IS real evidence (we know the
 *    status), but only 2 of 7 checks (availability, https) could ever
 *    run from it — too little to represent "the technical basics";
 *  - DNS/timeout/connection/redirect-chain/browser/internal-checker
 *    failures are NOT confirmed evidence about the website at all —
 *    only that this attempt didn't succeed, which may be temporary or a
 *    limitation of this checker.
 * Rather than pick a "less misleading" formula for either case (e.g.
 * renormalizing 25/55 into a headline "45/100" that looks far more
 * comprehensive than 2-of-7 actually is), CheckUnscored omits the score
 * fields entirely — structurally, not just as a zero — so no consumer
 * (the results page, the disclosure, the email) can accidentally render
 * a stale or misleading number. See CheckScored/CheckUnscored below.
 */
export interface CheckScored {
  ok: true
  status: 'scored'
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

/** Homepage availability was not confirmed good — see the rubric-audit
 *  comment above CheckScored for why no score/band is shown here. Every
 *  consumer of `CheckSuccess` must handle this branch explicitly (no
 *  `score` field exists to accidentally read). `findings` still carries
 *  whatever WAS genuinely established (e.g. the actual HTTP status, or
 *  HTTPS if a response was received at all) — this is "no aggregate
 *  number," never "no information." */
export interface CheckUnscored {
  ok: true
  status: 'unscored'
  input: string
  finalUrl: string
  summary: string
  findings: Finding[]
  checksCompleted: number
  checksTotal: number
}

export type CheckSuccess = CheckScored | CheckUnscored

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
 *  counted checks (see SCORED_CHECK_COUNT in api/check-website.ts).
 *
 *  Rubric-audit release: these numbers are this checkup's OWN
 *  prioritization — not an industry standard, not a benchmark validated
 *  against real outcomes, and not the only reasonable way to weight
 *  these seven items. They reflect two judgments made when this tool
 *  was built: how essential each item is to a basic, working, secure
 *  site, and how confidently this specific automated check can actually
 *  establish it (a deterministic fact like an HTTP status or a protocol
 *  is weighted differently than a heuristic signal like regex-based
 *  contact-info detection or a sampled link crawl). A different tool
 *  could reasonably weight these differently — this is disclosed to
 *  users verbatim in CheckPage.tsx's score-explanation panel, not just
 *  asserted here. */
export const CHECK_WEIGHTS: Record<string, number> = {
  availability: 30,
  https: 25,
  mobile: 15,
  title: 10,
  'meta-description': 10,
  contact: 5,
  links: 5,
}

/** This tool's own coarse length cutoffs for "probably long enough to
 *  be useful" — not a search-engine requirement, not a guarantee that
 *  crossing them means genuine quality, and not a claim that falling
 *  short means the title/description is actually bad. Single source of
 *  truth for both api/check-website.ts's detection logic and the
 *  disclosure text that explains it to users. */
export const TITLE_MIN_LENGTH = 10
export const META_DESCRIPTION_MIN_LENGTH = 50

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

/** True when `raw` already names http:// or https:// explicitly, before
 *  any normalization. A bare hostname ("example.com") does not — see
 *  normalizeWebsiteUrl, which defaults it to https. Protocol-fallback
 *  release: api/check-website.ts uses this (on the RAW input, not the
 *  normalized URL, which always has SOME protocol by the time it's
 *  built) to decide whether an HTTPS connection failure is eligible for
 *  an automatic HTTP retry — only when the user never chose a protocol
 *  themselves. */
export function hasExplicitProtocol(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim())
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
  if (!hasExplicitProtocol(candidate)) {
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

/** The summary for a CheckUnscored result — see the rubric-audit
 *  comment above CheckScored for why no score exists to summarize
 *  instead. `checksCompleted`/`checksTotal` are always echoed in the
 *  message text as well as shown separately in the UI, so the
 *  "prominent completed-check count" requirement holds even if a
 *  consumer only reads one of the two. */
export function unscoredSummaryFor(reason: 'confirmed-error-response' | 'checker-unavailable', checksCompleted: number, checksTotal: number): string {
  if (reason === 'confirmed-error-response') {
    return `Only ${checksCompleted} of ${checksTotal} technical basics could be checked, because your homepage didn’t return a normal response. See the details below.`
  }
  return `We weren’t able to complete this check for your website (${checksCompleted} of ${checksTotal} checks completed). This may be temporary, a limitation of this automated checker, or an issue reaching your site — it doesn’t necessarily mean your website has a problem. Please try again in a few minutes.`
}

/**
 * The exact user-facing status for one finding, precise enough to
 * distinguish partial credit from zero credit — the gap the rubric
 * audit found (a 5/10 short title and a 0/10 missing title both showed
 * "Needs improvement"). Reads directly off `points`, never re-derives
 * or guesses a state from `bucket` alone.
 */
export function checkStatusLabel(finding: Finding): string {
  switch (finding.bucket) {
    case 'unverified':
      return 'Unable to verify'
    case 'specialist':
      return 'Outside scope'
    case 'good':
      return 'Passed'
    case 'improve':
      return finding.points > 0 ? 'Partially met' : 'Not met'
  }
}
