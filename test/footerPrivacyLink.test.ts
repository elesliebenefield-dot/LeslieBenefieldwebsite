// Tests for the "Privacy Policy" footer link — Footer is a single shared
// component rendered on every page, so this checks it on two different
// pages (the homepage and /check) to confirm it's genuinely a sitewide
// change and not something scoped to a single page. Also confirms the
// pre-existing .footer-links/.footer-link CSS (previously unused in
// Footer.tsx) renders correctly and is keyboard-reachable.
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/footerPrivacyLink.test.ts

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

for (const [label, url] of [
  ['homepage', '/index.html'],
  ['/check', '/check.html'],
] as const) {
  test(`${label}: footer has a clearly labeled "Privacy Policy" link to /privacy-policy`, async () => {
    const page: Page = await browser.newPage()
    try {
      await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' })
      const link = await page.$eval('.footer .footer-link', (el) => ({
        text: el.textContent?.trim(),
        href: el.getAttribute('href'),
      }))
      assert.equal(link.text, 'Privacy Policy')
      assert.equal(link.href, '/privacy-policy')
    } finally {
      await page.close()
    }
  })
}

test('the footer link is keyboard-focusable', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    await page.focus('.footer .footer-link')
    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent?.trim(),
    }))
    assert.equal(focused.tag, 'A')
    assert.equal(focused.text, 'Privacy Policy')
  } finally {
    await page.close()
  }
})

test('the link does not disturb the existing footer content (copyright line, contact info, payment icons all still present)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const copyright = await page.$eval('.footer-text', (el) => el.textContent?.trim())
    const contact = await page.$eval('.footer-contact', (el) => el.textContent || '')
    const paymentIconCount = await page.$$eval('.pay-icon img', (els) => els.length)
    assert.equal(copyright, 'Designed & Developed by Leslie © 2026')
    assert.match(contact, /850-565-9114/)
    assert.match(contact, /websitesbyleslie01@gmail\.com/)
    assert.equal(paymentIconCount, 6)
  } finally {
    await page.close()
  }
})
