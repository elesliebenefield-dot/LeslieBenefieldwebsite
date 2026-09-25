// Homepage structure, Tools band, and portfolio — integration tests.
// Verifies the section order, the approved hero copy, the three "What I
// Build" cards, the Tools band's demo thumbnail (moved from the old Work-grid
// demos card), the /services#interactive-tool-demos anchor, no horizontal
// overflow at desktop and 320px, and that client project cards are unchanged.
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

// ─── 1. Homepage structure: hero, What I Build, Tools band, Work ──────────────

test('homepage sections appear in order: hero, services, tools, work, about, contact — and Process is no longer on the homepage', async () => {
  const page = await openHome()
  try {
    const ids = await page.$$eval('main > section', els => els.map(el => el.id))
    assert.deepEqual(ids, ['hero', 'services', 'tools', 'work', 'about', 'contact'])
    assert.equal(await page.$('#process'), null, 'Process should live on /services, not the homepage')
  } finally {
    await page.close()
  }
})

test('hero copy and buttons match the approved Option A wording', async () => {
  const page = await openHome()
  try {
    const hero = await page.$eval('#hero', el => ({
      eyebrow: el.querySelector('.hero-eyebrow')?.textContent?.trim(),
      headline: el.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
      copy: el.querySelector('.hero-copy')?.textContent?.replace(/\s+/g, ' ').trim(),
      buttons: Array.from(el.querySelectorAll('.hero-ctas a')).map(a => ({ text: a.textContent?.trim(), href: a.getAttribute('href') })),
    }))
    assert.equal(hero.eyebrow, "Hi, I'm Leslie.")
    assert.equal(hero.headline, 'Websites, custom tools, and automation for small businesses.')
    assert.equal(hero.copy, 'I build clear, mobile-friendly websites and practical tools that help customers reach you and take busywork off your plate.')
    assert.deepEqual(hero.buttons, [
      { text: 'See My Work', href: '#work' },
      { text: 'Explore Business Tools', href: '/business-tools' },
    ])
  } finally {
    await page.close()
  }
})

test('What I Build has exactly three cards — Websites, Custom Business Tools, Automation — each with a link', async () => {
  const page = await openHome()
  try {
    const cards = await page.$$eval('#services .service-card', els => els.map(el => ({
      title: el.querySelector('.service-title')?.textContent?.trim(),
      desc: el.querySelector('.service-desc')?.textContent?.trim(),
      href: el.querySelector('a.service-link')?.getAttribute('href'),
    })))
    assert.deepEqual(cards.map(c => c.title), ['Websites', 'Custom Business Tools', 'Automation'])
    assert.equal(cards[0].href, '/services')
    assert.equal(cards[1].href, '#tools')
    assert.match(cards[2].href ?? '', /^https:\/\/docs\.google\.com\/forms\//, 'Automation card links to the existing quote form')
    assert.equal(cards[2].desc, 'Custom workflows and simple automations that reduce repetitive business tasks.')
  } finally {
    await page.close()
  }
})

test('Tools band shows the four-panel demo thumbnail (bakery, plumbing, food truck, real estate)', async () => {
  const page = await openHome()
  try {
    const labels = await page.$$eval('#tools .demo-thumb-label', els => els.map(el => el.textContent?.trim()))
    assert.deepEqual(labels, ['Bakery', 'Plumbing', 'Food Truck', 'Real Estate'])
    const thumbHidden = await page.$eval('#tools .tools-band-thumb', el => el.getAttribute('aria-hidden'))
    assert.equal(thumbHidden, 'true', 'the thumbnail is decorative')
  } finally {
    await page.close()
  }
})

test('work grid holds only the three real projects (the demos card moved to the Tools band)', async () => {
  const page = await openHome()
  try {
    const titles = await page.$$eval('.work-card-title', els => els.map(el => el.textContent?.trim()))
    assert.deepEqual(titles, ["Ashley's Pet Care", "Sissy's Sweets by EM", 'MosaicTessera'])
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

test('content moved off the homepage now lives on /services: setup support, Process, and Who I Work With', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const support = await page.$eval('.services-support', el => el.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    assert.match(support, /^Helpful setup support — Depending on the project, I can also help with domain setup/)
    const steps = await page.$$eval('#process .process-title', els => els.map(el => el.textContent?.trim()))
    assert.deepEqual(steps, ["Let's Talk", 'Planning & Discovery', 'Design & Content', 'Build & Refine', 'Launch'])
    const fit = await page.$eval('#who-i-work-with', el => ({
      title: el.querySelector('h2')?.textContent?.trim(),
      groups: Array.from(el.querySelectorAll('.fit-group-title')).map(g => g.textContent?.trim()),
      text: el.textContent ?? '',
    }))
    assert.equal(fit.title, 'A great fit for')
    assert.deepEqual(fit.groups, ['Local & professional services', 'Food, retail & local business', 'Personal, creative & community work'])
    assert.match(fit.text, /bartering services when it makes sense for both of us/)
  } finally {
    await page.close()
  }
})

test('loading /services#process scrolls the Process section into view', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(`${baseUrl}/services.html#process`, { waitUntil: 'load' })
    await new Promise(r => setTimeout(r, 500))
    const top = await page.$eval('#process', el => el.getBoundingClientRect().top)
    assert.ok(Math.abs(top - 64) < 40, `#process should sit just under the sticky nav, got top=${top}`)
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
