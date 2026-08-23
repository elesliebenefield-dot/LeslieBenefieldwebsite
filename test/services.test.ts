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

// ─── 2. Three demo cards — presence and content ───────────────────────────────

test('services page has exactly three demo cards', async () => {
  const page = await openServices(1280)
  try {
    const cards = await page.$$('.pricing-demo-card')
    assert.equal(cards.length, 3, `Expected 3 .pricing-demo-card elements, got ${cards.length}`)
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

test('Real Estate Client Tools card is present with correct link', async () => {
  const page = await openServices(1280)
  try {
    const titles = await page.$$eval('.pricing-demo-card-title', els => els.map(el => el.textContent?.trim()))
    const links  = await page.$$eval('.pricing-demo-link',       els => els.map(el => el.getAttribute('href')))
    assert.ok(titles.some(t => /real estate client tools/i.test(t || '')), 'Real estate card title should be present')
    assert.ok(links.includes('/real-estate-tools'), 'Real estate card link should point to /real-estate-tools')
  } finally {
    await page.close()
  }
})

test('Real Estate Client Tools card button text is "Explore the Suite →"', async () => {
  const page = await openServices(1280)
  try {
    const linkTexts = await page.$$eval('.pricing-demo-link', els => els.map(el => el.textContent?.trim()))
    assert.ok(linkTexts.some(t => /Explore the Suite/i.test(t || '')), 'Real estate card should have "Explore the Suite →" button')
  } finally {
    await page.close()
  }
})

test('/real-estate-tools is the destination for the suite card (clean URL, not .html)', async () => {
  const page = await openServices(1280)
  try {
    const links = await page.$$eval('.pricing-demo-link', els => els.map(el => el.getAttribute('href')))
    const reLink = links.find(h => h?.includes('real-estate'))
    assert.ok(reLink === '/real-estate-tools',
      `Suite link should be "/real-estate-tools", got "${reLink}"`)
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

test('website pricing — Free Website Review is "Complimentary"', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-grid', el => el.textContent ?? '')
    assert.ok(text.includes('Complimentary'), 'pricing-grid should contain "Complimentary"')
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

test('tool pricing — new-website one tool is $250', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('$250'), 'New-website single tool price should be $250')
  } finally {
    await page.close()
  }
})

test('tool pricing — new-website suite of 2–3 tools is $600', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('$600'), 'New-website 2-3 tool suite price should be $600')
  } finally {
    await page.close()
  }
})

test('tool pricing — new-website complete suite of 4–6 tools is $1,000', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('$1,000'), 'New-website 4-6 tool suite price should be $1,000')
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

test('tool pricing — existing-website one hosted tool is $400', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('$400'), 'Existing-website single hosted tool price should be $400')
  } finally {
    await page.close()
  }
})

test('tool pricing — existing-website suite of 2–3 hosted tools is $800', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('$800'), 'Existing-website 2-3 hosted tool suite price should be $800')
  } finally {
    await page.close()
  }
})

test('tool pricing — existing-website complete suite of 4–6 hosted tools is $1,500', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('$1,500'), 'Existing-website 4-6 hosted tool suite price should be $1,500')
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

test('tool pricing — monthly one tool is $19/month', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('$19/month'), 'Monthly single tool rate should be $19/month')
  } finally {
    await page.close()
  }
})

test('tool pricing — monthly 2–3 tools suite is $29/month', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('$29/month'), 'Monthly 2-3 tool suite rate should be $29/month')
  } finally {
    await page.close()
  }
})

test('tool pricing — monthly 4–6 tools suite is $49/month', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent ?? '')
    assert.ok(text.includes('$49/month'), 'Monthly 4-6 tool suite rate should be $49/month')
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

// ─── 13. Tool pricing section overflow at all tested widths ───────────────────

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

// ─── 14. Heading hierarchy ────────────────────────────────────────────────────

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
        .filter(h3 => !h3.closest('.pricing-tools-inner') && !h3.closest('.pricing-demo-inner'))
        .map(h3 => h3.textContent?.trim())
    )
    assert.deepEqual(orphanH3s, [],
      `h3 elements found outside expected sections: ${orphanH3s.join(', ')}`)
  } finally {
    await page.close()
  }
})
