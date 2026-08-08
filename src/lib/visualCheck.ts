// Shared between the browser (CheckPage) and the serverless function (api/check-visual).

export type VisualFindingBucket = 'good' | 'improve' | 'unverified' | 'specialist'
export type FindingViewport = 'desktop' | 'mobile' | 'both'

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
  | 'creating-context'
  | 'creating-page'
  | 'navigating'
  | 'analyzing-page'
  | 'building-report'
  | 'unknown'

export interface VisualCheckSuccess {
  ok: true
  finalUrl: string
  score: number
  summary: string
  findings: VisualFinding[]
  checksCompleted: number
  checksTotal: number
  /** Preview-only. Never present in production responses. */
  diagnosticStage?: DiagnosticStage
}

export interface VisualCheckFailure {
  ok: false
  error: string
}

export type VisualCheckResponse = VisualCheckSuccess | VisualCheckFailure

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
