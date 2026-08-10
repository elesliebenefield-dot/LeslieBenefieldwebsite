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

import type { ClassificationResult } from '../types/classification.js'
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
