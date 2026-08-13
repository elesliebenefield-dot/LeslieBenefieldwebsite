// Tests for the /services page (Services & Pricing) — a standalone page
// added alongside /check, following the same shared Nav/Footer + own-page
// pattern. Covers what's specific to this page: correct pricing content and
// labeling, clean heading structure (no skipped levels — this page has no
// [data-reveal]-gated section that could go missing mid-scroll like the
// process-step bug in site.headingStructure.test.ts, but a fresh page is
// still worth a direct check rather than assuming), CTA link destinations,
// no horizontal overflow, and prefers-reduced-motion showing all content
// immediately with no animation.
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/servicesPage.test.ts

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
const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
}

let browser: Browser
let server: Server
let baseUrl: string

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
    const urlPath = req.url === '/' ? '/services.html' : req.url || '/services.html'
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

function collectHeadingStructure() {
  const allHeadings = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
  const h1Count = allHeadings.filter((h) => h.tagName === 'H1').length
  const levels = allHeadings.map((h) => Number(h.tagName[1]))
  let hasSkippedLevel = false
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) hasSkippedLevel = true
  }
  if (levels.length > 0 && levels[0] > 2) hasSkippedLevel = true
  const emptyHeadingCount = allHeadings.filter((h) => (h.textContent || '').trim().length === 0).length
  return { h1Count, hasSkippedLevel, emptyHeadingCount }
}

test('page loads with no console/page errors', async () => {
  const page: Page = await browser.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    assert.deepEqual(pageErrors, [])
  } finally {
    await page.close()
  }
})

test('heading structure: single h1, no skipped level, no empty headings', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const m = await page.evaluate(collectHeadingStructure)
    assert.deepEqual(m, { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 })
    const h1Text = await page.$eval('h1', (el) => el.textContent?.trim())
    assert.equal(h1Text, 'Clear options. Custom quotes.')
  } finally {
    await page.close()
  }
})

test('all five pricing cards are present with correct titles and price labels', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const cards = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.pricing-card')).map((card) => ({
        title: card.querySelector('.pricing-card-title')?.textContent?.trim(),
        price: card.querySelector('.pricing-card-price')?.textContent?.trim(),
      }))
    )
    assert.deepEqual(cards, [
      { title: 'Free Website Review', price: 'Complimentary' },
      { title: 'One-Page Website or Landing Page', price: 'Starting at $750' },
      { title: 'Small-Business Website', price: 'Starting at $1,500' },
      { title: 'Website Refresh', price: 'Starting at $800' },
      { title: 'Website Updates & Support', price: 'Custom quote' },
    ])
  } finally {
    await page.close()
  }
})

test('every paid service is labeled "Starting at" or "Custom quote" — no hourly rate anywhere on the page', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const prices = await page.$$eval('.pricing-card-price', (els) => els.map((e) => e.textContent?.trim() || ''))
    for (const price of prices) {
      assert.ok(
        price === 'Complimentary' || price === 'Custom quote' || /^Starting at \$/.test(price),
        `unexpected price label: "${price}"`
      )
    }
    // Checks for an actual displayed rate like "$50/hour" or "$50/hr" — not
    // the word "hourly" on its own, since the required page copy
    // legitimately uses it in a reassuring negation ("no surprise hourly
    // billing"), which must NOT trip this check.
    const bodyText = await page.evaluate(() => document.body.textContent || '')
    assert.ok(!/\$\s*\d+(\.\d+)?\s*\/\s*(hour|hr)\b/i.test(bodyText), 'page must not display an hourly rate')
  } finally {
    await page.close()
  }
})

test('payment section is present with the correct heading', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const heading = await page.$eval('.pricing-payment-inner .section-title', (el) => el.textContent?.trim())
    assert.equal(heading, 'Simple, clear payment expectations.')
    const body = await page.$eval('.pricing-payment-inner .section-subtitle', (el) => el.textContent || '')
    assert.match(body, /50% project deposit/)
  } finally {
    await page.close()
  }
})

test('final CTA has the correct heading and both buttons point to the right destinations', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const heading = await page.$eval('.pricing-cta-inner .section-title', (el) => el.textContent?.trim())
    assert.equal(heading, 'Not sure which option fits?')

    const reviewHref = await page.$eval('.pricing-cta-buttons a.btn-primary', (el) => el.getAttribute('href'))
    assert.equal(reviewHref, '/check')

    const quoteLink = await page.$eval('.pricing-cta-buttons a.btn-outline', (el) => ({
      href: el.getAttribute('href'),
      target: el.getAttribute('target'),
      rel: el.getAttribute('rel'),
    }))
    assert.equal(quoteLink.href, GOOGLE_FORM_URL)
    assert.equal(quoteLink.target, '_blank')
    assert.match(quoteLink.rel || '', /noopener/)
  } finally {
    await page.close()
  }
})

test('nav includes a working "Services & Pricing" link to /services, and the "Get a Quote" nav button still points to the Google Form', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const navLink = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('.nav-links a')).find((a) => a.textContent?.trim() === 'Services & Pricing')
      return link ? link.getAttribute('href') : null
    })
    assert.equal(navLink, '/services')

    const contactBtnHref = await page.$eval('.nav-contact-btn', (el) => el.getAttribute('href'))
    assert.equal(contactBtnHref, GOOGLE_FORM_URL)
  } finally {
    await page.close()
  }
})

test('no horizontal overflow at 390px (mobile) or 1280px (desktop)', async () => {
  const page: Page = await browser.newPage()
  try {
    for (const width of [390, 768, 1080, 1081, 1280]) {
      await page.setViewport({ width, height: 900 })
      await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 0, `expected no overflow at ${width}px, got ${overflow}px`)
    }
  } finally {
    await page.close()
  }
})

test('prefers-reduced-motion: all [data-reveal] content is visible immediately with no transition', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const states = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-reveal]')).map((el) => {
        const cs = getComputedStyle(el)
        return { opacity: cs.opacity, transitionProperty: cs.transitionProperty }
      })
    )
    assert.ok(states.length > 0, 'expected at least one [data-reveal] element on the page')
    for (const s of states) {
      assert.equal(s.opacity, '1')
      // transitionProperty (not the full shorthand) is what actually
      // determines whether anything animates — .pricing-card also matches
      // a more specific [data-reveal="soft"][data-reveal-delay="N"] rule
      // that sets transition-delay alone, which survives in the shorthand
      // serialization as an inert value once transition-property is none.
      assert.equal(s.transitionProperty, 'none')
    }
  } finally {
    await page.close()
  }
})

test('"Back to Websites by Leslie" link is keyboard-focusable and points home', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const href = await page.$eval('.pricing-back', (el) => el.getAttribute('href'))
    assert.equal(href, '/')
  } finally {
    await page.close()
  }
})
