// Homepage portfolio demos card — integration tests.
// Verifies the new "Interactive Tools for Small Businesses" featured card in
// the Work section: correct status label, title, description, button text,
// and link destination; the anchor target on the Services page; no horizontal
// overflow at desktop and 320px; and that existing client project cards are
// unchanged.
//
// Runs against the real production build (dist/, always rebuilt fresh — see
// the before() hook) in a real browser via Puppeteer. No live network access.
//
// Run with: node --test test/homepageDemosCard.test.ts

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
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg':  'image/jpeg',
  '.png':  'image/png',
}

let server: Server
let browser: Browser
let baseUrl: string

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
    const urlPath = req.url || '/'
    const filePath = urlPath === '/'
      ? path.join(DIST, 'index.html')
      : path.join(DIST, decodeURIComponent(urlPath.split('?')[0]))
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

async function openHome(viewport = 1280): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width: viewport, height: 900 })
  await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
  return page
}

// ─── 1. Card presence and content ────────────────────────────────────────────

test('work grid has four cards after adding the demos card', async () => {
  const page = await openHome()
  try {
    const cards = await page.$$('.work-card')
    assert.equal(cards.length, 4, `Expected 4 .work-card elements, got ${cards.length}`)
  } finally {
    await page.close()
  }
})

test('demos card status badge reads "LIVE DEMOS" (uppercased by CSS)', async () => {
  const page = await openHome()
  try {
    const statuses = await page.$$eval('.work-card-status', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(statuses.some(s => /live demos/i.test(s)), `Expected a "Live Demos" status badge, got: ${JSON.stringify(statuses)}`)
  } finally {
    await page.close()
  }
})

test('demos card title is "Interactive Tools for Small Businesses"', async () => {
  const page = await openHome()
  try {
    const titles = await page.$$eval('.work-card-title', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(
      titles.some(t => /interactive tools for small businesses/i.test(t)),
      `Expected demos card title, got: ${JSON.stringify(titles)}`
    )
  } finally {
    await page.close()
  }
})

test('demos card description mentions bakeries, plumbing, food trucks, and real estate', async () => {
  const page = await openHome()
  try {
    const descs = await page.$$eval('.work-card-desc', els => els.map(el => el.textContent?.trim() ?? ''))
    const demosDesc = descs.find(d => /bakeries/i.test(d)) ?? ''
    assert.ok(demosDesc.length > 0, 'Could not find demos card description')
    assert.match(demosDesc, /plumbing/i)
    assert.match(demosDesc, /food truck/i)
    assert.match(demosDesc, /real estate/i)
  } finally {
    await page.close()
  }
})

test('demos card button text is "Explore the Demos"', async () => {
  const page = await openHome()
  try {
    const links = await page.$$eval('.work-card-link', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(links.some(l => /explore the demos/i.test(l)), `Expected "Explore the Demos" button, got: ${JSON.stringify(links)}`)
  } finally {
    await page.close()
  }
})

test('demos card link destination is /services#interactive-tool-demos', async () => {
  const page = await openHome()
  try {
    const hrefs = await page.$$eval('.work-card-link', els => els.map(el => el.getAttribute('href') ?? ''))
    assert.ok(
      hrefs.some(h => h === '/services#interactive-tool-demos'),
      `Expected href "/services#interactive-tool-demos", got: ${JSON.stringify(hrefs)}`
    )
  } finally {
    await page.close()
  }
})

test('demos card link does not open in a new tab (it is an internal anchor)', async () => {
  const page = await openHome()
  try {
    // Find the demos card link specifically (by href)
    const target = await page.$eval(
      'a.work-card-link[href="/services#interactive-tool-demos"]',
      el => el.getAttribute('target') ?? ''
    )
    assert.notEqual(target, '_blank', 'Internal anchor link must not open in a new tab')
  } finally {
    await page.close()
  }
})

// ─── 2. Clearly identified as a demonstration, not client work ─────────────────

test('demos card does not use "Client Project", "Live Website", or "Live on Google Play" as its status', async () => {
  const page = await openHome()
  try {
    const demoLinkEl = await page.$('a.work-card-link[href="/services#interactive-tool-demos"]')
    assert.ok(demoLinkEl, 'Demos card link not found')
    const card = await page.evaluateHandle(el => el.closest('.work-card'), demoLinkEl)
    const status = await page.evaluate(el => el?.querySelector('.work-card-status')?.textContent?.trim() ?? '', card)
    assert.ok(!/client project/i.test(status), `Demos card must not say "Client Project", got: "${status}"`)
    assert.ok(!/^live website$/i.test(status), `Demos card must not say "Live Website", got: "${status}"`)
    assert.ok(!/google play/i.test(status), `Demos card must not say "Live on Google Play", got: "${status}"`)
  } finally {
    await page.close()
  }
})

// ─── 3. Anchor exists on the Services page ───────────────────────────────────

test('Services page has id="interactive-tool-demos" on the showcase section', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const el = await page.$('#interactive-tool-demos')
    assert.ok(el, 'Element with id="interactive-tool-demos" not found on services.html')
  } finally {
    await page.close()
  }
})

test('id="interactive-tool-demos" is on the section containing the four demo cards', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const hasDemoCards = await page.evaluate(() => {
      const section = document.getElementById('interactive-tool-demos')
      return !!section?.querySelector('.pricing-demo-card')
    })
    assert.ok(hasDemoCards, '#interactive-tool-demos section must contain .pricing-demo-card elements')
  } finally {
    await page.close()
  }
})

// ─── 4. Existing client project cards unchanged ───────────────────────────────

test("Ashley's Pet Care card is still present with its external link", async () => {
  const page = await openHome()
  try {
    const titles = await page.$$eval('.work-card-title', els => els.map(el => el.textContent?.trim() ?? ''))
    const hrefs  = await page.$$eval('.work-card-link',  els => els.map(el => el.getAttribute('href') ?? ''))
    assert.ok(titles.some(t => /ashley/i.test(t)), "Ashley's Pet Care card must be present")
    assert.ok(hrefs.some(h => h.includes('ashleys-pet-care')), "Ashley's Pet Care link must be present")
  } finally {
    await page.close()
  }
})

test("Sissy's Sweets card is still present with its external link", async () => {
  const page = await openHome()
  try {
    const titles = await page.$$eval('.work-card-title', els => els.map(el => el.textContent?.trim() ?? ''))
    const hrefs  = await page.$$eval('.work-card-link',  els => els.map(el => el.getAttribute('href') ?? ''))
    assert.ok(titles.some(t => /sissy/i.test(t)), "Sissy's Sweets card must be present")
    assert.ok(hrefs.some(h => h.includes('sissyssweets')), "Sissy's Sweets link must be present")
  } finally {
    await page.close()
  }
})

test('MosaicTessera card is still present with its external link', async () => {
  const page = await openHome()
  try {
    const titles = await page.$$eval('.work-card-title', els => els.map(el => el.textContent?.trim() ?? ''))
    const hrefs  = await page.$$eval('.work-card-link',  els => els.map(el => el.getAttribute('href') ?? ''))
    assert.ok(titles.some(t => /mosaic/i.test(t)), 'MosaicTessera card must be present')
    assert.ok(hrefs.some(h => h.includes('mosaictessera')), 'MosaicTessera link must be present')
  } finally {
    await page.close()
  }
})

// ─── 5. No horizontal overflow ────────────────────────────────────────────────

for (const viewport of [320, 1280]) {
  test(`no horizontal overflow on homepage at ${viewport}px`, async () => {
    const page = await openHome(viewport)
    try {
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
      assert.ok(overflow <= 0, `Horizontal overflow of ${overflow}px at ${viewport}px`)
    } finally {
      await page.close()
    }
  })
}

test('work grid cards do not overflow their container at 320px', async () => {
  const page = await openHome(320)
  try {
    const overflow = await page.evaluate(() => {
      const grid = document.querySelector('.work-grid')
      if (!grid) return 0
      const gr = grid.getBoundingClientRect()
      return Array.from(grid.querySelectorAll('.work-card')).reduce((max, card) => {
        const cr = card.getBoundingClientRect()
        return Math.max(max, Math.round((cr.right - gr.right) * 10) / 10)
      }, 0)
    })
    assert.ok(overflow <= 1, `Work card overflows grid by ${overflow}px at 320px`)
  } finally {
    await page.close()
  }
})

test('work grid cards do not overflow their container at 1280px', async () => {
  const page = await openHome(1280)
  try {
    const overflow = await page.evaluate(() => {
      const grid = document.querySelector('.work-grid')
      if (!grid) return 0
      const gr = grid.getBoundingClientRect()
      return Array.from(grid.querySelectorAll('.work-card')).reduce((max, card) => {
        const cr = card.getBoundingClientRect()
        return Math.max(max, Math.round((cr.right - gr.right) * 10) / 10)
      }, 0)
    })
    assert.ok(overflow <= 1, `Work card overflows grid by ${overflow}px at 1280px`)
  } finally {
    await page.close()
  }
})

// ─── 6. Services page demo cards unchanged by anchor addition ─────────────────

test('Services page still has exactly four .pricing-demo-card elements', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const cards = await page.$$('.pricing-demo-card')
    assert.equal(cards.length, 4, `Expected 4 .pricing-demo-card elements, got ${cards.length}`)
  } finally {
    await page.close()
  }
})
