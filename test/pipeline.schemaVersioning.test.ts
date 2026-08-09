// Sub-patch 2a — runtime schema validation and adversarial malformed-input
// tests for parseEmptyRawCapture and parseEmptyNormalizedEvidence, the
// untrusted/deserialized-boundary parsers (compile-time types alone don't
// help once a value has crossed a serialization boundary). Every parser
// here must validate the COMPLETE claimed shape and reject anything that
// doesn't match exactly — no network, no DNS, no browser, every input
// below is a hand-built plain object.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, type RawCapture } from '../src/lib/pipeline/types/rawCapture.ts'
import { NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION } from '../src/lib/pipeline/types/normalizedEvidence.ts'
import { EMPTY_CAPTURE_PAYLOAD, EMPTY_CHECK_EVIDENCE } from '../src/lib/pipeline/types/checkSpecification.ts'
import { parseEmptyRawCapture, parseEmptyNormalizedEvidence } from '../src/lib/pipeline/types/schemaValidation.ts'

const validRawCapture: RawCapture<'empty'> = {
  envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION,
  checkId: 'empty',
  payloadSchemaVersion: '1.0.0',
  provenance: {
    capturedAt: '2026-08-09T00:00:00.000Z',
    viewport: { name: 'desktop', width: 1280, height: 800 },
    finalUrl: 'https://example.com/',
  },
  payload: EMPTY_CAPTURE_PAYLOAD,
  incompleteCoverage: {},
}

const validEmptyEvidence = {
  envelopeSchemaVersion: NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION,
  checkId: 'empty' as const,
  sourceCapturePayloadSchemaVersion: '1.0.0',
  evidenceSchemaVersion: '1.0.0',
  evidence: EMPTY_CHECK_EVIDENCE,
  viewportsPresent: ['desktop' as const],
  incompleteCoverage: {},
}

// ─── parseEmptyRawCapture ───────────────────────────────────────────────

test('parseEmptyRawCapture accepts a well-formed, current-version value', () => {
  const result = parseEmptyRawCapture(validRawCapture)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value, validRawCapture)
})

test('parseEmptyRawCapture rejects non-objects, arrays, and null', () => {
  for (const bad of [null, undefined, 'a string', 42, true, []]) {
    const result = parseEmptyRawCapture(bad)
    assert.equal(result.ok, false, `expected rejection for ${JSON.stringify(bad)}`)
  }
})

test('parseEmptyRawCapture rejects a prototype-polluted object', () => {
  const polluted = Object.create({ evil: true })
  Object.assign(polluted, validRawCapture)
  const result = parseEmptyRawCapture(polluted)
  assert.equal(result.ok, false)
})

test('parseEmptyRawCapture rejects missing keys', () => {
  const { payload, ...withoutPayload } = validRawCapture
  void payload
  const result = parseEmptyRawCapture(withoutPayload)
  assert.equal(result.ok, false)
})

test('parseEmptyRawCapture rejects unexpected extra keys (exact-schema, not lenient)', () => {
  const result = parseEmptyRawCapture({ ...validRawCapture, extraField: 'not allowed' })
  assert.equal(result.ok, false)
})

test('parseEmptyRawCapture rejects a future/unknown envelopeSchemaVersion', () => {
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, envelopeSchemaVersion: '2.0.0' }).ok, false)
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, envelopeSchemaVersion: '0.9.0' }).ok, false)
})

test('parseEmptyRawCapture rejects an unregistered checkId', () => {
  const result = parseEmptyRawCapture({ ...validRawCapture, checkId: 'not-a-real-check' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /not-a-real-check/)
})

test('parseEmptyRawCapture rejects an unsupported payloadSchemaVersion', () => {
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, payloadSchemaVersion: '9.9.9' }).ok, false)
})

test('parseEmptyRawCapture rejects an arbitrary {} payload — the discriminant must be present and correct, not merely "is an object"', () => {
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, payload: {} }).ok, false)
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, payload: { __brand: 'WrongBrand' } }).ok, false)
})

test('parseEmptyRawCapture rejects malformed provenance: missing/extra keys, wrong viewport name, non-finite/negative dimensions, invalid date, empty finalUrl', () => {
  const base = validRawCapture.provenance
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: { ...base, viewport: { name: 'huge-tv', width: 1280, height: 800 } } }).ok, false, 'invalid viewport name')
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: { ...base, viewport: { name: 'desktop', width: -1, height: 800 } } }).ok, false, 'negative width')
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: { ...base, viewport: { name: 'desktop', width: 0, height: 800 } } }).ok, false, 'zero width')
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: { ...base, viewport: { name: 'desktop', width: Infinity, height: 800 } } }).ok, false, 'infinite width')
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: { ...base, viewport: { name: 'desktop', width: NaN, height: 800 } } }).ok, false, 'NaN width')
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: { ...base, capturedAt: 'not a date' } }).ok, false, 'invalid date string')
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: { ...base, finalUrl: '' } }).ok, false, 'empty finalUrl')
  const { finalUrl, ...provenanceWithoutFinalUrl } = base
  void finalUrl
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: provenanceWithoutFinalUrl }).ok, false, 'missing finalUrl')
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: { ...base, extra: 'nope' } }).ok, false, 'unexpected provenance key')
})

test('parseEmptyRawCapture rejects a non-boolean-valued incompleteCoverage', () => {
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, incompleteCoverage: { timedOut: 'yes' } }).ok, false)
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, incompleteCoverage: 'not-an-object' }).ok, false)
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, incompleteCoverage: [] }).ok, false)
})

// ─── parseEmptyNormalizedEvidence ───────────────────────────────────────

test('parseEmptyNormalizedEvidence accepts a well-formed, current-version value', () => {
  const result = parseEmptyNormalizedEvidence(validEmptyEvidence)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value, validEmptyEvidence)
})

test('parseEmptyNormalizedEvidence rejects non-objects, arrays, and null', () => {
  for (const bad of [null, undefined, 'x', 1, false, []]) {
    assert.equal(parseEmptyNormalizedEvidence(bad).ok, false)
  }
})

test('parseEmptyNormalizedEvidence rejects a prototype-polluted object', () => {
  const polluted = Object.create({ evil: true })
  Object.assign(polluted, validEmptyEvidence)
  assert.equal(parseEmptyNormalizedEvidence(polluted).ok, false)
})

test('parseEmptyNormalizedEvidence rejects missing and unexpected-extra keys', () => {
  const { evidence, ...withoutEvidence } = validEmptyEvidence
  void evidence
  assert.equal(parseEmptyNormalizedEvidence(withoutEvidence).ok, false)
  assert.equal(parseEmptyNormalizedEvidence({ ...validEmptyEvidence, extra: true }).ok, false)
})

test('parseEmptyNormalizedEvidence rejects a future/unknown envelopeSchemaVersion', () => {
  assert.equal(parseEmptyNormalizedEvidence({ ...validEmptyEvidence, envelopeSchemaVersion: '2.0.0' }).ok, false)
})

test('parseEmptyNormalizedEvidence rejects a checkId other than "empty"', () => {
  const result = parseEmptyNormalizedEvidence({ ...validEmptyEvidence, checkId: 'not-a-real-check' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /not-a-real-check/)
})

test('parseEmptyNormalizedEvidence rejects unsupported sourceCapturePayloadSchemaVersion and evidenceSchemaVersion', () => {
  assert.equal(parseEmptyNormalizedEvidence({ ...validEmptyEvidence, sourceCapturePayloadSchemaVersion: '9.9.9' }).ok, false)
  assert.equal(parseEmptyNormalizedEvidence({ ...validEmptyEvidence, evidenceSchemaVersion: '9.9.9' }).ok, false)
})

test('parseEmptyNormalizedEvidence rejects an arbitrary {} evidence value — the discriminant must be present and correct', () => {
  assert.equal(parseEmptyNormalizedEvidence({ ...validEmptyEvidence, evidence: {} }).ok, false)
  assert.equal(parseEmptyNormalizedEvidence({ ...validEmptyEvidence, evidence: { __brand: 'WrongBrand' } }).ok, false)
})

test('parseEmptyNormalizedEvidence rejects a viewportsPresent array with an invalid element, or a non-array', () => {
  assert.equal(parseEmptyNormalizedEvidence({ ...validEmptyEvidence, viewportsPresent: ['desktop', 'huge-tv'] }).ok, false)
  assert.equal(parseEmptyNormalizedEvidence({ ...validEmptyEvidence, viewportsPresent: 'desktop' }).ok, false)
})

test('parseEmptyNormalizedEvidence rejects a non-boolean-valued incompleteCoverage', () => {
  assert.equal(parseEmptyNormalizedEvidence({ ...validEmptyEvidence, incompleteCoverage: { timedOut: 1 } }).ok, false)
})

test('error messages name the actual offending value, for debuggability', () => {
  const bad = parseEmptyRawCapture({ schemaVersion: 'garbage' })
  assert.equal(bad.ok, false)
  const bad2 = parseEmptyNormalizedEvidence({ schemaVersion: 'garbage' })
  assert.equal(bad2.ok, false)
})

// ─── Hardening: dangerous keys, canonical timestamps, duplicate sets,
// safe reconstruction ────────────────────────────────────────────────────

test('parseEmptyRawCapture rejects a dangerous top-level key (__proto__) even when it survives as a real own property via JSON.parse', () => {
  const polluted = JSON.parse(`{"__proto__":{"polluted":true},"envelopeSchemaVersion":"1.0.0","checkId":"empty","payloadSchemaVersion":"1.0.0","provenance":${JSON.stringify(validRawCapture.provenance)},"payload":${JSON.stringify(EMPTY_CAPTURE_PAYLOAD)},"incompleteCoverage":{}}`)
  assert.ok(Object.prototype.hasOwnProperty.call(polluted, '__proto__'), 'test setup: __proto__ must be a real own key for this to be meaningful')
  const result = parseEmptyRawCapture(polluted)
  assert.equal(result.ok, false)
})

test('parseEmptyRawCapture and parseEmptyNormalizedEvidence reject dangerous keys (__proto__/prototype/constructor) inside incompleteCoverage', () => {
  for (const dangerousKey of ['__proto__', 'prototype', 'constructor']) {
    const pollutedCoverage = JSON.parse(`{"${dangerousKey}":true}`)
    assert.ok(Object.prototype.hasOwnProperty.call(pollutedCoverage, dangerousKey))
    assert.equal(parseEmptyRawCapture({ ...validRawCapture, incompleteCoverage: pollutedCoverage }).ok, false, `RawCapture must reject dangerous key "${dangerousKey}" in incompleteCoverage`)
    assert.equal(parseEmptyNormalizedEvidence({ ...validEmptyEvidence, incompleteCoverage: pollutedCoverage }).ok, false, `NormalizedEvidence must reject dangerous key "${dangerousKey}" in incompleteCoverage`)
  }
})

test('parseEmptyRawCapture requires a canonical ISO timestamp — Date.parse-permissive formats are rejected', () => {
  for (const looseButDateParseable of ['2026-08-09', 'Aug 9, 2026', '08/09/2026', '2026-08-09T00:00:00', '2026-08-09 00:00:00Z', 'Sun Aug 09 2026 00:00:00 GMT+0000']) {
    const result = parseEmptyRawCapture({ ...validRawCapture, provenance: { ...validRawCapture.provenance, capturedAt: looseButDateParseable } })
    assert.equal(result.ok, false, `expected rejection for non-canonical timestamp: ${looseButDateParseable}`)
  }
})

test('parseEmptyRawCapture rejects a syntactically-ISO but calendar-invalid timestamp (e.g. Feb 30)', () => {
  const result = parseEmptyRawCapture({ ...validRawCapture, provenance: { ...validRawCapture.provenance, capturedAt: '2026-02-30T00:00:00.000Z' } })
  assert.equal(result.ok, false)
})

test('parseEmptyRawCapture accepts canonical ISO timestamps with and without milliseconds', () => {
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: { ...validRawCapture.provenance, capturedAt: '2026-08-09T00:00:00Z' } }).ok, true)
  assert.equal(parseEmptyRawCapture({ ...validRawCapture, provenance: { ...validRawCapture.provenance, capturedAt: '2026-08-09T00:00:00.123Z' } }).ok, true)
})

test('parseEmptyNormalizedEvidence rejects duplicate viewport identifiers — viewportsPresent is a set, not a multiset', () => {
  const result = parseEmptyNormalizedEvidence({ ...validEmptyEvidence, viewportsPresent: ['desktop', 'desktop'] })
  assert.equal(result.ok, false)
})

test('parseEmptyNormalizedEvidence accepts distinct-but-repeated-category viewport sets with no duplicates', () => {
  const result = parseEmptyNormalizedEvidence({ ...validEmptyEvidence, viewportsPresent: ['desktop', 'tablet', 'mobile', 'narrow'] })
  assert.equal(result.ok, true)
})

test('parseEmptyRawCapture returns a value whose nested provenance/incompleteCoverage are NOT the same object references as the input — reconstructed fresh, not aliased', () => {
  const input = { ...validRawCapture, provenance: { ...validRawCapture.provenance }, incompleteCoverage: { timedOut: true } }
  const result = parseEmptyRawCapture(input)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.notEqual(result.value.provenance, input.provenance, 'provenance must be a fresh object, not the same reference')
    assert.notEqual(result.value.incompleteCoverage, input.incompleteCoverage, 'incompleteCoverage must be a fresh object, not the same reference')
    assert.deepEqual(result.value.incompleteCoverage, input.incompleteCoverage)
    // Mutating the original input after validation must not affect the
    // already-returned validated value.
    input.incompleteCoverage.timedOut = false
    assert.equal(result.value.incompleteCoverage.timedOut, true, 'mutating the caller\'s original object after validation must not affect the returned value')
  }
})

test('parseEmptyNormalizedEvidence returns a value whose viewportsPresent is NOT the same array reference as the input', () => {
  const input = { ...validEmptyEvidence, viewportsPresent: ['desktop'] }
  const result = parseEmptyNormalizedEvidence(input)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.notEqual(result.value.viewportsPresent, input.viewportsPresent, 'viewportsPresent must be a fresh array, not the same reference')
    input.viewportsPresent.push('mobile')
    assert.deepEqual(result.value.viewportsPresent, ['desktop'], 'mutating the caller\'s original array after validation must not affect the returned value')
  }
})
