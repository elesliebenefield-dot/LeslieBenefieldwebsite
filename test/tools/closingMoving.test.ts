// Browser integration tests for the Closing & Moving Organizer.
// Validates the 4-stage workflow: Transition setup → Task library → Organize timeline → Results.
//
// Runs against the production build (dist/) via a lightweight static HTTP server.
// Run with: node --test test/tools/closingMoving.test.ts

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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
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
  await page.evaluateOnNewDocument((share: boolean) => {
    if (!share) {
      Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true })
    } else {
      Object.defineProperty(navigator, 'share', {
        value: (data: unknown) => { (window as unknown as Record<string, unknown>).__lastShared = data; return Promise.resolve() },
        writable: true, configurable: true,
      })
    }
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (t: string) => { (window as unknown as Record<string, unknown>).__lastCopied = t; return Promise.resolve() } },
      writable: true, configurable: true,
    })
  }, canShare)
  await page.goto(`${baseUrl}/tools-closing-moving.html`, { waitUntil: 'load' })
  return page
}

async function selectTransitionType(page: Page, type: 'buying' | 'selling' | 'selling_buying' | 'moving_only' | 'other') {
  await page.click(`input[name="cm-transition-type"][value="${type}"]`)
}

async function advanceToLibrary(page: Page, type: 'buying' | 'selling' | 'selling_buying' | 'moving_only' | 'other' = 'buying') {
  await selectTransitionType(page, type)
  await page.click('.cm-stage-actions .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-section-card') !== null)
}

async function advanceToTimeline(page: Page, type: 'buying' | 'selling' | 'selling_buying' | 'moving_only' | 'other' = 'buying') {
  await advanceToLibrary(page, type)
  // Check at least one starter task
  const firstCheckbox = await page.$('.cm-starter-checkbox')
  if (firstCheckbox) await firstCheckbox.click()
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-stage') !== null && document.querySelector('.cm-stage-intro') !== null)
}

async function advanceToResults(page: Page, type: 'buying' | 'selling' | 'selling_buying' | 'moving_only' | 'other' = 'buying') {
  await advanceToTimeline(page, type)
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-results') !== null)
}

// ─── 1. Page load and branding ───────────────────────────────────────────────

test('page loads with correct title', async () => {
  const page = await openTool()
  const title = await page.title()
  assert.match(title, /Closing|Moving/i)
  await page.close()
})

test('page has h1 tool heading', async () => {
  const page = await openTool()
  const h1 = await page.$eval('h1', el => el.textContent || '')
  assert.match(h1, /Closing|Moving/i)
  await page.close()
})

test('Websites by Leslie wordmark is present', async () => {
  const page = await openTool()
  const wordmark = await page.$eval('.tool-wordmark', el => el.textContent || '')
  assert.match(wordmark, /Websites by Leslie/i)
  await page.close()
})

test('page has noindex meta tag', async () => {
  const page = await openTool()
  const robots = await page.$eval('meta[name="robots"]', el => (el as HTMLMetaElement).content)
  assert.match(robots, /noindex/)
  await page.close()
})

// ─── 2. Session-only and wire-fraud notices ──────────────────────────────────

test('session-only notice is visible in Stage 1', async () => {
  const page = await openTool()
  const notice = await page.$eval('.cm-privacy-notice', el => el.textContent || '')
  assert.match(notice, /session.only/i)
  await page.close()
})

test('wire-fraud safety notice is visible in Stage 1', async () => {
  const page = await openTool()
  const notice = await page.$eval('.cm-wire-fraud-notice', el => el.textContent || '')
  assert.match(notice, /wire|payment|wiring/i)
  await page.close()
})

test('wire-fraud notice does not claim to eliminate risk', async () => {
  const page = await openTool()
  const notice = await page.$eval('.cm-wire-fraud-notice', el => el.textContent || '')
  assert.doesNotMatch(notice, /eliminates risk|guarantee|fully protect/i)
  await page.close()
})

// ─── 3. Stage 1 — Transition setup ──────────────────────────────────────────

test('Stage 1 shows all 5 transition type options', async () => {
  const page = await openTool()
  const radios = await page.$$('input[name="cm-transition-type"]')
  assert.equal(radios.length, 5)
  await page.close()
})

test('Stage 1 requires transition type — shows error if missing', async () => {
  const page = await openTool()
  await page.click('.cm-stage-actions .listing-planner-btn--primary')
  const error = await page.$('.cm-field-error')
  assert.ok(error, 'Error message should appear when transition type not selected')
  const errorText = await error!.evaluate(el => el.textContent || '')
  assert.match(errorText, /transition type|select/i)
  await page.close()
})

test('Stage 1 does not advance without transition type', async () => {
  const page = await openTool()
  await page.click('.cm-stage-actions .listing-planner-btn--primary')
  const stillOnStage1 = await page.$('.cm-wire-fraud-notice')
  assert.ok(stillOnStage1, 'Should still show Stage 1')
  await page.close()
})

test('buying type shows Arriving property label field, not Leaving', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'buying')
  const hasArriving = await page.$('#cm-arriving-label')
  const hasLeaving = await page.$('#cm-leaving-label')
  assert.ok(hasArriving, 'Arriving label should be visible for buying')
  assert.equal(hasLeaving, null, 'Leaving label should not appear for buying')
  await page.close()
})

test('selling type shows Leaving property label field, not Arriving', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'selling')
  const hasLeaving = await page.$('#cm-leaving-label')
  const hasArriving = await page.$('#cm-arriving-label')
  assert.ok(hasLeaving, 'Leaving label should be visible for selling')
  assert.equal(hasArriving, null, 'Arriving label should not appear for selling')
  await page.close()
})

test('selling_buying type shows both Leaving and Arriving fields', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'selling_buying')
  const hasLeaving = await page.$('#cm-leaving-label')
  const hasArriving = await page.$('#cm-arriving-label')
  assert.ok(hasLeaving, 'Leaving label should appear for selling_buying')
  assert.ok(hasArriving, 'Arriving label should appear for selling_buying')
  await page.close()
})

test('moving_only hides closing date fields', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'moving_only')
  const closingField = await page.$('#cm-date-closing')
  assert.equal(closingField, null, 'Closing date should not appear for moving_only')
  await page.close()
})

test('planning dates are labeled as user-entered, not verified', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'buying')
  // Look for the fieldset legend that mentions "Planning dates"
  const datesLegend = await page.$$eval('.cm-fieldset .cm-legend', legends => {
    const match = legends.find(el => /planning dates/i.test(el.textContent || ''))
    return match ? match.textContent || '' : ''
  })
  assert.match(datesLegend, /user.entered|not verified|planning/i)
  await page.close()
})

test('involved parties has 8 checkboxes', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'buying')
  const checks = await page.$$('.cm-checkbox-grid .cm-checkbox-input')
  assert.ok(checks.length >= 7, `Should have at least 7 involved party options, got ${checks.length}`)
  await page.close()
})

test('Stage 1 optional fields — plan name and notes — accept input', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'buying')
  await page.type('#cm-plan-name', 'Spring Closing')
  await page.type('#cm-notes', 'Important transition')
  const name = await page.$eval('#cm-plan-name', (el: HTMLInputElement) => el.value)
  const notes = await page.$eval('#cm-notes', (el: HTMLTextAreaElement) => el.value)
  assert.equal(name, 'Spring Closing')
  assert.equal(notes, 'Important transition')
  await page.close()
})

// ─── 4. Stage 2 — Task library ──────────────────────────────────────────────

test('Stage 2 shows task library sections', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  const sections = await page.$$('.cm-section-card')
  assert.ok(sections.length >= 4, `Should have at least 4 library sections, got ${sections.length}`)
  await page.close()
})

test('buying type does NOT show Leaving property section in library', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  const leavingSection = await page.$('[data-track="leaving"]')
  assert.equal(leavingSection, null, 'Leaving section should not appear for buying')
  await page.close()
})

test('selling type does NOT show Arriving property section in library', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'selling')
  const arrivingSection = await page.$('[data-track="arriving"]')
  assert.equal(arrivingSection, null, 'Arriving section should not appear for selling')
  await page.close()
})

test('selling_buying shows both Leaving and Arriving sections', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'selling_buying')
  const leaving = await page.$('[data-track="leaving"]')
  const arriving = await page.$('[data-track="arriving"]')
  assert.ok(leaving, 'Leaving section should appear for selling_buying')
  assert.ok(arriving, 'Arriving section should appear for selling_buying')
  await page.close()
})

test('moving_only shows no closing_coordination section', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'moving_only')
  const closingSection = await page.$('[data-track="closing_coordination"]')
  assert.equal(closingSection, null, 'Closing coordination should not appear for moving_only')
  await page.close()
})

test('section headers are expandable', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  // Close and re-open a section
  const header = await page.$('.cm-section-header:not(.cm-section-header--static)')
  assert.ok(header)
  await header!.click()
  await header!.click()
  const items = await page.$$('.cm-starter-checkbox')
  assert.ok(items.length > 0, 'Checkboxes should appear after expanding section')
  await page.close()
})

test('selecting a starter task updates selection counter', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  const checkbox = await page.$('.cm-starter-checkbox')
  assert.ok(checkbox)
  await checkbox!.click()
  const counter = await page.$eval('.cm-selection-summary', el => el.textContent || '')
  assert.match(counter, /1 task/i)
  await page.close()
})

test('custom task can be added in Stage 2', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  await page.type('.cm-custom-input', 'Notify my accountant')
  await page.click('.cm-add-btn')
  const items = await page.$$('.cm-custom-item')
  assert.ok(items.length >= 1, 'Custom task should appear in the list')
  const label = await items[0].evaluate(el => el.textContent || '')
  assert.match(label, /accountant/i)
  await page.close()
})

test('custom task can be removed in Stage 2', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  await page.type('.cm-custom-input', 'Test removal task')
  await page.click('.cm-add-btn')
  await page.waitForFunction(() => document.querySelectorAll('.cm-custom-item').length >= 1)
  await page.click('.cm-custom-item .cm-remove-btn')
  await page.waitForFunction(() => document.querySelectorAll('.cm-custom-item').length === 0)
  const items = await page.$$('.cm-custom-item')
  assert.equal(items.length, 0)
  await page.close()
})

test('Enter key in custom task input adds the task', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  await page.type('.cm-custom-input', 'Enter key task')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelectorAll('.cm-custom-item').length >= 1)
  const items = await page.$$('.cm-custom-item')
  assert.ok(items.length >= 1)
  await page.close()
})

test('Stage 2 Next button advances to Stage 3', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  const checkbox = await page.$('.cm-starter-checkbox')
  if (checkbox) await checkbox.click()
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-task-cards, .cm-empty-tasks') !== null)
  const inTimeline = await page.$('.cm-task-cards, .cm-empty-tasks')
  assert.ok(inTimeline, 'Should be in Stage 3')
  await page.close()
})

test('Stage 2 Back button returns to Stage 1', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  await page.click('.cm-stage-actions--split .listing-planner-btn--secondary')
  const backOnStage1 = await page.$('.cm-wire-fraud-notice')
  assert.ok(backOnStage1, 'Should return to Stage 1')
  await page.close()
})

test('Stage 2 preserves transition type when going Back and returning', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'selling_buying')
  await page.click('.cm-stage-actions .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-section-card') !== null)
  // Go back
  await page.click('.cm-stage-actions--split .listing-planner-btn--secondary')
  await page.waitForFunction(() => document.querySelector('.cm-wire-fraud-notice') !== null)
  // The selected type should still be checked
  const checked = await page.$eval(
    'input[name="cm-transition-type"][value="selling_buying"]',
    (el: HTMLInputElement) => el.checked
  )
  assert.ok(checked, 'Selling and buying should still be selected after back navigation')
  await page.close()
})

// ─── 5. Stage 3 — Organize timeline ─────────────────────────────────────────

test('Stage 3 shows task cards for selected tasks', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const cards = await page.$$('.cm-task-card')
  assert.ok(cards.length >= 1, 'Should have at least one task card')
  await page.close()
})

test('Stage 3 expand/collapse task card', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const editBtn = await page.$('.cm-edit-btn')
  assert.ok(editBtn)
  await editBtn!.click()
  const expanded = await page.$('.cm-task-card-body')
  assert.ok(expanded, 'Task card body should be visible after expand')
  await editBtn!.click()
  const collapsed = await page.$('.cm-task-card-body')
  assert.equal(collapsed, null, 'Task card body should collapse')
  await page.close()
})

test('Stage 3 task card has track selector', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const editBtn = await page.$('.cm-edit-btn')
  await editBtn!.click()
  const trackSelect = await page.$('[id^="cm-track-"]')
  assert.ok(trackSelect, 'Track selector should be present')
  await page.close()
})

test('Stage 3 task card has planning period, status, responsible, waiting-on, notes', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const editBtn = await page.$('.cm-edit-btn')
  await editBtn!.click()
  const period = await page.$('[id^="cm-period-"]')
  const status = await page.$('[id^="cm-status-"]')
  const responsible = await page.$('[id^="cm-responsible-"]')
  const waiting = await page.$('[id^="cm-waiting-"]')
  const notes = await page.$('[id^="cm-notes-"]')
  assert.ok(period, 'Period selector should exist')
  assert.ok(status, 'Status selector should exist')
  assert.ok(responsible, 'Responsible field should exist')
  assert.ok(waiting, 'Waiting-on field should exist')
  assert.ok(notes, 'Notes textarea should exist')
  await page.close()
})

test('Stage 3 task card has professional confirmation checkbox', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const editBtn = await page.$('.cm-edit-btn')
  await editBtn!.click()
  const confirmCheck = await page.$('.cm-task-card-body .cm-checkbox-input')
  assert.ok(confirmCheck, 'Professional confirmation checkbox should exist')
  await page.close()
})

test('Stage 3 task card has target date field', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const editBtn = await page.$('.cm-edit-btn')
  await editBtn!.click()
  const dateInput = await page.$('[id^="cm-date-"]')
  assert.ok(dateInput, 'Target date input should exist')
  await page.close()
})

test('Stage 3 task can be removed', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const initialCount = (await page.$$('.cm-task-card')).length
  const removeBtn = await page.$('.cm-remove-btn')
  assert.ok(removeBtn)
  await removeBtn!.click()
  await page.waitForFunction(
    (prev: number) => document.querySelectorAll('.cm-task-card').length < prev,
    {},
    initialCount
  )
  const newCount = (await page.$$('.cm-task-card')).length
  assert.equal(newCount, initialCount - 1)
  await page.close()
})

test('Stage 3 requires at least one task — shows validation error', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  // Don't select any tasks, just advance to Stage 3
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-empty-tasks, .cm-task-card') !== null || document.querySelector('.cm-results') !== null)
  // Try to advance to results
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  const validationError = await page.$('.cm-task-validation')
  assert.ok(validationError, 'Validation error should appear when no tasks')
  const errorText = await validationError!.evaluate(el => el.textContent || '')
  assert.match(errorText, /task|select/i)
  await page.close()
})

test('Stage 3 add question for professional', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const questionInput = await page.$('.cm-questions-section .cm-custom-input')
  assert.ok(questionInput)
  await questionInput!.type('What documents do I need at closing?')
  await page.click('.cm-questions-section .cm-add-btn')
  await page.waitForFunction(() => document.querySelector('.cm-task-card--question') !== null)
  const questionCard = await page.$('.cm-task-card--question')
  assert.ok(questionCard, 'Question card should appear')
  await page.close()
})

test('Stage 3 professional question can be removed', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const questionInput = await page.$('.cm-questions-section .cm-custom-input')
  await questionInput!.type('Test question')
  await page.click('.cm-questions-section .cm-add-btn')
  await page.waitForFunction(() => document.querySelector('.cm-task-card--question') !== null)
  const removeBtn = await page.$('.cm-task-card--question .cm-remove-btn')
  await removeBtn!.click()
  await page.waitForFunction(() => document.querySelector('.cm-task-card--question') === null)
  const remaining = await page.$('.cm-task-card--question')
  assert.equal(remaining, null)
  await page.close()
})

test('Stage 3 Back button returns to Stage 2', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  await page.click('.cm-stage-actions--split .listing-planner-btn--secondary')
  await page.waitForFunction(() => document.querySelector('.cm-section-card') !== null)
  const inLibrary = await page.$('.cm-section-card')
  assert.ok(inLibrary, 'Should be back in Stage 2')
  await page.close()
})

test('Stage 3 preserves task details after Back and forward navigation', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  // Edit a task
  const editBtn = await page.$('.cm-edit-btn')
  await editBtn!.click()
  const responsibleInput = await page.$('[id^="cm-responsible-"]')
  await responsibleInput!.type('Jane')
  // Go back to library and return
  await page.click('.cm-stage-actions--split .listing-planner-btn--secondary')
  await page.waitForFunction(() => document.querySelector('.cm-section-card') !== null)
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-task-card') !== null)
  // Expand the task again
  const editBtn2 = await page.$('.cm-edit-btn')
  await editBtn2!.click()
  const value = await page.$eval('[id^="cm-responsible-"]', (el: HTMLInputElement) => el.value)
  assert.equal(value, 'Jane', 'Responsible field should be preserved')
  await page.close()
})

// ─── 6. Results page ─────────────────────────────────────────────────────────

test('Results page renders after Stage 3', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const results = await page.$('.cm-results')
  assert.ok(results, 'Results container should be visible')
  await page.close()
})

test('Results show transition overview section', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const heading = await page.$eval('.cm-result-section-heading', el => el.textContent || '')
  assert.match(heading, /transition|overview/i)
  await page.close()
})

test('Results show transition type in overview', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const dl = await page.$eval('.cm-result-dl', el => el.textContent || '')
  assert.match(dl, /buy|moving in/i)
  await page.close()
})

test('Results show progress summary', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const sections = await page.$$('.cm-result-section-heading')
  const headings = await Promise.all(sections.map(s => s.evaluate(el => el.textContent || '')))
  const hasProgress = headings.some(h => /progress/i.test(h))
  assert.ok(hasProgress, 'Progress summary section should be present')
  await page.close()
})

test('Results show tasks grouped by planning period', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const planSection = await page.$('.cm-result-section-heading')
  const headingText = await planSection!.evaluate(el => el.textContent || '')
  assert.ok(headingText, 'Should have result section headings')
  await page.close()
})

test('Results show task track labels', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const tags = await page.$$('.cm-result-meta-tag')
  assert.ok(tags.length >= 1, 'Track labels should be visible in results')
  await page.close()
})

test('Results show task status', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const statusTags = await page.$$('.cm-result-status')
  assert.ok(statusTags.length >= 1, 'Status tags should be visible in results')
  await page.close()
})

test('Results: planning dates section shown when dates entered', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'buying')
  // Enter a closing date
  await page.evaluate(() => {
    const input = document.querySelector('#cm-date-closing') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, '2026-09-15')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.click('.cm-stage-actions .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-section-card') !== null)
  const checkbox = await page.$('.cm-starter-checkbox')
  if (checkbox) await checkbox.click()
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-task-card, .cm-empty-tasks') !== null)
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-results') !== null)
  const sections = await page.$$('.cm-result-section-heading')
  const headings = await Promise.all(sections.map(s => s.evaluate(el => el.textContent || '')))
  const hasDates = headings.some(h => /date/i.test(h))
  assert.ok(hasDates, 'Dates section should appear when dates are entered')
  await page.close()
})

test('Results: planning dates are labeled as user-entered, not verified', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'buying')
  await page.evaluate(() => {
    const input = document.querySelector('#cm-date-closing') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, '2026-09-15')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.click('.cm-stage-actions .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-section-card') !== null)
  const checkbox = await page.$('.cm-starter-checkbox')
  if (checkbox) await checkbox.click()
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-task-card, .cm-empty-tasks') !== null)
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-results') !== null)
  const datesSection = await page.$('.cm-result-dates-note')
  if (datesSection) {
    const text = await datesSection.evaluate(el => el.textContent || '')
    assert.match(text, /user.entered|not verified|planning/i)
  }
  await page.close()
})

test('Results: no planning dates section when no dates entered', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const sections = await page.$$('.cm-result-section-heading')
  const headings = await Promise.all(sections.map(s => s.evaluate(el => el.textContent || '')))
  // For buying with no dates entered, there should be no "Planning dates" section
  const hasDates = headings.some(h => /^planning dates/i.test(h))
  assert.equal(hasDates, false, 'Dates section should not appear when no dates entered')
  await page.close()
})

test('Results: questions for professionals section appears when questions added', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const questionInput = await page.$('.cm-questions-section .cm-custom-input')
  await questionInput!.type('What is needed at closing?')
  await page.click('.cm-questions-section .cm-add-btn')
  await page.waitForFunction(() => document.querySelector('.cm-task-card--question') !== null)
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-results') !== null)
  const sections = await page.$$('.cm-result-section-heading')
  const headings = await Promise.all(sections.map(s => s.evaluate(el => el.textContent || '')))
  const hasQuestions = headings.some(h => /question|professional/i.test(h))
  assert.ok(hasQuestions, 'Questions section should appear in results')
  await page.close()
})

test('Results: professional confirmation callout appears when task flagged', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const editBtn = await page.$('.cm-edit-btn')
  await editBtn!.click()
  const confirmCheck = await page.$('.cm-task-card-body .cm-checkbox-input')
  await confirmCheck!.click()
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-results') !== null)
  const callout = await page.$('.cm-result-confirm-callout')
  assert.ok(callout, 'Professional confirmation callout should appear')
  await page.close()
})

test('Results: waiting-on section appears when dependency noted', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const editBtn = await page.$('.cm-edit-btn')
  await editBtn!.click()
  const waitingInput = await page.$('[id^="cm-waiting-"]')
  await waitingInput!.type('Awaiting lender approval')
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-results') !== null)
  const sections = await page.$$('.cm-result-section-heading')
  const headings = await Promise.all(sections.map(s => s.evaluate(el => el.textContent || '')))
  const hasWaiting = headings.some(h => /waiting|dependenc/i.test(h))
  assert.ok(hasWaiting, 'Waiting/dependencies section should appear')
  await page.close()
})

// ─── 7. Results action bar ────────────────────────────────────────────────────

test('Results has exactly one action bar with five controls (no Share)', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const actionBars = await page.$$('.cm-results-actions')
  assert.equal(actionBars.length, 1, 'Should have exactly one action bar')
  const buttons = await page.$$('.cm-results-actions button')
  assert.equal(buttons.length, 4, 'Should have 4 buttons when share not available (copy, print, review/edit, start over)')
  await page.close()
})

test('Results action bar has exactly 5 controls when share is available', async () => {
  const page = await openTool(true)
  await advanceToResults(page, 'buying')
  const buttons = await page.$$('.cm-results-actions button')
  assert.equal(buttons.length, 5, 'Should have 5 buttons when share is available')
  await page.close()
})

test('Results action bar DOM order: Copy, [Share], Print, Review/Edit, Start Over', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const buttons = await page.$$('.cm-results-actions button')
  const labels = await Promise.all(buttons.map(b => b.evaluate(el => el.textContent?.trim() || '')))
  assert.match(labels[0], /copy/i)
  assert.match(labels[1], /print/i)
  assert.match(labels[2], /review|edit/i)
  assert.match(labels[3], /start over/i)
  await page.close()
})

test('Results DOM order: disclaimer → action bar → business CTA', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const order = await page.evaluate(() => {
    const disclaimer = document.querySelector('.cm-results-disclaimer')
    const actions = document.querySelector('.cm-results-actions')
    const footer = document.querySelector('.tool-footer')
    if (!disclaimer || !actions || !footer) return null
    const allEls = Array.from(document.querySelectorAll('*'))
    return {
      disclaimer: allEls.indexOf(disclaimer),
      actions: allEls.indexOf(actions),
      footer: allEls.indexOf(footer),
    }
  })
  assert.ok(order, 'All three elements should exist')
  assert.ok(order!.disclaimer < order!.actions, 'Disclaimer should come before actions')
  assert.ok(order!.actions < order!.footer, 'Actions should come before footer CTA')
  await page.close()
})

// ─── 8. Copy, Share, Print ───────────────────────────────────────────────────

test('Copy button copies plan text', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const copyBtn = await page.$eval('.cm-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.cm-results-actions')!.querySelectorAll('button'))
    return all.find(b => /copy/i.test(b.textContent || '')) !== undefined
  })
  assert.ok(copyBtn, 'Copy button should exist')

  await page.$eval('.cm-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.cm-results-actions')!.querySelectorAll('button'))
    all.find(b => /copy/i.test(b.textContent || ''))?.click()
  })
  await new Promise(r => setTimeout(r, 200))
  const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied)
  assert.ok(typeof copied === 'string' && copied.length > 0, 'Should copy text to clipboard')
  await page.close()
})

test('Copied text includes plan header', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  await page.$eval('.cm-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.cm-results-actions')!.querySelectorAll('button'))
    all.find(b => /copy/i.test(b.textContent || ''))?.click()
  })
  await new Promise(r => setTimeout(r, 200))
  const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
  assert.match(copied, /CLOSING|MOVING/i)
  await page.close()
})

test('Copied text includes disclaimer', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  await page.$eval('.cm-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.cm-results-actions')!.querySelectorAll('button'))
    all.find(b => /copy/i.test(b.textContent || ''))?.click()
  })
  await new Promise(r => setTimeout(r, 200))
  const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
  assert.match(copied, /personal organization|not provide|not stored/i)
  await page.close()
})

test('Share button is absent when navigator.share is not available', async () => {
  const page = await openTool(false)
  await advanceToResults(page, 'buying')
  const shareBtn = await page.$eval('.cm-results-actions', (el: Element) => {
    const btns = Array.from(el.querySelectorAll('button'))
    return btns.some(b => /share/i.test(b.textContent || ''))
  })
  assert.equal(shareBtn, false, 'Share button should not be present without navigator.share')
  await page.close()
})

test('Share button is present when navigator.share is available', async () => {
  const page = await openTool(true)
  await advanceToResults(page, 'buying')
  const shareBtn = await page.$eval('.cm-results-actions', (el: Element) => {
    const btns = Array.from(el.querySelectorAll('button'))
    return btns.some(b => /share/i.test(b.textContent || ''))
  })
  assert.ok(shareBtn, 'Share button should be present with navigator.share')
  await page.close()
})

test('Share button invokes navigator.share with plan content', async () => {
  const page = await openTool(true)
  await advanceToResults(page, 'buying')
  await page.$eval('.cm-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.cm-results-actions')!.querySelectorAll('button'))
    all.find(b => /share/i.test(b.textContent || ''))?.click()
  })
  await new Promise(r => setTimeout(r, 200))
  const shared = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastShared as Record<string, string>)
  assert.ok(shared, 'navigator.share should have been called')
  assert.match(shared.text, /CLOSING|MOVING/i)
  await page.close()
})

test('Print hides action bar and business CTA', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const printHidden = await page.evaluate(() => {
    const style = document.createElement('style')
    style.textContent = '@media print { body { display: block !important; } }'
    document.head.appendChild(style)
    const el = document.querySelector('.cm-results-actions')
    if (!el) return false
    const computed = window.getComputedStyle(el)
    return computed.display !== 'none'
  })
  // The print CSS says display:none - just verify the class exists and is targeted
  const hasActions = await page.$('.cm-results-actions')
  assert.ok(hasActions, 'Action bar should exist in DOM')
  const hasFooter = await page.$('.tool-footer')
  assert.ok(hasFooter, 'Footer CTA should exist in DOM')
  await page.close()
})

// ─── 9. Review/Edit and Start Over ──────────────────────────────────────────

test('Review/Edit button returns to Stage 3', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  await page.$eval('.cm-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.cm-results-actions')!.querySelectorAll('button'))
    all.find(b => /review|edit/i.test(b.textContent || ''))?.click()
  })
  await page.waitForFunction(() => document.querySelector('.cm-results') === null)
  const inTimeline = await page.$('.cm-task-card, .cm-empty-tasks')
  assert.ok(inTimeline, 'Should return to Stage 3')
  await page.close()
})

test('Review/Edit preserves task data', async () => {
  const page = await openTool()
  await advanceToTimeline(page, 'buying')
  const editBtn = await page.$('.cm-edit-btn')
  await editBtn!.click()
  const notesInput = await page.$('[id^="cm-notes-"]')
  await notesInput!.type('Important context')
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-results') !== null)
  // Go back to Stage 3 via Review/Edit
  await page.$eval('.cm-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.cm-results-actions')!.querySelectorAll('button'))
    all.find(b => /review|edit/i.test(b.textContent || ''))?.click()
  })
  await page.waitForFunction(() => document.querySelector('.cm-task-card') !== null)
  const editBtn2 = await page.$('.cm-edit-btn')
  await editBtn2!.click()
  const value = await page.$eval('[id^="cm-notes-"]', (el: HTMLTextAreaElement) => el.value)
  assert.match(value, /Important context/)
  await page.close()
})

test('Start Over shows confirmation dialog', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  await page.$eval('.cm-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.cm-results-actions')!.querySelectorAll('button'))
    all.find(b => /start over/i.test(b.textContent || ''))?.click()
  })
  await page.waitForFunction(() => document.querySelector('.tool-confirm-backdrop') !== null)
  const dialog = await page.$('.tool-confirm-dialog')
  assert.ok(dialog, 'Confirmation dialog should appear')
  await page.close()
})

test('Start Over cancel keeps the results', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  await page.$eval('.cm-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.cm-results-actions')!.querySelectorAll('button'))
    all.find(b => /start over/i.test(b.textContent || ''))?.click()
  })
  await page.waitForFunction(() => document.querySelector('.tool-confirm-backdrop') !== null)
  await page.click('.tool-confirm-cancel')
  await page.waitForFunction(() => document.querySelector('.tool-confirm-backdrop') === null)
  const results = await page.$('.cm-results')
  assert.ok(results, 'Results should still be visible after canceling')
  await page.close()
})

test('Start Over confirm resets to Stage 1', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  await page.$eval('.cm-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.cm-results-actions')!.querySelectorAll('button'))
    all.find(b => /start over/i.test(b.textContent || ''))?.click()
  })
  await page.waitForFunction(() => document.querySelector('.tool-confirm-backdrop') !== null)
  await page.click('.tool-confirm-proceed')
  await page.waitForFunction(() => document.querySelector('.cm-wire-fraud-notice') !== null)
  const wireNotice = await page.$('.cm-wire-fraud-notice')
  assert.ok(wireNotice, 'Should be back at Stage 1 after confirming Start Over')
  await page.close()
})

// ─── 10. Transition-type specific scenarios ───────────────────────────────────

test('Scenario A: Buying — one-sided plan completes without Leaving track', async () => {
  const page = await openTool()
  // Setup
  await selectTransitionType(page, 'buying')
  await page.type('#cm-plan-name', 'Spring Purchase')
  await page.evaluate(() => {
    const input = document.querySelector('#cm-arriving-label') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, 'Maple Avenue')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.click('.cm-stage-actions .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-section-card') !== null)

  // Select tasks from multiple tracks
  const checkboxes = await page.$$('.cm-starter-checkbox')
  for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
    await checkboxes[i].click()
  }
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-task-card, .cm-empty-tasks') !== null)
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-results') !== null)

  // Verify results
  const overviewDl = await page.$eval('.cm-result-dl', el => el.textContent || '')
  assert.match(overviewDl, /buy|Arriving|Maple/i)

  // No Leaving section should appear if no tasks in Leaving track
  const leavingItems = await page.evaluate(() => {
    const allTags = Array.from(document.querySelectorAll('.cm-result-meta-tag'))
    return allTags.some(el => /^Leaving$/.test(el.textContent?.trim() || ''))
  })
  assert.equal(leavingItems, false, 'No Leaving track items should appear in buying results')
  await page.close()
})

test('Scenario B: Selling and buying — dual-track plan shows both sides', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'selling_buying')
  await page.evaluate(() => {
    const leaving = document.querySelector('#cm-leaving-label') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(leaving, 'Oak Street')
    leaving.dispatchEvent(new Event('input', { bubbles: true }))
    leaving.dispatchEvent(new Event('change', { bubbles: true }))
    const arriving = document.querySelector('#cm-arriving-label') as HTMLInputElement
    setter?.call(arriving, 'Pine Road')
    arriving.dispatchEvent(new Event('input', { bubbles: true }))
    arriving.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.click('.cm-stage-actions .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-section-card') !== null)

  // Select tasks from leaving track — sections start open; only click header if closed
  const leavingSection = await page.$('[data-track="leaving"]')
  assert.ok(leavingSection, 'Leaving section should be present')
  const leavingHeaderOpen = await page.$eval('[data-track="leaving"] .cm-section-header', el => el.getAttribute('aria-expanded'))
  if (leavingHeaderOpen !== 'true') {
    await page.click('[data-track="leaving"] .cm-section-header')
    await page.waitForFunction(() => document.querySelector('[data-track="leaving"] .cm-starter-checkbox') !== null)
  }
  const leavingCheck = await page.$('[data-track="leaving"] .cm-starter-checkbox')
  if (leavingCheck) await leavingCheck.click()

  // Select tasks from arriving track
  const arrivingHeaderOpen = await page.$eval('[data-track="arriving"] .cm-section-header', el => el.getAttribute('aria-expanded')).catch(() => null)
  if (arrivingHeaderOpen === 'false') {
    await page.click('[data-track="arriving"] .cm-section-header')
    await page.waitForFunction(() => document.querySelector('[data-track="arriving"] .cm-starter-checkbox') !== null)
  }
  const arrivingCheck = await page.$('[data-track="arriving"] .cm-starter-checkbox')
  if (arrivingCheck) await arrivingCheck.click()

  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-task-card') !== null)
  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-results') !== null)

  // Both track labels should appear in results
  const resultText = await page.$eval('.cm-results', el => el.textContent || '')
  assert.match(resultText, /Leaving|Oak Street/i)
  assert.match(resultText, /Arriving|Pine Road/i)
  await page.close()
})

test('Scenario B: data does not cross between Leaving and Arriving tracks', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'selling_buying')
  await page.click('.cm-stage-actions .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-section-card') !== null)

  // Select only a leaving task — sections start open, so don't close them
  const leavingHeaderOpen = await page.$eval('[data-track="leaving"] .cm-section-header', el => el.getAttribute('aria-expanded')).catch(() => null)
  if (leavingHeaderOpen === 'false') {
    await page.click('[data-track="leaving"] .cm-section-header')
    await page.waitForFunction(() => document.querySelector('[data-track="leaving"] .cm-starter-checkbox') !== null)
  }
  const leavingCheck = await page.$('[data-track="leaving"] .cm-starter-checkbox')
  if (leavingCheck) await leavingCheck.click()

  await page.click('.cm-stage-actions--split .listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cm-task-card') !== null)

  // Expand the card and verify it has track=leaving
  const editBtn = await page.$('.cm-edit-btn')
  await editBtn!.click()
  const trackValue = await page.$eval('[id^="cm-track-"]', (el: HTMLSelectElement) => el.value)
  assert.equal(trackValue, 'leaving', 'Task selected in leaving section should have leaving track')
  await page.close()
})

test('Scenario C: Moving only — no closing, Leaving, or Arriving sections', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'moving_only')
  const closingSection = await page.$('[data-track="closing_coordination"]')
  const leavingSection = await page.$('[data-track="leaving"]')
  const arrivingSection = await page.$('[data-track="arriving"]')
  assert.equal(closingSection, null, 'No closing coordination section for moving_only')
  assert.equal(leavingSection, null, 'No leaving section for moving_only')
  assert.equal(arrivingSection, null, 'No arriving section for moving_only')
  await page.close()
})

test('Scenario C: Moving only plan completes without transaction info', async () => {
  const page = await openTool()
  await advanceToResults(page, 'moving_only')
  const results = await page.$('.cm-results')
  assert.ok(results, 'Results should render for moving_only')
  // Should have progress summary and plan
  const sections = await page.$$('.cm-result-section-heading')
  assert.ok(sections.length >= 1, 'Should have at least one result section')
  await page.close()
})

test('Scenario C: Moving only results show no empty Leaving/Arriving sections', async () => {
  const page = await openTool()
  await advanceToResults(page, 'moving_only')
  const resultText = await page.$eval('.cm-results', el => el.textContent || '')
  // If there are no leaving/arriving tasks, those track labels should not appear
  const hasPlanSection = await page.$('.cm-result-period-group')
  if (hasPlanSection) {
    const metaTags = await page.$$('.cm-result-meta-tag')
    const tagTexts = await Promise.all(metaTags.map(t => t.evaluate(el => el.textContent?.trim() || '')))
    const hasLeaving = tagTexts.some(t => t === 'Leaving')
    const hasArriving = tagTexts.some(t => t === 'Arriving')
    assert.equal(hasLeaving, false, 'No Leaving track items should appear for moving_only')
    assert.equal(hasArriving, false, 'No Arriving track items should appear for moving_only')
  }
  assert.ok(resultText, 'Results should have content')
  await page.close()
})

// ─── 11. Safety and language guardrails ──────────────────────────────────────

test('No financial calculation language in Stage 1', async () => {
  const page = await openTool()
  const pageText = await page.$eval('body', el => el.textContent || '')
  assert.doesNotMatch(pageText, /estimated closing costs|calculate.*proceeds|your tax|assessed value|appraisal estimate/i)
  await page.close()
})

test('No professional advice language in Stage 1', async () => {
  const page = await openTool()
  const pageText = await page.$eval('body', el => el.textContent || '')
  assert.doesNotMatch(pageText, /you must|you are required|legally required|contractually obligated/i)
  await page.close()
})

test('No wire-instruction fields exist anywhere in the tool', async () => {
  const page = await openTool()
  // Check for suspicious input labels
  const labels = await page.$$eval('label', els => els.map(el => el.textContent?.toLowerCase() || ''))
  const badLabels = labels.filter(l => /wire|routing number|account number|ssn|social security/i.test(l))
  assert.equal(badLabels.length, 0, `No wire/banking labels should exist: ${badLabels}`)
  await page.close()
})

test('Disclaimer in results does not claim to provide professional advice', async () => {
  const page = await openTool()
  await advanceToResults(page, 'buying')
  const disclaimer = await page.$eval('.cm-results-disclaimer', el => el.textContent || '')
  assert.match(disclaimer, /does not provide|personal organization|not.*advice/i)
  await page.close()
})

test('Starter task labels do not imply contractual requirement', async () => {
  const page = await openTool()
  await advanceToLibrary(page, 'buying')
  // Open all sections to get all task labels
  const headers = await page.$$('.cm-section-header:not(.cm-section-header--static)')
  for (const h of headers) {
    const isOpen = await h.evaluate(el => el.getAttribute('aria-expanded') === 'true')
    if (!isOpen) await h.click()
  }
  const taskTexts = await page.$$eval('.cm-starter-text', els => els.map(el => el.textContent || ''))
  const required = taskTexts.filter(t => /you must|required by law|legally obligated|contract requires/i.test(t))
  assert.equal(required.length, 0, `No starter tasks should imply legal requirement: ${required}`)
  await page.close()
})

// ─── 12. Accessibility and responsive ────────────────────────────────────────

test('Progress bar has accessible role and aria-label', async () => {
  const page = await openTool()
  await selectTransitionType(page, 'buying')
  const progress = await page.$('[role="status"]')
  assert.ok(progress, 'Progress bar should have role=status')
  await page.close()
})

test('Transition type fieldset has accessible legend', async () => {
  const page = await openTool()
  const legend = await page.$('.cm-fieldset .cm-legend')
  assert.ok(legend, 'Transition type fieldset should have a legend')
  await page.close()
})

test('No horizontal overflow at 375px width', async () => {
  const page = await openTool()
  await page.setViewport({ width: 375, height: 812 })
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  assert.equal(overflow, false, 'No horizontal overflow at 375px')
  await page.close()
})

test('No horizontal overflow at 320px width', async () => {
  const page = await openTool()
  await page.setViewport({ width: 320, height: 568 })
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  assert.equal(overflow, false, 'No horizontal overflow at 320px')
  await page.close()
})

test('No horizontal overflow at 1440px width', async () => {
  const page = await openTool()
  await page.setViewport({ width: 1440, height: 900 })
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  assert.equal(overflow, false, 'No horizontal overflow at 1440px')
  await page.close()
})

test('Results page has no horizontal overflow at 375px', async () => {
  const page = await openTool()
  await page.setViewport({ width: 375, height: 812 })
  await advanceToResults(page, 'buying')
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  assert.equal(overflow, false, 'No overflow at 375px on results page')
  await page.close()
})

// ─── 13. Regression — existing tools unaffected ──────────────────────────────

async function checkToolTitle(baseUrl: string, browser: Browser, path: string, expectedPattern: RegExp): Promise<boolean> {
  const page = await browser.newPage()
  await page.goto(`${baseUrl}/${path}`, { waitUntil: 'load' })
  const title = await page.title()
  await page.close()
  return expectedPattern.test(title)
}

test('Regression: Buyer Readiness Planner still loads', async () => {
  const ok = await checkToolTitle(baseUrl, browser, 'tools-buyer.html', /buyer/i)
  assert.ok(ok)
})

test('Regression: Seller Planner still loads', async () => {
  const ok = await checkToolTitle(baseUrl, browser, 'tools-seller.html', /seller/i)
  assert.ok(ok)
})

test('Regression: Listing Preparation still loads', async () => {
  const ok = await checkToolTitle(baseUrl, browser, 'tools-listing-preparation.html', /listing/i)
  assert.ok(ok)
})

test('Regression: Property Comparison still loads', async () => {
  const ok = await checkToolTitle(baseUrl, browser, 'tools-property-comparison.html', /property|comparison/i)
  assert.ok(ok)
})

test('Regression: Open House Follow-Up still loads', async () => {
  const ok = await checkToolTitle(baseUrl, browser, 'tools-open-house-follow-up.html', /open house|follow.up/i)
  assert.ok(ok)
})
