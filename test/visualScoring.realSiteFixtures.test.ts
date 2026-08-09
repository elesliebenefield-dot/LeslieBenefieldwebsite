// Pinned regression fixtures for the two real sites this checker has actually
// been run against (sissyssweets-byem.com and websitesbyleslie.com).
//
// IMPORTANT (two rounds of reconciliation, 2026-08-08):
//
// 1. production (api/check-visual.ts) always calls scrollThroughPageAndSettle()
// before collectPageMeasurements() — it scrolls the full page height to
// trigger scroll-reveal animations (opacity:0 until scrolled into view)
// before measuring. An earlier version of this fixture was captured WITHOUT
// that step and silently missed every element gated behind
// sissyssweets-byem.com's scroll-reveal animations — 6 of the site's 15
// genuine tiny-font instances (an entire "Featured Creations" card section
// plus two eyebrow-labeled sections) were invisible at measurement time.
// `measure()` below always performs the same scroll step production does.
//
// 2. Of those 15, one was itself a duplicate: `<p class="footer__credit">
// Designed by <a>Websites by Leslie</a></p>` — the <p> and its nested <a>
// render at IDENTICAL font-size and color (confirmed live), so both
// independently qualified as tiny-font candidates for what is one rendered
// line. collectPageMeasurements now excludes a descendant that renders no
// distinct style from an already-eligible ancestor (see
// isRedundantWithAncestor and test/visualAnalysis.textDedup.test.ts) — the
// true, deduplicated count is **14 instances across 6 style groups**, not 15
// across 7. The HTML fixture below reproduces every section that mattered,
// not a partial subset — this is the complete, correct, deduplicated dataset.
//
// These are static HTML reproductions of the measured DOM structure (same
// tag, class, and computed font size for every element that mattered to the
// readability check, plus enough of the rest of the page to reproduce the
// live site's full 12-check profile) — the automated suite never touches the
// live network; only the one-time snapshot that produced these fixtures did.
//
// Run with: node --test test/visualScoring.realSiteFixtures.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { collectPageMeasurements, type ViewportLabel, type RawMeasurements } from '../src/lib/visualAnalysis.ts'
import { scrollThroughPageAndSettle } from '../src/lib/scrollSettle.ts'
import { buildVisualReport } from '../src/lib/visualScoring.ts'

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let browser: Browser

before(async () => {
  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
})

// Small, solid-color, correctly-proportioned inline logo — natural size matches
// rendered size exactly, so the logo check can land on "good" rather than
// "unverified", the same way it does on both real sites.
const LOGO_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#333"/></svg>')

async function measure(html: string, viewportLabel: ViewportLabel): Promise<RawMeasurements> {
  const page: Page = await browser.newPage()
  try {
    await page.setViewport(viewportLabel === 'mobile' ? { width: 390, height: 844 } : { width: 1024, height: 768 })
    await page.setContent(html, { waitUntil: 'load' })
    // Match production exactly: it always scrolls through the page before
    // measuring (see the file-level comment above for why this matters).
    await scrollThroughPageAndSettle(page)
    return await page.evaluate(collectPageMeasurements, viewportLabel)
  } finally {
    await page.close()
  }
}

// ─── sissyssweets-byem.com ─────────────────────────────────────────────────
// Reproduces every section of the live site that contributes a genuine
// tiny-font instance, at the exact tag/class/font-size Puppeteer measured
// (2026-08-08, with the scroll step): a hero badge, six eyebrow-labeled
// section headers sharing one style, three category tags on the "Featured
// Creations" cards sharing another, and four footer lines — one of which
// (the footer__credit paragraph) has a nested <a> that renders at the exact
// same font-size and color as its parent and is correctly excluded as
// redundant. 6 unique style groups, 14 raw instances total. Also reproduces
// the header/nav/logo/CTA/headings/footer-copyright/tap-target shape closely
// enough that all 11 non-readability checks land on "good", the same as the
// live site — so the pinned overall score is a genuine end-to-end
// reproduction, not just the
// readability sub-score in isolation.
const sissysSweetsHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>Sissy's Sweets</title>
<style>
  body { margin: 0; font-family: sans-serif; color: #222; background: #fff; }
  header { padding: 12px 16px; display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
  header nav { display: flex; flex-wrap: wrap; gap: 10px 10px; row-gap: 10px; }
  header nav a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 10px; font-size: 16px; color: #222; text-decoration: none; }
  .logo { width: 100px; height: 40px; }
  .menu-toggle { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; }
  .hero { padding: 40px 20px; }
  .hero h1 { font-size: 32px; margin: 0 0 12px; }
  .hero__badge { font-size: 10.88px; display: inline-block; }
  .hero p { font-size: 16px; line-height: 1.5; max-width: 60ch; }
  .cta { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 20px; font-size: 16px; color: #fff; background: #333; text-decoration: none; margin-top: 16px; }
  section { padding: 32px 20px; }
  .eyebrow { font-size: 11.2px; display: block; margin-bottom: 8px; }
  .cards { display: flex; flex-wrap: wrap; gap: 16px; }
  .card { padding: 16px; }
  .card__cat { font-size: 10.56px; display: block; margin-bottom: 6px; }
  footer { padding: 24px; }
  footer .footer__col-title { font-size: 10.4px; margin: 0 0 8px; }
  footer p { font-size: 11.52px; margin: 4px 0; }
  footer .footer__credit { font-size: 10.4px; }
  footer a { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; min-width: 40px; font-size: 10.4px; color: #222; }
  @media (max-width: 480px) {
    header nav { display: none; }
  }
</style></head>
<body>
  <header>
    <img class="logo" src="${LOGO_SRC}" alt="Sissy's Sweets logo" />
    <nav aria-label="Primary">
      <a href="#home">Home</a><a href="#about">About</a><a href="#contact">Contact</a>
      <a href="#menus">Menus</a><a href="#projects">Projects</a><a href="#reviews">Reviews</a>
    </nav>
    <button type="button" class="menu-toggle" aria-label="Open menu">&#9776;</button>
  </header>
  <main>
    <section class="hero">
      <h1>Custom Cakes, Cupcakes &amp; More</h1>
      <span class="hero__badge">Young Harris, Georgia</span>
      <p>Handcrafted desserts made with love, right here in the mountains of North Georgia.</p>
      <a class="cta" href="#work">See My Work</a>
    </section>
    <section>
      <span class="eyebrow">Featured Creations</span>
      <h2>What We Make</h2>
      <div class="cards">
        <article class="card"><span class="card__cat">Cakes</span><h3>Custom Cakes</h3></article>
        <article class="card"><span class="card__cat">Cupcakes</span><h3>Cupcake Orders</h3></article>
        <article class="card"><span class="card__cat">Specialty Treats</span><h3>Specialty Treats</h3></article>
      </div>
    </section>
    <section>
      <span class="eyebrow">Meet the Baker</span>
      <h2>About Sissy</h2>
      <p>Every order is made fresh, from scratch, with the best ingredients I can find.</p>
    </section>
    <section>
      <span class="eyebrow">What Customers Say</span>
      <h2>Reviews</h2>
      <p>"Absolutely the best cake I've ever had — will be ordering again!"</p>
    </section>
    <section>
      <span class="eyebrow">Stay Connected</span>
      <h2>Follow Along</h2>
      <p>Find the latest photos and specials on social media.</p>
    </section>
    <section>
      <span class="eyebrow">Where We Serve</span>
      <h2>Service Area</h2>
      <p>Proudly serving Young Harris, Georgia and the surrounding area.</p>
    </section>
    <section>
      <span class="eyebrow">Ready to Order?</span>
      <h2>Get In Touch</h2>
      <a class="cta" href="#contact">Contact Sissy's Sweets</a>
    </section>
  </main>
  <footer>
    <h3 class="footer__col-title">Contact</h3>
    <p>© 2026 Sissy's Sweets by Em &nbsp;&middot;&nbsp; Young Harris, Georgia</p>
    <p class="footer__credit">Designed &amp; Developed by <a href="#">Websites by Leslie</a></p>
    <p>Making your life sweeter, one order at a time.</p>
  </footer>
</body></html>`

test('sissyssweets-byem.com fixture: desktop has zero tiny-font issues (mobile-only detection)', async () => {
  const desktop = await measure(sissysSweetsHtml, 'desktop')
  const tinyFont = desktop.textIssues.filter((i) => i.kind === 'tiny-font')
  assert.equal(tinyFont.length, 0)
})

test('sissyssweets-byem.com fixture: mobile reproduces all 14 deduplicated genuine instances across 6 unique style groups', async () => {
  const mobile = await measure(sissysSweetsHtml, 'mobile')
  const tinyFont = mobile.textIssues.filter((i) => i.kind === 'tiny-font')
  assert.equal(
    tinyFont.length,
    14,
    '1 hero badge + 6 eyebrow section headers + 3 card categories + 1 footer col-title + 2 plain footer <p> + 1 footer__credit ' +
      '(its nested credit link is redundant — same font-size/color as the <p> — and correctly excluded)'
  )

  const byGroup = new Map<string, typeof tinyFont>()
  for (const issue of tinyFont) {
    const key = issue.groupKey ?? issue.sample
    byGroup.set(key, [...(byGroup.get(key) ?? []), issue])
  }
  assert.equal(byGroup.size, 6, 'unique style groups')

  assert.equal(byGroup.get('span|hero__badge|11')?.length, 1)
  assert.equal(byGroup.get('span|eyebrow|11')?.length, 6, 'Featured Creations, Meet the Baker, What Customers Say, Stay Connected, Where We Serve, Ready to Order?')
  assert.equal(byGroup.get('span|card__cat|11')?.length, 3, 'Cakes, Cupcakes, Specialty Treats')
  assert.equal(byGroup.get('h3|footer__col-title|10')?.length, 1)
  assert.equal(byGroup.get('p||12')?.length, 2, 'the two plain <p> footer lines round to the same 12px group')
  assert.equal(byGroup.get('p|footer__credit|10')?.length, 1)
  assert.equal(byGroup.get('a||10'), undefined, 'the nested footer credit link is redundant with its identically-styled parent <p> and must not form its own group')

  for (const key of ['span|hero__badge|11', 'span|eyebrow|11', 'span|card__cat|11']) {
    for (const issue of byGroup.get(key) ?? []) assert.equal(issue.role, 'label')
  }
  for (const key of ['h3|footer__col-title|10', 'p||12', 'p|footer__credit|10']) {
    for (const issue of byGroup.get(key) ?? []) assert.equal(issue.role, 'footer')
  }

  const creditLine = byGroup.get('p|footer__credit|10')?.[0]
  assert.equal(creditLine?.sample, "Designed & Developed by Websites by Leslie", 'the kept parent still retains its own direct text alongside the excluded descendant\'s')
})

test('sissyssweets-byem.com fixture: pinned readability score — 6 grouped label/footer styles cost 9/12 points, no severe override', async () => {
  const desktop = await measure(sissysSweetsHtml, 'desktop')
  const mobile = await measure(sissysSweetsHtml, 'mobile')
  const report = buildVisualReport(desktop, mobile)
  const finding = report.findings.find((f) => f.id === 'readability')
  if (!finding) throw new Error('no readability finding in report')

  assert.equal(finding.bucket, 'improve')
  // Hand-derived (see the reconciliation report for the full group-by-group
  // table): severities 0.224/0.16/0.288/0.32/0.096/0.32 x role weights
  // (label 0.4, footer 0.5) x volume factors (1, 1.5, 1.2, 1, 1.1, 1) sum
  // to 0.69664; ratioLost = 0.69664 / 2.5 = 0.278656; no group clears the
  // severe-override role-weight minimum (0.8) — max here is 0.5 (footer) —
  // so the override never fires regardless of instance count.
  // points = round(12 * (1 - 0.278656)) = round(8.656128) = 9.
  assert.equal(finding.points, 9)
  assert.match(finding.detail, /unusually small mobile text/)
})

test('sissyssweets-byem.com fixture: pinned overall score is 97/100 (88 from the other 11 checks, 9 from readability)', async () => {
  const desktop = await measure(sissysSweetsHtml, 'desktop')
  const mobile = await measure(sissysSweetsHtml, 'mobile')
  const report = buildVisualReport(desktop, mobile)

  const nonReadability = report.findings.filter((f) => f.id !== 'readability' && f.id !== 'ecommerce-visual')
  for (const f of nonReadability) {
    assert.equal(f.bucket, 'good', `expected "${f.label}" to be good, got "${f.bucket}": ${f.detail}`)
  }
  assert.equal(report.checksCompleted, 12)
  assert.equal(report.score, 97)
})

// ─── websitesbyleslie.com ───────────────────────────────────────────────────
// Reproduces the live site's shape: a normal-sized footer (no tiny-font
// anywhere) plus several pieces of text sitting over a background image,
// which the live site also reported as contrast-unverifiable. Confirms the
// grouped model contributes exactly 0 when there is nothing to group. Also
// re-verified with the scroll step (see file-level comment) — unaffected;
// this site has no scroll-reveal-gated content and no tiny-font either way.
const websitesByLeslieHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>Websites by Leslie</title>
<style>
  body { margin: 0; font-family: sans-serif; }
  header nav a { display: inline-block; padding: 8px 12px; font-size: 16px; }
  .hero { padding: 40px 20px; background: linear-gradient(135deg, #222, #555); color: #fff; }
  .hero h1 { font-size: 32px; }
  footer { padding: 24px; font-size: 14px; }
  .cta { display: inline-block; padding: 12px 20px; font-size: 16px; }
</style></head>
<body>
  <header>
    <nav aria-label="Primary">
      <a href="#home">Home</a><a href="#services">Services</a><a href="#contact">Contact</a>
    </nav>
  </header>
  <main>
    <section class="hero">
      <h1>Websites that work as hard as you do</h1>
      <a class="cta" href="#contact">Get a Free Quote</a>
    </section>
  </main>
  <footer>
    <p>Designed &amp; Developed by Leslie © 2026</p>
    <p>850-565-9114 &middot; websitesbyleslie01@gmail.com</p>
    <p>850-565-9114</p>
    <p>websitesbyleslie01@gmail.com</p>
    <p>Secure online payments accepted</p>
    <p>Other payment arrangements available upon request.</p>
  </footer>
</body></html>`

test('websitesbyleslie.com fixture: zero tiny-font issues at either viewport', async () => {
  const desktop = await measure(websitesByLeslieHtml, 'desktop')
  const mobile = await measure(websitesByLeslieHtml, 'mobile')
  assert.equal(desktop.textIssues.filter((i) => i.kind === 'tiny-font').length, 0)
  assert.equal(mobile.textIssues.filter((i) => i.kind === 'tiny-font').length, 0)
})

test('websitesbyleslie.com fixture: pinned readability score is fully credited (grouped model contributes 0 with nothing to group)', async () => {
  const desktop = await measure(websitesByLeslieHtml, 'desktop')
  const mobile = await measure(websitesByLeslieHtml, 'mobile')
  const report = buildVisualReport(desktop, mobile)
  const finding = report.findings.find((f) => f.id === 'readability')
  if (!finding) throw new Error('no readability finding in report')

  // The hero text sits over a gradient background, so it's contrast-unverifiable
  // (matches the live site) — that alone makes this an "unverified" bucket,
  // not "good", but it must cost zero points either way.
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
  assert.doesNotMatch(finding.detail, /unusually small mobile text/)
})
