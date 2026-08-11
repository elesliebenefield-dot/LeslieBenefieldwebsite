// Rubric-audit release — comprehensive, table-driven coverage for the
// Technical Basics scoring correction: label precision (Passed/
// Partially met/Not met/Unable to verify/Outside scope), the
// availability-confirmed-good gate for showing any score at all, and
// the honest "unable to complete"/no-score treatment for confirmed
// non-success responses and checker-side failures (DNS, timeout,
// connection, generic internal error). Real handler, real local fixture
// HTTP servers — never mocked — via handleCheckWebsite's test-only
// deps/timeoutMs injection (mirrors api/check-visual.ts's
// handleCheckVisual exactly).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { handleCheckWebsite, checkerUnavailableResponse } from '../api/check-website.ts'
import { CHECK_WEIGHTS, checkStatusLabel, TITLE_MIN_LENGTH, META_DESCRIPTION_MIN_LENGTH } from '../src/lib/websiteCheck.ts'
import type { CheckResponse, Finding } from '../src/lib/websiteCheck.ts'
import { buildCombinedEmailBody } from '../src/lib/emailBody.ts'
import type { RebuildCheckSuccess } from '../src/lib/visualCheck.ts'

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

/** api/check-website.ts's real fetch() call resolves hostnames through
 *  real DNS (unlike api/check-visual.ts's Puppeteer-based capture, which
 *  routes through a connection-binding proxy) — so a fake "safe.invalid"
 *  hostname can't be used here even with a `lookup` override, since that
 *  override only affects assertSafeUrl's own pre-check, not the actual
 *  network request. Instead, requests target the literal loopback
 *  address directly, and `classify` (same override point, same
 *  precedent as test/technicalFallback.test.ts's contactLinksDepsFor)
 *  allows just that one address through the private-IP rejection that
 *  would otherwise apply to it. */
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

async function checkFixture(port: number, timeoutMs?: number): Promise<CheckResponse> {
  const { res, state } = mockRes()
  await handleCheckWebsite({ method: 'POST', body: JSON.stringify({ url: `http://127.0.0.1:${port}/` }) }, res, depsFor(port), timeoutMs)
  assert.equal(state.statusCode, 200)
  if (!state.body) throw new Error('no response body')
  return state.body
}

function page(bodyHtml: string, headHtml = ''): string {
  return `<!DOCTYPE html><html><head>${headHtml}</head><body>${bodyHtml}</body></html>`
}

// Comfortably clears THIN_CONTENT_THRESHOLD (200 visible characters) so
// contact/links are genuinely evaluated rather than left 'unverified' —
// used by tests that need a fully scored result to inspect a specific
// check in isolation.
const SUBSTANTIAL_CONTENT =
  '<p>Real content well past the thin-content threshold, so the static check trusts this page enough to sample its links and contact information directly, rather than treating it as a JS application shell that renders everything client-side.</p>'

// ─── Pure function: checkStatusLabel — every bucket/points combination ──

test('checkStatusLabel: good is always Passed', () => {
  assert.equal(checkStatusLabel({ id: 'x', label: 'X', bucket: 'good', detail: '', points: 10 }), 'Passed')
})

test('checkStatusLabel: improve with points > 0 is Partially met — the exact bug this release fixes', () => {
  assert.equal(checkStatusLabel({ id: 'title', label: 'Page title', bucket: 'improve', detail: '', points: 5 }), 'Partially met')
})

test('checkStatusLabel: improve with 0 points is Not met, distinct from Partially met', () => {
  assert.equal(checkStatusLabel({ id: 'title', label: 'Page title', bucket: 'improve', detail: '', points: 0 }), 'Not met')
})

test('checkStatusLabel: unverified is always Unable to verify, regardless of points', () => {
  assert.equal(checkStatusLabel({ id: 'contact', label: 'Contact', bucket: 'unverified', detail: '', points: 0 }), 'Unable to verify')
})

test('checkStatusLabel: specialist is always Outside scope', () => {
  assert.equal(checkStatusLabel({ id: 'availability', label: 'Availability', bucket: 'specialist', detail: '', points: 0 }), 'Outside scope')
})

// ─── Title: 10/10 (good), 5/10 (partial, present-but-short), 0/10 (missing) ──

test('title: at or above the length threshold earns full credit (10/10) and is labeled Passed', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('<p>content</p>', `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title>`))
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    const title = result.findings.find((f) => f.id === 'title')!
    assert.equal(title.points, CHECK_WEIGHTS.title)
    assert.equal(title.bucket, 'good')
    assert.equal(checkStatusLabel(title), 'Passed')
  } finally {
    server.close()
  }
})

test('title: present but under the length threshold earns partial credit (5/10) and is labeled Partially met', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('<p>content</p>', `<title>${'x'.repeat(TITLE_MIN_LENGTH - 1)}</title>`))
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    const title = result.findings.find((f) => f.id === 'title')!
    assert.equal(title.points, 5)
    assert.equal(title.bucket, 'improve')
    assert.equal(checkStatusLabel(title), 'Partially met')
  } finally {
    server.close()
  }
})

test('title: missing entirely earns zero credit (0/10) and is labeled Not met — distinct from the partial-credit case above', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('<p>content</p>'))
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    const title = result.findings.find((f) => f.id === 'title')!
    assert.equal(title.points, 0)
    assert.equal(title.bucket, 'improve')
    assert.equal(checkStatusLabel(title), 'Not met')
  } finally {
    server.close()
  }
})

// ─── Meta description: same 10/10, 5/10, 0/10 shape as title ──────────

test('meta description: at or above the length threshold earns full credit (10/10) and is labeled Passed', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('<p>content</p>', `<meta name="description" content="${'x'.repeat(META_DESCRIPTION_MIN_LENGTH)}">`))
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    const meta = result.findings.find((f) => f.id === 'meta-description')!
    assert.equal(meta.points, CHECK_WEIGHTS['meta-description'])
    assert.equal(meta.bucket, 'good')
    assert.equal(checkStatusLabel(meta), 'Passed')
  } finally {
    server.close()
  }
})

test('meta description: present but under the length threshold earns partial credit (5/10) and is labeled Partially met', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('<p>content</p>', `<meta name="description" content="${'x'.repeat(META_DESCRIPTION_MIN_LENGTH - 1)}">`))
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    const meta = result.findings.find((f) => f.id === 'meta-description')!
    assert.equal(meta.points, 5)
    assert.equal(meta.bucket, 'improve')
    assert.equal(checkStatusLabel(meta), 'Partially met')
  } finally {
    server.close()
  }
})

test('meta description: missing entirely earns zero credit (0/10) and is labeled Not met', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('<p>content</p>'))
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    const meta = result.findings.find((f) => f.id === 'meta-description')!
    assert.equal(meta.points, 0)
    assert.equal(meta.bucket, 'improve')
    assert.equal(checkStatusLabel(meta), 'Not met')
  } finally {
    server.close()
  }
})

// ─── Homepage links: proportional credit, including partial and zero ──

test('homepage links: proportional credit when some sampled links are broken (2 of 3 working → 3/5, rounded)', async () => {
  const { server, port } = await startServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(page(`${SUBSTANTIAL_CONTENT}<a href="/a">A</a> <a href="/b">B</a> <a href="/broken">Broken</a>`))
      return
    }
    if (req.url === '/a' || req.url === '/b') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(page('ok'))
      return
    }
    res.writeHead(404)
    res.end('not found')
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    const links = result.findings.find((f) => f.id === 'links')!
    assert.equal(links.points, Math.round(CHECK_WEIGHTS.links * (2 / 3)))
    assert.equal(links.bucket, 'improve')
    assert.equal(checkStatusLabel(links), 'Partially met')
  } finally {
    server.close()
  }
})

test('homepage links: zero credit when every sampled link is broken (0/5), still labeled Partially-met-shaped as Not met', async () => {
  const { server, port } = await startServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(page(`${SUBSTANTIAL_CONTENT}<a href="/broken1">A</a> <a href="/broken2">B</a>`))
      return
    }
    res.writeHead(404)
    res.end('not found')
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    const links = result.findings.find((f) => f.id === 'links')!
    assert.equal(links.points, 0)
    assert.equal(links.bucket, 'improve')
    assert.equal(checkStatusLabel(links), 'Not met')
  } finally {
    server.close()
  }
})

// ─── Confirmed non-success responses: real evidence, but too little to score ──

test('confirmed 404: only availability and https complete (2 of 7), no score fields, real status named honestly', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(404)
    res.end('not found')
  })
  try {
    const result = await checkFixture(port)
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.equal(result.status, 'unscored')
    assert.equal(result.checksCompleted, 2)
    assert.equal(result.checksTotal, 7)
    assert.ok(!('score' in result), 'a confirmed-bad-status result must have no score field at all')
    assert.ok(!('rawScore' in result), 'no rawScore field either')
    assert.ok(!('possiblePoints' in result), 'no possiblePoints field either')
    const availability = result.findings.find((f) => f.id === 'availability')!
    assert.match(availability.detail, /status of 404/)
    assert.ok(!availability.detail.toLowerCase().includes("doesn't work") && !availability.detail.toLowerCase().includes('does not work'), 'must not claim the website itself is broken')
    const https = result.findings.find((f) => f.id === 'https')!
    assert.ok(https, 'https is still evaluated even on a confirmed-bad-status response — a real response came back at all')
    assert.equal(https.bucket, 'improve', 'this fixture is plain HTTP')
  } finally {
    server.close()
  }
})

test('confirmed 500: same shape as 404 — real status named, 2 of 7, no score', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(500)
    res.end('server error')
  })
  try {
    const result = await checkFixture(port)
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.equal(result.status, 'unscored')
    assert.equal(result.checksCompleted, 2)
    assert.ok(!('score' in result))
    const availability = result.findings.find((f) => f.id === 'availability')!
    assert.match(availability.detail, /status of 500/)
  } finally {
    server.close()
  }
})

// ─── Checker-side failures: never confirmed evidence, always unverified/0-of-7/no-score ──

test('DNS/connection failure (nothing listening): honest unverified state, 0 of 7, no score, does not claim the website is down', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200)
    res.end('unused')
  })
  server.close() // nothing is listening on this port by the time the request is made
  await new Promise((resolve) => setTimeout(resolve, 50))

  const { res, state } = mockRes()
  await handleCheckWebsite({ method: 'POST', body: JSON.stringify({ url: `http://127.0.0.1:${port}/` }) }, res, depsFor(port))
  assert.equal(state.statusCode, 200)
  const result = state.body!
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error('unreachable')
  assert.equal(result.status, 'unscored')
  assert.equal(result.checksCompleted, 0)
  assert.equal(result.checksTotal, 7)
  assert.ok(!('score' in result))
  const availability = result.findings.find((f) => f.id === 'availability')!
  assert.equal(availability.bucket, 'unverified')
  assert.ok(
    !/\bis down\b/i.test(availability.detail) || /doesn.t necessarily mean/i.test(availability.detail),
    'must not flatly assert the website is down — a hedged "doesn\'t necessarily mean...is down" is fine, an unqualified claim is not'
  )
  assert.match(availability.detail, /temporary|limitation of this automated checker/)
})

test('timeout: a real, bounded (test-only short timeoutMs) AbortError produces the same honest unverified/0-of-7/no-score shape', async () => {
  const { server, port } = await startServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(page('<p>too slow</p>'))
    }, 500)
  })
  try {
    const { res, state } = mockRes()
    await handleCheckWebsite({ method: 'POST', body: JSON.stringify({ url: `http://127.0.0.1:${port}/` }) }, res, depsFor(port), 100)
    assert.equal(state.statusCode, 200)
    const result = state.body!
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.equal(result.status, 'unscored')
    assert.equal(result.checksCompleted, 0)
    assert.ok(!('score' in result))
    const availability = result.findings.find((f) => f.id === 'availability')!
    assert.match(availability.detail, /took too long to respond/)
  } finally {
    server.close()
  }
})

// ─── Correct denominator exclusion (available=true, contact/links genuinely unverifiable) ──

test('a thin-content page (JS application shell) leaves contact/links unverified, excluded from the denominator — not scored as a failure', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('<div id="app"></div>', '<title>App</title>')) // deliberately thin: under THIN_CONTENT_THRESHOLD
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result — availability/https/mobile/title/meta are always determinable regardless of body content')
    const contact = result.findings.find((f) => f.id === 'contact')!
    const links = result.findings.find((f) => f.id === 'links')!
    assert.equal(contact.bucket, 'unverified')
    assert.equal(links.bucket, 'unverified')
    assert.equal(checkStatusLabel(contact), 'Unable to verify')
    assert.equal(checkStatusLabel(links), 'Unable to verify')
    // possiblePoints must have shrunk by exactly both checks' weights —
    // never left at 100 as if they'd been scored and failed.
    assert.equal(result.possiblePoints, 100 - CHECK_WEIGHTS.contact - CHECK_WEIGHTS.links)
    assert.equal(result.checksCompleted, 5)
  } finally {
    server.close()
  }
})

// ─── Exact formula agreement ────────────────────────────────────────

test('exact formula agreement: score always equals round((rawScore / possiblePoints) * 100), clamped 0-100, for a fully completed 7-of-7 result', async () => {
  const { server, port } = await startServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(
        page(
          `${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`,
          `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title><meta name="description" content="${'x'.repeat(META_DESCRIPTION_MIN_LENGTH)}"><meta name="viewport" content="width=device-width">`
        )
      )
      return
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('ok'))
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    assert.equal(result.checksCompleted, 7, 'this fixture is deliberately built to complete every counted check')
    const expected = Math.max(0, Math.min(100, Math.round((result.rawScore / result.possiblePoints) * 100)))
    assert.equal(result.score, expected)
  } finally {
    server.close()
  }
})

// ─── Generic internal (post-fetch) failure ──────────────────────────
//
// Forcing a genuine unexpected exception through the full HTTP path
// without artificial fault injection isn't practical (evaluateHomepageLinks
// and buildReport don't throw under any normal input). The pre-fetch DNS
// and timeout tests above already prove the real handler's catch-block
// wiring correctly turns a real thrown error into this exact shape; this
// test covers the shared response builder itself directly, at the pure-
// function level, since both the pre-fetch and post-fetch catch blocks
// in handleCheckWebsite call it identically.
test('generic internal failure: checkerUnavailableResponse produces the same honest unverified/0-of-7/no-score shape, without leaking the real error detail', () => {
  const result = checkerUnavailableResponse('https://example.com/', 'https://example.com/', 'An unexpected error occurred while finishing this check.')
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
  assert.match(availability.detail, /An unexpected error occurred while finishing this check\./)
})

// ─── Email: no score line for unscored results ─────────────────────

test('email: an unscored result never shows a numerical score line, only the honest completed-check count', () => {
  const unscored = {
    ok: true as const,
    status: 'unscored' as const,
    input: 'https://example.com/',
    finalUrl: 'https://example.com/',
    summary: 'We weren’t able to complete this check for your website.',
    findings: [{ id: 'availability', label: 'Homepage availability', bucket: 'unverified' as const, detail: 'Could not reach it.', points: 0 }] satisfies Finding[],
    checksCompleted: 0,
    checksTotal: 7,
  }
  const body = buildCombinedEmailBody(unscored, null, { detailLimit: null, includeGoodSections: true, unverifiedSummaryOnly: false })
  assert.ok(!/\d+\/100/.test(body), 'no "X/100" score must ever appear in the email for an unscored result')
  assert.ok(body.includes('Technical Basics: Unable to complete this check (0 of 7 checks completed)'))
})

test('email: a scored result shows the real score line', () => {
  const scored = {
    ok: true as const,
    status: 'scored' as const,
    input: 'https://example.com/',
    finalUrl: 'https://example.com/',
    score: 79,
    rawScore: 75,
    possiblePoints: 95,
    summary: 'The technical basics checked look solid, with some room to improve.',
    findings: [] as Finding[],
    checksCompleted: 6,
    checksTotal: 7,
  }
  const body = buildCombinedEmailBody(scored, null, { detailLimit: null, includeGoodSections: true, unverifiedSummaryOnly: false })
  assert.ok(body.includes('Technical Basics Score: 79/100 (6 of 7 checks completed)'))
})

// Unused import guard for RebuildCheckSuccess type (kept for parity with
// emailBody's own signature — not exercised directly by these tests).
void (null as unknown as RebuildCheckSuccess | null)
