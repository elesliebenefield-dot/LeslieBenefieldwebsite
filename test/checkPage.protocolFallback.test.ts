// Protocol-fallback release — real-browser regression tests for:
//   - the on-page "Unable to verify automatically" category description
//     using evidence-based wording for a zero-response failure (never
//     claiming the site "loads some content through browser scripts"
//     when nothing was ever received), and the prefilled email agreeing;
//   - the Visual & Usability Review receiving the FINAL reachable URL
//     (the one that actually worked — e.g. the http:// URL after an
//     HTTPS→HTTP fallback), not the original (possibly https://) input.
// Runs against the real production build (dist/) via Puppeteer, with
// both API routes replaced by a local mock server — mirrors
// test/checkPage.unscoredRendering.test.ts's established pattern.
//
// Run with: node --test test/checkPage.protocolFallback.test.ts

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

// Both protocols failed — the honest zero-response shape.
const BOTH_PROTOCOLS_FAILED = {
  ok: true,
  status: 'unscored',
  input: 'https://marker-bothfailed.example/',
  finalUrl: 'https://marker-bothfailed.example/',
  summary:
    "We weren't able to complete this check for your website (0 of 7 checks completed). This may be temporary, a limitation of this automated checker, or an issue reaching your site — it doesn't necessarily mean your website has a problem. Please try again in a few minutes.",
  checksCompleted: 0,
  checksTotal: 7,
  findings: [
    finding(
      'availability',
      'Homepage availability',
      'unverified',
      'We weren’t able to complete this check for your website: The website couldn’t be reached over a secure (HTTPS) or a plain (HTTP) connection. This may be temporary, a limitation of this automated checker, or an issue on our end — it doesn’t necessarily mean your website is down. Please try again in a few minutes.',
      0
    ),
  ],
}

// A successful HTTPS→HTTP fallback result — scored, HTTPS "Not met".
const HTTP_FALLBACK_SCORED = {
  ok: true,
  status: 'scored',
  input: 'https://marker-fallback.example/',
  finalUrl: 'http://marker-fallback.example/',
  score: 70,
  rawScore: 70,
  possiblePoints: 100,
  summary: 'The technical basics checked are working, but a few common issues could be affecting visitors.',
  checksCompleted: 7,
  checksTotal: 7,
  findings: [
    finding('availability', 'Homepage availability', 'good', 'Your homepage loaded successfully.', CHECK_WEIGHTS.availability),
    finding('response-time', 'Response time', 'good', 'Fast enough.', 0),
    finding(
      'https',
      'HTTPS / secure connection',
      'improve',
      'A secure (HTTPS) connection to your website could not be made, so this check used a plain HTTP connection instead. Your visitors’ connections aren’t encrypted right now. Moving to HTTPS — most hosting providers offer free SSL certificates — is strongly recommended.',
      0
    ),
    finding('mobile', 'Mobile setup', 'good', 'Has viewport.', CHECK_WEIGHTS.mobile),
    finding('title', 'Page title', 'good', 'Good title.', CHECK_WEIGHTS.title),
    finding('meta-description', 'Meta description', 'good', 'Good description.', CHECK_WEIGHTS['meta-description']),
    finding('contact', 'Contact information', 'good', 'Found contact info.', CHECK_WEIGHTS.contact),
    finding('links', 'Homepage links', 'good', 'All links fine.', CHECK_WEIGHTS.links),
  ],
}

function visualResponse(finalUrl: string) {
  return {
    ok: true,
    status: 'complete',
    finalUrl,
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
  ['bothfailed', BOTH_PROTOCOLS_FAILED],
  ['fallback', HTTP_FALLBACK_SCORED],
])

// Records the exact URL /api/check-visual was invoked with, per marker —
// this is the direct proof the visual review received the FINAL
// reachable URL, not the original input.
const visualCheckCalledWith: string[] = []

// Records the exact raw `url` field the client sent to /api/check-website
// for each submission — this is the direct proof the client sends the
// user's UNNORMALIZED input, not a client-pre-normalized (already
// protocol-qualified) string. A real, live-preview-discovered bug: the
// client used to send the pre-normalized URL (e.g. "https://example.com/"
// even when the visitor typed a bare "example.com"), which made the
// server's hasExplicitProtocol(rawUrl) check always see an explicit
// protocol — permanently disabling the HTTPS→HTTP fallback for every
// real visitor, even though it worked correctly in every test that
// called the server directly with a genuinely bare hostname.
const technicalRequestUrls: string[] = []

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

  server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/check-website') {
      const body = await readBody(req)
      const { url } = JSON.parse(body)
      technicalRequestUrls.push(url)
      const marker = markerFor(url)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(technicalByMarker.get(marker)))
      return
    }
    if (req.method === 'POST' && req.url === '/api/check-visual') {
      const body = await readBody(req)
      const { url } = JSON.parse(body)
      visualCheckCalledWith.push(url)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(visualResponse(url)))
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

test('both protocols failed: the page shows evidence-based wording, never claiming the site loads scripted content it never received', async () => {
  const page: Page = await browser.newPage()
  try {
    await submitAndWaitForResults(page, 'bothfailed')

    const categoryDesc = await page.$eval('.checkup-category-desc', (el) => el.textContent || '')
    assert.match(categoryDesc, /automated checker wasn.t able to reach your website/)
    assert.ok(!categoryDesc.toLowerCase().includes('browser script'), `category description must not claim scripted content: "${categoryDesc}"`)

    const emailHref = await page.$eval('.checkup-cta a.btn-primary', (el) => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(emailHref)
    assert.ok(!decoded.toLowerCase().includes('browser script'), 'the prefilled email must not claim scripted content either')
    assert.ok(decoded.includes('Unable to complete this check'), 'the email must consistently reflect the same zero-response state as the page')
  } finally {
    await page.close()
  }
})

test('a successful HTTPS→HTTP fallback: the Visual & Usability Review receives the final (http://) URL, not the original https:// input', async () => {
  const page: Page = await browser.newPage()
  try {
    await submitAndWaitForResults(page, 'fallback')

    await page.waitForFunction(() => !document.querySelector('.checkup-visual-section .checkup-loading'), { timeout: 15000 })

    assert.ok(visualCheckCalledWith.length > 0, 'the visual check must have been invoked at all')
    const lastCall = visualCheckCalledWith[visualCheckCalledWith.length - 1]
    assert.equal(lastCall, HTTP_FALLBACK_SCORED.finalUrl, 'the visual review must be called with the FINAL reachable (http://) URL, not the original https:// input')
    assert.equal(lastCall.startsWith('http://'), true)

    // Cross-check the technical side of the same result: HTTPS "Not met"
    // at 0/25, availability still credited normally.
    const rows = await page.$$eval('.checkup-score-table tbody tr', (trs) => trs.map((tr) => Array.from(tr.querySelectorAll('th, td')).map((c) => c.textContent?.trim())))
    const httpsRow = rows.find((r) => r[0] === 'HTTPS / secure connection')
    assert.equal(httpsRow?.[2], 'Not met')
    assert.equal(httpsRow?.[3], '0 / 25')
    const availabilityRow = rows.find((r) => r[0] === 'Homepage availability')
    assert.equal(availabilityRow?.[2], 'Passed')
  } finally {
    await page.close()
  }
})

// Live-preview-discovered regression: the client used to send
// normalizeWebsiteUrl(inputValue).toString() as the request body's `url`
// field — the client-side PRE-NORMALIZED string, already protocol-
// qualified — instead of the visitor's own raw input. That made the
// server's hasExplicitProtocol(rawUrl) check see an explicit protocol on
// EVERY real submission, even a bare "example.com," permanently
// disabling the HTTPS→HTTP fallback for real visitors while every
// server-level test (which calls the handler directly with a genuinely
// bare hostname) kept passing. This test submits a bare hostname through
// the real page and inspects the exact HTTP request body the browser
// actually sent — the only way to catch this class of bug, since a
// canned mock response (as used above) never reveals what request body
// produced it.
test('a bare hostname (no protocol typed) is sent to the server exactly as typed — never pre-normalized to an explicit https:// URL', async () => {
  const page: Page = await browser.newPage()
  try {
    const before = technicalRequestUrls.length
    await submitAndWaitForResults(page, 'fallback')
    const sent = technicalRequestUrls.slice(before)
    assert.equal(sent.length, 1, 'exactly one request to /api/check-website for this submission')
    assert.equal(sent[0], 'marker-fallback.example', 'the server must receive the visitor’s raw input verbatim, not a client-pre-normalized https://-qualified string')
    assert.equal(sent[0].startsWith('http'), false, 'a bare hostname must never arrive at the server already looking like it had an explicit protocol')
  } finally {
    await page.close()
  }
})
