// Tests for summarizeVisualReport: a perfect numeric score must never read as
// "nothing left to look at" when a manual-review suggestion (measurable:false,
// never scored) or an unverified check (not assessable, excluded from scoring)
// is still present. The numeric score itself is untouched by any of this —
// only the status text changes.
//
// Pure/synthetic — no browser dependency.
//
// Run with: node --import ./test-support/register-ts-sibling-loader.mjs --test test/visualScoring.presentation.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVisualReport, summarizeVisualReport } from '../src/lib/visualScoring.ts'
import type { RawMeasurements, RawTextIssue } from '../src/lib/visualAnalysis.ts'

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

test('score 100 with a manual-review suggestion present (measurable:false "improve" finding): status says to review the items below, not that everything is clean', () => {
  const mobile = base({ hero: { headingFound: true, headingTop: 5000, headingOutOfViewport: true, ctaFound: true, ctaTop: 5100 } })
  const report = buildVisualReport(base(), mobile, base())
  const heroFinding = report.findings.find((f) => f.id === 'hero')
  if (!heroFinding) throw new Error('no hero finding')
  // Sanity check on the premise: score is genuinely 100, and the suggestion
  // is genuinely present and non-scoring — this test only means something if
  // both of those are true.
  assert.equal(report.score, 100)
  assert.equal(heroFinding.bucket, 'improve')
  assert.equal(heroFinding.measurable, false)

  assert.equal(summarizeVisualReport(report), 'Measured checks look strong; review the items below.')
})

test('score 100 with an unverified check present (contrast couldn\'t be measured): status says to review the items below, not that everything is clean', () => {
  const unverifiableOnly: RawTextIssue[] = [{ kind: 'contrast-unverifiable', sample: 'Hero heading', detail: 'text over a background image or gradient' }]
  const desktop = base({ textIssues: unverifiableOnly })
  const mobile = base({ textIssues: unverifiableOnly })
  const report = buildVisualReport(desktop, mobile, base())
  const readabilityFinding = report.findings.find((f) => f.id === 'readability')
  if (!readabilityFinding) throw new Error('no readability finding')
  assert.equal(report.score, 100)
  assert.equal(readabilityFinding.bucket, 'unverified')
  assert.ok(report.checksCompleted < report.checksTotal, 'the unverified check must not count toward checksCompleted')

  assert.equal(summarizeVisualReport(report), 'Measured checks look strong; review the items below.')
})

test('score 100 with nothing left to review at all: the ordinary "looks solid" framing still applies — the new status is not shown for a genuinely clean result', () => {
  const report = buildVisualReport(base(), base(), base())
  assert.equal(report.score, 100)
  assert.ok(report.findings.every((f) => f.bucket === 'good'))
  assert.equal(summarizeVisualReport(report), 'The rendered page looks solid overall, with just a few small things worth a look.')
})

test('a manual-review suggestion below score 100 does not trigger the "measured checks" framing — only a perfect 100 does', () => {
  const desktop = base({ overflow: { scrollWidth: 950, clientWidth: 770, overflowPx: 180 } }) // genuine, measurable overflow -> score < 100
  const mobile = base({ hero: { headingFound: true, headingTop: 5000, headingOutOfViewport: true, ctaFound: true, ctaTop: 5100 } })
  const report = buildVisualReport(desktop, mobile, base())
  assert.ok(report.score < 100)
  assert.notEqual(summarizeVisualReport(report), 'Measured checks look strong; review the items below.')
})

test('whole-page render failure: "could not be rendered" regardless of any of the above', () => {
  const report = buildVisualReport(null, null)
  assert.equal(summarizeVisualReport(report), 'This website could not be rendered for a visual review.')
})
