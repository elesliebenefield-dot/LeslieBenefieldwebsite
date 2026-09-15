// Tests for the "Facebook" footer link (2026-09-15 post-launch restoration)
// — Footer is a single shared component rendered on every page, so this
// checks it on two different pages (the homepage and /check) to confirm
// it's genuinely a sitewide change. Reuses the exact Facebook URL already
// present on the homepage's own Contact section, rather than inventing one.
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
  test(`${label}: footer has a clearly labeled "Facebook" link to the same Facebook URL used on the homepage`, async () => {
    const page: Page = await browser.newPage()
    try {
      await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' })
      const links = await page.$$eval('.footer .footer-link', (els) =>
        els.map((el) => ({ text: el.textContent?.trim(), href: el.getAttribute('href') }))
      )
      const facebookLink = links.find((l) => l.text === 'Facebook')
      assert.ok(facebookLink, `${label} footer should have a link labeled "Facebook"`)
      assert.equal(facebookLink!.href, EXPECTED_FACEBOOK_URL)
    } finally {
      await page.close()
    }
  })
}

test('the footer Facebook link opens in a new tab safely (target=_blank, rel=noopener noreferrer)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const attrs = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.footer .footer-link'))
      const fb = links.find((l) => l.textContent?.trim() === 'Facebook')
      return fb ? { target: fb.getAttribute('target'), rel: fb.getAttribute('rel') } : null
    })
    assert.ok(attrs, 'Facebook footer link should exist')
    assert.equal(attrs!.target, '_blank')
    assert.match(attrs!.rel || '', /noopener/)
    assert.match(attrs!.rel || '', /noreferrer/)
  } finally {
    await page.close()
  }
})

test('the footer Facebook link is keyboard-focusable and matches the existing footer-link typography', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const links = await page.$$('.footer .footer-link')
    const lastLink = links[links.length - 1]
    const text = await lastLink.evaluate((el) => el.textContent?.trim())
    assert.equal(text, 'Facebook', 'Facebook should be the last footer link, after Privacy Policy and Business Tools')

    await lastLink.focus()
    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent?.trim(),
    }))
    assert.equal(focused.tag, 'A')
    assert.equal(focused.text, 'Facebook')

    // Same class as every other footer link — no bespoke styling introduced.
    const [privacyFont, facebookFont] = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.footer .footer-link'))
      return els.map((el) => {
        const cs = getComputedStyle(el)
        return `${cs.fontSize}|${cs.fontWeight}|${cs.color}`
      })
    })
    assert.equal(facebookFont, privacyFont, 'Facebook link should match the existing footer-link typography exactly')
  } finally {
    await page.close()
  }
})

test('the Facebook link does not disturb the existing footer content (Privacy Policy, Business Tools, phone, email, faith statement, payment icons all still present)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const linkTexts = await page.$$eval('.footer .footer-link', (els) => els.map((el) => el.textContent?.trim()))
    assert.deepEqual(linkTexts, ['Privacy Policy', 'Business Tools', 'Facebook'])

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
