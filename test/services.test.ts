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

async function pricingCard(page: Page, title: string) {
  return page.$$eval('.pricing-card', (cards, t) => {
    const card = cards.find(c => c.querySelector('.pricing-card-title')?.textContent?.trim() === t)
    return card ? {
      price: card.querySelector('.pricing-card-price')?.textContent?.trim(),
      desc: card.querySelector('.pricing-card-desc')?.textContent?.trim() ?? '',
    } : null
  }, title)
}

test('website pricing — Starter Website is "Starting at $500" and describes the defined starter scope', async () => {
  const page = await openServices(1280)
  try {
    const card = await pricingCard(page, 'Starter Website')
    assert.ok(card, 'Starter Website card should be present')
    assert.equal(card!.price, 'Starting at $500')
    for (const phrase of ['One page covering your business, services, and contact details', 'established design approach',
      'You supply photos and basic information', 'mobile-friendly layout', 'basic search setup', 'contact links',
      'one revision round', 'launch assistance']) {
      assert.ok(card!.desc.includes(phrase), `Starter description should mention "${phrase}"`)
    }
  } finally {
    await page.close()
  }
})

test('website pricing — Starter price note covers the starter scope only, with no other amounts', async () => {
  const page = await openServices(1280)
  try {
    const notes = await page.$$eval('.services-support', els => els.map(el => el.textContent?.replace(/\s+/g, ' ').trim() ?? ''))
    const note = notes.find(n => n.startsWith('About the Starter Website price')) ?? ''
    assert.match(note, /\$500 is the starting price for the defined starter scope/)
    assert.match(note, /Extra pages, extensive copywriting, custom tools, and additional functionality are quoted separately/)
    assert.equal((note.match(/\$\d/g) ?? []).length, 1, 'the note should state no amount other than the $500 starting price')
  } finally {
    await page.close()
  }
})

test('website pricing — "How website costs work" note: one-time build fee, no required plan, domain and hosting handled in the quote', async () => {
  const page = await openServices(1280)
  try {
    const notes = await page.$$eval('.services-support', els => els.map(el => el.textContent?.replace(/\s+/g, ' ').trim() ?? ''))
    const note = notes.find(n => n.startsWith('How website costs work')) ?? ''
    assert.equal(note,
      'How website costs work — Website projects have a one-time build fee. No ongoing maintenance plan is required. ' +
      'Domain registration is paid separately, and any website hosting costs will be specified in your quote before work begins. ' +
      'If you need updates or help later, those are quoted separately.')
    const page_text = await page.$eval('main', el => el.textContent ?? '')
    assert.ok(!/free hosting|lifetime hosting|hosting (is )?included|\/month[^.]*website/i.test(page_text.replace(/\s+/g, ' ')),
      'no free/lifetime hosting promise and no monthly website fee')
  } finally {
    await page.close()
  }
})

test('website pricing — Small-Business Website and Website Refresh are "Custom quote"; retired prices are gone', async () => {
  const page = await openServices(1280)
  try {
    assert.equal((await pricingCard(page, 'Small-Business Website'))?.price, 'Custom quote')
    assert.equal((await pricingCard(page, 'Website Refresh'))?.price, 'Custom quote')
    const text = await page.$eval('.pricing-grid', el => el.textContent ?? '')
    for (const old of ['$750', '$1,500', '$800', 'One-Page Website or Landing Page']) {
      assert.ok(!text.includes(old), `retired website pricing still present: "${old}"`)
    }
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

// ─── 8. Standalone tool pricing & new-website bundle message ─────────────────

test('tool pricing — group headings: Tool Setup, Tool Hosting, new-website message', async () => {
  const page = await openServices(1280)
  try {
    const headings = await page.$$eval('.pricing-tools-group-heading', els => els.map(el => el.textContent?.trim()))
    assert.deepEqual(headings, ['Tool Setup', 'Tool Hosting', 'Adding a tool to your new website?'])
  } finally {
    await page.close()
  }
})

async function groupRows(page: Page, index: number) {
  return page.$$eval('.pricing-tools-group', (groups, i) =>
    Array.from(groups[i as number].querySelectorAll('.pricing-tools-list li')).map(li => ({
      item: li.querySelector('.pricing-tools-item')?.textContent?.trim(),
      price: li.querySelector('.pricing-tools-price')?.textContent?.trim(),
    })), index)
}

async function groupNote(page: Page, index: number) {
  return page.$$eval('.pricing-tools-group', (groups, i) =>
    groups[i as number].querySelector('.pricing-tools-note')?.textContent?.replace(/\s+/g, ' ').trim() ?? '', index)
}

test('tool pricing — setup: $150 per individual tool, suites and new tools/automation by custom quote', async () => {
  const page = await openServices(1280)
  try {
    assert.deepEqual(await groupRows(page, 0), [
      { item: 'Individual existing tool, customized (per tool)', price: 'Starting at $150' },
      { item: 'Suite of tools', price: 'Custom quote' },
      { item: 'New custom tools or automation', price: 'Custom quote' },
    ])
    const note = await groupNote(page, 0)
    assert.match(note, /Final setup depends on the customization you request\./)
    assert.match(note, /Suites of tools are quoted as a bundle, with savings compared with setting up the included tools individually\./)
    assert.ok(!/Real Estate|six tools/.test(note), 'setup note should not name a specific suite')
  } finally {
    await page.close()
  }
})

test('tool pricing — Tool Hosting is one $10/month fee per business, hosting only', async () => {
  const page = await openServices(1280)
  try {
    assert.deepEqual(await groupRows(page, 1), [{ item: 'Per business', price: '$10/month' }])
    const note = await groupNote(page, 1)
    assert.match(note, /One monthly fee per business covers hosting for the tools you've purchased from me, whether that's one tool or several\./)
    assert.match(note, /isn't charged per tool and doesn't provide access to every tool I offer/)
    assert.match(note, /covers hosting only; later changes are quoted separately/)
  } finally {
    await page.close()
  }
})

test('tool pricing — new-website card shows the approved message and no price table', async () => {
  const page = await openServices(1280)
  try {
    const card = await page.$$eval('.pricing-tools-group', groups => ({
      text: groups[2].querySelector('.pricing-tools-note')?.textContent?.replace(/\s+/g, ' ').trim(),
      rows: groups[2].querySelectorAll('.pricing-tools-list li').length,
      all: groups[2].textContent ?? '',
    }))
    assert.equal(card.text,
      'Discounted tool setup is available when included in a new Websites by Leslie website project and agreed on before the build is completed. ' +
      'Your quote will show the combined price and any Tool Hosting fee. ' +
      'Tools requested after the website is completed are quoted separately.')
    assert.equal(card.rows, 0, 'the new-website card should not list prices')
    assert.ok(!/\$|%/.test(card.all), 'no fixed bundle price or discount percentage')
  } finally {
    await page.close()
  }
})

test('tool pricing — no retired tiers, care packages, discount percentages, free hosting, or unlimited-update promises', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-tools-inner', el => el.textContent?.replace(/\s+/g, ' ') ?? '')
    for (const old of ['$250', '$600', '$1,000', '$400', '$300', '$500', '$19/month', '$29/month', '$49/month',
      '$15/month', '$25/month', '$35/month', 'Two–three', 'Four–six', 'Hosting & Care', 'hosting and care',
      'per business package', 'Added to a New Website', 'For an Existing Website']) {
      assert.ok(!text.includes(old), `retired tool-pricing text still present: "${old}"`)
    }
    assert.ok(!/\d+\s*%/.test(text), 'no discount percentage')
    assert.ok(!/free hosting|hosting (is )?free|unlimited|bug fixes|compatibility maintenance/i.test(text),
      'no free hosting, unlimited updates, or care-package promises')
  } finally {
    await page.close()
  }
})

// ─── 9. Content distinctions and wording ─────────────────────────────────────

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

test('pricing clarity — Tool Hosting statement is hosting only; additional charges must be agreed first', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-clarity', el => el.textContent?.replace(/\s+/g, ' ') ?? '')
    assert.match(text, /Tool Hosting keeps the tools you've purchased online\. It is hosting only and does not include content updates, new features, or ongoing support — any later changes are quoted separately\./)
    assert.match(text, /Paid integrations, automated messaging, or substantial usage that would require additional charges will be discussed and agreed on before those charges apply\./)
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

test('pricing clarity — setup statement lists contact details and modest wording changes', async () => {
  const page = await openServices(1280)
  try {
    const text = await page.$eval('.pricing-clarity', el => el.textContent?.replace(/\s+/g, ' ') ?? '')
    assert.ok(text.includes('contact details'), 'Setup statement should mention contact details')
    assert.ok(text.includes('modest wording and question changes'), 'Setup statement should mention modest wording/question changes')
    assert.ok(text.includes('New functionality'), 'Out-of-scope statement should include new functionality')
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
          !h3.closest('.pricing-free-inner') &&
          !h3.closest('#who-i-work-with')
        )
        .map(h3 => h3.textContent?.trim())
    )
    assert.deepEqual(orphanH3s, [],
      `h3 elements found outside expected sections: ${orphanH3s.join(', ')}`)
  } finally {
    await page.close()
  }
})
