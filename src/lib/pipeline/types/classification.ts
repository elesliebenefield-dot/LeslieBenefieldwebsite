// Sub-patch 2a — CheckContract and ClassificationResult.
//
// Distributive conditional types, for the same union-correlation reason as
// RawCaptureFor/NormalizedEvidenceFor (see checkSpecification.ts).
//
// No `weight`/`scoreContribution` field: the approved plan's own Phase 5
// text marks both as conditional — "present only if/when scoring is
// retained" — not a current requirement. Milestone 2 makes no scoring
// decision and the Score Aggregator remains structurally absent (Rule #8);
// these fields are introduced with that later scoring gate, not made
// casually available now.

import type { CheckId, CheckRegistry, CheckRegistryShape, AuditFieldKeyFor } from './checkSpecification.js'
import type { NormalizedEvidenceFor } from './normalizedEvidence.js'

export type StandardsBasis =
  | { type: 'standard'; citation: string }
  | { type: 'product-policy'; rationale: string }

export type CheckContractFor<Reg extends CheckRegistryShape<Reg>, K extends keyof Reg & string = keyof Reg & string> = K extends unknown
  ? {
      id: K
      version: Reg[K]['contractVersion']
      claim: string
      standardsBasis: StandardsBasis
      /** The subset of this check's own registered audit-field keys the
       *  contract declares it may need — never another check's keys,
       *  never an arbitrary string. `never[]` (i.e. only `[]`) for a check
       *  whose `auditFields` is `Record<never, never>`. `readonly` so a
       *  genuinely frozen array (see contractRegistry.ts) can be assigned
       *  here without a cast — a registered contract is immutable data. */
      requiredEvidenceFields: readonly AuditFieldKeyFor<Reg, K>[]
    }
  : never

/** Production convenience alias, bound to the real `CheckRegistry`. */
export type CheckContract<K extends CheckId = CheckId> = CheckContractFor<CheckRegistry, K>

export type ClassificationOutcome = 'good' | 'improve' | 'manual-review-advisory' | 'unverified'

/**
 * `evidenceRefs` lists which of THIS check's own registered audit-field
 * keys were actually relied on to reach `outcome` — this is the sole input
 * a future Audit Record Builder (sub-patch 2b) may use to decide what
 * evidence is worth referencing. A key not registered for this check
 * cannot appear here at all (compile-time), so it can never appear in an
 * AuditRecord either.
 */
export type ClassificationResultFor<Reg extends CheckRegistryShape<Reg>, K extends keyof Reg & string = keyof Reg & string> = K extends unknown
  ? {
      checkId: K
      contractVersion: Reg[K]['contractVersion']
      outcome: ClassificationOutcome
      standardsBasis: StandardsBasis
      evidenceRefs: AuditFieldKeyFor<Reg, K>[]
      reasoning: string
    }
  : never

/** Production convenience alias, bound to the real `CheckRegistry`. */
export type ClassificationResult<K extends CheckId = CheckId> = ClassificationResultFor<CheckRegistry, K>

/**
 * Type shape only — no implementation exists in 2a (a real classifier is
 * sub-patch 2b's pure pipeline skeleton, or a real check's own classifier
 * from Milestone 3+ onward). Built from the same correlation-preserving
 * `NormalizedEvidenceFor`/`CheckContractFor`/`ClassificationResultFor`
 * types, so a `ClassifierFor<Reg, K>` bound to one concrete, already-known K
 * (e.g. `Classifier<'empty'>`, K fixed at the declaration site, not
 * inferred) only ever accepts/returns that K's own shapes — this is 2a's
 * only actual usage pattern.
 *
 * Two independent parameters are NOT safe if some FUTURE function instead
 * makes K itself a type parameter to be INFERRED from the call site
 * (rather than a fixed literal): TypeScript's inference can widen K to the
 * full check-ID union to satisfy each parameter independently, silently
 * accepting a call whose evidence and contract belong to different checks
 * — see __compileTimeChecks.ts's proof (2k)/(2k-limitation) for a
 * demonstrated counter-example and mitigation.
 */
export type ClassifierFor<Reg extends CheckRegistryShape<Reg>, K extends keyof Reg & string> = (
  evidence: NormalizedEvidenceFor<Reg, K>,
  contract: CheckContractFor<Reg, K>
) => ClassificationResultFor<Reg, K>

/** Production convenience alias, bound to the real `CheckRegistry`. */
export type Classifier<K extends CheckId> = ClassifierFor<CheckRegistry, K>

/**
 * The correlation-SAFE way for any FUTURE generic function to accept
 * evidence+contract together under one INFERRED K: bundle them into a
 * single object parameter rather than two independent ones. A fresh
 * object-literal argument is checked jointly against this type's
 * per-check branches, so a mismatched evidence/contract pairing is
 * rejected even under generic inference — unlike two separate parameters,
 * which inference can satisfy independently by widening K. See
 * __compileTimeChecks.ts's proof (2k).
 */
export type ClassificationInputFor<Reg extends CheckRegistryShape<Reg>, K extends keyof Reg & string = keyof Reg & string> = K extends unknown
  ? { evidence: NormalizedEvidenceFor<Reg, K>; contract: CheckContractFor<Reg, K> }
  : never

/** Production convenience alias, bound to the real `CheckRegistry`. */
export type ClassificationInput<K extends CheckId = CheckId> = ClassificationInputFor<CheckRegistry, K>
