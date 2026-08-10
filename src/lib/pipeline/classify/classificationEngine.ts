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
    reasoning = `The page content fits within the ${viewportWidthPx}px mobile viewport — no measurable horizontal overflow.`
  } else if (overflowPx <= OVERFLOW_CLEAR_ISSUE_PX) {
    outcome = 'manual-review-advisory'
    reasoning = `The page content is about ${overflowPx}px wider than the ${viewportWidthPx}px mobile viewport — small enough that it may or may not be visually noticeable; worth a manual look.`
  } else {
    outcome = 'improve'
    reasoning = `The page content is about ${overflowPx}px wider than the ${viewportWidthPx}px mobile viewport, which causes visible horizontal scrolling on a phone.`
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

export function classifyReadability(input: ClassificationInput<'readability'>): ClassificationResult<'readability'> {
  const { minVisibleFontSizePx } = input.evidence.evidence
  let outcome: ClassificationOutcome
  let reasoning: string
  if (minVisibleFontSizePx === null) {
    outcome = 'unverified'
    reasoning = 'No visible text could be measured on this page, so text-size readability could not be checked.'
  } else if (minVisibleFontSizePx < READABILITY_CLEAR_ISSUE_PX) {
    outcome = 'improve'
    reasoning = `The smallest visible text found on the page is ${minVisibleFontSizePx}px, which is hard to read on a phone.`
  } else if (minVisibleFontSizePx < READABILITY_BORDERLINE_PX) {
    outcome = 'manual-review-advisory'
    reasoning = `The smallest visible text found on the page is ${minVisibleFontSizePx}px — on the small side; worth a manual look.`
  } else {
    outcome = 'good'
    reasoning = `The smallest visible text found on the page is ${minVisibleFontSizePx}px, a comfortable reading size.`
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
