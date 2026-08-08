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

test('a genuine issue alongside an unverifiable one: still scored, but only the genuine issue affects the score', () => {
  const { finding } = readabilityFinding([
    { kind: 'contrast-unverifiable', sample: 'Hero heading', detail: 'text over a background image or gradient' },
    { kind: 'tiny-font', sample: 'Small label', detail: '10px' },
  ])
  assert.equal(finding.bucket, 'improve')
  // ratioLost = genuineIssues.length / 10 = 1/10 -> points = round(12 * 0.9) = 11
  assert.equal(finding.points, 11)
  assert.match(finding.detail, /unusually small mobile text/)
  assert.match(finding.detail, /1 additional piece of text/)
})

test('multiple genuine issues: ratioLost is based on the genuine count only, excluding unverifiable ones', () => {
  const { finding } = readabilityFinding([
    { kind: 'contrast-unverifiable', sample: 'A', detail: '' },
    { kind: 'contrast-unverifiable', sample: 'B', detail: '' },
    { kind: 'contrast-unverifiable', sample: 'C', detail: '' },
    { kind: 'tiny-font', sample: 'D', detail: '10px' },
  ])
  // If the 3 unverifiable issues wrongly counted toward ratioLost, this would
  // be round(12 * (1 - 4/10)) = 7. With only the genuine issue counted, it's
  // round(12 * (1 - 1/10)) = 11.
  assert.equal(finding.points, 11)
})

test('a genuine issue with no unverifiable ones: message has no unverifiable note', () => {
  const { finding } = readabilityFinding([{ kind: 'tiny-font', sample: 'Small label', detail: '10px' }])
  assert.equal(finding.bucket, 'improve')
  assert.doesNotMatch(finding.detail, /background image or gradient/)
})
