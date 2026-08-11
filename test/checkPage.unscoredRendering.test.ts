// Rubric-audit release — real-browser regression tests proving:
//   - a CheckUnscored result never renders a numerical score or a
//     score-band label, in either its confirmed-error-response shape
//     (a real 404/500 came back) or its checker-unavailable shape (DNS/
//     timeout/connection/internal failure) — only the prominent
//     completed-check count and an honest summary;
//   - the completed-check count and score shown on the page, the
//     disclosure table's own point sum, and the prefilled email body
//     all agree with each other and with the raw API response — never
//     silently drifting apart.
// Runs against the real production build (dist/) via Puppeteer, with
// both API routes replaced by a local mock server whose response
// content is fully controlled — mirrors
// test/checkPage.scoreExplanation.test.ts's established pattern.
//
// Run with: node --test test/checkPage.unscoredRendering.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { CHECK_WEIGHTS } from '../src/lib/websiteCheck.ts'

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

// Confirmed non-success response: real evidence (a 404 came back), but
// only 2 of 7 checks could run.
const CONFIRMED_404 = {
  ok: true,
  status: 'unscored',
  input: 'https://marker-confirmed404.example/',
  finalUrl: 'https://marker-confirmed404.example/',
  summary: "Only 2 of 7 technical basics could be checked, because your homepage didn't return a normal response. See the details below.",
  checksCompleted: 2,
  checksTotal: 7,
  findings: [
    finding('availability', 'Homepage availability', 'specialist', 'Your homepage responded with a status of 404 instead of a normal success status.', 0),
    finding('https', 'HTTPS / secure connection', 'good', 'Your website loads over a secure (HTTPS) connection.', CHECK_WEIGHTS.https),
  ],
}

// Checker-side failure: no confirmed evidence about the website at all.
const DNS_FAILURE = {
  ok: true,
  status: 'unscored',
  input: 'https://marker-dnsfail.example/',
  finalUrl: 'https://marker-dnsfail.example/',
  summary:
    "We weren't able to complete this check for your website (0 of 7 checks completed). This may be temporary, a limitation of this automated checker, or an issue reaching your site — it doesn't necessarily mean your website has a problem. Please try again in a few minutes.",
  checksCompleted: 0,
  checksTotal: 7,
  findings: [finding('availability', 'Homepage availability', 'unverified', "We weren't able to complete this check for your website: The website couldn't be reached.", 0)],
}

// A fully scored, fully completed result — the cross-surface consistency
// baseline this file checks the unscored cases against, and its own
// arithmetic (disclosure table point sum vs. rawScore, page vs. email).
const SCORED = {
  ok: true,
  status: 'scored',
  input: 'https://marker-scored.example/',
  finalUrl: 'https://marker-scored.example/',
  score: 84,
  rawScore: 80,
  possiblePoints: 95,
  summary: 'The technical basics checked look solid. Not every check could be completed, so this reflects only what was verified.',
  checksCompleted: 6,
  checksTotal: 7,
  findings: [
    finding('availability', 'Homepage availability', 'good', 'Loaded fine.', CHECK_WEIGHTS.availability),
    finding('response-time', 'Response time', 'good', 'Fast enough.', 0),
    finding('https', 'HTTPS / secure connection', 'good', 'Secure.', CHECK_WEIGHTS.https),
    finding('mobile', 'Mobile setup', 'improve', 'No viewport found.', 0),
    finding('title', 'Page title', 'good', 'Good title.', CHECK_WEIGHTS.title),
    finding('meta-description', 'Meta description', 'good', 'Good description.', CHECK_WEIGHTS['meta-description']),
    finding('contact', 'Contact information', 'unverified', 'Could not verify — JS rendered.', 0),
    finding('links', 'Homepage links', 'good', 'All links fine.', CHECK_WEIGHTS.links),
  ],
}

function visualResponse() {
  return {
    ok: true,
    status: 'complete',
    finalUrl: 'https://marker.example',
    findings: [
      { checkId: 'overflow', label: 'No clear issue found', detail: 'VISUAL-OVERFLOW' },
      { checkId: 'readability', label: 'No clear issue found', detail: 'VISUAL-READABILITY' },
    ],
  }
}

let browser: Browser
let server: Server
let baseUrl: string

const technicalByMarker = new Map<string, unknown>([
  ['confirmed404', CONFIRMED_404],
  ['dnsfail', DNS_FAILURE],
  ['scored', SCORED],
])

function markerFor(url: string): string {
  const match = /marker-([a-z0-9]+)/i.exec(url)
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
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(visualResponse()))
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

async function scoreElementsExist(page: Page): Promise<boolean> {
  // .checkup-score-label is deliberately excluded: FindingRow reuses that
  // exact class name for each individual finding's own label text, which
  // renders in both scored and unscored results — it isn't score-specific.
  return page.evaluate(() => {
    return (
      document.querySelector('.checkup-score-row') !== null ||
      document.querySelector('.checkup-score-number') !== null ||
      document.querySelector('.checkup-score-disclosure') !== null
    )
  })
}

test('confirmed 404: no score or band renders, only the prominent 2-of-7 count and the real status', async () => {
  const page: Page = await browser.newPage()
  try {
    await submitAndWaitForResults(page, 'confirmed404')

    assert.equal(await scoreElementsExist(page), false, 'a confirmed non-success response must never render a score/band, even though real evidence (the 404) exists')

    const countText = await page.$eval('.checkup-checks-count--prominent', (el) => el.textContent || '')
    assert.ok(countText.includes('2 of 7 checks completed'))

    const bodyText = await page.evaluate(() => document.body.textContent || '')
    assert.match(bodyText, /status of 404/)
    assert.ok(!/\bdoesn.t work\b/i.test(bodyText), 'must not claim the website itself doesn\'t work')
  } finally {
    await page.close()
  }
})

test('DNS/connection failure: no score or band renders, only the prominent 0-of-7 count and an honest, non-alarmist summary', async () => {
  const page: Page = await browser.newPage()
  try {
    await submitAndWaitForResults(page, 'dnsfail')

    assert.equal(await scoreElementsExist(page), false, 'a checker-side failure must never render a score/band — there is no confirmed evidence about the website at all')

    const countText = await page.$eval('.checkup-checks-count--prominent', (el) => el.textContent || '')
    assert.ok(countText.includes('0 of 7 checks completed'))

    const summaryText = await page.$eval('.checkup-unscored-notice .checkup-summary', (el) => el.textContent || '')
    assert.match(summaryText, /temporary|limitation of this automated checker/)

    const emailHref = await page.$eval('.checkup-cta a.btn-primary', (el) => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(emailHref)
    assert.ok(!/\d+\/100/.test(decoded), 'the prefilled email must not show a score either, for consistency with the page')
    assert.ok(decoded.includes('Unable to complete this check'))
  } finally {
    await page.close()
  }
})

test('a scored result: the score, the disclosure table point sum, and the prefilled email all agree with the raw API numbers', async () => {
  const page: Page = await browser.newPage()
  try {
    await submitAndWaitForResults(page, 'scored')

    assert.equal(await scoreElementsExist(page), true, 'a confirmed-good-availability result must render its score')

    const displayedScore = await page.$eval('.checkup-score-number', (el) => el.textContent || '')
    assert.equal(displayedScore, String(SCORED.score))

    const countText = await page.$eval('.checkup-checks-count', (el) => el.textContent || '')
    assert.ok(countText.includes(`${SCORED.checksCompleted} of ${SCORED.checksTotal}`))

    // The disclosure table's own point column must sum to exactly rawScore
    // — proving the table isn't silently out of sync with the headline
    // score's own numerator.
    const pointCells = await page.$$eval('.checkup-score-table tbody td:last-child', (els) => els.map((e) => e.textContent || ''))
    const summed = pointCells.reduce((total, cell) => {
      const match = /^\s*(\d+)\s*\/\s*\d+\s*$/.exec(cell)
      return total + (match ? Number(match[1]) : 0)
    }, 0)
    assert.equal(summed, SCORED.rawScore)

    const emailHref = await page.$eval('.checkup-cta a.btn-primary', (el) => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(emailHref)
    assert.ok(decoded.includes(`Technical Basics Score: ${SCORED.score}/100 (${SCORED.checksCompleted} of ${SCORED.checksTotal} checks completed)`), `email must show the same score/count as the page, got: ${decoded}`)
  } finally {
    await page.close()
  }
})
