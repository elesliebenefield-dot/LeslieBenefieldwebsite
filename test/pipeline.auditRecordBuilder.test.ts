// Sub-patch 2b — Audit Record Builder tests for the trivial 'empty'
// sibling.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ClassificationResult } from '../src/lib/pipeline/types/classification.ts'
import { buildEmptyAuditRecord } from '../src/lib/pipeline/audit/auditRecordBuilder.ts'

function makeClassification(): ClassificationResult<'empty'> {
  return {
    checkId: 'empty',
    contractVersion: '1.0.0',
    outcome: 'unverified',
    standardsBasis: { type: 'product-policy', rationale: 'Internal architecture scaffold.' },
    evidenceRefs: [],
    reasoning: 'Architecture scaffold: no real check was evaluated.',
  }
}

const classification = makeClassification()

test('produces a valid, minimized AuditRecord<"empty">', () => {
  const result = buildEmptyAuditRecord(classification, 'req-1', ['no-op-rule'])
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.checkId, 'empty')
    assert.equal(result.value.contractVersion, '1.0.0')
    assert.equal(result.value.requestId, 'req-1')
    assert.deepEqual(result.value.rulesApplied, ['no-op-rule'])
  }
})

test('the duplicated top-level reasoning field is gone: AuditRecord has no reasoning field of its own, only classificationResult.reasoning', () => {
  const result = buildEmptyAuditRecord(classification, 'req-1b', [])
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.ok(!('reasoning' in result.value), 'AuditRecord must not have a top-level reasoning field')
    assert.equal(result.value.classificationResult.reasoning, classification.reasoning, 'reasoning is now sourced solely from classificationResult')
    assert.deepEqual(
      Object.keys(result.value).sort(),
      ['auditFieldRefs', 'checkId', 'classificationResult', 'contractVersion', 'requestId', 'rulesApplied'].sort()
    )
  }
})

test('auditFieldRefs is always empty', () => {
  const result = buildEmptyAuditRecord(classification, 'req-2', [])
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value.auditFieldRefs, [])
})

test('non-blank request-id enforcement: an empty requestId is rejected with a typed failure', () => {
  const result = buildEmptyAuditRecord(classification, '', [])
  assert.equal(result.ok, false)
  if (!result.ok) assert.deepEqual(result.error, { kind: 'empty-request-id' })
})

test('non-blank request-id enforcement: a whitespace-only requestId is rejected, not silently trimmed and accepted', () => {
  const result = buildEmptyAuditRecord(classification, '   ', [])
  assert.equal(result.ok, false)
  if (!result.ok) assert.deepEqual(result.error, { kind: 'empty-request-id' })
})

test('non-blank rule-identifier enforcement: an empty-string rule identifier is rejected with a typed failure naming its index', () => {
  const result = buildEmptyAuditRecord(classification, 'req-3', ['valid-rule', ''])
  assert.equal(result.ok, false)
  if (!result.ok) assert.deepEqual(result.error, { kind: 'empty-rule-identifier', index: 1 })
})

test('non-blank rule-identifier enforcement: a whitespace-only rule identifier is rejected', () => {
  const result = buildEmptyAuditRecord(classification, 'req-3b', ['valid-rule', '\t\n  '])
  assert.equal(result.ok, false)
  if (!result.ok) assert.deepEqual(result.error, { kind: 'empty-rule-identifier', index: 1 })
})

test('a valid, non-blank string with surrounding whitespace is accepted and stored EXACTLY as given — not silently trimmed', () => {
  const result = buildEmptyAuditRecord(classification, '  req-padded  ', ['  rule-padded  '])
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.requestId, '  req-padded  ', 'requestId must be stored verbatim, not trimmed')
    assert.deepEqual(result.value.rulesApplied, ['  rule-padded  '], 'rule identifiers must be stored verbatim, not trimmed')
  }
})

test('an empty rulesApplied array is valid (no rule fired, honestly reflected, not itself an error)', () => {
  const result = buildEmptyAuditRecord(classification, 'req-4', [])
  assert.equal(result.ok, true)
})

test('input arrays are not retained: mutating the caller\'s rulesApplied array after the call does not affect the returned record', () => {
  const rules = ['rule-a']
  const result = buildEmptyAuditRecord(classification, 'req-5', rules)
  assert.equal(result.ok, true)
  rules.push('rule-b')
  if (result.ok) assert.deepEqual(result.value.rulesApplied, ['rule-a'])
})

test('does not accept or embed the full NormalizedEvidence object — only ClassificationResult and request-scoped metadata are inputs', () => {
  assert.equal(buildEmptyAuditRecord.length, 3, 'buildEmptyAuditRecord must take exactly 3 parameters: classification, requestId, rulesApplied')
})

test('no persistence or logging: does not reference fs, a database, or console logging', async () => {
  const { readFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const source = await readFile(path.join(import.meta.dirname, '..', 'src/lib/pipeline/audit/auditRecordBuilder.ts'), 'utf8')
  for (const forbidden of ['node:fs', 'console.log', 'console.error', 'localStorage', 'sessionStorage']) {
    assert.ok(!source.includes(forbidden), `must not reference "${forbidden}"`)
  }
})

test('does not depend on findings modules: source contains no reference to VisitorFinding, findingsPresenter, or the present/ directory', async () => {
  const { readFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const source = await readFile(path.join(import.meta.dirname, '..', 'src/lib/pipeline/audit/auditRecordBuilder.ts'), 'utf8')
  const importLines = source.split('\n').filter((l) => /^\s*import\b/.test(l))
  for (const forbidden of ['VisitorFinding', 'findingsPresenter', '/present/']) {
    assert.ok(importLines.every((l) => !l.includes(forbidden)), `must not import "${forbidden}": ${JSON.stringify(importLines)}`)
  }
})

test('deterministic: identical inputs produce deeply equal output (excluding the fresh-reference nature of nested objects)', () => {
  const a = buildEmptyAuditRecord(classification, 'req-6', ['r'])
  const b = buildEmptyAuditRecord(classification, 'req-6', ['r'])
  assert.deepEqual(a, b)
})

// ─── Mutation-isolation tests ──────────────────────────────────────────

test('mutating the input classification after building cannot alter the audit record', () => {
  const source = makeClassification()
  const result = buildEmptyAuditRecord(source, 'req-mut-1', ['rule'])
  assert.equal(result.ok, true)
  const snapshotBefore = result.ok ? structuredClone(result.value) : null

  if (source.standardsBasis.type === 'product-policy') {
    source.standardsBasis.rationale = 'MUTATED AFTER BUILD'
  }

  if (result.ok) assert.deepEqual(result.value, snapshotBefore, 'the already-built audit record must be unaffected by mutating the input classification afterward')
})

test('mutating one audit record cannot alter its input classification or a later, independently built audit record', () => {
  const source = makeClassification()
  const first = buildEmptyAuditRecord(source, 'req-mut-2', [])
  assert.equal(first.ok, true)

  if (first.ok && first.value.classificationResult.standardsBasis.type === 'product-policy') {
    first.value.classificationResult.standardsBasis.rationale = 'MUTATED RECORD'
  }

  assert.equal(source.standardsBasis.type === 'product-policy' && source.standardsBasis.rationale, 'Internal architecture scaffold.', 'mutating a returned record must not affect the input classification it was built from')

  const second = buildEmptyAuditRecord(source, 'req-mut-2', [])
  assert.equal(
    second.ok && second.value.classificationResult.standardsBasis.type === 'product-policy' && second.value.classificationResult.standardsBasis.rationale,
    'Internal architecture scaffold.',
    'mutating one audit record must not affect a later, independently built one'
  )
})

test('consecutive audit records do not share mutable nested objects', () => {
  const source = makeClassification()
  const a = buildEmptyAuditRecord(source, 'req-mut-3', [])
  const b = buildEmptyAuditRecord(source, 'req-mut-3', [])
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) {
    assert.notEqual(a.value.classificationResult, b.value.classificationResult)
    assert.notEqual(a.value.classificationResult.standardsBasis, b.value.classificationResult.standardsBasis)
    assert.notEqual(a.value.classificationResult.standardsBasis, source.standardsBasis, 'must not share the input classification\'s own standardsBasis reference either')
  }
})
