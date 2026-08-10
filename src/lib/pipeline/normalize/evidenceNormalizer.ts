// Sub-patch 2b — Evidence Normalizer, for the registered 'empty' scaffold
// only. Does not pretend to support any future real check: the whole
// point of this stage is proving RawCapture[] -> NormalizedEvidence flows
// correctly, using the trivial contract 2a already registered.
//
// Pure function only: no deserialization, no browser/DOM/filesystem/
// network/DNS work, no URL-safety authorization, no puppeteer-core type.
// Input is already-typed/validated `RawCapture<'empty'>[]` (hand-authored
// for this sub-patch's tests; a real Capture Service, sub-patch 2d, would
// produce it later).
//
// Reads only `provenance.viewport.name` from each capture — never
// `capturedAt`, `finalUrl`, or any other provenance field. Determinism
// (PRD Criterion #7) requires this stage's output to depend only on
// content a real check would eventually classify, never on capture
// metadata.

import type { RawCapture, ViewportName } from '../types/rawCapture.js'
import { NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION, type NormalizedEvidence } from '../types/normalizedEvidence.js'
import { EMPTY_CHECK_EVIDENCE } from '../types/checkSpecification.js'

/** Canonical, documented viewport order — output `viewportsPresent` is
 *  always sorted to this order, regardless of input array order, so
 *  equivalent capture sets produce deeply equal normalized evidence. */
export const CANONICAL_VIEWPORT_ORDER: readonly ViewportName[] = ['desktop', 'tablet', 'mobile', 'narrow']

export type NormalizeEmptyFailure =
  | { kind: 'empty-capture-collection' }
  | { kind: 'duplicate-viewport'; viewportName: ViewportName }

export type NormalizeEmptyResult = { ok: true; value: NormalizedEvidence<'empty'> } | { ok: false; error: NormalizeEmptyFailure }

/**
 * Merges `incompleteCoverage` across captures with a logical OR per key:
 * if ANY viewport reports a key incomplete, the merged result stays
 * incomplete for that key — this can never silently upgrade an incomplete
 * capture to "complete" (requirement: never flip true -> false). Boolean
 * OR is well-defined for every possible combination of per-viewport
 * values, so there is no genuinely irreconcilable/contradictory case to
 * reject here — unlike duplicate viewport names (rejected below), two
 * viewports disagreeing on one coverage key has an honest, unambiguous
 * combined answer.
 */
function mergeIncompleteCoverage(captures: readonly RawCapture<'empty'>[]): Record<string, boolean> {
  const keys = new Set<string>()
  for (const capture of captures) {
    for (const key of Object.keys(capture.incompleteCoverage)) keys.add(key)
  }
  const merged: Record<string, boolean> = {}
  for (const key of [...keys].sort()) {
    merged[key] = captures.some((capture) => capture.incompleteCoverage[key] === true)
  }
  return merged
}

export function normalizeEmptyEvidence(captures: readonly RawCapture<'empty'>[]): NormalizeEmptyResult {
  // Non-empty input and duplicate-viewport rejection are invariants
  // TypeScript's element type (RawCapture<'empty'>) cannot express on its
  // own — both require a runtime check.
  if (captures.length === 0) {
    return { ok: false, error: { kind: 'empty-capture-collection' } }
  }

  const seen = new Set<ViewportName>()
  for (const capture of captures) {
    const name = capture.provenance.viewport.name
    if (seen.has(name)) {
      return { ok: false, error: { kind: 'duplicate-viewport', viewportName: name } }
    }
    seen.add(name)
  }

  const viewportsPresent = CANONICAL_VIEWPORT_ORDER.filter((name) => seen.has(name))

  return {
    ok: true,
    value: {
      envelopeSchemaVersion: NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION,
      checkId: 'empty',
      sourceCapturePayloadSchemaVersion: '1.0.0',
      evidenceSchemaVersion: '1.0.0',
      evidence: EMPTY_CHECK_EVIDENCE,
      viewportsPresent,
      incompleteCoverage: mergeIncompleteCoverage(captures),
    },
  }
}
