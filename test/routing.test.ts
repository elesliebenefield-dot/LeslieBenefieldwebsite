// Verifies that the clean production URLs defined in vercel.json load the
// correct pages — not the homepage fallback. Uses a test server that applies
// the same rewrites as vercel.json so the test reflects production behaviour.
//
// Failing cases caught by this file:
//   - /real-estate-tools returns index.html (homepage) instead of the showcase
//   - /tools/real-estate/<tool> returns index.html instead of the intended tool
//   - The homepage callout link points to something other than /real-estate-tools
//   - The Real Estate Tools suite or demos are described as "free"
//
// Runs against the real production build (dist/, always rebuilt fresh).

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

// Mirrors vercel.json exactly.
const REWRITES: Record<string, string> = {
  '/check':                                  '/check.html',
  '/services':                               '/services.html',
  '/faq':                                    '/faq.html',
  '/website-checklist':                      '/website-checklist.html',
  '/privacy-policy':                         '/privacy-policy.html',
  '/tools/real-estate/seller':               '/tools-seller.html',
  '/tools/real-estate/buyer':                '/tools-buyer.html',
  '/tools/real-estate/listing-preparation':  '/tools-listing-preparation.html',
  '/tools/real-estate/property-comparison':  '/tools-property-comparison.html',
  '/tools/real-estate/open-house-follow-up': '/tools-open-house-follow-up.html',
  '/tools/real-estate/closing-moving':       '/tools-closing-moving.html',
  '/real-estate-tools':                      '/tools-real-estate-showcase.html',
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
}

let browser: Browser
let server: Server
let baseUrl: string

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
    const rawPath = req.url?.split('?')[0] ?? '/'
    const resolved = REWRITES[rawPath] ?? (rawPath === '/' ? '/index.html' : rawPath)
    const filePath = path.join(DIST, resolved)
    try {
      const data = await readFile(filePath)
      const ext  = path.extname(filePath)
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

async function getPage(url: string, width = 1280): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 900 })
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' })
  return page
}

// ── /real-estate-tools routing ────────────────────────────────────────────────

test('/real-estate-tools loads the showcase page, not the homepage', async () => {
  const page = await getPage('/real-estate-tools')
  try {
    // 1. Static title discriminator.
    const title = await page.title()
    assert.match(title, /Real Estate/i, `expected showcase title, got: "${title}"`)

    // 2. Homepage hero must NOT be present.
    const homepageHero = await page.$('.hero')
    assert.equal(homepageHero, null, 'homepage .hero must not be present — clean URL is falling back to index.html')

    // 3. React must have mounted and rendered the showcase app.
    //    .rts-hero-card is rendered by RealEstateToolsShowcasePage after hydration.
    await page.waitForSelector('.rts-hero-card', { timeout: 5000 }).catch(() => {
      throw new Error('React did not mount .rts-hero-card on /real-estate-tools — blank page or wrong bundle')
    })

    // 4. H1 is rendered by React — confirms the correct component tree loaded.
    const h1 = await page.$eval('h1', (el) => el.textContent?.trim() ?? '').catch(() => '')
    assert.ok(h1.length > 0, 'h1 must be present on the showcase page after React mounts')

    // 5. All six tool cards present — fails for a partial mount or homepage fallback.
    const toolCardCount = await page.$$eval('.rts-tool-card', (els) => els.length)
    assert.equal(toolCardCount, 6, `expected 6 .rts-tool-card elements, got ${toolCardCount} — homepage fallback or failed mount suspected`)
  } finally {
    await page.close()
  }
})

test('/real-estate-tools showcase h1 and title are correct', async () => {
  const page = await getPage('/real-estate-tools')
  try {
    const title = await page.title()
    assert.match(title, /Websites by Leslie/i)
    const h1 = await page.$eval('h1', (el) => el.textContent?.trim() ?? '')
    assert.match(h1, /real estate|planning tools|client journey/i)
  } finally {
    await page.close()
  }
})

// ── Individual demo routing ───────────────────────────────────────────────────

// bodyFragment: a text string rendered by React inside each tool — proves the
// application actually mounted and rendered the correct content. Absent on a
// blank page, failed React mount, or homepage fallback.
//
// mountedSelector: a React-rendered CSS selector that is specific to each
// tool's layout component. Each tool was probed to confirm the selector it
// actually uses at load time:
//   - buyer / seller / listing-preparation → .tool-page (shared layout root)
//   - property-comparison                  → h1  (renders immediately at load)
//   - open-house-follow-up / closing-moving → .tool-container (layout root)
const DEMO_ROUTES: { url: string; titleFragment: string; bodyFragment: string; mountedSelector: string }[] = [
  { url: '/tools/real-estate/buyer',               titleFragment: 'Buyer',      bodyFragment: 'Buyer Readiness Planner',            mountedSelector: '.tool-page' },
  { url: '/tools/real-estate/seller',              titleFragment: 'Seller',     bodyFragment: 'Seller Readiness Planner',           mountedSelector: '.tool-page' },
  { url: '/tools/real-estate/listing-preparation', titleFragment: 'Listing',    bodyFragment: 'Listing Preparation Action Planner', mountedSelector: '.tool-page' },
  { url: '/tools/real-estate/property-comparison', titleFragment: 'Property',   bodyFragment: 'Property Comparison',                mountedSelector: 'h1' },
  { url: '/tools/real-estate/open-house-follow-up',titleFragment: 'Open House', bodyFragment: 'Open House Follow-Up',               mountedSelector: '.tool-container' },
  { url: '/tools/real-estate/closing-moving',      titleFragment: 'Closing',    bodyFragment: 'Closing & Moving Organizer',         mountedSelector: '.tool-container' },
]

for (const { url, titleFragment, bodyFragment, mountedSelector } of DEMO_ROUTES) {
  test(`${url} loads the correct tool page, not the homepage`, async () => {
    const page = await getPage(url)
    try {
      // 1. Static HTML <title> — present before React renders, fast discriminator
      //    against an index.html fallback which would carry the homepage title.
      const title = await page.title()
      assert.match(title, new RegExp(titleFragment, 'i'),
        `expected title containing "${titleFragment}" at ${url}, got: "${title}" — clean URL may be falling back to index.html`)

      // 2. Homepage hero must not be present.
      const homepageHero = await page.$('.hero')
      assert.equal(homepageHero, null,
        `homepage .hero must not be present at ${url} — clean URL is falling back to index.html`)

      // 3. React must have mounted and rendered visible, route-specific content.
      //    Wait for the tool-specific layout selector — its absence means React
      //    failed to mount, the wrong bundle loaded, or the page is blank.
      await page.waitForSelector(mountedSelector, { timeout: 5000 }).catch(() => {
        throw new Error(`React did not mount "${mountedSelector}" at ${url} — blank page, failed mount, or wrong bundle`)
      })

      // 4. Verify the route-specific body text is present in the rendered DOM.
      //    Fails for a blank page, homepage fallback, or misrouted bundle.
      const bodyText = await page.evaluate(() => document.body.textContent ?? '')
      assert.ok(bodyText.includes(bodyFragment),
        `expected body to contain "${bodyFragment}" at ${url} — React may not have rendered the correct tool`)
    } finally {
      await page.close()
    }
  })
}

// ── Homepage callout destination ─────────────────────────────────────────────

test('homepage callout "See the tools" link points to /real-estate-tools (not a .html file)', async () => {
  const page = await getPage('/')
  try {
    const href = await page.$eval('.tools-callout-link', (el) => el.getAttribute('href')).catch(() => null)
    assert.ok(href !== null, '.tools-callout-link must exist on the homepage')
    assert.equal(href, '/real-estate-tools',
      `callout link must point to /real-estate-tools, got: "${href}"`)
  } finally {
    await page.close()
  }
})

// ── No prohibited "free" language for the tools/suite ────────────────────────

test('homepage callout does not describe the suite or tools as "free"', async () => {
  const page = await getPage('/')
  try {
    const calloutText = (await page.$eval('.tools-callout', (el) => el.textContent ?? '').catch(() => '')).toLowerCase()
    assert.ok(calloutText.length > 10, 'callout must have content')
    assert.ok(!/\bfree\b/.test(calloutText),
      `homepage callout must not call the suite/tools "free", got: "${calloutText}"`)
  } finally {
    await page.close()
  }
})

test('showcase page does not describe the suite or tools as "free"', async () => {
  const page = await getPage('/real-estate-tools')
  try {
    const bodyText = (await page.evaluate(() => document.body.textContent ?? '')).toLowerCase()

    // "free quote" (about a business consultation) is permitted.
    // "free to explore", "free tools", "free suite" are prohibited.
    // Strip allowed occurrences of "free quote" / "free website review" before checking.
    const stripped = bodyText
      .replace(/free quote/g, '')
      .replace(/free website review/g, '')

    const prohibitedPattern = /\bfree\b.{0,30}(tool|suite|demo|implement|integrat|setup|custom|brand)/
    const reversePattern    = /(tool|suite|demo|implement|integrat|setup|custom|brand).{0,30}\bfree\b/

    assert.ok(!prohibitedPattern.test(stripped),
      'showcase must not describe tools/suite/demos/customization as "free"')
    assert.ok(!reversePattern.test(stripped),
      'showcase must not describe tools/suite/demos/customization as "free" (reverse order)')
  } finally {
    await page.close()
  }
})
