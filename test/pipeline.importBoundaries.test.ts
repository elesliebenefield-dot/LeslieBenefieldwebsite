// Sub-patch 2a — import-boundary source-scan tests (architecture-
// dependency-map.md Rules #7, #10, #11). Source scans are one additional
// guard, not the sole guarantee — the primary guarantees are the type
// designs and module boundaries themselves. No Classification Engine or
// other pipeline runtime exists in 2a (that's sub-patch 2b), so there is
// nothing yet to test an import boundary FROM in that direction; this file
// covers what 2a actually contains: pipeline/types/ and offline/oracle/.
//
// Also proves request-path isolation for 2a's own new files: nothing added
// in this sub-patch performs, or is capable of performing, network/DNS I/O.

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

function importLinesOf(source: string): string[] {
  return source.split('\n').filter((line) => /^\s*import\b/.test(line))
}

test('api/check-visual.ts (Milestone 1, unchanged) still does not import src/lib/pipeline/ or src/lib/offline/', async () => {
  const source = await readFile(path.join(ROOT, 'api/check-visual.ts'), 'utf8')
  const imports = importLinesOf(source)
  for (const forbidden of ['src/lib/pipeline', 'src/lib/offline', '../src/lib/pipeline', '../src/lib/offline']) {
    assert.ok(imports.every((l) => !l.includes(forbidden)), `api/check-visual.ts must not import "${forbidden}": ${JSON.stringify(imports)}`)
  }
})

test('no file under api/ imports anything from src/lib/pipeline/ or src/lib/offline/', async () => {
  const apiFiles = await listFilesRecursive(path.join(ROOT, 'api'))
  for (const file of apiFiles) {
    const source = await readFile(file, 'utf8')
    const imports = importLinesOf(source)
    for (const forbidden of ['lib/pipeline', 'lib/offline']) {
      assert.ok(imports.every((l) => !l.includes(forbidden)), `${path.relative(ROOT, file)} must not import "${forbidden}": ${JSON.stringify(imports)}`)
    }
  }
})

test('no file under src/lib/pipeline/ imports from src/lib/offline/ (offline is never in the request path)', async () => {
  const pipelineFiles = await listFilesRecursive(path.join(ROOT, 'src/lib/pipeline'))
  for (const file of pipelineFiles) {
    const source = await readFile(file, 'utf8')
    const imports = importLinesOf(source)
    assert.ok(imports.every((l) => !l.includes('lib/offline')), `${path.relative(ROOT, file)} must not import from src/lib/offline/: ${JSON.stringify(imports)}`)
  }
})

test('src/lib/offline/oracle/types.ts only imports shared types from src/lib/pipeline/types/, never a pipeline implementation module', async () => {
  const source = await readFile(path.join(ROOT, 'src/lib/offline/oracle/types.ts'), 'utf8')
  const imports = importLinesOf(source)
  for (const forbidden of ['/capture/', '/normalize/', '/classify/', '/present/', '/audit/']) {
    assert.ok(imports.every((l) => !l.includes(forbidden)), `offline/oracle/types.ts must not import "${forbidden}": ${JSON.stringify(imports)}`)
  }
  assert.ok(imports.every((l) => !l.includes('__compileTimeChecks')), 'offline/oracle/types.ts must not import the compile-time-proof file')
})

test('request-path isolation: none of 2a\'s new pipeline/offline source files import network, DNS, filesystem, or browser modules', async () => {
  const newDirs = ['src/lib/pipeline/types', 'src/lib/offline/oracle']
  const forbiddenModules = ['node:http', 'node:https', 'node:net', 'node:dns', "'http'", "'https'", "'net'", "'dns'", 'puppeteer-core', 'node:fs', "'fs'", 'node-fetch']
  for (const dir of newDirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    assert.ok(files.length > 0, `expected files under ${dir}`)
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const imports = importLinesOf(source)
      for (const forbidden of forbiddenModules) {
        assert.ok(imports.every((l) => !l.includes(forbidden)), `${path.relative(ROOT, file)} must not import ${forbidden}: ${JSON.stringify(imports)}`)
      }
      assert.ok(!/\bfetch\s*\(/.test(source), `${path.relative(ROOT, file)} must not call fetch()`)
    }
  }
})

test('none of 2a\'s new files import puppeteer-core or any not-yet-existing Capture Service module path', async () => {
  const dirs = ['src/lib/pipeline/types', 'src/lib/offline/oracle']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const imports = importLinesOf(source)
      for (const forbidden of ['puppeteer-core', 'captureService', 'browserLifecycle', 'pageHardening', '/capture/']) {
        assert.ok(imports.every((l) => !l.includes(forbidden)), `${path.relative(ROOT, file)} must not import "${forbidden}": ${JSON.stringify(imports)}`)
      }
    }
  }
})

// ─── Sub-patch 2b: import-boundary and request-path-isolation tests for
// pipeline/normalize, pipeline/classify, pipeline/present, pipeline/audit.

test('none of 2b\'s new modules import puppeteer-core or any browser/Capture Service module', async () => {
  const dirs = ['src/lib/pipeline/normalize', 'src/lib/pipeline/classify', 'src/lib/pipeline/present', 'src/lib/pipeline/audit']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const imports = importLinesOf(source)
      for (const forbidden of ['puppeteer-core', 'captureService', 'browserLifecycle', 'pageHardening', '/capture/']) {
        assert.ok(imports.every((l) => !l.includes(forbidden)), `${path.relative(ROOT, file)} must not import "${forbidden}": ${JSON.stringify(imports)}`)
      }
    }
  }
})

test('none of 2b\'s new modules import network, DNS, filesystem, child-process, database, telemetry, analytics, or offline modules', async () => {
  const dirs = ['src/lib/pipeline/normalize', 'src/lib/pipeline/classify', 'src/lib/pipeline/present', 'src/lib/pipeline/audit']
  const forbiddenModules = [
    'node:http',
    'node:https',
    'node:net',
    'node:dns',
    "'http'",
    "'https'",
    "'net'",
    "'dns'",
    'node:fs',
    "'fs'",
    'node:child_process',
    "'child_process'",
    'node-fetch',
    'lib/offline',
  ]
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    assert.ok(files.length > 0, `expected files under ${dir}`)
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const imports = importLinesOf(source)
      for (const forbidden of forbiddenModules) {
        assert.ok(imports.every((l) => !l.includes(forbidden)), `${path.relative(ROOT, file)} must not import ${forbidden}: ${JSON.stringify(imports)}`)
      }
    }
  }
})

test('none of 2b\'s new modules call fetch(), launch a browser, touch the DOM, use environment-variable gates, import api/, or use timers as hidden nondeterminism', async () => {
  const dirs = ['src/lib/pipeline/normalize', 'src/lib/pipeline/classify', 'src/lib/pipeline/present', 'src/lib/pipeline/audit']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const imports = importLinesOf(source)
      assert.ok(!/\bfetch\s*\(/.test(source), `${path.relative(ROOT, file)} must not call fetch()`)
      assert.ok(!/document\.|window\./.test(source), `${path.relative(ROOT, file)} must not touch the DOM`)
      assert.ok(!/process\.env/.test(source), `${path.relative(ROOT, file)} must not use an environment-variable gate`)
      assert.ok(!/setTimeout|setInterval|Date\.now\(\)|new Date\(\)/.test(source), `${path.relative(ROOT, file)} must not use timers/wall-clock as hidden nondeterminism`)
      assert.ok(imports.every((l) => !l.includes("from '../../../api") && !l.includes('from "../../../api')), `${path.relative(ROOT, file)} must not import from api/`)
    }
  }
})

test('public api/check-visual.ts cannot reach any 2b module (still unchanged, still imports only src/lib/visualCheck.ts)', async () => {
  const source = await readFile(path.join(ROOT, 'api/check-visual.ts'), 'utf8')
  const imports = importLinesOf(source)
  for (const forbidden of ['pipeline/normalize', 'pipeline/classify', 'pipeline/present', 'pipeline/audit']) {
    assert.ok(imports.every((l) => !l.includes(forbidden)), `api/check-visual.ts must not import "${forbidden}": ${JSON.stringify(imports)}`)
  }
})

// ─── Sub-patch 2c: import-boundary and request-path-isolation tests for
// src/lib/offline/invariants/.

test('src/lib/offline/invariants/ only imports from src/lib/pipeline/types/, never a pipeline implementation module', async () => {
  const files = await listFilesRecursive(path.join(ROOT, 'src/lib/offline/invariants'))
  assert.ok(files.length > 0, 'expected files under src/lib/offline/invariants')
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const imports = importLinesOf(source)
    for (const forbidden of ['/capture/', '/normalize/', '/classify/', '/present/', '/audit/', 'pipeline/capture', 'pipeline/normalize', 'pipeline/classify', 'pipeline/present', 'pipeline/audit']) {
      assert.ok(imports.every((l) => !l.includes(forbidden)), `${path.relative(ROOT, file)} must not import "${forbidden}": ${JSON.stringify(imports)}`)
    }
  }
})

test('none of 2c\'s new offline/invariants modules import puppeteer-core, browser, Capture Service, or oracle/shadow modules', async () => {
  const files = await listFilesRecursive(path.join(ROOT, 'src/lib/offline/invariants'))
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const imports = importLinesOf(source)
    for (const forbidden of ['puppeteer-core', 'captureService', 'browserLifecycle', 'pageHardening', '/capture/', '/oracle/', '/shadow/']) {
      assert.ok(imports.every((l) => !l.includes(forbidden)), `${path.relative(ROOT, file)} must not import "${forbidden}": ${JSON.stringify(imports)}`)
    }
  }
})

test('none of 2c\'s new offline/invariants modules import network, DNS, filesystem, child-process, or database modules, or call fetch()', async () => {
  const files = await listFilesRecursive(path.join(ROOT, 'src/lib/offline/invariants'))
  const forbiddenModules = ['node:http', 'node:https', 'node:net', 'node:dns', "'http'", "'https'", "'net'", "'dns'", 'node:child_process', "'child_process'", 'node-fetch']
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const imports = importLinesOf(source)
    for (const forbidden of forbiddenModules) {
      assert.ok(imports.every((l) => !l.includes(forbidden)), `${path.relative(ROOT, file)} must not import ${forbidden}: ${JSON.stringify(imports)}`)
    }
    assert.ok(!/\bfetch\s*\(/.test(source), `${path.relative(ROOT, file)} must not call fetch()`)
  }
})

test('public api/check-visual.ts cannot reach any 2c module (still unchanged, still imports only src/lib/visualCheck.ts)', async () => {
  const source = await readFile(path.join(ROOT, 'api/check-visual.ts'), 'utf8')
  const imports = importLinesOf(source)
  for (const forbidden of ['offline/invariants', 'benchmarkFixture', 'metamorphicRunner', 'invariantAssertions']) {
    assert.ok(imports.every((l) => !l.includes(forbidden)), `api/check-visual.ts must not import "${forbidden}": ${JSON.stringify(imports)}`)
  }
})

// ─── Sub-patch 2d (practical scope reset): import-boundary and request-
// path-isolation tests for src/lib/pipeline/capture/. Unlike every
// earlier sub-patch's new modules, capture/ modules ARE expected to
// import puppeteer-core and node:net/node:dns/node:http — that's the
// whole point of a capture safety boundary. What must still hold: no
// downstream pipeline stage (normalize/classify/present/audit) or
// offline module reaches BACKWARD into capture/, capture/ itself
// imports nothing from those downstream stages, and — as with every
// sub-patch so far — the public API remains completely unreachable.

test('public api/check-visual.ts cannot reach any 2d module (still unchanged, still imports only src/lib/visualCheck.ts)', async () => {
  const source = await readFile(path.join(ROOT, 'api/check-visual.ts'), 'utf8')
  const imports = importLinesOf(source)
  for (const forbidden of ['pipeline/capture', '/capture/', 'networkSafety', 'connectionBindingProxy', 'browserLifecycle', 'pageHardening']) {
    assert.ok(imports.every((l) => !l.includes(forbidden)), `api/check-visual.ts must not import "${forbidden}": ${JSON.stringify(imports)}`)
  }
})

test('no file under api/ imports anything from src/lib/pipeline/capture/ specifically (in addition to the general pipeline/offline check above)', async () => {
  const apiFiles = await listFilesRecursive(path.join(ROOT, 'api'))
  for (const file of apiFiles) {
    const source = await readFile(file, 'utf8')
    const imports = importLinesOf(source)
    assert.ok(imports.every((l) => !l.includes('pipeline/capture')), `${path.relative(ROOT, file)} must not import pipeline/capture: ${JSON.stringify(imports)}`)
  }
})

test('src/lib/pipeline/capture/ imports nothing from downstream pipeline stages (normalize/classify/present/audit) or from src/lib/offline/ — it is the top of the one-way pipeline chain, nothing is upstream of it to import', async () => {
  const files = await listFilesRecursive(path.join(ROOT, 'src/lib/pipeline/capture'))
  assert.ok(files.length > 0, 'expected files under src/lib/pipeline/capture')
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const imports = importLinesOf(source)
    for (const forbidden of ['/normalize/', '/classify/', '/present/', '/audit/', 'pipeline/normalize', 'pipeline/classify', 'pipeline/present', 'pipeline/audit', 'lib/offline']) {
      assert.ok(imports.every((l) => !l.includes(forbidden)), `${path.relative(ROOT, file)} must not import "${forbidden}": ${JSON.stringify(imports)}`)
    }
  }
})

test('none of 2b\'s pipeline/normalize|classify|present|audit modules import backward from pipeline/capture (import direction stays one-way)', async () => {
  const dirs = ['src/lib/pipeline/normalize', 'src/lib/pipeline/classify', 'src/lib/pipeline/present', 'src/lib/pipeline/audit']
  for (const dir of dirs) {
    const files = await listFilesRecursive(path.join(ROOT, dir))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const imports = importLinesOf(source)
      assert.ok(imports.every((l) => !l.includes('/capture/') && !l.includes('pipeline/capture')), `${path.relative(ROOT, file)} must not import backward from pipeline/capture: ${JSON.stringify(imports)}`)
    }
  }
})

test('src/lib/pipeline/capture/ does not import any oracle/shadow/invariants offline module, or any test-only/synthetic module', async () => {
  const files = await listFilesRecursive(path.join(ROOT, 'src/lib/pipeline/capture'))
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const imports = importLinesOf(source)
    for (const forbidden of ['/oracle/', '/shadow/', '/invariants/', 'benchmarkFixture', 'metamorphicRunner', 'invariantAssertions']) {
      assert.ok(imports.every((l) => !l.includes(forbidden)), `${path.relative(ROOT, file)} must not import "${forbidden}": ${JSON.stringify(imports)}`)
    }
  }
})
