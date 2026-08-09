// Regression test for the frontend request-race condition fixed in CheckPage.tsx
// (see requestIdRef in handleSubmit/runVisualCheck): if a user submits a second
// checkup before the first submission's visual review has finished loading, the
// first submission's response can arrive AFTER the second's. Without a request-
// generation guard, that late/stale response silently overwrites the newer,
// already-displayed results — a plausible, concrete mechanism for a UI that
// appears to show a finding (e.g. a heading-structure warning) that the live API
// no longer actually returns for the current input.
//
// Runs against the real production build (`dist/`, built by `npm run build`) in
// a real browser via Puppeteer, with the two API routes replaced by a local
// mock server whose response timing is fully controlled — so "stale response
// arrives after the fresher one" is deterministically reproducible instead of
// depending on real network jitter. No live network access is used.
//
// Run with: node --test test/checkPage.raceCondition.test.ts
// The before() hook always runs `npm run build` fresh — it never reuses
// whatever happens to already be in dist/, even if dist/check.html exists.
// Reusing an existing build silently tests whatever source produced that
// build, not the source currently on disk — for a race-condition regression
// test, that's exactly the gap that would let this test keep passing against
// a stale, already-fixed bundle even if the fix were later reverted in
// source. The rebuild costs a few hundred ms and removes that gap entirely.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = path.resolve(import.meta.dirname, '..')
const DIST = path.join(ROOT, 'dist')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
}

// Mirrors the shape api/check-website.ts and api/check-visual.ts return —
// only the fields CheckPage.tsx actually reads are populated.
function technicalResponse(finalUrl: string, marker: string) {
  return {
    ok: true,
    input: finalUrl,
    finalUrl,
    score: 90,
    summary: `TECHNICAL-${marker}`,
    findings: [{ id: 'response-time', label: 'Response time', bucket: 'good', detail: `TECHNICAL-DETAIL-${marker}` }],
    checksCompleted: 1,
    checksTotal: 1,
  }
}

function visualResponse(marker: string) {
  return {
    ok: true,
    finalUrl: `https://${marker.toLowerCase()}.example`,
    score: 77,
    summary: `VISUAL-${marker}`,
    findings: [{ id: 'headings', label: 'Heading structure', bucket: 'improve', viewport: 'both', detail: `VISUAL-DETAIL-${marker}`, measurable: true }],
    checksCompleted: 1,
    checksTotal: 1,
  }
}

let browser: Browser
let server: Server
let baseUrl: string

// requestUrl -> ms to delay that request's visual response by. Lets the test
// force the FIRST submission's visual response to resolve AFTER the SECOND's.
const visualDelayByUrl = new Map<string, number>()

before(async () => {
  // Always rebuild, regardless of what's already in dist/ — see the file-level
  // comment for why reusing an existing build would defeat this test's purpose.
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/check-website') {
      const body = await readBody(req)
      const { url } = JSON.parse(body)
      const marker = markerFor(url)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(technicalResponse(url, marker)))
      return
    }
    if (req.method === 'POST' && req.url === '/api/check-visual') {
      const body = await readBody(req)
      const { url } = JSON.parse(body)
      const marker = markerFor(url)
      const delay = visualDelayByUrl.get(url) ?? 0
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(visualResponse(marker)))
      }, delay)
      return
    }

    // Static file serving for the built SPA.
    const urlPath = req.url === '/' || req.url === '/check' ? '/check.html' : req.url || '/check.html'
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

function markerFor(url: string): string {
  if (url.includes('site-a')) return 'A'
  if (url.includes('site-b')) return 'B'
  return 'UNKNOWN'
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
  })
}

test('a stale, slow visual response from an earlier submission does not overwrite a newer submission\'s already-displayed results', async () => {
  // Submission A's visual response is deliberately slow; submission B's is
  // fast — so B's fresh response lands first, and A's stale one arrives after.
  visualDelayByUrl.set('https://site-a.example/', 1200)
  visualDelayByUrl.set('https://site-b.example/', 150)

  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })

    // Submit A.
    await page.type('#website-url', 'site-a.example')
    await page.click('.checkup-submit')
    // Wait for A's technical result (fast) to appear, re-enabling the form.
    await page.waitForSelector('.checkup-summary')
    await assertContainsText(page, '.checkup-summary', 'TECHNICAL-A')

    // Before A's slow visual response resolves, submit B for a different URL.
    await page.evaluate(() => {
      const input = document.getElementById('website-url') as HTMLInputElement
      input.value = ''
    })
    await page.type('#website-url', 'site-b.example')
    await page.click('.checkup-submit')
    await page.waitForSelector('.checkup-summary')
    await assertContainsText(page, '.checkup-summary', 'TECHNICAL-B')

    // Wait long enough for BOTH visual responses to resolve — B's fast one
    // first, then A's slow, stale one after it.
    await new Promise((resolve) => setTimeout(resolve, 1600))

    const visualSummaries = await page.$$eval('.checkup-visual-section .checkup-summary', (els) => els.map((e) => e.textContent))
    const pageText = await page.evaluate(() => document.body.textContent || '')

    assert.ok(
      visualSummaries.some((t) => t?.includes('VISUAL-B')),
      `expected the visual section to show submission B's fresh result, got: ${JSON.stringify(visualSummaries)}`
    )
    assert.ok(
      !pageText.includes('VISUAL-A') && !pageText.includes('VISUAL-DETAIL-A'),
      'submission A\'s stale, late-arriving visual response must not appear anywhere in the UI once B has been submitted'
    )
  } finally {
    await page.close()
  }
})

async function assertContainsText(page: Page, selector: string, text: string) {
  const content = await page.$eval(selector, (el) => el.textContent || '')
  assert.ok(content.includes(text), `expected "${selector}" to contain "${text}", got "${content}"`)
}
