// Real-browser integration tests for the Free Home Bakery Pricing
// Calculator's saved-data UI (Milestone M4): saved recipes CRUD, saved
// ingredients CRUD with shared-ingredient reuse and edit-impact
// confirmation, the what-if edit/discard flow, and the Backup & Restore
// export/import UI. Runs against the production build (dist/) via a
// lightweight static HTTP server, driven by real headless Chrome — the
// same pattern as bakeryPricingCalculatorUI.test.ts (M3).
//
// Every test starts from a freshly wiped IndexedDB database so tests never
// leak saved data into one another.
//
// Run with: node --test test/tools/bakeryPricingSavedData.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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

// Every test gets its own empty database — this app's IndexedDB store
// persists across pages in the same browser instance, so without this,
// saved data from one test would leak into the next.
async function openFreshTool(): Promise<Page> {
  const page = await browser.newPage()
  await page.goto(`${baseUrl}/tools-bakery-pricing.html`, { waitUntil: 'load' })
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
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

interface IngredientInput {
  name: string
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
  await page.keyboard.press('Escape')
  await page.type('#bp-ing-price', ing.packagePrice)
  await page.type('#bp-ing-pkg-qty', ing.packageQuantity)
  const pkgUnitSelect = await page.$('select[aria-label="Package amount unit"]')
  await pkgUnitSelect!.select(ing.packageUnit)
  await page.type('#bp-ing-use-qty', ing.amountUsed)
  const useUnitSelect = await page.$('select[aria-label="Amount used unit"]')
  await useUnitSelect!.select(ing.amountUsedUnit)
  await page.click('.bp-add-ingredient-form .bp-btn-primary')
  await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
}

async function priceAndSaveRecipe(page: Page, name: string, yieldValue: string, ing: IngredientInput) {
  await page.type('#bp-recipe-name', name)
  await setInputValue(page, '#bp-yield', yieldValue)
  await addIngredient(page, ing)
  await page.click('.bp-nav .bp-btn-primary') // -> costs
  await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
  await page.click('.bp-nav .bp-btn-primary') // -> breakdown
  await page.waitForSelector('.bp-save-row')
  await page.click('.bp-save-row .bp-btn-primary')
  await page.waitForFunction(
    () => document.querySelector('.bp-app-nav-btn.is-active')?.textContent?.includes('Saved Recipes'),
    { timeout: 5000 },
  )
}

async function confirmDialog(page: Page) {
  await page.waitForSelector('.tool-confirm-proceed', { timeout: 5000 })
  await page.click('.tool-confirm-proceed')
}

const FLOUR: IngredientInput = { name: 'Flour', packageUnit: 'lb', amountUsedUnit: 'lb', packagePrice: '3.49', packageQuantity: '5', amountUsed: '2' }

// ─── 1. App shell & database ─────────────────────────────────────────────

test('the app opens exactly one namespaced IndexedDB database on load', async () => {
  const page = await openFreshTool()
  try {
    const dbNames = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name))
    assert.deepEqual(dbNames, ['bakery-pricing-planner'])
  } finally {
    await page.close()
  }
})

test('all three nav tabs are present once the database is ready, Calculator active by default', async () => {
  const page = await openFreshTool()
  try {
    const labels = await page.$$eval('.bp-app-nav-btn', els => els.map(e => e.textContent))
    assert.equal(labels.length, 3)
    assert.match(labels[0]!, /Calculator/)
    assert.match(labels[1]!, /Saved Recipes/)
    assert.match(labels[2]!, /Ingredient Library/)
    const active = await page.$eval('.bp-app-nav-btn.is-active', el => el.textContent)
    assert.match(active!, /Calculator/)
  } finally {
    await page.close()
  }
})

test('Saved Recipes and Ingredient Library both start with a friendly empty state', async () => {
  const page = await openFreshTool()
  try {
    await page.click('.bp-app-nav-btn:nth-child(2)')
    await page.waitForSelector('.bp-empty-state')
    const recipesEmpty = await page.$eval('.bp-empty-state', el => el.textContent)
    assert.match(recipesEmpty!, /haven't saved any recipes/)

    await page.click('.bp-app-nav-btn:nth-child(3)')
    await page.waitForSelector('.bp-empty-state')
    const ingredientsEmpty = await page.$eval('.bp-empty-state', el => el.textContent)
    assert.match(ingredientsEmpty!, /No saved ingredients yet/)
  } finally {
    await page.close()
  }
})

// ─── 2. Saving, listing, editing, duplicating, deleting recipes (M4-1) ────

test('saving a priced recipe adds it to Saved Recipes with a live-computed suggested price', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Test Cookies', '12', FLOUR)
    const rowText = await page.$eval('.bp-ingredient-row', el => el.textContent)
    assert.match(rowText!, /Test Cookies/)
    assert.match(rowText!, /\$\d+\.\d{2} \/ item/)
  } finally {
    await page.close()
  }
})

test('saving without a recipe name is blocked and returns to Step 1 with an inline error', async () => {
  const page = await openFreshTool()
  try {
    await setInputValue(page, '#bp-yield', '12')
    await addIngredient(page, FLOUR)
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('.bp-save-row')
    await page.click('.bp-save-row .bp-btn-primary')
    await page.waitForFunction(() => !!document.querySelector('#bp-recipe-name'))
    const errorText = await page.$eval('.bp-error', el => el.textContent)
    assert.match(errorText!, /Enter a name for this recipe/)
  } finally {
    await page.close()
  }
})

test('opening a saved recipe loads its ingredients and shows an editing banner', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Test Cookies', '12', FLOUR)
    await page.click('.bp-saved-recipe-name')
    await page.waitForSelector('.bp-editing-banner')
    const banner = await page.$eval('.bp-editing-banner', el => el.textContent)
    assert.match(banner!, /Editing.*Test Cookies/)
    const ingredientRow = await page.$eval('.bp-ingredient-row', el => el.textContent)
    assert.match(ingredientRow!, /Flour/)
    assert.match(ingredientRow!, /2 lb/)
  } finally {
    await page.close()
  }
})

test('discarding an edit returns to Saved Recipes without persisting the change', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Test Cookies', '12', FLOUR)
    await page.click('.bp-saved-recipe-name')
    await page.waitForSelector('.bp-editing-banner')
    await setInputValue(page, '#bp-yield', '999')
    // "Discard changes" lives on the breakdown step, same as M3's "Start Over".
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('.bp-save-row')
    await page.click('.bp-link-btn::-p-text(Discard changes)')
    await confirmDialog(page)
    await page.waitForSelector('.bp-saved-recipe-name', { timeout: 5000 })
    await page.click('.bp-saved-recipe-name')
    await page.waitForSelector('#bp-yield')
    const yieldValue = await page.$eval('#bp-yield', el => (el as HTMLInputElement).value)
    assert.equal(yieldValue, '12', 'the discarded yield change must not have been saved')
  } finally {
    await page.close()
  }
})

test('a what-if edit (changing yield) can be saved with "Save Changes" and the new value persists', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Test Cookies', '12', FLOUR)
    await page.click('.bp-saved-recipe-name')
    await page.waitForSelector('#bp-yield')
    await setInputValue(page, '#bp-yield', '48')
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('.bp-save-row')
    const saveLabel = await page.$eval('.bp-save-row .bp-btn-primary', el => el.textContent)
    assert.match(saveLabel!, /Save Changes/)
    await page.click('.bp-save-row .bp-btn-primary')
    await page.waitForFunction(
      () => document.querySelector('.bp-app-nav-btn.is-active')?.textContent?.includes('Saved Recipes'),
      { timeout: 5000 },
    )
    await page.click('.bp-saved-recipe-name')
    await page.waitForSelector('#bp-yield')
    const yieldValue = await page.$eval('#bp-yield', el => (el as HTMLInputElement).value)
    assert.equal(yieldValue, '48')
  } finally {
    await page.close()
  }
})

test('duplicating a saved recipe creates an independent copy', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Test Cookies', '12', FLOUR)
    await page.click('.bp-ingredient-row .bp-link-btn::-p-text(Duplicate)')
    await page.waitForFunction(() => document.querySelectorAll('.bp-ingredient-row').length >= 2)
    const names = await page.$$eval('.bp-saved-recipe-name', els => els.map(e => e.textContent))
    assert.ok(names.some(n => n === 'Test Cookies'))
    assert.ok(names.some(n => n === 'Test Cookies (Copy)'))
  } finally {
    await page.close()
  }
})

test('deleting a saved recipe requires confirmation and removes it from the list', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Test Cookies', '12', FLOUR)
    await page.click('.bp-ingredient-row .bp-remove-btn')
    await confirmDialog(page)
    await page.waitForSelector('.bp-empty-state')
    const emptyText = await page.$eval('.bp-empty-state', el => el.textContent)
    assert.match(emptyText!, /haven't saved any recipes/)
  } finally {
    await page.close()
  }
})

// ─── 3. Saved ingredients: reuse, edit impact, delete block (M4-2) ────────

test('adding an ingredient from the autocomplete offers the baker\'s own saved ingredients, reusing rather than duplicating the record', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Recipe One', '12', FLOUR)

    await page.click('.bp-saved-recipes-new')
    await page.waitForSelector('#bp-recipe-name')
    await page.type('#bp-recipe-name', 'Recipe Two')
    await setInputValue(page, '#bp-yield', '10')
    await page.click('.bp-btn-ghost')
    await page.waitForSelector('#bp-ing-name')
    await page.type('#bp-ing-name', 'Flou')
    await page.waitForSelector('.bp-autocomplete-list')
    const badge = await page.$('.bp-autocomplete-badge')
    assert.ok(badge, 'a saved-ingredient suggestion must be visibly marked "Saved"')
    await page.click('.bp-autocomplete-option')

    const priceDisabled = await page.$eval('#bp-ing-price', el => (el as HTMLInputElement).disabled)
    const priceValue = await page.$eval('#bp-ing-price', el => (el as HTMLInputElement).value)
    assert.equal(priceDisabled, true, 'price is looked up live from the saved ingredient, not freely editable')
    assert.equal(priceValue, '3.49')

    await page.type('#bp-ing-use-qty', '1')
    await (await page.$('select[aria-label="Amount used unit"]'))!.select('lb')
    await page.click('.bp-add-ingredient-form .bp-btn-primary')
    await page.waitForFunction(() => !!document.querySelector('.bp-ingredient-row'))
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForFunction(() => !!document.querySelector('#bp-labor-rate'))
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('.bp-save-row')
    await page.click('.bp-save-row .bp-btn-primary')
    await page.waitForFunction(
      () => document.querySelector('.bp-app-nav-btn.is-active')?.textContent?.includes('Saved Recipes'),
      { timeout: 5000 },
    )

    await page.click('.bp-app-nav-btn:nth-child(3)')
    await page.waitForSelector('.bp-ingredient-list li')
    const libRows = await page.$$eval('.bp-ingredient-list li', els => els.map(e => e.textContent))
    assert.equal(libRows.length, 1, 'reusing a saved ingredient must not create a duplicate record')
    assert.match(libRows[0]!, /Used in 2 recipes/)
  } finally {
    await page.close()
  }
})

test('editing a referenced saved ingredient shows a non-blocking impact confirmation naming the recipe', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Test Cookies', '12', FLOUR)
    await page.click('.bp-app-nav-btn:nth-child(3)')
    await page.waitForSelector('.bp-ingredient-row .bp-link-btn')
    await page.click('.bp-ingredient-row .bp-link-btn')
    await page.waitForSelector('#bp-lib-edit-price')
    await setInputValue(page, '#bp-lib-edit-price', '4.00')
    await page.click('.bp-saved-row-editing .bp-btn-primary')
    await page.waitForSelector('[role="dialog"]')
    const dialogText = await page.$eval('[role="dialog"]', el => el.textContent)
    assert.match(dialogText!, /used in 1 saved recipe/)
    assert.match(dialogText!, /Test Cookies/)
    await confirmDialog(page)
    await page.waitForFunction(() => !document.querySelector('#bp-lib-edit-price'))
    const rowText = await page.$eval('.bp-ingredient-row', el => el.textContent)
    assert.match(rowText!, /\$4\.00/)
  } finally {
    await page.close()
  }
})

test('deleting a saved ingredient that is still referenced is blocked with a friendly message naming the recipe', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Test Cookies', '12', FLOUR)
    await page.click('.bp-app-nav-btn:nth-child(3)')
    await page.waitForSelector('.bp-ingredient-row .bp-remove-btn')
    await page.click('.bp-ingredient-row .bp-remove-btn')
    await confirmDialog(page)
    await page.waitForSelector('.bp-error-banner')
    const message = await page.$eval('.bp-error-banner', el => el.textContent)
    assert.match(message!, /Can't delete/)
    assert.match(message!, /Test Cookies/)
    const stillThere = await page.$('.bp-ingredient-row')
    assert.ok(stillThere, 'a blocked delete must not remove the ingredient')
  } finally {
    await page.close()
  }
})

test('deleting a saved ingredient with no referencing recipes succeeds', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Test Cookies', '12', FLOUR)
    await page.click('.bp-ingredient-row .bp-remove-btn') // delete the recipe first
    await confirmDialog(page)
    await page.waitForSelector('.bp-empty-state')

    await page.click('.bp-app-nav-btn:nth-child(3)')
    await page.waitForSelector('.bp-ingredient-row .bp-remove-btn')
    await page.click('.bp-ingredient-row .bp-remove-btn')
    await confirmDialog(page)
    await page.waitForSelector('.bp-empty-state')
    const emptyText = await page.$eval('.bp-empty-state', el => el.textContent)
    assert.match(emptyText!, /No saved ingredients yet/)
  } finally {
    await page.close()
  }
})

// ─── 4. Navigating away from an unsaved draft ─────────────────────────────

test('navigating away from a dirty, unsaved new recipe prompts for confirmation before leaving', async () => {
  const page = await openFreshTool()
  try {
    await page.type('#bp-recipe-name', 'In Progress')
    await page.click('.bp-app-nav-btn:nth-child(2)')
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 })
    const dialogText = await page.$eval('[role="dialog"]', el => el.textContent)
    assert.match(dialogText!, /unsaved changes/i)
    await page.click('.tool-confirm-cancel')
    const stillOnCalculator = await page.$eval('.bp-app-nav-btn.is-active', el => el.textContent)
    assert.match(stillOnCalculator!, /Calculator/)
  } finally {
    await page.close()
  }
})

test('navigating away from a still-blank new recipe does not prompt', async () => {
  const page = await openFreshTool()
  try {
    await page.click('.bp-app-nav-btn:nth-child(3)')
    await page.waitForSelector('.bp-empty-state', { timeout: 3000 })
    const dialog = await page.$('[role="dialog"]')
    assert.equal(dialog, null)
  } finally {
    await page.close()
  }
})

// ─── 5. Backup & Restore (export/import UI) ───────────────────────────────

test('Backup & Restore: downloading does not throw, and restoring previews record counts before confirming', async () => {
  const page = await openFreshTool()
  const errors: string[] = []
  page.on('pageerror', err => errors.push(String(err)))
  let workDir: string | undefined
  try {
    await priceAndSaveRecipe(page, 'Test Cookies', '12', FLOUR)
    await page.waitForSelector('.bp-backup-restore')

    await page.click('.bp-backup-restore .bp-btn-secondary')
    await page.waitForSelector('.bp-backup-restore [role="status"]')
    assert.deepEqual(errors, [])

    workDir = await mkdtemp(path.join(tmpdir(), 'bp-export-'))
    const exportFile = {
      app: 'bakery-pricing-planner',
      exportFormatVersion: 1,
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: { ingredients: [], recipes: [], recipeIngredientUsages: [] },
    }
    const filePath = path.join(workDir, 'backup.json')
    await writeFile(filePath, JSON.stringify(exportFile))

    const fileInput = await page.$('.bp-backup-restore input[type="file"]')
    await fileInput!.uploadFile(filePath)
    await page.waitForSelector('[role="dialog"]')
    const dialogText = await page.$eval('[role="dialog"]', el => el.textContent)
    assert.match(dialogText!, /0 recipe\(s\) and 0 ingredient\(s\)/)
    await page.click('.tool-confirm-cancel')

    // Cancelling must leave the existing saved recipe untouched.
    const stillThere = await page.$eval('.bp-saved-recipe-name', el => el.textContent)
    assert.equal(stillThere, 'Test Cookies')
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true })
    await page.close()
  }
})

test('an invalid backup file is rejected with a calm message, not a crash', async () => {
  const page = await openFreshTool()
  const errors: string[] = []
  page.on('pageerror', err => errors.push(String(err)))
  let workDir: string | undefined
  try {
    await page.click('.bp-app-nav-btn:nth-child(2)')
    await page.waitForSelector('.bp-backup-restore')

    workDir = await mkdtemp(path.join(tmpdir(), 'bp-export-bad-'))
    const filePath = path.join(workDir, 'not-a-backup.json')
    await writeFile(filePath, JSON.stringify({ hello: 'world' }))

    const fileInput = await page.$('.bp-backup-restore input[type="file"]')
    await fileInput!.uploadFile(filePath)
    await page.waitForSelector('.bp-backup-restore .bp-error')
    const message = await page.$eval('.bp-backup-restore .bp-error', el => el.textContent)
    assert.ok(message && message.length > 0)
    assert.deepEqual(errors, [])
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true })
    await page.close()
  }
})

// ─── 9. M6 accessibility & visual-identity audit coverage ──────────────────
// The M4 saved-data screens and the post-M4 Backup & Restore section were
// functionally well-tested from the start, but — unlike the M3 UI suite —
// never got their own dedicated accessibility/responsive/personality
// checks. This section closes that gap, found during the M6 audit.

test('Saved Recipes, Ingredient Library, and Backup & Restore have no horizontal overflow at mobile widths, empty or populated', async () => {
  const page = await openFreshTool()
  try {
    await page.setViewport({ width: 320, height: 900 })

    await page.click('.bp-app-nav-btn:nth-child(2)')
    await page.waitForSelector('.bp-empty-state')
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    assert.equal(overflow, false, 'Saved Recipes (empty) overflows at 320px')

    await page.click('.bp-app-nav-btn:nth-child(3)')
    await page.waitForSelector('.bp-empty-state')
    overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    assert.equal(overflow, false, 'Ingredient Library (empty) overflows at 320px')

    await page.click('.bp-app-nav-btn:nth-child(1)')
    await page.waitForSelector('#bp-recipe-name')
    await priceAndSaveRecipe(page, 'Overflow Check', '12', FLOUR)
    overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    assert.equal(overflow, false, 'Saved Recipes (with data) overflows at 320px')

    await page.click('.bp-app-nav-btn:nth-child(3)')
    await page.waitForSelector('.bp-ingredient-row')
    overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    assert.equal(overflow, false, 'Ingredient Library (with data) overflows at 320px')
  } finally {
    await page.close()
  }
})

test('Saved Recipes, Ingredient Library, and Backup & Restore controls meet 44px touch targets at mobile width', async () => {
  const page = await openFreshTool()
  try {
    await page.setViewport({ width: 375, height: 900 })
    await priceAndSaveRecipe(page, 'Touch Target Check', '12', FLOUR)

    const navHeights = await page.$$eval('.bp-app-nav-btn', els => els.map(e => e.getBoundingClientRect().height))
    for (const h of navHeights) assert.ok(h >= 44, `nav tab height ${h} below 44px`)

    const rowActionHeights = await page.$$eval('.bp-saved-row button, .bp-saved-row a', els => els.map(e => e.getBoundingClientRect().height))
    for (const h of rowActionHeights) assert.ok(h >= 44, `saved-row action height ${h} below 44px`)

    const backupButtonHeights = await page.$$eval('.bp-backup-restore button', els => els.map(e => e.getBoundingClientRect().height))
    for (const h of backupButtonHeights) assert.ok(h >= 44, `Backup & Restore button height ${h} below 44px`)

    await page.click('.bp-app-nav-btn:nth-child(3)')
    await page.waitForSelector('.bp-ingredient-row .bp-link-btn')
    const libraryRowHeights = await page.$$eval('.bp-saved-row button', els => els.map(e => e.getBoundingClientRect().height))
    for (const h of libraryRowHeights) assert.ok(h >= 44, `Ingredient Library row action height ${h} below 44px`)

    await page.click('.bp-ingredient-row .bp-link-btn')
    await page.waitForSelector('.bp-saved-row-editing')
    const editFormHeights = await page.$$eval(
      '.bp-saved-row-editing input, .bp-saved-row-editing select, .bp-saved-row-editing button',
      els => els.map(e => e.getBoundingClientRect().height),
    )
    for (const h of editFormHeights) assert.ok(h >= 44, `Ingredient edit form control height ${h} below 44px`)
  } finally {
    await page.close()
  }
})

test('Every visible form control on Saved Recipes and Ingredient Library has an associated plain-language label', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Label Check', '12', FLOUR)
    const unlabeledSaved = await page.$$eval('.bp-step input:not([hidden]), .bp-step select', els =>
      els.filter(el => {
        const id = el.id
        return !(id && document.querySelector(`label[for="${id}"]`)) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')
      }).length,
    )
    assert.equal(unlabeledSaved, 0)

    await page.click('.bp-app-nav-btn:nth-child(3)')
    await page.waitForSelector('.bp-ingredient-row .bp-link-btn')
    await page.click('.bp-ingredient-row .bp-link-btn')
    await page.waitForSelector('.bp-saved-row-editing')
    const unlabeledLibrary = await page.$$eval('.bp-step input:not([hidden]), .bp-step select', els =>
      els.filter(el => {
        const id = el.id
        return !(id && document.querySelector(`label[for="${id}"]`)) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')
      }).length,
    )
    assert.equal(unlabeledLibrary, 0)
  } finally {
    await page.close()
  }
})

test('Backup & Restore and Test a Selling Price show their section icon, decorative and hidden from screen readers', async () => {
  const page = await openFreshTool()
  try {
    await priceAndSaveRecipe(page, 'Icon Check', '12', FLOUR)
    const backupIcon = await page.$('.bp-backup-restore h2 .bp-section-icon')
    assert.ok(backupIcon, 'Backup & Restore heading should carry a SectionIcon, matching every other major section')
    const backupIconHidden = await page.$eval('.bp-backup-restore h2 .bp-section-icon', el => el.getAttribute('aria-hidden'))
    assert.equal(backupIconHidden, 'true')

    await page.click('.bp-app-nav-btn:nth-child(1)')
    await page.waitForSelector('#bp-recipe-name')
    await addIngredient(page, FLOUR)
    await setInputValue(page, '#bp-yield', '12')
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('#bp-labor-rate')
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('.bp-completeness-check')
    const sellingPriceIcon = await page.$('.bp-selling-price-test summary .bp-section-icon')
    assert.ok(sellingPriceIcon, '"Test a selling price" summary should carry a SectionIcon, matching "See how this was calculated"')
    const sellingPriceIconHidden = await page.$eval('.bp-selling-price-test summary .bp-section-icon', el => el.getAttribute('aria-hidden'))
    assert.equal(sellingPriceIconHidden, 'true')
  } finally {
    await page.close()
  }
})

test('localStorage holds only the documented last-hourly-rate preference after a save — nothing else, no tracking-shaped keys', async () => {
  const page = await openFreshTool()
  try {
    await page.type('#bp-recipe-name', 'Storage Check')
    await setInputValue(page, '#bp-yield', '12')
    await addIngredient(page, FLOUR)
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('#bp-labor-rate')
    await setInputValue(page, '#bp-labor-rate', '18')
    await page.click('.bp-nav .bp-btn-primary')
    await page.waitForSelector('.bp-save-row')
    await page.click('.bp-save-row .bp-btn-primary')
    await page.waitForFunction(
      () => document.querySelector('.bp-app-nav-btn.is-active')?.textContent?.includes('Saved Recipes'),
      { timeout: 5000 },
    )
    const keys = await page.evaluate(() => Object.keys(localStorage))
    assert.deepEqual(keys, ['bakery-pricing-planner:last-hourly-rate'])
    const sessionKeys = await page.evaluate(() => Object.keys(sessionStorage))
    assert.deepEqual(sessionKeys, [])
  } finally {
    await page.close()
  }
})
