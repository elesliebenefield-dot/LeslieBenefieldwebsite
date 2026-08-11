// Release-polish pass — end-to-end tests for the Technical Basics
// contact-info/homepage-links rendered-DOM fallback: real Chrome, real
// local fixture HTTP server, real (self-contained) link-checking —
// never a real third-party site. `captureOverrides` (the capture
// pipeline's own deps/allowedHttpPort — see test/pipeline.captureService.test.ts)
// and `contactLinksDeps` (src/lib/contactLinksCheck.ts's OWN, separate
// safety boundary for the fallback's link-checking fetches) are both
// test-only parameters accepted by handleCheckVisual; production
// supplies neither.
//
// The fixture page's initial static HTML is deliberately thin (an empty
// <div id="app">) with a script that injects real content, a phone
// number, an email/mailto link, and a mix of safe same-origin links
// plus unsupported/unsafe link types — all via string concatenation so
// none of it is a literal, regex-matchable substring in the raw
// (pre-render) HTML. This proves the static check would have seen
// "thin content, nothing found" while the rendered DOM has real,
// verifiable evidence.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import http from 'node:http'
import { handleCheckVisual } from '../api/check-visual.ts'
import { resolveLocalChromePath } from '../src/lib/pipeline/capture/browserLifecycle.ts'
import { evaluateContactSignal, evaluateHomepageLinks } from '../src/lib/contactLinksCheck.ts'
import type { RebuildCheckResponse } from '../src/lib/visualCheck.ts'
import type { CaptureBrowserHandle } from '../src/lib/pipeline/capture/browserLifecycle.ts'

const CHROME_PATH = resolveLocalChromePath()
const chromeAvailable = existsSync(CHROME_PATH)

function skippableTest(name: string, fn: () => Promise<void>): void {
  test(name, { skip: !chromeAvailable ? 'local Chrome not found at the expected path — skipping real-browser tests' : false }, fn)
}

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

// A phone number and email address that only ever exist as JS-assembled
// fragments in the delivered bytes — see the file-level comment above.
//
// The browser navigates to a fake "safe.invalid" hostname (safe because
// the capture pipeline's connection-binding proxy binds the ACTUAL
// connection by validated IP, regardless of what that hostname would
// really resolve to). checkLink's own fallback link-checking has no
// such proxy — it calls fetch() directly — so the injected links must
// be genuinely reachable: absolute http://127.0.0.1:PORT/... URLs, not
// paths relative to "safe.invalid" (which isn't a real, resolvable
// hostname on this machine).
const homePageHtml = (port: number) => `<!DOCTYPE html>
<html lang="en">
<head><title>JS-rendered contact and links</title></head>
<body>
<div id="app"></div>
<script>
  var digits = ['5','5','5','-','1','2','3','-','4','5','6','7'];
  var phone = '+1 ' + digits.join('');
  var user = 'info';
  var atSign = String.fromCharCode(64);
  var domain = 'example.invalid';
  var email = user + atSign + domain;
  var mailtoScheme = 'mail' + 'to:';
  var origin = 'http://127.0.0.1:${port}';
  var content =
    '<main><h1>Welcome</h1>' +
    '<p>This is the real content of the page, injected by a script after the initial response ' +
    'well past the length threshold this automated check uses to decide whether a rendered ' +
    'fallback is worth attempting instead of just reading the raw HTML that was actually delivered.</p>' +
    '<p>Call us at ' + phone + ' or email <a href="' + mailtoScheme + email + '">' + email + '</a>.</p>' +
    '<nav>' +
      '<a href="' + origin + '/about">About</a> ' +
      '<a href="' + origin + '/services">Services</a> ' +
      '<a href="' + origin + '/pricing">Pricing</a> ' +
      '<a href="' + mailtoScheme + email + '">Email</a> ' +
      '<a href="tel:+15551234567">Call</a> ' +
      '<a href="javascript:void(0)">Menu</a> ' +
      '<a href="#top">Back to top</a>' +
    '</nav>' +
    '</main>';
  document.getElementById('app').innerHTML = content;
</script>
</body>
</html>`

const SIMPLE_PAGE = (title: string) => `<!DOCTYPE html><html><head><title>${title}</title></head><body><p>ok</p></body></html>`

async function startFixtureServer(): Promise<{ server: http.Server; port: number }> {
  let port = 0
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === undefined) {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(homePageHtml(port))
      return
    }
    if (req.url === '/about' || req.url === '/services' || req.url === '/pricing') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(SIMPLE_PAGE(req.url))
      return
    }
    res.writeHead(404)
    res.end('not found')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('failed to bind fixture server')
  port = address.port
  return { server, port }
}

/** The capture pipeline's OWN URL-safety deps (networkSafety.ts) — for
 *  the browser's navigation itself. Matches test/pipeline.captureService.test.ts's
 *  own depsFor exactly. */
function captureDepsFor(port: number) {
  return {
    lookup: async (hostname: string) => {
      if (hostname === 'safe.invalid') return [{ address: '127.0.0.1', family: 4 }]
      throw new Error(`unexpected test host: ${hostname}`)
    },
    classify: (ip: string) => (ip === '127.0.0.1' ? ('public' as const) : ('unparsable' as const)),
    allowedPorts: [String(port)],
  }
}

/** src/lib/contactLinksCheck.ts's OWN, separate deps — for the
 *  fallback's own direct fetch-based link-checking (checkLink), not the
 *  capture pipeline's proxy. */
function contactLinksDepsFor(port: number) {
  return {
    lookup: async (hostname: string) => {
      if (hostname === 'safe.invalid') return [{ address: '127.0.0.1' }]
      throw new Error(`unexpected test host: ${hostname}`)
    },
    classify: (ip: string) => ip !== '127.0.0.1', // true = private/unsafe
    allowedPorts: [String(port)],
  }
}

skippableTest('a JavaScript-injected phone number/email/mailto link becomes verifiable through the rendered-DOM fallback', async () => {
  const { server, port } = await startFixtureServer()
  try {
    const { res, state } = mockRes()
    await handleCheckVisual(
      { method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/`, needsContactFallback: true, needsLinksFallback: false }) },
      res,
      { executablePath: CHROME_PATH, navigationTimeoutMs: 8000, deps: captureDepsFor(port), allowedHttpPort: port },
      contactLinksDepsFor(port)
    )
    assert.equal(state.statusCode, 200)
    assert.equal(state.body?.ok, true)
    if (!state.body?.ok) throw new Error('unreachable')
    assert.ok(state.body.contactFallback, 'a contact fallback must be present')
    assert.equal(state.body.contactFallback?.finding.bucket, 'good')
    assert.equal(state.body.contactFallback?.points, 5)
    assert.equal(state.body.contactFallback?.possiblePointsRestored, 5)
    assert.ok(!state.body.linksFallback, 'links fallback was not requested, so it must be absent')
  } finally {
    server.close()
  }
})

skippableTest('JavaScript-injected safe same-origin links are verified through the existing protected sampling/checking path (real assertSafeUrl + fetch)', async () => {
  const { server, port } = await startFixtureServer()
  try {
    const { res, state } = mockRes()
    await handleCheckVisual(
      { method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/`, needsContactFallback: false, needsLinksFallback: true }) },
      res,
      { executablePath: CHROME_PATH, navigationTimeoutMs: 8000, deps: captureDepsFor(port), allowedHttpPort: port },
      contactLinksDepsFor(port)
    )
    assert.equal(state.statusCode, 200)
    if (!state.body?.ok) throw new Error('unreachable')
    assert.ok(state.body.linksFallback, 'a links fallback must be present')
    assert.equal(state.body.linksFallback?.finding.bucket, 'good')
    assert.equal(state.body.linksFallback?.points, 5)
    assert.match(state.body.linksFallback!.finding.detail, /sample of 3 links?/, 'exactly the 3 safe same-origin links must have been sampled — mailto:/tel:/javascript:/fragment links excluded')
    assert.ok(!state.body.contactFallback, 'contact fallback was not requested, so it must be absent')
  } finally {
    server.close()
  }
})

skippableTest('unsupported/unsafe rendered links (mailto:, tel:, javascript:, fragment) never reach the link sample — only the 3 real http(s) candidates are counted', async () => {
  const { server, port } = await startFixtureServer()
  try {
    const { res, state } = mockRes()
    await handleCheckVisual(
      { method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/`, needsLinksFallback: true }) },
      res,
      { executablePath: CHROME_PATH, navigationTimeoutMs: 8000, deps: captureDepsFor(port), allowedHttpPort: port },
      contactLinksDepsFor(port)
    )
    if (!state.body?.ok) throw new Error('unreachable')
    // 7 hrefs are injected total (3 real + mailto + tel + javascript + fragment);
    // only the 3 real ones must ever have been sampled/checked.
    assert.match(state.body.linksFallback!.finding.detail, /sample of 3 links?/)
  } finally {
    server.close()
  }
})

skippableTest('fallback not requested: the response carries no contactFallback/linksFallback even though the page has rendered evidence', async () => {
  const { server, port } = await startFixtureServer()
  try {
    const { res, state } = mockRes()
    await handleCheckVisual(
      { method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/` }) }, // neither flag set
      res,
      { executablePath: CHROME_PATH, navigationTimeoutMs: 8000, deps: captureDepsFor(port), allowedHttpPort: port },
      contactLinksDepsFor(port)
    )
    if (!state.body?.ok) throw new Error('unreachable')
    assert.ok(!state.body.contactFallback, 'must never fabricate a fallback result that was not asked for')
    assert.ok(!state.body.linksFallback)
  } finally {
    server.close()
  }
})

skippableTest('no second browser process is launched even when both fallbacks are requested', async () => {
  const { server, port } = await startFixtureServer()
  let launchCount = 0
  try {
    const { res, state } = mockRes()
    await handleCheckVisual(
      { method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/`, needsContactFallback: true, needsLinksFallback: true }) },
      res,
      {
        executablePath: CHROME_PATH,
        navigationTimeoutMs: 8000,
        deps: captureDepsFor(port),
        allowedHttpPort: port,
        onHandleReady: (_handle: CaptureBrowserHandle) => {
          launchCount++
        },
      },
      contactLinksDepsFor(port)
    )
    assert.equal(state.body?.ok, true)
    assert.equal(launchCount, 1, 'exactly one browser process must have launched for a request needing both fallbacks')
  } finally {
    server.close()
  }
})

// ─── Hotfix: rendered links populated by a separate, later async
// operation than the page's own text (reproduced live against a real
// client-rendered site — see captureService.ts's network-idle wait
// before the fallback HTML capture). The page below injects real text
// immediately (so readability's own measurement/recheck is unaffected
// and succeeds right away), but its navigation links only arrive several
// hundred milliseconds later, via an actual pending fetch() to this same
// fixture server — not a bare setTimeout — since that's the real
// mechanism a network-idle wait detects. ─────────────────────────────

const delayedLinksHomePageHtml = (port: number) => `<!DOCTYPE html>
<html lang="en">
<head><title>Delayed links</title></head>
<body>
<div id="app"></div>
<script>
  var origin = 'http://127.0.0.1:${port}';
  // Real content, injected immediately — well past the thin-content
  // threshold, and enough for readability's own measurement to succeed
  // without ever needing its own recheck.
  document.getElementById('app').innerHTML =
    '<main><h1>Welcome</h1><p>This is the real content of the page, injected immediately on load, ' +
    'well past the length threshold this automated check uses to decide whether a rendered fallback ' +
    'is worth attempting instead of just reading the raw HTML that was actually delivered.</p></main>';
  // Navigation links arrive later, once a real pending network request
  // resolves — matching the reproduced real-world pattern of a client-
  // rendered site whose navigation is populated by its own data fetch,
  // independently of when the page's own text becomes visible. Same-
  // origin relative path (not the absolute "origin" above) — the page
  // itself is loaded as safe.invalid:port, so an absolute 127.0.0.1
  // fetch would be cross-origin and blocked by CORS, which has nothing
  // to do with what this test is actually proving.
  fetch('/delayed-links-data')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var nav = document.createElement('nav');
      nav.innerHTML = data.links.map(function (href) { return '<a href="' + href + '">link</a>'; }).join(' ');
      document.body.appendChild(nav);
    });
</script>
</body>
</html>`

async function startDelayedLinksFixtureServer(delayMs: number): Promise<{ server: http.Server; port: number }> {
  let port = 0
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === undefined) {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(delayedLinksHomePageHtml(port))
      return
    }
    if (req.url === '/delayed-links-data') {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ links: [`http://127.0.0.1:${port}/about`, `http://127.0.0.1:${port}/services`, `http://127.0.0.1:${port}/pricing`] }))
      }, delayMs)
      return
    }
    if (req.url === '/about' || req.url === '/services' || req.url === '/pricing') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(SIMPLE_PAGE(req.url))
      return
    }
    res.writeHead(404)
    res.end('not found')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('failed to bind fixture server')
  port = address.port
  return { server, port }
}

skippableTest('rendered links populated by a separate, later async operation than the page\'s own text are still sampled from the final page state', async () => {
  const { server, port } = await startDelayedLinksFixtureServer(600)
  try {
    const { res, state } = mockRes()
    await handleCheckVisual(
      { method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/`, needsLinksFallback: true }) },
      res,
      { executablePath: CHROME_PATH, navigationTimeoutMs: 8000, deps: captureDepsFor(port), allowedHttpPort: port },
      contactLinksDepsFor(port)
    )
    assert.equal(state.statusCode, 200)
    if (!state.body?.ok) throw new Error('unreachable')
    const readability = state.body.findings.find((f) => f.checkId === 'readability')
    assert.ok(readability && !readability.detail.toLowerCase().includes('no visible text'), 'readability must find the immediately-injected text, unaffected by this fix')
    assert.ok(state.body.linksFallback, 'the links fallback must be present — the delayed links must have been captured, not an empty pre-fetch snapshot')
    assert.equal(state.body.linksFallback?.finding.bucket, 'good')
    assert.match(state.body.linksFallback!.finding.detail, /sample of 3 links?/, 'all 3 delayed links must have been sampled once they arrived')
  } finally {
    server.close()
  }
})

skippableTest('a page whose links never finish loading (network never goes idle) still returns the honest "Unable to verify" result, not a fabricated pass', async () => {
  // The links data endpoint never responds within the bounded settle
  // window (well beyond RENDERED_HTML_SETTLE_TIMEOUT_MS) — a genuinely
  // blocked/stuck async operation, not a slow-but-eventually-resolving one.
  const { server, port } = await startDelayedLinksFixtureServer(10000)
  try {
    const { res, state } = mockRes()
    await handleCheckVisual(
      { method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/`, needsLinksFallback: true }) },
      res,
      { executablePath: CHROME_PATH, navigationTimeoutMs: 8000, deps: captureDepsFor(port), allowedHttpPort: port },
      contactLinksDepsFor(port)
    )
    assert.equal(state.statusCode, 200)
    if (!state.body?.ok) throw new Error('unreachable')
    assert.ok(!state.body.linksFallback, 'no fallback result must be fabricated when the rendered page never actually gained real links within the bounded wait')
  } finally {
    server.close()
  }
})

// ─── Hotfix: real navigation links positioned late in a large rendered
// page must not be silently discarded by the rendered-HTML capture's
// truncation cap — reproduced live against a real client-rendered site
// whose rendered page was ~2.9M characters, with its real links past the
// OLD 2,000,000-char cap (see captureService.ts's MAX_RENDERED_HTML_CHARS).
// This fixture reproduces that shape deterministically: real text
// immediately, then ~2.2M characters of harmless padding, THEN the real
// navigation links — past the old cutoff, comfortably under the new one. ──

const largePageWithLateLinksHtml = (port: number) => `<!DOCTYPE html>
<html lang="en">
<head><title>Large page with late links</title></head>
<body>
<div id="app"></div>
<script>
  var origin = 'http://127.0.0.1:${port}';
  document.getElementById('app').innerHTML =
    '<main><h1>Welcome</h1><p>Real content, injected immediately, well past the thin-content threshold.</p></main>';
  // ~2.2M characters of harmless padding BEFORE the real links — pushes
  // them past the OLD 2,000,000-char truncation cap once serialized.
  var padding = document.createElement('div');
  padding.style.display = 'none';
  padding.textContent = 'x'.repeat(2200000);
  document.body.appendChild(padding);
  var nav = document.createElement('nav');
  nav.innerHTML =
    '<a href="' + origin + '/about">About</a> ' +
    '<a href="' + origin + '/services">Services</a> ' +
    '<a href="' + origin + '/pricing">Pricing</a>';
  document.body.appendChild(nav);
</script>
</body>
</html>`

async function startLargePageFixtureServer(): Promise<{ server: http.Server; port: number }> {
  let port = 0
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === undefined) {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(largePageWithLateLinksHtml(port))
      return
    }
    if (req.url === '/about' || req.url === '/services' || req.url === '/pricing') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(SIMPLE_PAGE(req.url))
      return
    }
    res.writeHead(404)
    res.end('not found')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('failed to bind fixture server')
  port = address.port
  return { server, port }
}

skippableTest('real navigation links positioned past the old truncation cutoff in a large rendered page are still found', async () => {
  const { server, port } = await startLargePageFixtureServer()
  try {
    const { res, state } = mockRes()
    await handleCheckVisual(
      { method: 'POST', body: JSON.stringify({ url: `http://safe.invalid:${port}/`, needsLinksFallback: true }) },
      res,
      { executablePath: CHROME_PATH, navigationTimeoutMs: 15000, deps: captureDepsFor(port), allowedHttpPort: port },
      contactLinksDepsFor(port)
    )
    assert.equal(state.statusCode, 200)
    if (!state.body?.ok) throw new Error('unreachable')
    assert.ok(state.body.linksFallback, 'the links fallback must find real links even when they are positioned past the old 2,000,000-char cutoff')
    assert.equal(state.body.linksFallback?.finding.bucket, 'good')
    assert.match(state.body.linksFallback!.finding.detail, /sample of 3 links?/)
  } finally {
    server.close()
  }
})

// ─── Static HTML results remain unchanged: the exact functions the
// static path (api/check-website.ts) reuses, exercised directly against
// ordinary (non-thin) static content — no rendering involved at all. ──

test('static content: evaluateContactSignal produces the identical "good" finding/points shape for ordinary static HTML with real contact info', () => {
  const staticHtml = '<html><body><main><p>Call us at (555) 123-4567 or visit our contact page.</p></main></body></html>'
  const evaluated = evaluateContactSignal(staticHtml)
  assert.equal(evaluated.found, true)
  assert.equal(evaluated.points, 5)
  assert.equal(evaluated.finding.bucket, 'good')
  assert.equal(evaluated.finding.detail, 'We found what appears to be contact information (a phone number, email address, or contact link) on your homepage.')
})

test('static content: evaluateContactSignal produces the identical "improve" finding/points shape when ordinary static HTML genuinely has no contact info', () => {
  const staticHtml = '<html><body><main><p>' + 'Plenty of ordinary page content with no contact details anywhere in it at all. '.repeat(4) + '</p></main></body></html>'
  const evaluated = evaluateContactSignal(staticHtml)
  assert.equal(evaluated.found, false)
  assert.equal(evaluated.points, 0)
  assert.equal(evaluated.finding.bucket, 'improve')
})

skippableTest('static content: evaluateHomepageLinks produces the identical "good" finding/points shape for ordinary static HTML with real same-origin links', async () => {
  const { server, port } = await startFixtureServer()
  try {
    // No browser/proxy involved here — evaluateHomepageLinks is a plain
    // async function, so the base URL can be the fixture server's real,
    // directly-fetchable address.
    const staticHtml = `<html><body><a href="/about">About</a><a href="/services">Services</a><a href="/pricing">Pricing</a></body></html>`
    const evaluated = await evaluateHomepageLinks(staticHtml, `http://127.0.0.1:${port}/`, contactLinksDepsFor(port))
    assert.ok(evaluated)
    assert.equal(evaluated?.linksChecked, 3)
    assert.equal(evaluated?.brokenLinks, 0)
    assert.equal(evaluated?.finding.bucket, 'good')
    assert.equal(evaluated?.points, 5)
  } finally {
    server.close()
  }
})

// ─── No domain-specific behavior ─────────────────────────────────────

test('no domain-specific behavior: the shared contact/links module has no logic keyed on a specific customer/target hostname (the checker tool’s own USER_AGENT self-identifier is the one, unconditional, non-target-specific exception)', async () => {
  const { readFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const source = await readFile(path.join(import.meta.dirname, '..', 'src', 'lib', 'contactLinksCheck.ts'), 'utf8')
  const withoutUserAgentLine = source
    .split('\n')
    .filter((line) => !line.includes('USER_AGENT ='))
    .join('\n')
  assert.ok(!/websitesbyleslie/i.test(withoutUserAgentLine), 'no logic outside the User-Agent identifier may reference this domain')
  assert.ok(!/sissyssweets/i.test(source), 'must never reference this — or any other — real customer domain at all')
})
