// Real-browser integration tests for the Free Home Bakery Pricing
// Calculator's guided UI (Milestone M3): step navigation, ingredient entry
// with unit-mismatch blocking, zero-cost acknowledge-and-dismiss, a
// hand-verified cost-breakdown/pricing example, margin/markup and rounding
// interaction, decimal exactness through the UI, "start over," and
// accessibility/mobile checks. Runs against the production build (dist/)
// via a lightweight static HTTP server, driven by real headless Chrome —
// the site's established pattern (see bakeryOrderPlanner.test.ts).
//
// Run with: node --test test/tools/bakeryPricingCalculatorUI.test.ts

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
  '.svg': 'image/svg+xml',
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

// ─── Helpers ────────────────────────────────────────────────────────────────

async function openTool(): Promise<Page> {
  const page = await browser.newPage()
  await page.goto(`${baseUrl}/tools-bakery-pricing.html`, { waitUntil: 'load' })
  return page
}

async function setYield(page: Page, value: string) {
  await page.click('#bp-yield', { clickCount: 3 })
  await page.type('#bp-yield', value)
}

// Sets a React-controlled input's value directly via the native value setter
// (rather than click-to-select + type, which can be flaky for replacing
// existing text in headless Chrome) — the same pattern the site's own
// bakeryOrderPlanner.test.ts uses for its date input.
async function setInputValue(page: Page, selector: string, value: string) {
  await page.evaluate((sel: string, val: string) => {
    const input = document.querySelector(sel) as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, selector, value)
}

interface IngredientInput {
  name: string
  measurementType: 'weight' | 'volume' | 'count'
  packageUnit: string
  amountUsedUnit: string
  packagePrice: string
  packageQuantity: string
  amountUsed: string
}

async function addIngredient(page: Page, ing: IngredientInput) {
  await page.click('.bp-btn-ghost')
  await page.waitForFunction(() => !!document.querySelector('#bp-ing-name'))
  await page.type('#bp-ing-name', ing.name)
  const selects = await page.$$('.bp-add-ingredient-form select')
  await selects[0].select(ing.measurementType)
  const refreshedSelects = await page.$$('.bp-add-ingredient-form select')
  await refreshedSelects[1].select(ing.packageUnit)
  await refreshedSelects[2].select(ing.amountUsedUnit)
  await page.type('#bp-ing-price', ing.packagePrice)
  const decimals = await page.$$('.bp-add-ingredient-form input[inputmode="decimal"]')
  await decimals[1].type(ing.packageQuantity)
  await decimals[2].type(ing.amountUsed)
}

async function saveIngredient(page: Page) {
  await page.click('.bp-add-ingredient-form .bp-btn-primary')
}

async function advanceToCosts(page: Page, yieldValue = '24') {
  await setYield(page, yieldValue)
  await page.click('.bp-nav .bp-btn-primary')
  await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
}

async function openCostGroup(page: Page, index: number) {
  const summaries = await page.$$('summary')
  await summaries[index].click()
}

async function advanceToBreakdown(page: Page, yieldValue = '24') {
  await advanceToCosts(page, yieldValue)
  await page.click('.bp-nav .bp-btn-primary')
  await page.waitForFunction(() => !!document.querySelector('.bp-ledger'))
}

// ─── 1. Page load and static structure ──────────────────────────────────────

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

test('page title is "Free Home Bakery Pricing Calculator"', async () => {
  const page = await openTool()
  try {
    assert.equal(await page.title(), 'Free Home Bakery Pricing Calculator')
  } finally {
    await page.close()
  }
})

test('header shows the public tool name', async () => {
  const page = await openTool()
  try {
    const title = await page.$eval('.tool-header-title', el => el.textContent?.trim())
    assert.equal(title, 'Free Home Bakery Pricing Calculator')
  } finally {
    await page.close()
  }
})

test('noindex, nofollow meta tag is present', async () => {
  const page = await openTool()
  try {
    const content = await page.$eval('meta[name="robots"]', el => (el as HTMLMetaElement).content)
    assert.match(content, /noindex/)
    assert.match(content, /nofollow/)
  } finally {
    await page.close()
  }
})

test('step indicator shows "Step 1 of 3" on load', async () => {
  const page = await openTool()
  try {
    const text = await page.$eval('.bp-step-indicator', el => el.textContent || '')
    assert.match(text, /Step 1 of 3/)
  } finally {
    await page.close()
  }
})

test('persistent disclaimer is present with role="note"', async () => {
  const page = await openTool()
  try {
    const el = await page.$('.tool-disclaimer')
    assert.ok(el, 'disclaimer should exist')
    const role = await el!.evaluate(node => node.getAttribute('role'))
    assert.equal(role, 'note')
    const text = await el!.evaluate(node => node.textContent || '')
    assert.match(text, /not accounting, tax, or financial advice/i)
    assert.match(text, /does not guarantee a profit/i)
  } finally {
    await page.close()
  }
})

// ─── 2. Step 1 — yield & required-field gating ──────────────────────────────

test('does not advance past Step 1 with an empty yield', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-nav .bp-btn-primary')
    const error = await page.$eval('#bp-yield', el => el.getAttribute('aria-invalid'))
    assert.equal(error, 'true')
    const stillStep1 = await page.$('#bp-recipe-name')
    assert.ok(stillStep1, 'should still be on Step 1')
  } finally {
    await page.close()
  }
})

test('advances to Step 2 with a valid yield and zero ingredients', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page, '24')
    const onStep2 = await page.$('#bp-labor-rate')
    assert.ok(onStep2, 'should be on Step 2 even with no ingredients added')
  } finally {
    await page.close()
  }
})

test('rejects a zero yield with the engine\'s own message', async () => {
  const page = await openTool()
  try {
    await setYield(page, '0')
    await page.click('.bp-nav .bp-btn-primary')
    const alertText = await page.$eval('[role="alert"]', el => el.textContent || '')
    assert.match(alertText, /positive whole number/i)
  } finally {
    await page.close()
  }
})

// ─── 3. Ingredient entry & unit-mismatch blocking ───────────────────────────

test('adding a valid ingredient shows it in the list with the correct computed cost', async () => {
  const page = await openTool()
  try {
    await setYield(page, '24')
    await addIngredient(page, {
      name: 'Eggs', measurementType: 'count', packageUnit: 'each', amountUsedUnit: 'each',
      packagePrice: '4.00', packageQuantity: '4', amountUsed: '2',
    })
    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    const rowText = await page.$eval('.bp-ingredient-list', el => el.textContent || '')
    assert.match(rowText, /Eggs/)
    assert.match(rowText, /\$2\.00/, `expected $2.00 cost, got: ${rowText}`)
    const subtotal = await page.$eval('.bp-ingredient-subtotal', el => el.textContent || '')
    assert.match(subtotal, /\$2\.00/)
  } finally {
    await page.close()
  }
})

test('removing an ingredient takes it out of the list and updates the subtotal', async () => {
  const page = await openTool()
  try {
    await setYield(page, '24')
    await addIngredient(page, {
      name: 'Eggs', measurementType: 'count', packageUnit: 'each', amountUsedUnit: 'each',
      packagePrice: '4.00', packageQuantity: '4', amountUsed: '2',
    })
    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    await page.click('.bp-remove-btn')
    const rows = await page.$$('.bp-ingredient-row')
    assert.equal(rows.length, 0, 'no ingredient rows should remain (subtotal row is also removed when list is empty)')
  } finally {
    await page.close()
  }
})

// M3's ingredient-add form has one measurement-type selector driving both the
// package-unit and amount-used-unit dropdowns, so both are always populated
// from the same unit list — a mismatched pair cannot be constructed through
// this form (that becomes reachable once M4 adds a reusable ingredient
// library with its own fixed package unit, used from a different recipe's
// usage-unit picker). This test proves that structural guarantee for weight
// and volume; the engine's own mismatch-blocking logic is exercised directly
// by the deterministic calc-engine suite (bakeryPricingValidation.test.ts).
test('the ingredient form never offers a package/usage unit pairing from two different measurement types', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-btn-ghost')
    await page.waitForFunction(() => !!document.querySelector('#bp-ing-type'))
    for (const [type, expectedUnits] of [
      ['weight', ['g', 'kg', 'oz', 'lb']],
      ['volume', ['mL', 'L', 'tsp', 'tbsp', 'cup']],
      ['count', ['each', 'dozen']],
    ] as const) {
      await page.select('#bp-ing-type', type)
      const [pkgUnits, useUnits] = await page.$$eval('.bp-add-ingredient-form select', sels => [
        Array.from((sels[1] as HTMLSelectElement).options).map(o => o.value),
        Array.from((sels[2] as HTMLSelectElement).options).map(o => o.value),
      ])
      assert.deepEqual(pkgUnits.sort(), [...expectedUnits].sort(), `package units for ${type}`)
      assert.deepEqual(useUnits.sort(), [...expectedUnits].sort(), `usage units for ${type}`)
    }
  } finally {
    await page.close()
  }
})

test('changing measurement type resets package and usage units to that type\'s units', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-btn-ghost')
    await page.waitForFunction(() => !!document.querySelector('#bp-ing-type'))
    await page.select('#bp-ing-type', 'volume')
    const options = await page.$$eval('.bp-add-ingredient-form select', sels =>
      [1, 2].map(i => (sels[i] as HTMLSelectElement).value),
    )
    assert.ok(options.every(u => ['mL', 'L', 'tsp', 'tbsp', 'cup'].includes(u)), `expected volume units, got: ${options}`)
  } finally {
    await page.close()
  }
})

test('a live cost preview appears once price, quantity, and amount used are all filled in', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, {
      name: 'Flour', measurementType: 'weight', packageUnit: 'lb', amountUsedUnit: 'g',
      packagePrice: '3.49', packageQuantity: '5', amountUsed: '280',
    })
    await page.waitForFunction(() => /costs about/i.test(document.querySelector('.bp-add-ingredient-form')?.textContent || ''))
    const text = await page.$eval('.bp-add-ingredient-form', el => el.textContent || '')
    assert.match(text, /costs about/i)
  } finally {
    await page.close()
  }
})

test('rejects an ingredient with a negative package price using the engine\'s own message', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, {
      name: 'Bad Price', measurementType: 'weight', packageUnit: 'g', amountUsedUnit: 'g',
      packagePrice: '-1', packageQuantity: '1', amountUsed: '1',
    })
    await saveIngredient(page)
    const alertText = await page.$eval('.bp-add-ingredient-form [role="alert"]', el => el.textContent || '')
    assert.match(alertText, /cannot be negative/i)
    const added = await page.$('.bp-ingredient-row')
    assert.equal(added, null, 'the invalid ingredient must not be added to the list')
  } finally {
    await page.close()
  }
})

// ─── 4. Additional Costs — validation and zero-cost acknowledgement ─────────

test('an invalid (negative) cost field shows a calm inline error and blocks advancing', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await page.type('#bp-labor-rate', '-5')
    const error = await page.$eval('#bp-labor-rate', el => el.getAttribute('aria-invalid'))
    assert.equal(error, 'true')
    await page.click('.bp-nav .bp-btn-primary')
    const stillStep2 = await page.$('#bp-labor-rate')
    assert.ok(stillStep2, 'should not advance past Step 2 with an invalid field')
  } finally {
    await page.close()
  }
})

test('a fragment like "-" alone while typing a decimal field does not crash the page', async () => {
  const page = await openTool()
  const errors: string[] = []
  try {
    await advanceToCosts(page)
    page.on('pageerror', err => errors.push(String(err)))
    await page.type('#bp-overhead', '-')
    await new Promise(r => setTimeout(r, 100))
    assert.deepEqual(errors, [])
    const navStillThere = await page.$('.bp-nav')
    assert.ok(navStillThere, 'the app must not crash on a transient invalid decimal fragment')
  } finally {
    await page.close()
  }
})

test('zero-cost notice appears for Labor when both fields are blank', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    const notice = await page.$('.bp-zero-notice')
    assert.ok(notice, 'zero-cost notice should appear for Labor by default')
    const text = await notice!.evaluate(el => el.textContent || '')
    assert.match(text, /is that intentional/i)
  } finally {
    await page.close()
  }
})

async function laborNoticePresent(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.querySelectorAll('.bp-cost-group')[0]?.querySelector('.bp-zero-notice'))
}

test('dismissing the zero-cost notice hides it and it does not reappear after further edits', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    assert.ok(await laborNoticePresent(page), 'labor notice should be present before dismissal')
    await page.click('.bp-cost-group .bp-zero-notice button')
    assert.equal(await laborNoticePresent(page), false, 'labor notice should be dismissed')
    // Edit the field and change it back to zero — must not re-warn per the PRD.
    await page.type('#bp-labor-rate', '10')
    await page.click('#bp-labor-rate', { clickCount: 3 })
    await page.keyboard.press('Backspace')
    assert.equal(await laborNoticePresent(page), false, 'an acknowledged zero must not re-warn this session')
  } finally {
    await page.close()
  }
})

test('Packaging zero-notice requires BOTH batch and per-item cost to be zero', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await openCostGroup(page, 1) // Packaging
    await page.type('#bp-pkg-batch', '1.50')
    const packagingNotice = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll('.bp-cost-group'))
      const packaging = groups[1]
      return !!packaging?.querySelector('.bp-zero-notice')
    })
    assert.equal(packagingNotice, false, 'packaging must not be flagged as zero once one of its two fields is nonzero')
  } finally {
    await page.close()
  }
})

// ─── 5. Cost Breakdown & Pricing — hand-verified example ────────────────────

async function buildHandVerifiedRecipe(page: Page) {
  await setYield(page, '24')
  await addIngredient(page, {
    name: 'Eggs', measurementType: 'count', packageUnit: 'each', amountUsedUnit: 'each',
    packagePrice: '4.00', packageQuantity: '4', amountUsed: '2',
  })
  await saveIngredient(page)
  await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
  await page.click('.bp-nav .bp-btn-primary')
  await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
  await page.type('#bp-labor-rate', '18')
  await page.type('#bp-labor-minutes', '40')
  await openCostGroup(page, 1)
  await page.type('#bp-pkg-batch', '1.50')
  await page.type('#bp-pkg-item', '0.15')
  await openCostGroup(page, 2)
  await page.type('#bp-overhead', '3.00')
  await openCostGroup(page, 3)
  await page.type('#bp-waste', '3')
  await page.click('.bp-nav .bp-btn-primary')
  await page.waitForFunction(() => !!document.querySelector('.bp-ledger'))
}

// Hand-verified: ingredientSubtotal $2.00 (4.00 * 2/4), wasteAllowance $0.06 (2.00*3%),
// laborCost $12.00 (18 * 40/60), packaging $5.10 (1.50 + 0.15*24), overhead $3.00.
// Total = 2.00 + 0.06 + 12.00 + 5.10 + 3.00 = $22.16. Cost per item = 22.16/24 = $0.92 (2dp).
test('cost breakdown matches a hand-verified example exactly', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const ledgerText = await page.$eval('.bp-ledger', el => el.textContent || '')
    assert.match(ledgerText, /\$2\.00/, 'ingredient subtotal')
    assert.match(ledgerText, /\$0\.06/, 'waste allowance')
    assert.match(ledgerText, /\$12\.00/, 'labor cost')
    assert.match(ledgerText, /\$5\.10/, 'packaging cost')
    assert.match(ledgerText, /\$3\.00/, 'overhead')
    assert.match(ledgerText, /\$22\.16/, 'total production cost')
    assert.match(ledgerText, /\$0\.92/, 'cost per item')
  } finally {
    await page.close()
  }
})

// At 35% margin (default) and $0.25 rounding: exact target batch = 22.16/0.65 = $34.09230769...,
// suggested whole-batch rounds UP to $34.25; exact per-item = 34.0923/24 = $1.42051282,
// suggested per-item rounds UP to $1.50.
test('suggested pricing at the default 35% margin and $0.25 increment matches the hand-verified example', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const text = await page.$eval('.bp-price-callout-gold', el => el.textContent || '')
    assert.match(text, /\$34\.25/, `expected suggested whole-batch price $34.25, got: ${text}`)
    assert.match(text, /\$1\.50/, `expected suggested per-item price $1.50, got: ${text}`)
  } finally {
    await page.close()
  }
})

test('changing the rounding increment recomputes the suggested price', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.bp-increment-row button'))
      const dollarButton = buttons.find(b => b.textContent?.includes('1.00')) as HTMLButtonElement
      dollarButton.click()
    })
    const text = await page.$eval('.bp-price-callout-gold', el => el.textContent || '')
    // Exact batch $34.0923 rounds up to $35 at the $1.00 increment.
    assert.match(text, /\$35\.00/, `expected $35.00 whole batch at $1 increment, got: ${text}`)
  } finally {
    await page.close()
  }
})

test('margin change updates the equivalent markup echo live', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    await setInputValue(page, '[aria-label="Desired profit margin percentage"]', '50')
    await page.waitForFunction(() => /≈ 100\.0%/.test(document.querySelector('.bp-margin-callout')?.textContent || ''))
    const calloutText = await page.$eval('.bp-margin-callout', el => el.textContent || '')
    assert.match(calloutText, /≈ 100\.0%/, `expected 50% margin to equal 100% markup, got: ${calloutText}`)
  } finally {
    await page.close()
  }
})

test('independent-rounding explanatory note is present and mentions it is expected, not an error', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const text = await page.$eval('.bp-price-callout-gold', el => el.textContent || '')
    assert.match(text, /rounded independently/i)
    assert.match(text, /expected, not an error/i)
  } finally {
    await page.close()
  }
})

test('a margin at or above 100% is blocked with the engine\'s own message', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    await setInputValue(page, '[aria-label="Desired profit margin percentage"]', '100')
    await page.waitForFunction(() => !!document.querySelector('.bp-step [role="alert"]'))
    const alertText = await page.$eval('.bp-step [role="alert"]', el => el.textContent || '')
    assert.match(alertText, /100%/i)
  } finally {
    await page.close()
  }
})

// ─── 6. Decimal exactness through the UI ────────────────────────────────────

// Fine Sea Salt, $0.99 / 26 oz, using 0.1 oz: 0.99 * (0.1/26) = $0.0038076923...
// — genuinely sub-penny, per the PRD's own worked example ingredient list.
test('a tiny fractional ingredient cost is shown to 4 decimal places, not rounded to zero', async () => {
  const page = await openTool()
  try {
    await setYield(page, '24')
    await addIngredient(page, {
      name: 'Fine Sea Salt', measurementType: 'weight', packageUnit: 'oz', amountUsedUnit: 'oz',
      packagePrice: '0.99', packageQuantity: '26', amountUsed: '0.1',
    })
    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    const rowText = await page.$eval('.bp-ingredient-list', el => el.textContent || '')
    assert.match(rowText, /\$0\.0038\b/, `expected a 4-decimal tiny cost of $0.0038, got: ${rowText}`)
    assert.doesNotMatch(rowText, /\$0\.00\b/, 'a genuinely tiny nonzero cost must not display as $0.00')
  } finally {
    await page.close()
  }
})

// ─── 7. Start over ───────────────────────────────────────────────────────────

test('Start Over shows a confirmation dialog and cancel keeps the current data', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    await page.click('.bp-link-btn')
    await page.waitForFunction(() => !!document.querySelector('.tool-confirm-backdrop'))
    await page.click('.tool-confirm-cancel')
    await page.waitForFunction(() => !document.querySelector('.tool-confirm-backdrop'))
    const stillOnBreakdown = await page.$('.bp-ledger')
    assert.ok(stillOnBreakdown, 'data should be preserved after cancelling Start Over')
  } finally {
    await page.close()
  }
})

test('Start Over confirm clears the draft and returns to Step 1', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    await page.click('.bp-link-btn')
    await page.waitForFunction(() => !!document.querySelector('.tool-confirm-backdrop'))
    await page.click('.tool-confirm-proceed')
    await page.waitForFunction(() => !!document.querySelector('#bp-yield'))
    const yieldValue = await page.$eval('#bp-yield', el => (el as HTMLInputElement).value)
    assert.equal(yieldValue, '', 'yield should be cleared')
    const ingredientCount = await page.$$eval('.bp-ingredient-row', els => els.length)
    assert.equal(ingredientCount, 0, 'ingredients should be cleared')
  } finally {
    await page.close()
  }
})

// ─── 8. No persistence — what-if edits stay temporary ───────────────────────

test('localStorage and sessionStorage stay empty throughout the entire flow', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage).length,
      session: Object.keys(sessionStorage).length,
    }))
    assert.equal(storage.local, 0, 'localStorage should be empty')
    assert.equal(storage.session, 0, 'sessionStorage should be empty')
  } finally {
    await page.close()
  }
})

test('no IndexedDB database is created during the M3 flow', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const dbNames = await page.evaluate(async () => {
      if (!indexedDB.databases) return []
      const dbs = await indexedDB.databases()
      return dbs.map(d => d.name)
    })
    assert.deepEqual(dbNames, [], 'M3 must not touch IndexedDB — persistence is Milestone M4')
  } finally {
    await page.close()
  }
})

// ─── 9. No monetization, accounts, or tracking language ─────────────────────

test('no premium, purchase, account, or tracking language appears anywhere on the page', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const bodyText = await page.$eval('body', el => el.textContent || '')
    assert.doesNotMatch(bodyText, /premium|upgrade|purchase|subscribe|checkout|sign up|sign in|create an account|log in/i)
  } finally {
    await page.close()
  }
})

test('no sales CTA is present in M3 (that is Milestone M7 scope)', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const cta = await page.$('.tool-sales-cta')
    assert.equal(cta, null, 'the results-only sales CTA is not built until M7')
  } finally {
    await page.close()
  }
})

test('no form elements with a server action attribute exist', async () => {
  const page = await openTool()
  try {
    const count = await page.$$eval('form[action]', els => els.length)
    assert.equal(count, 0)
  } finally {
    await page.close()
  }
})

// ─── 10. Accessibility ───────────────────────────────────────────────────────

test('yield, recipe name, and margin inputs each have an associated label', async () => {
  const page = await openTool()
  try {
    const yieldLabel = await page.$eval('label[for="bp-yield"]', el => el.textContent || '')
    assert.match(yieldLabel, /yield/i)
    const nameLabel = await page.$eval('label[for="bp-recipe-name"]', el => el.textContent || '')
    assert.match(nameLabel, /recipe name/i)
  } finally {
    await page.close()
  }
})

test('cost input fields each have an associated label', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    for (const [id, pattern] of [
      ['bp-labor-rate', /hourly rate/i],
      ['bp-labor-minutes', /active minutes/i],
    ] as const) {
      const label = await page.$eval(`label[for="${id}"]`, el => el.textContent || '')
      assert.match(label, pattern)
    }
  } finally {
    await page.close()
  }
})

test('a visible focus outline appears on the yield input when focused', async () => {
  const page = await openTool()
  try {
    await page.focus('#bp-yield')
    const outline = await page.$eval('#bp-yield', el => getComputedStyle(el).outlineStyle)
    assert.notEqual(outline, 'none', 'focused input must show a visible focus outline')
  } finally {
    await page.close()
  }
})

test('validation errors are announced via role="alert"', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-nav .bp-btn-primary')
    const alerts = await page.$$('[role="alert"]')
    assert.ok(alerts.length > 0, 'at least one role="alert" should appear on validation failure')
  } finally {
    await page.close()
  }
})

for (const viewport of [320, 375, 390, 768, 1440]) {
  test(`no horizontal overflow at ${viewport}px on Step 1`, async () => {
    const page = await openTool()
    try {
      await page.setViewport({ width: viewport, height: 900 })
      await page.goto(`${baseUrl}/tools-bakery-pricing.html`, { waitUntil: 'load' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 0, `expected no overflow at ${viewport}px, got ${overflow}px`)
    } finally {
      await page.close()
    }
  })
}

test('no horizontal overflow at 375px on the Cost Breakdown step', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 375, height: 812 })
    await buildHandVerifiedRecipe(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `expected no overflow, got ${overflow}px`)
  } finally {
    await page.close()
  }
})

test('all buttons meet a 44px minimum height on Step 1 at mobile width', async () => {
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
    assert.deepEqual(smallBtns, [], `buttons smaller than 44px: ${JSON.stringify(smallBtns)}`)
  } finally {
    await page.close()
  }
})

test('all text inputs meet a 44px minimum height on Step 1 at mobile width', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 375, height: 812 })
    const smallInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'))
      return inputs
        .filter(el => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.height < 44
        })
        .map(el => (el as HTMLInputElement).id)
    })
    assert.deepEqual(smallInputs, [], `inputs smaller than 44px: ${JSON.stringify(smallInputs)}`)
  } finally {
    await page.close()
  }
})

// ─── 11. Regression — other tools still load ────────────────────────────────

async function checkToolLoads(pathName: string, pattern: RegExp): Promise<boolean> {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/${pathName}`, { waitUntil: 'load' })
    return pattern.test(await page.title())
  } finally {
    await page.close()
  }
}

test('Regression: Custom Bakery Order Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-custom-bakery-order.html', /bakery/i))
})

test('Regression: Plumbing Service Visit Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-plumbing-visit.html', /plumbing/i))
})

test('Regression: Services page still loads', async () => {
  assert.ok(await checkToolLoads('services.html', /service/i))
})
