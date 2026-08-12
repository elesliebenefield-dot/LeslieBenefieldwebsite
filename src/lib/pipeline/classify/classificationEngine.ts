// Sub-patch 2b — trivial/empty Classification Engine. Proves the
// NormalizedEvidence -> ClassificationResult relationship only, for the
// single registered 'empty' check. No real check classification logic
// (Milestone 3+); no generic dispatch framework beyond what this one path
// needs.
//
// Accepts 2a's bundled, correlation-safe `ClassificationInput<'empty'>`
// (one object, not two independently-inferred parameters) — see
// classification.ts's own header comment on why two separate parameters
// are unsafe under generic inference. Since evidence and contract arrive
// pre-correlated by the type itself, there is nothing left to cross-check
// at runtime.
//
// Must never import puppeteer-core or any Capture Service module — see
// architecture-dependency-map.md Rule #2 and
// test/pipeline.importBoundaries.test.ts.

import type { ClassificationInput, ClassificationOutcome, ClassificationResult, StandardsBasis } from '../types/classification.js'

/**
 * Corrected: a prior revision assigned `input.contract.standardsBasis`
 * directly into the result, letting the caller's contract object and the
 * returned classification result share the same nested object — mutating
 * one after the fact would silently mutate the other. Reconstructs a
 * fresh object for whichever discriminated-union member it actually is,
 * so the two never share a reference.
 */
function cloneStandardsBasis(basis: StandardsBasis): StandardsBasis {
  return basis.type === 'standard' ? { type: 'standard', citation: basis.citation } : { type: 'product-policy', rationale: basis.rationale }
}

export function classifyEmpty(input: ClassificationInput<'empty'>): ClassificationResult<'empty'> {
  return {
    checkId: input.contract.id,
    contractVersion: input.contract.version,
    outcome: 'unverified',
    standardsBasis: cloneStandardsBasis(input.contract.standardsBasis),
    evidenceRefs: [],
    reasoning: 'Architecture scaffold: no real check was evaluated and no evidence was consulted. This result exists only to prove the pipeline shape end-to-end.',
  }
}

// ─── First real checks: overflow, readability. Thresholds below are an
// honest, disclosed PRODUCT-POLICY heuristic (see contractRegistry.ts's
// standardsBasis for each) — neither check cites a standard, because
// neither threshold comes from one (there is no WCAG-mandated minimum
// font size, and horizontal-overflow tolerance is a product judgment
// call, not a spec). Never claim WCAG compliance or a numeric score;
// `outcome` is the only signal, presented in plain English by
// findingsPresenter.ts. ───────────────────────────────────────────────

/** <= this many px of overflow is treated as measurement noise (sub-
 *  pixel rounding), not a real issue. */
const OVERFLOW_TOLERANCE_PX = 2
/** Beyond this many px, horizontal scrolling on a phone is clearly
 *  visible — a confident "likely opportunity". Between the tolerance
 *  and this line is genuinely borderline, not confidently either way. */
const OVERFLOW_CLEAR_ISSUE_PX = 20

export function classifyOverflow(input: ClassificationInput<'overflow'>): ClassificationResult<'overflow'> {
  const { overflowPx, viewportWidthPx } = input.evidence.evidence
  let outcome: ClassificationOutcome
  let reasoning: string
  if (overflowPx <= OVERFLOW_TOLERANCE_PX) {
    outcome = 'good'
    reasoning = `Your page fits within a typical phone screen (${viewportWidthPx}px wide) — nothing appears to require sideways scrolling.`
  } else if (overflowPx <= OVERFLOW_CLEAR_ISSUE_PX) {
    outcome = 'manual-review-advisory'
    reasoning = `Part of your page is about ${overflowPx}px wider than a typical phone screen (${viewportWidthPx}px) — small enough that it may or may not be noticeable to visitors; worth a manual look on an actual phone.`
  } else {
    outcome = 'improve'
    reasoning = `Part of your page is about ${overflowPx}px wider than a typical phone screen (${viewportWidthPx}px), which causes visible sideways scrolling on a phone.`
  }
  return {
    checkId: input.contract.id,
    contractVersion: input.contract.version,
    outcome,
    standardsBasis: cloneStandardsBasis(input.contract.standardsBasis),
    evidenceRefs: [],
    reasoning,
  }
}

/** Below this, text is clearly hard to read on a phone — a confident
 *  "likely opportunity". */
const READABILITY_CLEAR_ISSUE_PX = 11
/** Below this (and at/above the clear-issue line), text is on the small
 *  side but not confidently a problem — borderline. */
const READABILITY_BORDERLINE_PX = 14

/** Rounds to at most one decimal place for display, dropping a trailing
 *  ".0" — e.g. 10.6667 -> "10.7px", 11 -> "11px". Display only:
 *  classification above always compares the raw, unrounded value, so a
 *  measurement that rounds up to a clean threshold number never changes
 *  which band it falls in. */
function formatPx(px: number): string {
  const rounded = Math.round(px * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}px` : `${rounded.toFixed(1)}px`
}

/**
 * Only ever appended, never used to derive `outcome` — footer/utility
 * text is context, not a finding of its own. Only mentioned when it's
 * actually smaller than the meaningful minimum (otherwise it isn't
 * noteworthy). Exceptionally tiny footer text (below the same
 * clear-issue line used for meaningful content) is still phrased
 * cautiously — "worth a manual look" — never as a definite defect.
 */
function footerContextClause(footerMinVisibleFontSizePx: number | null, meaningfulMinVisibleFontSizePx: number): string {
  if (footerMinVisibleFontSizePx === null || footerMinVisibleFontSizePx >= meaningfulMinVisibleFontSizePx) return ''
  const formatted = formatPx(footerMinVisibleFontSizePx)
  return footerMinVisibleFontSizePx < READABILITY_CLEAR_ISSUE_PX
    ? ` We also noticed smaller ${formatted} text in the footer or utility area — worth a manual look, though it wasn’t used to judge your page’s main readability.`
    : ` We also noticed smaller ${formatted} text in the footer or utility area, which wasn’t used to judge your page’s main readability.`
}

export function classifyReadability(input: ClassificationInput<'readability'>): ClassificationResult<'readability'> {
  const { minVisibleFontSizePx, footerMinVisibleFontSizePx } = input.evidence.evidence
  let outcome: ClassificationOutcome
  let reasoning: string
  if (minVisibleFontSizePx === null) {
    outcome = 'unverified'
    reasoning =
      footerMinVisibleFontSizePx === null
        ? 'We couldn’t find any visible text to measure on this page, so we couldn’t check text size.'
        : `We couldn’t find enough main content text to confidently check text size — only smaller footer or utility text (like a copyright line), which we don’t judge your page by. The smallest text found overall was ${formatPx(footerMinVisibleFontSizePx)}.`
  } else if (minVisibleFontSizePx < READABILITY_CLEAR_ISSUE_PX) {
    outcome = 'improve'
    reasoning = `The smallest text we found in your main content is ${formatPx(minVisibleFontSizePx)} — small enough that it may be hard to read on a phone.${footerContextClause(footerMinVisibleFontSizePx, minVisibleFontSizePx)}`
  } else if (minVisibleFontSizePx < READABILITY_BORDERLINE_PX) {
    outcome = 'manual-review-advisory'
    reasoning = `The smallest text we found in your main content is ${formatPx(minVisibleFontSizePx)} — on the small side; worth a manual look.${footerContextClause(footerMinVisibleFontSizePx, minVisibleFontSizePx)}`
  } else {
    outcome = 'good'
    reasoning = `The smallest text we found in your main content is ${formatPx(minVisibleFontSizePx)} — a comfortable size to read.${footerContextClause(footerMinVisibleFontSizePx, minVisibleFontSizePx)}`
  }
  return {
    checkId: input.contract.id,
    contractVersion: input.contract.version,
    outcome,
    standardsBasis: cloneStandardsBasis(input.contract.standardsBasis),
    evidenceRefs: [],
    reasoning,
  }
}
