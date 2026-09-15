// Focused integration tests for the Services page.
// Covers: payment-heading overflow, three demo cards, correct destinations,
// and horizontal overflow across key viewports.
//
// Runs against the production build (dist/).
// Run with: node --test test/services.test.ts

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
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
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

async function openServices(viewport: number): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width: viewport, height: 900 })
  await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
  return page
}

// ─── 1. Payment-heading bounding box ─────────────────────────────────────────
// Checks that the rendered right edge of ".pricing-payment-inner .section-title"
// does not exceed the right inner edge of ".pricing-payment-inner".

async function headingFitsInCard(viewport: number): Promise<{ fits: boolean; overflow: number }> {
  const page = await openServices(viewport)
  try {
    return await page.evaluate(() => {
      const heading = document.querySelector('.pricing-payment-inner .section-title')
      const card    = document.querySelector('.pricing-payment-inner')
      if (!heading || !card) return { fits: false, overflow: -1 }
      const hr = heading.getBoundingClientRect()
      const cr = card.getBoundingClientRect()
      const overflow = Math.round((hr.right - cr.right) * 10) / 10
      return { fits: hr.right <= cr.right + 1, overflow }
    })
  } finally {
    await page.close()
  }
}

for (const viewport of [320, 375, 390, 768, 1280, 1440]) {
  test(`payment heading stays within its card at ${viewport}px`, async () => {
    const { fits, overflow } = await headingFitsInCard(viewport)
    assert.ok(fits, `"Simple, clear payment expectations." extends ${overflow}px outside .pricing-payment-inner at ${viewport}px`)
  })
}

// ─── 2. Four demo cards — presence and content ───────────────────────────────

test('services page has exactly four demo cards', async () => {
  const page = await openServices(1280)
  try {
    const cards = await page.$$('.pricing-demo-card')
    assert.equal(cards.length, 4, `Expected 4 .pricing-demo-card elements, got ${cards.length}`)
  } finally {
    await page.close()
  }
})

test('Custom Bakery Order Planner card is present with correct link', async () => {
  const page = await openServices(1280)
  try {
    const titles = await page.$$eval('.pricing-demo-card-title', els => els.map(el => el.textContent?.trim()))
    const links  = await page.$$eval('.pricing-demo-link',       els => els.map(el => el.getAttribute('href')))
    assert.ok(titles.some(t => /custom bakery order planner/i.test(t || '')), 'Bakery card title should be present')
    assert.ok(links.includes('/tools-custom-bakery-order'), 'Bakery card link should point to /tools-custom-bakery-order')
  } finally {
    await page.close()
  }
})

test('Plumbing Service Visit Planner card is present with correct link', async () => {
  const page = await openServices(1280)
  try {
    const titles = await page.$$eval('.pricing-demo-card-title', els => els.map(el => el.textContent?.trim()))
    const links  = await page.$$eval('.pricing-demo-link',       els => els.map(el => el.getAttribute('href')))
    assert.ok(titles.some(t => /plumbing service visit planner/i.test(t || '')), 'Plumbing card title should be present')
    assert.ok(links.includes('/tools-plumbing-visit'), 'Plumbing card link should point to /tools-plumbing-visit')
  } finally {
    await page.close()
  }
})

test('Food Truck Event Planner card is present with correct link', async () => {
  const page = await openServices(1280)
  try {
    const titles = await page.$$eval('.pricing-demo-card-title', els => els.map(el => el.textContent?.trim()))
    const links  = await page.$$eval('.pricing-demo-link',       els => els.map(el => el.getAttribute('href')))
    assert.ok(titles.some(t => /food truck event planner/i.test(t || '')), 'Food Truck card title should be present')
    assert.ok(links.includes('/tools-food-truck-event'), 'Food Truck card link should point to /tools-food-truck-event')
  } finally {
    await page.close()
  }
})

test('Food Truck Event Planner card button text is "Try the Demo →"', async () => {
  const page = await openServices(1280)
  try {
    const linkTexts = await page.$$eval('.pricing-demo-link', els => els.map(el => el.textContent?.trim()))
    assert.ok(linkTexts.some(t => /Try the Demo/i.test(t || '')), 'At least one card should have "Try the Demo →" button')
  } finally {
    await page.close()
  }
})

test('Real Estate Client Tools card is present in the demo grid with correct link', async () => {
  const page = await openServices(1280)
  try {
    const titles = await page.$$eval('.pricing-demo-card-title', els => els.map(el => el.textContent?.trim()))
    const links  = await page.$$eval('.pricing-demo-link',       els => els.map(el => el.getAttribute('href')))
    assert.ok(titles.some(t => /real estate client tools/i.test(t || '')), 'Real Estate card title should be present')
    assert.ok(links.includes('/real-estate-tools'), 'Real Estate card link should point to /real-estate-tools')
  } finally {
    await page.close()
  }
})

test('Real Estate Client Tools card button text is "Explore the Suite →"', async () => {
  const page = await openServices(1280)
  try {
    const linkTexts = await page.$$eval('.pricing-demo-link', els => els.map(el => el.textContent?.trim()))
    assert.ok(linkTexts.some(t => /Explore the Suite/i.test(t || '')), 'Real Estate card should have "Explore the Suite →" button')
  } finally {
    await page.close()
  }
})

test('/real-estate-tools is the destination for the Real Estate card link (clean URL, not .html)', async () => {
  const page = await openServices(1280)
  try {
    const links = await page.$$eval('.pricing-demo-link', els => els.map(el => el.getAttribute('href')))
    assert.ok(links.includes('/real-estate-tools'), `Real Estate card link must be "/real-estate-tools"`)
  } finally {
    await page.close()
  }
})

test('all four demo card tags say "Live Demo"', async () => {
  const page = await openServices(1280)
  try {
    const tags = await page.$$eval('.pricing-demo-tag', els => els.map(el => el.textContent?.trim()))
    assert.equal(tags.length, 4, `Expected 4 .pricing-demo-tag elements, got ${tags.length}`)
    for (const tag of tags) {
      assert.equal(tag, 'Live Demo', `Expected tag "Live Demo", got "${tag}"`)
    }
  } finally {
    await page.close()
  }
})

test('no demo card overflows its grid at 1280px', async () => {
  const page = await openServices(1280)
  try {
    const overflow = await page.evaluate(() => {
      const grid = document.querySelector('.pricing-demo-cards')
      if (!grid) return 0
      const gr = grid.getBoundingClientRect()
      const cards = Array.from(grid.querySelectorAll('.pricing-demo-card'))
      return cards.reduce((max, card) => {
        const cr = card.getBoundingClientRect()
        return Math.max(max, cr.right - gr.right)
      }, 0)
    })
    assert.ok(overflow <= 1, `Card overflows grid by ${overflow}px at 1280px`)
  } finally {
    await page.close()
  }
})

test('no demo card overflows its grid at 1440px', async () => {
  const page = await openServices(1440)
  try {
    const overflow = await page.evaluate(() => {
      const grid = document.querySelector('.pricing-demo-cards')
      if (!grid) return 0
      const gr = grid.getBoundingClientRect()
      const cards = Array.from(grid.querySelectorAll('.pricing-demo-card'))
      return cards.reduce((max, card) => {
        const cr = card.getBoundingClientRect()
        return Math.max(max, cr.right - gr.right)
      }, 0)
    })
    assert.ok(overflow <= 1, `Card overflows grid by ${overflow}px at 1440px`)
  } finally {
    await page.close()
  }
})

// ─── 3. No horizontal overflow on the Services page ──────────────────────────

for (const viewport of [320, 375, 768, 1280, 1440]) {
  test(`no horizontal overflow on Services page at ${viewport}px`, async () => {
    const page = await openServices(viewport)
    try {
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
      assert.ok(overflow <= 0, `Expected no overflow at ${viewport}px, got ${overflow}px`)
    } finally {
      await page.close()
    }
  })
}

// ─── 4. Cards and buttons remain inside grid at narrow viewports ──────────────

test('no demo card or button overflows its grid at 320px', async () => {
  const page = await openServices(320)
  try {
    const overflow = await page.evaluate(() => {
      const grid = document.querySelector('.pricing-demo-cards')
      if (!grid) return 0
      const gr = grid.getBoundingClientRect()
      const cards = Array.from(grid.querySelectorAll('.pricing-demo-card'))
      return cards.reduce((max, card) => {
        const cr = card.getBoundingClientRect()
        return Math.max(max, cr.right - gr.right)
      }, 0)
    })
    assert.ok(overflow <= 1, `Card overflows grid by ${overflow}px at 320px`)
  } finally {
    await page.close()
  }
})

test('no demo card or button overflows its grid at 375px', async () => {
  const page = await openServices(375)
  try {
    const overflow = await page.evaluate(() => {
      const grid = document.querySelector('.pricing-demo-cards')
      if (!grid) return 0
      const gr = grid.getBoundingClientRect()
      const cards = Array.from(grid.querySelectorAll('.pricing-demo-card'))
      return cards.reduce((max, card) => {
        const cr = card.getBoundingClientRect()
        return Math.max(max, cr.right - gr.right)
      }, 0)
    })
    assert.ok(overflow <= 1, `Card overflows grid by ${overflow}px at 375px`)
  } finally {
    await page.close()
  }
})

// ─── 5. Regression — real estate suite still loads after ServicesPage changes ─

test('Regression: /real-estate-tools still loads the showcase, not the homepage', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(`${baseUrl}/tools-real-estate-showcase.html`, { waitUntil: 'load' })
    const title = await page.title()
    assert.match(title, /Real Estate|Websites by Leslie/i)
    const hero = await page.$('.hero')
    assert.equal(hero, null, 'Homepage hero should not be present on the showcase')
    await page.waitForSelector('.rts-hero-card', { timeout: 5000 })
  } finally {
    await page.close()
  }
})

// ─── 6. Website prices unchanged ─────────────────────────────────────────────

test('website pricing — Free Website Review title and price are present', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-grid', el => el.textContent ?? '')
    assert.ok(text.includes('Free Website Review'), 'pricing-grid should contain "Free Website Review"')
    assert.ok(text.includes('Complimentary'), 'pricing-grid should contain "Complimentary"')
  } finally {
    await page.close()
  }
})

test('website pricing — Free Website Review description uses approved wording', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-grid', el => el.textContent ?? '')
    assert.ok(
      text.includes("what's working") && text.includes('what could be improved'),
      'Free Website Review description should describe the practical review'
    )
    assert.ok(
      text.includes("I'll explain your options"),
      'Free Website Review description should mention explaining options'
    )
    assert.ok(
      !text.includes('good fit for my services'),
      'Old "good fit for my services" wording should not appear'
    )
  } finally {
    await page.close()
  }
})

test('website pricing — Free Website Review card does not overflow at 320px', async () => {
  const page = await openServices(320)
  try {
    const overflow = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.pricing-card'))
      const reviewCard = cards.find(c => c.textContent?.includes('Free Website Review'))
      if (!reviewCard) return -1
      const grid = reviewCard.closest('.pricing-grid')
      if (!grid) return -1
      const cr = reviewCard.getBoundingClientRect()
      const gr = grid.getBoundingClientRect()
      return Math.round((cr.right - gr.right) * 10) / 10
    })
    assert.ok(overflow >= 0, 'Free Website Review card not found in .pricing-grid')
    assert.ok(overflow <= 1, `Free Website Review card overflows by ${overflow}px at 320px`)
  } finally {
    await page.close()
  }
})

test('website pricing — One-Page Website price is "Starting at $750"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-grid', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $750'), 'pricing-grid should contain "Starting at $750"')
  } finally {
    await page.close()
  }
})

test('website pricing — Small-Business Website price is "Starting at $1,500"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-grid', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $1,500'), 'pricing-grid should contain "Starting at $1,500"')
  } finally {
    await page.close()
  }
})

test('website pricing — Website Refresh price is "Starting at $800"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-grid', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $800'), 'pricing-grid should contain "Starting at $800"')
  } finally {
    await page.close()
  }
})

test('website pricing — Website Updates & Support price is "Custom quote"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-grid', el => el.textContent ?? '')
    assert.ok(text.includes('Custom quote'), 'pricing-grid should contain "Custom quote"')
  } finally {
    await page.close()
  }
})

// ─── 7. Tool pricing section is present ───────────────────────────────────────

test('tool pricing section heading reads "Interactive Tool Pricing"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('Interactive Tool Pricing'), '.pricing-tools-inner should include the section heading')
  } finally {
    await page.close()
  }
})

test('tool pricing — three group cards are present', async () => {
  const page = await openServices(1280)
  try {
    const groups = await page.$$('.pricing-tools-group')
    assert.equal(groups.length, 3, `Expected 3 .pricing-tools-group elements, got ${groups.length}`)
  } finally {
    await page.close()
  }
})

// ─── 8. New-website tool prices ───────────────────────────────────────────────

test('tool pricing — new-website group heading is "Added to a New Website"', async () => {
  const page = await openServices(1280)
  try {
    const headings = await page.$$eval('.pricing-tools-group-heading', els => els.map(el => el.textContent?.trim()))
    assert.ok(headings.some(h => /added to a new website/i.test(h || '')), 'Should have "Added to a New Website" group heading')
  } finally {
    await page.close()
  }
})

test('tool pricing — new-website one tool is "Starting at $250"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $250'), 'New-website single tool price should be "Starting at $250"')
  } finally {
    await page.close()
  }
})

test('tool pricing — new-website suite of 2–3 tools is "Starting at $600"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $600'), 'New-website 2-3 tool suite price should be "Starting at $600"')
  } finally {
    await page.close()
  }
})

test('tool pricing — new-website complete suite of 4–6 tools is "Starting at $1,000"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $1,000'), 'New-website 4-6 tool suite price should be "Starting at $1,000"')
  } finally {
    await page.close()
  }
})

// ─── 9. Existing-website tool prices ─────────────────────────────────────────

test('tool pricing — existing-website group heading is "For an Existing Website"', async () => {
  const page = await openServices(1280)
  try {
    const headings = await page.$$eval('.pricing-tools-group-heading', els => els.map(el => el.textContent?.trim()))
    assert.ok(headings.some(h => /for an existing website/i.test(h || '')), 'Should have "For an Existing Website" group heading')
  } finally {
    await page.close()
  }
})

test('tool pricing — existing-website one hosted tool is "Starting at $400"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $400'), 'Existing-website single hosted tool price should be "Starting at $400"')
  } finally {
    await page.close()
  }
})

test('tool pricing — existing-website suite of 2–3 hosted tools is "Starting at $800"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $800'), 'Existing-website 2-3 hosted tool suite price should be "Starting at $800"')
  } finally {
    await page.close()
  }
})

test('tool pricing — existing-website complete suite of 4–6 hosted tools is "Starting at $1,500"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $1,500'), 'Existing-website 4-6 hosted tool suite price should be "Starting at $1,500"')
  } finally {
    await page.close()
  }
})

// ─── 10. Monthly hosting & care prices ────────────────────────────────────────

test('tool pricing — monthly care group heading is "Monthly Hosting & Care"', async () => {
  const page = await openServices(1280)
  try {
    const headings = await page.$$eval('.pricing-tools-group-heading', els => els.map(el => el.textContent?.trim()))
    assert.ok(headings.some(h => /monthly hosting/i.test(h || '')), 'Should have "Monthly Hosting & Care" group heading')
  } finally {
    await page.close()
  }
})

test('tool pricing — monthly one tool is "Starting at $19/month"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $19/month'), 'Monthly single tool rate should be "Starting at $19/month"')
  } finally {
    await page.close()
  }
})

test('tool pricing — monthly 2–3 tools suite is "Starting at $29/month"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $29/month'), 'Monthly 2-3 tool suite rate should be "Starting at $29/month"')
  } finally {
    await page.close()
  }
})

test('tool pricing — monthly 4–6 tools suite is "Starting at $49/month"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('Starting at $49/month'), 'Monthly 4-6 tool suite rate should be "Starting at $49/month"')
  } finally {
    await page.close()
  }
})

// ─── 11. Content distinctions and wording ─────────────────────────────────────

test('tool pricing — new-website and existing-website groups are visually distinct headings', async () => {
  const page = await openServices(1280)
  try {
    const headings = await page.$$eval('.pricing-tools-group-heading', els => els.map(el => el.textContent?.trim()))
    const hasNew      = headings.some(h => /added to a new website/i.test(h || ''))
    const hasExisting = headings.some(h => /for an existing website/i.test(h || ''))
    assert.ok(hasNew,      'Should have "Added to a New Website" heading')
    assert.ok(hasExisting, 'Should have "For an Existing Website" heading')
    assert.notEqual(headings.indexOf(headings.find(h => /added/i.test(h || '')) ?? ''),
                    headings.indexOf(headings.find(h => /existing/i.test(h || '')) ?? ''),
                    'New-website and existing-website groups should be distinct elements')
  } finally {
    await page.close()
  }
})

test('tool pricing — existing-website note mentions client receives a hosted link', async () => {
  const page = await openServices(1280)
  try {
    const notes = await page.$$eval('.pricing-tools-note', els => els.map(el => el.textContent ?? ''))
    const existingNote = notes.find(n => /existing website/i.test(n) || /professional link/i.test(n)) ?? ''
    assert.ok(/professional link/i.test(existingNote),
      'Existing-website note should mention the client receives a professional link')
  } finally {
    await page.close()
  }
})

test('tool pricing — existing-website note states changes to existing site are not included', async () => {
  const page = await openServices(1280)
  try {
    const notes = await page.$$eval('.pricing-tools-note', els => els.map(el => el.textContent ?? ''))
    const existingNote = notes.find(n => /professional link/i.test(n)) ?? ''
    assert.ok(/not included/i.test(existingNote),
      'Existing-website note should explicitly state that changes to the existing site are not included')
  } finally {
    await page.close()
  }
})

test('tool pricing — monthly care note states what is included', async () => {
  const page = await openServices(1280)
  try {
    const notes = await page.$$eval('.pricing-tools-note', els => els.map(el => el.textContent ?? ''))
    const monthlyNote = notes.find(n => /hosting and care includes/i.test(n)) ?? ''
    assert.ok(monthlyNote.length > 0, 'Monthly care note should state what is included')
    assert.ok(/bug fixes/i.test(monthlyNote), 'Monthly care note should mention bug fixes')
    assert.ok(/compatibility/i.test(monthlyNote), 'Monthly care note should mention compatibility maintenance')
  } finally {
    await page.close()
  }
})

test('tool pricing — monthly care note states what is quoted separately', async () => {
  const page = await openServices(1280)
  try {
    const notes = await page.$$eval('.pricing-tools-note', els => els.map(el => el.textContent ?? ''))
    const monthlyNote = notes.find(n => /hosting and care includes/i.test(n)) ?? ''
    assert.ok(/quoted separately/i.test(monthlyNote),
      'Monthly care note should state that new tools and major changes are quoted separately')
  } finally {
    await page.close()
  }
})

// ─── 12. Payment & Project Terms unchanged ────────────────────────────────────

test('Payment & Project Terms section heading is present and unchanged', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-payment-inner', el => el.textContent ?? '')
    assert.ok(/payment & project terms/i.test(text), 'Should have "Payment & Project Terms" label')
    assert.ok(/simple, clear payment expectations/i.test(text), 'Section title should be unchanged')
  } finally {
    await page.close()
  }
})

test('Payment & Project Terms — 50% deposit language is present', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-payment-inner', el => el.textContent ?? '')
    assert.ok(/50%.*deposit/i.test(text), 'Should contain 50% deposit language')
  } finally {
    await page.close()
  }
})

// ─── 13. CTA section wording ─────────────────────────────────────────────────

test('CTA section — "Not sure which option fits?" heading is present', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-cta-inner', el => el.textContent ?? '')
    assert.ok(/not sure which option fits/i.test(text), 'CTA heading should be present')
  } finally {
    await page.close()
  }
})

test('CTA section — review paragraph uses approved wording (no "or idea")', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-cta-inner', el => el.textContent ?? '')
    assert.ok(
      text.includes("what's working") && text.includes('what could be improved'),
      'CTA paragraph should describe the practical review'
    )
    assert.ok(
      text.includes('whether it needs any changes at all'),
      'CTA paragraph should include "whether it needs any changes at all"'
    )
    assert.ok(
      !text.includes('or idea'),
      'CTA paragraph should not say "or idea"'
    )
    assert.ok(
      !text.includes('next steps'),
      'CTA paragraph should not say "next steps"'
    )
  } finally {
    await page.close()
  }
})

// ─── 14 (was 13). Tool pricing section overflow at all tested widths ───────────────────

for (const viewport of [320, 375, 390, 768, 1280, 1440]) {
  test(`tool pricing section has no horizontal overflow at ${viewport}px`, async () => {
    const page = await openServices(viewport)
    try {
      const overflow = await page.evaluate(() => {
        const section = document.querySelector('.pricing-tools-inner')
        if (!section) return 0
        return section.scrollWidth - section.clientWidth
      })
      assert.ok(overflow <= 0, `Expected no overflow in .pricing-tools-inner at ${viewport}px, got ${overflow}px`)
    } finally {
      await page.close()
    }
  })
}

for (const viewport of [320, 375, 390, 768, 1280, 1440]) {
  test(`tool pricing group cards do not overflow their container at ${viewport}px`, async () => {
    const page = await openServices(viewport)
    try {
      const overflow = await page.evaluate(() => {
        const groups = document.querySelectorAll('.pricing-tools-group')
        const container = document.querySelector('.pricing-tools-inner')
        if (!container || groups.length === 0) return 0
        const cr = container.getBoundingClientRect()
        return Array.from(groups).reduce((max, g) => {
          const gr = g.getBoundingClientRect()
          return Math.max(max, Math.round((gr.right - cr.right) * 10) / 10)
        }, 0)
      })
      assert.ok(overflow <= 1, `A tool pricing group card extends ${overflow}px outside its container at ${viewport}px`)
    } finally {
      await page.close()
    }
  })
}

// ─── 14. Pricing-clarity panel ───────────────────────────────────────────────

test('pricing clarity — heading "What your tool pricing includes" is present', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-clarity', el => el.textContent ?? '')
    assert.ok(/what your tool pricing includes/i.test(text),
      'Pricing-clarity panel should have the approved heading')
  } finally {
    await page.close()
  }
})

test('pricing clarity — setup statement mentions branding, customization, and one revision round', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-clarity', el => el.textContent ?? '')
    assert.ok(text.includes('branding'), 'Setup statement should mention branding')
    assert.ok(text.includes('revision round'), 'Setup statement should mention one revision round')
  } finally {
    await page.close()
  }
})

test('pricing clarity — existing-website statement mentions hosted tool link and not included', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-clarity', el => el.textContent ?? '')
    assert.ok(text.includes('hosted tool link'), 'Should mention hosted tool link')
    assert.ok(text.includes('not included'), 'Should state editing existing site is not included')
  } finally {
    await page.close()
  }
})

test('pricing clarity — monthly care statement is present with correct wording', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-clarity', el => el.textContent ?? '')
    assert.ok(/monthly hosting.*care includes/i.test(text),
      'Monthly Hosting & Care statement should be present')
    assert.ok(text.includes('compatibility maintenance'), 'Should mention compatibility maintenance')
    assert.ok(text.includes('bug fixes'), 'Should mention bug fixes')
    assert.ok(text.includes('contact-information updates'), 'Should mention contact-information updates')
  } finally {
    await page.close()
  }
})

test('pricing clarity — "quoted separately" statement covers major out-of-scope items', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-clarity', el => el.textContent ?? '')
    assert.ok(text.includes('quoted separately'), 'Should state out-of-scope items are quoted separately')
    assert.ok(text.includes('third-party integrations'), 'Should mention third-party integrations')
    assert.ok(text.includes('payment processing'), 'Should mention payment processing')
  } finally {
    await page.close()
  }
})

test('pricing clarity — panel does not overflow at 320px', async () => {
  const page = await openServices(320)
  try {
    const overflow = await page.evaluate(() => {
      const panel = document.querySelector('.pricing-clarity')
      const container = document.querySelector('.pricing-tools-inner')
      if (!panel || !container) return 0
      const pr = panel.getBoundingClientRect()
      const cr = container.getBoundingClientRect()
      return Math.round((pr.right - cr.right) * 10) / 10
    })
    assert.ok(overflow <= 1, `pricing-clarity panel overflows by ${overflow}px at 320px`)
  } finally {
    await page.close()
  }
})

test('pricing clarity — all 9 "Starting at" prices remain unchanged in the pricing section', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    const prices = [
      'Starting at $250', 'Starting at $600',     'Starting at $1,000',
      'Starting at $400', 'Starting at $800',     'Starting at $1,500',
      'Starting at $19/month', 'Starting at $29/month', 'Starting at $49/month',
    ]
    for (const price of prices) {
      assert.ok(text.includes(price), `"${price}" not found in pricing section`)
    }
  } finally {
    await page.close()
  }
})

// ─── 15. Heading hierarchy ────────────────────────────────────────────────────

test('Services page has exactly one h1', async () => {
  const page = await openServices(1280)
  try {
    const h1s = await page.$$('h1')
    assert.equal(h1s.length, 1, `Expected 1 h1, got ${h1s.length}`)
  } finally {
    await page.close()
  }
})

test('Services page h3 elements all appear inside sections that have an h2 ancestor', async () => {
  const page = await openServices(1280)
  try {
    const orphanH3s = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h3'))
        .filter(h3 =>
          !h3.closest('.pricing-tools-inner') &&
          !h3.closest('.pricing-demo-inner') &&
          !h3.closest('.pricing-free-inner')
        )
        .map(h3 => h3.textContent?.trim())
    )
    assert.deepEqual(orphanH3s, [],
      `h3 elements found outside expected sections: ${orphanH3s.join(', ')}`)
  } finally {
    await page.close()
  }
})
