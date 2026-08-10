// Sub-patch 2b — the smallest runtime registry needed for the production
// `empty` contract. Not a generalized dispatch framework: one frozen
// constant, typed directly against 2a's `CheckContract<'empty'>` (no
// unsafe cast — a plain type annotation, checked structurally), plus a
// fail-closed lookup by (checkId, version).
//
// No generic registry machinery is introduced here beyond what 2a already
// provides (`CheckContract<K>`) — there is nothing new to prove preserves
// ID/version correlation, since this module consumes 2a's own correlation-
// preserving type directly rather than building a parallel mechanism.

import type { CheckId } from '../types/checkSpecification.js'
import type { CheckContract } from '../types/classification.js'

/**
 * Standards basis honestly identifies this as an architecture scaffold —
 * it does not cite an accessibility/usability standard this contract
 * doesn't evaluate. No weight, score, or threshold: Milestone 2 makes no
 * scoring decision (see classification.ts's header comment).
 */
const EMPTY_CONTRACT: CheckContract<'empty'> = Object.freeze({
  id: 'empty',
  version: '1.0.0',
  claim:
    'Milestone 2 architecture scaffold — proves the Normalizer -> Classification Engine -> sibling-output pipeline shape end-to-end. Not a real check: no evidence is evaluated and no accessibility or usability claim is made.',
  standardsBasis: Object.freeze({
    type: 'product-policy',
    rationale: 'Internal architecture scaffold, not a standards-based check. No accessibility or usability standard is evaluated or claimed.',
  }),
  // Corrected: the outer Object.freeze() protects only the top-level
  // property REFERENCES (this array can't be swapped for a different one)
  // — it does not freeze the array's own contents. `never[]` typing means
  // no VALID code can push a real element onto it, but a runtime bypass
  // (e.g. `as any`) still could, mutating the array in place and
  // corrupting every future call's view of it too, since it's the same
  // shared reference. Frozen explicitly so that isn't possible either.
  requiredEvidenceFields: Object.freeze([]),
})

export type ContractLookupFailure = { kind: 'unregistered-check-id'; checkId: string } | { kind: 'unsupported-contract-version'; checkId: CheckId; version: string }

export type ContractLookupResult = { ok: true; value: CheckContract<'empty'> } | { ok: false; error: ContractLookupFailure }

/** Fail-closed by (checkId, version): an unregistered ID or an
 *  unsupported version for a registered ID are both rejected, never
 *  silently coerced to the nearest known entry. */
export function lookupEmptyContract(checkId: string, version: string): ContractLookupResult {
  if (checkId !== 'empty') {
    return { ok: false, error: { kind: 'unregistered-check-id', checkId } }
  }
  if (version !== EMPTY_CONTRACT.version) {
    return { ok: false, error: { kind: 'unsupported-contract-version', checkId: 'empty', version } }
  }
  return { ok: true, value: EMPTY_CONTRACT }
}

/** Direct accessor for callers that already know they want the one
 *  registered contract (e.g. hand-authored test setup). */
export function getEmptyContract(): CheckContract<'empty'> {
  return EMPTY_CONTRACT
}
