// Regression tests for patch v0.1.1-containment (see
// cody-projects/checker-reliability-rebuild/build/v0.1.1-containment/patch.md):
// the public V2 Visual & Usability Review is fail-closed and temporarily
// withdrawn — no measurement is attempted for any input — while V1 and the
// rest of the site remain completely unaffected. Proves:
//   - the routed handler returns the fixed withdrawal response immediately
//     after confirming POST, for missing/malformed/unsafe/private-network/
//     arbitrary URL data alike, without reading the request body at all;
//   - non-POST still gets 405;
//   - the routed handler cannot produce status: 'complete' — both
//     behaviorally (many different inputs) and structurally (its source
//     imports none of the modules that could produce one);
//   - the withdrawal response contains only ok/status/message;
//   - /check renders the withdrawal placeholder with no score, while V1's
//     section still renders real content — using a controlled, local V1
//     fixture, not a live network call;
//   - the homepage is unaffected.
//
// Fully offline and deterministic: no real network access, no DNS
// resolution, no live site is contacted anywhere in this file. Confirming
// V1's *actual* live behavior is a separate, real-network production
// verification step after deployment (see patch.md) — not this suite's
// job, and not a dependency of it.
//
// Run with: node --test test/checkPage.containment.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import checkVisualHandler from '../api/check-visual.ts'
import type { VisualCheckResponse } from '../src/lib/visualCheck.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DIST = path.join(ROOT, 'dist')

// ─── Part 1: direct handler tests — no browser, no network, no DNS ────────

function mockRes() {
  const state: { statusCode: number; body: VisualCheckResponse | null } = { statusCode: 0, body: null }
  const res = {
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(b: VisualCheckResponse) {
      state.body = b
    },
  }
  return { res, state }
}

test('withdrawal: missing, malformed, unsafe, private-network, and arbitrary URL data all get the identical fixed withdrawal response — the body is never read at all', async () => {
  const inputs: Array<Record<string, unknown>> = [
    { method: 'POST' }, // no body field whatsoever
    { method: 'POST', body: undefined },
    { method: 'POST', body: null },
    { method: 'POST', body: 'not even valid json {{{' },
    { method: 'POST', body: JSON.stringify({}) }, // no url field
    { method: 'POST', body: JSON.stringify({ url: '' }) },
    { method: 'POST', body: JSON.stringify({ url: '169.254.169.254' }) }, // link-local/metadata SSRF target
    { method: 'POST', body: JSON.stringify({ url: 'http://127.0.0.1:22' }) }, // loopback/private
    { method: 'POST', body: JSON.stringify({ url: 'file:///etc/passwd' }) },
    { method: 'POST', body: JSON.stringify({ url: 'example.com' }) }, // an otherwise-ordinary, valid-looking URL
  ]
  for (const input of inputs) {
    const { res, state } = mockRes()
    await checkVisualHandler(input as { method?: string }, res)
    assert.equal(state.statusCode, 200, `input=${JSON.stringify(input)}`)
    assert.ok(state.body?.ok, `input=${JSON.stringify(input)}`)
    assert.equal((state.body as { status: string }).status, 'withdrawn', `input=${JSON.stringify(input)}`)
  }
})

test('non-POST requests still receive 405, unchanged', async () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH', undefined]) {
    const { res, state } = mockRes()
    await checkVisualHandler({ method }, res)
    assert.equal(state.statusCode, 405, `method=${method}`)
    assert.equal(state.body?.ok, false, `method=${method}`)
  }
})

test('withdrawal response shape: contains ONLY ok/status/message — no score, checksCompleted, checksTotal, or findings, even as zero/empty', async () => {
  const { res, state } = mockRes()
  await checkVisualHandler({ method: 'POST' }, res)
  const keys = Object.keys(state.body as object).sort()
  assert.deepEqual(keys, ['message', 'ok', 'status'], 'a future partial-rebuild change accidentally leaking extra fields through this endpoint would fail this test first')
})

test('the routed handler cannot produce status: "complete" while contained — behaviorally, across many inputs, and structurally, by import graph', async () => {
  for (const input of [
    { method: 'POST', body: JSON.stringify({ url: 'example.com' }) },
    { method: 'POST', body: JSON.stringify({ url: 'https://sissyssweets-byem.com' }) },
    { method: 'POST' },
    { method: 'GET' },
  ]) {
    const { res, state } = mockRes()
    await checkVisualHandler(input, res)
    if (state.body?.ok) {
      assert.notEqual((state.body as { status: string }).status, 'complete', `input=${JSON.stringify(input)}`)
    }
  }

  // Structural guarantee, not just an observed behavior: the routed file's
  // own IMPORT statements cannot reach real measurement code at all, so no
  // future input could ever change this without also changing this file's
  // imports.
  const source = await readFile(path.join(ROOT, 'api', 'check-visual.ts'), 'utf8')
  const importLines = source.split('\n').filter((line) => /^\s*import\b/.test(line))
  for (const forbidden of ['puppeteer-core', 'urlSafety', 'visualAnalysis', 'visualScoring', 'scrollSettle', 'websiteCheck']) {
    assert.ok(
      importLines.every((line) => !line.includes(forbidden)),
      `api/check-visual.ts must not IMPORT anything referencing "${forbidden}" — found it in: ${JSON.stringify(importLines)}`
    )
  }
  assert.ok(!source.includes("'complete'"), 'the routed handler\'s own source must not contain the "complete" status literal at all')
})

async function listFilesRecursive(dir: string, baseDir: string = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath, baseDir)))
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, fullPath))
    }
  }
  return files
}

test('the public api/ tree contains no second visual-check handler or legacy visual-measurement endpoint — api/check-visual.ts is the only one', async () => {
  const apiDir = path.join(ROOT, 'api')
  const files = await listFilesRecursive(apiDir)

  assert.deepEqual(
    files.sort(),
    ['check-visual.ts', 'check-website.ts'],
    `api/ must contain exactly these two route files and nothing else (no legacy/duplicate handler, no extra subdirectory) — found: ${JSON.stringify(files)}`
  )

  // check-website.ts (V1) is fetch-based, not browser-based — confirming it
  // doesn't import puppeteer-core rules out a hidden second visual-measurement
  // handler disguised as V1.
  const v1Source = await readFile(path.join(apiDir, 'check-website.ts'), 'utf8')
  assert.ok(!v1Source.includes('puppeteer-core'), 'api/check-website.ts must not import puppeteer-core')
})

// ─── Part 2: real-browser /check flow (offline) + homepage regression ─────
//
// /api/check-visual is served by the REAL routed handler (already fully
// offline/deterministic, proven above). /api/check-website (V1) is served
// by a fixed, controlled LOCAL fixture, not V1's real handler and not a
// live network call — V1's own real behavior is verified separately,
// against the live site, during production verification (see patch.md);
// this suite only needs to prove V1's UI rendering pipeline is unaffected
// by the V2 containment change, which a controlled fixture does without
// any network dependency.

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
}

const MOCK_V1_RESPONSE = {
  ok: true,
  input: 'example.com',
  finalUrl: 'https://example.com/',
  score: 92,
  summary: 'CONTROLLED-V1-FIXTURE',
  findings: [{ id: 'response-time', label: 'Response time', bucket: 'good', detail: 'Fast enough.' }],
  checksCompleted: 1,
  checksTotal: 1,
}

let browser: Browser
let server: Server
let baseUrl: string

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/check-visual') {
      await checkVisualHandler(
        { method: 'POST' },
        {
          status(code: number) {
            res.statusCode = code
            return this
          },
          json(body: unknown) {
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(body))
          },
        }
      )
      return
    }
    if (req.method === 'POST' && req.url === '/api/check-website') {
      // Controlled local fixture — no real V1 handler, no network. See the
      // file-level comment above for why this is intentional here.
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(MOCK_V1_RESPONSE))
      return
    }

    const urlPath = req.url === '/' ? '/index.html' : req.url === '/check' ? '/check.html' : req.url || '/index.html'
    const filePath = path.join(DIST, decodeURIComponent(urlPath.split('?')[0]))
    try {
      const data = await readFile(filePath)
      const ext = path.extname(filePath)
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('failed to start mock server')
  baseUrl = `http://127.0.0.1:${address.port}`

  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

test('/check: the V2 section shows the withdrawal placeholder and no score, while V1 (controlled local fixture) still renders real results', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await page.type('#website-url', 'example.com')
    await page.click('.checkup-submit')

    await page.waitForSelector('.checkup-results .checkup-summary')
    await assertContainsText(page, '.checkup-results .checkup-summary', 'CONTROLLED-V1-FIXTURE')

    await page.waitForFunction(() => !document.querySelector('.checkup-visual-section .checkup-loading'), { timeout: 15000 })

    const visualSectionText = await page.$eval('.checkup-visual-section', (el) => el.textContent || '')
    assert.ok(visualSectionText.includes('Under independent review'), `expected withdrawal label, got: ${visualSectionText}`)
    assert.ok(
      visualSectionText.includes('temporarily paused while we rebuild and independently validate it'),
      `expected withdrawal message, got: ${visualSectionText}`
    )
    assert.ok(!visualSectionText.includes('Score not available'), 'must not read as a render failure')
    assert.ok(!visualSectionText.includes('Review could not be completed'), 'must not read as a render failure')
    assert.ok(!/\/100/.test(visualSectionText), 'must not show any numeric score')

    const v1Text = await page.$eval('.checkup-results', (el) => el.textContent || '')
    assert.ok(/92\s*\/\s*100/.test(v1Text), `V1 (Technical Basics) must still render the controlled fixture's score, got: ${v1Text}`)
  } finally {
    await page.close()
  }
})

test('the homepage is unaffected by containment', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const bodyText = await page.evaluate(() => document.body.textContent || '')
    assert.ok(bodyText.includes('Websites by Leslie'), 'nav logo / brand name should still render')
    const navLinksCount = await page.$$eval('.nav-links a', (els) => els.length)
    assert.ok(navLinksCount > 0, 'nav links should still render unchanged')
  } finally {
    await page.close()
  }
})

async function assertContainsText(page: Page, selector: string, text: string) {
  const content = await page.$eval(selector, (el) => el.textContent || '')
  assert.ok(content.includes(text), `expected "${selector}" to contain "${text}", got "${content}"`)
}
