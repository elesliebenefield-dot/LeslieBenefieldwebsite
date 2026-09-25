// Real-browser integration tests for the 2026-09-15 mobile-menu redesign:
// the flat 10-link .nav-mobile list became a compact table of contents —
// Home stays a direct link, everything else is grouped into four
// independently-collapsible sections (Services; Work & About; Tools &
// Resources; Help & Contact), collapsed by default, mirroring the /faq
// accordion's established button+aria-expanded/aria-controls pattern.
// The desktop nav (.nav-links) is unaffected by this change.
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/navMobileMenu.test.ts

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

const EXPECTED_GROUPS = [
  {
    label: 'Services',
    items: [
      { text: 'Services & Pricing', href: '/services' },
      { text: 'Process', href: '/services#process' },
    ],
  },
  {
    label: 'Work & About',
    items: [
      { text: 'Portfolio', href: '#work' },
      { text: 'About', href: '#about' },
    ],
  },
  {
    label: 'Tools & Resources',
    items: [
      { text: 'View all Business Tools →', href: '/business-tools' },
      { text: 'Free Bakery Pricing Calculator', href: '/bakery-pricing-guide' },
      { text: 'Custom Bakery Order Planner', href: '/tools-custom-bakery-order' },
      { text: 'Plumbing Service Visit Planner', href: '/tools-plumbing-visit' },
      { text: 'Food Truck Event Planner', href: '/tools-food-truck-event' },
      { text: 'Real Estate Client Tools', href: '/real-estate-tools' },
      { text: 'Website Checklist', href: '/website-checklist' },
      { text: 'Free Website Review', href: '/check' },
    ],
  },
  {
    label: 'Help & Contact',
    items: [
      { text: 'FAQ', href: '/faq' },
      { text: 'Contact', href: '#contact' },
    ],
  },
]

async function openMenu(page: Page, path = '/index.html') {
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'load' })
  await page.click('.nav-hamburger')
}

// On an interior page (variant="page"), Nav's sectionHref() prefixes
// in-page anchors with "/" so they route back to the homepage's section
// instead of trying to scroll a section that doesn't exist on this page.
// Real page routes (not anchors) are identical on every page regardless
// of variant.
const EXPECTED_GROUPS_INTERIOR = EXPECTED_GROUPS.map((group) => ({
  label: group.label,
  items: group.items.map((item) => ({
    text: item.text,
    href: item.href.startsWith('#') ? `/${item.href}` : item.href,
  })),
}))

test('the mobile menu has Home as a direct link, four group toggles, and the Get a Quote CTA — all collapsed by default', async () => {
  const page: Page = await browser.newPage()
  try {
    await openMenu(page)

    const homeHref = await page.$eval('.nav-mobile > .nav-mobile-link', (el) => el.getAttribute('href'))
    assert.equal(homeHref, '#hero')

    const groupLabels = await page.$$eval('.nav-mobile-group-toggle span', (els) => els.map((e) => e.textContent?.trim()))
    assert.deepEqual(groupLabels, EXPECTED_GROUPS.map((g) => g.label))

    const expandedStates = await page.$$eval('.nav-mobile-group-toggle', (els) => els.map((e) => e.getAttribute('aria-expanded')))
    assert.deepEqual(expandedStates, ['false', 'false', 'false', 'false'], 'every group must start collapsed')

    const ctaText = await page.$eval('.nav-mobile-cta', (el) => el.textContent?.trim())
    assert.equal(ctaText, 'Get a Quote')
  } finally {
    await page.close()
  }
})

test('every group\'s real destinations are present with the correct text and href, confirmed against actual routes/section ids', async () => {
  const page: Page = await browser.newPage()
  try {
    await openMenu(page)

    for (const group of EXPECTED_GROUPS) {
      const toggle = await page.$$eval('.nav-mobile-group-toggle', (els, label) => {
        const match = els.find((e) => e.querySelector('span')?.textContent?.trim() === label)
        return match ? els.indexOf(match) : -1
      }, group.label)
      assert.ok(toggle >= 0, `expected a toggle for "${group.label}"`)

      const toggles = await page.$$('.nav-mobile-group-toggle')
      await toggles[toggle].click()

      const panelId = await toggles[toggle].evaluate((el) => el.getAttribute('aria-controls'))
      const items = await page.$$eval(`#${panelId} a`, (els) => els.map((e) => ({ text: e.textContent?.trim(), href: e.getAttribute('href') })))
      assert.deepEqual(items, group.items, `mismatch in "${group.label}" group items`)
    }
  } finally {
    await page.close()
  }
})

test('on an interior page (variant="page"), every group\'s destinations are still correct — homepage-section links (Portfolio, About, Contact) get the "/" prefix, real page routes stay identical', async () => {
  const page: Page = await browser.newPage()
  try {
    await openMenu(page, '/check.html')

    const homeHref = await page.$eval('.nav-mobile > .nav-mobile-link', (el) => el.getAttribute('href'))
    assert.equal(homeHref, '/#hero', 'Home should route back to the homepage\'s hero section from an interior page')

    for (const group of EXPECTED_GROUPS_INTERIOR) {
      const toggleIndex = await page.$$eval('.nav-mobile-group-toggle', (els, label) => {
        const match = els.find((e) => e.querySelector('span')?.textContent?.trim() === label)
        return match ? els.indexOf(match) : -1
      }, group.label)
      assert.ok(toggleIndex >= 0, `expected a toggle for "${group.label}"`)

      const toggles = await page.$$('.nav-mobile-group-toggle')
      await toggles[toggleIndex].click()

      const panelId = await toggles[toggleIndex].evaluate((el) => el.getAttribute('aria-controls'))
      const items = await page.$$eval(`#${panelId} a`, (els) => els.map((e) => ({ text: e.textContent?.trim(), href: e.getAttribute('href') })))
      assert.deepEqual(items, group.items, `mismatch in "${group.label}" group items on an interior page`)
    }
  } finally {
    await page.close()
  }
})

test('groups are independent disclosures — opening one does not close another, and each can be closed independently', async () => {
  const page: Page = await browser.newPage()
  try {
    await openMenu(page)
    const toggles = await page.$$('.nav-mobile-group-toggle')

    await toggles[0].click()
    await toggles[2].click()

    const states = await page.$$eval('.nav-mobile-group-toggle', (els) => els.map((e) => e.getAttribute('aria-expanded')))
    assert.deepEqual(states, ['true', 'false', 'true', 'false'], 'opening group 0 then group 2 should leave both open and 1/3 untouched')

    await toggles[0].click()
    const statesAfterClose = await page.$$eval('.nav-mobile-group-toggle', (els) => els.map((e) => e.getAttribute('aria-expanded')))
    assert.deepEqual(statesAfterClose, ['false', 'false', 'true', 'false'], 'closing group 0 should leave group 2 open')
  } finally {
    await page.close()
  }
})

test('a collapsed group\'s links are not reachable by Tab (removed from tab order until expanded)', async () => {
  const page: Page = await browser.newPage()
  try {
    await openMenu(page)
    const toggle = await page.$('.nav-mobile-group-toggle')
    await toggle!.focus()
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      cls: document.activeElement?.className,
    }))
    // The very next focusable element after the first (collapsed) group's
    // toggle must be the *next group's* toggle, not one of its own hidden
    // sublinks — confirming the collapsed panel's visibility:hidden
    // removes it from the tab sequence, matching the /faq accordion.
    assert.ok(
      (focused.cls as string)?.includes('nav-mobile-group-toggle'),
      `expected the next tab stop to be a group toggle, got ${focused.tag}.${focused.cls}`
    )
  } finally {
    await page.close()
  }
})

test('keyboard Enter and Space both toggle a focused group', async () => {
  const page: Page = await browser.newPage()
  try {
    await openMenu(page)
    const toggle = await page.$('.nav-mobile-group-toggle')
    await toggle!.focus()

    await page.keyboard.press('Enter')
    let expanded = await toggle!.evaluate((el) => el.getAttribute('aria-expanded'))
    assert.equal(expanded, 'true')

    await page.keyboard.press('Space')
    expanded = await toggle!.evaluate((el) => el.getAttribute('aria-expanded'))
    assert.equal(expanded, 'false')
  } finally {
    await page.close()
  }
})

test('the chevron rotates (transform changes) when its group is expanded', async () => {
  const page: Page = await browser.newPage()
  try {
    await openMenu(page)
    const before = await page.$eval('.nav-mobile-chevron', (el) => getComputedStyle(el).transform)
    await page.click('.nav-mobile-group-toggle')
    const after = await page.$eval('.nav-mobile-chevron', (el) => getComputedStyle(el).transform)
    assert.notEqual(before, after)
  } finally {
    await page.close()
  }
})

test('under prefers-reduced-motion: groups still open/close, but with zero transition duration', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await openMenu(page)
    const toggle = await page.$('.nav-mobile-group-toggle')
    const duration = await page.$eval('.nav-mobile-group-panel', (el) => getComputedStyle(el).transitionDuration)
    assert.equal(duration, '0s')
    await toggle!.click()
    const expanded = await toggle!.evaluate((el) => el.getAttribute('aria-expanded'))
    assert.equal(expanded, 'true')
  } finally {
    await page.close()
  }
})

test('selecting a destination inside an expanded group closes the entire mobile menu', async () => {
  const page: Page = await browser.newPage()
  try {
    await openMenu(page)
    const toggles = await page.$$('.nav-mobile-group-toggle')
    await toggles[1].click()
    // Let the 0.35s expand transition finish before clicking — otherwise
    // Puppeteer can click a stale position mid-animation.
    await new Promise((r) => setTimeout(r, 500))
    // "Portfolio" (#work, an in-page anchor) is used deliberately instead
    // of a real-navigation link like "Services & Pricing" — isolates the
    // close-on-click behavior itself from page-navigation timing.
    const links = await page.$$('.nav-mobile-sublink')
    const portfolioLink = await page.evaluate(() => Array.from(document.querySelectorAll('.nav-mobile-sublink')).findIndex(el => el.textContent?.trim() === 'Portfolio'))
    await links[portfolioLink].click()
    const navMobileHidden = await page.$eval('.nav-mobile', (el) => (el as HTMLElement).style.display === 'none')
    assert.ok(navMobileHidden, 'the mobile menu should close after selecting a destination')
  } finally {
    await page.close()
  }
})

test('the mobile menu panel is constrained and scrollable on a short screen with every group expanded', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 390, height: 500 })
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    await page.click('.nav-hamburger')
    const toggles = await page.$$('.nav-mobile-group-toggle')
    for (const t of toggles) await t.click()
    // Let the 0.35s grid-template-rows expand transition finish before
    // measuring — otherwise scrollHeight is caught mid-animation.
    await new Promise((r) => setTimeout(r, 500))

    const metrics = await page.$eval('.nav-mobile', (el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }))
    assert.ok(metrics.scrollHeight > metrics.clientHeight, 'with every group expanded on a 500px-tall screen, content should exceed the panel — otherwise this test isn\'t exercising the scroll behavior')
    assert.equal(metrics.overflowY, 'auto')

    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    assert.equal(pageOverflow, false, 'the menu scrolling internally must not cause horizontal page overflow')
  } finally {
    await page.close()
  }
})

for (const width of [320, 375, 390]) {
  test(`no horizontal overflow at ${width}px with every group expanded`, async () => {
    const page: Page = await browser.newPage()
    try {
      await page.setViewport({ width, height: 900 })
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
      await page.click('.nav-hamburger')
      const toggles = await page.$$('.nav-mobile-group-toggle')
      for (const t of toggles) await t.click()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      assert.equal(overflow, false, `expected no horizontal overflow at ${width}px`)
    } finally {
      await page.close()
    }
  })
}

test('the desktop nav (.nav-links) is unaffected — still 9 flat links, unchanged', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 1500, height: 900 })
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const links = await page.$$eval('.nav-links a', (els) => els.map((e) => ({ text: e.textContent?.trim(), href: e.getAttribute('href') })))
    assert.deepEqual(links, [
      { text: 'Home', href: '#hero' },
      { text: 'Services & Pricing', href: '/services' },
      { text: 'Portfolio', href: '#work' },
      { text: 'Tools', href: '/business-tools' },
      { text: 'About', href: '#about' },
      { text: 'FAQ', href: '/faq' },
      { text: 'Website Checklist', href: '/website-checklist' },
      { text: 'Free Website Review', href: '/check' },
      { text: 'Contact', href: '#contact' },
    ])
  } finally {
    await page.close()
  }
})
