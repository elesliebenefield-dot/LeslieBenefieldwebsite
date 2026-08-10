// First real-checker release — request/result-flow tests for the routed
// api/check-visual.ts handler itself (method/body validation, response
// shaping, error-message mapping). The underlying capture/classify
// pipeline already has its own dedicated end-to-end coverage in
// test/pipeline.captureService.test.ts; this file proves the HTTP-facing
// handler wires that pipeline's output into the documented plain-English
// response shape correctly, and that malformed input never reaches it.
//
// Real Chrome, real local fixture HTML served from a real local HTTP
// server — never a real third-party site. `captureOverrides` (deps/
// allowedHttpPort) is a test-only parameter accepted by handleCheckVisual
// alongside the request/response — production's default export never
// supplies it. If local Chrome isn't present, the browser-dependent tests
// skip rather than fail.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { handleCheckVisual } from '../api/check-visual.ts'
import { resolveLocalChromePath } from '../src/lib/pipeline/capture/browserLifecycle.ts'
import type { RebuildCheckResponse } from '../src/lib/visualCheck.ts'

const CHROME_PATH = resolveLocalChromePath()
const chromeAvailable = existsSync(CHROME_PATH)

function skippableTest(name: string, fn: () => Promise<void>): void {
  test(name, { skip: !chromeAvailable ? 'local Chrome not found at the expected path — skipping real-browser tests' : false }, fn)
}

const FIXTURES_DIR = path.resolve(import.meta.dirname, 'fixtures/visual-checker/first-release')

function mockRes() {
  const state: { statusCode: number; body: RebuildCheckResponse | null } = { statusCode: 0, body: null }
  const res = {
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(b: RebuildCheckResponse) {
      state.body = b
    },
  }
  return { res, state }
}

async function startFixtureServer(fileName: string): Promise<{ server: http.Server; port: number }> {
  const html = await readFile(path.join(FIXTURES_DIR, fileName), 'utf8')
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(html)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('failed to bind fixture server')
  return { server, port: address.port }
}

function depsFor(port: number) {
  return {
    lookup: async (hostname: string) => {
      if (hostname === 'safe.invalid') return [{ address: '127.0.0.1', family: 4 }]
      throw new Error(`unexpected test host: ${hostname}`)
    },
    classify: (ip: string) => (ip === '127.0.0.1' ? ('public' as const) : ('unparsable' as const)),
    allowedPorts: [String(port)],
  }
}

// ─── Malformed/missing input never reaches capture — no browser, no network ──

test('non-POST requests receive 405', async () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH', undefined]) {
    const { res, state } = mockRes()
    await handleCheckVisual({ method }, res)
    assert.equal(state.statusCode, 405, `method=${method}`)
    assert.equal(state.body?.ok, false, `method=${method}`)
  }
})

test('missing, empty, or non-string url all get a friendly 400 without attempting a capture', async () => {
  const inputs: Array<Record<string, unknown>> = [
    { method: 'POST' },
    { method: 'POST', body: undefined },
    { method: 'POST', body: null },
    { method: 'POST', body: JSON.stringify({}) },
    { method: 'POST', body: JSON.stringify({ url: '' }) },
    { method: 'POST', body: JSON.stringify({ url: '   ' }) },
    { method: 'POST', body: JSON.stringify({ url: 123 }) },
  ]
  for (const input of inputs) {
    const { res, state } = mockRes()
    await handleCheckVisual(input, res)
    assert.equal(state.statusCode, 400, `input=${JSON.stringify(input)}`)
    assert.equal(state.body?.ok, false, `input=${JSON.stringify(input)}`)
  }
})

test('malformed JSON body gets a friendly 400', async () => {
  const { res, state } = mockRes()
  await handleCheckVisual({ method: 'POST', body: 'not even valid json {{{' }, res)
  assert.equal(state.statusCode, 400)
  assert.equal(state.body?.ok, false)
})

test('a URL that fails normalization (e.g. localhost) gets a friendly 400', async () => {
  const { res, state } = mockRes()
  await handleCheckVisual({ method: 'POST', body: JSON.stringify({ url: 'localhost' }) }, res)
  assert.equal(state.statusCode, 400)
  assert.equal(state.body?.ok, false)
  if (!state.body?.ok) assert.ok(!/localhost/i.test(state.body!.error), 'the friendly message should not leak the raw input back verbatim')
})

// ─── Real request/result flow through the real handler, against a local fixture ──

skippableTest('a clean fixture produces a 200 with two "No clear issue found" findings, in the documented shape', async () => {
  const { server, port } = await startFixtureServer('clean.html')
  try {
    const { res, state } = mockRes()
    await handleCheckVisual({ method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/` }) }, res, {
      executablePath: CHROME_PATH,
      navigationTimeoutMs: 8000,
      deps: depsFor(port),
      allowedHttpPort: port,
    })
    assert.equal(state.statusCode, 200)
    assert.equal(state.body?.ok, true)
    if (!state.body?.ok) throw new Error('unreachable')
    assert.equal(state.body.status, 'complete')
    assert.equal(Object.keys(state.body).sort().join(','), 'findings,finalUrl,ok,status'.split(',').sort().join(','))
    assert.equal(state.body.findings.length, 2)
    const byCheck = Object.fromEntries(state.body.findings.map((f) => [f.checkId, f]))
    assert.equal(byCheck.overflow.label, 'No clear issue found')
    assert.equal(byCheck.readability.label, 'No clear issue found')
    assert.ok(byCheck.overflow.detail.length > 0)
    assert.ok(byCheck.readability.detail.length > 0)
  } finally {
    server.close()
  }
})

skippableTest('an overflow-issue fixture produces "Likely opportunity" for overflow, and an unaffected readability finding', async () => {
  const { server, port } = await startFixtureServer('overflow-issue.html')
  try {
    const { res, state } = mockRes()
    await handleCheckVisual({ method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/` }) }, res, {
      executablePath: CHROME_PATH,
      navigationTimeoutMs: 8000,
      deps: depsFor(port),
      allowedHttpPort: port,
    })
    assert.equal(state.body?.ok, true)
    if (!state.body?.ok) throw new Error('unreachable')
    const byCheck = Object.fromEntries(state.body.findings.map((f) => [f.checkId, f]))
    assert.equal(byCheck.overflow.label, 'Likely opportunity')
    assert.equal(byCheck.readability.label, 'No clear issue found')
  } finally {
    server.close()
  }
})

skippableTest('a tiny-text fixture produces "Likely opportunity" for readability, and an unaffected overflow finding', async () => {
  const { server, port } = await startFixtureServer('tiny-text.html')
  try {
    const { res, state } = mockRes()
    await handleCheckVisual({ method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/` }) }, res, {
      executablePath: CHROME_PATH,
      navigationTimeoutMs: 8000,
      deps: depsFor(port),
      allowedHttpPort: port,
    })
    assert.equal(state.body?.ok, true)
    if (!state.body?.ok) throw new Error('unreachable')
    const byCheck = Object.fromEntries(state.body.findings.map((f) => [f.checkId, f]))
    assert.equal(byCheck.readability.label, 'Likely opportunity')
    assert.equal(byCheck.overflow.label, 'No clear issue found')
  } finally {
    server.close()
  }
})

skippableTest('a no-visible-text fixture produces an honest "Couldn\'t be checked" for readability, not a fabricated pass', async () => {
  const { server, port } = await startFixtureServer('no-visible-text.html')
  try {
    const { res, state } = mockRes()
    await handleCheckVisual({ method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/` }) }, res, {
      executablePath: CHROME_PATH,
      navigationTimeoutMs: 8000,
      deps: depsFor(port),
      allowedHttpPort: port,
    })
    assert.equal(state.body?.ok, true)
    if (!state.body?.ok) throw new Error('unreachable')
    const byCheck = Object.fromEntries(state.body.findings.map((f) => [f.checkId, f]))
    assert.equal(byCheck.readability.label, "Couldn't be checked")
  } finally {
    server.close()
  }
})

skippableTest('a capture failure (unsafe target, real safety boundary) still yields a 200 with a friendly, non-leaking error', async () => {
  const { server, port } = await startFixtureServer('clean.html')
  try {
    const { res, state } = mockRes()
    const unsafeDeps = {
      lookup: async () => [{ address: '10.1.2.3', family: 4 as const }],
      classify: () => 'private' as const,
      allowedPorts: [String(port)],
    }
    await handleCheckVisual({ method: 'POST', body: JSON.stringify({ url: `http://unsafe.invalid:${port}/` }) }, res, {
      executablePath: CHROME_PATH,
      navigationTimeoutMs: 5000,
      deps: unsafeDeps,
      allowedHttpPort: port,
    })
    assert.equal(state.statusCode, 200)
    assert.equal(state.body?.ok, false)
    if (state.body?.ok) throw new Error('unreachable')
    assert.ok(!/10\.1\.2\.3|private|SSRF/i.test(state.body!.error), 'must not leak internal failure detail')
  } finally {
    server.close()
  }
})
