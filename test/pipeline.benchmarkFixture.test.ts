// Sub-patch 2c — BenchmarkFixture format tests: parsing, correlation,
// canonicalization, immutability, and the migration mechanism. No
// browser, no network — the fixture file is read from local disk only.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  parseEmptyBenchmarkFixture,
  canonicalizeFixture,
  fixturesAreEquivalent,
  createMigratedBenchmarkFixture,
  BENCHMARK_FIXTURE_SCHEMA_VERSION,
  type BenchmarkFixture,
} from '../src/lib/offline/invariants/benchmarkFixture.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const FIXTURE_PATH = path.join(ROOT, 'test/fixtures/visual-checker/benchmark/empty-scaffold.v1.json')

async function loadRawFixtureJson(): Promise<unknown> {
  return JSON.parse(await readFile(FIXTURE_PATH, 'utf8'))
}

// ─── 1. Valid synthetic empty fixture parsing ──────────────────────────

test('valid synthetic empty fixture parses successfully', async () => {
  const raw = await loadRawFixtureJson()
  const result = parseEmptyBenchmarkFixture(raw)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.checkId, 'empty')
    assert.equal(result.value.fixtureSchemaVersion, BENCHMARK_FIXTURE_SCHEMA_VERSION)
    assert.equal(result.value.rawCaptures.length, 2)
    assert.equal(result.value.expected.classificationResult.outcome, 'unverified')
  }
})

// ─── Expectation integrity: the checked-in fixture's `expected` values are
// exercised end-to-end against the REAL integrated normalizer, contract
// registry, and classifier — not merely hand-typed literals that could
// silently drift from actual pipeline behavior. This test file (unlike
// benchmarkFixture.ts itself) is free to import pipeline implementation
// modules directly. ──────────────────────────────────────────────────────

test('the checked-in empty-scaffold fixture\'s expected normalizedEvidence and classificationResult exactly match what the real pipeline actually produces from its rawCaptures', async () => {
  const { normalizeEmptyEvidence } = await import('../src/lib/pipeline/normalize/evidenceNormalizer.ts')
  const { classifyEmpty } = await import('../src/lib/pipeline/classify/classificationEngine.ts')
  const { getEmptyContract } = await import('../src/lib/pipeline/classify/contractRegistry.ts')

  const raw = await loadRawFixtureJson()
  const parsed = parseEmptyBenchmarkFixture(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return

  const actualNormalized = normalizeEmptyEvidence(parsed.value.rawCaptures)
  assert.equal(actualNormalized.ok, true, 'the fixture\'s own rawCaptures must actually normalize successfully')
  if (!actualNormalized.ok) return
  assert.deepEqual(actualNormalized.value, parsed.value.expected.normalizedEvidence, 'the fixture\'s expected.normalizedEvidence must exactly match what normalizeEmptyEvidence actually produces — if this ever fails, the checked-in fixture has drifted from real pipeline behavior')

  const actualClassification = classifyEmpty({ evidence: actualNormalized.value, contract: getEmptyContract() })
  assert.deepEqual(actualClassification, parsed.value.expected.classificationResult, 'the fixture\'s expected.classificationResult must exactly match what classifyEmpty actually produces — if this ever fails, the checked-in fixture has drifted from real pipeline behavior')
})

// ─── 2. Exact-key enforcement and unknown-key rejection ────────────────

test('rejects an unknown top-level key', async () => {
  const raw = (await loadRawFixtureJson()) as Record<string, unknown>
  const result = parseEmptyBenchmarkFixture({ ...raw, extraField: 'not allowed' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'unexpected-or-missing-keys')
})

test('rejects a missing top-level key', async () => {
  const raw = (await loadRawFixtureJson()) as Record<string, unknown>
  const { expected, ...withoutExpected } = raw
  void expected
  const result = parseEmptyBenchmarkFixture(withoutExpected)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'unexpected-or-missing-keys')
})

// ─── 3. Dangerous-key/prototype-pollution rejection using real own
// properties ─────────────────────────────────────────────────────────

test('rejects a dangerous top-level key (__proto__) surviving as a real own property via JSON.parse', async () => {
  const raw = await loadRawFixtureJson()
  // JSON.stringify(raw) is `{"fixtureSchemaVersion":...}`; slicing off the
  // leading `{` and prepending our own `"__proto__":...,` produces valid
  // JSON whose __proto__ key becomes a REAL own property when parsed (the
  // JSON.parse literal-key path never triggers Object.prototype's own
  // __proto__ accessor) — the same realistic threat model 2a's own
  // schemaValidation tests use.
  const polluted = JSON.parse(`{"__proto__":{"polluted":true},${JSON.stringify(raw).slice(1)}`)
  assert.ok(Object.prototype.hasOwnProperty.call(polluted, '__proto__'), 'test setup: __proto__ must be a real own key')
  const result = parseEmptyBenchmarkFixture(polluted)
  assert.equal(result.ok, false)
})

test('rejects a prototype-polluted (non-plain) object outright', async () => {
  const raw = await loadRawFixtureJson()
  const polluted = Object.create({ evil: true })
  Object.assign(polluted, raw)
  const result = parseEmptyBenchmarkFixture(polluted)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'not-a-plain-object')
})

// ─── 4. Unsupported fixture/schema/contract version rejection ─────────

test('rejects an unsupported fixtureSchemaVersion', async () => {
  const raw = (await loadRawFixtureJson()) as Record<string, unknown>
  const result = parseEmptyBenchmarkFixture({ ...raw, fixtureSchemaVersion: '9.9.9' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'unsupported-fixture-schema-version')
})

test('rejects an unsupported classificationResult.contractVersion inside expected', async () => {
  const raw = (await loadRawFixtureJson()) as { expected: { classificationResult: Record<string, unknown> } }
  const bad = { ...raw, expected: { ...raw.expected, classificationResult: { ...raw.expected.classificationResult, contractVersion: '9.9.9' } } }
  const result = parseEmptyBenchmarkFixture(bad)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'invalid-expected-classification-result')
})

test('rejects an unsupported evidenceSchemaVersion inside expected.normalizedEvidence', async () => {
  const raw = (await loadRawFixtureJson()) as { expected: { normalizedEvidence: Record<string, unknown> } }
  const bad = { ...raw, expected: { ...raw.expected, normalizedEvidence: { ...raw.expected.normalizedEvidence, evidenceSchemaVersion: '9.9.9' } } }
  const result = parseEmptyBenchmarkFixture(bad)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'invalid-expected-normalized-evidence')
})

// ─── 5. Cross-check and mismatched-version rejection (runtime side; the
// compile-time side is __compileTimeChecks.ts) ──────────────────────────

test('rejects an unregistered checkId', async () => {
  const raw = (await loadRawFixtureJson()) as Record<string, unknown>
  const result = parseEmptyBenchmarkFixture({ ...raw, checkId: 'not-a-real-check' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'unregistered-check-id')
})

test('rejects a classificationResult claiming a checkId different from the fixture\'s own', async () => {
  const raw = (await loadRawFixtureJson()) as { expected: { classificationResult: Record<string, unknown> } }
  const bad = { ...raw, expected: { ...raw.expected, classificationResult: { ...raw.expected.classificationResult, checkId: 'not-a-real-check' } } }
  const result = parseEmptyBenchmarkFixture(bad)
  assert.equal(result.ok, false)
})

// ─── 6. Empty-collection and duplicate-viewport rejection — enforced by
// the parser itself, not deferred to a later Evidence Normalizer call ───

test('rejects a fixture whose rawCaptures array is empty', async () => {
  const raw = (await loadRawFixtureJson()) as Record<string, unknown>
  const result = parseEmptyBenchmarkFixture({ ...raw, rawCaptures: [] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'empty-raw-captures')
})

test('rejects rawCaptures with a duplicate viewport name — caught by the parser itself, not merely at a later normalization step', async () => {
  const raw = (await loadRawFixtureJson()) as { rawCaptures: unknown[] }
  const duplicated = { ...raw, rawCaptures: [raw.rawCaptures[0], raw.rawCaptures[0]] }
  const result = parseEmptyBenchmarkFixture(duplicated)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error.kind, 'duplicate-viewport-across-raw-captures')
    if (result.error.kind === 'duplicate-viewport-across-raw-captures') assert.equal(result.error.viewportName, 'desktop')
  }
})

test('defense-in-depth: a hand-built (not parser-constructed) fixture value with duplicate-viewport rawCaptures is independently also rejected by the Evidence Normalizer, since it accepts RawCapture[] from callers other than this parser too', async () => {
  const { normalizeEmptyEvidence } = await import('../src/lib/pipeline/normalize/evidenceNormalizer.ts')
  const raw = (await loadRawFixtureJson()) as { rawCaptures: unknown[] }
  const validParse = parseEmptyBenchmarkFixture(raw)
  assert.equal(validParse.ok, true)
  if (!validParse.ok) return
  // Bypasses parseEmptyBenchmarkFixture entirely — this is deliberately
  // NOT how the fixture-parsing boundary is reached; it proves the
  // Normalizer's own independent duplicate-viewport guard still holds.
  const duplicateCaptures = [validParse.value.rawCaptures[0], validParse.value.rawCaptures[0]]
  const normalized = normalizeEmptyEvidence(duplicateCaptures)
  assert.equal(normalized.ok, false)
  if (!normalized.ok) assert.equal(normalized.error.kind, 'duplicate-viewport')
})

// ─── 7. Fresh-object reconstruction and mutation isolation ─────────────

test('a successfully parsed fixture is reconstructed fresh — mutating the raw input after parsing does not affect the parsed value', async () => {
  const raw = (await loadRawFixtureJson()) as Record<string, unknown>
  const mutableRaw = JSON.parse(JSON.stringify(raw))
  const result = parseEmptyBenchmarkFixture(mutableRaw)
  assert.equal(result.ok, true)
  const snapshotBefore = result.ok ? structuredClone(result.value) : null
  mutableRaw.fixtureId = 'MUTATED-AFTER-PARSE'
  if (result.ok) assert.deepEqual(result.value, snapshotBefore)
})

test('the parsed rawCaptures array is not the same reference as the input array', async () => {
  const raw = (await loadRawFixtureJson()) as { rawCaptures: unknown[] }
  const result = parseEmptyBenchmarkFixture(raw)
  assert.equal(result.ok, true)
  if (result.ok) assert.notEqual(result.value.rawCaptures, raw.rawCaptures)
})

// ─── 8. Canonical serialization/comparison across reordered equivalent
// inputs ──────────────────────────────────────────────────────────────

test('canonicalizeFixture sorts rawCaptures to the canonical viewport order regardless of input order', async () => {
  const raw = (await loadRawFixtureJson()) as { rawCaptures: unknown[] }
  const reversed = { ...raw, rawCaptures: [...raw.rawCaptures].reverse() }
  const parsedOriginal = parseEmptyBenchmarkFixture(raw)
  const parsedReversed = parseEmptyBenchmarkFixture(reversed)
  assert.equal(parsedOriginal.ok, true)
  assert.equal(parsedReversed.ok, true)
  if (parsedOriginal.ok && parsedReversed.ok) {
    assert.deepEqual(canonicalizeFixture(parsedOriginal.value), canonicalizeFixture(parsedReversed.value))
  }
})

test('fixturesAreEquivalent is true for logically-equivalent fixtures parsed from differently-ordered input, and false for genuinely different fixtures', async () => {
  const raw = (await loadRawFixtureJson()) as { rawCaptures: unknown[]; fixtureId: string }
  const reversed = { ...raw, rawCaptures: [...raw.rawCaptures].reverse() }
  const different = { ...raw, fixtureId: 'a-genuinely-different-fixture-id' }
  const a = parseEmptyBenchmarkFixture(raw)
  const b = parseEmptyBenchmarkFixture(reversed)
  const c = parseEmptyBenchmarkFixture(different)
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  assert.equal(c.ok, true)
  if (a.ok && b.ok && c.ok) {
    assert.equal(fixturesAreEquivalent(a.value, b.value), true, 'reordered-but-equivalent fixtures must compare equal')
    assert.equal(fixturesAreEquivalent(a.value, c.value), false, 'genuinely different fixtures must not compare equal')
  }
})

// ─── Complete canonicalization: not merely rawCaptures order ────────────

test('canonicalizeFixture sorts each rawCapture\'s incompleteCoverage record by key, independent of input order', async () => {
  const raw = (await loadRawFixtureJson()) as { rawCaptures: Record<string, unknown>[] }
  const withOrderZA = { ...raw, rawCaptures: [{ ...raw.rawCaptures[0], incompleteCoverage: { zField: true, aField: false } }, raw.rawCaptures[1]] }
  const withOrderAZ = { ...raw, rawCaptures: [{ ...raw.rawCaptures[0], incompleteCoverage: { aField: false, zField: true } }, raw.rawCaptures[1]] }
  const a = parseEmptyBenchmarkFixture(withOrderZA)
  const b = parseEmptyBenchmarkFixture(withOrderAZ)
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) {
    const canonicalA = canonicalizeFixture(a.value)
    const desktopCapture = canonicalA.rawCaptures.find((c) => c.provenance.viewport.name === 'desktop')
    assert.ok(desktopCapture)
    assert.deepEqual(Object.keys(desktopCapture.incompleteCoverage), ['aField', 'zField'])
    assert.equal(fixturesAreEquivalent(a.value, b.value), true, 'differing only in incompleteCoverage key order must still be equivalent')
  }
})

test('canonicalizeFixture sorts expected.normalizedEvidence.viewportsPresent to canonical viewport order, independent of input order', async () => {
  const raw = (await loadRawFixtureJson()) as { expected: { normalizedEvidence: Record<string, unknown> & { viewportsPresent: string[] } } }
  const reversedViewports = { ...raw, expected: { ...raw.expected, normalizedEvidence: { ...raw.expected.normalizedEvidence, viewportsPresent: [...raw.expected.normalizedEvidence.viewportsPresent].reverse() } } }
  const a = parseEmptyBenchmarkFixture(raw)
  const b = parseEmptyBenchmarkFixture(reversedViewports)
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) {
    assert.deepEqual(canonicalizeFixture(a.value).expected.normalizedEvidence.viewportsPresent, ['desktop', 'mobile'])
    assert.equal(fixturesAreEquivalent(a.value, b.value), true, 'differing only in viewportsPresent array order must still be equivalent')
  }
})

test('canonicalizeFixture sorts expected.normalizedEvidence.incompleteCoverage by key, independent of input order', async () => {
  const raw = (await loadRawFixtureJson()) as { expected: { normalizedEvidence: Record<string, unknown> } }
  const withOrderZA = { ...raw, expected: { ...raw.expected, normalizedEvidence: { ...raw.expected.normalizedEvidence, incompleteCoverage: { zField: false, aField: true } } } }
  const withOrderAZ = { ...raw, expected: { ...raw.expected, normalizedEvidence: { ...raw.expected.normalizedEvidence, incompleteCoverage: { aField: true, zField: false } } } }
  const a = parseEmptyBenchmarkFixture(withOrderZA)
  const b = parseEmptyBenchmarkFixture(withOrderAZ)
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) {
    assert.deepEqual(Object.keys(canonicalizeFixture(a.value).expected.normalizedEvidence.incompleteCoverage), ['aField', 'zField'])
    assert.equal(fixturesAreEquivalent(a.value, b.value), true, 'differing only in expected incompleteCoverage key order must still be equivalent')
  }
})

test('canonicalizeFixture handles simultaneously-reordered rawCaptures, nested coverage keys, and viewport arrays together', async () => {
  const raw = (await loadRawFixtureJson()) as {
    rawCaptures: Record<string, unknown>[]
    expected: { normalizedEvidence: Record<string, unknown> & { viewportsPresent: string[] } }
  }
  // Both variants carry the SAME incompleteCoverage CONTENT ({a:false,
  // z:true} on every capture) — only key order, capture order, and
  // viewportsPresent order differ between them. Genuinely differing
  // content (e.g. one variant missing a field the other has) would make
  // them non-equivalent fixtures, not merely differently-ordered ones.
  const baseline = { ...raw, rawCaptures: raw.rawCaptures.map((c) => ({ ...c, incompleteCoverage: { a: false, z: true } })) }
  const scrambled = {
    ...baseline,
    rawCaptures: [{ ...baseline.rawCaptures[1], incompleteCoverage: { z: true, a: false } }, { ...baseline.rawCaptures[0], incompleteCoverage: { a: false, z: true } }],
    expected: { ...baseline.expected, normalizedEvidence: { ...baseline.expected.normalizedEvidence, viewportsPresent: [...baseline.expected.normalizedEvidence.viewportsPresent].reverse() } },
  }
  const a = parseEmptyBenchmarkFixture(baseline)
  const b = parseEmptyBenchmarkFixture(scrambled)
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  if (a.ok && b.ok) assert.deepEqual(canonicalizeFixture(a.value), canonicalizeFixture(b.value))
})

test('mutating a canonicalized fixture does not mutate its source, and does not affect an independently-produced canonicalized copy', async () => {
  const raw = await loadRawFixtureJson()
  const parsed = parseEmptyBenchmarkFixture(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const sourceSnapshot = structuredClone(parsed.value)
  const canonicalA = canonicalizeFixture(parsed.value)
  const canonicalB = canonicalizeFixture(parsed.value)

  canonicalA.rawCaptures[0].incompleteCoverage.tampered = true
  canonicalA.rawCaptures[0].provenance.viewport.width = 999999
  canonicalA.expected.normalizedEvidence.incompleteCoverage.tampered = true
  canonicalA.expected.normalizedEvidence.viewportsPresent.push('narrow')
  canonicalA.expected.classificationResult.reasoning = 'TAMPERED'

  assert.deepEqual(parsed.value, sourceSnapshot, 'mutating a canonicalized copy must never affect the source fixture')
  assert.notDeepEqual(canonicalA, canonicalB, 'mutating one canonicalized result must not affect an independently produced one')
  assert.equal(canonicalB.expected.classificationResult.reasoning !== 'TAMPERED', true)
  assert.equal(canonicalB.rawCaptures[0].provenance.viewport.width !== 999999, true)
})

// ─── Canonicalization safety for a FUTURE, non-'empty' check's mutable
// payload/evidence shape. 'empty's own payload/evidence are the frozen
// EMPTY_CAPTURE_PAYLOAD/EMPTY_CHECK_EVIDENCE singletons — cloning a
// frozen object is a no-op, so a test built only from 'empty' data can
// never actually exercise canonicalizeRawCapture/canonicalizeNormalized-
// Evidence's deep-clone of `payload`/`evidence`. This substitutes a
// synthetic, deliberately MUTABLE nested-object payload/evidence — a
// stand-in for what a real check registered in a future milestone might
// look like, matching the shape of check-payload types described by
// checkSpecification.ts's CheckRegistryEntry — cast into
// BenchmarkFixture<'empty'> only because canonicalizeFixture's exported
// signature is pinned to the real CheckRegistry (deliberately not made
// generic over an arbitrary registry here — that would be new framework
// surface with no present caller, exactly what this cleanup pass must
// not add). The cast does not claim 'empty' really has this shape; it
// exercises the GENERIC cloning behavior the canonicalization helpers
// apply to whatever payload/evidence value they are actually given. ────

test('canonicalizeFixture deep-clones a synthetic, mutable-shaped payload/evidence: mutating a canonicalized result cannot affect its source or a sibling canonicalized result', async () => {
  const raw = await loadRawFixtureJson()
  const parsed = parseEmptyBenchmarkFixture(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return

  const syntheticMutablePayload = { __brand: 'EmptyCapturePayload', nested: { counter: 0, tags: ['a', 'b'] } }
  const syntheticMutableEvidence = { __brand: 'EmptyCheckEvidence', nested: { counter: 0, tags: ['a', 'b'] } }
  const syntheticFixture = {
    ...structuredClone(parsed.value),
    rawCaptures: parsed.value.rawCaptures.map((c) => ({ ...structuredClone(c), payload: structuredClone(syntheticMutablePayload) })),
    expected: {
      ...structuredClone(parsed.value.expected),
      normalizedEvidence: { ...structuredClone(parsed.value.expected.normalizedEvidence), evidence: structuredClone(syntheticMutableEvidence) },
    },
  } as unknown as BenchmarkFixture<'empty'>
  const syntheticSnapshot = structuredClone(syntheticFixture)

  const canonicalA = canonicalizeFixture(syntheticFixture)
  const canonicalB = canonicalizeFixture(syntheticFixture)

  const tamperedPayload = canonicalA.rawCaptures[0].payload as unknown as typeof syntheticMutablePayload
  tamperedPayload.nested.counter = 999
  tamperedPayload.nested.tags.push('TAMPERED')
  const tamperedEvidence = canonicalA.expected.normalizedEvidence.evidence as unknown as typeof syntheticMutableEvidence
  tamperedEvidence.nested.counter = 999
  tamperedEvidence.nested.tags.push('TAMPERED')

  assert.deepEqual(syntheticFixture, syntheticSnapshot, 'mutating a canonicalized result must never affect the source fixture, even for a mutable synthetic payload/evidence shape')
  assert.notDeepEqual(canonicalA, canonicalB, "mutating one canonicalized result's payload/evidence must not affect an independently-produced sibling canonicalized result")

  const untouchedPayload = canonicalB.rawCaptures[0].payload as unknown as typeof syntheticMutablePayload
  const untouchedEvidence = canonicalB.expected.normalizedEvidence.evidence as unknown as typeof syntheticMutableEvidence
  assert.equal(untouchedPayload.nested.counter, 0)
  assert.deepEqual(untouchedPayload.nested.tags, ['a', 'b'])
  assert.equal(untouchedEvidence.nested.counter, 0)
  assert.deepEqual(untouchedEvidence.nested.tags, ['a', 'b'])
})

// ─── 18a. Immutable fixture derivation/lineage — a NEW fixture entry
// derived from a source AT THE SAME fixtureSchemaVersion (e.g.
// re-authoring/renaming a fixture without a schema change). This is
// lineage tracking, not a schema migration — a genuine version
// transition is proven separately in 18b below, since changing only the
// fixtureId (while both source and output keep the same
// fixtureSchemaVersion) does not itself demonstrate a migration. ────────

test('createMigratedBenchmarkFixture supports immutable fixture derivation/lineage: a new fixture entry, same fixtureSchemaVersion, records and never mutates its source', async () => {
  const raw = await loadRawFixtureJson()
  const parsed = parseEmptyBenchmarkFixture(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const source: BenchmarkFixture<'empty'> = parsed.value
  const sourceSnapshot = structuredClone(source)

  // Test-only derivation: produces a NEW, wholly independent fixture
  // object (a fresh clone, not the source, with a different fixtureId) at
  // the SAME fixtureSchemaVersion as its source — this is lineage, not a
  // version migration.
  const derivedFixtureCandidate: BenchmarkFixture<'empty'> = { ...structuredClone(source), fixtureId: `${source.fixtureId}-derived-test-only` }
  const result = createMigratedBenchmarkFixture(source, derivedFixtureCandidate)

  assert.equal(result.ok, true)
  if (!result.ok) return
  const derived = result.value

  assert.notEqual(derived.fixture.fixtureId, source.fixtureId, 'derivation must produce a new, distinctly-identified entry')
  assert.equal(derived.fixture.fixtureSchemaVersion, source.fixtureSchemaVersion, 'this is same-schema derivation/lineage — a genuine schema-VERSION migration is proven separately below')
  assert.equal(derived.migratedFrom.fixtureId, source.fixtureId, 'the derived fixture must record its source reference')
  assert.equal(derived.migratedFrom.fixtureSchemaVersion, source.fixtureSchemaVersion)
  assert.deepEqual(source, sourceSnapshot, 'the source fixture must be completely unchanged by derivation')
  assert.notEqual(derived.fixture, source, 'the derived fixture must not be the same object reference as its source')
  assert.notEqual(derived.fixture, derivedFixtureCandidate, 'the constructor must return a fresh reconstruction, not the caller\'s own object reference')
})

// ─── 18b. A GENUINE schema-version migration: source and output carry
// DIFFERENT fixtureSchemaVersion values, not merely different fixtureIds.
// No second real fixture schema version has ever existed (Milestone 2
// registers only "1.0.0") — a test-only synthetic legacy version is used
// so this proves the mechanism honestly, without inventing a real
// production migration ahead of need or adding any new production
// abstraction. ────────────────────────────────────────────────────────

test('createMigratedBenchmarkFixture proves a genuine schema-version migration: source and migrated output carry different fixtureSchemaVersion values, migratedFrom records the OLD version, and the source is never mutated', async () => {
  const raw = await loadRawFixtureJson()
  const parsed = parseEmptyBenchmarkFixture(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return

  // A synthetic LEGACY fixture: identical content, but claims an OLDER
  // fixtureSchemaVersion than BENCHMARK_FIXTURE_SCHEMA_VERSION ('1.0.0').
  // No such version has ever shipped; `createMigratedBenchmarkFixture`
  // only checks that the source's version string is non-blank, so a cast
  // is sufficient here — this is a test-only fixture, not a claim that
  // '0.9.0-test-only-legacy' is a real, ever-registered fixture schema.
  const legacySource = { ...structuredClone(parsed.value), fixtureSchemaVersion: '0.9.0-test-only-legacy' } as unknown as BenchmarkFixture<'empty'>
  const legacySourceSnapshot = structuredClone(legacySource)

  // The migration TARGET: expressed in the CURRENT fixture schema, as a
  // new entry (a genuine migration produces a new fixture, never an
  // in-place rewrite of the legacy one).
  const migratedFixtureCandidate: BenchmarkFixture<'empty'> = {
    ...structuredClone(parsed.value),
    fixtureId: `${legacySource.fixtureId}-migrated-to-current-schema`,
    fixtureSchemaVersion: BENCHMARK_FIXTURE_SCHEMA_VERSION,
  }

  const result = createMigratedBenchmarkFixture(legacySource, migratedFixtureCandidate)
  assert.equal(result.ok, true)
  if (!result.ok) return
  const migrated = result.value

  assert.notEqual(
    migrated.fixture.fixtureSchemaVersion,
    migrated.migratedFrom.fixtureSchemaVersion,
    'a genuine migration changes fixtureSchemaVersion, not merely fixtureId — this is what distinguishes a migration from ordinary derivation/lineage (see 18a above)'
  )
  assert.equal(migrated.fixture.fixtureSchemaVersion, BENCHMARK_FIXTURE_SCHEMA_VERSION, 'the migrated fixture must be expressed in the CURRENT fixture schema')
  assert.equal(migrated.migratedFrom.fixtureSchemaVersion, '0.9.0-test-only-legacy', 'migratedFrom must record the OLD (source) version, not the new one')
  assert.equal(migrated.migratedFrom.fixtureId, legacySource.fixtureId)
  assert.deepEqual(legacySource, legacySourceSnapshot, 'the legacy source fixture must be completely unchanged by migration')
  assert.notEqual(migrated.fixture, legacySource, 'the migrated fixture must not be the same object reference as its source')
})

// ─── Migration mechanism strength: the validated constructor rejects a
// meaningless or unsafe source relationship, rather than accepting any
// arbitrary strings ───────────────────────────────────────────────────

test('createMigratedBenchmarkFixture rejects a blank source fixtureId', async () => {
  const raw = await loadRawFixtureJson()
  const parsed = parseEmptyBenchmarkFixture(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const blankIdSource: BenchmarkFixture<'empty'> = { ...structuredClone(parsed.value), fixtureId: '   ' }
  const migratedCandidate: BenchmarkFixture<'empty'> = { ...structuredClone(parsed.value), fixtureId: 'something-else' }
  const result = createMigratedBenchmarkFixture(blankIdSource, migratedCandidate)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'blank-source-fixture-id')
})

test('createMigratedBenchmarkFixture rejects a blank source fixtureSchemaVersion', async () => {
  const raw = await loadRawFixtureJson()
  const parsed = parseEmptyBenchmarkFixture(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const blankVersionSource = { ...structuredClone(parsed.value), fixtureSchemaVersion: '' } as unknown as BenchmarkFixture<'empty'>
  const migratedCandidate: BenchmarkFixture<'empty'> = { ...structuredClone(parsed.value), fixtureId: 'something-else' }
  const result = createMigratedBenchmarkFixture(blankVersionSource, migratedCandidate)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'blank-source-fixture-schema-version')
})

test('createMigratedBenchmarkFixture rejects a migration whose output claims the same fixtureId and fixtureSchemaVersion as its own source', async () => {
  const raw = await loadRawFixtureJson()
  const parsed = parseEmptyBenchmarkFixture(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const source = parsed.value
  const selfReferentialCandidate: BenchmarkFixture<'empty'> = structuredClone(source)
  const result = createMigratedBenchmarkFixture(source, selfReferentialCandidate)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'migration-references-same-fixture-id-and-version-as-output')
})

test('createMigratedBenchmarkFixture rejects a migrated fixture that reuses a nested object reference from its source', async () => {
  const raw = await loadRawFixtureJson()
  const parsed = parseEmptyBenchmarkFixture(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const source = parsed.value
  // Deliberately bad: reuses the SOURCE's own rawCaptures array reference
  // instead of a fresh clone — a later mutation of one would corrupt the
  // other.
  const unsafeCandidate: BenchmarkFixture<'empty'> = { ...source, fixtureId: `${source.fixtureId}-migrated`, rawCaptures: source.rawCaptures }
  const result = createMigratedBenchmarkFixture(source, unsafeCandidate)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'migrated-fixture-shares-reference-with-source')
})

test('createMigratedBenchmarkFixture rejects a migrated fixture whose nested expected.classificationResult object is the same reference as its source\'s', async () => {
  const raw = await loadRawFixtureJson()
  const parsed = parseEmptyBenchmarkFixture(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const source = parsed.value
  const unsafeCandidate: BenchmarkFixture<'empty'> = {
    ...structuredClone(source),
    fixtureId: `${source.fixtureId}-migrated`,
    expected: { normalizedEvidence: structuredClone(source.expected.normalizedEvidence), classificationResult: source.expected.classificationResult },
  }
  const result = createMigratedBenchmarkFixture(source, unsafeCandidate)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'migrated-fixture-shares-reference-with-source')
})

// ─── 19. Fixture files contain no real domains or prohibited content ──

test('the fixture file contains no real domain and no prohibited page content (HTML/CSS/DOM/screenshots/cookies)', async () => {
  const text = await readFile(FIXTURE_PATH, 'utf8')
  for (const forbidden of ['websitesbyleslie.com', 'sissyssweets', '.com', '.org', '.net', '<html', '<div', 'screenshot', 'cookie', 'localStorage']) {
    assert.ok(!text.toLowerCase().includes(forbidden.toLowerCase()), `fixture file must not contain "${forbidden}"`)
  }
  assert.ok(text.includes('.invalid'), 'fixture file must use a reserved .invalid URL')
})
