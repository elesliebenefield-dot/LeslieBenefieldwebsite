// Data-loss notices — integration tests.
// The nine demo planners keep answers only in page memory (no storage, no
// network), so each shows a visible note on its first step: answers can be
// lost on refresh/leave, and the visitor should copy or print (or share,
// where available) first. The bakery pricing calculator saves recipes only
// in the current browser (IndexedDB), so its Saved Recipes screen explains
// that and points to the existing Download Backup button.
//
// Runs against the real production build (dist/, rebuilt fresh) in a real
// browser via Puppeteer. No live network access.
//
// Run with: node --test test/dataLossNotices.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import puppeteer, { type Browser } from 'puppeteer-core'

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

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()

// [label, built page, note selector, the thing the visitor should keep]
const PLANNERS = [
  ['Custom Bakery Order Planner', '/tools-custom-bakery-order.html', '.tool-privacy-note', 'your results'],
  ['Plumbing Service Visit Planner', '/tools-plumbing-visit.html', '.tool-privacy-note', 'your results'],
  ['Food Truck Event Planner', '/tools-food-truck-event.html', '.tool-privacy-note', 'your results'],
  ['Buyer Readiness Planner', '/tools-buyer.html', '.tool-privacy-note', 'your results'],
  ['Seller Readiness Planner', '/tools-seller.html', '.tool-privacy-note', 'your results'],
  ['Listing Preparation Action Planner', '/tools-listing-preparation.html', '.tool-privacy-note', 'it'],
  ['Home Tour & Property Comparison Planner', '/tools-property-comparison.html', '.tool-privacy-note', 'it'],
  ['Open House Follow-Up Planner', '/tools-open-house-follow-up.html', '.oh-privacy-notice', 'your follow-up plan'],
  ['Closing & Moving Organizer', '/tools-closing-moving.html', '.cm-privacy-notice', 'your plan'],
] as const

for (const [label, url, selector, keep] of PLANNERS) {
  test(`${label}: first step shows a visible note that answers can be lost on refresh/leave, and to copy or print first`, async () => {
    const page = await browser.newPage()
    try {
      await page.setViewport({ width: 390, height: 844 })
      await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' })
      await page.waitForSelector(selector, { visible: true })
      const note = await page.$eval(selector, (el) => ({ text: el.textContent ?? '', role: el.getAttribute('role') }))
      const text = normalize(note.text)
      assert.equal(note.role, 'note')
      assert.match(text, /refreshing or leaving this page can erase|Close or refresh the page to clear all information/,
        `${label}: note must say answers can be lost on refresh/leave — got: ${text}`)
      assert.ok(text.includes(`Copy or print ${keep}`) || text.includes(`copy or print ${keep}`),
        `${label}: note must tell the visitor to copy or print ${keep} — got: ${text}`)
      assert.match(text, /\(or share (it|them), where available\)/, `${label}: share must be qualified as "where available"`)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      assert.ok(overflow <= 0, `${label}: no horizontal overflow at 390px, got ${overflow}px`)
    } finally {
      await page.close()
    }
  })
}

test('bakery pricing calculator: Saved Recipes explains browser-only saving and points to the existing Download Backup button', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/tools-bakery-pricing.html`, { waitUntil: 'load' })
    // Wait for the Saved Recipes nav button itself — the nav renders progressively.
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('.bp-app-nav-btn')).some((el) => el.textContent?.includes('Saved Recipes')))
    const buttons = await page.$$('.bp-app-nav-btn')
    const labels = await Promise.all(buttons.map((b) => b.evaluate((el) => el.textContent ?? '')))
    await buttons[labels.findIndex((l) => l.includes('Saved Recipes'))].click()
    await page.waitForSelector('.bp-saved-recipes-storage-note', { visible: true })
    const text = normalize(await page.$eval('.bp-saved-recipes-storage-note', (el) => el.textContent ?? ''))
    assert.equal(text,
      'Your recipes are saved only in this browser on this device. Clearing your browser data or using a ' +
      'private window can erase them, so use Download Backup below to keep a copy.')
    const backupButtons = await page.$$eval('.bp-backup-restore button', (els) => els.map((el) => el.textContent?.trim()))
    assert.ok(backupButtons.includes('Download Backup'), `the note refers to the existing "Download Backup" button — found ${JSON.stringify(backupButtons)}`)
  } finally {
    await page.close()
  }
})
