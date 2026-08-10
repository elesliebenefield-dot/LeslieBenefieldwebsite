// Sub-patch 2c — invariant/tolerance assertion tests, including a genuine
// exercise of PRD Success Criterion #7 (determinism) against the real
// pipeline, and confirmation the #1/#4/#5/#6 hooks never report a pass.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertExactDeepEqual,
  assertDeterministicRepeatedRun,
  assertDeterminismUnderControlledCapture,
  assertCanonicalOrder,
  assertSourceUnchanged,
  assertWithinTolerance,
  assertEquivalenceInvariance,
  assertZeroCostForAdvisoryFindings,
  assertMonotonicityProblemsCannotHelp,
  assertMonotonicityWorseCannotScoreBetter,
} from '../src/lib/offline/invariants/invariantAssertions.ts'
import { normalizeEmptyEvidence, CANONICAL_VIEWPORT_ORDER } from '../src/lib/pipeline/normalize/evidenceNormalizer.ts'
import { RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, type RawCapture, type ViewportName } from '../src/lib/pipeline/types/rawCapture.ts'
import { EMPTY_CAPTURE_PAYLOAD } from '../src/lib/pipeline/types/checkSpecification.ts'

function makeCapture(viewportName: ViewportName): RawCapture<'empty'> {
  return {
    envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION,
    checkId: 'empty',
    payloadSchemaVersion: '1.0.0',
    provenance: { capturedAt: '2026-01-01T00:00:00.000Z', viewport: { name: viewportName, width: 1280, height: 800 }, finalUrl: 'https://fixture.invalid/a' },
    payload: EMPTY_CAPTURE_PAYLOAD,
    incompleteCoverage: {},
  }
}

// ─── 16. Exact equality's zero-tolerance behavior ───────────────────────

test('16. assertExactDeepEqual passes for structurally identical values and fails for any difference, however small', () => {
  assert.equal(assertExactDeepEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }).pass, true)
  assert.equal(assertExactDeepEqual({ a: 1.0000001 }, { a: 1.0000002 }).pass, false, 'zero tolerance — even a tiny numeric difference fails')
  const result = assertExactDeepEqual({ a: 1 }, { a: 2 })
  assert.equal(result.pass, false)
  if (!result.pass) assert.equal(typeof result.detail, 'string')
})

// ─── 17. Caller-supplied numeric tolerance boundary behavior ───────────

test('17. assertWithinTolerance: exact boundary (diff === tolerance) passes', () => {
  assert.equal(assertWithinTolerance(10, 8, 2).pass, true)
})

test('17. assertWithinTolerance: just inside tolerance passes', () => {
  assert.equal(assertWithinTolerance(10, 8.5, 2).pass, true)
})

test('17. assertWithinTolerance: just outside tolerance fails', () => {
  assert.equal(assertWithinTolerance(10, 7.999, 2).pass, false)
})

test('17. assertWithinTolerance: negative tolerance is rejected', () => {
  const result = assertWithinTolerance(10, 10, -0.001)
  assert.equal(result.pass, false)
  if (!result.pass) assert.match(result.detail, /tolerance/)
})

test('17. assertWithinTolerance: NaN tolerance is rejected', () => {
  assert.equal(assertWithinTolerance(10, 10, NaN).pass, false)
})

test('17. assertWithinTolerance: Infinity tolerance is rejected', () => {
  assert.equal(assertWithinTolerance(10, 10, Infinity).pass, false)
})

test('17. assertWithinTolerance: zero tolerance is valid (boundary, not rejected) and behaves as exact equality', () => {
  assert.equal(assertWithinTolerance(5, 5, 0).pass, true)
  assert.equal(assertWithinTolerance(5, 5.0001, 0).pass, false)
})

test('17. assertWithinTolerance rejects non-finite actual/expected regardless of tolerance', () => {
  assert.equal(assertWithinTolerance(NaN, 5, 10).pass, false)
  assert.equal(assertWithinTolerance(5, Infinity, 10).pass, false)
})

// ─── clear distinction between exact equality and tolerance ────────────

test('assertExactDeepEqual and assertWithinTolerance are distinct functions with distinct semantics — exact equality never accepts a tolerance parameter', () => {
  assert.equal(assertExactDeepEqual.length, 2, 'assertExactDeepEqual takes only (actual, expected), no tolerance parameter')
  assert.equal(assertWithinTolerance.length, 3, 'assertWithinTolerance requires an explicit tolerance parameter')
})

// ─── canonical-order and source-immutability assertions ────────────────

test('assertCanonicalOrder passes for an already-canonical value and fails for a non-canonical one', () => {
  const canonical = [...CANONICAL_VIEWPORT_ORDER]
  const nonCanonical = [...CANONICAL_VIEWPORT_ORDER].reverse()
  const identity = (v: readonly ViewportName[]) => [...v].sort((a, b) => CANONICAL_VIEWPORT_ORDER.indexOf(a) - CANONICAL_VIEWPORT_ORDER.indexOf(b))
  assert.equal(assertCanonicalOrder(canonical, identity).pass, true)
  assert.equal(assertCanonicalOrder(nonCanonical, identity).pass, false)
})

test('assertSourceUnchanged passes when a value matches its pre-operation snapshot, fails when it was mutated', () => {
  const snapshot = { x: 1 }
  assert.equal(assertSourceUnchanged({ x: 1 }, snapshot).pass, true)
  assert.equal(assertSourceUnchanged({ x: 2 }, snapshot).pass, false)
})

// ─── PRD Success Criterion #7 — genuinely exercised against the real
// pipeline ───────────────────────────────────────────────────────────────

test('PRD #7: assertDeterminismUnderControlledCapture passes for the real normalizeEmptyEvidence pipeline, repeated many times', () => {
  const captures: RawCapture<'empty'>[] = [makeCapture('desktop'), makeCapture('tablet')]
  const result = assertDeterminismUnderControlledCapture(captures, normalizeEmptyEvidence, 10)
  assert.equal(result.status, 'pass')
})

test('assertDeterministicRepeatedRun rejects a non-positive-integer run count as an invariant-failure, not an execution-error', () => {
  for (const badRuns of [0, -1, 1.5]) {
    const result = assertDeterministicRepeatedRun([makeCapture('desktop')], normalizeEmptyEvidence, badRuns)
    assert.equal(result.status, 'invariant-failure')
  }
})

test('assertDeterministicRepeatedRun detects genuine nondeterminism as an invariant-failure', () => {
  let counter = 0
  const nondeterministicSut = () => ({ callNumber: counter++ })
  const result = assertDeterministicRepeatedRun({}, nondeterministicSut, 3)
  assert.equal(result.status, 'invariant-failure')
})

// ─── Structured execution-error results (distinct from invariant-failure) ──

test('assertDeterministicRepeatedRun reports a throwing systemUnderTest as a structured execution-error, not a thrown exception, and identifies the failing run index', () => {
  let callCount = 0
  const throwsOnSecondRun = () => {
    callCount++
    if (callCount === 2) throw new Error('boom-sut')
    return { ok: true }
  }
  const result = assertDeterministicRepeatedRun({}, throwsOnSecondRun, 5)
  assert.equal(result.status, 'execution-error')
  if (result.status === 'execution-error') {
    assert.equal(result.phase, 'system-under-test')
    assert.equal(result.runIndex, 1, 'zero-indexed: the second call is index 1')
    assert.match(result.reason, /boom-sut/)
  }
})

test('assertDeterministicRepeatedRun reports a structuredClone failure (a non-cloneable input) as a structured execution-error at run 0, distinct from an invariant-failure', () => {
  const nonCloneableInput = { fn: () => 'functions are not structured-cloneable' }
  const result = assertDeterministicRepeatedRun(nonCloneableInput, (x) => x, 3)
  assert.equal(result.status, 'execution-error')
  if (result.status === 'execution-error') {
    assert.equal(result.phase, 'clone')
    assert.equal(result.runIndex, 0)
    assert.equal(typeof result.reason, 'string')
    assert.ok(result.reason.length > 0)
  }
})

test('assertDeterministicRepeatedRun execution-error does not echo the input value into its reason', () => {
  const secretShapedInput = { doNotLeakThisToken: 'super-secret-value-12345' }
  const throwingSut = () => {
    throw new Error('generic failure')
  }
  const result = assertDeterministicRepeatedRun(secretShapedInput, throwingSut, 1)
  assert.equal(result.status, 'execution-error')
  if (result.status === 'execution-error') assert.ok(!result.reason.includes('super-secret-value-12345'))
})

test('pass, invariant-failure, and execution-error are three distinct, mutually exclusive statuses', () => {
  const passResult = assertDeterministicRepeatedRun({ x: 1 }, (x) => x, 3)
  const invariantFailureResult = assertDeterministicRepeatedRun({}, (() => { let n = 0; return () => ({ n: n++ }) })(), 3)
  const executionErrorResult = assertDeterministicRepeatedRun({}, () => { throw new Error('x') }, 1)
  assert.equal(passResult.status, 'pass')
  assert.equal(invariantFailureResult.status, 'invariant-failure')
  assert.equal(executionErrorResult.status, 'execution-error')
  const statuses = new Set([passResult.status, invariantFailureResult.status, executionErrorResult.status])
  assert.equal(statuses.size, 3, 'each case must produce a genuinely distinct status')
})

// ─── PRD #1, #4, #5, #6 — never marked as passed ────────────────────────

test('PRD #1, #4, #5, #6 hooks always report "deferred", never a fabricated pass, and each names its blocking PRD criterion', () => {
  for (const hook of [assertEquivalenceInvariance, assertZeroCostForAdvisoryFindings, assertMonotonicityProblemsCannotHelp, assertMonotonicityWorseCannotScoreBetter]) {
    const result = hook()
    assert.equal(result.status, 'deferred')
    assert.ok(!('pass' in result), 'a deferred hook result must not have a pass/fail field that could be mistaken for an exercised assertion')
    assert.match(result.prdCriterion, /PRD Success Criterion #[1456]/)
    assert.ok(result.reason.length > 0)
  }
})

// ─── no logging/persistence/timers/randomness/env/network source scan ──

test('invariantAssertions.ts has no logging, persistence, timers not used as hidden nondeterminism, environment dependence, or network/browser access', async () => {
  const { readFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const source = await readFile(path.join(import.meta.dirname, '..', 'src/lib/offline/invariants/invariantAssertions.ts'), 'utf8')
  for (const forbidden of ['console.', 'node:fs', "'fs'", 'setTimeout', 'setInterval', 'Math.random', 'process.env', 'fetch(', 'node:http', 'node:net', 'puppeteer']) {
    assert.ok(!source.includes(forbidden), `invariantAssertions.ts must not reference "${forbidden}"`)
  }
})
