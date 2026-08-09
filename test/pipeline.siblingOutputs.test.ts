// Sub-patch 2a — proves the Findings and AuditRecord TYPE files are true
// siblings (architecture-dependency-map.md Rule #3): neither imports the
// other. This is a types-only guarantee in 2a — no Findings Presenter or
// Audit Record Builder RUNTIME exists yet (that's sub-patch 2b); the
// stronger runtime version of this test (constructing both from the same
// ClassificationResult and asserting no shared mutable state) belongs to
// 2b, once those functions exist. Source-scan as an additional,
// non-sole guard — the primary guarantee is that neither file's own type
// definitions reference the other's exported type.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

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
