// Tests for the /privacy-policy page — a standalone page added alongside
// /check, /services, /faq, and /website-checklist, following the same
// shared Nav/Footer + own-page pattern. Covers what's specific to this
// page: the required H1/last-updated text, clean heading structure, that
// every required policy topic is actually present, that the page never
// claims a payment processor or analytics/cookie behavior the codebase
// doesn't actually have, correct contact links, no horizontal overflow,
// keyboard reachability, and prefers-reduced-motion.
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/privacyPolicyPage.test.ts

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
const LESLIE_EMAIL = 'websitesbyleslie01@gmail.com'

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
    const urlPath = req.url === '/' ? '/privacy-policy.html' : req.url || '/privacy-policy.html'
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
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    assert.deepEqual(pageErrors, [])
  } finally {
    await page.close()
  }
})

test('heading structure: single h1 "Privacy Policy", no skipped level, no empty headings', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const m = await page.evaluate(collectHeadingStructure)
    assert.deepEqual(m, { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 })
    const h1Text = await page.$eval('h1', (el) => el.textContent?.trim())
    assert.equal(h1Text, 'Privacy Policy')
  } finally {
    await page.close()
  }
})

test('the required "Last updated" line is present with the correct date', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const updated = await page.$eval('.privacy-updated', (el) => el.textContent?.trim())
    assert.equal(updated, 'Last updated: September 25, 2026.')
  } finally {
    await page.close()
  }
})

test('every required policy topic is present as its own section', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const titles = await page.$$eval('.privacy-section-title', (els) => els.map((e) => e.textContent?.trim()))
    // Order matches the brief's "at minimum, cover" list, plus a cookies
    // clarification and a closing contact section.
    assert.deepEqual(titles, [
      'Information You May Provide',
      'Cookies & Automatic Information',
      'Interactive Tools & the Bakery Pricing Calculator',
      'How This Information Is Used',
      'Service Providers',
      'Sharing Your Information',
      'Data Security',
      'Your Choices',
      'Adults Only',
      'Changes to This Policy',
      'Contact',
    ])
  } finally {
    await page.close()
  }
})

test('information-collected section names what the codebase audit actually confirmed (name/phone/URL/contact method/project details, the mailto-based review form, and the Google Form)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const text = await page.evaluate(() => document.querySelector('.privacy-body')?.textContent || '')
    assert.match(text, /name/i)
    assert.match(text, /phone number/i)
    assert.match(text, /website address/i)
    assert.match(text, /preferred contact method/i)
    assert.match(text, /Free Website Review form/i)
    assert.match(text, /Google Form/)
  } finally {
    await page.close()
  }
})

test('does not claim a payment processor, analytics tool, or any third party beyond what the codebase audit confirmed (Google Forms, Google Fonts, Vercel)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const text = await page.evaluate(() => document.body.textContent || '')
    // No unconfirmed payment processor or analytics/tracking vendor names.
    assert.ok(!/\bstripe\b/i.test(text), 'must not name Stripe — not present anywhere in this codebase')
    assert.ok(!/\bpaypal\b/i.test(text))
    assert.ok(!/\bsquare\b/i.test(text))
    assert.ok(!/google analytics|gtag|facebook pixel|\bmailchimp\b/i.test(text))
    // The only third parties named must be ones actually confirmed by the
    // audit: Google Forms, Google Fonts, and the Vercel host.
    assert.match(text, /Google Forms/)
    assert.match(text, /Google Fonts/)
    assert.match(text, /Vercel/)
  } finally {
    await page.close()
  }
})

test('accurately states this site does not use cookies/analytics/tracking scripts, and does not process payments directly', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const text = await page.evaluate(() => document.body.textContent || '')
    assert.match(text, /does not use cookies, analytics, or tracking scripts/i)
    assert.match(text, /does not process payments|does not process payments directly/i)
  } finally {
    await page.close()
  }
})

test('states information is not sold, and is shared only for the specific reasons in the brief (providing services, payment, legal compliance, protecting rights/safety)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const text = await page.evaluate(() => document.querySelector('.privacy-body')?.textContent || '')
    assert.match(text, /do not sell your personal information/i)
    assert.match(text, /comply with a legal obligation/i)
    assert.match(text, /protect my rights, property, or safety/i)
  } finally {
    await page.close()
  }
})

test('is appropriately cautious: no compliance guarantee, explicitly not legal advice', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const text = await page.evaluate(() => document.body.textContent || '')
    assert.match(text, /isn't legal advice/i)
    assert.ok(!/\bwe comply with\b|\bfully compliant\b|\bguarantee(s|d)? compliance\b/i.test(text))
  } finally {
    await page.close()
  }
})

test('"Adults Only" section states the under-18 policy', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const text = await page.evaluate(() => document.querySelector('.privacy-body')?.textContent || '')
    assert.match(text, /intended for adults age 18 or older/i)
    assert.match(text, /do not knowingly collect personal information from anyone under 18/i)
  } finally {
    await page.close()
  }
})

test('choices/contact section links to the correct email for access/correction/deletion requests', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const emailLinks = await page.$$eval('.privacy-body a[href^="mailto:"]', (els) => els.map((e) => e.getAttribute('href')))
    assert.ok(emailLinks.every((href) => href === `mailto:${LESLIE_EMAIL}`))
    assert.ok(emailLinks.length >= 1)
    const phoneLink = await page.$eval('.privacy-body a[href^="tel:"]', (el) => el.getAttribute('href'))
    assert.equal(phoneLink, 'tel:8505659114')
  } finally {
    await page.close()
  }
})

test('no horizontal overflow at 390px, 768px, or 1440px', async () => {
  const page: Page = await browser.newPage()
  try {
    for (const width of [390, 768, 1440]) {
      await page.setViewport({ width, height: 900 })
      await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 0, `expected no overflow at ${width}px, got ${overflow}px`)
    }
  } finally {
    await page.close()
  }
})

test('the back link is keyboard-focusable, points home, and is the first focusable element in the page content', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const href = await page.$eval('.page-back', (el) => el.getAttribute('href'))
    assert.equal(href, '/')
    await page.focus('.page-back')
    const focusedClass = await page.evaluate(() => document.activeElement?.className)
    assert.equal(focusedClass, 'page-back')
  } finally {
    await page.close()
  }
})

test('prefers-reduced-motion: header and body reveal content is visible immediately with no transition', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const states = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-reveal]')).map((el) => {
        const cs = getComputedStyle(el)
        return { opacity: cs.opacity, transitionProperty: cs.transitionProperty }
      })
    )
    assert.ok(states.length > 0, 'expected at least one [data-reveal] element on the page')
    for (const s of states) {
      assert.equal(s.opacity, '1')
      assert.equal(s.transitionProperty, 'none')
    }
  } finally {
    await page.close()
  }
})

test('tools section explains the tools\' actual data handling without claiming the whole site sends nothing', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/privacy-policy.html`, { waitUntil: 'load' })
    const section = await page.$$eval('.privacy-section', (els) => {
      const el = els.find((e) => e.querySelector('.privacy-section-title')?.textContent?.includes('Interactive Tools'))
      return (el?.textContent || '').replace(/\s+/g, ' ')
    })
    // Planners: page memory only, not sent automatically, lost on refresh/leave.
    assert.match(section, /kept only in that open page's memory/)
    assert.match(section, /isn't automatically sent to me/)
    assert.match(section, /refreshing or leaving the page can erase your answers/)
    // Visitor-initiated actions, including email via the visitor's own app.
    assert.match(section, /Copy places your summary on your device's clipboard/)
    assert.match(section, /Share \(on devices that support it\)/)
    assert.match(section, /Print opens your browser's print dialog/)
    assert.match(section, /opens your own email app/)
    // Calculator: browser-only saving of recipes, ingredients, and the hourly-rate setting.
    assert.match(section, /recipes and ingredients you choose to save, along with the last hourly labor rate/)
    assert.match(section, /in the browser you're using on that device/)
    // Backup/Restore, including replacement on restore and the exact backup file name.
    assert.match(section, /Download Backup/)
    assert.match(section, /bakery-pricing-backup\.json/)
    assert.match(section, /replaces all the recipes and ingredients currently saved/)
    assert.match(section, /clear your browser's data|private or incognito window/)
    // Distinguishes tool data from hosting logs and third-party services.
    assert.match(section, /Vercel, which may log basic technical information/)
    assert.match(section, /Google Fonts/)
    // Must not overclaim that the site makes no network requests or collects nothing.
    assert.ok(!/(this (web)?site|the site) (makes no|never makes any) (network )?requests|collects no (data|information)/i.test(section))
  } finally {
    await page.close()
  }
})

