// Real-browser integration tests for the M7 information-architecture
// correction: a single "Business Tools" hub replaces the old
// industry-specific "Real Estate Tools" footer link, discoverable from the
// main nav, the homepage's featured-tool callout, the footer, and a new
// distinct free-tools section on /services — without placing every
// individual article or calculator route directly in the nav or footer.
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/businessToolsHub.test.ts

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

test('the desktop nav has exactly one "Tools" link, pointing to /business-tools, and no other bakery/article route', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 1500, height: 900 })
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const hrefs = await page.$$eval('.nav-links a[href]', els => els.map(e => ({ text: e.textContent?.trim(), href: e.getAttribute('href') })))
    const toolsLinks = hrefs.filter(h => h.href === '/business-tools')
    assert.equal(toolsLinks.length, 1, 'desktop nav should have exactly one link to /business-tools')
    assert.equal(toolsLinks[0].text, 'Tools')
    assert.ok(!hrefs.some(h => (h.href || '').includes('bakery')), 'desktop nav must not link any bakery-specific route directly')
    assert.ok(!hrefs.some(h => h.href === '/real-estate-tools'), 'desktop nav must not link /real-estate-tools directly')
  } finally {
    await page.close()
  }
})

test('the mobile nav\'s "Tools & Resources" group has exactly one "View all Business Tools" link, pointing to /business-tools (2026-09-15 mobile-menu redesign)', async () => {
  // Superseded by the mobile-menu redesign: "Business Tools" is no longer
  // a flat top-level link — it's the "View all Business Tools →" entry
  // inside the collapsible "Tools & Resources" group. See
  // test/navMobileMenu.test.ts for the full grouped-menu test coverage.
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    await page.click('.nav-hamburger')
    const toggles = await page.$$('.nav-mobile-group-toggle')
    for (const toggle of toggles) {
      const label = await toggle.$eval('span', el => el.textContent?.trim())
      if (label === 'Tools & Resources') await toggle.click()
    }
    const hrefs = await page.$$eval('.nav-mobile a[href]', els => els.map(e => ({ text: e.textContent?.trim(), href: e.getAttribute('href') })))
    const toolsLinks = hrefs.filter(h => h.href === '/business-tools')
    assert.equal(toolsLinks.length, 1, 'mobile nav should have exactly one link to /business-tools')
    assert.equal(toolsLinks[0].text, 'View all Business Tools →')
  } finally {
    await page.close()
  }
})

for (const [label, url] of [
  ['homepage', '/index.html'],
  ['/check', '/check.html'],
] as const) {
  test(`${label}: footer's "Business Tools" link replaces the old "Real Estate Tools" link`, async () => {
    const page: Page = await browser.newPage()
    try {
      await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' })
      const hrefs = await page.$$eval('.footer-links a[href]', els => els.map(e => ({ text: e.textContent?.trim(), href: e.getAttribute('href') })))
      assert.ok(hrefs.some(h => h.href === '/business-tools' && h.text === 'Business Tools'), `${label} footer should have a "Business Tools" link to /business-tools`)
      assert.ok(!hrefs.some(h => h.href === '/real-estate-tools'), `${label} footer must no longer link /real-estate-tools directly`)
      assert.ok(!hrefs.some(h => (h.text || '').includes('Real Estate')), `${label} footer must not say "Real Estate Tools" anymore`)
    } finally {
      await page.close()
    }
  })
}

test('the homepage featured-tool callout points to /business-tools, not directly to any one tool', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const link = await page.$eval('.tools-callout-link', el => ({
      text: el.textContent?.trim(),
      href: el.getAttribute('href'),
    }))
    assert.equal(link.href, '/business-tools')
    const calloutText = await page.$eval('.tools-callout-text', el => el.textContent || '')
    assert.doesNotMatch(calloutText, /six interactive real estate planning tools/i, 'the callout copy should no longer describe the set as only real estate tools')
    assert.match(calloutText, /baker/i, 'the callout copy should reflect the broader multi-industry tool set, including bakers')
  } finally {
    await page.close()
  }
})

test('the Business Tools hub loads, is indexable (2026-09-15 final publication), and accurately distinguishes the one free tool from every live demo', async () => {
  const page: Page = await browser.newPage()
  const errors: string[] = []
  page.on('pageerror', err => errors.push(String(err)))
  try {
    await page.goto(`${baseUrl}/business-tools.html`, { waitUntil: 'load' })
    assert.deepEqual(errors, [])

    const robotsEl = await page.$('meta[name="robots"]')
    const robots = robotsEl ? await page.$eval('meta[name="robots"]', el => (el as HTMLMetaElement).content) : null
    assert.ok(!robots || !robots.includes('noindex'), `expected no noindex directive, got: "${robots}"`)

    const tags = await page.$$eval('.bt-tool-tag', els => els.map(e => e.textContent?.trim()))
    assert.ok(tags.includes('Free Tool'), 'the hub should mark the bakery calculator as a Free Tool')
    assert.ok(tags.filter(t => t === 'Live Demo').length >= 4, 'the hub should mark the other four confirmed tools as Live Demo')

    const hrefs = await page.$$eval('.bt-tool-link', els => els.map(e => e.getAttribute('href')))
    for (const route of ['/bakery-pricing-guide', '/tools-custom-bakery-order', '/tools-plumbing-visit', '/tools-food-truck-event', '/real-estate-tools']) {
      assert.ok(hrefs.includes(route), `the hub should link ${route}`)
    }
  } finally {
    await page.close()
  }
})

test('the hub hero has an opaque backing behind its text, consistent with the .faq-inner/.rts-hero-card pattern used elsewhere over the same photo background (2026-09-15 readability fix)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/business-tools.html`, { waitUntil: 'load' })
    const style = await page.$eval('.bt-hero-inner', (el) => {
      const s = getComputedStyle(el)
      return { backgroundColor: s.backgroundColor, backdropFilter: s.backdropFilter || (s as any).webkitBackdropFilter }
    })
    const match = style.backgroundColor.match(/rgba?\(([^)]+)\)/)
    assert.ok(match, `expected an rgb(a) background-color on .bt-hero-inner, got "${style.backgroundColor}"`)
    const parts = match![1].split(',').map((n) => parseFloat(n.trim()))
    const alpha = parts.length === 4 ? parts[3] : 1
    assert.ok(alpha >= 0.8, `.bt-hero-inner background must be sufficiently opaque (>= 0.8 alpha) so readability doesn't depend on the photo behind it — got alpha ${alpha}`)
    assert.ok(style.backdropFilter && style.backdropFilter !== 'none', '.bt-hero-inner should also blur the photo behind it, matching the site\'s established hero-over-photo pattern')
  } finally {
    await page.close()
  }
})

test('the bakery-pricing landing page still links the calculator (the four educational articles were removed 2026-09-15 — Websites by Leslie is not presenting itself as a source of bakery-pricing advice)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/bakery-pricing-guide.html`, { waitUntil: 'load' })
    const hrefs = await page.$$eval('a[href]', els => els.map(e => e.getAttribute('href') || ''))
    assert.ok(hrefs.includes('/tools-bakery-pricing'))
    for (const removedArticle of ['/bakery-pricing-for-profit', '/bakery-food-cost-vs-margin', '/bakery-labor-cost', '/bakery-packaging-waste-overhead']) {
      assert.ok(!hrefs.includes(removedArticle), `landing page must no longer link the removed article ${removedArticle}`)
    }
  } finally {
    await page.close()
  }
})

test('no horizontal overflow at 320px or 375px on the Business Tools hub', async () => {
  const page: Page = await browser.newPage()
  try {
    for (const width of [320, 375]) {
      await page.setViewport({ width, height: 900 })
      await page.goto(`${baseUrl}/business-tools.html`, { waitUntil: 'load' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      assert.equal(overflow, false, `hub overflows at ${width}px`)
    }
  } finally {
    await page.close()
  }
})

test('the hub\'s tool links meet the 44px touch-target minimum', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 375, height: 900 })
    await page.goto(`${baseUrl}/business-tools.html`, { waitUntil: 'load' })
    const heights = await page.$$eval('.bt-tool-link', els => els.map(e => e.getBoundingClientRect().height))
    for (const h of heights) {
      assert.ok(h >= 44, `expected all .bt-tool-link heights >= 44px, got ${h}`)
    }
  } finally {
    await page.close()
  }
})
