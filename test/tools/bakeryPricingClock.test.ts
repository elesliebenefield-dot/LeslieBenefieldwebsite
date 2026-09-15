// Tests for the monotonic ISO-timestamp clock used by every repository's
// createdAt/updatedAt fields. The invariant under test: every call returns
// a value strictly later than every previous call in this process — proven
// deterministically (no sleeps, no timing assumptions), because the clock
// itself never depends on wall-clock speed to hold the guarantee.
//
// Run with: node --test test/tools/bakeryPricingClock.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nowIso } from '../../src/tools/bakery-pricing/data/clock.ts'

test('two immediately consecutive calls are strictly increasing', () => {
  const first = nowIso()
  const second = nowIso()
  assert.ok(
    new Date(second).getTime() > new Date(first).getTime(),
    `expected ${second} to be strictly later than ${first}`,
  )
})

test('a long run of back-to-back calls is strictly increasing throughout, regardless of how many land in the same millisecond', () => {
  const timestamps: string[] = []
  for (let i = 0; i < 2000; i++) timestamps.push(nowIso())

  for (let i = 1; i < timestamps.length; i++) {
    const prevMs = new Date(timestamps[i - 1] as string).getTime()
    const curMs = new Date(timestamps[i] as string).getTime()
    assert.ok(curMs > prevMs, `index ${i}: expected ${timestamps[i]} > ${timestamps[i - 1]}`)
  }
})

test('every returned value is a valid ISO 8601 string', () => {
  const value = nowIso()
  assert.equal(new Date(value).toISOString(), value)
})
