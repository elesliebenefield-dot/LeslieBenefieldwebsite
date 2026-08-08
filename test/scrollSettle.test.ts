// Verifies scrollThroughPageAndSettle actually waits for the page's scroll
// position to settle back at the top before resolving, on a page that uses
// `scroll-behavior: smooth` — the exact condition that previously caused the
// checker's overlap/clipping detection to fire on content that was only ever
// mid-animation, never actually obstructed.
//
// Run with: node --test test/scrollSettle.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { scrollThroughPageAndSettle } from '../src/lib/scrollSettle.ts'

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let browser: Browser

before(async () => {
  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
})

// Tall enough that the function's own down-scroll loop can't reach the bottom
// in a single step, and that a smooth scrollTo(0, 0) genuinely takes real time
// to animate back — a fixed short delay would not reliably catch up to it.
const TALL_SMOOTH_SCROLL_PAGE = `
  <!doctype html>
  <html style="scroll-behavior: smooth;">
  <head><style>
    body { margin: 0; }
    .filler { height: 20000px; background: linear-gradient(#eee, #ccc); }
  </style></head>
  <body><div class="filler"></div></body>
  </html>
`

test('resolves only once the page has actually scrolled back to the top', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 390, height: 844 })
    await page.setContent(TALL_SMOOTH_SCROLL_PAGE, { waitUntil: 'load' })

    await scrollThroughPageAndSettle(page)

    const scrollY = await page.evaluate(() => window.scrollY)
    assert.equal(scrollY, 0, `expected scrollY to be settled at 0, got ${scrollY}`)
  } finally {
    await page.close()
  }
})

test('restores the page\'s original scroll-behavior afterward', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 390, height: 844 })
    await page.setContent(TALL_SMOOTH_SCROLL_PAGE, { waitUntil: 'load' })

    await scrollThroughPageAndSettle(page)

    const inlineScrollBehavior = await page.evaluate(() => document.documentElement.style.scrollBehavior)
    // No lingering inline override — whatever was there before (nothing, in
    // this fixture's case, since 'smooth' is set via the style attribute
    // directly on <html> rather than a stylesheet) is back.
    assert.equal(inlineScrollBehavior, 'smooth')
  } finally {
    await page.close()
  }
})

test('takes real time to settle rather than resolving immediately', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 390, height: 844 })
    await page.setContent(TALL_SMOOTH_SCROLL_PAGE, { waitUntil: 'load' })

    const start = Date.now()
    await scrollThroughPageAndSettle(page)
    const elapsed = Date.now() - start

    // The down-scroll loop alone (12 steps x 250ms) takes ~3s on a page this
    // tall; a stub/no-op implementation would return almost instantly.
    assert.ok(elapsed > 2000, `expected settling to take real time, took ${elapsed}ms`)
  } finally {
    await page.close()
  }
})

test('on a page without smooth scrolling, still settles at the top', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 1024, height: 768 })
    await page.setContent(`
      <!doctype html>
      <html><head><style>body{margin:0} .filler{height:6000px}</style></head>
      <body><div class="filler"></div></body></html>
    `, { waitUntil: 'load' })

    await scrollThroughPageAndSettle(page)

    const scrollY = await page.evaluate(() => window.scrollY)
    assert.equal(scrollY, 0)
  } finally {
    await page.close()
  }
})
