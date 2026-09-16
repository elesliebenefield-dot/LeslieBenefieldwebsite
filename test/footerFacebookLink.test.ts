// Tests for the shared footer's Facebook link.
//
// 2026-09-15: restored as a text link labeled "Facebook".
// 2026-09-16: corrected to a recognizable Facebook logo (white "f" on
// Facebook-blue) with an accessible name via aria-label, since the link no
// longer has visible text. Footer is a single shared component rendered on
// every page, so this checks it on two different pages (the homepage and
// /check) to confirm it's genuinely a sitewide change. Reuses the exact
// Facebook URL already present on the homepage's own Contact section,
// rather than inventing one.
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/footerFacebookLink.test.ts

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

const EXPECTED_FACEBOOK_URL = 'https://www.facebook.com/share/1EB3v8j1Fz/'
const EXPECTED_ACCESSIBLE_NAME = 'Websites by Leslie on Facebook'
const FACEBOOK_LINK_SELECTOR = '.footer .footer-link[aria-label="Websites by Leslie on Facebook"]'

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
    const urlPath = req.url === '/' ? '/index.html' : req.url || '/index.html'
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

test('the homepage\'s own Contact section Facebook link is the source of truth this test reuses', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const contactFacebookHref = await page.$eval('a[href*="facebook.com"]', (el) => el.getAttribute('href'))
    assert.equal(contactFacebookHref, EXPECTED_FACEBOOK_URL)
  } finally {
    await page.close()
  }
})

for (const [label, url] of [
  ['homepage', '/index.html'],
  ['/check', '/check.html'],
] as const) {
  test(`${label}: footer has a Facebook logo link, accessibly named, to the same Facebook URL used on the homepage`, async () => {
    const page: Page = await browser.newPage()
    try {
      await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' })
      const facebookLink = await page.$eval(FACEBOOK_LINK_SELECTOR, (el) => ({
        href: el.getAttribute('href'),
        ariaLabel: el.getAttribute('aria-label'),
        text: el.textContent?.trim(),
      }))
      assert.equal(facebookLink.href, EXPECTED_FACEBOOK_URL)
      assert.equal(facebookLink.ariaLabel, EXPECTED_ACCESSIBLE_NAME)
      // The logo itself is the link's content — no separate visible "Facebook" text.
      assert.equal(facebookLink.text, '')
    } finally {
      await page.close()
    }
  })
}

test('the browser computes the link\'s accessible name as "Websites by Leslie on Facebook" from aria-label', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const handle = await page.$(FACEBOOK_LINK_SELECTOR)
    assert.ok(handle, 'Facebook footer link should exist')
    const snapshot = await page.accessibility.snapshot({ root: handle! })
    assert.equal(snapshot?.name, EXPECTED_ACCESSIBLE_NAME)
  } finally {
    await page.close()
  }
})

test('the footer Facebook logo is a recognizable Facebook mark: white "f" on Facebook-blue background', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const glyph = await page.$eval(`${FACEBOOK_LINK_SELECTOR} svg`, (svg) => {
      const rect = svg.querySelector('rect')
      const path = svg.querySelector('path')
      return { rectFill: rect?.getAttribute('fill'), pathFill: path?.getAttribute('fill') }
    })
    assert.equal(glyph.rectFill, '#1877F2', 'background should be Facebook blue')
    assert.equal(glyph.pathFill, '#fff', 'the "f" glyph should be white')
  } finally {
    await page.close()
  }
})

test('the footer Facebook link opens in a new tab safely (target=_blank, rel=noopener noreferrer)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const attrs = await page.$eval(FACEBOOK_LINK_SELECTOR, (el) => ({
      target: el.getAttribute('target'),
      rel: el.getAttribute('rel'),
    }))
    assert.equal(attrs.target, '_blank')
    assert.match(attrs.rel || '', /noopener/)
    assert.match(attrs.rel || '', /noreferrer/)
  } finally {
    await page.close()
  }
})

test('the footer Facebook link is keyboard-focusable and matches the footer\'s existing scale and spacing', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const links = await page.$$('.footer .footer-link')
    const lastLink = links[links.length - 1]
    const ariaLabel = await lastLink.evaluate((el) => el.getAttribute('aria-label'))
    assert.equal(ariaLabel, EXPECTED_ACCESSIBLE_NAME, 'Facebook logo should be the last footer link, after Privacy Policy and Business Tools')

    await lastLink.focus()
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
    assert.equal(focused, EXPECTED_ACCESSIBLE_NAME)

    // Icon sized to sit comfortably within the footer's existing link row,
    // aligned with the text links' scale rather than dominating it.
    const [iconBox, textLinkBox] = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.footer .footer-link'))
      return els.map((el) => {
        const rect = el.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      })
    }).then((boxes) => [boxes[boxes.length - 1], boxes[0]])
    assert.ok(iconBox.height > 0 && iconBox.height <= 24, 'icon should be modestly sized, not oversized')
    assert.ok(
      Math.abs(iconBox.height - textLinkBox.height) <= 12,
      'icon height should be visually comparable to the adjacent text links\' height'
    )

    // Gap between footer links (flex row) is untouched — icon is just another flex item.
    const gap = await page.$eval('.footer-links', (el) => getComputedStyle(el).gap)
    assert.equal(gap, '20px') // 1.25rem at default 16px root
  } finally {
    await page.close()
  }
})

test('the Facebook logo does not disturb the existing footer content (Privacy Policy, Business Tools, phone, email, faith statement, payment icons all still present)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const links = await page.$$eval('.footer .footer-link', (els) =>
      els.map((el) => ({ text: el.textContent?.trim(), ariaLabel: el.getAttribute('aria-label') }))
    )
    assert.deepEqual(
      links.map((l) => l.text || l.ariaLabel),
      ['Privacy Policy', 'Business Tools', EXPECTED_ACCESSIBLE_NAME]
    )

    const faith = await page.$eval('.footer-faith', (el) => el.textContent?.trim())
    assert.equal(faith, 'Jesus loves you. — John 3:16')
    const contact = await page.$eval('.footer-contact', (el) => el.textContent || '')
    assert.match(contact, /850-565-9114/)
    assert.match(contact, /websitesbyleslie01@gmail\.com/)
    const paymentIconCount = await page.$$eval('.pay-icon img', (els) => els.length)
    assert.equal(paymentIconCount, 6)
  } finally {
    await page.close()
  }
})
