// Tests for the 2026-08-08 comprehensive reliability hardening pass:
// - viewport aggregation defects (hero/cta/headings/logo silently preferring
//   ONE viewport's whole object instead of combining both — see the
//   in-code comments on each check in visualScoring.ts for the specific bug
//   each test below regresses)
// - partial-viewport-availability honesty (overflow/overlap/readability/
//   images/navigation silently treating "the other viewport is unavailable"
//   as "the other viewport was verified clean")
// - measurable:false ("heuristic suggestion") findings never reducing score
//
// Pure/synthetic — no browser dependency, mirrors visualScoring.test.ts's
// own design goal.
//
// Run with: node --import ./test-support/register-ts-sibling-loader.mjs --test test/visualScoring.viewportAggregation.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVisualReport } from '../src/lib/visualScoring.ts'
import type { RawMeasurements } from '../src/lib/visualAnalysis.ts'

// A fully "clean" set of measurements — every check passes — so each test
// can override just the fields it cares about and know every other check's
// effect on checksCompleted/score is a fixed, known constant.
function base(overrides: Partial<RawMeasurements> = {}): RawMeasurements {
  return {
    viewport: { width: 1440, height: 900 },
    overflow: { scrollWidth: 1440, clientWidth: 1440, overflowPx: 0 },
    clippedOrOverlapping: [],
    nav: { found: true, linkCount: 4, linksOverflowViewport: false, menuButtonFound: true, menuButtonHasAccessibleName: true, stickyHeaderHeight: 64 },
    logo: {
      found: true,
      rendered: { width: 100, height: 40 },
      natural: { width: 200, height: 80 },
      overflowsContainer: false,
      distortedAspectRatio: false,
      likelyBlurry: false,
      headerHeightRatio: 0.1,
    },
    textIssues: [],
    tapTargets: [],
    images: [],
    hero: { headingFound: true, headingTop: 100, headingOutOfViewport: false, ctaFound: true, ctaTop: 200 },
    cta: { hasContactLink: true, hasPrimaryAction: true, ecommerceSignal: false },
    headings: { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 },
    copyrightTexts: [`© ${new Date().getFullYear()} Example`],
    overlays: [],
    incompleteCoverage: { textIssues: false, tapTargets: false, images: false, overlap: false },
    ...overrides,
  }
}

function findingFor(desktop: RawMeasurements | null, mobile: RawMeasurements | null, id: string) {
  const report = buildVisualReport(desktop, mobile)
  const finding = report.findings.find((f) => f.id === id)
  if (!finding) throw new Error(`no ${id} finding in report`)
  return { report, finding }
}

// ─── Hero: was `m || d` — mobile's WHOLE object preferred, hiding a ────────
// desktop-only missing heading whenever mobile succeeded.

test('hero: heading missing on DESKTOP only (mobile fine) is a genuine problem, not hidden by mobile winning the fallback', () => {
  const desktop = base({ hero: { headingFound: false, headingTop: null, headingOutOfViewport: false, ctaFound: true, ctaTop: 200 } })
  const mobile = base({ hero: { headingFound: true, headingTop: 50, headingOutOfViewport: false, ctaFound: true, ctaTop: 100 } })
  const { finding } = findingFor(desktop, mobile, 'hero')
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.viewport, 'desktop')
  assert.match(finding.detail, /desktop/)
  assert.equal(finding.points, Math.round(6 * 0.65)) // single-viewport-missing penalty
})

test('hero: heading missing on MOBILE only (desktop fine) is also a genuine problem — not just the reverse direction', () => {
  const desktop = base({ hero: { headingFound: true, headingTop: 50, headingOutOfViewport: false, ctaFound: true, ctaTop: 100 } })
  const mobile = base({ hero: { headingFound: false, headingTop: null, headingOutOfViewport: false, ctaFound: true, ctaTop: 200 } })
  const { finding } = findingFor(desktop, mobile, 'hero')
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.viewport, 'mobile')
  assert.equal(finding.points, Math.round(6 * 0.65))
})

test('hero: heading missing on BOTH viewports gets the full (not halved) penalty', () => {
  const missing = { headingFound: false, headingTop: null, headingOutOfViewport: false, ctaFound: true, ctaTop: 200 }
  const { finding } = findingFor(base({ hero: missing }), base({ hero: missing }), 'hero')
  assert.equal(finding.viewport, 'both')
  assert.equal(finding.points, Math.round(6 * 0.4))
})

// ─── CTA: was `d || m` — desktop's WHOLE object preferred, so a ───────────
// mobile-exclusive contact link could never rescue the check.

test('cta: a contact link found ONLY on mobile (desktop has none) still counts — a mobile-exclusive "Call Now" button must not be invisible', () => {
  const desktop = base({ cta: { hasContactLink: false, hasPrimaryAction: false, ecommerceSignal: false } })
  const mobile = base({ cta: { hasContactLink: true, hasPrimaryAction: false, ecommerceSignal: false } })
  const { finding } = findingFor(desktop, mobile, 'cta')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.points, 6)
})

test('cta: a primary action found ONLY on desktop (mobile has none) still counts', () => {
  const desktop = base({ cta: { hasContactLink: false, hasPrimaryAction: true, ecommerceSignal: false } })
  const mobile = base({ cta: { hasContactLink: false, hasPrimaryAction: false, ecommerceSignal: false } })
  const { finding } = findingFor(desktop, mobile, 'cta')
  assert.equal(finding.bucket, 'good')
})

test('cta: genuinely absent on both viewports is still correctly flagged', () => {
  const none = { hasContactLink: false, hasPrimaryAction: false, ecommerceSignal: false }
  const { finding } = findingFor(base({ cta: none }), base({ cta: none }), 'cta')
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.points, Math.round(6 * 0.3))
})

// Previously untested fallback path: an ecommerce/marketplace page with no
// contact link or primary action found is deliberately NOT scored as a
// failure (different expectations apply to that kind of site) — it must
// route to 'unverified', not 'improve', and cost no points either way.
test('cta: an ecommerce page with no contact/primary-action found is unverified, not penalized as a failure', () => {
  const none = { hasContactLink: false, hasPrimaryAction: false, ecommerceSignal: true }
  const { finding, report } = findingFor(base({ cta: none }), base({ cta: none }), 'cta')
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
  assert.match(finding.detail, /ecommerce/)
  assert.equal(report.score, 100, 'the ecommerce scope note must not drag the score down at all')
})

// Previously untested: the informational ecommerce-visual "specialist" note
// itself — pushed once, separately from the 12 scored checks, and never
// counted toward score either way regardless of what triggered it.
test('the ecommerce-visual specialist note appears once when ecommerceSignal is true anywhere, and never affects score', () => {
  const desktop = base({ cta: { hasContactLink: true, hasPrimaryAction: true, ecommerceSignal: false } })
  const mobile = base({ cta: { hasContactLink: true, hasPrimaryAction: true, ecommerceSignal: true } })
  const report = buildVisualReport(desktop, mobile)
  const note = report.findings.find((f) => f.id === 'ecommerce-visual')
  if (!note) throw new Error('no ecommerce-visual finding')
  assert.equal(note.bucket, 'specialist')
  assert.equal(note.points, 0)
  assert.equal(report.score, 100)
})

// ─── Headings: was `desktop?.headings || mobile?.headings` — desktop's ────
// WHOLE structure preferred, hiding a mobile-only skipped heading level.
// This is the exact live mechanism behind websitesbyleslie.com showing
// hasSkippedLevel=true on mobile while desktop shows false — previously
// invisible to the score because desktop's (clean) structure always won.

test('headings: a skipped level on MOBILE only (desktop structure is clean) is now a real, reported finding — though as a measurable:false suggestion, it costs no points (see the dedicated measurable:false tests below)', () => {
  const desktop = base({ headings: { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 } })
  const mobile = base({ headings: { h1Count: 1, hasSkippedLevel: true, emptyHeadingCount: 0 } })
  const { finding } = findingFor(desktop, mobile, 'headings')
  assert.equal(finding.bucket, 'improve')
  assert.match(finding.detail, /skip/)
  assert.equal(finding.measurable, false)
  assert.equal(finding.points, 4)
})

test('headings: no H1 on desktop only (mobile has exactly one) is reported, naming the affected viewport', () => {
  const desktop = base({ headings: { h1Count: 0, hasSkippedLevel: false, emptyHeadingCount: 0 } })
  const mobile = base({ headings: { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 } })
  const { finding } = findingFor(desktop, mobile, 'headings')
  assert.equal(finding.bucket, 'improve')
  assert.match(finding.detail, /No main page heading was found on desktop/)
  assert.equal(finding.measurable, true)
})

test('headings: clean on both viewports is still fully credited', () => {
  const clean = { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 }
  const { finding, report } = findingFor(base({ headings: clean }), base({ headings: clean }), 'headings')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.points, 4)
  assert.equal(report.score, 100)
})

// ─── Logo: was `mobile.logo.found ? mobile.logo : desktop.logo` — the ─────
// WHOLE logo object from one viewport preferred, hiding the other
// viewport's independent rendering problems for the same logo.

test('logo: distorted on desktop only (mobile rendering of the same logo is fine) is still flagged', () => {
  const desktop = base({
    logo: { found: true, rendered: { width: 100, height: 40 }, natural: { width: 80, height: 80 }, overflowsContainer: false, distortedAspectRatio: true, likelyBlurry: false, headerHeightRatio: 0.1 },
  })
  const mobile = base({
    logo: { found: true, rendered: { width: 100, height: 40 }, natural: { width: 200, height: 80 }, overflowsContainer: false, distortedAspectRatio: false, likelyBlurry: false, headerHeightRatio: 0.1 },
  })
  const { finding } = findingFor(desktop, mobile, 'logo')
  assert.equal(finding.bucket, 'improve')
  assert.match(finding.detail, /stretched/)
})

// ─── Partial-viewport-availability honesty (overflow/overlap/readability/ ─
// images/navigation): was silently defaulting the unavailable side to an
// empty array/false, reading exactly like "confirmed clean," and always
// labeling the finding 'both' even when only one viewport ever ran.

test('overflow: mobile unavailable, desktop clean — credited, but viewport is honestly "desktop" and the note says mobile could not be measured', () => {
  const { finding, report } = findingFor(base(), null, 'overflow')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.viewport, 'desktop')
  assert.match(finding.detail, /Mobile could not be measured/)
  assert.equal(report.score, 100)
})

test('overlap: desktop unavailable, mobile clean — viewport is "mobile", not "both"', () => {
  const { finding } = findingFor(null, base(), 'overlap')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.viewport, 'mobile')
  assert.match(finding.detail, /Desktop could not be measured/)
})

test('readability: mobile unavailable, desktop clean — viewport is "desktop", not "both"', () => {
  const { finding } = findingFor(base(), null, 'readability')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.viewport, 'desktop')
  assert.match(finding.detail, /Mobile could not be measured/)
})

test('images: desktop unavailable, mobile has none to check — viewport is "mobile"', () => {
  const { finding } = findingFor(null, base(), 'images')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.viewport, 'mobile')
})

test('navigation: mobile unavailable, desktop nav fine — credited, but notes mobile usability was never verified', () => {
  const { finding } = findingFor(base(), null, 'navigation')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.viewport, 'desktop')
  assert.match(finding.detail, /Mobile could not be measured/)
})

test('both viewports available and clean: no partial-coverage note leaks into any of these checks', () => {
  const { finding: overflowF } = findingFor(base(), base(), 'overflow')
  const { finding: navF } = findingFor(base(), base(), 'navigation')
  assert.doesNotMatch(overflowF.detail, /could not be measured/)
  assert.doesNotMatch(navF.detail, /could not be measured/)
  assert.equal(overflowF.viewport, 'both')
  assert.equal(navF.viewport, 'both')
})

// ─── measurable:false ("heuristic suggestion") findings never reduce score ─

test('hero: heading unusually far down the mobile page (a suggestion, measurable:false) costs ZERO points, unlike a genuinely missing heading', () => {
  const desktop = base()
  const mobile = base({ hero: { headingFound: true, headingTop: 5000, headingOutOfViewport: true, ctaFound: true, ctaTop: 5100 } })
  const { finding, report } = findingFor(desktop, mobile, 'hero')
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.measurable, false)
  assert.equal(finding.points, 6, 'a heuristic suggestion must not cost any of the 6 hero points')
  assert.equal(report.score, 100, 'the suggestion alone must not move the overall score at all')
})

test('copyright: no copyright notice found (a suggestion, measurable:false) costs ZERO points', () => {
  const { finding, report } = findingFor(base({ copyrightTexts: [] }), base({ copyrightTexts: [] }), 'copyright')
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.measurable, false)
  assert.equal(finding.points, 3)
  assert.equal(report.score, 100)
})

test('copyright: a placeholder/future/reversed year (all measurable:false suggestions) still costs ZERO points regardless of how many problems stack', () => {
  const currentYear = new Date().getFullYear()
  const { finding } = findingFor(
    base({ copyrightTexts: [`© 20XX-${currentYear + 5} Example`] }),
    base({ copyrightTexts: [`© 20XX-${currentYear + 5} Example`] }),
    'copyright'
  )
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.points, 3, 'stacking multiple suggestion-level problems must still never cost points')
})

test('headings: a skipped level with an otherwise-correct H1 count (measurable:false — no hard count problem) costs ZERO points', () => {
  const skipOnly = { h1Count: 1, hasSkippedLevel: true, emptyHeadingCount: 0 }
  const { finding, report } = findingFor(base({ headings: skipOnly }), base({ headings: skipOnly }), 'headings')
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.measurable, false)
  assert.equal(finding.points, 4)
  assert.equal(report.score, 100)
})

test('headings: a genuinely missing H1 (measurable:true — a hard, deterministic problem) DOES cost points, unlike the skip-level suggestion above', () => {
  const noH1 = { h1Count: 0, hasSkippedLevel: false, emptyHeadingCount: 0 }
  const { finding, report } = findingFor(base({ headings: noH1 }), base({ headings: noH1 }), 'headings')
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.measurable, true)
  assert.equal(finding.points, Math.round(4 * 0.4))
  assert.ok(report.score < 100)
})

// ─── Both viewports null: whole-page early-return path, unaffected by the refactor ─

test('both viewports unavailable: whole-page early return, single unverified "render" finding, zero credited points, no crash', () => {
  const report = buildVisualReport(null, null)
  assert.equal(report.score, 0)
  assert.equal(report.checksCompleted, 0)
  assert.equal(report.findings.length, 1)
  assert.equal(report.findings[0].id, 'render')
  assert.equal(report.findings[0].bucket, 'unverified')
})
