// Sub-patch 2c — BenchmarkFixture: the format the offline invariant/
// metamorphic framework exercises the pipeline against.
//
// Designed now, in its owning sub-patch, against the ACTUAL merged 2a/2b
// contracts — not the stale illustrative pseudocode Phase 5 explicitly
// deferred (patch.md: "each is designed when its owning sub-patch is
// actually implemented, not spoken for here with illustrative shapes that
// risk going stale").
//
// A "small shared type module" under src/lib/offline/invariants/, allowed
// per patch.md Phase 11 row 2c only because it's genuinely necessary: the
// fixture format needs a real type + a fail-closed runtime parser (used at
// the deserialized-fixture-file boundary, same as 2a's schemaValidation.ts
// at the RawCapture/NormalizedEvidence boundary), and duplicating that
// logic per-test-file would be exactly the kind of untyped, unminimized
// surface this project has repeatedly closed off elsewhere. Concrete
// proof of necessity: test/pipeline.benchmarkFixture.test.ts.
//
// Import boundary (architecture-dependency-map.md): src/lib/offline/* may
// import src/lib/pipeline/types/ only, never a pipeline implementation
// module (normalize/classify/present/audit). This file imports only
// pipeline/types/*.

import type { CheckId, CheckRegistry, CheckRegistryShape } from '../../pipeline/types/checkSpecification.js'
import type { RawCaptureFor, ViewportName } from '../../pipeline/types/rawCapture.js'
import type { NormalizedEvidenceFor } from '../../pipeline/types/normalizedEvidence.js'
import type { ClassificationResultFor, ClassificationOutcome, StandardsBasis } from '../../pipeline/types/classification.js'
import { parseEmptyRawCapture, parseEmptyNormalizedEvidence, type ValidationResult } from '../../pipeline/types/schemaValidation.js'

export const BENCHMARK_FIXTURE_SCHEMA_VERSION = '1.0.0' as const

/**
 * Correlation-preserving, exactly like RawCaptureFor/NormalizedEvidenceFor
 * (see checkSpecification.ts's header comment for why a plain generic
 * interface would reopen the union-correlation hole 2a fixed): a
 * distributive conditional type over the SAME registry, reusing
 * `RawCaptureFor`/`NormalizedEvidenceFor`/`ClassificationResultFor`
 * directly as field types rather than re-deriving them — a fixture's
 * `rawCaptures`/`expected` fields are bound to the SAME K as
 * `fixture.checkId`, so a fixture cannot claim check A's ID while holding
 * check B's captures or expected result, even through the all-check
 * union default.
 *
 * Deliberately minimal: only bounded synthetic RawCapture inputs and the
 * minimal expected normalized/classification result the registered check
 * needs — no screenshots, HTML, DOM, accessibility trees beyond what the
 * check's own registered payload/evidence types already declare (for
 * 'empty', that's nothing — see checkSpecification.ts).
 */
export type BenchmarkFixtureFor<Reg extends CheckRegistryShape<Reg>, K extends keyof Reg & string = keyof Reg & string> = K extends unknown
  ? {
      fixtureSchemaVersion: typeof BENCHMARK_FIXTURE_SCHEMA_VERSION
      /** Explicit, human-assigned identity — never a generated timestamp
       *  or random value; see requirement 6 in patch.md's 2c row. */
      fixtureId: string
      checkId: K
      rawCaptures: RawCaptureFor<Reg, K>[]
      expected: {
        normalizedEvidence: NormalizedEvidenceFor<Reg, K>
        classificationResult: ClassificationResultFor<Reg, K>
      }
    }
  : never

/** Production convenience alias, bound to the real `CheckRegistry`. */
export type BenchmarkFixture<K extends CheckId = CheckId> = BenchmarkFixtureFor<CheckRegistry, K>

/**
 * A migrated fixture: never mutates its source, always references it.
 * Proven with a test-only synthetic version transition
 * (test/pipeline.benchmarkFixture.test.ts) — no real migration exists yet
 * because no fixture has ever needed one; this type exists so the
 * mechanism itself is provably sound before it's needed for real.
 *
 * This type alone does not PROVE a meaningful source relationship — it's
 * just a shape, constructible with any strings. `createMigratedBenchmarkFixture`
 * below is the validated constructor; prefer it over building this object
 * literal directly.
 */
export interface MigratedBenchmarkFixture<K extends CheckId = CheckId> {
  fixture: BenchmarkFixture<K>
  migratedFrom: { fixtureId: string; fixtureSchemaVersion: string }
}

// ─── Migration constructor/validator ───────────────────────────────────────

export type MigrationValidationFailure =
  | { kind: 'blank-source-fixture-id' }
  | { kind: 'blank-source-fixture-schema-version' }
  | { kind: 'migration-references-same-fixture-id-and-version-as-output' }
  | { kind: 'migrated-fixture-shares-reference-with-source' }

export type MigrationResult<K extends CheckId = CheckId> = { ok: true; value: MigratedBenchmarkFixture<K> } | { ok: false; error: MigrationValidationFailure }

/**
 * Recursively checks whether any nested value in `a` is the SAME object
 * reference as the value at the corresponding path in `b` — a deep
 * reference-identity scan, not a value-equality check (two independently
 * constructed objects with identical content are NOT flagged; only actual
 * shared mutable state is).
 */
function sharesReference(a: unknown, b: unknown): boolean {
  if (a === b && typeof a === 'object' && a !== null) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.some((av, i) => sharesReference(av, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    return Object.keys(a).some((k) => sharesReference(a[k], b[k]))
  }
  return false
}

/**
 * The smallest validated constructor for a `MigratedBenchmarkFixture`:
 * rejects a blank source fixture ID/version, a migration that claims to
 * have produced a fixture identical (by ID+version) to its own claimed
 * source, and a migrated fixture that reuses any nested object reference
 * from the source (mutation of one could then silently corrupt the
 * other). On success, returns a fully reconstructed value — the migrated
 * fixture is deep-cloned, never the caller's own reference — so no
 * accidental reference sharing can be introduced after this point either.
 *
 * Deliberately does not validate that `migratedFixture`'s CONTENT is a
 * faithful transformation of `source`'s content — that's the concern of
 * whatever real migration logic exists (none does yet); this constructor
 * only proves the mechanism's structural/reference-safety invariants.
 */
export function createMigratedBenchmarkFixture<K extends CheckId>(source: BenchmarkFixture<K>, migratedFixture: BenchmarkFixture<K>): MigrationResult<K> {
  if (typeof source.fixtureId !== 'string' || source.fixtureId.trim().length === 0) {
    return { ok: false, error: { kind: 'blank-source-fixture-id' } }
  }
  if (typeof source.fixtureSchemaVersion !== 'string' || source.fixtureSchemaVersion.trim().length === 0) {
    return { ok: false, error: { kind: 'blank-source-fixture-schema-version' } }
  }
  if (migratedFixture.fixtureId === source.fixtureId && migratedFixture.fixtureSchemaVersion === source.fixtureSchemaVersion) {
    return { ok: false, error: { kind: 'migration-references-same-fixture-id-and-version-as-output' } }
  }
  if (sharesReference(migratedFixture, source)) {
    return { ok: false, error: { kind: 'migrated-fixture-shares-reference-with-source' } }
  }
  return {
    ok: true,
    value: {
      fixture: structuredClone(migratedFixture),
      migratedFrom: { fixtureId: source.fixtureId, fixtureSchemaVersion: source.fixtureSchemaVersion },
    },
  }
}

// ─── Canonical ordering / comparison (requirement 10) ─────────────────────

/**
 * Duplicated intentionally, not imported: `evidenceNormalizer.ts` (which
 * defines the canonical order too) is a pipeline IMPLEMENTATION module,
 * and src/lib/offline/* may never import those directly (architecture-
 * dependency-map.md) — only src/lib/pipeline/types/. A 4-entry literal
 * array is a small, well-justified duplication against that boundary, not
 * a maintenance burden.
 */
const CANONICAL_VIEWPORT_ORDER: readonly ViewportName[] = ['desktop', 'tablet', 'mobile', 'narrow']

function canonicalViewportCompare(a: ViewportName, b: ViewportName): number {
  return CANONICAL_VIEWPORT_ORDER.indexOf(a) - CANONICAL_VIEWPORT_ORDER.indexOf(b)
}

/** Fresh object, keys inserted in sorted order — two records with the same
 *  entries but different insertion order produce identical `JSON.stringify`
 *  output after this. */
function sortRecordKeys<V>(record: Readonly<Record<string, V>>): Record<string, V> {
  const out: Record<string, V> = {}
  for (const key of Object.keys(record).sort()) out[key] = record[key]
  return out
}

/**
 * Canonicalizes a single capture: its `incompleteCoverage` record's key
 * order (not semantically meaningful), and a deep clone of `payload`.
 *
 * The deep clone matters generically, not just for 'empty': this function
 * is generic over `K`, so a FUTURE registered check's `capturePayload`
 * could be an arbitrary mutable nested object — for 'empty' specifically,
 * `payload` is always the frozen `EMPTY_CAPTURE_PAYLOAD` singleton, so
 * cloning it is a no-op in practice today, but the function's own
 * documented promise ("no nested object is shared by reference with the
 * input") must hold for whatever payload shape a real check eventually
 * registers, not merely for the one payload shape that happens to be
 * frozen right now. `structuredClone` makes no assumption about the
 * payload's internal shape.
 */
function canonicalizeRawCapture<K extends CheckId>(capture: RawCaptureFor<CheckRegistry, K>): RawCaptureFor<CheckRegistry, K> {
  return {
    ...capture,
    provenance: { ...capture.provenance, viewport: { ...capture.provenance.viewport } },
    payload: structuredClone(capture.payload),
    incompleteCoverage: sortRecordKeys(capture.incompleteCoverage),
  }
}

/**
 * Canonical comparison operates on already-PARSED (reconstructed) fixture
 * values, whose field order is fixed by `parseEmptyBenchmarkFixture`
 * regardless of the original input's key order — combined with sorting
 * `rawCaptures` by canonical viewport order (and each capture's own
 * `incompleteCoverage` by key) here, two logically-equivalent fixtures
 * produce identical serialized output regardless of how their original
 * source ordered object keys or capture entries.
 */
function canonicalizeRawCaptureOrder<K extends CheckId>(captures: readonly RawCaptureFor<CheckRegistry, K>[]): RawCaptureFor<CheckRegistry, K>[] {
  return captures.map(canonicalizeRawCapture).sort((a, b) => canonicalViewportCompare(a.provenance.viewport.name, b.provenance.viewport.name))
}

/**
 * Canonicalizes the expected `NormalizedEvidence`: `viewportsPresent`
 * sorted to canonical viewport order, `incompleteCoverage` sorted by key,
 * and a deep clone of `evidence` itself. As with `payload` above, cloning
 * `evidence` is a no-op today (the frozen `EMPTY_CHECK_EVIDENCE`
 * singleton, for 'empty') but is required for this generic function's
 * promise to hold once a real check registers mutable nested evidence.
 */
function canonicalizeNormalizedEvidence<K extends CheckId>(normalizedEvidence: NormalizedEvidenceFor<CheckRegistry, K>): NormalizedEvidenceFor<CheckRegistry, K> {
  return {
    ...normalizedEvidence,
    evidence: structuredClone(normalizedEvidence.evidence),
    viewportsPresent: [...normalizedEvidence.viewportsPresent].sort(canonicalViewportCompare),
    incompleteCoverage: sortRecordKeys(normalizedEvidence.incompleteCoverage),
  }
}

/** Canonicalizes the expected `ClassificationResult`: `evidenceRefs`
 *  sorted (a `never[]` for 'empty', but sorted generically in case a
 *  future check registers real audit-field keys here), and a fresh
 *  `standardsBasis` reconstruction so no source reference is retained. */
function canonicalizeClassificationResult<K extends CheckId>(result: ClassificationResultFor<CheckRegistry, K>): ClassificationResultFor<CheckRegistry, K> {
  return {
    ...result,
    evidenceRefs: [...result.evidenceRefs].sort(),
    standardsBasis: result.standardsBasis.type === 'standard' ? { type: 'standard', citation: result.standardsBasis.citation } : { type: 'product-policy', rationale: result.standardsBasis.rationale },
  }
}

/**
 * Canonicalizes the ENTIRE fixture, not merely `rawCaptures`'s order —
 * every nested record/array field whose order isn't semantically
 * meaningful is normalized too (raw-capture order and each capture's
 * `incompleteCoverage`; the expected evidence's `viewportsPresent` and
 * `incompleteCoverage`; the expected classification's `evidenceRefs`), and
 * every nested payload/evidence object is deep-cloned via `structuredClone`
 * regardless of its internal shape. Returns a fully reconstructed fixture
 * at every level — no nested object is shared by reference with `fixture`,
 * a promise this generic function honors for whatever payload/evidence
 * shape a future registered check uses, not only for 'empty's frozen
 * sentinels (which happen to make cloning a practical no-op today, but
 * were never the reason the guarantee holds). Calling this twice on the
 * same input produces two independent object graphs: mutating one can
 * never affect the other, proven directly against a synthetic
 * mutable-payload registry, not merely against 'empty's frozen shapes
 * (`test/pipeline.benchmarkFixture.test.ts`).
 */
export function canonicalizeFixture<K extends CheckId>(fixture: BenchmarkFixture<K>): BenchmarkFixture<K> {
  return {
    ...fixture,
    rawCaptures: canonicalizeRawCaptureOrder(fixture.rawCaptures),
    expected: {
      normalizedEvidence: canonicalizeNormalizedEvidence(fixture.expected.normalizedEvidence),
      classificationResult: canonicalizeClassificationResult(fixture.expected.classificationResult),
    },
  }
}

export function fixturesAreEquivalent(a: BenchmarkFixture<'empty'>, b: BenchmarkFixture<'empty'>): boolean {
  return JSON.stringify(canonicalizeFixture(a)) === JSON.stringify(canonicalizeFixture(b))
}

// ─── Runtime validation (requirements 7, 8, 9) ─────────────────────────────

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false
  const proto = Object.getPrototypeOf(x)
  return proto === Object.prototype || proto === null
}

function hasExactKeys(x: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(x)
  if (actual.length !== keys.length) return false
  return keys.every((k) => actual.includes(k))
}

const DANGEROUS_RECORD_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
function hasNoDangerousKeys(x: Record<string, unknown>): boolean {
  return Object.keys(x).every((k) => !DANGEROUS_RECORD_KEYS.has(k))
}

const CLASSIFICATION_OUTCOMES: readonly ClassificationOutcome[] = ['good', 'improve', 'manual-review-advisory', 'unverified']
function isClassificationOutcome(x: unknown): x is ClassificationOutcome {
  return typeof x === 'string' && (CLASSIFICATION_OUTCOMES as readonly string[]).includes(x)
}

function isStandardsBasis(x: unknown): x is StandardsBasis {
  if (!isPlainObject(x)) return false
  if (x.type === 'standard') return hasExactKeys(x, ['type', 'citation']) && typeof x.citation === 'string' && x.citation.length > 0
  if (x.type === 'product-policy') return hasExactKeys(x, ['type', 'rationale']) && typeof x.rationale === 'string' && x.rationale.length > 0
  return false
}

/**
 * No runtime parser for `ClassificationResult` existed before 2c — 2a/2b
 * never needed one (a `ClassificationResult` was always produced
 * in-process by `classifyEmpty`, never deserialized). A fixture file IS
 * untrusted/deserialized input, so this is a genuinely new boundary, not a
 * duplicate of an existing parser.
 */
function parseEmptyClassificationResultValue(x: unknown): ValidationResult<ClassificationResultFor<CheckRegistry, 'empty'>> {
  if (!isPlainObject(x)) return { ok: false, error: 'classificationResult is not a plain object' }
  if (!hasNoDangerousKeys(x)) return { ok: false, error: 'classificationResult contains a dangerous key' }
  if (!hasExactKeys(x, ['checkId', 'contractVersion', 'outcome', 'standardsBasis', 'evidenceRefs', 'reasoning'])) {
    return { ok: false, error: `classificationResult has unexpected or missing keys: ${JSON.stringify(Object.keys(x))}` }
  }
  if (x.checkId !== 'empty') return { ok: false, error: `unsupported/unregistered checkId: ${JSON.stringify(x.checkId)}` }
  if (x.contractVersion !== '1.0.0') return { ok: false, error: `unsupported contractVersion: ${JSON.stringify(x.contractVersion)}` }
  // The trivial 'empty' contract's classifier only ever produces
  // 'unverified' (classificationEngine.ts) — a fixture claiming any other
  // outcome for 'empty' does not describe a value the real classifier can
  // produce, so it is rejected here, not merely "any valid outcome".
  if (x.outcome !== 'unverified') return { ok: false, error: `outcome must be 'unverified' for the empty scaffold, got: ${JSON.stringify(x.outcome)}` }
  if (!isClassificationOutcome(x.outcome)) return { ok: false, error: 'invalid outcome enum value' }
  if (!isStandardsBasis(x.standardsBasis)) return { ok: false, error: 'invalid standardsBasis' }
  // 'empty' registers Record<never, never> audit fields, so evidenceRefs
  // is typed never[] — the only valid runtime value is an empty array.
  if (!Array.isArray(x.evidenceRefs) || x.evidenceRefs.length !== 0) return { ok: false, error: 'evidenceRefs must be an empty array for the empty scaffold' }
  if (typeof x.reasoning !== 'string' || x.reasoning.length === 0) return { ok: false, error: 'reasoning must be a non-empty string' }

  return {
    ok: true,
    value: {
      checkId: 'empty',
      contractVersion: '1.0.0',
      outcome: 'unverified',
      standardsBasis: x.standardsBasis.type === 'standard' ? { type: 'standard', citation: x.standardsBasis.citation } : { type: 'product-policy', rationale: x.standardsBasis.rationale },
      evidenceRefs: [],
      reasoning: x.reasoning,
    },
  }
}

export type BenchmarkFixtureValidationFailure =
  | { kind: 'not-a-plain-object' }
  | { kind: 'unexpected-or-missing-keys'; keys: string[] }
  | { kind: 'dangerous-key' }
  | { kind: 'unsupported-fixture-schema-version'; version: unknown }
  | { kind: 'blank-fixture-id' }
  | { kind: 'unregistered-check-id'; checkId: unknown }
  | { kind: 'raw-captures-not-an-array' }
  | { kind: 'invalid-raw-capture-at-index'; index: number; error: string }
  | { kind: 'empty-raw-captures' }
  | { kind: 'duplicate-viewport-across-raw-captures'; viewportName: ViewportName }
  | { kind: 'invalid-expected-object' }
  | { kind: 'invalid-expected-normalized-evidence'; error: string }
  | { kind: 'invalid-expected-classification-result'; error: string }

export type BenchmarkFixtureResult = { ok: true; value: BenchmarkFixture<'empty'> } | { ok: false; error: BenchmarkFixtureValidationFailure }

/**
 * Milestone 2 registers exactly one check ('empty'), so this parser is
 * specific to it — matching 2a's own `parseEmptyRawCapture`/
 * `parseEmptyNormalizedEvidence` precedent (specific parsers per
 * registered check, not a generic-over-CheckId one, since a generic
 * parser would need a per-check payload validator supplied by whichever
 * check registers itself — which doesn't exist until Milestone 3+).
 *
 * Rejects (fail-closed, typed result, never throws): unknown/missing top-
 * level keys, dangerous keys, unsupported fixture schema version, a blank
 * fixture ID, an unregistered checkId, a malformed rawCaptures array (each
 * entry independently re-validated via 2a's own `parseEmptyRawCapture`),
 * an EMPTY rawCaptures array, a duplicate viewport name across the whole
 * `rawCaptures` array, and a malformed `expected` object.
 *
 * The empty-collection and duplicate-viewport checks are enforced HERE,
 * at the fixture-parsing boundary — not deferred to a later call into the
 * Evidence Normalizer. `normalizeEmptyEvidence` (2b) independently
 * re-checks both as defense-in-depth (it must, since it accepts
 * `RawCapture[]` from callers other than this parser too), but a fixture
 * that already fails either check is invalid on its own terms and must
 * never be reported as successfully parsed.
 */
export function parseEmptyBenchmarkFixture(x: unknown): BenchmarkFixtureResult {
  if (!isPlainObject(x)) return { ok: false, error: { kind: 'not-a-plain-object' } }
  if (!hasNoDangerousKeys(x)) return { ok: false, error: { kind: 'dangerous-key' } }
  if (!hasExactKeys(x, ['fixtureSchemaVersion', 'fixtureId', 'checkId', 'rawCaptures', 'expected'])) {
    return { ok: false, error: { kind: 'unexpected-or-missing-keys', keys: Object.keys(x) } }
  }
  if (x.fixtureSchemaVersion !== BENCHMARK_FIXTURE_SCHEMA_VERSION) {
    return { ok: false, error: { kind: 'unsupported-fixture-schema-version', version: x.fixtureSchemaVersion } }
  }
  if (typeof x.fixtureId !== 'string' || x.fixtureId.trim().length === 0) {
    return { ok: false, error: { kind: 'blank-fixture-id' } }
  }
  if (x.checkId !== 'empty') {
    return { ok: false, error: { kind: 'unregistered-check-id', checkId: x.checkId } }
  }
  if (!Array.isArray(x.rawCaptures)) {
    return { ok: false, error: { kind: 'raw-captures-not-an-array' } }
  }
  const parsedCaptures: RawCaptureFor<CheckRegistry, 'empty'>[] = []
  for (let i = 0; i < x.rawCaptures.length; i++) {
    const parsed = parseEmptyRawCapture(x.rawCaptures[i])
    if (!parsed.ok) return { ok: false, error: { kind: 'invalid-raw-capture-at-index', index: i, error: parsed.error } }
    parsedCaptures.push(parsed.value)
  }
  if (parsedCaptures.length === 0) {
    return { ok: false, error: { kind: 'empty-raw-captures' } }
  }
  const seenViewports = new Set<ViewportName>()
  for (const capture of parsedCaptures) {
    const viewportName = capture.provenance.viewport.name
    if (seenViewports.has(viewportName)) {
      return { ok: false, error: { kind: 'duplicate-viewport-across-raw-captures', viewportName } }
    }
    seenViewports.add(viewportName)
  }
  if (!isPlainObject(x.expected) || !hasExactKeys(x.expected, ['normalizedEvidence', 'classificationResult'])) {
    return { ok: false, error: { kind: 'invalid-expected-object' } }
  }
  const parsedNormalizedEvidence = parseEmptyNormalizedEvidence(x.expected.normalizedEvidence)
  if (!parsedNormalizedEvidence.ok) return { ok: false, error: { kind: 'invalid-expected-normalized-evidence', error: parsedNormalizedEvidence.error } }
  const parsedClassificationResult = parseEmptyClassificationResultValue(x.expected.classificationResult)
  if (!parsedClassificationResult.ok) return { ok: false, error: { kind: 'invalid-expected-classification-result', error: parsedClassificationResult.error } }

  return {
    ok: true,
    value: {
      fixtureSchemaVersion: BENCHMARK_FIXTURE_SCHEMA_VERSION,
      fixtureId: x.fixtureId,
      checkId: 'empty',
      rawCaptures: parsedCaptures,
      expected: {
        normalizedEvidence: parsedNormalizedEvidence.value,
        classificationResult: parsedClassificationResult.value,
      },
    },
  }
}
