// Real-browser integration tests for the post-M4 beginner-guidance
// enhancement: optional "Help me estimate this" estimators for Labor,
// Overhead, and Waste; the results-step Cost Completeness Check and Test a
// Selling Price panel; the updated disclaimer copy; and saved-data
// compatibility for values that originated from an estimator. Runs against
// the production build (dist/) via a lightweight static HTTP server, driven
// by real headless Chrome — the same pattern as bakeryPricingCalculatorUI.test.ts.
//
// Run with: node --test test/tools/bakeryPricingCostEstimators.test.ts

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

// A fresh page with a wiped IndexedDB database and cleared localStorage —
// this suite touches both the saved-recipe database and the "last hourly
// rate" local preference, and neither should leak between tests.
async function openFreshTool(): Promise<Page> {
  const page = await browser.newPage()
  await page.goto(`${baseUrl}/tools-bakery-pricing.html`, { waitUntil: 'load' })
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        localStorage.clear()
        const req = indexedDB.deleteDatabase('bakery-pricing-planner')
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        req.onblocked = () => resolve()
      }),
  )
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('#bp-recipe-name', { timeout: 8000 })
  return page
}

async function setInputValue(page: Page, selector: string, value: string) {
  await page.evaluate((sel: string, val: string) => {
    const input = document.querySelector(sel) as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, selector, value)
}

async function addFillerIngredientAndReachCosts(page: Page, yieldValue = '12') {
  await setInputValue(page, '#bp-yield', yieldValue)
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
}

async function openCostGroup(page: Page, index: number) {
  const summaries = await page.$$('.bp-cost-group summary')
  await summaries[index]!.click()
}

async function reachBreakdown(page: Page) {
  await page.click('.bp-nav .bp-btn-primary')
  await page.waitForSelector('.bp-completeness-check')
}

// ─── 1. Labor estimator ─────────────────────────────────────────────────────

test('Labor: direct-entry fields are shown by default, unchanged', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    const rateVisible = await page.$('#bp-labor-rate')
    const minutesVisible = await page.$('#bp-labor-minutes')
    assert.ok(rateVisible, 'hourly rate field must be directly enterable by default')
    assert.ok(minutesVisible, 'active minutes field must be directly enterable by default')
    const estimatorPresent = await page.$('.bp-estimator')
    assert.equal(estimatorPresent, null, 'the estimator panel must not be shown until explicitly requested')
  } finally {
    await page.close()
  }
})

test('Labor: "Help me estimate" reveals a task checklist that sums to active minutes and applies on request', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    const radios = await page.$$('input[name="bp-labor-minutes-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('.bp-estimator')

    const rows = await page.$$('.bp-estimator-rows input')
    assert.equal(rows.length, 8, 'expects all eight task rows: shopping, prep, supervision, decorating, packaging, cleanup, communication, delivery')
    await rows[0]!.type('15')
    await rows[3]!.type('10')
    await page.waitForFunction(() => document.querySelector('.bp-estimator-total')?.textContent?.includes('25'))

    await page.click('.bp-estimator .bp-btn-secondary')
    await page.waitForSelector('#bp-labor-minutes')
    const value = await page.$eval('#bp-labor-minutes', el => (el as HTMLInputElement).value)
    assert.equal(value, '25')

    // Applying returns to direct mode so the result is visible in the ordinary field.
    const directChecked = await page.$eval('input[name="bp-labor-minutes-mode"]', el => (el as HTMLInputElement).checked)
    assert.equal(directChecked, true)
  } finally {
    await page.close()
  }
})

test('Labor: the "Use this total" button is disabled while every task row is blank', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    const radios = await page.$$('input[name="bp-labor-minutes-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('.bp-estimator')
    const disabled = await page.$eval('.bp-estimator .bp-btn-secondary', el => (el as HTMLButtonElement).disabled)
    assert.equal(disabled, true)
  } finally {
    await page.close()
  }
})

test('Labor: switching to estimate mode and back without applying leaves a directly-entered value untouched', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    await setInputValue(page, '#bp-labor-minutes', '99')
    const radios = await page.$$('input[name="bp-labor-minutes-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('.bp-estimator')
    await radios[0]!.click()
    await page.waitForSelector('#bp-labor-minutes')
    const value = await page.$eval('#bp-labor-minutes', el => (el as HTMLInputElement).value)
    assert.equal(value, '99', 'switching modes without applying must never clear or alter the direct value')
  } finally {
    await page.close()
  }
})

test('Labor: passive baking/cooling time is never a task row — only active-time tasks are offered', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    const radios = await page.$$('input[name="bp-labor-minutes-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('.bp-estimator')
    const labels = await page.$$eval('.bp-estimator-row label', els => els.map(e => e.textContent))
    assert.deepEqual(labels, [
      'Shopping / ingredient pickup',
      'Preparation and mixing',
      'Active baking supervision',
      'Cooling / decorating',
      'Packaging',
      'Cleanup',
      'Customer communication',
      'Delivery or handoff',
    ])
    assert.ok(!labels.some(l => /^(baking|cooling)$/i.test(l ?? '')), 'no row should represent the full passive baking/cooling duration')
  } finally {
    await page.close()
  }
})

test('Labor: explains that labor pays the baker while profit belongs to the business, and offers rate-setting questions — without prescribing a universal rate', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    const text = await page.$eval('.bp-cost-group', el => el.textContent || '')
    assert.match(text, /pays you for the time/i)
    assert.match(text, /profit.*business itself/i)
    assert.match(text, /what would make this work worth your time/i)
    assert.doesNotMatch(text, /\$\d+(\.\d+)?\s*(\/|per)\s*hour/i, 'must never suggest a specific universal hourly rate')
  } finally {
    await page.close()
  }
})

// ─── 2. Overhead estimator ──────────────────────────────────────────────────

test('Overhead: converts an annual amount to monthly and computes an allocation per batch, labeled as an estimate not a benchmark', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    await openCostGroup(page, 2) // Labor, Supplies, Overhead
    const radios = await page.$$('input[name="bp-overhead-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('#bp-overhead-cat-permits')

    await page.type('#bp-overhead-cat-permits', '120')
    await (await page.$('select[aria-label="Permits and licenses billing period"]'))!.select('year')
    await page.type('#bp-overhead-cat-insurance', '50')
    await page.type('#bp-overhead-monthly-batches', '20')

    await page.waitForFunction(() => document.querySelector('.bp-estimator-total')?.textContent?.includes('$60.00'))
    const text = await page.$eval('.bp-estimator', el => el.textContent || '')
    assert.match(text, /allocation estimate/i)
    assert.match(text, /not a market benchmark/i)

    await page.click('.bp-estimator .bp-btn-secondary')
    await page.waitForSelector('#bp-overhead')
    const value = await page.$eval('#bp-overhead', el => (el as HTMLInputElement).value)
    assert.equal(value, '3') // $60 / 20 batches
  } finally {
    await page.close()
  }
})

test('Overhead: the apply button is disabled when no cost categories have been entered', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    await openCostGroup(page, 2)
    const radios = await page.$$('input[name="bp-overhead-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('#bp-overhead-monthly-batches')
    await page.type('#bp-overhead-monthly-batches', '10')
    await page.waitForSelector('.bp-estimator .bp-btn-secondary')
    const disabled = await page.$eval('.bp-estimator .bp-btn-secondary', el => (el as HTMLButtonElement).disabled)
    assert.equal(disabled, true)
  } finally {
    await page.close()
  }
})

// ─── 3. Waste estimator ─────────────────────────────────────────────────────

test('Waste: converts a dollar amount into a percentage of this recipe\'s own ingredient cost, with no universal default offered', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    await openCostGroup(page, 3) // Labor, Supplies, Overhead, Waste
    const radios = await page.$$('input[name="bp-waste-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('#bp-waste-dollar')

    // Ingredient subtotal for the filler recipe: 3.49/5 * 2 = 1.396
    await page.type('#bp-waste-dollar', '0.698')
    await page.waitForSelector('.bp-estimator .bp-btn-secondary')
    const buttonText = await page.$eval('.bp-estimator .bp-btn-secondary', el => el.textContent || '')
    assert.match(buttonText, /~50\.0%/)

    await page.click('.bp-estimator .bp-btn-secondary')
    await page.waitForSelector('#bp-waste')
    const value = await page.$eval('#bp-waste', el => (el as HTMLInputElement).value)
    assert.equal(value, '50')
  } finally {
    await page.close()
  }
})

test('Waste: a repeating/non-terminating dollar-to-percent conversion applies as a clean, human-readable value — never a floating-point or arbitrary-precision artifact', async () => {
  const page = await openFreshTool()
  try {
    // $3.49 for 5 lb, 1 lb used -> ingredient cost is exactly 0.698 (a value
    // that displays rounded as "$0.70" but is not itself a round number).
    // 0.07 / 0.698 is a non-terminating decimal at decimal.js's working
    // precision — before the fix, the *applied* value (not the on-screen
    // preview, which already used toFixed(1)) carried that raw, ~20-digit
    // result straight into the direct-entry field and the Step 3 breakdown.
    await setInputValue(page, '#bp-yield', '12')
    await page.click('.bp-btn-ghost')
    await page.waitForSelector('#bp-ing-name')
    await page.type('#bp-ing-name', 'Flour')
    await page.keyboard.press('Escape')
    await page.type('#bp-ing-price', '3.49')
    await page.type('#bp-ing-pkg-qty', '5')
    await (await page.$('select[aria-label="Package amount unit"]'))!.select('lb')
    await page.type('#bp-ing-use-qty', '1')
    await (await page.$('select[aria-label="Amount used unit"]'))!.select('lb')
    await page.click('.bp-add-ingredient-form .bp-btn-primary')
    await page.waitForSelector('.bp-ingredient-row')
    const ingredientCost = await page.$eval('.bp-ingredient-cost', el => el.textContent || '')
    assert.equal(ingredientCost.trim(), '$0.70')

    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('#bp-labor-rate')
    await openCostGroup(page, 3)
    const radios = await page.$$('input[name="bp-waste-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('#bp-waste-dollar')
    await page.type('#bp-waste-dollar', '0.07')
    await page.waitForSelector('.bp-estimator .bp-btn-secondary')

    await page.click('.bp-estimator .bp-btn-secondary')
    await page.waitForSelector('#bp-waste')
    const wasteValue = await page.$eval('#bp-waste', el => (el as HTMLInputElement).value)
    assert.equal(wasteValue, '10', 'the applied percentage must be a clean, human-editable value, not a repeating-decimal artifact')
    assert.doesNotMatch(wasteValue, /9{5,}|0{5,}|\./, 'must never expose a long run of trailing digits or an unnecessary decimal point')

    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('.bp-completeness-check')
    const wasteRow = await page.$$eval('.bp-ledger-row', els =>
      els.map(e => e.textContent || '').find(t => t.includes('Waste Allowance')) || '',
    )
    assert.match(wasteRow, /Ingredient Waste Allowance \(10%\)/, 'Step 3 breakdown must show a clean percentage, not a raw decimal artifact')
    assert.doesNotMatch(wasteRow, /9{5,}|\d{5,}%/)
  } finally {
    await page.close()
  }
})

test('Waste: a clean, estimator-applied percentage round-trips through save/reopen without regaining precision noise', async () => {
  const page = await openFreshTool()
  try {
    await page.type('#bp-recipe-name', 'Waste Precision Round Trip')
    await setInputValue(page, '#bp-yield', '12')
    await page.click('.bp-btn-ghost')
    await page.waitForSelector('#bp-ing-name')
    await page.type('#bp-ing-name', 'Flour')
    await page.keyboard.press('Escape')
    await page.type('#bp-ing-price', '3.49')
    await page.type('#bp-ing-pkg-qty', '5')
    await (await page.$('select[aria-label="Package amount unit"]'))!.select('lb')
    await page.type('#bp-ing-use-qty', '1')
    await (await page.$('select[aria-label="Amount used unit"]'))!.select('lb')
    await page.click('.bp-add-ingredient-form .bp-btn-primary')
    await page.waitForSelector('.bp-ingredient-row')
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('#bp-labor-rate')

    await openCostGroup(page, 3)
    const radios = await page.$$('input[name="bp-waste-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('#bp-waste-dollar')
    await page.type('#bp-waste-dollar', '0.07')
    await page.waitForSelector('.bp-estimator .bp-btn-secondary')
    await page.click('.bp-estimator .bp-btn-secondary')
    await page.waitForSelector('#bp-waste')

    await reachBreakdown(page)
    await page.waitForSelector('.bp-save-row')
    await page.click('.bp-save-row .bp-btn-primary')
    await page.waitForFunction(
      () => document.querySelector('.bp-app-nav-btn.is-active')?.textContent?.includes('Saved Recipes'),
      { timeout: 5000 },
    )

    await page.click('.bp-saved-recipe-name')
    await page.waitForSelector('.bp-editing-banner')
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('#bp-waste')
    const reloadedWaste = await page.$eval('#bp-waste', el => (el as HTMLInputElement).value)
    assert.equal(reloadedWaste, '10')
  } finally {
    await page.close()
  }
})

test('Overhead: a repeating per-batch division also applies as a clean value, not a floating-point artifact (same fix as Waste)', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    await openCostGroup(page, 2)
    const radios = await page.$$('input[name="bp-overhead-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('#bp-overhead-cat-permits')
    // $10 monthly overhead split across 3 batches -> 3.3333... repeating.
    await page.type('#bp-overhead-cat-permits', '10')
    await page.type('#bp-overhead-monthly-batches', '3')
    await page.waitForSelector('.bp-estimator .bp-btn-secondary')

    await page.click('.bp-estimator .bp-btn-secondary')
    await page.waitForSelector('#bp-overhead')
    const overheadValue = await page.$eval('#bp-overhead', el => (el as HTMLInputElement).value)
    assert.equal(overheadValue, '3.33')
    assert.doesNotMatch(overheadValue, /3{5,}/, 'must never expose decimal.js\'s full working precision in a direct-entry field')
  } finally {
    await page.close()
  }
})

test('Waste: explains what waste includes and that tracking real batches gives the best personal estimate', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    await openCostGroup(page, 3)
    const text = await page.$$eval('.bp-cost-group', els => els[3]?.textContent || '')
    assert.match(text, /spills, trimming, broken or rejected products, leftovers, test batches, and failed\s*batches/i)
    assert.match(text, /tracking a few real batches/i)
  } finally {
    await page.close()
  }
})

// ─── 4. Results: Cost Completeness Check ────────────────────────────────────

test('Completeness check: reports each category\'s inclusion and explains the effect of any gaps, calmly', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    // Leave labor, overhead, waste, and supplies all untouched (all zero/blank).
    await reachBreakdown(page)
    const text = await page.$eval('.bp-completeness-check', el => el.textContent || '')
    assert.match(text, /Labor not included/)
    assert.match(text, /Overhead not included/)
    assert.match(text, /Waste not included/)
    assert.match(text, /Supplies & Packaging not included/)
    assert.match(text, /may be lower than your true cost/i)
    assert.doesNotMatch(text, /warning|danger|alert!/i, 'tone must stay helpful, not alarming')
  } finally {
    await page.close()
  }
})

test('Completeness check: a fully-entered set of costs shows every category included, with no gap note', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    await setInputValue(page, '#bp-labor-rate', '20')
    await setInputValue(page, '#bp-labor-minutes', '10')
    await openCostGroup(page, 2)
    await setInputValue(page, '#bp-overhead', '2')
    await openCostGroup(page, 3)
    await setInputValue(page, '#bp-waste', '5')
    await openCostGroup(page, 1)
    await page.click('.bp-supplies-section .bp-btn-ghost')
    await page.waitForSelector('#bp-supply-name')
    await page.type('#bp-supply-name', 'Box')
    const radios = await page.$$('input[name="bp-supply-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('#bp-supply-direct')
    await page.type('#bp-supply-direct', '1.00')
    await page.click('.bp-supplies-section .bp-btn-primary')
    await page.waitForSelector('.bp-supplies-section .bp-ingredient-row')

    await reachBreakdown(page)
    const text = await page.$eval('.bp-completeness-check', el => el.textContent || '')
    assert.match(text, /Labor included/)
    assert.match(text, /Overhead included/)
    assert.match(text, /Waste included/)
    assert.match(text, /Supplies & Packaging included/)
    assert.doesNotMatch(text, /may be lower than your true cost/i)
  } finally {
    await page.close()
  }
})

// ─── 5. Results: Test a Selling Price ───────────────────────────────────────

test('Selling price test: is collapsed by default and clearly separate from the suggested price', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    await reachBreakdown(page)
    const open = await page.$eval('.bp-selling-price-test', el => (el as HTMLDetailsElement).open)
    assert.equal(open, false)
    const heading = await page.$eval('.bp-selling-price-test summary', el => el.textContent || '')
    assert.match(heading, /Test a selling price/)
  } finally {
    await page.close()
  }
})

test('Selling price test: reports per-item price, remainder, and margin, and warns clearly when below break-even', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    await reachBreakdown(page)
    await page.click('.bp-selling-price-test summary')
    await page.waitForSelector('#bp-selling-price-test')

    await page.type('#bp-selling-price-test', '0.50')
    await page.waitForSelector('.bp-below-break-even')
    const warning = await page.$eval('.bp-below-break-even', el => el.textContent || '')
    assert.match(warning, /below your break-even cost/i)
    assert.match(warning, /lose money/i)

    await setInputValue(page, '#bp-selling-price-test', '')
    await page.type('#bp-selling-price-test', '50.00')
    await page.waitForFunction(() => !document.querySelector('.bp-below-break-even'))
    const result = await page.$eval('.bp-selling-price-result', el => el.textContent || '')
    assert.match(result, /Per item:/)
    assert.match(result, /Left after your entered production costs:/)
    assert.match(result, /Actual margin:/)
  } finally {
    await page.close()
  }
})

// ─── 6. Disclaimer (updated for the new estimators) ─────────────────────────

test('Disclaimer: short notice stays concise and non-alarming; full disclaimer covers the new estimator-driven claims', async () => {
  const page = await openFreshTool()
  try {
    const summary = await page.$eval('.bp-disclaimer-summary', el => el.textContent || '')
    assert.match(summary, /not financial, accounting, tax, legal, or business advice/i)
    assert.ok(summary.length < 220, 'the short notice must stay concise, not become a legal wall')

    await page.click('.tool-disclaimer summary')
    await page.waitForFunction(() => (document.querySelector('.tool-disclaimer details') as HTMLDetailsElement)?.open)
    const full = await page.$eval('.tool-disclaimer details', el => el.textContent || '')
    assert.match(full, /based entirely on the information and assumptions/i)
    assert.match(full, /hourly-rate considerations, overhead allocations, waste estimates, margins, and the\s*cost-completeness indicators/i)
    assert.match(full, /educational planning tools/i)
    assert.match(full, /not market-rate recommendations/i)
    assert.match(full, /verifying your own expenses, applicable taxes, permits and licenses, wage and labor\s*requirements, food-business regulations, local market conditions/i)
    assert.match(full, /Websites by Leslie does not guarantee the accuracy, completeness, profitability, or\s*suitability/i)
    assert.match(full, /to the extent permitted by\s*applicable law/i)
    assert.match(full, /consult an accountant, attorney, tax professional, or your local regulatory authority/i)
  } finally {
    await page.close()
  }
})

// ─── 7. Saved-data compatibility ────────────────────────────────────────────

test('A recipe saved using estimator-applied values round-trips through IndexedDB exactly like a directly-typed value', async () => {
  const page = await openFreshTool()
  try {
    await page.type('#bp-recipe-name', 'Estimator Round Trip')
    await addFillerIngredientAndReachCosts(page)

    const laborRadios = await page.$$('input[name="bp-labor-minutes-mode"]')
    await laborRadios[1]!.click()
    await page.waitForSelector('.bp-estimator-rows input')
    const rows = await page.$$('.bp-estimator-rows input')
    await rows[0]!.type('30')
    await page.click('.bp-estimator .bp-btn-secondary')
    await page.waitForSelector('#bp-labor-minutes')
    await setInputValue(page, '#bp-labor-rate', '20')

    await openCostGroup(page, 2)
    const overheadRadios = await page.$$('input[name="bp-overhead-mode"]')
    await overheadRadios[1]!.click()
    await page.waitForSelector('#bp-overhead-cat-permits')
    await page.type('#bp-overhead-cat-permits', '60')
    await page.type('#bp-overhead-monthly-batches', '10')
    await page.waitForSelector('.bp-estimator .bp-btn-secondary')
    await page.click('.bp-estimator .bp-btn-secondary')
    await page.waitForSelector('#bp-overhead')

    await reachBreakdown(page)
    await page.waitForSelector('.bp-save-row')
    await page.click('.bp-save-row .bp-btn-primary')
    await page.waitForFunction(
      () => document.querySelector('.bp-app-nav-btn.is-active')?.textContent?.includes('Saved Recipes'),
      { timeout: 5000 },
    )

    await page.click('.bp-saved-recipe-name')
    await page.waitForSelector('.bp-editing-banner')
    await page.click('.bp-nav .bp-btn-primary') // Step 1 -> Step 2 (Additional Costs)
    await page.waitForSelector('#bp-labor-minutes')
    const minutesValue = await page.$eval('#bp-labor-minutes', el => (el as HTMLInputElement).value)
    const rateValue = await page.$eval('#bp-labor-rate', el => (el as HTMLInputElement).value)
    assert.equal(minutesValue, '30')
    assert.equal(rateValue, '20')
    await openCostGroup(page, 2)
    const overheadValue = await page.$eval('#bp-overhead', el => (el as HTMLInputElement).value)
    assert.equal(overheadValue, '6') // 60 / 10 batches
  } finally {
    await page.close()
  }
})

test('The last-used hourly rate is remembered locally and pre-fills a brand-new recipe, without affecting saved-recipe data', async () => {
  const page = await openFreshTool()
  try {
    await page.type('#bp-recipe-name', 'Rate Memory Test')
    await addFillerIngredientAndReachCosts(page)
    await setInputValue(page, '#bp-labor-rate', '22.50')
    await setInputValue(page, '#bp-labor-minutes', '10')
    await reachBreakdown(page)
    await page.click('.bp-save-row .bp-btn-primary')
    await page.waitForFunction(
      () => document.querySelector('.bp-app-nav-btn.is-active')?.textContent?.includes('Saved Recipes'),
      { timeout: 5000 },
    )

    await page.click('.bp-saved-recipes-new')
    await page.waitForSelector('#bp-recipe-name')
    await addFillerIngredientAndReachCosts(page)
    const prefilled = await page.$eval('#bp-labor-rate', el => (el as HTMLInputElement).value)
    // Preserved exactly as typed/saved — DecimalString values are never
    // reformatted or simplified on their way back out.
    assert.equal(prefilled, '22.50')
  } finally {
    await page.close()
  }
})

// ─── 8. Accessibility & mobile ──────────────────────────────────────────────

test('No horizontal overflow at 320px or 390px on the Additional Costs step with every estimator open', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    const laborRadios = await page.$$('input[name="bp-labor-minutes-mode"]')
    await laborRadios[1]!.click()
    await page.waitForSelector('.bp-estimator')
    await openCostGroup(page, 2)
    const overheadRadios = await page.$$('input[name="bp-overhead-mode"]')
    await overheadRadios[1]!.click()
    await openCostGroup(page, 3)
    const wasteRadios = await page.$$('input[name="bp-waste-mode"]')
    await wasteRadios[1]!.click()

    for (const width of [320, 390]) {
      await page.setViewport({ width, height: 900 })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      assert.equal(overflow, false, `unexpected horizontal overflow at ${width}px`)
    }
  } finally {
    await page.close()
  }
})

test('Estimator inputs and the mode toggle meet 44px touch targets at mobile width', async () => {
  const page = await openFreshTool()
  try {
    await page.setViewport({ width: 375, height: 900 })
    await addFillerIngredientAndReachCosts(page)
    const radios = await page.$$('input[name="bp-labor-minutes-mode"]')
    await radios[1]!.click()
    await page.waitForSelector('.bp-estimator')

    const optionHeights = await page.$$eval('.bp-mode-option', els => els.map(e => e.getBoundingClientRect().height))
    for (const h of optionHeights) assert.ok(h >= 44, `mode option height ${h} below 44px`)

    const rowInputHeights = await page.$$eval('.bp-estimator-rows input', els => els.map(e => e.getBoundingClientRect().height))
    for (const h of rowInputHeights) assert.ok(h >= 44, `estimator row input height ${h} below 44px`)
  } finally {
    await page.close()
  }
})

test('The completeness check and below-break-even warning use accessible live/alert semantics', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    await reachBreakdown(page)
    const role = await page.$eval('.bp-completeness-check', el => el.getAttribute('role'))
    assert.equal(role, 'status')

    await page.click('.bp-selling-price-test summary')
    await page.waitForSelector('#bp-selling-price-test')
    await page.type('#bp-selling-price-test', '0.50')
    await page.waitForSelector('.bp-below-break-even')
    const warningRole = await page.$eval('.bp-below-break-even', el => el.getAttribute('role'))
    assert.equal(warningRole, 'alert')
  } finally {
    await page.close()
  }
})

test('Every estimator field has an associated plain-language label', async () => {
  const page = await openFreshTool()
  try {
    await addFillerIngredientAndReachCosts(page)
    const laborRadios = await page.$$('input[name="bp-labor-minutes-mode"]')
    await laborRadios[1]!.click()
    await page.waitForSelector('.bp-estimator-rows input')
    const unlabeled = await page.$$eval('.bp-estimator-rows input', inputs =>
      inputs.filter(i => !i.id || !document.querySelector(`label[for="${i.id}"]`)).length,
    )
    assert.equal(unlabeled, 0)
  } finally {
    await page.close()
  }
})
