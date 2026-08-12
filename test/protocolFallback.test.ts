// Protocol-fallback release — general HTTPS→HTTP fallback for hostnames
// entered without an explicit protocol, fixing the scarservices.com
// class of defect (a site with no working HTTPS at all was reported as
// completely unreachable, even though it's reachable over plain HTTP).
// Real local fixture servers only — plain HTTP servers, and genuine
// self-signed HTTPS servers via a real (openssl-generated) certificate
// — never mocked network behavior.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { handleCheckWebsite, checkerUnavailableResponse } from '../api/check-website.ts'
import { CHECK_WEIGHTS, checkStatusLabel } from '../src/lib/websiteCheck.ts'
import type { CheckResponse } from '../src/lib/websiteCheck.ts'

function mockRes() {
  const state: { statusCode: number; body: CheckResponse | null } = { statusCode: 0, body: null }
  const res = {
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(b: CheckResponse) {
      state.body = b
    },
  }
  return { res, state }
}

/** Same override pattern used throughout this suite (see
 *  test/scoringRubric.test.ts) — allows only the local fixture's own
 *  loopback address/port through the SSRF-safety checks that would
 *  otherwise reject it, without touching real DNS or weakening the
 *  checks any real request gets. */
function depsFor(port: number) {
  return {
    classify: (ip: string) => ip !== '127.0.0.1',
    allowedPorts: [String(port)],
  }
}

async function startServer(handlerFn: http.RequestListener): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer(handlerFn)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('failed to bind fixture server')
  return { server, port: address.port }
}

/** A REAL HTTPS server with a genuine (openssl-generated) self-signed
 *  certificate — not a mock of TLS, an actual TLS handshake against
 *  actual X.509 material. `NODE_TLS_REJECT_UNAUTHORIZED` is set to '0'
 *  only around the single call that talks to it (see withInsecureTls
 *  below) so this doesn't weaken certificate validation for anything
 *  else, in this file or any other. */
function generateSelfSignedCert(): { key: Buffer; cert: Buffer; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'protocol-fallback-cert-'))
  const keyPath = path.join(dir, 'key.pem')
  const certPath = path.join(dir, 'cert.pem')
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath, '-days', '1', '-nodes', '-subj', '/CN=127.0.0.1'], {
    stdio: 'pipe',
  })
  const key = readFileSync(keyPath)
  const cert = readFileSync(certPath)
  return { key, cert, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

async function startHttpsServer(handlerFn: http.RequestListener): Promise<{ server: https.Server; port: number; cleanupCert: () => void }> {
  const { key, cert, cleanup } = generateSelfSignedCert()
  const server = https.createServer({ key, cert }, handlerFn)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('failed to bind fixture HTTPS server')
  return { server, port: address.port, cleanupCert: cleanup }
}

/** Scopes NODE_TLS_REJECT_UNAUTHORIZED='0' to exactly the duration of
 *  `fn` — this test suite's self-signed fixture certs are never trusted
 *  by default (correctly), so this is the standard, narrowly-bounded way
 *  to exercise a real TLS connection against one locally. Restored
 *  unconditionally, even if `fn` throws. */
async function withInsecureTls<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  try {
    return await fn()
  } finally {
    if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous
  }
}

function page(bodyHtml: string, headHtml = ''): string {
  return `<!DOCTYPE html><html><head>${headHtml}</head><body>${bodyHtml}</body></html>`
}

const SUBSTANTIAL_CONTENT =
  '<p>Real content well past the thin-content threshold, so the static check trusts this page enough to sample its links and contact information directly, rather than treating it as a JS application shell.</p>'

async function check(url: string, port: number, timeoutMs?: number): Promise<CheckResponse> {
  const { res, state } = mockRes()
  await handleCheckWebsite({ method: 'POST', body: JSON.stringify({ url }) }, res, depsFor(port), timeoutMs)
  assert.equal(state.statusCode, 200)
  if (!state.body) throw new Error('no response body')
  return state.body
}

// ─── 1 & 5: bare hostname, HTTPS connection failure → HTTP fallback succeeds ──
//
// A real plain-HTTP server, hit over https:// — Node's fetch performs a
// genuine TLS handshake against it and fails immediately and for real
// (a plain HTTP server can't complete one), reproducing exactly the
// "HTTPS never connects" shape of the scarservices.com defect, without
// depending on any real external host.

test('bare hostname: HTTPS fails at the TLS layer (real plain-HTTP server), automatically retries and succeeds over HTTP', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(
      page(
        `${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`,
        '<title>1234567890</title><meta name="description" content="12345678901234567890123456789012345678901234567890"><meta name="viewport" content="width=device-width">'
      )
    )
  })
  try {
    const result = await check(`127.0.0.1:${port}`, port)
    if (!result.ok || result.status !== 'scored') throw new Error(`expected a scored result, got: ${JSON.stringify(result)}`)

    assert.equal(result.finalUrl.startsWith('http://'), true, 'the final URL must reflect the protocol that actually worked')

    const availability = result.findings.find((f) => f.id === 'availability')!
    assert.equal(availability.bucket, 'good')
    assert.equal(availability.points, CHECK_WEIGHTS.availability)
    assert.equal(checkStatusLabel(availability), 'Passed')

    // Requirement: HTTPS is marked "Not met" at 0/25, with wording that
    // clearly recommends moving to HTTPS — distinct from the ordinary
    // "doesn't appear to use HTTPS" wording, since here HTTPS was
    // actively tried and failed to connect at all (stronger evidence).
    const httpsFinding = result.findings.find((f) => f.id === 'https')!
    assert.equal(httpsFinding.points, 0)
    assert.equal(httpsFinding.bucket, 'improve')
    assert.equal(checkStatusLabel(httpsFinding), 'Not met')
    assert.match(httpsFinding.detail, /could not be made/)
    assert.match(httpsFinding.detail, /strongly recommended/)
    assert.doesNotMatch(httpsFinding.detail, /doesn.t appear to use/, 'must use the fallback-specific wording, not the ordinary unused-HTTPS wording')

    // The remaining eligible technical checks still ran normally.
    const title = result.findings.find((f) => f.id === 'title')!
    assert.equal(title.points, CHECK_WEIGHTS.title)
    const meta = result.findings.find((f) => f.id === 'meta-description')!
    assert.equal(meta.points, CHECK_WEIGHTS['meta-description'])
    const mobile = result.findings.find((f) => f.id === 'mobile')!
    assert.equal(mobile.points, CHECK_WEIGHTS.mobile)
    assert.equal(result.checksCompleted, 7)
  } finally {
    server.close()
  }
})

// ─── 2: a real HTTPS response — including 404/500 — never triggers fallback ──

test('a real HTTPS 404 response is never retried over HTTP — a real status code is not a connection failure', async () => {
  const { server, port, cleanupCert } = await startHttpsServer((_req, res) => {
    res.writeHead(404)
    res.end('not found')
  })
  try {
    const result = await withInsecureTls(() => check(`127.0.0.1:${port}`, port))
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.equal(result.status, 'unscored')
    assert.equal(result.checksCompleted, 2, 'exactly the confirmed-error-response shape: availability + https only, never the 0-of-7 fallback-failure shape')
    const availability = result.findings.find((f) => f.id === 'availability')!
    assert.match(availability.detail, /status of 404/)
    const httpsFinding = result.findings.find((f) => f.id === 'https')!
    assert.equal(httpsFinding.bucket, 'good', 'HTTPS itself connected fine — only the response status was non-success')
  } finally {
    server.close()
    cleanupCert()
  }
})

test('a real HTTPS 500 response is never retried over HTTP', async () => {
  const { server, port, cleanupCert } = await startHttpsServer((_req, res) => {
    res.writeHead(500)
    res.end('server error')
  })
  try {
    const result = await withInsecureTls(() => check(`127.0.0.1:${port}`, port))
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.equal(result.status, 'unscored')
    assert.equal(result.checksCompleted, 2)
    const availability = result.findings.find((f) => f.id === 'availability')!
    assert.match(availability.detail, /status of 500/)
  } finally {
    server.close()
    cleanupCert()
  }
})

// ─── existing HTTPS sites are completely unaffected (no regression) ──

test('a real, healthy HTTPS site (self-signed fixture) scores exactly as before — no fallback path is ever entered', async () => {
  const { server, port, cleanupCert } = await startHttpsServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(
      page(
        `${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`,
        '<title>1234567890</title><meta name="description" content="12345678901234567890123456789012345678901234567890"><meta name="viewport" content="width=device-width">'
      )
    )
  })
  try {
    const result = await withInsecureTls(() => check(`127.0.0.1:${port}`, port))
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    assert.equal(result.finalUrl.startsWith('https://'), true)
    const httpsFinding = result.findings.find((f) => f.id === 'https')!
    assert.equal(httpsFinding.bucket, 'good')
    assert.equal(httpsFinding.points, CHECK_WEIGHTS.https)
    assert.equal(httpsFinding.detail, 'Your website loads over a secure (HTTPS) connection.', 'the ORIGINAL, unchanged wording for a normal working HTTPS site')
    assert.equal(result.checksCompleted, 7)
  } finally {
    server.close()
    cleanupCert()
  }
})

// ─── 3: an explicit https:// input is never silently downgraded ──

test('explicit https:// input: a real TLS-layer failure is NOT retried over HTTP — the user’s explicit protocol choice is respected', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('hello'))
  })
  try {
    const result = await check(`https://127.0.0.1:${port}`, port)
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.equal(result.status, 'unscored')
    assert.equal(result.checksCompleted, 0, 'no fallback occurred — the honest total-failure shape, not a scored HTTP result')
    const availability = result.findings.find((f) => f.id === 'availability')!
    assert.equal(availability.bucket, 'unverified')
    assert.doesNotMatch(availability.detail, /plain \(HTTP\)/, 'the dual-protocol-failure wording must never appear — HTTP was never attempted at all')
  } finally {
    server.close()
  }
})

// ─── 4: an explicit http:// input is checked as HTTP directly, never probing HTTPS first ──

test('explicit http:// input: checked directly as HTTP — exactly one connection is made, HTTPS is never attempted', async () => {
  let connectionCount = 0
  const { server, port } = await startServer((_req, res) => {
    connectionCount++
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(
      page(
        `${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p>`,
        '<title>1234567890</title><meta name="description" content="12345678901234567890123456789012345678901234567890">'
      )
    )
  })
  try {
    const result = await check(`http://127.0.0.1:${port}`, port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    assert.equal(result.finalUrl, `http://127.0.0.1:${port}/`)
    const httpsFinding = result.findings.find((f) => f.id === 'https')!
    assert.equal(httpsFinding.bucket, 'improve')
    assert.equal(httpsFinding.detail, 'Your website doesn’t appear to use a secure (HTTPS) connection. Most hosting providers offer free SSL certificates to enable this.', 'the ORIGINAL non-fallback wording — this was never a connection failure, HTTPS was simply never tried')
    assert.equal(connectionCount, 1, 'exactly one request reached the server — no separate HTTPS probe happened first')
  } finally {
    server.close()
  }
})

// ─── 6: neither protocol succeeds — honest unscored result, no fabricated evidence ──

test('bare hostname: both HTTPS and HTTP fail (nothing listening) — unscored, 0 of 7, no score fields, no claim about browser scripts', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200)
    res.end('unused')
  })
  server.close()
  await new Promise((resolve) => setTimeout(resolve, 50))

  const result = await check(`127.0.0.1:${port}`, port)
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error('unreachable')
  assert.equal(result.status, 'unscored')
  assert.equal(result.checksCompleted, 0)
  assert.equal(result.checksTotal, 7)
  assert.ok(!('score' in result))
  assert.ok(!('rawScore' in result))
  assert.ok(!('possiblePoints' in result))
  const availability = result.findings.find((f) => f.id === 'availability')!
  assert.equal(availability.bucket, 'unverified')
  assert.match(availability.detail, /secure \(HTTPS\) or a plain \(HTTP\) connection/)
  assert.ok(!availability.detail.toLowerCase().includes('browser script'), 'must never claim scripted content was seen — nothing was ever received')
})

test('checkerUnavailableResponse itself never claims the site "loads some content through browser scripts" for any reason text', () => {
  const result = checkerUnavailableResponse('https://example.com/', 'https://example.com/', 'The website couldn’t be reached.')
  if (!result.ok) throw new Error('unreachable')
  const availability = result.findings.find((f) => f.id === 'availability')!
  assert.ok(!availability.detail.toLowerCase().includes('browser script'))
})

// ─── 9: SSRF/redirect protections remain fully enforced during the fallback ──

test('a redirect during the HTTP fallback attempt to a disallowed port is still rejected — the safety boundary is not bypassed by the fallback', async () => {
  const { server, port } = await startServer((req, res) => {
    if (req.url === '/') {
      // Redirects to a port that is NOT in this test's allowedPorts —
      // must be rejected by assertSafeUrl exactly as any other redirect
      // would be, proving the fallback's own redirect hop is still
      // safety-checked, not given a free pass.
      res.writeHead(302, { location: 'http://127.0.0.1:1/' })
      res.end()
      return
    }
    res.writeHead(200)
    res.end('should never be reached')
  })
  try {
    const result = await check(`127.0.0.1:${port}`, port)
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.equal(result.status, 'unscored')
    assert.equal(result.checksCompleted, 0, 'the unsafe redirect must fail the whole attempt, not silently score a result')
  } finally {
    server.close()
  }
})

test('a redirect during the HTTP fallback to a private/loopback-classified address is still rejected', async () => {
  const { server, port } = await startServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(302, { location: `http://127.0.0.2:${port}/` })
      res.end()
      return
    }
    res.writeHead(200)
    res.end('should never be reached')
  })
  try {
    // classify() only allows 127.0.0.1 through — 127.0.0.2 is treated as
    // private/unsafe here, same as any real address this deps override
    // doesn't explicitly allow.
    const { res, state } = mockRes()
    await handleCheckWebsite({ method: 'POST', body: JSON.stringify({ url: `127.0.0.1:${port}` }) }, res, depsFor(port))
    assert.equal(state.statusCode, 200)
    const result = state.body!
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.equal(result.status, 'unscored')
    assert.equal(result.checksCompleted, 0)
  } finally {
    server.close()
  }
})

test('too many redirects during the HTTP fallback attempt is still bounded and rejected, exactly as an ordinary request would be', async () => {
  const { server, port } = await startServer((req, res) => {
    const hop = Number(req.url?.replace('/', '') || '0')
    res.writeHead(302, { location: `/${hop + 1}` })
    res.end()
  })
  try {
    const result = await check(`127.0.0.1:${port}`, port)
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.equal(result.status, 'unscored')
    assert.equal(result.checksCompleted, 0)
  } finally {
    server.close()
  }
})

test('a timeout during the HTTP fallback attempt (server accepts the connection but never responds) is still bounded by the same real timeoutMs', async () => {
  const { server, port } = await startServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(page('too slow'))
    }, 2000)
  })
  try {
    const started = Date.now()
    const result = await check(`127.0.0.1:${port}`, port, 150)
    const elapsed = Date.now() - started
    assert.ok(elapsed < 2000, `must not wait out the full 2s server delay — took ${elapsed}ms`)
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.equal(result.status, 'unscored')
    assert.equal(result.checksCompleted, 0)
  } finally {
    server.close()
  }
})

// ─── assertSafeUrl is genuinely re-invoked for the HTTP retry, not skipped ──

test('assertSafeUrl (the SSRF safety check) is genuinely re-invoked for the HTTP retry URL, not reused/cached from the failed HTTPS attempt', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('hello'))
  })
  try {
    let classifyCalls = 0
    const deps = {
      classify: (ip: string) => {
        classifyCalls++
        return ip !== '127.0.0.1'
      },
      allowedPorts: [String(port)],
    }
    const { res, state } = mockRes()
    // This hits handleCheckWebsite directly (not the `check()` helper
    // above, which builds its own deps) so this test's own counting
    // `classify` is the one actually threaded through both the initial
    // top-level check AND every hop of both the HTTPS and HTTP attempts.
    await handleCheckWebsite({ method: 'POST', body: JSON.stringify({ url: `127.0.0.1:${port}` }) }, res, deps)
    assert.equal(state.statusCode, 200)
    const result = state.body!
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    // At minimum: the top-level pre-flight check, the failed HTTPS hop,
    // and the successful HTTP retry's own hop — 3 real, independent
    // safety validations for this one request, not 1.
    assert.ok(classifyCalls >= 3, `expected assertSafeUrl to run independently for each attempt (>=3 calls), got ${classifyCalls}`)
  } finally {
    server.close()
  }
})
