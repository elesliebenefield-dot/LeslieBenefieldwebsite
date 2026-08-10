// Sub-patch 2a — scope audit: proves no 2b-2g implementation exists on
// this branch. Per patch.md Phase 11's sub-patch table, 2a's own file
// scope is `src/lib/pipeline/types/*.ts` (types only, no logic) plus a
// runtime validation module for deserialized-boundary parsing and
// compile-time-proof files — nothing else. This test names every
// directory/file that belongs to a later sub-patch and asserts none of
// them exist yet.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, access } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

async function listFilesRecursive(dir: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

test('2b (pure pipeline skeleton + sibling outputs) contains exactly its approved files — one module per stage, no more', async () => {
  const expected: Record<string, string[]> = {
    'src/lib/pipeline/normalize': ['src/lib/pipeline/normalize/evidenceNormalizer.ts'],
    'src/lib/pipeline/classify': ['src/lib/pipeline/classify/classificationEngine.ts', 'src/lib/pipeline/classify/contractRegistry.ts'],
    'src/lib/pipeline/present': ['src/lib/pipeline/present/findingsPresenter.ts'],
    'src/lib/pipeline/audit': ['src/lib/pipeline/audit/auditRecordBuilder.ts'],
  }
  for (const [dir, expectedFiles] of Object.entries(expected)) {
    const files = (await listFilesRecursive(path.join(ROOT, dir))).map((f) => path.relative(ROOT, f))
    assert.deepEqual(files.sort(), expectedFiles.sort(), `${dir} must contain exactly its approved 2b file(s)`)
  }
})

test('2c (fixtures + invariant framework) contains exactly its approved files — no more', async () => {
  const invariantsFiles = (await listFilesRecursive(path.join(ROOT, 'src/lib/offline/invariants'))).map((f) => path.relative(ROOT, f))
  assert.deepEqual(
    invariantsFiles.sort(),
    [
      'src/lib/offline/invariants/__compileTimeChecks.ts',
      'src/lib/offline/invariants/benchmarkFixture.ts',
      'src/lib/offline/invariants/invariantAssertions.ts',
      'src/lib/offline/invariants/metamorphicRunner.ts',
    ].sort(),
    'src/lib/offline/invariants/ must contain exactly these 2c files'
  )
  assert.equal(await exists(path.join(ROOT, 'test/fixtures/visual-checker/README.md')), true)
  const benchmarkFiles = (await listFilesRecursive(path.join(ROOT, 'test/fixtures/visual-checker/benchmark'))).map((f) => path.relative(ROOT, f))
  assert.deepEqual(benchmarkFiles.sort(), ['test/fixtures/visual-checker/benchmark/empty-scaffold.v1.json'].sort(), 'the benchmark/ directory must contain exactly the one Milestone 2 synthetic fixture — no real-check fixture content')
})

test('2d (practical capture safety boundary) contains exactly its approved files — no more', async () => {
  const files = (await listFilesRecursive(path.join(ROOT, 'src/lib/pipeline/capture'))).map((f) => path.relative(ROOT, f))
  assert.deepEqual(
    files.sort(),
    [
      'src/lib/pipeline/capture/networkSafety.ts',
      'src/lib/pipeline/capture/connectionBindingProxy.ts',
      'src/lib/pipeline/capture/browserLifecycle.ts',
      'src/lib/pipeline/capture/pageHardening.ts',
    ].sort(),
    'src/lib/pipeline/capture/ must contain exactly these 2d files — deliberately no captureService.ts (RawCapture-producing orchestration is out of the practical-2d reset\'s scope; see patch.md\'s Scope Reset section)'
  )
})

test('2e (oracle adapters + comparison mapping) is not implemented: no adapter or mapper file exists under offline/oracle/, only types and its compile-time proof', async () => {
  const files = (await listFilesRecursive(path.join(ROOT, 'src/lib/offline/oracle'))).map((f) => path.relative(ROOT, f))
  assert.deepEqual(
    files.sort(),
    ['src/lib/offline/oracle/__compileTimeChecks.ts', 'src/lib/offline/oracle/types.ts'].sort(),
    'src/lib/offline/oracle/ must contain only the 2a type/compile-time-proof files — axeAdapter.ts, lighthouseAdapter.ts, and comparisonMapper.ts belong to sub-patch 2e'
  )
})

test('2f (shadow-runner scaffolding) is not implemented: offline/shadow/ does not exist', async () => {
  const files = await listFilesRecursive(path.join(ROOT, 'src/lib/offline/shadow'))
  assert.deepEqual(files, [], 'src/lib/offline/shadow/ belongs to sub-patch 2f, and Milestone 2 runs no real-site shadow validation regardless (decided, not deferred)')
})

test('src/lib/pipeline/types/ contains only 2a-scoped files — types, runtime validation, and compile-time proofs, no runtime pipeline logic', async () => {
  const files = (await listFilesRecursive(path.join(ROOT, 'src/lib/pipeline/types'))).map((f) => path.relative(ROOT, f))
  assert.deepEqual(
    files.sort(),
    [
      'src/lib/pipeline/types/__compileTimeChecks.ts',
      'src/lib/pipeline/types/auditRecord.ts',
      'src/lib/pipeline/types/checkSpecification.ts',
      'src/lib/pipeline/types/classification.ts',
      'src/lib/pipeline/types/findings.ts',
      'src/lib/pipeline/types/normalizedEvidence.ts',
      'src/lib/pipeline/types/rawCapture.ts',
      'src/lib/pipeline/types/schemaValidation.ts',
    ].sort()
  )
})

test('no exported function in src/lib/pipeline/types/ or src/lib/offline/oracle/ decides a real classification outcome, comparison outcome, or persists anything — only type re-shaping/validation functions exist', async () => {
  // Structural proxy: the only exported `function` declarations across 2a's
  // surface should be the schema-validation parsers (schemaValidation.ts)
  // — no classifyX, normalizeX, presentX, buildX, or compareX function.
  const { readFile } = await import('node:fs/promises')
  const dirs = ['src/lib/pipeline/types', 'src/lib/offline/oracle']
  const forbiddenFunctionNamePatterns = [/export function classify/i, /export function normalize/i, /export function present/i, /export function build/i, /export function compare/i, /export function decide/i]
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const pattern of forbiddenFunctionNamePatterns) {
        assert.ok(!pattern.test(source), `${path.relative(ROOT, file)} must not export a runtime pipeline-logic function matching ${pattern}`)
      }
    }
  }
})

test('no scoring fields or logic anywhere in 2b\'s new modules — Milestone 2 makes no scoring decision', async () => {
  const { readFile } = await import('node:fs/promises')
  const dirs = ['src/lib/pipeline/normalize', 'src/lib/pipeline/classify', 'src/lib/pipeline/present', 'src/lib/pipeline/audit']
  const forbiddenScoringTerms = ['scoreContribution', 'weight:', 'weight?:', 'threshold', "outcome: 'good'", 'passRate', 'scoreAggregator']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const codeOnly = source
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
        .join('\n')
      for (const term of forbiddenScoringTerms) {
        assert.ok(!codeOnly.includes(term), `${path.relative(ROOT, file)} must not contain scoring-related term "${term}"`)
      }
    }
  }
})

test('no accidental browser, Capture Service, fixture-library, oracle-adapter, shadow-runner, or API work in 2b\'s new modules', async () => {
  const { readFile } = await import('node:fs/promises')
  const dirs = ['src/lib/pipeline/normalize', 'src/lib/pipeline/classify', 'src/lib/pipeline/present', 'src/lib/pipeline/audit']
  const forbiddenTerms = [
    'puppeteer',
    'Browser',
    'Page',
    'captureService',
    'fixtures/visual-checker',
    'BenchmarkFixture',
    'axe-core',
    'lighthouse',
    'OracleTool',
    'ShadowRun',
    "from 'express'",
    'api/check-visual',
  ]
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      // Strip comments first — these modules' own doc comments legitimately
      // NAME several of these terms (e.g. "no puppeteer-core", "not a real
      // check like axe-core") to explain why they're forbidden, which a
      // whole-file substring search would misflag. Only actual code should
      // trip this check.
      const codeOnly = source
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
        .join('\n')
      for (const term of forbiddenTerms) {
        assert.ok(!codeOnly.includes(term), `${path.relative(ROOT, file)} must not reference "${term}" in code`)
      }
    }
  }
})

test('no scoring fields or logic anywhere in 2c\'s new modules — Milestone 2 makes no scoring decision', async () => {
  const { readFile } = await import('node:fs/promises')
  const dirs = ['src/lib/offline/invariants']
  const forbiddenScoringTerms = ['scoreContribution', 'weight:', 'weight?:', "outcome: 'good'", 'passRate', 'scoreAggregator', 'acceptanceThreshold']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const codeOnly = source
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
        .join('\n')
      for (const term of forbiddenScoringTerms) {
        assert.ok(!codeOnly.includes(term), `${path.relative(ROOT, file)} must not contain scoring-related term "${term}"`)
      }
    }
  }
})

test('no accidental browser, Capture Service, oracle-adapter, or shadow-runner work in 2c\'s new modules, and no calibrated real-check tolerance default', async () => {
  const { readFile } = await import('node:fs/promises')
  const dirs = ['src/lib/offline/invariants']
  const forbiddenTerms = ['puppeteer', 'captureService', 'axe-core', 'lighthouse', 'OracleTool', 'ShadowRun', "from 'express'", 'api/check-visual', 'websitesbyleslie', 'sissyssweets']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const codeOnly = source
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
        .join('\n')
      for (const term of forbiddenTerms) {
        assert.ok(!codeOnly.includes(term), `${path.relative(ROOT, file)} must not reference "${term}" in code`)
      }
    }
  }
})

test('no exported function in offline/invariants/ decides a real classification outcome or persists anything — only framework/assertion/parsing functions exist', async () => {
  const { readFile } = await import('node:fs/promises')
  const dirs = ['src/lib/offline/invariants']
  const forbiddenFunctionNamePatterns = [/export function classify/i, /export function normalize/i, /export function present/i, /export function compare/i, /export function decide/i]
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const pattern of forbiddenFunctionNamePatterns) {
        assert.ok(!pattern.test(source), `${path.relative(ROOT, file)} must not export a runtime pipeline-logic function matching ${pattern}`)
      }
    }
  }
})

// ─── Sub-patch 2d (practical scope reset) — content audits. Unlike
// every earlier sub-patch, 2d's own modules ARE expected to reference
// puppeteer/Browser/Page/captureService-adjacent terms (that's the
// whole point of a capture safety boundary) — so the forbidden-term
// lists here are deliberately narrower than 2b/2c's, covering only what
// actually must not appear: scoring, real-check content, real domains,
// oracle/shadow/axe/lighthouse work, and any reference back to the
// withdrawn public API.

test('no scoring fields or logic anywhere in 2d\'s new modules — Milestone 2 makes no scoring decision', async () => {
  const { readFile } = await import('node:fs/promises')
  const dirs = ['src/lib/pipeline/capture']
  const forbiddenScoringTerms = ['scoreContribution', 'weight:', 'weight?:', "outcome: 'good'", 'passRate', 'scoreAggregator', 'acceptanceThreshold']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const codeOnly = source
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
        .join('\n')
      for (const term of forbiddenScoringTerms) {
        assert.ok(!codeOnly.includes(term), `${path.relative(ROOT, file)} must not contain scoring-related term "${term}"`)
      }
    }
  }
})

test('no real-site domain, oracle-adapter, shadow-runner, or public-API reference in 2d\'s new modules', async () => {
  const { readFile } = await import('node:fs/promises')
  const dirs = ['src/lib/pipeline/capture']
  const forbiddenTerms = ['websitesbyleslie', 'sissyssweets', 'axe-core', 'lighthouse', 'OracleTool', 'ShadowRun', "from 'express'", 'api/check-visual', '/oracle/', '/shadow/', '/invariants/']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const codeOnly = source
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
        .join('\n')
      for (const term of forbiddenTerms) {
        assert.ok(!codeOnly.includes(term), `${path.relative(ROOT, file)} must not reference "${term}" in code`)
      }
    }
  }
})

test('no exported function in pipeline/capture/ presents a visitor finding or builds an audit record — only capture/network-safety/browser-lifecycle functions exist. (Not banning "classify": networkSafety.ts legitimately exports classifyIpv4/classifyIpv6/classifyIpAddress/classifyHostnameShape — network-address classification, unrelated to and not to be confused with a CHECK\'s classification outcome, which nothing in this directory produces.)', async () => {
  const { readFile } = await import('node:fs/promises')
  const dirs = ['src/lib/pipeline/capture']
  const forbiddenFunctionNamePatterns = [/export function present/i, /export function buildAuditRecord/i]
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const pattern of forbiddenFunctionNamePatterns) {
        assert.ok(!pattern.test(source), `${path.relative(ROOT, file)} must not export a check-decision/presentation function matching ${pattern}`)
      }
    }
  }
})
