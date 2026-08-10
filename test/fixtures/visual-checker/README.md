# Benchmark fixture library — sub-patch 2c

This directory holds `BenchmarkFixture` data for the offline invariant/
metamorphic test framework. Format defined in
`src/lib/offline/invariants/benchmarkFixture.ts`; validated by
`parseEmptyBenchmarkFixture` from that same file.

## Format

A fixture is JSON with exactly these top-level keys:

- `fixtureSchemaVersion` — currently `"1.0.0"`. Unsupported versions are
  rejected, not coerced.
- `fixtureId` — explicit, human-assigned identity string. Never a
  generated timestamp or random value.
- `checkId` — a registered check ID (Milestone 2: only `"empty"` is
  registered).
- `rawCaptures` — an array of `RawCapture<checkId>` values (2a's type,
  `src/lib/pipeline/types/rawCapture.ts`), one per viewport.
- `expected` — `{ normalizedEvidence, classificationResult }`: the exact
  `NormalizedEvidence<checkId>` and `ClassificationResult<checkId>` the
  real pipeline (2b's `normalizeEmptyEvidence`/`classifyEmpty`) is expected
  to produce from `rawCaptures`.

`checkId`, and every nested version field, is tied to a single registered
check's registry entry via `BenchmarkFixtureFor`'s distributive-
conditional-type design — the same correlation-preserving mechanism 2a
uses for `RawCapture`/`NormalizedEvidence`/`ClassificationResult`
themselves, reused here rather than re-derived. A fixture cannot claim one
check's ID while holding another check's captures or expected result, even
through the all-check union type — proven in
`src/lib/offline/invariants/__compileTimeChecks.ts`.

`rawCaptures` must be non-empty and must not contain two captures with the
same viewport name — both are enforced by `parseEmptyBenchmarkFixture`
itself, at parse time, not deferred to a later Evidence Normalizer call.

## Canonicalization

`canonicalizeFixture`/`fixturesAreEquivalent` normalize the ENTIRE
fixture, not merely `rawCaptures`'s order: raw-capture order (by canonical
viewport order), every `incompleteCoverage` record's key order (both on
each raw capture and on the expected normalized evidence), the expected
normalized evidence's `viewportsPresent` order, and the expected
classification's `evidenceRefs` order. Two fixtures that differ only in
one of these orderings compare equal under `fixturesAreEquivalent`.
`canonicalizeFixture` always returns a fully reconstructed value — no
nested object is shared by reference with its input (aside from the
registered check's own frozen, immutable payload/evidence singletons).

## Versioning and correlation

Every schema version referenced by a fixture — the fixture format's own
version, and the capture/evidence/contract schema versions implied by
`checkId` — is validated against 2a's `CheckRegistry`
(`checkSpecification.ts`) at parse time. A fixture recorded under one
schema version stays reproducible as long as either the matching
normalizer/classifier version is kept, or a migration produces a *new*
fixture entry (see "Migration" below) — never by silently reinterpreting
old data under new rules.

## Immutability

`parseEmptyBenchmarkFixture` reconstructs every field of a successfully
parsed fixture into fresh objects/arrays (the same pattern established in
`schemaValidation.ts`) — a parsed fixture never retains a reference into
the raw, possibly-attacker-controlled input it was parsed from.

## Migration rule

A stored fixture's data is never mutated in place. Any future migration
(e.g. a fixture schema version bump) produces a **new** fixture entry that
references its source by `fixtureId` and `fixtureSchemaVersion`
(`MigratedBenchmarkFixture`, in `benchmarkFixture.ts`) — the original is
untouched. `createMigratedBenchmarkFixture` is the validated constructor
(prefer it over building a `MigratedBenchmarkFixture` object literal
directly): it rejects a blank source fixture ID/version, a migration
claiming to have produced a fixture identical (by ID+version) to its own
source, and a migrated fixture that reuses any nested object reference
from the source. No real migration exists yet, because no fixture has
ever needed one; the mechanism itself is proven with a test-only synthetic
version transition in `test/pipeline.benchmarkFixture.test.ts`, not
invented as a real production migration ahead of need.

## What this fixture library deliberately does NOT contain

- Real website or customer content of any kind.
- Screenshots, HTML snapshots, CSS, DOM dumps, accessibility trees,
  cookies, storage, response bodies, or unrestricted text.
- Real visual-check fixtures (positive/negative/boundary cases for any of
  the 12 real checks) — those begin at Milestone 3, per each check's own
  contract.
- Any URL other than the reserved `.invalid` TLD (RFC 2606) — fixtures
  never reference or request a real site.

## The `benchmark/` fixtures currently present

**`empty-scaffold.v1.json`** — the *only* fixture in Milestone 2. It
exercises the registered `'empty'` architecture scaffold end-to-end
(Normalizer → Classification Engine → both sibling outputs) using
synthetic, hand-authored `RawCapture` values only. It is **not** a
positive, negative, or boundary case for any real check, and it does
**not** satisfy, partially or otherwise, `validation-parameters-v1-draft.md`
§1's provisional real-check fixture-count recommendation (3 positive / 3
negative / 2 boundary per check) — that recommendation applies to real
checks migrated from Milestone 3 onward, none of which exist yet. Positive,
negative, and boundary fixtures for real checks are a Milestone 3+
concern, out of this sub-patch's scope.
