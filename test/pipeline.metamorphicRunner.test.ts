// Sub-patch 2c — metamorphic runner tests. The runner itself never
// imports a pipeline implementation module (see its own header comment);
// THIS TEST FILE supplies the real `normalizeEmptyEvidence` as the
// system-under-test, since test files aren't bound by the offline/*
// import-boundary rule. No browser, no network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runMetamorphicSuite, type MetamorphicTransformation, type MetamorphicRelationResult } from '../src/lib/offline/invariants/metamorphicRunner.ts'
import { normalizeEmptyEvidence, type NormalizeEmptyResult } from '../src/lib/pipeline/normalize/evidenceNormalizer.ts'
import { RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, type RawCapture, type ViewportName } from '../src/lib/pipeline/types/rawCapture.ts'
import { EMPTY_CAPTURE_PAYLOAD } from '../src/lib/pipeline/types/checkSpecification.ts'

function makeCapture(viewportName: ViewportName, capturedAt = '2026-01-01T00:00:00.000Z', finalUrl = 'https://fixture.invalid/a'): RawCapture<'empty'> {
  return {
    envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION,
    checkId: 'empty',
    payloadSchemaVersion: '1.0.0',
    provenance: { capturedAt, viewport: { name: viewportName, width: 1280, height: 800 }, finalUrl },
    payload: EMPTY_CAPTURE_PAYLOAD,
    incompleteCoverage: {},
  }
}

function exactRelation(sourceOutput: NormalizeEmptyResult, transformedOutput: NormalizeEmptyResult): MetamorphicRelationResult {
  return JSON.stringify(sourceOutput) === JSON.stringify(transformedOutput) ? { holds: true } : { holds: false, detail: 'normalized evidence differs after transformation' }
}

const sourceCaptures: RawCapture<'empty'>[] = [makeCapture('desktop'), makeCapture('tablet')]

// ─── Valid transformations for the synthetic empty scaffold: capture-order
// permutation, and provenance-field changes the normalizer ignores ──────

const permuteOrder: MetamorphicTransformation<RawCapture<'empty'>[]> = {
  id: 'permute-capture-order',
  apply: (captures) => [...captures].reverse(),
}

const changeIgnoredProvenance: MetamorphicTransformation<RawCapture<'empty'>[]> = {
  id: 'change-ignored-provenance',
  apply: (captures) => captures.map((c) => ({ ...c, provenance: { ...c.provenance, capturedAt: '2099-12-31T23:59:59.999Z', finalUrl: 'https://fixture.invalid/totally-different-path' } })),
}

test('10. capture-order permutation produces identical normalized evidence', () => {
  const result = runMetamorphicSuite(sourceCaptures, [permuteOrder], normalizeEmptyEvidence, exactRelation)
  assert.equal(result.status, 'completed')
  if (result.status === 'completed') assert.deepEqual(result.outcomes, [{ status: 'pass', transformationId: 'permute-capture-order' }])
})

test('11. ignored provenance changes (capturedAt, finalUrl) produce identical normalized evidence', () => {
  const result = runMetamorphicSuite(sourceCaptures, [changeIgnoredProvenance], normalizeEmptyEvidence, exactRelation)
  assert.equal(result.status, 'completed')
  if (result.status === 'completed') assert.deepEqual(result.outcomes, [{ status: 'pass', transformationId: 'change-ignored-provenance' }])
})

// ─── 12. A deliberately non-invariant transformation is reported as a
// failure ────────────────────────────────────────────────────────────

const injectExtraViewport: MetamorphicTransformation<RawCapture<'empty'>[]> = {
  id: 'inject-extra-viewport',
  apply: (captures) => [...captures, makeCapture('mobile')],
}

test('12. a deliberately non-invariant transformation (adding a viewport) is reported as a failure, proving the runner can fail', () => {
  const result = runMetamorphicSuite(sourceCaptures, [injectExtraViewport], normalizeEmptyEvidence, exactRelation)
  assert.equal(result.status, 'completed')
  if (result.status === 'completed') {
    assert.equal(result.outcomes.length, 1)
    assert.equal(result.outcomes[0].status, 'fail')
    assert.equal(result.outcomes[0].transformationId, 'inject-extra-viewport')
  }
})

// ─── 13. Duplicate/blank transformation ID rejection ────────────────────

test('13a. rejects a blank transformation id', () => {
  const result = runMetamorphicSuite(sourceCaptures, [{ id: '   ', apply: (c) => c }], normalizeEmptyEvidence, exactRelation)
  assert.equal(result.status, 'invalid-transformations')
})

test('13b. rejects duplicate transformation ids', () => {
  const result = runMetamorphicSuite(sourceCaptures, [permuteOrder, { ...permuteOrder }], normalizeEmptyEvidence, exactRelation)
  assert.equal(result.status, 'invalid-transformations')
})

// ─── 14. Transformation, system-under-test, and assertion exceptions
// reported distinctly ───────────────────────────────────────────────────

test('14a. a throwing transformation is reported as a "transformation"-phase error, not swallowed', () => {
  const throwingTransform: MetamorphicTransformation<RawCapture<'empty'>[]> = { id: 'throws', apply: () => { throw new Error('boom-transform') } }
  const result = runMetamorphicSuite(sourceCaptures, [throwingTransform], normalizeEmptyEvidence, exactRelation)
  assert.equal(result.status, 'completed')
  if (result.status === 'completed') {
    assert.equal(result.outcomes[0].status, 'error')
    if (result.outcomes[0].status === 'error') {
      assert.equal(result.outcomes[0].phase, 'transformation')
      assert.match(result.outcomes[0].reason, /boom-transform/)
    }
  }
})

test('14b. a throwing system-under-test is reported as a "system-under-test"-phase error', () => {
  const throwingSut = () => {
    throw new Error('boom-sut')
  }
  const result = runMetamorphicSuite(sourceCaptures, [permuteOrder], throwingSut, exactRelation)
  assert.equal(result.status, 'baseline-error', 'the baseline call happens first and throws here, before any transformation runs')
  if (result.status === 'baseline-error') assert.match(result.reason, /boom-sut/)
})

test('14b2. a system-under-test that only throws on the TRANSFORMED input (not the baseline) is reported as a "system-under-test"-phase per-transformation error', () => {
  let callCount = 0
  const sometimesThrowingSut = (captures: RawCapture<'empty'>[]) => {
    callCount++
    if (callCount > 1) throw new Error('boom-sut-on-transformed')
    return normalizeEmptyEvidence(captures)
  }
  const result = runMetamorphicSuite(sourceCaptures, [permuteOrder], sometimesThrowingSut, exactRelation)
  assert.equal(result.status, 'completed')
  if (result.status === 'completed') {
    assert.equal(result.outcomes[0].status, 'error')
    if (result.outcomes[0].status === 'error') {
      assert.equal(result.outcomes[0].phase, 'system-under-test')
      assert.match(result.outcomes[0].reason, /boom-sut-on-transformed/)
    }
  }
})

test('14c. a throwing relation/assertion is reported as an "assertion"-phase error', () => {
  const throwingRelation = (): MetamorphicRelationResult => {
    throw new Error('boom-assertion')
  }
  const result = runMetamorphicSuite(sourceCaptures, [permuteOrder], normalizeEmptyEvidence, throwingRelation)
  assert.equal(result.status, 'completed')
  if (result.status === 'completed') {
    assert.equal(result.outcomes[0].status, 'error')
    if (result.outcomes[0].status === 'error') assert.equal(result.outcomes[0].phase, 'assertion')
  }
})

test('a malformed (non-{holds} shaped) relation result is reported as an "assertion"-phase error, not trusted', () => {
  const malformedRelation = (() => ({ notHolds: 'garbage' })) as unknown as (a: NormalizeEmptyResult, b: NormalizeEmptyResult) => MetamorphicRelationResult
  const result = runMetamorphicSuite(sourceCaptures, [permuteOrder], normalizeEmptyEvidence, malformedRelation)
  assert.equal(result.status, 'completed')
  if (result.status === 'completed') {
    assert.equal(result.outcomes[0].status, 'error')
    if (result.outcomes[0].status === 'error') assert.equal(result.outcomes[0].phase, 'assertion')
  }
})

// ─── 15. Deterministic result ordering across repeated runs, and across
// differently-ordered but equivalent transformation sets ────────────────

test('15. deterministic output ordering: repeated runs with the same transformation list produce outcomes in the same (sorted-by-id) order', () => {
  const transformations = [permuteOrder, changeIgnoredProvenance, injectExtraViewport]
  const runs = Array.from({ length: 5 }, () => runMetamorphicSuite(sourceCaptures, transformations, normalizeEmptyEvidence, exactRelation))
  for (const r of runs) assert.equal(r.status, 'completed')
  const first = runs[0]
  for (const r of runs) assert.deepEqual(r, first)
  if (first.status === 'completed') {
    assert.deepEqual(
      first.outcomes.map((o) => o.transformationId),
      ['change-ignored-provenance', 'inject-extra-viewport', 'permute-capture-order'],
      'outcomes are sorted lexicographically by transformation id, not the order they were supplied in'
    )
  }
})

test('equivalent transformation sets supplied in different orders produce identical result ordering', () => {
  const transformations = [permuteOrder, changeIgnoredProvenance, injectExtraViewport]
  const shuffledTransformations = [injectExtraViewport, permuteOrder, changeIgnoredProvenance]
  const reverseShuffledTransformations = [changeIgnoredProvenance, injectExtraViewport, permuteOrder]
  const resultA = runMetamorphicSuite(sourceCaptures, transformations, normalizeEmptyEvidence, exactRelation)
  const resultB = runMetamorphicSuite(sourceCaptures, shuffledTransformations, normalizeEmptyEvidence, exactRelation)
  const resultC = runMetamorphicSuite(sourceCaptures, reverseShuffledTransformations, normalizeEmptyEvidence, exactRelation)
  assert.deepEqual(resultA, resultB)
  assert.deepEqual(resultA, resultC)
})

// ─── 9. Source fixture unchanged after every transformation ────────────

test('9. the source input array and its elements are never mutated by any transformation, including a badly-behaved in-place-mutating one', () => {
  const badTransform: MetamorphicTransformation<RawCapture<'empty'>[]> = {
    id: 'mutates-in-place',
    apply: (captures) => {
      // Deliberately bad behavior: mutates its argument in place instead
      // of returning a new array/objects. The runner clones before
      // calling `apply`, so even this cannot reach the real source.
      captures[0].incompleteCoverage.tamperedFlag = true
      captures.push(makeCapture('narrow'))
      return captures
    },
  }
  const snapshotBefore = structuredClone(sourceCaptures)
  runMetamorphicSuite(sourceCaptures, [permuteOrder, changeIgnoredProvenance, badTransform], normalizeEmptyEvidence, exactRelation)
  assert.deepEqual(sourceCaptures, snapshotBefore, 'the original source array/objects must be completely unchanged after running the suite')
})

// ─── Baseline isolation: a malicious relation cannot corrupt later
// transformations by mutating the shared baseline output ───────────────

test('a relation that mutates its source/transformed-output arguments cannot influence the outcome of a later transformation in the same suite', () => {
  // Deliberately bad behavior: reaches into whatever it's handed and
  // mutates it in place, on EVERY call — if the runner passed the same
  // `sourceOutput` reference to every relation call, this would corrupt
  // it for every subsequent transformation too.
  const maliciousRelation = (sourceOutput: NormalizeEmptyResult, transformedOutput: NormalizeEmptyResult): MetamorphicRelationResult => {
    if (sourceOutput.ok) (sourceOutput as { ok: true; value: { checkId: string } }).value.checkId = 'TAMPERED'
    if (transformedOutput.ok) (transformedOutput as { ok: true; value: { checkId: string } }).value.checkId = 'TAMPERED'
    return sourceOutput.ok && transformedOutput.ok && JSON.stringify(sourceOutput.value) === JSON.stringify(transformedOutput.value) ? { holds: true } : { holds: false, detail: 'evidence differs' }
  }

  const transformations = [
    { id: 'a-first', apply: (c: RawCapture<'empty'>[]) => [...c].reverse() },
    { id: 'b-second', apply: (c: RawCapture<'empty'>[]) => [...c].reverse() },
    { id: 'c-third', apply: (c: RawCapture<'empty'>[]) => [...c].reverse() },
  ]
  const result = runMetamorphicSuite(sourceCaptures, transformations, normalizeEmptyEvidence, maliciousRelation)
  assert.equal(result.status, 'completed')
  if (result.status === 'completed') {
    // Every transformation is a genuine capture-order permutation (an
    // actual invariant of normalizeEmptyEvidence), so every one must
    // still PASS — if the malicious relation's mutation of a shared
    // baseline reference had leaked across calls, a later transformation
    // would see an already-corrupted 'TAMPERED' baseline and fail.
    assert.deepEqual(result.outcomes, [
      { status: 'pass', transformationId: 'a-first' },
      { status: 'pass', transformationId: 'b-second' },
      { status: 'pass', transformationId: 'c-third' },
    ])
  }

  // The real baseline, recomputed independently, must never have observed
  // the tampering either — proving the runner's OWN internal sourceOutput
  // was never the same reference handed to the relation.
  const freshBaseline = normalizeEmptyEvidence(sourceCaptures)
  assert.equal(freshBaseline.ok, true)
  if (freshBaseline.ok) assert.equal(freshBaseline.value.checkId, 'empty')
})

// ─── never mutates a fresh-cloned transformed input across siblings ────

test('running the same transformation twice in one suite (via two differently-named entries) produces independent, non-interfering results', () => {
  const result = runMetamorphicSuite(sourceCaptures, [permuteOrder, { ...permuteOrder, id: 'permute-capture-order-again' }], normalizeEmptyEvidence, exactRelation)
  assert.equal(result.status, 'completed')
  if (result.status === 'completed') {
    assert.equal(result.outcomes.length, 2)
    assert.deepEqual(result.outcomes, [
      { status: 'pass', transformationId: 'permute-capture-order' },
      { status: 'pass', transformationId: 'permute-capture-order-again' },
    ])
  }
})

// ─── no logging/persistence/timers/randomness/env/network source scan ──

test('metamorphicRunner.ts has no logging, persistence, timers, randomness, environment dependence, or network/browser access', async () => {
  const { readFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const source = await readFile(path.join(import.meta.dirname, '..', 'src/lib/offline/invariants/metamorphicRunner.ts'), 'utf8')
  for (const forbidden of ['console.', 'node:fs', "'fs'", 'setTimeout', 'setInterval', 'Math.random', 'Date.now', 'new Date(', 'process.env', 'fetch(', 'node:http', 'node:net', 'puppeteer']) {
    assert.ok(!source.includes(forbidden), `metamorphicRunner.ts must not reference "${forbidden}"`)
  }
})
