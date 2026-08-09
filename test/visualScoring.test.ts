// Tests for the Visual & Usability scoring logic (src/lib/visualScoring.ts).
// Pure/synthetic — no browser dependency, per that module's own design goal.
//
// Run with: node --import ./test-support/register-ts-sibling-loader.mjs --test test/visualScoring.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVisualReport } from '../src/lib/visualScoring.ts'
import type { RawMeasurements, RawTextIssue } from '../src/lib/visualAnalysis.ts'

// A fully "clean" set of measurements — every other check passes — so each
// test can vary only textIssues and know any readability-finding effects are
// isolated from the other 11 checks.
function cleanMeasurements(textIssues: RawTextIssue[] = []): RawMeasurements {
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
    textIssues,
    tapTargets: [],
    images: [],
    hero: { headingFound: true, headingTop: 100, headingOutOfViewport: false, ctaFound: true, ctaTop: 200 },
    cta: { hasContactLink: true, hasPrimaryAction: true, ecommerceSignal: false },
    headings: { h1Count: 1, hasSkippedLevel: false, emptyHeadingCount: 0 },
    copyrightTexts: [`© ${new Date().getFullYear()} Example`],
    overlays: [],
    incompleteCoverage: { textIssues: false, tapTargets: false, images: false, overlap: false },
  }
}

function readabilityFinding(desktopIssues: RawTextIssue[], mobileIssues: RawTextIssue[] = []) {
  const report = buildVisualReport(cleanMeasurements(desktopIssues), cleanMeasurements(mobileIssues))
  const finding = report.findings.find((f) => f.id === 'readability')
  if (!finding) throw new Error('no readability finding in report')
  return { report, finding }
}

test('no issues at all: readability is "good" and fully credited', () => {
  const { report, finding } = readabilityFinding([])
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.points, 12)
  assert.equal(report.checksCompleted, 12)
})

test('only contrast-unverifiable issues: readability is "unverified", not "good" and not scored', () => {
  const { report, finding } = readabilityFinding([
    { kind: 'contrast-unverifiable', sample: 'Hero heading', detail: 'text over a background image or gradient' },
  ])
  assert.equal(finding.bucket, 'unverified')
  assert.match(finding.detail, /couldn.t be reliably measured/)
  // credit() was not called for readability, so it doesn't count toward
  // checksCompleted — the other 11 clean checks still do.
  assert.equal(report.checksCompleted, 11)
})

// A single, well-formed tiny-font issue (label role, 8px, its own style group)
// used across several tests below. Its expected contribution is computed once
// here and re-derived in detail by the dedicated computeTinyFontRatioLost
// tests in visualScoring.tinyFont.test.ts — this file only needs the final
// points value to prove the *combination* logic (unverifiable exclusion,
// message wording), not the tiny-font model's internals.
const oneLabelTinyFontIssue: RawTextIssue = {
  kind: 'tiny-font',
  sample: 'Small label',
  detail: '8px',
  fontSizePx: 8,
  role: 'label',
  groupKey: 'span|label|8',
}
// severity=(12-8)/5=0.8, roleWeight=0.4, volumeFactor=1 (single instance)
// -> weightedSum=0.32 -> ratioLost=0.32/2.5=0.128 -> points=round(12*0.872)=10
const EXPECTED_POINTS_FOR_ONE_LABEL_ISSUE = 10

test('a genuine issue alongside an unverifiable one: still scored, but only the genuine issue affects the score', () => {
  const { finding } = readabilityFinding([
    { kind: 'contrast-unverifiable', sample: 'Hero heading', detail: 'text over a background image or gradient' },
    oneLabelTinyFontIssue,
  ])
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.points, EXPECTED_POINTS_FOR_ONE_LABEL_ISSUE)
  assert.match(finding.detail, /unusually small mobile text/)
  assert.match(finding.detail, /1 additional piece of text/)
})

test('multiple genuine issues: ratioLost is based on the genuine count only, excluding unverifiable ones', () => {
  const { finding } = readabilityFinding([
    { kind: 'contrast-unverifiable', sample: 'A', detail: '' },
    { kind: 'contrast-unverifiable', sample: 'B', detail: '' },
    { kind: 'contrast-unverifiable', sample: 'C', detail: '' },
    oneLabelTinyFontIssue,
  ])
  // Points should be identical to the single-genuine-issue test above,
  // regardless of how many unverifiable items also accompany it.
  assert.equal(finding.points, EXPECTED_POINTS_FOR_ONE_LABEL_ISSUE)
})

test('a genuine issue with no unverifiable ones: message has no unverifiable note', () => {
  const { finding } = readabilityFinding([oneLabelTinyFontIssue])
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.points, EXPECTED_POINTS_FOR_ONE_LABEL_ISSUE)
  assert.doesNotMatch(finding.detail, /background image or gradient/)
})

// ─── Good / bad / intermediate tiny-font fixtures ──────────────────────────
// End-to-end (through buildVisualReport, not just computeTinyFontRatioLost
// directly) demonstrations of the three scenarios the grouped model was
// designed around. Per-group arithmetic for each is hand-derived and cross-
// checked against the dedicated computeTinyFontRatioLost tests in
// visualScoring.tinyFont.test.ts.

function tinyFontFixture(count: number, fontSizePx: number, role: RawTextIssue['role'], groupKey: string): RawTextIssue[] {
  return Array.from({ length: count }, (_, i) => ({
    kind: 'tiny-font' as const,
    sample: `sample ${i}`,
    detail: `${fontSizePx}px`,
    fontSizePx,
    role,
    groupKey,
  }))
}

test('good fixture: a page with no tiny-font issues is fully credited', () => {
  const { finding, report } = readabilityFinding([])
  assert.equal(finding.bucket, 'good')
  assert.equal(finding.points, 12)
  assert.equal(report.score, 100)
})

test('bad fixture: 20 repeated 8px BODY paragraphs (one style) trip the severe override to a full deduction', () => {
  const { finding } = readabilityFinding(tinyFontFixture(20, 8, 'body', 'p|copy|8'))
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.points, 0, 'severe override forces ratioLost to 1 regardless of how the weighted formula alone would score it')
  assert.match(finding.detail, /unusually small mobile text/)
})

test('bad fixture: 6 repeated 8px NAV links (one style) also trip the severe override — severe isn\'t body-only', () => {
  const { finding } = readabilityFinding(tinyFontFixture(6, 8, 'nav', 'a|navlink|8'))
  assert.equal(finding.points, 0)
})

test('intermediate fixture: 10 repeated borderline (11px) LABEL spans sharing one style get a proportionate deduction, not a full one', () => {
  const { finding } = readabilityFinding(tinyFontFixture(10, 11, 'label', 'span.eyebrow|11'))
  assert.equal(finding.bucket, 'improve')
  assert.equal(finding.points, 11, 'severity 0.2 x role weight 0.4 x capped volume factor 1.5 stays well under the severe thresholds')
  assert.notEqual(finding.points, 0, 'must not be scored as if it were a severe, unrelated-defect case')
})

test('intermediate fixture: the same 10 borderline labels scored as 10 unrelated one-off styles cost strictly more than as one grouped style', () => {
  const groupedIssues = tinyFontFixture(10, 11, 'label', 'span.eyebrow|11')
  const ungroupedIssues = Array.from({ length: 10 }, (_, i) => tinyFontFixture(1, 11, 'label', `span.unrelated-${i}|11`)).flat()
  const grouped = readabilityFinding(groupedIssues).finding
  const ungrouped = readabilityFinding(ungroupedIssues).finding
  assert.equal(grouped.points, 11)
  assert.equal(ungrouped.points, 8)
  assert.ok(grouped.points > ungrouped.points, 'repetition of one real style must be cheaper than the same count of unrelated styles')
})
