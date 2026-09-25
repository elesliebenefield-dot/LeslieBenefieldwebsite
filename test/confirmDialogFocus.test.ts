// Shared ConfirmDialog (src/tools/core/components/ConfirmDialog.tsx) —
// keyboard focus handling. Exercised through the Custom Bakery Order
// Planner's "Start over?" dialog, which opens from the results screen's
// Start Over button:
//   - opening moves focus to Cancel ("Go Back");
//   - Tab / Shift+Tab cycle between the dialog's two buttons and never
//     reach the page behind it;
//   - Escape and Cancel close it and return focus to Start Over;
//   - confirming removes Start Over (the page resets to step 1), so focus
//     lands on a remaining control on the page instead of being lost;
//   - reopening after a cancel behaves the same the second time.
// Wording, appearance, and what confirming does are unchanged.
//
// Runs against the real production build (dist/, rebuilt fresh) in a real
// browser via Puppeteer. No live network access.
//
// Run with: node --test test/confirmDialogFocus.test.ts

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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openToResults(): Promise<Page> {
  const page = await browser.newPage()
  await page.goto(`${baseUrl}/tools-custom-bakery-order.html`, { waitUntil: 'load' })
  await page.click('input[name="productType"][value="cake"]')
  await page.evaluate(() => {
    const input = document.querySelector('#neededByDate') as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '2026-12-20')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.click('input[name="occasion"][value="birthday"]')
  await page.click('input[name="recipient"][value="gift_one"]')
  await page.click('.tool-nav-next')
  await page.waitForSelector('#sizeQuantity')
  await page.type('#sizeQuantity', '2-tier, serves 20')
  await page.type('#inscriptionText', 'Happy Birthday!')
  await page.click('.tool-nav-next')
  await page.waitForSelector('input[name="budget"]')
  await page.click('input[name="budget"][value="150_300"]')
  await page.click('.tool-nav-next')
  await page.waitForSelector('.bakery-email-btn')
  return page
}

// Open the dialog the way a keyboard user would: focus Start Over, press Enter.
async function openDialogFromKeyboard(page: Page) {
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll<HTMLButtonElement>('.result-actions button'))
      .find((b) => b.textContent?.trim() === 'Start Over')
    if (!btn) throw new Error('Start Over button not found')
    btn.focus()
  })
  await page.keyboard.press('Enter')
  await page.waitForSelector('.tool-confirm-backdrop[role="dialog"]')
}

const focused = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement | null
  return {
    text: el?.textContent?.trim() ?? '',
    className: el?.className ?? '',
    tag: el?.tagName ?? '',
    inDialog: !!el?.closest('.tool-confirm-dialog'),
    isBody: el === document.body,
    inMain: !!el?.closest('main'),
  }
})

const dialogOpen = (page: Page) => page.evaluate(() => !!document.querySelector('.tool-confirm-backdrop'))

// ── Tests ─────────────────────────────────────────────────────────────────────

test('opening the dialog moves focus to Cancel ("Go Back"); wording is unchanged', async () => {
  const page = await openToResults()
  try {
    await openDialogFromKeyboard(page)
    const f = await focused(page)
    assert.equal(f.text, 'Go Back')
    assert.ok(f.inDialog)
    const text = await page.$eval('.tool-confirm-dialog', (el) => el.textContent?.replace(/\s+/g, ' ').trim())
    assert.equal(text, 'Start over?This will clear all your answers and return to step 1.Go BackYes, Start Over')
  } finally {
    await page.close()
  }
})

test('Tab and Shift+Tab cycle between the two dialog buttons and never leave the dialog', async () => {
  const page = await openToResults()
  try {
    await openDialogFromKeyboard(page)
    const forward: string[] = []
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      const f = await focused(page)
      assert.ok(f.inDialog, `Tab #${i + 1} left the dialog (focused ${f.tag} "${f.text}")`)
      forward.push(f.text)
    }
    assert.deepEqual(forward, ['Yes, Start Over', 'Go Back', 'Yes, Start Over', 'Go Back'])

    const backward: string[] = []
    for (let i = 0; i < 4; i++) {
      await page.keyboard.down('Shift')
      await page.keyboard.press('Tab')
      await page.keyboard.up('Shift')
      const f = await focused(page)
      assert.ok(f.inDialog, `Shift+Tab #${i + 1} left the dialog (focused ${f.tag} "${f.text}")`)
      backward.push(f.text)
    }
    assert.deepEqual(backward, ['Yes, Start Over', 'Go Back', 'Yes, Start Over', 'Go Back'])
    assert.equal(await dialogOpen(page), true, 'tabbing must not close the dialog')
  } finally {
    await page.close()
  }
})

test('Escape cancels, keeps the results, and returns focus to Start Over', async () => {
  const page = await openToResults()
  try {
    await openDialogFromKeyboard(page)
    await page.keyboard.press('Escape')
    assert.equal(await dialogOpen(page), false)
    assert.ok(await page.$('.bakery-email-btn'), 'results must still be shown after cancelling')
    const f = await focused(page)
    assert.equal(f.text, 'Start Over', `focus should return to Start Over, got ${f.tag} "${f.text}"`)
  } finally {
    await page.close()
  }
})

test('Cancel ("Go Back") via keyboard closes the dialog and returns focus to Start Over', async () => {
  const page = await openToResults()
  try {
    await openDialogFromKeyboard(page)
    await page.keyboard.press('Enter') // focus starts on Go Back
    assert.equal(await dialogOpen(page), false)
    assert.ok(await page.$('.bakery-email-btn'), 'results must still be shown after cancelling')
    const f = await focused(page)
    assert.equal(f.text, 'Start Over')
  } finally {
    await page.close()
  }
})

test('confirming resets to step 1 (Start Over is gone) and focus moves to a remaining control on the page, not the page body', async () => {
  const page = await openToResults()
  try {
    await openDialogFromKeyboard(page)
    await page.keyboard.press('Tab') // → Yes, Start Over
    assert.equal((await focused(page)).text, 'Yes, Start Over')
    await page.keyboard.press('Enter')
    await page.waitForSelector('input[name="productType"]')
    assert.equal(await dialogOpen(page), false)
    const cleared = await page.$eval('input[name="productType"][value="cake"]', (el) => (el as HTMLInputElement).checked)
    assert.equal(cleared, false, 'confirming must still clear the answers, as before')
    const f = await focused(page)
    assert.equal(f.isBody, false, 'focus must not be dropped to the page body')
    assert.ok(f.inMain, `focus should land on a control in the planner, got ${f.tag}.${f.className} "${f.text}"`)
    assert.ok(['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(f.tag), `focused a non-control: ${f.tag}`)
  } finally {
    await page.close()
  }
})

test('reopening after a cancel works the same: focus on Cancel, Tab stays inside, Escape returns to Start Over', async () => {
  const page = await openToResults()
  try {
    await openDialogFromKeyboard(page)
    await page.keyboard.press('Escape')
    assert.equal((await focused(page)).text, 'Start Over')

    await page.keyboard.press('Enter') // reopen from the restored focus
    await page.waitForSelector('.tool-confirm-backdrop[role="dialog"]')
    assert.equal((await focused(page)).text, 'Go Back')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const f = await focused(page)
    assert.ok(f.inDialog)
    assert.equal(f.text, 'Go Back')
    await page.keyboard.press('Escape')
    assert.equal(await dialogOpen(page), false)
    assert.equal((await focused(page)).text, 'Start Over')
  } finally {
    await page.close()
  }
})

test('mouse: clicking the backdrop still cancels, and clicking a dialog button still works', async () => {
  const page = await openToResults()
  try {
    await openDialogFromKeyboard(page)
    await page.mouse.click(5, 5) // backdrop corner
    assert.equal(await dialogOpen(page), false, 'backdrop click should still cancel')
    assert.ok(await page.$('.bakery-email-btn'))
    await openDialogFromKeyboard(page)
    await page.click('.tool-confirm-cancel')
    assert.equal(await dialogOpen(page), false)
    assert.ok(await page.$('.bakery-email-btn'))
  } finally {
    await page.close()
  }
})
