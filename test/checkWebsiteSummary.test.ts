// Release-polish fix: a completed, fully-verified 100/100 result with no
// 'improve' findings was still saying "with just a few small things
// worth a look" — a contradiction. summaryFor's "worth a look"/"room to
// improve" language is now gated on whether any 'improve' finding
// actually exists, and a qualification is added when not every check
// could be completed.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summaryFor } from '../api/check-website.ts'

test('a perfect, fully-verified score with no improve findings does not claim there are "small things worth a look"', () => {
  const summary = summaryFor(100, false, 7, 7)
  assert.ok(!summary.includes('worth a look'))
  assert.equal(summary, 'The technical basics checked look great.')
})

test('a high score WITH improve findings still mentions them', () => {
  const summary = summaryFor(90, true, 7, 7)
  assert.match(summary, /worth a look/)
})

test('a solid-band score (65-84) with no improve findings does not claim "room to improve"', () => {
  const summary = summaryFor(70, false, 7, 7)
  assert.ok(!summary.includes('room to improve'))
  assert.equal(summary, 'The technical basics checked look solid.')
})

test('a solid-band score WITH improve findings still mentions room to improve', () => {
  const summary = summaryFor(70, true, 7, 7)
  assert.match(summary, /room to improve/)
})

test('an incomplete result (fewer than all checks verified) gets a qualification note, even at a perfect score', () => {
  const summary = summaryFor(100, false, 5, 7)
  assert.match(summary, /not every check could be completed/i)
})

test('a fully-completed result gets no qualification note', () => {
  const summary = summaryFor(100, false, 7, 7)
  assert.ok(!summary.toLowerCase().includes('not every check'))
})
