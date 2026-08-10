// Sub-patch 2c — compile-time negative-case proofs for
// `BenchmarkFixtureFor`'s correlation preservation. Never imported by any
// production or test module; enforced solely by `npx tsc --noEmit`
// (tsconfig.json's "include": ["src"] already covers this file). Each
// proof is a single-line expression immediately after its
// `@ts-expect-error` comment, for the same reason as 2a's
// `src/lib/pipeline/types/__compileTimeChecks.ts`.
//
// Milestone 2's production CheckRegistry registers exactly one check
// ('empty'), which alone cannot prove cross-check rejection. As in 2a,
// this file declares its OWN separate, non-exported, two-entry synthetic
// registry — never merged into production, never imported anywhere else —
// and instantiates the EXACT SAME `BenchmarkFixtureFor` generic production
// uses, so a regression in the shared machinery fails this proof directly.

import type { CheckRegistryEntry } from '../../pipeline/types/checkSpecification.js'
import type { BenchmarkFixtureFor } from './benchmarkFixture.js'

interface SyntheticRegistry {
  testCheckA: {
    captureSchemaVersion: '1.0.0'
    capturePayload: { readonly __brand: 'SyntheticCaptureA' }
    evidenceSchemaVersion: '1.0.0'
    evidence: { readonly __brand: 'SyntheticEvidenceA' }
    contractVersion: '1.0.0'
    auditFields: { sampleCount: number }
  }
  testCheckB: {
    captureSchemaVersion: '2.0.0'
    capturePayload: { readonly __brand: 'SyntheticCaptureB' }
    evidenceSchemaVersion: '2.0.0'
    evidence: { readonly __brand: 'SyntheticEvidenceB' }
    contractVersion: '2.0.0'
    auditFields: { label: string }
  }
}

// Confirms SyntheticRegistry actually conforms to the shape
// BenchmarkFixtureFor's constraint expects, the same way 2a's own proof
// file does — if this line fails to compile, the registry above is
// malformed, independent of any of the proofs below.
type _RegistryConformanceCheck = { [K in keyof SyntheticRegistry]: CheckRegistryEntry }
declare const _registryConformance: _RegistryConformanceCheck
void _registryConformance

declare const fixtureA: BenchmarkFixtureFor<SyntheticRegistry, 'testCheckA'>
declare const fixtureB: BenchmarkFixtureFor<SyntheticRegistry, 'testCheckB'>
declare function acceptsOnlyFixtureA(f: BenchmarkFixtureFor<SyntheticRegistry, 'testCheckA'>): void

// (1) A fixture typed for testCheckA must not satisfy a consumer requiring testCheckB's.
declare function acceptsOnlyFixtureB(f: BenchmarkFixtureFor<SyntheticRegistry, 'testCheckB'>): void
// @ts-expect-error - a testCheckA fixture must not satisfy a consumer requiring testCheckB's
acceptsOnlyFixtureB(fixtureA)

// (2) mixed ID and rawCaptures: testCheckA's checkId must not pair with
// testCheckB's capture payload, even through the all-check union.
declare const capturePayloadB: SyntheticRegistry['testCheckB']['capturePayload']
declare const fixtureACapture0: BenchmarkFixtureFor<SyntheticRegistry, 'testCheckA'>['rawCaptures'][number]
// @ts-expect-error - testCheckA's checkId must not pair with testCheckB's capture payload
const _mixedFixtureCapture: BenchmarkFixtureFor<SyntheticRegistry> = { ...fixtureA, rawCaptures: [{ ...fixtureACapture0, payload: capturePayloadB }] }
void _mixedFixtureCapture

// (3) mixed ID and expected.normalizedEvidence: testCheckA's checkId must
// not pair with testCheckB's expected evidence.
// @ts-expect-error - testCheckA's checkId must not pair with testCheckB's expected normalizedEvidence
const _mixedFixtureEvidence: BenchmarkFixtureFor<SyntheticRegistry> = { ...fixtureA, expected: { ...fixtureA.expected, normalizedEvidence: fixtureB.expected.normalizedEvidence } }
void _mixedFixtureEvidence

// (4) mixed ID and expected.classificationResult: testCheckA's checkId
// must not pair with testCheckB's expected classification result.
// @ts-expect-error - testCheckA's checkId must not pair with testCheckB's expected classificationResult
const _mixedFixtureClassification: BenchmarkFixtureFor<SyntheticRegistry> = { ...fixtureA, expected: { ...fixtureA.expected, classificationResult: fixtureB.expected.classificationResult } }
void _mixedFixtureClassification

// (5) an unregistered checkId is rejected.
declare const unregisteredId: 'testCheckC'
// @ts-expect-error - 'testCheckC' is not a member of the synthetic registry's check IDs
const _badFixtureCheckId: keyof SyntheticRegistry & string = unregisteredId
void _badFixtureCheckId

// (6) positive control: a well-formed, correctly-correlated fixture IS
// constructible — if this ever fails to compile, the mechanism above has
// been over-constrained.
acceptsOnlyFixtureA(fixtureA)
