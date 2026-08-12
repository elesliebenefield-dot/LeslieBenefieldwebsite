// Free Website Review page — real-browser tests for the client-only
// request form that replaced the automated checker. There is no backend
// for this feature (no api/ route): required-field validation is purely
// client-side, and "delivery" is a mailto: link the visitor's own email
// client opens — matching the site's only other established lead-capture
// pattern (Contact.tsx's "Email Me" button). These tests verify:
//   - required vs. optional fields, and inline/summary error states
//   - the always-visible copyable fallback (name/business/website/email/
//     message) that appears alongside the honest, non-overclaiming
//     confirmation message after a valid submission — this is what
//     actually survives navigating to an unhandled mailto: link in a
//     headless/sandboxed browser with no mail client configured, so it's
//     the correct thing to assert against rather than trying to intercept
//     the OS-level mailto handoff itself
//   - accessibility: focus moves to the error summary or confirmation,
//     aria-invalid/aria-describedby wiring
//
// Runs against the real production build (dist/, always rebuilt fresh) in
// a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/reviewPage.test.ts

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

let browser: Browser
let server: Server
let baseUrl: string

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
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

async function fillField(page: Page, id: string, value: string) {
  if (!value) return
  await page.type(`#${id}`, value)
}

test('the page renders the specified copy, all five fields, and the submit button', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })

    const h1 = await page.$eval('h1.section-title', (el) => el.textContent)
    assert.equal(h1, 'Free Website Review')

    const bodyText = await page.evaluate(() => document.body.textContent || '')
    assert.match(bodyText, /Send me your website and I'll take a real, personal look at the basics/)
    assert.match(bodyText, /I'll let you know whether your website may be a good fit for my services/)
    assert.match(bodyText, /No pressure, and no automatic score or promise that every issue can be fixed/)

    for (const id of ['review-name', 'review-business', 'review-url', 'review-email', 'review-message']) {
      assert.ok(await page.$(`#${id}`), `expected field #${id} to exist`)
    }

    const buttonText = await page.$eval('.review-submit', (el) => el.textContent)
    assert.equal(buttonText, 'Open My Email to Request a Free Review')

    // Never render anything that looks like an automated score/results tool.
    assert.ok(!/technical basics|checkup-score|automated finding/i.test(bodyText))
  } finally {
    await page.close()
  }
})

test('submitting with all required fields empty shows the error summary and all three inline errors, without opening anything', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await page.click('.review-submit')

    const summary = await page.$eval('.review-error-summary', (el) => el.textContent)
    assert.match(summary!, /Please fix the highlighted fields below/)

    assert.equal(await page.$eval('#review-name', (el) => el.getAttribute('aria-invalid')), 'true')
    assert.equal(await page.$eval('#review-url', (el) => el.getAttribute('aria-invalid')), 'true')
    assert.equal(await page.$eval('#review-email', (el) => el.getAttribute('aria-invalid')), 'true')

    assert.match(await page.$eval('#review-name-error', (el) => el.textContent!), /Please enter your name/)
    assert.match(await page.$eval('#review-url-error', (el) => el.textContent!), /Please enter your website address/)
    assert.match(await page.$eval('#review-email-error', (el) => el.textContent!), /Please enter your email address/)

    // Focus should move to the error summary so screen-reader users hear it.
    const activeId = await page.evaluate(() => document.activeElement?.className)
    assert.equal(activeId, 'review-error-summary')

    // The form must still be showing — no confirmation, no navigation attempt.
    assert.ok(await page.$('.review-form'))
    assert.ok(!(await page.$('.review-confirmation')))
  } finally {
    await page.close()
  }
})

test('an obviously malformed email is rejected with a specific message, independent of the other required fields', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await fillField(page, 'review-name', 'Jamie Rivera')
    await fillField(page, 'review-url', 'jamies-bakery.com')
    await fillField(page, 'review-email', 'not-an-email')
    await page.click('.review-submit')

    assert.equal(await page.$eval('#review-email', (el) => el.getAttribute('aria-invalid')), 'true')
    assert.match(await page.$eval('#review-email-error', (el) => el.textContent!), /doesn't look like a valid email address/)
    assert.equal(await page.$eval('#review-name', (el) => el.getAttribute('aria-invalid')), 'false')
    assert.equal(await page.$eval('#review-url', (el) => el.getAttribute('aria-invalid')), 'false')
  } finally {
    await page.close()
  }
})

test('business name and the help-with message are genuinely optional: a valid submission without them succeeds', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await fillField(page, 'review-name', 'Priya Nair')
    await fillField(page, 'review-url', 'nairconsulting.com')
    await fillField(page, 'review-email', 'priya@nairconsulting.com')
    await page.click('.review-submit')
    await page.waitForSelector('.review-confirmation', { timeout: 5000 })

    const fallbackText = await page.$eval('.review-fallback-text', (el) => el.textContent || '')
    assert.match(fallbackText, /Name: Priya Nair/)
    assert.match(fallbackText, /Website address: nairconsulting\.com/)
    assert.match(fallbackText, /Reply email: priya@nairconsulting\.com/)
    assert.match(fallbackText, /Not specified/)
    assert.ok(!/Business name:/.test(fallbackText), 'must not print a Business name line when none was given')
  } finally {
    await page.close()
  }
})

test('a fully filled-out valid submission shows the honest confirmation message and a fallback block with every field', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await fillField(page, 'review-name', 'Tomás García')
    await fillField(page, 'review-business', "García's Auto Repair")
    await fillField(page, 'review-url', 'garciasautorepair.com')
    await fillField(page, 'review-email', 'tomas@garciasautorepair.com')
    await fillField(page, 'review-message', 'Not sure my site works well on phones.')
    await page.click('.review-submit')
    await page.waitForSelector('.review-confirmation', { timeout: 5000 })

    const lead = await page.$eval('.review-confirmation-lead', (el) => el.textContent)
    assert.equal(lead, 'Your email app should now be open with your request filled in. Please review it and click Send.')
    // Must never claim the request was already sent/delivered automatically.
    const confirmationText = await page.$eval('.review-confirmation', (el) => el.textContent || '')
    assert.ok(!/has been sent|was sent|delivered|submitted successfully/i.test(confirmationText))

    const fallbackEmailHref = await page.$eval('.review-fallback-email a', (el) => el.getAttribute('href'))
    assert.equal(fallbackEmailHref, 'mailto:websitesbyleslie01@gmail.com')

    const fallbackText = await page.$eval('.review-fallback-text', (el) => el.textContent || '')
    assert.match(fallbackText, /Name: Tomás García/)
    assert.match(fallbackText, /Business name: García's Auto Repair/)
    assert.match(fallbackText, /Website address: garciasautorepair\.com/)
    assert.match(fallbackText, /Reply email: tomas@garciasautorepair\.com/)
    assert.match(fallbackText, /Not sure my site works well on phones\./)

    // Page must still be on /check — a mailto: href assignment must never
    // navigate the visitor away from the confirmation they need to see.
    assert.ok(page.url().includes('/check.html'))

    // Focus should move to the confirmation for screen-reader users.
    const activeClass = await page.evaluate(() => document.activeElement?.className)
    assert.equal(activeClass, 'review-confirmation')
  } finally {
    await page.close()
  }
})

test('the copy button attempts to copy the fallback text and never crashes the page, even if clipboard access is unavailable', async () => {
  // Headless/sandboxed environments frequently have no OS clipboard
  // available at all regardless of permission grants — this asserts the
  // component's own graceful handling (try/catch around
  // navigator.clipboard.writeText, see ReviewPage.tsx) rather than
  // depending on a real clipboard actually being reachable in CI.
  const page: Page = await browser.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await fillField(page, 'review-name', 'Dana Okafor')
    await fillField(page, 'review-url', 'okaforstudio.com')
    await fillField(page, 'review-email', 'dana@okaforstudio.com')
    await page.click('.review-submit')
    await page.waitForSelector('.review-confirmation', { timeout: 5000 })

    await page.click('.review-copy-btn')
    // Give the async clipboard attempt (success or failure) a moment to
    // resolve, then confirm the page is still intact either way.
    await new Promise((r) => setTimeout(r, 300))
    assert.deepEqual(pageErrors, [])
    assert.ok(await page.$('.review-copy-btn'), 'the copy button must still be present and unbroken')
  } finally {
    await page.close()
  }
})

test('"Start over" returns to a blank form', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    await fillField(page, 'review-name', 'Sam Lee')
    await fillField(page, 'review-url', 'samleedesign.com')
    await fillField(page, 'review-email', 'sam@samleedesign.com')
    await page.click('.review-submit')
    await page.waitForSelector('.review-confirmation', { timeout: 5000 })

    await page.click('.review-start-over')
    await page.waitForSelector('.review-form', { timeout: 5000 })
    assert.equal(await page.$eval('#review-name', (el) => (el as HTMLInputElement).value), '')
  } finally {
    await page.close()
  }
})

test('desktop (1280px) and mobile (390px) layouts have no horizontal overflow', async () => {
  for (const width of [390, 1280]) {
    const page: Page = await browser.newPage()
    try {
      await page.setViewport({ width, height: 900 })
      await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 0, `expected no horizontal overflow at ${width}px, got ${overflow}px`)
    } finally {
      await page.close()
    }
  }
})
