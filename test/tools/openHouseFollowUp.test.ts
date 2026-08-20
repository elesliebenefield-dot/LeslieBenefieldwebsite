// Browser integration tests for the Open House Follow-Up Planner.
// Validates the 4-stage workflow: Event setup → Event outcomes → Follow-up plan → Results.
//
// Runs against the production build (dist/) via a lightweight static HTTP server.
// Run with: node --test test/tools/openHouseFollowUp.test.ts

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
  await page.goto(`${baseUrl}/tools-open-house-follow-up.html`, { waitUntil: 'load' })
  return page
}

async function fillStage1(page: Page, opts: { label?: string; date?: string } = {}) {
  const label = opts.label ?? '123 Maple St'
  const date  = opts.date  ?? '2026-07-15'
  await page.type('#oh-property-label', label)
  // Use nativeInputValueSetter so React picks up the controlled-input change
  await page.evaluate((d: string) => {
    const input = document.querySelector('#oh-date') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, d)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, date)
}

async function advanceToStage2(page: Page) {
  await fillStage1(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-section') !== null)
}

async function addVisitor(page: Page) {
  await page.click('.oh-add-visitor-btn')
  await page.waitForFunction(() => document.querySelectorAll('.oh-visitor-card').length > 0)
}

async function advanceToStage3(page: Page) {
  await advanceToStage2(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
}

async function selectFirstStarter(page: Page) {
  await page.click('.oh-starter-list input[type="checkbox"]')
  await page.waitForFunction(() => document.querySelectorAll('.oh-action-card').length > 0)
}

async function advanceToResults(page: Page) {
  await advanceToStage3(page)
  await selectFirstStarter(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)
}

// ── Page load ─────────────────────────────────────────────────────────────────

test('page title is Open House Follow-Up Planner', async () => {
  const page = await openTool()
  const title = await page.title()
  assert.equal(title, 'Open House Follow-Up Planner')
  await page.close()
})

test('h1 contains Open House Follow-Up Planner', async () => {
  const page = await openTool()
  const h1 = await page.$eval('.tool-title', el => el.textContent)
  assert.match(h1 || '', /Open House Follow-Up Planner/)
  await page.close()
})

// ── Stage 1: Event setup ──────────────────────────────────────────────────────

test('stage 1 progress label is Event setup', async () => {
  const page = await openTool()
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Event setup')
  await page.close()
})

test('stage 1 progress count is 1 of 4', async () => {
  const page = await openTool()
  const count = await page.$eval('.tool-progress-count', el => el.textContent)
  assert.match(count || '', /1 of 4/)
  await page.close()
})

test('stage 1 shows privacy notice', async () => {
  const page = await openTool()
  const notice = await page.$('.oh-privacy-notice')
  assert.ok(notice, 'privacy notice should be present')
  await page.close()
})

test('stage 1 privacy notice mentions session-only', async () => {
  const page = await openTool()
  const text = await page.$eval('.oh-privacy-notice', el => el.textContent)
  assert.match(text || '', /session-only/i)
  await page.close()
})

test('stage 1 property label field is present', async () => {
  const page = await openTool()
  const field = await page.$('#oh-property-label')
  assert.ok(field)
  await page.close()
})

test('stage 1 date field is present', async () => {
  const page = await openTool()
  const field = await page.$('#oh-date')
  assert.ok(field)
  await page.close()
})

test('stage 1 shows validation errors when Next clicked with empty required fields', async () => {
  const page = await openTool()
  await page.click('.listing-planner-btn--primary')
  const alert = await page.$('[role="alert"]')
  assert.ok(alert, 'validation error should appear')
  await page.close()
})

test('stage 1 shows property label error when label missing', async () => {
  const page = await openTool()
  await page.evaluate(() => {
    const input = document.querySelector('#oh-date') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, '2026-07-15')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.click('.listing-planner-btn--primary')
  const err = await page.$('#oh-property-label-error')
  assert.ok(err, 'property label error should appear')
  await page.close()
})

test('stage 1 shows date error when date missing', async () => {
  const page = await openTool()
  await page.type('#oh-property-label', '123 Maple St')
  await page.click('.listing-planner-btn--primary')
  const err = await page.$('#oh-date-error')
  assert.ok(err, 'date error should appear')
  await page.close()
})

test('stage 1 advances to stage 2 when required fields filled', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Event outcomes')
  await page.close()
})

test('stage 1 seller update radio buttons are present', async () => {
  const page = await openTool()
  const radios = await page.$$('input[name="oh-seller-update"]')
  assert.ok(radios.length >= 3)
  await page.close()
})

test('stage 1 optional fields are present', async () => {
  const page = await openTool()
  const startTime = await page.$('#oh-start-time')
  const endTime   = await page.$('#oh-end-time')
  const agent     = await page.$('#oh-hosting-agent')
  const notes     = await page.$('#oh-event-notes')
  assert.ok(startTime && endTime && agent && notes)
  await page.close()
})

// ── Stage 2: Event outcomes ───────────────────────────────────────────────────

test('stage 2 progress label is Event outcomes', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Event outcomes')
  await page.close()
})

test('stage 2 progress count is 2 of 4', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const count = await page.$eval('.tool-progress-count', el => el.textContent)
  assert.match(count || '', /2 of 4/)
  await page.close()
})

test('stage 2 attendance radios are present', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const radios = await page.$$('input[name="oh-attendance-outcome"]')
  assert.ok(radios.length >= 4)
  await page.close()
})

test('stage 2 feedback theme textarea is present', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const el = await page.$('#oh-feedback-themes')
  assert.ok(el)
  await page.close()
})

test('stage 2 shows privacy caution banner', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const banner = await page.$('.oh-privacy-caution-banner')
  assert.ok(banner, 'privacy caution banner should be present')
  await page.close()
})

test('stage 2 privacy caution banner mentions protected-class', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const text = await page.$eval('.oh-privacy-caution-banner', el => el.textContent)
  assert.match(text || '', /protected-class/i)
  await page.close()
})

test('stage 2 starts with zero visitor records', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const count = await page.evaluate(() => document.querySelectorAll('.oh-visitor-card').length)
  assert.equal(count, 0)
  await page.close()
})

test('stage 2 add visitor button creates a visitor card', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)
  const count = await page.evaluate(() => document.querySelectorAll('.oh-visitor-card').length)
  assert.equal(count, 1)
  await page.close()
})

test('stage 2 visitor card has data-visitor-id attribute', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)
  const id = await page.$eval('.oh-visitor-card', el => el.getAttribute('data-visitor-id'))
  assert.ok(id, 'data-visitor-id should be present')
  await page.close()
})

test('stage 2 visitor permission dropdown is present', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)
  const select = await page.$('.oh-visitor-card select[id^="oh-visitor-permission-"]')
  assert.ok(select)
  await page.close()
})

test('stage 2 selecting declined permission shows declined notice', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)
  await page.select('.oh-visitor-card select[id^="oh-visitor-permission-"]', 'declined')
  const notice = await page.$('.oh-declined-notice')
  assert.ok(notice, 'declined notice should appear')
  await page.close()
})

test('stage 2 selecting unknown permission shows neutral caution note', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)
  await page.select('.oh-visitor-card select[id^="oh-visitor-permission-"]', 'unknown')
  const note = await page.$('.oh-permission-note')
  assert.ok(note, 'permission note should appear for unknown')
  await page.close()
})

test('stage 2 unknown permission note mentions brokerage', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)
  await page.select('.oh-visitor-card select[id^="oh-visitor-permission-"]', 'unknown')
  const text = await page.$eval('.oh-permission-note', el => el.textContent)
  assert.match(text || '', /brokerage/i)
  await page.close()
})

test('stage 2 remove visitor button triggers confirm dialog', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)
  await page.click('.listing-task-card__remove-btn')
  const dialog = await page.$('.tool-confirm-dialog, [role="dialog"]')
  assert.ok(dialog, 'confirm dialog should appear')
  await page.close()
})

test('stage 2 cancelling removal keeps the record', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)
  await page.click('.listing-task-card__remove-btn')
  await page.waitForSelector('.tool-confirm-cancel')
  await page.click('.tool-confirm-cancel')
  const count = await page.evaluate(() => document.querySelectorAll('.oh-visitor-card').length)
  assert.equal(count, 1)
  await page.close()
})

test('stage 2 confirming removal removes the record', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)
  await page.click('.listing-task-card__remove-btn')
  await page.waitForSelector('.tool-confirm-proceed')
  await page.click('.tool-confirm-proceed')
  await page.waitForFunction(() => document.querySelectorAll('.oh-visitor-card').length === 0)
  const count = await page.evaluate(() => document.querySelectorAll('.oh-visitor-card').length)
  assert.equal(count, 0)
  await page.close()
})

test('stage 2 can add multiple visitor records', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)
  await addVisitor(page)
  await addVisitor(page)
  const count = await page.evaluate(() => document.querySelectorAll('.oh-visitor-card').length)
  assert.equal(count, 3)
  await page.close()
})

test('stage 2 add button shows max notice at 12 visitors', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  for (let i = 0; i < 12; i++) {
    await addVisitor(page)
  }
  const maxNotice = await page.$('.oh-max-notice')
  assert.ok(maxNotice, 'max notice should appear at 12')
  await page.close()
})

test('stage 2 no-visitor event can proceed without visitor records', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Follow-up plan')
  await page.close()
})

test('stage 2 back button returns to stage 1', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-planner-btn--secondary')
  await page.waitForFunction(() => document.querySelector('#oh-property-label') !== null)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Event setup')
  await page.close()
})

// ── Stage 3: Follow-up plan ───────────────────────────────────────────────────

test('stage 3 progress label is Follow-up plan', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Follow-up plan')
  await page.close()
})

test('stage 3 progress count is 3 of 4', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const count = await page.$eval('.tool-progress-count', el => el.textContent)
  assert.match(count || '', /3 of 4/)
  await page.close()
})

test('stage 3 shows starter action checkboxes', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const checkboxes = await page.$$('.oh-starter-list input[type="checkbox"]')
  assert.ok(checkboxes.length >= 5, 'should have at least 5 starter checkboxes')
  await page.close()
})

test('stage 3 checking a starter action creates an action card', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await selectFirstStarter(page)
  const cards = await page.evaluate(() => document.querySelectorAll('.oh-action-card').length)
  assert.equal(cards, 1)
  await page.close()
})

test('stage 3 action card has data-action-id attribute', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await selectFirstStarter(page)
  const id = await page.$eval('.oh-action-card', el => el.getAttribute('data-action-id'))
  assert.ok(id, 'data-action-id should be present')
  await page.close()
})

test('stage 3 unchecking a starter action removes the action card', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await selectFirstStarter(page)
  await page.click('.oh-starter-list input[type="checkbox"]')
  await page.waitForFunction(() => document.querySelectorAll('.oh-action-card').length === 0)
  const count = await page.evaluate(() => document.querySelectorAll('.oh-action-card').length)
  assert.equal(count, 0)
  await page.close()
})

test('stage 3 action card Edit details button expands fields', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await selectFirstStarter(page)
  await page.click('.listing-task-card__edit-btn')
  const body = await page.$('.oh-action-card-body')
  assert.ok(body)
  await page.close()
})

test('stage 3 action card timing selector is present when expanded', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await selectFirstStarter(page)
  await page.click('.listing-task-card__edit-btn')
  await page.waitForSelector('.oh-action-card-body select[id^="oh-action-timing-"]')
  const select = await page.$('.oh-action-card-body select[id^="oh-action-timing-"]')
  assert.ok(select)
  await page.close()
})

test('stage 3 action card status selector is present when expanded', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await selectFirstStarter(page)
  await page.click('.listing-task-card__edit-btn')
  await page.waitForSelector('select[id^="oh-action-status-"]')
  const select = await page.$('select[id^="oh-action-status-"]')
  assert.ok(select)
  await page.close()
})

test('stage 3 broker input checkbox is present when expanded', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await selectFirstStarter(page)
  await page.click('.listing-task-card__edit-btn')
  await page.waitForSelector('.oh-action-card-body input[type="checkbox"]')
  const cb = await page.$('.oh-action-card-body input[type="checkbox"]')
  assert.ok(cb)
  await page.close()
})

test('stage 3 custom action input and add button are present', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const input = await page.$('.oh-custom-action-input')
  const btn   = await page.$('.oh-custom-action-add')
  assert.ok(input && btn)
  await page.close()
})

test('stage 3 adding a custom action creates an action card with remove button', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await page.type('.oh-custom-action-input', 'My custom task')
  await page.click('.oh-custom-action-add')
  await page.waitForFunction(() => document.querySelectorAll('.oh-action-card').length > 0)
  const removeBtn = await page.$('.listing-task-card__remove-btn')
  assert.ok(removeBtn, 'custom action should have remove button')
  await page.close()
})

test('stage 3 clicking Next with 0 actions shows validation error', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await page.click('.listing-planner-btn--primary')
  const alert = await page.$('[role="alert"]')
  assert.ok(alert, 'validation error should appear with no actions')
  await page.close()
})

test('stage 3 validation error mentions at least one action', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await page.click('.listing-planner-btn--primary')
  const text = await page.$eval('[role="alert"]', el => el.textContent)
  assert.match(text || '', /at least one/i)
  await page.close()
})

test('stage 3 back button returns to stage 2', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  // Stage 3 has two .listing-planner-btn--secondary buttons (Add custom action + Back).
  // Use the scoped stage-actions selector to target only the Back button.
  await page.click('.oh-stage-actions .listing-planner-btn--secondary')
  await page.waitForFunction(() => document.querySelector('.oh-add-visitor-btn') !== null)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Event outcomes')
  await page.close()
})

// ── Results ───────────────────────────────────────────────────────────────────

test('results view renders after completing all stages', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const results = await page.$('.oh-results')
  assert.ok(results)
  await page.close()
})

test('results shows event overview section', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const headings = await page.$$eval('.oh-result-section-heading', els => els.map(e => e.textContent))
  assert.ok(headings.some(h => /event overview/i.test(h || '')))
  await page.close()
})

test('results shows property label entered in stage 1', async () => {
  const page = await openTool()
  await fillStage1(page, { label: 'Magnolia House' })
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-section') !== null)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
  await selectFirstStarter(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)
  const text = await page.$eval('.oh-results', el => el.textContent)
  assert.match(text || '', /Magnolia House/)
  await page.close()
})

test('results shows follow-up plan section with action', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const headings = await page.$$eval('.oh-result-section-heading', els => els.map(e => e.textContent))
  assert.ok(headings.some(h => /follow-up plan/i.test(h || '')))
  await page.close()
})

test('results action items have data-action-result-id attribute', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const id = await page.$eval('.oh-result-action-item', el => el.getAttribute('data-action-result-id'))
  assert.ok(id, 'data-action-result-id should be present')
  await page.close()
})

test('results shows disclaimer about session-only workspace', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const text = await page.$eval('.oh-results-disclaimer', el => el.textContent)
  assert.match(text || '', /session-only/i)
  await page.close()
})

test('results copy button is present', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const btn = await page.$$eval('.oh-results-actions button', btns =>
    btns.map(b => b.textContent).some(t => /copy/i.test(t || ''))
  )
  assert.ok(btn, 'copy button should be present')
  await page.close()
})

test('results copy button writes text to clipboard', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const copyBtn = await page.$$eval('.oh-results-actions button', btns =>
    btns.find(b => /copy/i.test(b.textContent || ''))?.textContent
  )
  assert.ok(copyBtn)
  await page.$eval('.oh-results-actions button', (btn: Element) => {
    if (/copy/i.test(btn.textContent || '')) (btn as HTMLButtonElement).click()
  })
  await new Promise(r => setTimeout(r, 300))
  const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied)
  assert.ok(copied, 'clipboard should have content')
  await page.close()
})

test('results copied text includes property label', async () => {
  const page = await openTool()
  await fillStage1(page, { label: 'Elm Ave Property' })
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-section') !== null)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
  await selectFirstStarter(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)
  await page.$eval('.oh-results-actions button', (btn: Element) => {
    if (/copy/i.test(btn.textContent || '')) (btn as HTMLButtonElement).click()
  })
  await new Promise(r => setTimeout(r, 300))
  const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
  assert.match(copied || '', /Elm Ave Property/)
  await page.close()
})

test('results Start Over button resets to stage 1 after confirmation', async () => {
  const page = await openTool()
  await advanceToResults(page)
  // Start Over is secondary — find it by text and click
  await page.$eval('.oh-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.oh-results-actions')!.querySelectorAll('button'))
    const startOver = all.find(b => /start over/i.test(b.textContent || ''))
    startOver?.click()
  })
  await page.waitForSelector('.tool-confirm-proceed')
  await page.click('.tool-confirm-proceed')
  await page.waitForFunction(() => document.querySelector('#oh-property-label') !== null)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Event setup')
  await page.close()
})

test('results Review / Edit button returns to stage 3', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.$eval('.oh-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.oh-results-actions')!.querySelectorAll('button'))
    const reviewEdit = all.find(b => /review.*edit/i.test(b.textContent || ''))
    reviewEdit?.click()
  })
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Follow-up plan')
  await page.close()
})

// ── Scenario A: Busy event with multiple visitors ─────────────────────────────

test('Scenario A: busy event — property label persists through all stages', async () => {
  const page = await openTool()
  await fillStage1(page, { label: 'Oak Lane Property' })
  await page.$eval('#oh-hosting-agent', (el: Element) => {
    (el as HTMLInputElement).value = 'Alex Chen'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.click('input[name="oh-seller-update"][value="yes"]')
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-section') !== null)

  // Stage 2: add 3 visitors
  await page.click('input[name="oh-attendance-outcome"][value="busy"]')
  await addVisitor(page)
  await addVisitor(page)
  await addVisitor(page)

  // Set permissions
  const permSelects = await page.$$('.oh-visitor-card select[id^="oh-visitor-permission-"]')
  await permSelects[0].select('confirmed')
  await permSelects[1].select('unknown')
  await permSelects[2].select('declined')

  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)

  // Stage 3: select 2 actions
  const checkboxes = await page.$$('.oh-starter-list input[type="checkbox"]')
  await checkboxes[0].click()
  await checkboxes[1].click()
  await page.waitForFunction(() => document.querySelectorAll('.oh-action-card').length >= 2)

  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)

  // Check results
  const text = await page.$eval('.oh-results', el => el.textContent)
  assert.match(text || '', /Oak Lane Property/)
  await page.close()
})

test('Scenario A: busy event — declined visitor does not appear in results visitor list', async () => {
  const page = await openTool()
  await advanceToStage2(page)

  await addVisitor(page)
  await addVisitor(page)

  const permSelects = await page.$$('.oh-visitor-card select[id^="oh-visitor-permission-"]')
  await permSelects[0].select('confirmed')
  await permSelects[1].select('declined')

  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
  await selectFirstStarter(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)

  // Eligible (confirmed) should appear; declined should NOT have a visitor result card
  const visitorResultCards = await page.evaluate(() =>
    document.querySelectorAll('[data-visitor-result-id]').length
  )
  // 1 declined + 1 confirmed = only 1 result card
  assert.equal(visitorResultCards, 1)
  await page.close()
})

test('Scenario A: busy event — declined record total is shown in results', async () => {
  const page = await openTool()
  await advanceToStage2(page)

  await addVisitor(page)
  await page.select('.oh-visitor-card select[id^="oh-visitor-permission-"]', 'declined')

  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
  await selectFirstStarter(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)

  const declinedBadge = await page.$('.oh-result-total-badge--declined')
  assert.ok(declinedBadge, 'declined badge should be visible in results')
  await page.close()
})

// ── Scenario B: No-visitor event ─────────────────────────────────────────────

test('Scenario B: no-visitor event — can complete full workflow without visitor records', async () => {
  const page = await openTool()
  await fillStage1(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-section') !== null)

  // Select no_visitors attendance
  await page.click('input[name="oh-attendance-outcome"][value="no_visitors"]')

  // Do NOT add any visitor records
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)

  // Add a wrap-up action
  await page.click('.oh-starter-list input[type="checkbox"]')
  await page.waitForFunction(() => document.querySelectorAll('.oh-action-card').length > 0)

  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)

  const results = await page.$('.oh-results')
  assert.ok(results, 'results view should load for no-visitor event')
  await page.close()
})

test('Scenario B: no-visitor event — selecting no_visitors shows notice in stage 2', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('input[name="oh-attendance-outcome"][value="no_visitors"]')
  const notice = await page.$('.oh-no-visitors-notice')
  assert.ok(notice, 'no-visitors notice should appear')
  await page.close()
})

// ── Scenario C: Record removal / privacy ─────────────────────────────────────

test('Scenario C: record removal — removed visitor does not appear in results', async () => {
  const page = await openTool()
  await advanceToStage2(page)

  await addVisitor(page)
  await addVisitor(page)
  // Label first visitor
  await page.type('.oh-visitor-card:first-child input[id^="oh-visitor-label-"]', 'Visitor Alpha')

  // Remove first visitor via confirm dialog
  await page.$eval('.oh-visitor-card', (card: Element) => {
    const btn = card.querySelector('.listing-task-card__remove-btn') as HTMLButtonElement
    btn?.click()
  })
  await page.waitForSelector('.tool-confirm-proceed')
  await page.click('.tool-confirm-proceed')
  await page.waitForFunction(() => document.querySelectorAll('.oh-visitor-card').length === 1)

  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
  await selectFirstStarter(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)

  // Only one visitor result card should remain (the second one)
  const count = await page.evaluate(() => document.querySelectorAll('[data-visitor-result-id]').length)
  assert.equal(count, 1)
  await page.close()
})

test('Scenario C: privacy — copied text does not include declined-visitor details', async () => {
  const page = await openTool()
  await advanceToStage2(page)

  await addVisitor(page)
  const labelInput = await page.$('input[id^="oh-visitor-label-"]')
  if (labelInput) await labelInput.type('DECLINED PERSON')
  await page.select('.oh-visitor-card select[id^="oh-visitor-permission-"]', 'declined')

  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
  await selectFirstStarter(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)

  await page.$eval('.oh-results-actions button', (btn: Element) => {
    if (/copy/i.test(btn.textContent || '')) (btn as HTMLButtonElement).click()
  })
  await new Promise(r => setTimeout(r, 300))
  const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
  // Declined person's name should not appear in the copied summary
  assert.ok(!copied?.includes('DECLINED PERSON'), 'declined visitor label should not appear in copied text')
  await page.close()
})

test('Scenario C: privacy — stage 2 collapse button hides visitor fields', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await addVisitor(page)

  // Visitor card is expanded by default; collapse it
  await page.click('.oh-visitor-card .listing-task-card__edit-btn')
  await page.waitForFunction(() => {
    const body = document.querySelector('.oh-visitor-card-body')
    return !body || (body as HTMLElement).style.display === 'none' || !document.querySelector('.oh-visitor-card-body')
  })
  const body = await page.$('.oh-visitor-card-body')
  assert.ok(!body, 'visitor fields should not be visible after collapse')
  await page.close()
})

// ── Responsive: progress bar visibility across all stages ─────────────────────

test('progress bar is visible in stages 1–3 and absent in results', async () => {
  const page = await browser.newPage()
  await page.setViewport({ width: 375, height: 812 })
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.resolve() }, writable: true, configurable: true,
    })
  })
  await page.goto(`${baseUrl}/tools-open-house-follow-up.html`, { waitUntil: 'load' })

  let bar = await page.$('.tool-progress')
  assert.ok(bar, 'progress bar visible in stage 1')

  await fillStage1(page)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-section') !== null)
  bar = await page.$('.tool-progress')
  assert.ok(bar, 'progress bar visible in stage 2')

  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
  bar = await page.$('.tool-progress')
  assert.ok(bar, 'progress bar visible in stage 3')

  await page.click('.oh-starter-list input[type="checkbox"]')
  await page.waitForFunction(() => document.querySelectorAll('.oh-action-card').length > 0)
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)
  bar = await page.$('.tool-progress')
  assert.ok(!bar, 'progress bar should be absent in results view')

  await page.close()
})

// ── Results action bar: focused layout and behavior tests ─────────────────────

test('results action bar: exactly one .oh-results-actions container', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const count = await page.evaluate(() => document.querySelectorAll('.oh-results-actions').length)
  assert.equal(count, 1, 'must be exactly one results action bar')
  await page.close()
})

test('results action bar: contains Copy Follow-Up Plan', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const found = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.oh-results-actions button'))
      .some(b => /copy follow-up plan/i.test(b.textContent || ''))
  )
  assert.ok(found, 'Copy Follow-Up Plan button must be in the action bar')
  await page.close()
})

test('results action bar: contains Print Follow-Up Plan', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const found = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.oh-results-actions button'))
      .some(b => /print follow-up plan/i.test(b.textContent || ''))
  )
  assert.ok(found, 'Print Follow-Up Plan button must be in the action bar')
  await page.close()
})

test('results action bar: contains Review / Edit inside the bar', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const found = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.oh-results-actions button'))
      .some(b => /review.*edit/i.test(b.textContent || ''))
  )
  assert.ok(found, 'Review / Edit must be inside .oh-results-actions')
  await page.close()
})

test('results action bar: contains Start Over inside the bar', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const found = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.oh-results-actions button'))
      .some(b => /start over/i.test(b.textContent || ''))
  )
  assert.ok(found, 'Start Over must be inside .oh-results-actions')
  await page.close()
})

test('results action bar: no separate Back to plan control outside the bar', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const outsideBar = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter(b => /back to plan/i.test(b.textContent || ''))
      .some(b => !b.closest('.oh-results-actions'))
  )
  assert.ok(!outsideBar, 'Back to plan must not exist outside the action bar')
  await page.close()
})

test('results Review / Edit preserves plan: action count survives round-trip', async () => {
  const page = await openTool()
  await advanceToResults(page)
  // Count action items in results
  const countBefore = await page.evaluate(() =>
    document.querySelectorAll('.oh-result-action-item').length
  )
  // Click Review / Edit
  await page.$eval('.oh-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.oh-results-actions')!.querySelectorAll('button'))
    all.find(b => /review.*edit/i.test(b.textContent || ''))?.click()
  })
  await page.waitForFunction(() => document.querySelector('.oh-starter-list') !== null)
  // Return to results
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.oh-results') !== null)
  const countAfter = await page.evaluate(() =>
    document.querySelectorAll('.oh-result-action-item').length
  )
  assert.equal(countAfter, countBefore, 'action count must be preserved after Review / Edit round-trip')
  await page.close()
})

test('results Start Over: shows confirmation dialog before resetting', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.$eval('.oh-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.oh-results-actions')!.querySelectorAll('button'))
    all.find(b => /start over/i.test(b.textContent || ''))?.click()
  })
  const dialog = await page.$('.tool-confirm-dialog, [role="dialog"]')
  assert.ok(dialog, 'Start Over must show confirmation dialog')
  await page.close()
})

test('results Start Over: cancel keeps results visible', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.$eval('.oh-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.oh-results-actions')!.querySelectorAll('button'))
    all.find(b => /start over/i.test(b.textContent || ''))?.click()
  })
  await page.waitForSelector('.tool-confirm-cancel')
  await page.click('.tool-confirm-cancel')
  const results = await page.$('.oh-results')
  assert.ok(results, 'results must remain visible after cancelling Start Over')
  await page.close()
})

test('results Start Over: confirm resets planner to stage 1', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.$eval('.oh-results-actions button', (btn: Element) => {
    const all = Array.from(btn.closest('.oh-results-actions')!.querySelectorAll('button'))
    all.find(b => /start over/i.test(b.textContent || ''))?.click()
  })
  await page.waitForSelector('.tool-confirm-proceed')
  await page.click('.tool-confirm-proceed')
  await page.waitForFunction(() => document.querySelector('#oh-property-label') !== null)
  const value = await page.$eval('#oh-property-label', el => (el as HTMLInputElement).value)
  assert.equal(value, '', 'property label must be cleared after Start Over')
  await page.close()
})

test('results DOM order: disclaimer before action bar, action bar before business CTA', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const order = await page.evaluate(() => {
    const disclaimer = document.querySelector('.oh-results-disclaimer')!
    const bar       = document.querySelector('.oh-results-actions')!
    const cta       = document.querySelector('.tool-footer')!
    const PRECEDING = Node.DOCUMENT_POSITION_PRECEDING
    return {
      disclaimerBeforeBar: !!(bar.compareDocumentPosition(disclaimer) & PRECEDING),
      barBeforeCta:        !!(cta.compareDocumentPosition(bar) & PRECEDING),
    }
  })
  assert.ok(order.disclaimerBeforeBar, 'disclaimer must precede the action bar in the DOM')
  assert.ok(order.barBeforeCta, 'action bar must precede the business CTA in the DOM')
  await page.close()
})

test('results print: action bar and CTA hidden; results and disclaimer visible', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.emulateMediaType('print')
  const checks = await page.evaluate(() => {
    const getDisplay = (sel: string) => {
      const el = document.querySelector(sel)
      return el ? getComputedStyle(el).display : 'missing'
    }
    return {
      actionBar:   getDisplay('.oh-results-actions'),
      cta:         getDisplay('.tool-footer'),
      resultSec:   getDisplay('.oh-result-section'),
      disclaimer:  getDisplay('.oh-results-disclaimer'),
    }
  })
  assert.equal(checks.actionBar,  'none',   'action bar must be hidden in print')
  assert.equal(checks.cta,        'none',   'business CTA must be hidden in print')
  assert.notEqual(checks.resultSec,  'none', 'result sections must be visible in print')
  assert.notEqual(checks.disclaimer, 'none', 'disclaimer must be visible in print')
  await page.close()
})
