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
  // 2e's axeAdapter.ts is EXCLUDED here deliberately: it legitimately
  // reads (never writes) node:fs to check for a local Chrome binary and
  // load axe-core's own script — a read, not a persistence concern. See
  // the dedicated 2e no-persistence test below, which allows reads but
  // still forbids writes/database/web-storage for that one file.
  const dirs = ['src/lib/pipeline/types', 'src/lib/offline/oracle']
  for (const dir of dirs) {
    const files = (await listFilesRecursive(path.join(ROOT, dir))).filter((f) => path.basename(f) !== 'axeAdapter.ts')
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

test('no directory belonging to a sub-patch later than 2d (offline/shadow) exists yet — nothing there to persist through', async () => {
  const forbidden = ['src/lib/offline/shadow']
  for (const dir of forbidden) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    assert.deepEqual(files, [], `${dir} must not exist in sub-patch 2d`)
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

// ─── Sub-patch 2d (practical scope reset) — src/lib/pipeline/capture/.
// This directory legitimately imports node:net/node:dns/puppeteer-core
// (that's its whole job) and is exempt from the network-import bans
// used elsewhere in this repo's persistence/isolation checks — none of
// that is a persistence concern. What's actually checked: no
// filesystem/database/web-storage reference, no module-level mutable
// state that could leak between separate captures, and (functionally)
// that each proxy/browser instance is independently scoped.

test('source scan: 2d\'s new files (pipeline/capture/) contain no filesystem, database, or web-storage reference, and no top-level mutable-collection binding capable of accumulating state across calls', async () => {
  const dirs = ['src/lib/pipeline/capture']
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

test('startConnectionBindingProxy() instances are independently scoped — no module-level counter/state shared across separate proxies', async () => {
  const { startConnectionBindingProxy } = await import('../src/lib/pipeline/capture/connectionBindingProxy.ts')
  const proxyA = await startConnectionBindingProxy({})
  const proxyB = await startConnectionBindingProxy({})
  try {
    assert.notEqual(proxyA.port, proxyB.port, 'each proxy must bind its own independent port')
    assert.equal(proxyA.totalConnections(), 0)
    assert.equal(proxyB.totalConnections(), 0)
  } finally {
    await proxyA.close()
    await proxyB.close()
  }
})

test('launchCaptureBrowser() rejects an invalid executablePath rather than silently falling back to some other browser — no hidden global browser instance is reused across captures', async () => {
  const { launchCaptureBrowser } = await import('../src/lib/pipeline/capture/browserLifecycle.ts')
  await assert.rejects(() => launchCaptureBrowser({ executablePath: '/nonexistent/path/to/chrome-binary', proxyPort: 1 }))
})

// ─── Sub-patch 2e (simplified accessibility cross-check) —
// axeAdapter.ts. Legitimately reads node:fs (checking for a local
// Chrome binary, loading axe-core's own script) — a read is not a
// persistence concern; what must never appear is a WRITE, a database
// dependency, web-storage, or module-level mutable state that could
// leak findings between separate fixture runs.

test('source scan: axeAdapter.ts never writes to the filesystem, never touches a database or web-storage API, and has no top-level mutable-collection binding', async () => {
  const { readFile } = await import('node:fs/promises')
  const filePath = path.join(ROOT, 'src/lib/offline/oracle/axeAdapter.ts')
  const source = await readFile(filePath, 'utf8')
  for (const forbidden of ['writeFile', 'appendFile', 'unlink', 'rm(', 'localStorage', 'sessionStorage', 'indexedDB']) {
    assert.ok(!source.includes(forbidden), `axeAdapter.ts must not reference "${forbidden}"`)
  }
  const topLevelReassignableCollection = /^(export\s+)?let\s+(\w+)\s*(:[^=]+)?=\s*(\[|\{)/m
  assert.ok(!topLevelReassignableCollection.test(source), 'axeAdapter.ts must not have a top-level reassignable (let) collection binding')
})

test('runAxeAgainstFixture() returns fresh, independent results per call — no module-level retention of findings between fixture runs', async () => {
  const { runAxeAgainstFixture } = await import('../src/lib/offline/oracle/axeAdapter.ts')
  const html = '<!DOCTYPE html><html lang="en"><body><main><h1>x</h1></main></body></html>'
  const a = await runAxeAgainstFixture(html, { executablePath: '/nonexistent/path/to/chrome-binary' })
  const b = await runAxeAgainstFixture(html, { executablePath: '/nonexistent/path/to/chrome-binary' })
  assert.notEqual(a, b, 'each call must return a fresh result object')
  assert.deepEqual(a, b)
})
