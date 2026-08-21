// Browser integration tests for the Home Tour & Property Comparison Planner.
// Tests the four-stage workflow: Set Tour Priorities → Add Properties →
// Record Observations → Review Comparison.
//
// Runs against the production build (dist/) via a lightweight static HTTP server.
// Run with: node --test test/tools/propertyComparison.test.ts

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
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
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

async function openTool(canShare = false): Promise<Page> {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument((shareEnabled: boolean) => {
    if (!shareEnabled) {
      Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true })
    } else {
      Object.defineProperty(navigator, 'share', {
        value: () => Promise.resolve(),
        writable: true, configurable: true,
      })
    }
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (t: string) => { (window as unknown as Record<string, unknown>).__lastCopied = t; return Promise.resolve() } },
      writable: true, configurable: true,
    })
  }, canShare)
  await page.goto(`${baseUrl}/tools-property-comparison.html`, { waitUntil: 'load' })
  return page
}

// Select a starter priority by label text
async function selectStarterPriority(page: Page, label: string) {
  const items = await page.$$('.cmp-starter-item')
  for (const item of items) {
    const text = await item.$eval('.cmp-starter-label', el => el.textContent?.trim())
    if (text === label) {
      await item.click()
      return
    }
  }
  throw new Error(`Starter priority not found: "${label}"`)
}

// Advance from stage 1 (one priority selected)
async function advanceToStage2(page: Page) {
  await selectStarterPriority(page, 'Layout and flow')
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-property-list') !== null)
}

// Fill nicknames into the two pre-seeded property cards.
// Card 0 starts expanded (shows "Collapse" button, nickname input is already visible).
// Card 1 starts collapsed (shows "Edit" button, nickname input is hidden).
async function fillMinimumProperties(page: Page) {
  // Card 0 is already expanded — nickname input is immediately accessible.
  await page.waitForSelector('[id^="nickname-"]')
  const inputs0 = await page.$$('[id^="nickname-"]')
  await inputs0[0].type('Home A')

  // Expand card 1 by clicking its "Edit" button.
  const editBtns = await page.$$('button.listing-task-card__edit-btn')
  // editBtns[0] = "Collapse" on the first card; editBtns[1] = "Edit" on the second card.
  await editBtns[1].click()
  await new Promise(r => setTimeout(r, 200))

  // Now two nickname inputs are visible. Find the blank one (Home B).
  const inputs = await page.$$('[id^="nickname-"]')
  for (const input of inputs) {
    const val = await input.evaluate((el: Element) => (el as HTMLInputElement).value)
    if (!val) {
      await input.type('Home B')
      return
    }
  }
}

async function advanceToStage3(page: Page) {
  await advanceToStage2(page)
  await fillMinimumProperties(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-property-tabs') !== null)
}

async function advanceToResults(page: Page) {
  await advanceToStage3(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-results-root') !== null)
}

// ── Page presence & header ────────────────────────────────────────────────────

test('tool page loads without errors', async () => {
  const page = await openTool()
  const title = await page.$eval('h1', el => el.textContent)
  assert.ok(title?.includes('Property Comparison'), `Expected "Property Comparison" in h1, got: ${title}`)
  await page.close()
})

test('page title tag includes "comparison"', async () => {
  const page = await openTool()
  const title = await page.title()
  assert.ok(title.toLowerCase().includes('comparison'), `Expected "comparison" in title, got: ${title}`)
  await page.close()
})

test('noindex meta is present', async () => {
  const page = await openTool()
  const robots = await page.$eval('meta[name="robots"]', el => el.getAttribute('content'))
  assert.ok(robots?.includes('noindex'))
  await page.close()
})

// ── Stage 1: Priorities ───────────────────────────────────────────────────────

test('stage 1 progress indicator shows step 1', async () => {
  const page = await openTool()
  const label = await page.$eval('[role="status"]', el => el.textContent)
  assert.ok(label?.includes('1'), `Expected "1" in progress indicator, got: ${label}`)
  await page.close()
})

test('stage 1 shows 14 starter priorities', async () => {
  const page = await openTool()
  const count = await page.$$eval('.cmp-starter-item', items => items.length)
  assert.equal(count, 14)
  await page.close()
})

test('stage 1 advance blocked when no priority selected', async () => {
  const page = await openTool()
  await page.click('.listing-planner-btn--primary')
  const alert = await page.$('[role="alert"]')
  assert.ok(alert, 'Error alert should appear when no priority selected')
  const text = await alert!.evaluate(el => el.textContent)
  assert.ok(text?.toLowerCase().includes('priorit'), `Expected priority error message, got: ${text}`)
  await page.close()
})

test('selecting a starter priority enables advance to stage 2', async () => {
  const page = await openTool()
  await selectStarterPriority(page, 'Natural light')
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-property-list') !== null)
  const list = await page.$('.cmp-property-list')
  assert.ok(list, 'Property list should be visible after advancing')
  await page.close()
})

test('selected starter appears in active priorities list', async () => {
  const page = await openTool()
  await selectStarterPriority(page, 'Storage')
  const items = await page.$$('.cmp-priority-item')
  assert.equal(items.length, 1)
  const text = await items[0].evaluate(el => el.textContent)
  assert.ok(text?.includes('Storage'))
  await page.close()
})

test('deselecting a starter removes it from the active list', async () => {
  const page = await openTool()
  await selectStarterPriority(page, 'Parking')
  let items = await page.$$('.cmp-priority-item')
  assert.equal(items.length, 1)
  await selectStarterPriority(page, 'Parking')
  items = await page.$$('.cmp-priority-item')
  assert.equal(items.length, 0)
  await page.close()
})

test('can add a custom priority', async () => {
  const page = await openTool()
  await page.type('.cmp-custom-input', 'Pool access')
  await page.click('.cmp-add-custom-btn')
  const items = await page.$$('.cmp-priority-item')
  assert.equal(items.length, 1)
  const text = await items[0].evaluate(el => el.textContent)
  assert.ok(text?.includes('Pool access'))
  await page.close()
})

test('custom priority shows Rename button', async () => {
  const page = await openTool()
  await page.type('.cmp-custom-input', 'Basement')
  await page.click('.cmp-add-custom-btn')
  const renameBtn = await page.$('.cmp-edit-btn')
  assert.ok(renameBtn, 'Rename button should appear for custom priority')
  await page.close()
})

test('Add button is disabled when at max 8 priorities', async () => {
  const page = await openTool()
  const starters = ['Layout and flow', 'Bedroom and bathroom needs', 'Overall condition', 'Natural light', 'Kitchen functionality', 'Storage', 'Parking', 'Outdoor space']
  for (const s of starters) {
    await selectStarterPriority(page, s)
  }
  const addBtn = await page.$('.cmp-add-custom-btn')
  const disabled = await addBtn!.evaluate((el: Element) => (el as HTMLButtonElement).disabled)
  assert.equal(disabled, true)
  await page.close()
})

test('starter checkboxes are disabled when at max 8 priorities', async () => {
  const page = await openTool()
  const starters = ['Layout and flow', 'Bedroom and bathroom needs', 'Overall condition', 'Natural light', 'Kitchen functionality', 'Storage', 'Parking', 'Outdoor space']
  for (const s of starters) {
    await selectStarterPriority(page, s)
  }
  const disabledItems = await page.$$('.cmp-starter-item--disabled')
  assert.ok(disabledItems.length > 0, 'Starter items should be disabled at max 8')
  await page.close()
})

test('Move Up button is disabled for first priority', async () => {
  const page = await openTool()
  await selectStarterPriority(page, 'Noise observed during the visit')
  const upBtn = await page.$('.cmp-move-btn')
  const disabled = await upBtn!.evaluate((el: Element) => (el as HTMLButtonElement).disabled)
  assert.equal(disabled, true)
  await page.close()
})

test('Move Down button is disabled for last priority', async () => {
  const page = await openTool()
  await selectStarterPriority(page, 'Pet-related needs')
  const buttons = await page.$$('.cmp-move-btn')
  const lastDown = buttons[1]
  const disabled = await lastDown.evaluate((el: Element) => (el as HTMLButtonElement).disabled)
  assert.equal(disabled, true)
  await page.close()
})

test('Move Up reorders two priorities', async () => {
  const page = await openTool()
  await selectStarterPriority(page, 'Layout and flow')
  await selectStarterPriority(page, 'Parking')
  // Items: [Layout and flow(0), Parking(1)].  Move Parking up: click up button for item at index 1.
  const btns = await page.$$('.cmp-move-btn')
  // Buttons: [↑ for item0, ↓ for item0, ↑ for item1, ↓ for item1]
  await btns[2].click()
  const labels = await page.$$eval('.cmp-priority-label', els => els.map(e => e.textContent?.trim()))
  assert.equal(labels[0], 'Parking')
  assert.equal(labels[1], 'Layout and flow')
  await page.close()
})

test('empty custom input shows validation error on Add', async () => {
  const page = await openTool()
  await page.click('.cmp-add-custom-btn')
  const error = await page.$('.tool-question-error')
  assert.ok(error, 'Should show error for empty custom input')
  await page.close()
})

test('pressing Enter in custom input adds the priority', async () => {
  const page = await openTool()
  await page.focus('.cmp-custom-input')
  await page.keyboard.type('Sunroom')
  await page.keyboard.press('Enter')
  const items = await page.$$('.cmp-priority-item')
  assert.equal(items.length, 1)
  await page.close()
})

test('priority count display updates as priorities are added', async () => {
  const page = await openTool()
  await selectStarterPriority(page, 'Natural light')
  const count = await page.$eval('.cmp-priority-count', el => el.textContent)
  assert.ok(count?.includes('1 of 8'), `Expected "1 of 8", got: ${count}`)
  await page.close()
})

// ── Stage 2: Properties ───────────────────────────────────────────────────────

test('stage 2 shows progress step 2', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const label = await page.$eval('[role="status"]', el => el.textContent)
  assert.ok(label?.includes('2'), `Expected "2" in progress indicator, got: ${label}`)
  await page.close()
})

test('stage 2 pre-seeds two property cards', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const cards = await page.$$('.cmp-property-card')
  assert.equal(cards.length, 2)
  await page.close()
})

test('stage 2 first card starts expanded with nickname input visible', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const input = await page.$('[id^="nickname-"]')
  assert.ok(input, 'First card nickname input should be visible immediately')
  await page.close()
})

test('stage 2 advance is blocked when fewer than 2 nicknames are filled', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-planner-btn--primary')
  const alert = await page.$('[role="alert"]')
  assert.ok(alert, 'Error alert should appear when nicknames are missing')
  await page.close()
})

test('stage 2 nickname error shown after failed advance attempt', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-planner-btn--primary')
  await new Promise(r => setTimeout(r, 200))
  // First card is expanded, should show nickname error
  const alerts = await page.$$('[role="alert"]')
  assert.ok(alerts.length > 0, 'Should show at least one role=alert')
  await page.close()
})

test('can add a third property', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.cmp-add-property-btn')
  const cards = await page.$$('.cmp-property-card')
  assert.equal(cards.length, 3)
  await page.close()
})

test('cannot add more than 4 properties', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.cmp-add-property-btn')
  await page.click('.cmp-add-property-btn')
  const addBtn = await page.$('.cmp-add-property-btn')
  assert.equal(addBtn, null, 'Add property button should be hidden at max 4')
  const limitNote = await page.$('.cmp-limit-note')
  assert.ok(limitNote, 'Limit note should appear at max 4')
  await page.close()
})

test('remove property button shows ConfirmDialog', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-task-card__remove-btn')
  await page.waitForSelector('[role="dialog"]')
  const dialog = await page.$('[role="dialog"]')
  assert.ok(dialog, 'ConfirmDialog should appear')
  await page.close()
})

test('cancel in ConfirmDialog keeps the property', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const initial = (await page.$$('.cmp-property-card')).length
  await page.click('.listing-task-card__remove-btn')
  await page.waitForSelector('[role="dialog"]')
  // Cancel button has class tool-confirm-cancel
  await page.click('.tool-confirm-cancel')
  await new Promise(r => setTimeout(r, 200))
  const final = (await page.$$('.cmp-property-card')).length
  assert.equal(final, initial, 'Property count should be unchanged after cancel')
  await page.close()
})

test('confirm in ConfirmDialog removes the property', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.cmp-add-property-btn')
  const initial = (await page.$$('.cmp-property-card')).length
  assert.equal(initial, 3)
  await page.click('.listing-task-card__remove-btn')
  await page.waitForSelector('[role="dialog"]')
  // Confirm button has class tool-confirm-proceed
  await page.click('.tool-confirm-proceed')
  await new Promise(r => setTimeout(r, 200))
  const final = (await page.$$('.cmp-property-card')).length
  assert.equal(final, 2, 'Property count should decrease by 1 after confirm')
  await page.close()
})

test('new property card auto-expands on add', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.cmp-add-property-btn')
  await new Promise(r => setTimeout(r, 200))
  const inputs = await page.$$('[id^="nickname-"]')
  assert.ok(inputs.length > 0, 'New card nickname input should be visible')
  await page.close()
})

test('property card shows nickname in collapsed state', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  // First card is already expanded — type into it
  await page.waitForSelector('[id^="nickname-"]')
  const input = await page.$('[id^="nickname-"]')
  await input!.type('Corner House')
  // Now collapse card 0 by clicking its button (which says "Collapse")
  const editBtns = await page.$$('button.listing-task-card__edit-btn')
  await editBtns[0].click()
  await new Promise(r => setTimeout(r, 200))
  const nicknameEl = await page.$('.cmp-property-nickname')
  const text = await nicknameEl!.evaluate(el => el.textContent)
  assert.ok(text?.includes('Corner House'), `Expected "Corner House" in nickname display, got: ${text}`)
  await page.close()
})

test('back button returns from stage 2 to stage 1', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-planner-btn--secondary')
  await new Promise(r => setTimeout(r, 200))
  const starters = await page.$('.cmp-starter-grid')
  assert.ok(starters, 'Back should return to priorities stage')
  await page.close()
})

test('priority selections are preserved when returning to stage 1', async () => {
  const page = await openTool()
  await selectStarterPriority(page, 'Storage')
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-property-list') !== null)
  await page.click('.listing-planner-btn--secondary')
  await new Promise(r => setTimeout(r, 200))
  const items = await page.$$('.cmp-priority-item')
  assert.equal(items.length, 1)
  const text = await items[0].evaluate(el => el.textContent)
  assert.ok(text?.includes('Storage'))
  await page.close()
})

// ── Stage 3: Observations ─────────────────────────────────────────────────────

test('stage 3 shows progress step 3', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const label = await page.$eval('[role="status"]', el => el.textContent)
  assert.ok(label?.includes('3'), `Expected "3" in progress indicator, got: ${label}`)
  await page.close()
})

test('stage 3 shows one tab per property', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const tabs = await page.$$('.cmp-property-tab')
  assert.equal(tabs.length, 2, 'Should have one tab per property')
  await page.close()
})

test('stage 3 first property tab is active by default', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const activeTab = await page.$('.cmp-property-tab--active')
  assert.ok(activeTab, 'One tab should be active')
  const text = await activeTab!.evaluate(el => el.textContent)
  assert.ok(text?.includes('Home A'), `Expected "Home A" to be active, got: ${text}`)
  await page.close()
})

test('clicking second property tab makes it active', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const tabs = await page.$$('.cmp-property-tab')
  await tabs[1].click()
  await new Promise(r => setTimeout(r, 100))
  const active = await page.$('.cmp-property-tab--active')
  const text = await active!.evaluate(el => el.textContent)
  assert.ok(text?.includes('Home B'), `Expected "Home B" to be active, got: ${text}`)
  await page.close()
})

test('one priority match select shown per priority selected', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const selects = await page.$$('.cmp-match-select')
  assert.equal(selects.length, 1, 'One match select per priority (1 selected)')
  await page.close()
})

test('match select has all 5 status options', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const options = await page.$$eval('.cmp-match-select option', opts => opts.map(o => o.textContent?.trim()))
  assert.ok(options.includes('Meets'))
  assert.ok(options.includes('Partly meets'))
  assert.ok(options.includes('Does not meet'))
  assert.ok(options.includes('Not sure'))
  assert.ok(options.includes('Not evaluated'))
  await page.close()
})

test('positives textarea is present in stage 3', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const el = await page.$('[id^="positives-"]')
  assert.ok(el, 'Positives textarea should be present')
  await page.close()
})

test('concerns textarea is present in stage 3', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const el = await page.$('[id^="concerns-"]')
  assert.ok(el, 'Concerns textarea should be present')
  await page.close()
})

test('at least 5 follow-up action checkboxes are present', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const checks = await page.$$('.cmp-followup-item input[type="checkbox"]')
  assert.ok(checks.length >= 5, `Expected ≥5 follow-up checkboxes, got: ${checks.length}`)
  await page.close()
})

test('can add a custom follow-up action', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await page.type('.cmp-custom-input', 'Drive by at night')
  await page.click('.cmp-add-custom-btn')
  const customItems = await page.$$('.cmp-custom-followup-item')
  assert.equal(customItems.length, 1)
  await page.close()
})

test('can remove a custom follow-up action', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await page.type('.cmp-custom-input', 'Check school boundaries')
  await page.click('.cmp-add-custom-btn')
  const removeBtn = await page.$('.cmp-custom-followup-item .cmp-remove-priority-btn')
  await removeBtn!.click()
  const items = await page.$$('.cmp-custom-followup-item')
  assert.equal(items.length, 0)
  await page.close()
})

test('back button returns from stage 3 to stage 2', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await page.click('.listing-planner-btn--secondary')
  await new Promise(r => setTimeout(r, 200))
  const list = await page.$('.cmp-property-list')
  assert.ok(list, 'Back should return to properties stage')
  await page.close()
})

// ── Stage 4: Results ──────────────────────────────────────────────────────────

test('results view renders', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const root = await page.$('.cmp-results-root')
  assert.ok(root, 'Results root should be present')
  await page.close()
})

test('results title includes "Comparison"', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const title = await page.$eval('.cmp-results-title', el => el.textContent)
  assert.ok(title?.toLowerCase().includes('comparison'), `Expected "comparison" in title, got: ${title}`)
  await page.close()
})

test('progress bar is hidden in results view', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const status = await page.$('[role="status"]')
  assert.equal(status, null, 'Progress bar should be hidden in results')
  await page.close()
})

test('priority comparison grid is visible', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const grid = await page.$('.cmp-comparison-grid')
  assert.ok(grid, 'Comparison grid should be present')
  await page.close()
})

test('comparison grid shows both property nicknames in headers', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const headers = await page.$$eval('.cmp-grid-prop-header', els => els.map(el => el.textContent?.trim()))
  const combined = headers.join(' ')
  assert.ok(combined.includes('Home A'), `Expected "Home A" in grid headers, got: ${combined}`)
  assert.ok(combined.includes('Home B'), `Expected "Home B" in grid headers, got: ${combined}`)
  await page.close()
})

test('comparison grid shows the selected priority as a row criterion', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const criteria = await page.$$eval('.cmp-grid-criterion', els => els.map(el => el.textContent?.trim()))
  assert.ok(criteria.some(c => c?.includes('Layout and flow')), `Expected "Layout and flow" in grid, got: ${criteria}`)
  await page.close()
})

test('match cells default to "Not evaluated" when observations are empty', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const cells = await page.$$eval('.cmp-grid-cell', els => els.map(el => el.textContent?.trim()))
  assert.ok(cells.every(c => c === 'Not evaluated'), `Expected all cells "Not evaluated", got: ${cells}`)
  await page.close()
})

test('disclaimer section is present in results', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const el = await page.$('.cmp-disclaimer-section')
  assert.ok(el, 'Disclaimer section should be present')
  await page.close()
})

test('disclaimer states the tool does not recommend or select a winner', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const text = await page.$eval('.cmp-disclaimer-section', el => el.textContent?.toLowerCase() ?? '')
  // The disclaimer should say "does not recommend" and "does not... winner" — confirming the tool makes no claims
  assert.ok(text.includes('does not recommend') || text.includes('not recommend'), 'Disclaimer should say the tool does not recommend')
  assert.ok(text.includes('winner'), 'Disclaimer should mention winner (in the context of "does not select a winner")')
  assert.ok(!text.includes('the winner is'), 'Disclaimer must not claim something IS a winner')
  assert.ok(!text.includes('best home'), 'Disclaimer must not claim a "best home"')
  await page.close()
})

test('results body contains no score or grade language', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const bodyText = await page.evaluate(() => document.body.textContent?.toLowerCase() ?? '')
  assert.ok(!bodyText.includes('score:'), 'No score labels in results')
  assert.ok(!bodyText.includes('overall score'), 'No "overall score" in results')
  assert.ok(!bodyText.includes('grade'), 'No grade language in results')
  assert.ok(!bodyText.includes('ranking'), 'No ranking language in results')
  await page.close()
})

test('CTA connect button is present', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const cta = await page.$('.cmp-cta-btn')
  assert.ok(cta, 'CTA button should be present')
  await page.close()
})

// ── Action bar placement regression tests ────────────────────────────────────

test('exactly one action bar exists in results', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const bars = await page.$$('.cmp-action-bar')
  assert.equal(bars.length, 1, `Expected exactly 1 action bar, found ${bars.length}`)
  await page.close()
})

test('action bar follows the disclaimer section in DOM order', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const order = await page.evaluate(() => {
    const disclaimer = document.querySelector('.cmp-disclaimer-section')
    const bar = document.querySelector('.cmp-action-bar')
    if (!disclaimer || !bar) return null
    const pos = disclaimer.compareDocumentPosition(bar)
    // DOCUMENT_POSITION_FOLLOWING = 4
    return !!(pos & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  assert.ok(order === true, 'Action bar must follow the disclaimer section in DOM order')
  await page.close()
})

test('action bar precedes the CTA section in DOM order', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const order = await page.evaluate(() => {
    const bar = document.querySelector('.cmp-action-bar')
    const cta = document.querySelector('.cmp-cta-section')
    if (!bar || !cta) return null
    const pos = bar.compareDocumentPosition(cta)
    return !!(pos & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  assert.ok(order === true, 'Action bar must precede the CTA section in DOM order')
  await page.close()
})

test('action bar contains Copy button', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const btns = await page.$$eval('.cmp-action-bar button', els => els.map(el => el.textContent?.trim().toLowerCase()))
  assert.ok(btns.some(t => t?.includes('copy')), 'Action bar must have a Copy button')
  await page.close()
})

test('action bar contains Print button', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const btns = await page.$$eval('.cmp-action-bar button', els => els.map(el => el.textContent?.trim().toLowerCase()))
  assert.ok(btns.some(t => t?.includes('print')), 'Action bar must have a Print button')
  await page.close()
})

test('action bar contains Edit responses button', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const btns = await page.$$eval('.cmp-action-bar button', els => els.map(el => el.textContent?.trim().toLowerCase()))
  assert.ok(btns.some(t => t?.includes('edit')), 'Action bar must have an Edit responses button')
  await page.close()
})

test('action bar contains Start over button', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const btns = await page.$$eval('.cmp-action-bar button', els => els.map(el => el.textContent?.trim().toLowerCase()))
  assert.ok(btns.some(t => t?.includes('start over')), 'Action bar must have a Start over button')
  await page.close()
})

test('action bar is not visible in print media (has print:hidden CSS)', async () => {
  const page = await openTool()
  await advanceToResults(page)
  // Verify the print CSS rule exists for .cmp-action-bar
  const hasPrintHide = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSMediaRule && rule.conditionText.includes('print')) {
            for (const inner of Array.from(rule.cssRules)) {
              const sr = inner as CSSStyleRule
              if (sr.selectorText?.includes('.cmp-action-bar') && sr.style?.display === 'none') {
                return true
              }
            }
          }
        }
      } catch { /* cross-origin */ }
    }
    return false
  })
  assert.ok(hasPrintHide, 'Action bar should have display:none in @media print')
  await page.close()
})

test('comparison grid is not hidden in print media', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const hiddenInPrint = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSMediaRule && rule.conditionText.includes('print')) {
            for (const inner of Array.from(rule.cssRules)) {
              const sr = inner as CSSStyleRule
              if (sr.selectorText?.includes('.cmp-comparison-grid') && sr.style?.display === 'none') {
                return true
              }
            }
          }
        }
      } catch { /* cross-origin */ }
    }
    return false
  })
  assert.equal(hiddenInPrint, false, 'Comparison grid must NOT be display:none in print')
  await page.close()
})

test('disclaimer section is not hidden in print media', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const hiddenInPrint = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSMediaRule && rule.conditionText.includes('print')) {
            for (const inner of Array.from(rule.cssRules)) {
              const sr = inner as CSSStyleRule
              if (sr.selectorText?.includes('.cmp-disclaimer-section') && sr.style?.display === 'none') {
                return true
              }
            }
          }
        }
      } catch { /* cross-origin */ }
    }
    return false
  })
  assert.equal(hiddenInPrint, false, 'Disclaimer section must NOT be display:none in print')
  await page.close()
})

// ── Copy / Share / Print ──────────────────────────────────────────────────────

test('Copy button writes plain text summary to clipboard', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.click('.cmp-action-bar button')
  await new Promise(r => setTimeout(r, 300))
  const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string | undefined)
  assert.ok(typeof copied === 'string' && copied.length > 0, 'Copy should populate __lastCopied')
  assert.ok(copied.toUpperCase().includes('HOME TOUR'), `Expected "HOME TOUR" in copied text, snippet: ${copied.slice(0, 100)}`)
  await page.close()
})

test('copied text includes both property nicknames', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.click('.cmp-action-bar button')
  await new Promise(r => setTimeout(r, 300))
  const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
  assert.ok(copied.includes('Home A'), 'Copied text should include "Home A"')
  assert.ok(copied.includes('Home B'), 'Copied text should include "Home B"')
  await page.close()
})

test('copied text includes disclaimer', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.click('.cmp-action-bar button')
  await new Promise(r => setTimeout(r, 300))
  const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
  assert.ok(copied.toLowerCase().includes('personal organization'), 'Copied text should include disclaimer')
  await page.close()
})

// ── Edit / Start Over ─────────────────────────────────────────────────────────

test('Edit responses button returns to observations stage', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.evaluate(() => (Array.from(document.querySelectorAll('.cmp-action-bar .tool-action-btn')).find(b => b.textContent?.trim() === 'Edit responses') as HTMLButtonElement)?.click())
  await new Promise(r => setTimeout(r, 200))
  const tabs = await page.$('.cmp-property-tabs')
  assert.ok(tabs, 'Edit should return to observations stage')
  await page.close()
})

test('Start over button shows inline confirmation', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.cmp-action-bar .tool-action-btn'))
      .find(b => b.textContent?.trim().toLowerCase() === 'start over') as HTMLButtonElement | undefined
    btn?.click()
  })
  await new Promise(r => setTimeout(r, 200))
  const confirm = await page.$('.cmp-start-over-confirm')
  assert.ok(confirm, 'Start over should show inline confirm')
  await page.close()
})

test('cancel Start over keeps results', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.cmp-action-bar .tool-action-btn'))
      .find(b => b.textContent?.trim().toLowerCase() === 'start over') as HTMLButtonElement | undefined
    btn?.click()
  })
  await new Promise(r => setTimeout(r, 200))
  const cancelBtn = await page.$('.cmp-start-over-confirm .tool-action-btn')
  await cancelBtn!.click()
  await new Promise(r => setTimeout(r, 200))
  const root = await page.$('.cmp-results-root')
  assert.ok(root, 'Results should still be visible after cancel')
  await page.close()
})

test('confirm Start over resets to stage 1', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.cmp-action-bar .tool-action-btn'))
      .find(b => b.textContent?.trim().toLowerCase() === 'start over') as HTMLButtonElement | undefined
    btn?.click()
  })
  await new Promise(r => setTimeout(r, 200))
  const yesBtn = await page.$('.cmp-start-over-confirm .cmp-action-btn--danger')
  await yesBtn!.click()
  await page.waitForFunction(() => document.querySelector('.cmp-starter-grid') !== null)
  const grid = await page.$('.cmp-starter-grid')
  assert.ok(grid, 'Start over should reset to stage 1')
  await page.close()
})

// ── Missing information section ───────────────────────────────────────────────

test('missing info section appears when priorities are not evaluated', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const missing = await page.$('.cmp-missing-list')
  assert.ok(missing, 'Missing info list should appear for unevaluated priorities')
  await page.close()
})

test('missing info has at least one item per property for unevaluated priorities', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const items = await page.$$('.cmp-missing-item')
  assert.ok(items.length >= 2, `Expected ≥2 missing items (one per property), got: ${items.length}`)
  await page.close()
})

test('evaluating all priorities removes the missing info section', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  // Evaluate property A
  await page.select('.cmp-match-select', 'meets')
  // Switch to property B
  const tabs = await page.$$('.cmp-property-tab')
  await tabs[1].click()
  await new Promise(r => setTimeout(r, 100))
  await page.select('.cmp-match-select', 'meets')
  // Advance to results
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-results-root') !== null)
  const missing = await page.$('.cmp-missing-list')
  assert.equal(missing, null, 'Missing info section should be hidden when all priorities evaluated')
  await page.close()
})

// ── Observations in results ───────────────────────────────────────────────────

test('positives entered in stage 3 appear in results', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await page.type('[id^="positives-"]', 'Beautiful hardwoods')
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-results-root') !== null)
  const text = await page.evaluate(() => document.body.textContent ?? '')
  assert.ok(text.includes('Beautiful hardwoods'), 'Positives should appear in results')
  await page.close()
})

test('concerns entered in stage 3 appear in results', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await page.type('[id^="concerns-"]', 'Roof looked aged')
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-results-root') !== null)
  const text = await page.evaluate(() => document.body.textContent ?? '')
  assert.ok(text.includes('Roof looked aged'), 'Concerns should appear in results')
  await page.close()
})

// ── Accessibility ─────────────────────────────────────────────────────────────

test('all buttons have accessible labels', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const buttons = await page.$$('button')
  for (const btn of buttons) {
    const label = await btn.evaluate(el => {
      const b = el as HTMLButtonElement
      return b.textContent?.trim() || b.getAttribute('aria-label') || ''
    })
    assert.ok(label.length > 0, `Button missing accessible label: ${await btn.evaluate(el => el.outerHTML)}`)
  }
  await page.close()
})

test('priority match selects each have an associated label', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const selects = await page.$$('.cmp-match-select')
  for (const sel of selects) {
    const id = await sel.evaluate(el => el.id)
    const label = await page.$(`label[for="${id}"]`)
    assert.ok(label, `Match select "${id}" should have an associated label`)
  }
  await page.close()
})

test('property tabs have role="tab"', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const tabs = await page.$$('[role="tab"]')
  assert.ok(tabs.length >= 2, 'Property tabs should have role="tab"')
  await page.close()
})

// ── Responsive: no horizontal overflow ───────────────────────────────────────

test('no horizontal overflow on stage 1 at 375px', async () => {
  const page = await openTool()
  await page.setViewport({ width: 375, height: 812 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert.equal(overflow, false, 'Stage 1 must not overflow at 375px')
  await page.close()
})

test('no horizontal overflow on stage 2 at 375px', async () => {
  const page = await openTool()
  await page.setViewport({ width: 375, height: 812 })
  await advanceToStage2(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert.equal(overflow, false, 'Stage 2 must not overflow at 375px')
  await page.close()
})

test('no horizontal overflow on results at 375px (2-property layout)', async () => {
  const page = await openTool()
  await page.setViewport({ width: 375, height: 812 })
  await advanceToResults(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert.equal(overflow, false, 'Results must not overflow at 375px')
  await page.close()
})

test('no horizontal overflow on results at 320px', async () => {
  const page = await openTool()
  await page.setViewport({ width: 320, height: 568 })
  await advanceToResults(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert.equal(overflow, false, 'Results must not overflow at 320px')
  await page.close()
})

test('no horizontal overflow on results at 768px', async () => {
  const page = await openTool()
  await page.setViewport({ width: 768, height: 1024 })
  await advanceToResults(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert.equal(overflow, false, 'Results must not overflow at 768px')
  await page.close()
})

test('no horizontal overflow on results at 1440px', async () => {
  const page = await openTool()
  await page.setViewport({ width: 1440, height: 900 })
  await advanceToResults(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert.equal(overflow, false, 'Results must not overflow at 1440px')
  await page.close()
})
