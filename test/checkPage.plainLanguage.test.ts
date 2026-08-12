// Plain-language release — real-browser regression tests for:
//   - the rendered page and the prefilled email agreeing with each
//     other on the new wording (score, category titles, the
//     search-result-description finding);
//   - the "Opportunities to improve" category rename (not "Worth
//     improving") appearing consistently on both surfaces;
//   - visual-review findings using plain language ("typical phone
//     screen," not "viewport");
//   - accessibility semantics (the score-explanation <details>/<summary>
//     disclosure, heading levels) remaining intact — this release only
//     changed text content, never markup structure, so these checks
//     prove that held.
// Runs against the real production build (dist/) via Puppeteer, with
// both API routes replaced by a local mock server — mirrors the
// established pattern in test/checkPage.scoreExplanation.test.ts.
//
// Run with: node --test test/checkPage.plainLanguage.test.ts

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

// A scored result mixing a "good" and an "improve" finding — enough to
// render both the "Looking good" and "Opportunities to improve"
// categories, plus the renamed search-result-description finding.
const MIXED_RESULT = {
  ok: true,
  status: 'scored',
  input: 'https://marker-mixed.example/',
  finalUrl: 'https://marker-mixed.example/',
  score: 90,
  rawScore: 90,
  possiblePoints: 100,
  summary: 'The technical basics checked look great, with just a few small things worth a look.',
  checksCompleted: 7,
  checksTotal: 7,
  // "Good" findings use short placeholder detail text deliberately —
  // this fixture's own purpose is to keep the full-detail (untruncated)
  // email tier selected, so the search-result-description finding's
  // complete, real wording (the one thing this test actually needs to
  // inspect end-to-end) survives into the email unclipped. The email
  // body's own length-tiered truncation (src/lib/emailBody.ts) is
  // pre-existing, unrelated behavior this release doesn't change.
  findings: [
    finding('availability', 'Homepage availability', 'good', 'Opened normally.', CHECK_WEIGHTS.availability),
    finding('response-time', 'Response time', 'good', 'Under 0.1 seconds.', 0),
    finding('https', 'HTTPS / secure connection', 'good', 'Loads securely.', CHECK_WEIGHTS.https),
    finding('mobile', 'Mobile setup', 'good', 'Sized for phones.', CHECK_WEIGHTS.mobile),
    finding('title', 'Page title', 'good', 'Long enough.', CHECK_WEIGHTS.title),
    finding(
      'meta-description',
      'Search-result description',
      'improve',
      'No search-result description was found. Search engines may create one automatically using text from your homepage, but it may not describe your business as clearly as you would like. Adding a concise description can help potential customers understand what you offer and decide whether to visit your website. It does not guarantee higher search rankings. This is commonly called a meta description.',
      0
    ),
    finding('contact', 'Contact information', 'good', 'Found on homepage.', CHECK_WEIGHTS.contact),
    finding('links', 'Homepage links', 'good', 'Sample of 3 links opened fine.', CHECK_WEIGHTS.links),
  ],
}

// Deliberately short detail text — see the comment on MIXED_RESULT's
// "good" findings above: this fixture's own purpose is to keep the
// full-detail email tier selected, so the meta-description finding's
// complete wording survives into the email unclipped for the
// consistency test below. "typical phone screen" is preserved since the
// page-rendering test checks for that exact plain-language phrase.
function visualResponse() {
  return {
    ok: true,
    status: 'complete',
    finalUrl: 'https://marker-mixed.example/',
    findings: [
      { checkId: 'overflow', label: 'Likely opportunity', detail: 'Wider than a typical phone screen — causes sideways scrolling.' },
      { checkId: 'readability', label: 'No clear issue found', detail: 'A comfortable size to read.' },
    ],
  }
}

let browser: Browser
let server: Server
let baseUrl: string

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
      await readBody(req)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(MIXED_RESULT))
      return
    }
    if (req.method === 'POST' && req.url === '/api/check-visual') {
      await readBody(req)
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

test('rendered category titles use the plain-language rename, and the search-result-description finding uses its new label and wording', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await page.type('#website-url', 'marker-mixed.example')
    await page.click('.checkup-submit')
    await page.waitForFunction(() => !document.querySelector('.checkup-finalizing'), { timeout: 15000 })
    await page.waitForSelector('.checkup-results')
    await page.waitForFunction(() => !document.querySelector('.checkup-visual-section .checkup-loading'), { timeout: 15000 })

    const categoryTitles = await page.$$eval('.checkup-category-title', (els) => els.map((e) => e.textContent))
    assert.ok(categoryTitles.includes('Opportunities to improve'), `expected "Opportunities to improve" among category titles, got: ${JSON.stringify(categoryTitles)}`)
    assert.ok(!categoryTitles.includes('Worth improving'), 'the old "Worth improving" title must not appear')

    const findingLabels = await page.$$eval('.checkup-finding-label', (els) => els.map((e) => e.childNodes[0]?.textContent?.trim()))
    assert.ok(findingLabels.includes('Search-result description'), `expected "Search-result description" among finding labels, got: ${JSON.stringify(findingLabels)}`)
    assert.ok(!findingLabels.includes('Meta description'), 'the old "Meta description" label must not appear')

    const bodyText = await page.evaluate(() => document.body.textContent || '')
    assert.match(bodyText, /No search-result description was found/)
    assert.match(bodyText, /does not guarantee higher search rankings/)
    assert.ok(!/won.t appear in search|can.t be found in search/i.test(bodyText), 'must never claim a missing description prevents search visibility')

    // Visual review findings use plain language, not "viewport".
    const visualText = await page.$eval('.checkup-visual-section', (el) => el.textContent || '')
    assert.match(visualText, /typical phone screen/)
    assert.ok(!visualText.toLowerCase().includes('viewport'), `visual review findings must not use "viewport" jargon: "${visualText}"`)

    // Accessibility: the score-explanation disclosure is still a native
    // <details>/<summary> (keyboard-operable, no extra JS needed) — this
    // release changed text only, never this element's tag/structure.
    const disclosureTag = await page.$eval('.checkup-score-disclosure', (el) => el.tagName.toLowerCase())
    assert.equal(disclosureTag, 'details')
    const summaryText = await page.$eval('.checkup-score-disclosure summary', (el) => el.textContent || '')
    assert.equal(summaryText, 'How this score is calculated')

    // Heading levels are unchanged: h2 "Your results", h3 category titles.
    const h2Text = await page.$eval('h2.checkup-results-title', (el) => el.textContent || '')
    assert.equal(h2Text, 'Your results')
  } finally {
    await page.close()
  }
})

test('the prefilled email is consistent with the rendered page: same score, same completed count, same search-result-description wording, same "Opportunities to Improve" section', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await page.type('#website-url', 'marker-mixed.example')
    await page.click('.checkup-submit')
    await page.waitForFunction(() => !document.querySelector('.checkup-finalizing'), { timeout: 15000 })
    await page.waitForSelector('.checkup-results')
    await page.waitForFunction(() => !document.querySelector('.checkup-visual-section .checkup-loading'), { timeout: 15000 })

    const pageScore = await page.$eval('.checkup-score-number', (el) => el.textContent || '')
    const pageCount = await page.$eval('.checkup-checks-count', (el) => el.textContent || '')

    const emailHref = await page.$eval('.checkup-cta a.btn-primary', (el) => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(emailHref)

    assert.ok(decoded.includes(`Technical Basics Score: ${pageScore}/100`), `email score must match the page's ${pageScore}`)
    assert.ok(pageCount.includes('7 of 7'), 'sanity check on the page count text itself')
    assert.ok(decoded.includes('(7 of 7 checks completed)'), 'email completed-count must match the page')

    assert.ok(decoded.includes('Opportunities to Improve:'), 'the email must use the same renamed section as the page')
    assert.ok(!decoded.includes('Worth Improving:'), 'the old section name must not appear in the email')

    // The email's own length-tiered truncation (pre-existing,
    // unrelated to this release) may shorten a long finding's detail
    // text — so this checks only what's guaranteed regardless of which
    // tier renders: the primary message survives (truncation only ever
    // trims from the END), and truncation can only ever REMOVE text, so
    // it can never introduce a false claim that wasn't already absent.
    // The untruncated, full-detail case (the disclaimer surviving
    // verbatim) is covered separately, directly against
    // buildCombinedEmailBody, in test/plainLanguageWording.test.ts.
    assert.ok(decoded.includes('No search-result description was found'), 'the email must carry the same search-result-description primary message as the page')
    assert.ok(!/won.t appear in search|can.t be found in search/i.test(decoded), 'the email must never claim a missing description prevents search visibility')
    assert.ok(!/will improve your (search )?ranking|will rank higher/i.test(decoded), 'the email must never promise improved search rankings')
  } finally {
    await page.close()
  }
})
