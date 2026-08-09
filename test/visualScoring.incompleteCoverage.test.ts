// Tests for the incomplete-coverage scoring rule: when a page has more real
// candidates in a category than the bounded measurement scan examined
// (RawMeasurements.incompleteCoverage), that category must be routed to
// "unable to verify automatically" — never scored off a partial sample,
// whether that partial sample happened to look clean or already had
// problems. A genuine issue sitting just past the cap must never be
// invisible (falsely "good"), and a clean-looking partial sample must never
// falsely earn full credit the rest of the page may not deserve either.
//
// Pure/synthetic — no browser dependency.
//
// Run with: node --import ./test-support/register-ts-sibling-loader.mjs --test test/visualScoring.incompleteCoverage.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVisualReport } from '../src/lib/visualScoring.ts'
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

function findingFor(desktop: RawMeasurements | null, mobile: RawMeasurements | null, id: string) {
  const report = buildVisualReport(desktop, mobile)
  const finding = report.findings.find((f) => f.id === id)
  if (!finding) throw new Error(`no ${id} finding in report`)
  return { report, finding }
}

// ─── Overlap ────────────────────────────────────────────────────────────────

test('overlap: incomplete coverage WITH a genuine issue present is unverified, not a scored "improve" — a real issue beyond the cap must not corrupt scoring either way', () => {
  const desktop = base({
    clippedOrOverlapping: [{ kind: 'overlap', sample: 'A / B' }],
    incompleteCoverage: { textIssues: false, tapTargets: false, images: false, overlap: true },
  })
  const { finding, report } = findingFor(desktop, base(), 'overlap')
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
  assert.match(finding.detail, /couldn.t be automatically verified/)
  assert.match(finding.detail, /1 instance/, 'the measured example must still be preserved as context')
  assert.equal(report.checksCompleted, 11, "overlap's weight must be excluded from checksCompleted (and so from both earned and possible), not just earned")
})

test('overlap: incomplete coverage with a CLEAN partial sample is also unverified, not falsely "good"', () => {
  const desktop = base({ incompleteCoverage: { textIssues: false, tapTargets: false, images: false, overlap: true } })
  const { finding } = findingFor(desktop, base(), 'overlap')
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
  assert.match(finding.detail, /No clipped or overlapping content was found within the portion examined/)
})

test('overlap: complete scan still scores normally (clean → good, full credit)', () => {
  const { finding, report } = findingFor(base(), base(), 'overlap')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.points, 12)
  assert.equal(report.score, 100)
})

test('overlap: complete scan with a genuine issue still scores normally (improve, reduced credit)', () => {
  const desktop = base({ clippedOrOverlapping: [{ kind: 'overlap', sample: 'A / B' }] })
  const { finding } = findingFor(desktop, base(), 'overlap')
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.points, Math.round(12 * (1 - 0.25)))
})

// ─── Readability ────────────────────────────────────────────────────────────

const oneTinyFontIssue: RawTextIssue = { kind: 'tiny-font', sample: 'Small', detail: '8px', fontSizePx: 8, role: 'body', groupKey: 'p||8' }

test('readability: incomplete coverage WITH a genuine issue present is unverified, not a scored "improve"', () => {
  const mobile = base({
    textIssues: [oneTinyFontIssue],
    incompleteCoverage: { textIssues: true, tapTargets: false, images: false, overlap: false },
  })
  const { finding, report } = findingFor(base(), mobile, 'readability')
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
  assert.match(finding.detail, /couldn.t be automatically verified/)
  assert.match(finding.detail, /1 potential issue/)
  assert.equal(report.checksCompleted, 11)
})

test('readability: incomplete coverage with a CLEAN partial sample is also unverified, not falsely "good"', () => {
  const mobile = base({ incompleteCoverage: { textIssues: true, tapTargets: false, images: false, overlap: false } })
  const { finding } = findingFor(base(), mobile, 'readability')
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
  assert.match(finding.detail, /No issues were found within the portion examined/)
})

test('readability: complete scan still scores normally', () => {
  const { finding, report } = findingFor(base(), base(), 'readability')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.points, 12)
  assert.equal(report.score, 100)
})

test('readability: incompleteCoverage on DESKTOP alone (mobile complete) still routes the whole check to unverified', () => {
  const desktop = base({ incompleteCoverage: { textIssues: true, tapTargets: false, images: false, overlap: false } })
  const { finding } = findingFor(desktop, base(), 'readability')
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
})

// ─── Tap targets (mobile only) ──────────────────────────────────────────────

test('tapTargets: incomplete coverage WITH a genuine issue present is unverified, not a scored "improve"', () => {
  const mobile = base({
    tapTargets: [{ tag: 'a', label: 'Tiny link', width: 20, height: 20, minGapToNeighbor: 2 }],
    incompleteCoverage: { textIssues: false, tapTargets: true, images: false, overlap: false },
  })
  const { finding, report } = findingFor(base(), mobile, 'tapTargets')
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
  assert.match(finding.detail, /couldn.t be automatically verified/)
  assert.match(finding.detail, /1 interactive element/)
  assert.equal(report.checksCompleted, 11)
})

test('tapTargets: incomplete coverage with a CLEAN partial sample is also unverified, not falsely "good"', () => {
  const mobile = base({ incompleteCoverage: { textIssues: false, tapTargets: true, images: false, overlap: false } })
  const { finding } = findingFor(base(), mobile, 'tapTargets')
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
})

test('tapTargets: complete scan still scores normally', () => {
  const { finding, report } = findingFor(base(), base(), 'tapTargets')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.points, 10)
  assert.equal(report.score, 100)
})

// ─── Images ─────────────────────────────────────────────────────────────────

test('images: incomplete coverage WITH a genuine broken image present is unverified, not a scored "improve"', () => {
  const desktop = base({
    images: [{ src: 'a.jpg', alt: 'a', loaded: false, naturalWidth: 0, naturalHeight: 0, renderedWidth: 100, renderedHeight: 100, visibleIntentionally: true, objectFit: 'fill' }],
    incompleteCoverage: { textIssues: false, tapTargets: false, images: true, overlap: false },
  })
  const { finding, report } = findingFor(desktop, base(), 'images')
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
  assert.match(finding.detail, /couldn.t be automatically verified/)
  assert.match(finding.detail, /1 image/)
  assert.equal(report.checksCompleted, 11)
})

test('images: incomplete coverage with a CLEAN partial sample is also unverified, not falsely "good"', () => {
  const desktop = base({ incompleteCoverage: { textIssues: false, tapTargets: false, images: true, overlap: false } })
  const { finding } = findingFor(desktop, base(), 'images')
  assert.equal(finding.bucket, 'unverified')
  assert.equal(finding.points, 0)
  assert.match(finding.detail, /No images were found within the portion examined/)
})

test('images: complete scan still scores normally', () => {
  const { finding, report } = findingFor(base(), base(), 'images')
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.points, 8)
  assert.equal(report.score, 100)
})

// ─── earned/possible/checksCompleted/displayed-status agreement ────────────

test('an incomplete category is excluded from earned AND possible identically — not just skipped in the numerator', () => {
  // Give navigation a genuine, partial problem (ratioLost 0.3, so it's
  // neither 0 nor full weight) so the score isn't trivially 100 or 0
  // regardless of how overlap's weight is handled — this makes "excluded
  // from both earned and possible" and "silently scored as if good" and
  // "silently scored as if bad" three arithmetically DIFFERENT scores, so
  // the test can distinguish which one actually happened.
  const desktop = base({
    nav: { found: true, linkCount: 4, linksOverflowViewport: true, menuButtonFound: true, menuButtonHasAccessibleName: true, stickyHeaderHeight: 64 },
    incompleteCoverage: { textIssues: false, tapTargets: false, images: false, overlap: true },
  })
  const report = buildVisualReport(desktop, base())
  const overlap = report.findings.find((f) => f.id === 'overlap')
  const nav = report.findings.find((f) => f.id === 'navigation')
  if (!overlap || !nav) throw new Error('missing finding')
  assert.equal(overlap.bucket, 'unverified')
  assert.equal(nav.points, Math.round(14 * 0.7))
  // With overlap's 12pts excluded from BOTH earned and possible: possible=88,
  // earned = 14+9.8(nav)+12+10+6+8+6+6+4+5+3 = 83.8 -> score = round(83.8/88*100) = 95.
  // If overlap had instead been silently scored "good" (full credit, old bug):
  // possible=100, earned=95.8 -> score=96. If scored as a genuine failure instead,
  // the score would be lower still. 95 is only reachable by true exclusion.
  assert.equal(report.score, 95)
})

test('score arithmetic is self-consistent when a category is routed to unverified: score reflects only the remaining scored checks', () => {
  const desktop = base({ incompleteCoverage: { textIssues: false, tapTargets: false, images: false, overlap: true } })
  const report = buildVisualReport(desktop, base())
  // All 11 other checks are clean/good in this fixture -> full credit on everything scored.
  assert.equal(report.checksCompleted, 11)
  assert.equal(report.score, 100, 'excluding overlap from both earned and possible leaves the other 11 checks at 100% of what remains')
})

test('multiple categories incomplete at once are each independently routed to unverified, and the rest of the report is unaffected', () => {
  const desktop = base({
    incompleteCoverage: { textIssues: true, tapTargets: false, images: true, overlap: false },
  })
  const mobile = base({
    incompleteCoverage: { textIssues: true, tapTargets: true, images: true, overlap: false },
  })
  const report = buildVisualReport(desktop, mobile)
  for (const id of ['readability', 'images', 'tapTargets']) {
    const f = report.findings.find((finding) => finding.id === id)
    if (!f) throw new Error(`no ${id} finding`)
    assert.equal(f.bucket, 'unverified', `${id} should be unverified`)
    assert.equal(f.points, 0)
  }
  // 12 checks total - 3 unverified (readability, images, tapTargets) = 9 completed.
  assert.equal(report.checksCompleted, 9)
  assert.equal(report.score, 100)
})
