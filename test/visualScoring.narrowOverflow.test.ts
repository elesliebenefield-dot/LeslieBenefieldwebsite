// Tests for the 320px narrow-mobile overflow fix: the overflow check now
// also reads a fourth (320px "narrow") measurement, folded into the
// existing "mobile" flag (mobile is the OR of 390px and 320px), so a page
// that only overflows at 320px — 390px, tablet, and desktop all clean —
// can never receive a falsely "good" overflow result. Discovered via a
// real bug: the collapsed nav row's fixed-size logo + hamburger button,
// plus standard padding/gap, needed 337px minimum, a few pixels more than
// 320px provides (see src/index.css and api/check-visual.ts).
//
// Pure/synthetic — no browser dependency.
//
// Run with: node --import ./test-support/register-ts-sibling-loader.mjs --test test/visualScoring.narrowOverflow.test.ts

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

// The overflow check itself ignores anything <=20px as noise (see
// visualScoring.ts) — the real bug's actual overflow at 320px measured
// smaller than that (17px), so this uses a value safely above the
// check's own threshold to exercise the "detected" branch, same as
// visualScoring.tabletOverflow.test.ts's overflowing() helper does.
function overflowing(overflowPx = 30): RawMeasurements {
  return base({ overflow: { scrollWidth: 350, clientWidth: 320, overflowPx } })
}

function overflowFinding(desktop: RawMeasurements | null, mobile: RawMeasurements | null, tablet: RawMeasurements | null, narrow: RawMeasurements | null) {
  const report = buildVisualReport(desktop, mobile, tablet, narrow)
  const finding = report.findings.find((f) => f.id === 'overflow')
  if (!finding) throw new Error('no overflow finding')
  return { report, finding }
}

test('320px-only overflow (390px mobile, tablet, and desktop all clean) is detected — a clean overflow result must be impossible here', () => {
  const { finding } = overflowFinding(base(), base(), base(), overflowing())
  assert.equal(finding.bucket, 'improve', 'must not be reported as good just because 390px, tablet, and desktop are clean')
  assert.equal(finding.viewport, 'mobile', '320px is folded into the mobile category, not a separate label')
  assert.match(finding.detail, /mobile/)
  assert.ok(finding.points < 14, 'a genuine 320px-only overflow must cost points')
  assert.equal(finding.points, Math.round(14 * (1 - 1 / 3)))
})

test('all four measurements clean (desktop, tablet, 390px mobile, 320px narrow): fully credited, viewport labeled "both"', () => {
  const { finding, report } = overflowFinding(base(), base(), base(), base())
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.points, 14)
  assert.equal(finding.viewport, 'both')
  assert.equal(report.score, 100)
})

test('390px overflowing while 320px is clean is still detected (narrow does not mask an existing 390px problem)', () => {
  const { finding } = overflowFinding(base(), overflowing(), base(), base())
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.viewport, 'mobile')
})

test('320px measurement unavailable (e.g. that viewport failed to load): overflow is still scored from 390px alone, exactly as before narrow existed — 390px coverage is never weakened', () => {
  const { finding } = overflowFinding(base(), base(), base(), null)
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.viewport, 'both')
  assert.doesNotMatch(finding.detail, /could not be measured/i)
})

test('both 390px and 320px unavailable, desktop and tablet clean: honestly notes mobile could not be measured', () => {
  const { finding } = overflowFinding(base(), null, base(), null)
  assert.equal(finding.bucket, 'good')
  assert.match(finding.detail, /Mobile could not be measured/)
})

test('desktop-only and tablet-only overflow detection are unaffected by the new narrow parameter (narrow=null, matching every pre-existing 3-argument call site)', () => {
  const desktopOnly = overflowFinding(overflowing(950), base(), base(), null).finding
  assert.equal(desktopOnly.bucket, 'improve')
  assert.equal(desktopOnly.viewport, 'desktop')

  const tabletOnly = overflowFinding(base(), base(), overflowing(950), null).finding
  assert.equal(tabletOnly.bucket, 'improve')
  assert.equal(tabletOnly.viewport, 'tablet')
})
