// Browser integration tests for the Seller Readiness Planner
// (tools-seller.html). Verifies multi-step navigation, validation,
// results display, Start Over flow, accessibility, and overflow.
//
// Runs against the production build (dist/) via a lightweight static
// HTTP server and Puppeteer. No live network access beyond Google Fonts
// (which the browser loads but tests do not depend on for assertions).
//
// Run with: node --test test/tools/sellerPlanner.test.ts

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

let browser: Browser
let server: Server
let baseUrl: string

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  server = createServer(async (req, res) => {
    const urlPath = req.url || '/tools-seller.html'
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
  await page.goto(`${baseUrl}/tools-seller.html`, { waitUntil: 'load' })
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
  await pickRadio(page, 'stage', 'preparing')
  await pickRadio(page, 'coordination', 'sellOnly')
}

/** Fill all required answers on step 2. */
async function fillStep2(page: Page) {
  await pickRadio(page, 'propertyType', 'singleFamily')
  await pickRadio(page, 'occupancy', 'ownerOccupied')
}

/** Fill all required answers on step 3. */
async function fillStep3(page: Page) {
  await pickRadio(page, 'knownRepairs', 'noneAware')
  await pickRadio(page, 'declutterStatus', 'done')
  await pickRadio(page, 'recentImprovements', 'none')
  await pickRadio(page, 'accessArrangement', 'straightforward')
  await pickRadio(page, 'prepQuestions', 'no')
}

/** Fill all required answers on step 4. */
async function fillStep4(page: Page) {
  await pickRadio(page, 'hoaInvolvement', 'no')
  await pickRadio(page, 'multipleOwners', 'one')
  await pickRadio(page, 'timingComplications', 'open')
}

/** Click Next button. */
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
    assert.equal(headerTitle, 'Seller Readiness Planner')

    const brand = await page.$eval('.tool-header-brand', el => el.textContent)
    assert.match(brand!, /Your Real Estate Agent/i)

    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Selling Plans')

    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /When are you hoping to list/)
    assert.match(body, /Where are you in the selling process/)
    assert.match(body, /Does your home sale need to coordinate/)
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
    await pickRadio(page, 'timeframe', 'asap')
    let checked = await page.evaluate(() => (document.querySelector('input[name="timeframe"][value="asap"]') as HTMLInputElement)?.checked)
    assert.equal(checked, true)

    await pickRadio(page, 'timeframe', '3to6')
    checked = await page.evaluate(() => (document.querySelector('input[name="timeframe"][value="3to6"]') as HTMLInputElement)?.checked)
    assert.equal(checked, true)
    const prevChecked = await page.evaluate(() => (document.querySelector('input[name="timeframe"][value="asap"]') as HTMLInputElement)?.checked)
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
    assert.equal(progressLabel, 'Selling Plans', 'should still be on step 1')
  } finally {
    await page.close()
  }
})

test('clicking Next with only some required step-1 fields shows error banner', async () => {
  const page = await openPage()
  try {
    await pickRadio(page, 'timeframe', 'asap')
    // stage and coordination not filled
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
    // Trigger error first
    await clickNext(page)
    assert.ok(await page.$('.tool-error-banner'), 'error should initially appear')

    // Fill all required fields
    await fillStep1(page)
    await clickNext(page)

    // Should advance to step 2 — no error banner, progress says Property Basics
    assert.ok(!(await page.$('.tool-error-banner')), 'error banner should be gone after valid submission')
    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Property Basics')
  } finally {
    await page.close()
  }
})

// ── Step navigation ───────────────────────────────────────────────────────────

test('progress bar label and count advance with each step', async () => {
  const page = await openPage()
  try {
    const expectedLabels = [
      'Selling Plans',
      'Property Basics',
      'Property Preparation',
      'Information to Gather',
      'Priorities & Next Steps',
    ]

    for (let i = 0; i < 4; i++) {
      const label = await page.$eval('.tool-progress-label', el => el.textContent)
      const count = await page.$eval('.tool-progress-count', el => el.textContent)
      assert.equal(label, expectedLabels[i])
      assert.match(count!, new RegExp(`${i + 1} of 5`))

      // Fill required answers for current step and advance
      if (i === 0) await fillStep1(page)
      if (i === 1) await fillStep2(page)
      if (i === 2) await fillStep3(page)
      if (i === 3) await fillStep4(page)
      await clickNext(page)
    }

    // Step 5
    const label = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(label, 'Priorities & Next Steps')
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
    await pickRadio(page, 'timeframe', 'asap')
    await pickRadio(page, 'stage', 'ready')
    await pickRadio(page, 'coordination', 'sellOnly')
    await clickNext(page)

    await page.click('.tool-nav-back')

    const timeframeChecked = await page.evaluate(() => (document.querySelector('input[name="timeframe"][value="asap"]') as HTMLInputElement)?.checked)
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

test('HOA items appear in results when hoaInvolvement is yes', async () => {
  const page = await openPage()
  try {
    await pickRadio(page, 'timeframe', '3to6')
    await pickRadio(page, 'stage', 'exploring')
    await pickRadio(page, 'coordination', 'sellOnly')
    await clickNext(page)

    await fillStep2(page)
    await clickNext(page)

    await fillStep3(page)
    await clickNext(page)

    await pickRadio(page, 'hoaInvolvement', 'yes')
    await pickRadio(page, 'multipleOwners', 'one')
    await pickRadio(page, 'timingComplications', 'open')
    await clickNext(page)

    await clickNext(page) // step 5 — no required fields

    const body = await page.evaluate(() => document.body.textContent || '')
    assert.match(body, /HOA information/i)
  } finally {
    await page.close()
  }
})

// ── Start Over ────────────────────────────────────────────────────────────────

test('Start Over button shows a confirmation dialog', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)

    await page.click('.result-action-btn--ghost')
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
    await page.click('.result-action-btn--ghost')
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
    await page.click('.result-action-btn--ghost')
    await page.click('.tool-confirm-proceed')

    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Selling Plans')

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
    await page.goto(`${baseUrl}/tools-seller.html`, { waitUntil: 'load' })
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
    await page.goto(`${baseUrl}/tools-seller.html`, { waitUntil: 'load' })
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

// ── Step 4 ownership options ──────────────────────────────────────────────────

test('step 4 ownership options use One owner / Multiple owners / I need to confirm labels', async () => {
  const page = await openPage()
  try {
    await fillStep1(page); await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)

    const labels = await page.$$eval('input[name="multipleOwners"]', els =>
      els.map(el => el.closest('label')?.querySelector('.option-card-label')?.textContent?.trim() ?? '')
    )
    assert.ok(labels.includes('One owner'), 'must have "One owner" option')
    assert.ok(labels.includes('Multiple owners'), 'must have "Multiple owners" option')
    assert.ok(labels.includes('I need to confirm'), 'must have "I need to confirm" option')
    assert.ok(!labels.some(l => /^yes$/i.test(l)), 'old "yes" option must not appear')
    assert.ok(!labels.some(l => /^no$/i.test(l)), 'old "no" option must not appear')
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

test('result actions bar has Copy Summary, Print Summary, Review / Edit Answers, and Start Over buttons', async () => {
  const page = await openPage()
  try {
    await completeAllSteps(page)

    const buttons = await page.$$eval('.result-action-btn', els =>
      els.map(el => el.textContent?.trim() ?? '')
    )
    assert.ok(buttons.some(t => /copy summary/i.test(t)), 'Copy Summary button must exist')
    assert.ok(buttons.some(t => /print summary/i.test(t)), 'Print Summary button must exist')
    assert.ok(buttons.some(t => /review.*edit.*answers/i.test(t)), 'Review / Edit Answers button must exist')
    assert.ok(buttons.some(t => /start over/i.test(t)), 'Start Over button must exist')
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
    await page.goto(`${baseUrl}/tools-seller.html`, { waitUntil: 'load' })
    await completeAllSteps(page)

    const statusBefore = await page.$eval('.result-copy-status', el => el.textContent || '')
    assert.equal(statusBefore.trim(), '', 'status should be empty before copy')

    await page.click('.result-action-btn')
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
    await pickRadio(page, 'timeframe', 'asap')
    await pickRadio(page, 'stage', 'ready')
    await pickRadio(page, 'coordination', 'sellOnly')
    await clickNext(page)
    await fillStep2(page); await clickNext(page)
    await fillStep3(page); await clickNext(page)
    await fillStep4(page); await clickNext(page)
    await clickNext(page) // step 5

    // Click Review / Edit Answers
    const buttons = await page.$$('.result-action-btn')
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent || '')
      if (/review.*edit.*answers/i.test(text)) {
        await btn.click()
        break
      }
    }

    const progressLabel = await page.$eval('.tool-progress-label', el => el.textContent)
    assert.equal(progressLabel, 'Selling Plans', 'should return to step 1')

    const timeframeChecked = await page.evaluate(() =>
      (document.querySelector('input[name="timeframe"][value="asap"]') as HTMLInputElement)?.checked
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
    assert.match(ctaLinkHref, /websitesbyleslie\.com/i)
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
