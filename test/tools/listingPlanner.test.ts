// Browser integration tests for the Listing Preparation Action Planner.
// Validates the three-stage action-planning workflow: Set Up the Plan,
// Build Your Action List, and Review Your Plan, plus the final action plan display.
//
// Runs against the production build (dist/) via a lightweight static HTTP server.
// Run with: node --test test/tools/listingPlanner.test.ts

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

async function openTool(share = false): Promise<Page> {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument((canShare: boolean) => {
    if (!canShare) {
      Object.defineProperty(navigator, 'share', { value: undefined, writable: true })
    }
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (t: string) => { (window as unknown as Record<string, unknown>).__lastCopied = t; return Promise.resolve() } },
      writable: true,
    })
  }, share)
  await page.goto(`${baseUrl}/tools-listing-preparation.html`, { waitUntil: 'load' })
  return page
}

async function selectOccupancy(page: Page, value = 'livingIn') {
  await page.click(`input[name="occupancy"][value="${value}"]`)
}

async function advanceToStage2(page: Page) {
  await selectOccupancy(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => document.querySelector('.listing-library') !== null)
}

async function selectFirstTask(page: Page) {
  await page.click('.listing-category__header')
  await page.waitForSelector('.listing-task-item__checkbox')
  await page.click('.listing-task-item__checkbox')
}

async function advanceToStage3(page: Page) {
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => document.querySelector('.listing-review-period') !== null || document.querySelector('.listing-my-plan__empty') !== null)
}

async function advanceToResults(page: Page) {
  await advanceToStage3(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => document.querySelector('.tool-results-title') !== null)
}

// ── Stage 1 ──────────────────────────────────────────────────────────────────

test('header text is Listing Preparation Action Planner', async () => {
  const page = await openTool()
  const title = await page.$eval('.tool-header-title', el => el.textContent)
  assert.equal(title, 'Listing Preparation Action Planner')
  await page.close()
})

test('stage 1 progress label is Set Up the Plan', async () => {
  const page = await openTool()
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Set Up the Plan')
  await page.close()
})

test('stage 1 progress count is 1 of 3', async () => {
  const page = await openTool()
  const count = await page.$eval('.tool-progress-count', el => el.textContent)
  assert.match(count || '', /1 of 3/)
  await page.close()
})

test('stage 1 has privacy note', async () => {
  const page = await openTool()
  const note = await page.$('.tool-privacy-note')
  assert.ok(note, 'privacy note should be present')
  await page.close()
})

test('stage 1 back button is disabled', async () => {
  const page = await openTool()
  const disabled = await page.$eval('.tool-nav-back', (el: Element) => (el as HTMLButtonElement).disabled)
  assert.equal(disabled, true)
  await page.close()
})

test('stage 1 shows error banner when occupancy not selected', async () => {
  const page = await openTool()
  await page.click('.tool-nav-next')
  const banner = await page.$('[role="alert"]')
  assert.ok(banner, 'error banner should appear when occupancy is missing')
  await page.close()
})

test('stage 1 advances after selecting occupancy', async () => {
  const page = await openTool()
  await selectOccupancy(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => document.querySelector('.listing-library') !== null)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Build Your Action List')
  await page.close()
})

test('stage 1 optional plan name can be entered', async () => {
  const page = await openTool()
  await page.type('#planName', 'Maple Street')
  const val = await page.$eval('#planName', (el: Element) => (el as HTMLInputElement).value)
  assert.equal(val, 'Maple Street')
  await page.close()
})

// ── Stage 2 ──────────────────────────────────────────────────────────────────

test('stage 2 progress label is Build Your Action List', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Build Your Action List')
  await page.close()
})

test('stage 2 progress count is 2 of 3', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const count = await page.$eval('.tool-progress-count', el => el.textContent)
  assert.match(count || '', /2 of 3/)
  await page.close()
})

test('stage 2 has 10 category sections', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const count = await page.evaluate(() => document.querySelectorAll('.listing-category').length)
  assert.equal(count, 10)
  await page.close()
})

test('categories are collapsed by default', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const visible = await page.evaluate(() => document.querySelectorAll('.listing-task-item__checkbox').length)
  assert.equal(visible, 0)
  await page.close()
})

test('clicking category header expands it and shows task items', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-category__header')
  await page.waitForSelector('.listing-task-item__checkbox')
  const count = await page.evaluate(() => document.querySelectorAll('.listing-task-item__checkbox').length)
  assert.ok(count > 0)
  await page.close()
})

test('clicking expanded header collapses it', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-category__header')
  await page.waitForSelector('.listing-task-item__checkbox')
  await page.click('.listing-category__header')
  const visible = await page.evaluate(() => document.querySelectorAll('.listing-task-item__checkbox').length)
  assert.equal(visible, 0)
  await page.close()
})

test('selecting a starter task adds it to My Action Plan', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  const cardCount = await page.evaluate(() => document.querySelectorAll('.listing-task-card').length)
  assert.equal(cardCount, 1)
  await page.close()
})

test('selected task count appears in category header', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  const countText = await page.$eval('.listing-category__count', el => el.textContent)
  assert.match(countText || '', /1 selected/)
  await page.close()
})

test('deselecting a starter task removes it from My Action Plan', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.listing-task-item__checkbox')
  const cardCount = await page.evaluate(() => document.querySelectorAll('.listing-task-card').length)
  assert.equal(cardCount, 0)
  await page.close()
})

test('trying to advance with 0 tasks shows error banner', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.tool-nav-next')
  const banner = await page.$('[role="alert"]')
  assert.ok(banner, 'error banner should appear when no tasks selected')
  await page.close()
})

test('task card edit button expands fields', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.listing-task-card__edit-btn')
  const fields = await page.$('.listing-task-card__fields')
  assert.ok(fields)
  await page.close()
})

test('status can be changed in expanded task card', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.listing-task-card__edit-btn')
  await page.waitForSelector('.listing-field-select')
  await page.select('.listing-field-select', 'inProgress')
  const badge = await page.$eval('.listing-status-badge', el => el.textContent)
  assert.match(badge || '', /In progress/)
  await page.close()
})

test('responsibility can be changed in expanded task card', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.listing-task-card__edit-btn')
  await page.waitForSelector('.listing-field-select')
  const selects = await page.$$('.listing-field-select')
  await selects[1].select('agent')
  const badge = await page.$eval('.listing-resp-badge', el => el.textContent)
  assert.match(badge || '', /Agent/)
  await page.close()
})

test('notes field is editable in expanded task card', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.listing-task-card__edit-btn')
  await page.waitForSelector('.listing-field-textarea')
  await page.type('.listing-field-textarea', 'My test note')
  const val = await page.$eval('.listing-field-textarea', (el: Element) => (el as HTMLTextAreaElement).value)
  assert.equal(val, 'My test note')
  await page.close()
})

test('needs agent input checkbox toggles agent badge', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.listing-task-card__edit-btn')
  await page.waitForSelector('.listing-agent-input-check')
  await page.click('.listing-agent-input-check')
  const badge = await page.$('.listing-agent-badge')
  assert.ok(badge)
  await page.close()
})

test('remove button removes task from plan', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.listing-task-card__remove-btn')
  const cardCount = await page.evaluate(() => document.querySelectorAll('.listing-task-card').length)
  assert.equal(cardCount, 0)
  await page.close()
})

test('Add custom task button shows form', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-add-custom-btn')
  const form = await page.$('.listing-custom-form')
  assert.ok(form)
  await page.close()
})

test('adding custom task without title shows error', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-add-custom-btn')
  await page.click('.listing-custom-form__add')
  const error = await page.$('[role="alert"]')
  assert.ok(error)
  await page.close()
})

test('custom task with title adds to My Action Plan', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-add-custom-btn')
  await page.type('.listing-custom-form input[type="text"]', 'My special task')
  await page.click('.listing-custom-form__add')
  const cardCount = await page.evaluate(() => document.querySelectorAll('.listing-task-card').length)
  assert.equal(cardCount, 1)
  const title = await page.$eval('.listing-task-card__title', el => el.textContent)
  assert.equal(title, 'My special task')
  await page.close()
})

// ── Stage 3 (Review) ──────────────────────────────────────────────────────────

test('stage 3 progress label is Review Your Plan', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Review Your Plan')
  await page.close()
})

test('stage 3 progress count is 3 of 3', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const count = await page.$eval('.tool-progress-count', el => el.textContent)
  assert.match(count || '', /3 of 3/)
  await page.close()
})

test('stage 3 next button reads See My Action Plan', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const label = await page.$eval('.tool-nav-next', el => el.textContent?.trim())
  assert.equal(label, 'See My Action Plan')
  await page.close()
})

test('stage 3 shows tasks grouped by planning period', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  const periods = await page.evaluate(() => document.querySelectorAll('.listing-review-period').length)
  assert.ok(periods >= 1)
  await page.close()
})

test('stage 3 flags tasks needing agent input', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.listing-task-card__edit-btn')
  await page.waitForSelector('.listing-agent-input-check')
  await page.click('.listing-agent-input-check')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.listing-review-period')
  const agentFlag = await page.$('.listing-flag--agent')
  assert.ok(agentFlag)
  await page.close()
})

test('stage 3 flags unassigned tasks', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-add-custom-btn')
  await page.type('.listing-custom-form input[type="text"]', 'Unassigned task')
  await page.click('.listing-custom-form__add')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.listing-review-period')
  const unassignedFlag = await page.$('.listing-flag--unassigned')
  assert.ok(unassignedFlag)
  await page.close()
})

test('back from stage 3 returns to stage 2 with tasks preserved', async () => {
  const page = await openTool()
  await advanceToStage3(page)
  await page.click('.tool-nav-back')
  await page.waitForFunction(() => document.querySelector('.listing-library') !== null)
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Build Your Action List')
  const cardCount = await page.evaluate(() => document.querySelectorAll('.listing-task-card').length)
  assert.equal(cardCount, 1)
  await page.close()
})

// ── Final Results ──────────────────────────────────────────────────────────────

test('results heading is Your Listing Preparation Action Plan', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const heading = await page.$eval('.tool-results-title', el => el.textContent)
  assert.equal(heading, 'Your Listing Preparation Action Plan')
  await page.close()
})

test('no progress bar on results page', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const progress = await page.$('.tool-progress')
  assert.equal(progress, null)
  await page.close()
})

test('plan name appears in results if entered', async () => {
  const page = await openTool()
  await page.type('#planName', 'Oak Street Home')
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.tool-nav-next')
  await page.waitForSelector('.listing-review-period')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.tool-results-title')
  const body = await page.evaluate(() => document.body.textContent)
  assert.ok(body?.includes('Oak Street Home'))
  await page.close()
})

test('photography date appears in results if entered', async () => {
  const page = await openTool()
  await page.evaluate(() => {
    const el = document.querySelector('#photographyDate') as HTMLInputElement
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeInputValueSetter?.call(el, '2026-10-15')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.tool-nav-next')
  await page.waitForSelector('.listing-review-period')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.tool-results-title')
  const body = await page.evaluate(() => document.body.textContent)
  assert.ok(body?.includes('Photography'))
  assert.ok(body?.includes('Oct 15, 2026'))
  await page.close()
})

test('no date section when no dates entered', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const datesSection = await page.$('.listing-plan-dates')
  assert.equal(datesSection, null)
  await page.close()
})

test('progress overview shows correct total count', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const body = await page.evaluate(() => document.querySelector('.listing-plan-progress')?.textContent)
  assert.ok(body?.includes('1'))
  assert.ok(body?.includes('Total'))
  await page.close()
})

test('tasks appear in final plan grouped by planning period', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const sections = await page.evaluate(() => document.querySelectorAll('.listing-plan-section').length)
  assert.ok(sections >= 1)
  await page.close()
})

test('task title appears in final plan', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const body = await page.evaluate(() => document.body.textContent)
  assert.ok(body?.includes('Remove excess belongings'))
  await page.close()
})

test('completed task has complete styling', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.listing-task-card__edit-btn')
  await page.waitForSelector('.listing-field-select')
  await page.select('.listing-field-select', 'complete')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.listing-review-period')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.tool-results-title')
  const hasCompleteClass = await page.evaluate(() =>
    document.querySelector('.listing-plan-task--complete') !== null
  )
  assert.ok(hasCompleteClass)
  const completeLabel = await page.$('.listing-plan-task__complete-label')
  assert.ok(completeLabel)
  await page.close()
})

test('tasks needing agent input are flagged in results section', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const headers = await page.$$('.listing-category__header')
  await headers[2].click() // Repairs and Maintenance (has defaultNeedsAgentInput tasks)
  await page.waitForSelector('.listing-task-item__checkbox')
  await page.click('.listing-task-item__checkbox')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.listing-review-period')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.tool-results-title')
  const agentSection = await page.$('.listing-plan-section--agent')
  assert.ok(agentSection)
  await page.close()
})

test('agent input badge in results summary reads "Agent input" not "Agent"', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  const headers = await page.$$('.listing-category__header')
  await headers[2].click() // Repairs and Maintenance has defaultNeedsAgentInput tasks
  await page.waitForSelector('.listing-task-item__checkbox')
  await page.click('.listing-task-item__checkbox')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.listing-review-period')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.tool-results-title')
  const badgeText = await page.$eval('.listing-plan-section--agent .listing-agent-badge', el => el.textContent?.trim())
  assert.equal(badgeText, 'Agent input')
  await page.close()
})

test('unassigned tasks appear in Needs Attention section', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  await page.click('.listing-add-custom-btn')
  await page.type('.listing-custom-form input[type="text"]', 'Custom unassigned task')
  await page.click('.listing-custom-form__add')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.listing-review-period')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.tool-results-title')
  const attentionSection = await page.$('.listing-plan-section--attention')
  assert.ok(attentionSection)
  await page.close()
})

test('blank notes do not appear in final plan', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const noteEls = await page.$$('.listing-plan-task__notes')
  assert.equal(noteEls.length, 0)
  await page.close()
})

test('plan notes section appears when setup notes entered', async () => {
  const page = await openTool()
  await page.type('#planNotes', 'Remember to coordinate with movers')
  await advanceToStage2(page)
  await selectFirstTask(page)
  await page.click('.tool-nav-next')
  await page.waitForSelector('.listing-review-period')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.tool-results-title')
  const notesSection = await page.$('.listing-plan-section--notes')
  assert.ok(notesSection)
  const body = await page.evaluate(() => document.body.textContent)
  assert.ok(body?.includes('Remember to coordinate with movers'))
  await page.close()
})

test('disclaimer is present in results', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const disclaimer = await page.$('.tool-disclaimer')
  assert.ok(disclaimer)
  const text = await page.$eval('.tool-disclaimer', el => el.textContent || '')
  assert.ok(/planning purposes only/i.test(text))
  await page.close()
})

test('disclaimer does not contain readiness grades or price advice', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const text = await page.$eval('.tool-disclaimer', el => el.textContent || '')
  assert.ok(!/readiness score|grade|listing price|home value prediction/i.test(text))
  await page.close()
})

test('exactly one action bar on results page', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const count = await page.evaluate(() => document.querySelectorAll('.result-actions').length)
  assert.equal(count, 1)
  await page.close()
})

test('action bar appears after disclaimer', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const [discPos, actionPos] = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'))
    return [
      all.indexOf(document.querySelector('.tool-disclaimer')!),
      all.indexOf(document.querySelector('.result-actions')!),
    ]
  })
  assert.ok(discPos < actionPos)
  await page.close()
})

test('action bar appears before CTA', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const [actionPos, ctaPos] = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'))
    return [
      all.indexOf(document.querySelector('.result-actions')!),
      all.indexOf(document.querySelector('.tool-sales-cta')!),
    ]
  })
  assert.ok(actionPos < ctaPos)
  await page.close()
})

test('action bar has no-print class', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const hasNoPrint = await page.evaluate(() =>
    document.querySelector('.result-actions')?.classList.contains('no-print')
  )
  assert.equal(hasNoPrint, true)
  await page.close()
})

test('CTA has no-print class', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const hasNoPrint = await page.evaluate(() =>
    document.querySelector('.tool-sales-cta')?.classList.contains('no-print')
  )
  assert.equal(hasNoPrint, true)
  await page.close()
})

test('Copy Action Plan produces non-empty text with plan header', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.click('.result-action-btn:first-child')
  await new Promise(r => setTimeout(r, 200))
  const copied = await page.evaluate(() => (window as unknown as Record<string, string>).__lastCopied || '')
  assert.ok(copied.length > 0)
  assert.ok(/LISTING PREPARATION ACTION PLAN/.test(copied))
  await page.close()
})

test('Copy Action Plan includes task content', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.click('.result-action-btn:first-child')
  await new Promise(r => setTimeout(r, 200))
  const copied = await page.evaluate(() => (window as unknown as Record<string, string>).__lastCopied || '')
  assert.ok(copied.includes('Remove excess belongings'))
  await page.close()
})

test('Copy Action Plan includes disclaimer', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.click('.result-action-btn:first-child')
  await new Promise(r => setTimeout(r, 200))
  const copied = await page.evaluate(() => (window as unknown as Record<string, string>).__lastCopied || '')
  assert.ok(/organizational and planning purposes only/i.test(copied))
  await page.close()
})

test('blank plan name absent from copy text', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.click('.result-action-btn:first-child')
  await new Promise(r => setTimeout(r, 200))
  const copied = await page.evaluate(() => (window as unknown as Record<string, string>).__lastCopied || '')
  assert.ok(!/^Plan: $/m.test(copied))
  await page.close()
})

test('Share button absent when navigator.share unavailable', async () => {
  const page = await openTool(false)
  await advanceToResults(page)
  const shareBtn = await page.$('.result-share-action')
  assert.equal(shareBtn, null)
  await page.close()
})

test('copy hint visible when navigator.share unavailable', async () => {
  const page = await openTool(false)
  await advanceToResults(page)
  const hint = await page.$('.result-share-hint')
  assert.ok(hint)
  await page.close()
})

test('copy status has role=status and aria-live=polite', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const [role, live] = await page.evaluate(() => {
    const el = document.querySelector('.result-copy-status')
    return [el?.getAttribute('role'), el?.getAttribute('aria-live')]
  })
  assert.equal(role, 'status')
  assert.equal(live, 'polite')
  await page.close()
})

test('error banner has role=alert', async () => {
  const page = await openTool()
  await page.click('.tool-nav-next')
  const role = await page.$eval('[role="alert"]', el => el.getAttribute('role'))
  assert.equal(role, 'alert')
  await page.close()
})

test('stage 2 with no tasks selected blocks advance and shows accessible error', async () => {
  const page = await openTool()
  await advanceToStage2(page)
  // Attempt to advance with zero tasks
  await page.click('.tool-nav-next')
  // Should still be on stage 2
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Build Your Action List')
  // Error banner must be present with role=alert
  const bannerRole = await page.$eval('[role="alert"]', el => el.getAttribute('role'))
  assert.equal(bannerRole, 'alert')
  // Message must contain the required text
  const bannerText = await page.$eval('[role="alert"]', el => el.textContent || '')
  assert.ok(bannerText.toLowerCase().includes('add at least one task'))
  await page.close()
})

test('Review/Edit Plan returns to review stage with tasks preserved', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.result-action-btn'))
    const btn = btns.find(b => b.textContent?.includes('Review'))
    ;(btn as HTMLButtonElement)?.click()
  })
  await new Promise(r => setTimeout(r, 300))
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Review Your Plan')
  const taskCount = await page.evaluate(() => document.querySelectorAll('.listing-task-card').length)
  assert.ok(taskCount >= 1)
  await page.close()
})

test('Start Over shows confirm dialog', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.click('.result-action-btn--ghost')
  await new Promise(r => setTimeout(r, 200))
  const dialog = await page.$('.tool-confirm-dialog')
  assert.ok(dialog)
  await page.close()
})

test('cancel Start Over keeps results page', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.click('.result-action-btn--ghost')
  await new Promise(r => setTimeout(r, 200))
  await page.click('.tool-confirm-cancel')
  await new Promise(r => setTimeout(r, 200))
  const title = await page.$('.tool-results-title')
  assert.ok(title)
  await page.close()
})

test('confirm Start Over resets to stage 1 and clears tasks', async () => {
  const page = await openTool()
  await advanceToResults(page)
  await page.click('.result-action-btn--ghost')
  await new Promise(r => setTimeout(r, 200))
  await page.click('.tool-confirm-proceed')
  await new Promise(r => setTimeout(r, 300))
  const label = await page.$eval('.tool-progress-label', el => el.textContent)
  assert.equal(label, 'Set Up the Plan')
  const occupancyChecked = await page.evaluate(() =>
    document.querySelectorAll('input[name="occupancy"]:checked').length
  )
  assert.equal(occupancyChecked, 0)
  await page.close()
})

// ── Accessibility ──────────────────────────────────────────────────────────────

test('all action buttons meet 44px minimum touch target', async () => {
  const page = await openTool()
  await advanceToResults(page)
  const short = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.result-action-btn'))
      .map(b => ({ text: b.textContent?.trim(), h: (b as HTMLElement).getBoundingClientRect().height }))
      .filter(b => b.h < 44)
  )
  assert.equal(short.length, 0, `Buttons below 44px: ${JSON.stringify(short)}`)
  await page.close()
})

// ── Viewport overflow ──────────────────────────────────────────────────────────

test('no horizontal overflow at 320px on stage 1', async () => {
  const page = await openTool()
  await page.setViewport({ width: 320, height: 800 })
  const scroll = await page.evaluate(() => document.body.scrollWidth)
  assert.ok(scroll <= 320, `scrollWidth=${scroll}`)
  await page.close()
})

test('no horizontal overflow at 375px on stage 2', async () => {
  const page = await openTool()
  await page.setViewport({ width: 375, height: 800 })
  await advanceToStage2(page)
  const scroll = await page.evaluate(() => document.body.scrollWidth)
  assert.ok(scroll <= 375, `scrollWidth=${scroll}`)
  await page.close()
})

test('no horizontal overflow at 375px on results page', async () => {
  const page = await openTool()
  await page.setViewport({ width: 375, height: 800 })
  await advanceToResults(page)
  const scroll = await page.evaluate(() => document.body.scrollWidth)
  assert.ok(scroll <= 375, `scrollWidth=${scroll}`)
  await page.close()
})

test('no horizontal overflow at 320px on results page', async () => {
  const page = await openTool()
  await page.setViewport({ width: 320, height: 800 })
  await advanceToResults(page)
  const scroll = await page.evaluate(() => document.body.scrollWidth)
  assert.ok(scroll <= 320, `scrollWidth=${scroll}`)
  await page.close()
})

test('no horizontal overflow at 430px on stage 2', async () => {
  const page = await openTool()
  await page.setViewport({ width: 430, height: 800 })
  await advanceToStage2(page)
  const scroll = await page.evaluate(() => document.body.scrollWidth)
  assert.ok(scroll <= 430, `scrollWidth=${scroll}`)
  await page.close()
})

test('no horizontal overflow at 1440px on results page', async () => {
  const page = await openTool()
  await page.setViewport({ width: 1440, height: 900 })
  await advanceToResults(page)
  const scroll = await page.evaluate(() => document.body.scrollWidth)
  assert.ok(scroll <= 1440, `scrollWidth=${scroll}`)
  await page.close()
})
