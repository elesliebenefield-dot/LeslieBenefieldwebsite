// Sub-patch 2b — Findings Presenter tests for the trivial 'empty' sibling.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ClassificationResult } from '../src/lib/pipeline/types/classification.ts'
import { presentEmptyFindings } from '../src/lib/pipeline/present/findingsPresenter.ts'

const result: ClassificationResult<'empty'> = {
  checkId: 'empty',
  contractVersion: '1.0.0',
  outcome: 'unverified',
  standardsBasis: { type: 'product-policy', rationale: 'Internal architecture scaffold.' },
  evidenceRefs: [],
  reasoning: 'Architecture scaffold: no real check was evaluated.',
}

test('returns an empty collection — no visitor-facing finding is fabricated for a check that evaluated nothing', () => {
  const findings = presentEmptyFindings(result)
  assert.deepEqual(findings, [])
})

test('output is immutable', () => {
  const findings = presentEmptyFindings(result)
  assert.throws(() => {
    ;(findings as unknown[]).push({})
  })
})

test('deterministic and free of shared mutable state: repeated calls return equal (and the exact same frozen) collection', () => {
  const a = presentEmptyFindings(result)
  const b = presentEmptyFindings(result)
  assert.deepEqual(a, b)
  assert.equal(a, b, 'the frozen empty sentinel may be shared safely since it is immutable')
})

test('does not mutate or retain the input classification result', () => {
  const snapshot = structuredClone(result)
  presentEmptyFindings(result)
  assert.deepEqual(result, snapshot)
})

test('does not depend on audit modules: source contains no reference to AuditRecord, auditRecordBuilder, or the audit/ directory', async () => {
  const { readFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const source = await readFile(path.join(import.meta.dirname, '..', 'src/lib/pipeline/present/findingsPresenter.ts'), 'utf8')
  const importLines = source.split('\n').filter((l) => /^\s*import\b/.test(l))
  for (const forbidden of ['AuditRecord', 'auditRecordBuilder', '/audit/']) {
    assert.ok(importLines.every((l) => !l.includes(forbidden)), `must not import "${forbidden}": ${JSON.stringify(importLines)}`)
  }
})
