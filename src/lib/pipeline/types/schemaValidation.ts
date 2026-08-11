// Sub-patch 2a — runtime schema validation at untrusted/deserialized
// boundaries (e.g. a value that crossed a process/serialization boundary,
// where TypeScript's compile-time guarantees no longer apply).
//
// Every parser validates the COMPLETE claimed shape: exact version
// literals, exact checkId, the branded discriminant, enum values, finite
// numeric ranges, array element shapes (including duplicate rejection
// where the contract expects a set), record value types, dangerous-key
// rejection, and rejects any unexpected key or non-plain (prototype-
// polluted) object. Returned validated values are RECONSTRUCTED into fresh
// plain objects field-by-field — never the caller's own nested objects
// returned by reference — so nothing attacker-controlled (an unusual
// prototype, a later in-place mutation of the original reference) survives
// into the result.
//
// `finalUrl` is validated here SYNTACTICALLY ONLY (non-empty string) —
// this module makes no claim that it is safe to navigate to or otherwise
// network-safe. That authorization is sub-patch 2d's unsolved design-spike
// scope (see threat-model.md); nothing here should be read as satisfying
// it.
//
// No schema-validation dependency (zod/yup/ajv/etc.) exists in this
// codebase, and none is added here — hand-written, matching the existing
// style of src/lib/urlSafety.ts.
//
// No exported function here returns a `x is SomeStrongType` predicate for
// a value this module cannot fully validate; only `ValidationResult<T>` is
// exported. Several PRIVATE helpers do use `x is T` — each one fully
// validates the complete narrow shape it claims, not a partial check.

import { RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, type CaptureProvenance, type RawCapture, type Viewport, type ViewportName } from './rawCapture.js'
import { NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION, type NormalizedEvidence } from './normalizedEvidence.js'
import { EMPTY_CAPTURE_PAYLOAD, EMPTY_CHECK_EVIDENCE } from './checkSpecification.js'

const VIEWPORT_NAMES: readonly ViewportName[] = ['desktop', 'tablet', 'mobile', 'narrow']

/** Keys that, if present as OWN enumerable properties on an object
 *  deserialized from untrusted input (e.g. via `JSON.parse`), could pollute
 *  a prototype if that object or its values are later copied/merged
 *  elsewhere. Rejected outright wherever an arbitrary-key record is
 *  accepted. */
const DANGEROUS_RECORD_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

/** A canonical `Date.toISOString()`-shaped timestamp — not "any string
 *  `Date.parse` happens to understand" (which also accepts many loose,
 *  ambiguous, or locale-dependent formats). */
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/

/** Rejects non-objects, arrays, null, AND prototype-polluted objects (only
 *  a plain `{}`/`Object.create(null)` prototype chain is accepted). */
function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false
  const proto = Object.getPrototypeOf(x)
  return proto === Object.prototype || proto === null
}

/** Rejects any object with missing OR unexpected keys — an exact-schema
 *  check, not a partial/lenient one. */
function hasExactKeys(x: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(x)
  if (actual.length !== keys.length) return false
  return keys.every((k) => actual.includes(k))
}

function hasNoDangerousKeys(x: Record<string, unknown>): boolean {
  return Object.keys(x).every((k) => !DANGEROUS_RECORD_KEYS.has(k))
}

function isFinitePositiveNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x > 0
}

function isViewportName(x: unknown): x is ViewportName {
  return typeof x === 'string' && (VIEWPORT_NAMES as readonly string[]).includes(x)
}

function isViewport(x: unknown): x is Viewport {
  if (!isPlainObject(x)) return false
  if (!hasExactKeys(x, ['name', 'width', 'height'])) return false
  if (!isViewportName(x.name)) return false
  if (!isFinitePositiveNumber(x.width)) return false
  if (!isFinitePositiveNumber(x.height)) return false
  return true
}

/** Canonical ISO 8601 UTC form only (`YYYY-MM-DDTHH:mm:ss[.sss]Z`), and
 *  the parsed value must round-trip to a real calendar date/time (rejects
 *  e.g. "2026-02-30..." which matches the pattern but isn't a real date). */
function isCanonicalIsoTimestamp(x: unknown): x is string {
  if (typeof x !== 'string' || !ISO_TIMESTAMP_PATTERN.test(x)) return false
  const ms = Date.parse(x)
  return !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(x.slice(0, 19))
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0
}

function isCaptureProvenance(x: unknown): x is CaptureProvenance {
  if (!isPlainObject(x)) return false
  if (!hasExactKeys(x, ['capturedAt', 'viewport', 'finalUrl'])) return false
  if (!isCanonicalIsoTimestamp(x.capturedAt)) return false
  if (!isViewport(x.viewport)) return false
  // finalUrl: syntactic check only (non-empty string) — see file header.
  if (!isNonEmptyString(x.finalUrl)) return false
  return true
}

function isBooleanRecord(x: unknown): x is Record<string, boolean> {
  if (!isPlainObject(x)) return false
  if (!hasNoDangerousKeys(x)) return false
  return Object.values(x).every((v) => typeof v === 'boolean')
}

/** Exact discriminant check: `{}` alone does NOT satisfy this — the
 *  `__brand` literal must be present and correct. */
function isEmptyCapturePayload(x: unknown): boolean {
  if (!isPlainObject(x)) return false
  if (!hasExactKeys(x, ['__brand'])) return false
  return x.__brand === EMPTY_CAPTURE_PAYLOAD.__brand
}

function isEmptyCheckEvidence(x: unknown): boolean {
  if (!isPlainObject(x)) return false
  if (!hasExactKeys(x, ['__brand'])) return false
  return x.__brand === EMPTY_CHECK_EVIDENCE.__brand
}

/** No duplicate elements — `viewportsPresent` is conceptually a SET of
 *  which viewports contributed, not an ordered multiset. */
function isViewportNameSet(x: unknown): x is ViewportName[] {
  if (!Array.isArray(x) || !x.every(isViewportName)) return false
  return new Set(x).size === x.length
}

/** Rebuilds a fresh, safe copy — never the caller's own object reference —
 *  once validated. */
function toSafeBooleanRecord(x: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(x)) out[k] = v
  return out
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Milestone 2 registers exactly one capture-check-id ('empty'), so this
 * parser is specific to it rather than generic over CheckId — a generic
 * parser would need a per-check payload validator supplied by whichever
 * check registers itself, which does not exist until a real check
 * migrates (Milestone 3+).
 */
export function parseEmptyRawCapture(x: unknown): ValidationResult<RawCapture<'empty'>> {
  if (!isPlainObject(x)) return { ok: false, error: 'not a plain object' }
  if (!hasNoDangerousKeys(x)) return { ok: false, error: 'contains a dangerous key (__proto__/prototype/constructor)' }
  if (!hasExactKeys(x, ['envelopeSchemaVersion', 'checkId', 'payloadSchemaVersion', 'provenance', 'payload', 'incompleteCoverage'])) {
    return { ok: false, error: `unexpected or missing keys: ${JSON.stringify(Object.keys(x))}` }
  }
  if (x.envelopeSchemaVersion !== RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION) {
    return { ok: false, error: `unsupported envelopeSchemaVersion: ${JSON.stringify(x.envelopeSchemaVersion)}` }
  }
  if (x.checkId !== 'empty') {
    return { ok: false, error: `unsupported/unregistered checkId: ${JSON.stringify(x.checkId)}` }
  }
  if (x.payloadSchemaVersion !== '1.0.0') {
    return { ok: false, error: `unsupported payloadSchemaVersion: ${JSON.stringify(x.payloadSchemaVersion)}` }
  }
  if (!isCaptureProvenance(x.provenance)) {
    return { ok: false, error: 'provenance is missing, malformed, or has unexpected keys' }
  }
  if (!isEmptyCapturePayload(x.payload)) {
    return { ok: false, error: 'payload does not match the registered empty capture-payload schema' }
  }
  if (!isBooleanRecord(x.incompleteCoverage)) {
    return { ok: false, error: 'incompleteCoverage is not a Record<string, boolean>, or contains a dangerous key' }
  }

  const provenance = x.provenance
  return {
    ok: true,
    value: {
      envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION,
      checkId: 'empty',
      payloadSchemaVersion: '1.0.0',
      provenance: {
        capturedAt: provenance.capturedAt,
        viewport: { name: provenance.viewport.name, width: provenance.viewport.width, height: provenance.viewport.height },
        finalUrl: provenance.finalUrl,
      },
      payload: EMPTY_CAPTURE_PAYLOAD,
      incompleteCoverage: toSafeBooleanRecord(x.incompleteCoverage),
    },
  }
}

export function parseEmptyNormalizedEvidence(x: unknown): ValidationResult<NormalizedEvidence<'empty'>> {
  if (!isPlainObject(x)) return { ok: false, error: 'not a plain object' }
  if (!hasNoDangerousKeys(x)) return { ok: false, error: 'contains a dangerous key (__proto__/prototype/constructor)' }
  if (
    !hasExactKeys(x, [
      'envelopeSchemaVersion',
      'checkId',
      'sourceCapturePayloadSchemaVersion',
      'evidenceSchemaVersion',
      'evidence',
      'viewportsPresent',
      'incompleteCoverage',
    ])
  ) {
    return { ok: false, error: `unexpected or missing keys: ${JSON.stringify(Object.keys(x))}` }
  }
  if (x.envelopeSchemaVersion !== NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION) {
    return { ok: false, error: `unsupported envelopeSchemaVersion: ${JSON.stringify(x.envelopeSchemaVersion)}` }
  }
  if (x.checkId !== 'empty') {
    return { ok: false, error: `unsupported/unregistered checkId: ${JSON.stringify(x.checkId)}` }
  }
  if (x.sourceCapturePayloadSchemaVersion !== '1.0.0') {
    return { ok: false, error: `unsupported sourceCapturePayloadSchemaVersion: ${JSON.stringify(x.sourceCapturePayloadSchemaVersion)}` }
  }
  if (x.evidenceSchemaVersion !== '1.0.0') {
    return { ok: false, error: `unsupported evidenceSchemaVersion: ${JSON.stringify(x.evidenceSchemaVersion)}` }
  }
  if (!isEmptyCheckEvidence(x.evidence)) {
    return { ok: false, error: 'evidence does not match the registered empty evidence schema' }
  }
  if (!isViewportNameSet(x.viewportsPresent)) {
    return { ok: false, error: 'viewportsPresent is not a duplicate-free array of valid ViewportName values' }
  }
  if (!isBooleanRecord(x.incompleteCoverage)) {
    return { ok: false, error: 'incompleteCoverage is not a Record<string, boolean>, or contains a dangerous key' }
  }

  return {
    ok: true,
    value: {
      envelopeSchemaVersion: NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION,
      checkId: 'empty',
      sourceCapturePayloadSchemaVersion: '1.0.0',
      evidenceSchemaVersion: '1.0.0',
      evidence: EMPTY_CHECK_EVIDENCE,
      viewportsPresent: [...x.viewportsPresent],
      incompleteCoverage: toSafeBooleanRecord(x.incompleteCoverage),
    },
  }
}
