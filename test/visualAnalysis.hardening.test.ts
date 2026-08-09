// Tests for the 2026-08-08 comprehensive reliability hardening pass, covering
// visualAnalysis.ts (measurement layer) fixes not already covered by
// visualAnalysis.textDedup.test.ts:
// - hidden contact/CTA links no longer counting as "found"
// - the shared 40-element contrast-sampling budget removal (a genuinely
//   low-contrast element after many earlier unverifiable/passing ones must
//   still be detected)
// - incompleteCoverage flags firing when a page has more real candidates
//   than the bounded scan examines
// - determinism under DOM reordering (the same set of elements, inserted in
//   a different order, must produce the same aggregate counts/groups)
//
// Run with: node --test test/visualAnalysis.hardening.test.ts

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

async function measure(bodyHtml: string, viewportLabel: ViewportLabel = 'mobile', headHtml = '') {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport(viewportLabel === 'mobile' ? { width: 390, height: 844 } : { width: 1024, height: 768 })
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${headHtml}</head><body>${bodyHtml}</body></html>`, {
      waitUntil: 'load',
    })
    return await page.evaluate(collectPageMeasurements, viewportLabel)
  } finally {
    await page.close()
  }
}

// ─── Hidden contact link / CTA visibility ──────────────────────────────────

test('a display:none contact link does not count as a working contact path', async () => {
  const m = await measure(`
    <a href="mailto:hidden@example.com" style="display:none;">Email us (hidden)</a>
    <p>No other contact info on this page.</p>
  `)
  assert.equal(m.cta.hasContactLink, false)
})

test('a visible contact link (no hiding style) still counts', async () => {
  const m = await measure(`<a href="mailto:visible@example.com">Email us</a>`)
  assert.equal(m.cta.hasContactLink, true)
})

test('a display:none primary-action button does not count', async () => {
  const m = await measure(`<button class="cta-button" style="display:none;">Buy Now</button>`)
  assert.equal(m.cta.hasPrimaryAction, false)
})

test('an aria-hidden contact link does not count, even though it matches the selector', async () => {
  const m = await measure(`<div aria-hidden="true"><a href="tel:5551234567">Call (hidden from AT and, here, visually too)</a></div>`)
  assert.equal(m.cta.hasContactLink, false)
})

// ─── Shared contrast-sampling budget removal ───────────────────────────────
// Before the fix, contrast checks stopped after the first 40 elements
// (in DOM order) that had fontSize >= 10, REGARDLESS of what kind of
// candidate they were. A page with 45+ early elements sitting over a
// background image (contrast-unverifiable, harmless) could consume the
// entire budget and leave a later, genuinely low-contrast paragraph never
// checked at all.

test('a genuinely low-contrast paragraph AFTER 45 unverifiable (over-background-image) candidates is still detected', async () => {
  const unverifiableBlock = Array.from(
    { length: 45 },
    (_, i) => `<p style="background-image:url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7);color:#333;">Over image ${i}</p>`
  ).join('\n')
  const m = await measure(`
    <div>${unverifiableBlock}</div>
    <p style="color: rgb(200,200,200); background-color: rgb(210,210,210);">Genuinely low contrast text after the unverifiable block</p>
  `)
  const unverifiable = m.textIssues.filter((i) => i.kind === 'contrast-unverifiable')
  const lowContrast = m.textIssues.filter((i) => i.kind === 'low-contrast')
  assert.equal(unverifiable.length, 45, 'sanity check: all 45 earlier candidates were genuinely evaluated as unverifiable')
  assert.equal(lowContrast.length, 1, 'the later genuinely low-contrast paragraph must still be caught, not crowded out by the earlier 45')
  assert.match(lowContrast[0].sample, /Genuinely low contrast/)
})

// ─── incompleteCoverage flags ───────────────────────────────────────────────

test('a page with more text candidates than the bounded scan examines sets incompleteCoverage.textIssues, and a page well under the cap does not', async () => {
  // TEXT_CANDIDATE_CAP is 400 — 420 short, distinct paragraphs comfortably exceeds it.
  const manyParas = Array.from({ length: 420 }, (_, i) => `<p>Paragraph number ${i} with enough text to qualify.</p>`).join('\n')
  const big = await measure(manyParas)
  assert.equal(big.incompleteCoverage.textIssues, true)

  const small = await measure('<p>Just one normal paragraph.</p>')
  assert.equal(small.incompleteCoverage.textIssues, false)
})

test('a page with more than IMAGE_CAP images sets incompleteCoverage.images', async () => {
  const manyImages = Array.from(
    { length: 110 },
    (_, i) =>
      `<img alt="img ${i}" width="10" height="10" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7" />`
  ).join('\n')
  const m = await measure(manyImages)
  assert.equal(m.incompleteCoverage.images, true)
})

test('a page with more heading/nav-link/button candidates than IMPORTANT_ELEMENT_CAP sets incompleteCoverage.overlap', async () => {
  // Candidates for the clip/overlap scan are h1, h2, nav a, header a, button,
  // [role="button"], a.btn — 210 nav links comfortably exceeds the 200 cap.
  const manyNavLinks = Array.from({ length: 210 }, (_, i) => `<a href="#l${i}">Link ${i}</a>`).join('\n')
  const m = await measure(`<nav>${manyNavLinks}</nav>`)
  assert.equal(m.incompleteCoverage.overlap, true)
})

test('a page with more mobile tap-target candidates than the bounded scan examines sets incompleteCoverage.tapTargets', async () => {
  const manyLinks = Array.from({ length: 210 }, (_, i) => `<footer><a href="#l${i}" style="display:inline-block;width:8px;height:8px;">${i}</a></footer>`).join('\n')
  const m = await measure(manyLinks, 'mobile')
  assert.equal(m.incompleteCoverage.tapTargets, true)
})

// ─── Overlays: not capped, and returned worst-first ────────────────────────
// Scoring only ever looks at the single WORST (largest areaRatio) overlay.
// The previous version capped this list at 5 WITHOUT sorting first, so a
// page with 6+ genuine overlays risked the true worst offender landing
// outside the cap while a lesser one survived and got scored in its place.
// 8 overlays are created here, worst (largest) last in DOM order — every one
// must survive (no cap), and the array must come back sorted worst-first.

test('overlays: none are dropped by a cap, and the true worst one sorts first regardless of DOM order', async () => {
  // All >= 50% of viewport height so none of them can be mistaken for the
  // page's real fixed header (which is deliberately excluded from
  // "overlay" findings — see the `!== topHeader` filter — and only
  // considers elements under 50% of the viewport height a candidate).
  const overlays = Array.from({ length: 8 }, (_, i) => {
    const heightPct = 55 + i * 5 // ascending: worst (largest) is LAST in DOM order
    return `<div style="position:fixed;top:0;left:0;width:100%;height:${heightPct}%;background:red;z-index:${i};"></div>`
  }).join('\n')
  const m = await measure(overlays, 'mobile')
  assert.equal(m.overlays.length, 8, 'no cap should have dropped any genuine overlay')
  const largest = Math.max(...m.overlays.map((o) => o.areaRatio))
  assert.ok(m.overlays[0].areaRatio === largest, 'the returned list must already be sorted worst-first')
  assert.ok(largest > 0.85, `expected the largest overlay (~90%) to be present, got ${largest}`)
})

test('incompleteCoverage never fires for an ordinary small page across every tracked category', async () => {
  const m = await measure(`
    <header><nav><a href="#a">A</a></nav></header>
    <main><h1>Hello</h1><p>Some text.</p></main>
    <footer><p>© ${new Date().getFullYear()} Example</p></footer>
  `)
  assert.deepEqual(m.incompleteCoverage, { textIssues: false, tapTargets: false, images: false, overlap: false })
})

// ─── Determinism under DOM reordering ──────────────────────────────────────
// The same set of elements, inserted in a different order, must produce the
// same aggregate tiny-font group structure and the same total counts — DOM
// order may change WHICH array index a given finding lands at, but must
// never change the aggregate facts a score is built from.

test('DOM reordering: the same tiny-font elements in a different order produce identical group counts and totals', async () => {
  const elements = [
    '<span class="eyebrow" style="font-size:8px;">Label One</span>',
    '<span class="eyebrow" style="font-size:8px;">Label Two</span>',
    '<p style="font-size:9px;">A small paragraph line.</p>',
    '<span class="eyebrow" style="font-size:8px;">Label Three</span>',
    '<p style="font-size:9px;">Another small paragraph line.</p>',
  ]
  const forward = await measure(elements.join('\n'))
  const reversed = await measure([...elements].reverse().join('\n'))

  function summarize(m: Awaited<ReturnType<typeof measure>>) {
    const tiny = m.textIssues.filter((i) => i.kind === 'tiny-font')
    const byGroup = new Map<string, number>()
    for (const i of tiny) byGroup.set(i.groupKey ?? i.sample, (byGroup.get(i.groupKey ?? i.sample) ?? 0) + 1)
    return { total: tiny.length, groups: [...byGroup.entries()].sort() }
  }

  assert.deepEqual(summarize(forward), summarize(reversed))
})

test('DOM reordering: an unrelated new element inserted in the middle of the page does not change existing findings\' counts', async () => {
  const original = `
    <span class="eyebrow" style="font-size:8px;">Label One</span>
    <span class="eyebrow" style="font-size:8px;">Label Two</span>
  `
  const withInsertion = `
    <span class="eyebrow" style="font-size:8px;">Label One</span>
    <p>A normal, unrelated 16px paragraph inserted in between — should have zero effect.</p>
    <span class="eyebrow" style="font-size:8px;">Label Two</span>
  `
  const m1 = await measure(original)
  const m2 = await measure(withInsertion)
  const tiny1 = m1.textIssues.filter((i) => i.kind === 'tiny-font')
  const tiny2 = m2.textIssues.filter((i) => i.kind === 'tiny-font')
  assert.equal(tiny1.length, 2)
  assert.equal(tiny2.length, 2, 'the unrelated normal-sized paragraph must not itself become a finding or alter the count')
})
