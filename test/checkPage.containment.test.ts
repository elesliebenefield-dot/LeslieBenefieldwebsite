// Structural/UI regression tests around api/check-visual.ts and /check.
//
// This file previously guarded patch v0.1.1-containment (the V2 Visual &
// Usability Review being fail-closed and withdrawn for every input). The
// first real-checker release (see captureService.ts, api/check-visual.ts)
// deliberately ends that containment on this branch — protected-preview
// only — so the withdrawal-specific assertions that used to live here no
// longer apply and have been removed. Request/response-shape and
// real-capture coverage for the routed handler now lives in
// test/checkVisualHandler.requestFlow.test.ts. What remains here:
//   - the public api/ tree still contains exactly one visual-check handler;
//   - /check renders the new plain-English findings (via a controlled,
//     local fixture response — not a live network call), while V1's
//     section still renders its own real content, independently;
//   - the homepage is unaffected.
//
// Fully offline and deterministic: no real network access, no DNS
// resolution, no live site is contacted anywhere in this file.
//
// Run with: node --test test/checkPage.containment.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const ROOT = path.resolve(import.meta.dirname, '..')
const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DIST = path.join(ROOT, 'dist')

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

// Controlled local fixture for V2, mirroring the same pattern already used
// for V1 above — no real handler, no browser capture, no network. This
// file's job is to prove CheckPage.tsx renders whatever the API returns;
// the real handler's own request/capture behavior is covered separately in
// test/checkVisualHandler.requestFlow.test.ts.
const MOCK_V2_RESPONSE = {
  ok: true,
  status: 'complete',
  finalUrl: 'https://example.com/',
  findings: [
    { checkId: 'overflow', label: 'Likely opportunity', detail: 'CONTROLLED-V2-FIXTURE-OVERFLOW' },
    { checkId: 'readability', label: 'No clear issue found', detail: 'CONTROLLED-V2-FIXTURE-READABILITY' },
  ],
}

let browser: Browser
let server: Server
let baseUrl: string

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/check-visual') {
      // Controlled local fixture — see the comment above MOCK_V2_RESPONSE.
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(MOCK_V2_RESPONSE))
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

test('/check: the V2 section shows the new plain-English findings, while V1 (controlled local fixture) still renders its own independent results', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await page.type('#website-url', 'example.com')
    await page.click('.checkup-submit')

    await page.waitForSelector('.checkup-results .checkup-summary')
    await assertContainsText(page, '.checkup-results .checkup-summary', 'CONTROLLED-V1-FIXTURE')

    await page.waitForFunction(() => !document.querySelector('.checkup-visual-section .checkup-loading'), { timeout: 15000 })

    const visualSectionText = await page.$eval('.checkup-visual-section', (el) => el.textContent || '')
    assert.ok(visualSectionText.includes('Likely opportunity'), `expected the overflow finding's label, got: ${visualSectionText}`)
    assert.ok(visualSectionText.includes('No clear issue found'), `expected the readability finding's label, got: ${visualSectionText}`)
    assert.ok(visualSectionText.includes('CONTROLLED-V2-FIXTURE-OVERFLOW'), `expected the overflow finding's detail, got: ${visualSectionText}`)
    assert.ok(visualSectionText.includes('CONTROLLED-V2-FIXTURE-READABILITY'), `expected the readability finding's detail, got: ${visualSectionText}`)
    assert.ok(!/\/100/.test(visualSectionText), 'must not show any numeric score — this release does not add one')

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
