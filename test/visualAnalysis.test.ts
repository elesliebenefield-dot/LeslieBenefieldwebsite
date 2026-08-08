// Focused tests for the Visual & Usability page-measurement logic
// (src/lib/visualAnalysis.ts), run against a real headless browser via Puppeteer
// so getComputedStyle/getBoundingClientRect behave exactly as they do in
// production (jsdom does not implement real layout, so it can't be trusted here).
//
// Run with: node --test test/visualAnalysis.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { collectPageMeasurements, type ViewportLabel } from '../src/lib/visualAnalysis.ts'

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let browser: Browser

before(async () => {
  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
})

async function measure(html: string, viewportLabel: ViewportLabel = 'desktop'): Promise<ReturnType<typeof collectPageMeasurements>> {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport(viewportLabel === 'mobile' ? { width: 390, height: 844 } : { width: 1024, height: 768 })
    await page.setContent(html, { waitUntil: 'load' })
    return await page.evaluate(collectPageMeasurements, viewportLabel)
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

// ─── Contrast over background images/gradients ──────────────────────────

test('text over a background-image is marked unable to verify, not falsely flagged as low-contrast', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      .hero { background-image: linear-gradient(#000, #000); background-size: cover; padding: 40px; }
      h1 { color: #fff; font-size: 48px; margin: 0; }
    </style></head>
    <body><div class="hero"><h1>Hero Heading Text</h1></div></body></html>
  `
  const result = await measure(html)
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  const unverifiable = result.textIssues.filter((i) => i.kind === 'contrast-unverifiable')
  assert.deepEqual(lowContrast, [], `expected no low-contrast findings, got: ${JSON.stringify(lowContrast)}`)
  assert.equal(unverifiable.length, 1, `expected one contrast-unverifiable finding, got: ${JSON.stringify(result.textIssues)}`)
})

test('an element with both a background-image and a solid background-color is still unverifiable (image paints over color)', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      .hero {
        background-color: #ffffff;
        background-image: linear-gradient(#000, #000);
        background-size: cover;
        padding: 40px;
      }
      h1 { color: #fff; font-size: 48px; margin: 0; }
    </style></head>
    <body><div class="hero"><h1>Hero Heading Text</h1></div></body></html>
  `
  const result = await measure(html)
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  const unverifiable = result.textIssues.filter((i) => i.kind === 'contrast-unverifiable')
  assert.deepEqual(
    lowContrast,
    [],
    `expected no low-contrast findings (white-on-white would be a false read from the color layer), got: ${JSON.stringify(lowContrast)}`
  )
  assert.equal(unverifiable.length, 1, `expected the image to take precedence over the same element's own color, got: ${JSON.stringify(result.textIssues)}`)
})

test('a nearer element\'s own opaque background takes precedence over a more distant ancestor\'s image', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      .hero { background-image: linear-gradient(#000, #000); background-size: cover; padding: 40px; }
      .card { background-color: #ffffff; padding: 16px; }
      p { color: #eeeeee; font-size: 16px; margin: 0; }
    </style></head>
    <body><div class="hero"><div class="card"><p>Card text over its own solid background.</p></div></div></body></html>
  `
  const result = await measure(html)
  const unverifiable = result.textIssues.filter((i) => i.kind === 'contrast-unverifiable')
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  assert.deepEqual(
    unverifiable,
    [],
    `expected the nearer .card background-color to resolve the background (not the ancestor's image), got: ${JSON.stringify(result.textIssues)}`
  )
  assert.equal(
    lowContrast.length,
    1,
    `expected the genuinely low-contrast text (#eee on the card's white) to still be detected, got: ${JSON.stringify(result.textIssues)}`
  )
})

// ─── Rendered-layer (hit-test) background resolution for overlays over siblings ──

test('a transparent fixed nav over a *sibling* background-image section is unable to verify (not an ancestor relationship)', async () => {
  // This mirrors the real bug found on sissyssweets-byem.com: a
  // position:fixed, transparent nav visually floats over a hero section
  // that is a sibling, not a DOM ancestor. A pure ancestor walk resolves the
  // nav text's background via nav -> body (missing the hero entirely);
  // only real paint-order hit-testing finds the hero's image is what's
  // actually rendered there.
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      .hero { position: absolute; top: 0; left: 0; width: 100%; height: 300px; background-image: linear-gradient(#000, #000); }
      nav { position: fixed; top: 0; left: 0; width: 100%; background: transparent; padding: 16px; }
      nav a { color: #fff; font-size: 18px; text-decoration: none; }
    </style></head>
    <body>
      <div class="hero"></div>
      <nav><a href="#">Sissy's Sweets</a></nav>
    </body></html>
  `
  const result = await measure(html)
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  const unverifiable = result.textIssues.filter((i) => i.kind === 'contrast-unverifiable')
  assert.deepEqual(lowContrast, [], `expected no false low-contrast finding, got: ${JSON.stringify(lowContrast)}`)
  assert.equal(unverifiable.length, 1, `expected the sibling hero image to be found via hit-testing, got: ${JSON.stringify(result.textIssues)}`)
})

test('a transparent fixed nav over a *sibling* solid-color section resolves to that color (not just images are found)', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      .hero { position: absolute; top: 0; left: 0; width: 100%; height: 300px; background: #000000; }
      nav { position: fixed; top: 0; left: 0; width: 100%; background: transparent; padding: 16px; }
      nav a { color: #fff; font-size: 18px; text-decoration: none; }
    </style></head>
    <body>
      <div class="hero"></div>
      <nav><a href="#">Logo Text</a></nav>
    </body></html>
  `
  const result = await measure(html)
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  const unverifiable = result.textIssues.filter((i) => i.kind === 'contrast-unverifiable')
  assert.deepEqual(unverifiable, [], `expected the sibling's solid color to be found (not marked unverifiable), got: ${JSON.stringify(result.textIssues)}`)
  assert.deepEqual(lowContrast, [], `expected white-on-black behind the overlay to read as good contrast, got: ${JSON.stringify(result.textIssues)}`)
})

test('an element with its own opaque background resolves via itself, with no overlay involved', async () => {
  // Regression guard: an earlier draft of the hit-test approach skipped the
  // sampled element itself when walking the paint-order stack, which broke
  // this ordinary, common case (no overlay at all).
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      p { color: #eeeeee; background: #ffffff; font-size: 16px; padding: 8px; }
    </style></head>
    <body><p>Genuinely low contrast text on its own solid background.</p></body></html>
  `
  const result = await measure(html)
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  assert.equal(lowContrast.length, 1, `expected the element's own background to be found and the low contrast detected, got: ${JSON.stringify(result.textIssues)}`)
})

test('a pointer-events:none decorative layer over text does not obstruct finding the real background behind it', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; background: #ffffff; }
      .glow { position: fixed; inset: 0; pointer-events: none; background: transparent; }
      p { color: #eeeeee; font-size: 16px; margin: 0; padding: 8px; }
    </style></head>
    <body>
      <div class="glow"></div>
      <p>Text under a decorative, non-interactive overlay layer.</p>
    </body></html>
  `
  const result = await measure(html)
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  const unverifiable = result.textIssues.filter((i) => i.kind === 'contrast-unverifiable')
  assert.deepEqual(unverifiable, [], `expected the decorative layer not to be misread as an unresolvable background, got: ${JSON.stringify(result.textIssues)}`)
  assert.equal(lowContrast.length, 1, `expected the real (white) background behind the decorative layer to be found and the low contrast detected, got: ${JSON.stringify(result.textIssues)}`)
})

test('falls back to an ancestor-only walk when elementsFromPoint is unavailable', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      .hero { position: absolute; top: 0; left: 0; width: 100%; height: 300px; background-image: linear-gradient(#000, #000); }
      nav { position: fixed; top: 0; left: 0; width: 100%; background: transparent; padding: 16px; }
      nav a { color: #fff; font-size: 18px; text-decoration: none; }
    </style></head>
    <body>
      <div class="hero"></div>
      <nav><a href="#">Sissy's Sweets</a></nav>
      <script>document.elementsFromPoint = undefined;</script>
    </body></html>
  `
  const result = await measure(html)
  // Without elementsFromPoint, the ancestor-only fallback can't see the
  // sibling .hero image (nav -> body only, both transparent/unset), so it
  // falls through to the white default and reads white-on-assumed-white as
  // low contrast — reproducing today's known limitation exactly, rather
  // than crashing. This proves the fallback branch itself runs (and that
  // the new hit-test path is genuinely what fixes the bug, not something
  // incidental).
  const lowContrast = result.textIssues.filter((i) => i.kind === 'low-contrast')
  const unverifiable = result.textIssues.filter((i) => i.kind === 'contrast-unverifiable')
  assert.deepEqual(unverifiable, [], `expected the fallback path not to find the sibling image, got: ${JSON.stringify(result.textIssues)}`)
  assert.equal(lowContrast.length, 1, `expected the fallback to reproduce the original false low-contrast read, got: ${JSON.stringify(result.textIssues)}`)
})

// ─── Ancestor-hidden elements (opacity, pointer-events, aria-hidden, hidden, inert) ──

test('elements inside a closed (opacity:0, pointer-events:none) menu are not treated as visible tap targets', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      button { width: 60px; height: 60px; }
      nav { opacity: 0; pointer-events: none; position: absolute; top: 0; left: 0; }
      nav a { display: inline-block; width: 20px; height: 20px; }
    </style></head>
    <body>
      <button>Real Button</button>
      <nav><a href="#">Hidden 1</a><a href="#">Hidden 2</a></nav>
    </body></html>
  `
  const result = await measure(html, 'mobile')
  assert.deepEqual(result.tapTargets, [], `expected no tap-target findings at all, got: ${JSON.stringify(result.tapTargets)}`)
})

test('an aria-hidden ancestor excludes its contents from visibility-based checks', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      a { display: inline-block; width: 20px; height: 20px; }
    </style></head>
    <body>
      <div aria-hidden="true"><a href="#">Hidden</a></div>
    </body></html>
  `
  const result = await measure(html, 'mobile')
  assert.deepEqual(result.tapTargets, [], `expected the aria-hidden link to be excluded, got: ${JSON.stringify(result.tapTargets)}`)
})

test('elements inside [hidden] or [inert] containers are excluded from visibility-based checks', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      button { width: 20px; height: 20px; }
    </style></head>
    <body>
      <div hidden><button>In hidden</button></div>
      <div inert><button>In inert</button></div>
    </body></html>
  `
  const result = await measure(html, 'mobile')
  assert.deepEqual(result.tapTargets, [], `expected both to be excluded, got: ${JSON.stringify(result.tapTargets)}`)
})

test('a hidden phantom element no longer corrupts a real button\'s neighbor-spacing result', async () => {
  // Before the fix, the invisible (but still laid-out) nav overlapped the real
  // button in screen coordinates, giving the real, correctly-sized button a
  // false minGapToNeighbor of 0 and getting it wrongly flagged as crowded.
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      button { width: 60px; height: 60px; }
      nav { opacity: 0; pointer-events: none; position: absolute; top: 0; left: 0; }
      nav a { display: inline-block; width: 20px; height: 20px; }
    </style></head>
    <body>
      <button>Real Button</button>
      <nav><a href="#">Hidden 1</a></nav>
    </body></html>
  `
  const result = await measure(html, 'mobile')
  const realButtonFinding = result.tapTargets.find((t) => t.label === 'Real Button')
  assert.equal(realButtonFinding, undefined, `expected the real, well-sized button to not be flagged, got: ${JSON.stringify(result.tapTargets)}`)
})

test('genuinely undersized, unhidden tap targets are still detected', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      button { width: 24px; height: 24px; }
    </style></head>
    <body><button>Tiny</button></body></html>
  `
  const result = await measure(html, 'mobile')
  assert.equal(result.tapTargets.length, 1, `expected the genuinely tiny button to be flagged, got: ${JSON.stringify(result.tapTargets)}`)
  assert.equal(result.tapTargets[0].label, 'Tiny')
})

test('genuinely crowded (small-gap), fully visible tap targets are still detected', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      button { position: absolute; width: 44px; height: 44px; top: 0; }
      .btn-a { left: 0px; }
      .btn-b { left: 46px; } /* 2px gap: under the 4px minimum */
    </style></head>
    <body>
      <button class="btn-a">A</button>
      <button class="btn-b">B</button>
    </body></html>
  `
  const result = await measure(html, 'mobile')
  assert.equal(result.tapTargets.length, 2, `expected both crowded buttons to be flagged, got: ${JSON.stringify(result.tapTargets)}`)
})

// ─── Heading-only line-height leniency ───────────────────────────────────

test('a large heading (h1) with tight line-height is not flagged as cramped', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      h1 { font-size: 56px; line-height: 1; margin: 0; }
    </style></head>
    <body><h1>Big Display Heading</h1></body></html>
  `
  const result = await measure(html)
  const tight = result.textIssues.filter((i) => i.kind === 'tight-line-height')
  assert.deepEqual(tight, [], `expected no tight-line-height finding for a heading, got: ${JSON.stringify(tight)}`)
})

test('an element with role="heading" gets the same line-height leniency as a real heading tag', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      .fake-heading { font-size: 56px; line-height: 1; margin: 0; display: block; }
    </style></head>
    <body><div class="fake-heading" role="heading" aria-level="1">Big Display Heading</div></body></html>
  `
  const result = await measure(html)
  const tight = result.textIssues.filter((i) => i.kind === 'tight-line-height')
  assert.deepEqual(tight, [], `expected role="heading" to get the same leniency, got: ${JSON.stringify(tight)}`)
})

test('a large NON-heading element with tight line-height is still flagged (font size alone is not enough to exempt it)', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      p.pull-quote { font-size: 32px; line-height: 1; margin: 0; }
    </style></head>
    <body><p class="pull-quote">A large styled pull-quote that is not semantically a heading.</p></body></html>
  `
  const result = await measure(html)
  const tight = result.textIssues.filter((i) => i.kind === 'tight-line-height')
  assert.equal(tight.length, 1, `expected a large non-heading element to still use the strict threshold, got: ${JSON.stringify(result.textIssues)}`)
})

test('a heading with genuinely broken (overlapping) line-height is still flagged', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; width: 300px; }
      h1 { font-size: 56px; line-height: 0.5; margin: 0; }
    </style></head>
    <body><h1>A Heading Long Enough To Wrap Onto More Than One Line</h1></body></html>
  `
  const result = await measure(html)
  const tight = result.textIssues.filter((i) => i.kind === 'tight-line-height')
  assert.equal(tight.length, 1, `expected genuinely broken heading line-height to still be flagged, got: ${JSON.stringify(result.textIssues)}`)
})

test('normal body text with tight line-height is still flagged (unchanged threshold for non-heading text)', async () => {
  const html = `
    <!doctype html>
    <html><head><style>
      body { margin: 0; }
      p { font-size: 16px; line-height: 1; margin: 0; }
    </style></head>
    <body><p>Ordinary paragraph text with line-height exactly matching its font size.</p></body></html>
  `
  const result = await measure(html)
  const tight = result.textIssues.filter((i) => i.kind === 'tight-line-height')
  assert.equal(tight.length, 1, `expected ordinary body text to still use the strict threshold, got: ${JSON.stringify(result.textIssues)}`)
})
