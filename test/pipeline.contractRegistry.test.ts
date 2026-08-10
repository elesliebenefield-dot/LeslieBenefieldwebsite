// Sub-patch 2b — Contract Registry tests for the single production
// 'empty' entry.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lookupEmptyContract, getEmptyContract } from '../src/lib/pipeline/classify/contractRegistry.ts'

test('exact empty contract lookup succeeds for the registered (checkId, version) pair', () => {
  const result = lookupEmptyContract('empty', '1.0.0')
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.id, 'empty')
    assert.equal(result.value.version, '1.0.0')
  }
})

test('exact version association: lookupEmptyContract and getEmptyContract agree on the same contract', () => {
  const looked = lookupEmptyContract('empty', '1.0.0')
  const direct = getEmptyContract()
  assert.equal(looked.ok, true)
  if (looked.ok) assert.deepEqual(looked.value, direct)
})

test('immutability: the registered contract\'s own top-level properties cannot be reassigned at runtime', () => {
  const contract = getEmptyContract()
  assert.throws(() => {
    ;(contract as { version: string }).version = '9.9.9'
  })
  assert.equal(getEmptyContract().version, '1.0.0', 'a failed mutation attempt must not have altered the registry')
})

test('nested immutability: requiredEvidenceFields is itself frozen, not just its parent — an in-place push attempt cannot leak into later calls', () => {
  const contract = getEmptyContract()
  assert.throws(() => {
    ;(contract.requiredEvidenceFields as unknown as unknown[]).push('fabricated' as never)
  }, 'requiredEvidenceFields must be frozen, not merely an unreassignable reference')
  assert.deepEqual(getEmptyContract().requiredEvidenceFields, [], 'a failed nested-mutation attempt must not have altered what later calls return')
  assert.deepEqual(lookupEmptyContract('empty', '1.0.0'), { ok: true, value: getEmptyContract() })
})

test('nested immutability: standardsBasis is itself frozen — an in-place property write attempt cannot leak into later calls', () => {
  const contract = getEmptyContract()
  assert.throws(() => {
    if (contract.standardsBasis.type === 'product-policy') {
      ;(contract.standardsBasis as { rationale: string }).rationale = 'fabricated'
    }
  })
  const after = getEmptyContract()
  assert.ok(after.standardsBasis.type === 'product-policy' && after.standardsBasis.rationale !== 'fabricated', 'a failed nested-mutation attempt must not have altered what later calls return')
})

test('repeated lookups after failed mutation attempts remain deeply equal — no drift accumulates across calls', () => {
  const contract = getEmptyContract()
  try {
    ;(contract.requiredEvidenceFields as unknown as unknown[]).push('x')
  } catch {
    // expected — frozen
  }
  const a = lookupEmptyContract('empty', '1.0.0')
  const b = lookupEmptyContract('empty', '1.0.0')
  assert.deepEqual(a, b)
})

test('unknown ID failure: an unregistered checkId is rejected with a typed failure', () => {
  const result = lookupEmptyContract('not-a-real-check', '1.0.0')
  assert.equal(result.ok, false)
  if (!result.ok) assert.deepEqual(result.error, { kind: 'unregistered-check-id', checkId: 'not-a-real-check' })
})

test('unsupported version failure: a registered ID with the wrong version is rejected with a typed failure', () => {
  const result = lookupEmptyContract('empty', '9.9.9')
  assert.equal(result.ok, false)
  if (!result.ok) assert.deepEqual(result.error, { kind: 'unsupported-contract-version', checkId: 'empty', version: '9.9.9' })
})

test('no fake standard, score, weight, or threshold: the contract is an honest architecture-scaffold claim, not a cited accessibility standard', () => {
  const contract = getEmptyContract()
  assert.equal(contract.standardsBasis.type, 'product-policy')
  assert.ok(!('weight' in contract), 'CheckContract<\'empty\'> must have no weight field')
  assert.ok(!('score' in contract), 'no score field')
  assert.ok(!('threshold' in contract), 'no threshold field')
  assert.ok(!/WCAG|ADA|accessibility standard/i.test(contract.claim), 'must not falsely cite an accessibility standard it does not evaluate')
  if (contract.standardsBasis.type === 'product-policy') {
    assert.ok(/scaffold/i.test(contract.standardsBasis.rationale), 'must honestly identify itself as a scaffold')
  }
})
