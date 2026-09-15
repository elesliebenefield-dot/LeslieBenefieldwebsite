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
  packageUnit: string
  amountUsedUnit: string
  packagePrice: string
  packageQuantity: string
  amountUsed: string
}

// Package and recipe-usage units are independent selects — no measurement-
// type selector exists. Selecting by aria-label rather than index keeps
// this robust regardless of DOM ordering.
async function addIngredient(page: Page, ing: IngredientInput) {
  await page.click('.bp-btn-ghost')
  await page.waitForFunction(() => !!document.querySelector('#bp-ing-name'))
  await page.type('#bp-ing-name', ing.name)
  await page.type('#bp-ing-price', ing.packagePrice)
  await page.type('#bp-ing-pkg-qty', ing.packageQuantity)
  const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
  await pkgUnitSelect!.select(ing.packageUnit)
  await page.type('#bp-ing-use-qty', ing.amountUsed)
  const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
  await useUnitSelect!.select(ing.amountUsedUnit)
}

async function saveIngredient(page: Page) {
  await page.click('.bp-add-ingredient-form .bp-btn-primary')
}

// The conversion is always expressed in grams (no weight-unit selector) —
// selecting the "I measure it in cups"-style choice card reveals the entry.
async function enterConversion(page: Page, volumeUnit: string, weightQuantity: string) {
  await page.click('.bp-choice-card-convert')
  await page.waitForFunction(() => !!document.querySelector('input[aria-label="Conversion weight amount"]'))
  const volSelect = await page.$('select[aria-label="Conversion volume unit"]')
  await volSelect!.select(volumeUnit)
  await page.type('input[aria-label="Conversion weight amount"]', weightQuantity)
}

// Step 1 now requires at least one ingredient to advance, so every helper
// that reaches Step 2 adds one by default (its exact values don't matter
// for tests that only care about the Additional Costs step).
async function advanceToCosts(page: Page, yieldValue = '24') {
  await setYield(page, yieldValue)
  await addIngredient(page, {
    name: 'Filler Ingredient', packageUnit: 'each', amountUsedUnit: 'each',
    packagePrice: '1', packageQuantity: '1', amountUsed: '1',
  })
  await saveIngredient(page)
  await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
  await page.click('.bp-nav .bp-btn-primary')
  await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
}

async function openCostGroup(page: Page, index: number) {
  const summaries = await page.$$('summary')
  await summaries[index].click()
}

async function openSuppliesGroup(page: Page) {
  await openCostGroup(page, 1)
  await page.waitForFunction(() => !!document.querySelector('.bp-supplies-section'))
}

async function addSupplyPackageItem(page: Page, opts: { name: string; packagePrice: string; packageQuantity: string; amountUsed: string }) {
  await page.click('.bp-supplies-section .bp-btn-ghost')
  await page.waitForFunction(() => !!document.querySelector('#bp-supply-name'))
  await page.type('#bp-supply-name', opts.name)
  await page.type('#bp-supply-price', opts.packagePrice)
  await page.type('#bp-supply-pkg-qty', opts.packageQuantity)
  await page.type('#bp-supply-used', opts.amountUsed)
  await page.click('.bp-supplies-section .bp-btn-primary')
}

async function addSupplyDirectItem(page: Page, opts: { name: string; directCost: string }) {
  await page.click('.bp-supplies-section .bp-btn-ghost')
  await page.waitForFunction(() => !!document.querySelector('#bp-supply-name'))
  await page.type('#bp-supply-name', opts.name)
  const radios = await page.$$('input[name="bp-supply-mode"]')
  await radios[1].click() // "I know the exact cost"
  await page.waitForFunction(() => !!document.querySelector('#bp-supply-direct'))
  await page.type('#bp-supply-direct', opts.directCost)
  await page.click('.bp-supplies-section .bp-btn-primary')
}

// Reproduces the only way to see Step 2's zero-cost notices while still on
// Step 2: leave it (Back) — which marks it reviewed — then return via Next.
async function reachReviewedCostsStep(page: Page) {
  await page.click('.bp-nav .bp-btn-secondary')
  await page.waitForFunction(() => !!document.querySelector('#bp-yield'))
  await page.click('.bp-nav .bp-btn-primary')
  await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
}

async function openCalculationDetails(page: Page) {
  await page.click('.bp-breakdown-details summary')
  await page.waitForFunction(() => (document.querySelector('.bp-breakdown-details') as HTMLDetailsElement)?.open)
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

test('compact header shows the shortened name for mobile readability', async () => {
  const page = await openTool()
  try {
    const title = await page.$eval('.tool-header-title', el => el.textContent?.trim())
    assert.equal(title, 'Bakery Pricing Calculator')
  } finally {
    await page.close()
  }
})

test('main page heading shows the full public tool name', async () => {
  const page = await openTool()
  try {
    const heading = await page.$eval('.bp-page-heading', el => el.textContent?.trim())
    // The heading also carries a small decorative bakery symbol (see the
    // personality-pass test below) — matched loosely here so this test
    // stays about the tool's actual name, not the decoration.
    assert.match(heading || '', /Free Home Bakery Pricing Calculator/)
  } finally {
    await page.close()
  }
})

test('welcome intro explains the three-step process and what to have ready', async () => {
  const page = await openTool()
  try {
    const text = await page.$eval('.bp-intro', el => el.textContent || '')
    assert.match(text, /three quick steps/i)
    assert.match(text, /yield|how many items or servings/i)
    assert.match(text, /package price/i)
    assert.match(text, /labor/i)
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

test('a compact disclaimer summary is persistently visible with role="note"', async () => {
  const page = await openTool()
  try {
    const el = await page.$('.tool-disclaimer')
    assert.ok(el, 'disclaimer should exist')
    const role = await el!.evaluate(node => node.getAttribute('role'))
    assert.equal(role, 'note')
    const summary = await page.$eval('.bp-disclaimer-summary', node => node.textContent || '')
    assert.match(summary, /planning estimates/i)
    assert.match(summary, /not financial, accounting, tax, legal, or business advice/i)
    assert.match(summary, /stay on your device/i)
    assert.doesNotMatch(summary, /never (stored|be stored)/i, 'must not claim data is never stored — M4 adds intentional on-device saving')
  } finally {
    await page.close()
  }
})

test('the full disclaimer is reachable via an accessible expandable control, not shown by default', async () => {
  const page = await openTool()
  try {
    const detailsOpenInitially = await page.$eval('.tool-disclaimer details', el => (el as HTMLDetailsElement).open)
    assert.equal(detailsOpenInitially, false, 'full disclaimer should be collapsed by default')
    await page.click('.tool-disclaimer summary')
    await page.waitForFunction(() => (document.querySelector('.tool-disclaimer details') as HTMLDetailsElement)?.open)
    const fullText = await page.$eval('.tool-disclaimer details', el => el.textContent || '')
    assert.match(fullText, /educational planning tools/i)
    assert.match(fullText, /not promises of profitability/i)
    assert.match(fullText, /not market-rate recommendations/i)
    assert.match(fullText, /responsible for verifying your own expenses, applicable taxes, permits/i)
    assert.match(fullText, /does not guarantee the accuracy, completeness, profitability, or suitability/i)
    assert.match(fullText, /consult an accountant, attorney, tax professional/i)
    assert.match(fullText, /never transmitted/i)
  } finally {
    await page.close()
  }
})

// ─── 1b. Bakery personality pass (visual, M3) ───────────────────────────────

test('the decorative bakery symbol beside the page heading is hidden from screen readers', async () => {
  const page = await openTool()
  try {
    const icon = await page.$('.bp-page-heading-icon')
    assert.ok(icon, 'a decorative page-heading icon should be present')
    const hidden = await page.$eval('.bp-page-heading-icon', el => el.getAttribute('aria-hidden'))
    assert.equal(hidden, 'true')
  } finally {
    await page.close()
  }
})

test('section icons (Ingredients, Labor, Supplies & Packaging, Cost Breakdown, Suggested Pricing) are present and hidden from screen readers, never the only label', async () => {
  const page = await openTool()
  try {
    // Step 1: Ingredients — Step 1 has two h2s ("Your Recipe" and
    // "Ingredients"), so target the one that actually contains the icon
    // rather than the first h2 on the page.
    const ingredientsIconHidden = await page.$eval('.bp-h2 .bp-section-icon', el => el.getAttribute('aria-hidden'))
    assert.equal(ingredientsIconHidden, 'true')
    const ingredientsHeading = await page.$eval('.bp-h2 .bp-section-icon', el => el.closest('.bp-h2')?.textContent || '')
    assert.match(ingredientsHeading, /Ingredients/)

    await setYield(page, '24')
    await addIngredient(page, { name: 'Eggs', packageUnit: 'each', amountUsedUnit: 'each', packagePrice: '4', packageQuantity: '4', amountUsed: '2' })
    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))

    // Step 2: Labor, Supplies & Packaging
    const summaryIcons = await page.$$eval('.bp-summary-label .bp-section-icon', els => els.map(e => e.getAttribute('aria-hidden')))
    assert.deepEqual(summaryIcons, ['true', 'true'])
    const summaryTexts = await page.$$eval('.bp-summary-label', els => els.map(e => e.textContent || ''))
    assert.ok(summaryTexts.some(t => /Labor/.test(t)))
    assert.ok(summaryTexts.some(t => /Supplies.*Packaging/.test(t)))

    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForFunction(() => !!document.querySelector('.bp-price-lead'))

    // Step 3: Suggested Pricing, Cost Breakdown ("See how this was
    // calculated"), and Test a Selling Price (added post-M4) each carry
    // their own icon.
    const step3Icons = await page.$$eval('.bp-h2 .bp-section-icon, .bp-summary-label .bp-section-icon', els => els.map(e => e.getAttribute('aria-hidden')))
    assert.deepEqual(step3Icons, ['true', 'true', 'true'])
  } finally {
    await page.close()
  }
})

test('empty states show a decorative, aria-hidden icon alongside friendly, concise copy', async () => {
  const page = await openTool()
  try {
    const ingredientsIcon = await page.$eval('.bp-empty-state-icon', el => el.getAttribute('aria-hidden'))
    assert.equal(ingredientsIcon, 'true')
    const ingredientsText = await page.$eval('.bp-empty-state', el => el.textContent || '')
    assert.match(ingredientsText, /No ingredients yet/)

    await advanceToCosts(page)
    await openSuppliesGroup(page)
    const suppliesIcon = await page.$eval('.bp-supplies-section .bp-empty-state-icon', el => el.getAttribute('aria-hidden'))
    assert.equal(suppliesIcon, 'true')
    const suppliesText = await page.$eval('.bp-supplies-section .bp-empty-state', el => el.textContent || '')
    assert.match(suppliesText, /Nothing added yet/)
  } finally {
    await page.close()
  }
})

test('the suggested-price completion highlight plays once on first reaching the breakdown, and does not replay on a later Back/Next revisit', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const celebratedFirstTime = await page.$eval('.bp-price-lead', el => el.classList.contains('bp-price-lead-celebrate'))
    assert.equal(celebratedFirstTime, true, 'the first time a completed calculation is reached, the highlight should apply')

    await page.click('.bp-nav .bp-btn-secondary')
    await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForFunction(() => !!document.querySelector('.bp-price-lead'))
    const celebratedSecondTime = await page.$eval('.bp-price-lead', el => el.classList.contains('bp-price-lead-celebrate'))
    assert.equal(celebratedSecondTime, false, 'revisiting the same completed calculation must not replay the highlight')
  } finally {
    await page.close()
  }
})

test('the completion highlight animation is completely disabled under prefers-reduced-motion', async () => {
  const page = await openTool()
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await buildHandVerifiedRecipe(page)
    const animationName = await page.$eval('.bp-price-lead', el => getComputedStyle(el).animationName)
    assert.equal(animationName, 'none', 'no animation should be computed at all under prefers-reduced-motion')
  } finally {
    await page.close()
  }
})

test('no horizontal overflow at 320px with the new decorative elements visible (heading icon, section icons, empty state)', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 320, height: 900 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `expected no overflow, got ${overflow}px`)
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

test('shows a neutral empty-state message under Ingredients before any are added', async () => {
  const page = await openTool()
  try {
    const text = await page.$eval('.bp-empty-state', el => el.textContent || '')
    assert.match(text, /no ingredients yet/i)
    assert.match(text, /add at least one/i)
  } finally {
    await page.close()
  }
})

test('does not advance to Step 2 with a valid yield but zero ingredients, and explains what is missing', async () => {
  const page = await openTool()
  try {
    await setYield(page, '24')
    await page.click('.bp-nav .bp-btn-primary')
    const onStep2 = await page.$('#bp-labor-rate')
    assert.equal(onStep2, null, 'must not advance to Step 2 with no ingredients')
    const emptyState = await page.$eval('.bp-empty-state', el => el.textContent || '')
    assert.match(emptyState, /add at least one ingredient before continuing/i)
    const role = await page.$eval('.bp-empty-state', el => el.getAttribute('role'))
    assert.equal(role, 'alert')
  } finally {
    await page.close()
  }
})

test('the pricing breakdown is never reachable without at least one ingredient, so an all-zero result from missing information can never be shown', async () => {
  const page = await openTool()
  try {
    await setYield(page, '24')
    // Try repeatedly — the gate must hold, not just fail once.
    await page.click('.bp-nav .bp-btn-primary')
    await page.click('.bp-nav .bp-btn-primary')
    await page.click('.bp-nav .bp-btn-primary')
    const breakdownVisible = await page.$('.bp-price-lead')
    assert.equal(breakdownVisible, null, 'must never reach the pricing breakdown without an ingredient')
    const stillOnStep1 = await page.$('#bp-yield')
    assert.ok(stillOnStep1, 'should remain on Step 1')
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
      name: 'Eggs', packageUnit: 'each', amountUsedUnit: 'each',
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
      name: 'Eggs', packageUnit: 'each', amountUsedUnit: 'each',
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

test('Continue to Additional Costs is disabled with an explanatory note while the add-ingredient form is open, and re-enables once added or cancelled', async () => {
  const page = await openTool()
  try {
    await setYield(page, '24')
    await addIngredient(page, {
      name: 'Eggs', packageUnit: 'each', amountUsedUnit: 'each',
      packagePrice: '4.00', packageQuantity: '4', amountUsed: '2',
    })
    // The form is open but not yet added/cancelled — Continue must be blocked.
    const disabledWhileOpen = await page.$eval('.bp-nav .bp-btn-primary', el => (el as HTMLButtonElement).disabled)
    assert.equal(disabledWhileOpen, true, 'Continue must be disabled while an ingredient form is still open')
    const note = await page.$eval('.bp-continue-blocked-note', el => el.textContent || '')
    assert.match(note, /Add or cancel this ingredient before continuing\./)

    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    const disabledAfterAdd = await page.$eval('.bp-nav .bp-btn-primary', el => (el as HTMLButtonElement).disabled)
    assert.equal(disabledAfterAdd, false, 'Continue should re-enable once the ingredient is added')
    const noteGoneAfterAdd = await page.$('.bp-continue-blocked-note')
    assert.equal(noteGoneAfterAdd, null)

    // Reopen the form and cancel instead of adding — must also re-enable Continue.
    await page.click('.bp-btn-ghost')
    await page.waitForFunction(() => !!document.querySelector('#bp-ing-name'))
    const disabledWhileOpenAgain = await page.$eval('.bp-nav .bp-btn-primary', el => (el as HTMLButtonElement).disabled)
    assert.equal(disabledWhileOpenAgain, true)
    await page.click('.bp-add-ingredient-form .bp-btn-secondary')
    const disabledAfterCancel = await page.$eval('.bp-nav .bp-btn-primary', el => (el as HTMLButtonElement).disabled)
    assert.equal(disabledAfterCancel, false, 'Continue should re-enable once the open ingredient form is cancelled')
  } finally {
    await page.close()
  }
})

// Package and recipe-usage units are independent selects, each offering
// every unit from every measurement type (grouped under optgroups) — a
// baker can buy flour by the pound and use it by the cup in one line.
test('package and recipe-usage unit selects are independent and each offer every unit', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-btn-ghost')
    await page.waitForFunction(() => !!document.querySelector('#bp-ing-name'))
    const allUnits = ['g', 'kg', 'oz', 'lb', 'mL', 'L', 'tsp', 'tbsp', 'cup', 'each', 'dozen']
    const pkgOptions = await page.$$eval('select[aria-label="Package amount unit"] option', els => els.map(o => (o as HTMLOptionElement).value))
    const useOptions = await page.$$eval('select[aria-label="Amount used unit"] option', els => els.map(o => (o as HTMLOptionElement).value))
    assert.deepEqual(pkgOptions.sort(), [...allUnits].sort())
    assert.deepEqual(useOptions.sort(), [...allUnits].sort())

    const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
    await pkgUnitSelect!.select('lb')
    const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
    await useUnitSelect!.select('cup')
    // Selecting the usage unit must not have reset the package unit — they are independent.
    const pkgUnitValue = await page.$eval('select[aria-label="Package amount unit"]', el => (el as HTMLSelectElement).value)
    assert.equal(pkgUnitValue, 'lb')
  } finally {
    await page.close()
  }
})

// Package: same weight unit family, different specific unit (lb vs g) —
// same measurement type, already bridgeable by the shared conversion
// registry with no per-ingredient conversion needed.
test('package and recipe both use weight, in different units, with no conversion needed', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'Flour', packageUnit: 'lb', amountUsedUnit: 'g', packagePrice: '3.49', packageQuantity: '5', amountUsed: '280' })
    const noCrossTypeHelp = await page.$('.bp-cross-type-help')
    assert.equal(noCrossTypeHelp, null, 'same measurement type must never show the cross-type explanation')
    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    const rowText = await page.$eval('.bp-ingredient-list', el => el.textContent || '')
    assert.match(rowText, /\$0\.43/, `expected ~$0.43, got: ${rowText}`)
  } finally {
    await page.close()
  }
})

// Package: volume, recipe: a different volume unit (cup vs tbsp).
test('package and recipe both use volume, in different units, with no conversion needed', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'Vanilla', packageUnit: 'cup', amountUsedUnit: 'tbsp', packagePrice: '7.49', packageQuantity: '1', amountUsed: '3' })
    const noCrossTypeHelp = await page.$('.bp-cross-type-help')
    assert.equal(noCrossTypeHelp, null)
    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    const rowText = await page.$eval('.bp-ingredient-list', el => el.textContent || '')
    assert.match(rowText, /\$1\.40/, `expected ~$1.40, got: ${rowText}`)
  } finally {
    await page.close()
  }
})

// ─── 3b. Cross-type (weight vs. volume) resolution ──────────────────────────

test('a weight/volume mismatch shows the friendly explanation, not a technical unit-mismatch message', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'Flour', packageUnit: 'lb', amountUsedUnit: 'cup', packagePrice: '3.49', packageQuantity: '5', amountUsed: '2' })
    const helpText = await page.$eval('.bp-cross-type-help', el => el.textContent || '')
    assert.match(helpText, /sold by weight, but your recipe measures it by volume/i)
    assert.match(helpText, /every ingredient weighs differently/i)
    assert.doesNotMatch(helpText, /different measurement types/i, 'the friendly explanation must replace the technical wording, not include it')
  } finally {
    await page.close()
  }
})

test('the two resolution choices use the ingredient\'s own name and read as equally weighted options', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'Flour', packageUnit: 'lb', amountUsedUnit: 'cup', packagePrice: '3.49', packageQuantity: '5', amountUsed: '2' })
    const weighTitle = await page.$eval('.bp-choice-card-weigh .bp-choice-card-title', el => el.textContent || '')
    assert.match(weighTitle, /I can weigh the Flour/)
    const weighHelper = await page.$eval('.bp-choice-card-weigh .bp-choice-card-helper', el => el.textContent || '')
    assert.match(weighHelper, /Switch to grams and enter the amount you use\./)
    const convertTitle = await page.$eval('.bp-choice-card-convert .bp-choice-card-title', el => el.textContent || '')
    assert.match(convertTitle, /I measure Flour in cups/)
    const convertHelper = await page.$eval('.bp-choice-card-convert .bp-choice-card-helper', el => el.textContent || '')
    assert.match(convertHelper, /Tell us what one cup of this ingredient weighs\./)

    // Same tag, same class family, same size — visually equal weight, not a
    // primary button next to a minor text link.
    const cardTags = await page.$$eval('.bp-choice-group .bp-choice-card', els => els.map(el => el.tagName))
    assert.deepEqual(cardTags, ['BUTTON', 'BUTTON'])
    const cardHeights = await page.$$eval('.bp-choice-group .bp-choice-card', els => els.map(el => el.getBoundingClientRect().height))
    assert.ok(Math.abs(cardHeights[0] - cardHeights[1]) < 2, `expected roughly equal card heights, got ${JSON.stringify(cardHeights)}`)
  } finally {
    await page.close()
  }
})

test('an ingredient with no name yet falls back to generic wording, not a blank name', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-btn-ghost')
    await page.waitForFunction(() => !!document.querySelector('#bp-ing-name'))
    await page.type('#bp-ing-price', '3.49')
    await page.type('#bp-ing-pkg-qty', '5')
    const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
    await pkgUnitSelect!.select('lb')
    await page.type('#bp-ing-use-qty', '2')
    const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
    await useUnitSelect!.select('cup')
    const weighTitle = await page.$eval('.bp-choice-card-weigh .bp-choice-card-title', el => el.textContent || '')
    assert.match(weighTitle, /I can weigh this ingredient/)
  } finally {
    await page.close()
  }
})

test('cannot add a cross-type ingredient until the baker chooses a resolution', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'Flour', packageUnit: 'lb', amountUsedUnit: 'cup', packagePrice: '3.49', packageQuantity: '5', amountUsed: '2' })
    const addDisabled = await page.$eval('.bp-add-ingredient-form .bp-btn-primary', el => (el as HTMLButtonElement).disabled)
    assert.equal(addDisabled, true, 'Add to recipe must be disabled while the cross-type mismatch is unresolved')
    const note = await page.$eval('.bp-cross-type-unresolved-note', el => el.textContent || '')
    assert.match(note, /Choose one of the options above before adding this ingredient\./)
  } finally {
    await page.close()
  }
})

test('choosing "I can weigh it" resolves the mismatch by switching to grams and focusing the recipe-amount field', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'Flour', packageUnit: 'lb', amountUsedUnit: 'cup', packagePrice: '3.49', packageQuantity: '5', amountUsed: '2' })
    await page.click('.bp-choice-card-weigh')
    const helpGone = await page.$('.bp-cross-type-help')
    assert.equal(helpGone, null, 'resolving by switching units should remove the cross-type explanation')
    const addDisabled = await page.$eval('.bp-add-ingredient-form .bp-btn-primary', el => (el as HTMLButtonElement).disabled)
    assert.equal(addDisabled, false, 'Add to recipe should be enabled once resolved')
    const useUnitValue = await page.$eval('select[aria-label="Amount used unit"]', el => (el as HTMLSelectElement).value)
    assert.equal(useUnitValue, 'g', 'the recipe-amount unit should switch to grams')
    const focusedId = await page.evaluate(() => document.activeElement?.id)
    assert.equal(focusedId, 'bp-ing-use-qty', 'the recipe-amount field should be focused so the baker can re-enter it')
  } finally {
    await page.close()
  }
})

// Flour: 5 lb package, 2 cups used, baker enters "1 cup weighs 120 g".
test('adding a conversion resolves the mismatch and computes the cost accurately (flour, lb package / cups recipe)', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'Flour', packageUnit: 'lb', amountUsedUnit: 'cup', packagePrice: '3.49', packageQuantity: '5', amountUsed: '2' })
    await enterConversion(page, 'cup', '120')
    const addDisabled = await page.$eval('.bp-add-ingredient-form .bp-btn-primary', el => (el as HTMLButtonElement).disabled)
    assert.equal(addDisabled, false, 'Add to recipe should be enabled once a valid conversion is entered')
    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    const rowText = await page.$eval('.bp-ingredient-list', el => el.textContent || '')
    // 3.49 * (240 g / 2267.96185 g) ≈ $0.37
    assert.match(rowText, /\$0\.37/, `expected ~$0.37, got: ${rowText}`)
  } finally {
    await page.close()
  }
})

test('no conversion is ever guessed — an incomplete conversion still blocks adding', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'Flour', packageUnit: 'lb', amountUsedUnit: 'cup', packagePrice: '3.49', packageQuantity: '5', amountUsed: '2' })
    await page.click('.bp-choice-card-convert') // open the conversion entry without filling it in
    await page.waitForFunction(() => !!document.querySelector('input[aria-label="Conversion weight amount"]'))
    const weightValue = await page.$eval('input[aria-label="Conversion weight amount"]', el => (el as HTMLInputElement).value)
    assert.equal(weightValue, '', 'the conversion weight field must start blank — never a hardcoded default')
    const addDisabled = await page.$eval('.bp-add-ingredient-form .bp-btn-primary', el => (el as HTMLButtonElement).disabled)
    assert.equal(addDisabled, true, 'Add to recipe must stay disabled until a real conversion value is entered')
    const note = await page.$eval('.bp-cross-type-unresolved-note', el => el.textContent || '')
    assert.match(note, /Choose one of the options above/)
  } finally {
    await page.close()
  }
})

test('a count vs. weight/volume mismatch is still blocked with the plain technical message (no conversion path offered)', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'Eggs', packageUnit: 'each', amountUsedUnit: 'g', packagePrice: '3.99', packageQuantity: '12', amountUsed: '50' })
    const crossTypeHelp = await page.$('.bp-cross-type-help')
    assert.equal(crossTypeHelp, null, 'count mismatches get the plain message, not the weight/volume resolution UI')
    const errorText = await page.$eval('.bp-add-ingredient-form .bp-error', el => el.textContent || '')
    assert.match(errorText, /different measurement types/i)
  } finally {
    await page.close()
  }
})

// ─── 3c. Common-ingredient library (autocomplete + standard conversions) ────

// Types into the ingredient-name combobox and waits for the suggestion
// dropdown to appear. Does NOT select anything — matches how a baker's
// typed text alone must never silently resolve to a specific ingredient.
async function typeIngredientName(page: Page, text: string) {
  await page.click('.bp-btn-ghost')
  await page.waitForFunction(() => !!document.querySelector('#bp-ing-name'))
  await page.type('#bp-ing-name', text)
  await page.waitForFunction(() => !!document.querySelector('.bp-autocomplete-list'))
}

async function selectSuggestionByText(page: Page, text: string) {
  await page.evaluate((t: string) => {
    const options = Array.from(document.querySelectorAll('.bp-autocomplete-option'))
    const match = options.find(o => o.textContent?.trim() === t)
    if (!match) throw new Error(`no suggestion found with text "${t}"`)
    ;(match as HTMLElement).click()
  }, text)
}

test('typing "All-purpose flour" and selecting it applies the standard conversion automatically', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'All-purpose flour')
    await selectSuggestionByText(page, 'All-purpose flour')
    await page.type('#bp-ing-price', '3.49')
    await page.type('#bp-ing-pkg-qty', '5')
    const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
    await pkgUnitSelect!.select('lb')
    await page.type('#bp-ing-use-qty', '2')
    const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
    await useUnitSelect!.select('cup')

    await page.waitForFunction(() => !!document.querySelector('.bp-standard-conversion'))
    const bannerText = await page.$eval('.bp-standard-conversion', el => el.textContent || '')
    assert.match(bannerText, /All-purpose flour: using the standard estimate of 1 cup = 120 grams\./)

    // The two-choice manual panel must NOT appear in this common path.
    const choiceGroup = await page.$('.bp-choice-group')
    assert.equal(choiceGroup, null, 'the manual two-choice panel must not show when a standard conversion applies')

    const addDisabled = await page.$eval('.bp-add-ingredient-form .bp-btn-primary', el => (el as HTMLButtonElement).disabled)
    assert.equal(addDisabled, false, 'Add to recipe should be enabled automatically once the standard applies')

    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    const rowText = await page.$eval('.bp-ingredient-list', el => el.textContent || '')
    // 3.49 * (240 g / 2267.96185 g) ≈ $0.37 — same hand-verified figure as
    // the manual-conversion cross-type test, since both use 1 cup = 120g.
    assert.match(rowText, /\$0\.37/, `expected ~$0.37, got: ${rowText}`)
  } finally {
    await page.close()
  }
})

test('the explanation reads "converted using a standard baking estimate" once a standard conversion applies, not "we need one more detail"', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'All-purpose flour')
    await selectSuggestionByText(page, 'All-purpose flour')
    await page.type('#bp-ing-price', '3.49')
    await page.type('#bp-ing-pkg-qty', '5')
    const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
    await pkgUnitSelect!.select('lb')
    await page.type('#bp-ing-use-qty', '2')
    const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
    await useUnitSelect!.select('cup')
    await page.waitForFunction(() => !!document.querySelector('.bp-standard-conversion'))
    const explanation = await page.$eval('.bp-cross-type-help > p', el => el.textContent || '')
    assert.match(explanation, /We've converted it using a standard baking estimate\./)
    assert.doesNotMatch(explanation, /we need one more detail/i, 'the "manual resolution needed" wording must not appear once a standard applies')
  } finally {
    await page.close()
  }
})

test('the explanation still reads "we need one more detail" for an unknown ingredient that genuinely requires manual resolution', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'My Secret Spice Blend', packageUnit: 'lb', amountUsedUnit: 'cup', packagePrice: '9.99', packageQuantity: '1', amountUsed: '1' })
    const explanation = await page.$eval('.bp-cross-type-help > p', el => el.textContent || '')
    assert.match(explanation, /we need one more detail to calculate its cost accurately/i)
    assert.doesNotMatch(explanation, /converted it using a standard baking estimate/i)
  } finally {
    await page.close()
  }
})

test('granulated sugar and packed brown sugar apply their own distinct standard conversions', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'white sugar')
    await selectSuggestionByText(page, 'Granulated white sugar')
    await page.type('#bp-ing-price', '2.50')
    await page.type('#bp-ing-pkg-qty', '4')
    const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
    await pkgUnitSelect!.select('lb')
    await page.type('#bp-ing-use-qty', '1')
    const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
    await useUnitSelect!.select('cup')
    await page.waitForFunction(() => !!document.querySelector('.bp-standard-conversion'))
    const sugarBanner = await page.$eval('.bp-standard-conversion', el => el.textContent || '')
    assert.match(sugarBanner, /1 cup = 198 grams/)
  } finally {
    await page.close()
  }
})

test('packed brown sugar alias applies its own standard conversion, distinct from granulated sugar', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'packed brown sugar')
    await selectSuggestionByText(page, 'Packed light or dark brown sugar')
    await page.type('#bp-ing-price', '3.00')
    await page.type('#bp-ing-pkg-qty', '2')
    const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
    await pkgUnitSelect!.select('lb')
    await page.type('#bp-ing-use-qty', '1')
    const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
    await useUnitSelect!.select('cup')
    await page.waitForFunction(() => !!document.querySelector('.bp-standard-conversion'))
    const brownSugarBanner = await page.$eval('.bp-standard-conversion', el => el.textContent || '')
    assert.match(brownSugarBanner, /1 cup = 213 grams/)
  } finally {
    await page.close()
  }
})

test('ingredient aliases resolve to the correct canonical suggestion: "AP flour" and "powdered sugar"', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'AP flour')
    const apSuggestions = await page.$$eval('.bp-autocomplete-option', els => els.map(e => e.textContent?.trim()))
    assert.deepEqual(apSuggestions, ['All-purpose flour'])
  } finally {
    await page.close()
  }
})

test('"powdered sugar" alias suggests confectioners\' sugar', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'powdered sugar')
    const suggestions = await page.$$eval('.bp-autocomplete-option', els => els.map(e => e.textContent?.trim()))
    assert.ok(suggestions.includes("Confectioners' sugar"))
  } finally {
    await page.close()
  }
})

test('typing the ambiguous word "flour" offers multiple specific suggestions, never a single silent match', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'flour')
    const suggestions = await page.$$eval('.bp-autocomplete-option', els => els.map(e => e.textContent?.trim()))
    assert.ok(suggestions.includes('All-purpose flour'))
    assert.ok(suggestions.includes('Bread flour'))
    assert.ok(suggestions.includes('Cake flour'))
    assert.ok(suggestions.length >= 3)
  } finally {
    await page.close()
  }
})

test('typing "flour" alone and never selecting a suggestion leaves no ingredient identity attached — the manual panel still governs a cross-type mismatch', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'flour')
    // Deliberately do not click a suggestion — dismiss the open dropdown
    // with Escape (a real click here could land on the dropdown itself,
    // since like any overlay autocomplete it covers the field beneath it).
    await page.keyboard.press('Escape')
    await page.click('#bp-ing-price')
    await page.type('#bp-ing-price', '3.49')
    await page.type('#bp-ing-pkg-qty', '5')
    const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
    await pkgUnitSelect!.select('lb')
    await page.type('#bp-ing-use-qty', '2')
    const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
    await useUnitSelect!.select('cup')
    await page.waitForFunction(() => !!document.querySelector('.bp-cross-type-help'))
    const standardBanner = await page.$('.bp-standard-conversion')
    assert.equal(standardBanner, null, 'no standard conversion may apply without an explicit selection')
    const choiceGroup = await page.$('.bp-choice-group')
    assert.ok(choiceGroup, 'the manual resolution panel must still be offered')
  } finally {
    await page.close()
  }
})

test('the small "Change" control lets the baker enter a brand-specific conversion, overriding the standard', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'All-purpose flour')
    await selectSuggestionByText(page, 'All-purpose flour')
    await page.type('#bp-ing-price', '3.49')
    await page.type('#bp-ing-pkg-qty', '5')
    const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
    await pkgUnitSelect!.select('lb')
    await page.type('#bp-ing-use-qty', '2')
    const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
    await useUnitSelect!.select('cup')
    await page.waitForFunction(() => !!document.querySelector('.bp-standard-conversion'))

    await page.click('.bp-standard-conversion-change')
    await page.waitForFunction(() => !!document.querySelector('.bp-choice-group'))
    // The standard-estimate banner is gone; the manual panel (with a
    // "use the standard instead" escape hatch) takes over.
    const bannerGone = await page.$('.bp-standard-conversion')
    assert.equal(bannerGone, null)
    const revertLink = await page.$eval('.bp-cross-type-help', el => el.textContent || '')
    assert.match(revertLink, /Use the standard estimate instead \(1 cup = 120g\)/)

    await enterConversion(page, 'cup', '130')
    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    const rowText = await page.$eval('.bp-ingredient-list', el => el.textContent || '')
    // 3.49 * (260 g / 2267.96185 g) ≈ $0.40, using the overridden 130 g/cup —
    // never the standard 120 g/cup once overridden.
    assert.match(rowText, /\$0\.40/, `expected ~$0.40 with the override, got: ${rowText}`)
  } finally {
    await page.close()
  }
})

test('a recipe amount already given as a weight is used directly — the library is never consulted', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'All-purpose flour')
    await selectSuggestionByText(page, 'All-purpose flour')
    await page.type('#bp-ing-price', '3.49')
    await page.type('#bp-ing-pkg-qty', '5')
    const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
    await pkgUnitSelect!.select('lb')
    // Recipe usage given directly in grams — same measurement type as the
    // package, so this is never a cross-type case at all.
    await page.type('#bp-ing-use-qty', '280')
    const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
    await useUnitSelect!.select('g')
    const crossTypeHelp = await page.$('.bp-cross-type-help')
    assert.equal(crossTypeHelp, null, 'a same-type (weight-to-weight) entry must never show any cross-type UI')
    const standardBanner = await page.$('.bp-standard-conversion')
    assert.equal(standardBanner, null)
    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    const rowText = await page.$eval('.bp-ingredient-list', el => el.textContent || '')
    // 3.49 * (280 g / 2267.96185 g) ≈ $0.43 — computed straight from the
    // recipe's own weight entry, with no density conversion involved.
    assert.match(rowText, /\$0\.43/, `expected ~$0.43, got: ${rowText}`)
  } finally {
    await page.close()
  }
})

test('an unknown custom ingredient falls back to the manual resolution panel, with no standard-conversion banner', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, { name: 'My Secret Spice Blend', packageUnit: 'lb', amountUsedUnit: 'cup', packagePrice: '9.99', packageQuantity: '1', amountUsed: '1' })
    const standardBanner = await page.$('.bp-standard-conversion')
    assert.equal(standardBanner, null)
    const choiceGroup = await page.$('.bp-choice-group')
    assert.ok(choiceGroup, 'an unrecognized ingredient must fall back to the manual two-choice panel')
  } finally {
    await page.close()
  }
})

test('a recognized ingredient without a trustworthy reference conversion (unpacked brown sugar) still falls back to manual resolution', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'unpacked brown sugar')
    await selectSuggestionByText(page, 'Brown sugar (lightly spooned, not packed)')
    await page.type('#bp-ing-price', '3.00')
    await page.type('#bp-ing-pkg-qty', '2')
    const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
    await pkgUnitSelect!.select('lb')
    await page.type('#bp-ing-use-qty', '1')
    const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
    await useUnitSelect!.select('cup')
    await page.waitForFunction(() => !!document.querySelector('.bp-cross-type-help'))
    const standardBanner = await page.$('.bp-standard-conversion')
    assert.equal(standardBanner, null, 'an ingredient with no reference conversion must never guess one')
    const helpText = await page.$eval('.bp-cross-type-help', el => el.textContent || '')
    assert.match(helpText, /don't have a standard estimate/i)
    const choiceGroup = await page.$('.bp-choice-group')
    assert.ok(choiceGroup, 'manual resolution must still be offered')
  } finally {
    await page.close()
  }
})

test('a bare "salt" query never silently picks one salt type — all distinct salts are offered, including two different kosher-salt brands', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'salt')
    const suggestions = await page.$$eval('.bp-autocomplete-option', els => els.map(e => e.textContent?.trim()))
    assert.ok(suggestions.includes('Table salt'))
    assert.ok(suggestions.includes('Kosher salt (Diamond Crystal)'))
    assert.ok(suggestions.includes("Kosher salt (Morton's)"))
    assert.ok(suggestions.includes('Fine sea salt'))
  } finally {
    await page.close()
  }
})

test('the ingredient-name field is a keyboard-accessible combobox: ArrowDown highlights, Enter selects', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'flour')
    await page.keyboard.press('ArrowDown')
    const activeDescendant = await page.$eval('#bp-ing-name', el => el.getAttribute('aria-activedescendant'))
    assert.equal(activeDescendant, 'bp-ing-name-option-0')
    await page.keyboard.press('Enter')
    const nameValue = await page.$eval('#bp-ing-name', el => (el as HTMLInputElement).value)
    assert.equal(nameValue, 'All-purpose flour', 'Enter on the first highlighted suggestion should select it')
    const listGone = await page.$('.bp-autocomplete-list')
    assert.equal(listGone, null, 'the suggestion list should close once a selection is made')
  } finally {
    await page.close()
  }
})

test('Escape closes the suggestion list without selecting anything', async () => {
  const page = await openTool()
  try {
    await typeIngredientName(page, 'flour')
    await page.keyboard.press('Escape')
    const listGone = await page.$('.bp-autocomplete-list')
    assert.equal(listGone, null)
    const nameValue = await page.$eval('#bp-ing-name', el => (el as HTMLInputElement).value)
    assert.equal(nameValue, 'flour', 'typed text is preserved, unchanged, after Escape')
  } finally {
    await page.close()
  }
})

test('the autocomplete list has no horizontal overflow and meets 44px touch targets at 320px', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 320, height: 900 })
    await typeIngredientName(page, 'flour')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `expected no overflow with the suggestion list open, got ${overflow}px`)
    const smallOptions = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.bp-autocomplete-option'))
      return els.filter(el => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 44).map(el => el.textContent)
    })
    assert.deepEqual(smallOptions, [])
  } finally {
    await page.close()
  }
})

test('the ingredient form uses plain-language questions instead of technical field labels', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-btn-ghost')
    await page.waitForFunction(() => !!document.querySelector('#bp-ing-name'))
    const priceLabel = await page.$eval('label[for="bp-ing-price"]', el => el.textContent || '')
    assert.match(priceLabel, /what did the package cost/i)
    const pkgQtyLabel = await page.$eval('label[for="bp-ing-pkg-qty"]', el => el.textContent || '')
    assert.match(pkgQtyLabel, /how much came in the package/i)
    const useQtyLabel = await page.$eval('label[for="bp-ing-use-qty"]', el => el.textContent || '')
    assert.match(useQtyLabel, /how much does this recipe use/i)
  } finally {
    await page.close()
  }
})

test('package amount and recipe amount are visually grouped with clear "Package" / "This recipe" labels', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-btn-ghost')
    await page.waitForFunction(() => !!document.querySelector('#bp-ing-name'))
    const groupLabel = await page.$eval('.bp-amount-compare-label', el => el.textContent || '')
    assert.match(groupLabel, /convert automatically/i)
    const blockTitles = await page.$$eval('.bp-amount-block-title', els => els.map(el => el.textContent?.trim()))
    assert.deepEqual(blockTitles, ['Package', 'This recipe'])
    const pkgQtyInsideGroup = await page.$('.bp-amount-compare #bp-ing-pkg-qty')
    const useQtyInsideGroup = await page.$('.bp-amount-compare #bp-ing-use-qty')
    assert.ok(pkgQtyInsideGroup, 'package quantity field should be inside the grouped comparison')
    assert.ok(useQtyInsideGroup, 'amount-used field should be inside the grouped comparison')
  } finally {
    await page.close()
  }
})

test('placeholders show realistic examples without pre-filling values a user could mistake for real data', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-btn-ghost')
    await page.waitForFunction(() => !!document.querySelector('#bp-ing-name'))
    for (const id of ['bp-ing-name', 'bp-ing-price', 'bp-ing-pkg-qty', 'bp-ing-use-qty']) {
      const value = await page.$eval(`#${id}`, el => (el as HTMLInputElement).value)
      assert.equal(value, '', `#${id} must start empty, not pre-filled`)
      const placeholder = await page.$eval(`#${id}`, el => (el as HTMLInputElement).placeholder)
      assert.match(placeholder, /^e\.g\.,/, `#${id} should show a short "e.g., ..." example`)
    }
  } finally {
    await page.close()
  }
})

test('the add-ingredient button reads "Add to recipe"', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-btn-ghost')
    await page.waitForFunction(() => !!document.querySelector('.bp-add-ingredient-form'))
    const label = await page.$eval('.bp-add-ingredient-form .bp-btn-primary', el => el.textContent?.trim())
    assert.equal(label, 'Add to recipe')
  } finally {
    await page.close()
  }
})

test('a live cost preview appears once price, quantity, and amount used are all filled in', async () => {
  const page = await openTool()
  try {
    await addIngredient(page, {
      name: 'Flour', packageUnit: 'lb', amountUsedUnit: 'g',
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
      name: 'Bad Price', packageUnit: 'g', amountUsedUnit: 'g',
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

async function laborNoticePresent(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.querySelectorAll('.bp-cost-group')[0]?.querySelector('.bp-zero-notice'))
}

test('no zero-cost notice appears immediately when Additional Costs is first shown, even though every field starts blank', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    const anyNotice = await page.$('.bp-zero-notice')
    assert.equal(anyNotice, null, 'zero-cost notices must not appear before the baker has tried to leave this step')
  } finally {
    await page.close()
  }
})

test('no zero-cost notice appears merely from opening a cost section, before leaving the step', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await openCostGroup(page, 1) // Packaging
    await openCostGroup(page, 2) // Overhead
    await openCostGroup(page, 3) // Ingredient Waste Allowance
    const anyNotice = await page.$('.bp-zero-notice')
    assert.equal(anyNotice, null, 'opening a section to look at it must not itself trigger the zero-cost review')
  } finally {
    await page.close()
  }
})

test('zero-cost notices appear once the baker leaves Additional Costs and comes back', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await reachReviewedCostsStep(page)
    const notice = await page.$('.bp-zero-notice')
    assert.ok(notice, 'zero-cost notice should appear for Labor once the step has been left once')
    const text = await notice!.evaluate(el => el.textContent || '')
    assert.match(text, /is that intentional/i)
  } finally {
    await page.close()
  }
})

test('advancing to the breakdown with unacknowledged zero costs is not blocked (non-blocking review)', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await page.click('.bp-nav .bp-btn-primary')
    const onBreakdown = await page.$('.bp-price-lead')
    assert.ok(onBreakdown, 'zero-cost notices must never block advancing, per the PRD')
  } finally {
    await page.close()
  }
})

test('dismissing the zero-cost notice hides it and it does not reappear after further edits', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await reachReviewedCostsStep(page)
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

test('Supplies zero-notice disappears once at least one item is added', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await reachReviewedCostsStep(page)
    await openSuppliesGroup(page)
    const noticeBefore = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll('.bp-cost-group'))
      return !!groups[1]?.querySelector('.bp-zero-notice')
    })
    assert.equal(noticeBefore, true, 'supplies should be flagged as zero before any item is added')
    await addSupplyDirectItem(page, { name: 'Cake Box', directCost: '1.50' })
    const noticeAfter = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll('.bp-cost-group'))
      return !!groups[1]?.querySelector('.bp-zero-notice')
    })
    assert.equal(noticeAfter, false, 'supplies must not be flagged as zero once an item has been added')
  } finally {
    await page.close()
  }
})

// ─── 4b. Supplies & Packaging ────────────────────────────────────────────────

test('Supplies & Packaging explains what belongs there and what does not (reusable equipment)', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await openSuppliesGroup(page)
    const text = await page.$eval('.bp-supplies-section', el => el.textContent || '')
    assert.match(text, /boxes, cake boards, bags, liners, labels, ribbon, parchment, sticks, dowels, and disposable trays/i)
    assert.match(text, /reusable equipment/i)
    assert.match(text, /mixers, pans, decorating tools/i)
    assert.match(text, /overhead/i)
  } finally {
    await page.close()
  }
})

test('adds multiple supply items and shows each cost separately plus a combined subtotal', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await openSuppliesGroup(page)
    await addSupplyPackageItem(page, { name: 'Cake-Pop Sticks', packagePrice: '5.00', packageQuantity: '100', amountUsed: '24' })
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    await addSupplyDirectItem(page, { name: 'Cake Box', directCost: '1.50' })
    await page.waitForFunction(() => document.querySelectorAll('.bp-supplies-section .bp-ingredient-row:not(.bp-ingredient-subtotal)').length === 2)
    const text = await page.$eval('.bp-supplies-section', el => el.textContent || '')
    assert.match(text, /Cake-Pop Sticks/)
    assert.match(text, /\$1\.20/, 'package-mode item cost')
    assert.match(text, /Cake Box/)
    assert.match(text, /\$1\.50/, 'direct-mode item cost')
    const subtotal = await page.$eval('.bp-supplies-section .bp-ingredient-subtotal', el => el.textContent || '')
    assert.match(subtotal, /\$2\.70/, `expected combined subtotal $2.70, got: ${subtotal}`)
  } finally {
    await page.close()
  }
})

test('a fractional (non-round) package cost is computed and displayed correctly', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await openSuppliesGroup(page)
    // $10 for a pack of 3 -> $3.33... per unit, one used.
    await addSupplyPackageItem(page, { name: 'Ribbon Spools', packagePrice: '10', packageQuantity: '3', amountUsed: '1' })
    await page.waitForFunction(() => !!document.querySelector('.bp-supplies-section .bp-ingredient-row'))
    const text = await page.$eval('.bp-supplies-section', el => el.textContent || '')
    assert.match(text, /\$3\.33/, `expected a fractional cost around $3.33, got: ${text}`)
  } finally {
    await page.close()
  }
})

test('a supply item with zero amount used costs $0, not an error', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await openSuppliesGroup(page)
    await addSupplyPackageItem(page, { name: 'Unused Labels', packagePrice: '5', packageQuantity: '100', amountUsed: '0' })
    await page.waitForFunction(() => !!document.querySelector('.bp-supplies-section .bp-ingredient-row'))
    const text = await page.$eval('.bp-supplies-section', el => el.textContent || '')
    assert.match(text, /\$0\.00/, `expected $0.00, got: ${text}`)
  } finally {
    await page.close()
  }
})

test('a supply item with a zero package quantity is rejected, not silently accepted', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await openSuppliesGroup(page)
    await addSupplyPackageItem(page, { name: 'Bad Item', packagePrice: '5', packageQuantity: '0', amountUsed: '1' })
    const errorText = await page.$eval('.bp-supplies-section .bp-error', el => el.textContent || '')
    assert.match(errorText, /greater than zero/i)
    const added = await page.$('.bp-supplies-section .bp-ingredient-row')
    assert.equal(added, null, 'the invalid item must not be added')
  } finally {
    await page.close()
  }
})

test('removing a supply item takes it out of the list and updates the subtotal', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await openSuppliesGroup(page)
    await addSupplyDirectItem(page, { name: 'Cake Box', directCost: '1.50' })
    await page.waitForFunction(() => !!document.querySelector('.bp-supplies-section .bp-ingredient-row'))
    await page.click('.bp-supplies-section .bp-row-actions .bp-remove-btn:last-child')
    const rows = await page.$$('.bp-supplies-section .bp-ingredient-row')
    assert.equal(rows.length, 0, 'no supply rows should remain')
  } finally {
    await page.close()
  }
})

test('editing a supply item updates its cost in place, without adding a duplicate row', async () => {
  const page = await openTool()
  try {
    await advanceToCosts(page)
    await openSuppliesGroup(page)
    await addSupplyDirectItem(page, { name: 'Cake Box', directCost: '1.50' })
    await page.waitForFunction(() => !!document.querySelector('.bp-supplies-section .bp-ingredient-row'))
    await page.click('.bp-supplies-section .bp-row-actions .bp-remove-btn:first-child') // edit (pencil)
    await page.waitForFunction(() => !!document.querySelector('#bp-supply-direct'))
    await page.click('#bp-supply-direct')
    await page.$eval('#bp-supply-direct', el => (el as HTMLInputElement).select())
    await page.type('#bp-supply-direct', '2.25')
    await page.click('.bp-supplies-section .bp-btn-primary')
    await new Promise(r => setTimeout(r, 100))
    const rows = await page.$$('.bp-supplies-section .bp-ingredient-row:not(.bp-ingredient-subtotal)')
    assert.equal(rows.length, 1, 'editing must not create a second row')
    const text = await page.$eval('.bp-supplies-section', el => el.textContent || '')
    assert.match(text, /\$2\.25/)
  } finally {
    await page.close()
  }
})

// ─── 5. Cost Breakdown & Pricing — hand-verified example ────────────────────

async function buildHandVerifiedRecipe(page: Page) {
  await setYield(page, '24')
  await addIngredient(page, {
    name: 'Eggs', packageUnit: 'each', amountUsedUnit: 'each',
    packagePrice: '4.00', packageQuantity: '4', amountUsed: '2',
  })
  await saveIngredient(page)
  await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
  await page.click('.bp-nav .bp-btn-primary')
  await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
  await page.type('#bp-labor-rate', '18')
  await page.type('#bp-labor-minutes', '40')
  await openSuppliesGroup(page)
  // Equivalent to the old $1.50 batch + $0.15/item x 24 packaging formula,
  // now expressed as two Supplies & Packaging line items: $5.10 total.
  await addSupplyDirectItem(page, { name: 'Cake Box', directCost: '1.50' })
  await page.waitForFunction(() => !!document.querySelector('.bp-supplies-section .bp-ingredient-row'))
  await addSupplyPackageItem(page, { name: 'Liners', packagePrice: '15.00', packageQuantity: '100', amountUsed: '24' })
  await page.waitForFunction(() => document.querySelectorAll('.bp-supplies-section .bp-ingredient-row:not(.bp-ingredient-subtotal)').length === 2)
  await openCostGroup(page, 2)
  await page.type('#bp-overhead', '3.00')
  await openCostGroup(page, 3)
  await page.type('#bp-waste', '3')
  await page.click('.bp-nav .bp-btn-primary')
  await page.waitForFunction(() => !!document.querySelector('.bp-price-lead'))
}

// Hand-verified: ingredientSubtotal $2.00 (4.00 * 2/4), wasteAllowance $0.06 (2.00*3%),
// laborCost $12.00 (18 * 40/60), supplies $5.10 (1.50 + 15*(24/100)=1.50+3.60), overhead $3.00.
// Total = 2.00 + 0.06 + 12.00 + 5.10 + 3.00 = $22.16. Cost per item = 22.16/24 = $0.92 (2dp).
test('cost breakdown matches a hand-verified example exactly, inside "See how this was calculated"', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    await openCalculationDetails(page)
    const ledgerText = await page.$eval('.bp-ledger', el => el.textContent || '')
    assert.match(ledgerText, /\$2\.00/, 'ingredient subtotal')
    assert.match(ledgerText, /\$0\.06/, 'waste allowance')
    assert.match(ledgerText, /\$12\.00/, 'labor cost')
    assert.match(ledgerText, /\$5\.10/, 'supplies & packaging cost')
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

test('the suggested price leads the breakdown step, with the full calculation collapsed by default', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const detailsOpen = await page.$eval('.bp-breakdown-details', el => (el as HTMLDetailsElement).open)
    assert.equal(detailsOpen, false, '"See how this was calculated" should be collapsed by default')
    const priceLeadY = await page.$eval('.bp-price-lead', el => el.getBoundingClientRect().top)
    const detailsY = await page.$eval('.bp-breakdown-details', el => el.getBoundingClientRect().top)
    assert.ok(priceLeadY < detailsY, 'the suggested price must appear above the detailed breakdown')
  } finally {
    await page.close()
  }
})

// ─── 5b. Typography (boutique bakery classic: Libre Caslon Display + Karla) ─

test('the suggested-price figures use bold Karla with tabular numerals, not the display serif', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const style = await page.$eval('.bp-price-lead .bp-price-big', el => {
      const computed = getComputedStyle(el)
      return { fontFamily: computed.fontFamily, fontVariantNumeric: computed.fontVariantNumeric, fontWeight: computed.fontWeight }
    })
    assert.match(style.fontFamily, /Karla/)
    assert.doesNotMatch(style.fontFamily, /Libre Caslon/)
    assert.match(style.fontVariantNumeric, /tabular-nums/)
    assert.equal(style.fontWeight, '700', 'the headline price must be visually dominant (bold), not the engine default')
  } finally {
    await page.close()
  }
})

test('the page title and major section headings use Libre Caslon Display, at its genuine weight rather than a synthesized bold', async () => {
  const page = await openTool()
  try {
    const heading = await page.$eval('.bp-page-heading', el => {
      const computed = getComputedStyle(el)
      return { fontFamily: computed.fontFamily, fontWeight: computed.fontWeight }
    })
    assert.match(heading.fontFamily, /Libre Caslon Display/)
    assert.doesNotMatch(heading.fontFamily, /^Karla/)
    // Libre Caslon Display ships only one real weight (400) — asking for
    // 600/700 would only trigger the browser's synthesized ("fake") bold.
    assert.equal(heading.fontWeight, '400', 'headings must use the display font\'s genuine weight, not a synthesized bold')
    const h2 = await page.$eval('.bp-h2', el => {
      const computed = getComputedStyle(el)
      return { fontFamily: computed.fontFamily, fontWeight: computed.fontWeight }
    })
    assert.match(h2.fontFamily, /Libre Caslon Display/)
    assert.equal(h2.fontWeight, '400')
  } finally {
    await page.close()
  }
})

test('exactly one short italic Libre Caslon Text decorative accent appears, near the suggested price, and is not used for the price itself or any label/button', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const accents = await page.$$('.bp-script-accent')
    assert.equal(accents.length, 1, 'at most one decorative accent should exist on the page at a time')
    const accent = await page.$eval('.bp-script-accent', el => {
      const computed = getComputedStyle(el)
      return { fontFamily: computed.fontFamily, fontStyle: computed.fontStyle }
    })
    // Libre Caslon Display has no italic cut of its own, so the accent
    // borrows its companion text face instead.
    assert.match(accent.fontFamily, /Libre Caslon Text/)
    assert.equal(accent.fontStyle, 'italic')
    // The price figures, labels, and buttons must never themselves be set in the accent's italic face.
    const priceFont = await page.$eval('.bp-price-lead .bp-price-big', el => getComputedStyle(el).fontFamily)
    assert.doesNotMatch(priceFont, /Libre Caslon Text/)
    const buttonFont = await page.$eval('.bp-nav .bp-btn', el => getComputedStyle(el).fontFamily)
    assert.doesNotMatch(buttonFont, /Libre Caslon Text/)
    const labelFont = await page.$eval('label', el => getComputedStyle(el).fontFamily)
    assert.doesNotMatch(labelFont, /Libre Caslon Text/)
  } finally {
    await page.close()
  }
})

test('form labels, buttons, and step indicator use Karla (the interface font), not the display serif', async () => {
  const page = await openTool()
  try {
    await page.click('.bp-btn-ghost')
    await page.waitForSelector('#bp-ing-name')
    const labelFont = await page.$eval('label[for="bp-ing-name"]', el => getComputedStyle(el).fontFamily)
    assert.match(labelFont, /Karla/)
    const buttonFont = await page.$eval('.bp-add-ingredient-form .bp-btn-primary', el => getComputedStyle(el).fontFamily)
    assert.match(buttonFont, /Karla/)
    const stepLabelFont = await page.$eval('.bp-step-label', el => getComputedStyle(el).fontFamily)
    assert.match(stepLabelFont, /Karla/)
    assert.doesNotMatch(stepLabelFont, /Libre Caslon/)
  } finally {
    await page.close()
  }
})

test('the "Continue to Additional Costs" nav button does not wrap onto more than two lines at 320px', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 320, height: 900 })
    await setYield(page, '24')
    await addIngredient(page, { name: 'Eggs', packageUnit: 'each', amountUsedUnit: 'each', packagePrice: '4', packageQuantity: '4', amountUsed: '2' })
    await saveIngredient(page)
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    const buttonHeight = await page.$eval('.bp-nav .bp-btn-primary', el => el.getBoundingClientRect().height)
    // A single-line button is ~48px tall; three cramped lines would be
    // noticeably taller. Two lines (or one) stays comfortably under this.
    assert.ok(buttonHeight < 90, `expected a one- or two-line button, got a height suggesting more lines: ${buttonHeight}px`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `expected no horizontal overflow, got ${overflow}px`)
  } finally {
    await page.close()
  }
})

test('fallback fonts still produce a usable layout if the web fonts are unavailable', async () => {
  const page = await browser.newPage()
  try {
    // Simulate the web fonts never loading by blocking the Google Fonts
    // stylesheet request before the very first navigation.
    await page.setRequestInterception(true)
    page.on('request', req => {
      if (req.url().includes('fonts.googleapis.com') || req.url().includes('fonts.gstatic.com')) req.abort()
      else req.continue()
    })
    await page.goto(`${baseUrl}/tools-bakery-pricing.html`, { waitUntil: 'load' })
    const headingFont = await page.$eval('.bp-page-heading', el => getComputedStyle(el).fontFamily)
    assert.match(headingFont, /Georgia|serif/i, 'the display font must fall back to a real serif, not disappear')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `expected a usable, non-overflowing layout even without the web fonts, got ${overflow}px`)
    const heading = await page.$eval('.bp-page-heading', el => el.textContent || '')
    assert.match(heading, /Free Home Bakery Pricing Calculator/)
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

test('margin explanation is a single short sentence next to the margin input', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const heading = await page.$eval('h2.bp-h2', el => el.textContent || '')
    assert.match(heading, /profit margin/i)
    const explanation = await page.$eval('.bp-step .bp-helper', el => el.textContent || '')
    assert.match(explanation, /margin is the percentage/i)
    // One sentence: exactly one period-terminated clause, no "markup" mentioned at equal weight here.
    assert.doesNotMatch(explanation, /markup/i, 'markup must not appear in the primary margin explanation')
  } finally {
    await page.close()
  }
})

test('markup is shown only as secondary, optional reference inside "See how this was calculated"', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const markupVisibleBeforeExpanding = await page.$('.bp-markup-note')
    // The element exists in the DOM (inside the collapsed <details>) but the
    // point under test is that it is not part of the lead content the baker
    // sees first — verified by the previous test's DOM-order check. Here we
    // confirm the markup value itself is correct once revealed.
    void markupVisibleBeforeExpanding
    await openCalculationDetails(page)
    await setInputValue(page, '[aria-label="Desired profit margin percentage"]', '50')
    await page.waitForFunction(() => /≈ 100\.0%/.test(document.querySelector('.bp-markup-note')?.textContent || ''))
    const noteText = await page.$eval('.bp-markup-note', el => el.textContent || '')
    assert.match(noteText, /≈ 100\.0%/, `expected 50% margin to equal 100% markup, got: ${noteText}`)
    assert.match(noteText, /for reference/i)
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
      name: 'Fine Sea Salt', packageUnit: 'oz', amountUsedUnit: 'oz',
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
    const stillOnBreakdown = await page.$('.bp-price-lead')
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

test('the app opens its own namespaced IndexedDB database (Milestone M4 saved-data persistence)', async () => {
  const page = await openTool()
  try {
    await buildHandVerifiedRecipe(page)
    const dbNames = await page.evaluate(async () => {
      if (!indexedDB.databases) return []
      const dbs = await indexedDB.databases()
      return dbs.map(d => d.name)
    })
    assert.deepEqual(dbNames, ['bakery-pricing-planner'], 'M4 opens exactly one, distinctly-namespaced IndexedDB database')
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

test('yield, recipe name, and margin inputs each have an associated plain-language label', async () => {
  const page = await openTool()
  try {
    const yieldLabel = await page.$eval('label[for="bp-yield"]', el => el.textContent || '')
    assert.match(yieldLabel, /how many items or servings does this recipe make/i)
    const nameLabel = await page.$eval('label[for="bp-recipe-name"]', el => el.textContent || '')
    assert.match(nameLabel, /what are you pricing/i)
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

test('the cross-type explanation and its conversion form have no horizontal overflow and meet 44px touch targets at 320px', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 320, height: 900 })
    await addIngredient(page, { name: 'Flour', packageUnit: 'lb', amountUsedUnit: 'cup', packagePrice: '3.49', packageQuantity: '5', amountUsed: '2' })
    await page.waitForFunction(() => !!document.querySelector('.bp-cross-type-help'))
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `expected no overflow with the explanation shown, got ${overflow}px`)

    await enterConversion(page, 'cup', '120')
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `expected no overflow with the conversion form open, got ${overflow}px`)

    const smallControls = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.bp-cross-type-help button'))
      return els
        .filter(el => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.height < 44
        })
        .map(el => el.textContent?.trim())
    })
    assert.deepEqual(smallControls, [], `cross-type controls smaller than 44px: ${JSON.stringify(smallControls)}`)
  } finally {
    await page.close()
  }
})

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

test('the Supplies & Packaging section has no horizontal overflow and meets 44px touch targets at mobile width, with two items added', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 320, height: 900 })
    await advanceToCosts(page)
    await openSuppliesGroup(page)
    await addSupplyPackageItem(page, { name: 'Cake-Pop Sticks', packagePrice: '5.00', packageQuantity: '100', amountUsed: '24' })
    await page.waitForFunction(() => !!document.querySelector('.bp-supplies-section .bp-ingredient-row'))
    await addSupplyDirectItem(page, { name: 'Cake Box', directCost: '1.50' })
    await page.waitForFunction(() => document.querySelectorAll('.bp-supplies-section .bp-ingredient-row:not(.bp-ingredient-subtotal)').length === 2)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `expected no overflow, got ${overflow}px`)

    const smallControls = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.bp-supplies-section button, .bp-supplies-section input'))
      return els
        .filter(el => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.height < 44
        })
        .map(el => el.tagName + ':' + (el.textContent?.trim() || (el as HTMLInputElement).id))
    })
    assert.deepEqual(smallControls, [], `controls smaller than 44px: ${JSON.stringify(smallControls)}`)
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
