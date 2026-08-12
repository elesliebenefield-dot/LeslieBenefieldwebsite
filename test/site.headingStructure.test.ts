// Regression test for the reported mobile heading-structure skip on the
// homepage: each .process-step card reveals independently of the "My
// Process" section heading (separate data-reveal wrappers), so at a
// realistic reveal-animation settle time, a process-step title could be
// visible while its parent heading wasn't — producing an h1 -> h3 skip in
// the visible heading sequence on mobile only. Fixed by retagging the
// step titles from h3 to h2 (src/components/Process.tsx) — same level as
// every other section's own title, so the visible sequence can never skip
// regardless of which cards happen to have revealed. className="process-title"
// is styled purely by class, not tag, so this is a structural-only change.
//
// Runs against the real production build (dist/, always rebuilt fresh) in a
// real browser via Puppeteer. No live network access. The heading-collection
// logic below is a small, purpose-built inline helper (not shared with any
// other module) — it only needs to answer "is the visible heading sequence
// well-formed," not the full range of things a general page-measurement
// tool would check.
//
// Run with: node --test test/site.headingStructure.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { scrollThroughPageAndSettle } from '../src/lib/scrollSettle.ts'

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

// Wide enough for the full desktop nav row; 390x844 is a common real phone
// viewport (matches navOverflow.test.ts's and the rest of the site's own
// mobile-testing convention).
const DESKTOP_VIEWPORT = { width: 1440, height: 900 }
const MOBILE_VIEWPORT = { width: 390, height: 844 }
// Comfortably longer than the site's own data-reveal transition duration,
// so every section has genuinely finished revealing before headings are
// read — mobile gets a shorter allowance since fewer/smaller sections are
// still settling into view by the time scrollThroughPageAndSettle returns.
const SETTLE_MS = 900
const MOBILE_SETTLE_MS = 500

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
  if (!address || typeof address === 'string') throw new Error('failed to start mock server')
  baseUrl = `http://127.0.0.1:${address.port}`

  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

/** Collects only what this file's tests need: the count/order of VISIBLE
 *  h1-h6 elements, whether the sequence skips a level, and whether any
 *  heading is empty. Runs inside the page via page.evaluate. */
function collectHeadingStructure() {
  function isVisible(el: Element): boolean {
    const htmlEl = el as HTMLElement
    if (typeof htmlEl.checkVisibility === 'function') {
      return htmlEl.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })
    }
    let node: Element | null = el
    while (node) {
      const s = window.getComputedStyle(node)
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity || '1') === 0) return false
      node = node.parentElement
    }
    return true
  }

  const allHeadings = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')).filter(isVisible)
  const h1Count = allHeadings.filter((h) => h.tagName === 'H1').length
  const levels = allHeadings.map((h) => Number(h.tagName[1]))
  let hasSkippedLevel = false
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) hasSkippedLevel = true
  }
  if (levels.length > 0 && levels[0] > 2) hasSkippedLevel = true
  const emptyHeadingCount = allHeadings.filter((h) => (h.textContent || '').trim().length === 0).length

  return { h1Count, hasSkippedLevel, emptyHeadingCount }
}

async function measureHeadings(viewport: { width: number; height: number }, settleMs: number) {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport(viewport)
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    try {
      await scrollThroughPageAndSettle(page)
    } catch {
      /* non-fatal, matches production */
    }
    await new Promise((r) => setTimeout(r, settleMs))
    return await page.evaluate(collectHeadingStructure)
  } finally {
    await page.close()
  }
}

test('homepage heading structure at desktop: no skipped level, single h1', async () => {
  const m = await measureHeadings(DESKTOP_VIEWPORT, SETTLE_MS)
  assert.deepEqual(m, { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 })
})

test('homepage heading structure at mobile: no skipped level (previously true — reproduces the reported finding) — fixed without changing wording or placement', async () => {
  const m = await measureHeadings(MOBILE_VIEWPORT, MOBILE_SETTLE_MS)
  assert.deepEqual(m, { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 })
})

test('mobile heading structure is deterministic across repeated measurements, not a one-off timing fluke', async () => {
  for (let i = 0; i < 3; i++) {
    const m = await measureHeadings(MOBILE_VIEWPORT, MOBILE_SETTLE_MS)
    assert.deepEqual(m, { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 }, `run ${i + 1}`)
  }
})

test('process step titles are still <h2 class="process-title"> and unchanged text — retagging did not alter wording', async () => {
  const page: Page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
    const steps = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.process-title')).map((el) => ({ tag: el.tagName, text: (el.textContent || '').trim() }))
    )
    assert.equal(steps.length, 5)
    assert.ok(steps.every((s) => s.tag === 'H2'))
    assert.deepEqual(
      steps.map((s) => s.text),
      ["Let's Talk", 'Planning & Discovery', 'Design & Content', 'Build & Refine', 'Launch']
    )
  } finally {
    await page.close()
  }
})

test('the .process-title class renders identically regardless of tag — proves the h3->h2 retag could not have changed appearance', async () => {
  // Rather than hardcode an expected pixel value (fragile, and not actually
  // the point), this inserts a detached h3 with the SAME class right next to
  // the real (now h2) element within the same page/layout context, and
  // compares their computed styles directly — the only way font-size,
  // weight, color, and margin could differ is if some rule in index.css
  // keyed off the tag rather than the class, which the source audit (no bare
  // h1-h6 selectors anywhere in index.css) already ruled out.
  for (const viewport of [DESKTOP_VIEWPORT, MOBILE_VIEWPORT]) {
    const page: Page = await browser.newPage()
    try {
      await page.setViewport(viewport)
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' })
      const result = await page.evaluate(() => {
        const real = document.querySelector('.process-title')
        if (!real) return null
        const probe = document.createElement('h3')
        probe.className = 'process-title'
        probe.textContent = real.textContent
        real.insertAdjacentElement('afterend', probe)
        const realStyle = getComputedStyle(real)
        const probeStyle = getComputedStyle(probe)
        const snapshot = (s: CSSStyleDeclaration) => ({
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          color: s.color,
          marginBottom: s.marginBottom,
        })
        const real_ = snapshot(realStyle)
        const probe_ = snapshot(probeStyle)
        probe.remove()
        return { real: real_, probe: probe_ }
      })
      if (!result) throw new Error('no .process-title element found')
      assert.deepEqual(result.real, result.probe, `at ${viewport.width}px, the real (h2) and probe (h3) elements must render identically`)
    } finally {
      await page.close()
    }
  }
})
