// Browser integration tests for the Custom Bakery Order Planner.
// Validates the 3-stage workflow: What Are You Ordering? → Customize It →
// Timing & Details → Order Request Brief.
//
// Runs against the production build (dist/) via a lightweight static HTTP server.
// Run with: node --test test/tools/bakeryOrderPlanner.test.ts

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function openTool(canShare = false): Promise<Page> {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument((share: boolean) => {
    if (!share) {
      Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true })
    } else {
      Object.defineProperty(navigator, 'share', {
        value: (data: unknown) => {
          (window as unknown as Record<string, unknown>).__lastShared = data
          return Promise.resolve()
        },
        writable: true, configurable: true,
      })
    }
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => {
          (window as unknown as Record<string, unknown>).__lastCopied = t
          return Promise.resolve()
        },
      },
      writable: true, configurable: true,
    })
  }, canShare)
  await page.goto(`${baseUrl}/tools-custom-bakery-order.html`, { waitUntil: 'load' })
  return page
}

// Set the date picker value (React requires native setter + dispatched events).
async function setDate(page: Page, isoDate: string) {
  await page.evaluate((d: string) => {
    const input = document.querySelector('#neededByDate') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, d)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, isoDate)
}

// Fill all Stage 1 required fields with defaults.
async function fillStage1(page: Page) {
  await page.click('input[name="productType"][value="cake"]')
  await setDate(page, '2026-12-20')
  await page.click('input[name="occasion"][value="birthday"]')
  await page.click('input[name="recipient"][value="gift_one"]')
}

// Advance through Stage 1 into Stage 2.
async function advanceToStage2(page: Page) {
  await fillStage1(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => !!document.querySelector('#sizeQuantity'))
}

// Fill all Stage 2 required fields with defaults.
async function fillStage2(page: Page, inscription = 'Happy Birthday!') {
  await page.type('#sizeQuantity', '2-tier, serves 20')
  await page.type('#inscriptionText', inscription)
}

// Advance through Stage 2 into Stage 3.
async function advanceToStage3(page: Page) {
  await advanceToStage2(page)
  await fillStage2(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => !!document.querySelector('input[name="budget"]'))
}

// Fill all Stage 3 required fields with defaults.
async function fillStage3(page: Page) {
  await page.click('input[name="budget"][value="150_300"]')
}

// Advance through all three stages into the results screen.
async function advanceToResults(page: Page) {
  await advanceToStage3(page)
  await fillStage3(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => !!document.querySelector('.bakery-email-btn'))
}

// Click a result-actions button by matching its text.
async function clickActionButton(page: Page, textPattern: RegExp) {
  await page.$eval('.result-actions', (bar: Element, pat: string) => {
    const btn = Array.from(bar.querySelectorAll('button'))
      .find(b => new RegExp(pat, 'i').test(b.textContent || ''))
    ;(btn as HTMLButtonElement | undefined)?.click()
  }, textPattern.source)
}

// ─── 1. Page load and static structure ───────────────────────────────────────

test('page loads without console or page errors', async () => {
  const page = await openTool()
  const errors: string[] = []
  page.on('pageerror', err => errors.push(String(err)))
  try {
    await page.reload({ waitUntil: 'load' })
    assert.deepEqual(errors, [])
  } finally {
    await page.close()
  }
})

test('page title is "Custom Bakery Order Planner"', async () => {
  const page = await openTool()
  try {
    assert.equal(await page.title(), 'Custom Bakery Order Planner')
  } finally {
    await page.close()
  }
})

test('header brand shows "Your Custom Bakery"', async () => {
  const page = await openTool()
  try {
    const brand = await page.$eval('.tool-header-brand', el => el.textContent?.trim())
    assert.equal(brand, 'Your Custom Bakery')
  } finally {
    await page.close()
  }
})

test('header title shows "Custom Order Planner"', async () => {
  const page = await openTool()
  try {
    const title = await page.$eval('.tool-header-title', el => el.textContent?.trim())
    assert.equal(title, 'Custom Order Planner')
  } finally {
    await page.close()
  }
})

test('header demo tag references Websites by Leslie', async () => {
  const page = await openTool()
  try {
    const demo = await page.$eval('.tool-header-demo', el => el.textContent || '')
    assert.match(demo, /Websites by Leslie/i)
  } finally {
    await page.close()
  }
})

test('three-stage progress indicator is present and shows step 1 of 3', async () => {
  const page = await openTool()
  try {
    const count = await page.$eval('.tool-progress-count', el => el.textContent?.trim())
    assert.equal(count, '1 of 3')
  } finally {
    await page.close()
  }
})

test('progress bar has role="status" for accessibility', async () => {
  const page = await openTool()
  try {
    const role = await page.$eval('.tool-progress', el => el.getAttribute('role'))
    assert.equal(role, 'status')
  } finally {
    await page.close()
  }
})

test('privacy notice is present on Stage 1 with correct role', async () => {
  const page = await openTool()
  try {
    const note = await page.$('.tool-privacy-note')
    assert.ok(note, 'Privacy note should exist')
    const role = await note!.evaluate(el => el.getAttribute('role'))
    assert.equal(role, 'note')
    const text = await note!.evaluate(el => el.textContent || '')
    assert.match(text, /stay in your browser/i)
    assert.match(text, /nothing is stored or transmitted/i)
  } finally {
    await page.close()
  }
})

test('noindex meta tag is present', async () => {
  const page = await openTool()
  try {
    const content = await page.$eval('meta[name="robots"]', el => (el as HTMLMetaElement).content)
    assert.match(content, /noindex/)
    assert.match(content, /nofollow/)
  } finally {
    await page.close()
  }
})

// ─── 2. Stage 1 — required fields ────────────────────────────────────────────

test('Stage 1 shows 5 product type options', async () => {
  const page = await openTool()
  try {
    const opts = await page.$$('input[name="productType"]')
    assert.equal(opts.length, 5)
  } finally {
    await page.close()
  }
})

test('Stage 1 shows 9 occasion options', async () => {
  const page = await openTool()
  try {
    const opts = await page.$$('input[name="occasion"]')
    assert.equal(opts.length, 9)
  } finally {
    await page.close()
  }
})

test('Stage 1 shows 3 recipient options', async () => {
  const page = await openTool()
  try {
    const opts = await page.$$('input[name="recipient"]')
    assert.equal(opts.length, 3)
  } finally {
    await page.close()
  }
})

test('Stage 1 does not advance when all required fields are empty', async () => {
  const page = await openTool()
  try {
    await page.click('.tool-nav-next')
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'Error banner should appear')
    const stillStage1 = await page.$('input[name="productType"]')
    assert.ok(stillStage1, 'Should still be on Stage 1')
  } finally {
    await page.close()
  }
})

test('Stage 1 does not advance with only product type selected', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="productType"][value="cake"]')
    await page.click('.tool-nav-next')
    const stillStage1 = await page.$('input[name="occasion"]')
    assert.ok(stillStage1, 'Should still be on Stage 1 without occasion and recipient')
  } finally {
    await page.close()
  }
})

test('Stage 1 does not advance with only product type and occasion', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="productType"][value="cake"]')
    await page.click('input[name="occasion"][value="birthday"]')
    await page.click('.tool-nav-next')
    const stillStage1 = await page.$('input[name="recipient"]')
    assert.ok(stillStage1, 'Should still be on Stage 1 without recipient')
  } finally {
    await page.close()
  }
})

test('Stage 1 advances with all four required fields complete', async () => {
  const page = await openTool()
  try {
    await fillStage1(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('#sizeQuantity'))
    const onStage2 = await page.$('#sizeQuantity')
    assert.ok(onStage2, 'Should be on Stage 2')
  } finally {
    await page.close()
  }
})

test('Stage 1 progress indicator reads "1 of 3"', async () => {
  const page = await openTool()
  try {
    const count = await page.$eval('.tool-progress-count', el => el.textContent?.trim())
    assert.equal(count, '1 of 3')
  } finally {
    await page.close()
  }
})

// ─── 3. Stage 2 — validation ──────────────────────────────────────────────────

test('Stage 2 progress indicator reads "2 of 3"', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const count = await page.$eval('.tool-progress-count', el => el.textContent?.trim())
    assert.equal(count, '2 of 3')
  } finally {
    await page.close()
  }
})

test('Stage 2 does not advance without inscription or "no inscription" checked', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.type('#sizeQuantity', '2 dozen cupcakes')
    await page.click('.tool-nav-next')
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'Error banner should appear without inscription')
    const stillStage2 = await page.$('#sizeQuantity')
    assert.ok(stillStage2, 'Should still be on Stage 2')
  } finally {
    await page.close()
  }
})

test('Stage 2 advances when "No inscription needed" is checked (without text)', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const checkboxes = await page.$$('.bakery-inline-check input[type="checkbox"]')
    await checkboxes[0].click() // "No inscription needed"
    await page.type('#sizeQuantity', '2-tier round, serves 20')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="budget"]'))
    const onStage3 = await page.$('input[name="budget"]')
    assert.ok(onStage3, 'Should advance to Stage 3 with "no inscription" checked')
  } finally {
    await page.close()
  }
})

test('Stage 2 does not advance without size and quantity', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.type('#inscriptionText', 'Happy Birthday!')
    await page.click('.tool-nav-next')
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'Error banner should appear without size/quantity')
    const stillStage2 = await page.$('#inscriptionText')
    assert.ok(stillStage2, 'Should still be on Stage 2')
  } finally {
    await page.close()
  }
})

test('Stage 2 advances with inscription text and size/quantity filled', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await fillStage2(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="budget"]'))
    const onStage3 = await page.$('input[name="budget"]')
    assert.ok(onStage3, 'Should advance to Stage 3')
  } finally {
    await page.close()
  }
})

test('Stage 2 colors field is optional — no error when blank', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await fillStage2(page)
    // Leave colors blank, only fill required fields
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="budget"]'))
    const onStage3 = await page.$('input[name="budget"]')
    assert.ok(onStage3, 'Should advance without colors filled')
  } finally {
    await page.close()
  }
})

test('Stage 2 style/theme field is optional — no error when blank', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await fillStage2(page)
    // Leave styleTheme blank
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="budget"]'))
    const onStage3 = await page.$('input[name="budget"]')
    assert.ok(onStage3, 'Should advance without style/theme filled')
  } finally {
    await page.close()
  }
})

test('"No inscription needed" checkbox hides the inscription textarea when checked', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const textareaBefore = await page.$('#inscriptionText')
    assert.ok(textareaBefore, 'Textarea should exist before checking')
    const checkboxes = await page.$$('.bakery-inline-check input[type="checkbox"]')
    await checkboxes[0].click() // "No inscription needed"
    const textareaAfter = await page.$('#inscriptionText')
    assert.equal(textareaAfter, null, 'Textarea should be hidden when no-inscription checked')
  } finally {
    await page.close()
  }
})

// ─── 4. Stage 3 — validation ──────────────────────────────────────────────────

test('Stage 3 progress indicator reads "3 of 3"', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const count = await page.$eval('.tool-progress-count', el => el.textContent?.trim())
    assert.equal(count, '3 of 3')
  } finally {
    await page.close()
  }
})

test('Stage 1 does not advance without a needed-by date', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="productType"][value="cake"]')
    await page.click('input[name="occasion"][value="birthday"]')
    await page.click('input[name="recipient"][value="gift_one"]')
    // Leave date blank
    await page.click('.tool-nav-next')
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'Error banner should appear without date')
    const stillStage1 = await page.$('#neededByDate')
    assert.ok(stillStage1, 'Should still be on Stage 1')
  } finally {
    await page.close()
  }
})

test('Stage 3 does not advance without a budget selection', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    // Date is already set by fillStage1 inside advanceToStage3
    await page.click('.tool-nav-next')
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'Error banner should appear without budget')
    const stillStage3 = await page.$('input[name="budget"]')
    assert.ok(stillStage3, 'Should still be on Stage 3')
  } finally {
    await page.close()
  }
})

test('Stage 3 shows 5 budget options', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const opts = await page.$$('input[name="budget"]')
    assert.equal(opts.length, 5)
  } finally {
    await page.close()
  }
})

test('"Prefer not to say" satisfies the budget requirement and advances to results', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('input[name="budget"][value="prefer_not_say"]')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.bakery-email-btn'))
    const results = await page.$('.bakery-email-btn')
    assert.ok(results, 'Should reach results with "Prefer not to say"')
  } finally {
    await page.close()
  }
})

test('Stage 3 timing notes field is optional', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await fillStage3(page)
    // Leave timingNote blank
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.bakery-email-btn'))
    const results = await page.$('.bakery-email-btn')
    assert.ok(results, 'Should reach results without timing notes')
  } finally {
    await page.close()
  }
})

test('Stage 3 dietary information field is optional', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await fillStage3(page)
    // Leave dietaryRestrictions blank
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.bakery-email-btn'))
    const results = await page.$('.bakery-email-btn')
    assert.ok(results, 'Should reach results without dietary information')
  } finally {
    await page.close()
  }
})

test('Stage 3 questions for baker field is optional', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await fillStage3(page)
    // Leave questionsForBaker blank
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.bakery-email-btn'))
    const results = await page.$('.bakery-email-btn')
    assert.ok(results, 'Should reach results without questions for baker')
  } finally {
    await page.close()
  }
})

test('dietary/allergy disclaimer appears exactly as approved in Stage 3', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const disclaimer = await page.$eval('.bakery-dietary-disclaimer', el => el.textContent?.trim())
    assert.equal(
      disclaimer,
      'Dietary and allergy information must be confirmed directly with the bakery. Completing this planner does not guarantee allergen-free preparation or accommodation.'
    )
  } finally {
    await page.close()
  }
})

test('dietary disclaimer in Stage 3 has role="note"', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const role = await page.$eval('.bakery-dietary-disclaimer', el => el.getAttribute('role'))
    assert.equal(role, 'note')
  } finally {
    await page.close()
  }
})

// ─── 5. Back navigation preserves answers ────────────────────────────────────

test('Back from Stage 2 to Stage 1 preserves all Stage 1 answers', async () => {
  const page = await openTool()
  try {
    await fillStage1(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('#sizeQuantity'))
    await page.click('.tool-nav-back')
    await page.waitForFunction(() => !!document.querySelector('input[name="productType"]'))
    const product  = await page.$eval('input[name="productType"][value="cake"]',     (el: Element) => (el as HTMLInputElement).checked)
    const occasion = await page.$eval('input[name="occasion"][value="birthday"]',    (el: Element) => (el as HTMLInputElement).checked)
    const recipient= await page.$eval('input[name="recipient"][value="gift_one"]',   (el: Element) => (el as HTMLInputElement).checked)
    assert.ok(product,   'Product type should be preserved')
    assert.ok(occasion,  'Occasion should be preserved')
    assert.ok(recipient, 'Recipient should be preserved')
  } finally {
    await page.close()
  }
})

test('Back from Stage 3 to Stage 2 preserves inscription and size/quantity', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.type('#sizeQuantity', '3 dozen cookies')
    await page.type('#inscriptionText', 'Hello World')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="budget"]'))
    await page.click('.tool-nav-back')
    await page.waitForFunction(() => !!document.querySelector('#inscriptionText'))
    const inscription  = await page.$eval('#inscriptionText',  (el: Element) => (el as HTMLTextAreaElement).value)
    const sizeQuantity = await page.$eval('#sizeQuantity',     (el: Element) => (el as HTMLInputElement).value)
    assert.equal(inscription,  'Hello World')
    assert.equal(sizeQuantity, '3 dozen cookies')
  } finally {
    await page.close()
  }
})

// ─── 6. Complete flow produces Order Request Brief ────────────────────────────

test('completing all stages produces the results screen', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const emailBtn = await page.$('.bakery-email-btn')
    assert.ok(emailBtn, 'Email button should appear on results screen')
  } finally {
    await page.close()
  }
})

test('results screen shows "Your Order Request Brief" heading', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const h1 = await page.$eval('.tool-results-title', el => el.textContent?.trim())
    assert.equal(h1, 'Your Order Request Brief')
  } finally {
    await page.close()
  }
})

test('results brief shows entered product type (Cake)', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /cake/i)
  } finally {
    await page.close()
  }
})

test('results brief shows entered occasion (Birthday)', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /birthday/i)
  } finally {
    await page.close()
  }
})

test('results brief shows entered inscription text', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page) // fillStage2 uses 'Happy Birthday!' as inscription
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.bakery-email-btn'))
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /Happy Birthday!/i)
  } finally {
    await page.close()
  }
})

test('results brief shows entered size and quantity', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /2-tier, serves 20/i)
  } finally {
    await page.close()
  }
})

test('results brief shows budget when not "prefer not to say"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // fillStage3 uses 150_300
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /\$150[–—-]\$?300/i)
  } finally {
    await page.close()
  }
})

test('results brief does not show budget when "prefer not to say" is selected', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('input[name="budget"][value="prefer_not_say"]')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.bakery-email-btn'))
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.doesNotMatch(briefText, /prefer not to say/i)
    // Budget label should not appear at all
    const dts = await page.$$eval('.result-recap-term', els => els.map(el => el.textContent?.trim()))
    assert.ok(!dts.includes('Budget'), 'Budget row should be absent when prefer not to say')
  } finally {
    await page.close()
  }
})

// ─── 7. Empty optional fields produce no blank rows ───────────────────────────

test('brief has no blank dt or dd elements when optional fields are skipped', async () => {
  const page = await openTool()
  try {
    // Fill only required fields; skip all optional ones
    await fillStage1(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('#sizeQuantity'))
    const checkboxes = await page.$$('.bakery-inline-check input[type="checkbox"]')
    await checkboxes[0].click() // "No inscription needed"
    await page.type('#sizeQuantity', '1 dozen cookies')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="budget"]'))
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.bakery-email-btn'))

    const blankDts = await page.$$eval('.result-recap-term',   els => els.filter(el => !el.textContent?.trim()).length)
    const blankDds = await page.$$eval('.result-recap-detail', els => els.filter(el => !el.textContent?.trim()).length)
    assert.equal(blankDts, 0, 'No blank dt elements')
    assert.equal(blankDds, 0, 'No blank dd elements')
  } finally {
    await page.close()
  }
})

test('Colors row is absent in brief when colors field is left blank', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const dts = await page.$$eval('.result-recap-term', els => els.map(el => el.textContent?.trim()))
    assert.ok(!dts.includes('Colors'), 'Colors row should not appear when field is blank')
  } finally {
    await page.close()
  }
})

test('Style / theme row is absent in brief when style field is blank', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const dts = await page.$$eval('.result-recap-term', els => els.map(el => el.textContent?.trim()))
    assert.ok(!dts.includes('Style / theme'), 'Style / theme row should not appear when field is blank')
  } finally {
    await page.close()
  }
})

test('Timing note row is absent when timing note field is blank', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const dts = await page.$$eval('.result-recap-term', els => els.map(el => el.textContent?.trim()))
    assert.ok(!dts.includes('Timing note'), 'Timing note row should not appear when field is blank')
  } finally {
    await page.close()
  }
})

test('Dietary / allergy notes row is absent when dietary field is blank', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const dts = await page.$$eval('.result-recap-term', els => els.map(el => el.textContent?.trim()))
    assert.ok(!dts.includes('Dietary / allergy notes'), 'Dietary row should not appear when field is blank')
  } finally {
    await page.close()
  }
})

test('"Questions for the Baker" section is absent when questions field is blank', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const sectionTitles = await page.$$eval('.result-section-title', els => els.map(el => el.textContent?.trim()))
    assert.ok(!sectionTitles.includes('Questions for the Baker'), 'Questions section should not appear when blank')
  } finally {
    await page.close()
  }
})

test('"Questions for the Baker" section appears when questions are entered', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.type('#questionsForBaker', 'Do you offer gluten-free sponge?')
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.bakery-email-btn'))
    const sectionTitles = await page.$$eval('.result-section-title', els => els.map(el => el.textContent?.trim()))
    assert.ok(sectionTitles.includes('Questions for the Baker'), 'Questions section should appear')
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /gluten-free/i)
  } finally {
    await page.close()
  }
})

// ─── 8. Copy Brief ────────────────────────────────────────────────────────────

test('Copy Brief writes text to clipboard', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied)
    assert.ok(typeof copied === 'string' && copied.length > 0, 'Should write text to clipboard')
  } finally {
    await page.close()
  }
})

test('copied text contains "ORDER REQUEST BRIEF" header', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
    assert.match(copied, /ORDER REQUEST BRIEF/)
  } finally {
    await page.close()
  }
})

test('copied text contains the entered inscription', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // fillStage2 uses 'Happy Birthday!'
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
    assert.match(copied, /Happy Birthday!/i)
  } finally {
    await page.close()
  }
})

test('copied text contains the entered size and quantity', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
    assert.match(copied, /2-tier, serves 20/i)
  } finally {
    await page.close()
  }
})

test('copy success is announced via accessible live region', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await page.waitForFunction(() => {
      const el = document.querySelector('[role="status"]')
      return el && /copied/i.test(el.textContent || '')
    })
    const statusText = await page.$eval('[role="status"]', el => el.textContent || '')
    assert.match(statusText, /copied/i)
  } finally {
    await page.close()
  }
})

test('live region has aria-live="polite" and aria-atomic="true"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    // The copy status div has role="status", aria-live="polite", aria-atomic="true"
    const attrs = await page.$eval('.result-copy-status', el => ({
      live:   el.getAttribute('aria-live'),
      atomic: el.getAttribute('aria-atomic'),
      role:   el.getAttribute('role'),
    }))
    assert.equal(attrs.live,   'polite')
    assert.equal(attrs.atomic, 'true')
    assert.equal(attrs.role,   'status')
  } finally {
    await page.close()
  }
})

// ─── 9. Share Brief ──────────────────────────────────────────────────────────

test('Share button is absent when navigator.share is not available', async () => {
  const page = await openTool(false)
  try {
    await advanceToResults(page)
    const hasShare = await page.$eval('.result-actions', bar => {
      return Array.from(bar.querySelectorAll('button')).some(b => /share/i.test(b.textContent || ''))
    })
    assert.equal(hasShare, false, 'Share button should not appear without navigator.share')
  } finally {
    await page.close()
  }
})

test('Share button is present when navigator.share is available', async () => {
  const page = await openTool(true)
  try {
    await advanceToResults(page)
    const hasShare = await page.$eval('.result-actions', bar => {
      return Array.from(bar.querySelectorAll('button')).some(b => /share/i.test(b.textContent || ''))
    })
    assert.ok(hasShare, 'Share button should appear when navigator.share is available')
  } finally {
    await page.close()
  }
})

test('Share button invokes navigator.share with the complete brief', async () => {
  const page = await openTool(true)
  try {
    await advanceToResults(page)
    await clickActionButton(page, /share brief/i)
    await new Promise(r => setTimeout(r, 300))
    const shared = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastShared as Record<string, string>)
    assert.ok(shared, 'navigator.share should have been called')
    assert.match(shared.text, /ORDER REQUEST BRIEF/)
    assert.match(shared.title, /bakery|order/i)
  } finally {
    await page.close()
  }
})

// ─── 10. Print rules ─────────────────────────────────────────────────────────

test('action bar and email button have no-print class for print suppression', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const actionBarHasNoPrint = await page.$eval('.result-actions', el => el.classList.contains('no-print'))
    assert.ok(actionBarHasNoPrint, 'Action bar should have no-print class')
    const emailCtaHasNoPrint = await page.$eval('.bakery-email-cta', el => el.classList.contains('no-print'))
    assert.ok(emailCtaHasNoPrint, 'Email CTA row should have no-print class')
  } finally {
    await page.close()
  }
})

test('customer name row has no-print class for print suppression', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const hasNoPrint = await page.$eval('.bakery-name-row', el => el.classList.contains('no-print'))
    assert.ok(hasNoPrint, 'Customer name row should have no-print class')
  } finally {
    await page.close()
  }
})

test('Websites by Leslie CTA has no-print class', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const hasNoPrint = await page.$eval('.tool-sales-cta', el => el.classList.contains('no-print'))
    assert.ok(hasNoPrint, 'Websites by Leslie CTA should have no-print class')
  } finally {
    await page.close()
  }
})

test('brief sections do not have no-print class — they print', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const sections = await page.$$('.result-section')
    for (const section of sections) {
      const hasNoPrint = await section.evaluate(el => el.classList.contains('no-print'))
      assert.equal(hasNoPrint, false, 'Brief sections should not be suppressed in print')
    }
  } finally {
    await page.close()
  }
})

// ─── 11. Email the Bakery ─────────────────────────────────────────────────────

test('Email the Bakery button exists on results screen', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const btn = await page.$('.bakery-email-btn')
    assert.ok(btn, 'Email button should exist')
  } finally {
    await page.close()
  }
})

test('mailto href has blank recipient (empty to) in the public demo', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.bakery-email-btn', el => el.getAttribute('href') || '')
    assert.ok(href.startsWith('mailto:?'), `href should start with "mailto:?" for empty recipient, got: ${href.slice(0, 50)}`)
  } finally {
    await page.close()
  }
})

test('mailto subject contains "Custom Order Request"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.bakery-email-btn', el => el.getAttribute('href') || '')
    assert.match(decodeURIComponent(href), /subject=Custom Order Request/i)
  } finally {
    await page.close()
  }
})

test('mailto subject includes product type and occasion', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // cake + birthday
    const href = await page.$eval('.bakery-email-btn', el => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(href)
    assert.match(decoded, /Cake/i)
    assert.match(decoded, /Birthday/i)
  } finally {
    await page.close()
  }
})

test('mailto body contains "ORDER REQUEST BRIEF" header', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.bakery-email-btn', el => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(href)
    assert.match(decoded, /ORDER REQUEST BRIEF/)
  } finally {
    await page.close()
  }
})

test('mailto body contains inscription text', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // inscription = 'Happy Birthday!'
    const href = await page.$eval('.bakery-email-btn', el => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(href)
    assert.match(decoded, /Happy Birthday!/i)
  } finally {
    await page.close()
  }
})

test('entering customer name adds it to the mailto body', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await page.type('#customerName', 'Sarah')
    // Wait for React to re-render and update the href
    await page.waitForFunction(() => {
      const btn = document.querySelector('.bakery-email-btn') as HTMLAnchorElement | null
      return btn?.href.includes('Sarah') || btn?.href.includes(encodeURIComponent('Sarah'))
    })
    const href = await page.$eval('.bakery-email-btn', el => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(href)
    assert.match(decoded, /Sarah/)
    assert.match(decoded, /Prepared by/i)
  } finally {
    await page.close()
  }
})

test('entering customer name does not alter other answers', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // cake + birthday, 'Happy Birthday!'
    await page.type('#customerName', 'Lee')
    await page.waitForFunction(() => {
      const btn = document.querySelector('.bakery-email-btn') as HTMLAnchorElement | null
      return btn?.href.includes('Lee')
    })
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /cake/i)
    assert.match(briefText, /birthday/i)
    assert.match(briefText, /Happy Birthday!/i)
  } finally {
    await page.close()
  }
})

// ─── 12. Review/Edit preserves answers ───────────────────────────────────────

test('Edit Answers returns to Stage 1', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /edit answers/i)
    await page.waitForFunction(() => !!document.querySelector('input[name="productType"]'))
    const onStage1 = await page.$('input[name="productType"]')
    assert.ok(onStage1, 'Should return to Stage 1')
  } finally {
    await page.close()
  }
})

test('Edit Answers preserves all Stage 1 selections', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /edit answers/i)
    await page.waitForFunction(() => !!document.querySelector('input[name="productType"]'))
    const product  = await page.$eval('input[name="productType"][value="cake"]',    (el: Element) => (el as HTMLInputElement).checked)
    const occasion = await page.$eval('input[name="occasion"][value="birthday"]',   (el: Element) => (el as HTMLInputElement).checked)
    const recipient= await page.$eval('input[name="recipient"][value="gift_one"]',  (el: Element) => (el as HTMLInputElement).checked)
    assert.ok(product,   'Product type preserved')
    assert.ok(occasion,  'Occasion preserved')
    assert.ok(recipient, 'Recipient preserved')
  } finally {
    await page.close()
  }
})

test('can re-advance to results after Edit Answers', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /edit answers/i)
    await page.waitForFunction(() => !!document.querySelector('input[name="productType"]'))
    // All answers preserved — can advance through each stage
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('#sizeQuantity'))
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="budget"]'))
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.bakery-email-btn'))
    const emailBtn = await page.$('.bakery-email-btn')
    assert.ok(emailBtn, 'Should reach results again')
  } finally {
    await page.close()
  }
})

// ─── 13. Start Over ──────────────────────────────────────────────────────────

test('Start Over shows the confirmation dialog', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /start over/i)
    await page.waitForFunction(() => !!document.querySelector('.tool-confirm-backdrop'))
    const dialog = await page.$('.tool-confirm-dialog')
    assert.ok(dialog, 'Confirmation dialog should appear')
  } finally {
    await page.close()
  }
})

test('Start Over cancel dismisses dialog and keeps results', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /start over/i)
    await page.waitForFunction(() => !!document.querySelector('.tool-confirm-backdrop'))
    await page.click('.tool-confirm-cancel')
    await page.waitForFunction(() => !document.querySelector('.tool-confirm-backdrop'))
    const results = await page.$('.bakery-email-btn')
    assert.ok(results, 'Results should still be visible after cancel')
  } finally {
    await page.close()
  }
})

test('Start Over confirm clears all answers and returns to Stage 1', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /start over/i)
    await page.waitForFunction(() => !!document.querySelector('.tool-confirm-backdrop'))
    await page.click('.tool-confirm-proceed')
    await page.waitForFunction(() => !!document.querySelector('input[name="productType"]'))
    const product = await page.$eval('input[name="productType"][value="cake"]', (el: Element) => (el as HTMLInputElement).checked)
    assert.equal(product, false, 'Product type should be cleared after Start Over')
    const privacyNote = await page.$('.tool-privacy-note')
    assert.ok(privacyNote, 'Privacy note should reappear (back on Stage 1)')
  } finally {
    await page.close()
  }
})

// ─── 14. Websites by Leslie CTA ──────────────────────────────────────────────

test('CTA heading is "Want an order planner like this for your business?"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const heading = await page.$eval('.tool-sales-cta-heading', el => el.textContent?.trim())
    assert.equal(heading, 'Want an order planner like this for your business?')
  } finally {
    await page.close()
  }
})

test('CTA body text mentions products, ordering process, and brand', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const body = await page.$eval('.tool-sales-cta-body', el => el.textContent || '')
    assert.match(body, /products/i)
    assert.match(body, /ordering process/i)
    assert.match(body, /brand/i)
  } finally {
    await page.close()
  }
})

test('CTA button text is "Ask About a Custom Planner →"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const linkText = await page.$eval('.tool-sales-cta-link', el => el.textContent?.trim())
    assert.match(linkText || '', /Ask About a Custom Planner/)
  } finally {
    await page.close()
  }
})

test('CTA button opens mailto to websitesbyleslie01@gmail.com', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.tool-sales-cta-link', el => el.getAttribute('href') || '')
    assert.match(href, /mailto:websitesbyleslie01@gmail\.com/)
  } finally {
    await page.close()
  }
})

test('CTA eyebrow labels it as for custom-order businesses', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const eyebrow = await page.$eval('.tool-sales-cta-eyebrow', el => el.textContent || '')
    assert.match(eyebrow, /custom.order|business/i)
  } finally {
    await page.close()
  }
})

// ─── 15. Services page demo link ─────────────────────────────────────────────

test('services page has a demo card for the Custom Bakery Order Planner', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const demoCard = await page.$('.pricing-demo-card')
    assert.ok(demoCard, 'Demo card should appear on services page')
    const title = await page.$eval('.pricing-demo-card-title', el => el.textContent?.trim())
    assert.match(title || '', /custom bakery order planner/i)
  } finally {
    await page.close()
  }
})

test('services page demo link points to /tools-custom-bakery-order', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const href = await page.$eval('.pricing-demo-link', el => el.getAttribute('href'))
    assert.equal(href, '/tools-custom-bakery-order')
  } finally {
    await page.close()
  }
})

test('services page demo section has a "Live Demo" tag', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const tag = await page.$eval('.pricing-demo-tag', el => el.textContent?.trim())
    assert.match(tag || '', /live demo/i)
  } finally {
    await page.close()
  }
})

// ─── 16. No horizontal overflow at key viewports ─────────────────────────────

for (const viewport of [320, 375, 390, 768, 1440]) {
  test(`no horizontal overflow at ${viewport}px on Stage 1`, async () => {
    const page = await openTool()
    try {
      await page.setViewport({ width: viewport, height: 900 })
      await page.goto(`${baseUrl}/tools-custom-bakery-order.html`, { waitUntil: 'load' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 0, `Expected no overflow at ${viewport}px, got ${overflow}px`)
    } finally {
      await page.close()
    }
  })
}

test('no horizontal overflow at 375px on results screen', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 375, height: 812 })
    await advanceToResults(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `Expected no overflow on results at 375px, got ${overflow}px`)
  } finally {
    await page.close()
  }
})

test('no horizontal overflow at 320px on results screen', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 320, height: 568 })
    await advanceToResults(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `Expected no overflow on results at 320px, got ${overflow}px`)
  } finally {
    await page.close()
  }
})

// ─── 17. Touch target minimum sizes ──────────────────────────────────────────

test('all buttons meet 44px minimum height on Stage 1', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 375, height: 812 })
    const smallBtns = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      return btns
        .filter(btn => {
          const r = btn.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.height < 44
        })
        .map(btn => btn.textContent?.trim())
    })
    assert.deepEqual(smallBtns, [], `Buttons smaller than 44px: ${JSON.stringify(smallBtns)}`)
  } finally {
    await page.close()
  }
})

test('all OptionCard labels meet 44px minimum height on Stage 1', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 375, height: 812 })
    const smallCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.option-card'))
      return cards
        .filter(card => {
          const r = card.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.height < 44
        })
        .map(card => card.textContent?.trim()?.slice(0, 40))
    })
    assert.deepEqual(smallCards, [], `OptionCards smaller than 44px: ${JSON.stringify(smallCards)}`)
  } finally {
    await page.close()
  }
})

test('bakery inline check toggles meet 44px minimum height', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.setViewport({ width: 375, height: 812 })
    const small = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.bakery-inline-check'))
      return labels
        .filter(el => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.height < 44
        })
        .map(el => el.textContent?.trim())
    })
    assert.deepEqual(small, [], `Inline check labels smaller than 44px: ${JSON.stringify(small)}`)
  } finally {
    await page.close()
  }
})

// ─── 18. Accessibility ───────────────────────────────────────────────────────

test('Stage 1 has fieldsets with legend elements for all radio groups', async () => {
  const page = await openTool()
  try {
    const fieldsets = await page.$$('fieldset.tool-question-fieldset')
    assert.ok(fieldsets.length >= 3, 'Should have at least 3 fieldsets on Stage 1')
    for (const fs of fieldsets) {
      const legend = await fs.$('legend')
      assert.ok(legend, 'Each fieldset should have a legend')
    }
  } finally {
    await page.close()
  }
})

test('Stage 1 validation error triggers role="alert" on field errors', async () => {
  const page = await openTool()
  try {
    await page.click('.tool-nav-next')
    const alerts = await page.$$('[role="alert"]')
    assert.ok(alerts.length > 0, 'At least one role="alert" element should appear on validation failure')
  } finally {
    await page.close()
  }
})

test('Stage 2 required field error triggers role="alert"', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.click('.tool-nav-next')
    const alerts = await page.$$('[role="alert"]')
    assert.ok(alerts.length > 0, 'Validation alerts should appear on Stage 2')
  } finally {
    await page.close()
  }
})

test('Stage 3 required field error triggers role="alert"', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('.tool-nav-next')
    const alerts = await page.$$('[role="alert"]')
    assert.ok(alerts.length > 0, 'Validation alerts should appear on Stage 3')
  } finally {
    await page.close()
  }
})

test('budget fieldset has an accessible legend', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const legend = await page.$('fieldset.tool-question-fieldset legend')
    assert.ok(legend, 'Budget fieldset should have a legend')
    const text = await legend!.evaluate(el => el.textContent?.trim())
    assert.match(text || '', /budget/i)
  } finally {
    await page.close()
  }
})

// ─── 19. No network requests, storage APIs, or submission behavior ────────────

test('localStorage and sessionStorage are empty throughout the flow', async () => {
  const page = await openTool()
  try {
    await fillStage1(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('#sizeQuantity'))
    const storage = await page.evaluate(() => ({
      local:   Object.keys(localStorage).length,
      session: Object.keys(sessionStorage).length,
    }))
    assert.equal(storage.local,   0, 'localStorage should be empty')
    assert.equal(storage.session, 0, 'sessionStorage should be empty')
  } finally {
    await page.close()
  }
})

test('no form elements with an action attribute exist in the tool', async () => {
  const page = await openTool()
  try {
    const formsWithAction = await page.$$eval('form[action]', els => els.length)
    assert.equal(formsWithAction, 0, 'No forms with server action should exist')
  } finally {
    await page.close()
  }
})

test('no file upload inputs exist anywhere in the tool', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const uploads = await page.$$('input[type="file"]')
    assert.equal(uploads.length, 0, 'No file upload inputs should exist')
  } finally {
    await page.close()
  }
})

test('no price calculation, payment UI, or order confirmation text in results', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const bodyText = await page.$eval('body', el => el.textContent || '')
    assert.doesNotMatch(bodyText, /order confirmed|order number|payment required|add to cart|checkout/i)
    assert.doesNotMatch(bodyText, /your price is|total cost|calculated estimate/i)
  } finally {
    await page.close()
  }
})

// ─── 20. Regression — all existing tools still load ──────────────────────────

async function checkToolLoads(path: string, pattern: RegExp): Promise<boolean> {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/${path}`, { waitUntil: 'load' })
    return pattern.test(await page.title())
  } finally {
    await page.close()
  }
}

test('Regression: Buyer Readiness Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-buyer.html', /buyer/i))
})

test('Regression: Seller Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-seller.html', /seller/i))
})

test('Regression: Listing Preparation Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-listing-preparation.html', /listing/i))
})

test('Regression: Property Comparison Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-property-comparison.html', /property|comparison/i))
})

test('Regression: Open House Follow-Up Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-open-house-follow-up.html', /open house|follow.up/i))
})

test('Regression: Closing & Moving Organizer still loads', async () => {
  assert.ok(await checkToolLoads('tools-closing-moving.html', /closing|moving/i))
})
