// Release-polish regression tests for the visible partial-result flash
// fixed in CheckPage.tsx: the technical result used to render immediately
// (e.g. "5 of 7 checks completed"), then silently jump to a higher score/
// count once the visual review (and any contact/links fallback merge)
// finished — making the checker look inconsistent even though the final
// answer was correct. See `isFinalizing` in CheckPage.tsx.
//
// Runs against the real production build (`dist/`) in a real browser via
// Puppeteer, with both API routes replaced by a local mock server whose
// response timing/content is fully controlled. No live network access.
//
// Run with: node --test test/checkPage.finalizeTransition.test.ts

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

interface TechnicalOpts {
  needsFallback?: boolean
  delayMs?: number
}

function technicalResponse(finalUrl: string, marker: string, opts: TechnicalOpts = {}) {
  const needsFallback = !!opts.needsFallback
  const findings = [
    { id: 'response-time', label: 'Response time', bucket: 'good', detail: `TECHNICAL-DETAIL-${marker}` },
    { id: 'contact', label: 'Contact info', bucket: needsFallback ? 'unverified' : 'good', detail: `CONTACT-${marker}` },
    { id: 'links', label: 'Homepage links', bucket: needsFallback ? 'unverified' : 'good', detail: `LINKS-${marker}` },
  ]
  return {
    ok: true,
    input: finalUrl,
    finalUrl,
    score: 100,
    summary: `TECHNICAL-SUMMARY-${marker}`,
    findings,
    checksCompleted: needsFallback ? 5 : 7,
    checksTotal: 7,
    rawScore: needsFallback ? 50 : 70,
    possiblePoints: needsFallback ? 50 : 70,
  }
}

interface VisualOpts {
  delayMs?: number
  fail?: boolean
  withFallback?: boolean
}

function visualResponse(marker: string, opts: VisualOpts = {}) {
  if (opts.fail) return { ok: false, error: `VISUAL-FAILED-${marker}` }
  const base = {
    ok: true,
    status: 'complete',
    finalUrl: `https://${marker.toLowerCase()}.example`,
    findings: [
      { checkId: 'overflow', label: 'No clear issue found', detail: `VISUAL-DETAIL-${marker}` },
      { checkId: 'readability', label: 'No clear issue found', detail: `VISUAL-READABILITY-${marker}` },
    ],
  }
  if (!opts.withFallback) return base
  return {
    ...base,
    contactFallback: { finding: { id: 'contact', label: 'Contact info', bucket: 'good', detail: `CONTACT-FALLBACK-${marker}` }, points: 10, possiblePointsRestored: 10 },
    linksFallback: { finding: { id: 'links', label: 'Homepage links', bucket: 'good', detail: `LINKS-FALLBACK-${marker}` }, points: 10, possiblePointsRestored: 10 },
  }
}

let browser: Browser
let server: Server
let baseUrl: string

const technicalOptsByMarker = new Map<string, TechnicalOpts>()
const visualOptsByMarker = new Map<string, VisualOpts>()

function markerFor(url: string): string {
  const match = /marker-([a-z0-9]+)/i.exec(url)
  return match ? match[1].toUpperCase() : 'UNKNOWN'
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
      const opts = technicalOptsByMarker.get(marker) ?? {}
      const send = () => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(technicalResponse(url, marker, opts)))
      }
      if (opts.delayMs) setTimeout(send, opts.delayMs)
      else send()
      return
    }
    if (req.method === 'POST' && req.url === '/api/check-visual') {
      const body = await readBody(req)
      const { url } = JSON.parse(body)
      const marker = markerFor(url)
      const opts = visualOptsByMarker.get(marker) ?? {}
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(visualResponse(marker, opts)))
      }, opts.delayMs ?? 0)
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

async function submit(page: Page, marker: string) {
  await page.evaluate(() => {
    const input = document.getElementById('website-url') as HTMLInputElement
    input.value = ''
  })
  await page.type('#website-url', `marker-${marker}.example`)
  await page.click('.checkup-submit')
}

test('a 5-of-7 static result that requires fallback is never exposed as the displayed final result, and the UI transitions directly from finalizing to the merged 7-of-7 result', async () => {
  technicalOptsByMarker.set('ONE', { needsFallback: true })
  visualOptsByMarker.set('ONE', { delayMs: 700, withFallback: true })

  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await submit(page, 'ONE')

    await page.waitForSelector('.checkup-finalizing')
    // While finalizing, the results report (and therefore any score/count/
    // findings/email content) must not exist in the DOM at all — not just
    // be visually hidden.
    const resultsWhileFinalizing = await page.$('.checkup-results')
    assert.equal(resultsWhileFinalizing, null, 'the results report must not be present while still finalizing')

    await page.waitForFunction(() => !document.querySelector('.checkup-finalizing'), { timeout: 15000 })
    await page.waitForSelector('.checkup-results')

    const countText = await page.$eval('.checkup-checks-count', (el) => el.textContent || '')
    assert.ok(countText.includes('7 of 7'), `expected the merged 7-of-7 count, got: ${countText}`)
    const bodyText = await page.evaluate(() => document.body.textContent || '')
    assert.ok(!bodyText.includes('5 of 7'), 'the intermediate 5-of-7 static count must never have appeared')
  } finally {
    await page.close()
  }
})

test('a site requiring no fallback still receives one coherent final render — visual findings and score appear together, never a separate visual-loading state after reveal', async () => {
  technicalOptsByMarker.set('TWO', { needsFallback: false })
  visualOptsByMarker.set('TWO', { delayMs: 200 })

  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await submit(page, 'TWO')

    await page.waitForFunction(() => !document.querySelector('.checkup-finalizing'), { timeout: 15000 })
    await page.waitForSelector('.checkup-results')

    const countText = await page.$eval('.checkup-checks-count', (el) => el.textContent || '')
    assert.ok(countText.includes('7 of 7'), `expected 7 of 7, got: ${countText}`)
    const visualLoading = await page.$('.checkup-visual-section .checkup-loading')
    assert.equal(visualLoading, null, 'the visual section must not show its own loading state once results are revealed')
    const visualText = await page.$eval('.checkup-visual-section', (el) => el.textContent || '')
    assert.ok(visualText.includes('VISUAL-DETAIL-TWO'), 'visual findings must already be present in the same reveal')
  } finally {
    await page.close()
  }
})

test('starting another check immediately clears the prior result', async () => {
  technicalOptsByMarker.set('THREE', { needsFallback: false })
  visualOptsByMarker.set('THREE', {})
  technicalOptsByMarker.set('FOUR', { needsFallback: false, delayMs: 600 })
  visualOptsByMarker.set('FOUR', {})

  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await submit(page, 'THREE')
    await page.waitForFunction(() => !document.querySelector('.checkup-finalizing'), { timeout: 15000 })
    await page.waitForSelector('.checkup-results')
    let bodyText = await page.evaluate(() => document.body.textContent || '')
    assert.ok(bodyText.includes('TECHNICAL-SUMMARY-THREE'), 'submission THREE\'s result must be showing before submission FOUR starts')

    await submit(page, 'FOUR')
    // FOUR's technical response is deliberately delayed — check immediately
    // (well before it can possibly resolve) that THREE's result is gone.
    await new Promise((resolve) => setTimeout(resolve, 100))
    const resultsRightAfterSubmit = await page.$('.checkup-results')
    assert.equal(resultsRightAfterSubmit, null, 'the prior result must be cleared immediately, not left showing until the new result arrives')
    bodyText = await page.evaluate(() => document.body.textContent || '')
    assert.ok(!bodyText.includes('TECHNICAL-SUMMARY-THREE'), 'the prior submission\'s content must not still be visible')

    await page.waitForFunction(() => !document.querySelector('.checkup-finalizing'), { timeout: 15000 })
    await page.waitForSelector('.checkup-results')
    bodyText = await page.evaluate(() => document.body.textContent || '')
    assert.ok(bodyText.includes('TECHNICAL-SUMMARY-FOUR'), 'submission FOUR\'s result must eventually appear')
  } finally {
    await page.close()
  }
})

test('a genuine visual-review failure exits the finalizing state with the honest, available (unmerged) results — not an infinite loading state', async () => {
  technicalOptsByMarker.set('FIVE', { needsFallback: true })
  visualOptsByMarker.set('FIVE', { delayMs: 300, fail: true })

  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await submit(page, 'FIVE')
    await page.waitForSelector('.checkup-finalizing')
    await page.waitForFunction(() => !document.querySelector('.checkup-finalizing'), { timeout: 15000 })
    await page.waitForSelector('.checkup-results')

    const countText = await page.$eval('.checkup-checks-count', (el) => el.textContent || '')
    assert.ok(countText.includes('5 of 7'), `a failed visual review must fall back to the honest, unmerged static count, got: ${countText}`)
    const visualSectionText = await page.$eval('.checkup-visual-section', (el) => el.textContent || '')
    assert.ok(visualSectionText.includes('couldn’t run') || visualSectionText.toLowerCase().includes("couldn't run") || visualSectionText.toLowerCase().includes('went wrong'), `expected an honest visual-review failure message, got: ${visualSectionText}`)
  } finally {
    await page.close()
  }
})

test('the final displayed result and the prefilled email use the same merged data', async () => {
  technicalOptsByMarker.set('SIX', { needsFallback: true })
  visualOptsByMarker.set('SIX', { delayMs: 200, withFallback: true })

  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await submit(page, 'SIX')
    await page.waitForFunction(() => !document.querySelector('.checkup-finalizing'), { timeout: 15000 })
    await page.waitForSelector('.checkup-results')

    const countText = await page.$eval('.checkup-checks-count', (el) => el.textContent || '')
    assert.ok(countText.includes('7 of 7'), `expected the displayed count to already be merged, got: ${countText}`)

    const ctaText = await page.$eval('.checkup-cta a.btn-primary, .checkup-cta button.btn-primary', (el) => el.textContent || '')
    assert.ok(!ctaText.includes('Preparing'), 'the email CTA must already be in its ready state once results are shown')

    const href = await page.$eval('.checkup-cta a.btn-primary', (el) => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(href)
    assert.ok(decoded.includes('7 of 7 checks completed'), `the prefilled email must reflect the same merged count shown on the page, got: ${decoded}`)
  } finally {
    await page.close()
  }
})
