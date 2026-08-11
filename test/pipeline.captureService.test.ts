// First real-checker release — end-to-end tests for captureService.ts:
// real Chrome, real connection-binding proxy, real local fixture HTML
// files served from a real local HTTP server — never a real third-party
// site. Local Chrome only (never @sparticuz/chromium's Lambda-only
// binary). If local Chrome isn't present at the expected path, these
// tests skip rather than fail.
//
// deps.lookup/deps.classify/allowedPorts are injected so these tests
// never touch real DNS and can point a fixture hostname at the local
// server's own ephemeral port — production supplies none of these; the
// real safety boundary (network validation + connection-binding proxy +
// page hardening) is exercised exactly as production would use it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { captureOverflowAndReadability } from '../src/lib/pipeline/capture/captureService.ts'
import { resolveLocalChromePath } from '../src/lib/pipeline/capture/browserLifecycle.ts'
import { normalizeOverflowEvidence, normalizeReadabilityEvidence } from '../src/lib/pipeline/normalize/evidenceNormalizer.ts'
import { classifyOverflow, classifyReadability } from '../src/lib/pipeline/classify/classificationEngine.ts'
import { getOverflowContract, getReadabilityContract } from '../src/lib/pipeline/classify/contractRegistry.ts'

const CHROME_PATH = resolveLocalChromePath()
const chromeAvailable = existsSync(CHROME_PATH)

function skippableTest(name: string, fn: () => Promise<void>): void {
  test(name, { skip: !chromeAvailable ? 'local Chrome not found at the expected path — skipping real-browser tests' : false }, fn)
}

const FIXTURES_DIR = path.resolve(import.meta.dirname, 'fixtures/visual-checker/first-release')

async function startFixtureServer(fileName: string): Promise<{ server: http.Server; port: number }> {
  const { readFile } = await import('node:fs/promises')
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

async function killAndAwaitDisconnect(handle: { browser: { process(): { kill(signal: string): void } | null }; isDisconnected(): boolean }): Promise<void> {
  handle.browser.process()?.kill('SIGKILL')
  const deadline = Date.now() + 3000
  while (!handle.isDisconnected() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

function depsFor(port: number) {
  return {
    lookup: async (hostname: string) => {
      if (hostname === 'safe.invalid') return [{ address: '127.0.0.1', family: 4 }]
      if (hostname === 'unsafe.invalid') return [{ address: '10.1.2.3', family: 4 }]
      throw new Error(`unexpected test host: ${hostname}`)
    },
    classify: (ip: string) => (ip === '127.0.0.1' ? ('public' as const) : ip === '10.1.2.3' ? ('private' as const) : ('unparsable' as const)),
    allowedPorts: [String(port)],
  }
}

async function captureAndClassify(fileName: string) {
  const { server, port } = await startFixtureServer(fileName)
  try {
    const result = await captureOverflowAndReadability(`http://safe.invalid:${port}/`, {
      executablePath: CHROME_PATH,
      navigationTimeoutMs: 8000,
      deps: depsFor(port),
      allowedHttpPort: port,
    })
    assert.equal(result.ok, true, `capture must succeed for ${fileName}`)
    if (!result.ok) throw new Error('unreachable')
    const overflowEvidence = normalizeOverflowEvidence(result.value.overflow)
    const overflowClassification = classifyOverflow({ evidence: overflowEvidence, contract: getOverflowContract() })
    const readabilityEvidence = normalizeReadabilityEvidence(result.value.readability)
    const readabilityClassification = classifyReadability({ evidence: readabilityEvidence, contract: getReadabilityContract() })
    return { overflowClassification, readabilityClassification }
  } finally {
    server.close()
  }
}

skippableTest('end-to-end: a genuinely clean fixture produces "good" for both checks through the real capture pipeline', async () => {
  const { overflowClassification, readabilityClassification } = await captureAndClassify('clean.html')
  assert.equal(overflowClassification.outcome, 'good')
  assert.equal(readabilityClassification.outcome, 'good')
})

skippableTest('end-to-end: a fixture with a clear overflow issue produces "improve" for overflow, unaffected readability', async () => {
  const { overflowClassification, readabilityClassification } = await captureAndClassify('overflow-issue.html')
  assert.equal(overflowClassification.outcome, 'improve')
  assert.equal(readabilityClassification.outcome, 'good')
})

skippableTest('end-to-end: a borderline overflow fixture produces "manual-review-advisory"', async () => {
  const { overflowClassification } = await captureAndClassify('overflow-boundary.html')
  assert.equal(overflowClassification.outcome, 'manual-review-advisory')
})

skippableTest('end-to-end: a tiny-text fixture produces "improve" for readability, unaffected overflow', async () => {
  const { overflowClassification, readabilityClassification } = await captureAndClassify('tiny-text.html')
  assert.equal(readabilityClassification.outcome, 'improve')
  assert.equal(overflowClassification.outcome, 'good')
})

skippableTest('end-to-end: a borderline text-size fixture produces "manual-review-advisory" for readability', async () => {
  const { readabilityClassification } = await captureAndClassify('text-boundary.html')
  assert.equal(readabilityClassification.outcome, 'manual-review-advisory')
})

// ─── Release polish: readability distinguishes footer/utility text from
// meaningful page content — see captureService.ts's
// extractRawMeasurements and classificationEngine.ts's classifyReadability. ──

skippableTest('end-to-end: small semantic-footer text does not determine the readability outcome, and is mentioned as context', async () => {
  const { readabilityClassification } = await captureAndClassify('small-footer-text.html')
  assert.equal(readabilityClassification.outcome, 'good', 'the 9px <footer> text must not be read as the page\'s smallest MEANINGFUL text')
  assert.match(readabilityClassification.reasoning, /footer/i, 'the smaller footer text must still be mentioned as context')
})

skippableTest('end-to-end: small div-based (unsemantic) footer text does not determine the readability outcome', async () => {
  const { readabilityClassification } = await captureAndClassify('div-based-footer-small-text.html')
  assert.equal(readabilityClassification.outcome, 'good', 'the 9px div.site-footer text must not be read as the page\'s smallest MEANINGFUL text')
  assert.match(readabilityClassification.reasoning, /footer/i, 'the smaller footer text must still be mentioned as context')
})

skippableTest('end-to-end: the no-<main> fallback still excludes footer text, and still measures <nav> as meaningful content', async () => {
  const { readabilityClassification } = await captureAndClassify('no-main-small-footer.html')
  assert.equal(readabilityClassification.outcome, 'good', 'the 9px <footer> text must not be read as the page\'s smallest MEANINGFUL text')
})

skippableTest('end-to-end: small navigation text outside any footer still triggers a readability finding — never dismissed as footer/utility', async () => {
  const { readabilityClassification } = await captureAndClassify('small-nav-text.html')
  assert.equal(readabilityClassification.outcome, 'improve', 'the 9px <nav> text is meaningful interface text, not footer/utility content')
})

skippableTest('end-to-end: a fixture with no visible text produces "unverified" for readability — honest uncertainty, not a fabricated pass', async () => {
  const { readabilityClassification } = await captureAndClassify('no-visible-text.html')
  assert.equal(readabilityClassification.outcome, 'unverified')
})

// ─── Reliability fix: a single sample taken too early (before JS-driven
// content reveal finishes) must not be normalized into "no visible
// text" — see captureService.ts's post-measurement recheck. ──────────

skippableTest('end-to-end: content revealed shortly after load is still measured — a too-early sample does not normalize to "no visible text"', async () => {
  const { readabilityClassification } = await captureAndClassify('delayed-reveal.html')
  assert.equal(readabilityClassification.outcome, 'good', 'the 16px content revealed 300ms after load must still be found, not treated as absent')
})

skippableTest('end-to-end: the rendered-HTML fallback capture does not clear or replace a readability measurement that needed the recheck', async () => {
  const { server, port } = await startFixtureServer('delayed-reveal.html')
  try {
    const result = await captureOverflowAndReadability(`http://safe.invalid:${port}/`, {
      executablePath: CHROME_PATH,
      navigationTimeoutMs: 8000,
      deps: depsFor(port),
      allowedHttpPort: port,
      captureRenderedHtml: true,
    })
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error('unreachable')
    assert.ok(result.value.renderedHtml && result.value.renderedHtml.length > 0, 'the fallback HTML capture must still run')
    const readabilityEvidence = normalizeReadabilityEvidence(result.value.readability)
    const readabilityClassification = classifyReadability({ evidence: readabilityEvidence, contract: getReadabilityContract() })
    assert.equal(readabilityClassification.outcome, 'good', 'requesting the fallback capture must not clear or replace the readability measurement')
  } finally {
    server.close()
  }
})

skippableTest('end-to-end: repeated complete-pipeline runs against a delayed-reveal page produce stable readability results', async () => {
  for (let i = 0; i < 5; i++) {
    const { readabilityClassification } = await captureAndClassify('delayed-reveal.html')
    assert.equal(readabilityClassification.outcome, 'good', `run ${i} must find the revealed content, not report it as absent`)
  }
})

// ─── Safety boundary is genuinely wired in, not bypassed ────────────

skippableTest('the capture service refuses a private-network target end-to-end — the real safety boundary, not merely mocked out', async () => {
  const { server, port } = await startFixtureServer('clean.html')
  try {
    const result = await captureOverflowAndReadability(`http://unsafe.invalid:${port}/`, {
      executablePath: CHROME_PATH,
      navigationTimeoutMs: 5000,
      deps: depsFor(port),
      allowedHttpPort: port,
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.error.kind, 'unsafe-url')
  } finally {
    server.close()
  }
})

skippableTest('an invalid URL is rejected before any browser is launched', async () => {
  const result = await captureOverflowAndReadability('not a url at all', { executablePath: CHROME_PATH })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'unsafe-url')
})

// ─── Crash diagnostics: a browser that launches but dies before/while
// creating a page is a structured 'browser-crashed' failure, not an
// uncaught exception — see api/check-visual.ts's production incident
// (TargetCloseError at context.newPage(), thrown past this function
// entirely before this patch). onHandleReady deterministically kills the
// REAL browser process right after a REAL launch succeeds, so this
// reproduces production's actual failure class end-to-end rather than
// mocking the outcome.

skippableTest('a browser that dies right after launch (killed before a page is created) is reported as a structured "browser-crashed" failure, not thrown', async () => {
  const { server, port } = await startFixtureServer('clean.html')
  try {
    const result = await captureOverflowAndReadability(`http://safe.invalid:${port}/`, {
      executablePath: CHROME_PATH,
      navigationTimeoutMs: 5000,
      deps: depsFor(port),
      allowedHttpPort: port,
      onHandleReady: (handle) => killAndAwaitDisconnect(handle),
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.kind, 'browser-crashed')
      assert.ok(result.error.reason.length > 0)
    }
  } finally {
    server.close()
  }
})

skippableTest('the browser layer itself: newIsolatedContext()/newPage() reject once the underlying process has been killed', async () => {
  const { launchCaptureBrowser } = await import('../src/lib/pipeline/capture/browserLifecycle.ts')
  const { startConnectionBindingProxy } = await import('../src/lib/pipeline/capture/connectionBindingProxy.ts')
  const proxy = await startConnectionBindingProxy({})
  try {
    const handle = await launchCaptureBrowser({ executablePath: CHROME_PATH, proxyPort: proxy.port })
    try {
      await killAndAwaitDisconnect(handle)
      await assert.rejects(async () => {
        const context = await handle.newIsolatedContext()
        await context.newPage()
      })
    } finally {
      await handle.close()
    }
  } finally {
    await proxy.close()
  }
})
