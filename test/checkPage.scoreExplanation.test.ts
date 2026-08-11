// Score-explanation release: real-browser regression tests for the
// "How this score is calculated" disclosure and the near-score
// calculation summary in CheckPage.tsx. Runs against the real
// production build (dist/) via Puppeteer, with both API routes replaced
// by a local mock server whose response content is fully controlled —
// mirrors test/checkPage.finalizeTransition.test.ts's pattern.
//
// Run with: node --test test/checkPage.scoreExplanation.test.ts

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

function finding(id: string, label: string, bucket: string, detail: string, points: number) {
  return { id, label, bucket, detail, points }
}

// Scenario A: fully completed, 100/100, no fallback needed.
const FULLY_COMPLETED = {
  ok: true,
  input: 'https://marker-full.example/',
  finalUrl: 'https://marker-full.example/',
  score: 100,
  rawScore: 100,
  possiblePoints: 100,
  summary: 'The technical basics checked look great.',
  checksCompleted: 7,
  checksTotal: 7,
  findings: [
    finding('availability', 'Homepage availability', 'good', 'Loaded fine.', 30),
    finding('response-time', 'Response time', 'good', 'Fast enough.', 0),
    finding('https', 'HTTPS / secure connection', 'good', 'Secure.', 25),
    finding('mobile', 'Mobile setup', 'good', 'Has viewport.', 15),
    finding('title', 'Page title', 'good', 'Good title.', 10),
    finding('meta-description', 'Meta description', 'good', 'Good description.', 10),
    finding('contact', 'Contact information', 'good', 'Found contact info.', 5),
    finding('links', 'Homepage links', 'good', 'All links fine.', 5),
  ],
}

// Scenario B: partial — contact unverified (excluded from denominator),
// mobile flagged 'improve' with 0 points, everything else good.
const PARTIAL_UNVERIFIED = {
  ok: true,
  input: 'https://marker-partial.example/',
  finalUrl: 'https://marker-partial.example/',
  score: 84,
  rawScore: 80,
  possiblePoints: 95,
  summary: 'The technical basics checked look solid. Not every check could be completed, so this reflects only what was verified.',
  checksCompleted: 6,
  checksTotal: 7,
  findings: [
    finding('availability', 'Homepage availability', 'good', 'Loaded fine.', 30),
    finding('response-time', 'Response time', 'good', 'Fast enough.', 0),
    finding('https', 'HTTPS / secure connection', 'good', 'Secure.', 25),
    finding('mobile', 'Mobile setup', 'improve', 'No viewport found.', 0),
    finding('title', 'Page title', 'good', 'Good title.', 10),
    finding('meta-description', 'Meta description', 'good', 'Good description.', 10),
    finding('contact', 'Contact information', 'unverified', 'Could not verify — JS rendered.', 0),
    finding('links', 'Homepage links', 'good', 'All links fine.', 5),
  ],
}

function visualResponse(marker: string, opts: { withContactFallback?: boolean } = {}) {
  const base = {
    ok: true,
    status: 'complete',
    finalUrl: `https://${marker}.example`,
    findings: [
      { checkId: 'overflow', label: 'No clear issue found', detail: `VISUAL-OVERFLOW-${marker}` },
      { checkId: 'readability', label: 'No clear issue found', detail: `VISUAL-READABILITY-${marker}` },
    ],
  }
  if (!opts.withContactFallback) return base
  return {
    ...base,
    contactFallback: {
      finding: finding('contact', 'Contact information', 'good', 'Found via rendered page.', 5),
      points: 5,
      possiblePointsRestored: 5,
    },
  }
}

let browser: Browser
let server: Server
let baseUrl: string

const technicalByMarker = new Map<string, unknown>()
const visualOptsByMarker = new Map<string, { withContactFallback?: boolean }>()

function markerFor(url: string): string {
  const match = /marker-([a-z]+)/i.exec(url)
  return match ? match[1].toLowerCase() : 'unknown'
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
  })
}

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  technicalByMarker.set('full', FULLY_COMPLETED)
  technicalByMarker.set('partial', PARTIAL_UNVERIFIED)
  technicalByMarker.set('fallback', {
    ...PARTIAL_UNVERIFIED,
    input: 'https://marker-fallback.example/',
    finalUrl: 'https://marker-fallback.example/',
  })
  visualOptsByMarker.set('fallback', { withContactFallback: true })

  server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/check-website') {
      const body = await readBody(req)
      const { url } = JSON.parse(body)
      const marker = markerFor(url)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(technicalByMarker.get(marker)))
      return
    }
    if (req.method === 'POST' && req.url === '/api/check-visual') {
      const body = await readBody(req)
      const { url } = JSON.parse(body)
      const marker = markerFor(url)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(visualResponse(marker, visualOptsByMarker.get(marker) ?? {})))
      return
    }

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

async function submitAndWaitForResults(page: Page, marker: string) {
  await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
  await page.type('#website-url', `marker-${marker}.example`)
  await page.click('.checkup-submit')
  await page.waitForFunction(() => !document.querySelector('.checkup-finalizing'), { timeout: 15000 })
  await page.waitForSelector('.checkup-results')
}

test('fully completed 100/100 result: disclosure shows all 7 checks at full credit, response time unscored, visual findings excluded', async () => {
  const page: Page = await browser.newPage()
  try {
    await submitAndWaitForResults(page, 'full')

    const calcText = await page.$eval('.checkup-score-calc', (el) => el.textContent || '')
    assert.match(calcText, /100 of 100 possible points/)
    assert.match(calcText, /score of 100/)
    assert.match(calcText, /Response time is measured and shown for context, but it isn.t scored/)
    assert.doesNotMatch(calcText, /left out of that possible-points total/, 'a fully-completed result must not show the unverified-exclusion note')

    const rowLabels = await page.$$eval('.checkup-score-table tbody th', (els) => els.map((e) => e.textContent))
    assert.deepEqual(rowLabels, ['Homepage availability', 'HTTPS / secure connection', 'Mobile setup', 'Page title', 'Meta description', 'Contact information', 'Homepage links'], 'exactly the 7 counted checks, in order — response-time must not appear as a row')

    const formulaText = await page.$eval('.checkup-score-formula', (el) => el.textContent || '')
    assert.match(formulaText, /100 ÷ 100/)

    const currentBandText = await page.$eval("tr[aria-current='true']", (el) => el.textContent || '')
    assert.match(currentBandText, /Looking strong/)

    const scoreExplanationText = await page.$eval('.checkup-score-explanation', (el) => el.textContent || '')
    assert.ok(!scoreExplanationText.includes('VISUAL-OVERFLOW-full') && !scoreExplanationText.includes('VISUAL-READABILITY-full'), 'visual findings must never appear inside the Technical Basics score explanation')
    assert.match(scoreExplanationText, /not included in this score/)
  } finally {
    await page.close()
  }
})

test('partially completed result: an unverified check is excluded from the possible-points denominator, not scored as a failure', async () => {
  const page: Page = await browser.newPage()
  try {
    await submitAndWaitForResults(page, 'partial')

    const calcText = await page.$eval('.checkup-score-calc', (el) => el.textContent || '')
    assert.match(calcText, /80 of 95 possible points/)
    assert.match(calcText, /left out of that possible-points total entirely — they.re not counted as failures/)

    const rows = await page.$$eval('.checkup-score-table tbody tr', (trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('th, td')).map((c) => c.textContent))
    )
    const contactRow = rows.find((r) => r[0] === 'Contact information')
    assert.ok(contactRow, 'contact must still appear as a row even though it is unverified')
    assert.equal(contactRow?.[2], 'Unable to verify')
    assert.equal(contactRow?.[3]?.trim(), '0 / 5')
  } finally {
    await page.close()
  }
})

test('a fallback-updated result: the disclosure reflects the merged findings/points, not the pre-merge state', async () => {
  const page: Page = await browser.newPage()
  try {
    await submitAndWaitForResults(page, 'fallback')

    const calcText = await page.$eval('.checkup-score-calc', (el) => el.textContent || '')
    // rawScore 80 + 5 (contact fallback) = 85, possiblePoints 95 + 5 = 100
    assert.match(calcText, /85 of 100 possible points/)
    assert.match(calcText, /score of 85/)

    const rows = await page.$$eval('.checkup-score-table tbody tr', (trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('th, td')).map((c) => c.textContent))
    )
    const contactRow = rows.find((r) => r[0] === 'Contact information')
    assert.equal(contactRow?.[2], 'Passed', 'the merged result must show the resolved (not the original unverified) status')
    assert.equal(contactRow?.[3]?.trim(), '5 / 5')

    const countText = await page.$eval('.checkup-checks-count', (el) => el.textContent || '')
    assert.ok(countText.includes('7 of 7'), 'checksCompleted must also reflect the merge')
  } finally {
    await page.close()
  }
})
