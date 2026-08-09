// Shared between the browser (CheckPage) and the serverless function (api/check-visual).

export type VisualFindingBucket = 'good' | 'improve' | 'unverified' | 'specialist'
// 'tablet' is currently only ever produced by the overflow check (the only
// one that also measures an intermediate/tablet-width viewport); every other
// check still only ever reports 'desktop' | 'mobile' | 'both'. 'both' means
// "more than one viewport" generally — for overflow specifically, the
// finding's detail text always names every affected viewport explicitly, so
// 'both' there just means "not just one."
export type FindingViewport = 'desktop' | 'tablet' | 'mobile' | 'both'

export interface VisualFinding {
  id: string
  label: string
  bucket: VisualFindingBucket
  viewport: FindingViewport
  detail: string
  /** true = a deterministic measurement; false = a heuristic suggestion best confirmed by a human. */
  measurable: boolean
}

// A closed, fixed set of stage names — nothing dynamic (error messages, paths,
// stack traces, URLs) can ever flow through this field, by construction. Only
// ever populated on preview deployments (VERCEL_ENV === "preview"); production
// responses never include it.
export type DiagnosticStage =
  | 'validating-request'
  | 'resolving-chromium'
  | 'launching-browser'
  | 'creating-page'
  | 'navigating'
  | 'analyzing-page'
  | 'building-report'
  | 'unknown'

export interface VisualCheckSuccess {
  ok: true
  /** Discriminant reserved for a genuine measurement attempt — including a
   *  whole-page render failure (checksCompleted: 0 is still a genuine
   *  attempt that ran and failed, not "nothing was tried"). While the
   *  public V2 route is contained (patch v0.1.1-containment), it never
   *  constructs this — it only ever returns 'withdrawn'. This type and
   *  discriminant exist for when real measurement resumes. */
  status: 'complete'
  finalUrl: string
  score: number
  summary: string
  findings: VisualFinding[]
  checksCompleted: number
  checksTotal: number
  /** Preview-only. Never present in production responses. */
  diagnosticStage?: DiagnosticStage
}

/** The V2 checker is temporarily withdrawn from public use (patch
 *  v0.1.1-containment, see cody-projects/checker-reliability-rebuild) —
 *  no measurement of any kind is attempted for any URL while this is
 *  active. Deliberately excludes score/checksCompleted/checksTotal/
 *  findings entirely (not zeroed — structurally absent) so this can
 *  never be confused with a failed, incomplete, or genuine result. */
export interface VisualCheckWithdrawn {
  ok: true
  status: 'withdrawn'
  message: string
}

export interface VisualCheckFailure {
  ok: false
  error: string
}

export type VisualCheckResponse = VisualCheckSuccess | VisualCheckWithdrawn | VisualCheckFailure

// Single source of truth for the withdrawal copy — read by both the API
// response (so any consumer, not just this site's own UI, gets the honest
// reason) and CheckPage's rendering, so the two can never drift apart.
export const VISUAL_CHECK_WITHDRAWN_LABEL = 'Under independent review'
export const VISUAL_CHECK_WITHDRAWN_MESSAGE =
  'The Visual & Usability Review is temporarily paused while we rebuild and independently validate it for consistency, accuracy, and clear explanations. It will return only after it passes that review. Your Technical Basics results above are unaffected.'

// ─── Scoring weights ──────────────────────────────────────────────
// Sums to 100. Functional-usability checks dominate; cosmetic/manual-judgment
// items (logo proportions, copyright) are capped low so they can't materially
// move the score — see api/check-visual.ts buildVisualReport for how a
// not-assessable check is excluded from both the earned and possible totals
// rather than counted as a failure.
export const VISUAL_CHECK_WEIGHTS = {
  overflow: 14, // High — horizontal overflow
  overlap: 12, // High — overlapping/clipped content, hidden behind header
  navigation: 14, // High — nav availability + mobile usability
  readability: 12, // High — text readability
  tapTargets: 10, // High — tap-target sizing/spacing
  overlays: 6, // High — fixed overlays obstructing content
  images: 8, // Medium — broken/distorted images
  hero: 6, // Medium — hero/above-the-fold usability
  cta: 6, // Medium — calls to action / contact paths
  headings: 4, // Medium — heading structure (serious issues)
  logo: 5, // Low — logo/header proportion suggestions
  copyright: 3, // Low — copyright/footer suggestions
} as const

export type VisualCheckId = keyof typeof VISUAL_CHECK_WEIGHTS

export const VISUAL_CHECK_COUNT = Object.keys(VISUAL_CHECK_WEIGHTS).length

export const VISUAL_CHECK_TOTAL_POINTS = Object.values(VISUAL_CHECK_WEIGHTS).reduce((a, b) => a + b, 0)
