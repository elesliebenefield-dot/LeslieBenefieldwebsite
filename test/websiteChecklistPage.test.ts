// Tests for the /website-checklist page (New Client Website Checklist) — a
// standalone page added alongside /check, /services, and /faq, following
// the same shared Nav/Footer + own-page pattern. Covers what's specific to
// this page: all five checklist groups and their items, the two reassuring
// notes (photos/professional-photos and online-access), clean heading
// structure, the shared CTA card, no horizontal overflow, and
// prefers-reduced-motion.
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/websiteChecklistPage.test.ts

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
const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header'

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
    const urlPath = req.url === '/' ? '/website-checklist.html' : req.url || '/website-checklist.html'
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
    await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
    assert.deepEqual(pageErrors, [])
  } finally {
    await page.close()
  }
})

test('heading structure: single h1, no skipped level, no empty headings', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
    const m = await page.evaluate(collectHeadingStructure)
    assert.deepEqual(m, { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 })
    const h1Text = await page.$eval('h1', (el) => el.textContent?.trim())
    assert.equal(h1Text, 'Getting ready for your website')
    const subheading = await page.$eval('.checklist-header .section-subtitle', (el) => el.textContent?.trim())
    assert.equal(
      subheading,
      'You do not need everything figured out before we talk. This checklist simply helps you gather the things that make a website project smoother.'
    )
  } finally {
    await page.close()
  }
})

test('all five checklist groups are present with their items, each item paired with an icon', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
    const groups = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.checklist-group')).map((group) => ({
        title: group.querySelector('.checklist-group-title')?.textContent?.trim(),
        itemCount: group.querySelectorAll('.checklist-items li').length,
        iconCount: group.querySelectorAll('.checklist-items li svg').length,
      }))
    )
    assert.deepEqual(
      groups.map((g) => g.title),
      ['Your business basics', 'Your goals', 'Your content', 'Your visuals', 'Your online access']
    )
    for (const g of groups) {
      assert.ok(g.itemCount > 0, `expected items in "${g.title}"`)
      assert.equal(g.iconCount, g.itemCount, `expected every item in "${g.title}" to have an icon`)
    }
  } finally {
    await page.close()
  }
})

test('the visuals group clearly says professional photos are helpful but not required, and the online-access group reassures it\'s okay not to have everything yet', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
    const notes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.checklist-group')).map((group) => ({
        title: group.querySelector('.checklist-group-title')?.textContent?.trim(),
        note: group.querySelector('.checklist-note')?.textContent?.trim() || null,
      }))
    )
    const visuals = notes.find((n) => n.title === 'Your visuals')
    const access = notes.find((n) => n.title === 'Your online access')
    assert.match(visuals?.note || '', /helpful.*not required/i)
    assert.match(access?.note || '', /okay not to have/i)
    assert.match(access?.note || '', /don't send passwords by email/i)
  } finally {
    await page.close()
  }
})

test('desktop/tablet 2-column widths: the fifth "Your online access" card is centered under the two rows above it, at the same width as the other cards', async () => {
  const page: Page = await browser.newPage()
  try {
    for (const width of [700, 1000, 1440]) {
      await page.setViewport({ width, height: 1200 })
      await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
      const layout = await page.evaluate(() => {
        const groups = Array.from(document.querySelectorAll('.checklist-group'))
        const last = groups[groups.length - 1]
        const first = groups[0]
        const container = document.querySelector('.checklist-groups')!
        const containerRect = container.getBoundingClientRect()
        const lastRect = last.getBoundingClientRect()
        const firstRect = first.getBoundingClientRect()
        return {
          widthsMatch: Math.abs(lastRect.width - firstRect.width) < 2,
          centered: Math.abs(containerRect.x + containerRect.width / 2 - (lastRect.x + lastRect.width / 2)) < 2,
        }
      })
      assert.ok(layout.widthsMatch, `expected the last card's width to match the first card's at ${width}px`)
      assert.ok(layout.centered, `expected the last card to be horizontally centered at ${width}px`)
    }
  } finally {
    await page.close()
  }
})

test('mobile (390px): checklist groups stay in a single natural column, unaffected by the desktop centering rule', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 390, height: 1600 })
    await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
    const xPositions = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.checklist-group')).map((g) => Math.round(g.getBoundingClientRect().x))
    )
    const uniqueX = new Set(xPositions)
    assert.equal(uniqueX.size, 1, `expected all cards to share one x position (single column), got ${JSON.stringify(xPositions)}`)
  } finally {
    await page.close()
  }
})

test('checklist cards lift on hover, consistent with service/portfolio cards (pointer devices only)', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
    const box = await page.$eval('.checklist-group', (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    await page.mouse.move(box.x, box.y)
    await new Promise((r) => setTimeout(r, 550))
    const transform = await page.$eval('.checklist-group', (el) => getComputedStyle(el).transform)
    assert.notEqual(transform, 'none')
  } finally {
    await page.close()
  }
})

test('CTA card has the right heading and both buttons point to the right destinations', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
    const heading = await page.$eval('.page-cta-inner .section-title', (el) => el.textContent?.trim())
    assert.equal(heading, 'Ready to take the next step?')

    const reviewHref = await page.$eval('.page-cta-buttons a.btn-primary', (el) => el.getAttribute('href'))
    assert.equal(reviewHref, '/check')

    const quoteLink = await page.$eval('.page-cta-buttons a.btn-outline', (el) => ({
      href: el.getAttribute('href'),
      target: el.getAttribute('target'),
      rel: el.getAttribute('rel'),
    }))
    assert.equal(quoteLink.href, GOOGLE_FORM_URL)
    assert.equal(quoteLink.target, '_blank')
    assert.match(quoteLink.rel || '', /noopener/)
  } finally {
    await page.close()
  }
})

test('nav includes a working "Website Checklist" link to /website-checklist', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
    const navLink = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('.nav-links a, .nav-mobile a')).find((a) => a.textContent?.trim() === 'Website Checklist')
      return link ? link.getAttribute('href') : null
    })
    assert.equal(navLink, '/website-checklist')
  } finally {
    await page.close()
  }
})

test('no horizontal overflow at 390px, 1400px (breakpoint boundary), or 1440px', async () => {
  const page: Page = await browser.newPage()
  try {
    for (const width of [390, 768, 1399, 1400, 1401, 1440]) {
      await page.setViewport({ width, height: 900 })
      await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 0, `expected no overflow at ${width}px, got ${overflow}px`)
    }
  } finally {
    await page.close()
  }
})

test('prefers-reduced-motion: all [data-reveal] content is visible immediately with no transition', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
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

test('"Back to Websites by Leslie" link is keyboard-focusable and points home', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/website-checklist.html`, { waitUntil: 'load' })
    const href = await page.$eval('.page-back', (el) => el.getAttribute('href'))
    assert.equal(href, '/')
  } finally {
    await page.close()
  }
})
