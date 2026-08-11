// Sub-patch 2a — NormalizedEvidence.
//
// `NormalizedEvidenceFor<Reg, K>` is a distributive conditional type, for
// the same union-correlation reason as `RawCaptureFor` (see
// checkSpecification.ts and rawCapture.ts's header comments).
// `NormalizedEvidence<K>` is the production convenience alias.

import type { ViewportName } from './rawCapture.js'
import type { CheckId, CheckRegistry, CheckRegistryShape } from './checkSpecification.js'

export const NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION = '1.0.0' as const

/**
 * Stage-2 (Evidence Normalizer, sub-patch 2b) output; stage-3
 * (Classification Engine, sub-patch 2b) input. No implementation of either
 * stage exists in 2a — this is the type shape only. Deliberately has NO
 * timestamp/provenance field at all: classification determinism requires
 * this to depend only on `payload`'s content, never on when or how it was
 * captured.
 */
export type NormalizedEvidenceFor<Reg extends CheckRegistryShape<Reg>, K extends keyof Reg & string = keyof Reg & string> = K extends unknown
  ? {
      envelopeSchemaVersion: typeof NORMALIZED_EVIDENCE_ENVELOPE_SCHEMA_VERSION
      checkId: K
      sourceCapturePayloadSchemaVersion: Reg[K]['captureSchemaVersion']
      evidenceSchemaVersion: Reg[K]['evidenceSchemaVersion']
      evidence: Reg[K]['evidence']
      viewportsPresent: ViewportName[]
      incompleteCoverage: Record<string, boolean>
    }
  : never

/** Production convenience alias, bound to the real `CheckRegistry`. */
export type NormalizedEvidence<K extends CheckId = CheckId> = NormalizedEvidenceFor<CheckRegistry, K>

/**
 * Opaque migration envelope: carries evidence whose schema version isn't
 * recognized by any current registry entry, for migration tooling only. It
 * is deliberately NOT structurally compatible with NormalizedEvidence<K>
 * for any K — a classifier's typed entry point cannot accept this, by
 * construction, not by convention. See __compileTimeChecks.ts.
 */
export interface UnrecognizedLegacyEvidence {
  schemaVersion: string
  opaque: true
  raw: unknown
}
