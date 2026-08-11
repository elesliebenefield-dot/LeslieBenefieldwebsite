// Sub-patch 2c — generic assertion machinery 2c can honestly prove, plus
// explicit hooks for the PRD invariants it cannot.
//
// Of PRD Success Criteria #1, #4, #5, #6, #7 (prd.md — the "invariants"
// named throughout plan.md/patch.md), only **#7 (determinism under
// controlled capture)** is meaningfully exercisable against Milestone 2's
// trivial 'empty' scaffold: it needs only a pure pipeline and controlled
// synthetic captures, both of which exist. #1 (equivalence invariance)
// needs a real check's definition of "relevant evidence"; #4 (zero cost
// for advisory findings) needs a real scoring mechanism (none exists —
// classification.ts's header comment); #5/#6 (monotonicity) need a real
// check with an injectable severity gradient. None of those can be
// meaningfully run against a check that evaluates nothing, so each is
// represented ONLY as a framework hook below that always returns
// `'deferred'` — never a fabricated pass.
//
// No logging, persistence, timers, randomness, environment dependence, or
// browser/network access.

import { isDeepStrictEqual } from 'node:util'

export type AssertionResult = { pass: true } | { pass: false; detail: string }

function describeThrown(e: unknown): string {
  // Bounded, no arbitrary-input echo — matches metamorphicRunner.ts's own
  // rule (both are generic frameworks that must never assume the input
  // they're handed is safe to reproduce in a message).
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 500)
  return `non-Error thrown value of type ${typeof e}`
}

/**
 * Distinct from `AssertionResult`: a repeated-run assertion invokes
 * `structuredClone` and a caller-supplied `systemUnderTest` function
 * potentially many times, either of which can throw for reasons that have
 * nothing to do with whether the determinism invariant itself holds
 * (e.g. a non-cloneable value, a bug in the system under test). Collapsing
 * that into `{ pass: false }` would conflate "the invariant was checked
 * and failed" with "the invariant could not be checked at all" — this
 * three-way status keeps them distinguishable at the call site.
 */
export type DeterminismAssertionResult =
  | { status: 'pass' }
  | { status: 'invariant-failure'; detail: string }
  | { status: 'execution-error'; runIndex: number; phase: 'clone' | 'system-under-test'; reason: string }

/** Zero-tolerance structural equality. Distinct from
 *  `assertWithinTolerance` below by design — see requirement "clear
 *  distinction between exact equality and caller-authorized tolerance". */
export function assertExactDeepEqual<T>(actual: T, expected: T): AssertionResult {
  return isDeepStrictEqual(actual, expected) ? { pass: true } : { pass: false, detail: 'actual and expected are not exactly deeply equal (zero tolerance)' }
}

/**
 * Calls `systemUnderTest` `runs` times, each against a FRESH clone of
 * `input` (never the same reference twice, so a system that mutates its
 * argument in place can't corrupt a later run's input), and asserts every
 * output is exactly deeply equal to the first.
 *
 * Never throws: a `structuredClone` failure or a `systemUnderTest` throw
 * on any run is reported as `{ status: 'execution-error' }`, distinct from
 * `{ status: 'invariant-failure' }` (the determinism invariant was
 * actually checked and found false) — a caller must not have to guess
 * which one happened from a bare `false`. `reason` is a bounded
 * description (`describeThrown`), never the raw thrown value or `input`
 * itself.
 */
export function assertDeterministicRepeatedRun<TInput, TOutput>(input: TInput, systemUnderTest: (i: TInput) => TOutput, runs: number): DeterminismAssertionResult {
  if (!Number.isInteger(runs) || runs < 1) {
    return { status: 'invariant-failure', detail: `runs must be a positive integer, got: ${runs}` }
  }
  const outputs: TOutput[] = []
  for (let i = 0; i < runs; i++) {
    let clonedInput: TInput
    try {
      clonedInput = structuredClone(input)
    } catch (e) {
      return { status: 'execution-error', runIndex: i, phase: 'clone', reason: describeThrown(e) }
    }
    try {
      outputs.push(systemUnderTest(clonedInput))
    } catch (e) {
      return { status: 'execution-error', runIndex: i, phase: 'system-under-test', reason: describeThrown(e) }
    }
  }
  const first = outputs[0]
  for (let i = 1; i < outputs.length; i++) {
    if (!isDeepStrictEqual(outputs[i], first)) {
      return { status: 'invariant-failure', detail: `run ${i} produced output that differs from run 0 — not deterministic` }
    }
  }
  return { status: 'pass' }
}

/**
 * PRD Success Criterion #7 (Determinism under controlled capture) —
 * exercised for real against the empty scaffold's actual pipeline
 * (test/pipeline.invariantAssertions.test.ts), not merely asserted. This
 * is a thin, explicitly-labeled wrapper around
 * `assertDeterministicRepeatedRun` — the mechanism (including its
 * execution-error handling) is identical; the separate name exists so the
 * PRD-criterion linkage is visible and testable at the call site, not
 * just in a comment.
 */
export function assertDeterminismUnderControlledCapture<TInput, TOutput>(input: TInput, systemUnderTest: (i: TInput) => TOutput, repeatedRuns: number): DeterminismAssertionResult {
  return assertDeterministicRepeatedRun(input, systemUnderTest, repeatedRuns)
}

/** Asserts `value` is already in its canonical form (per the caller-
 *  supplied `canonicalize` function) — i.e. canonicalizing it again is a
 *  no-op. */
export function assertCanonicalOrder<T>(value: T, canonicalize: (v: T) => T): AssertionResult {
  return isDeepStrictEqual(value, canonicalize(value)) ? { pass: true } : { pass: false, detail: 'value is not already in canonical order' }
}

/** Asserts a fixture/source value is unchanged from a snapshot taken
 *  before some operation — proving that operation didn't mutate it. */
export function assertSourceUnchanged<T>(currentValue: T, snapshotBeforeOperation: T): AssertionResult {
  return isDeepStrictEqual(currentValue, snapshotBeforeOperation) ? { pass: true } : { pass: false, detail: 'source value was mutated — no longer matches its pre-operation snapshot' }
}

/**
 * Explicit, caller-supplied numeric tolerance only — there is no default.
 * Rejects a non-finite (NaN/Infinity) or negative tolerance outright,
 * since Milestone 2 establishes no calibrated tolerance for any real
 * check (validation-parameters-v1-draft.md §6: "PROVISIONAL... no
 * specific number is proposed here as anything other than a placeholder
 * to be replaced").
 */
export function assertWithinTolerance(actual: number, expected: number, tolerance: number): AssertionResult {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return { pass: false, detail: `tolerance must be a finite number >= 0, got: ${tolerance}` }
  }
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    return { pass: false, detail: `actual and expected must both be finite numbers, got actual=${actual}, expected=${expected}` }
  }
  const diff = Math.abs(actual - expected)
  return diff <= tolerance ? { pass: true } : { pass: false, detail: `|${actual} - ${expected}| = ${diff} exceeds tolerance ${tolerance}` }
}

// ─── PRD invariant framework hooks — deliberately not exercised ───────────

export interface DeferredAssertionResult {
  status: 'deferred'
  prdCriterion: string
  reason: string
}

/** PRD Success Criterion #1 (Equivalence invariance, scoped to
 *  relevance). Cannot be constructed as a "pass" here — this function has
 *  no return type other than `DeferredAssertionResult`, so no caller can
 *  accidentally treat 'empty' as having exercised it. */
export function assertEquivalenceInvariance(): DeferredAssertionResult {
  return {
    status: 'deferred',
    prdCriterion: 'PRD Success Criterion #1 (equivalence invariance)',
    reason: "requires a real check's definition of which evidence is relevant to it — meaningless for a check that evaluates no evidence at all. Deferred to Milestone 3+.",
  }
}

/** PRD Success Criterion #4 (Zero cost for manual-review/policy-advisory
 *  findings). */
export function assertZeroCostForAdvisoryFindings(): DeferredAssertionResult {
  return {
    status: 'deferred',
    prdCriterion: 'PRD Success Criterion #4 (zero cost for advisory findings)',
    reason: 'requires a real scoring mechanism, which does not exist anywhere in Milestone 2\'s core contracts (see classification.ts). Deferred to the scoring gate.',
  }
}

/** PRD Success Criterion #5 (Monotonicity — problems can't help). */
export function assertMonotonicityProblemsCannotHelp(): DeferredAssertionResult {
  return {
    status: 'deferred',
    prdCriterion: 'PRD Success Criterion #5 (monotonicity — problems can\'t help)',
    reason: 'requires a real check with an injectable problem to test "adding a problem never helps" against — the empty scaffold has no problems to inject. Deferred to Milestone 3+.',
  }
}

/** PRD Success Criterion #6 (Monotonicity — worse can't score better). */
export function assertMonotonicityWorseCannotScoreBetter(): DeferredAssertionResult {
  return {
    status: 'deferred',
    prdCriterion: 'PRD Success Criterion #6 (monotonicity — worse can\'t score better)',
    reason: 'requires a real check with a measurable severity gradient — the empty scaffold has none. Deferred to Milestone 3+.',
  }
}
