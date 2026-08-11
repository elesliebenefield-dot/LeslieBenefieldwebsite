// Sub-patch 2b — trivial Audit Record Builder, for the registered 'empty'
// scaffold only. The empty contract's audit-field allowlist is
// `Record<never, never>` (checkSpecification.ts) — there is nothing
// auditable, so this builder does not accept a `NormalizedEvidence`
// parameter at all: there is no field it could ever legally resolve a
// reference from, and accepting the full evidence object "just in case"
// would be exactly the untyped/unminimized surface 2a's design closed off.
//
// Sibling-independence rule: must NEVER import from
// ../present/findingsPresenter.ts or ../types/findings.ts, and must never
// consume a VisitorFinding. No persistence of any kind here (no fs, no
// db, no module-level retention) — see test/pipeline.noPersistence.test.ts.

import type { ClassificationResult, StandardsBasis } from '../types/classification.js'
import type { AuditRecord } from '../types/auditRecord.js'

export type AuditMetadataFailure = { kind: 'empty-request-id' } | { kind: 'empty-rule-identifier'; index: number }

export type BuildEmptyAuditRecordResult = { ok: true; value: AuditRecord<'empty'> } | { ok: false; error: AuditMetadataFailure }

/** See classificationEngine.ts's identical helper — kept as its own local
 *  copy here rather than a shared import, so this module's only pipeline-
 *  type dependency stays `../types/*`, per its own import-boundary rule. */
function cloneStandardsBasis(basis: StandardsBasis): StandardsBasis {
  return basis.type === 'standard' ? { type: 'standard', citation: basis.citation } : { type: 'product-policy', rationale: basis.rationale }
}

/**
 * A string that is empty OR contains only whitespace is treated as blank
 * — rejected, not silently trimmed and accepted. The ORIGINAL string
 * (with any surrounding whitespace) is what gets stored when it passes;
 * this function only decides accept/reject, it never rewrites the value.
 */
function isBlank(value: string): boolean {
  return value.trim().length === 0
}

/**
 * `requestId` and `rulesApplied` are the only request-scoped metadata the
 * approved `AuditRecord<'empty'>` type needs beyond the classification
 * result itself. Both are validated (non-blank request ID; no blank rule
 * identifiers — blank meaning empty OR whitespace-only) because
 * TypeScript's `string`/`string[]` types alone can't rule either out at
 * compile time.
 */
export function buildEmptyAuditRecord(classification: ClassificationResult<'empty'>, requestId: string, rulesApplied: readonly string[]): BuildEmptyAuditRecordResult {
  if (isBlank(requestId)) {
    return { ok: false, error: { kind: 'empty-request-id' } }
  }
  for (let i = 0; i < rulesApplied.length; i++) {
    if (isBlank(rulesApplied[i])) {
      return { ok: false, error: { kind: 'empty-rule-identifier', index: i } }
    }
  }

  return {
    ok: true,
    value: {
      checkId: classification.checkId,
      contractVersion: classification.contractVersion,
      // Structurally incapable of holding a reference: 'empty's audit-key
      // type is `never` (checkSpecification.ts), so `[]` is the only
      // value this field can ever take — not a runtime choice.
      auditFieldRefs: [],
      // Reconstructed fresh field-by-field — including a freshly cloned
      // standardsBasis (see cloneStandardsBasis above) — not the caller's
      // own classification object, so mutating that object afterward
      // cannot alter this audit record. `reasoning` lives only here, on
      // the embedded ClassificationResult: AuditRecord itself has no
      // separate top-level `reasoning` field (corrected — see
      // ../types/auditRecord.ts).
      classificationResult: {
        checkId: classification.checkId,
        contractVersion: classification.contractVersion,
        outcome: classification.outcome,
        standardsBasis: cloneStandardsBasis(classification.standardsBasis),
        evidenceRefs: [...classification.evidenceRefs],
        reasoning: classification.reasoning,
      },
      rulesApplied: [...rulesApplied],
      requestId,
    },
  }
}
