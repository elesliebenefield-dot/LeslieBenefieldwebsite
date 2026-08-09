// Sub-patch 2a — RawCapture: the versioned capture envelope.
//
// `RawCaptureFor<Reg, K>` is a distributive conditional type — see
// checkSpecification.ts's header comment for why this is required instead
// of a plain generic interface. `RawCapture<K>` is the production
// convenience alias bound to `CheckRegistry`; test-only code proves the
// general mechanism by instantiating `RawCaptureFor` against its own
// separate registry (see __compileTimeChecks.ts), not a hand-copied
// parallel type.
//
// `provenance` is structurally separate from `payload`: it describes the
// capture PROCESS (when/where/what viewport), never page content, and is
// never classifier-consumable evidence — see NormalizedEvidence, which has
// no provenance field at all, only what was derived from `payload`.
//
// `finalUrl` is recorded here as PROVENANCE ONLY — a plain string, not
// validated or asserted safe by this module. Network-safety authorization
// (SSRF/DNS-rebinding protection for whatever URL a Capture Service
// actually navigates to) is sub-patch 2d's unsolved design-spike scope
// (see threat-model.md) — this file makes no safety claim about it at all,
// syntactic or otherwise.

import type { CheckId, CheckRegistry, CheckRegistryShape } from './checkSpecification.js'

export type ViewportName = 'desktop' | 'tablet' | 'mobile' | 'narrow'

export interface Viewport {
  name: ViewportName
  width: number
  height: number
}

export const RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION = '1.0.0' as const

/**
 * Provenance is infrastructure metadata about the capture itself, never
 * page content and never classifier-consumable. `capturedAt` in particular
 * must never be read downstream of capture (determinism, PRD Criterion
 * #7): classification must depend only on `payload`'s content, never on
 * when it was captured.
 */
export interface CaptureProvenance {
  capturedAt: string
  viewport: Viewport
  finalUrl: string
}

export type RawCaptureFor<Reg extends CheckRegistryShape<Reg>, K extends keyof Reg & string = keyof Reg & string> = K extends unknown
  ? {
      envelopeSchemaVersion: typeof RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION
      checkId: K
      payloadSchemaVersion: Reg[K]['captureSchemaVersion']
      provenance: CaptureProvenance
      payload: Reg[K]['capturePayload']
      incompleteCoverage: Record<string, boolean>
    }
  : never

/** Production convenience alias, bound to the real `CheckRegistry`. */
export type RawCapture<K extends CheckId = CheckId> = RawCaptureFor<CheckRegistry, K>
