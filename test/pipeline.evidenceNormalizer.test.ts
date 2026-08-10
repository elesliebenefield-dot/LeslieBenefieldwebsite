// Sub-patch 2b — Evidence Normalizer tests. Hand-authored typed
// RawCapture<'empty'> values only — no browser, no fixture library
// (that's 2c), no network. Proves determinism, order-independence,
// provenance non-leakage, and typed failure semantics.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, type RawCapture, type ViewportName } from '../src/lib/pipeline/types/rawCapture.ts'
import { EMPTY_CAPTURE_PAYLOAD } from '../src/lib/pipeline/types/checkSpecification.ts'
import { normalizeEmptyEvidence, CANONICAL_VIEWPORT_ORDER } from '../src/lib/pipeline/normalize/evidenceNormalizer.ts'

function makeCapture(viewportName: ViewportName, incompleteCoverage: Record<string, boolean> = {}): RawCapture<'empty'> {
  return {
    envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION,
    checkId: 'empty',
    payloadSchemaVersion: '1.0.0',
    provenance: {
      capturedAt: '2026-08-09T00:00:00.000Z',
      viewport: { name: viewportName, width: 1280, height: 800 },
      finalUrl: 'https://example.com/',
    },
    payload: EMPTY_CAPTURE_PAYLOAD,
    incompleteCoverage,
  }
}

test('produces well-formed NormalizedEvidence<"empty"> for a single capture', () => {
  const result = normalizeEmptyEvidence([makeCapture('desktop')])
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.checkId, 'empty')
    assert.equal(result.value.evidence.__brand, 'EmptyCheckEvidence')
    assert.deepEqual(result.value.viewportsPresent, ['desktop'])
  }
})

test('canonical viewport ordering: output is always desktop, tablet, mobile, narrow regardless of input order', () => {
  assert.deepEqual(CANONICAL_VIEWPORT_ORDER, ['desktop', 'tablet', 'mobile', 'narrow'])
  const result = normalizeEmptyEvidence([makeCapture('narrow'), makeCapture('desktop'), makeCapture('mobile')])
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value.viewportsPresent, ['desktop', 'mobile', 'narrow'])
})

test('canonical coverage-key ordering: incompleteCoverage keys are always alphabetically ordered in the output', () => {
  const result = normalizeEmptyEvidence([makeCapture('desktop', { zKey: true, aKey: false, mKey: true })])
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(Object.keys(result.value.incompleteCoverage), ['aKey', 'mKey', 'zKey'])
})

test('input-order independence: equivalent capture sets in different orders produce deeply equal normalized evidence', () => {
  const a = normalizeEmptyEvidence([makeCapture('desktop', { x: true }), makeCapture('mobile', { y: false })])
  const b = normalizeEmptyEvidence([makeCapture('mobile', { y: false }), makeCapture('desktop', { x: true })])
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value)
})

test('no provenance leakage: capturedAt and finalUrl never appear anywhere in the output', () => {
  const capture = makeCapture('desktop')
  const result = normalizeEmptyEvidence([capture])
  assert.equal(result.ok, true)
  if (result.ok) {
    const serialized = JSON.stringify(result.value)
    assert.ok(!serialized.includes(capture.provenance.capturedAt), 'capturedAt must not leak into normalized evidence')
    assert.ok(!serialized.includes(capture.provenance.finalUrl), 'finalUrl must not leak into normalized evidence')
    assert.ok(!('capturedAt' in result.value), 'no capturedAt field at all')
    assert.ok(!('finalUrl' in result.value), 'no finalUrl field at all')
    assert.ok(!('provenance' in result.value), 'no provenance field at all')
  }
})

test('structural guarantee: evidenceNormalizer.ts source never references capturedAt or finalUrl in code (excluding comments)', async () => {
  const { readFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const source = await readFile(path.join(import.meta.dirname, '..', 'src/lib/pipeline/normalize/evidenceNormalizer.ts'), 'utf8')
  const codeOnly = source
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
    .join('\n')
  assert.ok(!codeOnly.includes('capturedAt'), 'code must not reference capturedAt')
  assert.ok(!codeOnly.includes('finalUrl'), 'code must not reference finalUrl')
})

test('incomplete coverage is never silently cleared: OR-merge keeps a key incomplete if ANY viewport reports it incomplete', () => {
  const result = normalizeEmptyEvidence([makeCapture('desktop', { network: true }), makeCapture('mobile', { network: false })])
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.value.incompleteCoverage.network, true, 'one incomplete viewport must not be masked by a complete one')
})

test('incomplete coverage OR-merge: all-complete stays complete, all-incomplete stays incomplete', () => {
  const allComplete = normalizeEmptyEvidence([makeCapture('desktop', { x: false }), makeCapture('mobile', { x: false })])
  const allIncomplete = normalizeEmptyEvidence([makeCapture('desktop', { x: true }), makeCapture('mobile', { x: true })])
  assert.equal(allComplete.ok, true)
  assert.equal(allIncomplete.ok, true)
  if (allComplete.ok) assert.equal(allComplete.value.incompleteCoverage.x, false)
  if (allIncomplete.ok) assert.equal(allIncomplete.value.incompleteCoverage.x, true)
})

test('empty-input failure: an empty capture collection is rejected with a typed failure, not an exception', () => {
  const result = normalizeEmptyEvidence([])
  assert.equal(result.ok, false)
  if (!result.ok) assert.deepEqual(result.error, { kind: 'empty-capture-collection' })
})

test('duplicate-viewport failure: two captures for the same viewport are rejected with a typed failure naming the viewport', () => {
  const result = normalizeEmptyEvidence([makeCapture('desktop'), makeCapture('desktop')])
  assert.equal(result.ok, false)
  if (!result.ok) assert.deepEqual(result.error, { kind: 'duplicate-viewport', viewportName: 'desktop' })
})

test('no input mutation: the input capture array and its elements are unchanged after normalization', () => {
  const captures = [makeCapture('desktop', { x: true })]
  const snapshot = structuredClone(captures)
  normalizeEmptyEvidence(captures)
  assert.deepEqual(captures, snapshot)
})

test('output freshness: repeated calls with equivalent but distinct input objects produce distinct, non-aliased output objects', () => {
  const a = normalizeEmptyEvidence([makeCapture('desktop')])
  const b = normalizeEmptyEvidence([makeCapture('desktop')])
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) {
    assert.notEqual(a.value, b.value)
    assert.notEqual(a.value.viewportsPresent, b.value.viewportsPresent)
    assert.notEqual(a.value.incompleteCoverage, b.value.incompleteCoverage)
    assert.deepEqual(a.value, b.value)
  }
})

test('deterministic repeated invocation: the exact same input produces deeply equal output every time, across many calls', () => {
  const captures = [makeCapture('desktop', { x: true }), makeCapture('tablet', { y: false })]
  const results = Array.from({ length: 5 }, () => normalizeEmptyEvidence(captures))
  for (const r of results) assert.equal(r.ok, true)
  const first = results[0]
  for (const r of results) assert.deepEqual(r, first)
})

test('a successful result cannot be used to corrupt later normalization results through mutation of evidence — the shared empty sentinel is frozen', () => {
  const first = normalizeEmptyEvidence([makeCapture('desktop')])
  assert.equal(first.ok, true)
  if (!first.ok) return

  assert.throws(() => {
    ;(first.value.evidence as { __brand: string }).__brand = 'TAMPERED'
  }, 'the shared EmptyCheckEvidence sentinel must be frozen, not mutable through one caller\'s result')

  const second = normalizeEmptyEvidence([makeCapture('desktop')])
  assert.equal(second.ok, true)
  if (second.ok) assert.equal(second.value.evidence.__brand, 'EmptyCheckEvidence', 'a failed mutation attempt on one result must not have corrupted a later, independent result')
})
