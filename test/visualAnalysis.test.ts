// Focused tests for the Visual & Usability page-measurement logic
// (src/lib/visualAnalysis.ts), run against a real headless browser via Puppeteer
// so getComputedStyle/getBoundingClientRect behave exactly as they do in
// production (jsdom does not implement real layout, so it can't be trusted here).
//
// Run with: node --test test/visualAnalysis.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { collectPageMeasurements } from '../src/lib/visualAnalysis.ts'

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let browser: Browser

before(async () => {
  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
})

async function measure(html: string): Promise<ReturnType<typeof collectPageMeasurements>> {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport({ width: 1024, height: 768 })
    await page.setContent(html, { waitUntil: 'load' })
    return await page.evaluate(collectPageMeasurements, 'desktop')
  } finally {
    await page.close()
  }
}

test('a wrapper <li> around a well-contrasted <a> is not reported as low-contrast', async () => {
  // The <li> has no color of its own — it inherits the page's dark body text
  // color — while its resolved background walks up to the dark nav bar, so a
  // naive per-element contrast check on the <li> itself reads its own inherited
  // (dark) text color against its own (dark) background: a false "~1:1" result
  // that has nothing to do with the actually-rendered white link text.
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; font-family: sans-serif; color: #1F3347; background: #fff; }
      nav { background: #1F3347; padding: 12px; }
      nav ul { list-style: none; margin: 0; padding: 0; display: flex; gap: 16px; }
      nav a { color: rgba(255, 255, 255, 0.92); text-decoration: none; font-size: 16px; }
    </style></head>
    <body>
      <nav><ul>
        <li><a href="#">Home</a></li>
        <li><a href="#">Services</a></li>
      </ul></nav>
    </body></html>
  `
  const result = await measure(html)
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  assert.deepEqual(
    lowContrast,
    [],
    `expected no low-contrast findings, got: ${JSON.stringify(lowContrast)}`
  )
})

test('genuinely low-contrast text (with its own text node) is still detected', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; font-family: sans-serif; }
      p { color: #eeeeee; background: #ffffff; font-size: 16px; padding: 8px; }
    </style></head>
    <body>
      <p>This text has genuinely low contrast against its background.</p>
    </body></html>
  `
  const result = await measure(html)
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  assert.equal(lowContrast.length, 1, `expected exactly one low-contrast finding, got: ${JSON.stringify(result.textIssues)}`)
  assert.match(lowContrast[0].sample, /genuinely low contrast/)
})

test('a <li> with its own text alongside a nested link is still evaluated', async () => {
  // A wrapper is only skipped when it has NO text of its own — one that mixes
  // its own text with a nested link should still be checked like any other
  // text-bearing element.
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; font-family: sans-serif; }
      li { color: #eeeeee; background: #ffffff; font-size: 16px; }
    </style></head>
    <body>
      <ul><li>Some low-contrast label text with a <a href="#" style="color:#eeeeee">link</a> inside it</li></ul>
    </body></html>
  `
  const result = await measure(html)
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  assert.ok(
    lowContrast.some((i) => i.sample.includes('Some low-contrast label text')),
    `expected the <li>'s own text to be flagged, got: ${JSON.stringify(result.textIssues)}`
  )
})

test('genuinely overlapping interactive elements are still detected', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      button { position: absolute; width: 200px; height: 60px; border: none; font-size: 14px; }
      .btn-a { top: 300px; left: 50px; background: #eee; }
      .btn-b { top: 310px; left: 60px; background: #ddd; }
    </style></head>
    <body>
      <button class="btn-a">Button A</button>
      <button class="btn-b">Button B</button>
    </body></html>
  `
  const result = await measure(html)
  const overlaps = result.clippedOrOverlapping.filter((i) => i.kind === 'overlap')
  assert.equal(overlaps.length, 1, `expected one overlap finding, got: ${JSON.stringify(result.clippedOrOverlapping)}`)
})

test('non-overlapping interactive elements are not falsely flagged', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      button { position: absolute; width: 200px; height: 60px; border: none; font-size: 14px; }
      .btn-a { top: 100px; left: 50px; background: #eee; }
      .btn-b { top: 400px; left: 50px; background: #ddd; }
    </style></head>
    <body>
      <button class="btn-a">Button A</button>
      <button class="btn-b">Button B</button>
    </body></html>
  `
  const result = await measure(html)
  const overlaps = result.clippedOrOverlapping.filter((i) => i.kind === 'overlap')
  assert.deepEqual(overlaps, [])
})
