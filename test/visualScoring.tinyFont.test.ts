// Dedicated tests for the tiny-font severity/role/grouping/volume/severe-override
// model in src/lib/visualScoring.ts (tinyFontSeverity, computeTinyFontRatioLost,
// and the constants that drive them). Pure/synthetic — no browser dependency.
//
// Run with: node --import ./test-support/register-ts-sibling-loader.mjs --test test/visualScoring.tinyFont.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  tinyFontSeverity,
  computeTinyFontRatioLost,
  TINY_FONT_THRESHOLD_PX,
  TINY_FONT_SEVERITY_FLOOR_PX,
  TINY_FONT_ROLE_WEIGHTS,
  TINY_FONT_VOLUME_CAP,
  TINY_FONT_VOLUME_STEP,
  TINY_FONT_SEVERE_MIN_SEVERITY,
  TINY_FONT_SEVERE_MIN_ROLE_WEIGHT,
  TINY_FONT_SEVERE_MIN_INSTANCES,
} from '../src/lib/visualScoring.ts'
import type { RawTextIssue, TinyFontRole } from '../src/lib/visualAnalysis.ts'

// Builds a batch of tiny-font RawTextIssue fixtures sharing one groupKey (so
// they're scored as a single style group) unless a distinct key is given per
// call — tests that want N *unrelated* styles call this once per instance
// with a unique groupKey instead.
function tinyFontIssues(count: number, fontSizePx: number, role: TinyFontRole, groupKey: string): RawTextIssue[] {
  return Array.from({ length: count }, (_, i) => ({
    kind: 'tiny-font' as const,
    sample: `sample ${i}`,
    detail: `${fontSizePx}px`,
    fontSizePx,
    role,
    groupKey,
  }))
}

// ─── tinyFontSeverity boundaries ───────────────────────────────────────────

test('tinyFontSeverity: at the detection threshold is 0 (not a tiny-font case at all in practice)', () => {
  assert.equal(tinyFontSeverity(TINY_FONT_THRESHOLD_PX), 0)
})

test('tinyFontSeverity: at the severity floor is 1 (maximally severe)', () => {
  assert.equal(tinyFontSeverity(TINY_FONT_SEVERITY_FLOOR_PX), 1)
})

test('tinyFontSeverity: below the severity floor stays clamped at 1, does not exceed it', () => {
  assert.equal(tinyFontSeverity(TINY_FONT_SEVERITY_FLOOR_PX - 1), 1)
  assert.equal(tinyFontSeverity(0), 1)
})

test('tinyFontSeverity: above the threshold stays clamped at 0, does not go negative', () => {
  assert.equal(tinyFontSeverity(TINY_FONT_THRESHOLD_PX + 5), 0)
})

test('tinyFontSeverity: linear midpoint between threshold and floor is 0.5', () => {
  const midpoint = (TINY_FONT_THRESHOLD_PX + TINY_FONT_SEVERITY_FLOOR_PX) / 2 // 9.5px
  assert.equal(tinyFontSeverity(midpoint), 0.5)
})

// ─── Role weighting ─────────────────────────────────────────────────────────
// Same font size (9px, severity 0.6), single instance, one test per role —
// isolates TINY_FONT_ROLE_WEIGHTS as the only variable and proves every role
// is actually wired up (not just body/label, which the combination tests
// in visualScoring.test.ts happen to exercise).

const ROLE_TEST_PX = 9 // severity = (12-9)/5 = 0.6
const roleExpectations: Record<TinyFontRole, number> = {
  body: 0.24,
  nav: 0.216,
  footer: 0.12,
  label: 0.096,
  unknown: 0.168,
}

for (const role of Object.keys(roleExpectations) as TinyFontRole[]) {
  test(`role weighting: single ${role} instance at severity 0.6 contributes ${roleExpectations[role]}`, () => {
    const ratioLost = computeTinyFontRatioLost(tinyFontIssues(1, ROLE_TEST_PX, role, `group-${role}`))
    assert.ok(
      Math.abs(ratioLost - roleExpectations[role]) < 1e-9,
      `expected ~${roleExpectations[role]}, got ${ratioLost}`
    )
  })
}

test('role weighting: body (1.0) costs more than label (0.4) at identical size and instance count', () => {
  const bodyRatio = computeTinyFontRatioLost(tinyFontIssues(1, ROLE_TEST_PX, 'body', 'g-body'))
  const labelRatio = computeTinyFontRatioLost(tinyFontIssues(1, ROLE_TEST_PX, 'label', 'g-label'))
  assert.ok(bodyRatio > labelRatio)
  assert.equal(TINY_FONT_ROLE_WEIGHTS.body, 1.0)
  assert.equal(TINY_FONT_ROLE_WEIGHTS.label, 0.4)
})

// ─── Grouping by unique style ───────────────────────────────────────────────

test('grouping: 5 instances of one style (same groupKey) cost less than 5 unrelated styles of the same severity/role', () => {
  const oneStyleRepeated = computeTinyFontRatioLost(tinyFontIssues(5, 8, 'label', 'span.eyebrow|8'))
  const fiveUnrelatedStyles = computeTinyFontRatioLost([
    ...tinyFontIssues(1, 8, 'label', 'group-a'),
    ...tinyFontIssues(1, 8, 'label', 'group-b'),
    ...tinyFontIssues(1, 8, 'label', 'group-c'),
    ...tinyFontIssues(1, 8, 'label', 'group-d'),
    ...tinyFontIssues(1, 8, 'label', 'group-e'),
  ])
  assert.ok(
    oneStyleRepeated < fiveUnrelatedStyles,
    `repeating one style (${oneStyleRepeated}) should cost less than 5 unrelated styles (${fiveUnrelatedStyles})`
  )
  assert.ok(Math.abs(oneStyleRepeated - 0.1792) < 1e-9)
  assert.ok(Math.abs(fiveUnrelatedStyles - 0.64) < 1e-9)
})

test('grouping: issues without a groupKey fall back to grouping by sample text', () => {
  const issues: RawTextIssue[] = [
    { kind: 'tiny-font', sample: 'Same label', detail: '8px', fontSizePx: 8, role: 'label' },
    { kind: 'tiny-font', sample: 'Same label', detail: '8px', fontSizePx: 8, role: 'label' },
  ]
  const grouped = computeTinyFontRatioLost(issues)
  const single = computeTinyFontRatioLost([issues[0]])
  // Two issues sharing a sample (and no groupKey) should be treated as one
  // group of 2, not two unrelated groups of 1 — i.e. volume-factored, not doubled.
  assert.ok(grouped > single)
  assert.ok(grouped < single * 2)
})

// ─── Volume factor ──────────────────────────────────────────────────────────

const VOLUME_TEST_PX = 10 // severity = (12-10)/5 = 0.4, role 'body' (weight 1.0)

test('volume factor: increases with repeated instances of one style, up to the cap', () => {
  const results = [1, 2, 3, 5].map((n) => computeTinyFontRatioLost(tinyFontIssues(n, VOLUME_TEST_PX, 'body', 'g')))
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i] > results[i - 1], `ratioLost should strictly increase from n=${i} to n=${i + 1}`)
  }
})

test('volume factor: is capped — 10 instances and 20 instances of the same style score identically', () => {
  const at10 = computeTinyFontRatioLost(tinyFontIssues(10, VOLUME_TEST_PX, 'body', 'g'))
  const at20 = computeTinyFontRatioLost(tinyFontIssues(20, VOLUME_TEST_PX, 'body', 'g'))
  assert.equal(at10, at20)
  // Sanity-check the cap constant is actually what bounds it.
  const maxPossibleVolumeFactor = TINY_FONT_VOLUME_CAP
  const expected = Math.min(1, (tinyFontSeverity(VOLUME_TEST_PX) * TINY_FONT_ROLE_WEIGHTS.body * maxPossibleVolumeFactor) / 2.5)
  assert.ok(Math.abs(at10 - expected) < 1e-9)
})

test('volume factor: step size matches TINY_FONT_VOLUME_STEP for a single additional instance', () => {
  const n1 = computeTinyFontRatioLost(tinyFontIssues(1, VOLUME_TEST_PX, 'body', 'g'))
  const n2 = computeTinyFontRatioLost(tinyFontIssues(2, VOLUME_TEST_PX, 'body', 'g'))
  const severity = tinyFontSeverity(VOLUME_TEST_PX)
  const expectedDelta = (severity * TINY_FONT_ROLE_WEIGHTS.body * TINY_FONT_VOLUME_STEP) / 2.5
  assert.ok(Math.abs(n2 - n1 - expectedDelta) < 1e-9)
})

// ─── Severe override ─────────────────────────────────────────────────────────
// All three conditions (severity, role weight, instance count) must hold at
// once — each test flips exactly one condition below its threshold to prove
// the override doesn't fire on a partial match.

test('severe override: fires and forces ratioLost to 1 when all three conditions hold (body, severity 0.6, 5 instances)', () => {
  assert.equal(TINY_FONT_SEVERE_MIN_SEVERITY, 0.6)
  assert.equal(TINY_FONT_SEVERE_MIN_INSTANCES, 5)
  const ratioLost = computeTinyFontRatioLost(tinyFontIssues(5, 9, 'body', 'g-severe-body'))
  assert.equal(ratioLost, 1)
})

test('severe override: fires for nav text too (role weight 0.9 clears the 0.8 minimum)', () => {
  assert.ok(TINY_FONT_ROLE_WEIGHTS.nav >= TINY_FONT_SEVERE_MIN_ROLE_WEIGHT)
  const ratioLost = computeTinyFontRatioLost(tinyFontIssues(5, 9, 'nav', 'g-severe-nav'))
  assert.equal(ratioLost, 1)
})

test('severe override: does NOT fire with only 4 instances (below the instance minimum)', () => {
  const ratioLost = computeTinyFontRatioLost(tinyFontIssues(4, 9, 'body', 'g-under-instances'))
  assert.ok(ratioLost < 1)
  assert.ok(Math.abs(ratioLost - 0.312) < 1e-9)
})

test('severe override: does NOT fire when severity is just under the minimum (9.5px, severity 0.5)', () => {
  assert.ok(tinyFontSeverity(9.5) < TINY_FONT_SEVERE_MIN_SEVERITY)
  const ratioLost = computeTinyFontRatioLost(tinyFontIssues(5, 9.5, 'body', 'g-under-severity'))
  assert.ok(ratioLost < 1)
  assert.ok(Math.abs(ratioLost - 0.28) < 1e-9)
})

test('severe override: does NOT fire for label-role text no matter how repeated or small — role weight (0.4) never clears the 0.8 minimum', () => {
  assert.ok(TINY_FONT_ROLE_WEIGHTS.label < TINY_FONT_SEVERE_MIN_ROLE_WEIGHT)
  const ratioLost = computeTinyFontRatioLost(tinyFontIssues(10, 6, 'label', 'g-label-never-severe'))
  assert.ok(ratioLost < 1, 'label-role text should never hit the severe override, only the weighted formula (capped at 1 via K, not via the override)')
})

test('severe override: multiple groups — one non-severe group does not get masked by an unrelated severe group, and vice versa the severe group still forces the total to 1', () => {
  const ratioLost = computeTinyFontRatioLost([
    ...tinyFontIssues(1, 11, 'label', 'g-mild'), // tiny, isolated, harmless
    ...tinyFontIssues(6, 8, 'body', 'g-severe'), // severity 0.8, body, 6 instances -> severe
  ])
  assert.equal(ratioLost, 1)
})

// ─── Empty / degenerate input ────────────────────────────────────────────────

test('computeTinyFontRatioLost: empty issue list costs nothing', () => {
  assert.equal(computeTinyFontRatioLost([]), 0)
})

test('computeTinyFontRatioLost: issues missing fontSizePx or role are skipped, not treated as zero-severity contributions', () => {
  const malformed: RawTextIssue[] = [{ kind: 'tiny-font', sample: 'no data', detail: '?px' }]
  assert.equal(computeTinyFontRatioLost(malformed), 0)
})
