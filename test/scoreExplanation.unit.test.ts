// Score-explanation release: pure-function coverage for the shared
// scoring source of truth (CHECK_WEIGHTS/SCORE_BANDS/scoreBandFor) the
// "How this score is calculated" disclosure (CheckPage.tsx) and
// api/check-website.ts's buildReport both read from — no browser
// required for this part.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHECK_WEIGHTS, CHECK_ORDER, SCORE_BANDS, scoreBandFor, summaryFor } from '../src/lib/websiteCheck.ts'

test('CHECK_WEIGHTS sums to exactly 100 across the 7 counted checks — the normalization denominator when everything is verified', () => {
  const total = Object.values(CHECK_WEIGHTS).reduce((a, b) => a + b, 0)
  assert.equal(total, 100)
  assert.equal(Object.keys(CHECK_WEIGHTS).length, 7)
})

test('CHECK_ORDER contains exactly the same 7 check ids as CHECK_WEIGHTS, once each', () => {
  assert.deepEqual([...CHECK_ORDER].sort(), Object.keys(CHECK_WEIGHTS).sort())
})

test('SCORE_BANDS is ordered highest-threshold-first and covers 0-100 with no gaps', () => {
  for (let i = 1; i < SCORE_BANDS.length; i++) {
    assert.ok(SCORE_BANDS[i - 1].minScore > SCORE_BANDS[i].minScore, 'bands must be strictly descending')
  }
  assert.equal(SCORE_BANDS[SCORE_BANDS.length - 1].minScore, 0, 'the lowest band must start at 0 so every score 0-100 matches some band')
})

// ─── Score-band boundary values ──────────────────────────────────────

test('score-band boundaries: 85 and 84 land in different bands', () => {
  assert.equal(scoreBandFor(85).label, 'Looking strong')
  assert.equal(scoreBandFor(84).label, 'Solid, with room to improve')
})

test('score-band boundaries: 65 and 64 land in different bands', () => {
  assert.equal(scoreBandFor(65).label, 'Solid, with room to improve')
  assert.equal(scoreBandFor(64).label, 'A few things to address')
})

test('score-band boundaries: 40 and 39 land in different bands', () => {
  assert.equal(scoreBandFor(40).label, 'A few things to address')
  assert.equal(scoreBandFor(39).label, 'Needs attention')
})

test('score-band boundaries: 100 and 0 both resolve to a real band', () => {
  assert.equal(scoreBandFor(100).label, 'Looking strong')
  assert.equal(scoreBandFor(0).label, 'Needs attention')
})

test('summaryFor and scoreBandFor agree at every boundary — one set of thresholds, not two', () => {
  for (const score of [0, 39, 40, 64, 65, 84, 85, 100]) {
    const band = scoreBandFor(score)
    const summary = summaryFor(score, false, 7, 7)
    if (band.minScore >= 85) assert.match(summary, /look great/)
    else if (band.minScore >= 65) assert.match(summary, /look solid/)
    else if (band.minScore >= 40) assert.match(summary, /are working/)
    else assert.match(summary, /notable issues/)
  }
})
