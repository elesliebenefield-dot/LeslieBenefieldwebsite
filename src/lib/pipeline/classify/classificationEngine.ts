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

import type { ClassificationInput, ClassificationResult, StandardsBasis } from '../types/classification.js'

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
