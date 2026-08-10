// Sub-patch 2b — Classification Engine tests for the trivial 'empty'
// classifier, using 2a's bundled ClassificationInput<'empty'> shape.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION, type NormalizedEvidence } from '../src/lib/pipeline/types/normalizedEvidence.ts'
import { EMPTY_CHECK_EVIDENCE } from '../src/lib/pipeline/types/checkSpecification.ts'
import type { ClassificationInput, CheckContract } from '../src/lib/pipeline/types/classification.ts'
import { getEmptyContract } from '../src/lib/pipeline/classify/contractRegistry.ts'
import { classifyEmpty } from '../src/lib/pipeline/classify/classificationEngine.ts'

/** A deliberately MUTABLE contract object, distinct from the frozen
 *  registry contract — needed to prove classifyEmpty doesn't share
 *  references with a caller-supplied contract that isn't frozen. */
function makeMutableEmptyContract(): CheckContract<'empty'> {
  return {
    id: 'empty',
    version: '1.0.0',
    claim: 'test claim',
    standardsBasis: { type: 'product-policy', rationale: 'original rationale' },
    requiredEvidenceFields: [],
  }
}

const evidence: NormalizedEvidence<'empty'> = {
  envelopeSchemaVersion: NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION,
  checkId: 'empty',
  sourceCapturePayloadSchemaVersion: '1.0.0',
  evidenceSchemaVersion: '1.0.0',
  evidence: EMPTY_CHECK_EVIDENCE,
  viewportsPresent: ['desktop'],
  incompleteCoverage: {},
}

const input: ClassificationInput<'empty'> = { evidence, contract: getEmptyContract() }

test('accepts the bundled ClassificationInput<"empty"> shape and produces ClassificationResult<"empty">', () => {
  const result = classifyEmpty(input)
  assert.equal(result.checkId, 'empty')
  assert.equal(result.contractVersion, '1.0.0')
})

test('outcome is always "unverified"', () => {
  assert.equal(classifyEmpty(input).outcome, 'unverified')
})

test('evidenceRefs is always empty, because the empty audit allowlist is never', () => {
  assert.deepEqual(classifyEmpty(input).evidenceRefs, [])
})

test('no scoring fields: the result has no score, weight, or pass/fail field', () => {
  const result = classifyEmpty(input)
  assert.ok(!('score' in result))
  assert.ok(!('weight' in result))
  assert.ok(!('scoreContribution' in result))
  assert.notEqual(result.outcome, 'good', 'the empty scaffold must never default to a "good" outcome')
})

test('reasoning states plainly that no real check or evidence was evaluated', () => {
  const result = classifyEmpty(input)
  assert.match(result.reasoning, /no (real )?(check|evidence)/i)
})

test('deterministic: identical input produces deeply equal output across repeated calls', () => {
  const a = classifyEmpty(input)
  const b = classifyEmpty(input)
  assert.deepEqual(a, b)
})

test('pure: does not mutate its input', () => {
  const snapshot = structuredClone(input)
  classifyEmpty(input)
  assert.deepEqual(input, snapshot)
})

test('standardsBasis is passed through from the contract, unmodified', () => {
  const result = classifyEmpty(input)
  assert.deepEqual(result.standardsBasis, input.contract.standardsBasis)
})

// ─── Mutation-isolation tests ──────────────────────────────────────────

test('mutating the input contract after classification cannot change the result', () => {
  const contract = makeMutableEmptyContract()
  const result = classifyEmpty({ evidence, contract })
  const snapshotBefore = structuredClone(result)

  if (contract.standardsBasis.type === 'product-policy') {
    contract.standardsBasis.rationale = 'MUTATED AFTER THE FACT'
  }

  assert.deepEqual(result, snapshotBefore, 'the already-returned result must be unaffected by mutating the input contract afterward')
})

test('mutating a result cannot change the contract it was built from, or a later classification result', () => {
  const contract = makeMutableEmptyContract()
  const first = classifyEmpty({ evidence, contract })

  if (first.standardsBasis.type === 'product-policy') {
    first.standardsBasis.rationale = 'MUTATED RESULT'
  }

  assert.equal(contract.standardsBasis.type === 'product-policy' && contract.standardsBasis.rationale, 'original rationale', 'mutating a result must not affect the contract it was derived from')

  const second = classifyEmpty({ evidence, contract })
  assert.equal(second.standardsBasis.type === 'product-policy' && second.standardsBasis.rationale, 'original rationale', 'mutating one result must not affect a later, independent classification result')
})

test('consecutive results do not share mutable nested objects or arrays', () => {
  const contract = makeMutableEmptyContract()
  const a = classifyEmpty({ evidence, contract })
  const b = classifyEmpty({ evidence, contract })

  assert.notEqual(a.standardsBasis, b.standardsBasis, 'standardsBasis must be a fresh object per call, not a shared reference')
  assert.notEqual(a.evidenceRefs, b.evidenceRefs, 'evidenceRefs must be a fresh array per call, not a shared reference')
  assert.notEqual(a.standardsBasis, contract.standardsBasis, 'the result must not share the contract\'s own standardsBasis reference either')
})
