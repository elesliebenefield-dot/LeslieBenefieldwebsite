// Sub-patch 2a/2b — proves the Findings and AuditRecord TYPE files, and
// (now that sub-patch 2b implements them) their RUNTIME sibling functions,
// are true siblings (architecture-dependency-map.md Rule #3): neither
// imports, calls, constructs, or requires the other. Source-scan as an
// additional, non-sole guard — the primary guarantee is the type/import
// structure plus the runtime independence tests below.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ClassificationResult } from '../src/lib/pipeline/types/classification.ts'
import { presentEmptyFindings } from '../src/lib/pipeline/present/findingsPresenter.ts'
import { buildEmptyAuditRecord } from '../src/lib/pipeline/audit/auditRecordBuilder.ts'

const ROOT = path.resolve(import.meta.dirname, '..')

const classification: ClassificationResult<'empty'> = {
  checkId: 'empty',
  contractVersion: '1.0.0',
  outcome: 'unverified',
  standardsBasis: { type: 'product-policy', rationale: 'Internal architecture scaffold.' },
  evidenceRefs: [],
  reasoning: 'Architecture scaffold: no real check was evaluated.',
}

function importLinesOf(source: string): string[] {
  return source.split('\n').filter((line) => /^\s*import\b/.test(line))
}

test('source scan: findings.ts and auditRecord.ts type files do not import each other', async () => {
  const findingsTypesSource = await readFile(path.join(ROOT, 'src/lib/pipeline/types/findings.ts'), 'utf8')
  const auditTypesSource = await readFile(path.join(ROOT, 'src/lib/pipeline/types/auditRecord.ts'), 'utf8')

  // Restricted to actual import statements, not the whole file — both
  // files' doc comments legitimately *name* the other file to explain why
  // the boundary exists, which a whole-file substring search would
  // misflag.
  const findingsImports = importLinesOf(findingsTypesSource)
  const auditImports = importLinesOf(auditTypesSource)
  assert.ok(findingsImports.every((l) => !l.includes('auditRecord')), `findings.ts must not import from auditRecord.ts: ${JSON.stringify(findingsImports)}`)
  assert.ok(auditImports.every((l) => !l.includes('findings')), `auditRecord.ts must not import from findings.ts: ${JSON.stringify(auditImports)}`)
})

test('VisitorFinding and AuditRecord are structurally distinct shapes — no field of one could hold the other', async () => {
  // Static/structural check via the actual exported type names appearing
  // in each file's own field declarations (not just imports) — neither
  // should name the other's type as a field type anywhere in its source.
  const findingsTypesSource = await readFile(path.join(ROOT, 'src/lib/pipeline/types/findings.ts'), 'utf8')
  const auditTypesSource = await readFile(path.join(ROOT, 'src/lib/pipeline/types/auditRecord.ts'), 'utf8')
  const codeOnly = (source: string) =>
    source
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
      .join('\n')

  assert.ok(!codeOnly(findingsTypesSource).includes('AuditRecord'), 'findings.ts code must not name AuditRecord as a field type')
  assert.ok(!codeOnly(auditTypesSource).includes('VisitorFinding'), 'auditRecord.ts code must not name VisitorFinding as a field type')
})

// ─── Sub-patch 2b: runtime sibling-independence proofs ────────────────────

test('both siblings can be called separately from the same classification result, in either order', () => {
  const findingsFirst = presentEmptyFindings(classification)
  const auditAfterFindings = buildEmptyAuditRecord(classification, 'req-order-1', [])
  assert.deepEqual(findingsFirst, [])
  assert.equal(auditAfterFindings.ok, true)

  const auditFirst = buildEmptyAuditRecord(classification, 'req-order-2', [])
  const findingsAfterAudit = presentEmptyFindings(classification)
  assert.equal(auditFirst.ok, true)
  assert.deepEqual(findingsAfterAudit, [])
})

test('neither call is required for the other: calling only one sibling succeeds independently', () => {
  assert.doesNotThrow(() => presentEmptyFindings(classification))
  assert.doesNotThrow(() => buildEmptyAuditRecord(classification, 'req-solo', []))
})

test('no shared mutable state: calling one sibling repeatedly does not change what the other produces', () => {
  const findingsBefore = presentEmptyFindings(classification)
  for (let i = 0; i < 5; i++) buildEmptyAuditRecord(classification, `req-${i}`, [`rule-${i}`])
  const findingsAfter = presentEmptyFindings(classification)
  assert.deepEqual(findingsBefore, findingsAfter)

  const auditBefore = buildEmptyAuditRecord(classification, 'req-stable', [])
  for (let i = 0; i < 5; i++) presentEmptyFindings(classification)
  const auditAfter = buildEmptyAuditRecord(classification, 'req-stable', [])
  assert.deepEqual(auditBefore, auditAfter)
})

test('changing/calling one cannot affect the other: mutating a findings result does not leak into a subsequently built audit record', () => {
  const findings = presentEmptyFindings(classification)
  try {
    ;(findings as unknown[]).push({ fabricated: true })
  } catch {
    // frozen array — expected, proves immutability independently too
  }
  const audit = buildEmptyAuditRecord(classification, 'req-isolation', [])
  assert.equal(audit.ok, true)
  if (audit.ok) assert.deepEqual(audit.value.auditFieldRefs, [])
})

test('imports are independent in both directions at the runtime-module level: findingsPresenter.ts does not import auditRecordBuilder.ts, and vice versa', async () => {
  const presenterSource = await readFile(path.join(ROOT, 'src/lib/pipeline/present/findingsPresenter.ts'), 'utf8')
  const auditSource = await readFile(path.join(ROOT, 'src/lib/pipeline/audit/auditRecordBuilder.ts'), 'utf8')
  const presenterImports = presenterSource.split('\n').filter((l) => /^\s*import\b/.test(l))
  const auditImports = auditSource.split('\n').filter((l) => /^\s*import\b/.test(l))
  assert.ok(presenterImports.every((l) => !l.includes('audit')), `findingsPresenter.ts must not import anything audit-related: ${JSON.stringify(presenterImports)}`)
  assert.ok(auditImports.every((l) => !l.includes('present') && !l.includes('findings')), `auditRecordBuilder.ts must not import anything findings-related: ${JSON.stringify(auditImports)}`)
})
