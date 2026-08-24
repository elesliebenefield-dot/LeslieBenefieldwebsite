// Browser integration tests for the Food Truck Event Planner.
// Validates the 3-stage workflow: Event basics → Food and service →
// Venue and logistics → Event Service Inquiry Brief.
//
// Runs against the production build (dist/) via a lightweight static HTTP server.
// Run with: node --test test/tools/foodTruckEventPlanner.test.ts

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
  await page.goto(`${baseUrl}/tools-food-truck-event.html`, { waitUntil: 'load' })
  return page
}

async function fillStage1Confirmed(page: Page) {
  await page.click('input[name="eventType"][value="corporate_workplace"]')
  await page.click('input[name="eventDateStatus"][value="confirmed"]')
  await page.waitForSelector('input#eventDate')
  await page.$eval('input#eventDate', (el: Element) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(el, '2026-10-10')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.click('input#venueName', { clickCount: 3 })
  await page.type('input#venueName', 'TechCo headquarters, Austin TX')
  await page.click('input[name="isPublic"][value="private"]')
  await page.click('input[name="attendance"][value="150_to_300"]')
  await page.click('input[name="serviceWindow"][value="lunch_midday"]')
}

async function fillStage1Tbd(page: Page) {
  await page.click('input[name="eventType"][value="birthday_celebration"]')
  await page.click('input[name="eventDateStatus"][value="tbd"]')
  await page.click('input#dateNotes', { clickCount: 3 })
  await page.type('input#dateNotes', 'Targeting any Saturday in October')
  await page.click('input#venueName', { clickCount: 3 })
  await page.type('input#venueName', 'Riverside Park, Austin TX')
  await page.click('input[name="isPublic"][value="public"]')
  await page.click('input[name="attendance"][value="25_to_75"]')
  await page.click('input[name="serviceWindow"][value="afternoon"]')
}

async function advanceToStage2(page: Page) {
  await fillStage1Confirmed(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => !!document.querySelector('input[name="serviceType"]'))
}

async function fillStage2(page: Page) {
  await page.click('input[name="serviceType"][value="full_meals"]')
  await page.click('input[name="paymentArrangement"][value="host_paid"]')
}

async function advanceToStage3(page: Page) {
  await advanceToStage2(page)
  await fillStage2(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => !!document.querySelector('input[name="setupSpace"]'))
}

async function fillStage3(page: Page) {
  await page.click('input[name="setupSpace"][value="yes_dedicated"]')
}

async function advanceToResults(page: Page) {
  await advanceToStage3(page)
  await fillStage3(page)
  await page.click('.tool-nav-next')
  await page.waitForFunction(() => !!document.querySelector('.food-truck-email-btn'))
}

async function clickActionButton(page: Page, textPattern: RegExp) {
  await page.$eval('.result-actions', (bar: Element, pat: string) => {
    const btn = Array.from(bar.querySelectorAll('button'))
      .find(b => new RegExp(pat, 'i').test(b.textContent || ''))
    ;(btn as HTMLButtonElement | undefined)?.click()
  }, textPattern.source)
}

async function openViewport(width: number): Promise<Page> {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.resolve() },
      writable: true, configurable: true,
    })
  })
  await page.setViewport({ width, height: 900 })
  await page.goto(`${baseUrl}/tools-food-truck-event.html`, { waitUntil: 'load' })
  return page
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

test('page title is "Food Truck Event Planner"', async () => {
  const page = await openTool()
  try {
    assert.equal(await page.title(), 'Food Truck Event Planner')
  } finally {
    await page.close()
  }
})

test('noindex, nofollow meta tag is present', async () => {
  const page = await openTool()
  try {
    const content = await page.$eval('meta[name="robots"]', el => el.getAttribute('content') ?? '')
    assert.ok(content.includes('noindex'), `expected noindex, got: "${content}"`)
    assert.ok(content.includes('nofollow'), `expected nofollow, got: "${content}"`)
  } finally {
    await page.close()
  }
})

test('header brand is "Your Mobile Food Business"', async () => {
  const page = await openTool()
  try {
    const brand = await page.$eval('.tool-header-brand', el => el.textContent?.trim() ?? '')
    assert.equal(brand, 'Your Mobile Food Business')
  } finally {
    await page.close()
  }
})

test('header title is "Food Truck Event Planner"', async () => {
  const page = await openTool()
  try {
    const title = await page.$eval('.tool-header-title', el => el.textContent?.trim() ?? '')
    assert.equal(title, 'Food Truck Event Planner')
  } finally {
    await page.close()
  }
})

test('progress shows "1 of 3" on Stage 1', async () => {
  const page = await openTool()
  try {
    const count = await page.$eval('.tool-progress-count', el => el.textContent?.trim() ?? '')
    assert.equal(count, '1 of 3')
  } finally {
    await page.close()
  }
})

test('privacy note is present on Stage 1 with role="note"', async () => {
  const page = await openTool()
  try {
    const note = await page.$eval('.tool-privacy-note', el => ({
      text: el.textContent ?? '',
      role: el.getAttribute('role'),
    }))
    assert.ok(note.text.includes('browser'), `privacy note missing browser reference`)
    assert.equal(note.role, 'note')
  } finally {
    await page.close()
  }
})

test('privacy note does not appear on Stage 2', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const note = await page.$('.tool-privacy-note')
    assert.equal(note, null, 'privacy note must not be present on Stage 2')
  } finally {
    await page.close()
  }
})

// ─── 2. Stage 1 — form rendering ─────────────────────────────────────────────

test('Stage 1 renders all required event type options', async () => {
  const page = await openTool()
  try {
    const values = await page.$$eval('input[name="eventType"]', els => els.map(el => (el as HTMLInputElement).value))
    assert.ok(values.includes('birthday_celebration'), 'missing birthday_celebration')
    assert.ok(values.includes('corporate_workplace'),  'missing corporate_workplace')
    assert.ok(values.includes('wedding_reception'),    'missing wedding_reception')
    assert.ok(values.includes('festival_fair_market'), 'missing festival_fair_market')
    assert.ok(values.includes('school_nonprofit'),     'missing school_nonprofit')
    assert.ok(values.includes('community_neighborhood'),'missing community_neighborhood')
    assert.ok(values.includes('other'),                'missing other')
    assert.equal(values.length, 7, `expected 7 event type options, got ${values.length}`)
  } finally {
    await page.close()
  }
})

test('Stage 1 renders date status options: confirmed and tbd', async () => {
  const page = await openTool()
  try {
    const values = await page.$$eval('input[name="eventDateStatus"]', els => els.map(el => (el as HTMLInputElement).value))
    assert.ok(values.includes('confirmed'), 'missing confirmed')
    assert.ok(values.includes('tbd'),       'missing tbd')
    assert.equal(values.length, 2)
  } finally {
    await page.close()
  }
})

test('date input is not shown until "confirmed" is selected', async () => {
  const page = await openTool()
  try {
    const beforeSelect = await page.$('input#eventDate')
    assert.equal(beforeSelect, null, 'date input must not be visible before selecting confirmed')
    await page.click('input[name="eventDateStatus"][value="confirmed"]')
    await page.waitForSelector('input#eventDate')
    const afterSelect = await page.$('input#eventDate')
    assert.ok(afterSelect !== null, 'date input must appear after selecting confirmed')
  } finally {
    await page.close()
  }
})

test('selecting "tbd" hides the date input and shows date notes', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="eventDateStatus"][value="tbd"]')
    await new Promise(r => setTimeout(r, 100))
    const dateInput = await page.$('input#eventDate')
    assert.equal(dateInput, null, 'date input must not be present when tbd selected')
    const notesInput = await page.$('input#dateNotes')
    assert.ok(notesInput !== null, 'date notes input must be present')
  } finally {
    await page.close()
  }
})

test('Stage 1 renders 6 attendance options including not_sure', async () => {
  const page = await openTool()
  try {
    const values = await page.$$eval('input[name="attendance"]', els => els.map(el => (el as HTMLInputElement).value))
    assert.equal(values.length, 6)
    assert.ok(values.includes('not_sure'), 'missing not_sure option')
    assert.ok(values.includes('over_300'), 'missing over_300 option')
  } finally {
    await page.close()
  }
})

test('Stage 1 renders 6 service window options', async () => {
  const page = await openTool()
  try {
    const values = await page.$$eval('input[name="serviceWindow"]', els => els.map(el => (el as HTMLInputElement).value))
    assert.equal(values.length, 6)
    assert.ok(values.includes('morning'),       'missing morning')
    assert.ok(values.includes('lunch_midday'),  'missing lunch_midday')
    assert.ok(values.includes('evening'),       'missing evening')
    assert.ok(values.includes('not_sure'),      'missing not_sure')
  } finally {
    await page.close()
  }
})

test('Stage 1 indoor/outdoor is optional and renders 4 options', async () => {
  const page = await openTool()
  try {
    const values = await page.$$eval('input[name="settingType"]', els => els.map(el => (el as HTMLInputElement).value))
    assert.equal(values.length, 4)
    assert.ok(values.includes('outdoor'),      'missing outdoor')
    assert.ok(values.includes('not_sure'),     'missing not_sure')
  } finally {
    await page.close()
  }
})

test('all Stage 1 required fieldset legends have a fieldset wrapper', async () => {
  const page = await openTool()
  try {
    const fieldsets = await page.$$eval('fieldset', els => els.map(el => el.querySelector('legend')?.textContent?.trim() ?? ''))
    assert.ok(fieldsets.some(t => /event is this/i.test(t)), 'event type fieldset missing')
    assert.ok(fieldsets.some(t => /confirmed event date/i.test(t)), 'date status fieldset missing')
    assert.ok(fieldsets.some(t => /public or private/i.test(t)), 'public/private fieldset missing')
    assert.ok(fieldsets.some(t => /how many people/i.test(t)), 'attendance fieldset missing')
    assert.ok(fieldsets.some(t => /food service/i.test(t)), 'service window fieldset missing')
  } finally {
    await page.close()
  }
})

// ─── 3. Stage 1 — validation ─────────────────────────────────────────────────

test('Stage 1 does not advance without event type', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="eventDateStatus"][value="confirmed"]')
    await page.waitForSelector('input#eventDate')
    await page.type('input#eventDate', '2026-10-10')
    await page.type('input#venueName', 'Test Venue')
    await page.click('input[name="isPublic"][value="private"]')
    await page.click('input[name="attendance"][value="25_to_75"]')
    await page.click('input[name="serviceWindow"][value="morning"]')
    await page.click('.tool-nav-next')
    await new Promise(r => setTimeout(r, 200))
    const serviceType = await page.$('input[name="serviceType"]')
    assert.equal(serviceType, null, 'should not have advanced to Stage 2')
    const errorBanner = await page.$('[role="alert"]')
    assert.ok(errorBanner !== null, 'error banner must be present')
  } finally {
    await page.close()
  }
})

test('Stage 1 does not advance without date status', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="eventType"][value="corporate_workplace"]')
    await page.type('input#venueName', 'Test Venue')
    await page.click('input[name="isPublic"][value="private"]')
    await page.click('input[name="attendance"][value="25_to_75"]')
    await page.click('input[name="serviceWindow"][value="morning"]')
    await page.click('.tool-nav-next')
    await new Promise(r => setTimeout(r, 200))
    const serviceType = await page.$('input[name="serviceType"]')
    assert.equal(serviceType, null)
  } finally {
    await page.close()
  }
})

test('Stage 1 with confirmed date status requires a non-empty date', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="eventType"][value="corporate_workplace"]')
    await page.click('input[name="eventDateStatus"][value="confirmed"]')
    await page.type('input#venueName', 'Test Venue')
    await page.click('input[name="isPublic"][value="private"]')
    await page.click('input[name="attendance"][value="25_to_75"]')
    await page.click('input[name="serviceWindow"][value="morning"]')
    await page.click('.tool-nav-next')
    await new Promise(r => setTimeout(r, 200))
    const serviceType = await page.$('input[name="serviceType"]')
    assert.equal(serviceType, null, 'must not advance without a date when confirmed is selected')
  } finally {
    await page.close()
  }
})

test('Stage 1 with tbd date status requires date notes', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="eventType"][value="corporate_workplace"]')
    await page.click('input[name="eventDateStatus"][value="tbd"]')
    // dateNotes left blank
    await page.type('input#venueName', 'Test Venue')
    await page.click('input[name="isPublic"][value="private"]')
    await page.click('input[name="attendance"][value="25_to_75"]')
    await page.click('input[name="serviceWindow"][value="morning"]')
    await page.click('.tool-nav-next')
    await new Promise(r => setTimeout(r, 200))
    const serviceType = await page.$('input[name="serviceType"]')
    assert.equal(serviceType, null, 'must not advance without date notes when tbd is selected')
  } finally {
    await page.close()
  }
})

test('Stage 1 does not advance without venue name', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="eventType"][value="corporate_workplace"]')
    await page.click('input[name="eventDateStatus"][value="confirmed"]')
    await page.waitForSelector('input#eventDate')
    await page.type('input#eventDate', '2026-10-10')
    // venueName left blank
    await page.click('input[name="isPublic"][value="private"]')
    await page.click('input[name="attendance"][value="25_to_75"]')
    await page.click('input[name="serviceWindow"][value="morning"]')
    await page.click('.tool-nav-next')
    await new Promise(r => setTimeout(r, 200))
    const serviceType = await page.$('input[name="serviceType"]')
    assert.equal(serviceType, null)
  } finally {
    await page.close()
  }
})

test('Stage 1 does not advance without attendance', async () => {
  const page = await openTool()
  try {
    await page.click('input[name="eventType"][value="corporate_workplace"]')
    await page.click('input[name="eventDateStatus"][value="confirmed"]')
    await page.waitForSelector('input#eventDate')
    await page.type('input#eventDate', '2026-10-10')
    await page.type('input#venueName', 'Test Venue')
    await page.click('input[name="isPublic"][value="private"]')
    // attendance left blank
    await page.click('input[name="serviceWindow"][value="morning"]')
    await page.click('.tool-nav-next')
    await new Promise(r => setTimeout(r, 200))
    const serviceType = await page.$('input[name="serviceType"]')
    assert.equal(serviceType, null)
  } finally {
    await page.close()
  }
})

test('Stage 1 advances when all required fields filled (confirmed date)', async () => {
  const page = await openTool()
  try {
    await fillStage1Confirmed(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="serviceType"]'), { timeout: 5000 })
    const progress = await page.$eval('.tool-progress-count', el => el.textContent?.trim() ?? '')
    assert.equal(progress, '2 of 3')
  } finally {
    await page.close()
  }
})

test('Stage 1 advances when all required fields filled (tbd date)', async () => {
  const page = await openTool()
  try {
    await fillStage1Tbd(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="serviceType"]'), { timeout: 5000 })
    const progress = await page.$eval('.tool-progress-count', el => el.textContent?.trim() ?? '')
    assert.equal(progress, '2 of 3')
  } finally {
    await page.close()
  }
})

// ─── 4. Stage 2 — form rendering ─────────────────────────────────────────────

test('Stage 2 renders 9 service type checkboxes', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const inputs = await page.$$eval('input[name="serviceType"]', els => els.map(el => ({
      value: (el as HTMLInputElement).value,
      type:  (el as HTMLInputElement).type,
    })))
    assert.equal(inputs.length, 9, `expected 9 service type options, got ${inputs.length}`)
    assert.ok(inputs.every(i => i.type === 'checkbox'), 'all service type inputs must be checkboxes')
    const values = inputs.map(i => i.value)
    assert.ok(values.includes('full_meals'),    'missing full_meals')
    assert.ok(values.includes('coffee'),        'missing coffee')
    assert.ok(values.includes('frozen_treats'), 'missing frozen_treats')
    assert.ok(values.includes('other'),         'missing other')
  } finally {
    await page.close()
  }
})

test('Stage 2 multiple service types can be selected simultaneously', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.click('input[name="serviceType"][value="full_meals"]')
    await page.click('input[name="serviceType"][value="coffee"]')
    await page.click('input[name="serviceType"][value="desserts"]')
    const checked = await page.$$eval('input[name="serviceType"]:checked', els => els.map(el => (el as HTMLInputElement).value))
    assert.deepEqual(checked.sort(), ['coffee', 'desserts', 'full_meals'])
  } finally {
    await page.close()
  }
})

test('Stage 2 renders 4 payment arrangement options', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const values = await page.$$eval('input[name="paymentArrangement"]', els => els.map(el => (el as HTMLInputElement).value))
    assert.equal(values.length, 4)
    assert.ok(values.includes('host_paid'),   'missing host_paid')
    assert.ok(values.includes('guest_paid'),  'missing guest_paid')
    assert.ok(values.includes('combination'), 'missing combination')
    assert.ok(values.includes('not_sure'),    'missing not_sure')
  } finally {
    await page.close()
  }
})

test('Stage 2 renders 5 budget options including prefer_not_say', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const values = await page.$$eval('input[name="budget"]', els => els.map(el => (el as HTMLInputElement).value))
    assert.equal(values.length, 5)
    assert.ok(values.includes('prefer_not_say'), 'missing prefer_not_say')
    assert.ok(values.includes('under_500'),      'missing under_500')
    assert.ok(values.includes('over_3000'),      'missing over_3000')
  } finally {
    await page.close()
  }
})

test('Stage 2 dietary caution has role="note"', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    const caution = await page.$eval('.food-truck-dietary-caution', el => ({
      role: el.getAttribute('role'),
      text: el.textContent ?? '',
    }))
    assert.equal(caution.role, 'note')
    assert.ok(/confirm.*directly.*vendor|vendor.*confirm/i.test(caution.text), `dietary caution text unexpected: "${caution.text}"`)
  } finally {
    await page.close()
  }
})

// ─── 5. Stage 2 — validation ─────────────────────────────────────────────────

test('Stage 2 does not advance without any service type selected', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.click('input[name="paymentArrangement"][value="host_paid"]')
    // no service type checked
    await page.click('.tool-nav-next')
    await new Promise(r => setTimeout(r, 200))
    const setupSpace = await page.$('input[name="setupSpace"]')
    assert.equal(setupSpace, null, 'must not advance to Stage 3 without service type')
    const error = await page.$('[role="alert"]')
    assert.ok(error !== null, 'error banner must appear')
  } finally {
    await page.close()
  }
})

test('Stage 2 does not advance without payment arrangement', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.click('input[name="serviceType"][value="full_meals"]')
    // no payment arrangement
    await page.click('.tool-nav-next')
    await new Promise(r => setTimeout(r, 200))
    const setupSpace = await page.$('input[name="setupSpace"]')
    assert.equal(setupSpace, null)
  } finally {
    await page.close()
  }
})

test('Stage 2 advances with service type and payment arrangement selected', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await fillStage2(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="setupSpace"]'), { timeout: 5000 })
    const progress = await page.$eval('.tool-progress-count', el => el.textContent?.trim() ?? '')
    assert.equal(progress, '3 of 3')
  } finally {
    await page.close()
  }
})

// ─── 6. Stage 3 — form rendering ─────────────────────────────────────────────

test('Stage 3 renders 4 setup space options', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const values = await page.$$eval('input[name="setupSpace"]', els => els.map(el => (el as HTMLInputElement).value))
    assert.equal(values.length, 4)
    assert.ok(values.includes('yes_dedicated'),  'missing yes_dedicated')
    assert.ok(values.includes('not_sure'),        'missing not_sure')
  } finally {
    await page.close()
  }
})

test('Stage 3 renders vehicle access, surface type, electricity, and water access options', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const vehicleValues = await page.$$eval('input[name="vehicleAccess"]', els => els.length)
    const surfaceValues = await page.$$eval('input[name="surfaceType"]', els => els.length)
    const electricValues = await page.$$eval('input[name="electricity"]', els => els.length)
    const waterValues   = await page.$$eval('input[name="waterAccess"]', els => els.length)
    assert.equal(vehicleValues, 4)
    assert.equal(surfaceValues, 4)
    assert.equal(electricValues, 3)
    assert.equal(waterValues, 3)
  } finally {
    await page.close()
  }
})

test('Stage 3 renders setup breakdown options', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const values = await page.$$eval('input[name="setupBreakdown"]', els => els.length)
    assert.equal(values, 5)
  } finally {
    await page.close()
  }
})

test('Stage 3 renders venue restrictions and questions textareas', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const venueTextarea    = await page.$('textarea#venueRestrictions')
    const questionsTextarea = await page.$('textarea#questions')
    assert.ok(venueTextarea !== null,     'venueRestrictions textarea must be present')
    assert.ok(questionsTextarea !== null,  'questions textarea must be present')
  } finally {
    await page.close()
  }
})

test('Stage 3 renders day-of contact field with privacy hint', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const contactInput = await page.$('input#dayOfContact')
    assert.ok(contactInput !== null, 'dayOfContact input must be present')
    const hintText = await page.evaluate(() => {
      const hints = Array.from(document.querySelectorAll('.tool-question-hint'))
      return hints.map(h => h.textContent ?? '').join(' ')
    })
    assert.ok(/appear.*brief.*email|brief.*email.*appear/i.test(hintText), 'day-of contact must note content appears in brief and email')
    assert.ok(/financial|password|sensitive/i.test(hintText), 'day-of contact must caution against sensitive info')
  } finally {
    await page.close()
  }
})

// ─── 7. Stage 3 — validation ─────────────────────────────────────────────────

test('Stage 3 does not advance to results without setup space', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    // no setup space selected
    await page.click('.tool-nav-next')
    await new Promise(r => setTimeout(r, 200))
    const emailBtn = await page.$('.food-truck-email-btn')
    assert.equal(emailBtn, null, 'must not advance to results without setup space')
    const error = await page.$('[role="alert"]')
    assert.ok(error !== null, 'error banner must appear')
  } finally {
    await page.close()
  }
})

test('Stage 3 final nav button label is "Build My Event Brief →"', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    const btnText = await page.$eval('.tool-nav-next', el => el.textContent?.trim() ?? '')
    assert.ok(/build my event brief/i.test(btnText), `unexpected next button label: "${btnText}"`)
  } finally {
    await page.close()
  }
})

test('Stage 3 advances to results with setup space selected', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const emailBtn = await page.$('.food-truck-email-btn')
    assert.ok(emailBtn !== null, '.food-truck-email-btn must be present on results screen')
  } finally {
    await page.close()
  }
})

// ─── 8. Results screen — structure ───────────────────────────────────────────

test('results screen has h1 "Your Event Service Inquiry Brief"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const h1 = await page.$eval('.tool-results-title', el => el.textContent?.trim() ?? '')
    assert.ok(/event service inquiry brief/i.test(h1), `unexpected h1: "${h1}"`)
  } finally {
    await page.close()
  }
})

test('results screen has Email the Vendor button', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const btn = await page.$eval('.food-truck-email-btn', el => el.textContent?.trim() ?? '')
    assert.ok(/email the vendor/i.test(btn), `unexpected email button text: "${btn}"`)
  } finally {
    await page.close()
  }
})

test('results Email button opens mailto with blank recipient in public demo', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.food-truck-email-btn', el => el.getAttribute('href') ?? '')
    assert.ok(href.startsWith('mailto:?'), `mailto must have blank recipient, got: "${href.slice(0, 50)}"`)
    assert.ok(href.includes('subject='), 'mailto must include subject')
    assert.ok(href.includes('body='),    'mailto must include body')
  } finally {
    await page.close()
  }
})

test('results screen has organizer name input', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const input = await page.$('input#organizerName')
    assert.ok(input !== null, 'organizerName input must be present on results screen')
  } finally {
    await page.close()
  }
})

test('results action bar has Copy, Print, Edit Answers, and Start Over buttons', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const btnTexts = await page.$$eval('.result-actions button', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(btnTexts.some(t => /copy/i.test(t)),        'Copy button missing')
    assert.ok(btnTexts.some(t => /print/i.test(t)),       'Print button missing')
    assert.ok(btnTexts.some(t => /edit answers/i.test(t)),'Edit Answers button missing')
    assert.ok(btnTexts.some(t => /start over/i.test(t)),  'Start Over button missing')
  } finally {
    await page.close()
  }
})

test('copy status live region has role="status" aria-live="polite" aria-atomic="true"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const region = await page.$eval('.result-copy-status', el => ({
      role:      el.getAttribute('role'),
      ariaLive:  el.getAttribute('aria-live'),
      ariaAtomic: el.getAttribute('aria-atomic'),
    }))
    assert.equal(region.role,       'status')
    assert.equal(region.ariaLive,   'polite')
    assert.equal(region.ariaAtomic, 'true')
  } finally {
    await page.close()
  }
})

test('progress bar is hidden on results screen', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const progress = await page.$('.tool-progress-count')
    assert.equal(progress, null, 'progress bar must not be present on results screen')
  } finally {
    await page.close()
  }
})

// ─── 9. Results — brief content correctness ──────────────────────────────────

test('brief shows correct event type label', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(/corporate or workplace event/i.test(briefText), `event type not in brief: "${briefText.slice(0, 200)}"`)
  } finally {
    await page.close()
  }
})

test('brief shows formatted date when confirmed', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(/october.*2026|2026.*october/i.test(briefText), `formatted date not in brief`)
  } finally {
    await page.close()
  }
})

test('brief shows "Date not yet confirmed" when tbd was selected', async () => {
  const page = await openTool()
  try {
    await fillStage1Tbd(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="serviceType"]'))
    await fillStage2(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="setupSpace"]'))
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.food-truck-email-btn'))
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(/date not yet confirmed/i.test(briefText), `tbd date not showing correctly: "${briefText.slice(0, 300)}"`)
    assert.ok(!/NaN|Invalid Date|undefined/i.test(briefText), 'no invalid date values must appear in brief')
  } finally {
    await page.close()
  }
})

test('brief shows venue name', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(/techco headquarters/i.test(briefText), 'venue name not in brief')
  } finally {
    await page.close()
  }
})

test('brief shows selected service type label', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(/full meals or entr/i.test(briefText), 'service type label not in brief')
  } finally {
    await page.close()
  }
})

test('brief shows multiple selected service types', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.click('input[name="serviceType"][value="full_meals"]')
    await page.click('input[name="serviceType"][value="coffee"]')
    await page.click('input[name="paymentArrangement"][value="guest_paid"]')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="setupSpace"]'))
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.food-truck-email-btn'))
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(/full meals.*coffee|coffee.*full meals/i.test(briefText), `multi-select not shown: "${briefText.slice(0, 300)}"`)
  } finally {
    await page.close()
  }
})

test('brief shows payment arrangement', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(/host.*paid|host covers/i.test(briefText), 'payment arrangement not in brief')
  } finally {
    await page.close()
  }
})

test('brief shows setup space', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(/dedicated setup area/i.test(briefText), 'setup space not in brief')
  } finally {
    await page.close()
  }
})

test('brief includes The Event, Service Requested, and Venue & Logistics sections', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const sectionTitles = await page.$$eval('.result-section-title', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(sectionTitles.some(t => /the event/i.test(t)),         'The Event section missing')
    assert.ok(sectionTitles.some(t => /service requested/i.test(t)), 'Service Requested section missing')
    assert.ok(sectionTitles.some(t => /venue.*logistics/i.test(t)),  'Venue & Logistics section missing')
  } finally {
    await page.close()
  }
})

// ─── 10. Brief suppression rules ─────────────────────────────────────────────

test('"Questions for the Vendor" section absent when questions textarea is empty', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const sectionTitles = await page.$$eval('.result-section-title', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(!sectionTitles.some(t => /questions for the vendor/i.test(t)),
      '"Questions for the Vendor" section must be absent when questions is empty')
  } finally {
    await page.close()
  }
})

test('"Questions for the Vendor" section appears when questions are filled', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await fillStage3(page)
    await page.type('textarea#questions', 'Do you have a vegetarian option?')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.food-truck-email-btn'))
    const sectionTitles = await page.$$eval('.result-section-title', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(sectionTitles.some(t => /questions for the vendor/i.test(t)),
      '"Questions for the Vendor" must appear when questions are filled')
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(/vegetarian option/i.test(briefText), 'question text not in brief')
  } finally {
    await page.close()
  }
})

test('budget row absent when "Prefer not to say" selected', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.click('input[name="serviceType"][value="full_meals"]')
    await page.click('input[name="paymentArrangement"][value="host_paid"]')
    await page.click('input[name="budget"][value="prefer_not_say"]')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="setupSpace"]'))
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.food-truck-email-btn'))
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(!/prefer not to say/i.test(briefText), '"Prefer not to say" must not appear in brief')
  } finally {
    await page.close()
  }
})

test('budget appears in brief when a specific budget range is selected', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.click('input[name="serviceType"][value="full_meals"]')
    await page.click('input[name="paymentArrangement"][value="host_paid"]')
    await page.click('input[name="budget"][value="1500_to_3000"]')
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="setupSpace"]'))
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.food-truck-email-btn'))
    const briefText = await page.$eval('.result-sections', el => el.textContent ?? '')
    assert.ok(/1,500.*3,000|3,000.*1,500/i.test(briefText), 'budget range not in brief')
  } finally {
    await page.close()
  }
})

test('optional fields not filled produce no blank rows in brief', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    // Find all dt elements in result-recap-list and check they have non-empty matching dd
    const emptyRows = await page.evaluate(() => {
      const terms = Array.from(document.querySelectorAll('.result-recap-term'))
      return terms
        .filter(dt => {
          const dd = dt.nextElementSibling
          return !dd || !dd.textContent?.trim()
        })
        .map(dt => dt.textContent?.trim())
    })
    assert.deepEqual(emptyRows, [], `found blank result rows: ${JSON.stringify(emptyRows)}`)
  } finally {
    await page.close()
  }
})

// ─── 11. Copy, email, and print actions ──────────────────────────────────────

test('Copy Brief writes full brief text to clipboard', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string ?? '')
    assert.ok(copied.includes('FOOD TRUCK EVENT INQUIRY BRIEF'), `header not in copied text`)
    assert.ok(copied.includes('THE EVENT'), `THE EVENT section not copied`)
    assert.ok(copied.includes('SERVICE REQUESTED'), `SERVICE REQUESTED section not copied`)
    assert.ok(copied.includes('VENUE & LOGISTICS'), `VENUE & LOGISTICS section not copied`)
  } finally {
    await page.close()
  }
})

test('copied brief includes the disclaimer', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const copied = await page.evaluate(() => (window as unknown as Record<string, unknown>).__lastCopied as string ?? '')
    assert.ok(/does not confirm availability/i.test(copied), 'disclaimer not in copied text')
    assert.ok(/reserve the date/i.test(copied), 'disclaimer must include "reserve the date"')
    assert.ok(/guarantee menu items/i.test(copied), 'disclaimer must include "guarantee menu items"')
    assert.ok(/establish pricing/i.test(copied), 'disclaimer must include "establish pricing"')
    assert.ok(/confirm venue suitability/i.test(copied), 'disclaimer must include "confirm venue suitability"')
  } finally {
    await page.close()
  }
})

test('email subject contains event type and date', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.food-truck-email-btn', el => el.getAttribute('href') ?? '')
    const decoded = decodeURIComponent(href)
    assert.ok(/corporate or workplace event/i.test(decoded), `event type not in subject: "${decoded.slice(0, 200)}"`)
    assert.ok(/october.*2026|2026.*october/i.test(decoded), `date not in subject: "${decoded.slice(0, 200)}"`)
  } finally {
    await page.close()
  }
})

test('email subject shows "Date TBD" when date is not confirmed', async () => {
  const page = await openTool()
  try {
    await fillStage1Tbd(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="serviceType"]'))
    await fillStage2(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="setupSpace"]'))
    await fillStage3(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('.food-truck-email-btn'))
    const href = await page.$eval('.food-truck-email-btn', el => el.getAttribute('href') ?? '')
    const decoded = decodeURIComponent(href)
    assert.ok(/date tbd/i.test(decoded), `"Date TBD" not in subject for tbd path: "${decoded.slice(0, 200)}"`)
    assert.ok(!/NaN|Invalid Date/i.test(decoded), 'no invalid date values in subject')
  } finally {
    await page.close()
  }
})

test('Copy Brief shows success status in live region', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /copy brief/i)
    await new Promise(r => setTimeout(r, 300))
    const statusText = await page.$eval('.result-copy-status', el => el.textContent?.trim() ?? '')
    assert.ok(/copied/i.test(statusText), `expected copied status, got: "${statusText}"`)
  } finally {
    await page.close()
  }
})

test('Share button is present when navigator.share is available', async () => {
  const page = await openTool(true)
  try {
    await advanceToResults(page)
    const btnTexts = await page.$$eval('.result-actions button', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(btnTexts.some(t => /share/i.test(t)), 'Share button must appear when navigator.share is available')
  } finally {
    await page.close()
  }
})

test('Share button absent when navigator.share is not available', async () => {
  const page = await openTool(false)
  try {
    await advanceToResults(page)
    const btnTexts = await page.$$eval('.result-actions button', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(!btnTexts.some(t => /^share/i.test(t)), 'Share button must not appear without navigator.share')
  } finally {
    await page.close()
  }
})

// ─── 12. Disclaimer wording ───────────────────────────────────────────────────

test('results-screen disclaimer has role="note"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const role = await page.$eval('.tool-disclaimer', el => el.getAttribute('role') ?? '')
    assert.equal(role, 'note')
  } finally {
    await page.close()
  }
})

test('disclaimer contains all five required clauses', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const text = await page.$eval('.tool-disclaimer', el => el.textContent ?? '')
    assert.ok(/confirm availability|availability/i.test(text),         'clause 1: confirm availability')
    assert.ok(/reserve the date/i.test(text),                          'clause 2: reserve the date')
    assert.ok(/guarantee menu items|service capacity/i.test(text),     'clause 3: guarantee menu items')
    assert.ok(/establish pricing/i.test(text),                         'clause 4: establish pricing')
    assert.ok(/confirm venue suitability/i.test(text),                 'clause 5: confirm venue suitability')
    assert.ok(/permits|licenses|utilities/i.test(text),                'clause 5 addendum: permits etc.')
  } finally {
    await page.close()
  }
})

test('disclaimer references "Your Mobile Food Business"', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const text = await page.$eval('.tool-disclaimer', el => el.textContent ?? '')
    assert.ok(/your mobile food business/i.test(text), 'disclaimer must reference the business name')
  } finally {
    await page.close()
  }
})

// ─── 13. Sales CTA ────────────────────────────────────────────────────────────

test('sales CTA heading matches approved wording', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const heading = await page.$eval('.tool-sales-cta-heading', el => el.textContent?.trim() ?? '')
    assert.ok(/want an event inquiry planner like this for your business/i.test(heading),
      `unexpected sales CTA heading: "${heading}"`)
  } finally {
    await page.close()
  }
})

test('sales CTA button opens mailto to Websites by Leslie with correct subject', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const href = await page.$eval('.tool-sales-cta-link', el => el.getAttribute('href') ?? '')
    assert.ok(href.includes('websitesbyleslie01@gmail.com'), `CTA must link to WBL email, got: "${href}"`)
    assert.ok(href.includes('Food%20Truck%20Event%20Inquiry'), `CTA subject must be "Food Truck Event Inquiry", got: "${href}"`)
  } finally {
    await page.close()
  }
})

test('sales CTA has a bullet list with hosted-link bullet using approved delivery wording', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    const items = await page.$$eval('.tool-sales-cta-features li', els => els.map(el => el.textContent?.trim() ?? ''))
    assert.ok(items.length >= 3, `Expected at least 3 CTA bullets, got ${items.length}`)
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

// ─── 14. Navigation — back, edit, start over ─────────────────────────────────

test('back button is disabled on Stage 1', async () => {
  const page = await openTool()
  try {
    const disabled = await page.$eval('.tool-nav-back', el => (el as HTMLButtonElement).disabled)
    assert.equal(disabled, true, 'back button must be disabled on Stage 1')
  } finally {
    await page.close()
  }
})

test('back from Stage 2 returns to Stage 1 with answers preserved', async () => {
  const page = await openTool()
  try {
    await advanceToStage2(page)
    await page.click('.tool-nav-back')
    await page.waitForFunction(() => !!document.querySelector('input[name="eventType"]'))
    const checked = await page.$eval('input[name="eventType"][value="corporate_workplace"]', el => (el as HTMLInputElement).checked)
    assert.equal(checked, true, 'event type answer must be preserved on back navigation')
    const progress = await page.$eval('.tool-progress-count', el => el.textContent?.trim() ?? '')
    assert.equal(progress, '1 of 3')
  } finally {
    await page.close()
  }
})

test('back from Stage 3 returns to Stage 2 with answers preserved', async () => {
  const page = await openTool()
  try {
    await advanceToStage3(page)
    await page.click('.tool-nav-back')
    await page.waitForFunction(() => !!document.querySelector('input[name="serviceType"]'))
    const checked = await page.$eval('input[name="serviceType"][value="full_meals"]', el => (el as HTMLInputElement).checked)
    assert.equal(checked, true, 'service type answer must be preserved on back navigation')
  } finally {
    await page.close()
  }
})

test('Edit Answers returns to Stage 1 with all answers preserved', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /edit answers/i)
    await page.waitForFunction(() => !!document.querySelector('input[name="eventType"]'))
    const checked = await page.$eval('input[name="eventType"][value="corporate_workplace"]', el => (el as HTMLInputElement).checked)
    assert.equal(checked, true, 'Stage 1 answers must be preserved after Edit Answers')
    const progress = await page.$eval('.tool-progress-count', el => el.textContent?.trim() ?? '')
    assert.equal(progress, '1 of 3')
  } finally {
    await page.close()
  }
})

test('Start Over dialog appears, cancel preserves state', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /start over/i)
    await new Promise(r => setTimeout(r, 200))
    const dialog = await page.$('.tool-confirm-dialog')
    assert.ok(dialog !== null, 'confirm dialog must appear')
    // Click cancel
    const cancelBtn = await page.$eval('.tool-confirm-dialog', el => {
      const btns = Array.from(el.querySelectorAll('button'))
      const cancel = btns.find(b => /go back|cancel/i.test(b.textContent ?? ''))
      cancel?.click()
      return cancel?.textContent ?? ''
    })
    assert.ok(/go back|cancel/i.test(cancelBtn), `cancel button text: "${cancelBtn}"`)
    await new Promise(r => setTimeout(r, 200))
    const emailBtn = await page.$('.food-truck-email-btn')
    assert.ok(emailBtn !== null, 'results must still be visible after cancel')
  } finally {
    await page.close()
  }
})

test('Start Over confirm clears all answers and returns to Stage 1', async () => {
  const page = await openTool()
  try {
    await advanceToResults(page)
    await clickActionButton(page, /start over/i)
    await new Promise(r => setTimeout(r, 200))
    await page.$eval('.tool-confirm-dialog', el => {
      const btns = Array.from(el.querySelectorAll('button'))
      const confirm = btns.find(b => /yes.*start over|start over/i.test(b.textContent ?? ''))
      confirm?.click()
    })
    await page.waitForFunction(() => !!document.querySelector('input[name="eventType"]'))
    const anyChecked = await page.$$eval('input[name="eventType"]', els => els.some(el => (el as HTMLInputElement).checked))
    assert.equal(anyChecked, false, 'all answers must be cleared after Start Over')
    const progress = await page.$eval('.tool-progress-count', el => el.textContent?.trim() ?? '')
    assert.equal(progress, '1 of 3')
  } finally {
    await page.close()
  }
})

// ─── 15. Accessibility ────────────────────────────────────────────────────────

test('all required radio groups have fieldset + legend', async () => {
  const page = await openTool()
  try {
    const fieldsets = await page.$$eval('fieldset', els => els.length)
    assert.ok(fieldsets >= 4, `expected ≥4 fieldsets on Stage 1, got ${fieldsets}`)
    const legends = await page.$$eval('fieldset legend', els => els.length)
    assert.equal(fieldsets, legends, 'every fieldset must have a legend')
  } finally {
    await page.close()
  }
})

test('all text inputs and textareas have associated labels', async () => {
  const page = await openTool()
  try {
    const unlabelled = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), textarea'))
      return inputs
        .filter(el => {
          const id = el.getAttribute('id')
          return !id || !document.querySelector(`label[for="${id}"]`)
        })
        .map(el => el.getAttribute('id') || el.tagName)
    })
    assert.deepEqual(unlabelled, [], `unlabelled inputs: ${JSON.stringify(unlabelled)}`)
  } finally {
    await page.close()
  }
})

test('all OptionCard inputs meet 44px min-height', async () => {
  const page = await openTool()
  try {
    const underTarget = await page.$$eval('label.option-card', els =>
      els
        .map(el => ({ text: el.textContent?.trim().slice(0, 30) ?? '', h: el.getBoundingClientRect().height }))
        .filter(({ h }) => h < 44)
        .map(({ text, h }) => `"${text}": ${Math.round(h)}px`)
    )
    assert.deepEqual(underTarget, [], `option cards below 44px: ${JSON.stringify(underTarget)}`)
  } finally {
    await page.close()
  }
})

test('no localStorage or sessionStorage access', async () => {
  const page = await openTool()
  const storageAccess: string[] = []
  await page.evaluateOnNewDocument(() => {
    const origSet = Storage.prototype.setItem
    Storage.prototype.setItem = function(key: string, val: string) {
      (window as unknown as Record<string, unknown>).__storageWritten = (window as unknown as Record<string, string[]>).__storageWritten || []
      ;((window as unknown as Record<string, string[]>).__storageWritten).push(key)
      return origSet.call(this, key, val)
    }
  })
  try {
    await page.goto(`${baseUrl}/tools-food-truck-event.html`, { waitUntil: 'load' })
    await fillStage1Confirmed(page)
    await page.click('.tool-nav-next')
    await page.waitForFunction(() => !!document.querySelector('input[name="serviceType"]'))
    const written = await page.evaluate(() => (window as unknown as Record<string, unknown>).__storageWritten ?? null)
    assert.equal(written, null, `localStorage/sessionStorage must not be written: ${JSON.stringify(written)}`)
  } finally {
    await page.close()
  }
})

// ─── 16. Responsive — no horizontal overflow ─────────────────────────────────

for (const width of [320, 375, 390, 768, 1280, 1440]) {
  test(`no horizontal overflow at ${width}px on Stage 1`, async () => {
    const page = await openViewport(width)
    try {
      const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
      assert.equal(overflow, false, `horizontal overflow at ${width}px on Stage 1`)
    } finally {
      await page.close()
    }
  })
}

test('no horizontal overflow on Stage 2 at 320px', async () => {
  const page = await openViewport(320)
  try {
    await advanceToStage2(page)
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
    assert.equal(overflow, false, 'horizontal overflow on Stage 2 at 320px')
  } finally {
    await page.close()
  }
})

test('no horizontal overflow on Stage 3 at 320px', async () => {
  const page = await openViewport(320)
  try {
    await advanceToStage3(page)
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
    assert.equal(overflow, false, 'horizontal overflow on Stage 3 at 320px')
  } finally {
    await page.close()
  }
})

test('no horizontal overflow on results screen at 320px', async () => {
  const page = await openViewport(320)
  try {
    await advanceToResults(page)
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
    assert.equal(overflow, false, 'horizontal overflow on results screen at 320px')
  } finally {
    await page.close()
  }
})

test('no horizontal overflow on results screen at 375px', async () => {
  const page = await openViewport(375)
  try {
    await advanceToResults(page)
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
    assert.equal(overflow, false, 'horizontal overflow on results screen at 375px')
  } finally {
    await page.close()
  }
})
