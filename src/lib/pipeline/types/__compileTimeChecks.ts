// Sub-patch 2a — compile-time negative-case proofs for the correlation-
// preserving check-registry mechanism (checkSpecification.ts) and the
// audit-key minimization mechanism (auditRecord.ts). Never imported by any
// production or test module; enforced solely by `npx tsc --noEmit`
// (tsconfig.json's "include": ["src"] already covers this file). Each
// proof is a single-line expression immediately after its
// `@ts-expect-error` comment, since TypeScript reports a type error on the
// specific line it occurs on, and a multi-line object literal can report
// its error on an inner line the directive doesn't cover.
//
// Corrected design (second correction pass): the first version of this
// file hand-defined SEPARATE `SyntheticEvidenceEnvelope`/`SyntheticContract`
// /`SyntheticResult`/`SyntheticAuditFieldRef` types that merely resembled
// production's shape — which meant the proofs verified a parallel
// reimplementation, not the actual production mechanism, and would keep
// passing even if production regressed. Below, `SyntheticRegistry` is
// declared as a genuine `CheckRegistryShape`-conforming registry, and every
// proof instantiates the SAME exported generic type constructors
// production uses (`RawCaptureFor`, `NormalizedEvidenceFor`,
// `CheckContractFor`, `ClassificationResultFor`, `AuditFieldRefFor`,
// `ClassifierFor`) against it — so a regression in the shared machinery
// fails these tests directly, not just a copy of it.
//
// `SyntheticRegistry` is entirely separate from `CheckRegistry`: never
// exported, never imported anywhere, never merged into the production
// registry (no `declare module`/interface-merging augmentation of
// `CheckRegistry` occurs anywhere in this codebase) — it exists solely to
// exercise the general mechanism against two distinct registrations,
// without adding a fake visitor-facing check to production.

import { RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, type CaptureProvenance, type RawCaptureFor } from './rawCapture.js'
import { NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION, type NormalizedEvidenceFor, type UnrecognizedLegacyEvidence } from './normalizedEvidence.js'
import type { CheckContractFor, ClassificationResultFor, ClassifierFor, ClassificationInputFor } from './classification.js'
import type { AuditFieldRefFor, AuditFieldRef } from './auditRecord.js'
import type { CheckId, CheckRegistry } from './checkSpecification.js'

// ─── Part 1: production registry proofs (single registered check) ────────

declare const unregisteredCheckIdLiteral: 'not-a-real-check'
// (1a) An unregistered check ID literal must not be assignable to CheckId.
// @ts-expect-error - 'not-a-real-check' is not a registered CheckId
const _badCheckId: CheckId = unregisteredCheckIdLiteral
void _badCheckId

type NotTheBrandedEmptyShape = { readonly somethingElseEntirely: true }
declare const wrongShapedValue: NotTheBrandedEmptyShape
// (1b) RawCapture<'empty'>'s payload field must be exactly the registry's
// capturePayload type for 'empty'.
// @ts-expect-error - NotTheBrandedEmptyShape does not satisfy RawCaptureFor<CheckRegistry, 'empty'>['payload']
const _badRawCapturePayload: RawCaptureFor<CheckRegistry, 'empty'>['payload'] = wrongShapedValue
void _badRawCapturePayload

// (1c) NormalizedEvidence<'empty'>'s evidence field must be exactly the
// registry's evidence type for 'empty'.
// @ts-expect-error - NotTheBrandedEmptyShape does not satisfy NormalizedEvidenceFor<CheckRegistry, 'empty'>['evidence']
const _badNormalizedEvidence: NormalizedEvidenceFor<CheckRegistry, 'empty'>['evidence'] = wrongShapedValue
void _badNormalizedEvidence

declare function acceptsOnlyEmptyEvidence(evidence: NormalizedEvidenceFor<CheckRegistry, 'empty'>): void
declare const legacyEvidence: UnrecognizedLegacyEvidence
// (1d) UnrecognizedLegacyEvidence is not structurally compatible with
// NormalizedEvidence<'empty'>.
// @ts-expect-error - UnrecognizedLegacyEvidence must not satisfy NormalizedEvidenceFor<CheckRegistry, 'empty'>
acceptsOnlyEmptyEvidence(legacyEvidence)

// (1e) AuditFieldRef<'empty'> must be uninhabited — 'empty' has no
// registered audit fields at all (genuinely empty, not a fictional one).
// @ts-expect-error - AuditFieldRef<'empty'> is `never`; nothing satisfies it
const _emptyAuditFieldRef: AuditFieldRef<'empty'> = { key: 'present', value: true }
void _emptyAuditFieldRef

// ─── Part 2: synthetic two-entry registry — proves the GENERAL mechanism
// (at least two synthetic, non-production, compile-time-only
// registrations), instantiated through the EXACT SAME generic machinery
// production uses. Not a real visual check, not a scoring rule.

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

declare const capturePayloadA: SyntheticRegistry['testCheckA']['capturePayload']
declare const capturePayloadB: SyntheticRegistry['testCheckB']['capturePayload']
declare const evidenceA: SyntheticRegistry['testCheckA']['evidence']
declare const evidenceB: SyntheticRegistry['testCheckB']['evidence']
declare const provenanceSample: CaptureProvenance

// (2a) mixed ID and capture payload through the all-check union: testCheckA's
// checkId must not pair with testCheckB's capture payload.
// @ts-expect-error - testCheckA's checkId must not pair with testCheckB's capture payload, even through the all-check union
const _mixedCapturePayload: RawCaptureFor<SyntheticRegistry> = { envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, checkId: 'testCheckA', payloadSchemaVersion: '1.0.0', provenance: provenanceSample, payload: capturePayloadB, incompleteCoverage: {} }
void _mixedCapturePayload

// (2b) mixed ID and capture version: testCheckA's checkId must not pair
// with testCheckB's payloadSchemaVersion ('2.0.0').
// @ts-expect-error - testCheckA's checkId must not pair with testCheckB's payloadSchemaVersion
const _mixedCaptureVersion: RawCaptureFor<SyntheticRegistry> = { envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, checkId: 'testCheckA', payloadSchemaVersion: '2.0.0', provenance: provenanceSample, payload: capturePayloadA, incompleteCoverage: {} }
void _mixedCaptureVersion

// (2c) mixed ID and evidence payload: testCheckA's checkId must not pair
// with testCheckB's evidence.
// @ts-expect-error - testCheckA's checkId must not pair with testCheckB's evidence
const _mixedEvidence: NormalizedEvidenceFor<SyntheticRegistry> = { envelopeSchemaVersion: NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION, checkId: 'testCheckA', sourceCapturePayloadSchemaVersion: '1.0.0', evidenceSchemaVersion: '1.0.0', evidence: evidenceB, viewportsPresent: [], incompleteCoverage: {} }
void _mixedEvidence

// (2d) mixed ID and evidence version: testCheckA's checkId must not pair
// with testCheckB's evidenceSchemaVersion ('2.0.0').
// @ts-expect-error - testCheckA's checkId must not pair with testCheckB's evidenceSchemaVersion
const _mixedEvidenceVersion: NormalizedEvidenceFor<SyntheticRegistry> = { envelopeSchemaVersion: NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION, checkId: 'testCheckA', sourceCapturePayloadSchemaVersion: '1.0.0', evidenceSchemaVersion: '2.0.0', evidence: evidenceA, viewportsPresent: [], incompleteCoverage: {} }
void _mixedEvidenceVersion

// (2e) mixed ID and contract version: testCheckA's checkId must not pair
// with testCheckB's contract version ('2.0.0').
// @ts-expect-error - testCheckA's checkId must not pair with testCheckB's contract version
const _mixedContractVersion: CheckContractFor<SyntheticRegistry> = { id: 'testCheckA', version: '2.0.0', claim: 'x', standardsBasis: { type: 'product-policy', rationale: 'x' }, requiredEvidenceFields: [] }
void _mixedContractVersion

// (2f) mixed classification result fields: testCheckA's checkId must not
// pair with testCheckB's contractVersion.
// @ts-expect-error - testCheckA's checkId must not pair with testCheckB's contractVersion in a ClassificationResult
const _mixedClassificationResultVersion: ClassificationResultFor<SyntheticRegistry> = { checkId: 'testCheckA', contractVersion: '2.0.0', outcome: 'unverified', standardsBasis: { type: 'product-policy', rationale: 'x' }, evidenceRefs: [], reasoning: 'x' }
void _mixedClassificationResultVersion

// (2g) mixed classification result fields: testCheckA's checkId must not
// pair with testCheckB's audit key ('label') in evidenceRefs.
// @ts-expect-error - testCheckA's checkId must not pair with testCheckB's audit key in evidenceRefs
const _mixedClassificationResultKey: ClassificationResultFor<SyntheticRegistry> = { checkId: 'testCheckA', contractVersion: '1.0.0', outcome: 'unverified', standardsBasis: { type: 'product-policy', rationale: 'x' }, evidenceRefs: ['label'], reasoning: 'x' }
void _mixedClassificationResultKey

// (2h) mixed audit key/value: testCheckB's audit key must not satisfy
// testCheckA's pinned AuditFieldRefFor type.
// @ts-expect-error - testCheckB's audit key 'label' must not satisfy testCheckA's AuditFieldRefFor
const _crossAuditKey: AuditFieldRefFor<SyntheticRegistry, 'testCheckA'> = { key: 'label', value: 'x' }
void _crossAuditKey

// (2i) mixed audit key/value: testCheckA's own 'sampleCount' key requires
// a number value, not a string.
// @ts-expect-error - 'sampleCount' requires a number, not a string
const _wrongAuditValueType: AuditFieldRefFor<SyntheticRegistry, 'testCheckA'> = { key: 'sampleCount', value: 'not-a-number' }
void _wrongAuditValueType

declare const classifyA: ClassifierFor<SyntheticRegistry, 'testCheckA'>
declare const evidenceEnvelopeA: NormalizedEvidenceFor<SyntheticRegistry, 'testCheckA'>
declare const evidenceEnvelopeB: NormalizedEvidenceFor<SyntheticRegistry, 'testCheckB'>
declare const contractA: CheckContractFor<SyntheticRegistry, 'testCheckA'>
declare const contractB: CheckContractFor<SyntheticRegistry, 'testCheckB'>

// (2j) cross-paired evidence and contract: a classifier pinned to
// testCheckA rejects being called with testCheckB's contract.
// @ts-expect-error - testCheckB's contract must not satisfy a classifier requiring testCheckA's contract
classifyA(evidenceEnvelopeA, contractB)

// (2k-limitation, disclosed, not a proof) generic-function inference CAN
// widen K to A | B and silently accept a mismatched pairing: a genuinely
// generic function (its own `<K extends ...>`) taking evidence and
// contract as TWO INDEPENDENT parameters lets TypeScript infer K as the
// full union to satisfy each parameter separately — since each parameter
// then independently becomes "testCheckA's shape | testCheckB's shape",
// and a single-check argument satisfies that union on its own, regardless
// of what the OTHER parameter's argument is. This next line is expected to
// compile successfully — it is not a bug in this proof, it is the
// documented reason `ClassificationInputFor` (classification.ts) exists.
declare function unsafeTwoParamPairing<K extends keyof SyntheticRegistry & string>(
  evidence: NormalizedEvidenceFor<SyntheticRegistry, K>,
  contract: CheckContractFor<SyntheticRegistry, K>
): ClassificationResultFor<SyntheticRegistry, K>
unsafeTwoParamPairing(evidenceEnvelopeA, contractB)

// (2k) generic-function inference attempting to widen K to A | B — the
// SAFE, bundled-single-parameter mitigation: a fresh object-literal
// argument is checked jointly against ClassificationInputFor's per-check
// branches, so inference correctly cannot unify K to satisfy testCheckA's
// evidence and testCheckB's contract simultaneously.
declare function safeBundledPairing<K extends keyof SyntheticRegistry & string>(
  input: ClassificationInputFor<SyntheticRegistry, K>
): ClassificationResultFor<SyntheticRegistry, K>
// @ts-expect-error - a fresh {evidence, contract} literal mixing testCheckA's evidence with testCheckB's contract must not satisfy any single branch of ClassificationInputFor
safeBundledPairing({ evidence: evidenceEnvelopeA, contract: contractB })

// (2l) an unregistered ID is rejected.
declare const unregisteredSyntheticId: 'testCheckC'
// @ts-expect-error - 'testCheckC' is not a member of the synthetic registry's check IDs
const _badSyntheticId: keyof SyntheticRegistry & string = unregisteredSyntheticId
void _badSyntheticId

// (2m) positive control: same-check pairings ARE constructible — if these
// ever fail to compile, the mechanism above has been over-constrained.
const _validPairing: ClassificationResultFor<SyntheticRegistry> = classifyA(evidenceEnvelopeA, contractA)
void _validPairing
const _validAuditRef: AuditFieldRefFor<SyntheticRegistry, 'testCheckB'> = { key: 'label', value: 'ok' }
void _validAuditRef
void evidenceEnvelopeB
