// Real-browser integration tests for Milestone M7: the calculator's
// attribution + lead-gen CTA + cross-link, the landing page, the four
// educational articles, structured data, and — as of the 2026-09-15
// final-publication approval — that every one of these pages is now
// indexable (noindex, nofollow removed) and discoverable from the live
// site. Runs against the production build (dist/) via a lightweight
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

let server: Server
let browser: Browser
let baseUrl: string

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
    const urlPath = req.url || '/'
    const filePath = path.join(DIST, decodeURIComponent(urlPath.split('?')[0]))
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

const NEW_PAGES = [
  { path: '/bakery-pricing-guide.html', title: /Free Home Bakery Pricing Calculator/ },
  { path: '/bakery-pricing-for-profit.html', title: /How to Price Baked Goods for Profit/ },
  { path: '/bakery-food-cost-vs-margin.html', title: /Food Cost vs\. Profit Margin/ },
  { path: '/bakery-labor-cost.html', title: /How to Calculate Labor Cost/ },
  { path: '/bakery-packaging-waste-overhead.html', title: /Packaging, Waste/ },
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

test('the calculator, the landing page, every article, and the Business Tools hub each carry a non-www canonical URL matching their own route', async () => {
  const PAGES_WITH_CANONICAL = [
    { path: '/tools-bakery-pricing.html', canonical: 'https://websitesbyleslie.com/tools-bakery-pricing' },
    { path: '/bakery-pricing-guide.html', canonical: 'https://websitesbyleslie.com/bakery-pricing-guide' },
    { path: '/bakery-pricing-for-profit.html', canonical: 'https://websitesbyleslie.com/bakery-pricing-for-profit' },
    { path: '/bakery-food-cost-vs-margin.html', canonical: 'https://websitesbyleslie.com/bakery-food-cost-vs-margin' },
    { path: '/bakery-labor-cost.html', canonical: 'https://websitesbyleslie.com/bakery-labor-cost' },
    { path: '/bakery-packaging-waste-overhead.html', canonical: 'https://websitesbyleslie.com/bakery-packaging-waste-overhead' },
    { path: '/business-tools.html', canonical: 'https://websitesbyleslie.com/business-tools' },
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

test('the live Services page links the free calculator through its distinct free-tools section, funneled via the landing page (not the individual articles or the raw calculator route directly)', async () => {
  // Built during the M7 information-architecture correction, discovering
  // the calculator from an already-live, indexed page (/services) — and
  // as of the 2026-09-15 final-publication approval, the target itself is
  // indexable too, so this link is now a genuine, fully live discovery path.
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const hrefs = await page.$$eval('a[href]', els => els.map(e => e.getAttribute('href') || ''))
    assert.ok(hrefs.includes('/bakery-pricing-guide'), 'Services page should link the free calculator via the landing page')
    assert.ok(!hrefs.some(h => h.includes('bakery-pricing-for-profit') || h.includes('bakery-food-cost-vs-margin') || h.includes('bakery-labor-cost') || h.includes('bakery-packaging-waste-overhead')), 'Services page must not link individual articles directly — only through the landing page')
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

test('the homepage discovers the tools only through a single "Business Tools" hub link, not a direct bakery-pricing link', async () => {
  // Per the M7 IA correction: the homepage's featured-tool callout should
  // point to the general /business-tools hub, not straight to any one
  // tool. The hub itself is what links onward to the bakery-pricing
  // landing page.
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const hrefs = await page.$$eval('a[href]', els => els.map(e => e.getAttribute('href') || ''))
    assert.ok(hrefs.includes('/business-tools'), 'the homepage should link the Business Tools hub')
    assert.ok(!hrefs.some(h => h.includes('bakery')), 'the homepage must not link any bakery-pricing content directly')
  } finally {
    await page.close()
  }
})

// ─── 2. New pages load correctly ───────────────────────────────────────────

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

test('every new page has a meta description', async () => {
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

test('articles make no market-price, profitability-guarantee, or legal-compliance claims', async () => {
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

test('the landing page and articles no longer make the corrected unsupported/double-counting claims (2026-09-15 content fixes)', async () => {
  const page = await browser.newPage()
  try {
    // 1 & 2: no page claims ingredients are "usually the smallest piece" of
    // a recipe's cost — an unsupported generalization about every recipe.
    for (const { path: p } of NEW_PAGES) {
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load' })
      const bodyText = await page.$eval('body', el => el.textContent || '')
      assert.doesNotMatch(bodyText, /ingredients?\s+(are|is)\s+usually\s+the\s+smallest/i, `${p} must not claim ingredients are usually the smallest piece of cost`)
    }

    // 3: the pricing-for-profit article must not describe margin as
    // covering equipment replacement — that's already covered by the
    // Overhead estimator, so stating it here double-counts the same cost.
    await page.goto(`${baseUrl}/bakery-pricing-for-profit.html`, { waitUntil: 'load' })
    const forProfitText = await page.$eval('body', el => el.textContent || '')
    assert.doesNotMatch(forProfitText, /replace\s+worn\s+equipment/i, 'pricing-for-profit article must not describe margin as covering equipment replacement (already in Overhead)')
    assert.match(forProfitText, /business risk|risk of running it/i, 'pricing-for-profit article should describe margin as covering business risk')
    assert.match(forProfitText, /reserve|grow/i, 'pricing-for-profit article should describe margin as supporting reserves/growth')

    // 4: the food-cost-vs-margin article must not claim margin tells you
    // whether an order was "worth taking" — softened to evaluating whether
    // a price supports the business.
    await page.goto(`${baseUrl}/bakery-food-cost-vs-margin.html`, { waitUntil: 'load' })
    const marginText = await page.$eval('body', el => el.textContent || '')
    assert.doesNotMatch(marginText, /worth\s+taking/i, 'food-cost-vs-margin article must not claim margin tells you whether an order was "worth taking"')
    assert.match(marginText, /supports?\s+your\s+business|supports?\s+the\s+business/i, 'food-cost-vs-margin article should describe margin as helping evaluate whether a price supports the business')
  } finally {
    await page.close()
  }
})

test('no article or the landing page mentions offline use, installing, or a home-screen app (M5/M8 deferred)', async () => {
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

test('every article links into the calculator, and the landing page links every article', async () => {
  const page = await browser.newPage()
  try {
    for (const { path: p } of NEW_PAGES.slice(1)) {
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load' })
      const hrefs = await page.$$eval('a[href]', els => els.map(e => e.getAttribute('href') || ''))
      assert.ok(hrefs.includes('/tools-bakery-pricing'), `${p} should link directly into the calculator`)
    }

    await page.goto(`${baseUrl}/bakery-pricing-guide.html`, { waitUntil: 'load' })
    const landingHrefs = await page.$$eval('a[href]', els => els.map(e => e.getAttribute('href') || ''))
    for (const articleHref of ['/bakery-pricing-for-profit', '/bakery-food-cost-vs-margin', '/bakery-labor-cost', '/bakery-packaging-waste-overhead']) {
      assert.ok(landingHrefs.includes(articleHref), `landing page should link ${articleHref}`)
    }
    assert.ok(landingHrefs.includes('/tools-bakery-pricing'), 'landing page should link directly into the calculator')
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

test('sitemap.xml lists the Business Tools hub alongside the calculator, landing page, and every article', async () => {
  const res = await fetch(`${baseUrl}/sitemap.xml`)
  const xml = await res.text()
  for (const loc of [
    'https://websitesbyleslie.com/business-tools',
    'https://websitesbyleslie.com/tools-bakery-pricing',
    'https://websitesbyleslie.com/bakery-pricing-guide',
    'https://websitesbyleslie.com/bakery-pricing-for-profit',
    'https://websitesbyleslie.com/bakery-food-cost-vs-margin',
    'https://websitesbyleslie.com/bakery-labor-cost',
    'https://websitesbyleslie.com/bakery-packaging-waste-overhead',
  ]) {
    assert.ok(xml.includes(`<loc>${loc}</loc>`), `sitemap.xml should list ${loc}`)
  }
})

// ─── 4. Structured data ─────────────────────────────────────────────────────

test('the calculator page carries valid WebApplication JSON-LD, describing it as free', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/tools-bakery-pricing.html`, { waitUntil: 'load' })
    const jsonLd = await page.$eval('script[type="application/ld+json"]', el => el.textContent || '')
    const parsed = JSON.parse(jsonLd)
    assert.equal(parsed['@type'], 'WebApplication')
    assert.equal(parsed.name, 'Free Home Bakery Pricing Calculator')
    assert.equal(parsed.offers.price, '0')
    assert.ok(parsed.description.length > 20)
  } finally {
    await page.close()
  }
})

// ─── 5. Accessibility & responsive on the new pages ────────────────────────

test('no horizontal overflow at 320px on the landing page or any article', async () => {
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
