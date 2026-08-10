// Sub-patch 2a — proves 2a's own surface stays ephemeral-only
// (architecture-dependency-map.md Rule #9; Governance Policy). No Audit
// Record Builder RUNTIME exists in 2a (that's sub-patch 2b) — this file
// only covers what 2a actually contains: type definitions, a runtime
// validation module, and compile-time-proof files. Structural guarantee
// first: no persistence dependency exists in package.json, so nothing can
// persist without one. Source-scan as an additional guard.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
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

test('no persistence dependency (database, filesystem storage, telemetry, object storage) exists in package.json', async () => {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
  const forbiddenNamePatterns = [/mongo/i, /postgres/i, /pg$/i, /mysql/i, /sqlite/i, /redis/i, /firebase/i, /supabase/i, /dynamodb/i, /aws-sdk/i, /s3/i, /prisma/i, /knex/i, /typeorm/i, /sequelize/i]
  const depNames = Object.keys(allDeps)
  for (const pattern of forbiddenNamePatterns) {
    const offenders = depNames.filter((name) => pattern.test(name))
    assert.deepEqual(offenders, [], `package.json must not have a persistence dependency matching ${pattern}`)
  }
})

test('source scan: 2a\'s new files (pipeline/types/, offline/oracle/) contain no filesystem, database, or web-storage reference, and no top-level mutable-collection binding capable of accumulating state across calls', async () => {
  const dirs = ['src/lib/pipeline/types', 'src/lib/offline/oracle']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    assert.ok(files.length > 0, `expected files under ${dir}`)
    for (const file of files) {
      // __compileTimeChecks.ts files are never imported by anything (see
      // their own header comments) — they exist solely to be type-checked
      // by `tsc --noEmit` and contain deliberately-invalid, @ts-expect-
      // error-guarded array literals as negative-case proofs. Those are
      // inert at runtime (no code path ever evaluates this file), so they
      // are excluded from the "top-level mutable collection" scan below,
      // which is about state a REACHABLE module could accumulate.
      const isCompileTimeProofFile = path.basename(file) === '__compileTimeChecks.ts'

      const source = await readFile(file, 'utf8')
      for (const forbidden of ["from 'node:fs", 'from "node:fs', 'writeFile', 'appendFile', 'localStorage', 'sessionStorage', 'indexedDB']) {
        assert.ok(!source.includes(forbidden), `${path.relative(ROOT, file)} must not reference "${forbidden}"`)
      }
      if (isCompileTimeProofFile) continue
      // A top-level `let` array/object binding is inherently reassignable
      // — always a candidate for cross-request accumulation, flagged
      // outright. A top-level `const` array/object binding (e.g.
      // VIEWPORT_NAMES, a fixed readonly lookup table; EMPTY_CHECK_EVIDENCE,
      // a frozen sentinel) is not itself a risk — the risk is only real if
      // something later actually mutates it in place (.push/.unshift/
      // .splice), which would make it a de facto accumulator despite the
      // `const` binding. Both patterns are checked.
      const topLevelReassignableCollection = /^(export\s+)?let\s+(\w+)\s*(:[^=]+)?=\s*(\[|\{)/m
      const reassignableMatch = source.match(topLevelReassignableCollection)
      if (reassignableMatch) {
        assert.fail(`${path.relative(ROOT, file)} has a top-level reassignable (let) collection binding: "${reassignableMatch[0]}"`)
      }
      const topLevelConstArray = /^(export\s+)?const\s+(\w+)\s*(:[^=]+)?=\s*\[/gm
      let constArrayMatch: RegExpExecArray | null
      while ((constArrayMatch = topLevelConstArray.exec(source))) {
        const name = constArrayMatch[2]
        const mutated = new RegExp(`\\b${name}\\.(push|unshift|splice|pop|shift|sort|reverse|fill|copyWithin)\\s*\\(`).test(source)
        assert.ok(!mutated, `${path.relative(ROOT, file)}'s top-level const array "${name}" is mutated in place elsewhere in the file — a de facto accumulator`)
      }
    }
  }
})

test('no directory belonging to a sub-patch later than 2c (pipeline/capture; offline/shadow) exists yet — nothing there to persist through', async () => {
  const forbidden = ['src/lib/pipeline/capture', 'src/lib/offline/shadow']
  for (const dir of forbidden) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    assert.deepEqual(files, [], `${dir} must not exist in sub-patch 2c`)
  }
})

test('source scan: 2b\'s new files (pipeline/normalize/, classify/, present/, audit/) contain no filesystem, database, or web-storage reference, and no top-level mutable-collection binding capable of accumulating state across calls', async () => {
  const dirs = ['src/lib/pipeline/normalize', 'src/lib/pipeline/classify', 'src/lib/pipeline/present', 'src/lib/pipeline/audit']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    assert.ok(files.length > 0, `expected files under ${dir}`)
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const forbidden of ["from 'node:fs", 'from "node:fs', 'writeFile', 'appendFile', 'localStorage', 'sessionStorage', 'indexedDB', 'console.log']) {
        assert.ok(!source.includes(forbidden), `${path.relative(ROOT, file)} must not reference "${forbidden}"`)
      }
      const topLevelReassignableCollection = /^(export\s+)?let\s+(\w+)\s*(:[^=]+)?=\s*(\[|\{)/m
      const reassignableMatch = source.match(topLevelReassignableCollection)
      if (reassignableMatch) {
        assert.fail(`${path.relative(ROOT, file)} has a top-level reassignable (let) collection binding: "${reassignableMatch[0]}"`)
      }
      const topLevelConstArray = /^(export\s+)?const\s+(\w+)\s*(:[^=]+)?=\s*\[/gm
      let constArrayMatch: RegExpExecArray | null
      while ((constArrayMatch = topLevelConstArray.exec(source))) {
        const name = constArrayMatch[2]
        const mutated = new RegExp(`\\b${name}\\.(push|unshift|splice|pop|shift|sort|reverse|fill|copyWithin)\\s*\\(`).test(source)
        assert.ok(!mutated, `${path.relative(ROOT, file)}'s top-level const array/collection "${name}" is mutated in place elsewhere in the file — a de facto accumulator`)
      }
    }
  }
})

test('source scan: 2c\'s new files (offline/invariants/) contain no filesystem, database, or web-storage reference, and no top-level mutable-collection binding capable of accumulating state across calls', async () => {
  const dirs = ['src/lib/offline/invariants']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    assert.ok(files.length > 0, `expected files under ${dir}`)
    for (const file of files) {
      const isCompileTimeProofFile = path.basename(file) === '__compileTimeChecks.ts'
      const source = await readFile(file, 'utf8')
      for (const forbidden of ["from 'node:fs", 'from "node:fs', 'writeFile', 'appendFile', 'localStorage', 'sessionStorage', 'indexedDB', 'console.log']) {
        assert.ok(!source.includes(forbidden), `${path.relative(ROOT, file)} must not reference "${forbidden}"`)
      }
      if (isCompileTimeProofFile) continue
      const topLevelReassignableCollection = /^(export\s+)?let\s+(\w+)\s*(:[^=]+)?=\s*(\[|\{)/m
      const reassignableMatch = source.match(topLevelReassignableCollection)
      if (reassignableMatch) {
        assert.fail(`${path.relative(ROOT, file)} has a top-level reassignable (let) collection binding: "${reassignableMatch[0]}"`)
      }
      const topLevelConstArray = /^(export\s+)?const\s+(\w+)\s*(:[^=]+)?=\s*\[/gm
      let constArrayMatch: RegExpExecArray | null
      while ((constArrayMatch = topLevelConstArray.exec(source))) {
        const name = constArrayMatch[2]
        const mutated = new RegExp(`\\b${name}\\.(push|unshift|splice|pop|shift|sort|reverse|fill|copyWithin)\\s*\\(`).test(source)
        assert.ok(!mutated, `${path.relative(ROOT, file)}'s top-level const array/collection "${name}" is mutated in place elsewhere in the file — a de facto accumulator`)
      }
    }
  }
})

test('offline/invariants/ modules construct only fresh, request-scoped return values — no module-level AuditRecord/NormalizedEvidence/BenchmarkFixture retention', async () => {
  // Structural proxy, consistent with 2a/2b's own no-persistence tests:
  // the metamorphic runner and assertion functions return freshly-built
  // result objects per call; nothing here is assigned to module-level
  // state and returned from a later call.
  const { runMetamorphicSuite } = await import('../src/lib/offline/invariants/metamorphicRunner.ts')
  const a = runMetamorphicSuite([1], [{ id: 't', apply: (x: number[]) => x }], (x: number[]) => x.length, () => ({ holds: true }))
  const b = runMetamorphicSuite([1], [{ id: 't', apply: (x: number[]) => x }], (x: number[]) => x.length, () => ({ holds: true }))
  assert.notEqual(a, b, 'each call must return a fresh result object')
  assert.deepEqual(a, b)
})
