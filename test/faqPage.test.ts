// Tests for the /faq page (Frequently Asked Questions) — a standalone page
// added alongside /check and /services, following the same shared
// Nav/Footer + own-page pattern. Covers what's specific to this page:
// correct question/answer content (including the inline link to /services
// and the rush-project policy question added later), clean heading
// structure, the shared CTA card, no horizontal overflow, and
// prefers-reduced-motion.
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/faqPage.test.ts

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
    const urlPath = req.url === '/' ? '/faq.html' : req.url || '/faq.html'
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
    await page.goto(`${baseUrl}/faq.html`, { waitUntil: 'load' })
    assert.deepEqual(pageErrors, [])
  } finally {
    await page.close()
  }
})

test('heading structure: single h1, no skipped level, no empty headings', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/faq.html`, { waitUntil: 'load' })
    const m = await page.evaluate(collectHeadingStructure)
    assert.deepEqual(m, { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 })
    const h1Text = await page.$eval('h1', (el) => el.textContent?.trim())
    assert.equal(h1Text, 'Frequently Asked Questions')
  } finally {
    await page.close()
  }
})

test('all eleven questions are present, each with a non-empty answer, in the expected order', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/faq.html`, { waitUntil: 'load' })
    const items = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.faq-item')).map((item) => ({
        question: item.querySelector('.faq-question')?.textContent?.trim(),
        answerLength: (item.querySelector('.faq-answer')?.textContent || '').trim().length,
      }))
    )
    assert.deepEqual(
      items.map((i) => i.question),
      [
        'How much does a website cost?',
        'How does payment work?',
        'Do you offer rush projects?',
        'How long does a website take?',
        'What do you need from me to get started?',
        "What if I don't have a logo, photos, or all of my wording yet?",
        'Can you update my existing website instead of building a new one?',
        'Do you help with domains and hosting?',
        'Will my website show up on Google?',
        'What happens after my website launches?',
        'Can you work with a small budget or barter?',
      ]
    )
    for (const item of items) {
      assert.ok(item.answerLength > 0, `expected a non-empty answer for "${item.question}"`)
    }
  } finally {
    await page.close()
  }
})

test('the cost answer links to /services, and no answer states a ranking/traffic guarantee or an hourly rate', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/faq.html`, { waitUntil: 'load' })
    const link = await page.$eval('.faq-item a', (el) => el.getAttribute('href'))
    assert.equal(link, '/services')

    const bodyText = await page.evaluate(() => document.body.textContent || '')
    assert.ok(!/\$\s*\d+(\.\d+)?\s*\/\s*(hour|hr)\b/i.test(bodyText), 'page must not display an hourly rate')
    // The SEO answer must not promise rankings/traffic/leads — only that
    // careful phrasing was used ("can't make guarantees").
    const seoAnswer = await page.evaluate(() => {
      const item = Array.from(document.querySelectorAll('.faq-item')).find((el) =>
        el.querySelector('.faq-question')?.textContent?.includes('show up on Google')
      )
      return item?.querySelector('.faq-answer')?.textContent || ''
    })
    assert.match(seoAnswer, /can't make guarantees/i)
  } finally {
    await page.close()
  }
})

test('the rush-project question does not promise rush availability', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/faq.html`, { waitUntil: 'load' })
    const answer = await page.evaluate(() => {
      const item = Array.from(document.querySelectorAll('.faq-item')).find((el) =>
        el.querySelector('.faq-question')?.textContent?.includes('rush')
      )
      return item?.querySelector('.faq-answer')?.textContent || ''
    })
    assert.match(answer, /depends on my current schedule/i)
    assert.match(answer, /rush fee/i)
  } finally {
    await page.close()
  }
})

test('CTA card has the right heading and both buttons point to the right destinations', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/faq.html`, { waitUntil: 'load' })
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

test('nav includes a working "FAQ" link to /faq', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/faq.html`, { waitUntil: 'load' })
    const navLink = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('.nav-links a, .nav-mobile a')).find((a) => a.textContent?.trim() === 'FAQ')
      return link ? link.getAttribute('href') : null
    })
    assert.equal(navLink, '/faq')
  } finally {
    await page.close()
  }
})

test('no horizontal overflow at 390px, 1400px (breakpoint boundary), or 1440px', async () => {
  const page: Page = await browser.newPage()
  try {
    for (const width of [390, 768, 1399, 1400, 1401, 1440]) {
      await page.setViewport({ width, height: 900 })
      await page.goto(`${baseUrl}/faq.html`, { waitUntil: 'load' })
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
    await page.goto(`${baseUrl}/faq.html`, { waitUntil: 'load' })
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
    await page.goto(`${baseUrl}/faq.html`, { waitUntil: 'load' })
    const href = await page.$eval('.page-back', (el) => el.getAttribute('href'))
    assert.equal(href, '/')
  } finally {
    await page.close()
  }
})
