// Sub-patch 2a — compile-time negative-case proofs for
// OracleComparisonResult's tied discriminated union. Never imported by any
// production or test module; enforced solely by `npx tsc --noEmit`.
//
// Unlike the first correction pass (which only proved a hypothetical
// `decide()` callback couldn't be called with insufficient comparability),
// these proofs construct OracleComparisonResult object literals DIRECTLY —
// the type itself must reject the invalid combination, with no
// constructor function involved at all.

import type { ComparabilityEvidence, OracleComparisonResult } from './types.js'

declare const insufficientComparability: Extract<ComparabilityEvidence, { kind: 'insufficient' }>
declare const fixtureComparability: Extract<ComparabilityEvidence, { kind: 'controlled-fixture' }>
declare const liveComparability: Extract<ComparabilityEvidence, { kind: 'live' }>

// (1) insufficient comparability + 'agreement' is not a valid OracleComparisonResult.
// @ts-expect-error - insufficient comparability must never pair with 'agreement'
const _insufficientAgreement: OracleComparisonResult = { checkId: 'empty', tool: 'axe-core', comparability: insufficientComparability, outcome: 'agreement' }
void _insufficientAgreement

// (2) insufficient comparability + 'disagreement' is not a valid OracleComparisonResult.
// @ts-expect-error - insufficient comparability must never pair with 'disagreement'
const _insufficientDisagreement: OracleComparisonResult = { checkId: 'empty', tool: 'axe-core', comparability: insufficientComparability, outcome: 'disagreement' }
void _insufficientDisagreement

// (3) controlled-fixture comparability + 'inconclusive' is not valid — complete
// comparability must resolve to an actual agreement/disagreement outcome.
// @ts-expect-error - controlled-fixture comparability must never pair with 'inconclusive'
const _fixtureInconclusive: OracleComparisonResult = { checkId: 'empty', tool: 'axe-core', comparability: fixtureComparability, outcome: 'inconclusive' }
void _fixtureInconclusive

// (4) live comparability + 'inconclusive' is not valid, for the same reason.
// @ts-expect-error - live comparability must never pair with 'inconclusive'
const _liveInconclusive: OracleComparisonResult = { checkId: 'empty', tool: 'axe-core', comparability: liveComparability, outcome: 'inconclusive' }
void _liveInconclusive

// (5) valid combinations, confirmed constructible (positive control — if
// these ever fail to compile, the union above has been over-constrained).
const _fixtureAgreement: OracleComparisonResult = { checkId: 'empty', tool: 'axe-core', comparability: fixtureComparability, outcome: 'agreement' }
void _fixtureAgreement
const _liveDisagreement: OracleComparisonResult = { checkId: 'empty', tool: 'lighthouse', comparability: liveComparability, outcome: 'disagreement' }
void _liveDisagreement
const _insufficientInconclusive: OracleComparisonResult = { checkId: 'empty', tool: 'axe-core', comparability: insufficientComparability, outcome: 'inconclusive' }
void _insufficientInconclusive
