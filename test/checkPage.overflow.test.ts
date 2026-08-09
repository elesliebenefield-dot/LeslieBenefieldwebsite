// Regression tests for the /check tablet/intermediate-width horizontal
// overflow bug: the shared Nav component's full desktop row (logo + 6 links
// + contact button) needed ~950px to lay out without crowding, but the
// hamburger-menu breakpoint was 768px — leaving a 769-949px window where
// the full row rendered and overflowed the viewport. Fixed by raising that
// one breakpoint to 960px (see src/index.css) so the hamburger stays active
// until the full row genuinely fits.
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/checkPage.overflow.test.ts

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
  // Always rebuild — never trust whatever happens to already be in dist/
  // (see test/checkPage.raceCondition.test.ts for why this matters: a stale
  // build would silently test old source, not the fix under review).
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
    const urlPath = req.url === '/' ? '/check.html' : req.url || '/check.html'
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

async function overflowAt(page: Page, width: number): Promise<number> {
  await page.setViewport({ width, height: 900 })
  await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

test('/check has no horizontal overflow anywhere across the affected intermediate-width range (340px-1440px)', async () => {
  const page: Page = await browser.newPage()
  try {
    // The originally-affected range was empirically found to be exactly
    // 769-949px (scrollWidth pinned at 950px throughout); this sweeps a
    // superset of that with a 20px step, plus the exact former boundary
    // values, so a regression anywhere in or near that window is caught.
    const widths = [340, 400, 500, 600, 700, 768, 769, 780, 800, 820, 850, 880, 900, 920, 940, 949, 950, 960, 961, 1000, 1024, 1200, 1440]
    for (const width of widths) {
      const overflow = await overflowAt(page, width)
      assert.ok(overflow <= 0, `expected no overflow at ${width}px, got ${overflow}px`)
    }
  } finally {
    await page.close()
  }
})

test('/check specifically at the new nav breakpoint boundary (960/961px) has no overflow on either side', async () => {
  const page: Page = await browser.newPage()
  try {
    for (const width of [958, 959, 960, 961, 962, 963]) {
      const overflow = await overflowAt(page, width)
      assert.ok(overflow <= 0, `expected no overflow at ${width}px, got ${overflow}px`)
    }
  } finally {
    await page.close()
  }
})

test('/check at a genuinely mobile width still shows the hamburger menu, not the full nav row (unchanged mobile behavior)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    const state = await page.evaluate(() => {
      const links = document.querySelector('.nav-links')
      const hamburger = document.querySelector('.nav-hamburger')
      return {
        linksDisplay: links ? getComputedStyle(links).display : null,
        hamburgerDisplay: hamburger ? getComputedStyle(hamburger).display : null,
      }
    })
    assert.equal(state.linksDisplay, 'none')
    assert.equal(state.hamburgerDisplay, 'flex')
  } finally {
    await page.close()
  }
})

test('/check at a genuinely desktop width still shows the full nav row, not the hamburger (unchanged desktop behavior)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${baseUrl}/check.html`, { waitUntil: 'load' })
    const state = await page.evaluate(() => {
      const links = document.querySelector('.nav-links')
      const contactBtn = document.querySelector('.nav-contact-btn')
      const hamburger = document.querySelector('.nav-hamburger')
      return {
        linksDisplay: links ? getComputedStyle(links).display : null,
        contactBtnDisplay: contactBtn ? getComputedStyle(contactBtn).display : null,
        hamburgerDisplay: hamburger ? getComputedStyle(hamburger).display : null,
      }
    })
    assert.equal(state.linksDisplay, 'flex')
    // CSS sets display:inline-block, but as a flex item it's "blockified" to
    // block per the CSS Display spec — that's the correct, unrelated-to-this-
    // fix browser behavior; the thing this test actually cares about is that
    // it's rendered at all (not display:none, as it is below the breakpoint).
    assert.notEqual(state.contactBtnDisplay, 'none')
    assert.equal(state.hamburgerDisplay, 'none')
  } finally {
    await page.close()
  }
})
