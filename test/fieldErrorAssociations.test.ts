// Field-level validation errors in the nine planners — accessibility
// associations. When a field (or a group of choices) shows a validation
// error, the control is marked aria-invalid and connected to that specific
// message with aria-describedby; when the error clears, both go away.
//   - Choice groups: the <fieldset> is described by the error (read once when
//     entering the group) and every choice input is aria-invalid.
//   - Single fields: the input/textarea is aria-invalid and described by the
//     error, keeping any existing description (e.g. Comparison's limit note).
// Step-level banners that aren't tied to one field ("Choose at least one
// comparison priority", Open House's "Select or add at least one follow-up
// action") are intentionally not attached to individual controls.
//
// Runs against the real production build (dist/, rebuilt fresh) in a real
// browser via Puppeteer. No live network access.
//
// Run with: node --test test/fieldErrorAssociations.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = path.resolve(import.meta.dirname, '..')
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
    const urlPath = req.url === '/' ? '/index.html' : req.url || '/index.html'
    const filePath = path.join(DIST, decodeURIComponent(urlPath.split('?')[0]))
    try {
      const data = await readFile(filePath)
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('failed to start mock server')
  baseUrl = `http://127.0.0.1:${address.port}`
  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

// Field-level error messages (step-level banners use .tool-error-banner / .oh-action-validation and are excluded).
const FIELD_ERROR = '.tool-question-error, .cm-field-error, .oh-field-error:not(.oh-action-validation)'

interface Audit {
  errors: { id: string; text: string }[]
  problems: string[]
}

// Checks every visible field error on the page against the association rules.
async function audit(page: Page): Promise<Audit> {
  return page.evaluate((sel) => {
    const problems: string[] = []
    const errors = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((e) => e.getClientRects().length > 0)
    const out = errors.map((e) => ({ id: e.id, text: (e.textContent || '').trim() }))
    for (const e of errors) {
      if (!e.id) { problems.push(`error without id: "${e.textContent?.trim()}"`); continue }
      if (document.querySelectorAll(`[id="${e.id}"]`).length !== 1) problems.push(`duplicate id ${e.id}`)
      const refs = Array.from(document.querySelectorAll<HTMLElement>('[aria-describedby]'))
        .filter((el) => (el.getAttribute('aria-describedby') || '').split(/\s+/).includes(e.id))
      if (refs.length === 0) { problems.push(`nothing is described by #${e.id}`); continue }
      for (const r of refs) {
        const controls = r.matches('fieldset')
          ? Array.from(r.querySelectorAll<HTMLInputElement>('input'))
          : [r as HTMLInputElement]
        for (const c of controls) {
          if (c.getAttribute('aria-invalid') !== 'true') problems.push(`${c.tagName}#${c.id || c.name} for #${e.id} is not aria-invalid`)
        }
      }
    }
    // No dangling references anywhere on the page.
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[aria-describedby]'))) {
      for (const id of (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)) {
        if (!document.getElementById(id)) problems.push(`${el.tagName}#${el.id} points to missing #${id}`)
      }
    }
    // Nothing left aria-invalid without a visible error that describes it.
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[aria-invalid="true"]'))) {
      const own = (el.getAttribute('aria-describedby') || '').split(/\s+/)
      const group = el.closest('fieldset')?.getAttribute('aria-describedby')?.split(/\s+/) || []
      const described = [...own, ...group].some((id) => id && errors.some((e) => e.id === id))
      if (!described) problems.push(`${el.tagName}#${el.id || (el as HTMLInputElement).name} is aria-invalid with no visible error describing it`)
    }
    return { errors: out, problems }
  }, FIELD_ERROR)
}

// Correct the field described by the given error id: pick the first choice in
// a group, or type into a text field (setting dates through the native setter).
async function correct(page: Page, errorId: string) {
  await page.evaluate((id) => {
    const ref = Array.from(document.querySelectorAll<HTMLElement>('[aria-describedby]'))
      .find((el) => (el.getAttribute('aria-describedby') || '').split(/\s+/).includes(id))
    if (!ref) throw new Error(`no control for #${id}`)
    const input = (ref.matches('fieldset') ? ref.querySelector('input') : ref) as HTMLInputElement | HTMLTextAreaElement
    if (input instanceof HTMLInputElement && (input.type === 'radio' || input.type === 'checkbox')) {
      input.click()
      return
    }
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, input.type === 'date' ? '2026-12-20' : 'Test entry')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, errorId)
}

async function stillReferenced(page: Page, id: string) {
  return page.evaluate((i) => Array.from(document.querySelectorAll('[aria-describedby]'))
    .some((el) => (el.getAttribute('aria-describedby') || '').split(/\s+/).includes(i)), id)
}

// [label, page, how to trigger step-1 field errors, whether any edit hides all of the step's errors]
// Open House hides every setup error as soon as any setup field is edited (existing behavior).
const PLANNERS: [string, string, (p: Page) => Promise<void>, boolean?][] = [
  ['Custom Bakery Order', '/tools-custom-bakery-order.html', (p) => p.click('.tool-nav-next')],
  ['Plumbing Service Visit', '/tools-plumbing-visit.html', (p) => p.click('.tool-nav-next')],
  ['Food Truck Event', '/tools-food-truck-event.html', (p) => p.click('.tool-nav-next')],
  ['Buyer Readiness', '/tools-buyer.html', (p) => p.click('.tool-nav-next')],
  ['Seller Readiness', '/tools-seller.html', (p) => p.click('.tool-nav-next')],
  ['Listing Preparation', '/tools-listing-preparation.html', (p) => p.click('.tool-nav-next')],
  ['Open House Follow-Up', '/tools-open-house-follow-up.html', (p) => p.click('.listing-planner-btn--primary'), true],
  ['Closing & Moving', '/tools-closing-moving.html', (p) => p.click('.cm-stage-actions .listing-planner-btn--primary')],
  // Comparison step 1's only field-level error is the custom-priority input (empty "Add").
  ['Home Tour & Property Comparison', '/tools-property-comparison.html', (p) => p.click('.cmp-add-custom-btn')],
]

for (const [label, url, trigger, editClearsAll] of PLANNERS) {
  test(`${label}: displayed field errors are tied to their controls, and clear when corrected`, async () => {
    const page = await browser.newPage()
    try {
      await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' })
      const before = await audit(page)
      assert.deepEqual(before.errors, [], 'no field errors before submitting')
      assert.equal(await page.$('[aria-invalid="true"]'), null, 'nothing is invalid before submitting')

      await trigger(page)
      await page.waitForFunction((sel) => Array.from(document.querySelectorAll(sel)).some((e) => e.getClientRects().length > 0), {}, FIELD_ERROR)
      const shown = await audit(page)
      assert.ok(shown.errors.length >= 1, 'expected at least one field error after submitting')
      assert.deepEqual(shown.problems, [], `association problems:\n${shown.problems.join('\n')}`)

      const first = shown.errors[0]
      await correct(page, first.id)
      await page.waitForFunction((id) => !document.getElementById(id), {}, first.id)
      const after = await audit(page)
      assert.equal(await stillReferenced(page, first.id), false, `#${first.id} is still referenced after the error cleared`)
      assert.deepEqual(after.problems, [], `after correction:\n${after.problems.join('\n')}`)
      if (editClearsAll) {
        assert.equal(after.errors.length, 0, 'this planner hides all step errors after any edit')
        assert.equal(await page.$('[aria-invalid="true"]'), null, 'no control stays aria-invalid once its error is hidden')
      } else {
        assert.equal(after.errors.length, shown.errors.length - 1, 'only the corrected error should clear')
      }
    } finally {
      await page.close()
    }
  })
}

test('Bakery step 2: text field and textarea errors are associated, and clear after typing', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/tools-custom-bakery-order.html`, { waitUntil: 'load' })
    await page.click('input[name="productType"][value="cake"]')
    await page.evaluate(() => {
      const i = document.querySelector('#neededByDate') as HTMLInputElement
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(i, '2026-12-20')
      i.dispatchEvent(new Event('input', { bubbles: true }))
      i.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.click('input[name="occasion"][value="birthday"]')
    await page.click('input[name="recipient"][value="gift_one"]')
    await page.click('.tool-nav-next')
    await page.waitForSelector('#sizeQuantity')
    await page.click('.tool-nav-next') // submit step 2 empty
    await page.waitForSelector('#sizeQuantity-error')
    const attrs = await page.evaluate(() => ['sizeQuantity', 'inscriptionText'].map((id) => {
      const el = document.getElementById(id)!
      return [id, el.getAttribute('aria-invalid'), el.getAttribute('aria-describedby')]
    }))
    assert.deepEqual(attrs, [
      ['sizeQuantity', 'true', 'sizeQuantity-error'],
      ['inscriptionText', 'true', 'inscriptionText-error'],
    ])
    assert.deepEqual((await audit(page)).problems, [])
    await page.type('#sizeQuantity', '2-tier, serves 20')
    await page.waitForFunction(() => !document.getElementById('sizeQuantity-error'))
    const cleared = await page.$eval('#sizeQuantity', (el) => [el.getAttribute('aria-invalid'), el.getAttribute('aria-describedby')])
    assert.deepEqual(cleared, [null, null], 'aria-invalid and aria-describedby are removed once the error clears')
    assert.equal(await page.$eval('#inscriptionText', (el) => el.getAttribute('aria-invalid')), 'true', 'the other field keeps its error')
  } finally {
    await page.close()
  }
})

test('Comparison custom priority: the error is added to the input\'s description without replacing anything, and removed after typing', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/tools-property-comparison.html`, { waitUntil: 'load' })
    const input = 'input[aria-label="Custom priority label"]'
    assert.equal(await page.$eval(input, (el) => el.getAttribute('aria-describedby')), null)
    await page.click('.cmp-add-custom-btn')
    await page.waitForSelector('#cmp-custom-priority-error')
    assert.deepEqual(await page.$eval(input, (el) => [el.getAttribute('aria-invalid'), el.getAttribute('aria-describedby')]),
      ['true', 'cmp-custom-priority-error'])
    await page.type(input, 'Sunroom')
    await page.waitForFunction(() => !document.getElementById('cmp-custom-priority-error'))
    assert.deepEqual(await page.$eval(input, (el) => [el.getAttribute('aria-invalid'), el.getAttribute('aria-describedby')]), [null, null])
  } finally {
    await page.close()
  }
})

test('Comparison property nicknames: each property\'s error has its own id and is tied only to its own input', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/tools-property-comparison.html`, { waitUntil: 'load' })
    for (const item of await page.$$('.cmp-starter-item')) {
      if ((await item.$eval('.cmp-starter-label', (e) => e.textContent?.trim())) === 'Layout and flow') { await item.click(); break }
    }
    await page.click('.listing-planner-btn--primary')
    await page.waitForSelector('[id^="nickname-"]')
    await page.click('.listing-planner-btn--primary') // submit with no nicknames
    await page.waitForSelector('[id^="nickname-error-"]')
    const a = await audit(page)
    assert.deepEqual(a.problems, [], a.problems.join('\n'))
    const ids = await page.$$eval('[id^="nickname-error-"]', (els) => els.map((e) => e.id))
    assert.equal(new Set(ids).size, ids.length, 'nickname error ids must be unique per property')
  } finally {
    await page.close()
  }
})
