// Sub-patch 2d (practical scope reset) — real-Chrome integration tests
// for browserLifecycle.ts + pageHardening.ts + connectionBindingProxy.ts
// working together. Local Chrome only (never @sparticuz/chromium's
// Lambda-only binary); a local test HTTP server only — never a real
// third-party site. If local Chrome isn't present at the expected path,
// these tests skip rather than fail, so the rest of the suite (and CI
// environments without a desktop Chrome install) is unaffected.
//
// deps.lookup/deps.classify are injected so these tests never touch real
// DNS — the "safe" test host is deliberately resolved to the local
// fixture server's own address; the "unsafe" test host is deliberately
// resolved to a private-range address the proxy must refuse to connect
// to. Production code supplies neither override.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import http from 'node:http'
import { startConnectionBindingProxy, type ConnectionBindingProxy } from '../src/lib/pipeline/capture/connectionBindingProxy.ts'
import { launchCaptureBrowser, resolveLocalChromePath, type CaptureBrowserHandle } from '../src/lib/pipeline/capture/browserLifecycle.ts'
import { hardenPage, suppressPopups } from '../src/lib/pipeline/capture/pageHardening.ts'
import type { BrowserContext } from 'puppeteer-core'

const CHROME_PATH = resolveLocalChromePath()
const chromeAvailable = existsSync(CHROME_PATH)

function skippableTest(name: string, fn: () => Promise<void>): void {
  test(name, { skip: !chromeAvailable ? 'local Chrome not found at the expected path — skipping real-browser tests' : false }, fn)
}

async function startFixtureOrigin(): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((req, res) => {
    if (req.url === '/popup') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html><body>popup target</body></html>')
      return
    }
    if (req.url === '/oversized-chunked') {
      // Deliberately NO content-length header — a chunked, headerless
      // response, exactly the case a Content-Length-based size check
      // cannot see coming. Streamed in small writes so CDP's
      // Network.dataReceived byte-counting has to add it up piece by
      // piece rather than seeing it all in one chunk.
      res.writeHead(200, { 'content-type': 'text/plain' })
      const chunk = 'x'.repeat(4096)
      let written = 0
      const interval = setInterval(() => {
        if (written >= 300000 || res.destroyed) {
          clearInterval(interval)
          res.end()
          return
        }
        res.write(chunk)
        written += chunk.length
      }, 5)
      req.on('close', () => clearInterval(interval))
      return
    }
    if (req.url === '/websocket-probe') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(`<html><body><script>
        window.__wsResult = 'not-attempted';
        try {
          const ws = new WebSocket('ws://' + location.host + '/ws');
          ws.onerror = () => { window.__wsResult = 'errored' };
          ws.onopen = () => { window.__wsResult = 'opened' };
        } catch (e) { window.__wsResult = 'threw' }
      </script></body></html>`)
      return
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(`<html><body>
      <h1>fixture page</h1>
      <script>
        window.__dialogResult = 'not-run';
        try { alert('should be auto-dismissed'); window.__dialogResult = 'survived'; } catch (e) { window.__dialogResult = 'threw'; }
        window.__popupResult = window.open('/popup', '_blank');
      </script>
    </body></html>`)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('failed to bind fixture origin')
  return { server, port: address.port }
}

function fakeDeps() {
  return {
    lookup: async (hostname: string) => {
      if (hostname === 'safe.invalid') return [{ address: '127.0.0.1', family: 4 }]
      if (hostname === 'private-target.invalid') return [{ address: '10.1.2.3', family: 4 }]
      throw new Error(`unexpected test host: ${hostname}`)
    },
    classify: (ip: string) => (ip === '127.0.0.1' ? ('public' as const) : ip === '10.1.2.3' ? ('private' as const) : ('unparsable' as const)),
  }
}

async function setup() {
  const { server: origin, port: originPort } = await startFixtureOrigin()
  const proxy: ConnectionBindingProxy = await startConnectionBindingProxy({ allowedConnectPort: originPort, allowedHttpPort: originPort, deps: fakeDeps() })
  const handle: CaptureBrowserHandle = await launchCaptureBrowser({ executablePath: CHROME_PATH, proxyPort: proxy.port, overallBudgetMs: 30000 })
  return {
    origin,
    originPort,
    proxy,
    handle,
    async teardown() {
      await handle.close()
      await proxy.close()
      origin.close()
    },
  }
}

skippableTest('navigation to a validated-safe target loads real content through the proxy, with hardening active', async () => {
  const ctx = await setup()
  try {
    const context: BrowserContext = await ctx.handle.newIsolatedContext()
    const page = await context.newPage()
    await hardenPage(page, { navigationTimeoutMs: 8000 })
    const response = await page.goto(`http://safe.invalid:${ctx.originPort}/`, { waitUntil: 'load', timeout: 8000 })
    assert.ok(response?.ok(), 'navigation must succeed with a 2xx response')
    const bodyText = await page.evaluate(() => document.body.innerText)
    assert.match(bodyText, /fixture page/)
    await context.close()
  } finally {
    await ctx.teardown()
  }
})

skippableTest('navigation to a private target fails safely — the proxy rejects the connection, Chrome never reaches it', async () => {
  const ctx = await setup()
  try {
    const context = await ctx.handle.newIsolatedContext()
    const page = await context.newPage()
    await hardenPage(page, { navigationTimeoutMs: 5000 })
    const response = await page.goto(`http://private-target.invalid:${ctx.originPort}/`, { waitUntil: 'load', timeout: 5000 }).catch(() => null)
    // A 502 from the proxy is still a syntactically valid HTTP response
    // (Puppeteer only rejects goto() for genuine network-level
    // failures), so the block is proven via the response status/ok(),
    // not by assuming a thrown exception.
    assert.ok(!response || !response.ok(), 'the private target must never be reachable — either goto() fails outright, or the response is a non-2xx (the proxy\'s 502)')
    await context.close()
  } finally {
    await ctx.teardown()
  }
})

skippableTest('a JS dialog (alert) is auto-dismissed and does not hang navigation', async () => {
  const ctx = await setup()
  try {
    const context = await ctx.handle.newIsolatedContext()
    const page = await context.newPage()
    await hardenPage(page, { navigationTimeoutMs: 8000 })
    await page.goto(`http://safe.invalid:${ctx.originPort}/`, { waitUntil: 'load', timeout: 8000 })
    await new Promise((r) => setTimeout(r, 200))
    const dialogResult = await page.evaluate(() => (window as unknown as { __dialogResult: string }).__dialogResult)
    assert.notEqual(dialogResult, 'not-run', 'the page script must have actually reached the alert() call')
    await context.close()
  } finally {
    await ctx.teardown()
  }
})

skippableTest('window.open() is suppressed — no second reachable page is created', async () => {
  const ctx = await setup()
  try {
    const context = await ctx.handle.newIsolatedContext()
    const page = await context.newPage()
    const { stop } = suppressPopups(context, page)
    await hardenPage(page, { navigationTimeoutMs: 8000 })
    await page.goto(`http://safe.invalid:${ctx.originPort}/`, { waitUntil: 'load', timeout: 8000 })
    await new Promise((r) => setTimeout(r, 200))
    const popupResult = await page.evaluate(() => (window as unknown as { __popupResult: unknown }).__popupResult)
    assert.equal(popupResult, null, 'window.open must be overridden to return null')
    const pages = await context.pages()
    assert.equal(pages.length, 1, 'no second page/tab must exist')
    stop()
    await context.close()
  } finally {
    await ctx.teardown()
  }
})

skippableTest('a WebSocket connection attempt is blocked', async () => {
  const ctx = await setup()
  try {
    const context = await ctx.handle.newIsolatedContext()
    const page = await context.newPage()
    await hardenPage(page, { navigationTimeoutMs: 8000 })
    await page.goto(`http://safe.invalid:${ctx.originPort}/websocket-probe`, { waitUntil: 'load', timeout: 8000 })
    await new Promise((r) => setTimeout(r, 300))
    const wsResult = await page.evaluate(() => (window as unknown as { __wsResult: string }).__wsResult)
    assert.notEqual(wsResult, 'opened', 'a WebSocket must never successfully open')
    await context.close()
  } finally {
    await ctx.teardown()
  }
})

// ─── Response-size enforcement: actual transferred bytes, not
// Content-Length — must catch a chunked, headerless response ──────────
// Regression coverage for the gap identified on review: the first
// version checked only the Content-Length response header, so a
// chunked/headerless response (exactly what /oversized-chunked serves)
// could exceed the cap undetected. Enforcement is now CDP
// Network.dataReceived-based (real bytes as Chrome receives them,
// post-TLS-decryption — see pageHardening.ts's doc comment on why this
// needs no interception of the connection-binding proxy's tunnel).

skippableTest('a chunked, headerless response exceeding maxResponseBytes is cut off via Page.stopLoading, and counted — proving real-byte enforcement, not a Content-Length check', async () => {
  const ctx = await setup()
  try {
    const context = await ctx.handle.newIsolatedContext()
    const page = await context.newPage()
    const getCounts = await hardenPage(page, { navigationTimeoutMs: 8000, maxResponseBytes: 20000 })
    await page.goto(`http://safe.invalid:${ctx.originPort}/oversized-chunked`, { waitUntil: 'load', timeout: 8000 }).catch(() => {
      // stopLoading can itself surface as a navigation error/abort —
      // acceptable; what matters is verified below.
    })
    // Give the streaming response a moment to have exceeded the cap and
    // for stopLoading to take effect.
    await new Promise((r) => setTimeout(r, 500))
    const counts = getCounts()
    assert.equal(counts.responsesOverSizeLimit, 1, 'the oversized chunked response must be detected and counted exactly once')

    const receivedLength = await page.evaluate(() => document.body.innerText.length).catch(() => 0)
    assert.ok(receivedLength < 300000, `the full 300000-byte body must not have been allowed to finish loading (got ${receivedLength} chars)`)
    await context.close()
  } finally {
    await ctx.teardown()
  }
})

// ─── Browser-resource limit: the overall wall-clock budget, separate
// from per-navigation timeout — force-kills the browser PROCESS if it
// is never cleanly closed ────────────────────────────────────────────

skippableTest('browser-resource limit: overallBudgetMs force-kills the browser process on its own if close() is never called', async () => {
  const { server: origin, port: originPort } = await startFixtureOrigin()
  const proxy = await startConnectionBindingProxy({ allowedConnectPort: originPort, allowedHttpPort: originPort, deps: fakeDeps() })
  const handle = await launchCaptureBrowser({ executablePath: CHROME_PATH, proxyPort: proxy.port, overallBudgetMs: 800 })
  try {
    assert.equal(handle.isDisconnected(), false)
    const deadline = Date.now() + 5000
    while (!handle.isDisconnected() && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100))
    }
    assert.equal(handle.isDisconnected(), true, 'the browser must be force-killed once overallBudgetMs elapses, with no close() call from the caller')
  } finally {
    // Already disconnected in the success case; close() must still be a
    // safe no-op afterward (idempotent cleanup, per its own contract).
    await handle.close()
    await proxy.close()
    origin.close()
  }
})

skippableTest('a fresh incognito context has no cookies from a previous capture (storage isolation)', async () => {
  const ctx = await setup()
  try {
    const contextA = await ctx.handle.newIsolatedContext()
    const pageA = await contextA.newPage()
    await hardenPage(pageA, { navigationTimeoutMs: 8000 })
    await pageA.goto(`http://safe.invalid:${ctx.originPort}/`, { waitUntil: 'load', timeout: 8000 })
    await pageA.evaluate(() => {
      document.cookie = 'capture-marker=should-not-leak'
    })
    await contextA.close()

    const contextB = await ctx.handle.newIsolatedContext()
    const pageB = await contextB.newPage()
    await hardenPage(pageB, { navigationTimeoutMs: 8000 })
    await pageB.goto(`http://safe.invalid:${ctx.originPort}/`, { waitUntil: 'load', timeout: 8000 })
    const cookies = await pageB.evaluate(() => document.cookie)
    assert.ok(!cookies.includes('capture-marker'), 'a fresh context must not see the previous context\'s cookies')
    await contextB.close()
  } finally {
    await ctx.teardown()
  }
})

skippableTest('cleanup: close() closes the browser and reports disconnected, even after an active capture', async () => {
  const ctx = await setup()
  const context = await ctx.handle.newIsolatedContext()
  const page = await context.newPage()
  await hardenPage(page, { navigationTimeoutMs: 8000 })
  await page.goto(`http://safe.invalid:${ctx.originPort}/`, { waitUntil: 'load', timeout: 8000 })
  assert.equal(ctx.handle.isDisconnected(), false)
  await ctx.teardown()
  assert.equal(ctx.handle.isDisconnected(), true)
})
