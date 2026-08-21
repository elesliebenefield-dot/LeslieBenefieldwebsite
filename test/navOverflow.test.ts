// Regression tests for the /check tablet/intermediate-width horizontal
// overflow bug: the shared Nav component's full desktop row (logo + N links
// + contact button) needs to lay out without crowding, but the
// hamburger-menu breakpoint was 768px — leaving a window where
// the full row rendered and overflowed the viewport. Fixed by raising that
// one breakpoint (see src/index.css) so the hamburger stays active
// until the full row genuinely fits.
//
// The breakpoint value has moved three times as links were added: 768px ->
// 960px (6 links, ~950px natural width) -> 1080px (7 links, after adding
// "Services & Pricing", ~1055px natural width) -> 1400px (8 links, after
// adding "FAQ" and "Website Checklist", ~1260px natural width). Each time,
// this file's boundary-specific test and sweep values were re-measured and
// updated to match — see the current @media (max-width: 1400px) block
// in src/index.css.
//
// This test only ever exercised the shared Nav component and page-level
// layout via /check.html as a rendering host — nothing checker-specific —
// so it survived the checker's removal unchanged (renamed from
// checkPage.overflow.test.ts to drop the retired-component name).
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/navOverflow.test.ts

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
  // Always rebuild — never trust whatever happens to already be in dist/,
  // since a stale build would silently test old source, not the fix under
  // review.
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
    // Sweeps from the narrow end up through desktop widths, including all
    // former breakpoint boundaries (960/961px, 1080/1081px) now safely
    // inside hamburger territory, and the current 1400/1401px breakpoint
    // boundary, so a regression anywhere near any of them is caught.
    const widths = [340, 400, 500, 600, 700, 768, 769, 780, 800, 820, 850, 880, 900, 920, 940, 960, 961, 1000, 1024, 1055, 1079, 1080, 1081, 1082, 1100, 1200, 1260, 1300, 1399, 1400, 1401, 1402, 1440]
    for (const width of widths) {
      const overflow = await overflowAt(page, width)
      assert.ok(overflow <= 0, `expected no overflow at ${width}px, got ${overflow}px`)
    }
  } finally {
    await page.close()
  }
})

test('/check has no horizontal overflow at 320px (narrowest common real device width) or anywhere in the 300-340px boundary region', async () => {
  const page: Page = await browser.newPage()
  try {
    // A second, separate overflow bug was found here: the collapsed row's
    // fixed-size logo + hamburger button, plus standard padding/gap, need
    // 337px minimum — a few pixels more than 320px provides. Fixed via a
    // narrow-width-only media query (see src/index.css) that only applies
    // below 337px. 320px (the narrowest common real device width) is the
    // specifically-required floor for this fix; this sweeps it plus its
    // surrounding boundary up to 340px to catch any regression nearby.
    const widths = [320, 321, 325, 330, 336, 337, 338, 340]
    for (const width of widths) {
      const overflow = await overflowAt(page, width)
      assert.ok(overflow <= 0, `expected no overflow at ${width}px, got ${overflow}px`)
    }
  } finally {
    await page.close()
  }
})

test('/check specifically at the new nav breakpoint boundary (1400/1401px) has no overflow on either side', async () => {
  const page: Page = await browser.newPage()
  try {
    for (const width of [1398, 1399, 1400, 1401, 1402, 1403]) {
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
