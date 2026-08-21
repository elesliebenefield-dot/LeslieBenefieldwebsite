// Tests for /real-estate-tools — the Real Estate Tools Showcase page.
// Covers: title, meta, canonical, indexable robots, OG/social metadata,
// "New from Websites by Leslie" eyebrow, all six tool names and demo
// links, nav "New" badge, customization CTA, privacy/session wording,
// no prohibited advisory claims, keyboard-accessible links, heading
// structure, responsive/overflow, and prefers-reduced-motion.
//
// Runs against the real production build (dist/, always rebuilt fresh —
// see the before() hook) in a real browser via Puppeteer.
//
// Run with: node --test test/realEstateShowcasePage.test.ts

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
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg':  'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
}

let browser: Browser
let server: Server
let baseUrl: string

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
    const urlPath = req.url === '/' ? '/tools-real-estate-showcase.html' : req.url || '/tools-real-estate-showcase.html'
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
  if (!address || typeof address === 'string') throw new Error('failed to start server')
  baseUrl = `http://127.0.0.1:${address.port}`

  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

async function loadPage(width = 1280): Promise<Page> {
  const page: Page = await browser.newPage()
  await page.setViewport({ width, height: 900 })
  await page.goto(`${baseUrl}/tools-real-estate-showcase.html`, { waitUntil: 'load' })
  return page
}

test('page loads with no console errors', async () => {
  const page = await loadPage()
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  try {
    await page.reload({ waitUntil: 'load' })
    assert.deepEqual(errors, [])
  } finally {
    await page.close()
  }
})

test('page title includes "Real Estate" and "Websites by Leslie"', async () => {
  const page = await loadPage()
  try {
    const title = await page.title()
    assert.match(title, /Real Estate/i)
    assert.match(title, /Websites by Leslie/i)
  } finally {
    await page.close()
  }
})

test('page is indexable — no noindex directive', async () => {
  const page = await loadPage()
  try {
    const robots = await page.$eval('meta[name="robots"]', (el) => (el as HTMLMetaElement).content).catch(() => '')
    assert.ok(!robots.includes('noindex'), `expected no noindex directive, got: "${robots}"`)
  } finally {
    await page.close()
  }
})

test('canonical link points to the correct production URL', async () => {
  const page = await loadPage()
  try {
    const canonical = await page.$eval('link[rel="canonical"]', (el) => (el as HTMLLinkElement).href).catch(() => '')
    assert.match(canonical, /websitesbyleslie\.com\/real-estate-tools/)
  } finally {
    await page.close()
  }
})

test('Open Graph and Twitter social metadata are present', async () => {
  const page = await loadPage()
  try {
    const ogTitle = await page.$eval('meta[property="og:title"]', (el) => (el as HTMLMetaElement).content).catch(() => '')
    const ogDesc  = await page.$eval('meta[property="og:description"]', (el) => (el as HTMLMetaElement).content).catch(() => '')
    const ogImg   = await page.$eval('meta[property="og:image"]', (el) => (el as HTMLMetaElement).content).catch(() => '')
    const ogUrl   = await page.$eval('meta[property="og:url"]', (el) => (el as HTMLMetaElement).content).catch(() => '')
    const twCard  = await page.$eval('meta[name="twitter:card"]', (el) => (el as HTMLMetaElement).content).catch(() => '')

    assert.ok(ogTitle.length > 0, 'og:title must be present')
    assert.ok(ogDesc.length > 0,  'og:description must be present')
    assert.match(ogImg, /social-preview/, 'og:image must reference the social preview image')
    assert.match(ogUrl, /real-estate-tools/, 'og:url must reference the showcase URL')
    assert.equal(twCard, 'summary_large_image')
  } finally {
    await page.close()
  }
})

test('"New from Websites by Leslie" eyebrow is visible above the fold on desktop', async () => {
  const page = await loadPage(1280)
  try {
    const newPillText = await page.$eval('.rts-hero-new', (el) => el.textContent?.trim() ?? '').catch(() => '')
    assert.match(newPillText, /New from Websites by Leslie/i)
    const rect = await page.$eval('.rts-hero-new', (el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, height: r.height }
    })
    assert.ok(rect.height > 0, 'hero-new pill must have non-zero height')
    assert.ok(rect.top < 900, '"New from Websites by Leslie" must be above the fold')
  } finally {
    await page.close()
  }
})

test('"New from Websites by Leslie" eyebrow is visible above the fold on mobile', async () => {
  const page = await loadPage(375)
  try {
    const newPillText = await page.$eval('.rts-hero-new', (el) => el.textContent?.trim() ?? '').catch(() => '')
    assert.match(newPillText, /New from Websites by Leslie/i)
    const rect = await page.$eval('.rts-hero-new', (el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, height: r.height }
    })
    assert.ok(rect.height > 0)
    assert.ok(rect.top < 900, '"New from Websites by Leslie" must be visible on mobile without scrolling')
  } finally {
    await page.close()
  }
})

test('page h1 is present and mentions the client journey or real estate tools', async () => {
  const page = await loadPage()
  try {
    const h1 = await page.$eval('h1', (el) => el.textContent?.trim() ?? '').catch(() => '')
    assert.ok(h1.length > 0, 'h1 must be present')
    assert.match(h1, /real estate|planning tools|client journey/i)
  } finally {
    await page.close()
  }
})

test('heading structure: single h1, no skipped level, no empty headings', async () => {
  const page = await loadPage()
  try {
    const m = await page.evaluate(() => {
      const hs = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'))
      const h1Count = hs.filter((h) => h.tagName === 'H1').length
      const levels = hs.map((h) => Number(h.tagName[1]))
      let hasSkippedLevel = false
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) hasSkippedLevel = true
      }
      if (levels.length > 0 && levels[0] > 2) hasSkippedLevel = true
      const emptyCount = hs.filter((h) => !(h.textContent || '').trim()).length
      return { h1Count, hasSkippedLevel, emptyCount }
    })
    assert.equal(m.h1Count, 1, 'must have exactly one h1')
    assert.equal(m.hasSkippedLevel, false, 'must not skip heading levels')
    assert.equal(m.emptyCount, 0, 'must not have empty headings')
  } finally {
    await page.close()
  }
})

const EXPECTED_TOOLS: { name: string; url: string }[] = [
  { name: 'Buyer Readiness Planner',                    url: '/tools/real-estate/buyer' },
  { name: 'Seller Readiness Planner',                   url: '/tools/real-estate/seller' },
  { name: 'Listing Preparation Action Planner',         url: '/tools/real-estate/listing-preparation' },
  { name: 'Home Tour & Property Comparison Planner',    url: '/tools/real-estate/property-comparison' },
  { name: 'Open House Follow-Up Planner',               url: '/tools/real-estate/open-house-follow-up' },
  { name: 'Closing & Moving Organizer',                 url: '/tools/real-estate/closing-moving' },
]

test('all six tool names appear on the page', async () => {
  const page = await loadPage()
  try {
    const bodyText = await page.evaluate(() => document.body.textContent ?? '')
    for (const tool of EXPECTED_TOOLS) {
      assert.ok(bodyText.includes(tool.name), `expected to find tool name: "${tool.name}"`)
    }
  } finally {
    await page.close()
  }
})

test('all six "Try the demo" links point to the correct tool URLs', async () => {
  const page = await loadPage()
  try {
    const demoLinks = await page.$$eval('.rts-tool-link', (els) =>
      els.map((el) => ({
        href: el.getAttribute('href'),
        text: el.textContent?.trim() ?? '',
        ariaLabel: el.getAttribute('aria-label') ?? '',
      }))
    )
    assert.equal(demoLinks.length, 6, 'expected exactly 6 demo links')
    for (const tool of EXPECTED_TOOLS) {
      const link = demoLinks.find((l) => l.href === tool.url)
      assert.ok(link, `expected a demo link for "${tool.url}"`)
      assert.match(link!.ariaLabel, /try the .+ demo/i, `demo link for "${tool.url}" must have a descriptive aria-label`)
    }
  } finally {
    await page.close()
  }
})

test('customization CTA is present and links to the contact form', async () => {
  const page = await loadPage()
  try {
    const ctaLinks = await page.$$eval('.rts-custom-cta a', (els) =>
      els.map((el) => ({ href: el.getAttribute('href'), text: el.textContent?.trim() }))
    )
    const primaryCta = ctaLinks.find((l) => l.href === GOOGLE_FORM_URL)
    assert.ok(primaryCta, 'customization CTA must link to the Google Form')
    assert.match(primaryCta!.text ?? '', /customize/i)
  } finally {
    await page.close()
  }
})

test('privacy section mentions session-only storage and no transmission', async () => {
  const page = await loadPage()
  try {
    const privacyText = await page.$eval('.rts-privacy-inner', (el) => el.textContent ?? '').catch(() => '')
    assert.ok(privacyText.length > 20, 'privacy section must have content')
    assert.match(privacyText, /session/i, 'privacy section must mention session-based storage')
    assert.match(privacyText, /not.*stored|nothing.*stored|cleared/i, 'privacy section must state data is not stored')
  } finally {
    await page.close()
  }
})

test('showcase page does not describe the suite or tools as "free" (prohibited language)', async () => {
  const page = await loadPage()
  try {
    const bodyText = (await page.evaluate(() => document.body.textContent ?? '')).toLowerCase()
    const stripped = bodyText
      .replace(/free quote/g, '')
      .replace(/free website review/g, '')
    assert.ok(!/\bfree\b.{0,30}(tool|suite|demo|implement|integrat|setup|custom|brand)/.test(stripped),
      'showcase must not describe tools/suite/demos/customization as "free"')
    assert.ok(!/(tool|suite|demo|implement|integrat|setup|custom|brand).{0,30}\bfree\b/.test(stripped),
      'showcase must not describe tools/suite/demos/customization as "free" (reverse order)')
  } finally {
    await page.close()
  }
})

test('page does not contain prohibited advisory claims', async () => {
  const page = await loadPage()
  try {
    const bodyText = (await page.evaluate(() => document.body.textContent ?? '')).toLowerCase()
    const prohibited = [
      /this tool (will|can|does) eliminate risk/,
      /guarantees? (safety|outcome|result)/,
      /we (recommend|advise) you (to|that)/,
      /you (should|must) (hire|consult|choose)/,
      /legally (required|binding)/,
    ]
    for (const pattern of prohibited) {
      assert.ok(!pattern.test(bodyText), `prohibited advisory claim found: ${pattern}`)
    }
  } finally {
    await page.close()
  }
})

test('no horizontal overflow at 320px, 375px, 768px, 1280px', async () => {
  for (const width of [320, 375, 768, 1280]) {
    const page = await loadPage(width)
    try {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 0, `expected no horizontal overflow at ${width}px, got ${overflow}px`)
    } finally {
      await page.close()
    }
  }
})

test('all .rts-tool-link anchors are keyboard focusable (tabIndex ≥ 0)', async () => {
  const page = await loadPage()
  try {
    const tabIndices = await page.$$eval('.rts-tool-link', (els) =>
      els.map((el) => (el as HTMLElement).tabIndex)
    )
    assert.equal(tabIndices.length, 6, 'expected 6 .rts-tool-link elements')
    for (const idx of tabIndices) {
      assert.ok(idx >= 0, `a .rts-tool-link has tabIndex ${idx}, expected >= 0`)
    }
  } finally {
    await page.close()
  }
})

test('journey overview section has four stages', async () => {
  const page = await loadPage()
  try {
    const stageCount = await page.$$eval('.rts-journey-stage', (els) => els.length)
    assert.equal(stageCount, 4, 'expected exactly 4 journey stages')
  } finally {
    await page.close()
  }
})

test('page has the site footer', async () => {
  const page = await loadPage()
  try {
    const footer = await page.$('footer.footer')
    assert.ok(footer, 'site footer must be present')
  } finally {
    await page.close()
  }
})

test('prefers-reduced-motion: hero card has no animation', async () => {
  const page = await loadPage()
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.reload({ waitUntil: 'load' })
    const animName = await page.$eval('.rts-hero-card', (el) => getComputedStyle(el).animationName)
    assert.equal(animName, 'none', 'hero card must not animate under reduced-motion')
  } finally {
    await page.close()
  }
})

test('prefers-reduced-motion: [data-reveal] elements are fully visible immediately', async () => {
  const page = await loadPage()
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.reload({ waitUntil: 'load' })
    const states = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-reveal]')).map((el) => {
        const cs = getComputedStyle(el)
        return { opacity: cs.opacity, transitionProperty: cs.transitionProperty }
      })
    )
    assert.ok(states.length > 0, 'expected at least one [data-reveal] element')
    for (const s of states) {
      assert.equal(s.opacity, '1')
      assert.equal(s.transitionProperty, 'none')
    }
  } finally {
    await page.close()
  }
})

test('individual tool pages are not affected: all six retain noindex', async () => {
  const toolHtmlFiles = [
    'tools-buyer.html',
    'tools-seller.html',
    'tools-listing-preparation.html',
    'tools-property-comparison.html',
    'tools-open-house-follow-up.html',
    'tools-closing-moving.html',
  ]
  for (const file of toolHtmlFiles) {
    const page: Page = await browser.newPage()
    try {
      await page.goto(`${baseUrl}/${file}`, { waitUntil: 'load' })
      const robots = await page.$eval('meta[name="robots"]', (el) => (el as HTMLMetaElement).content).catch(() => '')
      assert.match(robots, /noindex/, `${file} must still be noindex`)
    } finally {
      await page.close()
    }
  }
})
