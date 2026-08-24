// Browser integration tests for the Plumbing Service Visit Planner.
// Validates the 3-stage workflow: What's happening? → Where and when? →
// About your home and the visit → Service Visit Brief.
//
// Runs against the production build (dist/) via a lightweight static HTTP server.
// Run with: node --test test/tools/plumbingVisitPlanner.test.ts

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
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function openTool(canShare = false): Promise<Page> {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument((share: boolean) => {
    if (!share) {
      Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true })
    } else {
      Object.defineProperty(navigator, 'share', {
        value: (data: unknown) => {
          (window as unknown as Record<string, unknown>).__lastShared = data
          return Promise.resolve()
        },
        writable: true, configurable: true,
      })
    }
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => {
          (window as unknown as Record<string, unknown>).__lastCopied = t
          return Promise.resolve()
        },
      },
      writable: true, configurable: true,
    })
  }, canShare)
  await page.goto(`${baseUrl}/tools-plumbing-visit.html`, { waitUntil: 'load' })
  return page
}

async function fillStage1(page: Page) {
  await page.click('input[name="concernType"][value="slow_drain"]')
  await page.click('input[name="activeWater"][value="none_visible"]')
}

async function advanceToStage2(page: Page) {
  await fillStage1(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => !!document.querySelector('input[name="homeArea"]'))
}

async function fillStage2(page: Page) {
  await page.click('input[name="homeArea"][value="main_bathroom"]')
  await page.click('input[name="firstNoticed"][value="last_few_days"]')
  await page.click('input[name="changeAnswer"][value="same"]')
  await page.click('input[name="history"][value="no_first_time"]')
  await page.click('input[name="waterElsewhere"][value="yes_normal"]')
}

async function advanceToStage3(page: Page) {
  await advanceToStage2(page)
  await fillStage2(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => !!document.querySelector('input[name="propertyType"]'))
}

async function fillStage3(page: Page) {
  await page.click('input[name="propertyType"][value="single_family"]')
  await page.click('input[name="recentWork"][value="no"]')
}

async function advanceToResults(page: Page) {
  await advanceToStage3(page)
  await fillStage3(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => !!document.querySelector('.plumbing-email-btn'))
}

async function clickActionButton(page: Page, textPattern: RegExp) {
  await page.$eval('.result-actions', (bar: Element, pat: string) => {
    const btn = Array.from(bar.querySelectorAll('button'))
      .find(b => new RegExp(pat, 'i').test(b.textContent || ''))
    ;(btn as HTMLButtonElement | undefined)?.click()
  }, textPattern.source)
}

// ─── 1. Page load and static structure ───────────────────────────────────────

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

test('page title is "Plumbing Service Visit Planner"', async () => {
  const page = await openTool()
  try {
    assert.equal(await page.title(), 'Plumbing Service Visit Planner')
  } finally {
    await page.close()
  }
})

test('header brand shows "Your Plumbing Company"', async () => {
  const page = await openTool()
  try {
    const brand = await page.$eval('.tool-header-brand', el => el.textContent?.trim())
    assert.equal(brand, 'Your Plumbing Company')
  } finally {
    await page.close()
  }
})

test('header title shows "Plumbing Service Visit Planner"', async () => {
  const page = await openTool()
  try {
    const title = await page.$eval('.tool-header-title', el => el.textContent?.trim())
    assert.equal(title, 'Plumbing Service Visit Planner')
  } finally {
    await page.close()
  }
})

test('header demo tag references Websites by Leslie', async () => {
  const page = await openTool()
  try {
    const demo = await page.$eval('.tool-header-demo', el => el.textContent || '')
    assert.match(demo, /Websites by Leslie/i)
  } finally {
    await page.close()
  }
})

test('three-stage progress indicator is present and shows step 1 of 3', async () => {
  const page = await openTool()
  try {
    const count = await page.$eval('.tool-progress-count', el => el.textContent?.trim())
    assert.equal(count, '1 of 3')
  } finally {
    await page.close()
  }
})

test('progress bar has role="status" for accessibility', async () => {
  const page = await openTool()
  try {
    const role = await page.$eval('.tool-progress', el => el.getAttribute('role'))
    assert.equal(role, 'status')
  } finally {
    await page.close()
  }
})

test('privacy notice is present on Stage 1 with correct role', async () => {
  const page = await openTool()
  try {
    const note = await page.$('.tool-privacy-note')
    assert.ok(note, 'Privacy note should exist')
    const role = await note!.evaluate(el => el.getAttribute('role'))
    assert.equal(role, 'note')
    const text = await note!.evaluate(el => el.textContent || '')
    assert.match(text, /stay in your browser/i)
    assert.match(text, /nothing is stored or transmitted/i)
  } finally {
    await page.close()
  }
})

test('noindex meta tag is present', async () => {
  const page = await openTool()
  try {
    const content = await page.$eval('meta[name="robots"]', el => (el as HTMLMetaElement).content)
    assert.match(content, /noindex/)
    assert.match(content, /nofollow/)
  } finally {
    await page.close()
  }
})

// ─── 2. Stage 1 — required fields and concern count ───────────────────────────

test('Stage 1 shows 9 concern type options', async () => {
  const page = await openTool()
  try {
    const opts = await page.$$('input[name="concernType"]')
    assert.equal(opts.length, 9)
  } finally {
    await page.close()
  }
})

test('Stage 1 shows 4 active water options', async () => {
  const page = await openTool()
  try {
    const opts = await page.$$('input[name="activeWater"]')
    assert.equal(opts.length, 4)
  } finally {
    await page.close()
  }
})

test('Stage 1 does not advance when both required fields are empty', async () => {
  const page = await openTool()
  try {
    await page.click('.tool-nav-next')
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'Error banner should appear')
    const stillStage1 = await page.$('input[name="concernType"]')
    assert.ok(stillStage1, 'Should still be on Stage 1')
  } finally {
    await page.close()
  }
})

test('Stage 1 does not advance with only concern type selected', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="concernType"][value="slow_drain"]')
    await page.click('.tool-nav-next')
    const stillStage1 = await page.$('input[name="activeWater"]')
    assert.ok(stillStage1, 'Should still be on Stage 1 without active water status')
  } finally {
    await page.close()
  }
})

test('Stage 1 does not advance with only active water selected', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="activeWater"][value="none_visible"]')
    await page.click('.tool-nav-next')
    const stillStage1 = await page.$('input[name="concernType"]')
    assert.ok(stillStage1, 'Should still be on Stage 1 without concern type')
  } finally {
    await page.close()
  }
})

test('Stage 1 advances with both required fields complete', async () => {
  const page = await openTool()
  try {
    await fillStage1(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="homeArea"]'))
    const onStage2 = await page.$('input[name="homeArea"]')
    assert.ok(onStage2, 'Should be on Stage 2')
  } finally {
    await page.close()
  }
})

test('observations textarea is optional — can advance without it', async () => {
  const page = await openTool()
  try {
    await fillStage1(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="homeArea"]'))
    const onStage2 = await page.$('input[name="homeArea"]')
    assert.ok(onStage2, 'Should advance without observations filled')
  } finally {
    await page.close()
  }
})

// ─── 3. Stage 1 — urgency notice ─────────────────────────────────────────────

test('urgency notice does not appear by default on Stage 1', async () => {
  const page = await openTool()
  try {
    const notice = await page.$('.plumbing-urgency-notice')
    assert.equal(notice, null, 'Urgency notice should not appear before active water is selected')
  } finally {
    await page.close()
  }
})

test('urgency notice appears for "flowing or spreading" selection', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="activeWater"][value="flowing_spreading"]')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-urgency-notice'))
    const notice = await page.$('.plumbing-urgency-notice')
    assert.ok(notice, 'Urgency notice should appear for flowing_spreading')
  } finally {
    await page.close()
  }
})

test('urgency notice has role="note"', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="activeWater"][value="flowing_spreading"]')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-urgency-notice'))
    const role = await page.$eval('.plumbing-urgency-notice', el => el.getAttribute('role'))
    assert.equal(role, 'note')
  } finally {
    await page.close()
  }
})

test('urgency notice uses the approved verbatim wording', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="activeWater"][value="flowing_spreading"]')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-urgency-notice'))
    const text = await page.$eval('.plumbing-urgency-notice', el => el.textContent?.trim() || '')
    assert.match(text, /contact a licensed plumber or emergency plumbing service directly/i)
    assert.match(text, /You do not need to finish this planner first/i)
    assert.match(text, /contact local emergency services/i)
  } finally {
    await page.close()
  }
})

test('urgency notice contains no shutoff or action instructions', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="activeWater"][value="flowing_spreading"]')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-urgency-notice'))
    const text = (await page.$eval('.plumbing-urgency-notice', el => el.textContent || '')).toLowerCase()
    assert.doesNotMatch(text, /turn off|shut off|main valve|close the valve/i)
    assert.doesNotMatch(text, /this is (not )?an emergency/i)
    assert.doesNotMatch(text, /you can wait|not urgent|safe/i)
  } finally {
    await page.close()
  }
})

test('urgency notice does not appear for "slow drip" selection', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="activeWater"][value="slow_drip"]')
    await new Promise(r => setTimeout(r, 200))
    const notice = await page.$('.plumbing-urgency-notice')
    assert.equal(notice, null, 'Urgency notice should not appear for slow_drip')
  } finally {
    await page.close()
  }
})

test('urgency notice does not appear for "none visible" selection', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="activeWater"][value="none_visible"]')
    await new Promise(r => setTimeout(r, 200))
    const notice = await page.$('.plumbing-urgency-notice')
    assert.equal(notice, null, 'Urgency notice should not appear for none_visible')
  } finally {
    await page.close()
  }
})

test('urgency notice does not block form advancement', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="concernType"][value="leak"]')
    await page.click('input[name="activeWater"][value="flowing_spreading"]')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-urgency-notice'))
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="homeArea"]'))
    const onStage2 = await page.$('input[name="homeArea"]')
    assert.ok(onStage2, 'Should advance despite urgency notice being visible')
  } finally {
    await page.close()
  }
})

// ─── 4. Stage 2 — required fields ─────────────────────────────────────────────

test('Stage 2 progress indicator reads "2 of 3"', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const count = await page.$eval('.tool-progress-count', el => el.textContent?.trim())
    assert.equal(count, '2 of 3')
  } finally {
    await page.close()
  }
})

test('Stage 2 shows 8 home area options', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const opts = await page.$$('input[name="homeArea"]')
    assert.equal(opts.length, 8)
  } finally {
    await page.close()
  }
})

test('Stage 2 shows 5 first-noticed options', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const opts = await page.$$('input[name="firstNoticed"]')
    assert.equal(opts.length, 5)
  } finally {
    await page.close()
  }
})

test('Stage 2 shows 5 change-since-then options', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const opts = await page.$$('input[name="changeAnswer"]')
    assert.equal(opts.length, 5)
  } finally {
    await page.close()
  }
})

test('Stage 2 shows 4 history options', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const opts = await page.$$('input[name="history"]')
    assert.equal(opts.length, 4)
  } finally {
    await page.close()
  }
})

test('Stage 2 shows 4 water-elsewhere options', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const opts = await page.$$('input[name="waterElsewhere"]')
    assert.equal(opts.length, 4)
  } finally {
    await page.close()
  }
})

test('Stage 2 does not advance without all 5 required answers', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.click('input[name="homeArea"][value="kitchen"]')
    await page.click('.tool-nav-next')
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'Error banner should appear with only one answer filled')
    const stillStage2 = await page.$('input[name="homeArea"]')
    assert.ok(stillStage2, 'Should still be on Stage 2')
  } finally {
    await page.close()
  }
})

test('Stage 2 fixture field is optional — can advance without it', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await fillStage2(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="propertyType"]'))
    const onStage3 = await page.$('input[name="propertyType"]')
    assert.ok(onStage3, 'Should advance without fixture filled')
  } finally {
    await page.close()
  }
})

test('Stage 2 advances with all 5 required fields', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await fillStage2(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="propertyType"]'))
    const onStage3 = await page.$('input[name="propertyType"]')
    assert.ok(onStage3, 'Should be on Stage 3')
  } finally {
    await page.close()
  }
})

// ─── 5. Stage 3 — required fields and conditional inputs ─────────────────────

test('Stage 3 progress indicator reads "3 of 3"', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const count = await page.$eval('.tool-progress-count', el => el.textContent?.trim())
    assert.equal(count, '3 of 3')
  } finally {
    await page.close()
  }
})

test('Stage 3 shows 5 property type options', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const opts = await page.$$('input[name="propertyType"]')
    assert.equal(opts.length, 5)
  } finally {
    await page.close()
  }
})

test('Stage 3 shows 3 recent-work options', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const opts = await page.$$('input[name="recentWork"]')
    assert.equal(opts.length, 3)
  } finally {
    await page.close()
  }
})

test('Stage 3 shows 4 timing options', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const opts = await page.$$('input[name="timing"]')
    assert.equal(opts.length, 4)
  } finally {
    await page.close()
  }
})

test('Stage 3 shows 4 access options', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const opts = await page.$$('input[name="accessAnswer"]')
    assert.equal(opts.length, 4)
  } finally {
    await page.close()
  }
})

test('Stage 3 does not advance without property type and recent-work', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('.tool-nav-next')
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'Error banner should appear without required answers')
    const stillStage3 = await page.$('input[name="propertyType"]')
    assert.ok(stillStage3, 'Should still be on Stage 3')
  } finally {
    await page.close()
  }
})

test('Stage 3 does not advance without recent-work answer', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('input[name="propertyType"][value="single_family"]')
    await page.click('.tool-nav-next')
    const banner = await page.$('.tool-error-banner')
    assert.ok(banner, 'Error banner should appear without recent-work answer')
  } finally {
    await page.close()
  }
})

test('Stage 3 access and timing fields are optional', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-email-btn'))
    const results = await page.$('.plumbing-email-btn')
    assert.ok(results, 'Should reach results without access or timing filled')
  } finally {
    await page.close()
  }
})

test('recent-work detail field is hidden when recentWork is not "yes"', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('input[name="recentWork"][value="no"]')
    await new Promise(r => setTimeout(r, 200))
    const detail = await page.$('#recentWorkDetail')
    assert.equal(detail, null, 'Detail field should not appear when recentWork is "no"')
  } finally {
    await page.close()
  }
})

test('recent-work detail field appears when recentWork is "yes"', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('input[name="recentWork"][value="yes"]')
    await page.waitForFunction(() => !!document.querySelector('#recentWorkDetail'))
    const detail = await page.$('#recentWorkDetail')
    assert.ok(detail, 'Detail field should appear when recentWork is "yes"')
  } finally {
    await page.close()
  }
})

test('recent-work detail is optional when recentWork is "yes"', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('input[name="propertyType"][value="condo_apartment"]')
    await page.click('input[name="recentWork"][value="yes"]')
    await page.waitForFunction(() => !!document.querySelector('#recentWorkDetail'))
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-email-btn'))
    const results = await page.$('.plumbing-email-btn')
    assert.ok(results, 'Should reach results without filling the detail field')
  } finally {
    await page.close()
  }
})

// ─── 6. Back navigation preserves answers ────────────────────────────────────

test('Back from Stage 2 preserves Stage 1 answers', async () => {
  const page = await openTool()
  try {
    await fillStage1(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="homeArea"]'))
    await page.click('.tool-nav-back')
    await page.waitForFunction(() => !!document.querySelector('input[name="concernType"]'))
    const concern     = await page.$eval('input[name="concernType"][value="slow_drain"]',  (el: Element) => (el as HTMLInputElement).checked)
    const activeWater = await page.$eval('input[name="activeWater"][value="none_visible"]', (el: Element) => (el as HTMLInputElement).checked)
    assert.ok(concern,     'Concern type should be preserved')
    assert.ok(activeWater, 'Active water answer should be preserved')
  } finally {
    await page.close()
  }
})

test('Back from Stage 3 preserves Stage 2 answers', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.type('#fixture', 'Kitchen sink faucet')
    await fillStage2(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="propertyType"]'))
    await page.click('.tool-nav-back')
    await page.waitForFunction(() => !!document.querySelector('input[name="homeArea"]'))
    const homeArea = await page.$eval('input[name="homeArea"][value="main_bathroom"]', (el: Element) => (el as HTMLInputElement).checked)
    const fixture  = await page.$eval('#fixture', (el: Element) => (el as HTMLInputElement).value)
    assert.ok(homeArea,                    'Home area should be preserved')
    assert.equal(fixture, 'Kitchen sink faucet', 'Fixture text should be preserved')
  } finally {
    await page.close()
  }
})

// ─── 7. Complete flow produces Service Visit Brief ────────────────────────────

test('completing all stages produces the results screen', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const emailBtn = await page.$('.plumbing-email-btn')
    assert.ok(emailBtn, 'Email button should appear on results screen')
  } finally {
    await page.close()
  }
})

test('results screen shows "Your Service Visit Brief" heading', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const h1 = await page.$eval('.tool-results-title', el => el.textContent?.trim())
    assert.equal(h1, 'Your Service Visit Brief')
  } finally {
    await page.close()
  }
})

test('results brief shows entered concern type', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // uses 'slow_drain'
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /slow or blocked drain/i)
  } finally {
    await page.close()
  }
})

test('results brief shows active water answer', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // uses 'none_visible'
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /no active water visible/i)
  } finally {
    await page.close()
  }
})

test('results brief shows home area', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // uses 'main_bathroom'
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /main bathroom/i)
  } finally {
    await page.close()
  }
})

test('results brief shows property type', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // uses 'single_family'
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /single-family home/i)
  } finally {
    await page.close()
  }
})

// ─── 8. Urgency flag in brief ─────────────────────────────────────────────────

test('urgency flag "⚠ Active water noted" is absent when active water is not flowing/spreading', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // uses none_visible
    const dts = await page.$$eval('.result-recap-term', els => els.map(el => el.textContent?.trim()))
    assert.ok(!dts.some(t => /active water noted/i.test(t || '')), 'Urgency flag row should not appear for non-flowing answer')
  } finally {
    await page.close()
  }
})

test('urgency flag "⚠ Active water noted" appears in brief when flowing/spreading selected', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="concernType"][value="leak"]')
    await page.click('input[name="activeWater"][value="flowing_spreading"]')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="homeArea"]'))
    await fillStage2(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="propertyType"]'))
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-email-btn'))
    const dts = await page.$$eval('.result-recap-term', els => els.map(el => el.textContent?.trim()))
    assert.ok(dts.some(t => /active water noted/i.test(t || '')), 'Urgency flag row should appear for flowing_spreading')
  } finally {
    await page.close()
  }
})

test('urgency flag in copied text when flowing/spreading', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="concernType"][value="leak"]')
    await page.click('input[name="activeWater"][value="flowing_spreading"]')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="homeArea"]'))
    await fillStage2(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="propertyType"]'))
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-email-btn'))
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
    assert.match(copied, /Active water noted/i)
    assert.match(copied, /actively flowing or spreading/i)
  } finally {
    await page.close()
  }
})

test('urgency flag absent from copied text when active water is not flowing/spreading', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // uses none_visible
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
    assert.doesNotMatch(copied, /Active water noted/i)
  } finally {
    await page.close()
  }
})

// ─── 9. "THE VISIT" section conditional ───────────────────────────────────────

test('"The Visit" section is absent when timing and questions are both blank', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // timing blank, questions blank
    const sectionTitles = await page.$$eval('.result-section-title', els => els.map(el => el.textContent?.trim()))
    assert.ok(!sectionTitles.includes('The Visit'), '"The Visit" section should not appear when both fields blank')
  } finally {
    await page.close()
  }
})

test('"The Visit" section appears when timing preference is selected', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await fillStage3(page)
    await page.click('input[name="timing"][value="next_few_days"]')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-email-btn'))
    const sectionTitles = await page.$$eval('.result-section-title', els => els.map(el => el.textContent?.trim()))
    assert.ok(sectionTitles.includes('The Visit'), '"The Visit" section should appear when timing is selected')
  } finally {
    await page.close()
  }
})

test('"The Visit" section appears when questions are entered', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await fillStage3(page)
    await page.type('#questions', 'Is this covered under my home warranty?')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-email-btn'))
    const sectionTitles = await page.$$eval('.result-section-title', els => els.map(el => el.textContent?.trim()))
    assert.ok(sectionTitles.includes('The Visit'), '"The Visit" section should appear when questions are entered')
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /home warranty/i)
  } finally {
    await page.close()
  }
})

// ─── 10. Empty optional rows are absent ───────────────────────────────────────

test('brief has no blank dt or dd elements when optional fields are skipped', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // only required fields filled
    const blankDts = await page.$$eval('.result-recap-term',   els => els.filter(el => !el.textContent?.trim()).length)
    const blankDds = await page.$$eval('.result-recap-detail', els => els.filter(el => !el.textContent?.trim()).length)
    assert.equal(blankDts, 0, 'No blank dt elements')
    assert.equal(blankDds, 0, 'No blank dd elements')
  } finally {
    await page.close()
  }
})

test('"What I observed" row is absent when observations field is blank', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const dts = await page.$$eval('.result-recap-term', els => els.map(el => el.textContent?.trim()))
    assert.ok(!dts.includes('What I observed'), 'Observations row should not appear when blank')
  } finally {
    await page.close()
  }
})

test('"Fixture or area" row is absent when fixture field is blank', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const dts = await page.$$eval('.result-recap-term', els => els.map(el => el.textContent?.trim()))
    assert.ok(!dts.includes('Fixture or area'), 'Fixture row should not appear when blank')
  } finally {
    await page.close()
  }
})

test('"Access" row is absent when access field is blank', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const dts = await page.$$eval('.result-recap-term', els => els.map(el => el.textContent?.trim()))
    assert.ok(!dts.includes('Access'), 'Access row should not appear when blank')
  } finally {
    await page.close()
  }
})

test('"Recent plumbing work" row shows detail when provided', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('input[name="propertyType"][value="single_family"]')
    await page.click('input[name="recentWork"][value="yes"]')
    await page.waitForFunction(() => !!document.querySelector('#recentWorkDetail'))
    await page.type('#recentWorkDetail', 'replaced kitchen faucet')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.plumbing-email-btn'))
    const briefText = await page.$eval('.result-sections', el => el.textContent || '')
    assert.match(briefText, /replaced kitchen faucet/i)
  } finally {
    await page.close()
  }
})

// ─── 11. Copy Brief ────────────────────────────────────────────────────────────

test('Copy Brief writes text to clipboard', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied)
    assert.ok(typeof copied === 'string' && copied.length > 0, 'Should write text to clipboard')
  } finally {
    await page.close()
  }
})

test('copied text contains "PLUMBING SERVICE VISIT BRIEF" header', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
    assert.match(copied, /PLUMBING SERVICE VISIT BRIEF/)
  } finally {
    await page.close()
  }
})

test('copied text contains the concern type label', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
    assert.match(copied, /Slow or blocked drain/i)
  } finally {
    await page.close()
  }
})

test('copied text contains the disclaimer', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string)
    assert.match(copied, /not a diagnosis|not a plumbing diagnosis/i)
  } finally {
    await page.close()
  }
})

test('copy success is announced via accessible live region', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await page.waitForFunction(() => {
      const el = document.querySelector('[role="status"]')
      return el && /copied/i.test(el.textContent || '')
    })
    const statusText = await page.$eval('[role="status"]', el => el.textContent || '')
    assert.match(statusText, /copied/i)
  } finally {
    await page.close()
  }
})

test('live region has aria-live="polite" and aria-atomic="true"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const attrs = await page.$eval('.result-copy-status', el => ({
      live:   el.getAttribute('aria-live'),
      atomic: el.getAttribute('aria-atomic'),
      role:   el.getAttribute('role'),
    }))
    assert.equal(attrs.live,   'polite')
    assert.equal(attrs.atomic, 'true')
    assert.equal(attrs.role,   'status')
  } finally {
    await page.close()
  }
})

// ─── 12. Share Brief ──────────────────────────────────────────────────────────

test('Share button is absent when navigator.share is not available', async () => {
  const page = await openTool(false)
  try {
    await advanceToResults(page)
    const hasShare = await page.$eval('.result-actions', bar => {
      return Array.from(bar.querySelectorAll('button')).some(b => /share/i.test(b.textContent || ''))
    })
    assert.equal(hasShare, false)
  } finally {
    await page.close()
  }
})

test('Share button is present when navigator.share is available', async () => {
  const page = await openTool(true)
  try {
    await advanceToResults(page)
    const hasShare = await page.$eval('.result-actions', bar => {
      return Array.from(bar.querySelectorAll('button')).some(b => /share/i.test(b.textContent || ''))
    })
    assert.ok(hasShare)
  } finally {
    await page.close()
  }
})

test('Share button invokes navigator.share with the complete brief', async () => {
  const page = await openTool(true)
  try {
    await advanceToResults(page)
    await clickActionButton(page, /share brief/i)
    await new Promise(r => setTimeout(r, 300))
    const shared = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastShared as Record<string, string>)
    assert.ok(shared)
    assert.match(shared.text, /PLUMBING SERVICE VISIT BRIEF/)
    assert.match(shared.title, /plumbing|service|visit/i)
  } finally {
    await page.close()
  }
})

// ─── 13. Print rules ──────────────────────────────────────────────────────────

test('action bar and email button have no-print class', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const actionBarHasNoPrint  = await page.$eval('.result-actions',     el => el.classList.contains('no-print'))
    const emailCtaHasNoPrint   = await page.$eval('.plumbing-email-cta', el => el.classList.contains('no-print'))
    assert.ok(actionBarHasNoPrint, 'Action bar should have no-print class')
    assert.ok(emailCtaHasNoPrint,  'Email CTA should have no-print class')
  } finally {
    await page.close()
  }
})

test('customer name row has no-print class', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const hasNoPrint = await page.$eval('.plumbing-name-row', el => el.classList.contains('no-print'))
    assert.ok(hasNoPrint)
  } finally {
    await page.close()
  }
})

test('Websites by Leslie CTA has no-print class', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const hasNoPrint = await page.$eval('.tool-sales-cta', el => el.classList.contains('no-print'))
    assert.ok(hasNoPrint)
  } finally {
    await page.close()
  }
})

// ─── 14. Email the Plumber ────────────────────────────────────────────────────

test('Email the Plumber button exists on results screen', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const btn = await page.$('.plumbing-email-btn')
    assert.ok(btn)
  } finally {
    await page.close()
  }
})

test('mailto href has blank recipient in the public demo', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.plumbing-email-btn', el => el.getAttribute('href') || '')
    assert.ok(href.startsWith('mailto:?'), `href should start with "mailto:?", got: ${href.slice(0, 50)}`)
  } finally {
    await page.close()
  }
})

test('mailto subject contains "Plumbing Service Visit Brief"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.plumbing-email-btn', el => el.getAttribute('href') || '')
    assert.match(decodeURIComponent(href), /Plumbing Service Visit Brief/i)
  } finally {
    await page.close()
  }
})

test('mailto subject includes the concern type', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page) // slow_drain
    const href = await page.$eval('.plumbing-email-btn', el => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(href)
    assert.match(decoded, /slow or blocked drain/i)
  } finally {
    await page.close()
  }
})

test('mailto body contains "PLUMBING SERVICE VISIT BRIEF" header', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.plumbing-email-btn', el => el.getAttribute('href') || '')
    assert.match(decodeURIComponent(href), /PLUMBING SERVICE VISIT BRIEF/)
  } finally {
    await page.close()
  }
})

test('entering customer name updates the brief and adds "Prepared by"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await page.type('#customerName', 'Karen')
    await page.waitForFunction(() => {
      const btn = document.querySelector('.plumbing-email-btn') as HTMLAnchorElement | null
      return btn?.href.includes('Karen') || btn?.href.includes(encodeURIComponent('Karen'))
    })
    const href = await page.$eval('.plumbing-email-btn', el => el.getAttribute('href') || '')
    const decoded = decodeURIComponent(href)
    assert.match(decoded, /Karen/)
    assert.match(decoded, /Prepared by/i)
  } finally {
    await page.close()
  }
})

// ─── 15. Edit Answers and Start Over ─────────────────────────────────────────

test('Edit Answers returns to Stage 1 with answers preserved', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /edit answers/i)
    await page.waitForFunction(() => !!document.querySelector('input[name="concernType"]'))
    const concern = await page.$eval('input[name="concernType"][value="slow_drain"]', (el: Element) => (el as HTMLInputElement).checked)
    assert.ok(concern, 'Concern type should be preserved after Edit Answers')
  } finally {
    await page.close()
  }
})

test('Start Over shows the confirmation dialog', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /start over/i)
    await page.waitForFunction(() => !!document.querySelector('.tool-confirm-backdrop'))
    const dialog = await page.$('.tool-confirm-dialog')
    assert.ok(dialog)
  } finally {
    await page.close()
  }
})

test('Start Over cancel keeps results', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /start over/i)
    await page.waitForFunction(() => !!document.querySelector('.tool-confirm-backdrop'))
    await page.click('.tool-confirm-cancel')
    await page.waitForFunction(() => !document.querySelector('.tool-confirm-backdrop'))
    const results = await page.$('.plumbing-email-btn')
    assert.ok(results, 'Results should still be visible after cancel')
  } finally {
    await page.close()
  }
})

test('Start Over confirm clears all answers and returns to Stage 1', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /start over/i)
    await page.waitForFunction(() => !!document.querySelector('.tool-confirm-backdrop'))
    await page.click('.tool-confirm-proceed')
    await page.waitForFunction(() => !!document.querySelector('input[name="concernType"]'))
    const concern = await page.$eval('input[name="concernType"][value="slow_drain"]', (el: Element) => (el as HTMLInputElement).checked)
    assert.equal(concern, false, 'Concern type should be cleared after Start Over')
  } finally {
    await page.close()
  }
})

// ─── 16. Websites by Leslie CTA ──────────────────────────────────────────────

test('CTA heading is "Want a service visit planner like this for your business?"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const heading = await page.$eval('.tool-sales-cta-heading', el => el.textContent?.trim())
    assert.equal(heading, 'Want a service visit planner like this for your business?')
  } finally {
    await page.close()
  }
})

test('CTA body text mentions services, customer questions, and brand', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const body = await page.$eval('.tool-sales-cta-body', el => el.textContent || '')
    assert.match(body, /services/i)
    assert.match(body, /customer questions|brand/i)
  } finally {
    await page.close()
  }
})

test('CTA button text is "Ask About a Custom Planner →"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const linkText = await page.$eval('.tool-sales-cta-link', el => el.textContent?.trim())
    assert.match(linkText || '', /Ask About a Custom Planner/)
  } finally {
    await page.close()
  }
})

test('CTA button opens mailto to websitesbyleslie01@gmail.com with correct subject', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.tool-sales-cta-link', el => el.getAttribute('href') || '')
    assert.match(href, /mailto:websitesbyleslie01@gmail\.com/)
    assert.ok(href.includes('Plumbing%20Service%20Visit%20Inquiry'), `CTA subject must be "Plumbing Service Visit Inquiry", got: "${href}"`)
  } finally {
    await page.close()
  }
})

test('CTA hosted-link bullet uses approved delivery wording', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const items = await page.$$eval('.tool-sales-cta-features li', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(
      items.some(i => /hosted as a standalone page.*website provider can link/i.test(i)),
      `Expected hosted-link bullet, got: ${JSON.stringify(items)}`
    )
    assert.ok(
      items.every(i => !/added to your existing website/i.test(i)),
      'Old "Added to your existing website" wording must not appear in CTA bullets'
    )
  } finally {
    await page.close()
  }
})

// ─── 17. Results disclaimer ───────────────────────────────────────────────────

test('disclaimer is present on results screen with role="note"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const disclaimer = await page.$('.tool-disclaimer')
    assert.ok(disclaimer)
    const role = await disclaimer!.evaluate(el => el.getAttribute('role'))
    assert.equal(role, 'note')
  } finally {
    await page.close()
  }
})

test('disclaimer says it is not a diagnosis or estimate', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const text = await page.$eval('.tool-disclaimer', el => el.textContent || '')
    assert.match(text, /not a (plumbing )?diagnosis/i)
    assert.doesNotMatch(text, /this is an emergency|this is not an emergency/i)
  } finally {
    await page.close()
  }
})

// ─── 18. Services page four-card layout ──────────────────────────────────────

test('services page has four demo cards', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const cards = await page.$$('.pricing-demo-card')
    assert.equal(cards.length, 4, 'Should have four demo cards')
  } finally {
    await page.close()
  }
})

test('services page has a demo card for the Plumbing Service Visit Planner', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const titles = await page.$$eval('.pricing-demo-card-title', els => els.map(el => el.textContent?.trim()))
    assert.ok(titles.some(t => /plumbing/i.test(t || '')), 'Should have plumbing card title')
  } finally {
    await page.close()
  }
})

test('services page plumbing demo link points to /tools-plumbing-visit', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const links = await page.$$eval('.pricing-demo-link', els => els.map(el => el.getAttribute('href')))
    assert.ok(links.includes('/tools-plumbing-visit'), 'Should have link to /tools-plumbing-visit')
  } finally {
    await page.close()
  }
})

test('services page bakery demo link still points to /tools-custom-bakery-order', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/services.html`, { waitUntil: 'load' })
    const links = await page.$$eval('.pricing-demo-link', els => els.map(el => el.getAttribute('href')))
    assert.ok(links.includes('/tools-custom-bakery-order'), 'Bakery link should still be present')
  } finally {
    await page.close()
  }
})

// ─── 19. No horizontal overflow at key viewports ──────────────────────────────

for (const viewport of [320, 375, 390, 768, 1440]) {
  test(`no horizontal overflow at ${viewport}px on Stage 1`, async () => {
    const page = await openTool()
    try {
      await page.setViewport({ width: viewport, height: 900 })
      await page.goto(`${baseUrl}/tools-plumbing-visit.html`, { waitUntil: 'load' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 0, `Expected no overflow at ${viewport}px, got ${overflow}px`)
    } finally {
      await page.close()
    }
  })
}

test('no horizontal overflow at 375px on results screen', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 375, height: 812 })
    await advanceToResults(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `Expected no overflow on results at 375px, got ${overflow}px`)
  } finally {
    await page.close()
  }
})

test('no horizontal overflow at 320px on results screen', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 320, height: 568 })
    await advanceToResults(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 0, `Expected no overflow on results at 320px, got ${overflow}px`)
  } finally {
    await page.close()
  }
})

// ─── 20. Touch target minimum sizes ───────────────────────────────────────────

test('all buttons meet 44px minimum height on Stage 1', async () => {
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
    assert.deepEqual(smallBtns, [], `Buttons smaller than 44px: ${JSON.stringify(smallBtns)}`)
  } finally {
    await page.close()
  }
})

test('all OptionCard labels meet 44px minimum height on Stage 1', async () => {
  const page = await openTool()
  try {
    await page.setViewport({ width: 375, height: 812 })
    const smallCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.option-card'))
      return cards
        .filter(card => {
          const r = card.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && r.height < 44
        })
        .map(card => card.textContent?.trim()?.slice(0, 40))
    })
    assert.deepEqual(smallCards, [], `OptionCards smaller than 44px: ${JSON.stringify(smallCards)}`)
  } finally {
    await page.close()
  }
})

// ─── 21. Accessibility ────────────────────────────────────────────────────────

test('Stage 1 has fieldsets with legend elements for all radio groups', async () => {
  const page = await openTool()
  try {
    const fieldsets = await page.$$('fieldset.tool-question-fieldset')
    assert.ok(fieldsets.length >= 2, 'Should have at least 2 fieldsets on Stage 1')
    for (const fs of fieldsets) {
      const legend = await fs.$('legend')
      assert.ok(legend, 'Each fieldset should have a legend')
    }
  } finally {
    await page.close()
  }
})

test('Stage 1 validation failure triggers role="alert" on field errors', async () => {
  const page = await openTool()
  try {
    await page.click('.tool-nav-next')
    const alerts = await page.$$('[role="alert"]')
    assert.ok(alerts.length > 0, 'At least one role="alert" element should appear on validation failure')
  } finally {
    await page.close()
  }
})

test('Stage 2 validation failure triggers role="alert"', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.click('.tool-nav-next')
    const alerts = await page.$$('[role="alert"]')
    assert.ok(alerts.length > 0)
  } finally {
    await page.close()
  }
})

test('Stage 3 validation failure triggers role="alert"', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('.tool-nav-next')
    const alerts = await page.$$('[role="alert"]')
    assert.ok(alerts.length > 0)
  } finally {
    await page.close()
  }
})

// ─── 22. No network requests, storage, or submission ──────────────────────────

test('localStorage and sessionStorage are empty throughout the flow', async () => {
  const page = await openTool()
  try {
    await fillStage1(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="homeArea"]'))
    const storage = await page.evaluate(() => ({
      local:   Object.keys(localStorage).length,
      session: Object.keys(sessionStorage).length,
    }))
    assert.equal(storage.local,   0, 'localStorage should be empty')
    assert.equal(storage.session, 0, 'sessionStorage should be empty')
  } finally {
    await page.close()
  }
})

test('no form elements with an action attribute exist in the tool', async () => {
  const page = await openTool()
  try {
    const formsWithAction = await page.$$eval('form[action]', els => els.length)
    assert.equal(formsWithAction, 0)
  } finally {
    await page.close()
  }
})

test('no file upload inputs exist anywhere in the tool', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const uploads = await page.$$('input[type="file"]')
    assert.equal(uploads.length, 0)
  } finally {
    await page.close()
  }
})

test('brief contains no scheduling confirmation, pricing, or diagnostic language', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const bodyText = await page.$eval('body', el => el.textContent || '')
    assert.doesNotMatch(bodyText, /appointment confirmed|booking confirmed|order confirmed/i)
    assert.doesNotMatch(bodyText, /the problem is|you have a|the cause is|you need a new/i)
    assert.doesNotMatch(bodyText, /this is (not )?an emergency/i)
    assert.doesNotMatch(bodyText, /turn off|shut off.*valve|shutoff/i)
  } finally {
    await page.close()
  }
})

// ─── 23. Regression — all existing tools still load ───────────────────────────

async function checkToolLoads(filePath: string, pattern: RegExp): Promise<boolean> {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/${filePath}`, { waitUntil: 'load' })
    return pattern.test(await page.title())
  } finally {
    await page.close()
  }
}

test('Regression: Buyer Readiness Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-buyer.html', /buyer/i))
})

test('Regression: Seller Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-seller.html', /seller/i))
})

test('Regression: Listing Preparation Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-listing-preparation.html', /listing/i))
})

test('Regression: Property Comparison Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-property-comparison.html', /property|comparison/i))
})

test('Regression: Open House Follow-Up Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-open-house-follow-up.html', /open house|follow.up/i))
})

test('Regression: Closing & Moving Organizer still loads', async () => {
  assert.ok(await checkToolLoads('tools-closing-moving.html', /closing|moving/i))
})

test('Regression: Custom Bakery Order Planner still loads', async () => {
  assert.ok(await checkToolLoads('tools-custom-bakery-order.html', /bakery|custom/i))
})
