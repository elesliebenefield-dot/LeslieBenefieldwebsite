// Real-browser integration tests for Milestone M7: the calculator's
// attribution + lead-gen CTA + cross-link, the landing page, structured
// data, and — as of the 2026-09-15 final-publication approval — that
// every one of these pages is indexable (noindex, nofollow removed) and
// discoverable from the live site.
//
// The four educational articles ("How to Price Baked Goods for Profit",
// "Food Cost vs. Profit Margin", "How to Calculate Labor Cost", and
// "Packaging, Waste & Overhead") were removed in a 2026-09-15 post-launch
// correction — Websites by Leslie is not presenting itself as a source
// of bakery-pricing advice. Their old URLs now permanently redirect to
// the landing page (see vercel.json's "redirects", mirrored below for
// local testing) rather than 404ing or serving content.
//
// Runs against the production build (dist/) via a lightweight
// static HTTP server, driven by real headless Chrome — the same pattern
// as the other UI test files.
//
// Run with: node --test test/tools/bakeryPricingLaunchPrep.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = path.resolve(import.meta.dirname, '../..')
const DIST = path.join(ROOT, 'dist')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

// Mirrors vercel.json's "redirects" and "rewrites" exactly — read from
// that file at startup rather than hardcoded a second time, so this test
// can never silently drift from the actual production routing config.
let REDIRECTS: Record<string, string> = {}
let REWRITES: Record<string, string> = {}

let server: Server
let browser: Browser
let baseUrl: string

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  const vercelConfig = JSON.parse(await readFile(path.join(ROOT, 'vercel.json'), 'utf-8'))
  for (const { source, destination } of vercelConfig.redirects ?? []) {
    REDIRECTS[source] = destination
  }
  for (const { source, destination } of vercelConfig.rewrites ?? []) {
    REWRITES[source] = destination
  }

  server = createServer(async (req, res) => {
    const urlPath = req.url || '/'
    const cleanPath = urlPath.split('?')[0]
    const redirectTarget = REDIRECTS[cleanPath]
    if (redirectTarget) {
      res.writeHead(308, { Location: redirectTarget })
      res.end()
      return
    }
    const resolvedPath = REWRITES[cleanPath] ?? cleanPath
    const filePath = path.join(DIST, decodeURIComponent(resolvedPath))
    try {
      const data = await readFile(filePath)
      const ext = path.extname(filePath)
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404); res.end()
    }
  })
  await new Promise<void>(resolve => server.listen(0, resolve))
  const addr = server.address() as { port: number }
  baseUrl = `http://127.0.0.1:${addr.port}`

  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
  await new Promise<void>(resolve => server.close(() => resolve()))
})

// Only the landing page remains here — the four articles were removed
// 2026-09-15. Kept as an array (rather than inlining a single page) so
// every test below that loops over it needed no structural changes.
const NEW_PAGES = [
  { path: '/bakery-pricing-guide.html', title: /Free Bakery Pricing Calculator/ },
]

const REMOVED_ARTICLE_URLS = [
  '/bakery-pricing-for-profit',
  '/bakery-food-cost-vs-margin',
  '/bakery-labor-cost',
  '/bakery-packaging-waste-overhead',
]

// ─── 1. Everything is now indexable (2026-09-15 final publication) ────────

test('every M7 page is indexable — no noindex directive anywhere in the cluster', async () => {
  const page = await browser.newPage()
  try {
    const ALL_PAGES = [...NEW_PAGES.map(n => n.path), '/tools-bakery-pricing.html', '/business-tools.html']
    for (const p of ALL_PAGES) {
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load' })
      const robotsEl = await page.$('meta[name="robots"]')
      const content = robotsEl ? await page.$eval('meta[name="robots"]', el => (el as HTMLMetaElement).content) : null
      assert.ok(!content || !content.includes('noindex'), `${p} expected no noindex directive, got: "${content}"`)
    }
  } finally {
    await page.close()
  }
})

test('the calculator, the landing page, and the Business Tools hub each carry a www canonical URL matching their own route', async () => {
  const PAGES_WITH_CANONICAL = [
    { path: '/tools-bakery-pricing.html', canonical: 'https://www.websitesbyleslie.com/tools-bakery-pricing' },
    { path: '/bakery-pricing-guide.html', canonical: 'https://www.websitesbyleslie.com/bakery-pricing-guide' },
    { path: '/business-tools.html', canonical: 'https://www.websitesbyleslie.com/business-tools' },
  ]
  const page = await browser.newPage()
  try {
    for (const { path: p, canonical } of PAGES_WITH_CANONICAL) {
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load' })
      const href = await page.$eval('link[rel="canonical"]', el => (el as HTMLLinkElement).href)
      assert.equal(href, canonical, `${p} canonical URL mismatch`)
    }
  } finally {
    await page.close()
  }
})

test('the live Services page links the free calculator through its distinct free-tools section, funneled via the landing page (not the raw calculator route directly)', async () => {
  // Built during the M7 information-architecture correction, discovering
  // the calculator from an already-live, indexed page (/services) — and
  // as of the 2026-09-15 final-publication approval, the target itself is
  // indexable too, so this link is now a genuine, fully live discovery path.
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const hrefs = await page.$$eval('a[href]', els => els.map(e => e.getAttribute('href') || ''))
    assert.ok(hrefs.includes('/bakery-pricing-guide'), 'Services page should link the free calculator via the landing page')
    // The free-tools card is in its own section, distinct from the existing
    // customizable-demo cards grid.
    const freeToolSection = await page.$('#free-tools .pricing-free-card')
    assert.ok(freeToolSection, 'the free-tools section should be a distinct area, separate from .pricing-demo-cards')
    const demoGridHrefs = await page.$$eval('.pricing-demo-cards a[href]', els => els.map(e => e.getAttribute('href') || ''))
    assert.ok(!demoGridHrefs.includes('/bakery-pricing-guide'), 'the free calculator must not be mixed into the customizable-demo cards grid')
  } finally {
    await page.close()
  }
})

test('the homepage callout discovers the tools only through the single "Business Tools" hub link; the mobile nav\'s Tools & Resources group separately provides a direct calculator link', async () => {
  // Per the M7 IA correction, the homepage's own featured-tool callout
  // funnels through the general /business-tools hub, not straight to any
  // one tool — that part is unchanged. The 2026-09-15 mobile-menu redesign
  // deliberately and separately adds direct tool links inside the shared
  // Nav's collapsible "Tools & Resources" group, present on every page
  // including the homepage — an intentional, approved discovery path, not
  // a regression of the callout's own behavior.
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    assert.ok(await page.$('.tools-callout'), 'the homepage should have its featured-tool callout')
    const calloutHrefs = await page.$$eval('.tools-callout a[href]', els => els.map(e => e.getAttribute('href') || ''))
    assert.deepEqual(calloutHrefs, ['/business-tools'], 'the homepage callout itself should link only the Business Tools hub, not any tool directly')

    const navHrefs = await page.$$eval('.nav-mobile a[href]', els => els.map(e => e.getAttribute('href') || ''))
    assert.ok(navHrefs.includes('/bakery-pricing-guide'), 'the mobile nav\'s Tools & Resources group should link the free calculator directly')
  } finally {
    await page.close()
  }
})

// ─── 2. Landing page loads correctly ───────────────────────────────────────

for (const { path: p, title } of NEW_PAGES) {
  test(`${p} loads without console or page errors, with the expected title`, async () => {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))
    try {
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load' })
      assert.deepEqual(errors, [])
      const pageTitle = await page.title()
      assert.match(pageTitle, title)
      const h1 = await page.$eval('h1', el => el.textContent || '')
      assert.ok(h1.length > 0)
    } finally {
      await page.close()
    }
  })
}

test('the landing page has a meta description', async () => {
  const page = await browser.newPage()
  try {
    for (const { path: p } of NEW_PAGES) {
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load' })
      const description = await page.$eval('meta[name="description"]', el => (el as HTMLMetaElement).content)
      assert.ok(description.length > 20, `${p} should have a real meta description`)
    }
  } finally {
    await page.close()
  }
})

// ─── 3. Content quality guards ──────────────────────────────────────────────

test('the landing page makes no market-price, profitability-guarantee, or legal-compliance claims', async () => {
  const page = await browser.newPage()
  try {
    for (const { path: p } of NEW_PAGES) {
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load' })
      const bodyText = await page.$eval('body', el => el.textContent || '')
      assert.doesNotMatch(bodyText, /guarantee(d)? (a )?profit/i, `${p} must not promise guaranteed profit`)
      assert.doesNotMatch(bodyText, /legal(ly)? (compliant|required)/i, `${p} must not make a legal-compliance claim`)
      assert.doesNotMatch(bodyText, /\$\d+(\.\d+)?\s*(an? hour|\/hr|per hour)/i, `${p} must not state a specific market hourly rate`)
    }
  } finally {
    await page.close()
  }
})

test('the landing page no longer makes the corrected unsupported-generalization claim (2026-09-15 content fix)', async () => {
  // The equipment-double-counting and "worth taking" claim fixes (also
  // from 2026-09-15) lived only in the pricing-for-profit and
  // food-cost-vs-margin articles, both removed in the later post-launch
  // article-removal correction — nothing left to check for those here.
  const page = await browser.newPage()
  try {
    for (const { path: p } of NEW_PAGES) {
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load' })
      const bodyText = await page.$eval('body', el => el.textContent || '')
      assert.doesNotMatch(bodyText, /ingredients?\s+(are|is)\s+usually\s+the\s+smallest/i, `${p} must not claim ingredients are usually the smallest piece of cost`)
    }
  } finally {
    await page.close()
  }
})

test('the landing page does not mention offline use, installing, or a home-screen app (M5/M8 deferred)', async () => {
  const page = await browser.newPage()
  try {
    for (const { path: p } of NEW_PAGES) {
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load' })
      const bodyText = await page.$eval('body', el => el.textContent || '')
      assert.doesNotMatch(bodyText, /\boffline\b/i, `${p} must not mention offline use`)
      assert.doesNotMatch(bodyText, /install(ed|able|ing)?\b/i, `${p} must not mention installability`)
      assert.doesNotMatch(bodyText, /home[- ]screen/i, `${p} must not mention a home-screen app`)
    }
  } finally {
    await page.close()
  }
})

test('the landing page links directly into the calculator, and no longer links (or mentions) any of the four removed articles', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/bakery-pricing-guide.html`, { waitUntil: 'load' })
    const hrefs = await page.$$eval('a[href]', els => els.map(e => e.getAttribute('href') || ''))
    assert.ok(hrefs.includes('/tools-bakery-pricing'), 'landing page should link directly into the calculator')
    for (const removedArticle of REMOVED_ARTICLE_URLS) {
      assert.ok(!hrefs.includes(removedArticle), `landing page must not link the removed article ${removedArticle}`)
    }
    const bodyText = await page.$eval('body', el => el.textContent || '')
    assert.doesNotMatch(bodyText, /learn more about pricing your bakes/i, 'the removed "Learn more about pricing your bakes" section must not reappear')
  } finally {
    await page.close()
  }
})

test('the calculator disclaimer still leads with the concise, non-alarming notice, with attribution as a separate, short line', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/tools-bakery-pricing.html`, { waitUntil: 'load' })
    await page.waitForSelector('.bp-disclaimer-summary')
    const summary = await page.$eval('.bp-disclaimer-summary', el => el.textContent || '')
    assert.match(summary, /not financial, accounting, tax, legal, or business advice/i)
    const attribution = await page.$eval('.bp-disclaimer-attribution', el => el.textContent || '')
    assert.match(attribution, /Built by/)
    assert.match(attribution, /Websites by Leslie/)
    const link = await page.$eval('.bp-disclaimer-attribution a', el => el.getAttribute('href') || '')
    assert.equal(link, 'https://websitesbyleslie.com')
  } finally {
    await page.close()
  }
})

test('sitemap.xml lists the Business Tools hub, the calculator, and the landing page — no removed article URLs', async () => {
  const res = await fetch(`${baseUrl}/sitemap.xml`)
  const xml = await res.text()
  for (const loc of [
    'https://www.websitesbyleslie.com/business-tools',
    'https://www.websitesbyleslie.com/tools-bakery-pricing',
    'https://www.websitesbyleslie.com/bakery-pricing-guide',
  ]) {
    assert.ok(xml.includes(`<loc>${loc}</loc>`), `sitemap.xml should list ${loc}`)
  }
  for (const removedArticle of REMOVED_ARTICLE_URLS) {
    assert.ok(!xml.includes(removedArticle), `sitemap.xml must not list the removed article ${removedArticle}`)
  }
})

// ─── 4. Removed-article redirects (2026-09-15 post-launch correction) ─────

test('each removed article URL permanently redirects to the landing page, and no article content is reachable', async () => {
  const page = await browser.newPage()
  try {
    for (const oldUrl of REMOVED_ARTICLE_URLS) {
      const response = await page.goto(`${baseUrl}${oldUrl}`, { waitUntil: 'load' })
      const chain = response?.request().redirectChain() ?? []
      assert.ok(chain.length >= 1, `${oldUrl} should redirect (not just resolve directly)`)
      assert.equal(chain[0].response()?.status(), 308, `${oldUrl} should redirect with a permanent (308) status`)
      assert.equal(chain[0].response()?.headers()['location'], '/bakery-pricing-guide', `${oldUrl} should redirect to /bakery-pricing-guide`)

      const finalTitle = await page.title()
      assert.match(finalTitle, /Free Bakery Pricing Calculator/, `${oldUrl} should land on the calculator's landing page`)
    }
  } finally {
    await page.close()
  }
})

test('the four removed articles\' .html files no longer exist in the production build', async () => {
  for (const removedHtmlFile of [
    '/bakery-pricing-for-profit.html',
    '/bakery-food-cost-vs-margin.html',
    '/bakery-labor-cost.html',
    '/bakery-packaging-waste-overhead.html',
  ]) {
    const res = await fetch(`${baseUrl}${removedHtmlFile}`)
    assert.equal(res.status, 404, `${removedHtmlFile} should no longer exist in the build (a redirect only covers the clean URL, not the raw .html file)`)
  }
})

// ─── 5. Structured data ─────────────────────────────────────────────────────

test('the calculator page carries valid WebApplication JSON-LD, describing it as free', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/tools-bakery-pricing.html`, { waitUntil: 'load' })
    const jsonLd = await page.$eval('script[type="application/ld+json"]', el => el.textContent || '')
    const parsed = JSON.parse(jsonLd)
    assert.equal(parsed['@type'], 'WebApplication')
    assert.equal(parsed.name, 'Free Bakery Pricing Calculator')
    assert.equal(parsed.offers.price, '0')
    assert.ok(parsed.description.length > 20)
  } finally {
    await page.close()
  }
})

// ─── 6. Accessibility & responsive on the landing page ─────────────────────

test('no horizontal overflow at 320px on the landing page', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 320, height: 900 })
    for (const { path: p } of NEW_PAGES) {
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      assert.equal(overflow, false, `${p} overflows at 320px`)
    }
  } finally {
    await page.close()
  }
})

test('the sales CTA and cross-link on the calculator meet 44px touch targets and are labeled', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 375, height: 900 })
    await page.goto(`${baseUrl}/tools-bakery-pricing.html`, { waitUntil: 'load' })
    await page.waitForSelector('#bp-yield')
    await page.evaluate(() => {
      const input = document.querySelector('#bp-yield') as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '12')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.click('.bp-btn-ghost')
    await page.waitForSelector('#bp-ing-name')
    await page.type('#bp-ing-name', 'Flour')
    await page.keyboard.press('Escape')
    await page.type('#bp-ing-price', '3.49')
    await page.type('#bp-ing-pkg-qty', '5')
    await (await page.$('select[aria-label="Package amount unit"]'))!.select('lb')
    await page.type('#bp-ing-use-qty', '2')
    await (await page.$('select[aria-label="Amount used unit"]'))!.select('lb')
    await page.click('.bp-add-ingredient-form .bp-btn-primary')
    await page.waitForSelector('.bp-ingredient-row')
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('#bp-labor-rate')
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('.tool-sales-cta')

    const ctaLinkHeight = await page.$eval('.tool-sales-cta-link', el => el.getBoundingClientRect().height)
    assert.ok(ctaLinkHeight >= 44, `CTA link height ${ctaLinkHeight} below 44px`)
    const crossLinkText = await page.$eval('.bp-cross-link-note', el => el.textContent || '')
    assert.match(crossLinkText, /Custom Bakery Order Planner/)
  } finally {
    await page.close()
  }
})
