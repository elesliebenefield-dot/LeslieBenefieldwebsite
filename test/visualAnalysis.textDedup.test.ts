// Tests for the nested-element text-ownership dedup rule in
// collectPageMeasurements (src/lib/visualAnalysis.ts): isRedundantWithAncestor.
//
// Discovered via a real bug: sissyssweets-byem.com's footer credit line is
// `<p class="footer__credit">Designed by <a>Websites by Leslie</a></p>`. Both
// the <p> and the nested <a> independently qualified as tiny-font candidates,
// double-counting one rendered line as two unrelated defects (confirmed
// live: identical 10.4px font-size and identical rgb(184,136,136) color —
// only text-decoration differs). The rule: a descendant nested inside an
// already-eligible ancestor is redundant (excluded) only when it renders
// under the SAME font-size, line-height, and color as that ancestor — i.e.
// it's extra markup (typically a hyperlink) around text the ancestor already
// accounts for, not a distinct styling decision. A descendant that genuinely
// differs (a different font-size or color) keeps its own finding. This is
// structural (DOM ancestry + computed style) — no site-specific selectors.
//
// Run with: node --test test/visualAnalysis.textDedup.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { collectPageMeasurements, type ViewportLabel } from '../src/lib/visualAnalysis.ts'
import { computeTinyFontRatioLost } from '../src/lib/visualScoring.ts'

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let browser: Browser

before(async () => {
  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
})

async function measure(bodyHtml: string, viewportLabel: ViewportLabel = 'mobile') {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport(viewportLabel === 'mobile' ? { width: 390, height: 844 } : { width: 1024, height: 768 })
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${bodyHtml}</body></html>`, { waitUntil: 'load' })
    return await page.evaluate(collectPageMeasurements, viewportLabel)
  } finally {
    await page.close()
  }
}

function tinyFont(m: Awaited<ReturnType<typeof measure>>) {
  return m.textIssues.filter((i) => i.kind === 'tiny-font')
}

test('paragraph containing only a link: the wrapper has no own text and is excluded (pre-existing behavior), the link is evaluated alone', async () => {
  const m = await measure(`<p><a href="#" style="font-size:8px;">Just a link label here</a></p>`)
  const tiny = tinyFont(m)
  assert.equal(tiny.length, 1)
  assert.equal(tiny[0].sample, 'Just a link label here')
})

test('paragraph with direct text plus a link, SAME style: only the paragraph counts once — the nested link is redundant', async () => {
  const m = await measure(
    `<p style="font-size:8px;color:#333;">Designed by <a href="#" style="color:#333;">Someone Nice</a></p>`
  )
  const tiny = tinyFont(m)
  assert.equal(tiny.length, 1, 'the <p> and its nested <a> render at identical font-size/line-height/color — one rendered line, one finding')
  assert.equal(tiny[0].sample, 'Designed by Someone Nice', 'the kept parent retains its own direct text alongside the descendant\'s')
})

test('paragraph with direct text plus a link, DIFFERENT font-size: both count — a genuinely distinct style is not deduplicated', async () => {
  const m = await measure(`<p style="font-size:8px;">Designed by <a href="#" style="font-size:6px;">Someone Nice</a></p>`)
  const tiny = tinyFont(m)
  assert.equal(tiny.length, 2, 'the link renders at a meaningfully different size than its parent, so it is a separate rendering decision')
})

test('nested spans, SAME style: only the outer span counts', async () => {
  const m = await measure(`<span style="font-size:8px;">Outer <span>Inner text</span> more</span>`)
  const tiny = tinyFont(m)
  assert.equal(tiny.length, 1)
  assert.equal(tiny[0].sample, 'Outer Inner text more')
})

test('nested spans, DIFFERENT style: both count', async () => {
  const m = await measure(`<span style="font-size:8px;">Outer <span style="font-size:6px;">Inner text</span> more</span>`)
  const tiny = tinyFont(m)
  assert.equal(tiny.length, 2)
})

test('multiple separate (non-nested) links: both count independently — matching style elsewhere on the page is not, by itself, redundancy', async () => {
  const m = await measure(`
    <div><a href="#" style="font-size:8px;">First link label</a></div>
    <div><a href="#" style="font-size:8px;">Second link label</a></div>
  `)
  const tiny = tinyFont(m)
  assert.equal(tiny.length, 2, 'neither link is an ancestor/descendant of the other — redundancy requires DOM containment, not just similar styling')
})

test('genuinely separate repeated text elements (siblings in unrelated containers): all count independently and group together normally', async () => {
  const m = await measure(`
    <section><span class="eyebrow" style="font-size:8px;">Label One</span></section>
    <section><span class="eyebrow" style="font-size:8px;">Label Two</span></section>
    <section><span class="eyebrow" style="font-size:8px;">Label Three</span></section>
  `)
  const tiny = tinyFont(m)
  assert.equal(tiny.length, 3)
  const groupKeys = new Set(tiny.map((i) => i.groupKey))
  assert.equal(groupKeys.size, 1, 'same tag/class/font-size, no ancestor relationship — grouped together as one style, not deduplicated against each other')
})

test('grouping after deduplication: repeated same-style credit lines with nested links group to the TRUE instance count, not inflated by the excluded links', async () => {
  const m = await measure(`
    <p class="credit" style="font-size:8px;">Designed by <a href="#" style="color:inherit;">Person A</a></p>
    <p class="credit" style="font-size:8px;">Made by <a href="#" style="color:inherit;">Person B</a></p>
    <p class="credit" style="font-size:8px;">Plain credit line only</p>
  `)
  const tiny = tinyFont(m)
  // Without dedup this would be 5 (3 paragraphs + 2 nested links). With it,
  // the two nested links are redundant with their identically-styled parents.
  assert.equal(tiny.length, 3)
  const byGroup = new Map<string, number>()
  for (const i of tiny) byGroup.set(i.groupKey ?? i.sample, (byGroup.get(i.groupKey ?? i.sample) ?? 0) + 1)
  assert.equal(byGroup.size, 1, 'all three <p class="credit"> share one style group')
  const [[, count]] = byGroup
  assert.equal(count, 3)

  // Feed straight into the scoring layer: volumeFactor must reflect the true
  // n=3, not a phantom n=5 from the excluded nested links.
  const ratioLost = computeTinyFontRatioLost(tiny)
  // severity=(12-8)/5=0.8, role='body' (a <p> tag) weight=1.0, volumeFactor
  // for n=3 = 1 + 0.1*2 = 1.2 -> weightedSum = 0.8*1.0*1.2 = 0.96
  // -> ratioLost = min(1, 0.96/2.5) = 0.384
  assert.ok(Math.abs(ratioLost - 0.384) < 1e-9, `expected ~0.384, got ${ratioLost}`)
})
