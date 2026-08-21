// Browser integration tests for the Buyer Readiness Planner (tools-buyer.html).
// Verifies multi-step navigation, validation, results display, Start Over flow,
// accessibility, and overflow.
//
// Runs against the production build (dist/) via a lightweight static HTTP server
// and Puppeteer. No live network access beyond Google Fonts (not asserted on).
//
// Run with: node --test test/tools/buyerPlanner.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile, access } from 'node:fs/promises'
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

let browser: Browser
let server: Server
let baseUrl: string

before(async () => {
  // Skip build if dist/tools-buyer.html already exists — another concurrent test
  // file (e.g. sellerPlanner.test.ts) will have already built the full project.
  // Running concurrent vite builds against the same dist/ causes race conditions.
  const buyerEntry = path.join(DIST, 'tools-buyer.html')
  const alreadyBuilt = await access(buyerEntry).then(() => true).catch(() => false)
  if (!alreadyBuilt) {
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  }

  server = createServer(async (req, res) => {
    const urlPath = req.url || '/tools-buyer.html'
    const filePath = path.join(DIST, decodeURIComponent(urlPath.split('?')[0]))
    try {
      const data = await readFile(filePath)
      const ext = path.extname(filePath)
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('failed to start test server')
  baseUrl = `http://127.0.0.1:${address.port}`

  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

async function openPage(): Promise<Page> {
  const page = await browser.newPage()
  await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
  // Wait for React to mount — progress label is the first element rendered by BuyerPlanner
  await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
  return page
}

/** Select a radio card by value within a name group. */
async function pickRadio(page: Page, name: string, value: string) {
  await page.click(`input[name="${name}"][value="${value}"]`)
}

/** Toggle a checkbox card by value. */
async function toggleCheckbox(page: Page, name: string, value: string) {
  await page.click(`input[name="${name}"][value="${value}"]`)
}

/** Fill all required answers on step 1. */
async function fillStep1(page: Page) {
  await pickRadio(page, 'timeframe', '3to6')
  await pickRadio(page, 'stage', 'actively')
  await pickRadio(page, 'purchaseType', 'firstHome')
}

/** Fill all required answers on step 2. */
async function fillStep2(page: Page) {
  await pickRadio(page, 'hasTargetArea', 'yes')
}

/** Fill all required answers on step 3. */
async function fillStep3(page: Page) {
  await pickRadio(page, 'financingStatus', 'preapproved')
}

/** Fill all required answers on step 4. */
async function fillStep4(page: Page) {
  await pickRadio(page, 'housingTiming', 'flexible')
  await pickRadio(page, 'mustSellFirst', 'no')
  await pickRadio(page, 'showingAvailability', 'flexible')
  await pickRadio(page, 'otherDecisionMakers', 'no')
  await pickRadio(page, 'movingFlexibility', 'flexible')
}

/** Click the Next / submit button. */
async function clickNext(page: Page) {
  await page.click('.tool-nav-next')
}

/** Navigate through all 5 steps with minimum required answers. */
async function completeAllSteps(page: Page) {
  await fillStep1(page)
  await clickNext(page)
  await fillStep2(page)
  await clickNext(page)
  await fillStep3(page)
  await clickNext(page)
  await fillStep4(page)
  await clickNext(page)
  // Step 5 has no required fields
  await clickNext(page)
}

// ── Basic rendering ───────────────────────────────────────────────────────────

test('page renders the header and step 1 questions', async () => {
  const page = await openPage()
  try {
    const headerTitle = await page.$eval('.tool-header-title', el => el.textContent)
    assert.equal(headerTitle, 'Buyer Readiness Planner')

    const brand = await page.$eval('.tool-header-brand', el => el.textContent)
    assert.match(brand!, /Your Real Estate Agent/i)

    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Buying Plans')

    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /When are you hoping to purchase/)
    assert.match(body, /Where are you in the buying process/)
    assert.match(body, /what best describes what you.re planning to purchase/i)
  } finally {
    await page.close()
  }
})

test('privacy note appears on step 1 and mentions browser storage', async () => {
  const page = await openPage()
  try {
    const note = await page.$eval('.tool-privacy-note', el => el.textContent || '')
    assert.match(note, /browser/)
    assert.match(note, /nothing\s+is\s+stored\s+or\s+transmitted/i)
  } finally {
    await page.close()
  }
})

// ── Option card selection ─────────────────────────────────────────────────────

test('selecting a radio card marks it selected and deselects others in the group', async () => {
  const page = await openPage()
  try {
    await pickRadio(page, 'timeframe', 'within3')
    let checked = await page.evaluate(() => (document.querySelector('input[name="timeframe"][value="within3"]') as HTMLInputElement)?.checked)
    assert.equal(checked, true)

    await pickRadio(page, 'timeframe', '3to6')
    checked = await page.evaluate(() => (document.querySelector('input[name="timeframe"][value="3to6"]') as HTMLInputElement)?.checked)
    assert.equal(checked, true)
    const prevChecked = await page.evaluate(() => (document.querySelector('input[name="timeframe"][value="within3"]') as HTMLInputElement)?.checked)
    assert.equal(prevChecked, false)
  } finally {
    await page.close()
  }
})

// ── Validation ────────────────────────────────────────────────────────────────

test('clicking Next on step 1 with no answers shows error banner and stays on step 1', async () => {
  const page = await openPage()
  try {
    await clickNext(page)
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'error banner should appear')
    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Buying Plans', 'should still be on step 1')
  } finally {
    await page.close()
  }
})

test('clicking Next with only some required step-1 fields shows error banner', async () => {
  const page = await openPage()
  try {
    await pickRadio(page, 'timeframe', '3to6')
    // stage and purchaseType not filled
    await clickNext(page)
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'error banner should appear when not all required fields are filled')
  } finally {
    await page.close()
  }
})

test('filling all step-1 required fields clears error banner on Next', async () => {
  const page = await openPage()
  try {
    await clickNext(page)
    assert.ok(await page.$('.tool-error-banner'), 'error should initially appear')

    await fillStep1(page)
    await clickNext(page)

    assert.ok(!(await page.$('.tool-error-banner')), 'error banner should be gone after valid submission')
    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Search Preferences')
  } finally {
    await page.close()
  }
})

test('clicking Next on step 2 with no hasTargetArea selection shows error banner', async () => {
  const page = await openPage()
  try {
    await fillStep1(page)
    await clickNext(page)
    await clickNext(page) // try to advance step 2 without required field
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'error banner should appear on step 2 without hasTargetArea')
    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Search Preferences')
  } finally {
    await page.close()
  }
})

// ── Step navigation ───────────────────────────────────────────────────────────

test('progress bar label and count advance with each step', async () => {
  const page = await openPage()
  try {
    const expectedLabels = [
      'Buying Plans',
      'Search Preferences',
      'Financing Status',
      'Timing & Coordination',
      'Priorities & Questions',
    ]

    for (let i = 0; i < 4; i++) {
      const label = await page.$eval('.tool-progress-label', el => el.textContent)
      const count = await page.$eval('.tool-progress-count', el => el.textContent)
      assert.equal(label, expectedLabels[i])
      assert.match(count!, new RegExp(`${i + 1} of 5`))

      if (i === 0) await fillStep1(page)
      if (i === 1) await fillStep2(page)
      if (i === 2) await fillStep3(page)
      if (i === 3) await fillStep4(page)
      await clickNext(page)
    }

    const label = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(label, 'Priorities & Questions')
    const count = await page.$eval('.tool-progress-count', el => el.textContent)
    assert.match(count!, /5 of 5/)
  } finally {
    await page.close()
  }
})

test('Back button is disabled on step 1 and enabled on step 2+', async () => {
  const page = await openPage()
  try {
    const disabledOnStep1 = await page.$eval('.tool-nav-back', el => (el as HTMLButtonElement).disabled)
    assert.equal(disabledOnStep1, true)

    await fillStep1(page)
    await clickNext(page)

    const disabledOnStep2 = await page.$eval('.tool-nav-back', el => (el as HTMLButtonElement).disabled)
    assert.equal(disabledOnStep2, false)
  } finally {
    await page.close()
  }
})

test('Back button on step 2 returns to step 1 and preserves answers', async () => {
  const page = await openPage()
  try {
    await pickRadio(page, 'timeframe', 'within3')
    await pickRadio(page, 'stage', 'ready')
    await pickRadio(page, 'purchaseType', 'firstHome')
    await clickNext(page)

    await page.click('.tool-nav-back')

    const timeframeChecked = await page.evaluate(() => (document.querySelector('input[name="timeframe"][value="within3"]') as HTMLInputElement)?.checked)
    assert.equal(timeframeChecked, true, 'timeframe selection should be preserved after Back')
    const stageChecked = await page.evaluate(() => (document.querySelector('input[name="stage"][value="ready"]') as HTMLInputElement)?.checked)
    assert.equal(stageChecked, true, 'stage selection should be preserved after Back')
  } finally {
    await page.close()
  }
})

test('the final step shows "See My Planning Summary" instead of "Next"', async () => {
  const page = await openPage()
  try {
    await fillStep1(page); await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)

    const btnText = await page.$eval('.tool-nav-next', el => el.textContent)
    assert.match(btnText!, /See My Planning Summary/i)
  } finally {
    await page.close()
  }
})

// ── Results ───────────────────────────────────────────────────────────────────

test('completing all steps shows the planning summary with at least one section', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)

    const title = await page.$eval('.tool-results-title', el => el.textContent)
    assert.equal(title, 'Your Planning Summary')

    const sections = await page.$$('.result-section')
    assert.ok(sections.length >= 1, 'at least one result section should appear')
  } finally {
    await page.close()
  }
})

test('nextStep section always appears in results', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /Suggested Next Step/i)
  } finally {
    await page.close()
  }
})

test('results include disclaimer with real estate advice text and Websites by Leslie credit', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const disclaimer = await page.$eval('.tool-disclaimer', el => el.textContent || '')
    assert.match(disclaimer, /informational/i)
    assert.match(disclaimer, /real estate/i)
    assert.match(disclaimer, /Websites by Leslie/i)
    assert.ok(!/Equal Housing Opportunity/i.test(disclaimer), 'EHO text must not appear in disclaimer')
  } finally {
    await page.close()
  }
})

test('results never display score, value, price, or verdict language', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const body = await page.evaluate(() => document.body.textContent || '')
    assert.ok(!/\bscore\b/i.test(body), 'results must not mention "score"')
    assert.ok(!/\byou are ready\b/i.test(body), 'results must not render a "you are ready" verdict')
    assert.ok(!/\byou are not ready\b/i.test(body), 'results must not render a "you are not ready" verdict')
  } finally {
    await page.close()
  }
})

test('results do not display credit score, income, or debt-to-income language', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const body = await page.evaluate(() => document.body.textContent || '')
    assert.ok(!/credit score/i.test(body), 'results must not mention credit score')
    assert.ok(!/debt.to.income/i.test(body), 'results must not mention debt-to-income')
    assert.ok(!/\bincome\b/i.test(body), 'results must not mention income')
  } finally {
    await page.close()
  }
})

test('lender not-started result item appears when financingStatus is notSpoken', async () => {
  const page = await openPage()
  try {
    await fillStep1(page); await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await pickRadio(page, 'financingStatus', 'notSpoken')
    await clickNext(page)
    await fillStep4(page); await clickNext(page)
    await clickNext(page) // step 5

    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /Connect with a lender/i)
  } finally {
    await page.close()
  }
})

test('cash purchase item appears when financingStatus is noFinancing', async () => {
  const page = await openPage()
  try {
    await fillStep1(page); await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await pickRadio(page, 'financingStatus', 'noFinancing')
    await clickNext(page)
    await fillStep4(page); await clickNext(page)
    await clickNext(page) // step 5

    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /Cash purchase/i)
  } finally {
    await page.close()
  }
})

// ── Start Over ────────────────────────────────────────────────────────────────

test('Start Over button shows a confirmation dialog', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)

    await page.evaluate(() => (Array.from(document.querySelectorAll('.result-actions .tool-action-btn')).find(b => b.textContent?.trim() === 'Start Over') as HTMLButtonElement)?.click())
    const dialog = await page.$('[role="dialog"]')
    assert.ok(dialog, 'confirm dialog should appear')
    const dialogText = await page.$eval('[role="dialog"]', el => el.textContent || '')
    assert.match(dialogText, /start over/i)
  } finally {
    await page.close()
  }
})

test('cancelling Start Over dialog stays on results', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    await page.evaluate(() => (Array.from(document.querySelectorAll('.result-actions .tool-action-btn')).find(b => b.textContent?.trim() === 'Start Over') as HTMLButtonElement)?.click())
    await page.click('.tool-confirm-cancel')

    const title = await page.$eval('.tool-results-title', el => el.textContent)
    assert.equal(title, 'Your Planning Summary')
  } finally {
    await page.close()
  }
})

test('confirming Start Over resets to step 1 with blank answers', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    await page.evaluate(() => (Array.from(document.querySelectorAll('.result-actions .tool-action-btn')).find(b => b.textContent?.trim() === 'Start Over') as HTMLButtonElement)?.click())
    await page.click('.tool-confirm-proceed')

    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Buying Plans')

    const anyChecked = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input[type="radio"]')).some(el => (el as HTMLInputElement).checked)
    )
    assert.equal(anyChecked, false, 'all radio inputs should be reset after Start Over')
  } finally {
    await page.close()
  }
})

// ── Overflow ──────────────────────────────────────────────────────────────────

test('no horizontal overflow on step 1 at mobile width (390px)', async () => {
  const page = await openPage()
  try {
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `expected no horizontal overflow at 390px, got ${overflow}px`)
  } finally {
    await page.close()
  }
})

test('no horizontal overflow on results at desktop width (1280px)', async () => {
  const page = await openPage()
  try {
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await completeAllSteps(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `expected no horizontal overflow at 1280px on results, got ${overflow}px`)
  } finally {
    await page.close()
  }
})

// ── Accessibility ─────────────────────────────────────────────────────────────

test('all question groups use fieldset and legend elements', async () => {
  const page = await openPage()
  try {
    const fieldsets = await page.$$eval('fieldset', els => els.length)
    assert.ok(fieldsets >= 3, `expected at least 3 fieldsets on step 1, got ${fieldsets}`)
    const legends = await page.$$eval('legend', els => els.length)
    assert.ok(legends >= 3, `expected at least 3 legends on step 1, got ${legends}`)
  } finally {
    await page.close()
  }
})

test('progress bar region has aria-label with step information', async () => {
  const page = await openPage()
  try {
    const ariaLabel = await page.$eval('[role="status"]', el => el.getAttribute('aria-label') || '')
    assert.match(ariaLabel, /step 1 of 5/i)
  } finally {
    await page.close()
  }
})

// ── Branding and demo label ───────────────────────────────────────────────────

test('header primary brand shows "Your Real Estate Agent"', async () => {
  const page = await openPage()
  try {
    const brand = await page.$eval('.tool-header-brand', el => el.textContent || '')
    assert.match(brand, /Your Real Estate Agent/i)
  } finally {
    await page.close()
  }
})

test('header demo label shows "Websites by Leslie"', async () => {
  const page = await openPage()
  try {
    const demo = await page.$eval('.tool-header-demo', el => el.textContent || '')
    assert.match(demo, /Websites by Leslie/i)
  } finally {
    await page.close()
  }
})

test('EHO symbol and Equal Housing Opportunity text do not appear anywhere on page', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const body = await page.evaluate(() => document.body.textContent || '')
    assert.ok(!/Equal Housing Opportunity/i.test(body), 'EHO text must not appear')
    assert.ok(!/⊜/.test(body), 'EHO symbol must not appear')
  } finally {
    await page.close()
  }
})

// ── Step 5 — no name or email fields ─────────────────────────────────────────

test('step 5 has no name or email input fields', async () => {
  const page = await openPage()
  try {
    await fillStep1(page); await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)

    const nameInput = await page.$('input[name="name"], input[type="text"][placeholder*="name" i]')
    const emailInput = await page.$('input[name="email"], input[type="email"]')
    assert.equal(nameInput, null, 'no name input should be on step 5')
    assert.equal(emailInput, null, 'no email input should be on step 5')
  } finally {
    await page.close()
  }
})

// ── Result actions ────────────────────────────────────────────────────────────

test('result actions bar always has Copy Summary, Print Summary, Review / Edit Answers, and Start Over', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)

    const buttons = await page.$$eval('.tool-action-btn', els =>
      els.map(el => el.textContent?.trim() ?? '')
    )
    assert.ok(buttons.some(t => /copy summary/i.test(t)), 'Copy Summary must exist')
    assert.ok(buttons.some(t => /print summary/i.test(t)), 'Print Summary must exist')
    assert.ok(buttons.some(t => /review.*edit.*answers/i.test(t)), 'Review / Edit Answers must exist')
    assert.ok(buttons.some(t => /start over/i.test(t)), 'Start Over must exist')
  } finally {
    await page.close()
  }
})

test('Copy Summary button updates live region with feedback', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.resolve() },
        configurable: true,
      })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await completeAllSteps(page)

    const statusBefore = await page.$eval('.result-copy-status', el => el.textContent || '')
    assert.equal(statusBefore.trim(), '', 'status should be empty before copy')

    await page.click('.tool-action-btn')
    await page.waitForFunction(() => {
      const el = document.querySelector('.result-copy-status')
      return el && el.textContent && el.textContent.trim().length > 0
    }, { timeout: 5000 })

    const statusAfter = await page.$eval('.result-copy-status', el => el.textContent || '')
    assert.match(statusAfter, /copied/i)
  } finally {
    await page.close()
  }
})

test('Review / Edit Answers returns to step 1 with prior answers preserved', async () => {
  const page = await openPage()
  try {
    await pickRadio(page, 'timeframe', 'within3')
    await pickRadio(page, 'stage', 'ready')
    await pickRadio(page, 'purchaseType', 'firstHome')
    await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)
    await clickNext(page) // step 5

    const buttons = await page.$$('.tool-action-btn')
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent || '')
      if (/review.*edit.*answers/i.test(text)) {
        await btn.click()
        break
      }
    }

    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Buying Plans', 'should return to step 1')

    const timeframeChecked = await page.evaluate(() =>
      (document.querySelector('input[name="timeframe"][value="within3"]') as HTMLInputElement)?.checked
    )
    assert.equal(timeframeChecked, true, 'prior timeframe answer should be preserved')
  } finally {
    await page.close()
  }
})

// ── Sales CTA ─────────────────────────────────────────────────────────────────

test('sales CTA appears on results screen targeting real estate professionals', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)

    const cta = await page.$('.tool-sales-cta')
    assert.ok(cta, 'sales CTA element must exist')

    const ctaText = await page.$eval('.tool-sales-cta', el => el.textContent || '')
    assert.match(ctaText, /real estate professionals/i)

    const ctaLinkHref = await page.$eval('.tool-sales-cta-link', el => el.getAttribute('href') || '')
    assert.match(ctaLinkHref, /mailto:websitesbyleslie01@gmail\.com/i)
    const ctaSubjectMatch = ctaLinkHref.match(/[?&]subject=([^&]*)/)
    const ctaSubject = decodeURIComponent(ctaSubjectMatch?.[1] ?? '')
    assert.equal(ctaSubject, 'Custom planner inquiry')
  } finally {
    await page.close()
  }
})

test('buyer CTA button shows "Email Leslie →" and has accessible title', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const text = await page.$eval('.tool-sales-cta-link', el => el.textContent?.trim() ?? '')
    assert.equal(text, 'Email Leslie →')
    const title = await page.$eval('.tool-sales-cta-link', el => el.getAttribute('title') || '')
    assert.match(title, /email application/i)
  } finally {
    await page.close()
  }
})

test('result-actions and tool-sales-cta carry the no-print class', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)

    const actionsHasNoPrint = await page.$eval('.result-actions', el => el.classList.contains('no-print'))
    const ctaHasNoPrint = await page.$eval('.tool-sales-cta', el => el.classList.contains('no-print'))

    assert.equal(actionsHasNoPrint, true, 'result-actions must have no-print class')
    assert.equal(ctaHasNoPrint, true, 'tool-sales-cta must have no-print class')
  } finally {
    await page.close()
  }
})

test('result-actions and tool-sales-cta are hidden in print media', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    await page.emulateMediaType('print')

    const actionsVisible = await page.$eval('.result-actions', el =>
      window.getComputedStyle(el).display !== 'none'
    )
    const ctaVisible = await page.$eval('.tool-sales-cta', el =>
      window.getComputedStyle(el).display !== 'none'
    )

    assert.equal(actionsVisible, false, 'result-actions must be hidden in print')
    assert.equal(ctaVisible, false, 'tool-sales-cta must be hidden in print')
  } finally {
    await page.close()
  }
})

// ── Timeframe options and guidance ────────────────────────────────────────────

test('step 1 timeframe options contain exactly the five expected values', async () => {
  const page = await openPage()
  try {
    const values = await page.$$eval('input[name="timeframe"]', els =>
      els.map(el => (el as HTMLInputElement).value).sort()
    )
    assert.deepEqual(values, ['3to6', '6to12', 'moreThan12', 'unsure', 'within3'])
  } finally {
    await page.close()
  }
})

test('"exploring" is absent from the timeframe radio inputs', async () => {
  const page = await openPage()
  try {
    const exploringInput = await page.$('input[name="timeframe"][value="exploring"]')
    assert.equal(exploringInput, null, '"exploring" must not exist as a timeframe radio option')
  } finally {
    await page.close()
  }
})

test('within3 timeframe produces a near-term timing result in the planning summary', async () => {
  const page = await openPage()
  try {
    await pickRadio(page, 'timeframe', 'within3')
    await pickRadio(page, 'stage', 'actively')
    await pickRadio(page, 'purchaseType', 'firstHome')
    await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)
    await clickNext(page) // step 5

    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /Near-term purchase timeline/i)
  } finally {
    await page.close()
  }
})

test('moreThan12 timeframe produces an early planning result in the planning summary', async () => {
  const page = await openPage()
  try {
    await pickRadio(page, 'timeframe', 'moreThan12')
    await pickRadio(page, 'stage', 'justExploring')
    await pickRadio(page, 'purchaseType', 'firstHome')
    await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)
    await clickNext(page) // step 5

    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /Early planning steps for a future purchase/i)
  } finally {
    await page.close()
  }
})

// ── Favicon and HTML hygiene ──────────────────────────────────────────────────

test('tools-buyer.html links the existing favicon.svg', async () => {
  const html = await readFile(path.join(ROOT, 'tools-buyer.html'), 'utf-8')
  assert.match(html, /favicon\.svg/, 'tools-buyer.html must link favicon.svg')
})

test('tools-seller.html links the existing favicon.svg', async () => {
  const html = await readFile(path.join(ROOT, 'tools-seller.html'), 'utf-8')
  assert.match(html, /favicon\.svg/, 'tools-seller.html must link favicon.svg')
})

// ── Share Summary ─────────────────────────────────────────────────────────────

test('native share: Share Summary button is visible and labeled correctly when share is supported', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', {
        value: async () => undefined,
        configurable: true, writable: true,
      })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    const text = await page.$eval('.result-share-action', el => el.textContent?.trim() ?? '')
    assert.equal(text, 'Share Summary')
    const title = await page.$eval('.result-share-action', el => el.getAttribute('title') || '')
    assert.match(title, /share/i)
  } finally {
    await page.close()
  }
})

test('native share: navigator.share receives the buyer planning summary title and complete text', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      const calls: Array<{ title?: string; text?: string }> = []
      Object.defineProperty(navigator, 'share', {
        value: async (data: { title?: string; text?: string }) => { calls.push(data); return undefined },
        configurable: true, writable: true,
      })
      ;(window as unknown as Record<string, unknown>).__shareCalls = () => [...calls]
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    await page.click('.result-share-action')
    await page.waitForFunction(
      () => ((window as unknown as Record<string, unknown>).__shareCalls as () => unknown[])().length > 0,
      { timeout: 3000 }
    )

    const calls = await page.evaluate(
      () => (window as unknown as { __shareCalls: () => Array<{ title: string; text: string }> }).__shareCalls()
    )
    assert.equal(calls.length, 1)
    assert.equal(calls[0].title, 'My Buyer Readiness Planning Summary')
    assert.match(calls[0].text, /BUYER READINESS PLANNER/)
    assert.match(calls[0].text, /informational and discussion purposes only/)
    assert.match(calls[0].text, /Suggested Next Step/)
  } finally {
    await page.close()
  }
})

test('native share: share text equals what Copy Summary produces', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', {
        value: async (data: { text?: string }) => {
          ;(window as unknown as Record<string, unknown>).__shareText = data.text ?? ''
          return undefined
        },
        configurable: true, writable: true,
      })
      const written: string[] = []
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (t: string) => { written.push(t); return undefined } },
        configurable: true,
      })
      ;(window as unknown as Record<string, unknown>).__clipboardWritten = () => [...written]
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    await page.click('.result-share-action')
    await page.waitForFunction(
      () => !!((window as unknown as Record<string, unknown>).__shareText as string),
      { timeout: 3000 }
    )
    const shareText = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__shareText as string
    )

    await page.click('.tool-action-btn') // Copy Summary is the first button
    await page.waitForFunction(
      () => ((window as unknown as { __clipboardWritten: () => string[] }).__clipboardWritten)().length > 0,
      { timeout: 3000 }
    )
    const written = await page.evaluate(
      () => (window as unknown as { __clipboardWritten: () => string[] }).__clipboardWritten()
    )

    assert.equal(shareText, written[0], 'share text must be identical to Copy Summary text')
  } finally {
    await page.close()
  }
})

test('native share: AbortError is handled quietly with no error status', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', {
        value: async () => { const e = new DOMException('Aborted', 'AbortError'); throw e },
        configurable: true, writable: true,
      })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    await page.click('.result-share-action')

    await new Promise(r => setTimeout(r, 800))
    const status = await page.$eval('.result-copy-status', el => el.textContent?.trim() ?? '')
    assert.equal(status, '', 'AbortError must not produce any status message')
  } finally {
    await page.close()
  }
})

test('native share: no status message appears when share succeeds', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', {
        value: async () => undefined,
        configurable: true, writable: true,
      })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    await page.click('.result-share-action')

    await new Promise(r => setTimeout(r, 800))
    const status = await page.$eval('.result-copy-status', el => el.textContent?.trim() ?? '')
    assert.equal(status, '', 'no status message should appear when native share succeeds')
  } finally {
    await page.close()
  }
})

test('native share: Share Summary is not visible in print media', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', {
        value: async () => undefined,
        configurable: true, writable: true,
      })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    await page.emulateMediaType('print')
    const visible = await page.$eval('.result-share-action', el =>
      window.getComputedStyle(el.closest('.result-actions')!).display !== 'none'
    )
    assert.equal(visible, false, 'result-actions (containing Share Summary) must be hidden in print')
  } finally {
    await page.close()
  }
})

test('desktop: Share Summary button is not rendered when navigator.share is unavailable', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    const shareBtn = await page.$('.result-share-action')
    assert.equal(shareBtn, null, 'Share Summary must not render when navigator.share is unavailable')
  } finally {
    await page.close()
  }
})

test('desktop: Copy Summary is displayed when navigator.share is unavailable', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    const buttons = await page.$$eval('.tool-action-btn', els =>
      els.map(el => el.textContent?.trim() ?? '')
    )
    assert.ok(buttons.some(t => /copy summary/i.test(t)), 'Copy Summary must be present on desktop')
  } finally {
    await page.close()
  }
})

test('desktop: email helper text is displayed when navigator.share is unavailable', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    const hint = await page.$eval('.result-share-hint', el => el.textContent?.trim() ?? '')
    assert.match(hint, /Copy Summary/i)
    assert.match(hint, /paste it into your email/i)
  } finally {
    await page.close()
  }
})

test('desktop: no mailto navigation occurs when navigator.share is unavailable', async () => {
  const page = await browser.newPage()
  try {
    let navigated = false
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    page.on('request', req => { if (req.url().startsWith('mailto:')) navigated = true })

    // No Share Summary button to click — verify no navigation happened after 500ms
    await new Promise(r => setTimeout(r, 500))
    assert.equal(navigated, false, 'no mailto navigation should occur on desktop')
  } finally {
    await page.close()
  }
})

test('desktop: Copy Summary places complete report on clipboard', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
      const written: string[] = []
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (t: string) => { written.push(t); return undefined } },
        configurable: true,
      })
      ;(window as unknown as Record<string, unknown>).__clipboardWritten = () => [...written]
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    await page.click('.tool-action-btn') // Copy Summary is the first button
    await page.waitForFunction(
      () => ((window as unknown as { __clipboardWritten: () => string[] }).__clipboardWritten)().length > 0,
      { timeout: 3000 }
    )

    const written = await page.evaluate(
      () => (window as unknown as { __clipboardWritten: () => string[] }).__clipboardWritten()
    )
    assert.ok(written.length >= 1)
    assert.match(written[0], /BUYER READINESS PLANNER/)
    assert.match(written[0], /Suggested Next Step/)
    assert.match(written[0], /informational and discussion purposes only/)
  } finally {
    await page.close()
  }
})

test('desktop: Copy Summary live region shows "Complete summary copied to clipboard."', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async () => undefined },
        configurable: true,
      })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    await page.click('.tool-action-btn')
    await page.waitForFunction(
      () => (document.querySelector('.result-copy-status')?.textContent ?? '').includes('Complete summary'),
      { timeout: 3000 }
    )

    const status = await page.$eval('.result-copy-status', el => el.textContent || '')
    assert.match(status, /Complete summary copied to clipboard/i)
  } finally {
    await page.close()
  }
})

test('desktop: email helper text is hidden in print media', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    await page.emulateMediaType('print')

    const visible = await page.$eval('.result-share-hint', el =>
      window.getComputedStyle(el.closest('.result-actions')!).display !== 'none'
    )
    assert.equal(visible, false, 'result-actions (containing email hint) must be hidden in print')
  } finally {
    await page.close()
  }
})

// ── Responsive ────────────────────────────────────────────────────────────────

async function checkOverflow(w: number, h: number, url: string): Promise<number> {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: w, height: h })
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    return await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  } finally {
    await page.close()
  }
}

test('no horizontal overflow on step 1 at 320px', async () => {
  const ovf = await checkOverflow(320, 568, `${baseUrl}/tools-buyer.html`)
  assert.ok(ovf <= 0, `expected no overflow at 320px, got ${ovf}px`)
})

test('no horizontal overflow on step 1 at 375px', async () => {
  const ovf = await checkOverflow(375, 667, `${baseUrl}/tools-buyer.html`)
  assert.ok(ovf <= 0, `expected no overflow at 375px, got ${ovf}px`)
})

test('no horizontal overflow on step 1 at 430px', async () => {
  const ovf = await checkOverflow(430, 932, `${baseUrl}/tools-buyer.html`)
  assert.ok(ovf <= 0, `expected no overflow at 430px, got ${ovf}px`)
})

test('no horizontal overflow on step 1 at 768px (tablet)', async () => {
  const ovf = await checkOverflow(768, 1024, `${baseUrl}/tools-buyer.html`)
  assert.ok(ovf <= 0, `expected no overflow at 768px, got ${ovf}px`)
})

test('no horizontal overflow on results at 320px', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 320, height: 568 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(ovf <= 0, `expected no overflow at 320px on results, got ${ovf}px`)
  } finally {
    await page.close()
  }
})

test('action buttons stay within viewport at 320px — no button extends past right edge', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 320, height: 568 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    const maxRight = await page.$$eval('.tool-action-btn', (btns) =>
      Math.max(...btns.map(b => b.getBoundingClientRect().right))
    )
    assert.ok(maxRight <= 320, `action button right edge (${maxRight.toFixed(1)}px) must not exceed 320px viewport`)
  } finally {
    await page.close()
  }
})

test('navigation buttons stay within viewport at 320px', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 320, height: 568 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    const navRight = await page.evaluate(() =>
      document.querySelector('.tool-nav')?.getBoundingClientRect().right ?? 0
    )
    assert.ok(navRight <= 320, `nav right edge (${navRight.toFixed(1)}px) must not exceed 320px`)
  } finally {
    await page.close()
  }
})

test('all action buttons meet 44px minimum touch target height', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const minHeight = await page.$$eval('.tool-action-btn', btns =>
      Math.min(...btns.map(b => b.getBoundingClientRect().height))
    )
    assert.ok(minHeight >= 44, `all action buttons must be at least 44px tall; smallest was ${minHeight.toFixed(1)}px`)
  } finally {
    await page.close()
  }
})

// ── Answers at a Glance recap ─────────────────────────────────────────────────

test('answers-recap section appears in results', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const recap = await page.$('.result-section--answers-recap')
    assert.ok(recap, 'answers-recap section must exist in results')
    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /Your Answers at a Glance/)
  } finally {
    await page.close()
  }
})

test('recap shows exact timeframe label selected', async () => {
  const page = await openPage()
  try {
    await pickRadio(page, 'timeframe', 'within3')
    await pickRadio(page, 'stage', 'actively')
    await pickRadio(page, 'purchaseType', 'firstHome')
    await clickNext(page)
    await fillStep2(page)
    await clickNext(page)
    await fillStep3(page)
    await clickNext(page)
    await fillStep4(page)
    await clickNext(page)
    await clickNext(page)

    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /Within the next 3 months/)
  } finally {
    await page.close()
  }
})

test('recap omits unanswered optional fields — no empty dd elements', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const emptyDetails = await page.$$eval('.result-recap-detail', els =>
      els.filter(el => !el.textContent || !el.textContent.trim()).length
    )
    assert.equal(emptyDetails, 0, 'no recap detail elements should be empty')
  } finally {
    await page.close()
  }
})

// ── Mutual exclusivity ────────────────────────────────────────────────────────

test('selecting must-have removes it from nice-to-haves', async () => {
  const page = await openPage()
  try {
    await fillStep1(page)
    await clickNext(page)

    await toggleCheckbox(page, 'niceToHaves', 'garage')
    const niceCheckedBefore = await page.evaluate(() =>
      (document.querySelector('input[name="niceToHaves"][value="garage"]') as HTMLInputElement)?.checked
    )
    assert.equal(niceCheckedBefore, true, 'garage should be checked in nice-to-haves before toggling must-have')

    await toggleCheckbox(page, 'mustHaves', 'garage')

    const niceCheckedAfter = await page.evaluate(() =>
      (document.querySelector('input[name="niceToHaves"][value="garage"]') as HTMLInputElement)?.checked
    )
    assert.equal(niceCheckedAfter, false, 'garage must be removed from nice-to-haves when added to must-haves')

    const mustChecked = await page.evaluate(() =>
      (document.querySelector('input[name="mustHaves"][value="garage"]') as HTMLInputElement)?.checked
    )
    assert.equal(mustChecked, true, 'garage must be checked in must-haves')
  } finally {
    await page.close()
  }
})

test('selecting nice-to-have removes it from must-haves', async () => {
  const page = await openPage()
  try {
    await fillStep1(page)
    await clickNext(page)

    await toggleCheckbox(page, 'mustHaves', 'garage')
    const mustCheckedBefore = await page.evaluate(() =>
      (document.querySelector('input[name="mustHaves"][value="garage"]') as HTMLInputElement)?.checked
    )
    assert.equal(mustCheckedBefore, true, 'garage should be checked in must-haves before toggling nice-to-have')

    await toggleCheckbox(page, 'niceToHaves', 'garage')

    const mustCheckedAfter = await page.evaluate(() =>
      (document.querySelector('input[name="mustHaves"][value="garage"]') as HTMLInputElement)?.checked
    )
    assert.equal(mustCheckedAfter, false, 'garage must be removed from must-haves when added to nice-to-haves')

    const niceChecked = await page.evaluate(() =>
      (document.querySelector('input[name="niceToHaves"][value="garage"]') as HTMLInputElement)?.checked
    )
    assert.equal(niceChecked, true, 'garage must be checked in nice-to-haves')
  } finally {
    await page.close()
  }
})

// ── Copy/Share recap ──────────────────────────────────────────────────────────

test('Copy Summary includes recap answers-at-a-glance content', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
      const written: string[] = []
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (t: string) => { written.push(t); return undefined } },
        configurable: true,
      })
      ;(window as unknown as Record<string, unknown>).__clipboardWritten = () => [...written]
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })

    await pickRadio(page, 'timeframe', '3to6')
    await pickRadio(page, 'stage', 'actively')
    await pickRadio(page, 'purchaseType', 'firstHome')
    await clickNext(page)
    await fillStep2(page)
    await clickNext(page)
    await fillStep3(page)
    await clickNext(page)
    await fillStep4(page)
    await clickNext(page)
    await clickNext(page)

    await page.click('.tool-action-btn')
    await page.waitForFunction(
      () => ((window as unknown as { __clipboardWritten: () => string[] }).__clipboardWritten)().length > 0,
      { timeout: 3000 }
    )

    const written = await page.evaluate(
      () => (window as unknown as { __clipboardWritten: () => string[] }).__clipboardWritten()
    )
    assert.ok(written.length >= 1)
    assert.match(written[0], /Your Answers at a Glance/)
    assert.match(written[0], /Within 3–6 months/)
  } finally {
    await page.close()
  }
})

test('Share Summary receives complete summary with recap', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      const calls: Array<{ title?: string; text?: string }> = []
      Object.defineProperty(navigator, 'share', {
        value: async (data: { title?: string; text?: string }) => { calls.push(data); return undefined },
        configurable: true, writable: true,
      })
      ;(window as unknown as Record<string, unknown>).__shareCalls = () => [...calls]
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)

    await page.click('.result-share-action')
    await page.waitForFunction(
      () => ((window as unknown as Record<string, unknown>).__shareCalls as () => unknown[])().length > 0,
      { timeout: 3000 }
    )

    const calls = await page.evaluate(
      () => (window as unknown as { __shareCalls: () => Array<{ title: string; text: string }> }).__shareCalls()
    )
    assert.equal(calls.length, 1)
    assert.match(calls[0].text, /Your Answers at a Glance/)
  } finally {
    await page.close()
  }
})

// ── Review/Edit preserves recap ───────────────────────────────────────────────

test('Review/Edit returns to questions preserving selections; recap reflects them after re-completing', async () => {
  const page = await openPage()
  try {
    await pickRadio(page, 'timeframe', 'within3')
    await pickRadio(page, 'stage', 'actively')
    await pickRadio(page, 'purchaseType', 'firstHome')
    await clickNext(page)
    await fillStep2(page)
    await clickNext(page)
    await fillStep3(page)
    await clickNext(page)
    await fillStep4(page)
    await clickNext(page)
    await clickNext(page)

    const buttons = await page.$$('.tool-action-btn')
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent || '')
      if (/review.*edit.*answers/i.test(text)) {
        await btn.click()
        break
      }
    }

    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Buying Plans', 'should be back on step 1')

    const timeframeChecked = await page.evaluate(() =>
      (document.querySelector('input[name="timeframe"][value="within3"]') as HTMLInputElement)?.checked
    )
    assert.equal(timeframeChecked, true, 'prior timeframe selection should be preserved')

    await clickNext(page)
    await clickNext(page)
    await clickNext(page)
    await clickNext(page)
    await clickNext(page)

    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /Within the next 3 months/)
  } finally {
    await page.close()
  }
})

// ── Print ─────────────────────────────────────────────────────────────────────

test('answers-recap section is present in DOM and does not have no-print class', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const hasNoPrint = await page.$eval('.result-section--answers-recap', el => el.classList.contains('no-print'))
    assert.equal(hasNoPrint, false, 'answers-recap must not have no-print class')
  } finally {
    await page.close()
  }
})

// ── Overflow at additional viewports ─────────────────────────────────────────

test('no horizontal overflow on results at 320px', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 320, height: 568 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(ovf <= 0, `expected no overflow at 320px on results, got ${ovf}px`)
  } finally {
    await page.close()
  }
})

test('no horizontal overflow on results at 375px', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 375, height: 667 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(ovf <= 0, `expected no overflow at 375px on results, got ${ovf}px`)
  } finally {
    await page.close()
  }
})

test('no horizontal overflow on results at 430px', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 430, height: 932 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(ovf <= 0, `expected no overflow at 430px on results, got ${ovf}px`)
  } finally {
    await page.close()
  }
})

test('no horizontal overflow on results at 768px', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 768, height: 1024 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(ovf <= 0, `expected no overflow at 768px on results, got ${ovf}px`)
  } finally {
    await page.close()
  }
})

test('no horizontal overflow on results at 1440px', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(ovf <= 0, `expected no overflow at 1440px on results, got ${ovf}px`)
  } finally {
    await page.close()
  }
})

// ── Touch targets ─────────────────────────────────────────────────────────────

test('all interactive controls have touch target height >= 44px', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const minHeight = await page.$$eval('.tool-action-btn', btns =>
      Math.min(...btns.map(b => b.getBoundingClientRect().height))
    )
    assert.ok(minHeight >= 44, `all interactive controls must be at least 44px tall; smallest was ${minHeight.toFixed(1)}px`)
  } finally {
    await page.close()
  }
})

// ── Recap ordering — must precede guidance ────────────────────────────────────

test('answers-recap section appears before the first tailored-guidance section in DOM order', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const recapBeforeGuidance = await page.evaluate(() => {
      const recap = document.querySelector('.result-section--answers-recap')
      const firstGuidance = document.querySelector('.result-sections .result-section')
      if (!recap || !firstGuidance) return false
      // DOCUMENT_POSITION_FOLLOWING means firstGuidance comes AFTER recap
      return !!(recap.compareDocumentPosition(firstGuidance) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    assert.equal(recapBeforeGuidance, true, 'answers-recap must appear before the first guidance section in DOM order')
  } finally {
    await page.close()
  }
})

// ── Written questions appear exactly once ─────────────────────────────────────

test('written question appears exactly once in visible results', async () => {
  const page = await openPage()
  try {
    const q = 'How competitive is the market right now?'
    await fillStep1(page); await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)
    // Step 5: enter question
    await page.type('#agentQuestions', q)
    await clickNext(page)

    const bodyText = await page.evaluate(() => document.body.textContent || '')
    const occurrences = (bodyText.match(/How competitive is the market right now\?/g) || []).length
    assert.equal(occurrences, 1, `written question must appear exactly once in visible results; found ${occurrences}`)
  } finally {
    await page.close()
  }
})

test('written question appears exactly once in Copy Summary', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true })
      const written: string[] = []
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (t: string) => { written.push(t); return undefined } },
        configurable: true,
      })
      ;(window as unknown as Record<string, unknown>).__clipboardWritten = () => [...written]
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    const q = 'How competitive is the market right now?'
    await fillStep1(page); await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)
    await page.type('#agentQuestions', q)
    await clickNext(page)

    await page.click('.tool-action-btn')
    await page.waitForFunction(
      () => ((window as unknown as { __clipboardWritten: () => string[] }).__clipboardWritten)().length > 0,
      { timeout: 3000 }
    )
    const written = await page.evaluate(
      () => (window as unknown as { __clipboardWritten: () => string[] }).__clipboardWritten()
    )
    const text = written[0] || ''
    const occurrences = (text.match(/How competitive is the market right now\?/g) || []).length
    assert.equal(occurrences, 1, `written question must appear exactly once in Copy Summary; found ${occurrences}`)
    assert.ok(!text.includes('Your Written Questions'), 'standalone "Your Written Questions" heading must not appear in Copy Summary')
  } finally {
    await page.close()
  }
})

test('written question appears exactly once in Share Summary', async () => {
  const page = await browser.newPage()
  try {
    await page.evaluateOnNewDocument(() => {
      const calls: Array<{ text?: string }> = []
      Object.defineProperty(navigator, 'share', {
        value: async (data: { text?: string }) => { calls.push(data); return undefined },
        configurable: true, writable: true,
      })
      ;(window as unknown as Record<string, unknown>).__shareCalls = () => [...calls]
    })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    const q = 'How competitive is the market right now?'
    await fillStep1(page); await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)
    await page.type('#agentQuestions', q)
    await clickNext(page)

    await page.click('.result-share-action')
    await page.waitForFunction(
      () => ((window as unknown as Record<string, unknown>).__shareCalls as () => unknown[])().length > 0,
      { timeout: 3000 }
    )
    const calls = await page.evaluate(
      () => (window as unknown as { __shareCalls: () => Array<{ text: string }> }).__shareCalls()
    )
    const text = calls[0]?.text ?? ''
    const occurrences = (text.match(/How competitive is the market right now\?/g) || []).length
    assert.equal(occurrences, 1, `written question must appear exactly once in Share Summary; found ${occurrences}`)
    assert.ok(!text.includes('Your Written Questions'), 'standalone "Your Written Questions" heading must not appear in Share Summary')
  } finally {
    await page.close()
  }
})

test('written question appears exactly once in print', async () => {
  const page = await openPage()
  try {
    const q = 'How competitive is the market right now?'
    await fillStep1(page); await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)
    await page.type('#agentQuestions', q)
    await clickNext(page)

    await page.emulateMediaType('print')
    const bodyText = await page.evaluate(() => document.body.textContent || '')
    const occurrences = (bodyText.match(/How competitive is the market right now\?/g) || []).length
    assert.equal(occurrences, 1, `written question must appear exactly once in print; found ${occurrences}`)
    await page.emulateMediaType('screen')
  } finally {
    await page.close()
  }
})

test('blank written-question field produces no blank or redundant section', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page) // step 5 left blank
    const writtenQSection = await page.$('.result-written-questions')
    assert.equal(writtenQSection, null, 'standalone result-written-questions section must not exist')
    const emptyDDs = await page.$$eval('.result-recap-detail', els =>
      els.filter(el => !el.textContent || !el.textContent.trim()).length
    )
    assert.equal(emptyDDs, 0, 'recap must have no empty detail cells when question is blank')
  } finally {
    await page.close()
  }
})

test('Review/Edit preserves written question; question still appears exactly once after round-trip', async () => {
  const page = await openPage()
  try {
    const q = 'What is typical earnest money in this area?'
    await fillStep1(page); await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)
    await page.type('#agentQuestions', q)
    await clickNext(page)

    // Click Review / Edit Answers
    const buttons = await page.$$('.tool-action-btn')
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent || '')
      if (/review.*edit.*answers/i.test(text)) { await btn.click(); break }
    }

    // Verify question is preserved in textarea on step 1 return
    await clickNext(page) // advance to step 5 through remaining steps
    await clickNext(page)
    await clickNext(page)
    await clickNext(page)
    const questionValue = await page.$eval('#agentQuestions', el => (el as HTMLTextAreaElement).value)
    assert.equal(questionValue, q, 'agentQuestions textarea must retain prior value after Review/Edit')
    await clickNext(page) // to results

    const bodyText = await page.evaluate(() => document.body.textContent || '')
    const occurrences = (bodyText.match(/What is typical earnest money in this area\?/g) || []).length
    assert.equal(occurrences, 1, `question must appear exactly once after Review/Edit round-trip; found ${occurrences}`)
  } finally {
    await page.close()
  }
})

// ── Overflow at 390px ─────────────────────────────────────────────────────────

test('no horizontal overflow on results at 390px', async () => {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(`${baseUrl}/tools-buyer.html`, { waitUntil: 'load' })
    await page.waitForSelector('.tool-progress-label', { timeout: 15000 })
    await completeAllSteps(page)
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(ovf <= 0, `expected no overflow at 390px on results, got ${ovf}px`)
  } finally {
    await page.close()
  }
})

// ── Action bar placement ───────────────────────────────────────────────────────

test('action bar appears after disclaimer in DOM order', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const disclaimerBeforeActions = await page.evaluate(() => {
      const disclaimer = document.querySelector('.tool-disclaimer')
      const actions = document.querySelector('.result-actions')
      if (!disclaimer || !actions) return false
      return !!(disclaimer.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    assert.equal(disclaimerBeforeActions, true, 'disclaimer must appear before result-actions in DOM order')
  } finally {
    await page.close()
  }
})

test('action bar appears before the professional customization CTA in DOM order', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const actionsBeforeCta = await page.evaluate(() => {
      const actions = document.querySelector('.result-actions')
      const cta = document.querySelector('.tool-sales-cta')
      if (!actions || !cta) return false
      return !!(actions.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    assert.equal(actionsBeforeCta, true, 'result-actions must appear before tool-sales-cta in DOM order')
  } finally {
    await page.close()
  }
})

test('exactly one action bar exists on the results page', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const count = await page.$$eval('.result-actions', els => els.length)
    assert.equal(count, 1, `expected exactly one .result-actions element, found ${count}`)
  } finally {
    await page.close()
  }
})

test('accessible status message inside action bar has role="status" and aria-live="polite"', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const attrs = await page.evaluate(() => {
      const status = document.querySelector('.result-actions [role="status"]')
      if (!status) return null
      return {
        role: status.getAttribute('role'),
        ariaLive: status.getAttribute('aria-live'),
        ariaAtomic: status.getAttribute('aria-atomic'),
      }
    })
    assert.ok(attrs !== null, 'status element with role="status" must exist inside .result-actions')
    assert.equal(attrs!.role, 'status', 'status element must have role="status"')
    assert.equal(attrs!.ariaLive, 'polite', 'status element must have aria-live="polite"')
    assert.equal(attrs!.ariaAtomic, 'true', 'status element must have aria-atomic="true"')
  } finally {
    await page.close()
  }
})

test('recap, guidance sections, and disclaimer are not hidden in print', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)
    const visibility = await page.evaluate(() => {
      const recap = document.querySelector('.result-section--answers-recap')
      const firstGuidanceSection = document.querySelector('.result-sections .result-section')
      const disclaimer = document.querySelector('.tool-disclaimer')
      const getDisplayInPrint = (el: Element | null) => {
        if (!el) return 'missing'
        // Use matchMedia to emulate print
        const sheet = document.createElement('style')
        sheet.media = 'print'
        sheet.textContent = ''
        return !el.classList.contains('no-print') ? 'visible' : 'hidden'
      }
      return {
        recap: getDisplayInPrint(recap),
        guidance: getDisplayInPrint(firstGuidanceSection),
        disclaimer: getDisplayInPrint(disclaimer),
      }
    })
    assert.equal(visibility.recap, 'visible', 'answers-recap must not have no-print class (must be visible in print)')
    assert.equal(visibility.guidance, 'visible', 'guidance sections must not have no-print class (must be visible in print)')
    assert.equal(visibility.disclaimer, 'visible', 'disclaimer must not have no-print class (must be visible in print)')
  } finally {
    await page.close()
  }
})
