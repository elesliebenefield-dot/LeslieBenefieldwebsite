// Tests for the intermediate/tablet-width overflow fix: the overflow check
// now also reads a third (tablet) measurement so a page that only overflows
// at intermediate widths — desktop and mobile both clean — can never receive
// a falsely "good" overflow result. Discovered via a real bug: /check's nav
// only collapsed to a hamburger menu below its own CSS breakpoint, so the
// full desktop nav row tried to render (and overflowed) at intermediate
// widths above that breakpoint but below where it actually fits.
//
// Pure/synthetic — no browser dependency.
//
// Run with: node --import ./test-support/register-ts-sibling-loader.mjs --test test/visualScoring.tabletOverflow.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVisualReport } from '../src/lib/visualScoring.ts'
import type { RawMeasurements } from '../src/lib/visualAnalysis.ts'

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

function overflowing(overflowPx = 180): RawMeasurements {
  return base({ overflow: { scrollWidth: 950, clientWidth: 770, overflowPx } })
}

function overflowFinding(desktop: RawMeasurements | null, mobile: RawMeasurements | null, tablet: RawMeasurements | null) {
  const report = buildVisualReport(desktop, mobile, tablet)
  const finding = report.findings.find((f) => f.id === 'overflow')
  if (!finding) throw new Error('no overflow finding')
  return { report, finding }
}

test('clean at all three viewports: fully credited, viewport labeled "both"', () => {
  const { finding, report } = overflowFinding(base(), base(), base())
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.points, 14)
  assert.equal(finding.viewport, 'both')
  assert.match(finding.detail, /desktop, tablet, and mobile/)
  assert.equal(report.score, 100)
})

test('tablet-only overflow (desktop and mobile both clean) is detected — a clean overflow result must be impossible here', () => {
  const { finding } = overflowFinding(base(), base(), overflowing())
  assert.equal(finding.bucket, 'improve', 'must not be reported as good just because desktop and mobile are clean')
  assert.equal(finding.viewport, 'tablet')
  assert.match(finding.detail, /tablet/)
  assert.ok(finding.points < 14, 'a genuine tablet-only overflow must cost points')
  assert.equal(finding.points, Math.round(14 * (1 - 1 / 3)))
})

test('desktop-only overflow (tablet and mobile clean) is still detected', () => {
  const { finding } = overflowFinding(overflowing(), base(), base())
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.viewport, 'desktop')
  assert.match(finding.detail, /desktop/)
  assert.ok(finding.points < 14)
})

test('mobile-only overflow (desktop and tablet clean) is still detected', () => {
  const { finding } = overflowFinding(base(), overflowing(), base())
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.viewport, 'mobile')
  assert.match(finding.detail, /mobile/)
  assert.ok(finding.points < 14)
})

test('overflow at all three viewports costs the full 14 points, more than a single-viewport overflow', () => {
  const singleViewport = overflowFinding(overflowing(), base(), base()).finding.points
  const allThree = overflowFinding(overflowing(), overflowing(), overflowing()).finding.points
  assert.equal(allThree, 0)
  assert.ok(allThree < singleViewport)
})

test('overflow on exactly two of three viewports costs more than one, less than three', () => {
  const one = overflowFinding(overflowing(), base(), base()).finding.points
  const two = overflowFinding(overflowing(), base(), overflowing()).finding.points
  const three = overflowFinding(overflowing(), overflowing(), overflowing()).finding.points
  assert.ok(two < one)
  assert.ok(two > three)
  assert.equal(two, Math.round(14 * (1 - 2 / 3)))
})

test('tablet measurement unavailable (e.g. that viewport failed to load): overflow is still scored from desktop + mobile, honestly noting tablet was not measured', () => {
  const { finding } = overflowFinding(base(), base(), null)
  assert.equal(finding.bucket, 'good')
  assert.match(finding.detail, /Tablet could not be measured/)
})

test('desktop and mobile both unavailable (tablet alone can\'t rescue the whole-page render check): the whole-page "could not be rendered" path still applies, not a silent overflow "good"', () => {
  // buildVisualReport's own top-level guard treats "no desktop and no
  // mobile" as a total render failure regardless of tablet, producing a
  // single unverified 'render' finding — there is no per-check 'overflow'
  // finding to silently mark "good" in this case.
  const report = buildVisualReport(null, null, overflowing())
  assert.equal(report.findings.length, 1)
  assert.equal(report.findings[0].id, 'render')
  assert.equal(report.findings[0].bucket, 'unverified')
  assert.equal(report.score, 0)
})
