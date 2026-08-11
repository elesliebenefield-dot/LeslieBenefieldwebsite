// Sub-patch 2a — oracle comparability governance types only. No adapter,
// no axe-core/Lighthouse execution, no comparison-mapping FUNCTION
// (`architecture-dependency-map.md`'s file layout places that logic in
// sub-patch 2e's `comparisonMapper.ts`, not 2a's `types.ts`).
//
// Corrected scope (second correction pass): the first design also carried
// `OracleToolResult`/`OpaqueOracleRawPayload<Tool>` with a publicly
// readable `raw: unknown` field — branding it `__opaque` did not actually
// stop code from reading or forwarding that value, so the "opaque" comment
// overstated the guarantee. Per the review's preferred option, 2a now
// defines only what genuinely belongs in the core contracts — tool
// identity, target descriptors, comparability inputs, manual WAVE
// evidence, and the comparison-result union below. Tool-specific raw
// output, parsing, normalized findings, and executable adapter-result
// types are deferred entirely to sub-patch 2e, which owns validating them.
//
// WAVE is NOT a member of OracleTool (the set of tools this codebase can
// actually execute) — it is manual-only, never automated (patch.md Phase
// 8, decided). ManualToolEvidence represents it as a structurally separate,
// non-executable evidence kind.

import type { CheckId } from '../../pipeline/types/checkSpecification.js'
import type { ViewportName } from '../../pipeline/types/rawCapture.js'

/** The only tools this codebase can actually execute. */
export type OracleTool = 'axe-core' | 'lighthouse'

/** WAVE is manual/unavailable only — structurally separate from
 *  OracleTool so it can never be treated as something this codebase runs. */
export interface ManualToolEvidence {
  tool: 'wave'
  status: 'manual-only'
  note: string
}

export type OracleTargetDescriptor =
  | { kind: 'fixture'; fixtureId: string; fixtureVersion: string }
  | { kind: 'live'; url: string; captureTimeWindow: string; finalUrl: string; contentFingerprint: string }

export type ComparabilityEvidence =
  | {
      kind: 'controlled-fixture'
      fixtureId: string
      fixtureVersion: string
      environmentFingerprint: string
      viewport: ViewportName
      toolVersion: string
    }
  | {
      kind: 'live'
      finalUrl: string
      viewport: ViewportName
      captureTimeWindow: string
      contentFingerprint: string
      environmentFingerprint: string
      toolVersion: string
    }
  | { kind: 'insufficient'; reason: string }

export type ComparisonOutcome = 'agreement' | 'disagreement' | 'inconclusive'

/**
 * Corrected design: previously a flat `{ comparability: ComparabilityEvidence;
 * outcome: ComparisonOutcome }` shape permitted constructing
 * `{ comparability: { kind: 'insufficient' }, outcome: 'agreement' }`
 * directly — nothing in the TYPE stopped it; only a hypothetical future
 * smart constructor would have. This is now a discriminated union keyed on
 * `comparability.kind` itself: only three combinations are constructible —
 * controlled-fixture/live comparability paired with agreement or
 * disagreement, and insufficient comparability paired ONLY with
 * inconclusive. The invalid combination is rejected by object-literal
 * assignability against this union directly, with no constructor function
 * involved at all (there is no runtime code in 2a that builds one — that's
 * sub-patch 2e). See __compileTimeChecks.ts for the negative proofs.
 */
export type OracleComparisonResult =
  | {
      checkId: CheckId
      tool: OracleTool
      comparability: Extract<ComparabilityEvidence, { kind: 'controlled-fixture' }>
      outcome: 'agreement' | 'disagreement'
      resolutionNote?: string
    }
  | {
      checkId: CheckId
      tool: OracleTool
      comparability: Extract<ComparabilityEvidence, { kind: 'live' }>
      outcome: 'agreement' | 'disagreement'
      resolutionNote?: string
    }
  | {
      checkId: CheckId
      tool: OracleTool
      comparability: Extract<ComparabilityEvidence, { kind: 'insufficient' }>
      outcome: 'inconclusive'
      resolutionNote?: string
    }
