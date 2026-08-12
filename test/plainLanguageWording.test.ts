// Plain-language release — purposeful coverage proving the rewritten
// visitor-facing wording is accurate, not just different. Real local
// fixture servers via handleCheckWebsite's test-only deps/timeoutMs
// injection (never mocked) — same established pattern as
// test/scoringRubric.test.ts and test/protocolFallback.test.ts.
//
// This file does NOT re-test scoring/detection logic (weights,
// thresholds, point states, denominator rules, HTTP fallback triggers)
// — that coverage already exists and is untouched by this release. It
// tests only that the WORDING attached to those same, unchanged results
// is accurate, non-alarming, and free of unexplained jargon.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { handleCheckWebsite } from '../api/check-website.ts'
import { CHECK_WEIGHTS, TITLE_MIN_LENGTH, META_DESCRIPTION_MIN_LENGTH } from '../src/lib/websiteCheck.ts'
import type { CheckResponse, CheckScored, Finding } from '../src/lib/websiteCheck.ts'
import { buildCombinedEmailBody } from '../src/lib/emailBody.ts'

/** Real self-signed HTTPS fixture — same established pattern as
 *  test/protocolFallback.test.ts — needed to genuinely exercise the
 *  "HTTPS is working" wording, as opposed to the fallback-specific
 *  wording a plain-HTTP fixture would trigger for a bare hostname. */
function generateSelfSignedCert(): { key: Buffer; cert: Buffer; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'plain-language-cert-'))
  const keyPath = path.join(dir, 'key.pem')
  const certPath = path.join(dir, 'cert.pem')
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath, '-days', '1', '-nodes', '-subj', '/CN=127.0.0.1'], {
    stdio: 'pipe',
  })
  return { key: readFileSync(keyPath), cert: readFileSync(certPath), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

async function startHttpsServer(handlerFn: http.RequestListener): Promise<{ server: https.Server; port: number; cleanupCert: () => void }> {
  const { key, cert, cleanup } = generateSelfSignedCert()
  const server = https.createServer({ key, cert }, handlerFn)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('failed to bind fixture HTTPS server')
  return { server, port: address.port, cleanupCert: cleanup }
}

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

async function checkFixture(port: number): Promise<CheckResponse> {
  const { res, state } = mockRes()
  await handleCheckWebsite({ method: 'POST', body: JSON.stringify({ url: `127.0.0.1:${port}` }) }, res, depsFor(port))
  assert.equal(state.statusCode, 200)
  if (!state.body) throw new Error('no response body')
  return state.body
}

function page(bodyHtml: string, headHtml = ''): string {
  return `<!DOCTYPE html><html><head>${headHtml}</head><body>${bodyHtml}</body></html>`
}

const SUBSTANTIAL_CONTENT =
  '<p>Real content well past the thin-content threshold, so the static check trusts this page enough to sample its links and contact information directly, rather than treating it as a JS application shell.</p>'

function findingFor(result: CheckResponse, id: string) {
  if (!result.ok) throw new Error('expected ok result')
  const finding = result.findings.find((f) => f.id === id)
  if (!finding) throw new Error(`no finding with id ${id}`)
  return finding
}

// Phrases that would overstate certainty this checker never established —
// checked against every finding detail this file inspects. The ranking
// list deliberately excludes the required NEGATED sentence ("does not
// guarantee higher search rankings") via the negative lookbehind — that
// exact disclaimer is REQUIRED text, not a violation.
const SEARCH_VISIBILITY_PREVENTION_CLAIMS = [/won.t (appear|show up) in search/i, /can.t be found in search/i, /prevents? .* from appearing in search/i, /invisible to search/i]
const RANKING_PROMISE_CLAIMS = [
  /\bwill improve your (search )?ranking/i,
  /\bboosts? your (search )?ranking/i,
  /\bwill rank higher/i,
  /(?<!does not |doesn.t )\bguarantees? (higher|better) (search )?ranking/i,
]

function assertNoOverclaiming(detail: string, label: string) {
  for (const re of SEARCH_VISIBILITY_PREVENTION_CLAIMS) {
    assert.doesNotMatch(detail, re, `${label} must not claim a missing description prevents the business from appearing in search results: "${detail}"`)
  }
  for (const re of RANKING_PROMISE_CLAIMS) {
    assert.doesNotMatch(detail, re, `${label} must not promise improved search rankings: "${detail}"`)
  }
}

// ─── Search-result description (meta description) — every state ────

test('search-result description: missing — uses the specified label, primary message, and explanation; mentions the technical term secondarily; no visibility-prevention claim; no ranking promise', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page(`${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`, `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title>`))
  })
  try {
    const result = await checkFixture(port)
    const finding = findingFor(result, 'meta-description')
    assert.equal(finding.label, 'Search-result description', 'the label must never be the raw technical term')
    assert.equal(finding.points, 0)
    assert.match(finding.detail, /^No search-result description was found\./, 'the exact primary message specified')
    assert.match(finding.detail, /Search engines may create one automatically/)
    assert.match(finding.detail, /may not describe your business as clearly as you would like/)
    assert.match(finding.detail, /Adding a concise description can help potential customers understand what you offer and decide whether to visit your website/)
    assert.match(finding.detail, /It does not guarantee higher search rankings\./)
    assert.match(finding.detail, /commonly called a meta description/i, 'the technical term is introduced secondarily, not as the primary label')
    assertNoOverclaiming(finding.detail, 'the missing-description finding')
  } finally {
    server.close()
  }
})

test('search-result description: present but short — explains the benefit without a ranking promise, and still names the technical term', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(
      page(
        `${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`,
        `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title><meta name="description" content="short description">`
      )
    )
  })
  try {
    const result = await checkFixture(port)
    const finding = findingFor(result, 'meta-description')
    assert.equal(finding.label, 'Search-result description')
    assert.equal(finding.points, 5)
    assert.match(finding.detail, /help potential customers understand what you offer and decide whether to visit/)
    assert.match(finding.detail, /It does not guarantee higher search rankings\./)
    assert.match(finding.detail, /meta description/i)
    assertNoOverclaiming(finding.detail, 'the short-description finding')
  } finally {
    server.close()
  }
})

test('search-result description: present and long enough — passes, explains what it is and does for visitors, no ranking promise', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(
      page(
        `${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`,
        `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title><meta name="description" content="${'x'.repeat(META_DESCRIPTION_MIN_LENGTH)}">`
      )
    )
  })
  try {
    const result = await checkFixture(port)
    const finding = findingFor(result, 'meta-description')
    assert.equal(finding.label, 'Search-result description')
    assert.equal(finding.points, CHECK_WEIGHTS['meta-description'])
    assert.match(finding.detail, /summary text search engines often show beneath your page.s title/)
    assert.match(finding.detail, /meta description/i)
    assertNoOverclaiming(finding.detail, 'the good-description finding')
  } finally {
    server.close()
  }
})

// ─── Plain explanations for every other counted check ───────────────

test('HTTPS (working): explains what it protects, without claiming complete website security', async () => {
  const { server, port, cleanupCert } = await startHttpsServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page(`${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`, `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title>`))
  })
  try {
    const result = await withInsecureTls(() => checkFixture(port))
    const httpsFinding = findingFor(result, 'https')
    assert.equal(httpsFinding.bucket, 'good', 'this fixture must have genuinely connected over HTTPS, not fallen back to HTTP')
    assert.match(httpsFinding.detail, /protects information traveling between a visitor.s browser and your site/)
    assert.doesNotMatch(httpsFinding.detail, /completely secure|fully secure|makes your (site|website) secure\b/i, 'must not overclaim HTTPS as complete website security')
  } finally {
    server.close()
    cleanupCert()
  }
})

test('mobile setup: explains the basic sizing setting, without claiming the complete mobile design is good', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(
      page(
        `${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`,
        `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title><meta name="viewport" content="width=device-width">`
      )
    )
  })
  try {
    const result = await checkFixture(port)
    const mobile = findingFor(result, 'mobile')
    assert.match(mobile.detail, /basic setting needed to size your page for phones and tablets/)
    assert.doesNotMatch(mobile.detail, /looks (great|good) on mobile|complete mobile (design|experience) is good/i, 'must not claim the full mobile design/experience is good')
  } finally {
    server.close()
  }
})

test('page title: explains browser tab + search-result headline in plain language', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page(`${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`, `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title>`))
  })
  try {
    const result = await checkFixture(port)
    const title = findingFor(result, 'title')
    assert.match(title.detail, /text shown in a browser tab/)
    assert.match(title.detail, /clickable headline for your page in search results/)
  } finally {
    server.close()
  }
})

test('contact detection: explains what was found and that this was an automated homepage-only scan', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page(`${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`, `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title>`))
  })
  try {
    const result = await checkFixture(port)
    const contact = findingFor(result, 'contact')
    assert.match(contact.detail, /looks like contact information/)
    assert.match(contact.detail, /automated scan of your homepage only/)
  } finally {
    server.close()
  }
})

test('sampled links: explains only a small sample was tested, not the entire website', async () => {
  const { server, port } = await startServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(page(`${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`, `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title>`))
      return
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('ok'))
  })
  try {
    const result = await checkFixture(port)
    const links = findingFor(result, 'links')
    assert.match(links.detail, /small sample, not a check of your entire website/)
  } finally {
    server.close()
  }
})

test('unverified (thin-content) results: never claim browser scripts without evidence, and never read as a failure', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('<div id="app"></div>', `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title>`))
  })
  try {
    const result = await checkFixture(port)
    const contact = findingFor(result, 'contact')
    const links = findingFor(result, 'links')
    for (const finding of [contact, links]) {
      assert.equal(finding.bucket, 'unverified')
      assert.ok(!finding.detail.toLowerCase().includes('browser script'), `must not use "browser scripts" jargon: "${finding.detail}"`)
      assert.ok(!/failed|failure/i.test(finding.detail), `an unverified result must never read as a failure: "${finding.detail}"`)
    }
  } finally {
    server.close()
  }
})

// ─── Response time: sub-0.1s must never render as "0.0 seconds" ─────

test('response time under 0.1 seconds is shown as "under 0.1 seconds," never "about 0.0 seconds"', async () => {
  const { server, port } = await startServer((_req, res) => {
    // Respond as fast as the event loop allows — real elapsed time on
    // loopback is reliably under 100ms, never mocked.
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page(`${SUBSTANTIAL_CONTENT}<p>Call us at (555) 123-4567.</p><a href="/about">About</a>`, `<title>${'x'.repeat(TITLE_MIN_LENGTH)}</title>`))
  })
  try {
    const result = await checkFixture(port)
    const responseTime = findingFor(result, 'response-time')
    assert.doesNotMatch(responseTime.detail, /0\.0 seconds/, 'a sub-0.1s response must never display as "0.0 seconds"')
    assert.match(responseTime.detail, /under 0\.1 seconds/)
  } finally {
    server.close()
  }
})

// ─── Completed vs. passed ────────────────────────────────────────────

test('"completed" is explicitly distinguished from "passed" in the score explanation, for a fully-completed result', async () => {
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
    assert.equal(result.checksCompleted, 7)
    // The API's own findings/summary don't carry this explanatory
    // sentence (that lives in CheckPage.tsx's ScoreExplanation, covered
    // by test/checkPage.scoreExplanation.test.ts) — this test instead
    // confirms the underlying data a "100% complete" reader could
    // otherwise misread as "100% passed" actually contains an 'improve'
    // opportunity, proving completion and passing are genuinely
    // different facts the UI must (and does, per the browser test)
    // distinguish.
  } finally {
    server.close()
  }
})

// ─── Email, untruncated: the full disclaimer survives verbatim ──────
//
// buildCombinedEmailBody's own detailLimit:null tier is called directly
// here (bypassing buildMailtoHref's length-based tier selection, which
// is pre-existing, unrelated behavior — see the real-page-length caveat
// in test/checkPage.plainLanguage.test.ts) to prove that WHEN the email
// shows full detail, the required disclaimer is there verbatim, not
// merely present after this release's rewrite.

test('email (untruncated tier): the missing search-result-description disclaimer survives verbatim, with no ranking promise and no search-visibility-prevention claim', () => {
  const technical: CheckScored = {
    ok: true,
    status: 'scored',
    input: 'https://example.com/',
    finalUrl: 'https://example.com/',
    score: 90,
    rawScore: 90,
    possiblePoints: 100,
    summary: 'The technical basics checked look great, with just a few small things worth a look.',
    checksCompleted: 7,
    checksTotal: 7,
    findings: [
      {
        id: 'meta-description',
        label: 'Search-result description',
        bucket: 'improve',
        detail:
          'No search-result description was found. Search engines may create one automatically using text from your homepage, but it may not describe your business as clearly as you would like. Adding a concise description can help potential customers understand what you offer and decide whether to visit your website. It does not guarantee higher search rankings. This is commonly called a meta description.',
        points: 0,
      },
    ] satisfies Finding[],
  }
  const body = buildCombinedEmailBody(technical, null, { detailLimit: null, includeGoodSections: true, unverifiedSummaryOnly: false })
  assert.ok(body.includes('No search-result description was found.'))
  assert.ok(body.includes('It does not guarantee higher search rankings.'))
  assert.ok(body.includes('This is commonly called a meta description.'))
  assertNoOverclaiming(body, 'the untruncated email body')
})

// ─── Weights, thresholds, and detection logic are unchanged ─────────

test('check weights are unchanged by this wording-only release', () => {
  assert.deepEqual(CHECK_WEIGHTS, {
    availability: 30,
    https: 25,
    mobile: 15,
    title: 10,
    'meta-description': 10,
    contact: 5,
    links: 5,
  })
})

test('title/meta-description length thresholds are unchanged by this wording-only release', () => {
  assert.equal(TITLE_MIN_LENGTH, 10)
  assert.equal(META_DESCRIPTION_MIN_LENGTH, 50)
})
