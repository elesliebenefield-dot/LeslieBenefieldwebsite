// Sub-patch 2b — trivial Findings Presenter, for the registered 'empty'
// scaffold only. The scaffold performed no real check, so this must not
// fabricate a visitor-facing finding just to populate a singular type —
// it returns an immutable, empty collection instead, which can truthfully
// represent "no finding" without inventing a label, standards claim, or
// recommendation.
//
// Sibling-independence rule: must NEVER import from
// ../audit/auditRecordBuilder.ts or ../types/auditRecord.ts, and must
// never consume an AuditRecord. See findings.ts and
// test/pipeline.siblingOutputs.test.ts / test/pipeline.importBoundaries.test.ts.

import type { ClassificationResult, StandardsBasis } from '../types/classification.js'
import type { VisitorFinding } from '../types/findings.js'

const EMPTY_FINDINGS: readonly VisitorFinding<'empty'>[] = Object.freeze([])

/** `_result` is required by the architecture (the Presenter's contract is
 *  "consumes a ClassificationResult"), even though the trivial empty case
 *  needs nothing from it to produce an empty collection — nothing about
 *  'empty' classification results (always `outcome: 'unverified'`, no
 *  evidence) ever changes what gets presented. */
export function presentEmptyFindings(_result: ClassificationResult<'empty'>): readonly VisitorFinding<'empty'>[] {
  return EMPTY_FINDINGS
}

// ─── First real checks: overflow, readability. Plain-English labels
// only — never a score, never a "compliant"/"passed" claim. `bucket`
// carries the same outcome for callers that need it structurally; the
// visitor-facing text is entirely in `label`/`detail`. Lead-prioritization
// wording, not an audit finding: "likely opportunity" means "worth
// reaching out about," not "this is broken."

const LABEL_BY_OUTCOME: Record<ClassificationResult['outcome'], string> = {
  improve: 'Likely opportunity',
  'manual-review-advisory': 'Worth a manual look',
  good: 'No clear issue found',
  unverified: "Couldn't be checked",
}

function standardsLabelFor(basis: StandardsBasis): string {
  return basis.type === 'standard' ? basis.citation : basis.rationale
}

export function presentOverflowFindings(result: ClassificationResult<'overflow'>): readonly VisitorFinding<'overflow'>[] {
  return Object.freeze([
    Object.freeze({
      checkId: 'overflow',
      label: LABEL_BY_OUTCOME[result.outcome],
      bucket: result.outcome,
      standardsLabel: standardsLabelFor(result.standardsBasis),
      detail: result.reasoning,
      viewportNote: 'Checked at mobile width (390px)',
    }),
  ])
}

export function presentReadabilityFindings(result: ClassificationResult<'readability'>): readonly VisitorFinding<'readability'>[] {
  return Object.freeze([
    Object.freeze({
      checkId: 'readability',
      label: LABEL_BY_OUTCOME[result.outcome],
      bucket: result.outcome,
      standardsLabel: standardsLabelFor(result.standardsBasis),
      detail: result.reasoning,
      viewportNote: 'Checked at mobile width (390px)',
    }),
  ])
}
