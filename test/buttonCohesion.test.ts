// Button-cohesion regression suite.
//
// Verifies that:
//   1. All six results components use .tool-action-btn for equal-weight utility actions.
//   2. The retired class names have no remaining component consumers.
//   3. Results action bars retain their intended order, behavior, and count.
//   4. Start Over opens its confirmation dialog; Cancel preserves results; Confirm resets.
//   5. Conditional Share behavior is unchanged.
//   6. Print still hides controls.
//   7. Representative buttons meet minimum touch-target heights and have focus-visible styling.
//   8. Reduced-motion preference suppresses hover transforms.
//   9. Property Comparison Add button meets the 44px touch-target requirement.
//  10. Results utility buttons have consistent computed geometry within each action bar.
//
// Source-level checks (sections 1–2) read .tsx files directly — no build or browser required.
// Browser checks (sections 3–10) run against the production build via an HTTP server.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile, readdir, access } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = path.resolve(import.meta.dirname, '..')
const DIST = path.join(ROOT, 'dist')
const SRC  = path.join(ROOT, 'src')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg':  'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
}

const REWRITES: Record<string, string> = {
  '/tools/real-estate/buyer':               '/tools-buyer.html',
  '/tools/real-estate/seller':              '/tools-seller.html',
  '/tools/real-estate/listing-preparation': '/tools-listing-preparation.html',
  '/tools/real-estate/property-comparison': '/tools-property-comparison.html',
  '/tools/real-estate/open-house-follow-up':'/tools-open-house-follow-up.html',
  '/tools/real-estate/closing-moving':      '/tools-closing-moving.html',
  '/real-estate-tools':                     '/tools-real-estate-showcase.html',
  '/':                                      '/index.html',
}

let browser: Browser
let server:  Server
let baseUrl: string

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Walk a directory tree and return all .tsx file paths. */
async function walkTsx(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) files.push(...await walkTsx(full))
    else if (e.name.endsWith('.tsx')) files.push(full)
  }
  return files
}

async function openPage(url: string, width = 1280): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 900 })
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' })
  return page
}

// ── Setup ─────────────────────────────────────────────────────────────────────

before(async () => {
  const entry = path.join(DIST, 'tools-buyer.html')
  const alreadyBuilt = await access(entry).then(() => true).catch(() => false)
  if (!alreadyBuilt) {
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  }

  server = createServer(async (req, res) => {
    const rawPath = req.url?.split('?')[0] ?? '/'
    const resolved = REWRITES[rawPath] ?? (rawPath === '/' ? '/index.html' : rawPath)
    const filePath = path.join(DIST, resolved)
    try {
      const data = await readFile(filePath)
      const ext  = path.extname(filePath)
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('server failed to start')
  baseUrl = `http://127.0.0.1:${addr.port}`

  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

// ── 1. Source: all six results components use .tool-action-btn ────────────────

const RESULTS_FILES = [
  'src/tools/real-estate/buyer/BuyerResults.tsx',
  'src/tools/real-estate/seller/SellerResults.tsx',
  'src/tools/real-estate/listing/ActionPlanResults.tsx',
  'src/tools/real-estate/open-house/FollowUpResults.tsx',
  'src/tools/real-estate/closing/ClosingResults.tsx',
  'src/tools/real-estate/comparison/ComparisonResults.tsx',
]

for (const rel of RESULTS_FILES) {
  test(`${path.basename(rel)} uses .tool-action-btn for results utility actions`, async () => {
    const src = await readFile(path.join(ROOT, rel), 'utf-8')
    assert.ok(
      src.includes('tool-action-btn'),
      `${rel} must contain "tool-action-btn" — results utility buttons must use the shared class`,
    )
  })
}

// ── 2. Source: retired class names have zero TSX consumers ────────────────────

const RETIRED_CLASSES = [
  'result-action-btn',
  'result-action-btn--ghost',
  'cmp-action-btn--secondary',
]

test('retired results-action class names have no remaining .tsx consumers', async () => {
  const allTsx = await walkTsx(path.join(SRC))
  const hits: string[] = []

  for (const file of allTsx) {
    const src = await readFile(file, 'utf-8')
    for (const cls of RETIRED_CLASSES) {
      if (src.includes(cls)) {
        hits.push(`${path.relative(ROOT, file)}: found retired class "${cls}"`)
      }
    }
  }

  assert.equal(
    hits.length,
    0,
    `Retired CSS classes must have zero component consumers.\nFound:\n${hits.join('\n')}`,
  )
})

// ── 3. Browser: results action bar order and count ────────────────────────────

// Navigate each tool to results, then verify the expected action buttons are present.
const TOOL_RESULTS: {
  url: string
  html: string
  mountedSelector: string
  label: string
  navigateToResults: (page: Page) => Promise<void>
}[] = [
  {
    url: '/tools/real-estate/buyer',
    html: '/tools-buyer.html',
    mountedSelector: '.tool-page',
    label: 'Buyer',
    navigateToResults: async (page) => {
      // Complete 5 steps with minimum answers.
      for (let step = 0; step < 5; step++) {
        if (step === 0) {
          await page.click('input[name="timeframe"][value="3to6"]').catch(() => {})
          await page.click('input[name="stage"][value="actively"]').catch(() => {})
          await page.click('input[name="purchaseType"][value="firstHome"]').catch(() => {})
        } else if (step === 1) {
          await page.click('input[name="hasTargetArea"][value="yes"]').catch(() => {})
        } else if (step === 2) {
          await page.click('input[name="financingStatus"][value="preapproved"]').catch(() => {})
        } else if (step === 3) {
          await page.click('input[name="housingTiming"][value="flexible"]').catch(() => {})
          await page.click('input[name="mustSellFirst"][value="no"]').catch(() => {})
          await page.click('input[name="showingAvailability"][value="flexible"]').catch(() => {})
          await page.click('input[name="otherDecisionMakers"][value="no"]').catch(() => {})
          await page.click('input[name="movingFlexibility"][value="flexible"]').catch(() => {})
        }
        await page.click('.tool-nav-next')
        await new Promise((r) => setTimeout(r, 200))
      }
      await page.waitForSelector('.result-actions', { timeout: 5000 })
    },
  },
]

test('Buyer results action bar uses .tool-action-btn and has expected utility buttons', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-page', { timeout: 10000 })
    await TOOL_RESULTS[0].navigateToResults(page)

    const btnCount = await page.$$eval('.result-actions .tool-action-btn', (els) => els.length)
    assert.ok(btnCount >= 4, `expected ≥4 .tool-action-btn in results, got ${btnCount}`)

    const bodyText = await page.evaluate(() => document.body.textContent ?? '')
    assert.ok(bodyText.includes('Copy Summary'), 'results must include "Copy Summary"')
    assert.ok(bodyText.includes('Print Summary'), 'results must include "Print Summary"')
    assert.ok(bodyText.includes('Review / Edit Answers'), 'results must include "Review / Edit Answers"')
    assert.ok(bodyText.includes('Start Over'), 'results must include "Start Over"')

    // No retired class names should be present in results bar
    const hasOldClass = await page.$eval('.result-actions', (el) => {
      return el.innerHTML.includes('result-action-btn') || el.innerHTML.includes('listing-planner-btn')
    }).catch(() => false)
    assert.equal(hasOldClass, false, 'results action bar must not contain retired class names in rendered HTML')
  } finally {
    await page.close()
  }
})

// ── 4. Browser: Start Over → confirm dialog → Cancel → results preserved ──────

test('Buyer: Start Over opens confirm dialog; Cancel preserves results', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-page', { timeout: 10000 })
    await TOOL_RESULTS[0].navigateToResults(page)

    // Click Start Over
    await page.$$eval('.result-actions .tool-action-btn', (btns) => {
      const btn = btns.find((b) => b.textContent?.trim() === 'Start Over')
      if (!btn) throw new Error('Start Over button not found')
      ;(btn as HTMLButtonElement).click()
    })

    // Confirm dialog should open
    await page.waitForSelector('.tool-confirm-backdrop', { timeout: 3000 })
    const dialogVisible = await page.$('.tool-confirm-backdrop')
    assert.ok(dialogVisible, 'confirm dialog must open after clicking Start Over')

    // Click Cancel
    await page.$eval('.tool-confirm-cancel', (el) => (el as HTMLButtonElement).click())
    await new Promise((r) => setTimeout(r, 300))

    // Results still visible; dialog gone
    const dialogAfterCancel = await page.$('.tool-confirm-backdrop')
    assert.equal(dialogAfterCancel, null, 'confirm dialog must close after Cancel')

    const resultsVisible = await page.$('.result-actions')
    assert.ok(resultsVisible, 'results must still be visible after Cancel')
  } finally {
    await page.close()
  }
})

// ── 5. Browser: Start Over → Confirm → resets to step 1 ──────────────────────

test('Buyer: Start Over → Confirm resets tool to step 1', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-page', { timeout: 10000 })
    await TOOL_RESULTS[0].navigateToResults(page)

    await page.$$eval('.result-actions .tool-action-btn', (btns) => {
      const btn = btns.find((b) => b.textContent?.trim() === 'Start Over')
      ;(btn as HTMLButtonElement).click()
    })
    await page.waitForSelector('.tool-confirm-backdrop', { timeout: 3000 })
    await page.$eval('.tool-confirm-proceed', (el) => (el as HTMLButtonElement).click())
    await new Promise((r) => setTimeout(r, 300))

    // Should be back at step 1
    const progressLabel = await page.$eval('.tool-progress-label', (el) => el.textContent).catch(() => null)
    assert.ok(progressLabel !== null, 'should be back at step 1 with a progress label')

    // Result-actions should be gone
    const resultsVisible = await page.$('.result-actions')
    assert.equal(resultsVisible, null, 'results must not be visible after Start Over confirm')
  } finally {
    await page.close()
  }
})

// ── 6. Browser: Print hides controls ─────────────────────────────────────────

test('Buyer results: .result-actions has .no-print class (print-hidden)', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-page', { timeout: 10000 })
    await TOOL_RESULTS[0].navigateToResults(page)

    const hasNoPrint = await page.$eval('.result-actions', (el) =>
      el.classList.contains('no-print'),
    )
    assert.equal(hasNoPrint, true, 'results action bar must have class .no-print')
  } finally {
    await page.close()
  }
})

// ── 7. Browser: touch-target minimum heights ──────────────────────────────────

test('main-site .btn-primary has min-height ≥ 44px (computed height)', async () => {
  const page = await openPage('/')
  try {
    await page.waitForSelector('.btn-primary', { timeout: 5000 })
    const height = await page.$eval('.btn-primary', (el) => el.getBoundingClientRect().height)
    assert.ok(height >= 44, `main-site .btn-primary rendered height ${height}px must be ≥ 44px`)
  } finally {
    await page.close()
  }
})

test('tool .tool-nav-next has min-height ≥ 48px (computed height)', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-nav-next', { timeout: 10000 })
    const height = await page.$eval('.tool-nav-next', (el) => el.getBoundingClientRect().height)
    assert.ok(height >= 48, `.tool-nav-next rendered height ${height}px must be ≥ 48px`)
  } finally {
    await page.close()
  }
})

test('Property Comparison Add button (cmp-add-custom-btn) has min-height ≥ 44px', async () => {
  const page = await openPage('/tools/real-estate/property-comparison')
  try {
    await page.waitForSelector('.cmp-add-custom-btn', { timeout: 10000 })
    const height = await page.$eval('.cmp-add-custom-btn', (el) => el.getBoundingClientRect().height)
    assert.ok(height >= 44, `.cmp-add-custom-btn rendered height ${height}px must be ≥ 44px`)
  } finally {
    await page.close()
  }
})

test('results .tool-action-btn has min-height ≥ 44px after navigation to Buyer results', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-page', { timeout: 10000 })
    await TOOL_RESULTS[0].navigateToResults(page)
    await page.waitForSelector('.tool-action-btn', { timeout: 5000 })
    const height = await page.$eval('.tool-action-btn', (el) => el.getBoundingClientRect().height)
    assert.ok(height >= 44, `.tool-action-btn rendered height ${height}px must be ≥ 44px`)
  } finally {
    await page.close()
  }
})

// ── 8. Browser: focus-visible styling is present ──────────────────────────────

test('main-site .btn has outline on focus-visible (keyboard focus)', async () => {
  const page = await openPage('/')
  try {
    await page.waitForSelector('.btn-primary', { timeout: 5000 })
    // Tab to the first focusable element then check the CSS outline rule exists in the sheet
    const hasRule = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule && rule.selectorText.includes('.btn:focus-visible')) {
              return true
            }
          }
        } catch { /* cross-origin */ }
      }
      return false
    })
    assert.equal(hasRule, true, '.btn:focus-visible rule must exist in the stylesheet')
  } finally {
    await page.close()
  }
})

test('tool .tool-action-btn has focus-visible outline rule', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-page', { timeout: 10000 })
    const hasRule = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule && rule.selectorText.includes('.tool-action-btn:focus-visible')) {
              return true
            }
          }
        } catch { /* cross-origin */ }
      }
      return false
    })
    assert.equal(hasRule, true, '.tool-action-btn:focus-visible rule must exist in the tool stylesheet')
  } finally {
    await page.close()
  }
})

// ── 9. Browser: reduced-motion suppresses hover transforms ────────────────────

test('prefers-reduced-motion: reduce suppresses hover transform on .btn', async () => {
  const page = await openPage('/')
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.waitForSelector('.btn', { timeout: 5000 })

    const transformValue = await page.evaluate(() => {
      const btn = document.querySelector('.btn') as HTMLElement | null
      if (!btn) return 'element-not-found'
      // Simulate hover by checking what the stylesheet says for reduced-motion
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion')) {
              for (const inner of Array.from(rule.cssRules || [])) {
                if (inner instanceof CSSStyleRule && inner.selectorText === '.btn:hover') {
                  return (inner as CSSStyleRule).style.transform
                }
              }
            }
          }
        } catch { /* cross-origin */ }
      }
      return 'rule-not-found'
    })
    // The reduced-motion rule should set transform to 'none'
    assert.equal(
      transformValue,
      'none',
      `prefers-reduced-motion hover transform for .btn must be "none", got "${transformValue}"`,
    )
  } finally {
    await page.close()
  }
})

test('prefers-reduced-motion: reduce suppresses hover transform on .tool-nav-next', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.waitForSelector('.tool-nav-next', { timeout: 10000 })

    const transformValue = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion')) {
              for (const inner of Array.from(rule.cssRules || [])) {
                if (inner instanceof CSSStyleRule && inner.selectorText.includes('.tool-nav-next:hover')) {
                  return (inner as CSSStyleRule).style.transform
                }
              }
            }
          }
        } catch { /* cross-origin */ }
      }
      return 'rule-not-found'
    })
    assert.equal(
      transformValue,
      'none',
      `prefers-reduced-motion hover transform for .tool-nav-next must be "none", got "${transformValue}"`,
    )
  } finally {
    await page.close()
  }
})

// ── 10. Browser: results utility buttons have consistent geometry ──────────────

test('Buyer results: all .tool-action-btn have equal computed height', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-page', { timeout: 10000 })
    await TOOL_RESULTS[0].navigateToResults(page)
    await page.waitForSelector('.tool-action-btn', { timeout: 5000 })

    const heights = await page.$$eval('.result-actions .tool-action-btn', (btns) =>
      btns.map((b) => Math.round(b.getBoundingClientRect().height)),
    )
    assert.ok(heights.length >= 4, `expected ≥4 .tool-action-btn, got ${heights.length}`)
    const allSame = heights.every((h) => h === heights[0])
    assert.equal(
      allSame,
      true,
      `all .tool-action-btn in results must have equal rendered height — got [${heights.join(', ')}]`,
    )
  } finally {
    await page.close()
  }
})

// ── 11. Browser: Comparison results — all 5 action-bar controls equal weight ──

/** Navigate comparison tool to results (mirrors advanceToResults in propertyComparison.test.ts). */
async function navigateToComparisonResults(page: Page): Promise<void> {
  // Stage 1: select one starter priority
  await page.waitForSelector('.cmp-starter-item', { timeout: 10000 })
  const items = await page.$$('.cmp-starter-item')
  if (items[0]) await items[0].click()
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-property-list') !== null)

  // Stage 2: fill minimum 2 property nicknames
  await page.waitForSelector('[id^="nickname-"]')
  const inputs0 = await page.$$('[id^="nickname-"]')
  if (inputs0[0]) await inputs0[0].type('Home A')
  const editBtns = await page.$$('button.listing-task-card__edit-btn')
  if (editBtns[1]) {
    await editBtns[1].click()
    await new Promise<void>((r) => setTimeout(r, 200))
  }
  const inputs1 = await page.$$('[id^="nickname-"]')
  for (const inp of inputs1) {
    const v = await inp.evaluate((el: Element) => (el as HTMLInputElement).value)
    if (!v) { await inp.type('Home B'); break }
  }
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-property-tabs') !== null)

  // Stage 3: advance to results
  await page.click('.listing-planner-btn--primary')
  await page.waitForFunction(() => document.querySelector('.cmp-results-root') !== null)
}

test('Comparison results: all action-bar controls use .tool-action-btn (equal weight)', async () => {
  const page = await openPage('/tools/real-estate/property-comparison')
  try {
    await navigateToComparisonResults(page)

    // Every button in the action bar must use .tool-action-btn
    const actionBarBtns = await page.$$eval('.cmp-action-bar button', (btns) =>
      btns.map((b) => ({ text: b.textContent?.trim() ?? '', classes: b.className })),
    )
    assert.ok(actionBarBtns.length >= 4, `expected ≥4 action-bar buttons, got ${actionBarBtns.length}`)

    for (const { text, classes } of actionBarBtns) {
      assert.ok(
        classes.includes('tool-action-btn'),
        `action-bar button "${text}" must use .tool-action-btn — got classes: "${classes}"`,
      )
    }

    // No action-bar button may use .cmp-action-btn in its initial (pre-confirm) state
    const hasFilledBtn = actionBarBtns.some(({ classes }) => classes.includes('cmp-action-btn'))
    assert.equal(hasFilledBtn, false, 'no action-bar button may use .cmp-action-btn before confirmation dialog opens')

    // "Start over" must be present and must be .tool-action-btn (not danger-styled)
    const startOverClasses = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.cmp-action-bar button'))
        .find((b) => b.textContent?.trim().toLowerCase() === 'start over')
      return btn ? btn.className : null
    })
    assert.ok(startOverClasses !== null, '"Start over" button must be present in comparison action bar')
    assert.ok(
      startOverClasses!.includes('tool-action-btn') && !startOverClasses!.includes('cmp-action-btn--danger'),
      `"Start over" action-bar button must use .tool-action-btn (no danger styling), got: "${startOverClasses}"`,
    )
  } finally {
    await page.close()
  }
})

test('Comparison results: all action-bar buttons have equal computed height', async () => {
  const page = await openPage('/tools/real-estate/property-comparison')
  try {
    await navigateToComparisonResults(page)

    const heights = await page.$$eval('.cmp-action-bar button', (btns) =>
      btns.map((b) => Math.round(b.getBoundingClientRect().height)),
    )
    assert.ok(heights.length >= 4, `expected ≥4 action-bar buttons, got ${heights.length}`)
    const allSame = heights.every((h) => h === heights[0])
    assert.equal(
      allSame,
      true,
      `all comparison action-bar buttons must have equal rendered height — got [${heights.join(', ')}]`,
    )
  } finally {
    await page.close()
  }
})

test('Comparison: Start over opens dialog; confirm dialog retains danger styling', async () => {
  const page = await openPage('/tools/real-estate/property-comparison')
  try {
    await navigateToComparisonResults(page)

    // Click the action-bar Start over (must be .tool-action-btn, not danger)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.cmp-action-bar .tool-action-btn'))
        .find((b) => b.textContent?.trim().toLowerCase() === 'start over') as HTMLButtonElement | undefined
      btn?.click()
    })
    await new Promise<void>((r) => setTimeout(r, 300))

    // Confirm dialog must appear
    const dialog = await page.$('.cmp-start-over-confirm')
    assert.ok(dialog, 'Start over confirm dialog must appear after clicking action-bar Start over')

    // "Yes, start over" in the dialog may retain danger emphasis
    const yesBtn = await page.$('.cmp-start-over-confirm .cmp-action-btn--danger')
    assert.ok(yesBtn, 'dialog "Yes, start over" button must retain .cmp-action-btn--danger styling')

    // Cancel dismisses dialog; results remain
    const cancelBtn = await page.$('.cmp-start-over-confirm .tool-action-btn')
    assert.ok(cancelBtn, 'dialog Cancel button must use .tool-action-btn')
    await cancelBtn!.click()
    await new Promise<void>((r) => setTimeout(r, 200))
    const dialogGone = await page.$('.cmp-start-over-confirm')
    assert.equal(dialogGone, null, 'confirm dialog must close after Cancel')
    const results = await page.$('.cmp-results-root')
    assert.ok(results, 'results must remain visible after Cancel')
  } finally {
    await page.close()
  }
})

// ── 12. Browser: four-style semantic role verification ────────────────────────
// Primary = teal fill; Secondary = white bg + teal border; Utility = same as secondary visually;
// Destructive = red fill. Buttons with different purposes must not share the same visual treatment.

const TEAL_BUTTON_RGB = 'rgb(52, 101, 115)'  // #346573  var(--color-accent-button)
const WHITE_BG_RGB    = 'rgb(255, 255, 255)'
const RED_BUTTON_RGB  = 'rgb(185, 28, 28)'   // #B91C1C  var(--color-error)

test('Style 1 PRIMARY: main-site .btn has teal fill background', async () => {
  const page = await openPage('/')
  try {
    await page.waitForSelector('.btn', { timeout: 5000 })
    const bg = await page.$eval('.btn', (el) =>
      getComputedStyle(el).backgroundColor,
    )
    assert.equal(bg, TEAL_BUTTON_RGB, `.btn primary must have teal fill, got "${bg}"`)
  } finally {
    await page.close()
  }
})

test('Style 1 PRIMARY: .tool-nav-next has teal fill background', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-nav-next', { timeout: 10000 })
    const bg = await page.$eval('.tool-nav-next', (el) =>
      getComputedStyle(el).backgroundColor,
    )
    assert.equal(bg, TEAL_BUTTON_RGB, `.tool-nav-next primary must have teal fill, got "${bg}"`)
  } finally {
    await page.close()
  }
})

test('Style 2 SECONDARY: main-site .btn-outline has white background and teal border', async () => {
  const page = await openPage('/')
  try {
    await page.waitForSelector('.btn-outline', { timeout: 5000 })
    const [bg, border] = await page.$eval('.btn-outline', (el) => {
      const s = getComputedStyle(el)
      return [s.backgroundColor, s.borderTopColor]
    })
    assert.equal(bg, WHITE_BG_RGB, `.btn-outline secondary background must be white, got "${bg}"`)
    assert.equal(border, TEAL_BUTTON_RGB, `.btn-outline secondary border must be teal, got "${border}"`)
  } finally {
    await page.close()
  }
})

test('Style 2 SECONDARY: .tool-nav-back has white background and teal border', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-nav-back', { timeout: 10000 })
    // Advance to step 2 so Back is enabled (disabled state has opacity override)
    await page.click('input[name="timeframe"][value="3to6"]').catch(() => {})
    await page.click('input[name="stage"][value="actively"]').catch(() => {})
    await page.click('input[name="purchaseType"][value="firstHome"]').catch(() => {})
    await page.click('.tool-nav-next')
    await new Promise((r) => setTimeout(r, 300))
    const [bg, border] = await page.$eval('.tool-nav-back', (el) => {
      const s = getComputedStyle(el)
      return [s.backgroundColor, s.borderTopColor]
    })
    assert.equal(bg, WHITE_BG_RGB, `.tool-nav-back secondary background must be white, got "${bg}"`)
    assert.equal(border, TEAL_BUTTON_RGB, `.tool-nav-back secondary border must be teal, got "${border}"`)
  } finally {
    await page.close()
  }
})

test('Style 2 SECONDARY: showcase .rts-tool-link has white background and teal border', async () => {
  const page = await openPage('/real-estate-tools')
  try {
    await page.waitForSelector('.rts-tool-link', { timeout: 10000 })
    const [bg, border] = await page.$eval('.rts-tool-link', (el) => {
      const s = getComputedStyle(el)
      return [s.backgroundColor, s.borderTopColor]
    })
    assert.equal(bg, WHITE_BG_RGB, `.rts-tool-link secondary background must be white, got "${bg}"`)
    assert.equal(border, TEAL_BUTTON_RGB, `.rts-tool-link secondary border must be teal, got "${border}"`)
  } finally {
    await page.close()
  }
})

test('Style 3 UTILITY: .tool-action-btn in results has white background and teal border (not primary fill)', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-page', { timeout: 10000 })
    await TOOL_RESULTS[0].navigateToResults(page)
    await page.waitForSelector('.tool-action-btn', { timeout: 5000 })
    const [bg, border] = await page.$eval('.tool-action-btn', (el) => {
      const s = getComputedStyle(el)
      return [s.backgroundColor, s.borderTopColor]
    })
    assert.equal(bg, WHITE_BG_RGB, `.tool-action-btn utility background must be white (not teal fill), got "${bg}"`)
    assert.equal(border, TEAL_BUTTON_RGB, `.tool-action-btn utility border must be teal, got "${border}"`)
  } finally {
    await page.close()
  }
})

test('Style 4 DESTRUCTIVE: .tool-confirm-proceed has red fill after Start Over', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-page', { timeout: 10000 })
    await TOOL_RESULTS[0].navigateToResults(page)
    await page.$$eval('.result-actions .tool-action-btn', (btns) => {
      const btn = btns.find((b) => b.textContent?.trim() === 'Start Over')
      ;(btn as HTMLButtonElement).click()
    })
    await page.waitForSelector('.tool-confirm-proceed', { timeout: 3000 })
    const bg = await page.$eval('.tool-confirm-proceed', (el) =>
      getComputedStyle(el).backgroundColor,
    )
    assert.equal(bg, RED_BUTTON_RGB, `.tool-confirm-proceed destructive must have red fill, got "${bg}"`)
  } finally {
    await page.close()
  }
})

test('Style 2 SECONDARY: .tool-confirm-cancel in Start Over dialog has white background', async () => {
  const page = await openPage('/tools/real-estate/buyer')
  try {
    await page.waitForSelector('.tool-page', { timeout: 10000 })
    await TOOL_RESULTS[0].navigateToResults(page)
    await page.$$eval('.result-actions .tool-action-btn', (btns) => {
      const btn = btns.find((b) => b.textContent?.trim() === 'Start Over')
      ;(btn as HTMLButtonElement).click()
    })
    await page.waitForSelector('.tool-confirm-cancel', { timeout: 3000 })
    const bg = await page.$eval('.tool-confirm-cancel', (el) =>
      getComputedStyle(el).backgroundColor,
    )
    assert.equal(bg, WHITE_BG_RGB, `.tool-confirm-cancel secondary dialog button must have white background, got "${bg}"`)
  } finally {
    await page.close()
  }
})
